import { ExecutionContext, INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomBytes, randomUUID } from 'crypto';
import request from 'supertest';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ConnectorConnection } from '../entities/connector-connection.entity';
import { ConnectorDecryptError, decryptConnectorSecret } from './connector-crypto';
import { ConnectorsController } from './connectors.controller';
import { ConnectorsService } from './connectors.service';
import {
  APP_PASSWORD_MESSAGE,
  BODY_TOO_LARGE_MESSAGE,
  CONNECTION_NOT_FOUND_MESSAGE,
  DELETE_FAILED_MESSAGE,
  ICAL_URL_MESSAGE,
  IMAP_PRESET_MESSAGE,
  INVALID_CONNECTOR_MESSAGE,
  LIST_FAILED_MESSAGE,
  SAVE_FAILED_MESSAGE,
  UNKNOWN_CONNECTOR_MESSAGE,
  USERNAME_MESSAGE,
} from './connector-rules';
import { CONNECTOR_CREDENTIALS_UNAVAILABLE_MESSAGE } from './connector-crypto';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const EMAIL = 'owner@example.com';
const OTHER_EMAIL = 'other@example.com';
const PASSWORD = 'S3cret!Pass';
const NEXT_PASSWORD = 'N3w!Secret!';
const SPACED_PASSWORD = 'ab cd ef gh';
const NORMALIZED_PASSWORD = 'abcdefgh';
const ICAL = 'https://calendar.example.com/feeds/ical-secret-token';
const ICAL_TOKEN = 'ical-secret-token';
const KEY = randomBytes(32).toString('base64');

