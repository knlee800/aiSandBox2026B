/**
 * AGENT-PLATFORM-07A: Coordinator Contracts / Schema
 *
 * TypeScript-only contracts for read-only orchestration coordination.
 * No runtime orchestration behavior, no module wiring, no DB entities.
 */

// ---------------------------------------------------------------------------
// ID aliases
// ---------------------------------------------------------------------------

export type CollaborationRunId = string;
export type ReferralTraceId = string;
export type ReferralId = string;
export type BuilderProfileId = string;
export type UserId = string;
export type ProjectId = string;
export type SessionId = string;
export type ConversationId = string;
export type IdempotencyKey = string;
export type IsoTimestamp = string;

// ---------------------------------------------------------------------------
// Agent identity
// ---------------------------------------------------------------------------

export type CollaborationAgentRole =
  | 'builder'
  | 'chief-of-staff'
  | 'product-strategy'
  | 'technology-advisor';

export interface CollaborationAgentIdentity {
  readonly agentRole: CollaborationAgentRole;
  readonly builderProfileId: BuilderProfileId;
}

export type SourceBuilderIdentity = CollaborationAgentIdentity;
export type TargetBuilderIdentity = CollaborationAgentIdentity;

// ---------------------------------------------------------------------------
// Status / mode unions
// ---------------------------------------------------------------------------

export const COLLABORATION_RUN_STATUSES = [
  'active',
  'completed',
  'failed',
  'cancelled',
  'timed_out',
] as const;

export type CollaborationRunStatus = (typeof COLLABORATION_RUN_STATUSES)[number];

export const REFERRAL_STATUSES = [
  'pending_approval',
  'approved',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
  'timed_out',
  'rejected',
] as const;

export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export const REFERRAL_RESULT_STATUSES = ['success', 'partial', 'failed'] as const;
export type ReferralResultStatus = (typeof REFERRAL_RESULT_STATUSES)[number];

export const REFERRAL_CANCEL_STATUSES = [
  'not_requested',
  'requested',
  'cancelled',
  'rejected',
] as const;

export type ReferralCancelStatus = (typeof REFERRAL_CANCEL_STATUSES)[number];

export const ORCHESTRATION_MODES = ['read_only'] as const;
export type OrchestrationMode = (typeof ORCHESTRATION_MODES)[number];

// ---------------------------------------------------------------------------
// Safety defaults / indicators
// ---------------------------------------------------------------------------

export const DEFAULT_MAX_REFERRAL_DEPTH = 3;
export const DEFAULT_MAX_AGENTS_PER_COLLABORATION = 4;
export const READ_ONLY_MODE_INDICATOR: OrchestrationMode = 'read_only';
export const NO_WRITE_TOOLS_INDICATOR = 'no_write_tools' as const;

export const READ_ONLY_ALLOWED_TOOL_IDS = ['list_files', 'read_file'] as const;
export const READ_ONLY_BLOCKED_TOOL_IDS = ['write_file', 'delete_file', 'run_validation'] as const;

// ---------------------------------------------------------------------------
// Core contracts
// ---------------------------------------------------------------------------

export interface ReferralConstraints {
  readonly timeoutMs: number;
  readonly maxDepth: number;
  readonly maxAgentsPerCollaboration: number;
  readonly readOnly: boolean;
  readonly allowWriteTools: boolean;
  readonly allowedTools: readonly string[];
}

export interface CollaborationRun {
  readonly collaborationRunId: CollaborationRunId;
  readonly userId: UserId;
  readonly projectId: ProjectId;
  readonly initiatorAgent: CollaborationAgentIdentity;
  readonly orchestrationMode: OrchestrationMode;
  readonly status: CollaborationRunStatus;
  readonly referralIds: readonly ReferralId[];
  readonly activeBuilderProfileIds: readonly BuilderProfileId[];
  readonly timeoutMs: number;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly completedAt: IsoTimestamp | null;
  readonly failedAt: IsoTimestamp | null;
  readonly timedOutAt: IsoTimestamp | null;
  readonly cancelRequestedAt: IsoTimestamp | null;
  readonly cancelledByUserId: UserId | null;
  readonly cancelReason: string | null;
}

