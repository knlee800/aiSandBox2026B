import { Test, TestingModule } from '@nestjs/testing';
import { OrchestrationService } from '../orchestration.service';
import {
  DEFAULT_MAX_REFERRAL_DEPTH,
  NO_WRITE_TOOLS_INDICATOR,
  READ_ONLY_ALLOWED_TOOL_IDS,
  READ_ONLY_BLOCKED_TOOL_IDS,
  READ_ONLY_MODE_INDICATOR,
} from '../orchestration.contracts';
import { QueueService } from '../../queue/queue.service';
import { ExecutionResultService } from '../../ai/execution-result.service';

describe('AGENT-PLATFORM-07E Step 3: Read-Only Coordinator In-Process Canary', () => {
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

  function createRun(collaborationRunId = 'collab-canary-01') {
    return service.createCollaborationRun({
      collaborationRunId,
      userId: 'user-canary-01',
      projectId: 'project-canary-01',
      initiatorAgent: {
        agentRole: 'builder',
        builderProfileId: 'builder-source-01',
      },
    });
  }

  function createReferral(overrides?: {
    referralId?: string;
    referralTraceId?: string;
    collaborationRunId?: string;
    parentReferralTraceId?: string | null;
    idempotencyKey?: string;
    targetBuilderProfileId?: string;
    targetAgentRole?: 'builder' | 'chief-of-staff' | 'product-strategy' | 'technology-advisor';
  }) {
    return service.createReferral({
      referralId: overrides?.referralId ?? 'ref-canary-01',
      referralTraceId: overrides?.referralTraceId ?? 'trace-canary-01',
      collaborationRunId: overrides?.collaborationRunId ?? 'collab-canary-01',
      parentReferralTraceId: overrides?.parentReferralTraceId ?? 'trace-parent-canary-00',
      sourceBuilder: {
        agentRole: 'builder',
        builderProfileId: 'builder-source-01',
      },
      targetBuilder: {
        agentRole: overrides?.targetAgentRole ?? 'chief-of-staff',
        builderProfileId: overrides?.targetBuilderProfileId ?? 'builder-target-01',
      },
      idempotencyKey: overrides?.idempotencyKey ?? 'idem-canary-01',
      referralChain: ['builder-source-01'],
      visitedBuilderProfileIds: ['builder-source-01'],
      depth: 1,
    });
  }

  function baseExecutionInput(referralId: string, executionId = 'exec-canary-01') {
    return {
      referralId,
      executionId,
      sessionId: 'session-canary-01',
      conversationId: 'conversation-canary-01',
      userId: 'user-canary-01',
      apiKeyId: 'apikey-canary-01',
      prompt: 'canary execution prompt',
      provider: 'stub',
      adapter: 'stub',
      model: 'stub-model',
      harnessVersion: 'v1',
      submittedAt: new Date().toISOString(),
      orchestrationPriority: 7,
    } as const;
  }

  it('1) creates collaboration run with collaboration_started audit metadata', () => {
    const run = createRun();
    const events = service.getAuditEvents();

    expect(run.collaborationRunId).toBe('collab-canary-01');
    expect(run.status).toBe('active');
    expect(run.orchestrationMode).toBe(READ_ONLY_MODE_INDICATOR);
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('orchestration.collaboration_created');
    expect(events[0]?.payload.lifecycleEvent).toBe('collaboration_started');
    expect(events[0]?.payload.collaborationRunId).toBe(run.collaborationRunId);
    expect(events[0]?.payload.userId).toBe('user-canary-01');
    expect(events[0]?.payload.projectId).toBe('project-canary-01');
    expect(events[0]?.payload.sourceBuilderProfileId).toBe('builder-source-01');
    expect(events[0]?.payload.sourceAgentRole).toBe('builder');
  });

  it('2) validates referral and read-only policy', () => {
    createRun();

    const validation = service.validateReferral({
      collaborationRunId: 'collab-canary-01',
      sourceBuilderProfileId: 'builder-source-01',
      targetBuilderProfileId: 'builder-target-01',
      idempotencyKey: 'idem-validate-01',
      depth: 1,
      visitedBuilderProfileIds: ['builder-source-01'],
    });
    const policy = service.getReadOnlyPolicy();

    expect(validation).toEqual({ outcome: 'valid' });
    expect(policy.mode).toBe(READ_ONLY_MODE_INDICATOR);
    expect(policy.noWriteIndicator).toBe(NO_WRITE_TOOLS_INDICATOR);
    expect(policy.readOnly).toBe(true);
    expect(policy.allowWriteTools).toBe(false);
    expect(policy.allowedToolIds).toEqual([...READ_ONLY_ALLOWED_TOOL_IDS]);
    expect(policy.blockedToolIds).toEqual([...READ_ONLY_BLOCKED_TOOL_IDS]);
  });

  it('3) creates referral with referral_created audit metadata', () => {
    createRun();
    service.clearAuditEvents();

    const referral = createReferral();
    const events = service.getAuditEvents();

    expect(referral.status).toBe('pending_approval');
    expect(referral.referralId).toBe('ref-canary-01');
    expect(referral.referralTraceId).toBe('trace-canary-01');
    expect(referral.parentReferralTraceId).toBe('trace-parent-canary-00');
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('orchestration.referral_created');
    expect(events[0]?.payload.lifecycleEvent).toBe('referral_created');
    expect(events[0]?.payload.referralId).toBe(referral.referralId);
    expect(events[0]?.payload.parentReferralTraceId).toBe('trace-parent-canary-00');
    expect(events[0]?.payload.sourceBuilderProfileId).toBe('builder-source-01');
    expect(events[0]?.payload.sourceAgentRole).toBe('builder');
    expect(events[0]?.payload.targetBuilderProfileId).toBe('builder-target-01');
    expect(events[0]?.payload.targetAgentRole).toBe('chief-of-staff');
    expect(events[0]?.payload.userId).toBe('user-canary-01');
    expect(events[0]?.payload.projectId).toBe('project-canary-01');
  });

  it('4) starts referral execution through mocked enqueue', async () => {
    createRun();
    const referral = createReferral();
    service.clearAuditEvents();

    const started = await service.startReferralExecution(baseExecutionInput(referral.referralId));
    const events = service.getAuditEvents();
    const payload = mockQueueService.enqueueExecution.mock.calls[0]?.[0];

    expect(started).toEqual({ executionId: 'exec-canary-01' });
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);
    expect(payload).toMatchObject({
      executionId: 'exec-canary-01',
      referralId: referral.referralId,
      isReferralExecution: true,
      collaborationRunId: 'collab-canary-01',
      referralTraceId: 'trace-canary-01',
      parentReferralTraceId: 'trace-parent-canary-00',
      referringBuilderProfileId: 'builder-source-01',
      builderProfileId: 'builder-target-01',
      agentRole: 'chief-of-staff',
      orchestrationPriority: 7,
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('orchestration.referral_started');
    expect(events[0]?.payload.lifecycleEvent).toBe('referral_started');
    expect(events[0]?.payload.transitionDetail).toBe('referral_enqueued');
  });

  it('5) verifies orchestration metadata fields across enqueue and audit payloads', async () => {
    createRun();
    const referral = createReferral();
    service.clearAuditEvents();

    await service.startReferralExecution(baseExecutionInput(referral.referralId, 'exec-canary-meta-01'));
    const payload = mockQueueService.enqueueExecution.mock.calls[0]?.[0];
    const startedEvent = service.getAuditEvents()[0];

    expect(payload.collaborationRunId).toBe('collab-canary-01');
    expect(payload.referralTraceId).toBe(referral.referralTraceId);
    expect(payload.referralId).toBe(referral.referralId);
    expect(payload.parentReferralTraceId).toBe(referral.parentReferralTraceId);
    expect(payload.referringBuilderProfileId).toBe('builder-source-01');
    expect(payload.builderProfileId).toBe('builder-target-01');
    expect(payload.agentRole).toBe('chief-of-staff');
    expect(payload.userId).toBe('user-canary-01');
    expect(payload.sessionId).toBe('session-canary-01');
    expect(payload.executionId).toBe('exec-canary-meta-01');
    expect(payload.isReferralExecution).toBe(true);
    expect(startedEvent?.payload.userId).toBe('user-canary-01');
    expect(startedEvent?.payload.projectId).toBe('project-canary-01');
    expect(startedEvent?.payload.sessionId).toBe('session-canary-01');
    expect(startedEvent?.payload.executionId).toBe('exec-canary-meta-01');
  });

  it('6) verifies key audit events sequence for create/start/complete lifecycle', async () => {
    createRun();
    const referral = createReferral();
    service.clearAuditEvents();

    await service.startReferralExecution(baseExecutionInput(referral.referralId, 'exec-canary-audit-01'));
    service.completeReferral({
      referralId: referral.referralId,
      summary: 'referral complete',
      durationMs: 88,
    });
    const eventTypes = service.getAuditEvents().map((event) => event.eventType);

    expect(eventTypes).toEqual([
      'orchestration.referral_started',
      'orchestration.referral_completed',
    ]);
  });

  it('7) completes referral and emits referral_completed audit marker', async () => {
    createRun();
    const referral = createReferral();
    await service.startReferralExecution(baseExecutionInput(referral.referralId, 'exec-canary-complete-01'));
    service.clearAuditEvents();

    const completed = service.completeReferral({
      referralId: referral.referralId,
      summary: 'canary completion',
      outputFiles: ['report.md'],
      durationMs: 120,
    });
    const events = service.getAuditEvents();

    expect(completed.status).toBe('completed');
    expect(completed.result?.status).toBe('success');
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('orchestration.referral_completed');
    expect(events[0]?.payload.lifecycleEvent).toBe('referral_completed');
    expect(events[0]?.payload.executionId).toBe('exec-canary-complete-01');
  });

  it('8) detects duplicate referral via idempotency key and emits duplicate lifecycle marker', () => {
    createRun();
    const first = createReferral({
      referralId: 'ref-dup-01',
      referralTraceId: 'trace-dup-01',
      idempotencyKey: 'idem-dup-01',
    });
    service.clearAuditEvents();

    const duplicate = createReferral({
      referralId: 'ref-dup-02',
      referralTraceId: 'trace-dup-02',
      idempotencyKey: 'idem-dup-01',
    });
    const events = service.getAuditEvents();

    expect(duplicate.referralId).toBe(first.referralId);
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('orchestration.referral_created');
    expect(events[0]?.payload.lifecycleEvent).toBe('referral_duplicate_detected');
    expect(events[0]?.payload.result).toBe('duplicate');
  });

  it('9) cancels referral through mocked requestCancel with correct executionId', async () => {
    createRun();
    const referral = createReferral();
    await service.startReferralExecution(baseExecutionInput(referral.referralId, 'exec-cancel-01'));
    service.clearAuditEvents();

    const cancelled = await service.cancelReferral({
      referralId: referral.referralId,
      cancelledByUserId: 'user-canary-01',
      cancelReason: 'canary referral cancel',
    });
    const events = service.getAuditEvents();

    expect(mockExecutionResultService.requestCancel).toHaveBeenCalledTimes(1);
    expect(mockExecutionResultService.requestCancel).toHaveBeenCalledWith('exec-cancel-01');
    expect(cancelled.status).toBe('cancelled');
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('orchestration.referral_cancelled');
    expect(events[0]?.payload.lifecycleEvent).toBe('referral_cancelled');
    expect(events[0]?.payload.executionId).toBe('exec-cancel-01');
  });

  it('10) cancels collaboration and emits collaboration_cancelled with affected referrals', async () => {
    createRun();
    const referralOne = createReferral({
      referralId: 'ref-cancel-collab-01',
      referralTraceId: 'trace-cancel-collab-01',
      idempotencyKey: 'idem-cancel-collab-01',
    });
    const referralTwo = createReferral({
      referralId: 'ref-cancel-collab-02',
      referralTraceId: 'trace-cancel-collab-02',
      idempotencyKey: 'idem-cancel-collab-02',
      targetBuilderProfileId: 'builder-target-02',
      targetAgentRole: 'product-strategy',
    });
    await service.startReferralExecution(
      baseExecutionInput(referralOne.referralId, 'exec-cancel-collab-01'),
    );
    service.clearAuditEvents();

    const cancelledRun = await service.cancelCollaboration({
      collaborationRunId: 'collab-canary-01',
      cancelledByUserId: 'user-canary-01',
      cancelReason: 'canary collaboration cancel',
    });
    const events = service.getAuditEvents();
    const collaborationEvent = events.find(
      (event) => event.eventType === 'orchestration.collaboration_cancelled',
    );

    expect(cancelledRun.status).toBe('cancelled');
    expect(service.getReferral(referralOne.referralId)?.status).toBe('cancelled');
    expect(service.getReferral(referralTwo.referralId)?.status).toBe('cancelled');
    expect(collaborationEvent).toBeDefined();
    expect(collaborationEvent?.payload.lifecycleEvent).toBe('collaboration_cancelled');
    expect(collaborationEvent?.payload.affectedReferralIds).toEqual(
      expect.arrayContaining([referralOne.referralId, referralTwo.referralId]),
    );
  });

  it('11) enforces depth safety limit and emits limitType depth', () => {
    createRun();
    service.clearAuditEvents();

    expect(() =>
      service.validateReferral({
        collaborationRunId: 'collab-canary-01',
        sourceBuilderProfileId: 'builder-source-01',
        targetBuilderProfileId: 'builder-target-depth',
        idempotencyKey: 'idem-depth-01',
        depth: DEFAULT_MAX_REFERRAL_DEPTH,
      }),
    ).toThrow(/exceeds max depth/i);

    const events = service.getAuditEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('orchestration.safety_limit_breached');
    expect(events[0]?.payload.limitType).toBe('depth');
  });

  it('12) enforces loop safety limit and emits limitType loop', () => {
    createRun();
    service.clearAuditEvents();

    expect(() =>
      service.validateReferral({
        collaborationRunId: 'collab-canary-01',
        sourceBuilderProfileId: 'builder-source-01',
        targetBuilderProfileId: 'builder-source-01',
        idempotencyKey: 'idem-loop-01',
        visitedBuilderProfileIds: ['builder-source-01'],
      }),
    ).toThrow(/loop detected/i);

    const events = service.getAuditEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('orchestration.safety_limit_breached');
    expect(events[0]?.payload.limitType).toBe('loop');
  });

  it('13) enforces agent-limit safety and emits limitType agent_limit', () => {
    createRun();
    createReferral({
      referralId: 'ref-agent-limit-01',
      idempotencyKey: 'idem-agent-limit-01',
      targetBuilderProfileId: 'builder-target-01',
      targetAgentRole: 'chief-of-staff',
    });
    createReferral({
      referralId: 'ref-agent-limit-02',
      idempotencyKey: 'idem-agent-limit-02',
      targetBuilderProfileId: 'builder-target-02',
      targetAgentRole: 'product-strategy',
    });
    createReferral({
      referralId: 'ref-agent-limit-03',
      idempotencyKey: 'idem-agent-limit-03',
      targetBuilderProfileId: 'builder-target-03',
      targetAgentRole: 'technology-advisor',
    });
    service.clearAuditEvents();

    expect(() =>
      service.validateReferral({
        collaborationRunId: 'collab-canary-01',
        sourceBuilderProfileId: 'builder-target-03',
        targetBuilderProfileId: 'builder-target-04',
        idempotencyKey: 'idem-agent-limit-04',
      }),
    ).toThrow(/max agents/i);

    const events = service.getAuditEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('orchestration.safety_limit_breached');
    expect(events[0]?.payload.limitType).toBe('agent_limit');
  });

  it('14) enforces blocked write tools / no-write policy', () => {
    createRun();
    const referral = createReferral();

    expect(referral.constraints.readOnly).toBe(true);
    expect(referral.constraints.allowWriteTools).toBe(false);
    expect(referral.constraints.allowedTools).toEqual([...READ_ONLY_ALLOWED_TOOL_IDS]);
    expect(referral.constraints.allowedTools).not.toEqual(
      expect.arrayContaining([...READ_ONLY_BLOCKED_TOOL_IDS]),
    );

    expect(() =>
      service.createReferral({
        referralId: 'ref-blocked-write-01',
        collaborationRunId: 'collab-canary-01',
        sourceBuilder: {
          agentRole: 'builder',
          builderProfileId: 'builder-source-01',
        },
        targetBuilder: {
          agentRole: 'chief-of-staff',
          builderProfileId: 'builder-target-blocked',
        },
        idempotencyKey: 'idem-blocked-write-01',
        constraints: {
          readOnly: true,
          allowWriteTools: false,
          allowedTools: ['list_files', 'write_file'],
        },
      }),
    ).toThrow(/blocked write-capable tools/i);
  });

  it('15) confirms AGENT-HARNESS write canary is not involved in this in-process canary', async () => {
    createRun();
    const referral = createReferral({
      referralId: 'ref-no-harness-write-01',
      referralTraceId: 'trace-no-harness-write-01',
      idempotencyKey: 'idem-no-harness-write-01',
    });
    await service.startReferralExecution(
      baseExecutionInput(referral.referralId, 'exec-no-harness-write-01'),
    );
    const policy = service.getReadOnlyPolicy();
    const payload = mockQueueService.enqueueExecution.mock.calls[0]?.[0];

    expect(policy.blockedToolIds).toEqual([...READ_ONLY_BLOCKED_TOOL_IDS]);
    expect(policy.allowedToolIds).toEqual([...READ_ONLY_ALLOWED_TOOL_IDS]);
    expect(payload.isReferralExecution).toBe(true);
    expect(payload.fileActions).toBeUndefined();
    expect(payload.toolCalls).toBeUndefined();
    expect(payload.enableWriteTools).toBeUndefined();
  });

  it('safely includes referral_failed audit marker verification', async () => {
    createRun();
    const referral = createReferral({
      referralId: 'ref-fail-01',
      referralTraceId: 'trace-fail-01',
      idempotencyKey: 'idem-fail-01',
    });
    await service.startReferralExecution(baseExecutionInput(referral.referralId, 'exec-fail-01'));
    service.clearAuditEvents();

    service.failReferral({
      referralId: referral.referralId,
      summary: 'canary failure path',
      durationMs: 32,
    });
    const events = service.getAuditEvents();

    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('orchestration.referral_failed');
    expect(events[0]?.payload.lifecycleEvent).toBe('referral_failed');
    expect(events[0]?.payload.executionId).toBe('exec-fail-01');
  });
});
