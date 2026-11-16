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
import { AgentMailTrigger } from '../entities/agent-mail-trigger.entity';
import { AgentMailTriggerRun } from '../entities/agent-mail-trigger-run.entity';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ConnectorConnection } from '../entities/connector-connection.entity';
import { UserAgent } from '../entities/user-agent.entity';
import { SameOriginWriteGuard } from '../guards/same-origin-write.guard';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import { EventTriggerController } from './event-trigger.controller';
import { MailTriggerController } from './mail-trigger.controller';
import { MailTriggerService } from './mail-trigger.service';
import { ScheduleController } from './schedule.controller';

const OWNER = '11111111-1111-4111-8111-111111111111';
const NOT_ENTITLED = '22222222-2222-4222-8222-222222222222';
const OTHER = '77777777-7777-4777-8777-777777777777';
const OWN_WORKFLOW = '33333333-3333-4333-8333-333333333333';
const OTHER_WORKFLOW = '44444444-4444-4444-8444-444444444444';
const UNKNOWN_ID = '66666666-6666-4666-8666-666666666666';
const APP_ORIGIN = 'http://localhost:3000';
const VALID_API_KEY = 'test-harness-api-key';
const MARKER = 'MARKER-TASK-5e2a';
const SENDER_MARKER = 'marker-sender-91fd';
const SUBJECT_MARKER = 'MARKER-SUBJECT-c07b';

const TOKENS: Record<string, string> = {
  'owner-token': OWNER,
  'plain-token': NOT_ENTITLED,
  'other-token': OTHER,
};

function triggerBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    target: { kind: 'chief-of-staff' },
    task: `${MARKER} summarise it`,
    senderFilter: `${SENDER_MARKER}@example.com`,
    subjectFilter: `${SUBJECT_MARKER} invoice`,
    timeZone: 'Asia/Taipei',
    ...overrides,
  };
}

