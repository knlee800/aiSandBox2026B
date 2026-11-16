import { ExecutionContext, INestApplication, Logger, UnauthorizedException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { FindOperator } from 'typeorm';
import { ApiKeyAuthGuard } from '../auth/api-key-auth.guard';
import { AuthService } from '../auth/auth.service';
import { EntitlementService } from '../auth/entitlement.service';
import { platformCookieNames } from '../auth/platform-cookies';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import { AgentSchedule } from '../entities/agent-schedule.entity';
import { AgentScheduleRun } from '../entities/agent-schedule-run.entity';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { UserAgent } from '../entities/user-agent.entity';
import { SameOriginWriteGuard } from '../guards/same-origin-write.guard';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import { AuthModule } from '../auth/auth.module';
import { OrchestrationModule } from '../orchestration/orchestration.module';
import { SafetyModule } from '../safety/safety.module';
import { ConnectorsModule } from '../connectors/connectors.module';
import { EventTriggerCalendar } from './event-trigger-calendar';
import { EventTriggerController } from './event-trigger.controller';
import { EventTriggerRunService } from './event-trigger-run.service';
import { EventTriggerService } from './event-trigger.service';
import { EventTriggerTimer } from './event-trigger-timer';
import { KnowledgeTriggerController } from './knowledge-trigger.controller';
import { KnowledgeTriggerRunService } from './knowledge-trigger-run.service';
import { KnowledgeTriggerService } from './knowledge-trigger.service';
import { KnowledgeTriggerTimer } from './knowledge-trigger-timer';
import { MailTriggerController } from './mail-trigger.controller';
import { MailTriggerMailbox } from './mail-trigger-mailbox';
import { MailTriggerRunService } from './mail-trigger-run.service';
import { MailTriggerService } from './mail-trigger.service';
import { MailTriggerTimer } from './mail-trigger-timer';
import { ScheduleController } from './schedule.controller';
import { ScheduleRunService } from './schedule-run.service';
import { ScheduleService } from './schedule.service';
import { ScheduleTimer } from './schedule-timer';
import { TriggersModule } from './triggers.module';

const OWNER = '11111111-1111-4111-8111-111111111111';
const NOT_ENTITLED = '22222222-2222-4222-8222-222222222222';
const OTHER = '77777777-7777-4777-8777-777777777777';
const OWN_WORKFLOW = '33333333-3333-4333-8333-333333333333';
const OTHER_WORKFLOW = '44444444-4444-4444-8444-444444444444';
const UNKNOWN_ID = '66666666-6666-4666-8666-666666666666';
const APP_ORIGIN = 'http://localhost:3000';
const VALID_API_KEY = 'test-harness-api-key';
const MARKER = 'MARKER-TASK-c91e';

const TOKENS: Record<string, string> = {
  'owner-token': OWNER,
  'plain-token': NOT_ENTITLED,
  'other-token': OTHER,
};

function scheduleBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    target: { kind: 'chief-of-staff' },
    task: `${MARKER} plan my day`,
    timeOfDay: '07:00',
    days: [1, 2, 3, 4, 5],
    timeZone: 'Asia/Taipei',
    ...overrides,
  };
}

