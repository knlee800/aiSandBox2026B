import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { QueueService } from '../queue/queue.service';
import { ExecutionResultService } from '../ai/execution-result.service';
import {
  InMemoryOrchestrationAuditRecorder,
  type OrchestrationAuditRecorder,
} from './orchestration-audit.recorder';
import { CollaborationRunEntity } from './collaboration-run.entity';
import { CollaborationReferralEntity } from './collaboration-referral.entity';
import {
  type OrchestrationAuditEvent,
  type OrchestrationAuditEventType,
  type BuilderProfileId,
  type CollaborationAgentIdentity,
  type CollaborationReferral,
  type CollaborationRun,
  type CollaborationRunId,
  DEFAULT_MAX_AGENTS_PER_COLLABORATION,
  DEFAULT_MAX_REFERRAL_DEPTH,
  type IdempotencyKey,
  NO_WRITE_TOOLS_INDICATOR,
  type ReferralId,
  READ_ONLY_ALLOWED_TOOL_IDS,
  READ_ONLY_BLOCKED_TOOL_IDS,
  READ_ONLY_MODE_INDICATOR,
  type ReferralResult,
  type ReferralStatus,
  type ReferralTraceId,
  type SourceBuilderIdentity,
  type TargetBuilderIdentity,
  type UserId,
  type ProjectId,
  type ReferralConstraints,
} from './orchestration.contracts';

const DEFAULT_REFERRAL_TIMEOUT_MS = 300_000;
const IDEMPOTENCY_REPLAY_STATUSES: readonly ReferralStatus[] = [
  'failed',
  'cancelled',
  'timed_out',
];

export interface ReadOnlyPolicy {
  readonly mode: typeof READ_ONLY_MODE_INDICATOR;
  readonly noWriteIndicator: typeof NO_WRITE_TOOLS_INDICATOR;
  readonly readOnly: true;
  readonly allowWriteTools: false;
  readonly allowedToolIds: readonly string[];
  readonly blockedToolIds: readonly string[];
}

export interface CreateCollaborationRunInput {
  readonly collaborationRunId?: CollaborationRunId;
  readonly userId: UserId;
  readonly projectId: ProjectId;
  readonly initiatorAgent: CollaborationAgentIdentity;
  readonly timeoutMs?: number;
}

export interface CreateReferralInput {
  readonly referralId?: ReferralId;
  readonly referralTraceId?: ReferralTraceId;
  readonly collaborationRunId: CollaborationRunId;
  readonly parentReferralTraceId?: ReferralTraceId | null;
  readonly sourceBuilder: SourceBuilderIdentity;
  readonly targetBuilder: TargetBuilderIdentity;
  readonly idempotencyKey: IdempotencyKey;
  readonly constraints?: Partial<ReferralConstraints>;
  readonly referralChain?: readonly BuilderProfileId[];
  readonly depth?: number;
  readonly maxDepth?: number;
  readonly visitedBuilderProfileIds?: readonly BuilderProfileId[];
  readonly timeoutMs?: number;
}

export interface CompleteReferralInput {
  readonly referralId: ReferralId;
  readonly status?: ReferralResult['status'];
  readonly summary: string;
  readonly outputFiles?: readonly string[];
  readonly durationMs?: number;
}

export interface FailReferralInput {
  readonly referralId: ReferralId;
  readonly summary: string;
  readonly outputFiles?: readonly string[];
  readonly durationMs?: number;
}

export interface ValidateReferralInput {
  readonly collaborationRunId: CollaborationRunId;
  readonly sourceBuilderProfileId: BuilderProfileId;
  readonly targetBuilderProfileId: BuilderProfileId;
  readonly idempotencyKey: IdempotencyKey;
  readonly constraints?: Partial<ReferralConstraints>;
  readonly depth?: number;
  readonly maxDepth?: number;
  readonly visitedBuilderProfileIds?: readonly BuilderProfileId[];
}

export type ValidateReferralResult =
  | { readonly outcome: 'valid' }
  | {
      readonly outcome: 'duplicate';
      readonly referral: CollaborationReferral;
    };

export interface StartReferralExecutionInput {
  readonly referralId: ReferralId;
  readonly executionId: string;
  readonly sessionId: string;
  readonly conversationId: string;
  readonly userId: string;
  readonly apiKeyId: string;
  readonly prompt: string;
  readonly workspaceContext?: unknown;
  readonly provider: string;
  readonly adapter: string;
  readonly model?: string;
  readonly harnessVersion?: string;
  readonly globalInstructions?: string;
  readonly projectInstructions?: string;
  readonly submittedAt: string;
  readonly orchestrationPriority?: number;
}

export interface CancelReferralInput {
  readonly referralId: ReferralId;
  readonly cancelledByUserId: UserId;
  readonly cancelReason: string;
}

export interface CancelCollaborationInput {
  readonly collaborationRunId: CollaborationRunId;
  readonly cancelledByUserId: UserId;
  readonly cancelReason: string;
}

@Injectable()
export class OrchestrationService {
  private readonly auditRecorder: OrchestrationAuditRecorder;

  constructor(
    @InjectRepository(CollaborationRunEntity)
    private readonly runRepo: Repository<CollaborationRunEntity>,
    @InjectRepository(CollaborationReferralEntity)
    private readonly referralRepo: Repository<CollaborationReferralEntity>,
    @Optional() private readonly queueService?: QueueService,
    @Optional() private readonly executionResultService?: ExecutionResultService,
    @Optional() auditRecorder?: InMemoryOrchestrationAuditRecorder,
  ) {
    this.auditRecorder = auditRecorder ?? new InMemoryOrchestrationAuditRecorder();
  }

