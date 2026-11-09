import net from 'node:net';
import tls from 'node:tls';

import {
  ImapMailboxClient,
  buildImapOptions,
  fetchUnreadHeaders,
  messageFromEnvelope,
  presetTarget,
} from '../clients/imap-client';
import { FORBIDDEN_IMAP_VERBS, MAIL_PRESETS, MAIL_TIMEOUT_MS } from '../limits';

const PASSWORD = 's3cret-app-password';
const USERNAME = 'user@example.com';

type ScriptedAddress = { name: string; mailbox: string; host: string };
type ScriptedMessage = {
  uid: number;
  date: string;
  subject: string;
  from: ScriptedAddress;
  to: ScriptedAddress[];
};

function imapString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function addressList(addresses: ScriptedAddress[]): string {
  if (addresses.length === 0) {
    return 'NIL';
  }
  const items = addresses.map((address) => `(${imapString(address.name)} NIL ${imapString(address.mailbox)} ${imapString(address.host)})`);
  return `(${items.join('')})`;
}

function envelopeOf(message: ScriptedMessage): string {
  return `(${imapString(message.date)} ${imapString(message.subject)} ${addressList([message.from])} NIL NIL ${addressList(message.to)} NIL NIL NIL NIL)`;
}

function fetchSetsSeen(command: string): boolean {
  const withoutPeek = command.replace(/BODY\.PEEK\[/g, '');
  return /BODY\[/.test(withoutPeek) || /RFC822(?!\.SIZE)\b/.test(command);
}

function expandUidSet(spec: string): number[] | null {
  if (spec.includes('*')) {
    return null;
  }
  const uids: number[] = [];
  for (const part of spec.split(',')) {
    if (part.includes(':')) {
      const [rawStart, rawEnd] = part.split(':');
      const start = Number(rawStart);
      const end = Number(rawEnd);
      for (let uid = Math.min(start, end); uid <= Math.max(start, end); uid += 1) {
        uids.push(uid);
      }
    } else {
      const uid = Number(part);
      if (Number.isFinite(uid)) {
        uids.push(uid);
      }
    }
  }
  return uids;
}

function parseLogin(rest: string): { user: string; pass: string } {
  const body = rest.replace(/^LOGIN\s+/i, '');
  const tokens: string[] = [];
  const pattern = /"([^"]*)"|(\S+)/g;
  let match = pattern.exec(body);
  while (match) {
    tokens.push(match[1] ?? match[2]);
    match = pattern.exec(body);
  }
  return { user: tokens[0] || '', pass: tokens[1] || '' };
}

