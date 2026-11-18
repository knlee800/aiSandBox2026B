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
import { AgentChainTrigger } from '../entities/agent-chain-trigger.entity';
import { AgentChainTriggerRun } from '../entities/agent-chain-trigger-run.entity';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { UserAgent } from '../entities/user-agent.entity';
import { SameOriginWriteGuard } from '../guards/same-origin-write.guard';
import { isRunResultToolEnabled } from '../orchestration/collaboration-result-grant';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import { ChainTriggerController } from './chain-trigger.controller';
import { ChainTriggerService } from './chain-trigger.service';
import { EventTriggerController } from './event-trigger.controller';
import { KnowledgeTriggerController } from './knowledge-trigger.controller';
import { MailTriggerController } from './mail-trigger.controller';
import { ScheduleController } from './schedule.controller';

const OWNER = '11111111-1111-4111-8111-111111111111';
const NOT_ENTITLED = '22222222-2222-4222-8222-222222222222';
const OTHER = '77777777-7777-4777-8777-777777777777';
const WF_A = '33333333-3333-4333-8333-333333333333';
const WF_B = '3bbbbbbb-3333-4333-8333-333333333333';
const OTHER_WORKFLOW = '44444444-4444-4444-8444-444444444444';
const DELETED_WORKFLOW = '55555555-5555-4555-8555-555555555555';
const UNKNOWN_ID = '66666666-6666-4666-8666-666666666666';
const APP_ORIGIN = 'http://localhost:3000';
const VALID_API_KEY = 'test-harness-api-key';
const MARKER = 'MARKER-TASK-a5c0';

const TOKENS: Record<string, string> = {
  'owner-token': OWNER,
  'plain-token': NOT_ENTITLED,
  'other-token': OTHER,
};

function triggerBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sourceWorkflowId: WF_A,
    target: { kind: 'chief-of-staff' },
    task: `${MARKER} summarise it`,
    timeZone: 'Asia/Taipei',
    ...overrides,
  };
}

