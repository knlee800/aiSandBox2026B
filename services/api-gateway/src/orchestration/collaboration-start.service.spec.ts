import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { ExecutionResultService } from '../ai/execution-result.service';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import { AbortConfig } from '../abort/abort.config';
import { AbortGuard } from '../abort/abort.guard';
import { CreditBalanceGuard } from '../billing/credit-balance.guard';
import { UserRole } from '../entities/user-role.enum';
import { QueueService } from '../queue/queue.service';
import { TokenQuotaGuard } from '../quota/token-quota.guard';
import { ExecutionSafetyGuard } from '../safety/execution-safety.guard';
import { GlobalSafetyLimitService } from '../safety/global-safety-limit.service';
import { UsageLedgerService } from '../usage-ledger/usage-ledger.service';
import { DailyCreditCapService } from '../safety/daily-credit-cap.service';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import { chatReply } from '../chat/chat-replies';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import { ConversationService } from '../conversations/conversation.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { SessionService } from '../sessions/session.service';
import { ChatRunService } from '../chat/chat-run.service';
import { CollaborationBusinessSessionService } from './collaboration-business-session';
import { CollaborationController } from './collaboration.controller';
import { CollaborationReferralEntity } from './collaboration-referral.entity';
import { CollaborationRunEntity } from './collaboration-run.entity';
import {
  COLLABORATION_OMITTED_CANCEL_REASON,
  CollaborationStartService,
  collaborationHttpException,
} from './collaboration-start.service';
import { CollaborationWorkflowService, workflowRefusal, WORKFLOW_REFUSAL_CODES } from './collaboration-workflow';
import { OrchestrationModule } from './orchestration.module';
import { OrchestrationService } from './orchestration.service';

/**
 * CHAT-DISCORD-01 C1 D1: the Team page's start and approve code as a shared
 * service. collaboration.controller.spec.ts stays unchanged and covers the
 * route's behaviour; this file proves the controller delegates to the module's
 * service and that a chat start stores the same hand-off as the page's start
 * for the same owner and body (acceptance 2), never with a sessionId (3).
 */

const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BUSINESS_SESSION_ID = '33333333-3333-4333-8333-333333333333';
const BUSINESS_PROJECT_ID = '44444444-4444-4444-8444-444444444444';
const CONVERSATION_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const WORKFLOW_ID = '55555555-5555-4555-8555-555555555555';
const LINK_ID = '66666666-6666-4666-8666-666666666666';
const TASK = 'Plan my week with the sales numbers';
const HARNESS_SECRET = 'collaboration-start-test-secret';

function cloneRow<T>(row: T): T {
  const copy = { ...(row as Record<string, unknown>) };
  for (const key of Object.keys(copy)) {
    const value = copy[key];
    if (value instanceof Date) {
      copy[key] = new Date(value.getTime());
    } else if (Array.isArray(value)) {
      copy[key] = [...value];
    } else if (key === 'pendingJob' && value && typeof value === 'object') {
      copy[key] = JSON.parse(JSON.stringify(value));
    }
  }
  return copy as T;
}

function matchesWhere(row: unknown, where?: Record<string, unknown>): boolean {
  if (!where) {
    return true;
  }
  const record = row as Record<string, unknown>;
  return Object.entries(where).every(([key, expected]) => record[key] === expected);
}