  private readonly defaultReferralConstraints: ReferralConstraints = {
    timeoutMs: DEFAULT_REFERRAL_TIMEOUT_MS,
    maxDepth: DEFAULT_MAX_REFERRAL_DEPTH,
    maxAgentsPerCollaboration: DEFAULT_MAX_AGENTS_PER_COLLABORATION,
    readOnly: true,
    allowWriteTools: false,
    allowedTools: [...READ_ONLY_ALLOWED_TOOL_IDS],
  };

  getDefaultReferralConstraints(): ReferralConstraints {
    return {
      ...this.defaultReferralConstraints,
      allowedTools: [...this.defaultReferralConstraints.allowedTools],
    };
  }

  getReadOnlyPolicy(): ReadOnlyPolicy {
    return {
      mode: READ_ONLY_MODE_INDICATOR,
      noWriteIndicator: NO_WRITE_TOOLS_INDICATOR,
      readOnly: true,
      allowWriteTools: false,
      allowedToolIds: [...READ_ONLY_ALLOWED_TOOL_IDS],
      blockedToolIds: [...READ_ONLY_BLOCKED_TOOL_IDS],
    };
  }

  getAuditEvents(): readonly OrchestrationAuditEvent[] {
    return this.auditRecorder.getEvents();
  }

  clearAuditEvents(): void {
    this.auditRecorder.clear();
  }

  async createCollaborationRun(
    input: CreateCollaborationRunInput,
  ): Promise<CollaborationRun> {
    const collaborationRunId =
      input.collaborationRunId && input.collaborationRunId.trim().length > 0
        ? input.collaborationRunId
        : this.generateId('collab');

    const existing = await this.runRepo.findOne({
      where: { collaborationRunId },
    });
    if (existing) {
      return this.toCollaborationRun(existing);
    }

    const now = new Date();
    const entity = this.fromCreateRunInput(input, collaborationRunId, now);
    const saved = await this.runRepo.save(entity);
    const run = this.toCollaborationRun(saved);
    this.emitAuditEvent({
      eventType: 'orchestration.collaboration_created',
      collaborationRunId: run.collaborationRunId,
      referralTraceId: null,
      sourceBuilder: run.initiatorAgent,
      targetBuilder: null,
      payload: {
        lifecycleEvent: 'collaboration_started',
        userId: run.userId,
        projectId: run.projectId,
        status: run.status,
        sourceBuilderProfileId: run.initiatorAgent.builderProfileId,
        sourceAgentRole: run.initiatorAgent.agentRole,
      },
    });

    return run;
  }

  async getCollaborationRun(
    collaborationRunId: CollaborationRunId,
  ): Promise<CollaborationRun | null> {
    const entity = await this.runRepo.findOne({
      where: { collaborationRunId },
    });
    if (!entity) {
      return null;
    }

    return this.toCollaborationRun(entity);
  }

  async createReferral(input: CreateReferralInput): Promise<CollaborationReferral> {
    return this.runInTransaction(async (runRepo, referralRepo) => {
      const validation = await this.validateReferralWithRepos(
        runRepo,
        referralRepo,
        {
          collaborationRunId: input.collaborationRunId,
          sourceBuilderProfileId: input.sourceBuilder.builderProfileId,
          targetBuilderProfileId: input.targetBuilder.builderProfileId,
          idempotencyKey: input.idempotencyKey,
          constraints: input.constraints,
          depth: input.depth,
          maxDepth: input.maxDepth,
          visitedBuilderProfileIds: input.visitedBuilderProfileIds,
        },
      );

      if (validation.outcome === 'duplicate') {
        const runEntity = await this.requireRunEntity(
          runRepo,
          input.collaborationRunId,
        );
        const run = this.toCollaborationRun(runEntity);
        this.emitAuditEvent({
          // The current 07A union has no dedicated duplicate type member.
          // Keep contract compatibility and mark duplicate lifecycle in payload.
          eventType: 'orchestration.referral_created',
          collaborationRunId: validation.referral.collaborationRunId,
          referralTraceId: validation.referral.referralTraceId,
          sourceBuilder: validation.referral.sourceBuilder,
          targetBuilder: validation.referral.targetBuilder,
          payload: {
            lifecycleEvent: 'referral_duplicate_detected',
            result: 'duplicate',
            referralId: validation.referral.referralId,
            parentReferralTraceId: validation.referral.parentReferralTraceId,
            idempotencyKey: validation.referral.idempotencyKey,
            userId: run.userId,
            projectId: run.projectId,
            sourceBuilderProfileId: validation.referral.sourceBuilder.builderProfileId,
            sourceAgentRole: validation.referral.sourceBuilder.agentRole,
            targetBuilderProfileId: validation.referral.targetBuilder.builderProfileId,
            targetAgentRole: validation.referral.targetBuilder.agentRole,
          },
        });
        return validation.referral;
      }

      const runEntity = await this.requireRunEntity(
        runRepo,
        input.collaborationRunId,
      );
      const run = this.toCollaborationRun(runEntity);
      const resolvedConstraints = this.resolveConstraints(input.constraints);
      const depth = input.depth ?? 0;

      const baseChain =
        input.referralChain && input.referralChain.length > 0
          ? [...input.referralChain]
          : [input.sourceBuilder.builderProfileId];
      if (baseChain[baseChain.length - 1] !== input.targetBuilder.builderProfileId) {
        baseChain.push(input.targetBuilder.builderProfileId);
      }

      const visited = this.uniqueBuilderIds([
        ...(input.visitedBuilderProfileIds ?? []),
        input.sourceBuilder.builderProfileId,
        input.targetBuilder.builderProfileId,
      ]);

      const referralId =
        input.referralId && input.referralId.trim().length > 0
          ? input.referralId
          : this.generateId('ref');
      const referralTraceId =
        input.referralTraceId && input.referralTraceId.trim().length > 0
          ? input.referralTraceId
          : this.generateId('trace');
      const now = new Date();

      const referralEntity = this.fromCreateReferralInput(
        input,
        {
          referralId,
          referralTraceId,
          depth,
          visited,
          referralChain: baseChain,
          resolvedConstraints,
          now,
        },
      );
      const savedReferral = await referralRepo.save(referralEntity);

      const nextActiveBuilderIds = this.uniqueBuilderIds([
        ...run.activeBuilderProfileIds,
        input.sourceBuilder.builderProfileId,
        input.targetBuilder.builderProfileId,
      ]);
      runEntity.referralIds = [...run.referralIds, savedReferral.referralId];
      runEntity.activeBuilderProfileIds = nextActiveBuilderIds;
      runEntity.updatedAt = now;
      await runRepo.save(runEntity);

      const referral = this.toReferral(savedReferral);
      this.emitAuditEvent({
        eventType: 'orchestration.referral_created',
        collaborationRunId: referral.collaborationRunId,
        referralTraceId: referral.referralTraceId,
        sourceBuilder: referral.sourceBuilder,
        targetBuilder: referral.targetBuilder,
        payload: {
          lifecycleEvent: 'referral_created',
          status: referral.status,
          referralId: referral.referralId,
          parentReferralTraceId: referral.parentReferralTraceId,
          idempotencyKey: referral.idempotencyKey,
          userId: run.userId,
          projectId: run.projectId,
          sourceBuilderProfileId: referral.sourceBuilder.builderProfileId,
          sourceAgentRole: referral.sourceBuilder.agentRole,
          targetBuilderProfileId: referral.targetBuilder.builderProfileId,
          targetAgentRole: referral.targetBuilder.agentRole,
        },
      });

      return referral;
    });
  }