export interface CollaborationReferral {
  readonly referralId: ReferralId;
  readonly collaborationRunId: CollaborationRunId;
  readonly referralTraceId: ReferralTraceId;
  readonly parentReferralTraceId: ReferralTraceId | null;
  readonly sourceBuilder: SourceBuilderIdentity;
  readonly targetBuilder: TargetBuilderIdentity;
  readonly status: ReferralStatus;
  readonly cancelStatus: ReferralCancelStatus;
  readonly idempotencyKey: IdempotencyKey;
  readonly referralChain: readonly BuilderProfileId[];
  readonly depth: number;
  readonly maxDepth: number;
  readonly visitedBuilderProfileIds: readonly BuilderProfileId[];
  readonly timeoutMs: number;
  readonly constraints: ReferralConstraints;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly completedAt: IsoTimestamp | null;
  readonly failedAt: IsoTimestamp | null;
  readonly timedOutAt: IsoTimestamp | null;
  readonly cancelRequestedAt: IsoTimestamp | null;
  readonly cancelledByUserId: UserId | null;
  readonly cancelReason: string | null;
  readonly result: ReferralResult | null;
}

export interface ReferralResult {
  readonly referralId: ReferralId;
  readonly referralTraceId: ReferralTraceId;
  readonly status: ReferralResultStatus;
  readonly summary: string;
  readonly outputFiles: readonly string[];
  readonly durationMs: number;
  readonly completedAt: IsoTimestamp | null;
  readonly failedAt: IsoTimestamp | null;
  readonly timedOutAt: IsoTimestamp | null;
}

export type OrchestrationAuditEventType =
  | 'orchestration.collaboration_created'
  | 'orchestration.referral_created'
  | 'orchestration.referral_approved'
  | 'orchestration.referral_rejected'
  | 'orchestration.referral_started'
  | 'orchestration.referral_completed'
  | 'orchestration.referral_failed'
  | 'orchestration.referral_cancelled'
  | 'orchestration.referral_timed_out'
  | 'orchestration.collaboration_completed'
  | 'orchestration.collaboration_cancelled'
  | 'orchestration.collaboration_timed_out'
  | 'orchestration.safety_limit_approached'
  | 'orchestration.safety_limit_breached';

export interface OrchestrationAuditEvent {
  readonly eventType: OrchestrationAuditEventType;
  readonly collaborationRunId: CollaborationRunId;
  readonly referralTraceId: ReferralTraceId | null;
  readonly sourceBuilder: SourceBuilderIdentity;
  readonly targetBuilder: TargetBuilderIdentity | null;
  readonly timestamp: IsoTimestamp;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ReadOnlyContextSnapshot {
  readonly projectId: ProjectId;
  readonly sessionId: SessionId;
  readonly conversationId: ConversationId;
  readonly sourceBuilderProfileId: BuilderProfileId;
  readonly selectedFilePath?: string;
  readonly contextFiles: readonly string[];
  readonly readOnlyAllowedTools: readonly string[];
  readonly capturedAt: IsoTimestamp;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ReferralCreateRequest {
  readonly collaborationRunId: CollaborationRunId;
  readonly parentReferralTraceId: ReferralTraceId | null;
  readonly sourceBuilder: SourceBuilderIdentity;
  readonly targetBuilder: TargetBuilderIdentity;
  readonly userId: UserId;
  readonly projectId: ProjectId;
  readonly sessionId: SessionId;
  readonly conversationId: ConversationId;
  readonly idempotencyKey: IdempotencyKey;
  readonly taskDescription: string;
  readonly contextSnapshot: ReadOnlyContextSnapshot;
  readonly constraints: ReferralConstraints;
  readonly referralChain: readonly BuilderProfileId[];
  readonly depth: number;
  readonly maxDepth: number;
  readonly visitedBuilderProfileIds: readonly BuilderProfileId[];
  readonly timeoutMs: number;
  readonly orchestrationPriority?: number;
}

// ---------------------------------------------------------------------------
// Queue/job future metadata shape
// ---------------------------------------------------------------------------

export interface OrchestrationJobMetadata {
  readonly collaborationRunId?: CollaborationRunId;
  readonly referralTraceId?: ReferralTraceId;
  readonly parentReferralTraceId?: ReferralTraceId;
  readonly referringBuilderProfileId?: BuilderProfileId;
  readonly orchestrationPriority?: number;
  readonly referralId?: ReferralId;
  readonly isReferralExecution?: boolean;
}
