import { ExecutionContext, INestApplication, Logger, UnauthorizedException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
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
import { AgentKnowledgeTrigger } from '../entities/agent-knowledge-trigger.entity';
import { AgentKnowledgeTriggerRun } from '../entities/agent-knowledge-trigger-run.entity';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { UserAgent } from '../entities/user-agent.entity';
import { SameOriginWriteGuard } from '../guards/same-origin-write.guard';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import { EventTriggerController } from './event-trigger.controller';
import { KnowledgeTriggerController } from './knowledge-trigger.controller';
import { KnowledgeTriggerService } from './knowledge-trigger.service';
import { MailTriggerController } from './mail-trigger.controller';
import { ScheduleController } from './schedule.controller';

const OWNER = '11111111-1111-4111-8111-111111111111';
const NOT_ENTITLED = '22222222-2222-4222-8222-222222222222';
const OTHER = '77777777-7777-4777-8777-777777777777';
const OWN_WORKFLOW = '33333333-3333-4333-8333-333333333333';
const OTHER_WORKFLOW = '44444444-4444-4444-8444-444444444444';
const UNKNOWN_ID = '66666666-6666-4666-8666-666666666666';
const DOCUMENT_ID = '88888888-8888-4888-8888-888888888888';
const APP_ORIGIN = 'http://localhost:3000';
const VALID_API_KEY = 'test-harness-api-key';
const MARKER = 'MARKER-TASK-d18f';

const TOKENS: Record<string, string> = {
  'owner-token': OWNER,
  'plain-token': NOT_ENTITLED,
  'other-token': OTHER,
};

function triggerBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    target: { kind: 'chief-of-staff' },
    task: `${MARKER} summarise it`,
    scopeId: 'policies',
    timeZone: 'Asia/Taipei',
    ...overrides,
  };
}

