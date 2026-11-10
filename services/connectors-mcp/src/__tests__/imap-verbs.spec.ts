import net from 'node:net';
import tls from 'node:tls';

import {
  ImapMailboxClient,
  buildImapOptions,
  fetchUnreadHeaders,
  messageFromEnvelope,
  presetTarget,
  type UnreadMessage,
} from '../clients/imap-client';
import { FORBIDDEN_IMAP_VERBS, MAIL_PRESETS, MAIL_TIMEOUT_MS, MAX_BODY_CHARS, MAX_BODY_FETCH_BYTES } from '../limits';

const PASSWORD = 's3cret-app-password';
const USERNAME = 'user@example.com';

type ScriptedAddress = { name: string; mailbox: string; host: string };
type ScriptedMessage = {
  uid: number;
  date: string;
  subject: string;
  from: ScriptedAddress;
  to: ScriptedAddress[];
  /** CONN-03: raw BODYSTRUCTURE; a one-part text/plain structure when absent. */
  structure?: string;
  /** CONN-03: body section contents by section, for example { '1': '...' }. */
  parts?: Record<string, string | Buffer>;
};

type ScriptedOptions = {
  loginResponse?: (user: string, pass: string) => string;
  /** CONN-03: answer every BODY.PEEK fetch with NO. */
  failBodyFetch?: boolean;
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

const DEFAULT_STRUCTURE = '("TEXT" "PLAIN" ("CHARSET" "UTF-8") NIL NIL "7BIT" 0 0)';

function textPart(subtype: string, charset: string, encoding: string, size: number): string {
  return `("TEXT" "${subtype}" ("CHARSET" "${charset}") NIL NIL "${encoding}" ${size} 1)`;
}

function multipart(subtype: string, children: string[]): string {
  return `(${children.join('')} "${subtype}")`;
}

const TEXT_ATTACHMENT = '("TEXT" "PLAIN" ("CHARSET" "UTF-8" "NAME" "notes.txt") NIL NIL "7BIT" 40 1 NIL ("ATTACHMENT" ("FILENAME" "notes.txt")) NIL NIL)';
const PDF_ATTACHMENT = '("APPLICATION" "PDF" ("NAME" "report.pdf") NIL NIL "BASE64" 5000 NIL ("ATTACHMENT" ("FILENAME" "report.pdf")) NIL NIL)';
const INLINE_IMAGE = '("IMAGE" "PNG" NIL "<img1>" NIL "BASE64" 2000 NIL ("INLINE" NIL) NIL NIL)';

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

function startScriptedImap(messages: ScriptedMessage[], loginOrOptions?: ScriptedOptions['loginResponse'] | ScriptedOptions): Promise<{
  port: number;
  commands: string[];
  /** CONN-03: bytes of every body section literal the server sent. */
  bodyLiteralBytes: number[];
  close: () => Promise<void>;
}> {
  const options: ScriptedOptions = typeof loginOrOptions === 'function' ? { loginResponse: loginOrOptions } : (loginOrOptions || {});
  const loginResponse = options.loginResponse;
  const commands: string[] = [];
  const bodyLiteralBytes: number[] = [];
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
        const section = rest.match(/BODY\.PEEK\[([^\]]*)\](?:<(\d+)\.(\d+)>)?/i);
        if (section) {
          if (options.failBodyFetch) {
            write(`${tag} NO [SERVERBUG] body fetch failed\r\n`);
            return;
          }
          const start = Number(section[2] || 0);
          const length = section[3] === undefined ? Number.MAX_SAFE_INTEGER : Number(section[3]);
          chosen.forEach((message, index) => {
            const content = message.parts?.[section[1]];
            if (content === undefined) {
              return;
            }
            const bytes = (Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8')).subarray(start, start + length);
            bodyLiteralBytes.push(bytes.length);
            const origin = section[2] === undefined ? '' : `<${start}>`;
            write(`* ${index + 1} FETCH (UID ${message.uid} BODY[${section[1]}]${origin} {${bytes.length}}\r\n`);
            write(bytes);
            write(')\r\n');
          });
          write(`${tag} OK FETCH completed\r\n`);
          return;
        }
        const wantsStructure = upper.includes('BODYSTRUCTURE');
        chosen.forEach((message, index) => {
          const structure = wantsStructure ? ` BODYSTRUCTURE ${message.structure || DEFAULT_STRUCTURE}` : '';
          write(`* ${index + 1} FETCH (UID ${message.uid} ENVELOPE ${envelopeOf(message)}${structure})\r\n`);
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
        bodyLiteralBytes,
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

describe('CONN-03 mail body excerpts', () => {
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

  const ADA: ScriptedAddress = { name: 'Ada Lovelace', mailbox: 'ada', host: 'example.com' };
  const BO: ScriptedAddress = { name: 'Bo', mailbox: 'bo', host: 'example.com' };

  function scripted(uid: number, extra: Partial<ScriptedMessage>): ScriptedMessage {
    return {
      uid,
      date: 'Mon, 09 Nov 2026 01:00:00 +0000',
      subject: `Message ${uid}`,
      from: ADA,
      to: [BO],
      ...extra,
    };
  }

  function localTarget(port: number) {
    return { host: '127.0.0.1', port, secure: false, rejectUnauthorized: true, doSTARTTLS: false as const };
  }

  async function listWith(messages: ScriptedMessage[], options?: ScriptedOptions) {
    const imap = await startScriptedImap(messages, options);
    try {
      const listed = await fetchUnreadHeaders(localTarget(imap.port), { username: USERNAME, appPassword: PASSWORD }, 25, 5_000);
      return { listed, commands: imap.commands, bodyLiteralBytes: imap.bodyLiteralBytes };
    } finally {
      await imap.close();
    }
  }

  function byId(listed: UnreadMessage[], id: number): UnreadMessage {
    const found = listed.find((message) => message.id === String(id));
    if (!found) {
      throw new Error(`message ${id} missing`);
    }
    return found;
  }

  /** Every BODY section asked for is BODY.PEEK with a partial of at most 16 KB, and no other verb is sent. */
  function expectOnlyPartialPeeks(commands: string[]) {
    for (const command of commands) {
      const sections = command.match(/BODY(\.PEEK)?\[[^\]]*\](<\d+\.\d+>)?/g) || [];
      for (const section of sections) {
        const match = section.match(/^BODY\.PEEK\[[0-9.]+\]<0\.(\d+)>$/);
        expect(match).not.toBeNull();
        expect(Number(match?.[1])).toBeLessThanOrEqual(MAX_BODY_FETCH_BYTES);
      }
      expect(command).not.toMatch(/RFC822(?!\.SIZE)/);
      expect(command).not.toMatch(/BINARY/);
    }
    expect(commands.filter(fetchSetsSeen)).toEqual([]);
    const verbs = commands.flatMap(commandVerbs);
    for (const verb of verbs) {
      // LIST and LSUB are the read-only folder lookup imapflow runs before EXAMINE; sent since CONN-01, not added here.
      expect(['CAPABILITY', 'LOGIN', 'LIST', 'LSUB', 'EXAMINE', 'UID', 'SEARCH', 'FETCH', 'NOOP', 'LOGOUT']).toContain(verb);
    }
    for (const forbidden of FORBIDDEN_IMAP_VERBS) {
      expect(verbs).not.toContain(forbidden);
    }
  }

  it('reads a plain part, HTML only, multipart with attachments, quoted-printable and base64 with BODY.PEEK partial fetches only', async () => {
    const qp = Buffer.from(
      'Hi Ada,\r\nThe quarterly report is ready=\r\n for review. Caf=C3=A9 at 3pm=E2=80=99s fine.\r\n\r\n> On Monday Bo wrote:\r\n> old quoted line\r\nThanks,\r\nBo\r\n',
      'latin1',
    );
    const html = '<html><head><title>T</title><style>p{color:red}</style></head><body><!-- tracking --><script>alert(1)</script>'
      + '<p>Invoice&nbsp;INV-2291 is <b>due</b> &amp; payable.</p><div>Line&#32;two &#x4E2D;&#25991;</div><ul><li>one</li><li>two</li></ul>Bye<br>Team</body></html>';
    const b64 = Buffer.from('Lunch at noon? 午餐見。\nSee you.', 'utf8').toString('base64').replace(/(.{20})/g, '$1\r\n');
    const messages: ScriptedMessage[] = [
      scripted(4, { structure: textPart('PLAIN', 'UTF-8', 'QUOTED-PRINTABLE', qp.length), parts: { '1': qp } }),
      scripted(9, {
        structure: multipart('MIXED', [
          TEXT_ATTACHMENT,
          `("MESSAGE" "RFC822" NIL NIL NIL "7BIT" 300 ${envelopeOf(scripted(1, {}))} ${textPart('PLAIN', 'UTF-8', '7BIT', 30)} 3)`,
          textPart('HTML', 'UTF-8', '7BIT', html.length),
          PDF_ATTACHMENT,
          INLINE_IMAGE,
        ]),
        parts: { '1': 'attachment text must not be read', '2': 'nested message must not be read', '3': html },
      }),
      scripted(12, {
        structure: multipart('MIXED', [
          multipart('ALTERNATIVE', [textPart('PLAIN', 'UTF-8', 'BASE64', b64.length), textPart('HTML', 'UTF-8', '7BIT', 20)]),
          PDF_ATTACHMENT,
        ]),
        parts: { '1.1': b64, '1.2': '<p>html twin</p>' },
      }),
      scripted(20, { structure: textPart('HTML', 'UTF-8', '7BIT', 28), parts: { '1': '<p>Only&nbsp;<i>HTML</i></p>' } }),
      scripted(21, { structure: multipart('MIXED', [PDF_ATTACHMENT, INLINE_IMAGE]), parts: { '1': 'never', '2': 'never' } }),
    ];
    const { listed, commands } = await listWith(messages);

    expect(listed.map((message) => message.id)).toEqual(['21', '20', '12', '9', '4']);
    expect(byId(listed, 4)).toMatchObject({
      subject: 'Message 4',
      from: { name: 'Ada Lovelace', address: 'ada@example.com' },
      bodyText: 'Hi Ada,\nThe quarterly report is ready for review. Café at 3pm’s fine.\nThanks,\nBo',
      bodyTruncated: false,
    });
    expect(byId(listed, 9)).toMatchObject({
      bodyText: 'Invoice INV-2291 is due & payable.\nLine two 中文\none\ntwo\nBye\nTeam',
      bodyTruncated: false,
    });
    expect(byId(listed, 12)).toMatchObject({ bodyText: 'Lunch at noon? 午餐見。\nSee you.', bodyTruncated: false });
    expect(byId(listed, 20)).toMatchObject({ bodyText: 'Only HTML', bodyTruncated: false });
    expect(byId(listed, 21)).toMatchObject({ bodyText: '', bodyTruncated: false });
    expect(JSON.stringify(listed)).not.toMatch(/must not be read|never|alert|tracking|color:red/);

    expect(commands.filter((command) => command.includes('BODY.PEEK'))).toEqual([
      'UID FETCH 4,20 (UID BODY.PEEK[1]<0.16384>)',
      'UID FETCH 9 (UID BODY.PEEK[3]<0.16384>)',
      'UID FETCH 12 (UID BODY.PEEK[1.1]<0.16384>)',
    ]);
    expect(commands).toContain('UID FETCH 4,9,12,20,21 (UID BODYSTRUCTURE ENVELOPE)');
    expect(commands.flatMap(commandVerbs)).toContain('EXAMINE');
    expectOnlyPartialPeeks(commands);
    // printed for the CONN-03 checkpoint
    process.stdout.write(`CONN-03 scripted IMAP commands:\n${commands.join('\n')}\n`);
    expect(logs.join('\n')).not.toContain(PASSWORD);
  });

  it('decodes Big5 and GB2312 bodies with TextDecoder, and bad bytes become U+FFFD without dropping the message', async () => {
    const big5 = Buffer.from([0xb7, 0x7c, 0xc4, 0xb3, 0x20, 0xa4, 0xa4, 0xa4, 0xe5]);
    const gb = Buffer.from([0xbb, 0xe1, 0xd2, 0xe9, 0x20, 0xd6, 0xd0, 0xce, 0xc4]).toString('base64');
    const broken = Buffer.from([0x4f, 0x4b, 0x20, 0xff, 0xfe, 0x21]);
    const { listed, commands } = await listWith([
      scripted(3, { structure: textPart('PLAIN', 'BIG5', '8BIT', big5.length), parts: { '1': big5 } }),
      scripted(5, { structure: textPart('PLAIN', 'GB2312', 'BASE64', gb.length), parts: { '1': gb } }),
      scripted(7, { structure: textPart('PLAIN', 'X-UNKNOWN-CHARSET', '8BIT', broken.length), parts: { '1': broken } }),
    ]);
    expect(byId(listed, 3).bodyText).toBe('會議 中文');
    expect(byId(listed, 5).bodyText).toBe('会议 中文');
    expect(byId(listed, 7).bodyText).toBe('OK ��!');
    expect(listed).toHaveLength(3);
    expectOnlyPartialPeeks(commands);
  });

  it('fetches at most 16 KB of an oversized body and cuts the excerpt at 800 characters', async () => {
    const big = `${'word '.repeat(19_999)}end-marker`;
    const { listed, commands, bodyLiteralBytes } = await listWith([
      scripted(8, { structure: textPart('PLAIN', 'UTF-8', '7BIT', big.length), parts: { '1': big } }),
    ]);
    const message = byId(listed, 8);
    expect(Array.from(message.bodyText).length).toBeLessThanOrEqual(MAX_BODY_CHARS);
    expect(Array.from(message.bodyText).length).toBeGreaterThan(MAX_BODY_CHARS - 5);
    expect(message.bodyText.startsWith('word word')).toBe(true);
    expect(message.bodyText).not.toContain('end-marker');
    expect(message.bodyTruncated).toBe(true);
    expect(bodyLiteralBytes).toEqual([MAX_BODY_FETCH_BYTES]);
    expectOnlyPartialPeeks(commands);
  });

  it('keeps the headers with an empty body when a body fetch fails, and the tool still succeeds', async () => {
    const messages = [
      scripted(2, { structure: textPart('PLAIN', 'UTF-8', '7BIT', 5), parts: { '1': 'hello' } }),
      // the server answers this message without its body section
      scripted(6, { structure: textPart('PLAIN', 'UTF-8', '7BIT', 5) }),
      scripted(11, { structure: multipart('ALTERNATIVE', [textPart('PLAIN', 'UTF-8', '7BIT', 5), textPart('HTML', 'UTF-8', '7BIT', 9)]), parts: { '1': 'there' } }),
    ];
    const partly = await listWith(messages);
    expect(partly.listed.map((message) => [message.id, message.bodyText])).toEqual([
      ['11', 'there'],
      ['6', ''],
      ['2', 'hello'],
    ]);

    const failed = await listWith(messages, { failBodyFetch: true });
    expect(failed.listed.map((message) => message.id)).toEqual(['11', '6', '2']);
    for (const message of failed.listed) {
      expect(message).toMatchObject({ subject: `Message ${message.id}`, bodyText: '', bodyTruncated: false });
    }
    expect(failed.commands.filter((command) => command.includes('BODY.PEEK'))).toHaveLength(1);
    expectOnlyPartialPeeks(failed.commands);
    expect(logs.join('\n')).not.toContain(PASSWORD);
    expect(logs.join('\n')).not.toContain(USERNAME);
  });
});
