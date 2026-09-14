import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrchestrationService } from '../orchestration.service';
import { OrchestrationModule } from '../orchestration.module';
import { CollaborationRunEntity } from '../collaboration-run.entity';
import { CollaborationReferralEntity } from '../collaboration-referral.entity';
import {
  DEFAULT_MAX_AGENTS_PER_COLLABORATION,
  DEFAULT_MAX_REFERRAL_DEPTH,
} from '../orchestration.contracts';
import { QueueService } from '../../queue/queue.service';
import { ExecutionResultService } from '../../ai/execution-result.service';

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

describe('AGENT-PLATFORM-ORCH-PERSIST-01: durable orchestration persistence', () => {
  let mockQueueService: { enqueueExecution: jest.Mock };
  let mockExecutionResultService: { requestCancel: jest.Mock };

  beforeEach(() => {
    mockQueueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };
    mockExecutionResultService = {
      requestCancel: jest.fn().mockResolvedValue(true),
    };
  });

  function createService(fakes = createOrchestrationRepoFakes()) {
    return {
      fakes,
      service: new OrchestrationService(
        fakes.runRepo as never,
        fakes.referralRepo as never,
        mockQueueService as unknown as QueueService,
        mockExecutionResultService as unknown as ExecutionResultService,
      ),
    };
  }

  async function seedRunAndReferral(
    service: OrchestrationService,
    options?: {
      collaborationRunId?: string;
      referralId?: string;
      referralTraceId?: string;
      idempotencyKey?: string;
      targetBuilderProfileId?: string;
    },
  ) {
    const collaborationRunId = options?.collaborationRunId ?? 'collab-persist-01';
    await service.createCollaborationRun({
      collaborationRunId,
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });
    return service.createReferral({
      referralId: options?.referralId ?? 'ref-persist-01',
      referralTraceId: options?.referralTraceId ?? 'trace-persist-01',
      collaborationRunId,
      sourceBuilder: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
      targetBuilder: {
        agentRole: 'chief-of-staff',
        builderProfileId: options?.targetBuilderProfileId ?? 'builder-b',
      },
      idempotencyKey: options?.idempotencyKey ?? 'key-persist-01',
    });
  }

  it('reads previously saved runs and referrals from a second service instance', async () => {
    const fakes = createOrchestrationRepoFakes();
    const first = createService(fakes).service;
    await seedRunAndReferral(first);

    const restarted = createService(fakes).service;
    const run = await restarted.getCollaborationRun('collab-persist-01');
    const referral = await restarted.getReferral('ref-persist-01');

    expect(run).not.toBeNull();
    expect(run?.collaborationRunId).toBe('collab-persist-01');
    expect(run?.referralIds).toEqual(['ref-persist-01']);
    expect(referral).not.toBeNull();
    expect(referral?.referralId).toBe('ref-persist-01');
    expect(referral?.idempotencyKey).toBe('key-persist-01');
    expect(referral?.status).toBe('pending_approval');
  });

  it('does not keep the former in-memory Map fields', () => {
    const { service } = createService();
    const instance = service as unknown as Record<string, unknown>;

    expect(instance.collaborationRunStore).toBeUndefined();
    expect(instance.referralStore).toBeUndefined();
    expect(instance.idempotencyStore).toBeUndefined();
    expect(instance.referralExecutionMap).toBeUndefined();
    expect('collaborationRunStore' in service).toBe(false);
    expect('referralStore' in service).toBe(false);
    expect('idempotencyStore' in service).toBe(false);
    expect('referralExecutionMap' in service).toBe(false);
  });

  it('returns the existing referral for a duplicate active idempotency key', async () => {
    const { service } = createService();
    const first = await seedRunAndReferral(service, {
      collaborationRunId: 'collab-idem-01',
      referralId: 'ref-idem-01',
      referralTraceId: 'trace-idem-01',
      idempotencyKey: 'idem-shared',
    });

    const duplicate = await service.createReferral({
      referralId: 'ref-idem-02',
      referralTraceId: 'trace-idem-02',
      collaborationRunId: 'collab-idem-01',
      sourceBuilder: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
      targetBuilder: {
        agentRole: 'chief-of-staff',
        builderProfileId: 'builder-b',
      },
      idempotencyKey: 'idem-shared',
    });

    expect(duplicate.referralId).toBe(first.referralId);
    expect(duplicate.referralTraceId).toBe(first.referralTraceId);
  });

  it('allows retry after failed, cancelled, and timed_out but not after completed', async () => {
    const { service, fakes } = createService();

    await seedRunAndReferral(service, {
      collaborationRunId: 'collab-retry-fail',
      referralId: 'ref-retry-fail',
      referralTraceId: 'trace-retry-fail',
      idempotencyKey: 'idem-retry-fail',
    });
    await service.failReferral({
      referralId: 'ref-retry-fail',
      summary: 'failed',
    });
    const afterFail = await service.createReferral({
      referralId: 'ref-retry-fail-2',
      referralTraceId: 'trace-retry-fail-2',
      collaborationRunId: 'collab-retry-fail',
      sourceBuilder: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
      targetBuilder: {
        agentRole: 'chief-of-staff',
        builderProfileId: 'builder-b',
      },
      idempotencyKey: 'idem-retry-fail',
    });
    expect(afterFail.referralId).toBe('ref-retry-fail-2');
    expect(afterFail.status).toBe('pending_approval');

    await seedRunAndReferral(service, {
      collaborationRunId: 'collab-retry-cancel',
      referralId: 'ref-retry-cancel',
      referralTraceId: 'trace-retry-cancel',
      idempotencyKey: 'idem-retry-cancel',
    });
    await service.cancelReferral({
      referralId: 'ref-retry-cancel',
      cancelledByUserId: 'user-01',
      cancelReason: 'stop',
    });
    const afterCancel = await service.createReferral({
      referralId: 'ref-retry-cancel-2',
      referralTraceId: 'trace-retry-cancel-2',
      collaborationRunId: 'collab-retry-cancel',
      sourceBuilder: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
      targetBuilder: {
        agentRole: 'chief-of-staff',
        builderProfileId: 'builder-b',
      },
      idempotencyKey: 'idem-retry-cancel',
    });
    expect(afterCancel.referralId).toBe('ref-retry-cancel-2');

    await seedRunAndReferral(service, {
      collaborationRunId: 'collab-retry-timeout',
      referralId: 'ref-retry-timeout',
      referralTraceId: 'trace-retry-timeout',
      idempotencyKey: 'idem-retry-timeout',
    });
    const timedOut = await fakes.referralRepo.findOne({
      where: { referralId: 'ref-retry-timeout' },
    });
    expect(timedOut).not.toBeNull();
    timedOut!.status = 'timed_out';
    await fakes.referralRepo.save(timedOut!);
    const afterTimeout = await service.createReferral({
      referralId: 'ref-retry-timeout-2',
      referralTraceId: 'trace-retry-timeout-2',
      collaborationRunId: 'collab-retry-timeout',
      sourceBuilder: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
      targetBuilder: {
        agentRole: 'chief-of-staff',
        builderProfileId: 'builder-b',
      },
      idempotencyKey: 'idem-retry-timeout',
    });
    expect(afterTimeout.referralId).toBe('ref-retry-timeout-2');

    await seedRunAndReferral(service, {
      collaborationRunId: 'collab-retry-complete',
      referralId: 'ref-retry-complete',
      referralTraceId: 'trace-retry-complete',
      idempotencyKey: 'idem-retry-complete',
    });
    await service.completeReferral({
      referralId: 'ref-retry-complete',
      summary: 'done',
    });
    const afterComplete = await service.createReferral({
      referralId: 'ref-retry-complete-2',
      referralTraceId: 'trace-retry-complete-2',
      collaborationRunId: 'collab-retry-complete',
      sourceBuilder: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
      targetBuilder: {
        agentRole: 'chief-of-staff',
        builderProfileId: 'builder-b',
      },
      idempotencyKey: 'idem-retry-complete',
    });
    expect(afterComplete.referralId).toBe('ref-retry-complete');
    expect(afterComplete.status).toBe('completed');
  });

  it('still throws and emits safety_limit_breached for depth, loop, and agent_limit', async () => {
    const { service } = createService();
    await service.createCollaborationRun({
      collaborationRunId: 'collab-limits',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });

    service.clearAuditEvents();
    await expect(
      service.validateReferral({
        collaborationRunId: 'collab-limits',
        sourceBuilderProfileId: 'builder-a',
        targetBuilderProfileId: 'builder-b',
        idempotencyKey: 'key-depth',
        depth: DEFAULT_MAX_REFERRAL_DEPTH,
      }),
    ).rejects.toThrow(/exceeds max depth/i);
    expect(service.getAuditEvents()[0]?.eventType).toBe(
      'orchestration.safety_limit_breached',
    );
    expect(service.getAuditEvents()[0]?.payload.limitType).toBe('depth');

    service.clearAuditEvents();
    await expect(
      service.validateReferral({
        collaborationRunId: 'collab-limits',
        sourceBuilderProfileId: 'builder-b',
        targetBuilderProfileId: 'builder-a',
        idempotencyKey: 'key-loop',
        visitedBuilderProfileIds: ['builder-a', 'builder-b'],
      }),
    ).rejects.toThrow(/loop detected/i);
    expect(service.getAuditEvents()[0]?.payload.limitType).toBe('loop');

    await service.createReferral({
      referralId: 'ref-limit-1',
      collaborationRunId: 'collab-limits',
      sourceBuilder: { agentRole: 'builder', builderProfileId: 'builder-a' },
      targetBuilder: {
        agentRole: 'chief-of-staff',
        builderProfileId: 'builder-b',
      },
      idempotencyKey: 'key-limit-1',
    });
    await service.createReferral({
      referralId: 'ref-limit-2',
      collaborationRunId: 'collab-limits',
      sourceBuilder: { agentRole: 'builder', builderProfileId: 'builder-b' },
      targetBuilder: {
        agentRole: 'product-strategy',
        builderProfileId: 'builder-c',
      },
      idempotencyKey: 'key-limit-2',
    });
    await service.createReferral({
      referralId: 'ref-limit-3',
      collaborationRunId: 'collab-limits',
      sourceBuilder: { agentRole: 'builder', builderProfileId: 'builder-c' },
      targetBuilder: {
        agentRole: 'technology-advisor',
        builderProfileId: 'builder-d',
      },
      idempotencyKey: 'key-limit-3',
    });
    service.clearAuditEvents();
    await expect(
      service.validateReferral({
        collaborationRunId: 'collab-limits',
        sourceBuilderProfileId: 'builder-d',
        targetBuilderProfileId: 'builder-e',
        idempotencyKey: 'key-limit-4',
      }),
    ).rejects.toThrow(/max agents/i);
    expect(service.getAuditEvents()[0]?.payload.limitType).toBe('agent_limit');
    expect(DEFAULT_MAX_AGENTS_PER_COLLABORATION).toBe(4);
  });

  it('omits harnessVersion from the startReferralExecution job payload', async () => {
    const { service } = createService();
    const referral = await seedRunAndReferral(service, {
      collaborationRunId: 'collab-harness',
      referralId: 'ref-harness',
      referralTraceId: 'trace-harness',
      idempotencyKey: 'key-harness',
    });

    await service.startReferralExecution({
      referralId: referral.referralId,
      executionId: 'exec-harness-01',
      sessionId: 'session-01',
      conversationId: 'conv-01',
      userId: 'user-01',
      apiKeyId: 'apikey-01',
      prompt: 'analyze',
      provider: 'stub',
      adapter: 'stub',
      harnessVersion: 'v1',
      submittedAt: new Date().toISOString(),
    });

    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);
    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload).not.toHaveProperty('harnessVersion');
    expect(payload).not.toHaveProperty('harnessEntitlementProof');
    expect(payload.referralId).toBe(referral.referralId);
    expect(payload.isReferralExecution).toBe(true);
  });

  it('does not register an HTTP controller on OrchestrationModule', () => {
    const controllers =
      Reflect.getMetadata('controllers', OrchestrationModule) ?? [];
    expect(controllers).toEqual([]);
  });

  it('wires repository tokens through the Nest testing module', async () => {
    const fakes = createOrchestrationRepoFakes();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestrationService,
        {
          provide: getRepositoryToken(CollaborationRunEntity),
          useValue: fakes.runRepo,
        },
        {
          provide: getRepositoryToken(CollaborationReferralEntity),
          useValue: fakes.referralRepo,
        },
        { provide: QueueService, useValue: mockQueueService },
        {
          provide: ExecutionResultService,
          useValue: mockExecutionResultService,
        },
      ],
    }).compile();

    const service = module.get<OrchestrationService>(OrchestrationService);
    const run = await service.createCollaborationRun({
      collaborationRunId: 'collab-nest',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });
    expect(run.collaborationRunId).toBe('collab-nest');
  });
});
