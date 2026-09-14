import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrchestrationService } from '../orchestration.service';
import { CollaborationRunEntity } from '../collaboration-run.entity';
import { CollaborationReferralEntity } from '../collaboration-referral.entity';
import {
  DEFAULT_MAX_AGENTS_PER_COLLABORATION,
  DEFAULT_MAX_REFERRAL_DEPTH,
  NO_WRITE_TOOLS_INDICATOR,
  type OrchestrationAuditEvent,
  READ_ONLY_ALLOWED_TOOL_IDS,
  READ_ONLY_BLOCKED_TOOL_IDS,
  READ_ONLY_MODE_INDICATOR,
} from '../orchestration.contracts';
import { QueueService } from '../../queue/queue.service';
import { ExecutionResultService } from '../../ai/execution-result.service';
import { InMemoryOrchestrationAuditRecorder } from '../orchestration-audit.recorder';

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

function orchestrationRepositoryProviders(fakes = createOrchestrationRepoFakes()) {
  return [
    {
      provide: getRepositoryToken(CollaborationRunEntity),
      useValue: fakes.runRepo,
    },
    {
      provide: getRepositoryToken(CollaborationReferralEntity),
      useValue: fakes.referralRepo,
    },
  ];
}

describe('OrchestrationService', () => {
  let service: OrchestrationService;
  let mockQueueService: { enqueueExecution: jest.Mock };
  let mockExecutionResultService: { requestCancel: jest.Mock };

  beforeEach(async () => {
    mockQueueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };
    mockExecutionResultService = {
      requestCancel: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestrationService,
        ...orchestrationRepositoryProviders(),
        { provide: QueueService, useValue: mockQueueService },
        { provide: ExecutionResultService, useValue: mockExecutionResultService },
      ],
    }).compile();

    service = module.get<OrchestrationService>(OrchestrationService);
  });

  it('is defined via Nest testing module', async () => {
    expect(service).toBeDefined();
  });

  it('returns default read-only referral constraints', async () => {
    const constraints = service.getDefaultReferralConstraints();

    expect(constraints.maxDepth).toBe(DEFAULT_MAX_REFERRAL_DEPTH);
    expect(constraints.maxAgentsPerCollaboration).toBe(
      DEFAULT_MAX_AGENTS_PER_COLLABORATION,
    );
    expect(constraints.readOnly).toBe(true);
    expect(constraints.allowWriteTools).toBe(false);
    expect(constraints.allowedTools).toEqual(['list_files', 'read_file']);
  });

  it('returns a read-only policy that blocks write tools', async () => {
    const policy = service.getReadOnlyPolicy();

    expect(policy.mode).toBe(READ_ONLY_MODE_INDICATOR);
    expect(policy.noWriteIndicator).toBe(NO_WRITE_TOOLS_INDICATOR);
    expect(policy.readOnly).toBe(true);
    expect(policy.allowWriteTools).toBe(false);
    expect(policy.blockedToolIds).toEqual([...READ_ONLY_BLOCKED_TOOL_IDS]);
  });

  it('creates and retrieves a collaboration run', async () => {
    const created = await service.createCollaborationRun({
      collaborationRunId: 'collab-01',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });

    const fetched = await service.getCollaborationRun('collab-01');

    expect(created.collaborationRunId).toBe('collab-01');
    expect(created.status).toBe('active');
    expect(created.orchestrationMode).toBe(READ_ONLY_MODE_INDICATOR);
    expect(created.activeBuilderProfileIds).toEqual(['builder-a']);
    expect(fetched).toEqual(created);
  });

  it('creates and retrieves a referral', async () => {
    await service.createCollaborationRun({
      collaborationRunId: 'collab-02',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });

    const created = await service.createReferral({
      referralId: 'ref-02',
      referralTraceId: 'trace-02',
      collaborationRunId: 'collab-02',
      sourceBuilder: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
      targetBuilder: {
        agentRole: 'chief-of-staff',
        builderProfileId: 'builder-b',
      },
      idempotencyKey: 'key-02',
      referralChain: ['builder-a'],
      visitedBuilderProfileIds: ['builder-a'],
      depth: 1,
      constraints: {
        readOnly: true,
        allowWriteTools: false,
      },
    });

    const fetched = await service.getReferral('ref-02');

    expect(created.referralId).toBe('ref-02');
    expect(created.referralTraceId).toBe('trace-02');
    expect(created.status).toBe('pending_approval');
    expect(created.constraints.allowedTools).toEqual([...READ_ONLY_ALLOWED_TOOL_IDS]);
    expect(fetched).toEqual(created);
  });

  it('completeReferral updates referral status and result', async () => {
    await service.createCollaborationRun({
      collaborationRunId: 'collab-03',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });

    await service.createReferral({
      referralId: 'ref-03',
      referralTraceId: 'trace-03',
      collaborationRunId: 'collab-03',
      sourceBuilder: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
      targetBuilder: {
        agentRole: 'product-strategy',
        builderProfileId: 'builder-b',
      },
      idempotencyKey: 'key-03',
      referralChain: ['builder-a'],
      visitedBuilderProfileIds: ['builder-a'],
      depth: 1,
    });

    const completed = await service.completeReferral({
      referralId: 'ref-03',
      summary: 'Completed successfully',
      outputFiles: ['/tmp/summary.md'],
      durationMs: 321,
    });

    expect(completed.status).toBe('completed');
    expect(completed.completedAt).not.toBeNull();
    expect(completed.result).toEqual({
      referralId: 'ref-03',
      referralTraceId: 'trace-03',
      status: 'success',
      summary: 'Completed successfully',
      outputFiles: ['/tmp/summary.md'],
      durationMs: 321,
      completedAt: completed.completedAt,
      failedAt: null,
      timedOutAt: null,
    });
  });

  it('failReferral updates referral status and result', async () => {
    await service.createCollaborationRun({
      collaborationRunId: 'collab-04',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });

    await service.createReferral({
      referralId: 'ref-04',
      referralTraceId: 'trace-04',
      collaborationRunId: 'collab-04',
      sourceBuilder: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
      targetBuilder: {
        agentRole: 'technology-advisor',
        builderProfileId: 'builder-b',
      },
      idempotencyKey: 'key-04',
      referralChain: ['builder-a'],
      visitedBuilderProfileIds: ['builder-a'],
      depth: 1,
    });

    const failed = await service.failReferral({
      referralId: 'ref-04',
      summary: 'Execution failed',
      outputFiles: [],
      durationMs: 55,
    });

    expect(failed.status).toBe('failed');
    expect(failed.failedAt).not.toBeNull();
    expect(failed.result).toEqual({
      referralId: 'ref-04',
      referralTraceId: 'trace-04',
      status: 'failed',
      summary: 'Execution failed',
      outputFiles: [],
      durationMs: 55,
      completedAt: null,
      failedAt: failed.failedAt,
      timedOutAt: null,
    });
  });

  it('enforces default max depth of 3', async () => {
    await service.createCollaborationRun({
      collaborationRunId: 'collab-05',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });

    await expect(
      service.validateReferral({
        collaborationRunId: 'collab-05',
        sourceBuilderProfileId: 'builder-a',
        targetBuilderProfileId: 'builder-b',
        idempotencyKey: 'key-05',
        depth: DEFAULT_MAX_REFERRAL_DEPTH,
      }),
    ).rejects.toThrow(/exceeds max depth/i);
  });

  it('enforces default max agents of 4', async () => {
    await service.createCollaborationRun({
      collaborationRunId: 'collab-06',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });

    await service.createReferral({
      referralId: 'ref-06-1',
      collaborationRunId: 'collab-06',
      sourceBuilder: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
      targetBuilder: {
        agentRole: 'chief-of-staff',
        builderProfileId: 'builder-b',
      },
      idempotencyKey: 'key-06-1',
    });

    await service.createReferral({
      referralId: 'ref-06-2',
      collaborationRunId: 'collab-06',
      sourceBuilder: {
        agentRole: 'builder',
        builderProfileId: 'builder-b',
      },
      targetBuilder: {
        agentRole: 'product-strategy',
        builderProfileId: 'builder-c',
      },
      idempotencyKey: 'key-06-2',
    });

    await service.createReferral({
      referralId: 'ref-06-3',
      collaborationRunId: 'collab-06',
      sourceBuilder: {
        agentRole: 'builder',
        builderProfileId: 'builder-c',
      },
      targetBuilder: {
        agentRole: 'technology-advisor',
        builderProfileId: 'builder-d',
      },
      idempotencyKey: 'key-06-3',
    });

    await expect(
      service.validateReferral({
        collaborationRunId: 'collab-06',
        sourceBuilderProfileId: 'builder-d',
        targetBuilderProfileId: 'builder-e',
        idempotencyKey: 'key-06-4',
      }),
    ).rejects.toThrow(/max agents/i);
  });

  it('uses idempotency key to return existing referral deterministically', async () => {
    await service.createCollaborationRun({
      collaborationRunId: 'collab-07',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });

    const first = await service.createReferral({
      referralId: 'ref-07',
      referralTraceId: 'trace-07',
      collaborationRunId: 'collab-07',
      sourceBuilder: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
      targetBuilder: {
        agentRole: 'chief-of-staff',
        builderProfileId: 'builder-b',
      },
      idempotencyKey: 'idempotency-07',
    });

    const second = await service.createReferral({
      referralId: 'ref-07-duplicate',
      referralTraceId: 'trace-07-duplicate',
      collaborationRunId: 'collab-07',
      sourceBuilder: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
      targetBuilder: {
        agentRole: 'chief-of-staff',
        builderProfileId: 'builder-b',
      },
      idempotencyKey: 'idempotency-07',
    });

    expect(second.referralId).toBe(first.referralId);
    expect(second.referralTraceId).toBe(first.referralTraceId);
  });

  it('rejects looped referrals when target builder is already visited', async () => {
    await service.createCollaborationRun({
      collaborationRunId: 'collab-08',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });

    await expect(
      service.validateReferral({
        collaborationRunId: 'collab-08',
        sourceBuilderProfileId: 'builder-b',
        targetBuilderProfileId: 'builder-a',
        idempotencyKey: 'key-08',
        visitedBuilderProfileIds: ['builder-a', 'builder-b'],
      }),
    ).rejects.toThrow(/loop detected/i);
  });

  it('enforces read-only policy by blocking write-enabled constraints', async () => {
    await service.createCollaborationRun({
      collaborationRunId: 'collab-09',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });

    await expect(
      service.createReferral({
        collaborationRunId: 'collab-09',
        sourceBuilder: {
          agentRole: 'builder',
          builderProfileId: 'builder-a',
        },
        targetBuilder: {
          agentRole: 'chief-of-staff',
          builderProfileId: 'builder-b',
        },
        idempotencyKey: 'key-09',
        constraints: {
          readOnly: false,
          allowWriteTools: true,
          allowedTools: ['write_file'],
        },
      }),
    ).rejects.toThrow(/read-only/i);
  });

  it('runs without queue or runtime provider dependencies', async () => {
    const run = await service.createCollaborationRun({
      collaborationRunId: 'collab-10',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });

    const referral = await service.createReferral({
      referralId: 'ref-10',
      collaborationRunId: run.collaborationRunId,
      sourceBuilder: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
      targetBuilder: {
        agentRole: 'chief-of-staff',
        builderProfileId: 'builder-b',
      },
      idempotencyKey: 'key-10',
    });

    expect(run.collaborationRunId).toBe('collab-10');
    expect(referral.collaborationRunId).toBe('collab-10');
    expect(referral.status).toBe('pending_approval');
  });
});