  async getReferral(referralId: ReferralId): Promise<CollaborationReferral | null> {
    const entity = await this.referralRepo.findOne({
      where: { referralId },
    });
    if (!entity) {
      return null;
    }

    return this.toReferral(entity);
  }

  async completeReferral(
    input: CompleteReferralInput,
  ): Promise<CollaborationReferral> {
    return this.runInTransaction(async (runRepo, referralRepo) => {
      const referralEntity = await this.requireReferralEntity(
        referralRepo,
        input.referralId,
      );
      if (referralEntity.status === 'completed') {
        return this.toReferral(referralEntity);
      }

      this.assertCanFinalizeReferral(this.toReferral(referralEntity));

      const completedAt = new Date();
      referralEntity.status = 'completed';
      referralEntity.resultStatus = input.status ?? 'success';
      referralEntity.resultSummary = input.summary;
      referralEntity.resultOutputFiles = [...(input.outputFiles ?? [])];
      referralEntity.resultDurationMs = input.durationMs ?? 0;
      referralEntity.completedAt = completedAt;
      referralEntity.updatedAt = completedAt;
      const saved = await referralRepo.save(referralEntity);
      const updated = this.toReferral(saved);
      const runEntity = await this.requireRunEntity(
        runRepo,
        updated.collaborationRunId,
      );
      const run = this.toCollaborationRun(runEntity);
      this.emitAuditEvent({
        eventType: 'orchestration.referral_completed',
        collaborationRunId: updated.collaborationRunId,
        referralTraceId: updated.referralTraceId,
        sourceBuilder: updated.sourceBuilder,
        targetBuilder: updated.targetBuilder,
        payload: {
          lifecycleEvent: 'referral_completed',
          status: updated.status,
          resultStatus: updated.result?.status,
          referralId: updated.referralId,
          executionId: saved.executionId ?? null,
          userId: run.userId,
          projectId: run.projectId,
          sourceBuilderProfileId: updated.sourceBuilder.builderProfileId,
          sourceAgentRole: updated.sourceBuilder.agentRole,
          targetBuilderProfileId: updated.targetBuilder.builderProfileId,
          targetAgentRole: updated.targetBuilder.agentRole,
        },
      });

      return updated;
    });
  }

  async failReferral(input: FailReferralInput): Promise<CollaborationReferral> {
    return this.runInTransaction(async (runRepo, referralRepo) => {
      const referralEntity = await this.requireReferralEntity(
        referralRepo,
        input.referralId,
      );
      if (referralEntity.status === 'failed') {
        return this.toReferral(referralEntity);
      }

      this.assertCanFinalizeReferral(this.toReferral(referralEntity));

      const failedAt = new Date();
      referralEntity.status = 'failed';
      referralEntity.resultStatus = 'failed';
      referralEntity.resultSummary = input.summary;
      referralEntity.resultOutputFiles = [...(input.outputFiles ?? [])];
      referralEntity.resultDurationMs = input.durationMs ?? 0;
      referralEntity.failedAt = failedAt;
      referralEntity.updatedAt = failedAt;
      const saved = await referralRepo.save(referralEntity);
      const updated = this.toReferral(saved);
      const runEntity = await this.requireRunEntity(
        runRepo,
        updated.collaborationRunId,
      );
      const run = this.toCollaborationRun(runEntity);
      this.emitAuditEvent({
        eventType: 'orchestration.referral_failed',
        collaborationRunId: updated.collaborationRunId,
        referralTraceId: updated.referralTraceId,
        sourceBuilder: updated.sourceBuilder,
        targetBuilder: updated.targetBuilder,
        payload: {
          lifecycleEvent: 'referral_failed',
          status: updated.status,
          resultStatus: updated.result?.status,
          summary: input.summary,
          referralId: updated.referralId,
          executionId: saved.executionId ?? null,
          userId: run.userId,
          projectId: run.projectId,
          sourceBuilderProfileId: updated.sourceBuilder.builderProfileId,
          sourceAgentRole: updated.sourceBuilder.agentRole,
          targetBuilderProfileId: updated.targetBuilder.builderProfileId,
          targetAgentRole: updated.targetBuilder.agentRole,
        },
      });

      return updated;
    });
  }