describe('ChainTriggerController (TRIGGER-CHAIN-01 S1)', () => {
  const originalFlag = process.env.CHAIN_TRIGGERS_ENABLED;
  const originalBase = process.env.APP_BASE_URL;
  let app: INestApplication;
  let store: MemoryStore;
  let logs: string[];
  let restoreLogs: () => void;

  async function boot(): Promise<void> {
    store = new MemoryStore();
    store.workflows.rows.push(
      { id: WF_A, userId: OWNER, name: 'Research desk', status: 'active', deletedAt: null } as UserAgent,
      { id: WF_B, userId: OWNER, name: 'Weekly digest', status: 'active', deletedAt: null } as UserAgent,
      { id: OTHER_WORKFLOW, userId: OTHER, name: 'Not yours', status: 'active', deletedAt: null } as UserAgent,
      {
        id: DELETED_WORKFLOW,
        userId: OWNER,
        name: 'Deleted flow',
        status: 'active',
        deletedAt: new Date('2026-11-01T00:00:00Z'),
      } as UserAgent,
    );
    const moduleRef = await Test.createTestingModule({
      controllers: [ChainTriggerController],
      providers: [
        ChainTriggerService,
        SessionCookieGuard,
        // Not used by the controller. Provided so that the API-key tests run
        // against a key the API-key path accepts (with harness scope): if the
        // routes ever moved to SessionOrApiKeyAuthGuard, those tests fail.
        SessionOrApiKeyAuthGuard,
        { provide: getRepositoryToken(AgentChainTrigger), useValue: store.triggers },
        { provide: getRepositoryToken(AgentChainTriggerRun), useValue: store.runs },
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
    process.env.CHAIN_TRIGGERS_ENABLED = 'true';
    process.env.APP_BASE_URL = APP_ORIGIN;
    logs = [];
    restoreLogs = watchLogs(logs);
    await boot();
  });

  afterEach(async () => {
    if (app) await app.close();
    restoreLogs();
    if (originalFlag === undefined) delete process.env.CHAIN_TRIGGERS_ENABLED;
    else process.env.CHAIN_TRIGGERS_ENABLED = originalFlag;
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
    ['get', '/api/chain-triggers'],
    ['post', '/api/chain-triggers'],
    ['patch', `/api/chain-triggers/${UNKNOWN_ID}`],
    ['delete', `/api/chain-triggers/${UNKNOWN_ID}`],
    ['get', `/api/chain-triggers/${UNKNOWN_ID}/runs`],
  ];

  it('uses SessionCookieGuard (session only) on the whole controller, as the other trigger routes do', () => {
    expect(Reflect.getMetadata('__guards__', ChainTriggerController)).toEqual([SessionCookieGuard]);
    for (const other of [KnowledgeTriggerController, MailTriggerController, EventTriggerController, ScheduleController]) {
      expect(Reflect.getMetadata('__guards__', ChainTriggerController)).toEqual(Reflect.getMetadata('__guards__', other));
    }
    expect(Reflect.getMetadata('path', ChainTriggerController)).toBe('chain-triggers');
    const source = readFileSync(join(__dirname, 'chain-trigger.controller.ts'), 'utf8');
    expect(source).toContain("@Controller('chain-triggers')");
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
      const response = await as('stale-token').get('/api/chain-triggers').expect(401);
      expect(response.body.message).toBe('Invalid or expired session');
      await as('stale-token').post('/api/chain-triggers').send(triggerBody()).expect(401);
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
      .post('/api/chain-triggers')
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example.com')
      .send(triggerBody())
      .expect(403);
    await request(app.getHttpServer()).post('/api/chain-triggers').set('Cookie', cookie).send(triggerBody()).expect(403);
    expect(store.calls).toEqual([]);
  });

  it('the main flow: create, list, change, history, delete, with the frozen shapes', async () => {
    const owner = as('owner-token');
    const runs = jest.spyOn(KillSwitchConfig, 'GLOBAL_EXECUTION_ENABLED', 'get').mockReturnValue(false);
    try {
      const empty = await owner.get('/api/chain-triggers').expect(200);
      expect(empty.body).toEqual({
        enabled: true,
        runsEnabled: false,
        resultToolEnabled: isRunResultToolEnabled(),
        limit: 3,
        triggers: [],
      });
      expect(typeof empty.body.resultToolEnabled).toBe('boolean');

      const created = await owner
        .post('/api/chain-triggers')
        .send(triggerBody({ target: { kind: 'workflow', workflowId: WF_B } }))
        .expect(201);
      expect(Object.keys(created.body).sort()).toEqual(
        ['createdAt', 'enabled', 'firesOn', 'id', 'lastRun', 'source', 'sourceWorkflowId', 'target', 'task', 'timeZone', 'updatedAt'].sort(),
      );
      expect(created.body).toMatchObject({
        sourceWorkflowId: WF_A,
        source: { workflowId: WF_A, name: 'Research desk', status: 'active' },
        target: { kind: 'workflow', workflowId: WF_B, name: 'Weekly digest', status: 'active' },
        task: `${MARKER} summarise it`,
        timeZone: 'Asia/Taipei',
        enabled: true,
        lastRun: null,
      });
      const id: string = created.body.id;

      const listed = await owner.get('/api/chain-triggers').expect(200);
      expect(Object.keys(listed.body).sort()).toEqual(['enabled', 'limit', 'resultToolEnabled', 'runsEnabled', 'triggers']);
      expect(listed.body.triggers).toEqual([created.body]);

      const changed = await owner
        .patch(`/api/chain-triggers/${id}`)
        .send({ target: { kind: 'chief-of-staff' }, timeZone: 'Europe/London', enabled: false })
        .expect(200);
      expect(changed.body).toMatchObject({
        id,
        sourceWorkflowId: WF_A,
        source: { workflowId: WF_A, name: 'Research desk', status: 'active' },
        target: { kind: 'chief-of-staff' },
        timeZone: 'Europe/London',
        enabled: false,
      });

      store.runs.rows.push({
        id: 'run-row-1',
        triggerId: id,
        userId: OWNER,
        sourceRunId: 'collab_finished-1',
        sourceCompletedAt: new Date('2026-11-16T10:27:00Z'),
        localDate: '2026-11-16',
        depth: 2,
        outcome: 'skipped',
        reason: 'chain_depth',
        collaborationRunId: null,
        createdAt: new Date('2026-11-16T10:30:00Z'),
      });
      const history = await owner.get(`/api/chain-triggers/${id}/runs`).expect(200);
      const row = {
        sourceRunId: 'collab_finished-1',
        sourceCompletedAt: '2026-11-16T10:27:00.000Z',
        localDate: '2026-11-16',
        depth: 2,
        outcome: 'skipped',
        reason: 'chain_depth',
        collaborationRunId: null,
        at: '2026-11-16T10:30:00.000Z',
      };
      expect(history.body).toEqual({ runs: [{ id: 'run-row-1', ...row }] });
      const withLast = await owner.get('/api/chain-triggers').expect(200);
      expect(withLast.body.triggers[0].lastRun).toEqual(row);

      const removed = await owner.delete(`/api/chain-triggers/${id}`).expect(200);
      expect(removed.body).toEqual({ id, deleted: true });
      expect(store.triggers.rows).toHaveLength(0);
      expect(store.runs.rows).toHaveLength(0);
      await owner.get(`/api/chain-triggers/${id}/runs`).expect(404);

      expect(store.audit.rows.map((entry) => entry.eventType)).toEqual([
        'chain_trigger_created',
        'chain_trigger_updated',
        'chain_trigger_deleted',
      ]);
      for (const secret of [MARKER, 'summarise', 'Research desk', 'Weekly digest']) {
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
        .post('/api/chain-triggers')
        .send(triggerBody({ task: 'theirs', sourceWorkflowId: OTHER_WORKFLOW }))
        .expect(201);
      otherTriggerId = created.body.id;
      store.runs.rows.push({
        id: 'their-run',
        triggerId: otherTriggerId,
        userId: OTHER,
        sourceRunId: 'collab_theirs',
        sourceCompletedAt: new Date('2026-11-14T00:57:00Z'),
        localDate: '2026-11-14',
        depth: 1,
        outcome: 'started',
        reason: null,
        collaborationRunId: 'collab_x',
        createdAt: new Date('2026-11-14T01:00:00Z'),
      });
    });

    it.each([
      ['patch', (id: string) => `/api/chain-triggers/${id}`],
      ['delete', (id: string) => `/api/chain-triggers/${id}`],
      ['get', (id: string) => `/api/chain-triggers/${id}/runs`],
    ] as Array<['patch' | 'delete' | 'get', (id: string) => string]>)(
      "%s on another owner's trigger, an unknown id and a malformed id",
      async (method, path) => {
        const before = snapshot();
        for (const id of [otherTriggerId, UNKNOWN_ID, 'not-a-uuid']) {
          const response = await as('owner-token')[method](path(id)).send({ enabled: false }).expect(404);
          expect(response.body).toEqual({
            statusCode: 404,
            message: 'Chain trigger not found',
            error: 'Not Found',
            code: 'chain_trigger_not_found',
          });
        }
        expect(snapshot()).toBe(before);
      },
    );

    it("another owner's triggers are not listed", async () => {
      const listed = await as('owner-token').get('/api/chain-triggers').expect(200);
      expect(listed.body.triggers).toEqual([]);
      expect(listed.text).not.toContain('theirs');
      expect(listed.text).not.toContain(otherTriggerId);
    });

    it("another owner's or a deleted workflow as source or target answers 404 on create and on change, and nothing changes", async () => {
      const own = await as('owner-token').post('/api/chain-triggers').send(triggerBody()).expect(201);
      const before = snapshot();
      for (const workflowId of [OTHER_WORKFLOW, DELETED_WORKFLOW, UNKNOWN_ID]) {
        for (const payload of [{ sourceWorkflowId: workflowId }, { target: { kind: 'workflow', workflowId } }]) {
          const create = await as('owner-token').post('/api/chain-triggers').send(triggerBody(payload)).expect(404);
          expect(create.body.code).toBe('chain_trigger_workflow_not_found');
          const change = await as('owner-token').patch(`/api/chain-triggers/${own.body.id}`).send(payload).expect(404);
          expect(change.body.code).toBe('chain_trigger_workflow_not_found');
        }
      }
      expect(snapshot()).toBe(before);
    });
  });

  describe('validation (stage-start sections 2 to 4)', () => {
    it.each([
      ['no source', { sourceWorkflowId: undefined }, 'chain_trigger_missing_field'],
      ['a null source', { sourceWorkflowId: null }, 'chain_trigger_invalid_source'],
      ['the Chief of Staff as the source', { sourceWorkflowId: 'chief-of-staff' }, 'chain_trigger_invalid_source'],
      ['no target', { target: undefined }, 'chain_trigger_missing_field'],
      ['a target equal to the source', { target: { kind: 'workflow', workflowId: WF_A } }, 'chain_trigger_same_workflow'],
      ['a team that needs a session', { target: { kind: 'coding' } }, 'chain_trigger_invalid_target'],
      ['an empty task', { task: '   ' }, 'chain_trigger_invalid_task'],
      ['a task over 7000 characters', { task: 'a'.repeat(7001) }, 'chain_trigger_invalid_task'],
      ['an invalid zone', { timeZone: 'Mars/Olympus_Mons' }, 'chain_trigger_invalid_time_zone'],
      ['a non-boolean switch', { enabled: 'yes' }, 'chain_trigger_invalid_enabled'],
      ['a provider', { provider: 'openai' }, 'chain_trigger_unknown_field'],
      ['a model', { model: { choice: 'pinned' } }, 'chain_trigger_unknown_field'],
      ['an approval setting', { approvalMode: 'auto' }, 'chain_trigger_unknown_field'],
      ['a tool profile', { toolProfile: 'write' }, 'chain_trigger_unknown_field'],
      ['a session id', { sessionId: UNKNOWN_ID }, 'chain_trigger_unknown_field'],
      ['an armed time', { armedAt: '2026-11-16T00:00:00Z' }, 'chain_trigger_unknown_field'],
      ['a depth', { depth: 1 }, 'chain_trigger_unknown_field'],
      ['a source run id', { sourceRunId: 'collab_x' }, 'chain_trigger_unknown_field'],
    ])('POST refuses %s with 400 and writes nothing', async (_label, overrides, code) => {
      const payload = triggerBody(overrides);
      for (const [key, value] of Object.entries(overrides)) {
        if (value === undefined) delete payload[key];
      }
      const response = await as('owner-token').post('/api/chain-triggers').send(payload).expect(400);
      expect(response.body.code).toBe(code);
      expect(response.text).not.toContain(MARKER);
      expect(store.triggers.rows).toHaveLength(0);
      expect(store.audit.rows).toHaveLength(0);
    });

    it('the edges are accepted: a 7000-character task, a workflow target, a switched-off trigger', async () => {
      await as('owner-token').post('/api/chain-triggers').send(triggerBody({ task: 'a'.repeat(7000) })).expect(201);
      await as('owner-token')
        .post('/api/chain-triggers')
        .send(triggerBody({ target: { kind: 'workflow', workflowId: WF_B } }))
        .expect(201);
      await as('owner-token').post('/api/chain-triggers').send(triggerBody({ enabled: false })).expect(201);
      expect(store.triggers.rows.map((row) => row.enabled)).toEqual([true, true, false]);
    });

    it('PATCH refuses an empty change, a bad source, the same-workflow rule on the merged row, a bad zone and an unknown field', async () => {
      const own = await as('owner-token')
        .post('/api/chain-triggers')
        .send(triggerBody({ target: { kind: 'workflow', workflowId: WF_B } }))
        .expect(201);
      const before = snapshot();
      const patch = (payload: Record<string, unknown>) =>
        as('owner-token').patch(`/api/chain-triggers/${own.body.id}`).send(payload).expect(400);
      expect((await patch({})).body.code).toBe('chain_trigger_empty_change');
      expect((await patch({ sourceWorkflowId: null })).body.code).toBe('chain_trigger_invalid_source');
      expect((await patch({ sourceWorkflowId: WF_B })).body.code).toBe('chain_trigger_same_workflow');
      expect((await patch({ target: { kind: 'workflow', workflowId: WF_A } })).body.code).toBe('chain_trigger_same_workflow');
      expect((await patch({ timeZone: 'Bad/Zone' })).body.code).toBe('chain_trigger_invalid_time_zone');
      expect((await patch({ userId: OTHER })).body.code).toBe('chain_trigger_unknown_field');
      expect(snapshot()).toBe(before);
    });
  });

  it('CHAIN-SOURCE-OFF-01: a switched-off or draft source is saved and switched on (no refusal); the answers carry its status', async () => {
    const WF_OFF = '3ddddddd-3333-4333-8333-333333333333';
    const WF_DRAFT = '3eeeeeee-3333-4333-8333-333333333333';
    store.workflows.rows.push(
      { id: WF_OFF, userId: OWNER, name: 'Switched off flow', status: 'disabled', deletedAt: null } as UserAgent,
      { id: WF_DRAFT, userId: OWNER, name: 'Draft flow', status: 'draft', deletedAt: null } as UserAgent,
    );
    const owner = as('owner-token');
    const created = await owner
      .post('/api/chain-triggers')
      .send(triggerBody({ sourceWorkflowId: WF_OFF, enabled: false }))
      .expect(201);
    expect(created.body.sourceWorkflowId).toBe(WF_OFF);
    expect(created.body.source).toEqual({ workflowId: WF_OFF, name: 'Switched off flow', status: 'disabled' });

    const on = await owner.patch(`/api/chain-triggers/${created.body.id}`).send({ enabled: true }).expect(200);
    expect(on.body).toMatchObject({
      enabled: true,
      sourceWorkflowId: WF_OFF,
      source: { workflowId: WF_OFF, name: 'Switched off flow', status: 'disabled' },
    });

    const draft = await owner.post('/api/chain-triggers').send(triggerBody({ sourceWorkflowId: WF_DRAFT })).expect(201);
    expect(draft.body.source).toEqual({ workflowId: WF_DRAFT, name: 'Draft flow', status: 'draft' });

    store.workflows.rows.find((row) => row.id === WF_OFF)!.deletedAt = new Date();
    const listed = await owner.get('/api/chain-triggers').expect(200);
    expect(listed.body.triggers.map((trigger: { source: unknown }) => trigger.source)).toEqual([
      { workflowId: WF_OFF, name: null, status: 'missing' },
      { workflowId: WF_DRAFT, name: 'Draft flow', status: 'draft' },
    ]);
    expect(store.triggers.rows.map((row) => row.enabled)).toEqual([true, true]);
    for (const secret of ['Switched off flow', 'Draft flow', MARKER]) {
      expect(JSON.stringify(store.audit.rows)).not.toContain(secret);
      expect(logs.join('\n')).not.toContain(secret);
    }
  });

  describe('firesOn (TRIGGER-CHAIN-FAILED-01 S1)', () => {
    it('POST without firesOn answers completed, with failed answers failed; list, PATCH and every answer carry it', async () => {
      const owner = as('owner-token');
      const plain = await owner.post('/api/chain-triggers').send(triggerBody()).expect(201);
      expect(plain.body.firesOn).toBe('completed');
      const failed = await owner
        .post('/api/chain-triggers')
        .send(triggerBody({ sourceWorkflowId: WF_B, firesOn: 'failed' }))
        .expect(201);
      expect(failed.body.firesOn).toBe('failed');
      expect(store.triggers.rows.map((row) => row.firesOn)).toEqual(['completed', 'failed']);

      const listed = await owner.get('/api/chain-triggers').expect(200);
      expect(Object.keys(listed.body).sort()).toEqual(['enabled', 'limit', 'resultToolEnabled', 'runsEnabled', 'triggers']);
      expect(listed.body.triggers.map((trigger: { firesOn: string }) => trigger.firesOn)).toEqual(['completed', 'failed']);

      const changed = await owner.patch(`/api/chain-triggers/${plain.body.id}`).send({ firesOn: 'failed' }).expect(200);
      expect(changed.body).toMatchObject({ id: plain.body.id, firesOn: 'failed', enabled: true });
      const untouched = await owner.patch(`/api/chain-triggers/${failed.body.id}`).send({ task: 'other' }).expect(200);
      expect(untouched.body.firesOn).toBe('failed');
      expect(store.audit.rows.map((row) => (row.payload as Record<string, unknown>).firesOn)).toEqual([
        'completed',
        'failed',
        'failed',
        'failed',
      ]);
    });

    it.each([['cancelled'], ['FAILED'], [''], [null], [true], [['failed']]])(
      'firesOn %j is 400 chain_trigger_invalid_fires_on on POST and PATCH and writes nothing',
      async (firesOn) => {
        const owner = as('owner-token');
        const refused = await owner.post('/api/chain-triggers').send(triggerBody({ firesOn })).expect(400);
        expect(refused.body).toEqual({
          statusCode: 400,
          message: "firesOn must be 'completed' or 'failed'",
          error: 'Bad Request',
          code: 'chain_trigger_invalid_fires_on',
        });
        expect(store.triggers.rows).toHaveLength(0);
        const own = await owner.post('/api/chain-triggers').send(triggerBody()).expect(201);
        const before = snapshot();
        const patched = await owner.patch(`/api/chain-triggers/${own.body.id}`).send({ firesOn }).expect(400);
        expect(patched.body.code).toBe('chain_trigger_invalid_fires_on');
        expect(snapshot()).toBe(before);
      },
    );

    it("a firesOn change on another owner's trigger, an unknown id or a malformed id is 404 and changes nothing", async () => {
      const theirs = await as('other-token')
        .post('/api/chain-triggers')
        .send(triggerBody({ sourceWorkflowId: OTHER_WORKFLOW }))
        .expect(201);
      const before = snapshot();
      for (const id of [theirs.body.id, UNKNOWN_ID, 'not-a-uuid']) {
        const response = await as('owner-token').patch(`/api/chain-triggers/${id}`).send({ firesOn: 'failed' }).expect(404);
        expect(response.body.code).toBe('chain_trigger_not_found');
      }
      expect(snapshot()).toBe(before);
      expect(store.triggers.rows[0].firesOn).toBe('completed');
    });

    it('a failure trigger and a completed trigger cannot close a loop between them (409 chain_trigger_cycle)', async () => {
      const owner = as('owner-token');
      await owner
        .post('/api/chain-triggers')
        .send(triggerBody({ target: { kind: 'workflow', workflowId: WF_B }, firesOn: 'failed' }))
        .expect(201);
      const refused = await owner
        .post('/api/chain-triggers')
        .send(triggerBody({ sourceWorkflowId: WF_B, target: { kind: 'workflow', workflowId: WF_A } }))
        .expect(409);
      expect(refused.body.code).toBe('chain_trigger_cycle');
    });

    it('the limit of 3 counts failure and completed triggers together', async () => {
      const owner = as('owner-token');
      for (const firesOn of ['failed', 'completed', 'failed']) {
        await owner.post('/api/chain-triggers').send(triggerBody({ firesOn })).expect(201);
      }
      const refused = await owner.post('/api/chain-triggers').send(triggerBody({ firesOn: 'failed' })).expect(409);
      expect(refused.body.code).toBe('chain_trigger_limit_reached');
      expect(store.triggers.rows).toHaveLength(3);
    });
  });

  it('a save that closes a cycle is 409 chain_trigger_cycle, on create and on change', async () => {
    const owner = as('owner-token');
    await owner.post('/api/chain-triggers').send(triggerBody({ target: { kind: 'workflow', workflowId: WF_B } })).expect(201);
    const refused = await owner
      .post('/api/chain-triggers')
      .send(triggerBody({ sourceWorkflowId: WF_B, target: { kind: 'workflow', workflowId: WF_A } }))
      .expect(409);
    expect(refused.body).toEqual({
      statusCode: 409,
      message: 'This trigger would close a loop of chain triggers',
      error: 'Conflict',
      code: 'chain_trigger_cycle',
    });
    const second = await owner.post('/api/chain-triggers').send(triggerBody({ sourceWorkflowId: WF_B })).expect(201);
    const change = await owner
      .patch(`/api/chain-triggers/${second.body.id}`)
      .send({ target: { kind: 'workflow', workflowId: WF_A } })
      .expect(409);
    expect(change.body.code).toBe('chain_trigger_cycle');
    expect(store.triggers.rows).toHaveLength(2);
    expect(store.triggers.rows[1].targetKind).toBe('chief-of-staff');
  });

  it('the fourth trigger is 409 chain_trigger_limit_reached', async () => {
    for (let i = 0; i < 3; i += 1) {
      await as('owner-token').post('/api/chain-triggers').send(triggerBody({ enabled: i === 0 })).expect(201);
    }
    const refused = await as('owner-token').post('/api/chain-triggers').send(triggerBody()).expect(409);
    expect(refused.body).toEqual({
      statusCode: 409,
      message: 'At most 3 chain triggers per account',
      error: 'Conflict',
      code: 'chain_trigger_limit_reached',
      limit: 3,
    });
    expect(store.triggers.rows).toHaveLength(3);
  });

  describe('CHAIN_TRIGGERS_ENABLED off', () => {
    it.each([[undefined], ['false'], ['TRUE'], ['1'], [' true']])(
      'with %j the routes still work and GET reports enabled false',
      async (value) => {
        if (value === undefined) delete process.env.CHAIN_TRIGGERS_ENABLED;
        else process.env.CHAIN_TRIGGERS_ENABLED = value;
        const owner = as('owner-token');
        const created = await owner.post('/api/chain-triggers').send(triggerBody()).expect(201);
        const listed = await owner.get('/api/chain-triggers').expect(200);
        expect(listed.body.enabled).toBe(false);
        expect(listed.body.triggers).toHaveLength(1);
        await owner.patch(`/api/chain-triggers/${created.body.id}`).send({ enabled: false }).expect(200);
        await owner.get(`/api/chain-triggers/${created.body.id}/runs`).expect(200);
        await owner.delete(`/api/chain-triggers/${created.body.id}`).expect(200);
      },
    );

    it('the exact string true reports enabled true; the other trigger switches do not', async () => {
      process.env.CHAIN_TRIGGERS_ENABLED = 'true';
      expect((await as('owner-token').get('/api/chain-triggers').expect(200)).body.enabled).toBe(true);
      const names = ['SCHEDULES_ENABLED', 'EVENT_TRIGGERS_ENABLED', 'MAIL_TRIGGERS_ENABLED', 'KNOWLEDGE_TRIGGERS_ENABLED'] as const;
      const originals = names.map((name) => process.env[name]);
      try {
        delete process.env.CHAIN_TRIGGERS_ENABLED;
        for (const name of names) process.env[name] = 'true';
        expect((await as('owner-token').get('/api/chain-triggers').expect(200)).body.enabled).toBe(false);
      } finally {
        names.forEach((name, index) => {
          if (originals[index] === undefined) delete process.env[name];
          else process.env[name] = originals[index];
        });
      }
    });

    it('the gateway parts boot with CHAIN_TRIGGERS_ENABLED unset', async () => {
      await app.close();
      delete process.env.CHAIN_TRIGGERS_ENABLED;
      await boot();
      expect((await as('owner-token').get('/api/chain-triggers').expect(200)).body.enabled).toBe(false);
    });
  });

  describe('S1 boundaries', () => {
    it('the S1 files have no timer, no run read and no run start', () => {
      for (const name of [
        'chain-trigger-switch.ts',
        'chain-trigger-validation.ts',
        'chain-trigger.controller.ts',
        'chain-trigger.service.ts',
      ]) {
        const source = readFileSync(join(__dirname, name), 'utf8');
        expect(source).not.toMatch(
          /setInterval|setTimeout|OnModuleInit|OnApplicationBootstrap|CollaborationStartService|OrchestrationModule|OrchestrationService|approveStep|CollaborationRunEntity|CollaborationReferral|collaboration_runs|pending_job|result_summary|ConnectorBroker|ConnectorsModule|ScheduleRunService|ScheduleTimer|EventTriggerRunService|EventTriggerTimer|MailTriggerRunService|MailTriggerTimer|KnowledgeTriggerRunService|KnowledgeTriggerTimer/,
        );
        expect(source).not.toContain('\r');
      }
      const service = readFileSync(join(__dirname, 'chain-trigger.service.ts'), 'utf8');
      expect(service.match(/isChainTriggersEnabled\(\)/g)).toHaveLength(1);
      expect(service).toMatch(/enabled: isChainTriggersEnabled\(\),/);
      expect(service).not.toMatch(/isSchedulesEnabled|isEventTriggersEnabled|isMailTriggersEnabled|isKnowledgeTriggersEnabled/);
    });

    it('the chain files reuse the schedule helpers by import and never import another trigger type', () => {
      for (const name of ['chain-trigger-validation.ts', 'chain-trigger.controller.ts', 'chain-trigger.service.ts']) {
        const source = readFileSync(join(__dirname, name), 'utf8');
        expect(source).not.toMatch(
          /from '\.\/event-trigger|from '\.\/mail-trigger|from '\.\/knowledge-trigger|from '\.\/schedule\.controller'|from '\.\/schedule-run|from '\.\/schedule-timer/,
        );
      }
      expect(readFileSync(join(__dirname, 'chain-trigger-validation.ts'), 'utf8')).toContain(
        "import { isAcceptedTimeZone, isUuid } from './schedule-validation';",
      );
      // The frozen routes keep their own paths.
      expect(Reflect.getMetadata('path', KnowledgeTriggerController)).toBe('knowledge-triggers');
      expect(Reflect.getMetadata('path', MailTriggerController)).toBe('mail-triggers');
      expect(Reflect.getMetadata('path', EventTriggerController)).toBe('event-triggers');
      expect(Reflect.getMetadata('path', ScheduleController)).toBe('schedules');
    });

    it('the gateway source outside the two orchestration files never names the run result switch, its job field or its grant', () => {
      // The three texts are assembled here so that this spec does not contain them either.
      const pinned = [['run', 'Result', 'Read'].join(''), ['RUN', 'RESULT', 'TOOL', 'ENABLED'].join('_'), ['run', 'Result', 'Grant', 'Job', 'Fields'].join('')];
      for (const name of [
        'chain-trigger-switch.ts',
        'chain-trigger-validation.ts',
        'chain-trigger.controller.ts',
        'chain-trigger.service.ts',
        'chain-trigger-switch.spec.ts',
        'chain-trigger-validation.spec.ts',
        'chain-trigger.controller.spec.ts',
        'chain-trigger.service.spec.ts',
        'triggers.module.ts',
        join('..', 'entities', 'agent-chain-trigger.entity.ts'),
        join('..', 'entities', 'agent-chain-trigger-run.entity.ts'),
        join('..', 'migrations', '1814000000000-CreateAgentChainTriggerTables.ts'),
        join('..', 'migrations', '__tests__', '1814000000000-CreateAgentChainTriggerTables.spec.ts'),
      ]) {
        const source = readFileSync(join(__dirname, name), 'utf8');
        for (const text of pinned) {
          expect(source.includes(text)).toBe(false);
        }
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

/* ---------- In-memory TypeORM stand-in (the knowledge trigger controller spec's store). ---------- */

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
    if (target === AgentChainTrigger) return this.store.triggers as MemoryRepository<object>;
    if (target === AgentChainTriggerRun) return this.store.runs as MemoryRepository<object>;
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
  triggers = new MemoryRepository<AgentChainTrigger>('triggers', this.calls);
  runs = new MemoryRepository<AgentChainTriggerRun>('runs', this.calls);
  workflows = new MemoryRepository<UserAgent>('workflows', this.calls);
  audit = new MemoryRepository<AuditEventEntity>('audit', this.calls);
  manager = new MemoryManager(this);

  constructor() {
    for (const repository of [this.triggers, this.runs, this.workflows, this.audit]) {
      repository.manager = this.manager;
    }
  }
}
