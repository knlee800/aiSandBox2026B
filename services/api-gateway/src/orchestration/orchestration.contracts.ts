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
export const MAX_HANDOFFS_PER_RUN = 8;
/** Reviewer to writer, then writer back to reviewer. Depth does not apply to those two edges. */
export const MAX_SEND_BACK_ROUNDS = 2;
/**
 * COS-FRONTDOOR-01B D16: a front-door round is one dispatch from the Chief of
 * Staff and the server's report-back. Depth does not apply to those two edges.
 */
export const MAX_FRONT_DOOR_ROUNDS = 2;
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
  readonly prompt: string | null;
  readonly decidedBy: string | null;
  readonly handoffNote: string | null;
  readonly result: ReferralResult | null;
}

export interface CollaborationListedAgent {
  readonly name: string;
  readonly instructions: string;
  /** COS-FRONTDOOR-01B D13: what the other agents read about this one. Server-set only. */
  readonly label?: string;
  readonly summary?: string;
}

/**
 * BIZ-USER-01C D4: a user workflow run's snapshot, written at start from the
 * owner's stored row. The run's prompt, version and access are the row as it
 * was at start. Orchestration-internal; not a job field and not signed.
 */
export interface ReferralPendingWorkflow {
  readonly id: string;
  /** Display only: the workflow's name at start. */
  readonly name: string;
  /** agentVersionFor over the row's material at start (D6). */
  readonly version: string;
  /** Catalogue scope ids at start, in catalogue order. */
  readonly knowledgeScopeIds: readonly string[];
  /** Allowlisted connector tool ids at start. Grants still need a connection at enqueue. */
  readonly connectorToolIds: readonly string[];
  readonly model:
    | { readonly choice: 'server' }
    | { readonly choice: 'platform'; readonly id: string };
  readonly testRun: boolean;
  readonly budgetPerRunCredits: number | null;
  readonly budgetPerDayCredits: number | null;
}

export interface ReferralPendingJob {
  readonly sessionId: string;
  readonly conversationId: string;
  readonly apiKeyId: string;
  readonly prompt: string;
  readonly provider: string;
  readonly adapter: string;
  readonly model: string | null;
  readonly workspaceContext: unknown;
  readonly globalInstructions: string | null;
  readonly projectInstructions: string | null;
  readonly orchestrationPriority: number | null;
  readonly decidedBy: string | null;
  readonly decisionReason: string | null;
  readonly agents?: readonly CollaborationListedAgent[] | null;
  readonly callerProjectInstructions?: string | null;
  readonly handoffNote?: string | null;
  /** Set once the answer has been decided for a hand-off. The page does not read this field. */
  readonly handoffChecked?: boolean;
  /** First hand-off opt-in. Children inherit it. True requests a signed harness job. */
  readonly fileAccess?: boolean;
  /** Working-tree diff captured when a writer step finishes. Stored for the page and the reviewer. */
  readonly workDiff?: {
    readonly text: string;
    readonly unavailable: boolean;
  } | null;
  /** BIZ-USER-01C D4: set on the first hand-off of a user workflow run only. */
  readonly workflow?: ReferralPendingWorkflow | null;
  /**
   * COS-FRONTDOOR-01B D10: on the first hand-off of a front-door run only, one
   * snapshot per usable workflow member. A child whose target is one of them
   * copies its own snapshot into `workflow` (D12). Orchestration-internal.
   */
  readonly rosterWorkflows?: readonly ReferralPendingWorkflow[] | null;
  /** COS-FRONTDOOR-01B D14: set once the report-back for this agent step was decided. */
  readonly reportBackChecked?: boolean;
  /**
   * USER-TEAMS-01B D4: the run's lead in a team run (`chief-of-staff` or the
   * lead workflow's row id). Set by the server on the first hand-off when the
   * agent list holds the lead and at least one member, copied to every child.
   * Never read from a request body. Orchestration-internal; not a job field.
   */
  readonly teamLeadId?: string;
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
  | 'orchestration.referral_prompt_edited'
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
