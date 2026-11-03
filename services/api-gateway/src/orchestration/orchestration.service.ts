import {
  BadRequestException,
  ConflictException,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import {
  createHarnessEntitlementProof,
  readValidatedHarnessEntitlementHmacSecret,
} from '../ai/ai-execution.controller';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import { QueueService } from '../queue/queue.service';
import { ExecutionResultService } from '../ai/execution-result.service';
import { UsageLedgerService } from '../usage-ledger/usage-ledger.service';
import { ExecutionSafetyGuard } from '../safety/execution-safety.guard';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import { AbortGuard } from '../abort/abort.guard';
import { CreditBalanceGuard } from '../billing/credit-balance.guard';
import { TokenQuotaGuard } from '../quota/token-quota.guard';
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
  MAX_HANDOFFS_PER_RUN,
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
  type CollaborationListedAgent,
  type ReferralConstraints,
  type ReferralPendingJob,
} from './orchestration.contracts';
import {
  COLLABORATION_WAITING_MAX_AGE_MS,
  HANDOFF_WAIT_TIMEOUT_REASON,
} from './collaboration-sweep.constants';
import { readStoredExecutionFailureReason } from './collaboration-failure-reason';
import {
  COLLABORATION_REVIEWER_PROFILE_ID,
  COLLABORATION_SEND_BACK_WRITER_INSTRUCTION,
  COLLABORATION_WRITER_PROFILE_ID,
} from './collaboration-team';
import { classifySendBackEdge } from './collaboration-send-back';
import {
  collaborationHarnessJobFields,
  readCollaborationHandoffWork,
  targetStepCanChangeFiles,
  type CollaborationHandoffFact,
} from './collaboration-tool-profile';
import { appendSavePointDiff } from './collaboration-work-diff';
import {
  answerHandoffIdempotencyKey,
  buildCollaborationProjectInstructions,
  buildRequestedHandoffPrompt,
  parseHandoffRequest,
  readCollaborationAgents,
} from './handoff-request';

function createdAtMs(value: Date): number {
  const time = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(time) ? time : 0;
}

const DEFAULT_REFERRAL_TIMEOUT_MS = 300_000;
const LEDGER_INTENT_FAILURE = 'Failed to write execution intent';
const HARNESS_PROOF_UNAVAILABLE = 'Harness entitlement proof could not be produced';
const FINISHED_FAILURE_EXECUTION_STATUSES: readonly string[] = [
  'failed',
  'cancelled',
  'timeout',
  'timed_out',
];
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
  readonly pendingJob?: ReferralPendingJob | null;
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

export interface CreatePendingReferralInput {
  readonly collaborationRunId: CollaborationRunId;
  readonly sourceBuilder: SourceBuilderIdentity;
  readonly targetBuilder: TargetBuilderIdentity;
  readonly idempotencyKey: IdempotencyKey;
  readonly sessionId: string;
  readonly conversationId: string;
  readonly apiKeyId: string;
  readonly prompt: string;
  readonly provider: string;
  readonly adapter: string;
  readonly model?: string;
  readonly workspaceContext?: unknown;
  readonly globalInstructions?: string;
  readonly projectInstructions?: string;
  readonly agents?: unknown;
  readonly fileAccess?: boolean;
  readonly constraints?: Partial<ReferralConstraints>;
  readonly parentReferralTraceId?: ReferralTraceId | null;
  readonly timeoutMs?: number;
  readonly orchestrationPriority?: number;
}

export interface DecideReferralInput {
  readonly collaborationRunId: CollaborationRunId;
  readonly referralId: ReferralId;
  readonly decidedBy: string;
  readonly reason?: string;
}

export interface CreateAndStartReferralInput {
  readonly collaborationRunId: CollaborationRunId;
  readonly sourceBuilder: SourceBuilderIdentity;
  readonly targetBuilder: TargetBuilderIdentity;
  readonly idempotencyKey: IdempotencyKey;
  readonly sessionId: string;
  readonly conversationId: string;
  readonly apiKeyId: string;
  readonly prompt: string;
  readonly provider: string;
  readonly adapter: string;
  readonly model?: string;
  readonly workspaceContext?: unknown;
  readonly globalInstructions?: string;
  readonly projectInstructions?: string;
  readonly constraints?: Partial<ReferralConstraints>;
  readonly referralChain?: readonly BuilderProfileId[];
  readonly depth?: number;
  readonly maxDepth?: number;
  readonly visitedBuilderProfileIds?: readonly BuilderProfileId[];
  readonly parentReferralTraceId?: ReferralTraceId | null;
  readonly timeoutMs?: number;
  readonly orchestrationPriority?: number;
}

export interface StartedCollaborationReferral {
  readonly referral: CollaborationReferral;
  readonly executionId: string | null;
}

type StoredExecution = {
  execution_status?: string | null;
  metadata?: unknown;
} | null;

