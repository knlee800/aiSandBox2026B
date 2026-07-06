/**
 * Governance Drift Guard — Type Definitions
 *
 * Canonical state model for task lifecycle tracking across
 * TASKS.md, TASKS_BACKLOG_FULL.md, and AINOW-EXECUTION-ROADMAP.md.
 */

// ─── Normalized task lifecycle states ────────────────────────────────────────

export type NormalizedTaskState =
  | 'REGISTERED'
  | 'ACTIVE'
  | 'IMPLEMENTED'
  | 'REVIEWED'
  | 'CONSOLIDATED'
  | 'COMPLETE'
  | 'LOCKED'
  | 'PROPOSED'
  | 'UNKNOWN';

// Ordered lifecycle sequence for validation
export const LIFECYCLE_ORDER: NormalizedTaskState[] = [
  'REGISTERED',
  'ACTIVE',
  'IMPLEMENTED',
  'REVIEWED',
  'CONSOLIDATED',
  'COMPLETE',
];

// ─── Source document identifiers ─────────────────────────────────────────────

export type GovernanceSource = 'TASKS' | 'BACKLOG' | 'ROADMAP';

// ─── Per-source task record ───────────────────────────────────────────────────

export interface TaskRecord {
  /** e.g. BILLING-READY-01, AGENT-HARNESS-05C9 */
  taskId: string;
  /** Human-readable name if available */
  name: string;
  /** Normalized state */
  state: NormalizedTaskState;
  /** Whether the task is marked LOCKED */
  locked: boolean;
  /** Whether a checkpoint reference was detected */
  hasCheckpoint: boolean;
  /** The source doc this record came from */
  source: GovernanceSource;
  /** Raw state string from the document before normalization */
  rawState: string;
}

// ─── Cross-file task view ─────────────────────────────────────────────────────

export interface TaskCrossView {
  taskId: string;
  tasks: Partial<Record<GovernanceSource, TaskRecord>>;
}

// ─── Drift issue types ────────────────────────────────────────────────────────

export type DriftIssueKind =
  | 'ACTIVE_COMPLETE_MISMATCH'
  | 'DUPLICATE_ACTIVE'
  | 'MISSING_CHECKPOINT'
  | 'LIFECYCLE_ORDER_VIOLATION'
  | 'ROADMAP_STATE_MISMATCH'
  | 'TASK_ONLY_IN_ONE_SOURCE'
  | 'LOCKED_TASK_MODIFIED';

export interface DriftIssue {
  kind: DriftIssueKind;
  taskId: string;
  description: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  sources: GovernanceSource[];
}

// ─── Snapshot of all governance docs ─────────────────────────────────────────

export interface GovernanceSnapshot {
  tasks: TaskRecord[];
  backlog: TaskRecord[];
  roadmap: TaskRecord[];
  /** ISO timestamp of when snapshot was taken */
  capturedAt: string;
}

// ─── Drift detection result ───────────────────────────────────────────────────

export interface DriftDetectionResult {
  status: 'OK' | 'DRIFT_DETECTED';
  summary: string;
  issues: DriftIssue[];
  taskStates: TaskCrossView[];
  roadmapAlignment: boolean;
  recommendedAction: string;
}

// ─── Lifecycle validation result ─────────────────────────────────────────────

export interface LifecycleValidationResult {
  valid: boolean;
  violations: DriftIssue[];
}

// ─── Roadmap alignment result ─────────────────────────────────────────────────

export interface RoadmapAlignmentResult {
  aligned: boolean;
  mismatches: DriftIssue[];
}