describe('ConnectorsController', () => {
  let app: INestApplication;
  let repo: MemoryConnectionRepository;
  const logs: string[] = [];
  let restoreLogs: () => void = () => undefined;
  const originalKey = process.env.CONNECTOR_CREDENTIALS_KEY;

  beforeEach(async () => {
    process.env.CONNECTOR_CREDENTIALS_KEY = KEY;
    logs.length = 0;
    restoreLogs = watchLogs(logs);
    repo = new MemoryConnectionRepository();
    const moduleRef = await Test.createTestingModule({
      controllers: [ConnectorsController],
      providers: [
        ConnectorsService,
        { provide: getRepositoryToken(ConnectorConnection), useValue: repo },
      ],
    })
      .overrideGuard(SessionOrApiKeyAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          const headerUser = req.header('x-test-user');
          const entitled = req.header('x-test-entitled');
          if (headerUser === 'anonymous') {
            req.apiKeyIdentity = undefined;
            return true;
          }
          req.apiKeyIdentity = {
            userId: headerUser || OWNER,
            apiKeyId: headerUser === 'no-key' ? '' : 'browser-session',
            scopes: ['ai:execute'],
            harnessEntitled: entitled !== '0',
          };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
    restoreLogs();
    if (originalKey === undefined) delete process.env.CONNECTOR_CREDENTIALS_KEY;
    else process.env.CONNECTOR_CREDENTIALS_KEY = originalKey;
  });

  function authed(userId = OWNER, entitled = true) {
    const server = request(app.getHttpServer());
    const mark = (req: request.Test) =>
      req.set('x-test-user', userId).set('x-test-entitled', entitled ? '1' : '0');
    return {
      get: (path: string) => mark(server.get(path)),
      post: (path: string) => mark(server.post(path)),
      delete: (path: string) => mark(server.delete(path)),
    };
  }

  it('uses SessionOrApiKeyAuthGuard and returns 403 when the caller is not harness entitled', async () => {
    const guards = Reflect.getMetadata('__guards__', ConnectorsController);
    expect(guards).toContain(SessionOrApiKeyAuthGuard);

    const denied = authed(OWNER, false);
    await denied.get('/api/connectors').expect(403);
    await denied
      .post('/api/connectors/imap')
      .send({ preset: 'gmail', username: EMAIL, appPassword: PASSWORD })
      .expect(403);
    await denied.post('/api/connectors/ical').send({ url: ICAL }).expect(403);
    await denied.delete('/api/connectors/imap').expect(403);
    expect(repo.rows).toHaveLength(0);
    expect(repo.audit.rows).toHaveLength(0);

    delete process.env.CONNECTOR_CREDENTIALS_KEY;
    const response = await denied
      .post('/api/connectors/imap')
      .send({ preset: 'gmail', username: EMAIL, appPassword: PASSWORD })
      .expect(403);
    expectAbsent([PASSWORD, ICAL], response.text);
    expectAbsent([PASSWORD, ICAL], logs.join('\n'));
  });

  it('returns 401 when credentials are missing', async () => {
    const missing = await request(app.getHttpServer())
      .post('/api/connectors/imap')
      .set('x-test-user', 'anonymous')
      .send({ preset: 'gmail', username: EMAIL, appPassword: PASSWORD })
      .expect(401);
    expect(missing.body.message).toBe('Missing authentication credentials');
    expectAbsent([PASSWORD], missing.text);

    await request(app.getHttpServer())
      .get('/api/connectors')
      .set('x-test-user', 'no-key')
      .expect(401);
  });

  it('returns 503 with a fixed message when the credentials key is missing or invalid', async () => {
    const invalid: Array<string | undefined> = [
      undefined,
      '',
      '   ',
      'not-a-key',
      randomBytes(31).toString('base64'),
      randomBytes(33).toString('base64'),
      randomBytes(32).toString('base64url'),
    ];

    for (const value of invalid) {
      if (value === undefined) delete process.env.CONNECTOR_CREDENTIALS_KEY;
      else process.env.CONNECTOR_CREDENTIALS_KEY = value;
      const response = await authed()
        .post('/api/connectors/imap')
        .send({ preset: 'gmail', username: EMAIL, appPassword: PASSWORD })
        .expect(503);
      expect(response.body.message).toBe(CONNECTOR_CREDENTIALS_UNAVAILABLE_MESSAGE);
      expectAbsent([PASSWORD, value?.trim() || ''], response.text);
      await authed().get('/api/connectors').expect(503);
      await authed().post('/api/connectors/ical').send({ url: ICAL }).expect(503);
      await authed().delete('/api/connectors/imap').expect(503);
    }

    delete process.env.CONNECTOR_CREDENTIALS_KEY;
    const oversized = await authed()
      .post('/api/connectors/ical')
      .send({ url: ICAL, pad: 'x'.repeat(5000) })
      .expect(503);
    expect(oversized.body.message).toBe(CONNECTOR_CREDENTIALS_UNAVAILABLE_MESSAGE);
    expectAbsent([ICAL_TOKEN, ICAL], oversized.text);
    expect(repo.rows).toHaveLength(0);
    expect(repo.audit.rows).toHaveLength(0);
    expectAbsent([PASSWORD, ICAL, ICAL_TOKEN, 'not-a-key'], logs.join('\n'));
  });

  it('connects, lists and deletes only the owner row and replaces the same kind', async () => {
    const created = await authed()
      .post('/api/connectors/imap')
      .send({
        preset: 'gmail',
        username: EMAIL,
        appPassword: SPACED_PASSWORD,
        userId: OTHER,
      })
      .expect(200);
    expect(Object.keys(created.body).sort()).toEqual([
      'createdAt',
      'kind',
      'lastVerifiedAt',
      'preset',
      'updatedAt',
      'username',
    ]);
    expect(created.body).toMatchObject({
      kind: 'imap',
      preset: 'gmail',
      username: EMAIL,
      lastVerifiedAt: null,
    });
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0].userId).toBe(OWNER);
    expect(repo.rows[0].keyVersion).toBe(1);
    expect(decryptConnectorSecret(OWNER, 'imap', repo.rows[0].secretCiphertext)).toBe(
      NORMALIZED_PASSWORD,
    );
    expect(() => decryptConnectorSecret(OTHER, 'imap', repo.rows[0].secretCiphertext)).toThrow(
      ConnectorDecryptError,
    );
    expect(() => decryptConnectorSecret(OWNER, 'ical', repo.rows[0].secretCiphertext)).toThrow(
      ConnectorDecryptError,
    );

    const replaced = await authed()
      .post('/api/connectors/imap')
      .send({ preset: 'yahoo', username: OTHER_EMAIL, appPassword: NEXT_PASSWORD })
      .expect(200);
    expect(replaced.body).toMatchObject({
      kind: 'imap',
      preset: 'yahoo',
      username: OTHER_EMAIL,
      createdAt: created.body.createdAt,
      lastVerifiedAt: null,
    });
    expect(Date.parse(replaced.body.updatedAt)).toBeGreaterThan(Date.parse(created.body.updatedAt));
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0].id).toBe(repo.audit.rows[0].subjectId);
    expect(decryptConnectorSecret(OWNER, 'imap', repo.rows[0].secretCiphertext)).toBe(NEXT_PASSWORD);

    const ical = await authed().post('/api/connectors/ical').send({ url: ICAL }).expect(200);
    expect(Object.keys(ical.body).sort()).toEqual(['createdAt', 'kind', 'lastVerifiedAt', 'updatedAt']);
    expect(ical.body).toMatchObject({ kind: 'ical', lastVerifiedAt: null });
    expect(repo.rows).toHaveLength(2);
    const icalRow = repo.rows.find((row) => row.kind === 'ical');
    expect(icalRow).toBeDefined();
    expect(decryptConnectorSecret(OWNER, 'ical', icalRow?.secretCiphertext || '')).toBe(ICAL);

    const listed = await authed().get('/api/connectors').expect(200);
    expect(listed.body.connections.map((item: { kind: string }) => item.kind).sort()).toEqual([
      'ical',
      'imap',
    ]);
    expect(JSON.stringify(listed.body).includes(repo.rows[0].secretCiphertext)).toBe(false);
    expect(JSON.stringify(listed.body).includes(icalRow?.secretCiphertext || 'missing-ciphertext')).toBe(
      false,
    );

    const hidden = await authed(OTHER).get('/api/connectors').expect(200);
    expect(hidden.body).toEqual({ connections: [] });
    const deniedDelete = await authed(OTHER).delete('/api/connectors/imap').expect(404);
    expect(deniedDelete.body.message).toBe(CONNECTION_NOT_FOUND_MESSAGE);
    expect(repo.rows).toHaveLength(2);

    await authed().delete('/api/connectors/imap').expect(204);
    expect(repo.rows.map((row) => row.kind)).toEqual(['ical']);
    await authed().delete('/api/connectors/imap').expect(404);
    await authed().delete('/api/connectors/google').expect(400);
    const unknown = await authed().delete(`/api/connectors/${encodeURIComponent(PASSWORD)}`).expect(400);
    expect(unknown.body.message).toBe(UNKNOWN_CONNECTOR_MESSAGE);
    expectAbsent([PASSWORD, NEXT_PASSWORD, SPACED_PASSWORD, ICAL, ICAL_TOKEN], unknown.text);
    expect(repo.rows.map((row) => row.kind)).toEqual(['ical']);

    await authed(OTHER)
      .post('/api/connectors/imap')
      .send({ preset: 'icloud', username: OTHER_EMAIL, appPassword: PASSWORD })
      .expect(200);
    const ownerList = await authed().get('/api/connectors').expect(200);
    expect(ownerList.body.connections).toHaveLength(1);
    expect(ownerList.body.connections[0].kind).toBe('ical');
    const otherList = await authed(OTHER).get('/api/connectors').expect(200);
    expect(otherList.body.connections).toEqual([
      expect.objectContaining({ kind: 'imap', preset: 'icloud', username: OTHER_EMAIL }),
    ]);
    expectAbsent(
      [PASSWORD, NEXT_PASSWORD, SPACED_PASSWORD, NORMALIZED_PASSWORD, ICAL, ICAL_TOKEN],
      `${listed.text}\n${hidden.text}\n${ownerList.text}\n${otherList.text}\n${logs.join('\n')}`,
    );
  });

  it('refuses connector input that fails the stage-start checks', async () => {
    const cases: Array<{ path: string; body: unknown; message: string; secret: string }> = [
      {
        path: '/api/connectors/imap',
        body: { preset: 'hotmail', username: EMAIL, appPassword: PASSWORD },
        message: IMAP_PRESET_MESSAGE,
        secret: PASSWORD,
      },
      {
        path: '/api/connectors/imap',
        body: { preset: 'gmail', username: 'not-an-email', appPassword: PASSWORD },
        message: USERNAME_MESSAGE,
        secret: PASSWORD,
      },
      {
        path: '/api/connectors/imap',
        body: { preset: 'gmail', username: EMAIL, appPassword: 'short1!' },
        message: APP_PASSWORD_MESSAGE,
        secret: 'short1!',
      },
      {
        path: '/api/connectors/imap',
        body: { preset: 'gmail', username: EMAIL, appPassword: 'B'.repeat(65) },
        message: APP_PASSWORD_MESSAGE,
        secret: 'B'.repeat(65),
      },
      {
        path: '/api/connectors/ical',
        body: { url: 'http://calendar.example.com/feeds/ical-secret-token' },
        message: ICAL_URL_MESSAGE,
        secret: ICAL_TOKEN,
      },
      {
        path: '/api/connectors/ical',
        body: { url: 'https://user:ical-secret-token@calendar.example.com/feed' },
        message: ICAL_URL_MESSAGE,
        secret: ICAL_TOKEN,
      },
      {
        path: '/api/connectors/ical',
        body: { url: 'https://127.0.0.1/ical-secret-token' },
        message: ICAL_URL_MESSAGE,
        secret: ICAL_TOKEN,
      },
      {
        path: '/api/connectors/imap',
        body: [PASSWORD],
        message: INVALID_CONNECTOR_MESSAGE,
        secret: PASSWORD,
      },
    ];

    for (const item of cases) {
      const response = await authed().post(item.path).send(item.body as never).expect(400);
      expect(response.body.message).toBe(item.message);
      expectAbsent([item.secret], response.text);
    }
    expect(repo.rows).toHaveLength(0);
    expect(repo.audit.rows).toHaveLength(0);
    expectAbsent([PASSWORD, ICAL_TOKEN], logs.join('\n'));
  });

  it('refuses a request body over 4 KB', async () => {
    const response = await authed()
      .post('/api/connectors/ical')
      .send({ url: ICAL, pad: 'x'.repeat(5000) })
      .expect(413);
    expect(response.body.message).toBe(BODY_TOO_LARGE_MESSAGE);
    expectAbsent([ICAL, ICAL_TOKEN], response.text);
    expectAbsent([ICAL, ICAL_TOKEN], logs.join('\n'));
    expect(repo.rows).toHaveLength(0);
    expect(repo.audit.rows).toHaveLength(0);
  });

  it('does not expose the app password or iCal link on success or failure', async () => {
    const secrets = [PASSWORD, NEXT_PASSWORD, ICAL, ICAL_TOKEN];
    const created = await authed()
      .post('/api/connectors/imap')
      .send({ preset: 'gmail', username: EMAIL, appPassword: PASSWORD })
      .expect(200);
    const linked = await authed().post('/api/connectors/ical').send({ url: ICAL }).expect(200);
    const listed = await authed().get('/api/connectors').expect(200);
    expectAbsent(secrets, `${created.text}\n${linked.text}\n${listed.text}`);
    expectAbsent(secrets, JSON.stringify(repo.rows));
    expectAbsent(secrets, JSON.stringify(repo.audit.rows));
    expect(repo.rows.find((row) => row.kind === 'imap')?.secretCiphertext.includes('https://')).toBe(
      false,
    );

    const badKey = await withKey('bad-key-material', () =>
      authed()
        .post('/api/connectors/imap')
        .send({ preset: 'gmail', username: EMAIL, appPassword: PASSWORD })
        .expect(503),
    );
    expectAbsent([PASSWORD, 'bad-key-material'], badKey.text);

    const badInput = await authed()
      .post('/api/connectors/ical')
      .send({ url: 'http://calendar.example.com/feeds/ical-secret-token' })
      .expect(400);
    expectAbsent([ICAL_TOKEN], badInput.text);

    repo.failSave = new Error(`insert failed ${PASSWORD} ${ICAL}`);
    const saveFailed = await authed()
      .post('/api/connectors/imap')
      .send({ preset: 'icloud', username: EMAIL, appPassword: NEXT_PASSWORD })
      .expect(500);
    expect(saveFailed.body.message).toBe(SAVE_FAILED_MESSAGE);
    expectAbsent(secrets, saveFailed.text);
    repo.failSave = null;

    repo.failFind = new Error(`select failed ${PASSWORD} ${ICAL}`);
    const listFailed = await authed().get('/api/connectors').expect(500);
    expect(listFailed.body.message).toBe(LIST_FAILED_MESSAGE);
    expectAbsent(secrets, listFailed.text);
    repo.failFind = null;

    repo.failDelete = new Error(`delete failed ${PASSWORD} ${ICAL}`);
    const deleteFailed = await authed().delete('/api/connectors/imap').expect(500);
    expect(deleteFailed.body.message).toBe(DELETE_FAILED_MESSAGE);
    expectAbsent(secrets, deleteFailed.text);
    repo.failDelete = null;

    expect(repo.rows).toHaveLength(2);
    expectAbsent(secrets, logs.join('\n'));
    expectAbsent([EMAIL], JSON.stringify(repo.audit.rows));
    expectAbsent([EMAIL, PASSWORD, ICAL], logs.join('\n'));
  });

  it('writes an audit row with action, kind and preset on connect, replace and delete', async () => {
    await authed()
      .post('/api/connectors/imap')
      .send({ preset: 'gmail', username: EMAIL, appPassword: PASSWORD })
      .expect(200);
    await authed()
      .post('/api/connectors/imap')
      .send({ preset: 'yahoo', username: OTHER_EMAIL, appPassword: NEXT_PASSWORD })
      .expect(200);
    await authed().delete('/api/connectors/imap').expect(204);
    await authed().post('/api/connectors/ical').send({ url: ICAL }).expect(200);
    await authed().post('/api/connectors/ical').send({ url: `${ICAL}?next=1` }).expect(200);
    await authed().delete('/api/connectors/ical').expect(204);

    expect(repo.audit.rows.map((row) => row.payload)).toEqual([
      { action: 'connect', kind: 'imap', preset: 'gmail' },
      { action: 'replace', kind: 'imap', preset: 'yahoo' },
      { action: 'delete', kind: 'imap', preset: 'yahoo' },
      { action: 'connect', kind: 'ical', preset: null },
      { action: 'replace', kind: 'ical', preset: null },
      { action: 'delete', kind: 'ical', preset: null },
    ]);
    for (const row of repo.audit.rows) {
      expect(Object.keys(row.payload).sort()).toEqual(['action', 'kind', 'preset']);
      expect(row.category).toBe('connector');
      expect(row.eventType).toBe(`connector.${(row.payload as { action: string }).action}`);
      expect(row.subjectType).toBe('connector_connection');
      expect(row.userId).toBe(OWNER);
      expect(row.subjectId).toMatch(/^[0-9a-f-]{36}$/);
    }
    expectAbsent([PASSWORD, NEXT_PASSWORD, EMAIL, OTHER_EMAIL, ICAL, ICAL_TOKEN], JSON.stringify(repo.audit.rows));
    expect(repo.rows).toHaveLength(0);
  });
});