  async validateReferral(
    input: ValidateReferralInput,
  ): Promise<ValidateReferralResult> {
    return this.validateReferralWithRepos(this.runRepo, this.referralRepo, input);
  }

  async startReferralExecution(
    input: StartReferralExecutionInput,
  ): Promise<{ executionId: string }> {
    if (!this.queueService) {
      throw new Error('QueueService is required for referral execution');
    }

    const jobPayload = await this.runInTransaction(
      async (_runRepo, referralRepo) => {
        const referralEntity = await this.requireReferralEntity(
          referralRepo,
          input.referralId,
        );
        const referral = this.toReferral(referralEntity);
        this.assertCanStartExecution(referral);
        this.assertReadOnlyConstraints(referral);

        const now = new Date();
        const payload = {
          executionId: input.executionId,
          userId: input.userId,
          apiKeyId: input.apiKeyId,
          sessionId: input.sessionId,
          conversationId: input.conversationId,
          provider: input.provider,
          adapter: input.adapter,
          prompt: input.prompt,
          workspaceContext: input.workspaceContext,
          globalInstructions: input.globalInstructions,
          projectInstructions: input.projectInstructions,
          model: input.model,
          submittedAt: input.submittedAt,
          agentRole: referral.targetBuilder.agentRole,
          builderProfileId: referral.targetBuilder.builderProfileId,
          collaborationRunId: referral.collaborationRunId,
          referralTraceId: referral.referralTraceId,
          parentReferralTraceId: referral.parentReferralTraceId ?? undefined,
          referringBuilderProfileId: referral.sourceBuilder.builderProfileId,
          referralId: referral.referralId,
          isReferralExecution: true,
          orchestrationPriority: input.orchestrationPriority,
        };

        referralEntity.executionId = input.executionId;
        referralEntity.status = 'in_progress';
        referralEntity.updatedAt = now;
        await referralRepo.save(referralEntity);

        return payload;
      },
    );

    await this.queueService.enqueueExecution(jobPayload);
    const updatedEntity = await this.referralRepo.findOne({
      where: { referralId: input.referralId },
    });
    if (!updatedEntity) {
      throw new Error(`Referral ${input.referralId} not found`);
    }
    const updated = this.toReferral(updatedEntity);
    const runEntity = await this.requireRunEntity(
      this.runRepo,
      updated.collaborationRunId,
    );
    const run = this.toCollaborationRun(runEntity);
    this.emitAuditEvent({
      eventType: 'orchestration.referral_started',
      collaborationRunId: updated.collaborationRunId,
      referralTraceId: updated.referralTraceId,
      sourceBuilder: updated.sourceBuilder,
      targetBuilder: updated.targetBuilder,
      payload: {
        lifecycleEvent: 'referral_started',
        transitionDetail: 'referral_enqueued',
        status: updated.status,
        referralId: updated.referralId,
        parentReferralTraceId: updated.parentReferralTraceId,
        executionId: input.executionId,
        sessionId: input.sessionId,
        userId: run.userId,
        projectId: run.projectId,
        sourceBuilderProfileId: updated.sourceBuilder.builderProfileId,
        sourceAgentRole: updated.sourceBuilder.agentRole,
        targetBuilderProfileId: updated.targetBuilder.builderProfileId,
        targetAgentRole: updated.targetBuilder.agentRole,
      },
    });

    return { executionId: input.executionId };
  }

  async cancelReferral(input: CancelReferralInput): Promise<CollaborationReferral> {
    return this.runInTransaction(async (runRepo, referralRepo) => {
      const referralEntity = await this.requireReferralEntity(
        referralRepo,
        input.referralId,
      );
      const runEntity = await this.requireRunEntity(
        runRepo,
        referralEntity.collaborationRunId,
      );
      return this.cancelReferralEntity(referralRepo, referralEntity, runEntity, input);
    });
  }

  async cancelCollaboration(
    input: CancelCollaborationInput,
  ): Promise<CollaborationRun> {
    return this.runInTransaction(async (runRepo, referralRepo) => {
      const runEntity = await this.requireRunEntity(
        runRepo,
        input.collaborationRunId,
      );
      const run = this.toCollaborationRun(runEntity);

      if (run.userId !== input.cancelledByUserId) {
        throw new Error(
          `User ${input.cancelledByUserId} is not authorized to cancel collaboration ${input.collaborationRunId}`,
        );
      }

      const activeStatuses: readonly ReferralStatus[] = [
        'pending_approval',
        'approved',
        'in_progress',
      ];
      const affectedReferralIds: ReferralId[] = [];

      for (const referralId of run.referralIds) {
        const referralEntity = await referralRepo.findOne({
          where: { referralId },
        });
        if (referralEntity && activeStatuses.includes(referralEntity.status)) {
          affectedReferralIds.push(referralId);
          await this.cancelReferralEntity(referralRepo, referralEntity, runEntity, {
            referralId,
            cancelledByUserId: input.cancelledByUserId,
            cancelReason: input.cancelReason,
          });
        }
      }

      const now = new Date();
      runEntity.status = 'cancelled';
      runEntity.cancelRequestedAt = now;
      runEntity.cancelledByUserId = input.cancelledByUserId;
      runEntity.cancelReason = input.cancelReason;
      runEntity.updatedAt = now;
      const savedRun = await runRepo.save(runEntity);
      const updatedRun = this.toCollaborationRun(savedRun);
      this.emitAuditEvent({
        eventType: 'orchestration.collaboration_cancelled',
        collaborationRunId: updatedRun.collaborationRunId,
        referralTraceId: null,
        sourceBuilder: updatedRun.initiatorAgent,
        targetBuilder: null,
        payload: {
          lifecycleEvent: 'collaboration_cancelled',
          status: updatedRun.status,
          userId: updatedRun.userId,
          projectId: updatedRun.projectId,
          cancelledByUserId: input.cancelledByUserId,
          reason: input.cancelReason,
          affectedReferralIds,
          sourceBuilderProfileId: updatedRun.initiatorAgent.builderProfileId,
          sourceAgentRole: updatedRun.initiatorAgent.agentRole,
        },
      });

      return updatedRun;
    });
  }

