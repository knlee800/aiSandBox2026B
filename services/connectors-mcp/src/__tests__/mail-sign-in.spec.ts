import net from 'node:net';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { AuthenticationFailure } from 'imapflow';

import type { CalendarFeed, CalendarWindowFeed } from '../clients/ical-feed';
import {
  fetchOneMessage,
  fetchRecentHeaders,
  fetchUnreadHeaders,
  isSignInRefused,
  mailReadError,
  type ImapSessionTarget,
  type MailboxClient,
  type MessageReadClient,
  type RecentMailClient,
} from '../clients/imap-client';
import { MAIL_SIGN_IN_REFUSED_MESSAGE } from '../limits';
import { MAIL_READ_TOOL_NAME, MAIL_RECENT_TOOL_NAME, MAIL_TOOL_NAME, createConnectorServer } from '../server';

/**
 * CONN-MAIL-AUTH-STATE-01 D1: a refused mail sign-in gives one fixed text from each
 * of the three IMAP reads; every other failure is redacted as before.
 */

const PASSWORD = 'fake-app-password-4821';
const USERNAME = 'owner.fake@example.com';
const SINCE_MS = 30 * 60 * 1000;

type LoginMode = 'no' | 'bad' | 'drop' | 'ok-then-examine-no';

/** A small IMAP server: the greeting, CAPABILITY, and LOGIN answered by `mode`. */
function startSignInServer(mode: LoginMode): Promise<{ port: number; commands: string[]; close: () => Promise<void> }> {
  const commands: string[] = [];
  const sockets = new Set<net.Socket>();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    let buffer = '';
    const write = (text: string) => {
      if (!socket.destroyed) {
        socket.write(text);
      }
    };
    const respond = (line: string) => {
      const match = line.match(/^(\S+)\s+([\s\S]*)$/);
      if (!match) {
        return;
      }
      const tag = match[1];
      const upper = match[2].toUpperCase();
      const verb = upper.split(/\s+/)[0];
      commands.push(verb);
      if (verb === 'CAPABILITY') {
        write(`* CAPABILITY IMAP4rev1\r\n${tag} OK CAPABILITY completed\r\n`);
        return;
      }
      if (verb === 'LOGIN') {
        if (mode === 'no') {
          write(`${tag} NO [AUTHENTICATIONFAILED] Invalid credentials for ${USERNAME} ${PASSWORD}\r\n`);
        } else if (mode === 'bad') {
          write(`${tag} BAD [AUTHENTICATIONFAILED] Bad login ${PASSWORD}\r\n`);
        } else if (mode === 'drop') {
          socket.destroy();
        } else {
          write(`${tag} OK LOGIN completed\r\n`);
        }
        return;
      }
      if (verb === 'LIST') {
        write(`* LIST (\\HasNoChildren) "/" "INBOX"\r\n${tag} OK LIST completed\r\n`);
        return;
      }
      if (verb === 'EXAMINE' || verb === 'SELECT') {
        write(`${tag} NO [SERVERBUG] mailbox unavailable for ${USERNAME} with ${PASSWORD}\r\n`);
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
        if (line) {
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
        reject(new Error('sign-in server did not bind'));
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

function localTarget(port: number): ImapSessionTarget {
  return { host: '127.0.0.1', port, secure: false, rejectUnauthorized: true, doSTARTTLS: false };
}

const AUTH = { username: USERNAME, appPassword: PASSWORD };

/** The three reads, each against `port`, each settling to its error (or null). */
const READS: Array<[string, (port: number) => Promise<unknown>]> = [
  ['the unread list', (port) => fetchUnreadHeaders(localTarget(port), AUTH, 25, 5_000)],
  ['the one-message read', (port) => fetchOneMessage(localTarget(port), AUTH, 7, 5_000)],
  ['the recent read', (port) => fetchRecentHeaders(localTarget(port), AUTH, new Date(Date.now() - SINCE_MS), 5_000)],
];

async function errorOf(run: Promise<unknown>): Promise<Error> {
  const caught = await run.then(() => null, (error: unknown) => error);
  expect(caught).toBeInstanceOf(Error);
  return caught as Error;
}

describe('CONN-MAIL-AUTH-STATE-01 D1 refused mail sign-in', () => {
  const logs: string[] = [];
  let spies: jest.SpyInstance[] = [];

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

  it('is the fixed text, with no address or password', () => {
    expect(MAIL_SIGN_IN_REFUSED_MESSAGE).toBe('The mail server refused the sign-in.');
  });

  describe('mailReadError', () => {
    it('gives exactly the fixed text for an error imapflow marked authenticationFailed', () => {
      const marked = Object.assign(new Error(`Command failed ${USERNAME} ${PASSWORD}`), {
        authenticationFailed: true,
        responseText: `Invalid credentials ${PASSWORD}`,
      });
      expect(isSignInRefused(marked)).toBe(true);
      expect(mailReadError(marked, [PASSWORD, USERNAME]).message).toBe(MAIL_SIGN_IN_REFUSED_MESSAGE);
      const failure = new AuthenticationFailure('Authentication failed');
      expect(mailReadError(failure, [PASSWORD, USERNAME]).message).toBe(MAIL_SIGN_IN_REFUSED_MESSAGE);
    });

    it.each([
      ['a plain error', new Error(`connect failed ${USERNAME} ${PASSWORD}`)],
      ['authenticationFailed false', Object.assign(new Error(`timed out ${PASSWORD}`), { authenticationFailed: false })],
      ['authenticationFailed as text', Object.assign(new Error(`odd ${USERNAME}`), { authenticationFailed: 'true' })],
      ['a server response text', Object.assign(new Error('Command failed'), { responseText: `NO for ${USERNAME} ${PASSWORD}` })],
    ])('redacts %s as before, never the fixed text', (_label, error) => {
      const out = mailReadError(error, [PASSWORD, USERNAME]);
      expect(isSignInRefused(error)).toBe(false);
      expect(out.message).not.toBe(MAIL_SIGN_IN_REFUSED_MESSAGE);
      expect(out.message).not.toContain(PASSWORD);
      expect(out.message).not.toContain(USERNAME);
      expect(out.message).toContain('[redacted]');
    });

    it('is false for anything that is not an error object', () => {
      for (const value of [null, undefined, 'authenticationFailed', 1, true]) {
        expect(isSignInRefused(value)).toBe(false);
      }
    });
  });

  describe.each(READS)('%s over IMAP', (_label, read) => {
    it.each(['no', 'bad'] as const)('throws exactly the fixed text when LOGIN is answered %s', async (mode) => {
      const imap = await startSignInServer(mode);
      try {
        const error = await errorOf(read(imap.port));
        expect(error.message).toBe(MAIL_SIGN_IN_REFUSED_MESSAGE);
        expect(imap.commands).toContain('LOGIN');
        expect(imap.commands).not.toContain('EXAMINE');
        expect(logs.join('\n')).not.toContain(PASSWORD);
        expect(logs.join('\n')).not.toContain(USERNAME);
      } finally {
        await imap.close();
      }
    });

    it('a connection lost during LOGIN is not a refusal', async () => {
      const imap = await startSignInServer('drop');
      try {
        const error = await errorOf(read(imap.port));
        expect(error.message).not.toBe(MAIL_SIGN_IN_REFUSED_MESSAGE);
        expect(error.message).not.toContain(PASSWORD);
        expect(error.message).not.toContain(USERNAME);
      } finally {
        await imap.close();
      }
    });

    it('a failure after a good sign-in is redacted as before, not the fixed text', async () => {
      const imap = await startSignInServer('ok-then-examine-no');
      try {
        const error = await errorOf(read(imap.port));
        expect(error.message).not.toBe(MAIL_SIGN_IN_REFUSED_MESSAGE);
        expect(error.message).not.toContain(PASSWORD);
        expect(error.message).not.toContain(USERNAME);
      } finally {
        await imap.close();
      }
    });
  });

  it('each mail tool answers the fixed text as its error result', async () => {
    const imap = await startSignInServer('no');
    const target = localTarget(imap.port);
    const mail: MailboxClient = {
      listUnread: (input) => fetchUnreadHeaders(target, input, 25, 5_000),
    };
    const mailRead: MessageReadClient = {
      readMessage: (input) => fetchOneMessage(target, input, input.messageId, 5_000),
    };
    const mailRecent: RecentMailClient = {
      listRecent: (input) => fetchRecentHeaders(target, input, input.since, 5_000),
    };
    const unused = async (): Promise<never> => {
      throw new Error('not used');
    };
    const server = createConnectorServer({
      mail,
      mailRead,
      mailRecent,
      calendar: { listToday: unused } as unknown as CalendarFeed,
      calendarWindow: { listWindow: unused } as unknown as CalendarWindowFeed,
    });
    const client = new Client({ name: 'mail-sign-in-test', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    try {
      const base = { preset: 'gmail', username: USERNAME, appPassword: PASSWORD };
      const calls = [
        { name: MAIL_TOOL_NAME, arguments: { ...base, limit: 1 } },
        { name: MAIL_READ_TOOL_NAME, arguments: { ...base, messageId: '7' } },
        { name: MAIL_RECENT_TOOL_NAME, arguments: { ...base, since: new Date(Date.now() - SINCE_MS).toISOString() } },
      ];
      for (const call of calls) {
        const result = await client.callTool(call);
        expect({ name: call.name, isError: result.isError, content: result.content }).toEqual({
          name: call.name,
          isError: true,
          content: [{ type: 'text', text: MAIL_SIGN_IN_REFUSED_MESSAGE }],
        });
      }
      expect(imap.commands.filter((command) => command === 'LOGIN')).toHaveLength(3);
    } finally {
      await client.close();
      await imap.close();
    }
  });
});
