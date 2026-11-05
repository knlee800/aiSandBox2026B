import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { createHarnessEntitlementProof } from '../ai/ai-execution.controller';
import { ExecutionResultService } from '../ai/execution-result.service';
import { AbortConfig } from '../abort/abort.config';
import { AbortGuard } from '../abort/abort.guard';
import { CreditBalanceGuard } from '../billing/credit-balance.guard';
import { UserRole } from '../entities/user-role.enum';
import { QueueService } from '../queue/queue.service';
import { QuotaConfig } from '../quota/quota.config';
import { TokenQuotaGuard } from '../quota/token-quota.guard';
import { CreditDeductionRecord } from '../entities/credit-deduction-record.entity';
import { ExecutionSafetyGuard } from '../safety/execution-safety.guard';
import { DailyCreditCapService } from '../safety/daily-credit-cap.service';
import { GlobalSafetyLimitService } from '../safety/global-safety-limit.service';
import { UsageLedgerService } from '../usage-ledger/usage-ledger.service';
import { CollaborationReferralEntity } from './collaboration-referral.entity';
import { CollaborationRunEntity } from './collaboration-run.entity';
import {
  COLLABORATION_SEND_BACK_WRITER_INSTRUCTION,
  COLLABORATION_TEAM,
} from './collaboration-team';
import { InternalCollaborationController } from './internal-collaboration.controller';
import {
  COLLABORATION_WAITING_MAX_AGE_MS,
  HANDOFF_WAIT_TIMEOUT_REASON,
} from './collaboration-sweep.constants';
import {
  MAX_HANDOFF_TASK_CHARS,
  answerHandoffIdempotencyKey,
} from './handoff-request';
import {
  DEFAULT_MAX_AGENTS_PER_COLLABORATION,
  DEFAULT_MAX_REFERRAL_DEPTH,
  MAX_HANDOFFS_PER_RUN,
} from './orchestration.contracts';
import { OrchestrationService } from './orchestration.service';