describe('AGENT-PLATFORM-07C2: startReferralExecution', () => {
  let service: OrchestrationService;
  let mockQueueService: { enqueueExecution: jest.Mock };
  let mockExecutionResultService: { requestCancel: jest.Mock };

  beforeEach(async () => {
    mockQueueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };
    mockExecutionResultService = {
      requestCancel: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestrationService,
        ...orchestrationRepositoryProviders(),
        { provide: QueueService, useValue: mockQueueService },
        { provide: ExecutionResultService, useValue: mockExecutionResultService },
      ],
    }).compile();

    service = module.get<OrchestrationService>(OrchestrationService);
  });

  async function setupReferral(overrides?: { referralId?: string; collabId?: string }) {
    const collabId = overrides?.collabId ?? 'collab-exec-01';
    const refId = overrides?.referralId ?? 'ref-exec-01';

    await service.createCollaborationRun({
      collaborationRunId: collabId,
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: { agentRole: 'builder', builderProfileId: 'builder-a' },
    });

    return await service.createReferral({
      referralId: refId,
      referralTraceId: `trace-${refId}`,
      collaborationRunId: collabId,
      parentReferralTraceId: 'parent-trace-001',
      sourceBuilder: { agentRole: 'builder', builderProfileId: 'builder-a' },
      targetBuilder: { agentRole: 'chief-of-staff', builderProfileId: 'builder-b' },
      idempotencyKey: `key-${refId}`,
      referralChain: ['builder-a'],
      visitedBuilderProfileIds: ['builder-a'],
      depth: 1,
    });
  }

  function baseExecutionInput(referralId: string) {
    return {
      referralId,
      executionId: 'exec-001',
      sessionId: 'session-001',
      conversationId: 'conv-001',
      userId: 'user-01',
      apiKeyId: 'apikey-01',
      prompt: 'analyze workspace',
      provider: 'stub',
      adapter: 'stub',
      model: 'test-model',
      harnessVersion: 'v1',
      submittedAt: new Date().toISOString(),
      orchestrationPriority: 10,
    } as const;
  }

  it('builds enriched job payload with all orchestration metadata fields', async () => {
    const referral = await setupReferral();
    await service.startReferralExecution(baseExecutionInput(referral.referralId));

    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);
    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];

    expect(payload.executionId).toBe('exec-001');
    expect(payload.collaborationRunId).toBe('collab-exec-01');
    expect(payload.referralTraceId).toBe(`trace-${referral.referralId}`);
    expect(payload.parentReferralTraceId).toBe('parent-trace-001');
    expect(payload.referringBuilderProfileId).toBe('builder-a');
    expect(payload.referralId).toBe(referral.referralId);
    expect(payload.isReferralExecution).toBe(true);
    expect(payload.orchestrationPriority).toBe(10);
    expect(payload.agentRole).toBe('chief-of-staff');
    expect(payload.builderProfileId).toBe('builder-b');
  });

  it('transitions referral to in_progress', async () => {
    const referral = await setupReferral();
    await service.startReferralExecution(baseExecutionInput(referral.referralId));

    const updated = await service.getReferral(referral.referralId);
    expect(updated!.status).toBe('in_progress');
  });

  it('rejects if referral is not in a valid starting state', async () => {
    const referral = await setupReferral();
    await service.completeReferral({
      referralId: referral.referralId,
      summary: 'done',
    });

    await expect(
      service.startReferralExecution(baseExecutionInput(referral.referralId)),
    ).rejects.toThrow(/cannot start execution/i);
  });

  it('records executionId on the referral row for cancel lookup', async () => {
    const referral = await setupReferral();
    await service.startReferralExecution(baseExecutionInput(referral.referralId));

    await service.cancelReferral({
      referralId: referral.referralId,
      cancelledByUserId: 'user-01',
      cancelReason: 'testing cancel',
    });

    expect(mockExecutionResultService.requestCancel).toHaveBeenCalledWith('exec-001');
  });

  it('enforces read-only constraints before enqueue', async () => {
    await service.createCollaborationRun({
      collaborationRunId: 'collab-ro-check',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: { agentRole: 'builder', builderProfileId: 'builder-a' },
    });

    await expect(
      service.createReferral({
        referralId: 'ref-ro-check',
        collaborationRunId: 'collab-ro-check',
        sourceBuilder: { agentRole: 'builder', builderProfileId: 'builder-a' },
        targetBuilder: { agentRole: 'chief-of-staff', builderProfileId: 'builder-b' },
        idempotencyKey: 'key-ro-check',
        constraints: { readOnly: false, allowWriteTools: true },
      }),
    ).rejects.toThrow(/read-only/i);

    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
  });

  it('AGENT-PLATFORM-EXEC-01C5B1: strips caller-provided harnessVersion from the enqueued referral job', async () => {
    const referral = await setupReferral({ referralId: 'ref-01c5b1-strip', collabId: 'collab-01c5b1-strip' });
    await service.startReferralExecution(baseExecutionInput(referral.referralId));

    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);
    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload).not.toHaveProperty('harnessVersion');
    expect(payload.executionId).toBe('exec-001');
    expect(payload.referralId).toBe(referral.referralId);
    expect(payload.isReferralExecution).toBe(true);
  });

  it('AGENT-PLATFORM-EXEC-01C5B1: referral input without harnessVersion retains existing enqueue behavior', async () => {
    const referral = await setupReferral({ referralId: 'ref-01c5b1-plain', collabId: 'collab-01c5b1-plain' });
    const { harnessVersion: _omitted, ...inputWithoutHarness } = baseExecutionInput(
      referral.referralId,
    );
    expect(_omitted).toBe('v1');

    await service.startReferralExecution(inputWithoutHarness);

    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);
    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload).not.toHaveProperty('harnessVersion');
    expect(payload.executionId).toBe('exec-001');
    expect(payload.userId).toBe('user-01');
    expect(payload.apiKeyId).toBe('apikey-01');
    expect(payload.collaborationRunId).toBe('collab-01c5b1-plain');
    expect(payload.referralId).toBe(referral.referralId);
    expect(payload.isReferralExecution).toBe(true);
    expect(payload.orchestrationPriority).toBe(10);
  });

  it('AGENT-PLATFORM-EXEC-01C5B1: does not manufacture a harnessEntitlementProof', async () => {
    const referral = await setupReferral({ referralId: 'ref-01c5b1-proof', collabId: 'collab-01c5b1-proof' });
    await service.startReferralExecution(baseExecutionInput(referral.referralId));

    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload).not.toHaveProperty('harnessEntitlementProof');
  });
});

