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
import { CollaborationRosterService } from './collaboration-roster';
import { CollaborationRosterEntity } from './collaboration-roster.entity';
import {
  FRONT_DOOR_LEAD_LABEL,
  buildReportBackPrompt,
  reportBackIdempotencyKey,
  teamLeadSummary,
} from './collaboration-front-door';
import { finalAnswerOf } from './collaboration-results';
import { buildCollaborationProjectInstructions } from './handoff-request';
import { CHIEF_OF_STAFF_INSTRUCTIONS } from '../system-agents/system-agent-registry';

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
  let rosterRows: Map<string, { userId: string; memberIds: unknown; updatedAt: Date }>;

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
    // COS-FRONTDOOR-01B: the roster store; empty unless a test saves one.
    rosterRows = new Map();
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
        CollaborationRosterService,
        {
          provide: getRepositoryToken(CollaborationRosterEntity),
          useValue: {
            findOne: async (opts: { where: { userId: string } }) => {
              const row = rosterRows.get(opts.where.userId);
              return row ? { ...row } : null;
            },
            upsert: async (row: { userId: string; memberIds: unknown; updatedAt: Date }) => {
              rosterRows.set(row.userId, { ...row });
            },
          },
        },
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
        // COS-FRONTDOOR-01B D4: chief-of-staff left this list; it starts on the business
        // session (its own describe block). Coding and advisors still need a session.
        for (const team of [undefined, 'coding', 'advisors']) {
          const body: Record<string, unknown> = { task: TASK };
          if (team !== undefined) {
            body.team = team;
          }
          const response = await http().post('/api/collaboration/runs').send(body).expect(400);
          expect(response.body.message).toBe('sessionId must be a valid UUID');
        }
        await http()
          .post('/api/collaboration/runs')
          .send(startBody({ sessionId: undefined, team: 'advisors' }))
          .expect(400);
        // A chief-of-staff body with a sessionId that is present but not a UUID is still 400.
        await http()
          .post('/api/collaboration/runs')
          .send(startBody({ sessionId: 'not-a-uuid', team: 'chief-of-staff' }))
          .expect(400);
        await http()
          .post('/api/collaboration/runs')
          .send(startBody({ sessionId: null, team: 'chief-of-staff' }))
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

  describe('COS-FRONTDOOR-01B front-door run and report-back', () => {
    const WF = 'f0f0f0f0-0000-4000-8000-0000000000fd';
    const DRAFT_WF = 'f0f0f0f0-0000-4000-8000-0000000000fe';
    const OWNER_TASK = 'Plan my week around the market and my mail.';
    const outputs = new Map<string, { status: string; output: string }>();

    function memberRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
      return {
        id: WF,
        userId: OWNER_ID,
        name: 'Mail digest',
        role: 'Assistant',
        description: 'Summarizes unread mail.',
        status: 'active',
        tone: null,
        replyLanguage: null,
        purpose: 'You summarize the owner\'s unread mail.',
        procedure: 'Call mail_list_unread_metadata and list each message in one line.',
        result: 'A short list.',
        toolProfile: 'read',
        knowledgeScopeIds: ['policies'],
        connectorToolIds: ['mail_list_unread_metadata'],
        model: { choice: 'server' },
        budgetPerRunCredits: null,
        budgetPerDayCredits: null,
        templateId: null,
        ...overrides,
      };
    }

    function service(): OrchestrationService {
      return app.get(OrchestrationService);
    }

    function steps(runId: string): CollaborationReferralEntity[] {
      return (runs.get(runId)?.referralIds ?? []).map((id) => referrals.get(id)!);
    }

    function last(runId: string): CollaborationReferralEntity {
      const all = steps(runId);
      return all[all.length - 1];
    }

    function jobOf(referralId: string): Record<string, unknown> {
      const executionId = referrals.get(referralId)?.executionId;
      const call = queue.enqueueExecution.mock.calls.find(
        (args) => (args[0] as { executionId: string }).executionId === executionId,
      );
      if (!call) {
        throw new Error(`no job for ${referralId}`);
      }
      return call[0] as Record<string, unknown>;
    }

    async function approve(runId: string, referralId: string, expected = 200) {
      return http()
        .post(`/api/collaboration/runs/${runId}/referrals/${referralId}/approve`)
        .send({})
        .expect(expected);
    }

    function finish(referralId: string, output: string, status = 'completed'): void {
      const executionId = referrals.get(referralId)?.executionId;
      if (!executionId) {
        throw new Error(`no execution for ${referralId}`);
      }
      outputs.set(executionId, { status, output });
    }

    async function readRun(runId: string) {
      return (await http().get(`/api/collaboration/runs/${runId}`).expect(200)).body as {
        run: { status: string };
        teamId: string;
        agents: Array<{ name: string; label: string | null }>;
        handoffs: Array<Record<string, unknown>>;
      };
    }

    /** Approve, finish with `output`, and read the run so the server reacts. */
    async function runStep(runId: string, referralId: string, output: string, status = 'completed') {
      await approve(runId, referralId);
      finish(referralId, output, status);
      return readRun(runId);
    }

    async function testRunWorkflow(id = WF): Promise<void> {
      const started = await http()
        .post('/api/collaboration/runs')
        .send({ sessionId: SESSION_ID, task: 'Test it.', workflowId: id, testRun: true })
        .expect(201);
      await runStep(started.body.collaborationRunId, started.body.referralId, 'Tested.');
      expect(referrals.get(started.body.referralId)?.status).toBe('completed');
    }

    async function startFrontDoor(
      memberIds: string[] | null,
      body: Record<string, unknown> = { sessionId: SESSION_ID },
    ) {
      if (memberIds) {
        rosterRows.set(OWNER_ID, { userId: OWNER_ID, memberIds, updatedAt: new Date() });
      }
      const started = await http()
        .post('/api/collaboration/runs')
        .send({ task: OWNER_TASK, team: 'chief-of-staff', ...body })
        .expect(201);
      return started.body as {
        collaborationRunId: string;
        referralId: string;
        roster?: { used: string[]; skipped: Array<{ id: string; reason: string }> };
      };
    }

    beforeEach(() => {
      outputs.clear();
      workflowRows.set(WF, memberRow());
      workflowRows.set(DRAFT_WF, memberRow({ id: DRAFT_WF, name: 'Draft flow', status: 'draft' }));
      executionResults.getExecution.mockImplementation(async (executionId: string) => {
        const stored = outputs.get(executionId);
        return stored
          ? {
              execution_status: stored.status,
              metadata: { aiExecutionResult: { output: stored.output } },
            }
          : null;
      });
    });

    it('builds the agent list from the stored roster with labels, summaries and the workflow snapshot', async () => {
      await testRunWorkflow();
      const started = await startFrontDoor(['product-strategy', WF], {
        sessionId: SESSION_ID,
        agents: [{ name: 'hacker', instructions: 'pwn' }],
        rosterWorkflows: [{ id: 'hacker' }],
      });
      const job = referrals.get(started.referralId)?.pendingJob;
      const rendered = renderWorkflow(workflowRows.get(WF) as never)!;
      const ps = systemAgentById('product-strategy')!;

      expect(started.roster).toEqual({ used: ['product-strategy', WF], skipped: [] });
      expect(referrals.get(started.referralId)?.targetBuilderProfileId).toBe('chief-of-staff');
      expect(job?.agents).toEqual([
        {
          name: 'chief-of-staff',
          instructions: CHIEF_OF_STAFF_INSTRUCTIONS,
          label: FRONT_DOOR_LEAD_LABEL,
          summary: expect.any(String),
        },
        {
          name: 'product-strategy',
          instructions: ps.instructions,
          label: 'Product Strategy',
          summary: "Answers product and market questions from the owner's market documents.",
        },
        {
          name: WF,
          instructions: rendered.instructions,
          label: 'Mail digest',
          summary: 'Summarizes unread mail.',
        },
      ]);
      expect(job?.rosterWorkflows).toEqual([
        {
          id: WF,
          name: 'Mail digest',
          version: rendered.version,
          knowledgeScopeIds: rendered.knowledgeScopeIds,
          connectorToolIds: rendered.connectorToolIds,
          model: { choice: 'server' },
          testRun: false,
          budgetPerRunCredits: null,
          budgetPerDayCredits: null,
        },
      ]);
      expect(job?.workflow).toBeUndefined();
      const brief = String(job?.projectInstructions);
      expect(brief).toContain(
        "- product-strategy (Product Strategy): Answers product and market questions from the owner's market documents.",
      );
      expect(brief).toContain(`- ${WF} (Mail digest): Summarizes unread mail.`);
      expect(brief).not.toContain(ps.instructions);
      expect(JSON.stringify(job)).not.toContain('pwn');
      expect(JSON.stringify(job)).not.toContain('hacker');
    });

    it('leaves out a draft, an untested and a missing member and reports them', async () => {
      // WF is not tested yet, and the third id is no workflow of this owner.
      const started = await startFrontDoor([
        WF,
        'f0f0f0f0-0000-4000-8000-00000000dead',
        'technology-advisor',
      ]);
      expect(started.roster?.used).toEqual(['technology-advisor']);
      expect(started.roster?.skipped).toEqual([
        { id: WF, reason: 'not_tested' },
        { id: 'f0f0f0f0-0000-4000-8000-00000000dead', reason: 'missing' },
      ]);
      const job = referrals.get(started.referralId)?.pendingJob;
      expect(job?.agents?.map((agent) => agent.name)).toEqual(['chief-of-staff', 'technology-advisor']);
      expect(job).not.toHaveProperty('rosterWorkflows');

      const draft = await startFrontDoor([DRAFT_WF]);
      expect(draft.roster).toEqual({ used: [], skipped: [{ id: DRAFT_WF, reason: 'draft' }] });
      expect(referrals.get(draft.referralId)?.pendingJob?.agents).toEqual([
        { name: 'chief-of-staff', instructions: CHIEF_OF_STAFF_INSTRUCTIONS },
      ]);
    });

    it('with an empty roster is today\'s one-role run, byte for byte', async () => {
      const none = await startFrontDoor(null);
      const empty = await startFrontDoor([]);
      const expectedBrief = buildCollaborationProjectInstructions({
        agents: [{ name: 'chief-of-staff', instructions: CHIEF_OF_STAFF_INSTRUCTIONS }],
        agentName: 'chief-of-staff',
      });
      expect(expectedBrief).toBe(
        `You are chief-of-staff.\n${CHIEF_OF_STAFF_INSTRUCTIONS}\n\nOther agents:\nnone\n\n` +
          'Ask another agent only when you genuinely need them. At most one request, alone at the very end of the answer, exactly <handoff to="name">task</handoff>. Otherwise no request.',
      );
      for (const started of [none, empty]) {
        expect(started.roster).toEqual({ used: [], skipped: [] });
        const job = referrals.get(started.referralId)?.pendingJob as unknown as Record<string, unknown>;
        expect(Object.keys(job).sort()).toEqual(
          [
            'adapter',
            'agents',
            'apiKeyId',
            'callerProjectInstructions',
            'conversationId',
            'decidedBy',
            'decisionReason',
            'fileAccess',
            'globalInstructions',
            'handoffNote',
            'model',
            'orchestrationPriority',
            'projectInstructions',
            'prompt',
            'provider',
            'sessionId',
            'workspaceContext',
          ].sort(),
        );
        expect(job.agents).toEqual([
          { name: 'chief-of-staff', instructions: CHIEF_OF_STAFF_INSTRUCTIONS },
        ]);
        expect(Object.keys((job.agents as object[])[0])).toEqual(['name', 'instructions']);
        expect(job.projectInstructions).toBe(expectedBrief);
        expect(job.callerProjectInstructions).toBeNull();
      }

      // A tag is still refused, there is no report-back, and the run completes on its answer.
      const detail = await runStep(
        none.collaborationRunId,
        none.referralId,
        'Done.\n<handoff to="product-strategy">Ask.</handoff>',
      );
      expect(detail.handoffs).toHaveLength(1);
      expect(detail.handoffs[0].handoffNote).toBe('refused: agent_not_on_list');
      expect(detail.run.status).toBe('completed');
      expect(detail.agents).toEqual([{ name: 'chief-of-staff', label: null }]);
    });

    it('starts without a session on the business rows with the caller note; coding and advisors still need one', async () => {
      const started = await startFrontDoor(['product-strategy'], {});
      expect(projectRows).toHaveLength(1);
      expect(businessSessionRows).toHaveLength(1);
      const job = referrals.get(started.referralId)?.pendingJob;
      expect(job?.sessionId).toBe(businessSessionRows[0].id);
      expect(job?.callerProjectInstructions).toBe(COLLABORATION_BUSINESS_RUN_NOTE);
      expect(String(job?.projectInstructions).startsWith(`${COLLABORATION_BUSINESS_RUN_NOTE}\n\n`)).toBe(
        true,
      );
      expect(runs.get(started.collaborationRunId)?.projectId).toBe(projectRows[0].id);

      // The member's step and the report-back keep the business session and the note.
      await runStep(
        started.collaborationRunId,
        started.referralId,
        'Asking.\n<handoff to="product-strategy">Market size?</handoff>',
      );
      const child = last(started.collaborationRunId);
      expect(child.pendingJob?.sessionId).toBe(businessSessionRows[0].id);
      expect(String(child.pendingJob?.projectInstructions).startsWith(COLLABORATION_BUSINESS_RUN_NOTE)).toBe(
        true,
      );
      await runStep(started.collaborationRunId, child.referralId, 'Large.');
      const reportBack = last(started.collaborationRunId);
      expect(reportBack.targetBuilderProfileId).toBe('chief-of-staff');
      expect(reportBack.pendingJob?.sessionId).toBe(businessSessionRows[0].id);

      for (const team of ['coding', 'advisors', undefined]) {
        await http()
          .post('/api/collaboration/runs')
          .send({ task: OWNER_TASK, ...(team ? { team } : {}) })
          .expect(400);
      }
      expect(projectRows).toHaveLength(1);
    });

    it('runs two rounds: dispatch, report-back, dispatch to a workflow, report-back, final answer', async () => {
      await testRunWorkflow();
      const started = await startFrontDoor(['product-strategy', WF]);
      const runId = started.collaborationRunId;

      await runStep(
        runId,
        started.referralId,
        'I need market data.\n<handoff to="product-strategy">What is the market size?</handoff>',
      );
      const d1 = last(runId);
      expect(d1).toMatchObject({
        sourceBuilderProfileId: 'chief-of-staff',
        targetBuilderProfileId: 'product-strategy',
        status: 'pending_approval',
        depth: 1,
      });
      expect(d1.pendingJob?.workflow ?? null).toBeNull();
      expect(d1.pendingJob?.provider).toBe('stub');

      const afterD1 = await runStep(runId, d1.referralId, 'The market is large.');
      const rb1 = last(runId);
      expect(rb1).toMatchObject({
        sourceBuilderProfileId: 'product-strategy',
        targetBuilderProfileId: 'chief-of-staff',
        status: 'pending_approval',
        idempotencyKey: reportBackIdempotencyKey(d1.referralId),
        depth: 2,
        parentReferralTraceId: d1.referralTraceId,
      });
      expect(rb1.pendingJob?.prompt).toBe(
        buildReportBackPrompt({
          ownerTask: OWNER_TASK,
          label: 'Product Strategy',
          answer: 'The market is large.',
        }),
      );
      expect(rb1.pendingJob?.decidedBy).toBeNull();
      expect(afterD1.run.status).toBe('active');
      expect(referrals.get(d1.referralId)?.pendingJob?.reportBackChecked).toBe(true);
      // Reading again (and the sweep) creates no second report-back.
      await readRun(runId);
      await service().sweepCollaborations();
      expect(
        steps(runId).filter((row) => row.idempotencyKey === reportBackIdempotencyKey(d1.referralId)),
      ).toHaveLength(1);

      await runStep(
        runId,
        rb1.referralId,
        `Now the mail.\n<handoff to="${WF}">Summarize my unread mail.</handoff>`,
      );
      expect(referrals.get(rb1.referralId)?.pendingJob?.handoffNote ?? null).toBeNull();
      const d2 = last(runId);
      const snapshot = referrals.get(started.referralId)?.pendingJob?.rosterWorkflows?.[0];
      expect(d2).toMatchObject({
        sourceBuilderProfileId: 'chief-of-staff',
        targetBuilderProfileId: WF,
        status: 'pending_approval',
        depth: 3,
      });
      expect(d2.pendingJob?.workflow).toEqual(snapshot);
      expect(d2.pendingJob?.workflow?.testRun).toBe(false);

      await approve(runId, d2.referralId);
      const intent = ledger.writeExecutionIntent.mock.calls.at(-1)?.[0];
      expect(intent.builderProfileId).toBe(WF);
      expect(intent.metadata).toMatchObject({
        agentDefinitionId: WF,
        agentDefinitionVersion: snapshot?.version,
      });
      expect(intent.metadata).not.toHaveProperty('workflowTestRun');
      finish(d2.referralId, 'Two unread mails.');
      await readRun(runId);
      const rb2 = last(runId);
      expect(rb2).toMatchObject({
        sourceBuilderProfileId: WF,
        targetBuilderProfileId: 'chief-of-staff',
        status: 'pending_approval',
        depth: 4,
      });
      expect(rb2.pendingJob?.prompt).toContain('Mail digest answered:\nTwo unread mails.');
      expect(rb2.pendingJob?.workflow ?? null).toBeNull();

      const done = await runStep(runId, rb2.referralId, 'Here is your week.');
      expect(done.run.status).toBe('completed');
      expect(steps(runId)).toHaveLength(5);
      expect(finalAnswerOf(steps(runId))).toBe('Here is your week.');
      expect(done.agents).toEqual([
        { name: 'chief-of-staff', label: 'Chief of Staff' },
        { name: 'product-strategy', label: 'Product Strategy' },
        { name: WF, label: 'Mail digest' },
      ]);
      expect(done.teamId).toBe('chief-of-staff');
      for (const step of steps(runId)) {
        expect(step.pendingJob?.decidedBy).toBe(OWNER_ID);
      }

      // HARNESS_ENTITLEMENT_PROOF_V1 used, not changed: every front-door job, including
      // a report-back and a workflow member, is signed with the chief-of-staff key set.
      const cosKeys = Object.keys(jobOf(started.referralId)).sort();
      expect(cosKeys).toContain('harnessEntitlementProof');
      for (const step of [d1, rb1, d2, rb2]) {
        expect(Object.keys(jobOf(step.referralId)).sort()).toEqual(cosKeys);
      }
      expect(jobOf(d2.referralId).builderProfileId).toBe(WF);
      expect(jobOf(rb1.referralId).builderProfileId).toBe('chief-of-staff');
    });

    it('refuses a third round and a second dispatch to the same member', async () => {
      await testRunWorkflow();
      const started = await startFrontDoor(['product-strategy', 'technology-advisor', WF]);
      const runId = started.collaborationRunId;
      await runStep(runId, started.referralId, 'Q.\n<handoff to="product-strategy">Market?</handoff>');
      await runStep(runId, last(runId).referralId, 'Large.');
      const rb1 = last(runId);
      await runStep(runId, rb1.referralId, 'Q.\n<handoff to="technology-advisor">Stack?</handoff>');
      await runStep(runId, last(runId).referralId, 'Modern.');
      const rb2 = last(runId);
      expect(rb2.targetBuilderProfileId).toBe('chief-of-staff');
      service().clearAuditEvents();
      const done = await runStep(runId, rb2.referralId, `Final.\n<handoff to="${WF}">Mail?</handoff>`);
      expect(referrals.get(rb2.referralId)?.pendingJob?.handoffNote).toBe('refused: front_door_rounds');
      expect(
        service()
          .getAuditEvents()
          .some((event) => event.payload.lifecycleEvent === 'referral_front_door_rounds_blocked'),
      ).toBe(true);
      expect(steps(runId)).toHaveLength(5);
      expect(done.run.status).toBe('completed');
      expect(finalAnswerOf(steps(runId))).toBe('Final.\n<handoff to="' + WF + '">Mail?</handoff>');

      const again = await startFrontDoor(['product-strategy', 'technology-advisor']);
      await runStep(again.collaborationRunId, again.referralId, 'Q.\n<handoff to="product-strategy">A?</handoff>');
      await runStep(again.collaborationRunId, last(again.collaborationRunId).referralId, 'B.');
      const rb = last(again.collaborationRunId);
      await runStep(again.collaborationRunId, rb.referralId, 'Q.\n<handoff to="product-strategy">Again?</handoff>');
      expect(referrals.get(rb.referralId)?.pendingJob?.handoffNote).toBe('refused: loop');
      expect(steps(again.collaborationRunId)).toHaveLength(3);
    });

    it("refuses a member's own tag as roster_reply and reports its answer back without the tag", async () => {
      const started = await startFrontDoor(['product-strategy', 'technology-advisor']);
      const runId = started.collaborationRunId;
      await runStep(runId, started.referralId, 'Q.\n<handoff to="product-strategy">Market?</handoff>');
      const d1 = last(runId);
      await runStep(runId, d1.referralId, 'Large market.\n<handoff to="technology-advisor">Check the stack.</handoff>');
      expect(referrals.get(d1.referralId)?.pendingJob?.handoffNote).toBe('refused: roster_reply');
      const rb = last(runId);
      expect(rb.targetBuilderProfileId).toBe('chief-of-staff');
      expect(rb.pendingJob?.prompt).toContain('Product Strategy answered:\nLarge market.\n\n');
      expect(rb.pendingJob?.prompt).not.toContain('<handoff');

      const other = await startFrontDoor(['product-strategy']);
      await runStep(other.collaborationRunId, other.referralId, 'Q.\n<handoff to="product-strategy">Market?</handoff>');
      const child = last(other.collaborationRunId);
      await runStep(other.collaborationRunId, child.referralId, 'A.\n<handoff to="chief-of-staff">Back.</handoff>');
      expect(referrals.get(child.referralId)?.pendingJob?.handoffNote).toBe('refused: roster_reply');
    });

    it('refuses a Chief of Staff tag to an agent that is not on the roster', async () => {
      const started = await startFrontDoor(['product-strategy']);
      await runStep(
        started.collaborationRunId,
        started.referralId,
        'Q.\n<handoff to="technology-advisor">Stack?</handoff>',
      );
      expect(referrals.get(started.referralId)?.pendingJob?.handoffNote).toBe(
        'refused: agent_not_on_list',
      );
      expect(steps(started.collaborationRunId)).toHaveLength(1);
    });

    it("completes on the agent's answer when the owner rejects the report-back", async () => {
      const started = await startFrontDoor(['product-strategy']);
      const runId = started.collaborationRunId;
      await runStep(runId, started.referralId, 'Q.\n<handoff to="product-strategy">Market?</handoff>');
      await runStep(runId, last(runId).referralId, 'The agent answer.');
      const rb = last(runId);
      await http()
        .post(`/api/collaboration/runs/${runId}/referrals/${rb.referralId}/reject`)
        .send({ reason: 'enough' })
        .expect(200);
      const detail = await readRun(runId);
      expect(detail.run.status).toBe('completed');
      expect(finalAnswerOf(steps(runId))).toBe('The agent answer.');
      expect(steps(runId)).toHaveLength(3);
    });

    it('fails the run with no report-back when the member fails', async () => {
      const started = await startFrontDoor(['product-strategy']);
      const runId = started.collaborationRunId;
      await runStep(runId, started.referralId, 'Q.\n<handoff to="product-strategy">Market?</handoff>');
      const d1 = last(runId);
      const detail = await runStep(runId, d1.referralId, '', 'failed');
      expect(referrals.get(d1.referralId)?.status).toBe('failed');
      expect(steps(runId)).toHaveLength(2);
      expect(detail.run.status).toBe('failed');
      await service().sweepCollaborations();
      expect(steps(runId)).toHaveLength(2);
    });

    it('waits to settle while a report-back is missing, and the sweep recovers it', async () => {
      const started = await startFrontDoor(['product-strategy']);
      const runId = started.collaborationRunId;
      await runStep(runId, started.referralId, 'Q.\n<handoff to="product-strategy">Market?</handoff>');
      const d1 = last(runId);
      await runStep(runId, d1.referralId, 'Large.');
      const rb = last(runId);
      // Simulate a gateway stop between the member's completion and the report-back.
      referrals.delete(rb.referralId);
      const run = runs.get(runId)!;
      run.referralIds = run.referralIds.filter((id) => id !== rb.referralId);
      const member = referrals.get(d1.referralId)!;
      member.pendingJob = { ...member.pendingJob!, reportBackChecked: undefined };
      expect(steps(runId).every((row) => row.status === 'completed')).toBe(true);

      const settle = (
        service() as unknown as {
          settleCollaborationRun: (id: string, rows: Array<{ status: string }>) => Promise<{ status: string }>;
        }
      ).settleCollaborationRun.bind(service());
      const settled = await settle(runId, steps(runId).map((row) => ({ status: row.status })));
      expect(settled.status).toBe('active');
      expect(runs.get(runId)?.status).toBe('active');

      await service().sweepCollaborations();
      const recovered = steps(runId).filter(
        (row) => row.idempotencyKey === reportBackIdempotencyKey(d1.referralId),
      );
      expect(recovered).toHaveLength(1);
      expect(recovered[0].status).toBe('pending_approval');
      expect(runs.get(runId)?.status).toBe('active');
    });

    it('re-checks a workflow member at approve and runs it on its own model', async () => {
      workflowRows.set(WF, memberRow({ budgetPerDayCredits: 5 }));
      await testRunWorkflow();
      const started = await startFrontDoor([WF]);
      const runId = started.collaborationRunId;
      await runStep(runId, started.referralId, `Q.\n<handoff to="${WF}">Mail?</handoff>`);
      const child = last(runId);
      expect(child.pendingJob?.workflow?.budgetPerDayCredits).toBe(5);

      const testExecution = [...referrals.values()].find(
        (row) => row.targetBuilderProfileId === WF && row.pendingJob?.workflow?.testRun === true,
      )?.executionId;
      deductionRows.push({
        ownerId: OWNER_ID,
        sourceEventId: testExecution,
        requestedCredits: 5,
        createdAt: new Date(),
      });
      const calls = queue.enqueueExecution.mock.calls.length;
      const overBudget = await approve(runId, child.referralId, 429);
      expect(overBudget.body.code).toBe('WORKFLOW_BUDGET_DAY');
      deductionRows.length = 0;
      workflowRows.set(WF, memberRow({ budgetPerDayCredits: 5, status: 'disabled' }));
      const off = await approve(runId, child.referralId, 409);
      expect(off.body.code).toBe('WORKFLOW_DISABLED');
      expect(queue.enqueueExecution.mock.calls.length).toBe(calls);
      expect(referrals.get(child.referralId)?.status).toBe('pending_approval');

      workflowRows.set(WF, memberRow({ model: { choice: 'platform', id: 'claude-haiku-5-5' } }));
      await testRunWorkflow();
      const platform = await startFrontDoor([WF]);
      await runStep(platform.collaborationRunId, platform.referralId, `Q.\n<handoff to="${WF}">Mail?</handoff>`);
      const platformChild = last(platform.collaborationRunId);
      expect(platformChild.pendingJob).toMatchObject({
        provider: 'anthropic',
        adapter: 'anthropic',
        model: 'claude-haiku-5-5',
      });
      await runStep(platform.collaborationRunId, platformChild.referralId, 'Mail.');
      const reportBack = last(platform.collaborationRunId);
      expect(reportBack.targetBuilderProfileId).toBe('chief-of-staff');
      expect(reportBack.pendingJob).toMatchObject({ provider: 'stub', model: 'stub' });
    });

    it('signs a report-back job and a workflow member job with the chief-of-staff key set', async () => {
      const plain = await startFrontDoor([]);
      await approve(plain.collaborationRunId, plain.referralId);
      const cosKeys = Object.keys(jobOf(plain.referralId)).sort();

      await testRunWorkflow();
      const started = await startFrontDoor([WF]);
      const runId = started.collaborationRunId;
      await runStep(runId, started.referralId, `Q.\n<handoff to="${WF}">Mail?</handoff>`);
      const child = last(runId);
      await runStep(runId, child.referralId, 'Mail.');
      const rb = last(runId);
      await approve(runId, rb.referralId);

      expect(Object.keys(jobOf(started.referralId)).sort()).toEqual(cosKeys);
      expect(Object.keys(jobOf(child.referralId)).sort()).toEqual(cosKeys);
      expect(Object.keys(jobOf(rb.referralId)).sort()).toEqual(cosKeys);
    });
  });

  describe('USER-TEAMS-01B user-team runs with report-back', () => {
    const LEAD = 'f0f0f0f0-0000-4000-8000-0000000000a1';
    const WF2 = 'f0f0f0f0-0000-4000-8000-0000000000a2';
    const DRAFT_WF = 'f0f0f0f0-0000-4000-8000-0000000000a3';
    const OFF_WF = 'f0f0f0f0-0000-4000-8000-0000000000a4';
    const UNTESTED_WF = 'f0f0f0f0-0000-4000-8000-0000000000a5';
    const GONE_WF = 'f0f0f0f0-0000-4000-8000-00000000dead';
    const OWNER_TASK = 'Plan my week around the market and my mail.';
    const outputs = new Map<string, { status: string; output: string }>();

    function leadRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
      return {
        id: LEAD,
        userId: OWNER_ID,
        name: 'Weekly plan',
        role: 'Assistant',
        description: 'Plans the week.',
        status: 'active',
        tone: null,
        replyLanguage: null,
        purpose: 'You plan the owner\'s week.',
        procedure: 'Ask the team when you need facts, then write the plan.',
        result: 'A short plan.',
        toolProfile: 'read',
        knowledgeScopeIds: ['market-data'],
        connectorToolIds: [],
        model: { choice: 'platform', id: 'claude-haiku-5-5' },
        budgetPerRunCredits: null,
        budgetPerDayCredits: null,
        templateId: null,
        teamMemberIds: ['product-strategy', WF2],
        ...overrides,
      };
    }

    function memberRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
      return {
        id: WF2,
        userId: OWNER_ID,
        name: 'Mail digest',
        role: 'Assistant',
        description: 'Summarizes unread mail.',
        status: 'active',
        tone: null,
        replyLanguage: null,
        purpose: 'You summarize the owner\'s unread mail.',
        procedure: 'Call mail_list_unread_metadata and list each message in one line.',
        result: 'A short list.',
        toolProfile: 'read',
        knowledgeScopeIds: ['policies'],
        connectorToolIds: ['mail_list_unread_metadata'],
        model: { choice: 'server' },
        budgetPerRunCredits: null,
        budgetPerDayCredits: null,
        templateId: null,
        // D12: the member's own team; never read in a run it does not lead.
        teamMemberIds: [LEAD, 'technology-advisor'],
        ...overrides,
      };
    }

    function service(): OrchestrationService {
      return app.get(OrchestrationService);
    }

    function steps(runId: string): CollaborationReferralEntity[] {
      return (runs.get(runId)?.referralIds ?? []).map((id) => referrals.get(id)!);
    }

    function last(runId: string): CollaborationReferralEntity {
      const all = steps(runId);
      return all[all.length - 1];
    }

    function jobOf(referralId: string): Record<string, unknown> {
      const executionId = referrals.get(referralId)?.executionId;
      const call = queue.enqueueExecution.mock.calls.find(
        (args) => (args[0] as { executionId: string }).executionId === executionId,
      );
      if (!call) {
        throw new Error(`no job for ${referralId}`);
      }
      return call[0] as Record<string, unknown>;
    }

    function intentOf(referralId: string): Record<string, unknown> {
      const executionId = referrals.get(referralId)?.executionId;
      const call = ledger.writeExecutionIntent.mock.calls.find(
        (args) => (args[0] as { executionId: string }).executionId === executionId,
      );
      if (!call) {
        throw new Error(`no intent for ${referralId}`);
      }
      return call[0] as Record<string, unknown>;
    }

    async function approve(runId: string, referralId: string, expected = 200) {
      return http()
        .post(`/api/collaboration/runs/${runId}/referrals/${referralId}/approve`)
        .send({})
        .expect(expected);
    }

    function finish(referralId: string, output: string, status = 'completed'): void {
      const executionId = referrals.get(referralId)?.executionId;
      if (!executionId) {
        throw new Error(`no execution for ${referralId}`);
      }
      outputs.set(executionId, { status, output });
    }

    async function readRun(runId: string) {
      return (await http().get(`/api/collaboration/runs/${runId}`).expect(200)).body as {
        run: { status: string };
        teamId: string;
        team: string[];
        workflow: { id: string; name: string; testRun: boolean } | null;
        agents: Array<{ name: string; label: string | null }>;
        handoffs: Array<Record<string, unknown>>;
      };
    }

    async function runStep(runId: string, referralId: string, output: string, status = 'completed') {
      await approve(runId, referralId);
      finish(referralId, output, status);
      return readRun(runId);
    }

    type StartBody = {
      collaborationRunId: string;
      referralId: string;
      roster?: { used: string[]; skipped: Array<{ id: string; reason: string }> };
    } & Record<string, unknown>;

    async function startLead(body: Record<string, unknown> = {}): Promise<StartBody> {
      const started = await http()
        .post('/api/collaboration/runs')
        .send({ sessionId: SESSION_ID, task: OWNER_TASK, workflowId: LEAD, ...body })
        .expect(201);
      return started.body as StartBody;
    }

    /** A completed test run of `id`, so a normal run (or a member) is allowed. */
    async function testRunWorkflow(id: string): Promise<void> {
      const started = await http()
        .post('/api/collaboration/runs')
        .send({ sessionId: SESSION_ID, task: 'Test it.', workflowId: id, testRun: true })
        .expect(201);
      await runStep(started.body.collaborationRunId, started.body.referralId, 'Tested.');
      expect(referrals.get(started.body.referralId)?.status).toBe('completed');
    }

    async function testTeam(): Promise<void> {
      await testRunWorkflow(WF2);
      await testRunWorkflow(LEAD);
    }

    function snapshotOf(row: Record<string, unknown>, testRun: boolean) {
      const rendered = renderWorkflow(row as never)!;
      return {
        id: row.id,
        name: row.name,
        version: rendered.version,
        knowledgeScopeIds: rendered.knowledgeScopeIds,
        connectorToolIds: rendered.connectorToolIds,
        model: row.model,
        testRun,
        budgetPerRunCredits: row.budgetPerRunCredits ?? null,
        budgetPerDayCredits: row.budgetPerDayCredits ?? null,
      };
    }

    beforeEach(() => {
      outputs.clear();
      workflowRows.set(LEAD, leadRow());
      workflowRows.set(WF2, memberRow());
      workflowRows.set(DRAFT_WF, memberRow({ id: DRAFT_WF, name: 'Draft flow', status: 'draft' }));
      workflowRows.set(OFF_WF, memberRow({ id: OFF_WF, name: 'Off flow', status: 'disabled' }));
      workflowRows.set(UNTESTED_WF, memberRow({ id: UNTESTED_WF, name: 'New flow' }));
      executionResults.getExecution.mockImplementation(async (executionId: string) => {
        const stored = outputs.get(executionId);
        return stored
          ? {
              execution_status: stored.status,
              metadata: { aiExecutionResult: { output: stored.output } },
            }
          : null;
      });
    });

    it('starts a workflow with its team: the labelled lead, the members, teamLeadId and the snapshots, none from the body', async () => {
      await testTeam();
      const started = await startLead({
        agents: [{ name: 'hacker', instructions: 'pwn' }],
        rosterWorkflows: [{ id: 'hacker' }],
        teamLeadId: 'hacker',
        teamMemberIds: ['technology-advisor'],
      });
      const stored = referrals.get(started.referralId);
      const job = stored?.pendingJob;
      const lead = renderWorkflow(workflowRows.get(LEAD) as never)!;
      const member = renderWorkflow(workflowRows.get(WF2) as never)!;
      const ps = systemAgentById('product-strategy')!;

      expect(started.roster).toEqual({ used: ['product-strategy', WF2], skipped: [] });
      expect(started.target).toBe(LEAD);
      expect(stored?.targetBuilderProfileId).toBe(LEAD);
      expect(job?.agents).toEqual([
        {
          name: LEAD,
          instructions: lead.instructions,
          label: 'Weekly plan',
          summary: teamLeadSummary('Weekly plan'),
        },
        {
          name: 'product-strategy',
          instructions: ps.instructions,
          label: 'Product Strategy',
          summary: "Answers product and market questions from the owner's market documents.",
        },
        {
          name: WF2,
          instructions: member.instructions,
          label: 'Mail digest',
          summary: 'Summarizes unread mail.',
        },
      ]);
      expect(job?.teamLeadId).toBe(LEAD);
      expect(job?.workflow).toEqual(snapshotOf(workflowRows.get(LEAD)!, false));
      expect(job?.rosterWorkflows).toEqual([snapshotOf(workflowRows.get(WF2)!, false)]);
      expect(job).toMatchObject({ provider: 'anthropic', adapter: 'anthropic', model: 'claude-haiku-5-5' });
      const brief = String(job?.projectInstructions);
      expect(brief).toContain(`You are ${LEAD}.`);
      expect(brief).toContain(
        "- product-strategy (Product Strategy): Answers product and market questions from the owner's market documents.",
      );
      expect(brief).toContain(`- ${WF2} (Mail digest): Summarizes unread mail.`);
      expect(brief).not.toContain(ps.instructions);
      const text = JSON.stringify(job);
      for (const leaked of ['pwn', 'hacker', 'technology-advisor']) {
        expect(text).not.toContain(leaked);
      }
    });

    it('leaves out a draft, an off, an untested and a missing member, and drops the lead itself silently', async () => {
      await testRunWorkflow(LEAD);
      workflowRows.set(LEAD, leadRow({ teamMemberIds: [LEAD, DRAFT_WF, OFF_WF] }));
      const none = await startLead();
      expect(none.roster).toEqual({
        used: [],
        skipped: [
          { id: DRAFT_WF, reason: 'draft' },
          { id: OFF_WF, reason: 'off' },
        ],
      });
      const alone = referrals.get(none.referralId)?.pendingJob as unknown as Record<string, unknown>;
      expect(alone.agents).toEqual([
        { name: LEAD, instructions: renderWorkflow(workflowRows.get(LEAD) as never)!.instructions },
      ]);
      expect(alone).not.toHaveProperty('teamLeadId');
      expect(alone).not.toHaveProperty('rosterWorkflows');

      workflowRows.set(LEAD, leadRow({ teamMemberIds: [UNTESTED_WF, GONE_WF, 'technology-advisor'] }));
      const some = await startLead();
      expect(some.roster).toEqual({
        used: ['technology-advisor'],
        skipped: [
          { id: UNTESTED_WF, reason: 'not_tested' },
          { id: GONE_WF, reason: 'missing' },
        ],
      });
      const job = referrals.get(some.referralId)?.pendingJob;
      expect(job?.agents?.map((agent) => agent.name)).toEqual([LEAD, 'technology-advisor']);
      expect(job?.teamLeadId).toBe(LEAD);
      expect(job).not.toHaveProperty('rosterWorkflows');
    });

    it('with an empty team is today\'s team of one, byte for byte, and has no roster', async () => {
      await testRunWorkflow(LEAD);
      const jobs: string[] = [];
      for (const team of [undefined, [], [LEAD]]) {
        const row = leadRow({ teamMemberIds: team });
        if (team === undefined) {
          delete row.teamMemberIds;
        }
        workflowRows.set(LEAD, row);
        const started = await startLead();
        expect(started).not.toHaveProperty('roster');
        const job = referrals.get(started.referralId)?.pendingJob as unknown as Record<string, unknown>;
        expect(Object.keys(job).sort()).toEqual(
          [
            'adapter',
            'agents',
            'apiKeyId',
            'callerProjectInstructions',
            'conversationId',
            'decidedBy',
            'decisionReason',
            'fileAccess',
            'globalInstructions',
            'handoffNote',
            'model',
            'orchestrationPriority',
            'projectInstructions',
            'prompt',
            'provider',
            'sessionId',
            'workflow',
            'workspaceContext',
          ].sort(),
        );
        expect(Object.keys((job.agents as object[])[0])).toEqual(['name', 'instructions']);
        jobs.push(JSON.stringify(job));
      }
      expect(new Set(jobs).size).toBe(1);
      const job = JSON.parse(jobs[0]) as Record<string, unknown>;
      expect(job.projectInstructions).toBe(
        buildCollaborationProjectInstructions({
          agents: job.agents as never,
          agentName: LEAD,
        }),
      );
    });

    it('runs two rounds: dispatch, report-back on the lead snapshot and model, dispatch to a workflow, report-back, final answer', async () => {
      await testTeam();
      const started = await startLead();
      const runId = started.collaborationRunId;
      const leadSnapshot = referrals.get(started.referralId)?.pendingJob?.workflow;
      const memberSnapshot = referrals.get(started.referralId)?.pendingJob?.rosterWorkflows?.[0];

      await runStep(
        runId,
        started.referralId,
        'I need market data.\n<handoff to="product-strategy">What is the market size?</handoff>',
      );
      const d1 = last(runId);
      expect(d1).toMatchObject({
        sourceBuilderProfileId: LEAD,
        targetBuilderProfileId: 'product-strategy',
        status: 'pending_approval',
        depth: 1,
      });
      expect(d1.pendingJob?.workflow ?? null).toBeNull();
      expect(d1.pendingJob?.teamLeadId).toBe(LEAD);
      // A system member runs on the step's provider, as in a Chief of Staff run.
      expect(d1.pendingJob).toMatchObject({ provider: 'anthropic', model: 'claude-haiku-5-5' });

      const afterD1 = await runStep(runId, d1.referralId, 'The market is large.');
      const rb1 = last(runId);
      expect(rb1).toMatchObject({
        sourceBuilderProfileId: 'product-strategy',
        targetBuilderProfileId: LEAD,
        status: 'pending_approval',
        idempotencyKey: reportBackIdempotencyKey(d1.referralId),
        depth: 2,
        parentReferralTraceId: d1.referralTraceId,
      });
      expect(rb1.pendingJob?.prompt).toBe(
        buildReportBackPrompt({ ownerTask: OWNER_TASK, label: 'Product Strategy', answer: 'The market is large.' }),
      );
      // D10: the report-back step carries the lead's own snapshot and runs on its model.
      expect(rb1.pendingJob?.workflow).toEqual(leadSnapshot);
      expect(rb1.pendingJob).toMatchObject({
        provider: 'anthropic',
        adapter: 'anthropic',
        model: 'claude-haiku-5-5',
        teamLeadId: LEAD,
        decidedBy: null,
      });
      expect(afterD1.run.status).toBe('active');
      await readRun(runId);
      await service().sweepCollaborations();
      expect(
        steps(runId).filter((row) => row.idempotencyKey === reportBackIdempotencyKey(d1.referralId)),
      ).toHaveLength(1);

      await approve(runId, rb1.referralId);
      expect(intentOf(rb1.referralId)).toMatchObject({
        builderProfileId: LEAD,
        metadata: expect.objectContaining({
          agentDefinitionId: LEAD,
          agentDefinitionVersion: leadSnapshot?.version,
          requestedProvider: 'anthropic',
          requestedModel: 'claude-haiku-5-5',
        }),
      });
      expect(intentOf(rb1.referralId).metadata).not.toHaveProperty('workflowTestRun');
      expect(jobOf(rb1.referralId)).toMatchObject({
        builderProfileId: LEAD,
        harnessToolProfile: 'read',
        harnessReadOnly: true,
        knowledgeScopes: jobOf(started.referralId).knowledgeScopes,
      });
      finish(rb1.referralId, `Now the mail.\n<handoff to="${WF2}">Summarize my unread mail.</handoff>`);
      await readRun(runId);
      expect(referrals.get(rb1.referralId)?.pendingJob?.handoffNote ?? null).toBeNull();

      const d2 = last(runId);
      expect(d2).toMatchObject({
        sourceBuilderProfileId: LEAD,
        targetBuilderProfileId: WF2,
        status: 'pending_approval',
        depth: 3,
      });
      expect(d2.pendingJob?.workflow).toEqual(memberSnapshot);
      expect(d2.pendingJob).toMatchObject({ provider: 'stub', model: 'stub', teamLeadId: LEAD });
      await approve(runId, d2.referralId);
      expect(intentOf(d2.referralId)).toMatchObject({
        builderProfileId: WF2,
        metadata: expect.objectContaining({
          agentDefinitionId: WF2,
          agentDefinitionVersion: memberSnapshot?.version,
        }),
      });
      // D12: the member's own team (the lead and technology-advisor) is never read; its tag is refused.
      finish(d2.referralId, 'Two unread mails.\n<handoff to="technology-advisor">Check the stack.</handoff>');
      await readRun(runId);
      expect(referrals.get(d2.referralId)?.pendingJob?.handoffNote).toBe('refused: roster_reply');
      const rb2 = last(runId);
      expect(rb2).toMatchObject({
        sourceBuilderProfileId: WF2,
        targetBuilderProfileId: LEAD,
        status: 'pending_approval',
        depth: 4,
      });
      expect(rb2.pendingJob?.prompt).toContain('Mail digest answered:\nTwo unread mails.\n\n');
      expect(rb2.pendingJob?.prompt).not.toContain('<handoff');
      expect(rb2.pendingJob?.workflow).toEqual(leadSnapshot);

      const done = await runStep(runId, rb2.referralId, 'Here is your week.');
      expect(done.run.status).toBe('completed');
      expect(steps(runId)).toHaveLength(5);
      expect(finalAnswerOf(steps(runId))).toBe('Here is your week.');
      expect(done.teamId).toBe('workflow');
      expect(done.workflow).toEqual({ id: LEAD, name: 'Weekly plan', testRun: false });
      expect(done.agents).toEqual([
        { name: LEAD, label: 'Weekly plan' },
        { name: 'product-strategy', label: 'Product Strategy' },
        { name: WF2, label: 'Mail digest' },
      ]);
      // A member workflow's unsourced answer is labelled like the lead's.
      expect(done.handoffs.find((step) => step.referralId === d2.referralId)).toMatchObject({
        unsourced: true,
        showUnsourced: true,
      });
      for (const step of steps(runId)) {
        expect(step.pendingJob?.decidedBy).toBe(OWNER_ID);
        expect(step.pendingJob?.teamLeadId).toBe(LEAD);
        expect(step.pendingJob?.agents).toEqual(referrals.get(started.referralId)?.pendingJob?.agents);
      }

      // HARNESS_ENTITLEMENT_PROOF_V1 used, not changed: the lead's first step, the
      // dispatches and the report-backs are signed with the chief-of-staff key set.
      const cos = await http()
        .post('/api/collaboration/runs')
        .send({ sessionId: SESSION_ID, task: OWNER_TASK, team: 'chief-of-staff' })
        .expect(201);
      await approve(cos.body.collaborationRunId, cos.body.referralId);
      const cosKeys = Object.keys(jobOf(cos.body.referralId)).sort();
      expect(cosKeys).toContain('harnessEntitlementProof');
      expect(cosKeys).not.toContain('teamLeadId');
      for (const step of steps(runId)) {
        expect(Object.keys(jobOf(step.referralId)).sort()).toEqual(cosKeys);
      }
    });

    it('refuses a second dispatch to the same member and a tag to an agent off the team', async () => {
      await testRunWorkflow(LEAD);
      workflowRows.set(LEAD, leadRow({ teamMemberIds: ['product-strategy', 'technology-advisor'] }));
      const started = await startLead();
      const runId = started.collaborationRunId;
      await runStep(runId, started.referralId, 'Q.\n<handoff to="product-strategy">Market?</handoff>');
      await runStep(runId, last(runId).referralId, 'Large.');
      const rb1 = last(runId);
      await runStep(runId, rb1.referralId, 'Q.\n<handoff to="product-strategy">Again?</handoff>');
      expect(referrals.get(rb1.referralId)?.pendingJob?.handoffNote).toBe('refused: loop');
      expect(steps(runId)).toHaveLength(3);

      const off = await startLead();
      await runStep(off.collaborationRunId, off.referralId, 'Q.\n<handoff to="writer">Write it.</handoff>');
      expect(referrals.get(off.referralId)?.pendingJob?.handoffNote).toBe('refused: agent_not_on_list');
      expect(steps(off.collaborationRunId)).toHaveLength(1);
    });

    it('caps the rounds at two with an audit event', async () => {
      await testTeam();
      workflowRows.set(LEAD, leadRow({ teamMemberIds: ['product-strategy', 'technology-advisor', WF2] }));
      const started = await startLead();
      const runId = started.collaborationRunId;
      await runStep(runId, started.referralId, 'Q.\n<handoff to="product-strategy">Market?</handoff>');
      await runStep(runId, last(runId).referralId, 'Large.');
      await runStep(runId, last(runId).referralId, 'Q.\n<handoff to="technology-advisor">Stack?</handoff>');
      await runStep(runId, last(runId).referralId, 'Modern.');
      const rb2 = last(runId);
      expect(rb2.targetBuilderProfileId).toBe(LEAD);
      service().clearAuditEvents();
      const done = await runStep(runId, rb2.referralId, `Final.\n<handoff to="${WF2}">Mail?</handoff>`);
      expect(referrals.get(rb2.referralId)?.pendingJob?.handoffNote).toBe('refused: front_door_rounds');
      expect(
        service()
          .getAuditEvents()
          .some((event) => event.payload.lifecycleEvent === 'referral_front_door_rounds_blocked'),
      ).toBe(true);
      expect(steps(runId)).toHaveLength(5);
      expect(done.run.status).toBe('completed');
    });

    it("checks the lead's own snapshot at the report-back approve: the day budget and an off lead", async () => {
      workflowRows.set(LEAD, leadRow({ budgetPerDayCredits: 5, teamMemberIds: ['product-strategy'] }));
      await testRunWorkflow(LEAD);
      const started = await startLead();
      const runId = started.collaborationRunId;
      await runStep(runId, started.referralId, 'Q.\n<handoff to="product-strategy">Market?</handoff>');
      await runStep(runId, last(runId).referralId, 'Large.');
      const rb = last(runId);
      expect(rb.pendingJob?.workflow?.budgetPerDayCredits).toBe(5);

      deductionRows.push({
        ownerId: OWNER_ID,
        sourceEventId: referrals.get(started.referralId)?.executionId,
        requestedCredits: 5,
        createdAt: new Date(),
      });
      const calls = queue.enqueueExecution.mock.calls.length;
      const overBudget = await approve(runId, rb.referralId, 429);
      expect(overBudget.body.code).toBe('WORKFLOW_BUDGET_DAY');
      deductionRows.length = 0;
      workflowRows.set(
        LEAD,
        leadRow({ budgetPerDayCredits: 5, teamMemberIds: ['product-strategy'], status: 'disabled' }),
      );
      const off = await approve(runId, rb.referralId, 409);
      expect(off.body.code).toBe('WORKFLOW_DISABLED');
      expect(queue.enqueueExecution.mock.calls.length).toBe(calls);
      expect(referrals.get(rb.referralId)?.status).toBe('pending_approval');

      workflowRows.set(LEAD, leadRow({ budgetPerDayCredits: 5, teamMemberIds: ['product-strategy'] }));
      await approve(runId, rb.referralId);
      expect(referrals.get(rb.referralId)?.status).not.toBe('pending_approval');
      expect(queue.enqueueExecution.mock.calls.length).toBe(calls + 1);
    });

    it("a test run runs the team: the lead's snapshot is a test run, the members' are not, and a draft lead reports back", async () => {
      await testRunWorkflow(WF2);
      workflowRows.set(LEAD, leadRow({ status: 'draft', teamMemberIds: ['product-strategy', WF2, DRAFT_WF] }));
      const started = await startLead({ testRun: true });
      const runId = started.collaborationRunId;
      expect(started.roster).toEqual({
        used: ['product-strategy', WF2],
        skipped: [{ id: DRAFT_WF, reason: 'draft' }],
      });
      const job = referrals.get(started.referralId)?.pendingJob;
      expect(job?.workflow?.testRun).toBe(true);
      expect(job?.rosterWorkflows?.map((snapshot) => snapshot.testRun)).toEqual([false]);

      await runStep(runId, started.referralId, `Q.\n<handoff to="${WF2}">Mail?</handoff>`);
      const d1 = last(runId);
      expect(d1.pendingJob?.workflow?.testRun).toBe(false);
      await runStep(runId, d1.referralId, 'Mail.');
      const rb = last(runId);
      expect(rb.targetBuilderProfileId).toBe(LEAD);
      expect(rb.pendingJob?.workflow).toEqual(job?.workflow);
      await approve(runId, rb.referralId);
      expect((intentOf(rb.referralId).metadata as Record<string, unknown>).workflowTestRun).toBe(true);
      finish(rb.referralId, 'The plan.');
      const done = await readRun(runId);
      expect(done.run.status).toBe('completed');
      expect(done.workflow).toEqual({ id: LEAD, name: 'Weekly plan', testRun: true });
      expect(finalAnswerOf(steps(runId))).toBe('The plan.');
    });

    it("completes on the member's answer when the report-back is rejected, and fails with no report-back when the member fails", async () => {
      await testRunWorkflow(LEAD);
      workflowRows.set(LEAD, leadRow({ teamMemberIds: ['product-strategy'] }));
      const started = await startLead();
      const runId = started.collaborationRunId;
      await runStep(runId, started.referralId, 'Q.\n<handoff to="product-strategy">Market?</handoff>');
      await runStep(runId, last(runId).referralId, 'The agent answer.');
      const rb = last(runId);
      await http()
        .post(`/api/collaboration/runs/${runId}/referrals/${rb.referralId}/reject`)
        .send({ reason: 'enough' })
        .expect(200);
      const detail = await readRun(runId);
      expect(detail.run.status).toBe('completed');
      expect(finalAnswerOf(steps(runId))).toBe('The agent answer.');
      expect(steps(runId)).toHaveLength(3);

      const failing = await startLead();
      const failId = failing.collaborationRunId;
      await runStep(failId, failing.referralId, 'Q.\n<handoff to="product-strategy">Market?</handoff>');
      const d1 = last(failId);
      const failed = await runStep(failId, d1.referralId, '', 'failed');
      expect(referrals.get(d1.referralId)?.status).toBe('failed');
      expect(failed.run.status).toBe('failed');
      await service().sweepCollaborations();
      expect(steps(failId)).toHaveLength(2);
    });

    it("waits to settle while a workflow lead's report-back is missing, and the sweep recovers it", async () => {
      await testRunWorkflow(LEAD);
      workflowRows.set(LEAD, leadRow({ teamMemberIds: ['product-strategy'] }));
      const started = await startLead();
      const runId = started.collaborationRunId;
      await runStep(runId, started.referralId, 'Q.\n<handoff to="product-strategy">Market?</handoff>');
      const d1 = last(runId);
      await runStep(runId, d1.referralId, 'Large.');
      const rb = last(runId);
      referrals.delete(rb.referralId);
      const run = runs.get(runId)!;
      run.referralIds = run.referralIds.filter((id) => id !== rb.referralId);
      const member = referrals.get(d1.referralId)!;
      member.pendingJob = { ...member.pendingJob!, reportBackChecked: undefined };

      const settle = (
        service() as unknown as {
          settleCollaborationRun: (id: string, rows: Array<{ status: string }>) => Promise<{ status: string }>;
        }
      ).settleCollaborationRun.bind(service());
      const settled = await settle(runId, steps(runId).map((row) => ({ status: row.status })));
      expect(settled.status).toBe('active');

      await service().sweepCollaborations();
      const recovered = steps(runId).filter(
        (row) => row.idempotencyKey === reportBackIdempotencyKey(d1.referralId),
      );
      expect(recovered).toHaveLength(1);
      expect(recovered[0]).toMatchObject({ status: 'pending_approval', targetBuilderProfileId: LEAD });
      expect(recovered[0].pendingJob?.workflow).toEqual(referrals.get(started.referralId)?.pendingJob?.workflow);
    });

    it('starts a team without a session on the business rows with the caller note', async () => {
      await testRunWorkflow(LEAD);
      workflowRows.set(LEAD, leadRow({ teamMemberIds: ['product-strategy'] }));
      const started = await http()
        .post('/api/collaboration/runs')
        .send({ task: OWNER_TASK, workflowId: LEAD })
        .expect(201);
      const body = started.body as StartBody;
      expect(body.roster).toEqual({ used: ['product-strategy'], skipped: [] });
      const job = referrals.get(body.referralId)?.pendingJob;
      expect(job?.sessionId).toBe(businessSessionRows[0].id);
      expect(job?.callerProjectInstructions).toBe(COLLABORATION_BUSINESS_RUN_NOTE);
      expect(job?.teamLeadId).toBe(LEAD);
      await runStep(body.collaborationRunId, body.referralId, 'Q.\n<handoff to="product-strategy">Market?</handoff>');
      const child = last(body.collaborationRunId);
      expect(child.pendingJob?.sessionId).toBe(businessSessionRows[0].id);
      await runStep(body.collaborationRunId, child.referralId, 'Large.');
      const rb = last(body.collaborationRunId);
      expect(rb.targetBuilderProfileId).toBe(LEAD);
      expect(rb.pendingJob?.sessionId).toBe(businessSessionRows[0].id);
      expect(String(rb.pendingJob?.projectInstructions).startsWith(COLLABORATION_BUSINESS_RUN_NOTE)).toBe(true);
    });

    it('sets teamLeadId on a Chief of Staff team start, and a front-door row stored without it still runs as one', async () => {
      rosterRows.set(OWNER_ID, { userId: OWNER_ID, memberIds: ['product-strategy'], updatedAt: new Date() });
      const started = await http()
        .post('/api/collaboration/runs')
        .send({ sessionId: SESSION_ID, task: OWNER_TASK, team: 'chief-of-staff', teamLeadId: LEAD })
        .expect(201);
      const runId = started.body.collaborationRunId as string;
      const first = referrals.get(started.body.referralId)!;
      expect(first.pendingJob?.teamLeadId).toBe('chief-of-staff');

      // A row stored before USER-TEAMS-01B has no teamLeadId.
      const legacy = { ...first.pendingJob! } as Record<string, unknown>;
      delete legacy.teamLeadId;
      first.pendingJob = legacy as never;
      await runStep(runId, first.referralId, 'Q.\n<handoff to="product-strategy">Market?</handoff>');
      const d1 = last(runId);
      expect(d1.targetBuilderProfileId).toBe('product-strategy');
      expect(d1.pendingJob).not.toHaveProperty('teamLeadId');
      await runStep(runId, d1.referralId, 'Large.\n<handoff to="technology-advisor">Stack?</handoff>');
      expect(referrals.get(d1.referralId)?.pendingJob?.handoffNote).toBe('refused: roster_reply');
      const rb = last(runId);
      expect(rb).toMatchObject({
        sourceBuilderProfileId: 'product-strategy',
        targetBuilderProfileId: 'chief-of-staff',
        idempotencyKey: reportBackIdempotencyKey(d1.referralId),
        depth: 2,
      });
      expect(rb.pendingJob?.workflow ?? null).toBeNull();
      const done = await runStep(runId, rb.referralId, 'Final.');
      expect(done.run.status).toBe('completed');
      expect(finalAnswerOf(steps(runId))).toBe('Final.');
    });
  });

  describe('APPROVAL-SET-01B the server auto-approve path', () => {
    const LEAD = 'f0f0f0f0-0000-4000-8000-0000000001b1';
    const WF2 = 'f0f0f0f0-0000-4000-8000-0000000001b2';
    const GHOST = 'f0f0f0f0-0000-4000-8000-0000000001bf';
    const OWNER_TASK = 'Plan my week around the market and my mail.';
    const outputs = new Map<string, { status: string; output: string }>();

    function leadRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
      return {
        id: LEAD,
        userId: OWNER_ID,
        name: 'Weekly plan',
        role: 'Assistant',
        description: 'Plans the week.',
        status: 'active',
        tone: null,
        replyLanguage: null,
        purpose: "You plan the owner's week.",
        procedure: 'Ask the team when you need facts, then write the plan.',
        result: 'A short plan.',
        toolProfile: 'read',
        knowledgeScopeIds: ['market-data'],
        connectorToolIds: [],
        model: { choice: 'platform', id: 'claude-haiku-5-5' },
        budgetPerRunCredits: null,
        budgetPerDayCredits: null,
        templateId: null,
        teamMemberIds: ['product-strategy', WF2, 'technology-advisor'],
        approvalMode: 'read_only',
        approvalCreditLimit: null,
        ...overrides,
      };
    }

    function memberRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
      return {
        id: WF2,
        userId: OWNER_ID,
        name: 'Mail digest',
        role: 'Assistant',
        description: 'Summarizes unread mail.',
        status: 'active',
        tone: null,
        replyLanguage: null,
        purpose: "You summarize the owner's unread mail.",
        procedure: 'Call mail_list_unread_metadata and list each message in one line.',
        result: 'A short list.',
        toolProfile: 'read',
        knowledgeScopeIds: ['policies'],
        connectorToolIds: ['mail_list_unread_metadata'],
        model: { choice: 'server' },
        budgetPerRunCredits: null,
        budgetPerDayCredits: null,
        templateId: null,
        teamMemberIds: [],
        // A member's own setting is never read in a run it does not lead.
        approvalMode: 'every',
        approvalCreditLimit: null,
        ...overrides,
      };
    }

    function service(): OrchestrationService {
      return app.get(OrchestrationService);
    }

    function steps(runId: string): CollaborationReferralEntity[] {
      return (runs.get(runId)?.referralIds ?? []).map((id) => referrals.get(id)!);
    }

    function last(runId: string): CollaborationReferralEntity {
      const all = steps(runId);
      return all[all.length - 1];
    }

    function row(referralId: string): CollaborationReferralEntity {
      return referrals.get(referralId)!;
    }

    function jobOf(referralId: string): Record<string, unknown> {
      const executionId = referrals.get(referralId)?.executionId;
      const calls = queue.enqueueExecution.mock.calls.filter(
        (args) => (args[0] as { executionId: string }).executionId === executionId,
      );
      if (calls.length !== 1) {
        throw new Error(`expected one job for ${referralId}, got ${calls.length}`);
      }
      return calls[0][0] as Record<string, unknown>;
    }

    async function approve(runId: string, referralId: string, expected = 200, body: object = {}) {
      return http()
        .post(`/api/collaboration/runs/${runId}/referrals/${referralId}/approve`)
        .send(body)
        .expect(expected);
    }

    async function readRun(runId: string) {
      return (await http().get(`/api/collaboration/runs/${runId}`).expect(200)).body as {
        run: { status: string };
        handoffs: Array<Record<string, unknown> & { referralId: string }>;
      };
    }

    /** The step's job finishes with `output`; the next read processes it. */
    async function answer(runId: string, referralId: string, output: string, status = 'completed') {
      const executionId = referrals.get(referralId)?.executionId;
      if (!executionId) {
        throw new Error(`no execution for ${referralId}`);
      }
      outputs.set(executionId, { status, output });
      return readRun(runId);
    }

    /** The owner's click, then the step's answer. */
    async function runStep(runId: string, referralId: string, output: string) {
      await approve(runId, referralId);
      return answer(runId, referralId, output);
    }

    function viewOf(detail: { handoffs: Array<Record<string, unknown> & { referralId: string }> }, id: string) {
      return detail.handoffs.find((handoff) => handoff.referralId === id);
    }

    async function startLead(body: Record<string, unknown> = {}) {
      const started = await http()
        .post('/api/collaboration/runs')
        .send({ sessionId: SESSION_ID, task: OWNER_TASK, workflowId: LEAD, ...body })
        .expect(201);
      return started.body as { collaborationRunId: string; referralId: string };
    }

    async function testRunWorkflow(id: string): Promise<void> {
      const started = await http()
        .post('/api/collaboration/runs')
        .send({ sessionId: SESSION_ID, task: 'Test it.', workflowId: id, testRun: true })
        .expect(201);
      await runStep(started.body.collaborationRunId, started.body.referralId, 'Tested.');
      expect(referrals.get(started.body.referralId)?.status).toBe('completed');
    }

    async function testTeam(): Promise<void> {
      await testRunWorkflow(WF2);
      await testRunWorkflow(LEAD);
    }

    function declined(): Array<Record<string, unknown>> {
      return service()
        .getAuditEvents()
        .filter((event) => event.payload.lifecycleEvent === 'auto_approval_declined')
        .map((event) => ({ ...event.payload }));
    }

    function approvedPayloads(): Array<Record<string, unknown>> {
      return service()
        .getAuditEvents()
        .filter((event) => event.eventType === 'orchestration.referral_approved')
        .map((event) => ({ ...event.payload }));
    }

    /** The lead dispatches to `to`: the owner clicks the lead's first step and it answers. */
    async function dispatchFromFirst(to: string) {
      const started = await startLead();
      const runId = started.collaborationRunId;
      await runStep(runId, started.referralId, `Q.\n<handoff to="${to}">Look into it.</handoff>`);
      const child = last(runId);
      expect(child.referralId).not.toBe(started.referralId);
      expect(child.targetBuilderProfileId).toBe(to);
      return { started, runId, child };
    }

    async function cosKeys(): Promise<string[]> {
      const cos = await http()
        .post('/api/collaboration/runs')
        .send({ sessionId: SESSION_ID, task: OWNER_TASK, team: 'chief-of-staff' })
        .expect(201);
      await approve(cos.body.collaborationRunId, cos.body.referralId);
      return Object.keys(jobOf(cos.body.referralId)).sort();
    }

    beforeEach(() => {
      outputs.clear();
      workflowRows.set(LEAD, leadRow());
      workflowRows.set(WF2, memberRow());
      executionResults.getExecution.mockImplementation(async (executionId: string) => {
        const stored = outputs.get(executionId);
        return stored
          ? {
              execution_status: stored.status,
              metadata: { aiExecutionResult: { output: stored.output } },
            }
          : null;
      });
    });

    it('with every, no column or a malformed setting, the dispatch and report-back wait byte for byte and record nothing', async () => {
      await testTeam();
      const shapes = new Set<string>();
      const settings: Array<Record<string, unknown> | null> = [
        { approvalMode: 'every', approvalCreditLimit: null },
        null,
        { approvalMode: 'sometimes', approvalCreditLimit: 5 },
        { approvalMode: 'credits', approvalCreditLimit: null },
        { approvalMode: 'every', approvalCreditLimit: 50 },
      ];
      for (const setting of settings) {
        const stored = leadRow(setting ?? {});
        if (setting === null) {
          delete stored.approvalMode;
          delete stored.approvalCreditLimit;
        }
        workflowRows.set(LEAD, stored);
        service().clearAuditEvents();
        const before = queue.enqueueExecution.mock.calls.length;
        const { runId, child: d1 } = await dispatchFromFirst('product-strategy');
        expect(d1.status).toBe('pending_approval');
        expect(queue.enqueueExecution.mock.calls.length).toBe(before + 1);
        const d1Job = JSON.stringify(d1.pendingJob);
        await runStep(runId, d1.referralId, 'The market is large.');
        const rb1 = last(runId);
        expect(rb1.targetBuilderProfileId).toBe(LEAD);
        expect(rb1.status).toBe('pending_approval');
        expect(queue.enqueueExecution.mock.calls.length).toBe(before + 2);
        for (const step of [d1, rb1]) {
          expect(step.pendingJob).not.toHaveProperty('autoApproval');
          expect(step.pendingJob?.decisionReason).toBeNull();
          expect(step.pendingJob?.decidedBy).toBeNull();
        }
        const detail = await readRun(runId);
        for (const handoff of detail.handoffs) {
          expect(handoff.autoApproved).toBeNull();
          expect(handoff.autoApprovalWaiting).toBeNull();
        }
        expect(declined()).toEqual([]);
        for (const payload of approvedPayloads()) {
          expect(payload).not.toHaveProperty('autoApproval');
        }
        shapes.add(`${d1Job}|${JSON.stringify(rb1.pendingJob)}`);
      }
      expect(shapes.size).toBe(1);
    });

    it('read_only: dispatches to an advisor and a workflow and both report-backs run without a click; the first hand-off waits; a third round is refused', async () => {
      await testTeam();
      const started = await startLead();
      const runId = started.collaborationRunId;
      const first = row(started.referralId);
      expect(first.status).toBe('pending_approval');
      expect(first.pendingJob).not.toHaveProperty('autoApproval');
      const leadSnapshot = first.pendingJob?.workflow;
      const memberSnapshot = first.pendingJob?.rosterWorkflows?.[0];
      service().clearAuditEvents();
      const before = queue.enqueueExecution.mock.calls.length;

      await runStep(runId, started.referralId, 'Q.\n<handoff to="product-strategy">Market?</handoff>');
      const d1 = row(last(runId).referralId);
      expect(d1).toMatchObject({
        sourceBuilderProfileId: LEAD,
        targetBuilderProfileId: 'product-strategy',
        status: 'in_progress',
      });
      expect(d1.pendingJob).toMatchObject({ decidedBy: OWNER_ID, decisionReason: 'auto:read_only' });
      expect(d1.pendingJob).not.toHaveProperty('autoApproval');
      expect(queue.enqueueExecution.mock.calls.length).toBe(before + 2);
      // The owner's click on a step already approved is refused by the conditional claim.
      await approve(runId, d1.referralId, 409);

      await answer(runId, d1.referralId, 'The market is large.');
      const rb1 = row(last(runId).referralId);
      expect(rb1).toMatchObject({
        sourceBuilderProfileId: 'product-strategy',
        targetBuilderProfileId: LEAD,
        status: 'in_progress',
        idempotencyKey: reportBackIdempotencyKey(d1.referralId),
      });
      expect(rb1.pendingJob?.workflow).toEqual(leadSnapshot);
      expect(rb1.pendingJob).toMatchObject({ decidedBy: OWNER_ID, decisionReason: 'auto:read_only' });

      await answer(runId, rb1.referralId, `Now the mail.\n<handoff to="${WF2}">Summarize my unread mail.</handoff>`);
      const d2 = row(last(runId).referralId);
      expect(d2).toMatchObject({ sourceBuilderProfileId: LEAD, targetBuilderProfileId: WF2, status: 'in_progress' });
      expect(d2.pendingJob?.workflow).toEqual(memberSnapshot);
      expect(d2.pendingJob).toMatchObject({ decidedBy: OWNER_ID, decisionReason: 'auto:read_only' });

      await answer(runId, d2.referralId, 'Two unread mails.');
      const rb2 = row(last(runId).referralId);
      expect(rb2).toMatchObject({ sourceBuilderProfileId: WF2, targetBuilderProfileId: LEAD, status: 'in_progress' });
      expect(rb2.pendingJob?.workflow).toEqual(leadSnapshot);

      const done = await answer(runId, rb2.referralId, 'Final.\n<handoff to="technology-advisor">Stack?</handoff>');
      expect(row(rb2.referralId).pendingJob?.handoffNote).toBe('refused: front_door_rounds');
      expect(steps(runId)).toHaveLength(5);
      expect(done.run.status).toBe('completed');
      expect(queue.enqueueExecution.mock.calls.length).toBe(before + 5);

      // D12: the view says which steps ran without a click.
      expect(viewOf(done, started.referralId)).toMatchObject({
        decidedBy: OWNER_ID,
        autoApproved: null,
        autoApprovalWaiting: null,
      });
      for (const step of [d1, rb1, d2, rb2]) {
        expect(viewOf(done, step.referralId)).toMatchObject({
          decidedBy: OWNER_ID,
          autoApproved: { mode: 'read_only', estimateCredits: null, creditLimit: null },
          autoApprovalWaiting: null,
        });
      }
      // D11: the approved events; only the automatic ones carry autoApproval.
      const approvals = approvedPayloads();
      expect(approvals).toHaveLength(5);
      expect(approvals[0]).toMatchObject({ referralId: started.referralId, decidedBy: OWNER_ID });
      expect(approvals[0]).not.toHaveProperty('autoApproval');
      for (const payload of approvals.slice(1)) {
        expect(payload).toMatchObject({
          decidedBy: OWNER_ID,
          autoApproval: { mode: 'read_only', estimateCredits: null, creditLimit: null },
        });
      }
      expect(declined()).toEqual([]);

      // HARNESS_ENTITLEMENT_PROOF_V1 used, not changed: every automatic job has
      // exactly the key set of a clicked Chief of Staff job.
      const keys = await cosKeys();
      expect(keys).toContain('harnessEntitlementProof');
      for (const step of steps(runId)) {
        const job = jobOf(step.referralId);
        expect(Object.keys(job).sort()).toEqual(keys);
        const text = JSON.stringify(job);
        for (const leaked of ['decisionReason', 'autoApproval', 'auto:read_only', 'teamLeadId']) {
          expect(text).not.toContain(leaked);
        }
      }
    });

    it('applies in a test run (DECISION C): a draft lead test run dispatches without a click', async () => {
      await testRunWorkflow(WF2);
      workflowRows.set(LEAD, leadRow({ status: 'draft' }));
      const started = await startLead({ testRun: true });
      const runId = started.collaborationRunId;
      expect(row(started.referralId).pendingJob?.workflow?.testRun).toBe(true);
      await runStep(runId, started.referralId, 'Q.\n<handoff to="product-strategy">Market?</handoff>');
      const d1 = row(last(runId).referralId);
      expect(d1.status).toBe('in_progress');
      expect(d1.pendingJob?.decisionReason).toBe('auto:read_only');
      await answer(runId, d1.referralId, 'Large.');
      // The report-back runs on the lead's test-run snapshot; the draft lead may test-run.
      const rb = row(last(runId).referralId);
      expect(rb.targetBuilderProfileId).toBe(LEAD);
      expect(rb.status).toBe('in_progress');
      expect(rb.pendingJob?.workflow?.testRun).toBe(true);
    });

    it('fail-closed: a write, review, null-profile or unknown target waits with writes, and the click still works', async () => {
      await testTeam();
      for (const target of ['writer', 'reviewer', 'builder', GHOST]) {
        service().clearAuditEvents();
        const started = await startLead();
        const runId = started.collaborationRunId;
        // A tampered stored list (the server never builds one like this).
        const first = referrals.get(started.referralId)!;
        first.pendingJob = {
          ...first.pendingJob!,
          agents: [
            ...(first.pendingJob!.agents ?? []),
            { name: target, instructions: 'x', label: 'X', summary: 'x' },
          ],
        };
        const before = queue.enqueueExecution.mock.calls.length;
        await runStep(runId, started.referralId, `Q.\n<handoff to="${target}">Do it.</handoff>`);
        const child = row(last(runId).referralId);
        expect(child.targetBuilderProfileId).toBe(target);
        expect(child.status).toBe('pending_approval');
        expect(child.pendingJob).toMatchObject({
          decidedBy: null,
          decisionReason: null,
          autoApproval: { outcome: 'waiting', reason: 'writes' },
        });
        expect(queue.enqueueExecution.mock.calls.length).toBe(before + 1);
        expect(declined()).toEqual([
          expect.objectContaining({
            reason: 'writes',
            limitType: 'auto_approval',
            referralId: child.referralId,
            mode: 'read_only',
            userId: OWNER_ID,
          }),
        ]);
        const detail = await readRun(runId);
        expect(viewOf(detail, child.referralId)).toMatchObject({
          status: 'pending_approval',
          autoApproved: null,
          autoApprovalWaiting: 'writes',
        });
        // A second read does not record it twice.
        expect(declined()).toHaveLength(1);
        if (target === 'writer') {
          await approve(runId, child.referralId);
          expect(row(child.referralId).status).toBe('in_progress');
          expect(row(child.referralId).pendingJob?.decisionReason).toBeNull();
          const after = await readRun(runId);
          expect(viewOf(after, child.referralId)).toMatchObject({
            autoApproved: null,
            autoApprovalWaiting: null,
          });
        }
      }
    });

    it('fail-closed: a workflow member whose connector tool is not flagged readOnly waits with writes', async () => {
      await testTeam();
      const started = await startLead();
      const first = referrals.get(started.referralId)!;
      const [snapshot] = first.pendingJob!.rosterWorkflows!;
      first.pendingJob = {
        ...first.pendingJob!,
        rosterWorkflows: [{ ...snapshot, connectorToolIds: ['mail_list_unread_metadata', 'mail_send_message'] }],
      };
      await runStep(started.collaborationRunId, started.referralId, `Q.\n<handoff to="${WF2}">Mail?</handoff>`);
      const d1 = row(last(started.collaborationRunId).referralId);
      expect(d1.targetBuilderProfileId).toBe(WF2);
      expect(d1.status).toBe('pending_approval');
      expect(d1.pendingJob?.autoApproval).toEqual({ outcome: 'waiting', reason: 'writes' });
    });

    it('a lead row deleted or switched off mid-run waits with lead_missing, and the click still works', async () => {
      await testTeam();
      for (const change of ['deleted', 'off'] as const) {
        service().clearAuditEvents();
        const started = await startLead();
        const runId = started.collaborationRunId;
        await approve(runId, started.referralId);
        if (change === 'deleted') {
          workflowRows.delete(LEAD);
        } else {
          workflowRows.set(LEAD, leadRow({ status: 'disabled' }));
        }
        await answer(runId, started.referralId, 'Q.\n<handoff to="product-strategy">Market?</handoff>');
        const d1 = row(last(runId).referralId);
        expect(d1.status).toBe('pending_approval');
        expect(d1.pendingJob?.autoApproval).toEqual({ outcome: 'waiting', reason: 'lead_missing' });
        expect(declined()).toEqual([
          expect.objectContaining({
            reason: 'lead_missing',
            mode: change === 'deleted' ? null : 'read_only',
            referralId: d1.referralId,
          }),
        ]);
        const detail = await readRun(runId);
        expect(viewOf(detail, d1.referralId)?.autoApprovalWaiting).toBe('lead_missing');
        await approve(runId, d1.referralId);
        expect(row(d1.referralId).status).toBe('in_progress');
        workflowRows.set(LEAD, leadRow());
      }
    });

    it('a refused check leaves the step waiting with checks_failed and the run alive; the click works once it passes', async () => {
      await testTeam();
      // The credit balance is exhausted.
      const dispatched = await startLead();
      const runId = dispatched.collaborationRunId;
      await approve(runId, dispatched.referralId);
      const credit = jest.spyOn(app.get(CreditBalanceGuard), 'canActivate').mockResolvedValue(false);
      try {
        await answer(runId, dispatched.referralId, 'Q.\n<handoff to="product-strategy">Market?</handoff>');
      } finally {
        credit.mockRestore();
      }
      const d1 = row(last(runId).referralId);
      expect(d1.targetBuilderProfileId).toBe('product-strategy');
      expect(d1.status).toBe('pending_approval');
      expect(d1.pendingJob?.autoApproval).toEqual({ outcome: 'waiting', reason: 'checks_failed' });
      expect(runs.get(runId)?.status).toBe('active');
      const waiting = await readRun(runId);
      expect(viewOf(waiting, d1.referralId)?.autoApprovalWaiting).toBe('checks_failed');
      await approve(runId, d1.referralId);
      expect(row(d1.referralId).status).toBe('in_progress');

      // The provider is switched off.
      const started = await startLead();
      await approve(started.collaborationRunId, started.referralId);
      const killed = jest.spyOn(KillSwitchConfig, 'isProviderEnabled').mockReturnValue(false);
      try {
        await answer(started.collaborationRunId, started.referralId, 'Q.\n<handoff to="product-strategy">Market?</handoff>');
      } finally {
        killed.mockRestore();
      }
      const off = row(last(started.collaborationRunId).referralId);
      expect(off.status).toBe('pending_approval');
      expect(off.pendingJob?.autoApproval).toEqual({ outcome: 'waiting', reason: 'checks_failed' });

      // The lead's own day budget at the report-back (its snapshot is checked, USER-TEAMS-01B D10).
      workflowRows.set(LEAD, leadRow({ budgetPerDayCredits: 5 }));
      const budget = await startLead();
      const budgetRun = budget.collaborationRunId;
      await runStep(budgetRun, budget.referralId, 'Q.\n<handoff to="product-strategy">Market?</handoff>');
      const bd1 = row(last(budgetRun).referralId);
      expect(bd1.status).toBe('in_progress');
      deductionRows.push({
        ownerId: OWNER_ID,
        sourceEventId: referrals.get(budget.referralId)?.executionId,
        requestedCredits: 5,
        createdAt: new Date(),
      });
      await answer(budgetRun, bd1.referralId, 'Large.');
      const rb = row(last(budgetRun).referralId);
      expect(rb.targetBuilderProfileId).toBe(LEAD);
      expect(rb.status).toBe('pending_approval');
      expect(rb.pendingJob?.autoApproval).toEqual({ outcome: 'waiting', reason: 'checks_failed' });
      expect(runs.get(budgetRun)?.status).toBe('active');
      expect(declined().filter((payload) => payload.reason === 'checks_failed')).toHaveLength(3);
      deductionRows.length = 0;
      await approve(budgetRun, rb.referralId);
      expect(row(rb.referralId).status).toBe('in_progress');
    });

    it('credits: the last completed step cost decides; at the limit runs, one over and unknown wait', async () => {
      await testTeam();
      workflowRows.set(LEAD, leadRow({ approvalMode: 'credits', approvalCreditLimit: 10 }));
      service().clearAuditEvents();

      // No product-strategy step yet: unknown.
      const one = await dispatchFromFirst('product-strategy');
      expect(one.child.status).toBe('pending_approval');
      expect(one.child.pendingJob?.autoApproval).toEqual({ outcome: 'waiting', reason: 'unknown_cost' });
      await runStep(one.runId, one.child.referralId, 'Large.');
      // The lead's last completed step has no deduction row: unknown as well.
      const rb = row(last(one.runId).referralId);
      expect(rb.targetBuilderProfileId).toBe(LEAD);
      expect(rb.pendingJob?.autoApproval).toEqual({ outcome: 'waiting', reason: 'unknown_cost' });
      deductionRows.push({
        ownerId: OWNER_ID,
        sourceEventId: referrals.get(one.child.referralId)?.executionId,
        requestedCredits: 10,
        createdAt: new Date(),
      });

      // At the limit: runs, with the estimate recorded.
      const two = await dispatchFromFirst('product-strategy');
      const atLimit = row(two.child.referralId);
      expect(atLimit.status).toBe('in_progress');
      expect(atLimit.pendingJob).toMatchObject({ decidedBy: OWNER_ID, decisionReason: 'auto:credits:10/10' });
      expect(approvedPayloads().find((payload) => payload.referralId === atLimit.referralId)).toMatchObject({
        autoApproval: { mode: 'credits', estimateCredits: 10, creditLimit: 10 },
      });
      const detail = await readRun(two.runId);
      expect(viewOf(detail, atLimit.referralId)).toMatchObject({
        autoApproved: { mode: 'credits', estimateCredits: 10, creditLimit: 10 },
        autoApprovalWaiting: null,
      });

      // One over: waits.
      workflowRows.set(LEAD, leadRow({ approvalMode: 'credits', approvalCreditLimit: 9 }));
      const three = await dispatchFromFirst('product-strategy');
      expect(three.child.status).toBe('pending_approval');
      expect(three.child.pendingJob?.autoApproval).toEqual({ outcome: 'waiting', reason: 'over_limit' });
      expect(declined().find((payload) => payload.referralId === three.child.referralId)).toMatchObject({
        reason: 'over_limit',
        mode: 'credits',
        estimateCredits: 10,
        creditLimit: 9,
      });
      // credits still needs a read-only target.
      workflowRows.set(LEAD, leadRow({ approvalMode: 'credits', approvalCreditLimit: 1000 }));
      const four = await startLead();
      const first = referrals.get(four.referralId)!;
      first.pendingJob = {
        ...first.pendingJob!,
        agents: [...(first.pendingJob!.agents ?? []), { name: 'writer', instructions: 'x' }],
      };
      await runStep(four.collaborationRunId, four.referralId, 'Q.\n<handoff to="writer">Write.</handoff>');
      expect(last(four.collaborationRunId).pendingJob?.autoApproval).toEqual({
        outcome: 'waiting',
        reason: 'writes',
      });
    });

    it('never reads decisionReason or autoApproval from a body, on start, approve or reject', async () => {
      await testTeam();
      workflowRows.set(LEAD, leadRow({ approvalMode: 'every' }));
      const started = await startLead({
        decisionReason: 'auto:read_only',
        autoApproval: { outcome: 'waiting', reason: 'writes' },
        approvalMode: 'read_only',
      });
      const runId = started.collaborationRunId;
      expect(row(started.referralId).pendingJob).not.toHaveProperty('autoApproval');
      expect(row(started.referralId).pendingJob?.decisionReason).toBeNull();
      const body = {
        decisionReason: 'auto:read_only',
        autoApproval: { mode: 'read_only' },
        autoApproved: { mode: 'read_only' },
      };
      const clicked = await approve(runId, started.referralId, 200, body);
      expect(clicked.body.autoApproved).toBeNull();
      expect(row(started.referralId).pendingJob?.decisionReason).toBeNull();
      expect(approvedPayloads().pop()).not.toHaveProperty('autoApproval');
      await answer(runId, started.referralId, 'Q.\n<handoff to="product-strategy">Market?</handoff>');
      const d1 = last(runId);
      expect(d1.status).toBe('pending_approval');
      // A reject reason that looks automatic is the owner's text, never shown as automatic.
      const rejected = await http()
        .post(`/api/collaboration/runs/${runId}/referrals/${d1.referralId}/reject`)
        .send({ reason: 'auto:read_only', ...body })
        .expect(200);
      expect(rejected.body).toMatchObject({ status: 'rejected', autoApproved: null, autoApprovalWaiting: null });
      expect(row(d1.referralId).pendingJob?.decisionReason).toBe('auto:read_only');
      expect(row(d1.referralId).pendingJob).not.toHaveProperty('autoApproval');

      // approveReferral writes only the server's own auto: values.
      const other = await startLead();
      await service().approveReferral({
        collaborationRunId: other.collaborationRunId,
        referralId: other.referralId,
        decidedBy: OWNER_ID,
        decisionReason: 'the owner said so',
      });
      expect(row(other.referralId).status).toBe('in_progress');
      expect(row(other.referralId).pendingJob?.decisionReason).toBeNull();
    });

    it('the sweep recovers a lost report-back and approves it once', async () => {
      await testTeam();
      const { runId, child: d1 } = await dispatchFromFirst('product-strategy');
      expect(row(d1.referralId).status).toBe('in_progress');
      await answer(runId, d1.referralId, 'Large.');
      const lost = last(runId);
      expect(lost.status).toBe('in_progress');
      // Lose the report-back, as if the Gateway stopped before it was stored.
      referrals.delete(lost.referralId);
      const run = runs.get(runId)!;
      run.referralIds = run.referralIds.filter((id) => id !== lost.referralId);
      const member = referrals.get(d1.referralId)!;
      member.pendingJob = { ...member.pendingJob!, reportBackChecked: undefined };

      const before = queue.enqueueExecution.mock.calls.length;
      await service().sweepCollaborations();
      const recovered = steps(runId).filter(
        (step) => step.idempotencyKey === reportBackIdempotencyKey(d1.referralId),
      );
      expect(recovered).toHaveLength(1);
      expect(recovered[0]).toMatchObject({ status: 'in_progress', targetBuilderProfileId: LEAD });
      expect(recovered[0].pendingJob?.decisionReason).toBe('auto:read_only');
      expect(queue.enqueueExecution.mock.calls.length).toBe(before + 1);
      await service().sweepCollaborations();
      await readRun(runId);
      expect(
        steps(runId).filter((step) => step.idempotencyKey === reportBackIdempotencyKey(d1.referralId)),
      ).toHaveLength(1);
      expect(queue.enqueueExecution.mock.calls.length).toBe(before + 1);
      expect(jobOf(recovered[0].referralId)).toMatchObject({ builderProfileId: LEAD });
    });

    it('a Chief of Staff run keeps every hand-off, whatever the workflow rows say', async () => {
      rosterRows.set(OWNER_ID, { userId: OWNER_ID, memberIds: ['product-strategy', WF2], updatedAt: new Date() });
      await testRunWorkflow(WF2);
      service().clearAuditEvents();
      const started = await http()
        .post('/api/collaboration/runs')
        .send({ sessionId: SESSION_ID, task: OWNER_TASK, team: 'chief-of-staff' })
        .expect(201);
      const runId = started.body.collaborationRunId as string;
      await runStep(runId, started.body.referralId, 'Q.\n<handoff to="product-strategy">Market?</handoff>');
      const d1 = last(runId);
      expect(d1.status).toBe('pending_approval');
      expect(d1.pendingJob).not.toHaveProperty('autoApproval');
      await runStep(runId, d1.referralId, 'Large.');
      const rb = last(runId);
      expect(rb.targetBuilderProfileId).toBe('chief-of-staff');
      expect(rb.status).toBe('pending_approval');
      expect(rb.pendingJob).not.toHaveProperty('autoApproval');
      expect(declined()).toEqual([]);
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