describe('ScheduleController (TRIGGER-01 S1)', () => {
  const originalSchedules = process.env.SCHEDULES_ENABLED;
  const originalBase = process.env.APP_BASE_URL;
  let app: INestApplication;
  let store: MemoryStore;
  let logs: string[];
  let restoreLogs: () => void;

  async function boot(): Promise<void> {
    store = new MemoryStore();
    store.workflows.rows.push(
      { id: OWN_WORKFLOW, userId: OWNER, name: 'Morning briefing', status: 'active', deletedAt: null } as UserAgent,
      { id: OTHER_WORKFLOW, userId: OTHER, name: 'Not yours', status: 'active', deletedAt: null } as UserAgent,
    );
    const moduleRef = await Test.createTestingModule({
      controllers: [ScheduleController],
      providers: [
        ScheduleService,
        SessionCookieGuard,
        // Not used by the controller. Provided so that the API-key tests run
        // against a key the API-key path accepts (with harness scope): if the
        // routes ever moved to SessionOrApiKeyAuthGuard, those tests fail.
        SessionOrApiKeyAuthGuard,
        { provide: getRepositoryToken(AgentSchedule), useValue: store.schedules },
        { provide: getRepositoryToken(AgentScheduleRun), useValue: store.runs },
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
    process.env.SCHEDULES_ENABLED = 'true';
    process.env.APP_BASE_URL = APP_ORIGIN;
    logs = [];
    restoreLogs = watchLogs(logs);
    await boot();
  });

  afterEach(async () => {
    if (app) await app.close();
    restoreLogs();
    if (originalSchedules === undefined) delete process.env.SCHEDULES_ENABLED;
    else process.env.SCHEDULES_ENABLED = originalSchedules;
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
    return JSON.stringify({ schedules: store.schedules.rows, runs: store.runs.rows, audit: store.audit.rows });
  }

  const ROUTES: Array<['get' | 'post' | 'patch' | 'delete', string]> = [
    ['get', '/api/schedules'],
    ['post', '/api/schedules'],
    ['patch', `/api/schedules/${UNKNOWN_ID}`],
    ['delete', `/api/schedules/${UNKNOWN_ID}`],
    ['get', `/api/schedules/${UNKNOWN_ID}/runs`],
  ];

  it('uses SessionCookieGuard (session only) on the whole controller, as the chat link routes do', () => {
    expect(Reflect.getMetadata('__guards__', ScheduleController)).toEqual([SessionCookieGuard]);
    const source = readFileSync(join(__dirname, 'schedule.controller.ts'), 'utf8');
    expect(source).toContain("@Controller('schedules')");
    expect(source).toContain('@UseGuards(SessionCookieGuard)');
    expect(source).not.toMatch(/SessionOrApiKey|ApiKeyAuthGuard|Csrf[A-Za-z]*|[/]internal/);
  });

  describe('401 without a session', () => {
    it.each(ROUTES)('%s %s', async (method, path) => {
      const response = await as()[method](path).send(scheduleBody()).expect(401);
      expect(response.body.message).toBe('Authentication required');
      expect(store.calls).toEqual([]);
    });

    it('an unknown session token is 401 too', async () => {
      const response = await as('stale-token').get('/api/schedules').expect(401);
      expect(response.body.message).toBe('Invalid or expired session');
      await as('stale-token').post('/api/schedules').send(scheduleBody()).expect(401);
      expect(store.calls).toEqual([]);
    });
  });

  describe('an API key alone is refused (session only)', () => {
    it.each(ROUTES)('%s %s with a valid harness API key and no session is 401 and touches nothing', async (method, path) => {
      const response = await request(app.getHttpServer())
        [method](path)
        .set('Authorization', `Bearer ${VALID_API_KEY}`)
        .set('Origin', APP_ORIGIN)
        .send(scheduleBody())
        .expect(401);
      expect(response.body.message).toBe('Authentication required');
      expect(store.calls).toEqual([]);
      expect(store.schedules.rows).toHaveLength(0);
      expect(store.audit.rows).toHaveLength(0);
    });
  });

  describe('403 without harness access', () => {
    it.each(ROUTES)('%s %s', async (method, path) => {
      await as('plain-token')[method](path).send(scheduleBody()).expect(403);
      expect(store.calls).toEqual([]);
    });
  });

  it('a cross-origin write with the session cookie is refused by the global guard and writes nothing', async () => {
    const cookie = [`${platformCookieNames().session}=owner-token`];
    await request(app.getHttpServer())
      .post('/api/schedules')
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example.com')
      .send(scheduleBody())
      .expect(403);
    await request(app.getHttpServer()).post('/api/schedules').set('Cookie', cookie).send(scheduleBody()).expect(403);
    expect(store.calls).toEqual([]);
  });

  it('the main flow: create, list, change, history, delete', async () => {
    const owner = as('owner-token');
    const runs = jest.spyOn(KillSwitchConfig, 'GLOBAL_EXECUTION_ENABLED', 'get').mockReturnValue(false);
    try {
      const empty = await owner.get('/api/schedules').expect(200);
      expect(empty.body).toEqual({ enabled: true, runsEnabled: false, limit: 5, schedules: [] });

      const created = await owner
        .post('/api/schedules')
        .send(scheduleBody({ target: { kind: 'workflow', workflowId: OWN_WORKFLOW } }))
        .expect(201);
      expect(Object.keys(created.body).sort()).toEqual(
        ['createdAt', 'days', 'enabled', 'id', 'lastRun', 'target', 'task', 'timeOfDay', 'timeZone', 'updatedAt'].sort(),
      );
      expect(created.body).toMatchObject({
        target: { kind: 'workflow', workflowId: OWN_WORKFLOW, name: 'Morning briefing', status: 'active' },
        task: `${MARKER} plan my day`,
        timeOfDay: '07:00',
        days: [1, 2, 3, 4, 5],
        timeZone: 'Asia/Taipei',
        enabled: true,
        lastRun: null,
      });
      const id: string = created.body.id;

      const listed = await owner.get('/api/schedules').expect(200);
      expect(listed.body.schedules).toEqual([created.body]);

      const changed = await owner
        .patch(`/api/schedules/${id}`)
        .send({ timeOfDay: '18:45', days: [6, 7], enabled: false })
        .expect(200);
      expect(changed.body).toMatchObject({ id, timeOfDay: '18:45', days: [6, 7], enabled: false });

      store.runs.rows.push({
        id: 'run-row-1',
        scheduleId: id,
        userId: OWNER,
        localDate: '2026-11-15',
        outcome: 'skipped',
        reason: 'runs_off',
        collaborationRunId: null,
        createdAt: new Date('2026-11-15T10:45:00Z'),
      });
      const history = await owner.get(`/api/schedules/${id}/runs`).expect(200);
      expect(history.body).toEqual({
        runs: [
          {
            id: 'run-row-1',
            localDate: '2026-11-15',
            outcome: 'skipped',
            reason: 'runs_off',
            collaborationRunId: null,
            at: '2026-11-15T10:45:00.000Z',
          },
        ],
      });
      const withLast = await owner.get('/api/schedules').expect(200);
      expect(withLast.body.schedules[0].lastRun).toEqual({
        localDate: '2026-11-15',
        outcome: 'skipped',
        reason: 'runs_off',
        collaborationRunId: null,
        at: '2026-11-15T10:45:00.000Z',
      });

      const removed = await owner.delete(`/api/schedules/${id}`).expect(200);
      expect(removed.body).toEqual({ id, deleted: true });
      expect(store.schedules.rows).toHaveLength(0);
      expect(store.runs.rows).toHaveLength(0);
      await owner.get(`/api/schedules/${id}/runs`).expect(404);

      expect(store.audit.rows.map((row) => row.eventType)).toEqual([
        'schedule_created',
        'schedule_updated',
        'schedule_deleted',
      ]);
      expect(JSON.stringify(store.audit.rows)).not.toContain(MARKER);
      expect(logs.join('\n')).not.toContain(MARKER);
    } finally {
      runs.mockRestore();
    }
  });

  describe("another owner's ids answer 404 and change nothing", () => {
    let otherScheduleId: string;

    beforeEach(async () => {
      const created = await as('other-token').post('/api/schedules').send(scheduleBody({ task: 'theirs' })).expect(201);
      otherScheduleId = created.body.id;
      store.runs.rows.push({
        id: 'their-run',
        scheduleId: otherScheduleId,
        userId: OTHER,
        localDate: '2026-11-14',
        outcome: 'started',
        reason: null,
        collaborationRunId: 'run-x',
        createdAt: new Date('2026-11-14T00:00:00Z'),
      });
    });

    it.each([
      ['patch', (id: string) => `/api/schedules/${id}`],
      ['delete', (id: string) => `/api/schedules/${id}`],
      ['get', (id: string) => `/api/schedules/${id}/runs`],
    ] as Array<['patch' | 'delete' | 'get', (id: string) => string]>)(
      "%s on another owner's schedule, an unknown id and a malformed id",
      async (method, path) => {
        const before = snapshot();
        for (const id of [otherScheduleId, UNKNOWN_ID, 'not-a-uuid']) {
          const response = await as('owner-token')[method](path(id)).send({ enabled: false }).expect(404);
          expect(response.body).toEqual({
            statusCode: 404,
            message: 'Schedule not found',
            error: 'Not Found',
            code: 'schedule_not_found',
          });
        }
        expect(snapshot()).toBe(before);
      },
    );

    it("another owner's schedules are not listed", async () => {
      const listed = await as('owner-token').get('/api/schedules').expect(200);
      expect(listed.body.schedules).toEqual([]);
      expect(listed.text).not.toContain('theirs');
    });

    it("another owner's workflow answers 404 on create and on change, and nothing changes", async () => {
      const own = await as('owner-token').post('/api/schedules').send(scheduleBody()).expect(201);
      const before = snapshot();
      for (const workflowId of [OTHER_WORKFLOW, UNKNOWN_ID]) {
        const create = await as('owner-token')
          .post('/api/schedules')
          .send(scheduleBody({ target: { kind: 'workflow', workflowId } }))
          .expect(404);
        expect(create.body.code).toBe('schedule_workflow_not_found');
        const change = await as('owner-token')
          .patch(`/api/schedules/${own.body.id}`)
          .send({ target: { kind: 'workflow', workflowId } })
          .expect(404);
        expect(change.body.code).toBe('schedule_workflow_not_found');
      }
      expect(snapshot()).toBe(before);
    });
  });

  describe('validation (stage-start section 7)', () => {
    it.each([
      ['an invalid zone', { timeZone: 'Mars/Olympus_Mons' }, 'schedule_invalid_time_zone'],
      ['an empty day set', { days: [] }, 'schedule_invalid_days'],
      ['a day out of range', { days: [0, 8] }, 'schedule_invalid_days'],
      ['a bad time', { timeOfDay: '24:00' }, 'schedule_invalid_time'],
      ['an empty task', { task: '   ' }, 'schedule_invalid_task'],
      ['a task over 8000 characters', { task: 'a'.repeat(8001) }, 'schedule_invalid_task'],
      ['a team that needs a session', { target: { kind: 'coding' } }, 'schedule_invalid_target'],
      ['a provider', { provider: 'openai' }, 'schedule_unknown_field'],
      ['a model', { model: { choice: 'pinned' } }, 'schedule_unknown_field'],
      ['an approval setting', { approvalMode: 'auto' }, 'schedule_unknown_field'],
      ['a budget', { budgetPerDayCredits: 10 }, 'schedule_unknown_field'],
      ['a tool profile', { toolProfile: 'write' }, 'schedule_unknown_field'],
      ['a session id', { sessionId: UNKNOWN_ID }, 'schedule_unknown_field'],
    ])('POST refuses %s with 400 and writes nothing', async (_label, overrides, code) => {
      const response = await as('owner-token').post('/api/schedules').send(scheduleBody(overrides)).expect(400);
      expect(response.body.code).toBe(code);
      expect(response.text).not.toContain(MARKER);
      expect(store.schedules.rows).toHaveLength(0);
      expect(store.audit.rows).toHaveLength(0);
    });

    it('PATCH refuses an empty change and an unknown field', async () => {
      const own = await as('owner-token').post('/api/schedules').send(scheduleBody()).expect(201);
      const before = snapshot();
      expect((await as('owner-token').patch(`/api/schedules/${own.body.id}`).send({}).expect(400)).body.code).toBe(
        'schedule_empty_change',
      );
      expect(
        (await as('owner-token').patch(`/api/schedules/${own.body.id}`).send({ timeZone: 'Bad/Zone' }).expect(400)).body
          .code,
      ).toBe('schedule_invalid_time_zone');
      expect(
        (await as('owner-token').patch(`/api/schedules/${own.body.id}`).send({ userId: OTHER }).expect(400)).body.code,
      ).toBe('schedule_unknown_field');
      expect(snapshot()).toBe(before);
    });
  });

  it('the sixth schedule is 409 schedule_limit_reached', async () => {
    for (let i = 0; i < 5; i += 1) {
      await as('owner-token').post('/api/schedules').send(scheduleBody({ enabled: i === 0 })).expect(201);
    }
    const refused = await as('owner-token').post('/api/schedules').send(scheduleBody()).expect(409);
    expect(refused.body).toEqual({
      statusCode: 409,
      message: 'At most 5 schedules per account',
      error: 'Conflict',
      code: 'schedule_limit_reached',
      limit: 5,
    });
    expect(store.schedules.rows).toHaveLength(5);
  });

  describe('SCHEDULES_ENABLED off', () => {
    it.each([[undefined], ['false'], ['TRUE'], ['1']])(
      'with %j the routes still work and GET reports enabled false',
      async (value) => {
        if (value === undefined) delete process.env.SCHEDULES_ENABLED;
        else process.env.SCHEDULES_ENABLED = value;
        const owner = as('owner-token');
        const created = await owner.post('/api/schedules').send(scheduleBody()).expect(201);
        const listed = await owner.get('/api/schedules').expect(200);
        expect(listed.body.enabled).toBe(false);
        expect(listed.body.schedules).toHaveLength(1);
        await owner.patch(`/api/schedules/${created.body.id}`).send({ enabled: false }).expect(200);
        await owner.get(`/api/schedules/${created.body.id}/runs`).expect(200);
        await owner.delete(`/api/schedules/${created.body.id}`).expect(200);
      },
    );

    it('the exact string true reports enabled true', async () => {
      process.env.SCHEDULES_ENABLED = 'true';
      expect((await as('owner-token').get('/api/schedules').expect(200)).body.enabled).toBe(true);
    });
  });

  describe('wiring and boot (criterion 9)', () => {
    it('the gateway parts boot with SCHEDULES_ENABLED unset', async () => {
      await app.close();
      delete process.env.SCHEDULES_ENABLED;
      await boot();
      const listed = await as('owner-token').get('/api/schedules').expect(200);
      expect(listed.body.enabled).toBe(false);
    });

    it('TriggersModule wires the controller, the services, the timer and the five repositories, and the app imports it', () => {
      // TRIGGER-EVENT-01 S2: the event trigger routes and their service join the schedule parts.
      // TRIGGER-MAIL-01 S2: the mail trigger routes join them.
      // TRIGGER-MORE-01 S1: the knowledge trigger routes join them.
      expect(Reflect.getMetadata('controllers', TriggersModule)).toEqual([ScheduleController, EventTriggerController, MailTriggerController, KnowledgeTriggerController]);
      // TRIGGER-01 S2: the run service and the timer join the S1 service.
      expect(Reflect.getMetadata('providers', TriggersModule)).toEqual([
        ScheduleService,
        ScheduleRunService,
        ScheduleTimer,
        EventTriggerService,
        // TRIGGER-EVENT-01 S3: the calendar reads, the event run service and the event timer.
        EventTriggerCalendar,
        EventTriggerRunService,
        EventTriggerTimer,
        // TRIGGER-MAIL-01 S2: the mail trigger service (no timer, no mailbox read, no run start).
        MailTriggerService,
        // TRIGGER-MAIL-01 S3: the mailbox reads, the mail run service and the mail timer.
        MailTriggerMailbox,
        MailTriggerRunService,
        MailTriggerTimer,
        // TRIGGER-MORE-01 S1: the knowledge trigger service (no timer, no document read, no run start).
        KnowledgeTriggerService,
        // TRIGGER-MORE-01 S2: the knowledge run service (document read, batch, claim, start) and the knowledge timer.
        KnowledgeTriggerRunService,
        KnowledgeTriggerTimer,
      ]);
      expect(Reflect.getMetadata('exports', TriggersModule)).toEqual([]);
      expect(Reflect.getMetadata('imports', TriggersModule)).toEqual(
        expect.arrayContaining([AuthModule, ConnectorsModule, OrchestrationModule, SafetyModule]),
      );
      const moduleSource = readFileSync(join(__dirname, 'triggers.module.ts'), 'utf8');
      expect(moduleSource).toContain(
        // TRIGGER-MORE-01 S2: KnowledgeDocument, read by the knowledge run service only (five columns).
        'TypeOrmModule.forFeature([AgentSchedule, AgentScheduleRun, AgentEventTrigger, AgentEventTriggerRun, AgentMailTrigger, AgentMailTriggerRun, AgentKnowledgeTrigger, AgentKnowledgeTriggerRun, KnowledgeDocument, AuditEventEntity, ConnectorConnection, UserAgent, User])',
      );
      expect(moduleSource).toContain('AuthModule');

      const appModule = readFileSync(join(__dirname, '..', 'app.module.ts'), 'utf8');
      expect(appModule).toContain("import { TriggersModule } from './triggers/triggers.module';");
      expect(appModule).toMatch(/^\s+TriggersModule, \/\/ TRIGGER-01 S1/m);
      expect(appModule).toMatch(/^\s+ChatModule, \/\/ CHAT-DISCORD-01/m);

      const entities = readFileSync(join(__dirname, '..', 'entities', 'index.ts'), 'utf8');
      expect(entities).toContain("export { AgentSchedule, AGENT_SCHEDULE_TARGET_KINDS } from './agent-schedule.entity';");
      expect(entities).toContain("export { AgentScheduleRun, AGENT_SCHEDULE_RUN_OUTCOMES } from './agent-schedule-run.entity';");
    });

    it('the timer, the run start and the boot hook live only in the S2 files; the routes start nothing; the switch is read once in the service', () => {
      const files = readdirSync(__dirname).filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'));
      expect(files.sort()).toEqual(
        [
          'event-trigger-calendar.ts',
          'event-trigger-due.ts',
          'event-trigger-reasons.ts',
          'event-trigger-run.service.ts',
          'event-trigger-switch.ts',
          'event-trigger-timer.ts',
          'event-trigger-validation.ts',
          'event-trigger.controller.ts',
          'event-trigger.service.ts',
          'knowledge-trigger-match.ts',
          'knowledge-trigger-reasons.ts',
          'knowledge-trigger-run.service.ts',
          'knowledge-trigger-switch.ts',
          'knowledge-trigger-timer.ts',
          'knowledge-trigger-validation.ts',
          'knowledge-trigger.controller.ts',
          'knowledge-trigger.service.ts',
          'mail-trigger-mailbox.ts',
          'mail-trigger-match.ts',
          'mail-trigger-reasons.ts',
          'mail-trigger-run.service.ts',
          'mail-trigger-switch.ts',
          'mail-trigger-timer.ts',
          'mail-trigger-validation.ts',
          'mail-trigger.controller.ts',
          'mail-trigger.service.ts',
          'schedule-due.ts',
          'schedule-refusal.ts',
          'schedule-run.service.ts',
          'schedule-switch.ts',
          'schedule-timer.ts',
          'schedule-validation.ts',
          'schedule.controller.ts',
          'schedule.service.ts',
          'triggers.module.ts',
        ].sort(),
      );
      const source = (name: string) => readFileSync(join(__dirname, name), 'utf8');
      // The S1 files (and the pure S2 helpers) still have no timer, no run start and no boot hook.
      // TRIGGER-EVENT-01 S2: the event trigger files likewise (no timer, no run start in S2).
      // TRIGGER-MAIL-01 S2: the mail trigger files likewise (no timer, no run start in S2).
      // TRIGGER-MORE-01 S1: the knowledge trigger files likewise (no timer, no run start in S1).
      for (const name of ['schedule-switch.ts', 'schedule-validation.ts', 'schedule.controller.ts', 'schedule.service.ts', 'schedule-due.ts', 'schedule-refusal.ts', 'event-trigger-switch.ts', 'event-trigger-validation.ts', 'event-trigger.controller.ts', 'event-trigger.service.ts', 'mail-trigger-switch.ts', 'mail-trigger-validation.ts', 'mail-trigger.controller.ts', 'mail-trigger.service.ts', 'knowledge-trigger-switch.ts', 'knowledge-trigger-validation.ts', 'knowledge-trigger.controller.ts', 'knowledge-trigger.service.ts']) {
        expect(source(name)).not.toMatch(/setInterval|setTimeout|OnModuleInit|OnApplicationBootstrap|CollaborationStartService|OrchestrationModule|approveStep/);
      }
      // TRIGGER-01 S2: the interval and the boot hook only in the timer; start and approve only in the run service.
      expect(source('schedule-timer.ts')).toMatch(/OnModuleInit/);
      expect(source('schedule-timer.ts').match(/setInterval\(/g)).toHaveLength(1);
      expect(source('schedule-timer.ts')).not.toMatch(/CollaborationStartService|approveStep|setTimeout|OnApplicationBootstrap/);
      expect(source('schedule-run.service.ts')).toMatch(/this\.starts\.start\(/);
      expect(source('schedule-run.service.ts')).toMatch(/this\.starts\.approveStep\(/);
      expect(source('schedule-run.service.ts')).not.toMatch(/setInterval|setTimeout|OnModuleInit|OnApplicationBootstrap/);
      // The routes never call the run service or the timer.
      expect(source('schedule.controller.ts')).not.toMatch(/ScheduleRunService|ScheduleTimer/);
      expect(source('schedule.service.ts')).not.toMatch(/ScheduleRunService|ScheduleTimer/);
      const service = source('schedule.service.ts');
      expect(service.match(/isSchedulesEnabled\(\)/g)).toHaveLength(1);
      expect(service).toMatch(/enabled: isSchedulesEnabled\(\),/);
      // The timer reads the switch live on every tick, once.
      expect(source('schedule-timer.ts').match(/isSchedulesEnabled\(\)/g)).toHaveLength(1);
      expect(source('schedule-run.service.ts')).not.toMatch(/isSchedulesEnabled/);
      // TRIGGER-EVENT-01 S3: the pure event helpers have no timer and no run start; the event
      // interval and boot hook only in the event timer; start and approve only in the event run
      // service; the calendar read only in the calendar file; the event flag read once a tick.
      for (const name of ['event-trigger-due.ts', 'event-trigger-reasons.ts', 'event-trigger-calendar.ts']) {
        expect(source(name)).not.toMatch(/setInterval|setTimeout|OnModuleInit|OnApplicationBootstrap|CollaborationStartService|OrchestrationModule|approveStep/);
      }
      expect(source('event-trigger-timer.ts')).toMatch(/OnModuleInit/);
      expect(source('event-trigger-timer.ts').match(/setInterval\(/g)).toHaveLength(1);
      expect(source('event-trigger-timer.ts')).not.toMatch(/CollaborationStartService|approveStep|setTimeout|OnApplicationBootstrap|readCalendarWindow/);
      expect(source('event-trigger-run.service.ts')).toMatch(/this\.starts\.start\(/);
      expect(source('event-trigger-run.service.ts')).toMatch(/this\.starts\.approveStep\(/);
      expect(source('event-trigger-run.service.ts')).not.toMatch(/setInterval|setTimeout|OnModuleInit|OnApplicationBootstrap|readCalendarWindow|ConnectorBroker/);
      expect(source('event-trigger-calendar.ts').match(/this\.broker\.readCalendarWindow\(/g)).toHaveLength(2);
      expect(source('event-trigger-calendar.ts')).not.toMatch(/callConnectorTool/);
      expect(source('event-trigger-timer.ts').match(/isEventTriggersEnabled\(\)/g)).toHaveLength(1);
      expect(source('event-trigger-run.service.ts')).not.toMatch(/isEventTriggersEnabled|isSchedulesEnabled/);
      expect(source('event-trigger-timer.ts')).not.toMatch(/isSchedulesEnabled/);
      // The schedule timer and run service never reach the event parts.
      expect(source('schedule-timer.ts')).not.toMatch(/EventTrigger/);
      expect(source('schedule-run.service.ts')).not.toMatch(/EventTrigger/);
      // TRIGGER-MAIL-01 S2: the mail files read no mailbox and reach no broker; the mail flag is
      // read once, in the service's list; the schedule and event parts never reach the mail parts.
      for (const name of ['mail-trigger-switch.ts', 'mail-trigger-validation.ts', 'mail-trigger.controller.ts', 'mail-trigger.service.ts']) {
        expect(source(name)).not.toMatch(/ConnectorBroker|ConnectorsModule|readRecentMail|callConnectorTool|mail_list_recent|ScheduleRunService|EventTriggerRunService/);
      }
      expect(source('mail-trigger.service.ts').match(/isMailTriggersEnabled\(\)/g)).toHaveLength(1);
      for (const name of ['schedule-timer.ts', 'schedule-run.service.ts', 'event-trigger-timer.ts', 'event-trigger-run.service.ts', 'event-trigger-calendar.ts']) {
        expect(source(name)).not.toMatch(/MailTrigger|isMailTriggersEnabled/);
      }
      // TRIGGER-MAIL-01 S3: the pure mail helpers have no timer and no run start; the mail interval
      // and boot hook only in the mail timer; start and approve only in the mail run service; the
      // mailbox read only in the mailbox file, once; the mail flag read once a tick in the timer and
      // live before each owner's read in the mailbox; the mail parts never reach the event or
      // schedule run parts.
      for (const name of ['mail-trigger-match.ts', 'mail-trigger-reasons.ts', 'mail-trigger-mailbox.ts']) {
        expect(source(name)).not.toMatch(/setInterval|setTimeout|OnModuleInit|OnApplicationBootstrap|CollaborationStartService|OrchestrationModule|approveStep/);
      }
      expect(source('mail-trigger-timer.ts')).toMatch(/OnModuleInit/);
      expect(source('mail-trigger-timer.ts').match(/setInterval\(/g)).toHaveLength(1);
      expect(source('mail-trigger-timer.ts')).not.toMatch(/CollaborationStartService|approveStep|setTimeout|OnApplicationBootstrap|readRecentMail|ConnectorBroker/);
      expect(source('mail-trigger-run.service.ts')).toMatch(/this\.starts\.start\(/);
      expect(source('mail-trigger-run.service.ts')).toMatch(/this\.starts\.approveStep\(/);
      expect(source('mail-trigger-run.service.ts')).not.toMatch(/setInterval|setTimeout|OnModuleInit|OnApplicationBootstrap|readRecentMail|ConnectorBroker/);
      expect(source('mail-trigger-mailbox.ts').match(/this\.broker\.readRecentMail\(/g)).toHaveLength(1);
      expect(source('mail-trigger-mailbox.ts')).not.toMatch(/callConnectorTool|readCalendarWindow/);
      expect(source('mail-trigger-timer.ts').match(/isMailTriggersEnabled\(\)/g)).toHaveLength(1);
      expect(source('mail-trigger-mailbox.ts').match(/isMailTriggersEnabled\(\)/g)).toHaveLength(1);
      expect(source('mail-trigger-run.service.ts')).not.toMatch(/isMailTriggersEnabled|isEventTriggersEnabled|isSchedulesEnabled/);
      for (const name of ['mail-trigger-timer.ts', 'mail-trigger-run.service.ts', 'mail-trigger-mailbox.ts', 'mail-trigger-match.ts', 'mail-trigger-reasons.ts']) {
        expect(source(name)).not.toMatch(/EventTriggerRunService|EventTriggerCalendar|ScheduleRunService/);
      }
      // TRIGGER-MORE-01 S1: the knowledge files read no knowledge document and reach no broker or
      // other run service; the knowledge flag is read once, in the service's list; the schedule,
      // event and mail parts never reach the knowledge parts.
      for (const name of ['knowledge-trigger-switch.ts', 'knowledge-trigger-validation.ts', 'knowledge-trigger.controller.ts', 'knowledge-trigger.service.ts']) {
        expect(source(name)).not.toMatch(/KnowledgeDocument|knowledge_documents|KnowledgeService|ConnectorBroker|ConnectorsModule|ScheduleRunService|EventTriggerRunService|MailTriggerRunService/);
      }
      expect(source('knowledge-trigger.service.ts').match(/isKnowledgeTriggersEnabled\(\)/g)).toHaveLength(1);
      for (const name of ['schedule-timer.ts', 'schedule-run.service.ts', 'event-trigger-timer.ts', 'event-trigger-run.service.ts', 'mail-trigger-timer.ts', 'mail-trigger-run.service.ts']) {
        expect(source(name)).not.toMatch(/KnowledgeTrigger|isKnowledgeTriggersEnabled/);
      }
      // TRIGGER-MORE-01 S2: the pure knowledge helpers have no timer, no run start and no document
      // read; the knowledge interval and boot hook only in the knowledge timer; start and approve
      // only in the knowledge run service, which alone reads knowledge_documents, once a tick, and
      // never through KnowledgeService; the knowledge flag read once in the timer and once in the run
      // service; the knowledge parts never reach the schedule, event or mail run parts.
      for (const name of ['knowledge-trigger-match.ts', 'knowledge-trigger-reasons.ts']) {
        expect(source(name)).not.toMatch(/setInterval|setTimeout|OnModuleInit|OnApplicationBootstrap|CollaborationStartService|OrchestrationModule|approveStep|Repository|KnowledgeService/);
      }
      expect(source('knowledge-trigger-timer.ts')).toMatch(/OnModuleInit/);
      expect(source('knowledge-trigger-timer.ts').match(/setInterval\(/g)).toHaveLength(1);
      expect(source('knowledge-trigger-timer.ts')).not.toMatch(/CollaborationStartService|approveStep|setTimeout|OnApplicationBootstrap|KnowledgeDocument/);
      expect(source('knowledge-trigger-run.service.ts')).toMatch(/this\.starts\.start\(/);
      expect(source('knowledge-trigger-run.service.ts')).toMatch(/this\.starts\.approveStep\(/);
      expect(source('knowledge-trigger-run.service.ts')).not.toMatch(/setInterval|setTimeout|OnModuleInit|OnApplicationBootstrap|KnowledgeService|ConnectorBroker/);
      expect(source('knowledge-trigger-run.service.ts').match(/this\.documents\.find\(/g)).toHaveLength(1);
      expect(source('knowledge-trigger-timer.ts').match(/isKnowledgeTriggersEnabled\(\)/g)).toHaveLength(1);
      expect(source('knowledge-trigger-run.service.ts').match(/isKnowledgeTriggersEnabled\(\)/g)).toHaveLength(1);
      expect(source('knowledge-trigger-run.service.ts')).not.toMatch(/isMailTriggersEnabled|isEventTriggersEnabled|isSchedulesEnabled/);
      for (const name of ['knowledge-trigger-timer.ts', 'knowledge-trigger-run.service.ts', 'knowledge-trigger-match.ts', 'knowledge-trigger-reasons.ts']) {
        expect(source(name)).not.toMatch(/ScheduleRunService|EventTriggerRunService|EventTriggerCalendar|MailTriggerRunService|MailTriggerMailbox/);
      }
      for (const name of readdirSync(__dirname).filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))) {
        if (name === 'knowledge-trigger-run.service.ts' || name === 'triggers.module.ts') continue;
        expect(source(name)).not.toMatch(/\bKnowledgeDocument\b|knowledge_documents/);
      }
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

/* ---------- In-memory TypeORM stand-in (the same shape as the chat specs' store). ---------- */

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
  failNextInsert = false;

  constructor(
    private readonly name: string,
    private readonly calls: string[],
    private readonly uniques: string[][] = [],
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
    if (this.failNextInsert) {
      this.failNextInsert = false;
      throw new Error(`${this.name} insert failed`);
    }
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
    if (target === AgentSchedule) return this.store.schedules as MemoryRepository<object>;
    if (target === AgentScheduleRun) return this.store.runs as MemoryRepository<object>;
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
      schedules: this.store.schedules.rows.map(copy),
      runs: this.store.runs.rows.map(copy),
      audit: this.store.audit.rows.map(copy),
    };
    try {
      return await work(this);
    } catch (error) {
      this.store.schedules.rows = snapshot.schedules;
      this.store.runs.rows = snapshot.runs;
      this.store.audit.rows = snapshot.audit;
      throw error;
    }
  }
}

class MemoryStore {
  calls: string[] = [];
  queries: Array<{ sql: string; params: unknown[] }> = [];
  schedules = new MemoryRepository<AgentSchedule>('schedules', this.calls);
  runs = new MemoryRepository<AgentScheduleRun>('runs', this.calls, [['scheduleId', 'localDate']]);
  workflows = new MemoryRepository<UserAgent>('workflows', this.calls);
  audit = new MemoryRepository<AuditEventEntity>('audit', this.calls);
  manager = new MemoryManager(this);

  constructor() {
    this.schedules.manager = this.manager;
    this.runs.manager = this.manager;
    this.workflows.manager = this.manager;
    this.audit.manager = this.manager;
  }
}
