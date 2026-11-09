import { INestApplication, Logger } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'crypto';
import request from 'supertest';
import { ConnectorConnection } from '../entities/connector-connection.entity';
import { InternalServiceAuthGuard } from '../guards/internal-service-auth.guard';
import { ConnectorBroker } from './connector-broker';
import { ConnectorMcpSession } from './connector-child';
import { encryptConnectorSecret } from './connector-crypto';
import { InternalConnectorsController } from './internal-connectors.controller';

const OWNER = '11111111-1111-4111-8111-111111111111';
const EMAIL = 'owner@example.com';
const PASSWORD = 'app-password-secret';
const KEY = randomBytes(32).toString('base64');
const INTERNAL = 'conn-02b-internal-key';

describe('InternalConnectorsController', () => {
  let app: INestApplication;
  let opener: jest.Mock;
  let session: FakeSession;
  let rows: ConnectorConnection[];
  let audits: Array<Record<string, unknown>>;
  const logs: string[] = [];
  let restoreLogs: () => void;
  const originalKey = process.env.CONNECTOR_CREDENTIALS_KEY;
  const originalInternal = process.env.INTERNAL_SERVICE_KEY;

  beforeEach(async () => {
    process.env.CONNECTOR_CREDENTIALS_KEY = KEY;
    process.env.INTERNAL_SERVICE_KEY = INTERNAL;
    logs.length = 0;
    restoreLogs = watchLogs(logs);
    rows = [imapRow()];
    audits = [];
    session = new FakeSession();
    opener = jest.fn(async () => session);
    const broker = new ConnectorBroker(connections(rows) as never, auditRepo(audits) as never, opener);
    const moduleRef = await Test.createTestingModule({
      controllers: [InternalConnectorsController],
      providers: [
        { provide: ConnectorBroker, useValue: broker },
        { provide: APP_GUARD, useClass: InternalServiceAuthGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    restoreLogs();
    if (originalKey === undefined) delete process.env.CONNECTOR_CREDENTIALS_KEY;
    else process.env.CONNECTOR_CREDENTIALS_KEY = originalKey;
    if (originalInternal === undefined) delete process.env.INTERNAL_SERVICE_KEY;
    else process.env.INTERNAL_SERVICE_KEY = originalInternal;
    await app.close();
  });

  function authed() {
    return request(app.getHttpServer())
      .post('/api/internal/connectors/call')
      .set('X-Internal-Service-Key', INTERNAL);
  }

  it('rejects an internal call without the service key', async () => {
    await request(app.getHttpServer())
      .post('/api/internal/connectors/call')
      .send({ userId: OWNER, toolId: 'mail_list_unread_metadata', arguments: { limit: 1 } })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/internal/connectors/call')
      .set('X-Internal-Service-Key', 'wrong-key')
      .send({ userId: OWNER, toolId: 'mail_list_unread_metadata', arguments: { limit: 1 } })
      .expect(401);
    expect(opener).not.toHaveBeenCalled();
    expect(audits).toHaveLength(0);

    const source = require('fs').readFileSync(
      require('path').join(__dirname, 'internal-connectors.controller.ts'),
      'utf8',
    );
    expect(source).toContain("@Controller('internal/connectors')");
    expect(source).not.toContain('@UseGuards');
    expect(source).not.toContain('SessionOrApiKeyAuthGuard');
  });

  it('calls the allowlisted tool for the owner and returns JSON', async () => {
    session.result = {
      content: [{ type: 'text', text: JSON.stringify({ messages: [{ id: '9', subject: 'Standup' }] }) }],
    };
    const response = await authed()
      .send({
        userId: OWNER,
        toolId: 'mail_list_unread_metadata',
        arguments: { limit: 1, appPassword: 'attacker-password', username: 'evil@example.com' },
        server: 'connectors-mcp',
      })
      .expect(200);
    expect(response.body).toEqual({ messages: [{ id: '9', subject: 'Standup' }] });
    expect(session.calls[0]).toEqual({
      name: 'mail_list_unread_metadata',
      args: { preset: 'gmail', username: EMAIL, appPassword: PASSWORD, limit: 1 },
    });
    expect(response.text.includes(PASSWORD)).toBe(false);
    expect(response.text.includes('SERVER_MAIL_DESCRIPTION_DO_NOT_PASS')).toBe(false);
    const payload = audits[0].payload as Record<string, unknown>;
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
      outcome: 'ok',
    });
  });

  it('refuses a user-supplied server and does not return child error text', async () => {
    const refused = await authed()
      .send({
        userId: OWNER,
        toolId: 'mail_list_unread_metadata',
        arguments: { limit: 1 },
        url: 'https://evil.example/mcp',
      })
      .expect(400);
    expect(refused.body.message).toBe('Unknown connector server.');
    expect(refused.text.includes('evil.example')).toBe(false);
    expect(opener).not.toHaveBeenCalled();

    session.error = new Error(`login failed ${PASSWORD}`);
    const failed = await authed()
      .send({ userId: OWNER, toolId: 'mail_list_unread_metadata', arguments: {} })
      .expect(503);
    expect(failed.body.message).toBe('The connector service is unavailable.');
    expect(failed.text.includes(PASSWORD)).toBe(false);
    expect(failed.text.includes(EMAIL)).toBe(false);
    expect(logs.join('\n').includes(PASSWORD)).toBe(false);
    expect(JSON.stringify(audits).includes(PASSWORD)).toBe(false);
  });

  it('returns 503 when the credentials key is missing', async () => {
    delete process.env.CONNECTOR_CREDENTIALS_KEY;
    const response = await authed()
      .send({ userId: OWNER, toolId: 'mail_list_unread_metadata', arguments: { limit: 1 } })
      .expect(503);
    expect(response.body.message).toBe('connections are not configured');
    expect(response.text.includes(PASSWORD)).toBe(false);
    expect(opener).not.toHaveBeenCalled();
    expect(audits).toHaveLength(0);
  });
});

function imapRow(): ConnectorConnection {
  const now = new Date();
  return {
    id: randomUUID(),
    userId: OWNER,
    kind: 'imap',
    preset: 'gmail',
    username: EMAIL,
    secretCiphertext: encryptConnectorSecret(OWNER, 'imap', PASSWORD),
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
      return rows.find((entry) => entry.userId === where?.userId && entry.kind === where?.kind) ?? null;
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

class FakeSession implements ConnectorMcpSession {
  calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  result: unknown = { content: [{ type: 'text', text: '{"messages":[]}' }] };
  error: Error | null = null;
  private listeners: Array<() => void> = [];

  async listTools() {
    return {
      tools: [
        { name: 'mail_list_unread_metadata', description: 'SERVER_MAIL_DESCRIPTION_DO_NOT_PASS' },
        { name: 'calendar_list_today', description: 'SERVER_CAL_DESCRIPTION_DO_NOT_PASS' },
      ],
    };
  }

  async callTool(name: string, args: Record<string, unknown>) {
    this.calls.push({ name, args });
    if (this.error) throw this.error;
    return this.result;
  }

  async close() {
    return undefined;
  }

  kill() {
    return undefined;
  }

  onExit(listener: () => void) {
    this.listeners.push(listener);
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