describe('AGENT-PLATFORM-07C2: cancelReferral', () => {
  let service: OrchestrationService;
  let mockQueueService: { enqueueExecution: jest.Mock };
  let mockExecutionResultService: { requestCancel: jest.Mock };

  beforeEach(async () => {
    mockQueueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };
    mockExecutionResultService = {
      requestCancel: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestrationService,
        ...orchestrationRepositoryProviders(),
        { provide: QueueService, useValue: mockQueueService },
        { provide: ExecutionResultService, useValue: mockExecutionResultService },
      ],
    }).compile();

    service = module.get<OrchestrationService>(OrchestrationService);
  });

  async function setupStartedReferral() {
    await service.createCollaborationRun({
      collaborationRunId: 'collab-cancel-01',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: { agentRole: 'builder', builderProfileId: 'builder-a' },
    });

    await service.createReferral({
      referralId: 'ref-cancel-01',
      referralTraceId: 'trace-cancel-01',
      collaborationRunId: 'collab-cancel-01',
      sourceBuilder: { agentRole: 'builder', builderProfileId: 'builder-a' },
      targetBuilder: { agentRole: 'chief-of-staff', builderProfileId: 'builder-b' },
      idempotencyKey: 'key-cancel-01',
      referralChain: ['builder-a'],
      visitedBuilderProfileIds: ['builder-a'],
      depth: 1,
    });

    return service.startReferralExecution({
      referralId: 'ref-cancel-01',
      executionId: 'exec-cancel-01',
      sessionId: 'session-01',
      conversationId: 'conv-01',
      userId: 'user-01',
      apiKeyId: 'apikey-01',
      prompt: 'test',
      provider: 'stub',
      adapter: 'stub',
      submittedAt: new Date().toISOString(),
    });
  }

  it('calls requestCancel with the correct executionId', async () => {
    await setupStartedReferral();

    await service.cancelReferral({
      referralId: 'ref-cancel-01',
      cancelledByUserId: 'user-01',
      cancelReason: 'user requested',
    });

    expect(mockExecutionResultService.requestCancel).toHaveBeenCalledWith('exec-cancel-01');
  });

  it('updates referral cancelStatus and status to cancelled', async () => {
    await setupStartedReferral();

    const cancelled = await service.cancelReferral({
      referralId: 'ref-cancel-01',
      cancelledByUserId: 'user-01',
      cancelReason: 'user requested',
    });

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancelStatus).toBe('cancelled');
    expect(cancelled.cancelRequestedAt).not.toBeNull();
    expect(cancelled.cancelledByUserId).toBe('user-01');
    expect(cancelled.cancelReason).toBe('user requested');
  });

  it('enforces userId ownership', async () => {
    await setupStartedReferral();

    await expect(
      service.cancelReferral({
        referralId: 'ref-cancel-01',
        cancelledByUserId: 'user-other',
        cancelReason: 'unauthorized',
      }),
    ).rejects.toThrow(/not authorized/i);
  });

  it('handles gracefully when execution has already completed', async () => {
    await setupStartedReferral();
    mockExecutionResultService.requestCancel.mockResolvedValue(false);

    const cancelled = await service.cancelReferral({
      referralId: 'ref-cancel-01',
      cancelledByUserId: 'user-01',
      cancelReason: 'too late',
    });

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancelStatus).toBe('cancelled');
    expect(mockExecutionResultService.requestCancel).toHaveBeenCalledWith('exec-cancel-01');
  });
});

