import { Logger } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { ConnectorConnection } from '../entities/connector-connection.entity';
import { ConnectorBroker } from './connector-broker';
import { ConnectorMcpSession, ConnectorTimers } from './connector-child';
import { encryptConnectorSecret } from './connector-crypto';
import {
  CALENDAR_TOOL,
  CONNECTOR_ARGUMENTS_MESSAGE,
  CONNECTOR_BUSY_MESSAGE,
  CONNECTOR_CALL_TIMEOUT_MS,
  CONNECTOR_IDLE_MS,
  CONNECTOR_MAX_RESULT_BYTES,
  CONNECTOR_RESULT_MESSAGE,
  CONNECTOR_TIMEOUT_MESSAGE,
  CONNECTOR_TOOL_MESSAGE,
  CONNECTOR_TOOL_MISSING_MESSAGE,
  CONNECTOR_UNAVAILABLE_MESSAGE,
  MAIL_TOOL,
  connectorToolCatalog,
} from './connector-servers';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const EMAIL = 'owner@example.com';
const PASSWORD = 'app-password-secret';
const ICAL = 'https://calendar.example.com/feeds/ical-secret-token';
const KEY = randomBytes(32).toString('base64');

describe('connector broker', () => {
  const logs: string[] = [];
  let rows: ConnectorConnection[];
  let audits: Array<Record<string, unknown>>;
  let opener: jest.Mock;
  let timers: ManualTimers;
  let broker: ConnectorBroker;
  let restoreLogs: () => void;
  const originalKey = process.env.CONNECTOR_CREDENTIALS_KEY;

  beforeEach(() => {
    process.env.CONNECTOR_CREDENTIALS_KEY = KEY;
    logs.length = 0;
    restoreLogs = watchLogs(logs);
    rows = [];
    audits = [];
    opener = jest.fn(async () => new FakeSession());
    timers = new ManualTimers();
    broker = new ConnectorBroker(connections(rows) as never, auditRepo(audits) as never, opener, timers);
  });

  afterEach(() => {
    restoreLogs();
    if (originalKey === undefined) delete process.env.CONNECTOR_CREDENTIALS_KEY;
    else process.env.CONNECTOR_CREDENTIALS_KEY = originalKey;
  });

  it('publishes our descriptions and model-facing schemas without secret fields', () => {
    expect(connectorToolCatalog()).toEqual([MAIL_TOOL, CALENDAR_TOOL]);
    const rendered = JSON.stringify(connectorToolCatalog());
    for (const secretField of ['appPassword', 'icalUrl', 'username', 'preset', 'ownerEmail']) {
      expect(rendered.includes(`"${secretField}"`)).toBe(false);
    }
    expect(Object.keys(MAIL_TOOL.inputSchema.properties)).toEqual(['limit']);
    expect(Object.keys(CALENDAR_TOOL.inputSchema.properties)).toEqual(['timeZone']);
    expect(CALENDAR_TOOL.inputSchema.required).toEqual(['timeZone']);
    expect(MAIL_TOOL.description.includes('connected mailbox')).toBe(true);
    expect(CALENDAR_TOOL.description.includes('connected calendar')).toBe(true);
  });

  it('calls an allowlisted tool only when the user has that connection and adds the decrypted secret as arguments', async () => {
    rows.push(imapRow(), icalRow());
    const session = new FakeSession();
    session.result = {
      content: [{ type: 'text', text: JSON.stringify({ messages: [{ id: '1' }, { id: '2' }] }) }],
    };
    opener.mockImplementation(async () => session);

    const called = await broker.callConnectorTool({
      userId: OWNER,
      toolId: 'mail_list_unread_metadata',
      args: { limit: 2, appPassword: 'attacker-password', username: 'evil@example.com', preset: 'yahoo' },
      action: 'connector_call',
    });
    expect(called.result).toEqual({ messages: [{ id: '1' }, { id: '2' }] });
    expect(session.calls).toEqual([
      {
        name: 'mail_list_unread_metadata',
        args: { preset: 'gmail', username: EMAIL, appPassword: PASSWORD, limit: 2 },
      },
    ]);
    expect(JSON.stringify(called.result).includes(PASSWORD)).toBe(false);
    expect(opener).toHaveBeenCalledTimes(1);

    session.result = {
      content: [{ type: 'text', text: JSON.stringify({ events: [{ title: 'Standup' }] }) }],
    };
    const calendar = await broker.callConnectorTool({
      userId: OWNER,
      toolId: 'calendar_list_today',
      args: { timeZone: 'UTC', icalUrl: 'https://evil.example/feed' },
      action: 'connector_call',
    });
    expect(calendar.result).toEqual({ events: [{ title: 'Standup' }] });
    expect(session.calls[1].args).toEqual({ timeZone: 'UTC', icalUrl: ICAL });

    await expect(
      broker.callConnectorTool({
        userId: OTHER,
        toolId: 'mail_list_unread_metadata',
        args: { limit: 1 },
        action: 'connector_call',
      }),
    ).rejects.toThrow('Connection not found.');
    expect(session.calls).toHaveLength(2);

    await expect(
      broker.callConnectorTool({
        userId: OWNER,
        toolId: 'mail_list_unread_metadata',
        args: { limit: 99 },
        action: 'connector_call',
      }),
    ).rejects.toThrow(CONNECTOR_ARGUMENTS_MESSAGE);

    await expect(
      broker.callConnectorTool({
        userId: OWNER,
        toolId: PASSWORD,
        args: {},
        action: 'connector_call',
      }),
    ).rejects.toThrow(CONNECTOR_TOOL_MESSAGE);
    expect(JSON.stringify(audits).includes(PASSWORD)).toBe(false);
    expect(logs.join('\n').includes(PASSWORD)).toBe(false);
  });

  it('does not pass server tool descriptions on and logs an unknown server tool once', async () => {
    rows.push(imapRow());
    const session = new FakeSession();
    session.tools.push({ name: 'evil_tool', description: 'SERVER_EVIL_DESCRIPTION_DO_NOT_PASS' });
    opener.mockImplementation(async () => session);
    const called = await broker.callConnectorTool({
      userId: OWNER,
      toolId: 'mail_list_unread_metadata',
      args: {},
      action: 'connector_call',
    });
    const rendered = `${JSON.stringify(called)} ${logs.join('\n')}`;
    expect(rendered.includes('SERVER_MAIL_DESCRIPTION_DO_NOT_PASS')).toBe(false);
    expect(rendered.includes('SERVER_EVIL_DESCRIPTION_DO_NOT_PASS')).toBe(false);
    expect(logs.filter((line) => line.includes('ignored connector tool evil_tool'))).toHaveLength(1);

    session.emitExit();
    await broker.callConnectorTool({
      userId: OWNER,
      toolId: 'mail_list_unread_metadata',
      args: {},
      action: 'connector_call',
    });
    expect(logs.filter((line) => line.includes('ignored connector tool evil_tool'))).toHaveLength(1);
    expect(opener).toHaveBeenCalledTimes(2);
  });

  it('fails with a fixed message when an allowlisted tool is missing', async () => {
    rows.push(imapRow());
    const session = new FakeSession();
    session.tools = [{ name: 'mail_list_unread_metadata', description: 'SERVER_ONLY' }];
    opener.mockImplementation(async () => session);
    await expect(
      broker.callConnectorTool({
        userId: OWNER,
        toolId: 'mail_list_unread_metadata',
        args: {},
        action: 'connector_call',
      }),
    ).rejects.toThrow(CONNECTOR_TOOL_MISSING_MESSAGE);
    expect(session.closed).toBe(true);
    expect(logs.join('\n').includes('SERVER_ONLY')).toBe(false);
    const row = audits[audits.length - 1];
    expect((row.payload as { outcome: string }).outcome).toBe('error');
  });

  it('stops the idle child after 5 minutes and starts a new child on the next call', async () => {
    rows.push(imapRow());
    opener.mockImplementation(async () => new FakeSession());
    await broker.callConnectorTool({
      userId: OWNER,
      toolId: 'mail_list_unread_metadata',
      args: {},
      action: 'connector_call',
    });
    expect(timers.pending(CONNECTOR_IDLE_MS)).toHaveLength(1);
    expect((await opener.mock.results[0].value) as FakeSession).toBeDefined();
    const first = await opener.mock.results[0].value;
    expect(first.closed).toBe(false);
    timers.fire(CONNECTOR_IDLE_MS);
    expect(first.closed).toBe(true);
    await broker.callConnectorTool({
      userId: OWNER,
      toolId: 'mail_list_unread_metadata',
      args: {},
      action: 'connector_call',
    });
    expect(opener).toHaveBeenCalledTimes(2);
  });

  it('starts a new child after the previous child exits', async () => {
    rows.push(imapRow());
    const first = new FakeSession();
    const second = new FakeSession();
    opener.mockImplementationOnce(async () => first).mockImplementationOnce(async () => second);
    await broker.callConnectorTool({
      userId: OWNER,
      toolId: 'mail_list_unread_metadata',
      args: {},
      action: 'connector_call',
    });
    first.emitExit();
    await broker.callConnectorTool({
      userId: OWNER,
      toolId: 'mail_list_unread_metadata',
      args: {},
      action: 'connector_call',
    });
    expect(second.calls).toHaveLength(1);
    expect(opener).toHaveBeenCalledTimes(2);
  });

  it('returns a fixed message when the child fails to start and the next call starts a new child', async () => {
    rows.push(imapRow());
    const session = new FakeSession();
    opener.mockRejectedValueOnce(new Error(`spawn ENOENT ${PASSWORD}`));
    opener.mockImplementation(async () => session);
    await expect(
      broker.callConnectorTool({
        userId: OWNER,
        toolId: 'mail_list_unread_metadata',
        args: {},
        action: 'connector_call',
      }),
    ).rejects.toThrow(CONNECTOR_UNAVAILABLE_MESSAGE);
    expect(logs.join('\n').includes(PASSWORD)).toBe(false);
    expect(JSON.stringify(audits).includes(PASSWORD)).toBe(false);
    await broker.callConnectorTool({
      userId: OWNER,
      toolId: 'mail_list_unread_metadata',
      args: {},
      action: 'connector_call',
    });
    expect(opener).toHaveBeenCalledTimes(2);
    expect(session.calls).toHaveLength(1);
  });

  it('rejects a fifth call while four calls are in flight', async () => {
    rows.push(imapRow());
    const session = new FakeSession();
    session.hang = true;
    opener.mockImplementation(async () => session);
    const pending = [0, 1, 2, 3].map(() =>
      broker.callConnectorTool({
        userId: OWNER,
        toolId: 'mail_list_unread_metadata',
        args: {},
        action: 'connector_call',
      }),
    );
    await settle();
    await expect(
      broker.callConnectorTool({
        userId: OWNER,
        toolId: 'mail_list_unread_metadata',
        args: {},
        action: 'connector_call',
      }),
    ).rejects.toThrow(CONNECTOR_BUSY_MESSAGE);
    expect(opener).toHaveBeenCalledTimes(1);
    expect(session.calls).toHaveLength(4);
    session.release();
    const results = await Promise.all(pending);
    expect(results).toHaveLength(4);
  });

  it('kills the child when a call exceeds 25 seconds', async () => {
    rows.push(imapRow());
    const session = new FakeSession();
    session.hang = true;
    opener.mockImplementation(async () => new FakeSession());
    opener.mockImplementationOnce(async () => session);
    const pending = broker.callConnectorTool({
      userId: OWNER,
      toolId: 'mail_list_unread_metadata',
      args: {},
      action: 'connector_call',
    });
    await settle();
    expect(timers.pending(CONNECTOR_CALL_TIMEOUT_MS)).toHaveLength(1);
    timers.fire(CONNECTOR_CALL_TIMEOUT_MS);
    await expect(pending).rejects.toThrow(CONNECTOR_TIMEOUT_MESSAGE);
    expect(session.killed).toBe(true);
    const audit = audits[audits.length - 1].payload as { outcome: string; toolId: string };
    expect(audit.outcome).toBe('timeout');
    expect(audit.toolId).toBe('mail_list_unread_metadata');
    expect(logs.join('\n').includes(PASSWORD)).toBe(false);

    await broker.callConnectorTool({
      userId: OWNER,
      toolId: 'mail_list_unread_metadata',
      args: {},
      action: 'connector_call',
    });
    expect(opener).toHaveBeenCalledTimes(2);
  });

  it('accepts a JSON result of 64 KB and refuses a larger result', async () => {
    rows.push(imapRow());
    const session = new FakeSession();
    opener.mockImplementation(async () => session);
    const fitted = jsonOfByteLength(CONNECTOR_MAX_RESULT_BYTES);
    session.result = { content: [{ type: 'text', text: fitted }] };
    const ok = await broker.callConnectorTool({
      userId: OWNER,
      toolId: 'mail_list_unread_metadata',
      args: {},
      action: 'connector_call',
    });
    expect(ok.result).toEqual(JSON.parse(fitted));
    expect((audits[audits.length - 1].payload as { resultBytes: number }).resultBytes).toBe(
      CONNECTOR_MAX_RESULT_BYTES,
    );

    session.result = { content: [{ type: 'text', text: jsonOfByteLength(CONNECTOR_MAX_RESULT_BYTES + 1) }] };
    await expect(
      broker.callConnectorTool({
        userId: OWNER,
        toolId: 'mail_list_unread_metadata',
        args: {},
        action: 'connector_call',
      }),
    ).rejects.toThrow(CONNECTOR_RESULT_MESSAGE);
    expect((audits[audits.length - 1].payload as { outcome: string }).outcome).toBe('error');
  });

  it('scrubs the secret from logs, exceptions, audit rows and the result', async () => {
    rows.push(imapRow());
    const session = new FakeSession();
    opener.mockImplementation(async () => session);
    session.error = new Error(`login failed ${PASSWORD} for ${EMAIL}`);
    let caught: unknown;
    try {
      await broker.callConnectorTool({
        userId: OWNER,
        toolId: 'mail_list_unread_metadata',
        args: {},
        action: 'connector_call',
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    const message = `${(caught as Error).message} ${JSON.stringify((caught as { getResponse?: () => unknown }).getResponse?.() ?? {})}`;
    expect(message.includes(PASSWORD)).toBe(false);
    expect(message.includes(EMAIL)).toBe(false);
    expect(message).toContain(CONNECTOR_UNAVAILABLE_MESSAGE);
    const renderedLogs = logs.join('\n');
    expect(renderedLogs.includes(PASSWORD)).toBe(false);
    expect(renderedLogs.includes(EMAIL)).toBe(false);
    expect(renderedLogs.includes('[redacted]')).toBe(true);
    expect(JSON.stringify(audits).includes(PASSWORD)).toBe(false);
    expect(JSON.stringify(audits).includes(EMAIL)).toBe(false);

    session.error = null;
    session.result = {
      isError: true,
      content: [{ type: 'text', text: `provider said ${PASSWORD}` }],
    };
    await expect(
      broker.callConnectorTool({
        userId: OWNER,
        toolId: 'mail_list_unread_metadata',
        args: {},
        action: 'connector_call',
      }),
    ).rejects.toThrow(CONNECTOR_RESULT_MESSAGE);
    expect(logs.join('\n').includes(PASSWORD)).toBe(false);

    session.result = {
      content: [{ type: 'text', text: JSON.stringify({ messages: [{ subject: PASSWORD }] }) }],
    };
    const returned = await broker.callConnectorTool({
      userId: OWNER,
      toolId: 'mail_list_unread_metadata',
      args: {},
      action: 'connector_call',
    });
    expect(JSON.stringify(returned.result).includes(PASSWORD)).toBe(false);
    expect(JSON.stringify(returned.result)).toContain('[redacted]');
    expect((returned.result as { messages: unknown[] }).messages).toHaveLength(1);
  });

  it('writes an audit row with action, toolId, userId, itemCount, resultBytes, durationMs and outcome', async () => {
    rows.push(imapRow());
    const text = JSON.stringify({ messages: [{ id: '9' }] });
    const session = new FakeSession();
    session.result = { content: [{ type: 'text', text }] };
    opener.mockImplementation(async () => session);
    await broker.callConnectorTool({
      userId: OWNER,
      toolId: 'mail_list_unread_metadata',
      args: { limit: 1 },
      action: 'connector_call',
    });
    expect(audits).toHaveLength(1);
    const row = audits[0];
    const payload = row.payload as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual([
      'action',
      'durationMs',
      'itemCount',
      'outcome',
      'resultBytes',
      'toolId',
      'userId',
    ]);
    expect(payload).toMatchObject({
      action: 'connector_call',
      toolId: 'mail_list_unread_metadata',
      userId: OWNER,
      itemCount: 1,
      resultBytes: Buffer.byteLength(text),
      outcome: 'ok',
    });
    expect(typeof payload.durationMs).toBe('number');
    expect(row.category).toBe('connector');
    expect(row.eventType).toBe('connector.call');
    expect(JSON.stringify(row).includes(PASSWORD)).toBe(false);
    expect(JSON.stringify(row).includes(EMAIL)).toBe(false);
    expect(JSON.stringify(payload).includes('subject')).toBe(false);
    expect(row.subjectType).toBe('connector_connection');
  });
});

function imapRow(): ConnectorConnection {
  return row('imap', 'gmail', EMAIL, PASSWORD);
}

function icalRow(): ConnectorConnection {
  return row('ical', null, null, ICAL);
}

function row(
  kind: 'imap' | 'ical',
  preset: string | null,
  username: string | null,
  secret: string,
): ConnectorConnection {
  const now = new Date();
  return {
    id: randomUUID(),
    userId: OWNER,
    kind,
    preset,
    username,
    secretCiphertext: encryptConnectorSecret(OWNER, kind, secret),
    keyVersion: 1,
    createdAt: now,
    updatedAt: now,
    lastVerifiedAt: null,
  } as ConnectorConnection;
}

function connections(rows: ConnectorConnection[]) {
  return {
    async findOne(options?: { where?: { userId?: string; kind?: string } }) {
      const where = options?.where;
      return (
        rows.find((entry) => entry.userId === where?.userId && entry.kind === where?.kind) ?? null
      );
    },
  };
}

function auditRepo(audits: Array<Record<string, unknown>>) {
  return {
    async save(value: Record<string, unknown>) {
      const stored = { ...value, payload: { ...(value.payload as object) } };
      audits.push(stored);
      return stored;
    },
  };
}

class ManualTimers implements ConnectorTimers {
  private queued: Array<{ ms: number; fire: () => void; cancelled: boolean }> = [];

  delay(ms: number, onFire: () => void): { cancel(): void } {
    const entry = { ms, fire: onFire, cancelled: false };
    this.queued.push(entry);
    return {
      cancel: () => {
        entry.cancelled = true;
      },
    };
  }

  pending(ms: number) {
    return this.queued.filter((entry) => !entry.cancelled && entry.ms === ms);
  }

  fire(ms: number) {
    for (const entry of this.pending(ms)) {
      entry.cancelled = true;
      entry.fire();
    }
  }
}

class FakeSession implements ConnectorMcpSession {
  calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  tools: Array<{ name: string; description?: string }> = [
    { name: 'mail_list_unread_metadata', description: 'SERVER_MAIL_DESCRIPTION_DO_NOT_PASS' },
    { name: 'calendar_list_today', description: 'SERVER_CAL_DESCRIPTION_DO_NOT_PASS' },
  ];
  result: unknown = { content: [{ type: 'text', text: JSON.stringify({ messages: [] }) }] };
  error: Error | null = null;
  hang = false;
  closed = false;
  killed = false;
  private pending: Array<{ resolve: (value: unknown) => void; reject: (error: Error) => void }> = [];
  private listeners: Array<() => void> = [];

  async listTools() {
    return { tools: this.tools.map((tool) => ({ ...tool })) };
  }

  callTool(name: string, args: Record<string, unknown>) {
    this.calls.push({ name, args });
    if (this.hang) {
      return new Promise((resolve, reject) => {
        this.pending.push({ resolve, reject });
      });
    }
    if (this.error) return Promise.reject(this.error);
    return Promise.resolve(this.result);
  }

  release(value?: unknown) {
    const pending = this.pending.splice(0);
    for (const item of pending) item.resolve(value ?? this.result);
  }

  async close() {
    this.closed = true;
    this.emitExit();
  }

  kill() {
    this.killed = true;
    const pending = this.pending.splice(0);
    for (const item of pending) item.reject(new Error('killed'));
    this.emitExit();
  }

  onExit(listener: () => void) {
    this.listeners.push(listener);
  }

  emitExit() {
    for (const listener of this.listeners.splice(0)) listener();
  }
}

function jsonOfByteLength(bytes: number): string {
  const prefix = '{"pad":"';
  const suffix = '"}';
  const pad = bytes - Buffer.byteLength(prefix + suffix);
  const text = `${prefix}${'a'.repeat(pad)}${suffix}`;
  if (Buffer.byteLength(text) !== bytes) {
    throw new Error(`json size ${Buffer.byteLength(text)} !== ${bytes}`);
  }
  return text;
}

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function watchLogs(target: string[]): () => void {
  const methods = ['log', 'warn', 'error', 'debug', 'verbose'] as const;
  const spies = methods.map((method) =>
    jest.spyOn(Logger.prototype, method).mockImplementation((...args: unknown[]) => {
      target.push(args.map((value) => (typeof value === 'string' ? value : JSON.stringify(value))).join(' '));
    }),
  );
  return () => spies.forEach((spy) => spy.mockRestore());
}