  private async cancelReferralEntity(
    referralRepo: Repository<CollaborationReferralEntity>,
    referralEntity: CollaborationReferralEntity,
    runEntity: CollaborationRunEntity,
    input: CancelReferralInput,
  ): Promise<CollaborationReferral> {
    const run = this.toCollaborationRun(runEntity);
    const referral = this.toReferral(referralEntity);

    if (run.userId !== input.cancelledByUserId) {
      throw new Error(
        `User ${input.cancelledByUserId} is not authorized to cancel referral ${input.referralId}`,
      );
    }

    const terminalStatuses: readonly ReferralStatus[] = [
      'completed',
      'failed',
      'cancelled',
      'timed_out',
      'rejected',
    ];
    if (terminalStatuses.includes(referral.status)) {
      return referral;
    }

    const executionId = referralEntity.executionId;
    if (executionId && this.executionResultService) {
      await this.executionResultService.requestCancel(executionId);
    }

    const now = new Date();
    referralEntity.status = 'cancelled';
    referralEntity.cancelStatus = 'cancelled';
    referralEntity.cancelRequestedAt = now;
    referralEntity.cancelledByUserId = input.cancelledByUserId;
    referralEntity.cancelReason = input.cancelReason;
    referralEntity.updatedAt = now;
    const saved = await referralRepo.save(referralEntity);
    const updated = this.toReferral(saved);
    this.emitAuditEvent({
      eventType: 'orchestration.referral_cancelled',
      collaborationRunId: updated.collaborationRunId,
      referralTraceId: updated.referralTraceId,
      sourceBuilder: updated.sourceBuilder,
      targetBuilder: updated.targetBuilder,
      payload: {
        lifecycleEvent: 'referral_cancelled',
        status: updated.status,
        referralId: updated.referralId,
        executionId: executionId ?? null,
        reason: input.cancelReason,
        cancelledByUserId: input.cancelledByUserId,
        userId: run.userId,
        projectId: run.projectId,
        sourceBuilderProfileId: updated.sourceBuilder.builderProfileId,
        sourceAgentRole: updated.sourceBuilder.agentRole,
        targetBuilderProfileId: updated.targetBuilder.builderProfileId,
        targetAgentRole: updated.targetBuilder.agentRole,
      },
    });

    return updated;
  }