function createOrchestrationRepoFakes() {
  const runs = new Map<string, CollaborationRunEntity>();
  const referrals = new Map<string, CollaborationReferralEntity>();
  const createRepo = <T>(store: Map<string, T>, pk: string) => {
    const repo = {
      findOne: async ({ where }: { where: Record<string, unknown> }) => {
        for (const row of store.values()) {
          if (matchesWhere(row, where)) {
            return cloneRow(row);
          }
        }
        return null;
      },
      find: async (opts: { where?: Record<string, unknown> } = {}) =>
        [...store.values()].filter((row) => matchesWhere(row, opts.where)).map((row) => cloneRow(row)),
      save: async (entity: T) => {
        const copy = cloneRow(entity);
        store.set(String((copy as Record<string, unknown>)[pk]), copy);
        return cloneRow(copy);
      },
      update: async (criteria: Record<string, unknown>, partial: Record<string, unknown>) => {
        let affected = 0;
        for (const [key, row] of store) {
          if (matchesWhere(row, criteria)) {
            const next = cloneRow(row);
            Object.assign(next as Record<string, unknown>, partial);
            store.set(key, next);
            affected += 1;
          }
        }
        return { affected, raw: [], generatedMaps: [] };
      },
      manager: undefined as unknown,
    };
    return repo;
  };
  const runRepo = createRepo(runs, 'collaborationRunId');
  const referralRepo = createRepo(referrals, 'referralId');
  const manager = {
    transaction: async <R>(cb: (em: typeof manager) => Promise<R>) => cb(manager),
    getRepository: (entity: unknown) => {
      if (entity === CollaborationRunEntity) return runRepo;
      if (entity === CollaborationReferralEntity) return referralRepo;
      throw new Error('Unknown orchestration entity');
    },
  };
  runRepo.manager = manager;
  referralRepo.manager = manager;
  return { runRepo, referralRepo, runs, referrals };
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

/** The stored first hand-off without the values that differ on every start. */
function storedHandoff(referral: CollaborationReferralEntity): Record<string, unknown> {
  const row = JSON.parse(JSON.stringify(referral)) as Record<string, unknown>;
  for (const key of ['referralId', 'collaborationRunId', 'referralTraceId', 'idempotencyKey', 'executionId']) {
    expect(typeof row[key]).toBe('string');
    delete row[key];
  }
  for (const [key, value] of Object.entries(row)) {
    if (/At$/.test(key)) {
      expect(value === null || typeof value === 'string').toBe(true);
      row[key] = value === null ? null : 'time';
    }
  }
  const job = row.pendingJob as Record<string, unknown>;
  expect(typeof job.executionId === 'string' || job.executionId === undefined).toBe(true);
  for (const key of Object.keys(job)) {
    if (/execution/i.test(key) && typeof job[key] === 'string') {
      job[key] = 'id';
    }
  }
  return row;
}

function storedRun(run: CollaborationRunEntity): Record<string, unknown> {
  const row = JSON.parse(JSON.stringify(run)) as Record<string, unknown>;
  delete row.collaborationRunId;
  row.referralIds = (row.referralIds as unknown[]).length;
  for (const [key, value] of Object.entries(row)) {
    if (/At$/.test(key)) {
      row[key] = value === null ? null : 'time';
    }
  }
  return row;
}

describe('CollaborationStartService (CHAT-DISCORD-01 C1 D1)', () => {
  const original = {
    global: process.env.GLOBAL_EXECUTION_ENABLED,
    provider: process.env.AI_PROVIDER,
    abort: process.env.ABORT_MODE,
    secret: process.env.HARNESS_ENTITLEMENT_HMAC_SECRET,
  };

  let app: INestApplication;
  let fakes: ReturnType<typeof createOrchestrationRepoFakes>;
  let starts: CollaborationStartService;
  let orchestration: OrchestrationService;
  let sessionReads: jest.Mock;
  let workflowRows: Array<{ id: string; name: string; status: string }>;
  let creditBalance: number;
  let tokensUsed: number;
  let capCheck: jest.Mock;
  let prepareStart: jest.Mock;

  beforeEach(async () => {
    process.env.GLOBAL_EXECUTION_ENABLED = 'true';
    process.env.AI_PROVIDER = 'stub';
    process.env.ABORT_MODE = 'NONE';
    process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = HARNESS_SECRET;
    AbortConfig.initialize();

    fakes = createOrchestrationRepoFakes();
    sessionReads = jest.fn(async (id: string) => {
      throw new NotFoundException(`Session with ID ${id} not found`);
    });
    const conversations = new Map<string, { id: string; sessionId: string }>();
    creditBalance = 25;
    tokensUsed = 0;
    capCheck = jest.fn(async () => undefined);
    const creditGuard = new CreditBalanceGuard(
      { findByOwner: async () => ({ balance: creditBalance }) } as never,
      { findOne: async () => ({ role: UserRole.USER }) } as never,
    );
    const tokenGuard = new TokenQuotaGuard({
      createQueryRunner: () => ({
        connect: async () => undefined,
        startTransaction: async () => undefined,
        commitTransaction: async () => undefined,
        rollbackTransaction: async () => undefined,
        release: async () => undefined,
        query: async (sql: string) => {
          if (sql.includes('SUM(tokens_used)')) return [{ total: tokensUsed }];
          if (sql.includes('ORDER BY timestamp')) return [{ timestamp: new Date() }];
          return [];
        },
      }),
    } as never);
    workflowRows = [{ id: WORKFLOW_ID, name: 'Sales Digest', status: 'active' }];
    const workflow = {
      id: WORKFLOW_ID,
      name: 'Sales Digest',
      version: 'v-test',
      knowledgeScopeIds: [],
      connectorToolIds: [],
      model: { choice: 'server' as const },
      testRun: false,
      budgetPerRunCredits: null,
    };
    const workflowService = {
      prepareStart: (prepareStart = jest.fn(async (input: { userId: string; workflowId: string; testRun: boolean }) => {
        if (input.userId !== OWNER_ID || input.workflowId !== WORKFLOW_ID) {
          throw new NotFoundException('Workflow not found');
        }
        return {
          builderProfileId: WORKFLOW_ID,
          agents: [{ name: WORKFLOW_ID, instructions: 'Summarise the sales numbers.' }],
          provider: 'stub',
          adapter: 'stub',
          model: 'stub-model',
          workflow: { ...workflow },
          teamMemberIds: [],
        };
      })),
      listForOwner: jest.fn(async (userId: string) =>
        userId === OWNER_ID ? workflowRows.map((row) => ({ ...row })) : [],
      ),
      assertCanApprove: jest.fn(async () => undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollaborationController],
      providers: [
        OrchestrationService,
        CollaborationStartService,
        ExecutionSafetyGuard,
        GlobalSafetyLimitService,
        AbortGuard,
        { provide: DailyCreditCapService, useValue: { assertWithinDailyCap: capCheck } },
        { provide: CreditBalanceGuard, useValue: creditGuard },
        { provide: TokenQuotaGuard, useValue: tokenGuard },
        { provide: getRepositoryToken(CollaborationRunEntity), useValue: fakes.runRepo },
        { provide: getRepositoryToken(CollaborationReferralEntity), useValue: fakes.referralRepo },
        { provide: QueueService, useValue: { enqueueExecution: jest.fn().mockResolvedValue(undefined) } },
        {
          provide: ExecutionResultService,
          useValue: { requestCancel: jest.fn(), getExecution: jest.fn().mockResolvedValue(null) },
        },
        { provide: ContainerManagerHttpClient, useValue: { getWorkingTreeDiff: jest.fn() } },
        {
          provide: UsageLedgerService,
          useValue: { writeExecutionIntent: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: SessionService, useValue: { getSessionById: sessionReads } },
        { provide: KnowledgeService, useValue: { findActiveOwnedByIds: jest.fn(async () => []) } },
        {
          provide: ConversationService,
          useValue: {
            getConversationBySession: async (sessionId: string) => conversations.get(sessionId) ?? null,
            getOrCreateConversation: async (sessionId: string) => {
              const created = { id: CONVERSATION_ID, sessionId };
              conversations.set(sessionId, created);
              return created;
            },
          },
        },
        {
          provide: CollaborationBusinessSessionService,
          useValue: {
            ensureForOwner: async () => ({ sessionId: BUSINESS_SESSION_ID, projectId: BUSINESS_PROJECT_ID }),
            findForOwner: async () => ({ projectId: BUSINESS_PROJECT_ID }),
          },
        },
        { provide: CollaborationWorkflowService, useValue: workflowService },
      ],
    })
      .overrideGuard(SessionOrApiKeyAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          // The identity SessionOrApiKeyAuthGuard builds for a browser session.
          req.apiKeyIdentity = {
            userId: OWNER_ID,
            apiKeyId: 'browser-session',
            scopes: ['ai:execute'],
            isInternal: true,
            harnessEntitled: true,
          };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    starts = app.get(CollaborationStartService);
    orchestration = app.get(OrchestrationService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await app?.close();
    restoreEnv('GLOBAL_EXECUTION_ENABLED', original.global);
    restoreEnv('AI_PROVIDER', original.provider);
    restoreEnv('ABORT_MODE', original.abort);
    restoreEnv('HARNESS_ENTITLEMENT_HMAC_SECRET', original.secret);
  });

  function chatRuns(): { service: ChatRunService; deliveries: Array<Record<string, unknown>>; audit: unknown[] } {
    const deliveries: Array<Record<string, unknown>> = [];
    const audit: unknown[] = [];
    const service = new ChatRunService(
      starts,
      orchestration,
      { wake: jest.fn() } as never,
      {
        count: async () => 0,
        insert: async (row: Record<string, unknown>) => {
          deliveries.push({ ...row });
          return {};
        },
        update: async (where: Record<string, unknown>, patch: Record<string, unknown>) => {
          for (const row of deliveries) {
            if (row.collaborationRunId === where.collaborationRunId) Object.assign(row, patch);
          }
          return { affected: 1 };
        },
        find: async () => [],
      } as never,
      { insert: async (row: unknown) => audit.push(row) } as never,
    );
    return { service, deliveries, audit };
  }

  const link = { linkId: LINK_ID, userId: OWNER_ID, locale: 'en' as const };

  async function pageStartAndApprove(body: Record<string, unknown>): Promise<string> {
    const started = await request(app.getHttpServer()).post('/api/collaboration/runs').send(body).expect(201);
    await request(app.getHttpServer())
      .post(`/api/collaboration/runs/${started.body.collaborationRunId}/referrals/${started.body.referralId}/approve`)
      .send({})
      .expect(200);
    return started.body.collaborationRunId as string;
  }

  function firstHandoffOf(runId: string): CollaborationReferralEntity {
    const run = fakes.runs.get(runId)!;
    return fakes.referrals.get(run.referralIds[0])!;
  }

  it('the controller uses the module-provided service for start and approve', async () => {
    const start = jest.spyOn(starts, 'start');
    const approve = jest.spyOn(starts, 'approveStep');
    const runId = await pageStartAndApprove({ team: 'chief-of-staff', task: TASK });
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0][1]).toEqual({ task: TASK, teamId: 'chief-of-staff' });
    expect(approve).toHaveBeenCalledTimes(1);
    expect(approve.mock.calls[0][0]).toMatchObject({ collaborationRunId: runId, decidedBy: OWNER_ID });
  });

  it('acceptance 2: a chat Chief of Staff start stores the same run and hand-off as the page for the same owner and body', async () => {
    const pageRunId = await pageStartAndApprove({ team: 'chief-of-staff', task: TASK });
    const chat = chatRuns();
    const reply = await chat.service.ask(link, { text: `  ${TASK}  ` });
    expect(reply.text).toContain('Started');
    const chatRunId = chat.deliveries[0].collaborationRunId as string;
    expect(chatRunId).not.toBe(pageRunId);

    expect(storedRun(fakes.runs.get(chatRunId)!)).toEqual(storedRun(fakes.runs.get(pageRunId)!));
    const pageHandoff = storedHandoff(firstHandoffOf(pageRunId));
    const chatHandoff = storedHandoff(firstHandoffOf(chatRunId));
    expect(chatHandoff).toEqual(pageHandoff);
    // Both approved by the owner, on the business session, with the session guard's key id.
    const job = chatHandoff.pendingJob as Record<string, unknown>;
    expect(chatHandoff.status).toBe(firstHandoffOf(pageRunId).status);
    expect(job.decidedBy).toBe(OWNER_ID);
    expect(job.sessionId).toBe(BUSINESS_SESSION_ID);
    expect(job.apiKeyId).toBe('browser-session');
    expect(job.prompt).toBe(TASK);
    expect(sessionReads).not.toHaveBeenCalled();
  });

  it('acceptance 2: a chat start of a named workflow stores the same run and hand-off as the page', async () => {
    const pageRunId = await pageStartAndApprove({ workflowId: WORKFLOW_ID, task: TASK });
    const chat = chatRuns();
    await chat.service.ask(link, { text: TASK, agent: 'sales digest' });
    const chatRunId = chat.deliveries[0].collaborationRunId as string;
    expect(storedRun(fakes.runs.get(chatRunId)!)).toEqual(storedRun(fakes.runs.get(pageRunId)!));
    expect(storedHandoff(firstHandoffOf(chatRunId))).toEqual(storedHandoff(firstHandoffOf(pageRunId)));

    // A leading @name is read the same way.
    const again = chatRuns();
    await again.service.ask(link, { text: `@Sales Digest ${TASK}` });
    const atRunId = again.deliveries[0].collaborationRunId as string;
    expect(storedHandoff(firstHandoffOf(atRunId))).toEqual(storedHandoff(firstHandoffOf(pageRunId)));
  });

  it('acceptance 3: a chat start never carries a sessionId', async () => {
    const parse = jest.spyOn(starts, 'readStartBody');
    const start = jest.spyOn(starts, 'start');
    const chat = chatRuns();
    await chat.service.ask(link, { text: TASK });
    await chat.service.ask(link, { text: TASK, agent: 'Sales Digest' });
    for (const [body] of parse.mock.calls) {
      expect(body).not.toHaveProperty('sessionId');
    }
    for (const [, input] of start.mock.calls) {
      expect(input).not.toHaveProperty('sessionId');
    }
    expect(sessionReads).not.toHaveBeenCalled();
    for (const delivery of chat.deliveries) {
      const job = firstHandoffOf(delivery.collaborationRunId as string).pendingJob as unknown as Record<string, unknown>;
      expect(job.sessionId).toBe(BUSINESS_SESSION_ID);
      expect(job.projectInstructions).toBeDefined();
    }
  });

  it('approveStep is the page approve: owner as decidedBy, tests gate enforced', async () => {
    const spy = jest.spyOn(orchestration, 'approveReferral');
    const started = await starts.start(
      { userId: OWNER_ID, apiKeyId: 'browser-session', scopes: ['ai:execute'], isInternal: true, harnessEntitled: true },
      starts.readStartBody({ team: 'chief-of-staff', task: TASK }),
    );
    await starts.approveStep({
      collaborationRunId: started.collaborationRunId,
      referralId: started.referralId,
      decidedBy: OWNER_ID,
      approveWithoutPassingTests: false,
    });
    expect(spy).toHaveBeenCalledWith({
      collaborationRunId: started.collaborationRunId,
      referralId: started.referralId,
      decidedBy: OWNER_ID,
      enforceTestsGate: true,
      approveWithoutPassingTests: false,
    });
  });

  it('cancelOwnedActiveRun cancels only the owner’s active run, with the page’s omitted reason', async () => {
    const identity = { userId: OWNER_ID, apiKeyId: 'browser-session', scopes: ['ai:execute'], harnessEntitled: true };
    const started = await starts.start(identity, starts.readStartBody({ team: 'chief-of-staff', task: TASK }));
    expect(await starts.cancelOwnedActiveRun(started.collaborationRunId, OTHER_ID)).toBeNull();
    expect(await starts.cancelOwnedActiveRun('collab-missing', OWNER_ID)).toBeNull();
    expect(fakes.runs.get(started.collaborationRunId)!.status).toBe('active');
    const cancelled = await starts.cancelOwnedActiveRun(started.collaborationRunId, OWNER_ID);
    expect(cancelled?.status).toBe('cancelled');
    expect(fakes.runs.get(started.collaborationRunId)!.cancelReason).toBe(COLLABORATION_OMITTED_CANCEL_REASON);
    expect(await starts.cancelOwnedActiveRun(started.collaborationRunId, OWNER_ID)).toBeNull();
  });

  it('readStartBody is the page parser (trim, required, 8000 characters, coding needs a session)', () => {
    expect(starts.readStartBody({ team: 'chief-of-staff', task: '  x  ' })).toEqual({ task: 'x', teamId: 'chief-of-staff' });
    expect(() => starts.readStartBody({ team: 'chief-of-staff', task: '   ' })).toThrow('task is required');
    expect(() => starts.readStartBody({ team: 'chief-of-staff', task: 'x'.repeat(8001) })).toThrow(/at most 8000/);
    expect(() => starts.readStartBody({ team: 'coding', task: 'x' })).toThrow('sessionId must be a valid UUID');
  });

  it('keeps the controller error mapping', () => {
    expect(collaborationHttpException(new Error('Run x not found')).getStatus()).toBe(404);
    expect(collaborationHttpException(new Error('target is read-only')).getStatus()).toBe(400);
    expect(collaborationHttpException(new Error('boom')).getStatus()).toBe(500);
  });

  it('OrchestrationModule provides and exports the service', () => {
    expect(Reflect.getMetadata('providers', OrchestrationModule)).toContain(CollaborationStartService);
    expect(Reflect.getMetadata('exports', OrchestrationModule)).toEqual([
      OrchestrationService,
      CollaborationStartService,
    ]);
  });

  describe('chat refusals through the existing checks (acceptance 4)', () => {
    async function refusedAsk(options: { text: string; agent?: string }, locale: 'en' | 'zh-TW' = 'en') {
      const chat = chatRuns();
      const runsBefore = new Set(fakes.runs.keys());
      const reply = await chat.service.ask({ ...link, locale }, options);
      const created = [...fakes.runs.keys()].filter((id) => !runsBefore.has(id));
      return { chat, reply, created };
    }

    function expectCancelledAndDropped(result: Awaited<ReturnType<typeof refusedAsk>>, reason: string): void {
      expect(result.created).toHaveLength(1);
      const run = fakes.runs.get(result.created[0])!;
      expect(run.status).toBe('cancelled');
      expect(run.cancelReason).toBe(`chat_refused:${reason}`);
      expect(fakes.referrals.get(run.referralIds[0])!.status).toBe('cancelled');
      expect(result.chat.deliveries).toEqual([
        expect.objectContaining({ collaborationRunId: result.created[0], status: 'dropped' }),
      ]);
      const refused = result.chat.audit as Array<{ eventType: string; payload: Record<string, unknown> }>;
      expect(refused.map((row) => row.eventType)).toEqual(['run_refused']);
      expect(refused[0].payload).toEqual({
        channel: 'discord',
        linkId: LINK_ID,
        reason,
        stage: 'approve',
        collaborationRunId: result.created[0],
      });
      expect(JSON.stringify(refused)).not.toContain(TASK);
    }

    it('provider switched off: the approve check refuses, the run is cancelled', async () => {
      jest.spyOn(KillSwitchConfig, 'isProviderEnabled').mockReturnValue(false);
      const result = await refusedAsk({ text: TASK });
      expect(result.reply).toEqual({ text: chatReply('en', 'ask.providerOff') });
      expectCancelledAndDropped(result, 'provider_off');
    });

    it('no credits: the credit guard refuses (402), the run is cancelled, the reply is translated', async () => {
      creditBalance = 0;
      const result = await refusedAsk({ text: TASK }, 'zh-TW');
      expect(result.reply).toEqual({ text: chatReply('zh-TW', 'ask.noCredits') });
      expectCancelledAndDropped(result, 'no_credits');
    });

    it('over the daily credit cap: the safety guard refuses (429), the run is cancelled', async () => {
      capCheck.mockRejectedValue(
        new HttpException(
          { statusCode: 429, message: 'Daily credit limit reached', error: 'Too Many Requests', cap: 'user' },
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );
      const result = await refusedAsk({ text: TASK });
      expect(result.reply).toEqual({ text: chatReply('en', 'ask.overCap') });
      expectCancelledAndDropped(result, 'over_cap');
      expect(capCheck).toHaveBeenCalledWith(OWNER_ID);
    });

    it('over the token quota: the quota guard refuses (429), the run is cancelled', async () => {
      tokensUsed = 10_000_000_000;
      const result = await refusedAsk({ text: TASK });
      expect(result.reply).toEqual({ text: chatReply('en', 'ask.overCap') });
      expectCancelledAndDropped(result, 'over_cap');
    });

    it('a switched-off workflow is refused before any run exists', async () => {
      prepareStart.mockRejectedValueOnce(workflowRefusal(WORKFLOW_REFUSAL_CODES.disabled));
      const result = await refusedAsk({ text: TASK, agent: 'Sales Digest' });
      expect(result.reply).toEqual({ text: chatReply('en', 'ask.workflowOff') });
      expect(result.created).toEqual([]);
      expect(result.chat.deliveries).toEqual([]);
      expect((result.chat.audit[0] as { payload: unknown }).payload).toEqual({
        channel: 'discord',
        linkId: LINK_ID,
        reason: 'workflow_off',
        stage: 'start',
      });
    });

    it('runs switched off: refused before anything is created', async () => {
      process.env.GLOBAL_EXECUTION_ENABLED = 'false';
      const result = await refusedAsk({ text: TASK });
      expect(result.reply).toEqual({ text: chatReply('en', 'ask.runsOff') });
      expect(result.created).toEqual([]);
      expect(result.chat.deliveries).toEqual([]);
    });
  });
});
