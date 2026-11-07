import {
  ExecutionContext,
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
import { systemAgentVersion } from '../system-agents/system-agent-registry';
import { UsageLedgerService } from '../usage-ledger/usage-ledger.service';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import { ConversationService } from '../conversations/conversation.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { SessionService } from '../sessions/session.service';
import {
  COLLABORATION_OMITTED_CANCEL_REASON,
  CollaborationController,
} from './collaboration.controller';
import { COLLABORATION_TEAM } from './collaboration-team';
import { CollaborationReferralEntity } from './collaboration-referral.entity';
import { CollaborationRunEntity } from './collaboration-run.entity';
import { OrchestrationService } from './orchestration.service';
import {
  TESTS_NOT_PASSED_CODE,
  TESTS_NOT_PASSED_MESSAGES,
} from './collaboration-tests-gate';
import {
  WORK_DIFF_PROMPT_HEADING,
  WORK_DIFF_PROMPT_UNAVAILABLE,
} from './collaboration-work-diff';

const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_SESSION_ID = '22222222-2222-4222-8222-222222222222';
const PROJECT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CONVERSATION_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const TASK = 'PROMPT_SHOULD_NOT_LEAK';
const HARNESS_SECRET = 'collaboration-screen-test-secret';

type FakeSession = {
  id: string;
  userId: string;
  projectId: string | null;
  status: 'active' | 'pending' | 'stopped' | 'expired' | 'error';
  terminatedAt: Date | null;
  expiresAt: Date;
};

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
    const repo: {
      findOne: (opts: { where: Record<string, unknown> }) => Promise<T | null>;
      find: (opts?: { where?: Record<string, unknown> }) => Promise<T[]>;
      save: (entity: T) => Promise<T>;
      update: (
        criteria: Record<string, unknown>,
        partial: Record<string, unknown>,
      ) => Promise<{ affected: number; raw: unknown[]; generatedMaps: unknown[] }>;
      manager: {
        transaction: <R>(cb: (em: unknown) => Promise<R>) => Promise<R>;
        getRepository: (entity: unknown) => unknown;
      };
    } = {
      findOne: async ({ where }) => {
        for (const row of store.values()) {
          if (matchesWhere(row, where)) {
            return cloneRow(row);
          }
        }
        return null;
      },
      find: async (opts = {}) =>
        [...store.values()]
          .filter((row) => matchesWhere(row, opts.where))
          .map((row) => cloneRow(row)),
      save: async (entity) => {
        const copy = cloneRow(entity);
        store.set(String((copy as Record<string, unknown>)[pk]), copy);
        return cloneRow(copy);
      },
      update: async (criteria, partial) => {
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
      manager: {
        transaction: async <R>(cb: (em: unknown) => Promise<R>) => cb(undefined),
        getRepository: () => undefined,
      },
    };
    return repo;
  };

  const runRepo = createRepo(runs, 'collaborationRunId');
  const referralRepo = createRepo(referrals, 'referralId');
  const manager = {
    transaction: async <R>(cb: (em: typeof manager) => Promise<R>) => cb(manager),
    getRepository: (entity: unknown) => {
      if (entity === CollaborationRunEntity) {
        return runRepo;
      }
      if (entity === CollaborationReferralEntity) {
        return referralRepo;
      }
      throw new Error('Unknown orchestration entity');
    },
  };
  runRepo.manager = manager;
  referralRepo.manager = manager;
  return { runRepo, referralRepo, runs, referrals };
}

function usableSession(overrides: Partial<FakeSession> = {}): FakeSession {
  return {
    id: SESSION_ID,
    userId: OWNER_ID,
    projectId: PROJECT_ID,
    status: 'active',
    terminatedAt: null,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    ...overrides,
  };
}