  private async validateReferralWithRepos(
    runRepo: Repository<CollaborationRunEntity>,
    referralRepo: Repository<CollaborationReferralEntity>,
    input: ValidateReferralInput,
  ): Promise<ValidateReferralResult> {
    const runEntity = await this.requireRunEntity(
      runRepo,
      input.collaborationRunId,
    );
    const run = this.toCollaborationRun(runEntity);
    const resolvedConstraints = this.resolveConstraints(input.constraints);
    const maxDepth = input.maxDepth ?? resolvedConstraints.maxDepth;
    const depth = input.depth ?? 0;

    if (depth >= maxDepth) {
      const sourceBuilder = await this.resolveBuilderIdentity(
        referralRepo,
        run,
        input.sourceBuilderProfileId,
      );
      const targetBuilder = await this.resolveBuilderIdentity(
        referralRepo,
        run,
        input.targetBuilderProfileId,
      );
      this.emitAuditEvent({
        eventType: 'orchestration.safety_limit_breached',
        collaborationRunId: input.collaborationRunId,
        referralTraceId: null,
        sourceBuilder,
        targetBuilder,
        payload: {
          lifecycleEvent: 'referral_depth_blocked',
          limitType: 'depth',
          currentValue: depth,
          maxValue: maxDepth,
          reason: 'referral_depth_exceeds_max_depth',
          userId: run.userId,
          projectId: run.projectId,
          sourceBuilderProfileId: input.sourceBuilderProfileId,
          targetBuilderProfileId: input.targetBuilderProfileId,
        },
      });
      throw new Error(
        `Referral depth ${depth} exceeds max depth ${maxDepth} for collaboration ${input.collaborationRunId}`,
      );
    }

    const visitedBuilderProfileIds = new Set(input.visitedBuilderProfileIds ?? []);
    if (visitedBuilderProfileIds.has(input.targetBuilderProfileId)) {
      const sourceBuilder = await this.resolveBuilderIdentity(
        referralRepo,
        run,
        input.sourceBuilderProfileId,
      );
      const targetBuilder = await this.resolveBuilderIdentity(
        referralRepo,
        run,
        input.targetBuilderProfileId,
      );
      this.emitAuditEvent({
        eventType: 'orchestration.safety_limit_breached',
        collaborationRunId: input.collaborationRunId,
        referralTraceId: null,
        sourceBuilder,
        targetBuilder,
        payload: {
          lifecycleEvent: 'referral_loop_blocked',
          limitType: 'loop',
          currentValue: visitedBuilderProfileIds.size,
          maxValue: visitedBuilderProfileIds.size,
          reason: 'referral_loop_detected',
          userId: run.userId,
          projectId: run.projectId,
          sourceBuilderProfileId: input.sourceBuilderProfileId,
          targetBuilderProfileId: input.targetBuilderProfileId,
        },
      });
      throw new Error(
        `Referral loop detected for builder ${input.targetBuilderProfileId} in collaboration ${input.collaborationRunId}`,
      );
    }

    const projectedAgentCount = this.uniqueBuilderIds([
      ...run.activeBuilderProfileIds,
      input.sourceBuilderProfileId,
      input.targetBuilderProfileId,
    ]).length;
    if (projectedAgentCount > resolvedConstraints.maxAgentsPerCollaboration) {
      const sourceBuilder = await this.resolveBuilderIdentity(
        referralRepo,
        run,
        input.sourceBuilderProfileId,
      );
      const targetBuilder = await this.resolveBuilderIdentity(
        referralRepo,
        run,
        input.targetBuilderProfileId,
      );
      this.emitAuditEvent({
        eventType: 'orchestration.safety_limit_breached',
        collaborationRunId: input.collaborationRunId,
        referralTraceId: null,
        sourceBuilder,
        targetBuilder,
        payload: {
          lifecycleEvent: 'referral_agent_limit_blocked',
          limitType: 'agent_limit',
          currentValue: projectedAgentCount,
          maxValue: resolvedConstraints.maxAgentsPerCollaboration,
          reason: 'max_agents_exceeded',
          userId: run.userId,
          projectId: run.projectId,
          sourceBuilderProfileId: input.sourceBuilderProfileId,
          targetBuilderProfileId: input.targetBuilderProfileId,
        },
      });
      throw new Error(
        `Max agents ${resolvedConstraints.maxAgentsPerCollaboration} exceeded for collaboration ${input.collaborationRunId}`,
      );
    }

    const existingReferral = await this.findActiveIdempotentReferral(
      referralRepo,
      input.collaborationRunId,
      input.idempotencyKey,
    );
    if (!existingReferral) {
      return { outcome: 'valid' };
    }

    return {
      outcome: 'duplicate',
      referral: this.toReferral(existingReferral),
    };
  }

  private assertCanStartExecution(referral: CollaborationReferral): void {
    const validStatuses: readonly ReferralStatus[] = [
      'pending_approval',
      'approved',
    ];
    if (!validStatuses.includes(referral.status)) {
      throw new Error(
        `Referral ${referral.referralId} cannot start execution from status ${referral.status}`,
      );
    }
  }

  private assertReadOnlyConstraints(referral: CollaborationReferral): void {
    if (!referral.constraints.readOnly || referral.constraints.allowWriteTools) {
      throw new Error(
        'Only read-only referrals with no write tools are allowed for execution',
      );
    }
  }

  private resolveConstraints(
    constraints?: Partial<ReferralConstraints>,
  ): ReferralConstraints {
    const defaultConstraints = this.getDefaultReferralConstraints();
    const merged: ReferralConstraints = {
      timeoutMs: constraints?.timeoutMs ?? defaultConstraints.timeoutMs,
      maxDepth: constraints?.maxDepth ?? defaultConstraints.maxDepth,
      maxAgentsPerCollaboration:
        constraints?.maxAgentsPerCollaboration ??
        defaultConstraints.maxAgentsPerCollaboration,
      readOnly: constraints?.readOnly ?? defaultConstraints.readOnly,
      allowWriteTools: constraints?.allowWriteTools ?? defaultConstraints.allowWriteTools,
      allowedTools: [...(constraints?.allowedTools ?? defaultConstraints.allowedTools)],
    };

    if (!merged.readOnly || merged.allowWriteTools) {
      throw new Error('Only read-only referrals with no write tools are allowed');
    }

    if (
      merged.allowedTools.some((toolId) =>
        READ_ONLY_BLOCKED_TOOL_IDS.includes(toolId as (typeof READ_ONLY_BLOCKED_TOOL_IDS)[number]),
      )
    ) {
      throw new Error('Referral constraints include blocked write-capable tools');
    }

    return merged;
  }

  private async runInTransaction<T>(
    work: (
      runRepo: Repository<CollaborationRunEntity>,
      referralRepo: Repository<CollaborationReferralEntity>,
    ) => Promise<T>,
  ): Promise<T> {
    return this.runRepo.manager.transaction(async (manager) => {
      return work(
        manager.getRepository(CollaborationRunEntity),
        manager.getRepository(CollaborationReferralEntity),
      );
    });
  }

  private async requireRunEntity(
    runRepo: Repository<CollaborationRunEntity>,
    collaborationRunId: CollaborationRunId,
  ): Promise<CollaborationRunEntity> {
    const entity = await runRepo.findOne({
      where: { collaborationRunId },
    });
    if (!entity) {
      throw new Error(`Collaboration run ${collaborationRunId} not found`);
    }

    return entity;
  }

  private async requireReferralEntity(
    referralRepo: Repository<CollaborationReferralEntity>,
    referralId: ReferralId,
  ): Promise<CollaborationReferralEntity> {
    const entity = await referralRepo.findOne({
      where: { referralId },
    });
    if (!entity) {
      throw new Error(`Referral ${referralId} not found`);
    }

    return entity;
  }