describe('MailTriggerController (TRIGGER-MAIL-01 S2)', () => {
  const originalFlag = process.env.MAIL_TRIGGERS_ENABLED;
  const originalBase = process.env.APP_BASE_URL;
  let app: INestApplication;
  let store: MemoryStore;
  let logs: string[];
  let restoreLogs: () => void;

  async function boot(): Promise<void> {
    store = new MemoryStore();
    store.workflows.rows.push(
      { id: OWN_WORKFLOW, userId: OWNER, name: 'Mail desk', status: 'active', deletedAt: null } as UserAgent,
      { id: OTHER_WORKFLOW, userId: OTHER, name: 'Not yours', status: 'active', deletedAt: null } as UserAgent,
    );
    const moduleRef = await Test.createTestingModule({
      controllers: [MailTriggerController],
      providers: [
        MailTriggerService,
        SessionCookieGuard,
        // Not used by the controller. Provided so that the API-key tests run
        // against a key the API-key path accepts (with harness scope): if the
        // routes ever moved to SessionOrApiKeyAuthGuard, those tests fail.
        SessionOrApiKeyAuthGuard,
        { provide: getRepositoryToken(AgentMailTrigger), useValue: store.triggers },
        { provide: getRepositoryToken(AgentMailTriggerRun), useValue: store.runs },
        { provide: getRepositoryToken(UserAgent), useValue: store.workflows },
        { provide: getRepositoryToken(ConnectorConnection), useValue: store.connections },
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
    process.env.MAIL_TRIGGERS_ENABLED = 'true';
    process.env.APP_BASE_URL = APP_ORIGIN;
    logs = [];
    restoreLogs = watchLogs(logs);
    await boot();
  });

  afterEach(async () => {
    if (app) await app.close();
    restoreLogs();
    if (originalFlag === undefined) delete process.env.MAIL_TRIGGERS_ENABLED;
    else process.env.MAIL_TRIGGERS_ENABLED = originalFlag;
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
    ['get', '/api/mail-triggers'],
    ['post', '/api/mail-triggers'],
    ['patch', `/api/mail-triggers/${UNKNOWN_ID}`],
    ['delete', `/api/mail-triggers/${UNKNOWN_ID}`],
    ['get', `/api/mail-triggers/${UNKNOWN_ID}/runs`],
  ];

  it('uses SessionCookieGuard (session only) on the whole controller, as the schedule and event trigger routes do', () => {
    expect(Reflect.getMetadata('__guards__', MailTriggerController)).toEqual([SessionCookieGuard]);
    expect(Reflect.getMetadata('__guards__', MailTriggerController)).toEqual(
      Reflect.getMetadata('__guards__', EventTriggerController),
    );
    expect(Reflect.getMetadata('__guards__', MailTriggerController)).toEqual(
      Reflect.getMetadata('__guards__', ScheduleController),
    );
    expect(Reflect.getMetadata('path', MailTriggerController)).toBe('mail-triggers');
    const source = readFileSync(join(__dirname, 'mail-trigger.controller.ts'), 'utf8');
    expect(source).toContain("@Controller('mail-triggers')");
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
      const response = await as('stale-token').get('/api/mail-triggers').expect(401);
      expect(response.body.message).toBe('Invalid or expired session');
      await as('stale-token').post('/api/mail-triggers').send(triggerBody()).expect(401);
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
      .post('/api/mail-triggers')
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example.com')
      .send(triggerBody())
      .expect(403);
    await request(app.getHttpServer()).post('/api/mail-triggers').set('Cookie', cookie).send(triggerBody()).expect(403);
    expect(store.calls).toEqual([]);
  });

  it('the main flow: create, list, change, history, delete, with the frozen shapes', async () => {
    const owner = as('owner-token');
    const runs = jest.spyOn(KillSwitchConfig, 'GLOBAL_EXECUTION_ENABLED', 'get').mockReturnValue(false);
    try {
      const empty = await owner.get('/api/mail-triggers').expect(200);
      expect(empty.body).toEqual({
        enabled: true,
        runsEnabled: false,
        limit: 3,
        mail: { connected: false, state: 'ok', stateAt: null },
        triggers: [],
      });

      const created = await owner
        .post('/api/mail-triggers')
        .send(triggerBody({ target: { kind: 'workflow', workflowId: OWN_WORKFLOW } }))
        .expect(201);
      expect(Object.keys(created.body).sort()).toEqual(
        [
          'createdAt',
          'enabled',
          'id',
          'lastRun',
          'senderFilter',
          'subjectFilter',
          'target',
          'task',
          'timeZone',
          'updatedAt',
        ].sort(),
      );
      expect(created.body).toMatchObject({
        target: { kind: 'workflow', workflowId: OWN_WORKFLOW, name: 'Mail desk', status: 'active' },
        task: `${MARKER} summarise it`,
        senderFilter: `${SENDER_MARKER}@example.com`,
        subjectFilter: `${SUBJECT_MARKER} invoice`,
        timeZone: 'Asia/Taipei',
        enabled: true,
        lastRun: null,
      });
      const id: string = created.body.id;

      store.connections.rows.push({ id: 'c1', userId: OWNER, kind: 'imap', secretCiphertext: 'never-read' } as ConnectorConnection);
      const listed = await owner.get('/api/mail-triggers').expect(200);
      expect(Object.keys(listed.body).sort()).toEqual(['enabled', 'limit', 'mail', 'runsEnabled', 'triggers']);
      expect(listed.body.triggers).toEqual([created.body]);
      expect(listed.body.mail).toEqual({ connected: true, state: 'ok', stateAt: null });
      expect(listed.text).not.toContain('never-read');

      const changed = await owner
        .patch(`/api/mail-triggers/${id}`)
        .send({ senderFilter: '@Example.org', subjectFilter: '', enabled: false })
        .expect(200);
      expect(changed.body).toMatchObject({ id, senderFilter: '@example.org', subjectFilter: null, enabled: false });

      store.runs.rows.push({
        id: 'run-row-1',
        triggerId: id,
        userId: OWNER,
        messageKey: 'f'.repeat(64),
        arrivedAt: new Date('2026-11-15T10:27:00Z'),
        localDate: '2026-11-15',
        outcome: 'skipped',
        reason: 'day_limit',
        collaborationRunId: null,
        createdAt: new Date('2026-11-15T10:30:00Z'),
      });
      const history = await owner.get(`/api/mail-triggers/${id}/runs`).expect(200);
      expect(history.body).toEqual({
        runs: [
          {
            id: 'run-row-1',
            arrivedAt: '2026-11-15T10:27:00.000Z',
            localDate: '2026-11-15',
            outcome: 'skipped',
            reason: 'day_limit',
            collaborationRunId: null,
            at: '2026-11-15T10:30:00.000Z',
          },
        ],
      });
      expect(history.text).not.toContain('f'.repeat(64));
      const withLast = await owner.get('/api/mail-triggers').expect(200);
      expect(withLast.body.triggers[0].lastRun).toEqual({
        arrivedAt: '2026-11-15T10:27:00.000Z',
        localDate: '2026-11-15',
        outcome: 'skipped',
        reason: 'day_limit',
        collaborationRunId: null,
        at: '2026-11-15T10:30:00.000Z',
      });

      const removed = await owner.delete(`/api/mail-triggers/${id}`).expect(200);
      expect(removed.body).toEqual({ id, deleted: true });
      expect(store.triggers.rows).toHaveLength(0);
      expect(store.runs.rows).toHaveLength(0);
      await owner.get(`/api/mail-triggers/${id}/runs`).expect(404);

      expect(store.audit.rows.map((row) => row.eventType)).toEqual([
        'mail_trigger_created',
        'mail_trigger_updated',
        'mail_trigger_deleted',
      ]);
      for (const secret of [MARKER, SENDER_MARKER, SUBJECT_MARKER, '@example']) {
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
        .post('/api/mail-triggers')
        .send(triggerBody({ task: 'theirs', senderFilter: 'theirs@example.org', subjectFilter: 'their subject' }))
        .expect(201);
      otherTriggerId = created.body.id;
      store.runs.rows.push({
        id: 'their-run',
        triggerId: otherTriggerId,
        userId: OTHER,
        messageKey: 'e'.repeat(64),
        arrivedAt: new Date('2026-11-14T00:57:00Z'),
        localDate: '2026-11-14',
        outcome: 'started',
        reason: null,
        collaborationRunId: 'run-x',
        createdAt: new Date('2026-11-14T01:00:00Z'),
      });
    });

    it.each([
      ['patch', (id: string) => `/api/mail-triggers/${id}`],
      ['delete', (id: string) => `/api/mail-triggers/${id}`],
      ['get', (id: string) => `/api/mail-triggers/${id}/runs`],
    ] as Array<['patch' | 'delete' | 'get', (id: string) => string]>)(
      "%s on another owner's trigger, an unknown id and a malformed id",
      async (method, path) => {
        const before = snapshot();
        for (const id of [otherTriggerId, UNKNOWN_ID, 'not-a-uuid']) {
          const response = await as('owner-token')[method](path(id)).send({ enabled: false }).expect(404);
          expect(response.body).toEqual({
            statusCode: 404,
            message: 'Mail trigger not found',
            error: 'Not Found',
            code: 'mail_trigger_not_found',
          });
        }
        expect(snapshot()).toBe(before);
      },
    );

    it("another owner's triggers are not listed", async () => {
      const listed = await as('owner-token').get('/api/mail-triggers').expect(200);
      expect(listed.body.triggers).toEqual([]);
      expect(listed.text).not.toContain('theirs');
      expect(listed.text).not.toContain('their subject');
    });

    it("another owner's workflow answers 404 on create and on change, and nothing changes", async () => {
      const own = await as('owner-token').post('/api/mail-triggers').send(triggerBody()).expect(201);
      const before = snapshot();
      for (const workflowId of [OTHER_WORKFLOW, UNKNOWN_ID]) {
        const create = await as('owner-token')
          .post('/api/mail-triggers')
          .send(triggerBody({ target: { kind: 'workflow', workflowId } }))
          .expect(404);
        expect(create.body.code).toBe('mail_trigger_workflow_not_found');
        const change = await as('owner-token')
          .patch(`/api/mail-triggers/${own.body.id}`)
          .send({ target: { kind: 'workflow', workflowId } })
          .expect(404);
        expect(change.body.code).toBe('mail_trigger_workflow_not_found');
      }
      expect(snapshot()).toBe(before);
    });
  });

  describe('validation (stage-start sections 2 and 8)', () => {
    it.each([
      ['no sender', { senderFilter: undefined }, 'mail_trigger_missing_field'],
      ['a null sender', { senderFilter: null }, 'mail_trigger_invalid_sender'],
      ['a blank sender', { senderFilter: '  ' }, 'mail_trigger_invalid_sender'],
      ['a sender without @', { senderFilter: 'example.com' }, 'mail_trigger_invalid_sender'],
      ['a sender with a display name', { senderFilter: 'Boss <boss@example.com>' }, 'mail_trigger_invalid_sender'],
      ['two senders', { senderFilter: 'a@example.com, b@example.com' }, 'mail_trigger_invalid_sender'],
      ['a sender over 254 characters', { senderFilter: `${'l'.repeat(60)}@${'d'.repeat(63)}.${'e'.repeat(63)}.${'f'.repeat(63)}.com` }, 'mail_trigger_invalid_sender'],
      ['a subject over 100 characters', { subjectFilter: 's'.repeat(101) }, 'mail_trigger_invalid_subject'],
      ['a subject that is not text', { subjectFilter: 7 }, 'mail_trigger_invalid_subject'],
      ['an empty task', { task: '   ' }, 'mail_trigger_invalid_task'],
      ['a task over 7500 characters', { task: 'a'.repeat(7501) }, 'mail_trigger_invalid_task'],
      ['an invalid zone', { timeZone: 'Mars/Olympus_Mons' }, 'mail_trigger_invalid_time_zone'],
      ['a team that needs a session', { target: { kind: 'coding' } }, 'mail_trigger_invalid_target'],
      ['a provider', { provider: 'openai' }, 'mail_trigger_unknown_field'],
      ['a model', { model: { choice: 'pinned' } }, 'mail_trigger_unknown_field'],
      ['an approval setting', { approvalMode: 'auto' }, 'mail_trigger_unknown_field'],
      ['a tool profile', { toolProfile: 'write' }, 'mail_trigger_unknown_field'],
      ['a session id', { sessionId: UNKNOWN_ID }, 'mail_trigger_unknown_field'],
      ['a mailbox state', { mailState: 'ok' }, 'mail_trigger_unknown_field'],
      ['an event lead', { leadMinutes: 15 }, 'mail_trigger_unknown_field'],
      ['a body filter', { bodyFilter: 'pay now' }, 'mail_trigger_unknown_field'],
    ])('POST refuses %s with 400 and writes nothing', async (_label, overrides, code) => {
      const payload = triggerBody(overrides);
      if ('senderFilter' in overrides && overrides.senderFilter === undefined) delete payload.senderFilter;
      const response = await as('owner-token').post('/api/mail-triggers').send(payload).expect(400);
      expect(response.body.code).toBe(code);
      expect(response.text).not.toContain(MARKER);
      expect(response.text).not.toContain(SENDER_MARKER);
      expect(response.text).not.toContain(SUBJECT_MARKER);
      expect(response.text).not.toContain('boss@example.com');
      expect(store.triggers.rows).toHaveLength(0);
      expect(store.audit.rows).toHaveLength(0);
    });

    it('the edges are accepted: an address, a domain, a 100-character subject, no subject, a 7500-character task', async () => {
      await as('owner-token').post('/api/mail-triggers').send(triggerBody({ senderFilter: '@example.com' })).expect(201);
      await as('owner-token')
        .post('/api/mail-triggers')
        .send(triggerBody({ subjectFilter: 's'.repeat(100) }))
        .expect(201);
      const noSubject = triggerBody({ task: 'a'.repeat(7500) });
      delete noSubject.subjectFilter;
      await as('owner-token').post('/api/mail-triggers').send(noSubject).expect(201);
      expect(store.triggers.rows.map((row) => row.senderFilter)).toEqual([
        '@example.com',
        `${SENDER_MARKER}@example.com`,
        `${SENDER_MARKER}@example.com`,
      ]);
      expect(store.triggers.rows.map((row) => row.subjectFilter)).toEqual([
        `${SUBJECT_MARKER} invoice`,
        's'.repeat(100),
        null,
      ]);
    });

    it('PATCH refuses an empty change, a cleared sender, a bad zone and an unknown field', async () => {
      const own = await as('owner-token').post('/api/mail-triggers').send(triggerBody()).expect(201);
      const before = snapshot();
      const patch = (payload: Record<string, unknown>) =>
        as('owner-token').patch(`/api/mail-triggers/${own.body.id}`).send(payload).expect(400);
      expect((await patch({})).body.code).toBe('mail_trigger_empty_change');
      expect((await patch({ senderFilter: null })).body.code).toBe('mail_trigger_invalid_sender');
      expect((await patch({ senderFilter: '' })).body.code).toBe('mail_trigger_invalid_sender');
      expect((await patch({ timeZone: 'Bad/Zone' })).body.code).toBe('mail_trigger_invalid_time_zone');
      expect((await patch({ userId: OTHER })).body.code).toBe('mail_trigger_unknown_field');
      expect(snapshot()).toBe(before);
    });
  });

  it('the fourth trigger is 409 mail_trigger_limit_reached', async () => {
    for (let i = 0; i < 3; i += 1) {
      await as('owner-token').post('/api/mail-triggers').send(triggerBody({ enabled: i === 0 })).expect(201);
    }
    const refused = await as('owner-token').post('/api/mail-triggers').send(triggerBody()).expect(409);
    expect(refused.body).toEqual({
      statusCode: 409,
      message: 'At most 3 mail triggers per account',
      error: 'Conflict',
      code: 'mail_trigger_limit_reached',
      limit: 3,
    });
    expect(store.triggers.rows).toHaveLength(3);
  });

  describe('MAIL_TRIGGERS_ENABLED off', () => {
    it.each([[undefined], ['false'], ['TRUE'], ['1'], [' true']])(
      'with %j the routes still work and GET reports enabled false',
      async (value) => {
        if (value === undefined) delete process.env.MAIL_TRIGGERS_ENABLED;
        else process.env.MAIL_TRIGGERS_ENABLED = value;
        const owner = as('owner-token');
        const created = await owner.post('/api/mail-triggers').send(triggerBody()).expect(201);
        const listed = await owner.get('/api/mail-triggers').expect(200);
        expect(listed.body.enabled).toBe(false);
        expect(listed.body.triggers).toHaveLength(1);
        await owner.patch(`/api/mail-triggers/${created.body.id}`).send({ enabled: false }).expect(200);
        await owner.get(`/api/mail-triggers/${created.body.id}/runs`).expect(200);
        await owner.delete(`/api/mail-triggers/${created.body.id}`).expect(200);
      },
    );

    it('the exact string true reports enabled true; EVENT_TRIGGERS_ENABLED and SCHEDULES_ENABLED do not', async () => {
      process.env.MAIL_TRIGGERS_ENABLED = 'true';
      expect((await as('owner-token').get('/api/mail-triggers').expect(200)).body.enabled).toBe(true);
      const originalSchedules = process.env.SCHEDULES_ENABLED;
      const originalEvents = process.env.EVENT_TRIGGERS_ENABLED;
      try {
        delete process.env.MAIL_TRIGGERS_ENABLED;
        process.env.SCHEDULES_ENABLED = 'true';
        process.env.EVENT_TRIGGERS_ENABLED = 'true';
        expect((await as('owner-token').get('/api/mail-triggers').expect(200)).body.enabled).toBe(false);
      } finally {
        if (originalSchedules === undefined) delete process.env.SCHEDULES_ENABLED;
        else process.env.SCHEDULES_ENABLED = originalSchedules;
        if (originalEvents === undefined) delete process.env.EVENT_TRIGGERS_ENABLED;
        else process.env.EVENT_TRIGGERS_ENABLED = originalEvents;
      }
    });

    it('the gateway parts boot with MAIL_TRIGGERS_ENABLED unset', async () => {
      await app.close();
      delete process.env.MAIL_TRIGGERS_ENABLED;
      await boot();
      expect((await as('owner-token').get('/api/mail-triggers').expect(200)).body.enabled).toBe(false);
    });
  });

  describe('S2 boundaries', () => {
    it('the S2 files have no timer, no mailbox read and no run start', () => {
      for (const name of [
        'mail-trigger-switch.ts',
        'mail-trigger-validation.ts',
        'mail-trigger.controller.ts',
        'mail-trigger.service.ts',
      ]) {
        const source = readFileSync(join(__dirname, name), 'utf8');
        expect(source).not.toMatch(
          /setInterval|setTimeout|OnModuleInit|OnApplicationBootstrap|CollaborationStartService|OrchestrationModule|approveStep|ConnectorBroker|ConnectorsModule|readRecentMail|readCalendarWindow|callConnectorTool|mail_list_recent|ScheduleRunService|ScheduleTimer|EventTriggerRunService|EventTriggerTimer/,
        );
      }
      const service = readFileSync(join(__dirname, 'mail-trigger.service.ts'), 'utf8');
      expect(service.match(/isMailTriggersEnabled\(\)/g)).toHaveLength(1);
      expect(service).toMatch(/enabled: isMailTriggersEnabled\(\),/);
      expect(service).not.toMatch(/isSchedulesEnabled|isEventTriggersEnabled/);
    });

    it('the mail files reuse the schedule helpers by import and never import the event trigger or schedule routes', () => {
      for (const name of ['mail-trigger-validation.ts', 'mail-trigger.controller.ts', 'mail-trigger.service.ts']) {
        const source = readFileSync(join(__dirname, name), 'utf8');
        expect(source).not.toMatch(/from '\.\/event-trigger|from '\.\/schedule\.controller'|from '\.\/schedule-run|from '\.\/schedule-timer/);
      }
      expect(readFileSync(join(__dirname, 'mail-trigger-validation.ts'), 'utf8')).toContain(
        "import { isAcceptedTimeZone, isUuid } from './schedule-validation';",
      );
      // The frozen routes keep their own paths.
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

/* ---------- In-memory TypeORM stand-in (the event trigger controller spec's store). ---------- */

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
    if (target === AgentMailTrigger) return this.store.triggers as MemoryRepository<object>;
    if (target === AgentMailTriggerRun) return this.store.runs as MemoryRepository<object>;
    if (target === UserAgent) return this.store.workflows as MemoryRepository<object>;
    if (target === AuditEventEntity) return this.store.audit as MemoryRepository<object>;
    if (target === ConnectorConnection) return this.store.connections as MemoryRepository<object>;
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
  triggers = new MemoryRepository<AgentMailTrigger>('triggers', this.calls);
  runs = new MemoryRepository<AgentMailTriggerRun>('runs', this.calls);
  workflows = new MemoryRepository<UserAgent>('workflows', this.calls);
  audit = new MemoryRepository<AuditEventEntity>('audit', this.calls);
  connections = new MemoryRepository<ConnectorConnection>('connections', this.calls);
  manager = new MemoryManager(this);

  constructor() {
    for (const repository of [this.triggers, this.runs, this.workflows, this.audit, this.connections]) {
      repository.manager = this.manager;
    }
  }
}
