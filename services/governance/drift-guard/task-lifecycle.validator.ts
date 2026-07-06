/**
 * Governance Drift Guard — Task Lifecycle Validator
 *
 * Enforces that tasks follow the approved lifecycle order:
 * REGISTERED → ACTIVE → IMPLEMENTED → REVIEWED → CONSOLIDATED → COMPLETE
 *
 * Also detects:
 * - ACTIVE/COMPLETE mismatches across source files
 * - Duplicate ACTIVE tasks (only one at a time)
 * - COMPLETE tasks missing checkpoint references
 */

import {
  DriftIssue,
  GovernanceSnapshot,
  LIFECYCLE_ORDER,
  LifecycleValidationResult,
  NormalizedTaskState,
  TaskRecord,
} from './drift-state.types';

// ─── Lifecycle ordering helpers ───────────────────────────────────────────────

function lifecycleIndex(state: NormalizedTaskState): number {
  const idx = LIFECYCLE_ORDER.indexOf(state);
  return idx === -1 ? -1 : idx;
}

function isOrderedBefore(a: NormalizedTaskState, b: NormalizedTaskState): boolean {
  const ia = lifecycleIndex(a);
  const ib = lifecycleIndex(b);
  if (ia === -1 || ib === -1) return true; // can't validate UNKNOWN/LOCKED/PROPOSED ordering
  return ia < ib;
}

// ─── Detect ACTIVE vs COMPLETE mismatch across files ─────────────────────────

function detectActiveCompleteMismatches(snapshot: GovernanceSnapshot): DriftIssue[] {
  const issues: DriftIssue[] = [];
  const allRecords = [...snapshot.tasks, ...snapshot.backlog, ...snapshot.roadmap];

  // Group by taskId
  const byTaskId = new Map<string, TaskRecord[]>();
  for (const record of allRecords) {
    const group = byTaskId.get(record.taskId) ?? [];
    group.push(record);
    byTaskId.set(record.taskId, group);
  }

  for (const [taskId, group] of byTaskId.entries()) {
    const hasActive = group.some((r) => r.state === 'ACTIVE');
    const hasComplete = group.some((r) => r.state === 'COMPLETE' || r.state === 'LOCKED');

    if (hasActive && hasComplete) {
      const activeSources = group
        .filter((r) => r.state === 'ACTIVE')
        .map((r) => r.source);
      const completeSources = group
        .filter((r) => r.state === 'COMPLETE' || r.state === 'LOCKED')
        .map((r) => r.source);

      issues.push({
        kind: 'ACTIVE_COMPLETE_MISMATCH',
        taskId,
        description:
          `Task "${taskId}" is marked ACTIVE in [${activeSources.join(', ')}] ` +
          `but COMPLETE/LOCKED in [${completeSources.join(', ')}]`,
        severity: 'ERROR',
        sources: [...new Set([...activeSources, ...completeSources])],
      });
    }
  }

  return issues;
}

// ─── Detect duplicate ACTIVE tasks ───────────────────────────────────────────

function detectDuplicateActiveTasks(snapshot: GovernanceSnapshot): DriftIssue[] {
  const issues: DriftIssue[] = [];

  // Only count tasks from TASKS source as "officially active"
  // (ROADMAP/BACKLOG may have incidental ACTIVE references during planning)
  const activeTasks = snapshot.tasks.filter((r) => r.state === 'ACTIVE');

  if (activeTasks.length > 1) {
    issues.push({
      kind: 'DUPLICATE_ACTIVE',
      taskId: activeTasks.map((r) => r.taskId).join(', '),
      description:
        `Multiple ACTIVE tasks detected in TASKS: ` +
        `[${activeTasks.map((r) => r.taskId).join(', ')}]. ` +
        `Only one task may be ACTIVE at a time per governance rules.`,
      severity: 'ERROR',
      sources: ['TASKS'],
    });
  }

  return issues;
}

// ─── Detect COMPLETE tasks missing checkpoint references ──────────────────────

function detectMissingCheckpoints(snapshot: GovernanceSnapshot): DriftIssue[] {
  const issues: DriftIssue[] = [];
  const allRecords = [...snapshot.tasks, ...snapshot.backlog, ...snapshot.roadmap];

  const seen = new Set<string>();

  for (const record of allRecords) {
    if (seen.has(record.taskId)) continue;
    if (record.state !== 'COMPLETE' && record.state !== 'LOCKED') continue;
    seen.add(record.taskId);

    if (!record.hasCheckpoint) {
      issues.push({
        kind: 'MISSING_CHECKPOINT',
        taskId: record.taskId,
        description: `Task "${record.taskId}" is marked ${record.state} but has no checkpoint reference near its state entry in ${record.source}`,
        severity: 'WARNING',
        sources: [record.source],
      });
    }
  }

  return issues;
}

// ─── Detect lifecycle order violations ───────────────────────────────────────
// Given a task that appears in multiple sources, the state should not regress.
// e.g. TASKS says IMPLEMENTED but ROADMAP says REGISTERED = backward regression.

function detectLifecycleOrderViolations(snapshot: GovernanceSnapshot): DriftIssue[] {
  const issues: DriftIssue[] = [];
  const allRecords = [...snapshot.tasks, ...snapshot.backlog, ...snapshot.roadmap];

  const byTaskId = new Map<string, TaskRecord[]>();
  for (const record of allRecords) {
    const group = byTaskId.get(record.taskId) ?? [];
    group.push(record);
    byTaskId.set(record.taskId, group);
  }

  for (const [taskId, group] of byTaskId.entries()) {
    // Filter to only trackable states
    const tracked = group.filter((r) => lifecycleIndex(r.state) !== -1);
    if (tracked.length < 2) continue;

    // Sort by lifecycle index descending — highest-state source is reference
    tracked.sort((a, b) => lifecycleIndex(b.state) - lifecycleIndex(a.state));
    const highest = tracked[0];

    for (let i = 1; i < tracked.length; i++) {
      const other = tracked[i];
      // If same state OK. If other < highest, that's a regression signal — INFO only
      // (different sources may be at different sync points)
      if (lifecycleIndex(other.state) < lifecycleIndex(highest.state) - 1) {
        issues.push({
          kind: 'LIFECYCLE_ORDER_VIOLATION',
          taskId,
          description:
            `Task "${taskId}" has state "${highest.state}" in ${highest.source} ` +
            `but "${other.state}" in ${other.source} — possible lifecycle regression or sync gap`,
          severity: 'WARNING',
          sources: [highest.source, other.source],
        });
        break; // one violation per task is sufficient
      }
    }
  }

  return issues;
}

// ─── Public validator ─────────────────────────────────────────────────────────

export function validateLifecycle(snapshot: GovernanceSnapshot): LifecycleValidationResult {
  const violations: DriftIssue[] = [
    ...detectActiveCompleteMismatches(snapshot),
    ...detectDuplicateActiveTasks(snapshot),
    ...detectMissingCheckpoints(snapshot),
    ...detectLifecycleOrderViolations(snapshot),
  ];

  return {
    valid: violations.every((v) => v.severity !== 'ERROR'),
    violations,
  };
}

// Re-export helpers for use in tests and report builder
export {
  detectActiveCompleteMismatches,
  detectDuplicateActiveTasks,
  detectLifecycleOrderViolations,
  detectMissingCheckpoints,
  isOrderedBefore,
  lifecycleIndex,
};
