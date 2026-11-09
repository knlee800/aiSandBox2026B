import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';
import * as childProcess from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { CONNECTOR_MCP_ENTRY, CONNECTOR_UNAVAILABLE_MESSAGE } from './connector-servers';
import { openConnectorMcpSession } from './connector-child';

jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process');
  return {
    ...actual,
    spawn: jest.fn(),
  };
});

describe('connector child', () => {
  const original = {
    PATH: process.env.PATH,
    NODE_ENV: process.env.NODE_ENV,
    CONNECTOR_CREDENTIALS_KEY: process.env.CONNECTOR_CREDENTIALS_KEY,
    HARNESS_ENTITLEMENT_HMAC_SECRET: process.env.HARNESS_ENTITLEMENT_HMAC_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
  };

  afterEach(() => {
    restore('PATH', original.PATH);
    restore('NODE_ENV', original.NODE_ENV);
    restore('CONNECTOR_CREDENTIALS_KEY', original.CONNECTOR_CREDENTIALS_KEY);
    restore('HARNESS_ENTITLEMENT_HMAC_SECRET', original.HARNESS_ENTITLEMENT_HMAC_SECRET);
    restore('DATABASE_URL', original.DATABASE_URL);
    jest.restoreAllMocks();
  });

  it('starts the child at the absolute connectors-mcp path with PATH and NODE_ENV only', async () => {
    process.env.PATH = 'C:\\node-bin';
    process.env.NODE_ENV = 'production';
    process.env.CONNECTOR_CREDENTIALS_KEY = 'credential-key-secret';
    process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = 'hmac-secret-value';
    process.env.DATABASE_URL = 'postgres://user:password@localhost/db';
    process.env.USERNAME = process.env.USERNAME || 'windows-user';
    const child = fakeChild();
    const spawn = childProcess.spawn as unknown as jest.Mock;
    spawn.mockImplementation(() => child);
    const session = await openConnectorMcpSession(async () => ({
      async listTools() {
        return { tools: [] };
      },
      async callTool() {
        return {};
      },
      async close() {
        return undefined;
      },
    }));

    expect(spawn).toHaveBeenCalledTimes(1);
    const [command, args, options] = spawn.mock.calls[0];
    expect(command).toBe('node');
    expect(args).toEqual([CONNECTOR_MCP_ENTRY]);
    expect(args).toEqual(['/opt/aisandbox/services/connectors-mcp/dist/main.js']);
    expect(options).toMatchObject({
      env: { PATH: 'C:\\node-bin', NODE_ENV: 'production' },
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    expect(Object.keys((options as { env: object }).env).sort()).toEqual(['NODE_ENV', 'PATH']);
    expect((options as { env: object }).env).not.toBe(process.env);
    expect((options as { cwd?: string }).cwd).toBeUndefined();
    const rendered = JSON.stringify(options);
    expect(rendered.includes('credential-key-secret')).toBe(false);
    expect(rendered.includes('hmac-secret-value')).toBe(false);
    expect(rendered.includes('postgres://')).toBe(false);
    expect(rendered.includes('windows-user')).toBe(false);
    await session.close();
  });

  it('uses the MCP client listTools and callTool over the child stdio', async () => {
    const child = scriptedChild();
    (childProcess.spawn as unknown as jest.Mock).mockImplementation(() => child);
    const session = await openConnectorMcpSession();
    const listed = await session.listTools();
    expect(listed.tools.map((tool) => tool.name)).toEqual([
      'mail_list_unread_metadata',
      'calendar_list_today',
    ]);
    expect(listed.tools[0].description).toBe('SERVER_MAIL_DO_NOT_PASS');
    const result = await session.callTool('mail_list_unread_metadata', {
      preset: 'gmail',
      username: 'owner@example.com',
      appPassword: 'app-password-secret',
      limit: 1,
    });
    expect(result).toMatchObject({
      content: [{ type: 'text', text: '{"messages":[]}' }],
    });
    expect(child.seen.some((message) => message.method === 'tools/call')).toBe(true);
    const call = child.seen.find((message) => message.method === 'tools/call');
    expect(call?.params?.name).toBe('mail_list_unread_metadata');
    expect(call?.params?.arguments?.appPassword).toBe('app-password-secret');
    await session.close();
  });

  it('constructs the SDK client used by the broker', () => {
    const client = new Client({ name: 'aisandbox-connector-broker', version: '0.1.0' });
    expect(typeof client.connect).toBe('function');
    expect(typeof client.listTools).toBe('function');
    expect(typeof client.callTool).toBe('function');
    expect(CONNECTOR_UNAVAILABLE_MESSAGE).toBe('The connector service is unavailable.');
  });
});

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function fakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdin: Writable;
    stdout: Readable;
    stderr: Readable;
    pid: number;
    exitCode: number | null;
    signalCode: NodeJS.Signals | null;
    kill: jest.Mock;
  };
  child.stdin = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  child.stdout = new Readable({ read() { return undefined; } });
  child.stderr = new Readable({ read() { return undefined; } });
  child.pid = 4242;
  child.exitCode = null;
  child.signalCode = null;
  child.kill = jest.fn(() => true);
  return child;
}

function scriptedChild() {
  const child = fakeChild();
  const pending: Buffer[] = [];
  const seen: Array<{ method?: string; id?: unknown; params?: { name?: string; arguments?: Record<string, unknown> } }> = [];
  child.stdin = new Writable({
    write(chunk, _encoding, callback) {
      pending.push(Buffer.from(chunk));
      const text = Buffer.concat(pending).toString('utf8');
      const lines = text.split('\n');
      pending.length = 0;
      if (!text.endsWith('\n')) {
        const rest = lines.pop() ?? '';
        if (rest) pending.push(Buffer.from(rest));
      }
      for (const line of lines) {
        if (!line.trim()) continue;
        const message = JSON.parse(line) as {
          method?: string;
          id?: unknown;
          params?: { name?: string; arguments?: Record<string, unknown>; protocolVersion?: string };
        };
        seen.push(message);
        respond(message);
      }
      callback();
    },
  });
  child.kill = jest.fn(() => {
    if (child.exitCode === null) {
      child.exitCode = 0;
      child.emit('exit', 0, 'SIGTERM');
    }
    return true;
  });

  function push(message: unknown) {
    child.stdout.push(`${JSON.stringify(message)}\n`);
  }

  function respond(message: {
    method?: string;
    id?: unknown;
    params?: { protocolVersion?: string };
  }) {
    if (message.method === 'initialize') {
      push({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: message.params?.protocolVersion || '2025-11-25',
          capabilities: { tools: {} },
          serverInfo: { name: 'fake-connectors', version: '0.0.0' },
        },
      });
      return;
    }
    if (message.method === 'ping') {
      push({ jsonrpc: '2.0', id: message.id, result: {} });
      return;
    }
    if (message.method === 'tools/list') {
      push({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          tools: [
            {
              name: 'mail_list_unread_metadata',
              description: 'SERVER_MAIL_DO_NOT_PASS',
              inputSchema: { type: 'object' },
            },
            {
              name: 'calendar_list_today',
              description: 'SERVER_CAL_DO_NOT_PASS',
              inputSchema: { type: 'object' },
            },
          ],
        },
      });
      return;
    }
    if (message.method === 'tools/call') {
      push({
        jsonrpc: '2.0',
        id: message.id,
        result: { content: [{ type: 'text', text: '{"messages":[]}' }] },
      });
    }
  }

  return Object.assign(child, { seen });
}
