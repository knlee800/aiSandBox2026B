import { Test, TestingModule } from '@nestjs/testing';
import { OrchestrationService } from '../orchestration.service';
import {
  DEFAULT_MAX_AGENTS_PER_COLLABORATION,
  DEFAULT_MAX_REFERRAL_DEPTH,
  NO_WRITE_TOOLS_INDICATOR,
  READ_ONLY_ALLOWED_TOOL_IDS,
  READ_ONLY_BLOCKED_TOOL_IDS,
  READ_ONLY_MODE_INDICATOR,
} from '../orchestration.contracts';
import { QueueService } from '../../queue/queue.service';
import { ExecutionResultService } from '../../ai/execution-result.service';

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
        { provide: QueueService, useValue: mockQueueService },
        { provide: ExecutionResultService, useValue: mockExecutionResultService },
      ],
    }).compile();

    service = module.get<OrchestrationService>(OrchestrationService);
  });

  it('is defined via Nest testing module', () => {
    expect(service).toBeDefined();
  });

  it('returns default read-only referral constraints', () => {
    const constraints = service.getDefaultReferralConstraints();

    expect(constraints.maxDepth).toBe(DEFAULT_MAX_REFERRAL_DEPTH);
    expect(constraints.maxAgentsPerCollaboration).toBe(
      DEFAULT_MAX_AGENTS_PER_COLLABORATION,
    );
    expect(constraints.readOnly).toBe(true);
    expect(constraints.allowWriteTools).toBe(false);
    expect(constraints.allowedTools).toEqual(['list_files', 'read_file']);
  });

  it('returns a read-only policy that blocks write tools', () => {
    const policy = service.getReadOnlyPolicy();

    expect(policy.mode).toBe(READ_ONLY_MODE_INDICATOR);
    expect(policy.noWriteIndicator).toBe(NO_WRITE_TOOLS_INDICATOR);
    expect(policy.readOnly).toBe(true);
    expect(policy.allowWriteTools).toBe(false);
    expect(policy.blockedToolIds).toEqual([...READ_ONLY_BLOCKED_TOOL_IDS]);
  });

  it('creates and retrieves a collaboration run', () => {
    const created = service.createCollaborationRun({
      collaborationRunId: 'collab-01',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });

    const fetched = service.getCollaborationRun('collab-01');

    expect(created.collaborationRunId).toBe('collab-01');
    expect(created.status).toBe('active');
    expect(created.orchestrationMode).toBe(READ_ONLY_MODE_INDICATOR);
    expect(created.activeBuilderProfileIds).toEqual(['builder-a']);
    expect(fetched).toEqual(created);
  });

  it('creates and retrieves a referral', () => {
    service.createCollaborationRun({
      collaborationRunId: 'collab-02',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });

    const created = service.createReferral({
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

    const fetched = service.getReferral('ref-02');

    expect(created.referralId).toBe('ref-02');
    expect(created.referralTraceId).toBe('trace-02');
    expect(created.status).toBe('pending_approval');
    expect(created.constraints.allowedTools).toEqual([...READ_ONLY_ALLOWED_TOOL_IDS]);
    expect(fetched).toEqual(created);
  });

  it('completeReferral updates referral status and result', () => {
    service.createCollaborationRun({
      collaborationRunId: 'collab-03',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });

    service.createReferral({
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

    const completed = service.completeReferral({
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

  it('failReferral updates referral status and result', () => {
    service.createCollaborationRun({
      collaborationRunId: 'collab-04',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });

    service.createReferral({
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

    const failed = service.failReferral({
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

  it('enforces default max depth of 3', () => {
    service.createCollaborationRun({
      collaborationRunId: 'collab-05',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });

    expect(() =>
      service.validateReferral({
        collaborationRunId: 'collab-05',
        sourceBuilderProfileId: 'builder-a',
        targetBuilderProfileId: 'builder-b',
        idempotencyKey: 'key-05',
        depth: DEFAULT_MAX_REFERRAL_DEPTH,
      }),
    ).toThrow(/exceeds max depth/i);
  });

  it('enforces default max agents of 4', () => {
    service.createCollaborationRun({
      collaborationRunId: 'collab-06',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });

    service.createReferral({
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

    service.createReferral({
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

    service.createReferral({
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

    expect(() =>
      service.validateReferral({
        collaborationRunId: 'collab-06',
        sourceBuilderProfileId: 'builder-d',
        targetBuilderProfileId: 'builder-e',
        idempotencyKey: 'key-06-4',
      }),
    ).toThrow(/max agents/i);
  });

  it('uses idempotency key to return existing referral deterministically', () => {
    service.createCollaborationRun({
      collaborationRunId: 'collab-07',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });

    const first = service.createReferral({
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

    const second = service.createReferral({
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

  it('rejects looped referrals when target builder is already visited', () => {
    service.createCollaborationRun({
      collaborationRunId: 'collab-08',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });

    expect(() =>
      service.validateReferral({
        collaborationRunId: 'collab-08',
        sourceBuilderProfileId: 'builder-b',
        targetBuilderProfileId: 'builder-a',
        idempotencyKey: 'key-08',
        visitedBuilderProfileIds: ['builder-a', 'builder-b'],
      }),
    ).toThrow(/loop detected/i);
  });

  it('enforces read-only policy by blocking write-enabled constraints', () => {
    service.createCollaborationRun({
      collaborationRunId: 'collab-09',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });

    expect(() =>
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
    ).toThrow(/read-only/i);
  });

  it('runs without queue or runtime provider dependencies', () => {
    const run = service.createCollaborationRun({
      collaborationRunId: 'collab-10',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-a',
      },
    });

    const referral = service.createReferral({
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
        { provide: QueueService, useValue: mockQueueService },
        { provide: ExecutionResultService, useValue: mockExecutionResultService },
      ],
    }).compile();

    service = module.get<OrchestrationService>(OrchestrationService);
  });

  function setupReferral(overrides?: { referralId?: string; collabId?: string }) {
    const collabId = overrides?.collabId ?? 'collab-exec-01';
    const refId = overrides?.referralId ?? 'ref-exec-01';

    service.createCollaborationRun({
      collaborationRunId: collabId,
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: { agentRole: 'builder', builderProfileId: 'builder-a' },
    });

    return service.createReferral({
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
    const referral = setupReferral();
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
    const referral = setupReferral();
    await service.startReferralExecution(baseExecutionInput(referral.referralId));

    const updated = service.getReferral(referral.referralId);
    expect(updated!.status).toBe('in_progress');
  });

  it('rejects if referral is not in a valid starting state', async () => {
    const referral = setupReferral();
    service.completeReferral({
      referralId: referral.referralId,
      summary: 'done',
    });

    await expect(
      service.startReferralExecution(baseExecutionInput(referral.referralId)),
    ).rejects.toThrow(/cannot start execution/i);
  });

  it('records executionId in private map for cancel lookup', async () => {
    const referral = setupReferral();
    await service.startReferralExecution(baseExecutionInput(referral.referralId));

    await service.cancelReferral({
      referralId: referral.referralId,
      cancelledByUserId: 'user-01',
      cancelReason: 'testing cancel',
    });

    expect(mockExecutionResultService.requestCancel).toHaveBeenCalledWith('exec-001');
  });

  it('enforces read-only constraints before enqueue', async () => {
    service.createCollaborationRun({
      collaborationRunId: 'collab-ro-check',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: { agentRole: 'builder', builderProfileId: 'builder-a' },
    });

    expect(() =>
      service.createReferral({
        referralId: 'ref-ro-check',
        collaborationRunId: 'collab-ro-check',
        sourceBuilder: { agentRole: 'builder', builderProfileId: 'builder-a' },
        targetBuilder: { agentRole: 'chief-of-staff', builderProfileId: 'builder-b' },
        idempotencyKey: 'key-ro-check',
        constraints: { readOnly: false, allowWriteTools: true },
      }),
    ).toThrow(/read-only/i);

    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
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
        { provide: QueueService, useValue: mockQueueService },
        { provide: ExecutionResultService, useValue: mockExecutionResultService },
      ],
    }).compile();

    service = module.get<OrchestrationService>(OrchestrationService);
  });

  function setupStartedReferral() {
    service.createCollaborationRun({
      collaborationRunId: 'collab-cancel-01',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: { agentRole: 'builder', builderProfileId: 'builder-a' },
    });

    service.createReferral({
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
        { provide: QueueService, useValue: mockQueueService },
        { provide: ExecutionResultService, useValue: mockExecutionResultService },
      ],
    }).compile();

    service = module.get<OrchestrationService>(OrchestrationService);
  });

  it('cascade-cancels all active referral executions', async () => {
    service.createCollaborationRun({
      collaborationRunId: 'collab-cascade-01',
      userId: 'user-01',
      projectId: 'project-01',
      initiatorAgent: { agentRole: 'builder', builderProfileId: 'builder-a' },
    });

    service.createReferral({
      referralId: 'ref-cascade-01',
      collaborationRunId: 'collab-cascade-01',
      sourceBuilder: { agentRole: 'builder', builderProfileId: 'builder-a' },
      targetBuilder: { agentRole: 'chief-of-staff', builderProfileId: 'builder-b' },
      idempotencyKey: 'key-cascade-01',
    });

    service.createReferral({
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

    const ref1 = service.getReferral('ref-cascade-01');
    const ref2 = service.getReferral('ref-cascade-02');
    expect(ref1!.status).toBe('cancelled');
    expect(ref2!.status).toBe('cancelled');
  });

  it('updates collaboration run status to cancelled', async () => {
    service.createCollaborationRun({
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
    service.createCollaborationRun({
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