function startScriptedImap(messages: ScriptedMessage[], loginResponse?: (user: string, pass: string) => string): Promise<{
  port: number;
  commands: string[];
  close: () => Promise<void>;
}> {
  const commands: string[] = [];
  const sockets = new Set<net.Socket>();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    let buffer = '';
    let idleTag = '';
    const write = (chunk: string | Buffer) => {
      if (!socket.destroyed) {
        socket.write(chunk);
      }
    };
    const respond = (line: string) => {
      const match = line.match(/^(\S+)\s+([\s\S]*)$/);
      if (!match) {
        return;
      }
      const tag = match[1];
      const rest = match[2];
      const upper = rest.toUpperCase();
      const recorded = upper.startsWith('LOGIN ') ? 'LOGIN' : upper;
      commands.push(recorded);
      const verb = upper.split(/\s+/)[0];
      if (verb === 'CAPABILITY') {
        write(`* CAPABILITY IMAP4rev1\r\n${tag} OK CAPABILITY completed\r\n`);
        return;
      }
      if (verb === 'LOGIN') {
        const parsed = parseLogin(rest);
        const status = loginResponse ? loginResponse(parsed.user, parsed.pass) : 'OK LOGIN completed';
        write(`${tag} ${status}\r\n`);
        return;
      }
      if (verb === 'LIST') {
        if (upper.includes('INBOX')) {
          write(`* LIST (\\HasNoChildren) "/" "INBOX"\r\n${tag} OK LIST completed\r\n`);
        } else {
          write(`* LIST (\\Noselect) "/" ""\r\n${tag} OK LIST completed\r\n`);
        }
        return;
      }
      if (verb === 'EXAMINE' || verb === 'SELECT') {
        write(`* FLAGS (\\Seen \\Answered \\Flagged \\Deleted \\Draft)\r\n`);
        write(`* ${messages.length} EXISTS\r\n`);
        write(`* 0 RECENT\r\n`);
        write(`* OK [UIDVALIDITY 1] UIDs valid\r\n`);
        write(`* OK [UIDNEXT ${messages.length + 1}] Predicted next UID\r\n`);
        write(`* OK [PERMANENTFLAGS ()] No permanent flags\r\n`);
        write(`${tag} OK [READ-ONLY] completed\r\n`);
        return;
      }
      if (verb === 'UID' && upper.startsWith('UID SEARCH')) {
        write(`* SEARCH ${messages.map((message) => message.uid).join(' ')}\r\n${tag} OK SEARCH completed\r\n`);
        return;
      }
      if (verb === 'UID' && upper.startsWith('UID FETCH')) {
        const setMatch = rest.match(/^UID\s+FETCH\s+([^\s(]+)/i);
        const requested = setMatch ? expandUidSet(setMatch[1]) : null;
        const chosen = messages.filter((message) => !requested || requested.includes(message.uid));
        chosen.forEach((message, index) => {
          write(`* ${index + 1} FETCH (UID ${message.uid} ENVELOPE ${envelopeOf(message)})\r\n`);
        });
        write(`${tag} OK FETCH completed\r\n`);
        return;
      }
      if (verb === 'IDLE') {
        idleTag = tag;
        write('+ idling\r\n');
        return;
      }
      if (verb === 'LOGOUT') {
        write(`* BYE\r\n${tag} OK LOGOUT completed\r\n`);
        socket.end();
        return;
      }
      write(`${tag} OK completed\r\n`);
    };
    write('* OK IMAP4rev1 ready\r\n');
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let split = buffer.indexOf('\r\n');
      while (split >= 0) {
        const line = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        if (line.toUpperCase() === 'DONE' && idleTag) {
          commands.push('DONE');
          write(`${idleTag} OK IDLE completed\r\n`);
          idleTag = '';
        } else if (line) {
          respond(line);
        }
        split = buffer.indexOf('\r\n');
      }
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('scripted IMAP did not bind'));
        return;
      }
      resolve({
        port: address.port,
        commands,
        close: () => new Promise((done) => {
          for (const socket of sockets) {
            socket.destroy();
          }
          server.close(() => done());
        }),
      });
    });
  });
}

function commandVerbs(command: string): string[] {
  const parts = command.split(/\s+/).filter(Boolean);
  const verbs = [parts[0]];
  if (parts[0] === 'UID' && parts[1]) {
    verbs.push(parts[1]);
  }
  return verbs;
}

