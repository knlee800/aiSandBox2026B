import { ExecutionContext, INestApplication, Logger, UnauthorizedException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { FindOperator } from 'typeorm';
import { ApiKeyAuthGuard } from '../auth/api-key-auth.guard';
import { AuthService } from '../auth/auth.service';
import { EntitlementService } from '../auth/entitlement.service';
import { platformCookieNames } from '../auth/platform-cookies';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ChatLink } from '../entities/chat-link.entity';
import { ChatLinkCode } from '../entities/chat-link-code.entity';
import { SameOriginWriteGuard } from '../guards/same-origin-write.guard';
import { ChatLinkController } from './chat-link.controller';
import { ChatLinkService } from './chat-link.service';
import { ChatCommandService } from './chat-commands';
import { ChatDeliveryService } from './chat-delivery.service';
import { ChatRunService } from './chat-run.service';
import { CHAT_TRANSPORT_PROVIDER, ChatChannelRunner, ChatModule } from './chat.module';

const OWNER = '11111111-1111-4111-8111-111111111111';
const NOT_ENTITLED = '22222222-2222-4222-8222-222222222222';
const DISCORD_ID = '987654321098765432';
const APP_ORIGIN = 'http://localhost:3000';
const VALID_API_KEY = 'test-harness-api-key';

const TOKENS: Record<string, string> = {
  'owner-token': OWNER,
  'plain-token': NOT_ENTITLED,
};