describe('KnowledgeTriggerController (TRIGGER-MORE-01 S1)', () => {
  const originalFlag = process.env.KNOWLEDGE_TRIGGERS_ENABLED;
  const originalBase = process.env.APP_BASE_URL;
  let app: INestApplication;
  let store: MemoryStore;
  let logs: string[];
  let restoreLogs: () => void;

  async function boot(): Promise<void> {
    store = new MemoryStore();
    store.workflows.rows.push(
      { id: OWN_WORKFLOW, userId: OWNER, name: 'Research desk', status: 'active', deletedAt: null } as UserAgent,
      { id: OTHER_WORKFLOW, userId: OTHER, name: 'Not yours', status: 'active', deletedAt: null } as UserAgent,
    );
    const moduleRef = await Test.createTestingModule({
      controllers: [KnowledgeTriggerController],
      providers: [
        KnowledgeTriggerService,
        SessionCookieGuard,
        // Not used by the controller. Provided so that the API-key tests run
        // against a key the API-key path accepts (with harness scope): if the
        // routes ever moved to SessionOrApiKeyAuthGuard, those tests fail.
        SessionOrApiKeyAuthGuard,
        { provide: getRepositoryToken(AgentKnowledgeTrigger), useValue: store.triggers },
        { provide: getRepositoryToken(AgentKnowledgeTriggerRun), useValue: store.runs },
        { provide: getRepositoryToken(UserAgent), useValue: store.workflows },
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
            validateSessionToken: async (token: string) => (TOKENS[token] ? { id: TOKENS[token] } : null),
          },
        },
        {
          provide: EntitlementService,
          useValue: {
            resolveHarnessEntitled: async (userId: string) => userId === OWNER || userId === OTHER,
          },
        },
        { provide: APP_GUARD, useClass: SameOriginWriteGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    await app.init();
  }

  beforeEach(async () => {
    process.env.KNOWLEDGE_TRIGGERS_ENABLED = 'true';
    process.env.APP_BASE_URL = APP_ORIGIN;
    logs = [];
    restoreLogs = watchLogs(logs);
    await boot();
  });

  afterEach(async () => {
    if (app) await app.close();
    restoreLogs();
    if (originalFlag === undefined) delete process.env.KNOWLEDGE_TRIGGERS_ENABLED;
    else process.env.KNOWLEDGE_TRIGGERS_ENABLED = originalFlag;
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
      patch: (path: string) => write(server.patch(path)),
      delete: (path: string) => write(server.delete(path)),
    };
  }

  function snapshot(): string {
    return JSON.stringify({ triggers: store.triggers.rows, runs: store.runs.rows, audit: store.audit.rows });
  }

  const ROUTES: Array<['get' | 'post' | 'patch' | 'delete', string]> = [
    ['get', '/api/knowledge-triggers'],
    ['post', '/api/knowledge-triggers'],
    ['patch', `/api/knowledge-triggers/${UNKNOWN_ID}`],
    ['delete', `/api/knowledge-triggers/${UNKNOWN_ID}`],
    ['get', `/api/knowledge-triggers/${UNKNOWN_ID}/runs`],
  ];

  it('uses SessionCookieGuard (session only) on the whole controller, as the schedule, event and mail trigger routes do', () => {
    expect(Reflect.getMetadata('__guards__', KnowledgeTriggerController)).toEqual([SessionCookieGuard]);
    for (const other of [MailTriggerController, EventTriggerController, ScheduleController]) {
      expect(Reflect.getMetadata('__guards__', KnowledgeTriggerController)).toEqual(
        Reflect.getMetadata('__guards__', other),
      );
    }
    expect(Reflect.getMetadata('path', KnowledgeTriggerController)).toBe('knowledge-triggers');
    const source = readFileSync(join(__dirname, 'knowledge-trigger.controller.ts'), 'utf8');
    expect(source).toContain("@Controller('knowledge-triggers')");
    expect(source).toContain('@UseGuards(SessionCookieGuard)');
    expect(source).toContain('this.entitlements.resolveHarnessEntitled(userId)');
    expect(source).not.toMatch(/SessionOrApiKey|ApiKeyAuthGuard|Csrf[A-Za-z]*|[/]internal|@Public|SkipSameOrigin/);
  });

  describe('401 without a session', () => {
    it.each(ROUTES)('%s %s', async (method, path) => {
      const response = await as()[method](path).send(triggerBody()).expect(401);
      expect(response.body.message).toBe('Authentication required');
      expect(store.calls).toEqual([]);
    });

    it('an unknown session token is 401 too', async () => {
      const response = await as('stale-token').get('/api/knowledge-triggers').expect(401);
      expect(response.body.message).toBe('Invalid or expired session');
      await as('stale-token').post('/api/knowledge-triggers').send(triggerBody()).expect(401);
      expect(store.calls).toEqual([]);
    });
  });

  describe('an API key alone is refused (session only)', () => {
    it.each(ROUTES)('%s %s with a valid harness API key and no session is 401 and touches nothing', async (method, path) => {
      const response = await request(app.getHttpServer())
        [method](path)
        .set('Authorization', `Bearer ${VALID_API_KEY}`)
        .set('Origin', APP_ORIGIN)
        .send(triggerBody())
        .expect(401);
      expect(response.body.message).toBe('Authentication required');
      expect(store.calls).toEqual([]);
      expect(store.triggers.rows).toHaveLength(0);
      expect(store.audit.rows).toHaveLength(0);
    });
  });

  describe('403 without harness access', () => {
    it.each(ROUTES)('%s %s', async (method, path) => {
      await as('plain-token')[method](path).send(triggerBody()).expect(403);
      expect(store.calls).toEqual([]);
    });
  });

  it('a cross-origin write with the session cookie is refused by the global guard and writes nothing', async () => {
    const cookie = [`${platformCookieNames().session}=owner-token`];
    await request(app.getHttpServer())
      .post('/api/knowledge-triggers')
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example.com')
      .send(triggerBody())
      .expect(403);
    await request(app.getHttpServer()).post('/api/knowledge-triggers').set('Cookie', cookie).send(triggerBody()).expect(403);
    expect(store.calls).toEqual([]);
  });

  it('the main flow: create, list, change, history, delete, with the frozen shapes', async () => {
    const owner = as('owner-token');
    const runs = jest.spyOn(KillSwitchConfig, 'GLOBAL_EXECUTION_ENABLED', 'get').mockReturnValue(false);
    try {
      const empty = await owner.get('/api/knowledge-triggers').expect(200);
      expect(empty.body).toEqual({ enabled: true, runsEnabled: false, limit: 3, triggers: [] });

      const created = await owner
        .post('/api/knowledge-triggers')
        .send(triggerBody({ target: { kind: 'workflow', workflowId: OWN_WORKFLOW }, scopeId: 'market-data' }))
        .expect(201);
      expect(Object.keys(created.body).sort()).toEqual(
        ['createdAt', 'enabled', 'id', 'lastRun', 'scopeId', 'target', 'task', 'timeZone', 'updatedAt'].sort(),
      );
      expect(created.body).toMatchObject({
        target: { kind: 'workflow', workflowId: OWN_WORKFLOW, name: 'Research desk', status: 'active' },
        task: `${MARKER} summarise it`,
        scopeId: 'market-data',
        timeZone: 'Asia/Taipei',
        enabled: true,
        lastRun: null,
      });
      const id: string = created.body.id;

      const listed = await owner.get('/api/knowledge-triggers').expect(200);
      expect(Object.keys(listed.body).sort()).toEqual(['enabled', 'limit', 'runsEnabled', 'triggers']);
      expect(listed.body.triggers).toEqual([created.body]);

      const changed = await owner
        .patch(`/api/knowledge-triggers/${id}`)
        .send({ scopeId: 'strategy-docs', timeZone: 'Europe/London', enabled: false })
        .expect(200);
      expect(changed.body).toMatchObject({ id, scopeId: 'strategy-docs', timeZone: 'Europe/London', enabled: false });

      store.runs.rows.push({
        id: 'run-row-1',
        triggerId: id,
        userId: OWNER,
        documentId: DOCUMENT_ID,
        documentKey: 'f'.repeat(64),
        changedAt: new Date('2026-11-16T10:27:00Z'),
        localDate: '2026-11-16',
        outcome: 'skipped',
        reason: 'day_limit',
        collaborationRunId: null,
        createdAt: new Date('2026-11-16T10:30:00Z'),
      });
      const history = await owner.get(`/api/knowledge-triggers/${id}/runs`).expect(200);
      const row = {
        documentId: DOCUMENT_ID,
        changedAt: '2026-11-16T10:27:00.000Z',
        localDate: '2026-11-16',
        outcome: 'skipped',
        reason: 'day_limit',
        collaborationRunId: null,
        at: '2026-11-16T10:30:00.000Z',
      };
      expect(history.body).toEqual({ runs: [{ id: 'run-row-1', ...row }] });
      expect(history.text).not.toContain('f'.repeat(64));
      const withLast = await owner.get('/api/knowledge-triggers').expect(200);
      expect(withLast.body.triggers[0].lastRun).toEqual(row);

      const removed = await owner.delete(`/api/knowledge-triggers/${id}`).expect(200);
      expect(removed.body).toEqual({ id, deleted: true });
      expect(store.triggers.rows).toHaveLength(0);
      expect(store.runs.rows).toHaveLength(0);
      await owner.get(`/api/knowledge-triggers/${id}/runs`).expect(404);

      expect(store.audit.rows.map((entry) => entry.eventType)).toEqual([
        'knowledge_trigger_created',
        'knowledge_trigger_updated',
        'knowledge_trigger_deleted',
      ]);
      for (const secret of [MARKER, 'summarise']) {
        expect(JSON.stringify(store.audit.rows)).not.toContain(secret);
        expect(logs.join('\n')).not.toContain(secret);
      }
    } finally {
      runs.mockRestore();
    }
  });

  describe("another owner's ids answer 404 and change nothing", () => {
    let otherTriggerId: string;

    beforeEach(async () => {
      const created = await as('other-token')
        .post('/api/knowledge-triggers')
        .send(triggerBody({ task: 'theirs', scopeId: 'strategy-docs' }))
        .expect(201);
      otherTriggerId = created.body.id;
      store.runs.rows.push({
        id: 'their-run',
        triggerId: otherTriggerId,
        userId: OTHER,
        documentId: DOCUMENT_ID,
        documentKey: 'e'.repeat(64),
        changedAt: new Date('2026-11-14T00:57:00Z'),
        localDate: '2026-11-14',
        outcome: 'started',
        reason: null,
        collaborationRunId: 'run-x',
        createdAt: new Date('2026-11-14T01:00:00Z'),
      });
    });

    it.each([
      ['patch', (id: string) => `/api/knowledge-triggers/${id}`],
      ['delete', (id: string) => `/api/knowledge-triggers/${id}`],
      ['get', (id: string) => `/api/knowledge-triggers/${id}/runs`],
    ] as Array<['patch' | 'delete' | 'get', (id: string) => string]>)(
      "%s on another owner's trigger, an unknown id and a malformed id",
      async (method, path) => {
        const before = snapshot();
        for (const id of [otherTriggerId, UNKNOWN_ID, 'not-a-uuid']) {
          const response = await as('owner-token')[method](path(id)).send({ enabled: false }).expect(404);
          expect(response.body).toEqual({
            statusCode: 404,
            message: 'Knowledge trigger not found',
            error: 'Not Found',
            code: 'knowledge_trigger_not_found',
          });
        }
        expect(snapshot()).toBe(before);
      },
    );

    it("another owner's triggers are not listed", async () => {
      const listed = await as('owner-token').get('/api/knowledge-triggers').expect(200);
      expect(listed.body.triggers).toEqual([]);
      expect(listed.text).not.toContain('theirs');
      expect(listed.text).not.toContain(otherTriggerId);
    });

    it("another owner's workflow answers 404 on create and on change, and nothing changes", async () => {
      const own = await as('owner-token').post('/api/knowledge-triggers').send(triggerBody()).expect(201);
      const before = snapshot();
      for (const workflowId of [OTHER_WORKFLOW, UNKNOWN_ID]) {
        const create = await as('owner-token')
          .post('/api/knowledge-triggers')
          .send(triggerBody({ target: { kind: 'workflow', workflowId } }))
          .expect(404);
        expect(create.body.code).toBe('knowledge_trigger_workflow_not_found');
        const change = await as('owner-token')
          .patch(`/api/knowledge-triggers/${own.body.id}`)
          .send({ target: { kind: 'workflow', workflowId } })
          .expect(404);
        expect(change.body.code).toBe('knowledge_trigger_workflow_not_found');
      }
      expect(snapshot()).toBe(before);
    });
  });

  describe('validation (stage-start sections 4 and 5)', () => {
    it.each([
      ['no folder', { scopeId: undefined }, 'knowledge_trigger_missing_field'],
      ['a null folder', { scopeId: null }, 'knowledge_trigger_invalid_folder'],
      ['an unknown folder', { scopeId: 'legal-contracts' }, 'knowledge_trigger_invalid_folder'],
      ['a folder in upper case', { scopeId: 'POLICIES' }, 'knowledge_trigger_invalid_folder'],
      ['two folders', { scopeId: ['policies', 'strategy-docs'] }, 'knowledge_trigger_invalid_folder'],
      ['a Chief of Staff trigger on codebase-context', { scopeId: 'codebase-context' }, 'knowledge_trigger_folder_not_readable'],
      ['a Chief of Staff trigger on market-data', { scopeId: 'market-data' }, 'knowledge_trigger_folder_not_readable'],
      ['a Chief of Staff trigger on tech-landscape', { scopeId: 'tech-landscape' }, 'knowledge_trigger_folder_not_readable'],
      ['an empty task', { task: '   ' }, 'knowledge_trigger_invalid_task'],
      ['a task over 7000 characters', { task: 'a'.repeat(7001) }, 'knowledge_trigger_invalid_task'],
      ['an invalid zone', { timeZone: 'Mars/Olympus_Mons' }, 'knowledge_trigger_invalid_time_zone'],
      ['a team that needs a session', { target: { kind: 'coding' } }, 'knowledge_trigger_invalid_target'],
      ['a provider', { provider: 'openai' }, 'knowledge_trigger_unknown_field'],
      ['a model', { model: { choice: 'pinned' } }, 'knowledge_trigger_unknown_field'],
      ['an approval setting', { approvalMode: 'auto' }, 'knowledge_trigger_unknown_field'],
      ['a tool profile', { toolProfile: 'write' }, 'knowledge_trigger_unknown_field'],
      ['a session id', { sessionId: UNKNOWN_ID }, 'knowledge_trigger_unknown_field'],
      ['an armed time', { armedAt: '2026-11-16T00:00:00Z' }, 'knowledge_trigger_unknown_field'],
      ['a document id', { documentId: DOCUMENT_ID }, 'knowledge_trigger_unknown_field'],
      ['a mail sender', { senderFilter: 'a@example.com' }, 'knowledge_trigger_unknown_field'],
    ])('POST refuses %s with 400 and writes nothing', async (_label, overrides, code) => {
      const payload = triggerBody(overrides);
      if ('scopeId' in overrides && overrides.scopeId === undefined) delete payload.scopeId;
      const response = await as('owner-token').post('/api/knowledge-triggers').send(payload).expect(400);
      expect(response.body.code).toBe(code);
      expect(response.text).not.toContain(MARKER);
      expect(store.triggers.rows).toHaveLength(0);
      expect(store.audit.rows).toHaveLength(0);
    });

    it('the edges are accepted: a 7000-character task, each Chief of Staff folder, a workflow on any folder', async () => {
      await as('owner-token').post('/api/knowledge-triggers').send(triggerBody({ task: 'a'.repeat(7000) })).expect(201);
      await as('owner-token').post('/api/knowledge-triggers').send(triggerBody({ scopeId: 'contract-templates' })).expect(201);
      await as('owner-token')
        .post('/api/knowledge-triggers')
        .send(triggerBody({ target: { kind: 'workflow', workflowId: OWN_WORKFLOW }, scopeId: 'tech-landscape' }))
        .expect(201);
      expect(store.triggers.rows.map((row) => row.scopeId)).toEqual(['policies', 'contract-templates', 'tech-landscape']);
    });

    it('PATCH refuses an empty change, a bad folder, the folder rule on the merged row, a bad zone and an unknown field', async () => {
      const own = await as('owner-token').post('/api/knowledge-triggers').send(triggerBody()).expect(201);
      const before = snapshot();
      const patch = (payload: Record<string, unknown>) =>
        as('owner-token').patch(`/api/knowledge-triggers/${own.body.id}`).send(payload).expect(400);
      expect((await patch({})).body.code).toBe('knowledge_trigger_empty_change');
      expect((await patch({ scopeId: null })).body.code).toBe('knowledge_trigger_invalid_folder');
      expect((await patch({ scopeId: 'market-data' })).body.code).toBe('knowledge_trigger_folder_not_readable');
      expect((await patch({ timeZone: 'Bad/Zone' })).body.code).toBe('knowledge_trigger_invalid_time_zone');
      expect((await patch({ userId: OTHER })).body.code).toBe('knowledge_trigger_unknown_field');
      expect(snapshot()).toBe(before);
    });
  });

  it('the fourth trigger is 409 knowledge_trigger_limit_reached', async () => {
    for (let i = 0; i < 3; i += 1) {
      await as('owner-token').post('/api/knowledge-triggers').send(triggerBody({ enabled: i === 0 })).expect(201);
    }
    const refused = await as('owner-token').post('/api/knowledge-triggers').send(triggerBody()).expect(409);
    expect(refused.body).toEqual({
      statusCode: 409,
      message: 'At most 3 knowledge triggers per account',
      error: 'Conflict',
      code: 'knowledge_trigger_limit_reached',
      limit: 3,
    });
    expect(store.triggers.rows).toHaveLength(3);
  });

  describe('KNOWLEDGE_TRIGGERS_ENABLED off', () => {
    it.each([[undefined], ['false'], ['TRUE'], ['1'], [' true']])(
      'with %j the routes still work and GET reports enabled false',
      async (value) => {
        if (value === undefined) delete process.env.KNOWLEDGE_TRIGGERS_ENABLED;
        else process.env.KNOWLEDGE_TRIGGERS_ENABLED = value;
        const owner = as('owner-token');
        const created = await owner.post('/api/knowledge-triggers').send(triggerBody()).expect(201);
        const listed = await owner.get('/api/knowledge-triggers').expect(200);
        expect(listed.body.enabled).toBe(false);
        expect(listed.body.triggers).toHaveLength(1);
        await owner.patch(`/api/knowledge-triggers/${created.body.id}`).send({ enabled: false }).expect(200);
        await owner.get(`/api/knowledge-triggers/${created.body.id}/runs`).expect(200);
        await owner.delete(`/api/knowledge-triggers/${created.body.id}`).expect(200);
      },
    );

    it('the exact string true reports enabled true; the other trigger switches do not', async () => {
      process.env.KNOWLEDGE_TRIGGERS_ENABLED = 'true';
      expect((await as('owner-token').get('/api/knowledge-triggers').expect(200)).body.enabled).toBe(true);
      const names = ['SCHEDULES_ENABLED', 'EVENT_TRIGGERS_ENABLED', 'MAIL_TRIGGERS_ENABLED'] as const;
      const originals = names.map((name) => process.env[name]);
      try {
        delete process.env.KNOWLEDGE_TRIGGERS_ENABLED;
        for (const name of names) process.env[name] = 'true';
        expect((await as('owner-token').get('/api/knowledge-triggers').expect(200)).body.enabled).toBe(false);
      } finally {
        names.forEach((name, index) => {
          if (originals[index] === undefined) delete process.env[name];
          else process.env[name] = originals[index];
        });
      }
    });

    it('the gateway parts boot with KNOWLEDGE_TRIGGERS_ENABLED unset', async () => {
      await app.close();
      delete process.env.KNOWLEDGE_TRIGGERS_ENABLED;
      await boot();
      expect((await as('owner-token').get('/api/knowledge-triggers').expect(200)).body.enabled).toBe(false);
    });
  });

  describe('S1 boundaries', () => {
    it('the S1 files have no timer, no document read and no run start', () => {
      for (const name of [
        'knowledge-trigger-switch.ts',
        'knowledge-trigger-validation.ts',
        'knowledge-trigger.controller.ts',
        'knowledge-trigger.service.ts',
      ]) {
        const source = readFileSync(join(__dirname, name), 'utf8');
        expect(source).not.toMatch(
          /setInterval|setTimeout|OnModuleInit|OnApplicationBootstrap|CollaborationStartService|OrchestrationModule|approveStep|KnowledgeDocument|knowledge_documents|KnowledgeService|ConnectorBroker|ConnectorsModule|ScheduleRunService|ScheduleTimer|EventTriggerRunService|EventTriggerTimer|MailTriggerRunService|MailTriggerTimer/,
        );
      }
      const service = readFileSync(join(__dirname, 'knowledge-trigger.service.ts'), 'utf8');
      expect(service.match(/isKnowledgeTriggersEnabled\(\)/g)).toHaveLength(1);
      expect(service).toMatch(/enabled: isKnowledgeTriggersEnabled\(\),/);
      expect(service).not.toMatch(/isSchedulesEnabled|isEventTriggersEnabled|isMailTriggersEnabled/);
    });

    it('the knowledge files reuse the schedule helpers by import and never import the event, mail or schedule routes', () => {
      for (const name of ['knowledge-trigger-validation.ts', 'knowledge-trigger.controller.ts', 'knowledge-trigger.service.ts']) {
        const source = readFileSync(join(__dirname, name), 'utf8');
        expect(source).not.toMatch(
          /from '\.\/event-trigger|from '\.\/mail-trigger|from '\.\/schedule\.controller'|from '\.\/schedule-run|from '\.\/schedule-timer/,
        );
      }
      expect(readFileSync(join(__dirname, 'knowledge-trigger-validation.ts'), 'utf8')).toContain(
        "import { isAcceptedTimeZone, isUuid } from './schedule-validation';",
      );
      // The frozen routes keep their own paths.
      expect(Reflect.getMetadata('path', MailTriggerController)).toBe('mail-triggers');
      expect(Reflect.getMetadata('path', EventTriggerController)).toBe('event-triggers');
      expect(Reflect.getMetadata('path', ScheduleController)).toBe('schedules');
    });
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

/* ---------- In-memory TypeORM stand-in (the mail trigger controller spec's store, without connections). ---------- */

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
        case 'in':
          return (expected.value as unknown[]).some((value) => sameValue(actual, value));
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

function sortRows<T>(rows: T[], order?: Record<string, 'ASC' | 'DESC'>): T[] {
  const [orderKey, direction] = Object.entries(order ?? {})[0] ?? [];
  if (orderKey) {
    rows.sort((a, b) => {
      const diff = asNumber((a as Row)[orderKey]) - asNumber((b as Row)[orderKey]);
      return direction === 'DESC' ? -diff : diff;
    });
  }
  return rows;
}

class MemoryRepository<T extends object> {
  rows: T[] = [];
  manager!: MemoryManager;

  constructor(
    private readonly name: string,
    private readonly calls: string[],
  ) {}

  async findOne(options: { where: Row; order?: Record<string, 'ASC' | 'DESC'> }): Promise<T | null> {
    this.calls.push(`${this.name}.findOne`);
    const found = sortRows(
      this.rows.filter((row) => matches(row as Row, options.where)),
      options.order,
    )[0];
    return found ? copy(found) : null;
  }

  async find(options: { where: Row; order?: Record<string, 'ASC' | 'DESC'>; take?: number }): Promise<T[]> {
    this.calls.push(`${this.name}.find`);
    const found = sortRows(
      this.rows.filter((row) => matches(row as Row, options.where)).map(copy),
      options.order,
    );
    return options.take === undefined ? found : found.slice(0, options.take);
  }

  async count(options: { where: Row }): Promise<number> {
    this.calls.push(`${this.name}.count`);
    return this.rows.filter((row) => matches(row as Row, options.where)).length;
  }

  async insert(entity: T): Promise<{ identifiers: unknown[] }> {
    this.calls.push(`${this.name}.insert`);
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

/** Sequential requests only here, so a snapshot rollback is enough. */
class MemoryManager {
  constructor(private readonly store: MemoryStore) {}

  getRepository(target: unknown): MemoryRepository<object> {
    if (target === AgentKnowledgeTrigger) return this.store.triggers as MemoryRepository<object>;
    if (target === AgentKnowledgeTriggerRun) return this.store.runs as MemoryRepository<object>;
    if (target === UserAgent) return this.store.workflows as MemoryRepository<object>;
    if (target === AuditEventEntity) return this.store.audit as MemoryRepository<object>;
    throw new Error('unknown repository');
  }

  async query(sql: string, params: unknown[]): Promise<unknown[]> {
    this.store.calls.push('manager.query');
    this.store.queries.push({ sql, params });
    return [];
  }

  async transaction<R>(work: (manager: MemoryManager) => Promise<R>): Promise<R> {
    const snapshot = {
      triggers: this.store.triggers.rows.map(copy),
      runs: this.store.runs.rows.map(copy),
      audit: this.store.audit.rows.map(copy),
    };
    try {
      return await work(this);
    } catch (error) {
      this.store.triggers.rows = snapshot.triggers;
      this.store.runs.rows = snapshot.runs;
      this.store.audit.rows = snapshot.audit;
      throw error;
    }
  }
}

class MemoryStore {
  calls: string[] = [];
  queries: Array<{ sql: string; params: unknown[] }> = [];
  triggers = new MemoryRepository<AgentKnowledgeTrigger>('triggers', this.calls);
  runs = new MemoryRepository<AgentKnowledgeTriggerRun>('runs', this.calls);
  workflows = new MemoryRepository<UserAgent>('workflows', this.calls);
  audit = new MemoryRepository<AuditEventEntity>('audit', this.calls);
  manager = new MemoryManager(this);

  constructor() {
    for (const repository of [this.triggers, this.runs, this.workflows, this.audit]) {
      repository.manager = this.manager;
    }
  }
}
