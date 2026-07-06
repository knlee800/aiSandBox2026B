/**
 * Governance Drift Guard — Roadmap Consistency Checker
 *
 * Compares task states in AINOW-EXECUTION-ROADMAP.md against TASKS.md
 * and TASKS_BACKLOG_FULL.md. Surfaces any state disagreements.
 */

import {
  DriftIssue,
  GovernanceSnapshot,
  NormalizedTaskState,
  RoadmapAlignmentResult,
  TaskRecord,
} from './drift-state.types';

// States that are considered "terminal" — once here, transitions are final
const TERMINAL_STATES: NormalizedTaskState[] = ['COMPLETE', 'LOCKED'];

// States that indicate ongoing work
const ACTIVE_STATES: NormalizedTaskState[] = ['ACTIVE', 'IMPLEMENTED', 'REVIEWED', 'CONSOLIDATED'];

function statesConflict(a: NormalizedTaskState, b: NormalizedTaskState): boolean {
  // Terminal vs active is a definitive conflict
  if (TERMINAL_STATES.includes(a) && ACTIVE_STATES.includes(b)) return true;
  if (ACTIVE_STATES.includes(a) && TERMINAL_STATES.includes(b)) return true;

  // COMPLETE vs ACTIVE is the most critical conflict
  if (a === 'COMPLETE' && b === 'ACTIVE') return true;
  if (a === 'ACTIVE' && b === 'COMPLETE') return true;
  if (a === 'LOCKED' && b === 'ACTIVE') return true;
  if (a === 'ACTIVE' && b === 'LOCKED') return true;

  return false;
}

function buildMismatchIssue(
  taskId: string,
  roadmapRecord: TaskRecord,
  otherRecord: TaskRecord,
): DriftIssue {
  return {
    kind: 'ROADMAP_STATE_MISMATCH',
    taskId,
    description:
      `ROADMAP shows "${roadmapRecord.rawState}" but ` +
      `${otherRecord.source} shows "${otherRecord.rawState}"`,
    severity: 'ERROR',
    sources: ['ROADMAP', otherRecord.source],
  };
}

// ─── Main checker ─────────────────────────────────────────────────────────────

export function checkRoadmapConsistency(snapshot: GovernanceSnapshot): RoadmapAlignmentResult {
  const mismatches: DriftIssue[] = [];

  // Index TASKS and BACKLOG by taskId for O(1) lookup
  const tasksIndex = new Map<string, TaskRecord>(snapshot.tasks.map((r) => [r.taskId, r]));
  const backlogIndex = new Map<string, TaskRecord>(snapshot.backlog.map((r) => [r.taskId, r]));

  for (const roadmapRecord of snapshot.roadmap) {
    const taskId = roadmapRecord.taskId;

    // Check against TASKS.md
    const tasksRecord = tasksIndex.get(taskId);
    if (tasksRecord && statesConflict(roadmapRecord.state, tasksRecord.state)) {
      mismatches.push(buildMismatchIssue(taskId, roadmapRecord, tasksRecord));
    }

    // Check against BACKLOG
    const backlogRecord = backlogIndex.get(taskId);
    if (backlogRecord && statesConflict(roadmapRecord.state, backlogRecord.state)) {
      mismatches.push(buildMismatchIssue(taskId, roadmapRecord, backlogRecord));
    }

    // If ROADMAP marks a task COMPLETE/LOCKED, warn if it appears nowhere else
    const inTasks = !!tasksRecord;
    const inBacklog = !!backlogRecord;
    if (!inTasks && !inBacklog) {
      mismatches.push({
        kind: 'TASK_ONLY_IN_ONE_SOURCE',
        taskId,
        description: `Task "${taskId}" is referenced in ROADMAP but not found in TASKS or BACKLOG`,
        severity: 'WARNING',
        sources: ['ROADMAP'],
      });
    }
  }

  // Check for tasks ACTIVE in TASKS but not reflected in ROADMAP
  const roadmapIndex = new Map<string, TaskRecord>(snapshot.roadmap.map((r) => [r.taskId, r]));

  for (const tasksRecord of snapshot.tasks) {
    if (tasksRecord.state !== 'ACTIVE') continue;
    const roadmapRecord = roadmapIndex.get(tasksRecord.taskId);
    if (!roadmapRecord) {
      mismatches.push({
        kind: 'ROADMAP_STATE_MISMATCH',
        taskId: tasksRecord.taskId,
        description: `Task "${tasksRecord.taskId}" is ACTIVE in TASKS but not tracked in ROADMAP`,
        severity: 'WARNING',
        sources: ['TASKS'],
      });
    } else if (statesConflict(tasksRecord.state, roadmapRecord.state)) {
      mismatches.push(buildMismatchIssue(tasksRecord.taskId, roadmapRecord, tasksRecord));
    }
  }

  return {
    aligned: mismatches.length === 0,
    mismatches,
  };
}
