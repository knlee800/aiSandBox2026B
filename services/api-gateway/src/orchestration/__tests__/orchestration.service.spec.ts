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

describe('OrchestrationService', () => {
  let service: OrchestrationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrchestrationService],
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