describe('AGENT-PLATFORM-07C2: cancelCollaboration', () => {
  let service: OrchestrationService;
  let mockQueueService: { enqueueExecution: jest.Mock };
  let mockExecutionResultService: { requestCancel: jest.Mock };

  beforeEach(async () => {
    mockQueueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };
    mockExecutionResultService = {
      requestCancel: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestrationService,
        ...orchestrationRepositoryProviders(),
        { provide: QueueService, useValue: mockQueueService },
        { provide: ExecutionResultService, useValue: mockExecutionResultService },
      ],
    }).compile();

    service = module.get<OrchestrationService>(OrchestrationService);
  });

  it('cascade-cancels all active referral executions', async () => {
    await service.createCollaborationRun({
      collaborationRunId: 'collab-cascade-01',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: { agentRole: 'builder', builderProfileId: 'builder-a' },
    });

    await service.createReferral({
      referralId: 'ref-cascade-01',
      collaborationRunId: 'collab-cascade-01',
      sourceBuilder: { agentRole: 'builder', builderProfileId: 'builder-a' },
      targetBuilder: { agentRole: 'chief-of-staff', builderProfileId: 'builder-b' },
      idempotencyKey: 'key-cascade-01',
    });

    await service.createReferral({
      referralId: 'ref-cascade-02',
      collaborationRunId: 'collab-cascade-01',
      sourceBuilder: { agentRole: 'builder', builderProfileId: 'builder-b' },
      targetBuilder: { agentRole: 'product-strategy', builderProfileId: 'builder-c' },
      idempotencyKey: 'key-cascade-02',
    });

    await service.startReferralExecution({
      referralId: 'ref-cascade-01',
      executionId: 'exec-cascade-01',
      sessionId: 's1',
      conversationId: 'c1',
      userId: 'user-01',
      apiKeyId: 'k1',
      prompt: 'test',
      provider: 'stub',
      adapter: 'stub',
      submittedAt: new Date().toISOString(),
    });

    await service.startReferralExecution({
      referralId: 'ref-cascade-02',
      executionId: 'exec-cascade-02',
      sessionId: 's2',
      conversationId: 'c2',
      userId: 'user-01',
      apiKeyId: 'k1',
      prompt: 'test2',
      provider: 'stub',
      adapter: 'stub',
      submittedAt: new Date().toISOString(),
    });

    await service.cancelCollaboration({
      collaborationRunId: 'collab-cascade-01',
      cancelledByUserId: 'user-01',
      cancelReason: 'cancel all',
    });

    expect(mockExecutionResultService.requestCancel).toHaveBeenCalledWith('exec-cascade-01');
    expect(mockExecutionResultService.requestCancel).toHaveBeenCalledWith('exec-cascade-02');

    const ref1 = await service.getReferral('ref-cascade-01');
    const ref2 = await service.getReferral('ref-cascade-02');
    expect(ref1!.status).toBe('cancelled');
    expect(ref2!.status).toBe('cancelled');
  });

  it('updates collaboration run status to cancelled', async () => {
    await service.createCollaborationRun({
      collaborationRunId: 'collab-cascade-02',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: { agentRole: 'builder', builderProfileId: 'builder-a' },
    });

    const cancelledRun = await service.cancelCollaboration({
      collaborationRunId: 'collab-cascade-02',
      cancelledByUserId: 'user-01',
      cancelReason: 'done',
    });

    expect(cancelledRun.status).toBe('cancelled');
    expect(cancelledRun.cancelledByUserId).toBe('user-01');
    expect(cancelledRun.cancelReason).toBe('done');
    expect(cancelledRun.cancelRequestedAt).not.toBeNull();
  });

  it('enforces userId ownership', async () => {
    await service.createCollaborationRun({
      collaborationRunId: 'collab-cascade-03',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: { agentRole: 'builder', builderProfileId: 'builder-a' },
    });

    await expect(
      service.cancelCollaboration({
        collaborationRunId: 'collab-cascade-03',
        cancelledByUserId: 'user-other',
        cancelReason: 'unauthorized',
      }),
    ).rejects.toThrow(/not authorized/i);
  });
});