const sessionId = '11111111-1111-4111-8111-111111111111';
const conversationId = '22222222-2222-4222-8222-222222222222';

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
      update: async (
        criteria: Record<string, unknown>,
        partial: Record<string, unknown>,
      ) => {
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

function referralBody(overrides: Record<string, unknown> = {}) {
  return {
    sourceBuilder: { agentRole: 'builder', builderProfileId: 'builder-a' },
    targetBuilder: { agentRole: 'chief-of-staff', builderProfileId: 'builder-b' },
    idempotencyKey: 'key-1',
    sessionId,
    conversationId,
    apiKeyId: 'apikey-01',
    prompt: 'Review the plan',
    provider: 'stub',
    adapter: 'stub',
    model: 'test-model',
    ...overrides,
  };
}

describe('InternalCollaborationController', () => {
  const originalGlobal = process.env.GLOBAL_EXECUTION_ENABLED;
  const originalProvider = process.env.AI_PROVIDER;
  const originalAbort = process.env.ABORT_MODE;

  let app: INestApplication;
  let queue: { enqueueExecution: jest.Mock };
  let ledger: { writeExecutionIntent: jest.Mock };
  let executionResults: { requestCancel: jest.Mock; getExecution: jest.Mock };
  let runs: Map<string, CollaborationRunEntity>;
  let referrals: Map<string, CollaborationReferralEntity>;
  let tokenUsage = 0;
  let creditBalance: { balance: number } | null = { balance: 25 };
  let dailyCreditTotal = '0';

  beforeEach(async () => {
    process.env.GLOBAL_EXECUTION_ENABLED = 'true';
    process.env.AI_PROVIDER = 'stub';
    process.env.ABORT_MODE = 'NONE';
    AbortConfig.initialize();
    tokenUsage = 0;
    creditBalance = { balance: 25 };
    dailyCreditTotal = '0';

    const fakes = createOrchestrationRepoFakes();
    runs = fakes.runs;
    referrals = fakes.referrals;
    queue = { enqueueExecution: jest.fn().mockResolvedValue(undefined) };
    ledger = { writeExecutionIntent: jest.fn().mockResolvedValue(undefined) };
    executionResults = {
      requestCancel: jest.fn().mockResolvedValue(true),
      getExecution: jest.fn().mockResolvedValue(null),
    };
    const creditGuard = new CreditBalanceGuard(
      { findByOwner: async () => creditBalance } as never,
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
            return [{ total: tokenUsage }];
          }
          if (sql.includes('ORDER BY timestamp')) {
            return [{ timestamp: new Date() }];
          }
          return [];
        },
      }),
    } as never);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalCollaborationController],
      providers: [
        OrchestrationService,
        ExecutionSafetyGuard,
        GlobalSafetyLimitService,
        DailyCreditCapService,
        {
          provide: getRepositoryToken(CreditDeductionRecord),
          useValue: {
            createQueryBuilder: () => {
              const qb = {
                select: () => qb,
                where: () => qb,
                andWhere: () => qb,
                getRawOne: async () => ({ total: dailyCreditTotal }),
              };
              return qb;
            },
          },
        },
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
        { provide: UsageLedgerService, useValue: ledger },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    if (originalGlobal === undefined) {
      delete process.env.GLOBAL_EXECUTION_ENABLED;
    } else {
      process.env.GLOBAL_EXECUTION_ENABLED = originalGlobal;
    }
    if (originalProvider === undefined) {
      delete process.env.AI_PROVIDER;
    } else {
      process.env.AI_PROVIDER = originalProvider;
    }
    if (originalAbort === undefined) {
      delete process.env.ABORT_MODE;
    } else {
      process.env.ABORT_MODE = originalAbort;
    }
    AbortConfig.reset();
  });

  async function createRun(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/internal/collaboration/runs')
      .send({
        userId: 'user-01',
        projectId: 'project-01',
        initiatorAgent: { agentRole: 'builder', builderProfileId: 'builder-a' },
      })
      .expect(201);
    return response.body.collaborationRunId as string;
  }

  function http() {
    return request(app.getHttpServer());
  }

  function postReferral(
    runId: string,
    overrides: Record<string, unknown> = {},
  ) {
    return http()
      .post(`/api/internal/collaboration/runs/${runId}/referrals`)
      .send(referralBody(overrides));
  }

  function approve(runId: string, referralId: string, decidedBy = 'keith') {
    return http()
      .post(`/api/internal/collaboration/runs/${runId}/referrals/${referralId}/approve`)
      .send({ decidedBy });
  }

  async function expectNoJob(runId: string) {
    expect(queue.enqueueExecution).not.toHaveBeenCalled();
    expect(ledger.writeExecutionIntent).not.toHaveBeenCalled();
    const detail = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);
    expect(detail.body.referrals).toEqual([]);
  }

  async function expectStillWaiting(runId: string) {
    expect(queue.enqueueExecution).not.toHaveBeenCalled();
    expect(ledger.writeExecutionIntent).not.toHaveBeenCalled();
    const detail = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);
    expect(detail.body.run.status).toBe('active');
    expect(detail.body.referrals).toHaveLength(1);
    expect(detail.body.referrals[0].status).toBe('pending_approval');
    expect(detail.body.referrals[0].prompt).toBe('Review the plan');
    return detail;
  }

  it('saves a waiting hand-off and starts it once approve writes the ledger before the job', async () => {
    const order: string[] = [];
    ledger.writeExecutionIntent.mockImplementation(async () => {
      order.push('ledger');
    });
    queue.enqueueExecution.mockImplementation(async () => {
      order.push('enqueue');
    });

    const runId = await createRun();
    const waiting = await postReferral(runId, {
      harnessVersion: 'v1',
      harnessEntitlementProof: { token: 'no' },
      depth: 9,
      maxDepth: 99,
      referralChain: ['someone-else'],
      visitedBuilderProfileIds: [],
      constraints: { maxDepth: 99 },
    }).expect(201);

    expect(order).toEqual([]);
    expect(waiting.body.executionId).toBeNull();
    expect(waiting.body.referral.status).toBe('pending_approval');
    expect(waiting.body.referral.prompt).toBe('Review the plan');
    expect(waiting.body.referral.decidedBy).toBeNull();
    expect(waiting.body.referral.depth).toBe(0);
    expect(waiting.body.referral.maxDepth).toBe(DEFAULT_MAX_REFERRAL_DEPTH);
    expect(waiting.body.referral.referralChain).toEqual(['builder-a', 'builder-b']);
    expect(queue.enqueueExecution).not.toHaveBeenCalled();
    expect(ledger.writeExecutionIntent).not.toHaveBeenCalled();

    const response = await approve(runId, waiting.body.referral.referralId).expect(200);

    expect(order).toEqual(['ledger', 'enqueue']);
    expect(response.body.referral.status).toBe('in_progress');
    expect(response.body.referral.decidedBy).toBe('keith');
    expect(response.body.referral.prompt).toBe('Review the plan');
    expect(response.body.executionId).toEqual(expect.any(String));

    const payload = queue.enqueueExecution.mock.calls[0][0];
    expect(payload.executionId).toBe(response.body.executionId);
    expect(payload).not.toHaveProperty('harnessVersion');
    expect(payload.executionIntent).toBe('conversation');
    expect(payload).not.toHaveProperty('harnessEntitlementProof');
    expect(JSON.stringify(payload)).not.toContain('harnessVersion');
    expect(payload.isReferralExecution).toBe(true);

    const intent = ledger.writeExecutionIntent.mock.calls[0][0];
    expect(intent.executionId).toBe(response.body.executionId);
    expect(intent.userId).toBe('user-01');
    expect(intent.metadata).not.toHaveProperty('harnessVersion');
    expect(intent.metadata.runMode).toBe('ask');

    const repeat = await approve(runId, waiting.body.referral.referralId);
    expect(repeat.status).toBe(409);
    expect(queue.enqueueExecution).toHaveBeenCalledTimes(1);
    expect(ledger.writeExecutionIntent).toHaveBeenCalledTimes(1);
  });

  it('returns 500 and creates no job when the ledger write fails on approve', async () => {
    ledger.writeExecutionIntent.mockRejectedValue(new Error('connection refused'));
    const runId = await createRun();
    const waiting = await postReferral(runId).expect(201);

    const response = await approve(runId, waiting.body.referral.referralId).expect(500);

    expect(response.body.message).toBe('Failed to write execution intent');
    expect(queue.enqueueExecution).not.toHaveBeenCalled();

    const detail = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);
    expect(detail.body.referrals[0].status).toBe('failed');
  });

  it('refuses an invalid session before creating a referral or a job', async () => {
    const runId = await createRun();
    const response = await request(app.getHttpServer())
      .post(`/api/internal/collaboration/runs/${runId}/referrals`)
      .send(referralBody({ sessionId: 'not-a-uuid' }))
      .expect(400);

    expect(response.body.message).toContain('sessionId');
    await expectNoJob(runId);
  });

  it('refuses a missing prompt before creating a referral or a job', async () => {
    const runId = await createRun();
    const body = referralBody();
    delete (body as { prompt?: string }).prompt;

    const response = await request(app.getHttpServer())
      .post(`/api/internal/collaboration/runs/${runId}/referrals`)
      .send(body)
      .expect(400);

    expect(response.body.message).toContain('prompt');
    await expectNoJob(runId);
  });

  it('refuses A to A and A to B to A with no caller depth or visited values', async () => {
    const runId = await createRun();
    const sameBuilder = await postReferral(runId, {
      targetBuilder: { agentRole: 'builder', builderProfileId: 'builder-a' },
      idempotencyKey: 'key-loop-self',
    }).expect(400);
    expect(sameBuilder.body.message).toContain('loop detected');
    await expectNoJob(runId);

    const first = await postReferral(runId, { idempotencyKey: 'key-ab' }).expect(201);
    const loop = await postReferral(runId, {
      idempotencyKey: 'key-ba',
      sourceBuilder: { agentRole: 'chief-of-staff', builderProfileId: 'builder-b' },
      targetBuilder: { agentRole: 'builder', builderProfileId: 'builder-a' },
      parentReferralTraceId: first.body.referral.referralTraceId,
      depth: 0,
      maxDepth: 99,
      referralChain: ['builder-b'],
      visitedBuilderProfileIds: [],
      constraints: { maxDepth: 99, maxAgentsPerCollaboration: 100 },
    }).expect(400);

    expect(loop.body.message).toContain('loop detected');
    expect(queue.enqueueExecution).not.toHaveBeenCalled();
    expect(ledger.writeExecutionIntent).not.toHaveBeenCalled();
    const detail = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);
    expect(detail.body.referrals).toHaveLength(1);
    expect(detail.body.referrals[0].status).toBe('pending_approval');
  });

  it('refuses the next hop when caller values try to raise max depth', async () => {
    const runId = await createRun();
    const builders = ['builder-a', 'builder-b', 'builder-c', 'builder-d', 'builder-e'];
    const roles = ['builder', 'chief-of-staff', 'product-strategy', 'technology-advisor', 'builder'] as const;
    let parentTrace: string | undefined;
    for (let hop = 0; hop < DEFAULT_MAX_REFERRAL_DEPTH; hop += 1) {
      const created = await postReferral(runId, {
        idempotencyKey: `key-depth-${hop}`,
        sourceBuilder: { agentRole: roles[hop], builderProfileId: builders[hop] },
        targetBuilder: { agentRole: roles[hop + 1], builderProfileId: builders[hop + 1] },
        ...(parentTrace ? { parentReferralTraceId: parentTrace } : {}),
        depth: 0,
        maxDepth: 99,
        constraints: { maxDepth: 99 },
      }).expect(201);
      expect(created.body.referral.depth).toBe(hop);
      parentTrace = created.body.referral.referralTraceId as string;
    }

    const blocked = await postReferral(runId, {
      idempotencyKey: 'key-depth-blocked',
      sourceBuilder: { agentRole: 'builder', builderProfileId: 'builder-d' },
      targetBuilder: { agentRole: 'chief-of-staff', builderProfileId: 'builder-e' },
      parentReferralTraceId: parentTrace,
      depth: 0,
      maxDepth: 99,
      visitedBuilderProfileIds: [],
      referralChain: ['builder-d'],
      constraints: { maxDepth: 99 },
    }).expect(400);

    expect(blocked.body.message).toContain('exceeds max depth');
    expect(queue.enqueueExecution).not.toHaveBeenCalled();
    const detail = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);
    expect(detail.body.referrals).toHaveLength(DEFAULT_MAX_REFERRAL_DEPTH);
  });

  it('refuses a referral past the agent limit and creates no job', async () => {
    const runId = await createRun();
    const response = await request(app.getHttpServer())
      .post(`/api/internal/collaboration/runs/${runId}/referrals`)
      .send(referralBody({ constraints: { maxAgentsPerCollaboration: 1 } }))
      .expect(400);

    expect(response.body.message).toContain('Max agents');
    await expectNoJob(runId);
  });

  it('refuses a referral that is not read-only and creates no job', async () => {
    const runId = await createRun();
    const response = await request(app.getHttpServer())
      .post(`/api/internal/collaboration/runs/${runId}/referrals`)
      .send(referralBody({ constraints: { readOnly: false } }))
      .expect(400);

    expect(response.body.message).toContain('read-only');
    await expectNoJob(runId);
  });

  it('refuses a referral that allows a blocked write tool and creates no job', async () => {
    const runId = await createRun();
    const response = await request(app.getHttpServer())
      .post(`/api/internal/collaboration/runs/${runId}/referrals`)
      .send(referralBody({ constraints: { allowedTools: ['write_file'] } }))
      .expect(400);

    expect(response.body.message).toContain('blocked write-capable');
    await expectNoJob(runId);
  });

  it('syncs a finished execution when the run is read and leaves it unchanged on the next read', async () => {
    const runId = await createRun();
    const waiting = await postReferral(runId).expect(201);
    const started = await approve(runId, waiting.body.referral.referralId).expect(200);

    executionResults.getExecution
      .mockResolvedValueOnce({
        execution_status: 'completed',
        metadata: { aiExecutionResult: { output: 'the answer' } },
      })
      .mockResolvedValueOnce({
        execution_status: 'failed',
        metadata: { aiExecutionResult: { output: 'changed' } },
      });

    const first = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);
    const second = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);

    expect(first.body.run.collaborationRunId).toBe(runId);
    expect(first.body.run.status).toBe('completed');
    expect(first.body.referrals[0].referralId).toBe(started.body.referral.referralId);
    expect(first.body.referrals[0].status).toBe('completed');
    expect(first.body.referrals[0].result.summary).toBe('the answer');
    expect(second.body.run.status).toBe('completed');
    expect(second.body.run.completedAt).toBe(first.body.run.completedAt);
    expect(second.body.referrals[0].status).toBe('completed');
    expect(second.body.referrals[0].result.summary).toBe('the answer');
    expect(executionResults.getExecution).toHaveBeenCalledTimes(1);
    expect(executionResults.getExecution).toHaveBeenCalledWith(started.body.executionId);
  });

  it('leaves a still-running referral in progress and the run active', async () => {
    const runId = await createRun();
    const waiting = await postReferral(runId, { idempotencyKey: 'key-running' }).expect(201);
    await approve(runId, waiting.body.referral.referralId).expect(200);

    executionResults.getExecution.mockResolvedValue({
      execution_status: 'running',
      metadata: {},
    });

    const detail = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);

    expect(detail.body.run.status).toBe('active');
    expect(detail.body.referrals[0].status).toBe('in_progress');
    expect(detail.body.referrals[0].result).toBeNull();
  });

  it('marks a failed execution as a failed referral and fails the run', async () => {
    const runId = await createRun();
    const waiting = await postReferral(runId, { idempotencyKey: 'key-failed' }).expect(201);
    await approve(runId, waiting.body.referral.referralId).expect(200);

    executionResults.getExecution.mockResolvedValue({
      execution_status: 'failed',
      metadata: { aiExecutionResult: { output: 'could not finish' } },
    });

    const detail = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);

    expect(detail.body.referrals[0].status).toBe('failed');
    expect(detail.body.referrals[0].result.summary).toBe('could not finish');
    expect(detail.body.run.status).toBe('failed');
    expect(detail.body.run.failedAt).toEqual(expect.any(String));
  });

  it('refuses a parent that is not in this run and stores nothing', async () => {
    const runId = await createRun();
    const otherRunId = await createRun();
    const other = await postReferral(otherRunId, { idempotencyKey: 'key-other' }).expect(201);

    const missing = await postReferral(runId, {
      idempotencyKey: 'key-missing-parent',
      parentReferralTraceId: 'trace-does-not-exist',
    }).expect(400);
    expect(missing.body.message).toContain('not in this run');

    const foreign = await postReferral(runId, {
      idempotencyKey: 'key-foreign-parent',
      parentReferralTraceId: other.body.referral.referralTraceId,
    }).expect(400);
    expect(foreign.body.message).toContain('not in this run');

    const detail = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);
    expect(detail.body.referrals).toEqual([]);
    expect(queue.enqueueExecution).not.toHaveBeenCalled();
  });

  it('refuses the ninth stored hand-off and records limitType handoff', async () => {
    const runId = await createRun();
    for (let index = 0; index < MAX_HANDOFFS_PER_RUN; index += 1) {
      await postReferral(runId, { idempotencyKey: `key-${index}` }).expect(201);
    }
    const service = app.get(OrchestrationService);
    service.clearAuditEvents();

    const blocked = await postReferral(runId, { idempotencyKey: 'key-ninth' }).expect(400);
    expect(blocked.body.message).toContain('Handoff limit');
    expect(service.getAuditEvents()[0]?.eventType).toBe('orchestration.safety_limit_breached');
    expect(service.getAuditEvents()[0]?.payload.limitType).toBe('handoff');

    const replay = await postReferral(runId, { idempotencyKey: 'key-0' }).expect(201);
    expect(replay.body.referral.status).toBe('pending_approval');
    const detail = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);
    expect(detail.body.referrals).toHaveLength(MAX_HANDOFFS_PER_RUN);
    expect(detail.body.run.status).toBe('active');
    expect(queue.enqueueExecution).not.toHaveBeenCalled();
  });

  it('counts a rejected hand-off toward the eight', async () => {
    const runId = await createRun();
    const first = await postReferral(runId, { idempotencyKey: 'key-reject-count' }).expect(201);
    await http()
      .post(`/api/internal/collaboration/runs/${runId}/referrals/${first.body.referral.referralId}/reject`)
      .send({ decidedBy: 'keith', reason: 'no' })
      .expect(200);
    for (let index = 1; index < MAX_HANDOFFS_PER_RUN; index += 1) {
      await postReferral(runId, { idempotencyKey: `key-count-${index}` }).expect(201);
    }
    const blocked = await postReferral(runId, { idempotencyKey: 'key-count-ninth' }).expect(400);
    expect(blocked.body.message).toContain('Handoff limit');
  });

  it('rejects a waiting hand-off without a job and then refuses approve', async () => {
    const runId = await createRun();
    const waiting = await postReferral(runId).expect(201);
    await expectStillWaiting(runId);

    const rejected = await http()
      .post(
        `/api/internal/collaboration/runs/${runId}/referrals/${waiting.body.referral.referralId}/reject`,
      )
      .send({ decidedBy: 'keith', reason: 'not this plan' })
      .expect(200);

    expect(rejected.body.status).toBe('rejected');
    expect(rejected.body.decidedBy).toBe('keith');
    expect(rejected.body.cancelReason).toBe('not this plan');
    expect(rejected.body.cancelledByUserId).toBe('keith');
    expect(rejected.body.prompt).toBe('Review the plan');
    expect(queue.enqueueExecution).not.toHaveBeenCalled();
    expect(ledger.writeExecutionIntent).not.toHaveBeenCalled();

    const again = await approve(runId, waiting.body.referral.referralId);
    expect(again.status).toBe(409);
    expect(queue.enqueueExecution).not.toHaveBeenCalled();
    const detail = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);
    expect(detail.body.run.status).toBe('failed');
    expect(detail.body.referrals[0].status).toBe('rejected');
  });

  it('approves only one of two overlapping calls', async () => {
    const runId = await createRun();
    const waiting = await postReferral(runId).expect(201);
    const referralId = waiting.body.referral.referralId as string;

    const [first, second] = await Promise.all([
      approve(runId, referralId),
      approve(runId, referralId),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    expect(queue.enqueueExecution).toHaveBeenCalledTimes(1);
    expect(ledger.writeExecutionIntent).toHaveBeenCalledTimes(1);
  });

  it('leaves the hand-off waiting when the off switch refuses approve', async () => {
    const runId = await createRun();
    const waiting = await postReferral(runId).expect(201);
    process.env.GLOBAL_EXECUTION_ENABLED = 'false';

    const response = await approve(runId, waiting.body.referral.referralId).expect(503);
    expect(response.body.message).toContain('temporarily disabled');
    await expectStillWaiting(runId);
  });

  it('leaves the hand-off waiting when the hand-off provider is disabled', async () => {
    const runId = await createRun();
    const waiting = await postReferral(runId, { provider: 'not-a-provider' }).expect(201);

    const response = await approve(runId, waiting.body.referral.referralId).expect(503);
    expect(response.body.message).toContain('not-a-provider');
    expect(response.body.message).toContain('temporarily unavailable');
    await expectStillWaiting(runId);
  });

  it('leaves the hand-off waiting when the daily credit cap is reached', async () => {
    const savedPlatform = process.env.MAX_DAILY_CREDITS_PLATFORM;
    const savedUser = process.env.MAX_DAILY_CREDITS_PER_USER;
    process.env.MAX_DAILY_CREDITS_PLATFORM = '1000';
    process.env.MAX_DAILY_CREDITS_PER_USER = '500';
    try {
      const runId = await createRun();
      const waiting = await postReferral(runId).expect(201);
      dailyCreditTotal = '1000';

      const response = await approve(runId, waiting.body.referral.referralId).expect(429);
      expect(response.body.message).toContain('Daily credit limit reached');
      await expectStillWaiting(runId);
    } finally {
      if (savedPlatform === undefined) {
        delete process.env.MAX_DAILY_CREDITS_PLATFORM;
      } else {
        process.env.MAX_DAILY_CREDITS_PLATFORM = savedPlatform;
      }
      if (savedUser === undefined) {
        delete process.env.MAX_DAILY_CREDITS_PER_USER;
      } else {
        process.env.MAX_DAILY_CREDITS_PER_USER = savedUser;
      }
    }
  });

  it('leaves the hand-off waiting when abort mode blocks execution', async () => {
    const runId = await createRun();
    const waiting = await postReferral(runId).expect(201);
    process.env.ABORT_MODE = 'EXECUTION_BLOCKED';
    AbortConfig.initialize();

    const response = await approve(runId, waiting.body.referral.referralId).expect(503);
    expect(response.body.message).toContain('temporarily unavailable');
    await expectStillWaiting(runId);
  });

  it('leaves the hand-off waiting when the credit balance is exhausted or missing', async () => {
    const runId = await createRun();
    const waiting = await postReferral(runId).expect(201);
    creditBalance = { balance: 0 };

    const exhausted = await approve(runId, waiting.body.referral.referralId).expect(402);
    expect(exhausted.body.message).toContain('Insufficient credit balance');
    await expectStillWaiting(runId);

    creditBalance = null;
    const missing = await approve(runId, waiting.body.referral.referralId).expect(402);
    expect(missing.body.message).toContain('Credit balance not provisioned');
    await expectStillWaiting(runId);
  });

  it('leaves the hand-off waiting when the token limit is exceeded', async () => {
    const runId = await createRun();
    const waiting = await postReferral(runId).expect(201);
    tokenUsage = QuotaConfig.MAX_TOKENS_PER_24H;

    const response = await approve(runId, waiting.body.referral.referralId).expect(429);
    expect(response.body.message).toContain('Token quota exceeded');
    await expectStillWaiting(runId);
  });

  it('does not finish a run while a hand-off is waiting, and finishes from the other outcomes', async () => {
    const openRun = await createRun();
    const pending = await postReferral(openRun, { idempotencyKey: 'key-open-wait' }).expect(201);
    const started = await postReferral(openRun, { idempotencyKey: 'key-open-run' }).expect(201);
    await approve(openRun, started.body.referral.referralId).expect(200);
    executionResults.getExecution.mockResolvedValue({
      execution_status: 'completed',
      metadata: { aiExecutionResult: { output: 'done' } },
    });
    const stillOpen = await http().get(`/api/internal/collaboration/runs/${openRun}`).expect(200);
    expect(stillOpen.body.run.status).toBe('active');
    expect(stillOpen.body.referrals.map((referral: { status: string }) => referral.status).sort()).toEqual([
      'completed',
      'pending_approval',
    ]);
    expect(pending.body.referral.status).toBe('pending_approval');

    const successRun = await createRun();
    const done = await postReferral(successRun, { idempotencyKey: 'key-done' }).expect(201);
    const rejected = await postReferral(successRun, { idempotencyKey: 'key-rejected' }).expect(201);
    await http()
      .post(
        `/api/internal/collaboration/runs/${successRun}/referrals/${rejected.body.referral.referralId}/reject`,
      )
      .send({ decidedBy: 'keith', reason: 'skip' })
      .expect(200);
    await approve(successRun, done.body.referral.referralId).expect(200);
    executionResults.getExecution.mockResolvedValue({
      execution_status: 'completed',
      metadata: { aiExecutionResult: { output: 'ok' } },
    });
    const completed = await http().get(`/api/internal/collaboration/runs/${successRun}`).expect(200);
    expect(completed.body.run.status).toBe('completed');

    const failedRun = await createRun();
    const ok = await postReferral(failedRun, { idempotencyKey: 'key-ok' }).expect(201);
    const bad = await postReferral(failedRun, { idempotencyKey: 'key-bad' }).expect(201);
    const okStarted = await approve(failedRun, ok.body.referral.referralId).expect(200);
    const badStarted = await approve(failedRun, bad.body.referral.referralId).expect(200);
    executionResults.getExecution.mockImplementation(async (executionId: string) => {
      if (executionId === badStarted.body.executionId) {
        return {
          execution_status: 'timeout',
          metadata: { aiExecutionResult: { output: '' } },
        };
      }
      return {
        execution_status: 'completed',
        metadata: { aiExecutionResult: { output: 'ok' } },
      };
    });
    const failed = await http().get(`/api/internal/collaboration/runs/${failedRun}`).expect(200);
    expect(failed.body.referrals.find((referral: { referralId: string }) => referral.referralId === bad.body.referral.referralId).status).toBe('failed');
    expect(failed.body.run.status).toBe('failed');
    expect(okStarted.body.executionId).toEqual(expect.any(String));

    const timedOutRun = await createRun();
    const timed = await postReferral(timedOutRun, { idempotencyKey: 'key-timed' }).expect(201);
    referrals.get(timed.body.referral.referralId as string)!.status = 'timed_out';
    const timedOut = await http().get(`/api/internal/collaboration/runs/${timedOutRun}`).expect(200);
    expect(timedOut.body.run.status).toBe('failed');

    const cancelledRun = await createRun();
    const cancelledReferral = await postReferral(cancelledRun, {
      idempotencyKey: 'key-cancelled-run',
    }).expect(201);
    referrals.get(cancelledReferral.body.referral.referralId as string)!.status = 'completed';
    runs.get(cancelledRun)!.status = 'cancelled';
    const cancelled = await http().get(`/api/internal/collaboration/runs/${cancelledRun}`).expect(200);
    expect(cancelled.body.run.status).toBe('cancelled');
    expect(cancelled.body.run.completedAt).toBeNull();

    const cancelledOnly = await createRun();
    const held = await postReferral(cancelledOnly, { idempotencyKey: 'key-held' }).expect(201);
    referrals.get(held.body.referral.referralId as string)!.status = 'cancelled';
    const heldRun = await http().get(`/api/internal/collaboration/runs/${cancelledOnly}`).expect(200);
    expect(heldRun.body.run.status).toBe('active');
  });

  it('refuses a higher agent cap from the caller', async () => {
    const runId = await createRun();
    const targets = ['builder-b', 'builder-c', 'builder-d'];
    const roles = ['chief-of-staff', 'product-strategy', 'technology-advisor'] as const;
    for (let index = 0; index < targets.length; index += 1) {
      await postReferral(runId, {
        idempotencyKey: `key-agent-${index}`,
        targetBuilder: { agentRole: roles[index], builderProfileId: targets[index] },
      }).expect(201);
    }
    const blocked = await postReferral(runId, {
      idempotencyKey: 'key-agent-loose',
      targetBuilder: { agentRole: 'builder', builderProfileId: 'builder-e' },
      constraints: { maxAgentsPerCollaboration: 100 },
    }).expect(400);
    expect(blocked.body.message).toContain('Max agents');
    expect(queue.enqueueExecution).not.toHaveBeenCalled();
  });

  const listedAgents = [
    { name: 'lead', instructions: 'Break the work into steps.' },
    { name: 'writer', instructions: 'Write the code.' },
  ];

  function leadInstructions(agentName: string, own: string, otherName: string, other: string): string {
    return [
      'Be concise.',
      '',
      `You are ${agentName}.`,
      own,
      '',
      'Other agents:',
      `- ${otherName}: ${other}`,
      '',
      'Ask another agent only when you genuinely need them. At most one request, alone at the very end of the answer, exactly <handoff to="name">task</handoff>. Otherwise no request.',
    ].join('\n');
  }

  function completedExecution(output: string) {
    return {
      execution_status: 'completed',
      metadata: { aiExecutionResult: { output } },
    };
  }

  it.each([
    [
      'too many',
      Array.from({ length: DEFAULT_MAX_AGENTS_PER_COLLABORATION + 1 }, (_, index) => ({
        name: `agent-${index}`,
        instructions: 'Work.',
      })),
      'at most',
    ],
    ['a bad name', [{ name: 'Lead', instructions: 'Work.' }], 'name is invalid'],
    [
      'a duplicate name',
      [
        { name: 'lead', instructions: 'Work.' },
        { name: 'lead', instructions: 'Again.' },
      ],
      'duplicated',
    ],
    [
      'instructions that are too long',
      [{ name: 'lead', instructions: 'x'.repeat(4001) }],
      'at most 4000',
    ],
    ['not an array', 'lead', 'must be an array'],
    ['empty', [], 'at most'],
  ])('rejects an agent list with %s and stores nothing', async (_label, agents, message) => {
    const runId = await createRun();
    const response = await postReferral(runId, {
      idempotencyKey: `bad-agents-${_label}`,
      targetBuilder: { agentRole: 'builder', builderProfileId: 'lead' },
      agents,
    }).expect(400);

    expect(response.body.message).toContain(message);
    await expectNoJob(runId);
  });

  it('rejects a target that is not on the list, including a later hand-off', async () => {
    const runId = await createRun();
    const missing = await postReferral(runId, {
      idempotencyKey: 'missing-target',
      targetBuilder: { agentRole: 'builder', builderProfileId: 'reviewer' },
      agents: listedAgents,
    }).expect(400);
    expect(missing.body.message).toContain('not on the agent list');
    await expectNoJob(runId);

    const root = await postReferral(runId, {
      idempotencyKey: 'listed-root',
      targetBuilder: { agentRole: 'builder', builderProfileId: 'lead' },
      agents: listedAgents,
    }).expect(201);
    const carried = await postReferral(runId, {
      idempotencyKey: 'listed-child',
      sourceBuilder: { agentRole: 'builder', builderProfileId: 'lead' },
      targetBuilder: { agentRole: 'builder', builderProfileId: 'reviewer' },
      parentReferralTraceId: root.body.referral.referralTraceId,
    }).expect(400);
    expect(carried.body.message).toContain('not on the agent list');

    const detail = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);
    expect(detail.body.referrals).toHaveLength(1);
    expect(queue.enqueueExecution).not.toHaveBeenCalled();
  });

  it('rejects an agent list on a hand-off that already has a parent', async () => {
    const runId = await createRun();
    const root = await postReferral(runId, {
      idempotencyKey: 'agents-root',
      targetBuilder: { agentRole: 'builder', builderProfileId: 'lead' },
      agents: listedAgents,
    }).expect(201);

    const child = await postReferral(runId, {
      idempotencyKey: 'agents-child',
      sourceBuilder: { agentRole: 'builder', builderProfileId: 'lead' },
      targetBuilder: { agentRole: 'builder', builderProfileId: 'writer' },
      parentReferralTraceId: root.body.referral.referralTraceId,
      agents: listedAgents,
    }).expect(400);

    expect(child.body.message).toContain('only accepted on the first hand-off');
    const detail = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);
    expect(detail.body.referrals).toHaveLength(1);
  });

  it('tells the job its role and the other agents, then creates one waiting hand-off from the answer', async () => {
    const runId = await createRun();
    const waiting = await postReferral(runId, {
      idempotencyKey: 'choose-root',
      sourceBuilder: { agentRole: 'builder', builderProfileId: 'builder-a' },
      targetBuilder: { agentRole: 'builder', builderProfileId: 'lead' },
      projectInstructions: 'Be concise.',
      agents: listedAgents,
    }).expect(201);
    const parentId = waiting.body.referral.referralId as string;
    await approve(runId, parentId).expect(200);

    const payload = queue.enqueueExecution.mock.calls[0][0];
    expect(payload.projectInstructions).toBe(
      leadInstructions('lead', 'Break the work into steps.', 'writer', 'Write the code.'),
    );
    expect(payload.executionIntent).toBe('conversation');

    const answer = 'The draft is ready.\n\n<handoff to="writer">Tighten the opening.</handoff>';
    executionResults.getExecution.mockResolvedValue(completedExecution(answer));

    const first = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);
    const second = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);
    await app.get(OrchestrationService).sweepCollaborations(new Date());
    const third = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);

    for (const detail of [first, second, third]) {
      expect(detail.body.run.status).toBe('active');
      expect(detail.body.referrals).toHaveLength(2);
      const parent = detail.body.referrals.find(
        (referral: { referralId: string }) => referral.referralId === parentId,
      );
      const child = detail.body.referrals.find(
        (referral: { referralId: string }) => referral.referralId !== parentId,
      );
      expect(parent.status).toBe('completed');
      expect(parent.result.summary).toBe(answer);
      expect(parent.handoffNote).toBeNull();
      expect(child.status).toBe('pending_approval');
      expect(child.decidedBy).toBeNull();
      expect(child.prompt).toBe('Tighten the opening.\n\nThe draft is ready.');
      expect(child.prompt).not.toContain('<handoff');
      expect(child.sourceBuilder).toEqual({ agentRole: 'builder', builderProfileId: 'lead' });
      expect(child.targetBuilder).toEqual({ agentRole: 'builder', builderProfileId: 'writer' });
      expect(child.parentReferralTraceId).toBe(waiting.body.referral.referralTraceId);
      expect(child.idempotencyKey).toBe(answerHandoffIdempotencyKey(parentId));
      expect(child.referralId).toBe(first.body.referrals[1].referralId);
    }

    const storedChild = referrals.get(first.body.referrals[1].referralId as string);
    expect(storedChild?.executionId ?? null).toBeNull();
    expect(storedChild?.pendingJob?.provider).toBe('stub');
    expect(storedChild?.pendingJob?.adapter).toBe('stub');
    expect(storedChild?.pendingJob?.model).toBe('test-model');
    expect(storedChild?.pendingJob?.sessionId).toBe(sessionId);
    expect(storedChild?.pendingJob?.conversationId).toBe(conversationId);
    expect(storedChild?.pendingJob?.agents).toEqual(listedAgents);
    expect(storedChild?.pendingJob?.projectInstructions).toBe(
      leadInstructions('writer', 'Write the code.', 'lead', 'Break the work into steps.'),
    );
    expect(queue.enqueueExecution).toHaveBeenCalledTimes(1);
    expect(ledger.writeExecutionIntent).toHaveBeenCalledTimes(1);

    const otherRun = await createRun();
    const other = await postReferral(otherRun, {
      idempotencyKey: 'choose-sweep-first',
      targetBuilder: { agentRole: 'builder', builderProfileId: 'lead' },
      projectInstructions: 'Be concise.',
      agents: listedAgents,
    }).expect(201);
    await approve(otherRun, other.body.referral.referralId).expect(200);
    const service = app.get(OrchestrationService);
    await service.sweepCollaborations(new Date());
    await service.sweepCollaborations(new Date());
    const swept = await http().get(`/api/internal/collaboration/runs/${otherRun}`).expect(200);
    expect(swept.body.run.status).toBe('active');
    expect(swept.body.referrals).toHaveLength(2);
    expect(swept.body.referrals.map((referral: { status: string }) => referral.status).sort()).toEqual([
      'completed',
      'pending_approval',
    ]);
    expect(queue.enqueueExecution).toHaveBeenCalledTimes(2);
    expect(ledger.writeExecutionIntent).toHaveBeenCalledTimes(2);
  });

  it('ends a branch that does not ask, and ignores a request when the run has no agent list', async () => {
    const plainRun = await createRun();
    const plain = await postReferral(plainRun, {
      idempotencyKey: 'no-request',
      targetBuilder: { agentRole: 'builder', builderProfileId: 'lead' },
      agents: listedAgents,
    }).expect(201);
    await approve(plainRun, plain.body.referral.referralId).expect(200);
    executionResults.getExecution.mockResolvedValue(completedExecution('All done.'));
    const finished = await http().get(`/api/internal/collaboration/runs/${plainRun}`).expect(200);
    expect(finished.body.run.status).toBe('completed');
    expect(finished.body.referrals).toHaveLength(1);
    expect(finished.body.referrals[0].status).toBe('completed');
    expect(finished.body.referrals[0].handoffNote).toBeNull();
    expect(finished.body.referrals[0].result.summary).toBe('All done.');

    const unlisted = await createRun();
    const referral = await postReferral(unlisted, { idempotencyKey: 'no-list' }).expect(201);
    await approve(unlisted, referral.body.referral.referralId).expect(200);
    const tagged = 'Done\n<handoff to="writer">Tighten the opening.</handoff>';
    executionResults.getExecution.mockResolvedValue(completedExecution(tagged));
    const detail = await http().get(`/api/internal/collaboration/runs/${unlisted}`).expect(200);
    expect(detail.body.run.status).toBe('completed');
    expect(detail.body.referrals).toHaveLength(1);
    expect(detail.body.referrals[0].status).toBe('completed');
    expect(detail.body.referrals[0].handoffNote).toBeNull();
    expect(detail.body.referrals[0].result.summary).toBe(tagged);
    expect(queue.enqueueExecution).toHaveBeenCalledTimes(2);
    expect(ledger.writeExecutionIntent).toHaveBeenCalledTimes(2);
  });

  it('records a malformed request, keeps the full answer, and does not create a hand-off', async () => {
    const runId = await createRun();
    const waiting = await postReferral(runId, {
      idempotencyKey: 'malformed-request',
      targetBuilder: { agentRole: 'builder', builderProfileId: 'lead' },
      agents: listedAgents,
    }).expect(201);
    await approve(runId, waiting.body.referral.referralId).expect(200);
    const answer = 'See <handoff to="writer">Tighten the opening.</handoff> above';
    executionResults.getExecution.mockResolvedValue(completedExecution(answer));

    const detail = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);

    expect(detail.body.run.status).toBe('completed');
    expect(detail.body.referrals).toHaveLength(1);
    expect(detail.body.referrals[0].status).toBe('completed');
    expect(detail.body.referrals[0].result.summary).toBe(answer);
    expect(detail.body.referrals[0].handoffNote).toBe('malformed: not_at_end');
    expect(queue.enqueueExecution).toHaveBeenCalledTimes(1);
    expect(ledger.writeExecutionIntent).toHaveBeenCalledTimes(1);
  });

  it('records a name that is not on the list and a task that is too long without a job', async () => {
    const service = app.get(OrchestrationService);
    const runId = await createRun();
    const unknown = await postReferral(runId, {
      idempotencyKey: 'unknown-name',
      targetBuilder: { agentRole: 'builder', builderProfileId: 'lead' },
      agents: listedAgents,
    }).expect(201);
    await approve(runId, unknown.body.referral.referralId).expect(200);
    executionResults.getExecution.mockResolvedValue(
      completedExecution('Ready.\n<handoff to="reviewer">Look again.</handoff>'),
    );
    service.clearAuditEvents();
    const unknownDetail = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);
    expect(unknownDetail.body.referrals).toHaveLength(1);
    expect(unknownDetail.body.referrals[0].status).toBe('completed');
    expect(unknownDetail.body.referrals[0].handoffNote).toBe('refused: agent_not_on_list');
    expect(unknownDetail.body.run.status).toBe('completed');
    expect(
      service.getAuditEvents().some(
        (event) =>
          event.eventType === 'orchestration.safety_limit_breached' &&
          event.payload.reason === 'agent_not_on_list',
      ),
    ).toBe(true);

    const longRun = await createRun();
    const long = await postReferral(longRun, {
      idempotencyKey: 'long-task',
      targetBuilder: { agentRole: 'builder', builderProfileId: 'lead' },
      agents: listedAgents,
    }).expect(201);
    await approve(longRun, long.body.referral.referralId).expect(200);
    const task = 'b'.repeat(MAX_HANDOFF_TASK_CHARS + 1);
    const longAnswer = `Ready.\n<handoff to="writer">${task}</handoff>`;
    executionResults.getExecution.mockResolvedValue(completedExecution(longAnswer));
    service.clearAuditEvents();
    const longDetail = await http().get(`/api/internal/collaboration/runs/${longRun}`).expect(200);
    expect(longDetail.body.referrals).toHaveLength(1);
    expect(longDetail.body.referrals[0].status).toBe('completed');
    expect(longDetail.body.referrals[0].result.summary).toBe(longAnswer);
    expect(longDetail.body.referrals[0].handoffNote).toBe('refused: task_too_long');
    expect(
      service.getAuditEvents().some(
        (event) =>
          event.eventType === 'orchestration.safety_limit_breached' &&
          event.payload.reason === 'task_too_long',
      ),
    ).toBe(true);
    expect(queue.enqueueExecution).toHaveBeenCalledTimes(2);
    expect(ledger.writeExecutionIntent).toHaveBeenCalledTimes(2);
  });

  it('records a loop, a depth limit, an agent limit, and the eight-hand-off limit without failing the parent', async () => {
    const service = app.get(OrchestrationService);

    const loopRun = await createRun();
    const loop = await postReferral(loopRun, {
      idempotencyKey: 'loop-root',
      targetBuilder: { agentRole: 'builder', builderProfileId: 'lead' },
      agents: listedAgents,
    }).expect(201);
    await approve(loopRun, loop.body.referral.referralId).expect(200);
    executionResults.getExecution.mockResolvedValue(
      completedExecution('Ready.\n<handoff to="lead">Again.</handoff>'),
    );
    const loopDetail = await http().get(`/api/internal/collaboration/runs/${loopRun}`).expect(200);
    expect(loopDetail.body.referrals).toHaveLength(1);
    expect(loopDetail.body.referrals[0].status).toBe('completed');
    expect(loopDetail.body.referrals[0].handoffNote).toBe('refused: loop');
    expect(
      service.getAuditEvents().some((event) => event.payload.limitType === 'loop'),
    ).toBe(true);

    const depthAgents = [
      { name: 'writer', instructions: 'Write.' },
      { name: 'editor', instructions: 'Edit.' },
      { name: 'extra', instructions: 'Extra.' },
      { name: 'fifth', instructions: 'Fifth.' },
    ];
    const depthRun = await createRun();
    const depthNames = ['writer', 'editor', 'extra'];
    let parentTrace: string | undefined;
    let depthParentId = '';
    for (let hop = 0; hop < depthNames.length; hop += 1) {
      const created = await postReferral(depthRun, {
        idempotencyKey: `depth-${hop}`,
        sourceBuilder: {
          agentRole: 'builder',
          builderProfileId: hop === 0 ? 'builder-a' : depthNames[hop - 1],
        },
        targetBuilder: { agentRole: 'builder', builderProfileId: depthNames[hop] },
        ...(hop === 0 ? { agents: depthAgents } : { parentReferralTraceId: parentTrace }),
      }).expect(201);
      parentTrace = created.body.referral.referralTraceId as string;
      depthParentId = created.body.referral.referralId as string;
    }
    await approve(depthRun, depthParentId).expect(200);
    executionResults.getExecution.mockResolvedValue(
      completedExecution('Ready.\n<handoff to="fifth">Continue.</handoff>'),
    );
    const depthDetail = await http().get(`/api/internal/collaboration/runs/${depthRun}`).expect(200);
    expect(depthDetail.body.referrals).toHaveLength(3);
    expect(depthDetail.body.run.status).toBe('active');
    const depthParent = depthDetail.body.referrals.find(
      (referral: { referralId: string }) => referral.referralId === depthParentId,
    );
    expect(depthParent.status).toBe('completed');
    expect(depthParent.handoffNote).toBe('refused: depth');
    expect(
      service.getAuditEvents().some((event) => event.payload.limitType === 'depth'),
    ).toBe(true);

    const limitAgents = [
      { name: 'a1', instructions: 'One.' },
      { name: 'a2', instructions: 'Two.' },
      { name: 'a3', instructions: 'Three.' },
      { name: 'a4', instructions: 'Four.' },
    ];
    const agentRun = await createRun();
    let answeringId = '';
    for (let index = 1; index <= 3; index += 1) {
      const created = await postReferral(agentRun, {
        idempotencyKey: `agent-${index}`,
        targetBuilder: { agentRole: 'builder', builderProfileId: `a${index}` },
        ...(index === 1 ? { agents: limitAgents } : {}),
      }).expect(201);
      if (index === 1) {
        answeringId = created.body.referral.referralId as string;
      }
    }
    await approve(agentRun, answeringId).expect(200);
    executionResults.getExecution.mockResolvedValue(
      completedExecution('Ready.\n<handoff to="a4">Next.</handoff>'),
    );
    const agentDetail = await http().get(`/api/internal/collaboration/runs/${agentRun}`).expect(200);
    expect(agentDetail.body.referrals).toHaveLength(3);
    expect(agentDetail.body.run.status).toBe('active');
    expect(
      agentDetail.body.referrals.find(
        (referral: { referralId: string }) => referral.referralId === answeringId,
      ).handoffNote,
    ).toBe('refused: agent_limit');
    expect(
      service.getAuditEvents().some((event) => event.payload.limitType === 'agent_limit'),
    ).toBe(true);

    const capRun = await createRun();
    let cappedId = '';
    for (let index = 0; index < MAX_HANDOFFS_PER_RUN; index += 1) {
      const created = await postReferral(capRun, {
        idempotencyKey: `cap-${index}`,
        ...(index === 0
          ? {
              targetBuilder: { agentRole: 'builder', builderProfileId: 'lead' },
              agents: listedAgents,
            }
          : {}),
      }).expect(201);
      if (index === 0) {
        cappedId = created.body.referral.referralId as string;
      }
    }
    await approve(capRun, cappedId).expect(200);
    executionResults.getExecution.mockResolvedValue(
      completedExecution('Ready.\n<handoff to="writer">Next.</handoff>'),
    );
    const calls = {
      queue: queue.enqueueExecution.mock.calls.length,
      ledger: ledger.writeExecutionIntent.mock.calls.length,
    };
    const capDetail = await http().get(`/api/internal/collaboration/runs/${capRun}`).expect(200);
    expect(capDetail.body.referrals).toHaveLength(MAX_HANDOFFS_PER_RUN);
    expect(capDetail.body.run.status).toBe('active');
    expect(
      capDetail.body.referrals.find(
        (referral: { referralId: string }) => referral.referralId === cappedId,
      ).handoffNote,
    ).toBe('refused: handoff_limit');
    expect(
      capDetail.body.referrals.find(
        (referral: { referralId: string }) => referral.referralId === cappedId,
      ).status,
    ).toBe('completed');
    expect(
      service.getAuditEvents().some((event) => event.payload.limitType === 'handoff'),
    ).toBe(true);
    expect(queue.enqueueExecution).toHaveBeenCalledTimes(calls.queue);
    expect(ledger.writeExecutionIntent).toHaveBeenCalledTimes(calls.ledger);
  });

  it('expires a hand-off at 24 hours, finishes settled runs, and never approves', async () => {
    const now = new Date('2026-11-02T12:00:00.000Z');
    const service = app.get(OrchestrationService);

    const oldRun = await createRun();
    const oldWaiting = await postReferral(oldRun, { idempotencyKey: 'old-wait' }).expect(201);
    referrals.get(oldWaiting.body.referral.referralId as string)!.createdAt = new Date(
      now.getTime() - COLLABORATION_WAITING_MAX_AGE_MS,
    );

    const youngRun = await createRun();
    const youngWaiting = await postReferral(youngRun, { idempotencyKey: 'young-wait' }).expect(201);
    referrals.get(youngWaiting.body.referral.referralId as string)!.createdAt = new Date(
      now.getTime() - COLLABORATION_WAITING_MAX_AGE_MS + 1,
    );

    const agedOpen = await createRun();
    runs.get(agedOpen)!.createdAt = new Date(now.getTime() - COLLABORATION_WAITING_MAX_AGE_MS - 1000);
    const held = await postReferral(agedOpen, { idempotencyKey: 'held-open' }).expect(201);
    referrals.get(held.body.referral.referralId as string)!.createdAt = new Date(now.getTime() - 1000);

    const finishedRun = await createRun();
    const done = await postReferral(finishedRun, { idempotencyKey: 'sweep-finished' }).expect(201);
    await approve(finishedRun, done.body.referral.referralId).expect(200);
    executionResults.getExecution.mockResolvedValue(completedExecution('done'));

    const emptyOld = await createRun();
    runs.get(emptyOld)!.createdAt = new Date(now.getTime() - COLLABORATION_WAITING_MAX_AGE_MS);
    const emptyYoung = await createRun();
    runs.get(emptyYoung)!.createdAt = new Date(now.getTime() - COLLABORATION_WAITING_MAX_AGE_MS + 1);

    const approvedBefore = service
      .getAuditEvents()
      .filter((event) => event.eventType === 'orchestration.referral_approved').length;
    const queueBefore = queue.enqueueExecution.mock.calls.length;
    const ledgerBefore = ledger.writeExecutionIntent.mock.calls.length;

    await service.sweepCollaborations(now);

    const oldDetail = await http().get(`/api/internal/collaboration/runs/${oldRun}`).expect(200);
    expect(oldDetail.body.referrals[0].status).toBe('timed_out');
    expect(oldDetail.body.referrals[0].result.summary).toBe(HANDOFF_WAIT_TIMEOUT_REASON);
    expect(oldDetail.body.run.status).toBe('failed');

    const youngDetail = await http().get(`/api/internal/collaboration/runs/${youngRun}`).expect(200);
    expect(youngDetail.body.referrals[0].status).toBe('pending_approval');
    expect(youngDetail.body.referrals[0].decidedBy).toBeNull();
    expect(youngDetail.body.run.status).toBe('active');

    const heldDetail = await http().get(`/api/internal/collaboration/runs/${agedOpen}`).expect(200);
    expect(heldDetail.body.referrals[0].status).toBe('pending_approval');
    expect(heldDetail.body.run.status).toBe('active');

    const finishedDetail = await http()
      .get(`/api/internal/collaboration/runs/${finishedRun}`)
      .expect(200);
    expect(finishedDetail.body.run.status).toBe('completed');
    expect(finishedDetail.body.referrals).toHaveLength(1);
    expect(finishedDetail.body.referrals[0].status).toBe('completed');

    expect((await http().get(`/api/internal/collaboration/runs/${emptyOld}`)).body.run.status).toBe(
      'failed',
    );
    expect((await http().get(`/api/internal/collaboration/runs/${emptyYoung}`)).body.run.status).toBe(
      'active',
    );

    expect(queue.enqueueExecution).toHaveBeenCalledTimes(queueBefore);
    expect(ledger.writeExecutionIntent).toHaveBeenCalledTimes(ledgerBefore);
    expect(
      service.getAuditEvents().filter((event) => event.eventType === 'orchestration.referral_approved'),
    ).toHaveLength(approvedBefore);
    for (const referral of referrals.values()) {
      expect(referral.status).not.toBe('approved');
    }
    expect(COLLABORATION_WAITING_MAX_AGE_MS).toBe(24 * 60 * 60 * 1000);
  });

  describe('COLLAB-HANDOFF-RECOVER-01 hand-off recovery', () => {
    const requestedAnswer =
      'The draft is ready.\n\n<handoff to="writer">Tighten the opening.</handoff>';
    let recoverSequence = 0;

    function referralsIn(runId: string): CollaborationReferralEntity[] {
      return [...referrals.values()].filter((row) => row.collaborationRunId === runId);
    }

    async function stageAnswer(input: {
      summary: string;
      completedAt: Date;
      handoffNote?: string;
      runStatus?: 'completed' | 'failed' | 'cancelled' | 'timed_out';
      referralStatus?: 'completed' | 'failed' | 'rejected' | 'timed_out';
    }): Promise<{ runId: string; referralId: string }> {
      recoverSequence += 1;
      const runId = await createRun();
      const created = await postReferral(runId, {
        idempotencyKey: `recover-${recoverSequence}`,
        targetBuilder: { agentRole: 'builder', builderProfileId: 'lead' },
        projectInstructions: 'Be concise.',
        agents: listedAgents,
      }).expect(201);
      const referralId = created.body.referral.referralId as string;
      await approve(runId, referralId).expect(200);
      const row = referrals.get(referralId);
      if (!row?.pendingJob) {
        throw new Error('staged referral has no pending job');
      }
      row.status = input.referralStatus ?? 'completed';
      row.resultStatus = row.status === 'completed' ? 'success' : 'failed';
      row.resultSummary = input.summary;
      row.resultOutputFiles = [];
      row.resultDurationMs = 1;
      row.completedAt = input.completedAt;
      row.updatedAt = input.completedAt;
      if (input.handoffNote) {
        row.pendingJob = { ...row.pendingJob, handoffNote: input.handoffNote };
      }
      if (input.runStatus) {
        const run = runs.get(runId);
        if (!run) {
          throw new Error('staged run missing');
        }
        run.status = input.runStatus;
      }
      return { runId, referralId };
    }

    async function holdRunOpen(runId: string): Promise<void> {
      await postReferral(runId, {
        idempotencyKey: `hold-${runId}`,
        targetBuilder: { agentRole: 'builder', builderProfileId: 'lead' },
        agents: listedAgents,
      }).expect(201);
    }

    it('creates the waiting hand-off and does not finish the run before it exists', async () => {
      const now = new Date();
      const staged = await stageAnswer({
        summary: requestedAnswer,
        completedAt: new Date(),
      });
      const queued = queue.enqueueExecution.mock.calls.length;
      const ledgerWrites = ledger.writeExecutionIntent.mock.calls.length;

      await app.get(OrchestrationService).sweepCollaborations(now);

      expect(queue.enqueueExecution).toHaveBeenCalledTimes(queued);
      expect(ledger.writeExecutionIntent).toHaveBeenCalledTimes(ledgerWrites);
      const detail = await http().get(`/api/internal/collaboration/runs/${staged.runId}`).expect(200);
      expect(detail.body.run.status).toBe('active');
      expect(detail.body.referrals).toHaveLength(2);
      const parent = detail.body.referrals.find(
        (referral: { referralId: string }) => referral.referralId === staged.referralId,
      );
      const child = detail.body.referrals.find(
        (referral: { referralId: string }) => referral.referralId !== staged.referralId,
      );
      expect(parent.status).toBe('completed');
      expect(parent.handoffNote).toBeNull();
      expect(child.status).toBe('pending_approval');
      expect(child.decidedBy).toBeNull();
      expect(child.prompt).toBe('Tighten the opening.\n\nThe draft is ready.');
      expect(child.idempotencyKey).toBe(answerHandoffIdempotencyKey(staged.referralId));
      expect(child.parentReferralTraceId).toBe(referrals.get(staged.referralId)?.referralTraceId);
    });

    it('creates the lost hand-off when the run is read, before the run is settled', async () => {
      const staged = await stageAnswer({
        summary: requestedAnswer,
        completedAt: new Date(),
      });

      const detail = await http().get(`/api/internal/collaboration/runs/${staged.runId}`).expect(200);

      expect(detail.body.run.status).toBe('active');
      expect(detail.body.referrals).toHaveLength(2);
      const parent = detail.body.referrals.find(
        (referral: { referralId: string }) => referral.referralId === staged.referralId,
      );
      const child = detail.body.referrals.find(
        (referral: { referralId: string }) => referral.referralId !== staged.referralId,
      );
      expect(parent.handoffNote).toBeNull();
      expect(parent).not.toHaveProperty('handoffChecked');
      expect(child.status).toBe('pending_approval');
      expect(child.idempotencyKey).toBe(answerHandoffIdempotencyKey(staged.referralId));
      expect(referrals.get(staged.referralId)?.pendingJob?.handoffChecked).toBe(true);
    });

    it('does not hold the run open for a completed step with no pending job', async () => {
      const staged = await stageAnswer({
        summary: requestedAnswer,
        completedAt: new Date(),
      });
      const row = referrals.get(staged.referralId);
      if (!row) {
        throw new Error('staged referral missing');
      }
      row.pendingJob = null;

      const detail = await http().get(`/api/internal/collaboration/runs/${staged.runId}`).expect(200);

      expect(detail.body.run.status).toBe('completed');
      expect(detail.body.referrals).toHaveLength(1);
      expect(detail.body.referrals[0].handoffNote).toBeNull();
    });

    it('skips a step whose follow-up exists in any status', async () => {
      const now = new Date();
      const completedAt = new Date();
      const statuses = [
        'pending_approval',
        'approved',
        'in_progress',
        'completed',
        'failed',
        'cancelled',
        'timed_out',
        'rejected',
      ] as const;
      for (const status of statuses) {
        const staged = await stageAnswer({ summary: requestedAnswer, completedAt });
        const followUp = await postReferral(staged.runId, {
          idempotencyKey: answerHandoffIdempotencyKey(staged.referralId),
          sourceBuilder: { agentRole: 'builder', builderProfileId: 'lead' },
          targetBuilder: { agentRole: 'builder', builderProfileId: 'writer' },
          parentReferralTraceId: referrals.get(staged.referralId)?.referralTraceId,
        }).expect(201);
        const followUpId = followUp.body.referral.referralId as string;
        const followUpRow = referrals.get(followUpId);
        if (!followUpRow) {
          throw new Error('missing follow-up');
        }
        followUpRow.status = status;
        const before = referrals.size;

        await app.get(OrchestrationService).sweepCollaborations(now);

        expect(referrals.size).toBe(before);
        expect(
          [...referrals.values()].filter(
            (row) => row.idempotencyKey === answerHandoffIdempotencyKey(staged.referralId),
          ),
        ).toHaveLength(1);
        expect(referrals.get(followUpId)?.status).toBe(status);
      }
    });

    it('creates one follow-up when the sweep runs twice', async () => {
      const now = new Date();
      const staged = await stageAnswer({
        summary: requestedAnswer,
        completedAt: new Date(),
      });
      const service = app.get(OrchestrationService);

      await service.sweepCollaborations(now);
      await service.sweepCollaborations(now);

      const matches = referralsIn(staged.runId).filter(
        (row) => row.idempotencyKey === answerHandoffIdempotencyKey(staged.referralId),
      );
      expect(matches).toHaveLength(1);
      expect(matches[0].status).toBe('pending_approval');
      expect(referralsIn(staged.runId)).toHaveLength(2);
      expect(runs.get(staged.runId)?.status).toBe('active');
    });

    it('records a step with no request once and skips it afterwards', async () => {
      const now = new Date();
      const staged = await stageAnswer({
        summary: 'All done.',
        completedAt: new Date(),
      });
      await holdRunOpen(staged.runId);
      const service = app.get(OrchestrationService);

      await service.sweepCollaborations(now);

      expect(referrals.get(staged.referralId)?.pendingJob?.handoffChecked).toBe(true);
      expect(referrals.get(staged.referralId)?.pendingJob?.handoffNote ?? null).toBeNull();
      const count = referralsIn(staged.runId).length;
      const stored = referrals.get(staged.referralId);
      if (!stored) {
        throw new Error('staged referral missing');
      }
      stored.resultSummary = requestedAnswer;

      await service.sweepCollaborations(now);

      expect(referrals.get(staged.referralId)?.pendingJob?.handoffChecked).toBe(true);
      expect(referrals.get(staged.referralId)?.pendingJob?.handoffNote ?? null).toBeNull();
      expect(referralsIn(staged.runId)).toHaveLength(count);
      expect(
        referralsIn(staged.runId).some(
          (row) => row.idempotencyKey === answerHandoffIdempotencyKey(staged.referralId),
        ),
      ).toBe(false);
    });

    it('keeps refused and malformed notes', async () => {
      const now = new Date();
      const completedAt = new Date();
      const service = app.get(OrchestrationService);

      const malformed = await stageAnswer({
        summary: 'See <handoff to="writer">Tighten the opening.</handoff> above',
        completedAt,
      });
      await holdRunOpen(malformed.runId);
      await service.sweepCollaborations(now);
      expect(referrals.get(malformed.referralId)?.pendingJob?.handoffNote).toBe(
        'malformed: not_at_end',
      );
      const malformedCount = referralsIn(malformed.runId).length;
      const malformedRow = referrals.get(malformed.referralId);
      if (!malformedRow) {
        throw new Error('malformed referral missing');
      }
      malformedRow.resultSummary = requestedAnswer;
      await service.sweepCollaborations(now);
      expect(referrals.get(malformed.referralId)?.pendingJob?.handoffNote).toBe(
        'malformed: not_at_end',
      );
      expect(referralsIn(malformed.runId)).toHaveLength(malformedCount);

      const kept = await stageAnswer({
        summary: requestedAnswer,
        completedAt,
        handoffNote: 'refused: loop',
      });
      await holdRunOpen(kept.runId);
      await service.sweepCollaborations(now);
      expect(referrals.get(kept.referralId)?.pendingJob?.handoffNote).toBe('refused: loop');
      expect(
        referralsIn(kept.runId).some(
          (row) => row.idempotencyKey === answerHandoffIdempotencyKey(kept.referralId),
        ),
      ).toBe(false);

      service.clearAuditEvents();
      const unlisted = await stageAnswer({
        summary: 'Ready.\n<handoff to="reviewer">Look again.</handoff>',
        completedAt,
      });
      const looped = await stageAnswer({
        summary: 'Ready.\n<handoff to="lead">Again.</handoff>',
        completedAt,
      });
      await service.sweepCollaborations(now);
      expect(referrals.get(unlisted.referralId)?.pendingJob?.handoffNote).toBe(
        'refused: agent_not_on_list',
      );
      expect(referrals.get(looped.referralId)?.pendingJob?.handoffNote).toBe('refused: loop');
      expect(referralsIn(unlisted.runId)).toHaveLength(1);
      expect(referralsIn(looped.runId)).toHaveLength(1);
      expect(
        service.getAuditEvents().some(
          (event) =>
            event.eventType === 'orchestration.safety_limit_breached' &&
            event.payload.reason === 'agent_not_on_list',
        ),
      ).toBe(true);
      expect(
        service.getAuditEvents().some((event) => event.payload.limitType === 'loop'),
      ).toBe(true);
    });

    it('skips inactive runs and referrals that are not completed', async () => {
      const now = new Date();
      const completedAt = new Date();
      const service = app.get(OrchestrationService);

      for (const runStatus of ['completed', 'failed', 'cancelled', 'timed_out'] as const) {
        const staged = await stageAnswer({
          summary: requestedAnswer,
          completedAt,
          runStatus,
        });
        await service.sweepCollaborations(now);
        expect(referralsIn(staged.runId)).toHaveLength(1);
        expect(referrals.get(staged.referralId)?.pendingJob?.handoffNote ?? null).toBeNull();
        expect(runs.get(staged.runId)?.status).toBe(runStatus);
      }

      for (const referralStatus of ['failed', 'rejected', 'timed_out'] as const) {
        const staged = await stageAnswer({
          summary: requestedAnswer,
          completedAt,
          referralStatus,
        });
        await service.sweepCollaborations(now);
        expect(referralsIn(staged.runId)).toHaveLength(1);
        expect(referrals.get(staged.referralId)?.status).toBe(referralStatus);
        expect(referrals.get(staged.referralId)?.pendingJob?.handoffNote ?? null).toBeNull();
      }

      const undated = await stageAnswer({ summary: requestedAnswer, completedAt });
      const undatedRow = referrals.get(undated.referralId);
      if (!undatedRow) {
        throw new Error('undated referral missing');
      }
      undatedRow.completedAt = null;
      await service.sweepCollaborations(now);
      expect(referralsIn(undated.runId)).toHaveLength(2);
      expect(runs.get(undated.runId)?.status).toBe('active');
      expect(undatedRow.pendingJob?.handoffNote ?? null).toBeNull();

      const blank = await stageAnswer({ summary: '', completedAt });
      await service.sweepCollaborations(now);
      expect(referralsIn(blank.runId)).toHaveLength(1);
      expect(referrals.get(blank.referralId)?.pendingJob?.handoffNote ?? null).toBeNull();
      expect(referrals.get(blank.referralId)?.pendingJob?.handoffChecked).toBe(true);
      expect(runs.get(blank.runId)?.status).toBe('completed');
    });

    it('treats an idempotency unique violation as already done', async () => {
      const now = new Date();
      const staged = await stageAnswer({
        summary: requestedAnswer,
        completedAt: new Date(),
      });
      type ReferralSave = (
        entity: CollaborationReferralEntity,
      ) => Promise<CollaborationReferralEntity>;
      const repo = app.get(getRepositoryToken(CollaborationReferralEntity)) as {
        save: ReferralSave;
      };
      const originalSave: ReferralSave = repo.save.bind(repo);
      repo.save = async (entity) => {
        const saved = await originalSave(entity);
        if (entity.idempotencyKey.startsWith('answer-handoff:')) {
          const error = new Error(
            'duplicate key value violates unique constraint "uq_collaboration_referrals_idempotency_active"',
          ) as Error & { code: string; driverError: { code: string; constraint: string } };
          error.code = '23505';
          error.driverError = {
            code: '23505',
            constraint: 'uq_collaboration_referrals_idempotency_active',
          };
          throw error;
        }
        return saved;
      };
      const service = app.get(OrchestrationService);
      try {
        await service.sweepCollaborations(now);
      } finally {
        repo.save = originalSave;
      }

      const followUps = referralsIn(staged.runId).filter(
        (row) => row.idempotencyKey === answerHandoffIdempotencyKey(staged.referralId),
      );
      expect(followUps).toHaveLength(1);
      expect(followUps[0].status).toBe('pending_approval');
      expect(referrals.get(staged.referralId)?.pendingJob?.handoffNote ?? null).toBeNull();
      expect(referrals.get(staged.referralId)?.pendingJob?.handoffChecked).toBe(true);
      expect(runs.get(staged.runId)?.status).toBe('active');

      await service.sweepCollaborations(now);

      expect(
        referralsIn(staged.runId).filter(
          (row) => row.idempotencyKey === answerHandoffIdempotencyKey(staged.referralId),
        ),
      ).toHaveLength(1);
      expect(referrals.get(staged.referralId)?.pendingJob?.handoffNote ?? null).toBeNull();
    });

    it('marks a lost step with an empty summary and settles the run', async () => {
      for (const summary of ['', null]) {
        const staged = await stageAnswer({
          summary: summary ?? '',
          completedAt: new Date(),
        });
        if (summary === null) {
          const row = referrals.get(staged.referralId);
          if (!row) {
            throw new Error('staged referral missing');
          }
          row.resultSummary = null;
        }

        const detail = await http().get(`/api/internal/collaboration/runs/${staged.runId}`).expect(200);

        expect(detail.body.run.status).toBe('completed');
        expect(detail.body.referrals).toHaveLength(1);
        expect(detail.body.referrals[0].handoffNote).toBeNull();
        expect(referrals.get(staged.referralId)?.pendingJob?.handoffChecked).toBe(true);
      }
    });

    it('marks a final step with no request and settles it in the same read', async () => {
      const staged = await stageAnswer({
        summary: 'All done.',
        completedAt: new Date(),
      });

      const detail = await http().get(`/api/internal/collaboration/runs/${staged.runId}`).expect(200);

      expect(detail.body.run.status).toBe('completed');
      expect(detail.body.referrals).toHaveLength(1);
      expect(detail.body.referrals[0].status).toBe('completed');
      expect(detail.body.referrals[0].handoffNote).toBeNull();
      expect(detail.body.referrals[0]).not.toHaveProperty('handoffChecked');
      expect(referrals.get(staged.referralId)?.pendingJob?.handoffChecked).toBe(true);
    });

    it('shows no note for an ordinary final step', async () => {
      const runId = await createRun();
      const waiting = await postReferral(runId, {
        idempotencyKey: 'ordinary-final',
        targetBuilder: { agentRole: 'builder', builderProfileId: 'lead' },
        projectInstructions: 'Be concise.',
        agents: listedAgents,
      }).expect(201);
      const referralId = waiting.body.referral.referralId as string;
      await approve(runId, referralId).expect(200);
      executionResults.getExecution.mockResolvedValue(completedExecution('All done.'));

      const detail = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);

      expect(detail.body.run.status).toBe('completed');
      expect(detail.body.referrals).toHaveLength(1);
      expect(detail.body.referrals[0].handoffNote).toBeNull();
      expect(detail.body.referrals[0].result.summary).toBe('All done.');
      expect(detail.body.referrals[0]).not.toHaveProperty('handoffChecked');
      expect(referrals.get(referralId)?.pendingJob?.handoffChecked).toBe(true);
      expect(referrals.get(referralId)?.pendingJob?.handoffNote ?? null).toBeNull();
    });

    it('records a different unique violation as a refusal', async () => {
      const staged = await stageAnswer({
        summary: requestedAnswer,
        completedAt: new Date(),
      });
      type ReferralSave = (
        entity: CollaborationReferralEntity,
      ) => Promise<CollaborationReferralEntity>;
      const repo = app.get(getRepositoryToken(CollaborationReferralEntity)) as {
        save: ReferralSave;
      };
      const originalSave: ReferralSave = repo.save.bind(repo);
      repo.save = async (entity) => {
        if (entity.idempotencyKey.startsWith('answer-handoff:')) {
          const error = new Error(
            'duplicate key value violates unique constraint "uq_collaboration_referrals_trace_id"',
          ) as Error & { code: string; driverError: { code: string; constraint: string } };
          error.code = '23505';
          error.driverError = {
            code: '23505',
            constraint: 'uq_collaboration_referrals_trace_id',
          };
          throw error;
        }
        return originalSave(entity);
      };
      try {
        await app.get(OrchestrationService).sweepCollaborations(new Date());
      } finally {
        repo.save = originalSave;
      }

      expect(referrals.get(staged.referralId)?.pendingJob?.handoffNote).toBe('refused: refused');
      expect(referrals.get(staged.referralId)?.pendingJob?.handoffChecked).toBe(true);
      expect(
        referralsIn(staged.runId).some((row) => row.idempotencyKey.startsWith('answer-handoff:')),
      ).toBe(false);
    });
  });

  describe('COLLAB-FILES-01 file access', () => {
    const HARNESS_SECRET = 'test-hmac-secret-collab-files-01';
    const originalSecret = process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;

    afterEach(() => {
      if (originalSecret === undefined) {
        delete process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
      } else {
        process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = originalSecret;
      }
    });

    function expectSignedToolProfile(
      payload: Record<string, unknown>,
      profile: 'read' | 'review' | 'write',
    ): void {
      expect(payload.harnessVersion).toBe('v1');
      expect(payload.harnessToolProfile).toBe(profile);
      if (profile === 'read') {
        expect(payload.harnessReadOnly).toBe(true);
      } else {
        expect(payload).not.toHaveProperty('harnessReadOnly');
      }
      expect(payload.executionIntent).toBe('conversation');
      expect(payload).not.toHaveProperty('fileAccess');
      const { harnessEntitlementProof, ...signed } = payload;
      const expected = createHarnessEntitlementProof({
        executionId: String(signed.executionId),
        userId: String(signed.userId),
        apiKeyId: String(signed.apiKeyId),
        issuedAt: String(signed.submittedAt),
        payloadWithoutProof: signed,
        secret: HARNESS_SECRET,
      });
      expect(harnessEntitlementProof).toEqual(expected);
      const tampered = createHarnessEntitlementProof({
        executionId: String(signed.executionId),
        userId: String(signed.userId),
        apiKeyId: String(signed.apiKeyId),
        issuedAt: String(signed.submittedAt),
        payloadWithoutProof: {
          ...signed,
          harnessToolProfile: profile === 'write' ? 'read' : 'write',
        },
        secret: HARNESS_SECRET,
      });
      expect(tampered.payloadDigest).not.toBe(expected.payloadDigest);
      expect(tampered.signature).not.toBe(expected.signature);
    }

    function expectSignedReadOnlyJob(payload: Record<string, unknown>): void {
      expectSignedToolProfile(payload, 'read');
    }

    it('enqueues a signed read-only harness job and ignores caller harness fields', async () => {
      process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = HARNESS_SECRET;
      const runId = await createRun();
      const waiting = await postReferral(runId, {
        idempotencyKey: 'file-access-root',
        fileAccess: true,
        harnessVersion: 'v2',
        harnessReadOnly: false,
        harnessEntitlementProof: { token: 'caller' },
      }).expect(201);

      expect(waiting.body.referral.status).toBe('pending_approval');
      expect(queue.enqueueExecution).not.toHaveBeenCalled();
      const stored = referrals.get(waiting.body.referral.referralId as string);
      expect(stored?.pendingJob?.fileAccess).toBe(true);
      expect(stored?.pendingJob).not.toHaveProperty('harnessVersion');
      expect(stored?.pendingJob).not.toHaveProperty('harnessReadOnly');

      const response = await approve(runId, waiting.body.referral.referralId).expect(200);
      expect(response.body.referral.status).toBe('in_progress');
      expect(queue.enqueueExecution).toHaveBeenCalledTimes(1);
      const payload = queue.enqueueExecution.mock.calls[0][0] as Record<string, unknown>;
      expectSignedReadOnlyJob(payload);
      expect(payload.harnessVersion).not.toBe('v2');
      expect(payload.harnessReadOnly).not.toBe(false);

      const intent = ledger.writeExecutionIntent.mock.calls[0][0];
      expect(intent.metadata).toEqual({
        runMode: 'ask',
        apiKeyId: 'apikey-01',
        requestedProvider: 'stub',
        requestedModel: 'test-model',
      });
      expect(intent.metadata).not.toHaveProperty('harnessVersion');
    });

    it('keeps a hand-off plain when file access is omitted or false, even if the caller sends harness fields', async () => {
      process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = HARNESS_SECRET;
      const runId = await createRun();
      const omitted = await postReferral(runId, {
        idempotencyKey: 'plain-omitted',
        harnessVersion: 'v1',
        harnessReadOnly: true,
      }).expect(201);
      await approve(runId, omitted.body.referral.referralId).expect(200);

      const falsyRun = await createRun();
      const falsy = await postReferral(falsyRun, {
        idempotencyKey: 'plain-false',
        fileAccess: false,
        harnessVersion: 'v1',
        harnessReadOnly: true,
      }).expect(201);
      expect(
        referrals.get(falsy.body.referral.referralId as string)?.pendingJob?.fileAccess,
      ).not.toBe(true);
      await approve(falsyRun, falsy.body.referral.referralId).expect(200);

      expect(queue.enqueueExecution).toHaveBeenCalledTimes(2);
      for (const call of queue.enqueueExecution.mock.calls) {
        const payload = call[0] as Record<string, unknown>;
        expect(payload).not.toHaveProperty('harnessVersion');
        expect(payload).not.toHaveProperty('harnessReadOnly');
        expect(payload).not.toHaveProperty('harnessToolProfile');
        expect(payload).not.toHaveProperty('harnessEntitlementProof');
        expect(payload.executionIntent).toBe('conversation');
        expect(JSON.stringify(payload)).not.toContain('harnessVersion');
        expect(JSON.stringify(payload)).not.toContain('harnessReadOnly');
        expect(JSON.stringify(payload)).not.toContain('harnessToolProfile');
      }
      for (const call of ledger.writeExecutionIntent.mock.calls) {
        expect(call[0].metadata.runMode).toBe('ask');
      }
    });

    it('carries file access to a direct child and to a child created from the answer', async () => {
      process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = HARNESS_SECRET;
      const runId = await createRun();
      const root = await postReferral(runId, {
        idempotencyKey: 'file-root',
        targetBuilder: { agentRole: 'builder', builderProfileId: 'lead' },
        agents: listedAgents,
        projectInstructions: 'Be concise.',
        fileAccess: true,
      }).expect(201);

      const direct = await postReferral(runId, {
        idempotencyKey: 'file-direct-child',
        sourceBuilder: { agentRole: 'builder', builderProfileId: 'lead' },
        targetBuilder: { agentRole: 'builder', builderProfileId: 'writer' },
        parentReferralTraceId: root.body.referral.referralTraceId,
      }).expect(201);
      expect(
        referrals.get(direct.body.referral.referralId as string)?.pendingJob?.fileAccess,
      ).toBe(true);
      expect(
        referrals.get(direct.body.referral.referralId as string)?.pendingJob?.agents,
      ).toEqual(listedAgents);

      const rejected = await postReferral(runId, {
        idempotencyKey: 'file-child-override',
        sourceBuilder: { agentRole: 'builder', builderProfileId: 'lead' },
        targetBuilder: { agentRole: 'builder', builderProfileId: 'writer' },
        parentReferralTraceId: root.body.referral.referralTraceId,
        fileAccess: true,
      }).expect(400);
      expect(rejected.body.message).toContain('only accepted on the first hand-off');

      await approve(runId, root.body.referral.referralId).expect(200);
      const answer =
        'The draft is ready.\n\n<handoff to="writer">Tighten the opening.</handoff>';
      executionResults.getExecution.mockResolvedValue(completedExecution(answer));
      const detail = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);
      const answerChild = detail.body.referrals.find(
        (referral: { referralId: string }) =>
          referral.referralId !== root.body.referral.referralId &&
          referral.referralId !== direct.body.referral.referralId,
      );
      expect(answerChild.status).toBe('pending_approval');
      expect(
        referrals.get(answerChild.referralId as string)?.pendingJob?.fileAccess,
      ).toBe(true);

      await approve(runId, direct.body.referral.referralId).expect(200);
      await approve(runId, answerChild.referralId).expect(200);

      expect(queue.enqueueExecution).toHaveBeenCalledTimes(3);
      for (const call of queue.enqueueExecution.mock.calls) {
        const payload = call[0] as Record<string, unknown>;
        if (payload.builderProfileId === 'writer') {
          expectSignedToolProfile(payload, 'write');
        } else {
          expectSignedReadOnlyJob(payload);
        }
      }
    });

    it('sets the tool profile from the target role and ignores a caller profile', async () => {
      process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = HARNESS_SECRET;
      const writerRun = await createRun();
      const writer = await postReferral(writerRun, {
        idempotencyKey: 'profile-writer',
        targetBuilder: { agentRole: 'builder', builderProfileId: 'writer' },
        fileAccess: true,
        harnessToolProfile: 'read',
        harnessReadOnly: true,
      }).expect(201);
      expect(
        referrals.get(writer.body.referral.referralId as string)?.pendingJob,
      ).not.toHaveProperty('harnessToolProfile');
      await approve(writerRun, writer.body.referral.referralId).expect(200);
      expectSignedToolProfile(
        queue.enqueueExecution.mock.calls[0][0] as Record<string, unknown>,
        'write',
      );

      const reviewRun = await createRun();
      const reviewer = await postReferral(reviewRun, {
        idempotencyKey: 'profile-reviewer',
        targetBuilder: { agentRole: 'builder', builderProfileId: 'reviewer' },
        fileAccess: true,
        harnessToolProfile: 'write',
      }).expect(201);
      await approve(reviewRun, reviewer.body.referral.referralId).expect(200);
      expectSignedToolProfile(
        queue.enqueueExecution.mock.calls[1][0] as Record<string, unknown>,
        'review',
      );
    });

    it('refuses approval and leaves the hand-off waiting when the signing secret is missing', async () => {
      const runId = await createRun();
      const waiting = await postReferral(runId, {
        idempotencyKey: 'file-no-secret',
        fileAccess: true,
      }).expect(201);

      process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = '   ';
      const blank = await approve(runId, waiting.body.referral.referralId).expect(500);
      expect(blank.body.message).toBe('Harness entitlement proof could not be produced');
      await expectStillWaiting(runId);

      delete process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
      const missing = await approve(runId, waiting.body.referral.referralId).expect(500);
      expect(missing.body.message).toBe('Harness entitlement proof could not be produced');
      await expectStillWaiting(runId);

      process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = HARNESS_SECRET;
      const started = await approve(runId, waiting.body.referral.referralId).expect(200);
      expect(started.body.referral.status).toBe('in_progress');
      expectSignedReadOnlyJob(queue.enqueueExecution.mock.calls[0][0]);
    });

    it('rejects a non-boolean fileAccess before creating a referral', async () => {
      const runId = await createRun();
      const response = await postReferral(runId, {
        idempotencyKey: 'file-bad-type',
        fileAccess: 'true',
      }).expect(400);
      expect(response.body.message).toContain('fileAccess must be a boolean');
      await expectNoJob(runId);
    });
  });

  it('allows two send-back rounds past max depth and refuses the third as a loop', async () => {
    const service = app.get(OrchestrationService);
    const runId = await createRun();
    const root = await postReferral(runId, {
      idempotencyKey: 'rounds-root',
      targetBuilder: { agentRole: 'builder', builderProfileId: 'lead' },
      agents: COLLABORATION_TEAM.map((agent) => ({
        name: agent.name,
        instructions: agent.instructions,
      })),
      projectInstructions: 'Be concise.',
    }).expect(201);

    const steps = ['writer', 'reviewer', 'writer', 'reviewer', 'writer', 'reviewer'];
    let currentId = root.body.referral.referralId as string;
    const seen = new Set<string>([currentId]);
    for (const target of steps) {
      await approve(runId, currentId).expect(200);
      executionResults.getExecution.mockResolvedValue(
        completedExecution(`Done.\n<handoff to="${target}">Next.</handoff>`),
      );
      const detail = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);
      const created = detail.body.referrals.find(
        (referral: { referralId: string }) => !seen.has(referral.referralId),
      );
      const parent = detail.body.referrals.find(
        (referral: { referralId: string }) => referral.referralId === currentId,
      );
      expect(parent.status).toBe('completed');
      expect(parent.handoffNote).toBeNull();
      expect(created.status).toBe('pending_approval');
      expect(created.targetBuilder.builderProfileId).toBe(target);
      seen.add(created.referralId);
      currentId = created.referralId;
    }

    const rows = [...referrals.values()].filter((row) => row.collaborationRunId === runId);
    const sendBacks = rows.filter(
      (row) =>
        row.sourceBuilderProfileId === 'reviewer' && row.targetBuilderProfileId === 'writer',
    );
    expect(sendBacks).toHaveLength(2);
    expect(sendBacks.map((row) => row.depth).sort()).toEqual([
      DEFAULT_MAX_REFERRAL_DEPTH,
      DEFAULT_MAX_REFERRAL_DEPTH + 2,
    ]);
    expect(sendBacks.every((row) => row.status === 'pending_approval' || row.status === 'completed')).toBe(
      true,
    );
    const firstWriter = rows.find(
      (row) => row.sourceBuilderProfileId === 'lead' && row.targetBuilderProfileId === 'writer',
    );
    expect(firstWriter?.pendingJob?.projectInstructions ?? '').not.toContain(
      'Fix only the listed items',
    );
    expect(sendBacks[0].pendingJob?.projectInstructions).toContain(
      COLLABORATION_SEND_BACK_WRITER_INSTRUCTION,
    );
    const reviewerJob = rows.find((row) => row.targetBuilderProfileId === 'reviewer');
    expect(reviewerJob?.pendingJob?.projectInstructions).toContain(
      'send the work back to writer with a specific list of what to fix',
    );
    expect(reviewerJob?.pendingJob?.projectInstructions).toContain(
      'Otherwise give the verdict and finish.',
    );

    service.clearAuditEvents();
    const queued = queue.enqueueExecution.mock.calls.length;
    await approve(runId, currentId).expect(200);
    executionResults.getExecution.mockResolvedValue(
      completedExecution('Done.\n<handoff to="writer">A third time.</handoff>'),
    );
    const refused = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);
    expect(refused.body.referrals).toHaveLength(steps.length + 1);
    const parent = refused.body.referrals.find(
      (referral: { referralId: string }) => referral.referralId === currentId,
    );
    expect(parent.status).toBe('completed');
    expect(parent.handoffNote).toBe('refused: loop');
    expect(service.getAuditEvents().some((event) => event.payload.limitType === 'loop')).toBe(true);
    expect(service.getAuditEvents().some((event) => event.payload.limitType === 'depth')).toBe(false);
    expect(queue.enqueueExecution).toHaveBeenCalledTimes(queued + 1);
    expect(refused.body.run.status).toBe('completed');
    expect(refused.body.run.failedAt).toBeNull();
  });

  it('refuses reviewer-to-lead and writer-to-lead loops', async () => {
    const service = app.get(OrchestrationService);
    const runId = await createRun();
    const root = await postReferral(runId, {
      idempotencyKey: 'loop-root',
      targetBuilder: { agentRole: 'builder', builderProfileId: 'lead' },
      agents: COLLABORATION_TEAM.map((agent) => ({
        name: agent.name,
        instructions: agent.instructions,
      })),
    }).expect(201);

    await approve(runId, root.body.referral.referralId).expect(200);
    executionResults.getExecution.mockResolvedValue(
      completedExecution('Done.\n<handoff to="writer">Fix it.</handoff>'),
    );
    const afterLead = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);
    const writer = afterLead.body.referrals.find(
      (referral: { targetBuilder: { builderProfileId: string } }) =>
        referral.targetBuilder.builderProfileId === 'writer',
    );
    service.clearAuditEvents();
    await approve(runId, writer.referralId).expect(200);
    executionResults.getExecution.mockResolvedValue(
      completedExecution('Done.\n<handoff to="lead">Back to you.</handoff>'),
    );
    const writerLoop = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);
    expect(writerLoop.body.referrals).toHaveLength(2);
    expect(
      writerLoop.body.referrals.find(
        (referral: { referralId: string }) => referral.referralId === writer.referralId,
      ).handoffNote,
    ).toBe('refused: loop');
    expect(service.getAuditEvents().some((event) => event.payload.limitType === 'loop')).toBe(true);

    const reviewRun = await createRun();
    const reviewRoot = await postReferral(reviewRun, {
      idempotencyKey: 'review-loop-root',
      targetBuilder: { agentRole: 'builder', builderProfileId: 'lead' },
      agents: COLLABORATION_TEAM.map((agent) => ({
        name: agent.name,
        instructions: agent.instructions,
      })),
    }).expect(201);
    await approve(reviewRun, reviewRoot.body.referral.referralId).expect(200);
    executionResults.getExecution.mockResolvedValue(
      completedExecution('Done.\n<handoff to="reviewer">Look.</handoff>'),
    );
    const afterReviewLead = await http().get(`/api/internal/collaboration/runs/${reviewRun}`).expect(200);
    const reviewer = afterReviewLead.body.referrals.find(
      (referral: { targetBuilder: { builderProfileId: string } }) =>
        referral.targetBuilder.builderProfileId === 'reviewer',
    );
    service.clearAuditEvents();
    await approve(reviewRun, reviewer.referralId).expect(200);
    executionResults.getExecution.mockResolvedValue(
      completedExecution('Done.\n<handoff to="lead">Back to lead.</handoff>'),
    );
    const leadLoop = await http().get(`/api/internal/collaboration/runs/${reviewRun}`).expect(200);
    expect(leadLoop.body.referrals).toHaveLength(2);
    expect(
      leadLoop.body.referrals.find(
        (referral: { referralId: string }) => referral.referralId === reviewer.referralId,
      ).handoffNote,
    ).toBe('refused: loop');
    expect(service.getAuditEvents().some((event) => event.payload.limitType === 'loop')).toBe(true);
    expect(service.getAuditEvents().some((event) => event.payload.limitType === 'depth')).toBe(false);
  });

  it('still refuses the ninth hand-off when the next edge is a send-back', async () => {
    const runId = await createRun();
    for (let index = 0; index < MAX_HANDOFFS_PER_RUN; index += 1) {
      await postReferral(runId, { idempotencyKey: `cap-send-${index}` }).expect(201);
    }
    const service = app.get(OrchestrationService);
    service.clearAuditEvents();
    const blocked = await postReferral(runId, {
      idempotencyKey: 'cap-send-ninth',
      sourceBuilder: { agentRole: 'builder', builderProfileId: 'reviewer' },
      targetBuilder: { agentRole: 'builder', builderProfileId: 'writer' },
    }).expect(400);
    expect(blocked.body.message).toContain('Handoff limit');
    expect(service.getAuditEvents()[0]?.payload.limitType).toBe('handoff');
    const detail = await http().get(`/api/internal/collaboration/runs/${runId}`).expect(200);
    expect(detail.body.referrals).toHaveLength(MAX_HANDOFFS_PER_RUN);
  });
});