describe('CollaborationController login routes', () => {
  const originalGlobal = process.env.GLOBAL_EXECUTION_ENABLED;
  const originalProvider = process.env.AI_PROVIDER;
  const originalAbort = process.env.ABORT_MODE;
  const originalSecret = process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;

  let app: INestApplication;
  let queue: { enqueueExecution: jest.Mock };
  let ledger: { writeExecutionIntent: jest.Mock };
  let executionResults: { requestCancel: jest.Mock; getExecution: jest.Mock };
  let runs: Map<string, CollaborationRunEntity>;
  let referrals: Map<string, CollaborationReferralEntity>;
  let sessions: Map<string, FakeSession>;
  let conversations: Map<string, { id: string; sessionId: string }>;
  let sessionReads: jest.Mock;
  let findActiveOwnedByIds: jest.Mock;
  let workTree: { getWorkingTreeDiff: jest.Mock };

  beforeEach(async () => {
    process.env.GLOBAL_EXECUTION_ENABLED = 'true';
    process.env.AI_PROVIDER = 'stub';
    process.env.ABORT_MODE = 'NONE';
    process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = HARNESS_SECRET;
    AbortConfig.initialize();

    const fakes = createOrchestrationRepoFakes();
    runs = fakes.runs;
    referrals = fakes.referrals;
    sessions = new Map<string, FakeSession>([[SESSION_ID, usableSession()]]);
    conversations = new Map([
      [SESSION_ID, { id: CONVERSATION_ID, sessionId: SESSION_ID }],
    ]);
    queue = { enqueueExecution: jest.fn().mockResolvedValue(undefined) };
    ledger = { writeExecutionIntent: jest.fn().mockResolvedValue(undefined) };
    executionResults = {
      requestCancel: jest.fn().mockResolvedValue(true),
      getExecution: jest.fn().mockResolvedValue(null),
    };
    workTree = {
      getWorkingTreeDiff: jest.fn().mockResolvedValue({
        commitHash: 'abc123abc123abc123abc123abc123abc123abcd',
        diff: '',
        truncated: false,
      }),
    };
    findActiveOwnedByIds = jest.fn(async () => []);
    sessionReads = jest.fn(async (sessionId: string) => {
      const session = sessions.get(sessionId);
      if (!session) {
        throw new NotFoundException(`Session with ID ${sessionId} not found`);
      }
      return session;
    });
    const creditGuard = new CreditBalanceGuard(
      { findByOwner: async () => ({ balance: 25 }) } as never,
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
          if (sql.includes('SUM(tokens_used)')) {
            return [{ total: 0 }];
          }
          if (sql.includes('ORDER BY timestamp')) {
            return [{ timestamp: new Date() }];
          }
          return [];
        },
      }),
    } as never);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollaborationController],
      providers: [
        OrchestrationService,
        ExecutionSafetyGuard,
        GlobalSafetyLimitService,
        AbortGuard,
        { provide: CreditBalanceGuard, useValue: creditGuard },
        { provide: TokenQuotaGuard, useValue: tokenGuard },
        { provide: getRepositoryToken(CollaborationRunEntity), useValue: fakes.runRepo },
        {
          provide: getRepositoryToken(CollaborationReferralEntity),
          useValue: fakes.referralRepo,
        },
        { provide: QueueService, useValue: queue },
        { provide: ExecutionResultService, useValue: executionResults },
        { provide: ContainerManagerHttpClient, useValue: workTree },
        { provide: UsageLedgerService, useValue: ledger },
        { provide: SessionService, useValue: { getSessionById: sessionReads } },
        { provide: KnowledgeService, useValue: { findActiveOwnedByIds } },
        {
          provide: ConversationService,
          useValue: {
            getConversationBySession: async (sessionId: string) =>
              conversations.get(sessionId) ?? null,
            getOrCreateConversation: async (sessionId: string) => {
              const existing = conversations.get(sessionId);
              if (existing) {
                return existing;
              }
              const created = {
                id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
                sessionId,
              };
              conversations.set(sessionId, created);
              return created;
            },
          },
        },
      ],
    })
      .overrideGuard(SessionOrApiKeyAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          const headerUser = req.header('x-test-user');
          const entitled = req.header('x-test-entitled');
          req.apiKeyIdentity = {
            userId: headerUser || OWNER_ID,
            apiKeyId: 'browser-session',
            scopes: ['ai:execute'],
            harnessEntitled: entitled === '0' ? false : true,
          };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    restoreEnv('GLOBAL_EXECUTION_ENABLED', originalGlobal);
    restoreEnv('AI_PROVIDER', originalProvider);
    restoreEnv('ABORT_MODE', originalAbort);
    restoreEnv('HARNESS_ENTITLEMENT_HMAC_SECRET', originalSecret);
  });

  function http(userId = OWNER_ID, entitled = true) {
    const req = request(app.getHttpServer());
    return {
      post: (path: string) =>
        req.post(path).set('x-test-user', userId).set('x-test-entitled', entitled ? '1' : '0'),
      get: (path: string) =>
        req.get(path).set('x-test-user', userId).set('x-test-entitled', entitled ? '1' : '0'),
    };
  }

  function startBody(overrides: Record<string, unknown> = {}) {
    return {
      sessionId: SESSION_ID,
      task: TASK,
      provider: 'openai',
      model: 'gpt-4o',
      decidedBy: 'someone-else',
      agents: [{ name: 'hacker', instructions: 'pwn' }],
      fileAccess: false,
      ...overrides,
    };
  }

  async function startRun() {
    const response = await http().post('/api/collaboration/runs').send(startBody()).expect(201);
    return response.body as {
      collaborationRunId: string;
      referralId: string;
      projectId: string;
      handoffStatus: string;
      conversationCreated: boolean;
      conversationId: string;
    };
  }

  it('refuses a caller who is not harness entitled on every route', async () => {
    const started = await startRun();
    const readsAfterStart = sessionReads.mock.calls.length;
    const denied = http(OWNER_ID, false);

    await denied.post('/api/collaboration/runs').send(startBody()).expect(403);
    expect(sessionReads.mock.calls.length).toBe(readsAfterStart);
    await denied.get(`/api/collaboration/runs?projectId=${PROJECT_ID}`).expect(403);
    await denied.get(`/api/collaboration/runs/${started.collaborationRunId}`).expect(403);
    await denied
      .post(
        `/api/collaboration/runs/${started.collaborationRunId}/referrals/${started.referralId}/approve`,
      )
      .send({ decidedBy: OTHER_ID })
      .expect(403);
    await denied
      .post(
        `/api/collaboration/runs/${started.collaborationRunId}/referrals/${started.referralId}/reject`,
      )
      .send({ decidedBy: OTHER_ID, reason: 'no' })
      .expect(403);
    await denied
      .post(`/api/collaboration/runs/${started.collaborationRunId}/cancel`)
      .send({ reason: 'no' })
      .expect(403);

    expect(referrals.get(started.referralId)?.status).toBe('pending_approval');
    expect(runs.get(started.collaborationRunId)?.status).toBe('active');
    expect(queue.enqueueExecution).not.toHaveBeenCalled();
    expect(runs.size).toBe(1);
  });

  it('refuses another user session and does not create a run', async () => {
    sessions.set(
      OTHER_SESSION_ID,
      usableSession({ id: OTHER_SESSION_ID, userId: OTHER_ID }),
    );

    const response = await http()
      .post('/api/collaboration/runs')
      .send(startBody({ sessionId: OTHER_SESSION_ID }))
      .expect(404);

    expect(response.body.message).toContain('not found');
    expect(runs.size).toBe(0);
    expect(referrals.size).toBe(0);
  });

  it('refuses a session that is missing', async () => {
    await http()
      .post('/api/collaboration/runs')
      .send(startBody({ sessionId: '99999999-9999-4999-8999-999999999999' }))
      .expect(404);
    expect(runs.size).toBe(0);
  });

  it('refuses a session the caller owns when it is not usable', async () => {
    sessions.set(SESSION_ID, usableSession({ terminatedAt: new Date() }));

    await http().post('/api/collaboration/runs').send(startBody()).expect(409);
    expect(runs.size).toBe(0);
  });

  it('creates a waiting hand-off with the server team, provider and model', async () => {
    const started = await startRun();
    const stored = referrals.get(started.referralId);

    expect(started.handoffStatus).toBe('pending_approval');
    expect(started.projectId).toBe(PROJECT_ID);
    expect(started.conversationId).toBe(CONVERSATION_ID);
    expect(started.conversationCreated).toBe(false);
    expect(stored?.status).toBe('pending_approval');
    expect(stored?.sourceBuilderProfileId).toBe('user');
    expect(stored?.targetBuilderProfileId).toBe('lead');
    expect(stored?.pendingJob?.provider).toBe('stub');
    expect(stored?.pendingJob?.model).toBe('stub');
    expect(stored?.pendingJob?.adapter).toBe('stub');
    expect(stored?.pendingJob?.fileAccess).toBe(true);
    expect(stored?.pendingJob?.agents).toEqual(COLLABORATION_TEAM.map((agent) => ({ ...agent })));
    expect(stored?.pendingJob?.prompt).toBe(TASK);
    expect(queue.enqueueExecution).not.toHaveBeenCalled();
    expect(JSON.stringify(started)).not.toContain('gpt-4o');
    expect(JSON.stringify(started)).not.toContain('openai');
    expect(JSON.stringify(started)).not.toContain('cannot change files');
  });

  it('creates a conversation when the session does not have one', async () => {
    conversations.delete(SESSION_ID);

    const started = await startRun();

    expect(started.conversationCreated).toBe(true);
    expect(started.conversationId).toBe('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
    expect(referrals.get(started.referralId)?.pendingJob?.conversationId).toBe(
      started.conversationId,
    );
  });

  it('returns 404 for another user on get, approve, reject and cancel', async () => {
    const started = await startRun();
    const other = http(OTHER_ID);

    await other.get(`/api/collaboration/runs/${started.collaborationRunId}`).expect(404);
    await other
      .post(
        `/api/collaboration/runs/${started.collaborationRunId}/referrals/${started.referralId}/approve`,
      )
      .send({ decidedBy: OTHER_ID })
      .expect(404);
    await other
      .post(
        `/api/collaboration/runs/${started.collaborationRunId}/referrals/${started.referralId}/reject`,
      )
      .send({ decidedBy: OTHER_ID, reason: 'no' })
      .expect(404);
    await other
      .post(`/api/collaboration/runs/${started.collaborationRunId}/cancel`)
      .send({ reason: 'no' })
      .expect(404);

    expect(referrals.get(started.referralId)?.status).toBe('pending_approval');
    expect(runs.get(started.collaborationRunId)?.status).toBe('active');
    expect(queue.enqueueExecution).not.toHaveBeenCalled();
  });

  it('cancels an active run for the owner', async () => {
    const started = await startRun();
    const cancel = jest.spyOn(app.get(OrchestrationService), 'cancelCollaboration');

    const response = await http()
      .post(`/api/collaboration/runs/${started.collaborationRunId}/cancel`)
      .send({ reason: 'stopping the wait' })
      .expect(200);

    expect(cancel).toHaveBeenCalledWith({
      collaborationRunId: started.collaborationRunId,
      cancelledByUserId: OWNER_ID,
      cancelReason: 'stopping the wait',
    });
    expect(response.body).toEqual({
      collaborationRunId: started.collaborationRunId,
      status: 'cancelled',
    });
    expect(runs.get(started.collaborationRunId)?.status).toBe('cancelled');
    expect(referrals.get(started.referralId)?.status).toBe('cancelled');
  });

  it('uses the default cancel reason when the body omits one', async () => {
    const started = await startRun();
    const cancel = jest.spyOn(app.get(OrchestrationService), 'cancelCollaboration');

    const response = await http()
      .post(`/api/collaboration/runs/${started.collaborationRunId}/cancel`)
      .send({})
      .expect(200);

    expect(cancel).toHaveBeenCalledWith({
      collaborationRunId: started.collaborationRunId,
      cancelledByUserId: OWNER_ID,
      cancelReason: COLLABORATION_OMITTED_CANCEL_REASON,
    });
    expect(response.body.status).toBe('cancelled');
    expect(runs.get(started.collaborationRunId)?.cancelReason).toBe(
      COLLABORATION_OMITTED_CANCEL_REASON,
    );
  });

  it('returns 409 when the run is not active and does not call cancel', async () => {
    const started = await startRun();
    const stored = runs.get(started.collaborationRunId);
    expect(stored).toBeDefined();
    stored!.status = 'completed';
    const cancel = jest.spyOn(app.get(OrchestrationService), 'cancelCollaboration');

    await http()
      .post(`/api/collaboration/runs/${started.collaborationRunId}/cancel`)
      .send({ reason: 'too late' })
      .expect(409);

    expect(cancel).not.toHaveBeenCalled();
    expect(runs.get(started.collaborationRunId)?.status).toBe('completed');
    expect(referrals.get(started.referralId)?.status).toBe('pending_approval');
  });

  it('returns 404 when another user cancels and does not call cancel', async () => {
    const started = await startRun();
    const cancel = jest.spyOn(app.get(OrchestrationService), 'cancelCollaboration');

    await http(OTHER_ID)
      .post(`/api/collaboration/runs/${started.collaborationRunId}/cancel`)
      .send({ reason: 'no' })
      .expect(404);

    expect(cancel).not.toHaveBeenCalled();
    expect(runs.get(started.collaborationRunId)?.status).toBe('active');
    expect(referrals.get(started.referralId)?.status).toBe('pending_approval');
  });

  it('refuses an unentitled caller on cancel the same way as reject', async () => {
    const started = await startRun();
    const cancel = jest.spyOn(app.get(OrchestrationService), 'cancelCollaboration');

    await http(OWNER_ID, false)
      .post(`/api/collaboration/runs/${started.collaborationRunId}/cancel`)
      .send({ reason: 'no' })
      .expect(403);

    expect(cancel).not.toHaveBeenCalled();
    expect(runs.get(started.collaborationRunId)?.status).toBe('active');
    expect(referrals.get(started.referralId)?.status).toBe('pending_approval');
  });

  it('lists the caller runs newest first without prompts or answers', async () => {
    const older = await startRun();
    const newer = await startRun();
    runs.get(older.collaborationRunId)!.createdAt = new Date('2020-01-01T00:00:00.000Z');
    runs.get(newer.collaborationRunId)!.createdAt = new Date('2026-01-01T00:00:00.000Z');

    const list = await http().get(`/api/collaboration/runs?projectId=${PROJECT_ID}`).expect(200);
    const foreign = await http(OTHER_ID)
      .get(`/api/collaboration/runs?projectId=${PROJECT_ID}`)
      .expect(200);

    expect(list.body.runs.map((run: { collaborationRunId: string }) => run.collaborationRunId)).toEqual([
      newer.collaborationRunId,
      older.collaborationRunId,
    ]);
    expect(Object.keys(list.body.runs[0]).sort()).toEqual([
      'collaborationRunId',
      'createdAt',
      'projectId',
      'status',
      'teamId',
      'updatedAt',
    ]);
    expect(list.body.runs[0].teamId).toBe('coding');
    expect(list.body.runs[1].teamId).toBe('coding');
    expect(JSON.stringify(list.body)).not.toContain(TASK);
    expect(JSON.stringify(list.body)).not.toContain('prompt');
    expect(JSON.stringify(list.body)).not.toContain('answer');
    expect(foreign.body.runs).toEqual([]);
  });

  it('sets decidedBy from the caller and ignores the body', async () => {
    const started = await startRun();

    const approved = await http()
      .post(
        `/api/collaboration/runs/${started.collaborationRunId}/referrals/${started.referralId}/approve`,
      )
      .send({ decidedBy: 'someone-else', reason: 'ignore me', provider: 'openai', model: 'gpt-4o' })
      .expect(200);

    expect(approved.body.decidedBy).toBe(OWNER_ID);
    expect(referrals.get(started.referralId)?.pendingJob?.decidedBy).toBe(OWNER_ID);
    expect(referrals.get(started.referralId)?.pendingJob?.provider).toBe('stub');

    const second = await startRun();
    const rejected = await http()
      .post(
        `/api/collaboration/runs/${second.collaborationRunId}/referrals/${second.referralId}/reject`,
      )
      .send({ decidedBy: 'someone-else', reason: 'too broad' })
      .expect(200);

    expect(rejected.body.decidedBy).toBe(OWNER_ID);
    expect(rejected.body.rejectReason).toBe('too broad');
    expect(referrals.get(second.referralId)?.pendingJob?.decidedBy).toBe(OWNER_ID);
    expect(referrals.get(second.referralId)?.cancelReason).toBe('too broad');

    const third = await startRun();
    const omitted = await http()
      .post(
        `/api/collaboration/runs/${third.collaborationRunId}/referrals/${third.referralId}/reject`,
      )
      .send({})
      .expect(200);

    expect(omitted.body.decidedBy).toBe(OWNER_ID);
    expect(omitted.body.rejectReason).toBeNull();
    expect(referrals.get(third.referralId)?.cancelReason).toBe('omitted');
  });

  it('shows the stored execution failure reason on the hand-off', async () => {
    const started = await startRun();
    await http()
      .post(
        `/api/collaboration/runs/${started.collaborationRunId}/referrals/${started.referralId}/approve`,
      )
      .send({})
      .expect(200);

    executionResults.getExecution.mockResolvedValue({
      execution_status: 'failed',
      metadata: {
        executionError: { message: 'The provider declined the request' },
      },
    });

    const detail = await http()
      .get(`/api/collaboration/runs/${started.collaborationRunId}`)
      .expect(200);

    expect(detail.body.handoffs[0].status).toBe('failed');
    expect(detail.body.handoffs[0].failureReason).toBe('The provider declined the request');
    expect(detail.body.handoffs[0].answer).toBeNull();
    expect(JSON.stringify(detail.body)).not.toContain('Execution failed');
    expect(detail.body.team).toEqual(['lead', 'writer', 'reviewer']);
    expect(detail.body.teamId).toBe('coding');
  });

  it('shows whether a step can change files, then the paths, save point and tests', async () => {
    const started = await startRun();
    const waiting = await http()
      .get(`/api/collaboration/runs/${started.collaborationRunId}`)
      .expect(200);
    expect(waiting.body.handoffs[0]).toMatchObject({
      target: 'lead',
      status: 'pending_approval',
      canChangeFiles: false,
      changedPaths: [],
      savePoint: null,
      tests: [],
    });

    await http()
      .post(
        `/api/collaboration/runs/${started.collaborationRunId}/referrals/${started.referralId}/approve`,
      )
      .send({})
      .expect(200);
    const leadPayload = queue.enqueueExecution.mock.calls[0][0] as Record<string, unknown>;
    expect(leadPayload.harnessToolProfile).toBe('read');
    expect(leadPayload.harnessReadOnly).toBe(true);
    const leadExecutionId = referrals.get(started.referralId)?.executionId;
    expect(leadExecutionId).toEqual(expect.any(String));

    executionResults.getExecution.mockImplementation(async (executionId: string) => {
      if (executionId === leadExecutionId) {
        return {
          execution_status: 'completed',
          metadata: {
            aiExecutionResult: {
              output: 'Ready.\n<handoff to="writer">Fix the form.</handoff>',
            },
          },
        };
      }
      const writer = [...referrals.values()].find(
        (referral) =>
          referral.executionId === executionId &&
          referral.targetBuilderProfileId === 'writer',
      );
      if (writer) {
        return {
          execution_status: 'completed',
          metadata: {
            aiExecutionResult: { output: 'Updated the form.' },
            harnessChangedPaths: ['src/form.ts', '', 4],
            preApplyCheckpointHash: 'abc123save',
            harnessValidationRuns: [
              { command: 'npm test', passed: true },
              { command: 'npm run build', passed: false },
              { command: 5, passed: true },
            ],
          },
        };
      }
      return null;
    });

    const afterLead = await http()
      .get(`/api/collaboration/runs/${started.collaborationRunId}`)
      .expect(200);
    const writerHandoff = afterLead.body.handoffs.find(
      (handoff: { target: string }) => handoff.target === 'writer',
    );
    expect(writerHandoff.status).toBe('pending_approval');
    expect(writerHandoff.canChangeFiles).toBe(true);
    expect(writerHandoff.changedPaths).toEqual([]);
    expect(writerHandoff.savePoint).toBeNull();
    expect(afterLead.body.handoffs[0].target).toBe('lead');
    expect(afterLead.body.handoffs[0].changedPaths).toEqual([]);

    await http()
      .post(
        `/api/collaboration/runs/${started.collaborationRunId}/referrals/${writerHandoff.referralId}/approve`,
      )
      .send({ harnessToolProfile: 'read' })
      .expect(200);
    const writerPayload = queue.enqueueExecution.mock.calls.at(-1)?.[0] as Record<
      string,
      unknown
    >;
    expect(writerPayload.harnessToolProfile).toBe('write');
    expect(writerPayload).not.toHaveProperty('harnessReadOnly');
    expect(writerPayload.builderProfileId).toBe('writer');

    const finished = await http()
      .get(`/api/collaboration/runs/${started.collaborationRunId}`)
      .expect(200);
    const doneWriter = finished.body.handoffs.find(
      (handoff: { referralId: string }) => handoff.referralId === writerHandoff.referralId,
    );
    expect(doneWriter.status).toBe('completed');
    expect(doneWriter.answer).toBe('Updated the form.');
    expect(doneWriter.canChangeFiles).toBe(true);
    expect(doneWriter.changedPaths).toEqual(['src/form.ts']);
    expect(doneWriter.savePoint).toBe('abc123save');
    expect(doneWriter.tests).toEqual([
      { command: 'npm test', passed: true },
      { command: 'npm run build', passed: false },
    ]);
    const doneLead = finished.body.handoffs.find(
      (handoff: { referralId: string }) => handoff.referralId === started.referralId,
    );
    expect(doneLead.canChangeFiles).toBe(false);
    expect(doneLead.changedPaths).toEqual([]);
  });

  it('puts the writer diff in the reviewer prompt and on GET runs/:id', async () => {
    const savePoint = 'abc123abc123abc123abc123abc123abc123abcd';
    const diff = 'diff --git a/src/form.ts b/src/form.ts\n+fixed\n[diff truncated]\n';
    workTree.getWorkingTreeDiff.mockResolvedValue({
      commitHash: savePoint,
      diff,
      truncated: true,
    });

    const started = await startRun();
    await http()
      .post(
        `/api/collaboration/runs/${started.collaborationRunId}/referrals/${started.referralId}/approve`,
      )
      .send({})
      .expect(200);
    const leadExecutionId = referrals.get(started.referralId)?.executionId;

    executionResults.getExecution.mockImplementation(async (executionId: string) => {
      if (executionId === leadExecutionId) {
        return {
          execution_status: 'completed',
          metadata: {
            aiExecutionResult: {
              output: 'Ready.\n<handoff to="writer">Fix the form.</handoff>',
            },
          },
        };
      }
      const writer = [...referrals.values()].find(
        (referral) =>
          referral.executionId === executionId && referral.targetBuilderProfileId === 'writer',
      );
      if (writer) {
        return {
          execution_status: 'completed',
          metadata: {
            aiExecutionResult: {
              output: 'Updated the form.\n<handoff to="reviewer">Look again.</handoff>',
            },
            preApplyCheckpointHash: savePoint,
          },
        };
      }
      return null;
    });

    const afterLead = await http()
      .get(`/api/collaboration/runs/${started.collaborationRunId}`)
      .expect(200);
    const writerHandoff = afterLead.body.handoffs.find(
      (handoff: { target: string }) => handoff.target === 'writer',
    );
    await http()
      .post(
        `/api/collaboration/runs/${started.collaborationRunId}/referrals/${writerHandoff.referralId}/approve`,
      )
      .send({})
      .expect(200);

    const finished = await http()
      .get(`/api/collaboration/runs/${started.collaborationRunId}`)
      .expect(200);
    const doneWriter = finished.body.handoffs.find(
      (handoff: { referralId: string }) => handoff.referralId === writerHandoff.referralId,
    );
    const reviewer = finished.body.handoffs.find(
      (handoff: { target: string }) => handoff.target === 'reviewer',
    );
    expect(doneWriter.status).toBe('completed');
    expect(doneWriter.diff).toBe(diff);
    expect(doneWriter.diffUnavailable).toBe(false);
    expect(reviewer.status).toBe('pending_approval');
    expect(reviewer.prompt.indexOf('Look again.')).toBeLessThan(
      reviewer.prompt.indexOf(WORK_DIFF_PROMPT_HEADING),
    );
    expect(reviewer.prompt).toContain(diff);
    expect(reviewer.prompt).toContain('[diff truncated]');
    expect(workTree.getWorkingTreeDiff).toHaveBeenCalledWith(SESSION_ID, savePoint);
    expect(finished.body.run.status).toBe('active');
  });

  it('leaves a note and does not fail when the writer diff cannot be fetched', async () => {
    workTree.getWorkingTreeDiff.mockRejectedValue(new Error('container down'));
    const started = await startRun();
    await http()
      .post(
        `/api/collaboration/runs/${started.collaborationRunId}/referrals/${started.referralId}/approve`,
      )
      .send({})
      .expect(200);
    const leadExecutionId = referrals.get(started.referralId)?.executionId;
    executionResults.getExecution.mockImplementation(async (executionId: string) => {
      if (executionId === leadExecutionId) {
        return {
          execution_status: 'completed',
          metadata: {
            aiExecutionResult: {
              output: 'Ready.\n<handoff to="writer">Fix the form.</handoff>',
            },
          },
        };
      }
      const writer = [...referrals.values()].find(
        (referral) =>
          referral.executionId === executionId && referral.targetBuilderProfileId === 'writer',
      );
      if (writer) {
        return {
          execution_status: 'completed',
          metadata: {
            aiExecutionResult: {
              output: 'Updated the form.\n<handoff to="reviewer">Look again.</handoff>',
            },
            preApplyCheckpointHash: 'abc123abc123abc123abc123abc123abc123abcd',
          },
        };
      }
      return null;
    });

    const afterLead = await http()
      .get(`/api/collaboration/runs/${started.collaborationRunId}`)
      .expect(200);
    const writerHandoff = afterLead.body.handoffs.find(
      (handoff: { target: string }) => handoff.target === 'writer',
    );
    const queued = queue.enqueueExecution.mock.calls.length;
    await http()
      .post(
        `/api/collaboration/runs/${started.collaborationRunId}/referrals/${writerHandoff.referralId}/approve`,
      )
      .send({})
      .expect(200);
    const finished = await http()
      .get(`/api/collaboration/runs/${started.collaborationRunId}`)
      .expect(200);
    const doneWriter = finished.body.handoffs.find(
      (handoff: { referralId: string }) => handoff.referralId === writerHandoff.referralId,
    );
    const reviewer = finished.body.handoffs.find(
      (handoff: { target: string }) => handoff.target === 'reviewer',
    );
    expect(finished.body.run.status).toBe('active');
    expect(doneWriter.status).toBe('completed');
    expect(doneWriter.diff).toBeNull();
    expect(doneWriter.diffUnavailable).toBe(true);
    expect(reviewer.status).toBe('pending_approval');
    expect(reviewer.prompt).toContain(WORK_DIFF_PROMPT_UNAVAILABLE);
    expect(reviewer.prompt.indexOf('Look again.')).toBeLessThan(
      reviewer.prompt.indexOf(WORK_DIFF_PROMPT_UNAVAILABLE),
    );
    expect(queue.enqueueExecution).toHaveBeenCalledTimes(queued + 1);
  });

  async function openReviewerHandoff(writerMetadata: Record<string, unknown>) {
    const started = await startRun();
    await http()
      .post(
        `/api/collaboration/runs/${started.collaborationRunId}/referrals/${started.referralId}/approve`,
      )
      .send({})
      .expect(200);
    const leadExecutionId = referrals.get(started.referralId)?.executionId;
    executionResults.getExecution.mockImplementation(async (executionId: string) => {
      if (executionId === leadExecutionId) {
        return {
          execution_status: 'completed',
          metadata: {
            aiExecutionResult: {
              output: 'Ready.\n<handoff to="writer">Fix the form.</handoff>',
            },
          },
        };
      }
      const writer = [...referrals.values()].find(
        (referral) =>
          referral.executionId === executionId && referral.targetBuilderProfileId === 'writer',
      );
      if (writer) {
        return {
          execution_status: 'completed',
          metadata: {
            aiExecutionResult: {
              output: 'Updated the form.\n<handoff to="reviewer">Look again.</handoff>',
            },
            ...writerMetadata,
          },
        };
      }
      return null;
    });

    const afterLead = await http()
      .get(`/api/collaboration/runs/${started.collaborationRunId}`)
      .expect(200);
    const writerHandoff = afterLead.body.handoffs.find(
      (handoff: { target: string }) => handoff.target === 'writer',
    );
    expect(writerHandoff.testsGate).toBe('not_required');
    expect(writerHandoff.testsBlockReason).toBeNull();
    await http()
      .post(
        `/api/collaboration/runs/${started.collaborationRunId}/referrals/${writerHandoff.referralId}/approve`,
      )
      .send({})
      .expect(200);

    const finished = await http()
      .get(`/api/collaboration/runs/${started.collaborationRunId}`)
      .expect(200);
    const reviewer = finished.body.handoffs.find(
      (handoff: { target: string }) => handoff.target === 'reviewer',
    );
    expect(reviewer).toMatchObject({
      source: 'writer',
      target: 'reviewer',
      status: 'pending_approval',
      tests: [],
    });
    return {
      runId: started.collaborationRunId as string,
      leadReferralId: started.referralId as string,
      writerReferralId: writerHandoff.referralId as string,
      reviewer,
      handoffs: finished.body.handoffs as Array<{
        referralId: string;
        source: string;
        target: string;
        testsGate: string;
        testsBlockReason: string | null;
        tests: unknown[];
      }>,
    };
  }

  function approvePath(runId: string, referralId: string): string {
    return `/api/collaboration/runs/${runId}/referrals/${referralId}/approve`;
  }

  it('refuses writer-to-reviewer approval when the latest validation run failed', async () => {
    const opened = await openReviewerHandoff({
      harnessChangedPaths: ['src/form.ts'],
      harnessValidationRuns: [
        { command: 'npm test', passed: true },
        { command: 'npm run build', passed: false },
      ],
    });
    expect(opened.reviewer.testsGate).toBe('blocked');
    expect(opened.reviewer.testsBlockReason).toBe('failed');
    const writerDone = opened.handoffs.find(
      (handoff) => handoff.referralId === opened.writerReferralId,
    );
    expect(writerDone?.testsGate).toBe('not_required');
    expect(writerDone?.tests).toEqual([
      { command: 'npm test', passed: true },
      { command: 'npm run build', passed: false },
    ]);

    const queued = queue.enqueueExecution.mock.calls.length;
    const refused = await http()
      .post(approvePath(opened.runId, opened.reviewer.referralId))
      .send({})
      .expect(409);
    expect(refused.body.code).toBe(TESTS_NOT_PASSED_CODE);
    expect(refused.body.testsBlockReason).toBe('failed');
    expect(refused.body.message).toBe(TESTS_NOT_PASSED_MESSAGES.failed);
    expect(referrals.get(opened.reviewer.referralId)?.status).toBe('pending_approval');
    expect(referrals.get(opened.reviewer.referralId)?.pendingJob?.decidedBy).toBeNull();
    expect(queue.enqueueExecution).toHaveBeenCalledTimes(queued);

    const ignoredFlag = await http()
      .post(approvePath(opened.runId, opened.reviewer.referralId))
      .send({ approveWithoutPassingTests: false, decidedBy: 'someone-else' })
      .expect(409);
    expect(ignoredFlag.body.code).toBe(TESTS_NOT_PASSED_CODE);
    expect(queue.enqueueExecution).toHaveBeenCalledTimes(queued);

    const approved = await http()
      .post(approvePath(opened.runId, opened.reviewer.referralId))
      .send({ approveWithoutPassingTests: true, decidedBy: 'someone-else' })
      .expect(200);
    expect(approved.body.decidedBy).toBe(OWNER_ID);
    expect(approved.body.testsGate).toBe('blocked');
    expect(approved.body.testsBlockReason).toBe('failed');
    expect(approved.body.status).not.toBe('pending_approval');
    expect(referrals.get(opened.reviewer.referralId)?.pendingJob?.decidedBy).toBe(OWNER_ID);
    expect(queue.enqueueExecution).toHaveBeenCalledTimes(queued + 1);
  });

  it('refuses writer-to-reviewer approval when the writer changed files and no tests ran', async () => {
    const opened = await openReviewerHandoff({
      harnessChangedPaths: ['src/form.ts', '', 4],
    });
    expect(opened.reviewer.testsGate).toBe('blocked');
    expect(opened.reviewer.testsBlockReason).toBe('none');

    const queued = queue.enqueueExecution.mock.calls.length;
    const refused = await http()
      .post(approvePath(opened.runId, opened.reviewer.referralId))
      .send({ approveWithoutPassingTests: 'true' })
      .expect(409);
    expect(refused.body.code).toBe(TESTS_NOT_PASSED_CODE);
    expect(refused.body.testsBlockReason).toBe('none');
    expect(refused.body.message).toBe(TESTS_NOT_PASSED_MESSAGES.none);
    expect(queue.enqueueExecution).toHaveBeenCalledTimes(queued);
    expect(referrals.get(opened.reviewer.referralId)?.status).toBe('pending_approval');

    await http()
      .post(approvePath(opened.runId, opened.reviewer.referralId))
      .send({ approveWithoutPassingTests: true })
      .expect(200);
    expect(queue.enqueueExecution).toHaveBeenCalledTimes(queued + 1);
  });

  it('approves a writer-to-reviewer hand-off when the latest run passed or no files changed', async () => {
    const passed = await openReviewerHandoff({
      harnessChangedPaths: ['src/form.ts'],
      harnessValidationRuns: [
        { command: 'npm test', passed: false },
        { command: 'npm test', passed: true },
      ],
    });
    expect(passed.reviewer.testsGate).toBe('passed');
    expect(passed.reviewer.testsBlockReason).toBeNull();
    const passedQueued = queue.enqueueExecution.mock.calls.length;
    const passedApprove = await http()
      .post(approvePath(passed.runId, passed.reviewer.referralId))
      .send({})
      .expect(200);
    expect(passedApprove.body.testsGate).toBe('passed');
    expect(queue.enqueueExecution).toHaveBeenCalledTimes(passedQueued + 1);

    const unchanged = await openReviewerHandoff({
      harnessValidationRuns: [{ command: 'npm test', passed: false }],
    });
    expect(unchanged.reviewer.testsGate).toBe('not_required');
    expect(unchanged.reviewer.testsBlockReason).toBeNull();
    const unchangedQueued = queue.enqueueExecution.mock.calls.length;
    await http()
      .post(approvePath(unchanged.runId, unchanged.reviewer.referralId))
      .send({})
      .expect(200);
    expect(queue.enqueueExecution).toHaveBeenCalledTimes(unchangedQueued + 1);
  });

  it('does not apply the tests gate to other hand-offs', async () => {
    const started = await startRun();
    const waiting = await http()
      .get(`/api/collaboration/runs/${started.collaborationRunId}`)
      .expect(200);
    expect(waiting.body.handoffs[0]).toMatchObject({
      source: 'user',
      target: 'lead',
      testsGate: 'not_required',
      testsBlockReason: null,
    });
    await http()
      .post(approvePath(started.collaborationRunId, started.referralId))
      .send({ approveWithoutPassingTests: false })
      .expect(200);

    const opened = await openReviewerHandoff({
      harnessChangedPaths: ['src/form.ts'],
      harnessValidationRuns: [{ command: 'npm test', passed: false }],
    });
    for (const handoff of opened.handoffs) {
      if (handoff.referralId === opened.reviewer.referralId) {
        expect(handoff.testsGate).toBe('blocked');
      } else {
        expect(handoff.testsGate).toBe('not_required');
      }
    }
    const leadAgain = await http()
      .post(approvePath(opened.runId, opened.leadReferralId))
      .send({})
      .expect(409);
    expect(leadAgain.body.code).toBeUndefined();
    expect(leadAgain.body.message).not.toBe(TESTS_NOT_PASSED_MESSAGES.failed);
    expect(leadAgain.body.message).not.toBe(TESTS_NOT_PASSED_MESSAGES.none);
    expect(referrals.get(opened.reviewer.referralId)?.status).toBe('pending_approval');
  });

  it('derives sources from the stored answer and drops foreign or invalid markers', async () => {
    const ownedId = '33333333-3333-4333-8333-333333333333';
    const foreignId = '44444444-4444-4444-8444-444444444444';
    const started = await startRun();
    const waiting = await http()
      .get(`/api/collaboration/runs/${started.collaborationRunId}`)
      .expect(200);
    expect(waiting.body.handoffs[0]).toMatchObject({
      status: 'pending_approval',
      sources: [],
      droppedSourceCount: 0,
      unsourced: false,
      showUnsourced: false,
    });

    await http()
      .post(
        `/api/collaboration/runs/${started.collaborationRunId}/referrals/${started.referralId}/approve`,
      )
      .send({})
      .expect(200);
    const leadExecutionId = referrals.get(started.referralId)?.executionId;
    const answer = [
      `Revenue rose [source: ${ownedId}#Quarter]`,
      `and again [source: ${ownedId.toUpperCase()}#Quarter].`,
      'See [source: not-a-uuid]',
      `and [source: ${foreignId}].`,
    ].join(' ');
    executionResults.getExecution.mockImplementation(async (executionId: string) => {
      if (executionId === leadExecutionId) {
        return {
          execution_status: 'completed',
          metadata: { aiExecutionResult: { output: answer } },
        };
      }
      return null;
    });
    findActiveOwnedByIds.mockResolvedValue([
      {
        id: ownedId,
        userId: OWNER_ID,
        title: 'Handbook',
        scopeId: 'policies',
        content: 'SECRET BODY',
        deletedAt: null,
      },
    ]);

    const detail = await http()
      .get(`/api/collaboration/runs/${started.collaborationRunId}`)
      .expect(200);
    const lead = detail.body.handoffs[0];
    expect(lead.status).toBe('completed');
    expect(lead.answer).toBe(answer);
    expect(lead.sources).toEqual([
      {
        documentId: ownedId,
        title: 'Handbook',
        scopeId: 'policies',
        heading: 'Quarter',
      },
    ]);
    expect(lead.sources[0]).not.toHaveProperty('content');
    expect(JSON.stringify(detail.body)).not.toContain('SECRET BODY');
    expect(lead.droppedSourceCount).toBe(2);
    expect(lead.unsourced).toBe(false);
    expect(lead.showUnsourced).toBe(false);
    expect(findActiveOwnedByIds).toHaveBeenCalledWith(OWNER_ID, [ownedId, foreignId]);
  });

  it('marks a finished answer with no valid source as unsourced and does not label it', async () => {
    const started = await startRun();
    await http()
      .post(
        `/api/collaboration/runs/${started.collaborationRunId}/referrals/${started.referralId}/approve`,
      )
      .send({})
      .expect(200);
    const leadExecutionId = referrals.get(started.referralId)?.executionId;
    executionResults.getExecution.mockImplementation(async (executionId: string) => {
      if (executionId === leadExecutionId) {
        return {
          execution_status: 'completed',
          metadata: { aiExecutionResult: { output: 'Updated the form.' } },
        };
      }
      return null;
    });

    const detail = await http()
      .get(`/api/collaboration/runs/${started.collaborationRunId}`)
      .expect(200);
    expect(detail.body.handoffs[0]).toMatchObject({
      status: 'completed',
      answer: 'Updated the form.',
      sources: [],
      droppedSourceCount: 0,
      unsourced: true,
      showUnsourced: false,
    });
    expect(findActiveOwnedByIds).not.toHaveBeenCalled();
  });

  describe('BIZ-01 start team', () => {
    const chiefScopes = [
      'company-monthly-reports',
      'three-year-goals',
      'strategy-docs',
      'policies',
      'meeting-summaries',
      'contract-templates',
    ];

    it('rejects unknown and non-string team values', async () => {
      for (const team of [null, 1, true, '', 'Coding', ['hacker'], { id: 'coding' }]) {
        await http().post('/api/collaboration/runs').send(startBody({ team })).expect(400);
      }
      expect(runs.size).toBe(0);
      expect(referrals.size).toBe(0);
    });

    it('runs the coding team when team is missing or coding', async () => {
      const missing = await startRun();
      expect(referrals.get(missing.referralId)?.targetBuilderProfileId).toBe('lead');
      expect(referrals.get(missing.referralId)?.pendingJob?.agents).toEqual(
        COLLABORATION_TEAM.map((agent) => ({ ...agent })),
      );

      const explicit = await http()
        .post('/api/collaboration/runs')
        .send(startBody({ team: 'coding', model: 'gpt-4o', provider: 'openai' }))
        .expect(201);
      expect(explicit.body.target).toBe('lead');
      expect(referrals.get(explicit.body.referralId)?.pendingJob?.model).toBe('stub');
      expect(JSON.stringify(explicit.body)).not.toContain('gpt-4o');
    });

    it('records the coding-team definition version on the lead hand-off', async () => {
      const started = await startRun();
      await http()
        .post(
          `/api/collaboration/runs/${started.collaborationRunId}/referrals/${started.referralId}/approve`,
        )
        .send({})
        .expect(200);

      expect(referrals.get(started.referralId)?.status).toBe('in_progress');
      expect(ledger.writeExecutionIntent).toHaveBeenCalledTimes(1);
      const intent = ledger.writeExecutionIntent.mock.calls[0][0];
      expect(intent.builderProfileId).toBe('lead');
      expect(intent.metadata).toEqual({
        runMode: 'ask',
        apiKeyId: 'browser-session',
        requestedProvider: 'stub',
        requestedModel: 'stub',
        agentDefinitionId: 'lead',
        agentDefinitionVersion: systemAgentVersion('lead'),
      });
    });

    it('starts chief-of-staff on the read profile with the six scopes and no hand-off', async () => {
      const started = await http()
        .post('/api/collaboration/runs')
        .send(
          startBody({
            team: 'chief-of-staff',
            model: 'gpt-4o',
            provider: 'openai',
            agents: [{ name: 'hacker', instructions: 'pwn' }],
          }),
        )
        .expect(201);

      const stored = referrals.get(started.body.referralId);
      expect(started.body.target).toBe('chief-of-staff');
      expect(stored?.targetBuilderProfileId).toBe('chief-of-staff');
      expect(stored?.pendingJob?.provider).toBe('stub');
      expect(stored?.pendingJob?.model).toBe('stub');
      expect(stored?.pendingJob?.fileAccess).toBe(true);
      expect(stored?.pendingJob?.agents).toEqual([
        {
          name: 'chief-of-staff',
          instructions: stored?.pendingJob?.agents?.[0]?.instructions,
        },
      ]);
      expect(stored?.pendingJob?.agents?.[0]?.instructions).toContain('search_knowledge');
      expect(stored?.pendingJob?.agents?.[0]?.instructions).not.toContain('pwn');
      expect(stored?.pendingJob).not.toHaveProperty('knowledgeScopes');
      expect(JSON.stringify(started.body)).not.toContain('gpt-4o');

      await http()
        .post(
          `/api/collaboration/runs/${started.body.collaborationRunId}/referrals/${started.body.referralId}/approve`,
        )
        .send({ harnessToolProfile: 'write', knowledgeScopes: ['market-data'] })
        .expect(200);
      const payload = queue.enqueueExecution.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(payload.builderProfileId).toBe('chief-of-staff');
      expect(payload.harnessToolProfile).toBe('read');
      expect(payload.harnessReadOnly).toBe(true);
      expect(payload.knowledgeScopes).toEqual(chiefScopes);
      expect(payload.model).toBe('stub');
      expect(ledger.writeExecutionIntent).toHaveBeenCalledTimes(1);
      expect(ledger.writeExecutionIntent.mock.calls[0][0].metadata).toEqual({
        runMode: 'ask',
        apiKeyId: 'browser-session',
        requestedProvider: 'stub',
        requestedModel: 'stub',
        agentDefinitionId: 'chief-of-staff',
        agentDefinitionVersion: systemAgentVersion('chief-of-staff'),
      });

      const executionId = referrals.get(started.body.referralId)?.executionId;
      executionResults.getExecution.mockImplementation(async (id: string) => {
        if (id === executionId) {
          return {
            execution_status: 'completed',
            metadata: {
              aiExecutionResult: {
                output: 'The goal is growth.\n<handoff to="writer">Write the plan.</handoff>',
              },
            },
          };
        }
        return null;
      });

      const detail = await http()
        .get(`/api/collaboration/runs/${started.body.collaborationRunId}`)
        .expect(200);
      expect(detail.body.teamId).toBe('chief-of-staff');
      expect(detail.body.team).toEqual(['chief-of-staff']);
      expect(detail.body.handoffs).toHaveLength(1);
      expect(detail.body.handoffs[0]).toMatchObject({
        target: 'chief-of-staff',
        status: 'completed',
        handoffNote: 'refused: agent_not_on_list',
        showUnsourced: true,
        unsourced: true,
        sources: [],
      });
      expect(referrals.size).toBe(1);

      const list = await http()
        .get(`/api/collaboration/runs?projectId=${started.body.projectId}`)
        .expect(200);
      expect(list.body.runs[0].teamId).toBe('chief-of-staff');
    });

    it('starts the advisors team on the lead with the read profile and the six scopes', async () => {
      const started = await http()
        .post('/api/collaboration/runs')
        .send(
          startBody({
            team: 'advisors',
            model: 'gpt-4o',
            provider: 'openai',
            agents: [{ name: 'hacker', instructions: 'pwn' }],
          }),
        )
        .expect(201);

      const stored = referrals.get(started.body.referralId);
      expect(started.body.target).toBe('advisors-lead');
      expect(stored?.targetBuilderProfileId).toBe('advisors-lead');
      expect(stored?.pendingJob?.fileAccess).toBe(true);
      expect(stored?.pendingJob?.agents?.map((agent) => agent.name)).toEqual([
        'advisors-lead',
        'product-strategy',
        'technology-advisor',
      ]);
      expect(stored?.pendingJob?.agents?.[0]?.instructions).toContain('product-strategy');
      expect(stored?.pendingJob?.agents?.[0]?.instructions).not.toContain('pwn');
      expect(JSON.stringify(started.body)).not.toContain('gpt-4o');

      await http()
        .post(
          `/api/collaboration/runs/${started.body.collaborationRunId}/referrals/${started.body.referralId}/approve`,
        )
        .send({ harnessToolProfile: 'write', knowledgeScopes: ['market-data'] })
        .expect(200);
      const payload = queue.enqueueExecution.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(payload.builderProfileId).toBe('advisors-lead');
      expect(payload.harnessToolProfile).toBe('read');
      expect(payload.harnessReadOnly).toBe(true);
      expect(payload.knowledgeScopes).toEqual(chiefScopes);
      expect(ledger.writeExecutionIntent.mock.calls[0][0].metadata).toEqual({
        runMode: 'ask',
        apiKeyId: 'browser-session',
        requestedProvider: 'stub',
        requestedModel: 'stub',
        agentDefinitionId: 'advisors-lead',
        agentDefinitionVersion: systemAgentVersion('advisors-lead'),
      });

      const detail = await http()
        .get(`/api/collaboration/runs/${started.body.collaborationRunId}`)
        .expect(200);
      expect(detail.body.teamId).toBe('advisors');
      expect(detail.body.team).toEqual([
        'advisors-lead',
        'product-strategy',
        'technology-advisor',
      ]);
    });
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