describe('IMAP read-only metadata', () => {
  const logs: string[] = [];
  let spies: Array<jest.SpyInstance> = [];

  beforeEach(() => {
    logs.length = 0;
    spies = (['log', 'info', 'warn', 'error'] as const).map((method) => jest.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      logs.push(args.map((arg) => String(arg)).join(' '));
    }));
  });

  afterEach(() => {
    for (const spy of spies) {
      spy.mockRestore();
    }
  });

  it('opens only the preset hosts on 993 with TLS certificate checks', () => {
    expect(presetTarget('gmail')).toEqual({
      host: MAIL_PRESETS.gmail,
      port: 993,
      secure: true,
      rejectUnauthorized: true,
    });
    expect(presetTarget('yahoo').host).toBe('imap.mail.yahoo.com');
    expect(presetTarget('icloud').host).toBe('imap.mail.me.com');
    const options = buildImapOptions(presetTarget('gmail'), { username: USERNAME, appPassword: PASSWORD }, MAIL_TIMEOUT_MS);
    expect(options.host).toBe('imap.gmail.com');
    expect(options.port).toBe(993);
    expect(options.secure).toBe(true);
    expect(options.tls).toEqual({ rejectUnauthorized: true });
    expect(options.logger).toBe(false);
    expect(options.connectionTimeout).toBe(20_000);
    expect(options.greetingTimeout).toBe(20_000);
    expect(options.socketTimeout).toBe(20_000);
  });

  it('rejects an unknown preset before opening a socket', async () => {
    const tlsConnect = jest.spyOn(tls, 'connect');
    const netConnect = jest.spyOn(net, 'connect');
    const client = new ImapMailboxClient();
    await expect(client.listUnread({
      preset: 'other',
      username: USERNAME,
      appPassword: PASSWORD,
    })).rejects.toThrow(/preset/);
    expect(tlsConnect).not.toHaveBeenCalled();
    expect(netConnect).not.toHaveBeenCalled();
    tlsConnect.mockRestore();
    netConnect.mockRestore();
  });

  it('uses EXAMINE and an envelope fetch and never a forbidden verb', async () => {
    const messages: ScriptedMessage[] = [
      {
        uid: 4,
        date: 'Mon, 09 Nov 2026 01:00:00 +0000',
        subject: 'Hello',
        from: { name: 'Ada Lovelace', mailbox: 'ada', host: 'example.com' },
        to: [
          { name: 'Bo', mailbox: 'bo', host: 'example.com' },
          { name: 'Cy', mailbox: 'cy', host: 'example.com' },
        ],
      },
      {
        uid: 9,
        date: 'Mon, 09 Nov 2026 02:00:00 +0000',
        subject: '=?UTF-8?B?5pyD6K2w?=',
        from: { name: '=?UTF-8?Q?=E7=8E=8B=E5=B0=8F=E6=98=8E?=', mailbox: 'wang', host: 'example.com' },
        to: [{ name: 'Ada', mailbox: 'ada', host: 'example.com' }],
      },
    ];
    const imap = await startScriptedImap(messages);
    try {
      const listed = await fetchUnreadHeaders({
        host: '127.0.0.1',
        port: imap.port,
        secure: false,
        rejectUnauthorized: true,
        doSTARTTLS: false,
      }, { username: USERNAME, appPassword: PASSWORD }, 25, 5_000);
      expect(listed.map((message) => message.id)).toEqual(['9', '4']);
      expect(listed[1]).toMatchObject({
        from: { name: 'Ada Lovelace', address: 'ada@example.com' },
        toCount: 2,
        subject: 'Hello',
        date: '2026-11-09T01:00:00.000Z',
      });
      expect(listed[0].subject).toBe('會議');
      expect(listed[0].from).toEqual({ name: '王小明', address: 'wang@example.com' });
      expect(listed[0].toCount).toBe(1);

      const verbs = imap.commands.flatMap(commandVerbs);
      expect(verbs).toContain('EXAMINE');
      expect(imap.commands.some((command) => command.includes('ENVELOPE'))).toBe(true);
      expect(imap.commands.some((command) => command.includes('UNSEEN'))).toBe(true);
      expect(imap.commands.filter(fetchSetsSeen)).toEqual([]);
      for (const forbidden of FORBIDDEN_IMAP_VERBS) {
        expect(verbs).not.toContain(forbidden);
      }
      expect(logs.join('\n')).not.toContain(PASSWORD);
      expect(logs.join('\n')).not.toContain(USERNAME);
    } finally {
      await imap.close();
    }
  });

  it('does not keep the app password or put it in an error', async () => {
    const first = await startScriptedImap([], (_user, pass) => `NO failed ${pass}`);
    const second = await startScriptedImap([], (user, pass) => (
      user === 'other@example.com' && pass === 'second-app-password' ? 'OK LOGIN completed' : 'NO wrong credentials'
    ));
    try {
      const error = await fetchUnreadHeaders({
        host: '127.0.0.1',
        port: first.port,
        secure: false,
        rejectUnauthorized: true,
        doSTARTTLS: false,
      }, { username: USERNAME, appPassword: PASSWORD }, 25, 5_000).then(() => null, (caught) => caught);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).not.toContain(PASSWORD);
      expect(error.message).not.toContain(USERNAME);
      expect(logs.join('\n')).not.toContain(PASSWORD);

      await fetchUnreadHeaders({
        host: '127.0.0.1',
        port: second.port,
        secure: false,
        rejectUnauthorized: true,
        doSTARTTLS: false,
      }, { username: 'other@example.com', appPassword: 'second-app-password' }, 1, 5_000);
      expect(second.commands.filter((command) => command === 'LOGIN')).toHaveLength(1);
      expect(first.commands).not.toEqual(expect.arrayContaining([expect.stringContaining(PASSWORD)]));
    } finally {
      await first.close();
      await second.close();
    }
  });
});

describe('envelope text limits', () => {
  it('drops control characters and cuts the subject, from name, and address at 300 characters', () => {
    const message = messageFromEnvelope(3, {
      date: 'not a date',
      subject: `\u0001${'Z'.repeat(350)}\u007f`,
      from: [{
        name: `\u0007${'N'.repeat(350)}`,
        address: `\u0008${'a'.repeat(350)}@example.com`,
      }],
      to: [
        { name: 'Bo', address: 'bo@example.com' },
        { name: 'Cy', address: 'cy@example.com' },
      ],
    });
    expect(message.subject).toBe('Z'.repeat(300));
    expect(message.from.name).toBe('N'.repeat(300));
    expect(message.from.address).toBe('a'.repeat(300));
    expect(`${message.subject}${message.from.name}${message.from.address}`).not.toMatch(/[\u0000-\u001F\u007F]/);
    expect(message.date).toBe('not a date');
    expect(message.toCount).toBe(2);
    expect(message.id).toBe('3');
  });
});
