import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { ExecutionResultService } from '../ai/execution-result.service';
import { QueueService } from '../queue/queue.service';
import { UsageLedgerService } from '../usage-ledger/usage-ledger.service';
import { CollaborationReferralEntity } from './collaboration-referral.entity';
import { CollaborationRunEntity } from './collaboration-run.entity';
import { InternalCollaborationController } from './internal-collaboration.controller';
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
  return { runRepo, referralRepo };
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
  let app: INestApplication;
  let queue: { enqueueExecution: jest.Mock };
  let ledger: { writeExecutionIntent: jest.Mock };
  let executionResults: { requestCancel: jest.Mock; getExecution: jest.Mock };

  beforeEach(async () => {
    const fakes = createOrchestrationRepoFakes();
    queue = { enqueueExecution: jest.fn().mockResolvedValue(undefined) };
    ledger = { writeExecutionIntent: jest.fn().mockResolvedValue(undefined) };
    executionResults = {
      requestCancel: jest.fn().mockResolvedValue(true),
      getExecution: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalCollaborationController],
      providers: [
        OrchestrationService,
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

  async function expectNoJob(runId: string) {
    expect(queue.enqueueExecution).not.toHaveBeenCalled();
    expect(ledger.writeExecutionIntent).not.toHaveBeenCalled();
    const detail = await request(app.getHttpServer())
      .get(`/api/internal/collaboration/runs/${runId}`)
      .expect(200);
    expect(detail.body.referrals).toEqual([]);
  }

  it('creates a run and starts a referral with the ledger row before the job', async () => {
    const order: string[] = [];
    ledger.writeExecutionIntent.mockImplementation(async () => {
      order.push('ledger');
    });
    queue.enqueueExecution.mockImplementation(async () => {
      order.push('enqueue');
    });

    const runId = await createRun();
    const response = await request(app.getHttpServer())
      .post(`/api/internal/collaboration/runs/${runId}/referrals`)
      .send(referralBody({ harnessVersion: 'v1', harnessEntitlementProof: { token: 'no' } }))
      .expect(201);

    expect(order).toEqual(['ledger', 'enqueue']);
    expect(response.body.referral.status).toBe('in_progress');
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
    expect(intent.metadata).not.toHaveProperty('harnessVersion');
    expect(intent.metadata.runMode).toBe('ask');
  });

  it('returns 500 and creates no job when the ledger write fails', async () => {
    ledger.writeExecutionIntent.mockRejectedValue(new Error('connection refused'));
    const runId = await createRun();

    const response = await request(app.getHttpServer())
      .post(`/api/internal/collaboration/runs/${runId}/referrals`)
      .send(referralBody())
      .expect(500);

    expect(response.body.message).toBe('Failed to write execution intent');
    expect(queue.enqueueExecution).not.toHaveBeenCalled();

    const detail = await request(app.getHttpServer())
      .get(`/api/internal/collaboration/runs/${runId}`)
      .expect(200);
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

  it('refuses a referral loop and creates no job', async () => {
    const runId = await createRun();
    const response = await request(app.getHttpServer())
      .post(`/api/internal/collaboration/runs/${runId}/referrals`)
      .send(referralBody({ visitedBuilderProfileIds: ['builder-b'] }))
      .expect(400);

    expect(response.body.message).toContain('loop detected');
    await expectNoJob(runId);
  });

  it('refuses a referral past max depth and creates no job', async () => {
    const runId = await createRun();
    const response = await request(app.getHttpServer())
      .post(`/api/internal/collaboration/runs/${runId}/referrals`)
      .send(referralBody({ depth: 3 }))
      .expect(400);

    expect(response.body.message).toContain('exceeds max depth');
    await expectNoJob(runId);
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
    const started = await request(app.getHttpServer())
      .post(`/api/internal/collaboration/runs/${runId}/referrals`)
      .send(referralBody())
      .expect(201);

    executionResults.getExecution
      .mockResolvedValueOnce({
        execution_status: 'completed',
        metadata: { aiExecutionResult: { output: 'the answer' } },
      })
      .mockResolvedValueOnce({
        execution_status: 'failed',
        metadata: { aiExecutionResult: { output: 'changed' } },
      });

    const first = await request(app.getHttpServer())
      .get(`/api/internal/collaboration/runs/${runId}`)
      .expect(200);
    const second = await request(app.getHttpServer())
      .get(`/api/internal/collaboration/runs/${runId}`)
      .expect(200);

    expect(first.body.run.collaborationRunId).toBe(runId);
    expect(first.body.referrals[0].referralId).toBe(started.body.referral.referralId);
    expect(first.body.referrals[0].status).toBe('completed');
    expect(first.body.referrals[0].result.summary).toBe('the answer');
    expect(second.body.referrals[0].status).toBe('completed');
    expect(second.body.referrals[0].result.summary).toBe('the answer');
    expect(executionResults.getExecution).toHaveBeenCalledTimes(1);
    expect(executionResults.getExecution).toHaveBeenCalledWith(started.body.executionId);
  });

  it('leaves a still-running referral in progress', async () => {
    const runId = await createRun();
    await request(app.getHttpServer())
      .post(`/api/internal/collaboration/runs/${runId}/referrals`)
      .send(referralBody({ idempotencyKey: 'key-running' }))
      .expect(201);

    executionResults.getExecution.mockResolvedValue({
      execution_status: 'running',
      metadata: {},
    });

    const detail = await request(app.getHttpServer())
      .get(`/api/internal/collaboration/runs/${runId}`)
      .expect(200);

    expect(detail.body.referrals[0].status).toBe('in_progress');
    expect(detail.body.referrals[0].result).toBeNull();
  });

  it('marks a failed execution as a failed referral', async () => {
    const runId = await createRun();
    await request(app.getHttpServer())
      .post(`/api/internal/collaboration/runs/${runId}/referrals`)
      .send(referralBody({ idempotencyKey: 'key-failed' }))
      .expect(201);

    executionResults.getExecution.mockResolvedValue({
      execution_status: 'failed',
      metadata: { aiExecutionResult: { output: 'could not finish' } },
    });

    const detail = await request(app.getHttpServer())
      .get(`/api/internal/collaboration/runs/${runId}`)
      .expect(200);

    expect(detail.body.referrals[0].status).toBe('failed');
    expect(detail.body.referrals[0].result.summary).toBe('could not finish');
  });
});