  private async findActiveIdempotentReferral(
    referralRepo: Repository<CollaborationReferralEntity>,
    collaborationRunId: CollaborationRunId,
    idempotencyKey: IdempotencyKey,
  ): Promise<CollaborationReferralEntity | null> {
    const rows = await referralRepo.find({
      where: { collaborationRunId, idempotencyKey },
    });
    return (
      rows.find(
        (row) => !IDEMPOTENCY_REPLAY_STATUSES.includes(row.status),
      ) ?? null
    );
  }

  private assertCanFinalizeReferral(referral: CollaborationReferral): void {
    const validStatuses: readonly ReferralStatus[] = [
      'pending_approval',
      'approved',
      'in_progress',
    ];

    if (!validStatuses.includes(referral.status)) {
      throw new Error(
        `Referral ${referral.referralId} cannot transition from ${referral.status}`,
      );
    }
  }

  private toCollaborationRun(entity: CollaborationRunEntity): CollaborationRun {
    return this.cloneCollaborationRun({
      collaborationRunId: entity.collaborationRunId,
      userId: entity.userId,
      projectId: entity.projectId,
      initiatorAgent: {
        agentRole: entity.initiatorAgentRole,
        builderProfileId: entity.initiatorBuilderProfileId,
      },
      orchestrationMode: entity.orchestrationMode,
      status: entity.status,
      referralIds: [...(entity.referralIds ?? [])],
      activeBuilderProfileIds: [...(entity.activeBuilderProfileIds ?? [])],
      timeoutMs: entity.timeoutMs,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      completedAt: this.toIso(entity.completedAt),
      failedAt: this.toIso(entity.failedAt),
      timedOutAt: this.toIso(entity.timedOutAt),
      cancelRequestedAt: this.toIso(entity.cancelRequestedAt),
      cancelledByUserId: entity.cancelledByUserId,
      cancelReason: entity.cancelReason,
    });
  }

  private toReferral(entity: CollaborationReferralEntity): CollaborationReferral {
    return this.cloneReferral({
      referralId: entity.referralId,
      collaborationRunId: entity.collaborationRunId,
      referralTraceId: entity.referralTraceId,
      parentReferralTraceId: entity.parentReferralTraceId,
      sourceBuilder: {
        agentRole: entity.sourceAgentRole,
        builderProfileId: entity.sourceBuilderProfileId,
      },
      targetBuilder: {
        agentRole: entity.targetAgentRole,
        builderProfileId: entity.targetBuilderProfileId,
      },
      status: entity.status,
      cancelStatus: entity.cancelStatus,
      idempotencyKey: entity.idempotencyKey,
      referralChain: [...(entity.referralChain ?? [])],
      depth: entity.depth,
      maxDepth: entity.maxDepth,
      visitedBuilderProfileIds: [...(entity.visitedBuilderProfileIds ?? [])],
      timeoutMs: entity.timeoutMs,
      constraints: {
        timeoutMs: entity.constraintTimeoutMs,
        maxDepth: entity.constraintMaxDepth,
        maxAgentsPerCollaboration: entity.constraintMaxAgentsPerCollaboration,
        readOnly: entity.constraintReadOnly,
        allowWriteTools: entity.constraintAllowWriteTools,
        allowedTools: [...(entity.constraintAllowedTools ?? [])],
      },
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      completedAt: this.toIso(entity.completedAt),
      failedAt: this.toIso(entity.failedAt),
      timedOutAt: this.toIso(entity.timedOutAt),
      cancelRequestedAt: this.toIso(entity.cancelRequestedAt),
      cancelledByUserId: entity.cancelledByUserId,
      cancelReason: entity.cancelReason,
      result: entity.resultStatus
        ? {
            referralId: entity.referralId,
            referralTraceId: entity.referralTraceId,
            status: entity.resultStatus,
            summary: entity.resultSummary ?? '',
            outputFiles: [...(entity.resultOutputFiles ?? [])],
            durationMs: entity.resultDurationMs ?? 0,
            completedAt: this.toIso(entity.completedAt),
            failedAt: this.toIso(entity.failedAt),
            timedOutAt: this.toIso(entity.timedOutAt),
          }
        : null,
    });
  }

  private fromCreateRunInput(
    input: CreateCollaborationRunInput,
    collaborationRunId: CollaborationRunId,
    now: Date,
  ): CollaborationRunEntity {
    const entity = new CollaborationRunEntity();
    entity.collaborationRunId = collaborationRunId;
    entity.userId = input.userId;
    entity.projectId = input.projectId;
    entity.initiatorAgentRole = input.initiatorAgent.agentRole;
    entity.initiatorBuilderProfileId = input.initiatorAgent.builderProfileId;
    entity.orchestrationMode = READ_ONLY_MODE_INDICATOR;
    entity.status = 'active';
    entity.referralIds = [];
    entity.activeBuilderProfileIds = [input.initiatorAgent.builderProfileId];
    entity.timeoutMs = input.timeoutMs ?? DEFAULT_REFERRAL_TIMEOUT_MS;
    entity.createdAt = now;
    entity.updatedAt = now;
    entity.completedAt = null;
    entity.failedAt = null;
    entity.timedOutAt = null;
    entity.cancelRequestedAt = null;
    entity.cancelledByUserId = null;
    entity.cancelReason = null;
    return entity;
  }

