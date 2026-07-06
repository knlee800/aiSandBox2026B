/**
 * Governance Drift Guard — Drift Report Builder
 *
 * Assembles the final structured JSON drift detection report from
 * snapshot + lifecycle validation + roadmap consistency results.
 */

import {
  DriftDetectionResult,
  DriftIssue,
  GovernanceSnapshot,
  GovernanceSource,
  TaskCrossView,
  TaskRecord,
} from './drift-state.types';
import { checkRoadmapConsistency } from './roadmap-consistency.checker';
import { validateLifecycle } from './task-lifecycle.validator';

// ─── Build cross-file task view ───────────────────────────────────────────────

function buildTaskCrossViews(snapshot: GovernanceSnapshot): TaskCrossView[] {
  const index = new Map<string, Partial<Record<GovernanceSource, TaskRecord>>>();

  const addRecords = (records: TaskRecord[]) => {
    for (const record of records) {
      const view = index.get(record.taskId) ?? {};
      view[record.source] = record;
      index.set(record.taskId, view);
    }
  };

  addRecords(snapshot.tasks);
  addRecords(snapshot.backlog);
  addRecords(snapshot.roadmap);

  return Array.from(index.entries())
    .map(([taskId, tasks]) => ({ taskId, tasks }))
    .sort((a, b) => a.taskId.localeCompare(b.taskId));
}

// ─── Summarise issues ─────────────────────────────────────────────────────────

function buildSummary(issues: DriftIssue[], aligned: boolean): string {
  if (issues.length === 0 && aligned) {
    return 'All governance sources are consistent. No drift detected.';
  }

  const errors = issues.filter((i) => i.severity === 'ERROR').length;
  const warnings = issues.filter((i) => i.severity === 'WARNING').length;

  const parts: string[] = [];
  if (!aligned) parts.push('ROADMAP alignment failure');
  if (errors > 0) parts.push(`${errors} error(s)`);
  if (warnings > 0) parts.push(`${warnings} warning(s)`);

  return `Drift detected: ${parts.join(', ')}.`;
}

// ─── Recommended action ───────────────────────────────────────────────────────

function buildRecommendedAction(issues: DriftIssue[], aligned: boolean): string {
  const errorIssues = issues.filter((i) => i.severity === 'ERROR');

  if (errorIssues.length === 0 && aligned) {
    return 'No action required. Proceed with the next governance-approved task transition.';
  }

  const kinds = new Set(errorIssues.map((i) => i.kind));

  if (kinds.has('ACTIVE_COMPLETE_MISMATCH')) {
    return (
      'BLOCK: Resolve ACTIVE/COMPLETE state mismatch across files before any lifecycle transition. ' +
      'Update the file that has the incorrect state to match the authoritative source (TASKS.md).'
    );
  }

  if (kinds.has('DUPLICATE_ACTIVE')) {
    return (
      'BLOCK: Only one task may be ACTIVE at a time. ' +
      'Consolidate or deregister the extra ACTIVE task before proceeding.'
    );
  }

  if (kinds.has('ROADMAP_STATE_MISMATCH')) {
    return (
      'REVIEW: Synchronize ROADMAP state entries with TASKS.md. ' +
      'ROADMAP should reflect the canonical state from TASKS.md.'
    );
  }

  if (issues.some((i) => i.kind === 'MISSING_CHECKPOINT')) {
    return (
      'WARNING: One or more COMPLETE tasks are missing checkpoint references. ' +
      'Ensure a checkpoint doc exists under docs/ for each completed task.'
    );
  }

  return 'Review all flagged issues and align governance sources before the next task transition.';
}

// ─── Public report builder ────────────────────────────────────────────────────

export function buildDriftReport(snapshot: GovernanceSnapshot): DriftDetectionResult {
  const lifecycleResult = validateLifecycle(snapshot);
  const roadmapResult = checkRoadmapConsistency(snapshot);

  const allIssues: DriftIssue[] = [
    ...lifecycleResult.violations,
    ...roadmapResult.mismatches,
  ];

  // Deduplicate by kind+taskId
  const seen = new Set<string>();
  const uniqueIssues = allIssues.filter((issue) => {
    const key = `${issue.kind}::${issue.taskId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const hasDrift =
    !lifecycleResult.valid ||
    !roadmapResult.aligned ||
    uniqueIssues.some((i) => i.severity === 'ERROR');

  return {
    status: hasDrift ? 'DRIFT_DETECTED' : 'OK',
    summary: buildSummary(uniqueIssues, roadmapResult.aligned),
    issues: uniqueIssues,
    taskStates: buildTaskCrossViews(snapshot),
    roadmapAlignment: roadmapResult.aligned,
    recommendedAction: buildRecommendedAction(uniqueIssues, roadmapResult.aligned),
  };
}