describe('ChatLinkController (CHAT-DISCORD-01 A1)', () => {
  const originalSwitch = process.env.CHAT_DISCORD_ENABLED;
  const originalBase = process.env.APP_BASE_URL;
  let app: INestApplication;
  let store: MemoryStore;
  let service: ChatLinkService;
  let logs: string[];
  let restoreLogs: () => void;

  beforeEach(async () => {
    process.env.CHAT_DISCORD_ENABLED = 'true';
    process.env.APP_BASE_URL = APP_ORIGIN;
    store = new MemoryStore();
    logs = [];
    restoreLogs = watchLogs(logs);

    const moduleRef = await Test.createTestingModule({
      controllers: [ChatLinkController],
      providers: [
        ChatLinkService,
        SessionCookieGuard,
        // Not used by the controller. Provided so that the API-key tests run
        // against a key the API-key path accepts (with harness scope): if the
        // routes ever went back to SessionOrApiKeyAuthGuard, those tests fail.
        SessionOrApiKeyAuthGuard,
        { provide: getRepositoryToken(ChatLink), useValue: store.links },
        { provide: getRepositoryToken(ChatLinkCode), useValue: store.codes },
        {
          provide: ApiKeyAuthGuard,
          useValue: {
            canActivate: (context: ExecutionContext) => {
              const req = context.switchToHttp().getRequest();
              if (req.headers['authorization'] !== `Bearer ${VALID_API_KEY}`) {
                throw new UnauthorizedException('Invalid API key');
              }
              req.apiKeyIdentity = {
                userId: OWNER,
                apiKeyId: 'key-1',
                scopes: ['ai:execute', 'ai:harness'],
                harnessEntitled: true,
              };
              return true;
            },
          },
        },
        {
          provide: AuthService,
          useValue: {
            validateSessionToken: async (token: string) =>
              TOKENS[token] ? { id: TOKENS[token] } : null,
          },
        },
        {
          provide: EntitlementService,
          useValue: { resolveHarnessEntitled: async (userId: string) => userId === OWNER },
        },
        { provide: APP_GUARD, useClass: SameOriginWriteGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    await app.init();
    service = moduleRef.get(ChatLinkService);
  });

  afterEach(async () => {
    if (app) await app.close();
    restoreLogs();
    if (originalSwitch === undefined) delete process.env.CHAT_DISCORD_ENABLED;
    else process.env.CHAT_DISCORD_ENABLED = originalSwitch;
    if (originalBase === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = originalBase;
  });

  function as(token?: string) {
    const server = request(app.getHttpServer());
    const cookie = token ? [`${platformCookieNames().session}=${token}`] : [];
    const read = (req: request.Test) => (token ? req.set('Cookie', cookie) : req);
    const write = (req: request.Test) => read(req).set('Origin', APP_ORIGIN);
    return {
      get: (path: string) => read(server.get(path)),
      post: (path: string) => write(server.post(path)),
      delete: (path: string) => write(server.delete(path)),
    };
  }

  const WRITES: Array<['post' | 'delete', string]> = [
    ['post', '/api/chat-links/discord/code'],
    ['post', '/api/chat-links/discord/confirm'],
    ['post', '/api/chat-links/discord/cancel'],
    ['delete', '/api/chat-links/discord'],
  ];

  it('uses SessionCookieGuard (session only) on the whole controller, as the API key routes do', () => {
    const guards = Reflect.getMetadata('__guards__', ChatLinkController);
    expect(guards).toEqual([SessionCookieGuard]);
    const apiKeyController = readFileSync(join(__dirname, '..', 'auth', 'api-key.controller.ts'), 'utf8');
    expect(apiKeyController).toContain('@UseGuards(SessionCookieGuard)');
  });

  describe('401 without a session', () => {
    it.each([['get', '/api/chat-links'] as ['get', string], ...WRITES])(
      '%s %s',
      async (method, path) => {
        const response = await as()[method](path).expect(401);
        expect(response.body.message).toBe('Authentication required');
        expect(store.calls).toEqual([]);
      },
    );

    it('an unknown session token is 401 too', async () => {
      const read = await as('stale-token').get('/api/chat-links').expect(401);
      expect(read.body.message).toBe('Invalid or expired session');
      await as('stale-token').post('/api/chat-links/discord/code').expect(401);
      expect(store.calls).toEqual([]);
    });
  });

  describe('an API key alone is refused (session only)', () => {
    it.each([['get', '/api/chat-links'] as ['get', string], ...WRITES])(
      '%s %s with a valid harness API key and no session is 401 and touches nothing',
      async (method, path) => {
        const server = request(app.getHttpServer());
        const response = await server[method](path)
          .set('Authorization', `Bearer ${VALID_API_KEY}`)
          .send({ locale: 'en' })
          .expect(401);
        expect(response.body.message).toBe('Authentication required');
        expect(store.calls).toEqual([]);
        expect(store.links.rows).toHaveLength(0);
        expect(store.codes.rows).toHaveLength(0);
        expect(store.audit.rows).toHaveLength(0);
      },
    );

    it('a valid session with harness access works, and a Bearer header beside it changes nothing', async () => {
      const server = request(app.getHttpServer());
      const cookie = [`${platformCookieNames().session}=owner-token`];
      const state = await server
        .get('/api/chat-links')
        .set('Cookie', cookie)
        .set('Authorization', `Bearer ${VALID_API_KEY}`)
        .expect(200);
      expect(state.body).toEqual({ enabled: true, paused: false, discord: { link: null, pending: null } });

      const created = await request(app.getHttpServer())
        .post('/api/chat-links/discord/code')
        .set('Cookie', cookie)
        .set('Origin', APP_ORIGIN)
        .expect(201);
      expect(created.body.channel).toBe('discord');
      expect(store.codes.rows).toHaveLength(1);
      expect(store.codes.rows[0].userId).toBe(OWNER);
    });
  });

  describe('403 without harness access', () => {
    it.each([['get', '/api/chat-links'] as ['get', string], ...WRITES])(
      '%s %s',
      async (method, path) => {
        await as('plain-token')[method](path).expect(403);
        expect(store.calls).toEqual([]);
      },
    );
  });

  it('a cross-origin write with the session cookie is refused by the global guard and writes nothing', async () => {
    await request(app.getHttpServer())
      .post('/api/chat-links/discord/code')
      .set('Cookie', [`${platformCookieNames().session}=owner-token`])
      .set('Origin', 'https://evil.example.com')
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/chat-links/discord/code')
      .set('Cookie', [`${platformCookieNames().session}=owner-token`])
      .expect(403);
    expect(store.calls).toEqual([]);
  });

  describe('switch off', () => {
    beforeEach(() => {
      process.env.CHAT_DISCORD_ENABLED = 'false';
    });

    it('GET answers enabled false and reads nothing', async () => {
      const response = await as('owner-token').get('/api/chat-links').expect(200);
      expect(response.body).toEqual({
        enabled: false,
        paused: false,
        discord: { link: null, pending: null },
      });
      expect(store.calls).toEqual([]);
    });

    it.each(WRITES)('%s %s answers 503 chat_link_unavailable and writes nothing', async (method, path) => {
      const response = await as('owner-token')[method](path).send({ locale: 'en' }).expect(503);
      expect(response.body).toEqual({
        statusCode: 503,
        message: 'Chat linking is not available',
        error: 'Service Unavailable',
        code: 'chat_link_unavailable',
      });
      expect(store.calls).toEqual([]);
      expect(store.links.rows).toHaveLength(0);
      expect(store.codes.rows).toHaveLength(0);
      expect(store.audit.rows).toHaveLength(0);
    });
  });

  it('the main flow: no link, code, pending claim, linked, unlink', async () => {
    const owner = as('owner-token');

    // No link.
    const empty = await owner.get('/api/chat-links').expect(200);
    expect(empty.body).toEqual({ enabled: true, paused: false, discord: { link: null, pending: null } });

    // Code: shown once.
    const created = await owner.post('/api/chat-links/discord/code').send({ locale: 'zh-TW' }).expect(201);
    expect(Object.keys(created.body).sort()).toEqual(['channel', 'code', 'expiresAt']);
    expect(created.body.channel).toBe('discord');
    expect(created.body.code).toMatch(/^[23456789A-HJ-NP-Z]{4}-[23456789A-HJ-NP-Z]{4}$/);
    const code: string = created.body.code;

    const waiting = await owner.get('/api/chat-links').expect(200);
    expect(waiting.body.discord.pending).toEqual({
      channel: 'discord',
      claimed: false,
      expiresAt: created.body.expiresAt,
    });
    expect(waiting.text).not.toContain(code);
    expect(waiting.text).not.toContain(code.replace('-', ''));

    // Pending claim (the Discord command calls the service in slice B).
    expect((await service.claim(code, DISCORD_ID, 'Keith', 'zh-TW')).outcome).toBe('claimed');
    const pending = await owner.get('/api/chat-links').expect(200);
    expect(pending.body.discord.link).toBeNull();
    expect(pending.body.discord.pending).toMatchObject({
      channel: 'discord',
      claimed: true,
      displayName: 'Keith',
      externalIdLast4: '5432',
    });
    expect(pending.text).not.toContain(DISCORD_ID);

    // Linked.
    const confirmed = await owner.post('/api/chat-links/discord/confirm').expect(200);
    expect(confirmed.body).toEqual({
      channel: 'discord',
      linkedAt: expect.any(String),
      lastUsedAt: null,
      externalIdLast4: '5432',
    });
    const linked = await owner.get('/api/chat-links').expect(200);
    expect(linked.body).toEqual({
      enabled: true,
      paused: false,
      discord: { link: confirmed.body, pending: null },
    });
    expect(linked.text).not.toContain(DISCORD_ID);
    expect(store.links.rows[0].locale).toBe('zh-TW');

    const again = await owner.post('/api/chat-links/discord/code').send({}).expect(409);
    expect(again.body).toEqual({
      statusCode: 409,
      message: 'A Discord account is already linked',
      error: 'Conflict',
      code: 'chat_link_exists',
    });

    // Unlink.
    const removed = await owner.delete('/api/chat-links/discord').expect(200);
    expect(removed.body).toEqual({ channel: 'discord', removed: true });
    expect(store.links.rows).toHaveLength(0);
    expect(store.codes.rows).toHaveLength(0);
    const after = await owner.get('/api/chat-links').expect(200);
    expect(after.body.discord).toEqual({ link: null, pending: null });

    const responses = [empty, waiting, pending, confirmed, linked, removed, after].map((r) => r.text).join('\n');
    expect(responses).not.toContain(createHash('sha256').update(code.replace('-', '')).digest('hex'));
    const auditText = JSON.stringify(store.audit.rows);
    expect(auditText).not.toContain(DISCORD_ID);
    expect(auditText).not.toContain(code.replace('-', ''));
    const allLogs = logs.join('\n');
    expect(allLogs).not.toContain(DISCORD_ID);
    expect(allLogs).not.toContain(code.replace('-', ''));
    expect(allLogs).not.toContain(code);
  });

  it('confirm with no claim is 404 chat_link_no_pending_claim; cancel removes a claim', async () => {
    const owner = as('owner-token');
    const none = await owner.post('/api/chat-links/discord/confirm').expect(404);
    expect(none.body).toEqual({
      statusCode: 404,
      message: 'No link request is waiting for confirmation',
      error: 'Not Found',
      code: 'chat_link_no_pending_claim',
    });

    const created = await owner.post('/api/chat-links/discord/code').expect(201);
    await service.claim(created.body.code, DISCORD_ID, 'Someone', 'en');
    const cancelled = await owner.post('/api/chat-links/discord/cancel').expect(200);
    expect(cancelled.body).toEqual({ channel: 'discord', cancelled: true });
    await owner.post('/api/chat-links/discord/confirm').expect(404);
    expect(store.links.rows).toHaveLength(0);

    const nothing = await owner.post('/api/chat-links/discord/cancel').expect(200);
    expect(nothing.body).toEqual({ channel: 'discord', cancelled: false });
    const unlinkNothing = await owner.delete('/api/chat-links/discord').expect(200);
    expect(unlinkNothing.body).toEqual({ channel: 'discord', removed: false });
  });

  it('the sixth code in an hour is 429 chat_link_rate_limited', async () => {
    const owner = as('owner-token');
    for (let i = 0; i < 5; i += 1) {
      await owner.post('/api/chat-links/discord/code').expect(201);
    }
    const limited = await owner.post('/api/chat-links/discord/code').expect(429);
    expect(limited.body).toMatchObject({
      statusCode: 429,
      error: 'Too Many Requests',
      code: 'chat_link_rate_limited',
    });
    expect(limited.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(store.codes.rows).toHaveLength(1);
  });

  it('a body without a locale, or with an odd one, stores en', async () => {
    const owner = as('owner-token');
    await owner.post('/api/chat-links/discord/code').expect(201);
    expect(store.codes.rows[0].locale).toBe('en');
    await owner.post('/api/chat-links/discord/code').send({ locale: { nested: true } }).expect(201);
    expect(store.codes.rows[0].locale).toBe('en');
    await owner.post('/api/chat-links/discord/code').send(['zh-CN']).expect(201);
    expect(store.codes.rows[0].locale).toBe('en');
  });

  it('ChatModule wires the controller, the service and the three repositories, and the app imports it', () => {
    const controllers = Reflect.getMetadata('controllers', ChatModule);
    const providers = Reflect.getMetadata('providers', ChatModule);
    const exportsList = Reflect.getMetadata('exports', ChatModule);
    expect(controllers).toEqual([ChatLinkController]);
    expect(providers).toEqual([
      ChatLinkService,
      ChatCommandService,
      CHAT_TRANSPORT_PROVIDER,
      ChatChannelRunner,
      ChatRunService,
      ChatDeliveryService,
    ]);
    expect(exportsList).toEqual([ChatLinkService]);

    const appModule = readFileSync(join(__dirname, '..', 'app.module.ts'), 'utf8');
    expect(appModule).toContain("import { ChatModule } from './chat/chat.module';");
    expect(appModule).toMatch(/^\s+ChatModule, \/\/ CHAT-DISCORD-01/m);

    const entities = readFileSync(join(__dirname, '..', 'entities', 'index.ts'), 'utf8');
    expect(entities).toContain("export { ChatLink } from './chat-link.entity';");
    expect(entities).toContain("export { ChatLinkCode } from './chat-link-code.entity';");

    const source = readFileSync(join(__dirname, 'chat-link.controller.ts'), 'utf8');
    expect(source).not.toMatch(/internal/i);
    expect(source).toContain("@Controller('chat-links')");
  });
});

function watchLogs(logs: string[]): () => void {
  const methods = ['log', 'warn', 'error', 'debug', 'verbose'] as const;
  const spies = methods.map((method) =>
    jest.spyOn(Logger.prototype, method).mockImplementation((...args: unknown[]) => {
      logs.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
    }),
  );
  return () => spies.forEach((spy) => spy.mockRestore());
}

/* ---------- In-memory TypeORM stand-in (the same shape as chat-link.service.spec.ts). ---------- */

type Row = Record<string, unknown>;

function sameValue(left: unknown, right: unknown): boolean {
  if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
  return left === right;
}

function asNumber(value: unknown): number {
  return value instanceof Date ? value.getTime() : Number(value);
}

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (expected instanceof FindOperator) {
      switch (expected.type) {
        case 'isNull':
          return actual === null || actual === undefined;
        case 'lessThanOrEqual':
          return asNumber(actual) <= asNumber(expected.value);
        case 'moreThan':
          return asNumber(actual) > asNumber(expected.value);
        default:
          throw new Error(`unsupported operator ${expected.type}`);
      }
    }
    return sameValue(actual, expected);
  });
}

function copy<T>(row: T): T {
  return { ...(row as object) } as T;
}

class MemoryRepository<T extends object> {
  rows: T[] = [];
  manager!: MemoryManager;

  constructor(
    private readonly name: string,
    private readonly calls: string[],
    private readonly uniques: string[][] = [],
  ) {}

  async findOne(options: { where: Row }): Promise<T | null> {
    this.calls.push(`${this.name}.findOne`);
    const found = this.rows.find((row) => matches(row as Row, options.where));
    return found ? copy(found) : null;
  }

  async find(options: { where: Row; order?: Record<string, 'ASC' | 'DESC'> }): Promise<T[]> {
    this.calls.push(`${this.name}.find`);
    const found = this.rows.filter((row) => matches(row as Row, options.where)).map(copy);
    const [orderKey, direction] = Object.entries(options.order ?? {})[0] ?? [];
    if (orderKey) {
      found.sort((a, b) => {
        const diff = asNumber((a as Row)[orderKey]) - asNumber((b as Row)[orderKey]);
        return direction === 'DESC' ? -diff : diff;
      });
    }
    return found;
  }

  async insert(entity: T): Promise<{ identifiers: unknown[] }> {
    this.calls.push(`${this.name}.insert`);
    for (const columns of this.uniques) {
      const clash = this.rows.some((row) =>
        columns.every((column) => sameValue((row as Row)[column], (entity as Row)[column])),
      );
      if (clash) {
        throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
      }
    }
    this.rows.push(copy(entity));
    return { identifiers: [{ id: (entity as Row).id }] };
  }

  async update(where: Row, patch: Partial<T>): Promise<{ affected: number }> {
    this.calls.push(`${this.name}.update`);
    let affected = 0;
    for (const row of this.rows) {
      if (matches(row as Row, where)) {
        Object.assign(row, patch);
        affected += 1;
      }
    }
    return { affected };
  }

  async delete(where: Row): Promise<{ affected: number }> {
    this.calls.push(`${this.name}.delete`);
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => !matches(row as Row, where));
    return { affected: before - this.rows.length };
  }
}

class MemoryManager {
  constructor(private readonly store: MemoryStore) {}

  getRepository(target: unknown): MemoryRepository<object> {
    if (target === ChatLink) return this.store.links as MemoryRepository<object>;
    if (target === ChatLinkCode) return this.store.codes as MemoryRepository<object>;
    if (target === AuditEventEntity) return this.store.audit as MemoryRepository<object>;
    throw new Error('unknown repository');
  }

  async transaction<R>(work: (manager: MemoryManager) => Promise<R>): Promise<R> {
    const snapshot = {
      links: this.store.links.rows.map(copy),
      codes: this.store.codes.rows.map(copy),
      audit: this.store.audit.rows.map(copy),
    };
    try {
      return await work(this);
    } catch (error) {
      this.store.links.rows = snapshot.links;
      this.store.codes.rows = snapshot.codes;
      this.store.audit.rows = snapshot.audit;
      throw error;
    }
  }
}

class MemoryStore {
  calls: string[] = [];
  links = new MemoryRepository<ChatLink>('links', this.calls, [
    ['channel', 'externalUserId'],
    ['userId', 'channel'],
  ]);
  codes = new MemoryRepository<ChatLinkCode>('codes', this.calls, [['codeHash']]);
  audit = new MemoryRepository<AuditEventEntity>('audit', this.calls);
  manager = new MemoryManager(this);

  constructor() {
    this.links.manager = this.manager;
    this.codes.manager = this.manager;
    this.audit.manager = this.manager;
  }
}