type ExecutionReadBack =
  | { readonly kind: 'unfinished' }
  | { readonly kind: 'succeeded'; readonly summary: string }
  | { readonly kind: 'failed'; readonly summary: string };

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
  private readonly logger = new Logger(OrchestrationService.name);
  private readonly auditRecorder: OrchestrationAuditRecorder;

  constructor(
    @InjectRepository(CollaborationRunEntity)
    private readonly runRepo: Repository<CollaborationRunEntity>,
    @InjectRepository(CollaborationReferralEntity)
    private readonly referralRepo: Repository<CollaborationReferralEntity>,
    @Optional() private readonly queueService?: QueueService,
    @Optional() private readonly executionResultService?: ExecutionResultService,
    @Optional() auditRecorder?: InMemoryOrchestrationAuditRecorder,
    @Optional() private readonly usageLedgerService?: UsageLedgerService,
    @Optional() private readonly executionSafetyGuard?: ExecutionSafetyGuard,
    @Optional() private readonly abortGuard?: AbortGuard,
    @Optional() private readonly creditBalanceGuard?: CreditBalanceGuard,
    @Optional() private readonly tokenQuotaGuard?: TokenQuotaGuard,
    @Optional() private readonly containerManagerClient?: ContainerManagerHttpClient,
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

  async listCollaborationRunsForOwner(input: {
    userId: string;
    projectId: string;
    limit: number;
  }): Promise<CollaborationRun[]> {
    const rows = await this.runRepo.find({
      where: { userId: input.userId, projectId: input.projectId },
    });
    const newestFirst = [...rows].sort(
      (left, right) => createdAtMs(right.createdAt) - createdAtMs(left.createdAt),
    );
    return newestFirst
      .slice(0, input.limit)
      .map((row) => this.toCollaborationRun(row));
  }

  async getCollaborationRunWithReferrals(
    collaborationRunId: CollaborationRunId,
  ): Promise<{ run: CollaborationRun; referrals: CollaborationReferral[] } | null> {
    const run = await this.getCollaborationRun(collaborationRunId);
    if (!run) {
      return null;
    }

    for (const referralId of run.referralIds) {
      await this.syncReferralFromExecution(referralId);
    }

    const refreshed = await this.runRepo.findOne({
      where: { collaborationRunId },
    });
    if (!refreshed) {
      return null;
    }
    const referrals: CollaborationReferral[] = [];
    for (const referralId of refreshed.referralIds ?? []) {
      const referral = await this.getReferral(referralId);
      if (referral) {
        referrals.push(referral);
      }
    }

    const settled = await this.settleCollaborationRun(collaborationRunId, referrals);
    if (!settled) {
      return null;
    }

    return { run: settled, referrals };
  }

  async readCollaborationHandoffFacts(
    collaborationRunId: CollaborationRunId,
  ): Promise<Map<string, CollaborationHandoffFact>> {
    const entities = await this.referralRepo.find({
      where: { collaborationRunId },
    });
    const facts = new Map<string, CollaborationHandoffFact>();
    for (const entity of entities) {
      let changedPaths: string[] = [];
      let savePoint: string | null = null;
      let tests: CollaborationHandoffFact['tests'][number][] = [];
      if (entity.executionId && this.executionResultService) {
        const execution = await this.executionResultService.getExecution(entity.executionId);
        const work = readCollaborationHandoffWork(execution?.metadata);
        changedPaths = [...work.changedPaths];
        savePoint = work.savePoint;
        tests = work.tests.map((test) => ({
          command: test.command,
          passed: test.passed,
        }));
      }
      const storedDiff = entity.pendingJob?.workDiff;
      const diffUnavailable = storedDiff?.unavailable === true;
      facts.set(entity.referralId, {
        canChangeFiles: targetStepCanChangeFiles(
          entity.targetBuilderProfileId,
          entity.pendingJob?.fileAccess === true,
        ),
        changedPaths,
        savePoint,
        tests,
        diff:
          storedDiff && !diffUnavailable && typeof storedDiff.text === 'string'
            ? storedDiff.text
            : null,
        diffUnavailable,
      });
    }
    return facts;
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
      const existingHandoffs = await referralRepo.find({
        where: { collaborationRunId: input.collaborationRunId },
      });
      if (existingHandoffs.length >= MAX_HANDOFFS_PER_RUN) {
        this.emitAuditEvent({
          eventType: 'orchestration.safety_limit_breached',
          collaborationRunId: input.collaborationRunId,
          referralTraceId: null,
          sourceBuilder: input.sourceBuilder,
          targetBuilder: input.targetBuilder,
          payload: {
            lifecycleEvent: 'referral_handoff_limit_blocked',
            limitType: 'handoff',
            currentValue: existingHandoffs.length + 1,
            maxValue: MAX_HANDOFFS_PER_RUN,
            reason: 'max_handoffs_exceeded',
            userId: run.userId,
            projectId: run.projectId,
            sourceBuilderProfileId: input.sourceBuilder.builderProfileId,
            targetBuilderProfileId: input.targetBuilder.builderProfileId,
          },
        });
        throw new Error(
          `Handoff limit ${MAX_HANDOFFS_PER_RUN} exceeded for collaboration ${input.collaborationRunId}`,
        );
      }
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
        const fileAccess = referralEntity.pendingJob?.fileAccess === true;
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
          executionIntent: 'conversation' as const,
          ...(fileAccess
            ? collaborationHarnessJobFields(referral.targetBuilder.builderProfileId)
            : {}),
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

    await this.queueService.enqueueExecution(
      this.withHarnessEntitlementProof(jobPayload),
    );
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

  async createAndStartReferral(
    input: CreateAndStartReferralInput,
  ): Promise<StartedCollaborationReferral> {
    const referral = await this.createReferral({
      collaborationRunId: input.collaborationRunId,
      parentReferralTraceId: input.parentReferralTraceId,
      sourceBuilder: input.sourceBuilder,
      targetBuilder: input.targetBuilder,
      idempotencyKey: input.idempotencyKey,
      constraints: input.constraints,
      referralChain: input.referralChain,
      depth: input.depth,
      maxDepth: input.maxDepth,
      visitedBuilderProfileIds: input.visitedBuilderProfileIds,
      timeoutMs: input.timeoutMs,
    });

    if (referral.status !== 'pending_approval' && referral.status !== 'approved') {
      const existing = await this.referralRepo.findOne({
        where: { referralId: referral.referralId },
      });
      return {
        referral,
        executionId: existing?.executionId ?? null,
      };
    }

    const run = await this.getCollaborationRun(referral.collaborationRunId);
    if (!run) {
      throw new Error(`Collaboration run ${referral.collaborationRunId} not found`);
    }

    const executionId = randomUUID();
    const submittedAt = this.now();
    let intentWritten = false;
    try {
      if (!this.usageLedgerService) {
        throw new Error('UsageLedgerService is required for referral execution');
      }
      await this.usageLedgerService.writeExecutionIntent({
        executionId,
        apiKeyId: input.apiKeyId,
        userId: run.userId,
        sessionId: input.sessionId,
        conversationId: input.conversationId,
        provider: input.provider,
        adapter: input.adapter,
        metadata: {
          runMode: 'ask',
          apiKeyId: input.apiKeyId,
          requestedProvider: input.provider,
          requestedModel: input.model ?? null,
        },
        agentRole: referral.targetBuilder.agentRole,
        builderProfileId: referral.targetBuilder.builderProfileId,
        collaborationRunId: referral.collaborationRunId,
        referralTraceId: referral.referralTraceId,
      });
      intentWritten = true;
    } catch {
      intentWritten = false;
    }

    if (!intentWritten) {
      await this.failReferralQuietly(referral.referralId, LEDGER_INTENT_FAILURE);
      throw new Error(LEDGER_INTENT_FAILURE);
    }

    try {
      await this.startReferralExecution({
        referralId: referral.referralId,
        executionId,
        sessionId: input.sessionId,
        conversationId: input.conversationId,
        userId: run.userId,
        apiKeyId: input.apiKeyId,
        prompt: input.prompt,
        workspaceContext: input.workspaceContext,
        provider: input.provider,
        adapter: input.adapter,
        model: input.model,
        globalInstructions: input.globalInstructions,
        projectInstructions: input.projectInstructions,
        submittedAt,
        orchestrationPriority: input.orchestrationPriority,
      });
    } catch (error) {
      await this.failReferralQuietly(
        referral.referralId,
        'Failed to enqueue referral execution',
      );
      throw error;
    }

    const started = await this.getReferral(referral.referralId);
    if (!started) {
      throw new Error(`Referral ${referral.referralId} not found`);
    }

    return { referral: started, executionId };
  }

  async createPendingReferral(
    input: CreatePendingReferralInput,
  ): Promise<StartedCollaborationReferral> {
    const prepared = await this.preparePendingReferral(input);
    const graph = await this.deriveServerGraph({
      collaborationRunId: input.collaborationRunId,
      parentReferralTraceId: input.parentReferralTraceId,
      sourceBuilderProfileId: input.sourceBuilder.builderProfileId,
    });
    const referral = await this.createReferral({
      collaborationRunId: input.collaborationRunId,
      parentReferralTraceId: graph.parentReferralTraceId,
      sourceBuilder: input.sourceBuilder,
      targetBuilder: input.targetBuilder,
      idempotencyKey: input.idempotencyKey,
      constraints: this.clampConstraints(input.constraints),
      referralChain: graph.referralChain,
      depth: graph.depth,
      visitedBuilderProfileIds: graph.visitedBuilderProfileIds,
      timeoutMs: this.clampTimeout(input.timeoutMs),
      pendingJob: {
        sessionId: input.sessionId,
        conversationId: input.conversationId,
        apiKeyId: input.apiKeyId,
        prompt: input.prompt,
        provider: input.provider,
        adapter: input.adapter,
        model: input.model ?? null,
        workspaceContext: input.workspaceContext ?? null,
        globalInstructions: input.globalInstructions ?? null,
        projectInstructions: prepared.projectInstructions,
        orchestrationPriority: input.orchestrationPriority ?? null,
        decidedBy: null,
        decisionReason: null,
        agents: prepared.agents,
        callerProjectInstructions: prepared.callerProjectInstructions,
        handoffNote: null,
        ...(prepared.fileAccess ? { fileAccess: true } : {}),
      },
    });
    const stored = await this.referralRepo.findOne({
      where: { referralId: referral.referralId },
    });
    return {
      referral,
      executionId: stored?.executionId ?? null,
    };
  }

  async approveReferral(
    input: DecideReferralInput,
  ): Promise<StartedCollaborationReferral> {
    const loaded = await this.loadReferralInRun(
      input.collaborationRunId,
      input.referralId,
    );
    if (loaded.entity.status !== 'pending_approval') {
      throw new ConflictException(
        `Referral ${input.referralId} cannot be approved from status ${loaded.entity.status}`,
      );
    }
    if (!loaded.entity.pendingJob?.prompt) {
      throw new ConflictException(
        `Referral ${input.referralId} has no waiting job`,
      );
    }
    const job = loaded.entity.pendingJob;
    if (
      job.fileAccess === true &&
      readValidatedHarnessEntitlementHmacSecret() === undefined
    ) {
      throw new InternalServerErrorException(HARNESS_PROOF_UNAVAILABLE);
    }
    await this.assertHandoffAllowed(loaded.run.userId, job);

    const now = new Date();
    const claimed = await this.referralRepo.update(
      {
        referralId: input.referralId,
        collaborationRunId: input.collaborationRunId,
        status: 'pending_approval',
      },
      {
        status: 'approved',
        pendingJob: {
          ...job,
          decidedBy: input.decidedBy,
        },
        updatedAt: now,
      },
    );
    if ((claimed.affected ?? 0) < 1) {
      throw new ConflictException(
        `Referral ${input.referralId} cannot be approved`,
      );
    }

    const referral = this.toReferral(loaded.entity);
    this.emitAuditEvent({
      eventType: 'orchestration.referral_approved',
      collaborationRunId: input.collaborationRunId,
      referralTraceId: referral.referralTraceId,
      sourceBuilder: referral.sourceBuilder,
      targetBuilder: referral.targetBuilder,
      payload: {
        lifecycleEvent: 'referral_approved',
        decidedBy: input.decidedBy,
        referralId: input.referralId,
        status: 'approved',
        userId: loaded.run.userId,
        projectId: loaded.run.projectId,
      },
    });

    const executionId = await this.enqueueApprovedReferral(
      input.referralId,
      { ...job, decidedBy: input.decidedBy },
      loaded.run.userId,
    );
    const started = await this.getReferral(input.referralId);
    if (!started) {
      throw new Error(`Referral ${input.referralId} not found`);
    }
    return { referral: started, executionId };
  }

  async rejectReferral(input: DecideReferralInput): Promise<CollaborationReferral> {
    const reason = input.reason?.trim() ?? '';
    if (reason.length === 0) {
      throw new BadRequestException(
        `Referral ${input.referralId} cannot be rejected without a reason`,
      );
    }
    const loaded = await this.loadReferralInRun(
      input.collaborationRunId,
      input.referralId,
    );
    if (loaded.entity.status !== 'pending_approval') {
      throw new ConflictException(
        `Referral ${input.referralId} cannot be rejected from status ${loaded.entity.status}`,
      );
    }
    const now = new Date();
    const job = loaded.entity.pendingJob
      ? {
          ...loaded.entity.pendingJob,
          decidedBy: input.decidedBy,
          decisionReason: reason,
        }
      : null;
    const rejected = await this.referralRepo.update(
      {
        referralId: input.referralId,
        collaborationRunId: input.collaborationRunId,
        status: 'pending_approval',
      },
      {
        status: 'rejected',
        cancelStatus: 'rejected',
        cancelledByUserId: input.decidedBy,
        cancelReason: reason,
        pendingJob: job,
        updatedAt: now,
      },
    );
    if ((rejected.affected ?? 0) < 1) {
      throw new ConflictException(
        `Referral ${input.referralId} cannot be rejected`,
      );
    }
    const stored = await this.referralRepo.findOne({
      where: { referralId: input.referralId },
    });
    if (!stored) {
      throw new Error(`Referral ${input.referralId} not found`);
    }
    const referral = this.toReferral(stored);
    this.emitAuditEvent({
      eventType: 'orchestration.referral_rejected',
      collaborationRunId: referral.collaborationRunId,
      referralTraceId: referral.referralTraceId,
      sourceBuilder: referral.sourceBuilder,
      targetBuilder: referral.targetBuilder,
      payload: {
        lifecycleEvent: 'referral_rejected',
        decidedBy: input.decidedBy,
        reason,
        referralId: referral.referralId,
        status: referral.status,
        userId: loaded.run.userId,
        projectId: loaded.run.projectId,
      },
    });
    return referral;
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
    const existingEdges = await referralRepo.find({
      where: { collaborationRunId: input.collaborationRunId },
    });
    const sendBackEdge = classifySendBackEdge(
      input.sourceBuilderProfileId,
      input.targetBuilderProfileId,
      existingEdges.map((edge) => ({
        sourceProfileId: edge.sourceBuilderProfileId,
        targetProfileId: edge.targetBuilderProfileId,
        createdAtMs:
          edge.createdAt instanceof Date
            ? edge.createdAt.getTime()
            : Date.parse(String(edge.createdAt)),
      })),
    );
    if (sendBackEdge !== 'ordinary') {
      const existingSendBack = await this.findActiveIdempotentReferral(
        referralRepo,
        input.collaborationRunId,
        input.idempotencyKey,
      );
      if (existingSendBack) {
        return {
          outcome: 'duplicate',
          referral: this.toReferral(existingSendBack),
        };
      }
    }

    const visitedBuilderProfileIds = new Set(input.visitedBuilderProfileIds ?? []);
    if (sendBackEdge === 'ordinary' && depth >= maxDepth) {
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

    if (
      sendBackEdge === 'capped' ||
      (sendBackEdge === 'ordinary' &&
        visitedBuilderProfileIds.has(input.targetBuilderProfileId))
    ) {
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

  private async deriveServerGraph(input: {
    collaborationRunId: CollaborationRunId;
    parentReferralTraceId?: ReferralTraceId | null;
    sourceBuilderProfileId: BuilderProfileId;
  }): Promise<{
    depth: number;
    referralChain: BuilderProfileId[];
    visitedBuilderProfileIds: BuilderProfileId[];
    parentReferralTraceId: ReferralTraceId | null;
  }> {
    const parentId = input.parentReferralTraceId?.trim() || null;
    if (!parentId) {
      return {
        depth: 0,
        referralChain: [input.sourceBuilderProfileId],
        visitedBuilderProfileIds: [input.sourceBuilderProfileId],
        parentReferralTraceId: null,
      };
    }

    const parent = await this.referralRepo.findOne({
      where: {
        collaborationRunId: input.collaborationRunId,
        referralTraceId: parentId,
      },
    });
    if (!parent) {
      throw new Error(
        `Parent referral trace ${parentId} is not in this run`,
      );
    }

    const referralChain = [...(parent.referralChain ?? [])];
    if (!referralChain.includes(input.sourceBuilderProfileId)) {
      referralChain.push(input.sourceBuilderProfileId);
    }
    return {
      depth: parent.depth + 1,
      referralChain,
      visitedBuilderProfileIds: this.uniqueBuilderIds([
        ...(parent.visitedBuilderProfileIds ?? []),
        ...referralChain,
        input.sourceBuilderProfileId,
      ]),
      parentReferralTraceId: parent.referralTraceId,
    };
  }

  private clampTimeout(timeoutMs: number | undefined): number | undefined {
    if (timeoutMs === undefined) {
      return undefined;
    }
    return Math.min(timeoutMs, this.getDefaultReferralConstraints().timeoutMs);
  }

  private clampConstraints(
    constraints?: Partial<ReferralConstraints>,
  ): Partial<ReferralConstraints> | undefined {
    if (!constraints) {
      return undefined;
    }
    const defaults = this.getDefaultReferralConstraints();
    const clamped: {
      timeoutMs?: number;
      maxDepth?: number;
      maxAgentsPerCollaboration?: number;
      readOnly?: boolean;
      allowWriteTools?: boolean;
      allowedTools?: string[];
    } = {
      ...constraints,
      allowedTools: constraints.allowedTools
        ? [...constraints.allowedTools]
        : undefined,
    };
    if (clamped.timeoutMs !== undefined) {
      clamped.timeoutMs = Math.min(clamped.timeoutMs, defaults.timeoutMs);
    }
    if (clamped.maxDepth !== undefined) {
      clamped.maxDepth = Math.min(clamped.maxDepth, defaults.maxDepth);
    }
    if (clamped.maxAgentsPerCollaboration !== undefined) {
      clamped.maxAgentsPerCollaboration = Math.min(
        clamped.maxAgentsPerCollaboration,
        defaults.maxAgentsPerCollaboration,
      );
    }
    if (clamped.allowedTools !== undefined) {
      const hasBlockedTool = clamped.allowedTools.some((toolId) =>
        (READ_ONLY_BLOCKED_TOOL_IDS as readonly string[]).includes(toolId),
      );
      if (!hasBlockedTool) {
        const allowed = new Set<string>(defaults.allowedTools);
        clamped.allowedTools = clamped.allowedTools.filter((toolId) =>
          allowed.has(toolId),
        );
      }
    }
    return clamped;
  }

  private async loadReferralInRun(
    collaborationRunId: CollaborationRunId,
    referralId: ReferralId,
  ): Promise<{ run: CollaborationRun; entity: CollaborationReferralEntity }> {
    const runEntity = await this.runRepo.findOne({
      where: { collaborationRunId },
    });
    if (!runEntity) {
      throw new Error(`Collaboration run ${collaborationRunId} not found`);
    }
    const entity = await this.referralRepo.findOne({
      where: { referralId },
    });
    if (!entity) {
      throw new Error(`Referral ${referralId} not found`);
    }
    if (entity.collaborationRunId !== collaborationRunId) {
      throw new Error(`Referral ${referralId} is not in this run`);
    }
    return { run: this.toCollaborationRun(runEntity), entity };
  }

  private async assertHandoffAllowed(
    userId: string,
    job: ReferralPendingJob,
  ): Promise<void> {
    if (
      !this.executionSafetyGuard ||
      !this.abortGuard ||
      !this.creditBalanceGuard ||
      !this.tokenQuotaGuard
    ) {
      throw new ServiceUnavailableException(
        'Collaboration safety checks are unavailable',
      );
    }

    const request = {
      body: {
        prompt: job.prompt,
        provider: job.provider,
      },
      apiKeyIdentity: {
        userId,
        apiKeyId: job.apiKeyId,
      },
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;

    if (!KillSwitchConfig.isProviderEnabled(job.provider)) {
      throw new ServiceUnavailableException(
        `Provider ${job.provider} temporarily unavailable`,
      );
    }

    const safetyAllowed = await this.executionSafetyGuard.canActivate(context);
    if (!safetyAllowed) {
      throw new ServiceUnavailableException(
        'AI execution temporarily disabled for maintenance',
      );
    }
    const abortAllowed = await this.abortGuard.canActivate(context);
    if (!abortAllowed) {
      throw new ServiceUnavailableException(
        'AI execution temporarily unavailable due to system maintenance. Please try again later.',
      );
    }
    const creditAllowed = await this.creditBalanceGuard.canActivate(context);
    if (!creditAllowed) {
      throw new ServiceUnavailableException('Insufficient credit balance');
    }
    const tokenAllowed = await this.tokenQuotaGuard.canActivate(context);
    if (!tokenAllowed) {
      throw new ServiceUnavailableException('Token quota exceeded');
    }
  }

  private async enqueueApprovedReferral(
    referralId: ReferralId,
    job: ReferralPendingJob,
    userId: string,
  ): Promise<string> {
    if (!this.usageLedgerService) {
      throw new Error('UsageLedgerService is required for referral execution');
    }
    const referralEntity = await this.referralRepo.findOne({
      where: { referralId },
    });
    if (!referralEntity) {
      throw new Error(`Referral ${referralId} not found`);
    }
    const referral = this.toReferral(referralEntity);
    const executionId = randomUUID();
    const submittedAt = this.now();
    let intentWritten = false;
    try {
      await this.usageLedgerService.writeExecutionIntent({
        executionId,
        apiKeyId: job.apiKeyId,
        userId,
        sessionId: job.sessionId,
        conversationId: job.conversationId,
        provider: job.provider,
        adapter: job.adapter,
        metadata: {
          runMode: 'ask',
          apiKeyId: job.apiKeyId,
          requestedProvider: job.provider,
          requestedModel: job.model,
        },
        agentRole: referral.targetBuilder.agentRole,
        builderProfileId: referral.targetBuilder.builderProfileId,
        collaborationRunId: referral.collaborationRunId,
        referralTraceId: referral.referralTraceId,
      });
      intentWritten = true;
    } catch {
      intentWritten = false;
    }

    if (!intentWritten) {
      await this.failReferralQuietly(referralId, LEDGER_INTENT_FAILURE);
      throw new Error(LEDGER_INTENT_FAILURE);
    }

    try {
      await this.startReferralExecution({
        referralId,
        executionId,
        sessionId: job.sessionId,
        conversationId: job.conversationId,
        userId,
        apiKeyId: job.apiKeyId,
        prompt: job.prompt,
        workspaceContext: job.workspaceContext ?? undefined,
        provider: job.provider,
        adapter: job.adapter,
        model: job.model ?? undefined,
        globalInstructions: job.globalInstructions ?? undefined,
        projectInstructions: job.projectInstructions ?? undefined,
        submittedAt,
        orchestrationPriority: job.orchestrationPriority ?? undefined,
      });
    } catch (error) {
      await this.failReferralQuietly(
        referralId,
        'Failed to enqueue referral execution',
      );
      throw error;
    }

    return executionId;
  }

  private async settleCollaborationRun(
    collaborationRunId: CollaborationRunId,
    referrals: readonly CollaborationReferral[],
  ): Promise<CollaborationRun | null> {
    const entity = await this.runRepo.findOne({
      where: { collaborationRunId },
    });
    if (!entity) {
      return null;
    }
    if (entity.status !== 'active' || referrals.length === 0) {
      return this.toCollaborationRun(entity);
    }

    const openStatuses: readonly ReferralStatus[] = [
      'pending_approval',
      'approved',
      'in_progress',
    ];
    if (referrals.some((referral) => openStatuses.includes(referral.status))) {
      return this.toCollaborationRun(entity);
    }

    const anyFailed = referrals.some(
      (referral) =>
        referral.status === 'failed' || referral.status === 'timed_out',
    );
    const approvedOnes = referrals.filter(
      (referral) => referral.status !== 'rejected',
    );
    const everyApprovedCompleted =
      approvedOnes.length > 0 &&
      approvedOnes.every((referral) => referral.status === 'completed');
    const onlyRejected = approvedOnes.length === 0;
    const now = new Date();

    if (anyFailed || onlyRejected) {
      entity.status = 'failed';
      entity.failedAt = now;
      entity.updatedAt = now;
      return this.toCollaborationRun(await this.runRepo.save(entity));
    }
    if (everyApprovedCompleted) {
      entity.status = 'completed';
      entity.completedAt = now;
      entity.updatedAt = now;
      return this.toCollaborationRun(await this.runRepo.save(entity));
    }
    return this.toCollaborationRun(entity);
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
      prompt: entity.pendingJob?.prompt ?? null,
      decidedBy: entity.pendingJob?.decidedBy ?? null,
      handoffNote: entity.pendingJob?.handoffNote ?? null,
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
    entity.pendingJob = input.pendingJob ?? null;
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

  private async syncReferralFromExecution(
    referralId: ReferralId,
  ): Promise<CollaborationReferral> {
    const entity = await this.referralRepo.findOne({
      where: { referralId },
    });
    if (!entity) {
      throw new Error(`Referral ${referralId} not found`);
    }
    if (entity.status !== 'in_progress' || !entity.executionId || !this.executionResultService) {
      return this.toReferral(entity);
    }

    const execution = await this.executionResultService.getExecution(entity.executionId);
    const outcome = this.classifyStoredExecution(execution);
    if (outcome.kind === 'succeeded') {
      await this.completeReferral({
        referralId,
        summary: outcome.summary,
      });
      await this.maybeRequestHandoff(referralId, outcome.summary);
      const updated = await this.getReferral(referralId);
      if (!updated) {
        throw new Error(`Referral ${referralId} not found`);
      }
      return updated;
    }
    if (outcome.kind === 'failed') {
      return this.failReferral({
        referralId,
        summary: outcome.summary,
      });
    }

    return this.toReferral(entity);
  }

  private classifyStoredExecution(execution: StoredExecution): ExecutionReadBack {
    const status = execution?.execution_status;
    if (status === 'completed') {
      return {
        kind: 'succeeded',
        summary: this.readAnswerText(execution?.metadata),
      };
    }
    if (status && FINISHED_FAILURE_EXECUTION_STATUSES.includes(status)) {
      const answer = this.readAnswerText(execution?.metadata);
      let summary = `Execution ${status}`;
      if (answer.length > 0) {
        summary = answer;
      } else {
        const storedReason = readStoredExecutionFailureReason(execution?.metadata);
        if (storedReason.length > 0) {
          summary = storedReason;
        }
      }
      return {
        kind: 'failed',
        summary,
      };
    }

    return { kind: 'unfinished' };
  }

  private readAnswerText(metadata: unknown): string {
    if (!this.isRecord(metadata)) {
      return '';
    }
    const result = metadata.aiExecutionResult;
    if (!this.isRecord(result)) {
      return '';
    }
    return typeof result.output === 'string' ? result.output : '';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private async failReferralQuietly(referralId: ReferralId, summary: string): Promise<void> {
    try {
      await this.failReferral({ referralId, summary });
    } catch {
      // A referral that is already terminal cannot be failed again.
    }
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

  async sweepCollaborations(now: Date = new Date()): Promise<void> {
    const inProgress = await this.referralRepo.find({
      where: { status: 'in_progress' },
    });
    for (const referral of inProgress) {
      try {
        await this.syncReferralFromExecution(referral.referralId);
      } catch (error) {
        this.logWithoutContents('collaboration.sweep_item_failed', error);
      }
    }

    const waiting = await this.referralRepo.find({
      where: { status: 'pending_approval' },
    });
    for (const referral of waiting) {
      if (!this.isAtLeastAge(referral.createdAt, now, COLLABORATION_WAITING_MAX_AGE_MS)) {
        continue;
      }
      try {
        await this.timeoutWaitingHandoff(referral.referralId, now);
      } catch (error) {
        this.logWithoutContents('collaboration.sweep_item_failed', error);
      }
    }

    const activeRuns = await this.runRepo.find({
      where: { status: 'active' },
    });
    for (const run of activeRuns) {
      try {
        await this.finishOrFailRun(run.collaborationRunId, now);
      } catch (error) {
        this.logWithoutContents('collaboration.sweep_item_failed', error);
      }
    }
  }

  private async preparePendingReferral(input: CreatePendingReferralInput): Promise<{
    agents: CollaborationListedAgent[] | null;
    callerProjectInstructions: string | null;
    projectInstructions: string | null;
    fileAccess: boolean;
  }> {
    const parentId = input.parentReferralTraceId?.trim() || null;
    if (input.agents !== undefined && parentId) {
      throw new BadRequestException('agents are only accepted on the first hand-off');
    }
    if (input.fileAccess !== undefined && parentId) {
      throw new BadRequestException('fileAccess is only accepted on the first hand-off');
    }

    let parent: CollaborationReferralEntity | null = null;
    if (parentId) {
      parent = await this.referralRepo.findOne({
        where: {
          collaborationRunId: input.collaborationRunId,
          referralTraceId: parentId,
        },
      });
      if (!parent) {
        throw new Error(`Parent referral trace ${parentId} is not in this run`);
      }
    }

    let agents: CollaborationListedAgent[] | null = null;
    if (!parent) {
      if (input.agents !== undefined) {
        const read = readCollaborationAgents(input.agents);
        if ('message' in read) {
          throw new BadRequestException(read.message);
        }
        agents = read.agents;
      }
    } else {
      agents = this.copyStoredAgents(parent.pendingJob?.agents);
    }

    if (
      agents &&
      !agents.some((agent) => agent.name === input.targetBuilder.builderProfileId)
    ) {
      throw new BadRequestException(
        `Target ${input.targetBuilder.builderProfileId} is not on the agent list`,
      );
    }

    const callerProjectInstructions =
      input.projectInstructions !== undefined
        ? input.projectInstructions
        : (parent?.pendingJob?.callerProjectInstructions ?? null);
    let projectInstructions = agents
      ? buildCollaborationProjectInstructions({
          callerInstructions: callerProjectInstructions,
          agents,
          agentName: input.targetBuilder.builderProfileId,
        })
      : callerProjectInstructions;
    if (
      projectInstructions &&
      input.targetBuilder.builderProfileId === COLLABORATION_WRITER_PROFILE_ID &&
      input.sourceBuilder.builderProfileId === COLLABORATION_REVIEWER_PROFILE_ID
    ) {
      projectInstructions = `${projectInstructions}\n\n${COLLABORATION_SEND_BACK_WRITER_INSTRUCTION}`;
    }
    const fileAccess = parent
      ? parent.pendingJob?.fileAccess === true
      : input.fileAccess === true;

    return { agents, callerProjectInstructions, projectInstructions, fileAccess };
  }

  private withHarnessEntitlementProof<
    T extends {
      executionId: string;
      userId: string;
      apiKeyId: string;
      submittedAt: string;
      harnessVersion?: string;
    },
  >(
    payload: T,
  ): T & {
    harnessEntitlementProof?: ReturnType<typeof createHarnessEntitlementProof>;
  } {
    if (payload.harnessVersion !== 'v1') {
      return payload;
    }
    const secret = readValidatedHarnessEntitlementHmacSecret();
    if (secret === undefined) {
      throw new InternalServerErrorException(HARNESS_PROOF_UNAVAILABLE);
    }
    try {
      const harnessEntitlementProof = createHarnessEntitlementProof({
        executionId: payload.executionId,
        userId: payload.userId,
        apiKeyId: payload.apiKeyId,
        issuedAt: payload.submittedAt,
        payloadWithoutProof: payload as unknown as Record<string, unknown>,
        secret,
      });
      return { ...payload, harnessEntitlementProof };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(HARNESS_PROOF_UNAVAILABLE);
    }
  }

  private copyStoredAgents(
    value: readonly CollaborationListedAgent[] | null | undefined,
  ): CollaborationListedAgent[] | null {
    if (!Array.isArray(value) || value.length === 0) {
      return null;
    }
    return value.map((agent) => ({
      name: agent.name,
      instructions: agent.instructions,
    }));
  }

  private async maybeRequestHandoff(referralId: ReferralId, answer: string): Promise<void> {
    try {
      await this.requestHandoffFromAnswer(referralId, answer);
    } catch (error) {
      this.logWithoutContents('collaboration.answer_handoff_failed', error);
      try {
        await this.rememberHandoffNote(referralId, 'refused: refused');
      } catch (noteError) {
        this.logWithoutContents('collaboration.answer_handoff_note_failed', noteError);
      }
    }
  }

  private async requestHandoffFromAnswer(
    referralId: ReferralId,
    answer: string,
  ): Promise<void> {
    await this.captureWriterWorkDiff(referralId);
    const entity = await this.referralRepo.findOne({
      where: { referralId },
    });
    if (!entity?.pendingJob) {
      return;
    }
    const agents = this.copyStoredAgents(entity.pendingJob.agents);
    if (!agents || entity.pendingJob.handoffNote) {
      return;
    }

    const idempotencyKey = answerHandoffIdempotencyKey(referralId);
    const existing = await this.findActiveIdempotentReferral(
      this.referralRepo,
      entity.collaborationRunId,
      idempotencyKey,
    );
    if (existing) {
      return;
    }

    const parsed = parseHandoffRequest(answer);
    if (parsed.kind === 'none') {
      return;
    }
    if (parsed.kind === 'malformed') {
      await this.rememberHandoffNote(referralId, `malformed: ${parsed.reason}`);
      return;
    }
    if (parsed.kind === 'too_long') {
      this.auditAnswerRefusal(entity, parsed.to, 'task_too_long');
      await this.rememberHandoffNote(referralId, 'refused: task_too_long');
      return;
    }
    if (!agents.some((agent) => agent.name === parsed.to)) {
      this.auditAnswerRefusal(entity, parsed.to, 'agent_not_on_list');
      await this.rememberHandoffNote(referralId, 'refused: agent_not_on_list');
      return;
    }

    const job = entity.pendingJob;
    let prompt = buildRequestedHandoffPrompt(parsed.task, parsed.answerWithoutRequest);
    const storedDiff = job.workDiff;
    if (
      storedDiff &&
      entity.targetBuilderProfileId === COLLABORATION_WRITER_PROFILE_ID &&
      parsed.to === COLLABORATION_REVIEWER_PROFILE_ID
    ) {
      prompt = appendSavePointDiff(prompt, storedDiff.text, storedDiff.unavailable);
    }
    try {
      await this.createPendingReferral({
        collaborationRunId: entity.collaborationRunId,
        sourceBuilder: {
          agentRole: entity.targetAgentRole,
          builderProfileId: entity.targetBuilderProfileId,
        },
        targetBuilder: {
          agentRole: 'builder',
          builderProfileId: parsed.to,
        },
        idempotencyKey,
        sessionId: job.sessionId,
        conversationId: job.conversationId,
        apiKeyId: job.apiKeyId,
        prompt,
        provider: job.provider,
        adapter: job.adapter,
        model: job.model ?? undefined,
        workspaceContext: job.workspaceContext ?? undefined,
        globalInstructions: job.globalInstructions ?? undefined,
        parentReferralTraceId: entity.referralTraceId,
        timeoutMs: entity.timeoutMs,
        orchestrationPriority: job.orchestrationPriority ?? undefined,
        constraints: {
          timeoutMs: entity.constraintTimeoutMs,
          maxDepth: entity.constraintMaxDepth,
          maxAgentsPerCollaboration: entity.constraintMaxAgentsPerCollaboration,
          readOnly: entity.constraintReadOnly,
          allowWriteTools: entity.constraintAllowWriteTools,
          allowedTools: [...(entity.constraintAllowedTools ?? [])],
        },
      });
    } catch (error) {
      const reason = this.classifyRefusal(error);
      await this.rememberHandoffNote(referralId, `refused: ${reason}`);
      if (reason === 'refused') {
        this.logWithoutContents('collaboration.answer_handoff_failed', error);
      }
    }
  }

  private auditAnswerRefusal(
    entity: CollaborationReferralEntity,
    targetName: string,
    reason: 'task_too_long' | 'agent_not_on_list',
  ): void {
    this.emitAuditEvent({
      eventType: 'orchestration.safety_limit_breached',
      collaborationRunId: entity.collaborationRunId,
      referralTraceId: entity.referralTraceId,
      sourceBuilder: {
        agentRole: entity.targetAgentRole,
        builderProfileId: entity.targetBuilderProfileId,
      },
      targetBuilder: {
        agentRole: 'builder',
        builderProfileId: targetName,
      },
      payload: {
        lifecycleEvent: 'answer_handoff_refused',
        reason,
        limitType: reason,
        referralId: entity.referralId,
        targetBuilderProfileId: targetName,
      },
    });
  }

  private classifyRefusal(error: unknown): string {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('loop detected')) {
      return 'loop';
    }
    if (message.includes('exceeds max depth')) {
      return 'depth';
    }
    if (message.includes('Max agents')) {
      return 'agent_limit';
    }
    if (message.includes('Handoff limit')) {
      return 'handoff_limit';
    }
    if (message.includes('not on the agent list')) {
      return 'agent_not_on_list';
    }
    return 'refused';
  }

  private async captureWriterWorkDiff(referralId: ReferralId): Promise<void> {
    try {
      const entity = await this.referralRepo.findOne({ where: { referralId } });
      if (
        !entity?.pendingJob ||
        entity.pendingJob.workDiff ||
        entity.targetBuilderProfileId !== COLLABORATION_WRITER_PROFILE_ID
      ) {
        return;
      }
      if (!entity.executionId || !this.executionResultService) {
        return;
      }
      const execution = await this.executionResultService.getExecution(entity.executionId);
      const savePoint = readCollaborationHandoffWork(execution?.metadata).savePoint;
      if (!savePoint) {
        return;
      }
      const sessionId = entity.pendingJob.sessionId;
      if (!this.containerManagerClient || sessionId.trim().length === 0) {
        await this.rememberWorkDiff(referralId, { text: '', unavailable: true });
        return;
      }
      const result = await this.containerManagerClient.getWorkingTreeDiff(sessionId, savePoint);
      if (!result || typeof result.diff !== 'string') {
        await this.rememberWorkDiff(referralId, { text: '', unavailable: true });
        return;
      }
      await this.rememberWorkDiff(referralId, { text: result.diff, unavailable: false });
    } catch (error) {
      this.logWithoutContents('collaboration.work_diff_failed', error);
      try {
        await this.rememberWorkDiff(referralId, { text: '', unavailable: true });
      } catch (noteError) {
        this.logWithoutContents('collaboration.work_diff_note_failed', noteError);
      }
    }
  }

  private async rememberWorkDiff(
    referralId: ReferralId,
    workDiff: { text: string; unavailable: boolean },
  ): Promise<void> {
    const entity = await this.referralRepo.findOne({ where: { referralId } });
    if (!entity?.pendingJob || entity.pendingJob.workDiff) {
      return;
    }
    entity.pendingJob = {
      ...entity.pendingJob,
      workDiff,
    };
    entity.updatedAt = new Date();
    await this.referralRepo.save(entity);
  }

  private async rememberHandoffNote(referralId: ReferralId, note: string): Promise<void> {
    const entity = await this.referralRepo.findOne({
      where: { referralId },
    });
    if (!entity?.pendingJob || entity.pendingJob.handoffNote) {
      return;
    }
    entity.pendingJob = {
      ...entity.pendingJob,
      handoffNote: note,
    };
    entity.updatedAt = new Date();
    await this.referralRepo.save(entity);
  }

  private async timeoutWaitingHandoff(referralId: ReferralId, now: Date): Promise<void> {
    const existing = await this.referralRepo.findOne({
      where: { referralId },
    });
    if (
      !existing ||
      existing.status !== 'pending_approval' ||
      !this.isAtLeastAge(existing.createdAt, now, COLLABORATION_WAITING_MAX_AGE_MS)
    ) {
      return;
    }

    const updated = await this.referralRepo.update(
      { referralId, status: 'pending_approval' },
      {
        status: 'timed_out',
        timedOutAt: now,
        updatedAt: now,
        resultStatus: 'failed',
        resultSummary: HANDOFF_WAIT_TIMEOUT_REASON,
      },
    );
    if ((updated.affected ?? 0) < 1) {
      return;
    }

    const entity = await this.referralRepo.findOne({
      where: { referralId },
    });
    if (!entity) {
      return;
    }
    const run = await this.runRepo.findOne({
      where: { collaborationRunId: entity.collaborationRunId },
    });
    this.emitAuditEvent({
      eventType: 'orchestration.referral_timed_out',
      collaborationRunId: entity.collaborationRunId,
      referralTraceId: entity.referralTraceId,
      sourceBuilder: {
        agentRole: entity.sourceAgentRole,
        builderProfileId: entity.sourceBuilderProfileId,
      },
      targetBuilder: {
        agentRole: entity.targetAgentRole,
        builderProfileId: entity.targetBuilderProfileId,
      },
      payload: {
        lifecycleEvent: 'referral_timed_out',
        status: 'timed_out',
        reason: HANDOFF_WAIT_TIMEOUT_REASON,
        referralId: entity.referralId,
        userId: run?.userId ?? null,
        projectId: run?.projectId ?? null,
      },
    });
  }

  private async finishOrFailRun(
    collaborationRunId: CollaborationRunId,
    now: Date,
  ): Promise<void> {
    const entity = await this.runRepo.findOne({
      where: { collaborationRunId },
    });
    if (!entity || entity.status !== 'active') {
      return;
    }
    const rows = await this.referralRepo.find({
      where: { collaborationRunId },
    });
    if (rows.length === 0) {
      if (this.isAtLeastAge(entity.createdAt, now, COLLABORATION_WAITING_MAX_AGE_MS)) {
        entity.status = 'failed';
        entity.failedAt = now;
        entity.updatedAt = now;
        await this.runRepo.save(entity);
      }
      return;
    }
    await this.settleCollaborationRun(
      collaborationRunId,
      rows.map((row) => this.toReferral(row)),
    );
  }

  private isAtLeastAge(createdAt: Date, now: Date, maxAgeMs: number): boolean {
    const createdMs = new Date(createdAt).getTime();
    if (!Number.isFinite(createdMs)) {
      return false;
    }
    return now.getTime() - createdMs >= maxAgeMs;
  }

  private logWithoutContents(event: string, error: unknown): void {
    const errorName = error instanceof Error ? error.name : 'Error';
    this.logger.error(JSON.stringify({ event, errorName }));
  }
}
