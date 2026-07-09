import { Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { QueueService } from '../queue/queue.service';
import { ExecutionResultService } from '../ai/execution-result.service';
import {
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
  type ReferralTraceId,
  type SourceBuilderIdentity,
  type TargetBuilderIdentity,
  type UserId,
  type ProjectId,
  type ReferralConstraints,
} from './orchestration.contracts';

const DEFAULT_REFERRAL_TIMEOUT_MS = 300_000;

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
  private readonly collaborationRunStore = new Map<CollaborationRunId, CollaborationRun>();
  private readonly referralStore = new Map<ReferralId, CollaborationReferral>();
  private readonly idempotencyStore = new Map<IdempotencyKey, ReferralId>();
  private readonly referralExecutionMap = new Map<ReferralId, string>();

  constructor(
    @Optional() private readonly queueService?: QueueService,
    @Optional() private readonly executionResultService?: ExecutionResultService,
  ) {}

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

  createCollaborationRun(input: CreateCollaborationRunInput): CollaborationRun {
    const collaborationRunId =
      input.collaborationRunId && input.collaborationRunId.trim().length > 0
        ? input.collaborationRunId
        : this.generateId('collab');

    const existing = this.collaborationRunStore.get(collaborationRunId);
    if (existing) {
      return this.cloneCollaborationRun(existing);
    }

    const now = this.now();
    const run: CollaborationRun = {
      collaborationRunId,
      userId: input.userId,
      projectId: input.projectId,
      initiatorAgent: {
        ...input.initiatorAgent,
      },
      orchestrationMode: READ_ONLY_MODE_INDICATOR,
      status: 'active',
      referralIds: [],
      activeBuilderProfileIds: [input.initiatorAgent.builderProfileId],
      timeoutMs: input.timeoutMs ?? DEFAULT_REFERRAL_TIMEOUT_MS,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      failedAt: null,
      timedOutAt: null,
      cancelRequestedAt: null,
      cancelledByUserId: null,
      cancelReason: null,
    };

    this.collaborationRunStore.set(collaborationRunId, run);

    return this.cloneCollaborationRun(run);
  }

  getCollaborationRun(collaborationRunId: CollaborationRunId): CollaborationRun | null {
    const run = this.collaborationRunStore.get(collaborationRunId);
    if (!run) {
      return null;
    }

    return this.cloneCollaborationRun(run);
  }

  createReferral(input: CreateReferralInput): CollaborationReferral {
    const validation = this.validateReferral({
      collaborationRunId: input.collaborationRunId,
      sourceBuilderProfileId: input.sourceBuilder.builderProfileId,
      targetBuilderProfileId: input.targetBuilder.builderProfileId,
      idempotencyKey: input.idempotencyKey,
      constraints: input.constraints,
      depth: input.depth,
      maxDepth: input.maxDepth,
      visitedBuilderProfileIds: input.visitedBuilderProfileIds,
    });

    if (validation.outcome === 'duplicate') {
      return validation.referral;
    }

    const run = this.getStoredCollaborationRun(input.collaborationRunId);
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
    const now = this.now();

    const referral: CollaborationReferral = {
      referralId,
      collaborationRunId: input.collaborationRunId,
      referralTraceId,
      parentReferralTraceId: input.parentReferralTraceId ?? null,
      sourceBuilder: {
        ...input.sourceBuilder,
      },
      targetBuilder: {
        ...input.targetBuilder,
      },
      status: 'pending_approval',
      cancelStatus: 'not_requested',
      idempotencyKey: input.idempotencyKey,
      referralChain: baseChain,
      depth,
      maxDepth: input.maxDepth ?? resolvedConstraints.maxDepth,
      visitedBuilderProfileIds: visited,
      timeoutMs: input.timeoutMs ?? resolvedConstraints.timeoutMs,
      constraints: {
        ...resolvedConstraints,
        allowedTools: [...resolvedConstraints.allowedTools],
      },
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      failedAt: null,
      timedOutAt: null,
      cancelRequestedAt: null,
      cancelledByUserId: null,
      cancelReason: null,
      result: null,
    };

    const nextActiveBuilderIds = this.uniqueBuilderIds([
      ...run.activeBuilderProfileIds,
      input.sourceBuilder.builderProfileId,
      input.targetBuilder.builderProfileId,
    ]);
    const updatedRun: CollaborationRun = {
      ...run,
      referralIds: [...run.referralIds, referral.referralId],
      activeBuilderProfileIds: nextActiveBuilderIds,
      updatedAt: now,
    };

    this.referralStore.set(referral.referralId, referral);
    this.idempotencyStore.set(
      this.buildIdempotencyStoreKey(referral.collaborationRunId, referral.idempotencyKey),
      referral.referralId,
    );
    this.collaborationRunStore.set(updatedRun.collaborationRunId, updatedRun);

    return this.cloneReferral(referral);
  }

  getReferral(referralId: ReferralId): CollaborationReferral | null {
    const referral = this.referralStore.get(referralId);
    if (!referral) {
      return null;
    }

    return this.cloneReferral(referral);
  }

  completeReferral(input: CompleteReferralInput): CollaborationReferral {
    const referral = this.getStoredReferral(input.referralId);
    if (referral.status === 'completed') {
      return this.cloneReferral(referral);
    }

    this.assertCanFinalizeReferral(referral);

    const completedAt = this.now();
    const nextResult: ReferralResult = {
      referralId: referral.referralId,
      referralTraceId: referral.referralTraceId,
      status: input.status ?? 'success',
      summary: input.summary,
      outputFiles: [...(input.outputFiles ?? [])],
      durationMs: input.durationMs ?? 0,
      completedAt,
      failedAt: null,
      timedOutAt: null,
    };

    const updated: CollaborationReferral = {
      ...referral,
      status: 'completed',
      result: nextResult,
      completedAt,
      updatedAt: completedAt,
    };

    this.referralStore.set(updated.referralId, updated);

    return this.cloneReferral(updated);
  }

  failReferral(input: FailReferralInput): CollaborationReferral {
    const referral = this.getStoredReferral(input.referralId);
    if (referral.status === 'failed') {
      return this.cloneReferral(referral);
    }

    this.assertCanFinalizeReferral(referral);

    const failedAt = this.now();
    const nextResult: ReferralResult = {
      referralId: referral.referralId,
      referralTraceId: referral.referralTraceId,
      status: 'failed',
      summary: input.summary,
      outputFiles: [...(input.outputFiles ?? [])],
      durationMs: input.durationMs ?? 0,
      completedAt: null,
      failedAt,
      timedOutAt: null,
    };

    const updated: CollaborationReferral = {
      ...referral,
      status: 'failed',
      result: nextResult,
      failedAt,
      updatedAt: failedAt,
    };

    this.referralStore.set(updated.referralId, updated);

    return this.cloneReferral(updated);
  }

  validateReferral(input: ValidateReferralInput): ValidateReferralResult {
    const run = this.getStoredCollaborationRun(input.collaborationRunId);
    const resolvedConstraints = this.resolveConstraints(input.constraints);
    const maxDepth = input.maxDepth ?? resolvedConstraints.maxDepth;
    const depth = input.depth ?? 0;

    if (depth >= maxDepth) {
      throw new Error(
        `Referral depth ${depth} exceeds max depth ${maxDepth} for collaboration ${input.collaborationRunId}`,
      );
    }

    const visitedBuilderProfileIds = new Set(input.visitedBuilderProfileIds ?? []);
    if (visitedBuilderProfileIds.has(input.targetBuilderProfileId)) {
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
      throw new Error(
        `Max agents ${resolvedConstraints.maxAgentsPerCollaboration} exceeded for collaboration ${input.collaborationRunId}`,
      );
    }

    const idempotencyStoreKey = this.buildIdempotencyStoreKey(
      input.collaborationRunId,
      input.idempotencyKey,
    );
    const existingReferralId = this.idempotencyStore.get(idempotencyStoreKey);
    if (!existingReferralId) {
      return { outcome: 'valid' };
    }

    const existingReferral = this.referralStore.get(existingReferralId);
    if (!existingReferral) {
      this.idempotencyStore.delete(idempotencyStoreKey);
      return { outcome: 'valid' };
    }

    if (['failed', 'cancelled', 'timed_out'].includes(existingReferral.status)) {
      return { outcome: 'valid' };
    }

    return {
      outcome: 'duplicate',
      referral: this.cloneReferral(existingReferral),
    };
  }

  async startReferralExecution(
    input: StartReferralExecutionInput,
  ): Promise<{ executionId: string }> {
    if (!this.queueService) {
      throw new Error('QueueService is required for referral execution');
    }

    const referral = this.getStoredReferral(input.referralId);
    this.assertCanStartExecution(referral);
    this.assertReadOnlyConstraints(referral);

    const now = this.now();
    const jobPayload = {
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
      harnessVersion: input.harnessVersion,
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

    this.referralExecutionMap.set(referral.referralId, input.executionId);

    const updated: CollaborationReferral = {
      ...referral,
      status: 'in_progress',
      updatedAt: now,
    };
    this.referralStore.set(updated.referralId, updated);

    await this.queueService.enqueueExecution(jobPayload);

    return { executionId: input.executionId };
  }

  async cancelReferral(input: CancelReferralInput): Promise<CollaborationReferral> {
    const referral = this.getStoredReferral(input.referralId);
    const run = this.getStoredCollaborationRun(referral.collaborationRunId);

    if (run.userId !== input.cancelledByUserId) {
      throw new Error(
        `User ${input.cancelledByUserId} is not authorized to cancel referral ${input.referralId}`,
      );
    }

    const terminalStatuses: readonly CollaborationReferral['status'][] = [
      'completed',
      'failed',
      'cancelled',
      'timed_out',
      'rejected',
    ];
    if (terminalStatuses.includes(referral.status)) {
      return this.cloneReferral(referral);
    }

    const executionId = this.referralExecutionMap.get(input.referralId);
    if (executionId && this.executionResultService) {
      await this.executionResultService.requestCancel(executionId);
    }

    const now = this.now();
    const updated: CollaborationReferral = {
      ...referral,
      status: 'cancelled',
      cancelStatus: 'cancelled',
      cancelRequestedAt: now,
      cancelledByUserId: input.cancelledByUserId,
      cancelReason: input.cancelReason,
      updatedAt: now,
    };
    this.referralStore.set(updated.referralId, updated);

    return this.cloneReferral(updated);
  }

  async cancelCollaboration(input: CancelCollaborationInput): Promise<CollaborationRun> {
    const run = this.getStoredCollaborationRun(input.collaborationRunId);

    if (run.userId !== input.cancelledByUserId) {
      throw new Error(
        `User ${input.cancelledByUserId} is not authorized to cancel collaboration ${input.collaborationRunId}`,
      );
    }

    const activeStatuses: readonly CollaborationReferral['status'][] = [
      'pending_approval',
      'approved',
      'in_progress',
    ];

    for (const referralId of run.referralIds) {
      const referral = this.referralStore.get(referralId);
      if (referral && activeStatuses.includes(referral.status)) {
        await this.cancelReferral({
          referralId,
          cancelledByUserId: input.cancelledByUserId,
          cancelReason: input.cancelReason,
        });
      }
    }

    const now = this.now();
    const updatedRun: CollaborationRun = {
      ...run,
      status: 'cancelled',
      cancelRequestedAt: now,
      cancelledByUserId: input.cancelledByUserId,
      cancelReason: input.cancelReason,
      updatedAt: now,
    };
    this.collaborationRunStore.set(updatedRun.collaborationRunId, updatedRun);

    return this.cloneCollaborationRun(updatedRun);
  }

  private assertCanStartExecution(referral: CollaborationReferral): void {
    const validStatuses: readonly CollaborationReferral['status'][] = [
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

  private getStoredCollaborationRun(collaborationRunId: CollaborationRunId): CollaborationRun {
    const run = this.collaborationRunStore.get(collaborationRunId);
    if (!run) {
      throw new Error(`Collaboration run ${collaborationRunId} not found`);
    }

    return run;
  }

  private getStoredReferral(referralId: ReferralId): CollaborationReferral {
    const referral = this.referralStore.get(referralId);
    if (!referral) {
      throw new Error(`Referral ${referralId} not found`);
    }

    return referral;
  }

  private assertCanFinalizeReferral(referral: CollaborationReferral): void {
    const validStatuses: readonly CollaborationReferral['status'][] = [
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

  private generateId(prefix: string): string {
    return `${prefix}_${randomUUID()}`;
  }

  private buildIdempotencyStoreKey(
    collaborationRunId: CollaborationRunId,
    idempotencyKey: IdempotencyKey,
  ): IdempotencyKey {
    return `${collaborationRunId}::${idempotencyKey}`;
  }

  private now(): string {
    return new Date().toISOString();
  }
}
