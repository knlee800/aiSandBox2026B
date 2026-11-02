import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { ExecutionResultService } from '../ai/execution-result.service';
import { AbortConfig } from '../abort/abort.config';
import { AbortGuard } from '../abort/abort.guard';
import { CreditBalanceGuard } from '../billing/credit-balance.guard';
import { UserRole } from '../entities/user-role.enum';
import { QueueService } from '../queue/queue.service';
import { QuotaConfig } from '../quota/quota.config';
import { TokenQuotaGuard } from '../quota/token-quota.guard';
import { ExecutionSafetyGuard } from '../safety/execution-safety.guard';
import { GlobalSafetyLimitService } from '../safety/global-safety-limit.service';
import { GlobalSafetyLimits } from '../safety/global-safety-limits.config';
import { UsageLedgerService } from '../usage-ledger/usage-ledger.service';
import { CollaborationReferralEntity } from './collaboration-referral.entity';
import { CollaborationRunEntity } from './collaboration-run.entity';
import { InternalCollaborationController } from './internal-collaboration.controller';
import {
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

  beforeEach(async () => {
    process.env.GLOBAL_EXECUTION_ENABLED = 'true';
    process.env.AI_PROVIDER = 'stub';
    process.env.ABORT_MODE = 'NONE';
    AbortConfig.initialize();
    tokenUsage = 0;
    creditBalance = { balance: 25 };

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

  it('leaves the hand-off waiting when daily spend is over the hard cap', async () => {
    const runId = await createRun();
    const waiting = await postReferral(runId).expect(201);
    app
      .get(GlobalSafetyLimitService)
      .recordExecutionCost(GlobalSafetyLimits.MAX_DAILY_SPEND_HARD_USD);

    const response = await approve(runId, waiting.body.referral.referralId).expect(503);
    expect(response.body.message).toContain('daily spend');
    await expectStillWaiting(runId);
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
});