  private fromCreateReferralInput(
    input: CreateReferralInput,
    details: {
      referralId: ReferralId;
      referralTraceId: ReferralTraceId;
      depth: number;
      visited: BuilderProfileId[];
      referralChain: BuilderProfileId[];
      resolvedConstraints: ReferralConstraints;
      now: Date;
    },
  ): CollaborationReferralEntity {
    const entity = new CollaborationReferralEntity();
    entity.referralId = details.referralId;
    entity.collaborationRunId = input.collaborationRunId;
    entity.referralTraceId = details.referralTraceId;
    entity.parentReferralTraceId = input.parentReferralTraceId ?? null;
    entity.sourceAgentRole = input.sourceBuilder.agentRole;
    entity.sourceBuilderProfileId = input.sourceBuilder.builderProfileId;
    entity.targetAgentRole = input.targetBuilder.agentRole;
    entity.targetBuilderProfileId = input.targetBuilder.builderProfileId;
    entity.status = 'pending_approval';
    entity.cancelStatus = 'not_requested';
    entity.idempotencyKey = input.idempotencyKey;
    entity.referralChain = [...details.referralChain];
    entity.depth = details.depth;
    entity.maxDepth = input.maxDepth ?? details.resolvedConstraints.maxDepth;
    entity.visitedBuilderProfileIds = [...details.visited];
    entity.timeoutMs = input.timeoutMs ?? details.resolvedConstraints.timeoutMs;
    entity.constraintTimeoutMs = details.resolvedConstraints.timeoutMs;
    entity.constraintMaxDepth = details.resolvedConstraints.maxDepth;
    entity.constraintMaxAgentsPerCollaboration =
      details.resolvedConstraints.maxAgentsPerCollaboration;
    entity.constraintReadOnly = details.resolvedConstraints.readOnly;
    entity.constraintAllowWriteTools = details.resolvedConstraints.allowWriteTools;
    entity.constraintAllowedTools = [...details.resolvedConstraints.allowedTools];
    entity.executionId = null;
    entity.resultStatus = null;
    entity.resultSummary = null;
    entity.resultOutputFiles = null;
    entity.resultDurationMs = null;
    entity.createdAt = details.now;
    entity.updatedAt = details.now;
    entity.completedAt = null;
    entity.failedAt = null;
    entity.timedOutAt = null;
    entity.cancelRequestedAt = null;
    entity.cancelledByUserId = null;
    entity.cancelReason = null;
    return entity;
  }

  private cloneCollaborationRun(run: CollaborationRun): CollaborationRun {
    return {
      ...run,
      initiatorAgent: {
        ...run.initiatorAgent,
      },
      referralIds: [...run.referralIds],
      activeBuilderProfileIds: [...run.activeBuilderProfileIds],
    };
  }

  private cloneReferral(referral: CollaborationReferral): CollaborationReferral {
    return {
      ...referral,
      sourceBuilder: {
        ...referral.sourceBuilder,
      },
      targetBuilder: {
        ...referral.targetBuilder,
      },
      referralChain: [...referral.referralChain],
      visitedBuilderProfileIds: [...referral.visitedBuilderProfileIds],
      constraints: {
        ...referral.constraints,
        allowedTools: [...referral.constraints.allowedTools],
      },
      result: referral.result
        ? {
            ...referral.result,
            outputFiles: [...referral.result.outputFiles],
          }
        : null,
    };
  }

  private uniqueBuilderIds(ids: readonly BuilderProfileId[]): BuilderProfileId[] {
    return Array.from(new Set(ids));
  }

  private async resolveBuilderIdentity(
    referralRepo: Repository<CollaborationReferralEntity>,
    run: CollaborationRun,
    builderProfileId: BuilderProfileId,
  ): Promise<CollaborationAgentIdentity> {
    if (run.initiatorAgent.builderProfileId === builderProfileId) {
      return { ...run.initiatorAgent };
    }

    const referrals = await referralRepo.find({
      where: { collaborationRunId: run.collaborationRunId },
    });
    for (const referral of referrals) {
      if (referral.sourceBuilderProfileId === builderProfileId) {
        return {
          agentRole: referral.sourceAgentRole,
          builderProfileId: referral.sourceBuilderProfileId,
        };
      }

      if (referral.targetBuilderProfileId === builderProfileId) {
        return {
          agentRole: referral.targetAgentRole,
          builderProfileId: referral.targetBuilderProfileId,
        };
      }
    }

    return {
      agentRole: 'builder',
      builderProfileId,
    };
  }

  private emitAuditEvent(input: {
    eventType: OrchestrationAuditEventType;
    collaborationRunId: CollaborationRunId;
    referralTraceId: ReferralTraceId | null;
    sourceBuilder: SourceBuilderIdentity;
    targetBuilder: TargetBuilderIdentity | null;
    payload: Record<string, unknown>;
  }): void {
    const event: OrchestrationAuditEvent = {
      eventType: input.eventType,
      collaborationRunId: input.collaborationRunId,
      referralTraceId: input.referralTraceId,
      sourceBuilder: { ...input.sourceBuilder },
      targetBuilder: input.targetBuilder ? { ...input.targetBuilder } : null,
      timestamp: this.now(),
      payload: {
        collaborationRunId: input.collaborationRunId,
        referralTraceId: input.referralTraceId,
        sourceBuilderProfileId: input.sourceBuilder.builderProfileId,
        sourceAgentRole: input.sourceBuilder.agentRole,
        targetBuilderProfileId: input.targetBuilder?.builderProfileId ?? null,
        targetAgentRole: input.targetBuilder?.agentRole ?? null,
        ...input.payload,
      },
    };
    this.auditRecorder.record(event);
  }

  private generateId(prefix: string): string {
    return `${prefix}_${randomUUID()}`;
  }

  private toIso(value: Date | null): string | null {
    return value ? value.toISOString() : null;
  }

  private now(): string {
    return new Date().toISOString();
  }
}
