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
import { MAX_HANDOFF_TASK_CHARS } from './handoff-request';
import { FindOperator } from 'typeorm';
import { CreditDeductionRecord } from '../entities/credit-deduction-record.entity';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import { systemAgentById } from '../system-agents/system-agent-registry';
import { UserAgentService } from '../user-agent/user-agent.service';
import { CollaborationWorkflowService, renderWorkflow } from './collaboration-workflow';
import { randomUUID } from 'crypto';
import { Project } from '../entities/project.entity';
import { Session } from '../entities/session.entity';
import {
  COLLABORATION_BUSINESS_RUN_NOTE,
  CollaborationBusinessSessionService,
} from './collaboration-business-session';

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

type BusinessRow = Record<string, unknown> & { id: string };

/** TEAM-NO-SESSION-02: a small projects or sessions repository with IsNull and order. */
function createBusinessRepo(rows: BusinessRow[]) {
  const matches = (row: BusinessRow, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, expected]) =>
      expected instanceof FindOperator && expected.type === 'isNull'
        ? row[key] === null || row[key] === undefined
        : row[key] === expected,
    );
  return {
    create: (input: Record<string, unknown>) => ({ ...input }),
    save: jest.fn(async (input: Record<string, unknown>) => {
      const row = {
        createdAt: new Date(),
        ...input,
        id: typeof input.id === 'string' ? input.id : randomUUID(),
      } as BusinessRow;
      rows.push(row);
      return { ...row };
    }),
    findOne: jest.fn(
      async (opts: { where: Record<string, unknown>; order?: Record<string, 'ASC' | 'DESC'> }) => {
        const found = rows
          .filter((row) => matches(row, opts.where))
          .sort(
            (a, b) =>
              (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime() ||
              a.id.localeCompare(b.id),
          );
        return found[0] ? { ...found[0] } : null;
      },
    ),
    update: jest.fn(async (criteria: Record<string, unknown>, partial: Record<string, unknown>) => {
      let affected = 0;
      for (const row of rows) {
        if (matches(row, criteria)) {
          Object.assign(row, partial);
          affected += 1;
        }
      }
      return { affected, raw: [], generatedMaps: [] };
    }),
  };
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
  let workflowRows: Map<string, Record<string, unknown>>;
  let deductionRows: Array<Record<string, unknown>>;
  let projectRows: BusinessRow[];
  let businessSessionRows: BusinessRow[];

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
    workflowRows = new Map();
    deductionRows = [];
    projectRows = [];
    businessSessionRows = [];
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
        CollaborationWorkflowService,
        CollaborationBusinessSessionService,
        { provide: getRepositoryToken(Project), useValue: createBusinessRepo(projectRows) },
        { provide: getRepositoryToken(Session), useValue: createBusinessRepo(businessSessionRows) },
        {
          provide: UserAgentService,
          useValue: {
            findOneByIdAndUserId: async (id: string, userId: string) => {
              const row = workflowRows.get(id);
              return row && row.userId === userId ? { ...row } : null;
            },
            listByUserId: async (userId: string) =>
              [...workflowRows.values()]
                .filter((row) => row.userId === userId)
                .map((row) => ({ ...row })),
          },
        },
        {
          provide: getRepositoryToken(CreditDeductionRecord),
          useValue: {
            find: async (opts: { where: Record<string, unknown> }) =>
              deductionRows.filter((row) =>
                Object.entries(opts.where).every(([key, expected]) =>
                  expected instanceof FindOperator
                    ? (expected.value as unknown[]).includes(row[key])
                    : row[key] === expected,
                ),
              ),
          },
        },
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
          if (req.header('x-test-anonymous') === '1') {
            req.apiKeyIdentity = undefined;
            return true;
          }
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
      'workflow',
    ]);
    expect(list.body.runs[0].teamId).toBe('coding');
    expect(list.body.runs[1].teamId).toBe('coding');
    expect(list.body.runs[0].workflow).toBeNull();
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

  describe('COLLAB-EDIT-01 edit a waiting hand-off prompt', () => {
    function promptPath(started: { collaborationRunId: string; referralId: string }) {
      return `/api/collaboration/runs/${started.collaborationRunId}/referrals/${started.referralId}/prompt`;
    }

    it('lets the owner replace a waiting hand-off with trimmed text', async () => {
      const started = await startRun();
      const edit = jest.spyOn(app.get(OrchestrationService), 'updatePendingReferralPrompt');

      const response = await http()
        .post(promptPath(started))
        .send({ prompt: '  edited task  ', editedBy: 'someone-else' })
        .expect(200);

      expect(edit).toHaveBeenCalledWith({
        collaborationRunId: started.collaborationRunId,
        referralId: started.referralId,
        prompt: 'edited task',
        editedBy: OWNER_ID,
      });
      expect(response.body.prompt).toBe('edited task');
      expect(response.body.status).toBe('pending_approval');
      expect(response.body.referralId).toBe(started.referralId);
      const stored = referrals.get(started.referralId);
      expect(stored?.pendingJob?.prompt).toBe('edited task');
      expect(stored?.pendingJob?.provider).toBe('stub');
      expect(stored?.status).toBe('pending_approval');

      const atLimit = 'p'.repeat(MAX_HANDOFF_TASK_CHARS);
      const limited = await http()
        .post(promptPath(started))
        .send({ prompt: atLimit })
        .expect(200);
      expect(limited.body.prompt).toBe(atLimit);
    });

    it('returns 409 when the hand-off is not waiting', async () => {
      const started = await startRun();
      const stored = referrals.get(started.referralId);
      expect(stored?.pendingJob?.prompt).toBe(TASK);
      stored!.status = 'in_progress';

      await http().post(promptPath(started)).send({ prompt: 'too late' }).expect(409);

      expect(referrals.get(started.referralId)?.status).toBe('in_progress');
      expect(referrals.get(started.referralId)?.pendingJob?.prompt).toBe(TASK);
    });

    it('returns 404 for another user and does not call the service', async () => {
      const started = await startRun();
      const edit = jest.spyOn(app.get(OrchestrationService), 'updatePendingReferralPrompt');

      await http(OTHER_ID).post(promptPath(started)).send({ prompt: 'nope' }).expect(404);

      expect(edit).not.toHaveBeenCalled();
      expect(referrals.get(started.referralId)?.pendingJob?.prompt).toBe(TASK);
      expect(referrals.get(started.referralId)?.status).toBe('pending_approval');
    });

    it('returns 400 for empty or whitespace text', async () => {
      const started = await startRun();
      const edit = jest.spyOn(app.get(OrchestrationService), 'updatePendingReferralPrompt');

      await http().post(promptPath(started)).send({ prompt: '' }).expect(400);
      await http().post(promptPath(started)).send({ prompt: ' \n\t ' }).expect(400);

      expect(edit).not.toHaveBeenCalled();
      expect(referrals.get(started.referralId)?.pendingJob?.prompt).toBe(TASK);
    });

    it('returns 400 when the text is longer than the hand-off limit', async () => {
      const started = await startRun();
      const edit = jest.spyOn(app.get(OrchestrationService), 'updatePendingReferralPrompt');

      await http()
        .post(promptPath(started))
        .send({ prompt: 'x'.repeat(MAX_HANDOFF_TASK_CHARS + 1) })
        .expect(400);

      expect(edit).not.toHaveBeenCalled();
      expect(referrals.get(started.referralId)?.pendingJob?.prompt).toBe(TASK);
    });

    it('returns 400 when prompt is missing or not a string', async () => {
      const started = await startRun();
      const edit = jest.spyOn(app.get(OrchestrationService), 'updatePendingReferralPrompt');

      await http().post(promptPath(started)).send({}).expect(400);
      await http().post(promptPath(started)).send({ prompt: 12 }).expect(400);
      await http().post(promptPath(started)).send({ prompt: null }).expect(400);
      await http().post(promptPath(started)).send({ prompt: { text: 'no' } }).expect(400);

      expect(edit).not.toHaveBeenCalled();
      expect(referrals.get(started.referralId)?.pendingJob?.prompt).toBe(TASK);
    });

    it('refuses an unentitled caller the same way as reject', async () => {
      const started = await startRun();
      const edit = jest.spyOn(app.get(OrchestrationService), 'updatePendingReferralPrompt');

      await http(OWNER_ID, false)
        .post(promptPath(started))
        .send({ prompt: 'not allowed' })
        .expect(403);

      expect(edit).not.toHaveBeenCalled();
      expect(referrals.get(started.referralId)?.status).toBe('pending_approval');
      expect(referrals.get(started.referralId)?.pendingJob?.prompt).toBe(TASK);
      expect(queue.enqueueExecution).not.toHaveBeenCalled();
    });
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

  describe('BIZ-USER-01C run a user workflow', () => {
    const WORKFLOW_ID = 'f0f0f0f0-0000-4000-8000-000000000001';
    const outputs = new Map<string, string>();

    function cosRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
      const cos = systemAgentById('chief-of-staff');
      if (!cos) {
        throw new Error('missing chief-of-staff');
      }
      return {
        id: WORKFLOW_ID,
        userId: OWNER_ID,
        name: 'Morning brief',
        role: 'Assistant',
        description: '',
        status: 'active',
        tone: cos.tone,
        replyLanguage: cos.replyLanguage,
        purpose: cos.purpose,
        procedure: cos.procedure,
        result: cos.result,
        toolProfile: 'read',
        knowledgeScopeIds: cos.knowledgeScopes.map((scope) => scope.id),
        connectorToolIds: [...cos.connectorToolIds],
        model: { choice: 'server' },
        budgetPerRunCredits: null,
        budgetPerDayCredits: null,
        templateId: 'chief-of-staff',
        ...overrides,
      };
    }

    function currentVersion(): string {
      const rendered = renderWorkflow(workflowRows.get(WORKFLOW_ID) as never);
      if (!rendered) {
        throw new Error('row does not render');
      }
      return rendered.version;
    }

    function workflowBody(overrides: Record<string, unknown> = {}) {
      return {
        sessionId: SESSION_ID,
        task: TASK,
        workflowId: WORKFLOW_ID,
        provider: 'openai',
        model: 'gpt-4o',
        agents: [{ name: 'hacker', instructions: 'pwn' }],
        knowledgeScopes: ['market-data'],
        connectorToolIds: ['not_a_tool'],
        budgetPerDayCredits: 100000,
        ...overrides,
      };
    }

    async function startWorkflow(overrides: Record<string, unknown> = {}, expected = 201) {
      return http().post('/api/collaboration/runs').send(workflowBody(overrides)).expect(expected);
    }

    function approvePath(body: { collaborationRunId: string; referralId: string }) {
      return `/api/collaboration/runs/${body.collaborationRunId}/referrals/${body.referralId}/approve`;
    }

    /** Approve, finish the execution with `output`, and read the run so it completes. */
    async function completeRun(
      body: { collaborationRunId: string; referralId: string },
      output = 'Nothing new today.',
    ): Promise<string> {
      await http().post(approvePath(body)).send({}).expect(200);
      const executionId = referrals.get(body.referralId)?.executionId;
      if (!executionId) {
        throw new Error('no execution');
      }
      outputs.set(executionId, output);
      await http().get(`/api/collaboration/runs/${body.collaborationRunId}`).expect(200);
      expect(referrals.get(body.referralId)?.status).toBe('completed');
      return executionId;
    }

    beforeEach(() => {
      outputs.clear();
      workflowRows.set(WORKFLOW_ID, cosRow());
      executionResults.getExecution.mockImplementation(async (executionId: string) =>
        outputs.has(executionId)
          ? {
              execution_status: 'completed',
              metadata: { aiExecutionResult: { output: outputs.get(executionId) } },
            }
          : null,
      );
    });

    it('starts a test run as a team of one with the rendered prompt and the snapshot, ignoring body fields', async () => {
      const response = await startWorkflow({ testRun: true });
      const stored = referrals.get(response.body.referralId);
      const row = workflowRows.get(WORKFLOW_ID);
      const rendered = renderWorkflow(row as never)!;

      expect(response.body.target).toBe(WORKFLOW_ID);
      expect(response.body.handoffStatus).toBe('pending_approval');
      expect(stored?.targetBuilderProfileId).toBe(WORKFLOW_ID);
      expect(stored?.pendingJob?.fileAccess).toBe(true);
      expect(stored?.pendingJob?.provider).toBe('stub');
      expect(stored?.pendingJob?.model).toBe('stub');
      expect(stored?.pendingJob?.agents).toEqual([
        { name: WORKFLOW_ID, instructions: rendered.instructions },
      ]);
      expect(stored?.pendingJob?.projectInstructions).toContain(`You are ${WORKFLOW_ID}.`);
      expect(stored?.pendingJob?.workflow).toEqual({
        id: WORKFLOW_ID,
        name: 'Morning brief',
        version: rendered.version,
        knowledgeScopeIds: rendered.knowledgeScopeIds,
        connectorToolIds: rendered.connectorToolIds,
        model: { choice: 'server' },
        testRun: true,
        budgetPerRunCredits: null,
        budgetPerDayCredits: null,
      });
      const text = JSON.stringify(stored?.pendingJob);
      for (const leaked of ['pwn', 'hacker', 'gpt-4o', 'market-data', 'not_a_tool', '100000']) {
        expect(text).not.toContain(leaked);
      }
      expect(queue.enqueueExecution).not.toHaveBeenCalled();
    });

    it('refuses team with workflowId, a bad workflowId and a bad testRun with 400 and creates nothing', async () => {
      await startWorkflow({ team: 'coding' }, 400);
      await startWorkflow({ team: 'chief-of-staff', testRun: true }, 400);
      await startWorkflow({ workflowId: 'not-a-uuid' }, 400);
      await startWorkflow({ workflowId: null }, 400);
      await startWorkflow({ testRun: 'yes' }, 400);
      await http()
        .post('/api/collaboration/runs')
        .send(startBody({ team: 'coding', testRun: true }))
        .expect(400);
      expect(runs.size).toBe(0);
      expect(referrals.size).toBe(0);
    });

    it("refuses another owner's workflow with 404 WORKFLOW_NOT_FOUND before any conversation or run", async () => {
      conversations.delete(SESSION_ID);
      workflowRows.set(WORKFLOW_ID, cosRow({ userId: OTHER_ID }));
      const response = await startWorkflow({ testRun: true }, 404);
      expect(response.body.code).toBe('WORKFLOW_NOT_FOUND');
      expect(conversations.has(SESSION_ID)).toBe(false);
      expect(runs.size).toBe(0);
      expect(referrals.size).toBe(0);
    });

    it('refuses a disabled workflow, and a row that cannot run, with 409', async () => {
      workflowRows.set(WORKFLOW_ID, cosRow({ status: 'disabled' }));
      expect((await startWorkflow({ testRun: true }, 409)).body.code).toBe('WORKFLOW_DISABLED');
      workflowRows.set(WORKFLOW_ID, cosRow({ model: { choice: 'platform', id: 'gpt-4o' } }));
      expect((await startWorkflow({ testRun: true }, 409)).body.code).toBe('WORKFLOW_INVALID');
      workflowRows.set(WORKFLOW_ID, cosRow({ purpose: 'x'.repeat(4001) }));
      expect((await startWorkflow({ testRun: true }, 409)).body.code).toBe('WORKFLOW_INVALID');
      expect(runs.size).toBe(0);
    });

    it('lets a draft test-run only, and an active workflow run normally only once tested at the current version', async () => {
      workflowRows.set(WORKFLOW_ID, cosRow({ status: 'draft' }));
      expect((await startWorkflow({}, 409)).body.code).toBe('WORKFLOW_NOT_TESTED');
      const draftTest = await startWorkflow({ testRun: true });
      await completeRun(draftTest.body);
      expect((await startWorkflow({}, 409)).body.code).toBe('WORKFLOW_NOT_TESTED');

      workflowRows.set(WORKFLOW_ID, cosRow({ status: 'active' }));
      const normal = await startWorkflow({});
      expect(referrals.get(normal.body.referralId)?.pendingJob?.workflow?.testRun).toBe(false);

      // Editing the workflow changes its version: it must be tested again.
      workflowRows.set(WORKFLOW_ID, cosRow({ purpose: 'Read my week and list what matters.' }));
      expect((await startWorkflow({}, 409)).body.code).toBe('WORKFLOW_NOT_TESTED');
    });

    it('refuses an untested active workflow; a failed or unfinished test run does not count', async () => {
      expect((await startWorkflow({}, 409)).body.code).toBe('WORKFLOW_NOT_TESTED');
      const pending = await startWorkflow({ testRun: true });
      await http().post(approvePath(pending.body)).send({}).expect(200);
      expect((await startWorkflow({}, 409)).body.code).toBe('WORKFLOW_NOT_TESTED');
    });

    it('refuses the day budget with 429 and the run budget with 409, with the numbers', async () => {
      const test = await startWorkflow({ testRun: true });
      const executionId = await completeRun(test.body);
      deductionRows.push({
        ownerId: OWNER_ID,
        sourceEventId: executionId,
        requestedCredits: 12,
        createdAt: new Date(),
      });
      // Another owner's and another execution's credits are not counted.
      deductionRows.push({ ownerId: OTHER_ID, sourceEventId: executionId, requestedCredits: 50, createdAt: new Date() });
      deductionRows.push({ ownerId: OWNER_ID, sourceEventId: 'other-exec', requestedCredits: 50, createdAt: new Date() });

      // NULL budgets never refuse.
      await startWorkflow({});

      workflowRows.set(WORKFLOW_ID, cosRow({ budgetPerDayCredits: 12 }));
      const day = await startWorkflow({}, 429);
      expect(day.body).toMatchObject({ code: 'WORKFLOW_BUDGET_DAY', budget: 12, spent: 12 });
      expect(day.body).not.toHaveProperty('cap');

      workflowRows.set(WORKFLOW_ID, cosRow({ budgetPerRunCredits: 11, budgetPerDayCredits: 100 }));
      const run = await startWorkflow({ testRun: true }, 409);
      expect(run.body).toMatchObject({ code: 'WORKFLOW_BUDGET_RUN', budget: 11, lastRun: 12 });

      workflowRows.set(WORKFLOW_ID, cosRow({ budgetPerRunCredits: 12, budgetPerDayCredits: 13 }));
      await startWorkflow({});
    });

    it('applies a platform model on anthropic and keeps the env model for the server choice', async () => {
      workflowRows.set(WORKFLOW_ID, cosRow({ model: { choice: 'platform', id: 'claude-haiku-5-5' } }));
      const platform = await startWorkflow({ testRun: true });
      const job = referrals.get(platform.body.referralId)?.pendingJob;
      expect(job?.provider).toBe('anthropic');
      expect(job?.adapter).toBe('anthropic');
      expect(job?.model).toBe('claude-haiku-5-5');
      expect(job?.workflow?.model).toEqual({ choice: 'platform', id: 'claude-haiku-5-5' });

      const spy = jest.spyOn(KillSwitchConfig, 'isProviderEnabled').mockReturnValue(false);
      try {
        await startWorkflow({ testRun: true }, 503);
      } finally {
        spy.mockRestore();
      }

      workflowRows.set(WORKFLOW_ID, cosRow());
      const server = await startWorkflow({ testRun: true });
      expect(referrals.get(server.body.referralId)?.pendingJob?.provider).toBe('stub');
      expect(referrals.get(server.body.referralId)?.pendingJob?.model).toBe('stub');
    });

    it('enqueues the snapshot, not a later edit, and records the workflow version in the ledger', async () => {
      const started = await startWorkflow({ testRun: true });
      const snapshot = referrals.get(started.body.referralId)?.pendingJob?.workflow;
      workflowRows.set(
        WORKFLOW_ID,
        cosRow({ purpose: 'Edited while waiting.', knowledgeScopeIds: ['policies'] }),
      );

      await http().post(approvePath(started.body)).send({ harnessToolProfile: 'write' }).expect(200);
      const payload = queue.enqueueExecution.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(payload.builderProfileId).toBe(WORKFLOW_ID);
      expect(payload.harnessVersion).toBe('v1');
      expect(payload.harnessToolProfile).toBe('read');
      expect(payload.harnessReadOnly).toBe(true);
      expect(payload.knowledgeScopes).toEqual(snapshot?.knowledgeScopeIds);
      expect(payload).not.toHaveProperty('agentId');
      expect(payload).not.toHaveProperty('workflow');
      expect(String(payload.projectInstructions)).not.toContain('Edited while waiting.');
      expect(typeof payload.harnessEntitlementProof).toBe('object');

      const intent = ledger.writeExecutionIntent.mock.calls.at(-1)?.[0];
      expect(intent.builderProfileId).toBe(WORKFLOW_ID);
      expect(intent.metadata).toEqual({
        runMode: 'ask',
        apiKeyId: 'browser-session',
        requestedProvider: 'stub',
        requestedModel: 'stub',
        agentDefinitionId: WORKFLOW_ID,
        agentDefinitionVersion: snapshot?.version,
        workflowTestRun: true,
      });
    });

    it('signs a workflow job with the key set of a chief-of-staff job on the same page', async () => {
      const cos = await http()
        .post('/api/collaboration/runs')
        .send(startBody({ team: 'chief-of-staff' }))
        .expect(201);
      await http().post(approvePath(cos.body)).send({}).expect(200);
      const cosJob = queue.enqueueExecution.mock.calls.at(-1)?.[0] as Record<string, unknown>;

      const workflow = await startWorkflow({ testRun: true });
      await http().post(approvePath(workflow.body)).send({}).expect(200);
      const workflowJob = queue.enqueueExecution.mock.calls.at(-1)?.[0] as Record<string, unknown>;

      expect(Object.keys(workflowJob).sort()).toEqual(Object.keys(cosJob).sort());
      expect(workflowJob.knowledgeScopes).toEqual(cosJob.knowledgeScopes);
    });

    it('omits workflowTestRun on a normal run', async () => {
      const test = await startWorkflow({ testRun: true });
      await completeRun(test.body);
      const normal = await startWorkflow({});
      await http().post(approvePath(normal.body)).send({}).expect(200);
      const intent = ledger.writeExecutionIntent.mock.calls.at(-1)?.[0];
      expect(intent.metadata.agentDefinitionVersion).toBe(currentVersion());
      expect(intent.metadata).not.toHaveProperty('workflowTestRun');
    });

    it('re-checks at approve: a removed row is refused and nothing is enqueued', async () => {
      const started = await startWorkflow({ testRun: true });
      workflowRows.delete(WORKFLOW_ID);
      const response = await http().post(approvePath(started.body)).send({}).expect(409);
      expect(response.body.code).toBe('WORKFLOW_DISABLED');
      expect(queue.enqueueExecution).not.toHaveBeenCalled();
      expect(referrals.get(started.body.referralId)?.status).toBe('pending_approval');
    });

    it('re-checks the day budget at approve when credits were spent during the wait', async () => {
      workflowRows.set(WORKFLOW_ID, cosRow({ budgetPerDayCredits: 20 }));
      const first = await startWorkflow({ testRun: true });
      const waiting = await startWorkflow({ testRun: true });
      const executionId = await completeRun(first.body);
      deductionRows.push({
        ownerId: OWNER_ID,
        sourceEventId: executionId,
        requestedCredits: 20,
        createdAt: new Date(),
      });
      const calls = queue.enqueueExecution.mock.calls.length;
      const response = await http().post(approvePath(waiting.body)).send({}).expect(429);
      expect(response.body).toMatchObject({ code: 'WORKFLOW_BUDGET_DAY', budget: 20, spent: 20 });
      expect(queue.enqueueExecution.mock.calls.length).toBe(calls);
    });

    it('shows the workflow on the run list and detail, labels an unsourced answer and refuses its hand-offs', async () => {
      const started = await startWorkflow({ testRun: true });
      await completeRun(
        started.body,
        `Today is quiet.\n<handoff to="writer">Write the plan.</handoff>`,
      );
      const detail = await http()
        .get(`/api/collaboration/runs/${started.body.collaborationRunId}`)
        .expect(200);
      expect(detail.body.teamId).toBe('workflow');
      expect(detail.body.team).toEqual([WORKFLOW_ID]);
      expect(detail.body.workflow).toEqual({ id: WORKFLOW_ID, name: 'Morning brief', testRun: true });
      expect(detail.body.handoffs).toHaveLength(1);
      expect(detail.body.handoffs[0]).toMatchObject({
        target: WORKFLOW_ID,
        status: 'completed',
        handoffNote: 'refused: agent_not_on_list',
        unsourced: true,
        showUnsourced: true,
      });
      expect(referrals.size).toBe(1);

      const list = await http().get(`/api/collaboration/runs?projectId=${PROJECT_ID}`).expect(200);
      expect(list.body.runs[0]).toMatchObject({
        teamId: 'workflow',
        workflow: { id: WORKFLOW_ID, name: 'Morning brief', testRun: true },
      });
      expect(JSON.stringify(list.body)).not.toContain(TASK);
    });

    it('refuses a hand-off from the workflow to itself', async () => {
      const started = await startWorkflow({ testRun: true });
      await completeRun(started.body, `Again.\n<handoff to="${WORKFLOW_ID}">Again.</handoff>`);
      expect(referrals.size).toBe(1);
      expect(String(referrals.get(started.body.referralId)?.pendingJob?.handoffNote)).toMatch(
        /^refused: /,
      );
    });

    it('lists the owner workflows without instructions, and refuses an unentitled caller', async () => {
      workflowRows.set(
        'f0f0f0f0-0000-4000-8000-000000000009',
        cosRow({ id: 'f0f0f0f0-0000-4000-8000-000000000009', userId: OTHER_ID, name: 'Foreign' }),
      );
      const test = await startWorkflow({ testRun: true });
      await completeRun(test.body);

      const response = await http().get('/api/collaboration/workflows').expect(200);
      expect(response.body.workflows).toHaveLength(1);
      const item = response.body.workflows[0];
      expect(Object.keys(item).sort()).toEqual([
        'budgetPerDayCredits',
        'budgetPerRunCredits',
        'connectorToolIds',
        'id',
        'knowledgeScopeIds',
        'lastRunCredits',
        'lastTestRunAt',
        'model',
        'name',
        'role',
        'spentTodayCredits',
        'status',
        'tested',
        'version',
      ]);
      expect(item).toMatchObject({
        id: WORKFLOW_ID,
        name: 'Morning brief',
        status: 'active',
        tested: true,
        version: currentVersion(),
      });
      const text = JSON.stringify(response.body);
      expect(text).not.toContain('Foreign');
      expect(text).not.toContain(String(workflowRows.get(WORKFLOW_ID)?.purpose));

      await http(OWNER_ID, false).get('/api/collaboration/workflows').expect(403);
      const denied = await http(OWNER_ID, false)
        .post('/api/collaboration/runs')
        .send(workflowBody({ testRun: true }))
        .expect(403);
      expect(denied.body.code).toBeUndefined();
    });

    it('keeps the three-team start body working as before', async () => {
      const started = await startRun();
      expect(referrals.get(started.referralId)?.targetBuilderProfileId).toBe('lead');
      expect(referrals.get(started.referralId)?.pendingJob).not.toHaveProperty('workflow');
      const list = await http().get(`/api/collaboration/runs?projectId=${PROJECT_ID}`).expect(200);
      expect(list.body.runs[0]).toMatchObject({ teamId: 'coding', workflow: null });
      const detail = await http()
        .get(`/api/collaboration/runs/${started.collaborationRunId}`)
        .expect(200);
      expect(detail.body.workflow).toBeNull();
    });

    describe('TEAM-NO-SESSION-02 start a workflow without a session', () => {
      const OTHER_WORKFLOW_ID = 'f0f0f0f0-0000-4000-8000-0000000000aa';

      function sessionless(overrides: Record<string, unknown> = {}) {
        return workflowBody({ sessionId: undefined, ...overrides });
      }

      async function startSessionless(
        overrides: Record<string, unknown> = {},
        expected = 201,
        userId = OWNER_ID,
      ) {
        return http(userId)
          .post('/api/collaboration/runs')
          .send(sessionless(overrides))
          .expect(expected);
      }

      it('starts on the business project and session, created on first use and reused after', async () => {
        const first = await startSessionless({ testRun: true });
        expect(projectRows).toHaveLength(1);
        expect(businessSessionRows).toHaveLength(1);
        const project = projectRows[0];
        const session = businessSessionRows[0];
        expect(first.body.projectId).toBe(project.id);
        expect(first.body.projectId).not.toBe(PROJECT_ID);
        expect(first.body.handoffStatus).toBe('pending_approval');
        expect(first.body.target).toBe(WORKFLOW_ID);
        expect(first.body.conversationCreated).toBe(true);
        expect(runs.get(first.body.collaborationRunId)?.projectId).toBe(project.id);
        expect(referrals.get(first.body.referralId)?.pendingJob?.sessionId).toBe(session.id);
        expect(referrals.get(first.body.referralId)?.pendingJob?.conversationId).toBe(
          first.body.conversationId,
        );
        expect(sessionReads).not.toHaveBeenCalled();

        const activityBefore = (session.lastActivityAt as Date).getTime();
        await new Promise((resolve) => setTimeout(resolve, 5));
        const second = await startSessionless({ testRun: true });
        expect(projectRows).toHaveLength(1);
        expect(businessSessionRows).toHaveLength(1);
        expect(second.body.projectId).toBe(project.id);
        expect(second.body.conversationCreated).toBe(false);
        expect(second.body.conversationId).toBe(first.body.conversationId);
        expect(referrals.get(second.body.referralId)?.pendingJob?.sessionId).toBe(session.id);
        expect((businessSessionRows[0].lastActivityAt as Date).getTime()).toBeGreaterThan(
          activityBefore,
        );
      });

      it('writes the exact business rows: stopped, expired at creation, no container, no workspace', async () => {
        await startSessionless({ testRun: true });
        const project = projectRows[0];
        const session = businessSessionRows[0];
        expect(project).toMatchObject({
          userId: OWNER_ID,
          name: 'Business workflows',
          slug: `business-${OWNER_ID}`,
          visibility: 'private',
          workspaceId: null,
        });
        expect(session).toMatchObject({
          userId: OWNER_ID,
          projectId: project.id,
          status: 'stopped',
          containerId: null,
          terminatedAt: null,
        });
        expect((session.expiresAt as Date).getTime()).toBeLessThanOrEqual(
          (session.createdAt as Date).getTime(),
        );
      });

      it('gives another owner their own business rows', async () => {
        workflowRows.set(
          OTHER_WORKFLOW_ID,
          cosRow({ id: OTHER_WORKFLOW_ID, userId: OTHER_ID, name: 'Their brief' }),
        );
        const mine = await startSessionless({ testRun: true });
        const theirs = await startSessionless(
          { testRun: true, workflowId: OTHER_WORKFLOW_ID },
          201,
          OTHER_ID,
        );
        expect(projectRows).toHaveLength(2);
        expect(businessSessionRows).toHaveLength(2);
        expect(theirs.body.projectId).not.toBe(mine.body.projectId);
        const theirProject = projectRows.find((row) => row.id === theirs.body.projectId);
        const theirSession = businessSessionRows.find((row) => row.userId === OTHER_ID);
        expect(theirProject).toMatchObject({ userId: OTHER_ID, slug: `business-${OTHER_ID}` });
        expect(theirSession).toMatchObject({ userId: OTHER_ID, projectId: theirs.body.projectId });
        expect(referrals.get(theirs.body.referralId)?.pendingJob?.sessionId).toBe(theirSession?.id);

        // Another owner's workflow is still 404 without a session, and creates nothing more.
        const foreign = await startSessionless({ testRun: true, workflowId: OTHER_WORKFLOW_ID }, 404);
        expect(foreign.body.code).toBe('WORKFLOW_NOT_FOUND');
        expect(projectRows).toHaveLength(2);
        expect(businessSessionRows).toHaveLength(2);
      });

      it('still refuses a team start without a session with 400 and creates nothing', async () => {
        for (const team of [undefined, 'coding', 'chief-of-staff', 'advisors']) {
          const body: Record<string, unknown> = { task: TASK };
          if (team !== undefined) {
            body.team = team;
          }
          const response = await http().post('/api/collaboration/runs').send(body).expect(400);
          expect(response.body.message).toBe('sessionId must be a valid UUID');
        }
        await http()
          .post('/api/collaboration/runs')
          .send(startBody({ sessionId: undefined, team: 'chief-of-staff' }))
          .expect(400);
        // A sessionId that is present but not a UUID is still refused on a workflow body.
        await startSessionless({ testRun: true, sessionId: 'not-a-uuid' }, 400);
        await startSessionless({ testRun: true, sessionId: null }, 400);
        expect(projectRows).toHaveLength(0);
        expect(businessSessionRows).toHaveLength(0);
        expect(runs.size).toBe(0);
        expect(referrals.size).toBe(0);
      });

      it('keeps the workspace path when a workflow start has a sessionId and creates no business rows', async () => {
        const started = await startWorkflow({ testRun: true });
        expect(started.body.projectId).toBe(PROJECT_ID);
        expect(started.body.conversationId).toBe(CONVERSATION_ID);
        expect(referrals.get(started.body.referralId)?.pendingJob?.sessionId).toBe(SESSION_ID);
        expect(projectRows).toHaveLength(0);
        expect(businessSessionRows).toHaveLength(0);

        // An unusable workspace session is still 409, not a silent fall back to the business session.
        sessions.set(SESSION_ID, usableSession({ terminatedAt: new Date() }));
        await startWorkflow({ testRun: true }, 409);
        sessions.set(SESSION_ID, usableSession({ projectId: null }));
        await startWorkflow({ testRun: true }, 409);
        expect(projectRows).toHaveLength(0);
        expect(businessSessionRows).toHaveLength(0);
      });

      it('creates no business rows when the start is refused (404, 409, 429, 503)', async () => {
        workflowRows.set(WORKFLOW_ID, cosRow({ userId: OTHER_ID }));
        expect((await startSessionless({ testRun: true }, 404)).body.code).toBe('WORKFLOW_NOT_FOUND');

        workflowRows.set(WORKFLOW_ID, cosRow({ status: 'disabled' }));
        expect((await startSessionless({ testRun: true }, 409)).body.code).toBe('WORKFLOW_DISABLED');

        workflowRows.set(WORKFLOW_ID, cosRow({ purpose: 'x'.repeat(4001) }));
        expect((await startSessionless({ testRun: true }, 409)).body.code).toBe('WORKFLOW_INVALID');

        workflowRows.set(WORKFLOW_ID, cosRow());
        expect((await startSessionless({}, 409)).body.code).toBe('WORKFLOW_NOT_TESTED');

        workflowRows.set(WORKFLOW_ID, cosRow({ model: { choice: 'platform', id: 'claude-haiku-5-5' } }));
        const spy = jest.spyOn(KillSwitchConfig, 'isProviderEnabled').mockReturnValue(false);
        try {
          await startSessionless({ testRun: true }, 503);
        } finally {
          spy.mockRestore();
        }

        // The day budget: a test run through the workspace session spends 12 credits.
        workflowRows.set(WORKFLOW_ID, cosRow({ budgetPerDayCredits: 12 }));
        const test = await startWorkflow({ testRun: true });
        const executionId = await completeRun(test.body);
        deductionRows.push({
          ownerId: OWNER_ID,
          sourceEventId: executionId,
          requestedCredits: 12,
          createdAt: new Date(),
        });
        const day = await startSessionless({}, 429);
        expect(day.body).toMatchObject({ code: 'WORKFLOW_BUDGET_DAY', budget: 12, spent: 12 });

        expect(projectRows).toHaveLength(0);
        expect(businessSessionRows).toHaveLength(0);
        expect(runs.size).toBe(1);
      });

      it('refuses a plan whose signed profile is not read with 409 and creates nothing', async () => {
        const original = CollaborationWorkflowService.prototype.prepareStart;
        const spy = jest
          .spyOn(CollaborationWorkflowService.prototype, 'prepareStart')
          .mockImplementation(async function (
            this: CollaborationWorkflowService,
            input: Parameters<CollaborationWorkflowService['prepareStart']>[0],
          ) {
            const prepared = await original.call(this, input);
            return { ...prepared, builderProfileId: 'writer' };
          });
        try {
          const response = await startSessionless({ testRun: true }, 409);
          expect(response.body.code).toBe('WORKFLOW_INVALID');
        } finally {
          spy.mockRestore();
        }
        expect(projectRows).toHaveLength(0);
        expect(businessSessionRows).toHaveLength(0);
        expect(runs.size).toBe(0);
        expect(referrals.size).toBe(0);
      });

      it('puts the caller note on projectInstructions only for a session-less run, and keeps the version', async () => {
        const without = await startSessionless({ testRun: true });
        const job = referrals.get(without.body.referralId)?.pendingJob;
        expect(job?.callerProjectInstructions).toBe(COLLABORATION_BUSINESS_RUN_NOTE);
        expect(
          String(job?.projectInstructions).startsWith(`${COLLABORATION_BUSINESS_RUN_NOTE}\n\n`),
        ).toBe(true);
        expect(job?.projectInstructions).toContain(`You are ${WORKFLOW_ID}.`);
        expect(job?.workflow?.version).toBe(currentVersion());

        const withSession = await startWorkflow({ testRun: true });
        const sessionJob = referrals.get(withSession.body.referralId)?.pendingJob;
        expect(sessionJob?.callerProjectInstructions ?? null).toBeNull();
        expect(String(sessionJob?.projectInstructions)).not.toContain(
          COLLABORATION_BUSINESS_RUN_NOTE,
        );

        await http().post(approvePath(without.body)).send({}).expect(200);
        const payload = queue.enqueueExecution.mock.calls.at(-1)?.[0] as Record<string, unknown>;
        expect(payload.sessionId).toBe(businessSessionRows[0].id);
        expect(payload.harnessToolProfile).toBe('read');
        expect(payload.harnessReadOnly).toBe(true);
        expect(String(payload.projectInstructions).startsWith(COLLABORATION_BUSINESS_RUN_NOTE)).toBe(
          true,
        );
        const intent = ledger.writeExecutionIntent.mock.calls.at(-1)?.[0];
        expect(intent.sessionId).toBe(businessSessionRows[0].id);
        expect(intent.metadata.agentDefinitionVersion).toBe(currentVersion());
        expect(intent.metadata.workflowTestRun).toBe(true);
      });

      it('signs a session-less workflow job with the same key set as one with a session', async () => {
        const withSession = await startWorkflow({ testRun: true });
        await http().post(approvePath(withSession.body)).send({}).expect(200);
        const sessionJob = queue.enqueueExecution.mock.calls.at(-1)?.[0] as Record<string, unknown>;
        const without = await startSessionless({ testRun: true });
        await http().post(approvePath(without.body)).send({}).expect(200);
        const businessJob = queue.enqueueExecution.mock.calls.at(-1)?.[0] as Record<string, unknown>;
        expect(Object.keys(businessJob).sort()).toEqual(Object.keys(sessionJob).sort());
      });

      it('lists the business project on the workflows route only once it exists, without creating it', async () => {
        const before = await http().get('/api/collaboration/workflows').expect(200);
        expect(before.body.business).toBeNull();
        expect(projectRows).toHaveLength(0);
        expect(businessSessionRows).toHaveLength(0);

        const started = await startSessionless({ testRun: true });
        const after = await http().get('/api/collaboration/workflows').expect(200);
        expect(after.body.business).toEqual({ projectId: started.body.projectId });
        expect(Object.keys(after.body).sort()).toEqual(['business', 'workflows']);

        const other = await http(OTHER_ID).get('/api/collaboration/workflows').expect(200);
        expect(other.body.business).toBeNull();
        expect(projectRows).toHaveLength(1);

        const list = await http()
          .get(`/api/collaboration/runs?projectId=${started.body.projectId}`)
          .expect(200);
        expect(list.body.runs).toHaveLength(1);
        expect(list.body.runs[0]).toMatchObject({
          collaborationRunId: started.body.collaborationRunId,
          teamId: 'workflow',
        });
      });

      it('keeps 401 and 403 on both routes and creates nothing', async () => {
        const anonymous = request(app.getHttpServer());
        await anonymous
          .post('/api/collaboration/runs')
          .set('x-test-anonymous', '1')
          .send(sessionless({ testRun: true }))
          .expect(401);
        await anonymous
          .get('/api/collaboration/workflows')
          .set('x-test-anonymous', '1')
          .expect(401);
        const denied = await http(OWNER_ID, false)
          .post('/api/collaboration/runs')
          .send(sessionless({ testRun: true }))
          .expect(403);
        expect(denied.body.code).toBeUndefined();
        await http(OWNER_ID, false).get('/api/collaboration/workflows').expect(403);
        expect(projectRows).toHaveLength(0);
        expect(businessSessionRows).toHaveLength(0);
        expect(runs.size).toBe(0);
      });
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