function expectAbsent(secrets: string[], value: string): void {
  for (const secret of secrets) {
    if (!secret) continue;
    expect(value.includes(secret)).toBe(false);
  }
}

async function withKey<T>(value: string, run: () => Promise<T>): Promise<T> {
  const previous = process.env.CONNECTOR_CREDENTIALS_KEY;
  process.env.CONNECTOR_CREDENTIALS_KEY = value;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.CONNECTOR_CREDENTIALS_KEY;
    else process.env.CONNECTOR_CREDENTIALS_KEY = previous;
  }
}

function watchLogs(logs: string[]): () => void {
  const methods = ['log', 'warn', 'error', 'debug', 'verbose'] as const;
  const spies = methods.map((method) =>
    jest.spyOn(Logger.prototype, method).mockImplementation((...args: unknown[]) => {
      logs.push(args.map(stringifyArg).join(' '));
    }),
  );
  const consoles = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
    jest.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      logs.push(args.map(stringifyArg).join(' '));
    }),
  );
  return () => {
    spies.forEach((spy) => spy.mockRestore());
    consoles.forEach((spy) => spy.mockRestore());
  };
}

function stringifyArg(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return `${value.name} ${value.message} ${value.stack ?? ''}`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

class MemoryAuditRepository {
  rows: Array<Record<string, any>> = [];

  async save(value: Record<string, any>): Promise<Record<string, any>> {
    const stored = {
      ...value,
      id: value.id ?? randomUUID(),
      payload: { ...(value.payload as object) },
      createdAt: new Date(),
    };
    this.rows.push(stored);
    return stored;
  }
}

class MemoryConnectionRepository {
  rows: ConnectorConnection[] = [];
  audit = new MemoryAuditRepository();
  failSave: Error | null = null;
  failFind: Error | null = null;
  failDelete: Error | null = null;
  manager = {
    transaction: async (
      run: (manager: { getRepository: (entity: unknown) => unknown }) => Promise<unknown>,
    ): Promise<unknown> => {
      const connectionSnap = this.rows.map(cloneConnection);
      const auditSnap = this.audit.rows.map((row) => ({ ...row, payload: { ...row.payload } }));
      try {
        return await run({
          getRepository: (entity: unknown) => {
            if (entity === ConnectorConnection) return this;
            if (entity === AuditEventEntity) return this.audit;
            throw new Error('unexpected repository');
          },
        });
      } catch (error) {
        this.rows = connectionSnap;
        this.audit.rows = auditSnap;
        throw error;
      }
    },
  };

  create(value: Partial<ConnectorConnection>): ConnectorConnection {
    return { ...value } as ConnectorConnection;
  }

  async save(value: ConnectorConnection): Promise<ConnectorConnection> {
    if (this.failSave) throw this.failSave;
    const stored = cloneConnection({
      ...value,
      id: value.id || randomUUID(),
      createdAt: value.createdAt ?? new Date(),
      updatedAt: value.updatedAt ?? new Date(),
      lastVerifiedAt: value.lastVerifiedAt ?? null,
      keyVersion: value.keyVersion ?? 1,
    });
    const index = this.rows.findIndex((row) => row.id === stored.id);
    if (index === -1) this.rows.push(stored);
    else this.rows[index] = stored;
    return cloneConnection(stored);
  }

  async find(options?: { where?: Record<string, unknown> }): Promise<ConnectorConnection[]> {
    if (this.failFind) throw this.failFind;
    return this.rows.filter((row) => matches(row, options?.where)).map(cloneConnection);
  }

  async findOne(options?: { where?: Record<string, unknown> }): Promise<ConnectorConnection | null> {
    if (this.failFind) throw this.failFind;
    const found = this.rows.find((row) => matches(row, options?.where));
    return found ? cloneConnection(found) : null;
  }

  async delete(criteria: Record<string, unknown>): Promise<{ affected: number }> {
    if (this.failDelete) throw this.failDelete;
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => !matches(row, criteria));
    return { affected: before - this.rows.length };
  }
}

function cloneConnection(row: ConnectorConnection): ConnectorConnection {
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    lastVerifiedAt: row.lastVerifiedAt ? new Date(row.lastVerifiedAt) : null,
  };
}

function matches(row: ConnectorConnection, where?: Record<string, unknown>): boolean {
  if (!where) return true;
  return Object.entries(where).every(
    ([key, value]) => (row as unknown as Record<string, unknown>)[key] === value,
  );
}