describe('AGENT-PLATFORM-07D: InMemoryOrchestrationAuditRecorder', () => {
  it('records and returns typed orchestration audit events', async () => {
    const recorder = new InMemoryOrchestrationAuditRecorder();
    const event: OrchestrationAuditEvent = {
      eventType: 'orchestration.collaboration_created',
      collaborationRunId: 'collab-recorder-01',
      referralTraceId: null,
      sourceBuilder: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
      targetBuilder: null,
      timestamp: new Date().toISOString(),
      payload: {
        lifecycleEvent: 'collaboration_started',
      },
    };

    recorder.record(event);

    expect(recorder.getEvents()).toEqual([event]);
  });

  it('clear removes all in-memory recorded events', async () => {
    const recorder = new InMemoryOrchestrationAuditRecorder();
    recorder.record({
      eventType: 'orchestration.collaboration_created',
      collaborationRunId: 'collab-recorder-02',
      referralTraceId: null,
      sourceBuilder: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
      targetBuilder: null,
      timestamp: new Date().toISOString(),
      payload: {
        lifecycleEvent: 'collaboration_started',
      },
    });

    recorder.clear();

    expect(recorder.getEvents()).toEqual([]);
  });
});

describe('AGENT-PLATFORM-07D: OrchestrationService audit emission', () => {
  let service: OrchestrationService;
  let auditRecorder: InMemoryOrchestrationAuditRecorder;
  let mockQueueService: { enqueueExecution: jest.Mock };
  let mockExecutionResultService: { requestCancel: jest.Mock };

  beforeEach(async () => {
    mockQueueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };
    mockExecutionResultService = {
      requestCancel: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestrationService,
        ...orchestrationRepositoryProviders(),
        InMemoryOrchestrationAuditRecorder,
        { provide: QueueService, useValue: mockQueueService },
        { provide: ExecutionResultService, useValue: mockExecutionResultService },
      ],
    }).compile();

    service = module.get<OrchestrationService>(OrchestrationService);
    auditRecorder = module.get<InMemoryOrchestrationAuditRecorder>(
      InMemoryOrchestrationAuditRecorder,
    );
    auditRecorder.clear();
  });

  async function createRun(collaborationRunId = 'collab-audit-01') {
    return await service.createCollaborationRun({
      collaborationRunId,
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });
  }

  async function createReferral(overrides?: {
    collaborationRunId?: string;
    referralId?: string;
    referralTraceId?: string;
    idempotencyKey?: string;
  }) {
    return await service.createReferral({
      referralId: overrides?.referralId ?? 'ref-audit-01',
      referralTraceId: overrides?.referralTraceId ?? 'trace-audit-01',
      collaborationRunId: overrides?.collaborationRunId ?? 'collab-audit-01',
      sourceBuilder: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
      targetBuilder: {
        agentRole: 'chief-of-staff',
        builderProfileId: 'builder-b',
      },
      idempotencyKey: overrides?.idempotencyKey ?? 'key-audit-01',
    });
  }

  it('createCollaborationRun emits collaboration_started mapped event', async () => {
    await createRun('collab-audit-create-run');

    const events = auditRecorder.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('orchestration.collaboration_created');
    expect(events[0]?.payload.lifecycleEvent).toBe('collaboration_started');
  });

  it('createReferral emits referral_created', async () => {
    await createRun();
    service.clearAuditEvents();

    const referral = await createReferral();
    const events = service.getAuditEvents();

    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('orchestration.referral_created');
    expect(events[0]?.payload.lifecycleEvent).toBe('referral_created');
    expect(events[0]?.payload.referralId).toBe(referral.referralId);
  });

  it('duplicate idempotency hit emits referral_duplicate_detected marker', async () => {
    await createRun('collab-audit-duplicate');
    const first = await createReferral({
      collaborationRunId: 'collab-audit-duplicate',
      referralId: 'ref-audit-dup-first',
      referralTraceId: 'trace-audit-dup-first',
      idempotencyKey: 'key-audit-dup',
    });
    service.clearAuditEvents();

    const second = await createReferral({
      collaborationRunId: 'collab-audit-duplicate',
      referralId: 'ref-audit-dup-second',
      referralTraceId: 'trace-audit-dup-second',
      idempotencyKey: 'key-audit-dup',
    });
    const events = service.getAuditEvents();

    expect(second.referralId).toBe(first.referralId);
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('orchestration.referral_created');
    expect(events[0]?.payload.lifecycleEvent).toBe('referral_duplicate_detected');
    expect(events[0]?.payload.result).toBe('duplicate');
  });

  it('startReferralExecution emits referral_enqueued/referral_started mapped event', async () => {
    await createRun('collab-audit-start');
    const referral = await createReferral({
      collaborationRunId: 'collab-audit-start',
      referralId: 'ref-audit-start',
      referralTraceId: 'trace-audit-start',
      idempotencyKey: 'key-audit-start',
    });
    service.clearAuditEvents();

    await service.startReferralExecution({
      referralId: referral.referralId,
      executionId: 'exec-audit-01',
      sessionId: 'session-audit-01',
      conversationId: 'conversation-audit-01',
      userId: 'user-01',
      apiKeyId: 'apikey-01',
      prompt: 'run referral',
      provider: 'stub',
      adapter: 'stub',
      submittedAt: new Date().toISOString(),
      orchestrationPriority: 1,
    });

    const events = service.getAuditEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('orchestration.referral_started');
    expect(events[0]?.payload.lifecycleEvent).toBe('referral_started');
    expect(events[0]?.payload.transitionDetail).toBe('referral_enqueued');
  });

  it('completeReferral emits referral_completed', async () => {
    await createRun('collab-audit-complete');
    const referral = await createReferral({
      collaborationRunId: 'collab-audit-complete',
      referralId: 'ref-audit-complete',
      referralTraceId: 'trace-audit-complete',
      idempotencyKey: 'key-audit-complete',
    });
    service.clearAuditEvents();

    await service.completeReferral({
      referralId: referral.referralId,
      summary: 'completed',
      durationMs: 15,
    });

    const events = service.getAuditEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('orchestration.referral_completed');
    expect(events[0]?.payload.lifecycleEvent).toBe('referral_completed');
  });

  it('failReferral emits referral_failed', async () => {
    await createRun('collab-audit-fail');
    const referral = await createReferral({
      collaborationRunId: 'collab-audit-fail',
      referralId: 'ref-audit-fail',
      referralTraceId: 'trace-audit-fail',
      idempotencyKey: 'key-audit-fail',
    });
    service.clearAuditEvents();

    await service.failReferral({
      referralId: referral.referralId,
      summary: 'failed',
      durationMs: 20,
    });

    const events = service.getAuditEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('orchestration.referral_failed');
    expect(events[0]?.payload.lifecycleEvent).toBe('referral_failed');
  });

  it('cancelReferral emits referral_cancelled', async () => {
    await createRun('collab-audit-cancel-ref');
    const referral = await createReferral({
      collaborationRunId: 'collab-audit-cancel-ref',
      referralId: 'ref-audit-cancel-ref',
      referralTraceId: 'trace-audit-cancel-ref',
      idempotencyKey: 'key-audit-cancel-ref',
    });
    await service.startReferralExecution({
      referralId: referral.referralId,
      executionId: 'exec-audit-cancel-ref',
      sessionId: 'session-audit-cancel-ref',
      conversationId: 'conversation-audit-cancel-ref',
      userId: 'user-01',
      apiKeyId: 'apikey-01',
      prompt: 'run referral then cancel',
      provider: 'stub',
      adapter: 'stub',
      submittedAt: new Date().toISOString(),
    });
    service.clearAuditEvents();

    await service.cancelReferral({
      referralId: referral.referralId,
      cancelledByUserId: 'user-01',
      cancelReason: 'requested',
    });

    const events = service.getAuditEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('orchestration.referral_cancelled');
    expect(events[0]?.payload.lifecycleEvent).toBe('referral_cancelled');
  });

  it('cancelCollaboration emits collaboration_cancelled', async () => {
    await createRun('collab-audit-cancel-collab');
    service.clearAuditEvents();

    await service.cancelCollaboration({
      collaborationRunId: 'collab-audit-cancel-collab',
      cancelledByUserId: 'user-01',
      cancelReason: 'user cancelled',
    });

    const events = service.getAuditEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('orchestration.collaboration_cancelled');
    expect(events[0]?.payload.lifecycleEvent).toBe('collaboration_cancelled');
  });

  it('depth block emits safety_limit_breached with limitType depth', async () => {
    await createRun('collab-audit-depth');
    service.clearAuditEvents();

    await expect(
      service.validateReferral({
        collaborationRunId: 'collab-audit-depth',
        sourceBuilderProfileId: 'builder-a',
        targetBuilderProfileId: 'builder-b',
        idempotencyKey: 'key-audit-depth',
        depth: DEFAULT_MAX_REFERRAL_DEPTH,
      }),
    ).rejects.toThrow(/exceeds max depth/i);

    const events = service.getAuditEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('orchestration.safety_limit_breached');
    expect(events[0]?.payload.limitType).toBe('depth');
  });

  it('agent-limit block emits safety_limit_breached with limitType agent_limit', async () => {
    await createRun('collab-audit-agent-limit');

    await service.createReferral({
      referralId: 'ref-audit-agent-limit-1',
      collaborationRunId: 'collab-audit-agent-limit',
      sourceBuilder: { agentRole: 'builder', builderProfileId: 'builder-a' },
      targetBuilder: { agentRole: 'chief-of-staff', builderProfileId: 'builder-b' },
      idempotencyKey: 'key-audit-agent-limit-1',
    });
    await service.createReferral({
      referralId: 'ref-audit-agent-limit-2',
      collaborationRunId: 'collab-audit-agent-limit',
      sourceBuilder: { agentRole: 'builder', builderProfileId: 'builder-b' },
      targetBuilder: { agentRole: 'product-strategy', builderProfileId: 'builder-c' },
      idempotencyKey: 'key-audit-agent-limit-2',
    });
    await service.createReferral({
      referralId: 'ref-audit-agent-limit-3',
      collaborationRunId: 'collab-audit-agent-limit',
      sourceBuilder: { agentRole: 'builder', builderProfileId: 'builder-c' },
      targetBuilder: { agentRole: 'technology-advisor', builderProfileId: 'builder-d' },
      idempotencyKey: 'key-audit-agent-limit-3',
    });
    service.clearAuditEvents();

    await expect(
      service.validateReferral({
        collaborationRunId: 'collab-audit-agent-limit',
        sourceBuilderProfileId: 'builder-d',
        targetBuilderProfileId: 'builder-e',
        idempotencyKey: 'key-audit-agent-limit-4',
      }),
    ).rejects.toThrow(/max agents/i);

    const events = service.getAuditEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('orchestration.safety_limit_breached');
    expect(events[0]?.payload.limitType).toBe('agent_limit');
  });

  it('loop block emits safety_limit_breached with limitType loop', async () => {
    await createRun('collab-audit-loop');
    service.clearAuditEvents();

    await expect(
      service.validateReferral({
        collaborationRunId: 'collab-audit-loop',
        sourceBuilderProfileId: 'builder-b',
        targetBuilderProfileId: 'builder-a',
        idempotencyKey: 'key-audit-loop',
        visitedBuilderProfileIds: ['builder-a', 'builder-b'],
      }),
    ).rejects.toThrow(/loop detected/i);

    const events = service.getAuditEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('orchestration.safety_limit_breached');
    expect(events[0]?.payload.limitType).toBe('loop');
  });

  it('payload includes collaboration/referral IDs and source-target builder metadata', async () => {
    await createRun('collab-audit-metadata');
    service.clearAuditEvents();

    const referral = await createReferral({
      collaborationRunId: 'collab-audit-metadata',
      referralId: 'ref-audit-metadata',
      referralTraceId: 'trace-audit-metadata',
      idempotencyKey: 'key-audit-metadata',
    });

    const event = service.getAuditEvents()[0];
    expect(event?.payload.collaborationRunId).toBe('collab-audit-metadata');
    expect(event?.payload.referralTraceId).toBe('trace-audit-metadata');
    expect(event?.payload.referralId).toBe(referral.referralId);
    expect(event?.payload.sourceBuilderProfileId).toBe('builder-a');
    expect(event?.payload.targetBuilderProfileId).toBe('builder-b');
  });

  it('service remains usable without external runtime/provider dependencies', async () => {
    const fakes = createOrchestrationRepoFakes();
    const localService = new OrchestrationService(
      fakes.runRepo as never,
      fakes.referralRepo as never,
    );
    const run = await localService.createCollaborationRun({
      collaborationRunId: 'collab-audit-local',
      userId: 'user-local',
      projectId: 'project-local',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-local',
      },
    });
    const referral = await localService.createReferral({
      referralId: 'ref-audit-local',
      collaborationRunId: run.collaborationRunId,
      sourceBuilder: {
        agentRole: 'builder',
        builderProfileId: 'builder-local',
      },
      targetBuilder: {
        agentRole: 'chief-of-staff',
        builderProfileId: 'builder-local-target',
      },
      idempotencyKey: 'key-audit-local',
    });

    expect(run.status).toBe('active');
    expect(referral.status).toBe('pending_approval');
    expect(localService.getAuditEvents().length).toBeGreaterThan(0);
  });
});
