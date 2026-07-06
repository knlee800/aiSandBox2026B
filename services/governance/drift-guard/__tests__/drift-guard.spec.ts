/**
 * Governance Drift Guard — Tests
 *
 * Covers:
 * - clean state (no drift)
 * - ACTIVE/COMPLETE mismatch detection
 * - duplicate ACTIVE task detection
 * - missing checkpoint detection
 * - lifecycle order violation detection
 * - roadmap consistency checking
 * - full report assembly
 * - snapshot parsing from inline markdown
 */

import { buildDriftReport } from '../drift-report.builder';
import {
  DriftDetectionResult,
  GovernanceSnapshot,
  TaskRecord,
} from '../drift-state.types';
import { checkRoadmapConsistency } from '../roadmap-consistency.checker';
import { parseMarkdownTasks } from '../task-state-snapshot';
import {
  detectActiveCompleteMismatches,
  detectDuplicateActiveTasks,
  detectMissingCheckpoints,
  lifecycleIndex,
  validateLifecycle,
} from '../task-lifecycle.validator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRecord(
  overrides: Partial<TaskRecord> & Pick<TaskRecord, 'taskId' | 'state' | 'source'>,
): TaskRecord {
  return {
    name: overrides.taskId,
    rawState: overrides.state,
    locked: overrides.state === 'LOCKED',
    hasCheckpoint: false,
    ...overrides,
  };
}

function makeSnapshot(
  tasks: TaskRecord[],
  backlog: TaskRecord[],
  roadmap: TaskRecord[],
): GovernanceSnapshot {
  return {
    tasks,
    backlog,
    roadmap,
    capturedAt: new Date().toISOString(),
  };
}

// ─── Lifecycle index ──────────────────────────────────────────────────────────

describe('lifecycleIndex', () => {
  it('assigns correct order to each lifecycle state', () => {
    expect(lifecycleIndex('REGISTERED')).toBe(0);
    expect(lifecycleIndex('ACTIVE')).toBe(1);
    expect(lifecycleIndex('IMPLEMENTED')).toBe(2);
    expect(lifecycleIndex('REVIEWED')).toBe(3);
    expect(lifecycleIndex('CONSOLIDATED')).toBe(4);
    expect(lifecycleIndex('COMPLETE')).toBe(5);
  });

  it('returns -1 for non-lifecycle states', () => {
    expect(lifecycleIndex('LOCKED')).toBe(-1);
    expect(lifecycleIndex('PROPOSED')).toBe(-1);
    expect(lifecycleIndex('UNKNOWN')).toBe(-1);
  });
});

// ─── Snapshot parser ──────────────────────────────────────────────────────────

describe('parseMarkdownTasks', () => {
  it('parses markdown table rows correctly', () => {
    const md = `
| Task ID | Name | Status |
|---------|------|--------|
| BILLING-READY-01 | Credit Ledger Foundation | COMPLETE and LOCKED |
| AGENT-HARNESS-06 | Canary Review | COMPLETE and LOCKED |
| AGENT-PLATFORM-02 | Dashboard Shell | ACTIVE |
`;
    const records = parseMarkdownTasks(md, 'ROADMAP');
    const ids = records.map((r) => r.taskId);
    expect(ids).toContain('BILLING-READY-01');
    expect(ids).toContain('AGENT-HARNESS-06');
    expect(ids).toContain('AGENT-PLATFORM-02');

    const billing = records.find((r) => r.taskId === 'BILLING-READY-01');
    expect(billing?.state).toBe('LOCKED');
    expect(billing?.locked).toBe(true);

    const platform = records.find((r) => r.taskId === 'AGENT-PLATFORM-02');
    expect(platform?.state).toBe('ACTIVE');
  });

  it('parses heading-style task entries', () => {
    const md = `
## TASK-X-01 — Feature One
**Status:** ACTIVE
`;
    const records = parseMarkdownTasks(md, 'TASKS');
    const task = records.find((r) => r.taskId === 'TASK-X-01');
    expect(task?.state).toBe('ACTIVE');
  });

  it('detects checkpoint references', () => {
    const md = `
| BILLING-READY-01 | Credit Ledger | COMPLETE and LOCKED |

See docs/BILLING-READY-01-CHECKPOINT.md for details.
`;
    const records = parseMarkdownTasks(md, 'ROADMAP');
    const billing = records.find((r) => r.taskId === 'BILLING-READY-01');
    expect(billing?.hasCheckpoint).toBe(true);
  });

  it('returns empty array for empty content', () => {
    expect(parseMarkdownTasks('', 'TASKS')).toEqual([]);
  });
});

// ─── ACTIVE/COMPLETE mismatch ─────────────────────────────────────────────────

describe('detectActiveCompleteMismatches', () => {
  it('flags a task that is ACTIVE in one source and COMPLETE in another', () => {
    const snapshot = makeSnapshot(
      [makeRecord({ taskId: 'TASK-01', state: 'ACTIVE', source: 'TASKS' })],
      [makeRecord({ taskId: 'TASK-01', state: 'COMPLETE', source: 'BACKLOG' })],
      [],
    );
    const issues = detectActiveCompleteMismatches(snapshot);
    expect(issues.length).toBe(1);
    expect(issues[0].kind).toBe('ACTIVE_COMPLETE_MISMATCH');
    expect(issues[0].severity).toBe('ERROR');
    expect(issues[0].taskId).toBe('TASK-01');
  });

  it('flags ACTIVE vs LOCKED mismatch', () => {
    const snapshot = makeSnapshot(
      [makeRecord({ taskId: 'TASK-02', state: 'ACTIVE', source: 'TASKS' })],
      [],
      [makeRecord({ taskId: 'TASK-02', state: 'LOCKED', source: 'ROADMAP' })],
    );
    const issues = detectActiveCompleteMismatches(snapshot);
    expect(issues.length).toBe(1);
    expect(issues[0].kind).toBe('ACTIVE_COMPLETE_MISMATCH');
  });

  it('does NOT flag when all sources agree on ACTIVE', () => {
    const snapshot = makeSnapshot(
      [makeRecord({ taskId: 'TASK-03', state: 'ACTIVE', source: 'TASKS' })],
      [makeRecord({ taskId: 'TASK-03', state: 'ACTIVE', source: 'BACKLOG' })],
      [],
    );
    expect(detectActiveCompleteMismatches(snapshot)).toHaveLength(0);
  });

  it('does NOT flag when all sources agree on COMPLETE', () => {
    const snapshot = makeSnapshot(
      [makeRecord({ taskId: 'TASK-04', state: 'COMPLETE', source: 'TASKS', hasCheckpoint: true })],
      [makeRecord({ taskId: 'TASK-04', state: 'LOCKED', source: 'BACKLOG', hasCheckpoint: true })],
      [],
    );
    expect(detectActiveCompleteMismatches(snapshot)).toHaveLength(0);
  });
});

// ─── Duplicate ACTIVE detection ───────────────────────────────────────────────

describe('detectDuplicateActiveTasks', () => {
  it('flags two ACTIVE tasks in TASKS', () => {
    const snapshot = makeSnapshot(
      [
        makeRecord({ taskId: 'TASK-A', state: 'ACTIVE', source: 'TASKS' }),
        makeRecord({ taskId: 'TASK-B', state: 'ACTIVE', source: 'TASKS' }),
      ],
      [],
      [],
    );
    const issues = detectDuplicateActiveTasks(snapshot);
    expect(issues.length).toBe(1);
    expect(issues[0].kind).toBe('DUPLICATE_ACTIVE');
    expect(issues[0].severity).toBe('ERROR');
  });

  it('does not flag a single ACTIVE task', () => {
    const snapshot = makeSnapshot(
      [makeRecord({ taskId: 'TASK-A', state: 'ACTIVE', source: 'TASKS' })],
      [],
      [],
    );
    expect(detectDuplicateActiveTasks(snapshot)).toHaveLength(0);
  });

  it('does not flag ACTIVE tasks in BACKLOG (only TASKS source counts)', () => {
    const snapshot = makeSnapshot(
      [],
      [
        makeRecord({ taskId: 'TASK-A', state: 'ACTIVE', source: 'BACKLOG' }),
        makeRecord({ taskId: 'TASK-B', state: 'ACTIVE', source: 'BACKLOG' }),
      ],
      [],
    );
    expect(detectDuplicateActiveTasks(snapshot)).toHaveLength(0);
  });
});

// ─── Missing checkpoint detection ────────────────────────────────────────────

describe('detectMissingCheckpoints', () => {
  it('flags COMPLETE task with no checkpoint reference', () => {
    const snapshot = makeSnapshot(
      [makeRecord({ taskId: 'TASK-Z', state: 'COMPLETE', source: 'TASKS', hasCheckpoint: false })],
      [],
      [],
    );
    const issues = detectMissingCheckpoints(snapshot);
    expect(issues.length).toBe(1);
    expect(issues[0].kind).toBe('MISSING_CHECKPOINT');
    expect(issues[0].severity).toBe('WARNING');
  });

  it('does NOT flag COMPLETE task that has a checkpoint reference', () => {
    const snapshot = makeSnapshot(
      [makeRecord({ taskId: 'TASK-Z', state: 'COMPLETE', source: 'TASKS', hasCheckpoint: true })],
      [],
      [],
    );
    expect(detectMissingCheckpoints(snapshot)).toHaveLength(0);
  });

  it('does NOT flag ACTIVE tasks for missing checkpoints', () => {
    const snapshot = makeSnapshot(
      [makeRecord({ taskId: 'TASK-Y', state: 'ACTIVE', source: 'TASKS', hasCheckpoint: false })],
      [],
      [],
    );
    expect(detectMissingCheckpoints(snapshot)).toHaveLength(0);
  });

  it('flags LOCKED task with no checkpoint reference', () => {
    const snapshot = makeSnapshot(
      [],
      [makeRecord({ taskId: 'TASK-L', state: 'LOCKED', source: 'BACKLOG', hasCheckpoint: false })],
      [],
    );
    const issues = detectMissingCheckpoints(snapshot);
    expect(issues.length).toBe(1);
    expect(issues[0].taskId).toBe('TASK-L');
  });
});

// ─── Lifecycle order validation ───────────────────────────────────────────────

describe('validateLifecycle', () => {
  it('returns valid: true when no errors exist', () => {
    const snapshot = makeSnapshot(
      [makeRecord({ taskId: 'TASK-01', state: 'ACTIVE', source: 'TASKS' })],
      [makeRecord({ taskId: 'TASK-01', state: 'REGISTERED', source: 'BACKLOG' })],
      [],
    );
    // ACTIVE in TASKS and REGISTERED in BACKLOG is a >1 step gap — WARNING only, not ERROR
    const result = validateLifecycle(snapshot);
    expect(result.valid).toBe(true); // warnings don't invalidate
  });

  it('returns valid: false when ERROR exists (ACTIVE/COMPLETE mismatch)', () => {
    const snapshot = makeSnapshot(
      [makeRecord({ taskId: 'TASK-01', state: 'ACTIVE', source: 'TASKS' })],
      [makeRecord({ taskId: 'TASK-01', state: 'COMPLETE', source: 'BACKLOG' })],
      [],
    );
    const result = validateLifecycle(snapshot);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.severity === 'ERROR')).toBe(true);
  });
});

// ─── Roadmap consistency ──────────────────────────────────────────────────────

describe('checkRoadmapConsistency', () => {
  it('returns aligned: true when ROADMAP and TASKS agree', () => {
    const snapshot = makeSnapshot(
      [makeRecord({ taskId: 'TASK-01', state: 'COMPLETE', source: 'TASKS', hasCheckpoint: true })],
      [],
      [makeRecord({ taskId: 'TASK-01', state: 'LOCKED', source: 'ROADMAP', hasCheckpoint: true })],
    );
    const result = checkRoadmapConsistency(snapshot);
    // COMPLETE vs LOCKED is compatible (both terminal) — no conflict
    expect(result.aligned).toBe(true);
  });

  it('returns aligned: false when ROADMAP shows LOCKED but TASKS shows ACTIVE', () => {
    const snapshot = makeSnapshot(
      [makeRecord({ taskId: 'TASK-01', state: 'ACTIVE', source: 'TASKS' })],
      [],
      [makeRecord({ taskId: 'TASK-01', state: 'LOCKED', source: 'ROADMAP', hasCheckpoint: true })],
    );
    const result = checkRoadmapConsistency(snapshot);
    expect(result.aligned).toBe(false);
    expect(result.mismatches.length).toBeGreaterThan(0);
  });

  it('flags tasks present in ROADMAP but not in TASKS or BACKLOG', () => {
    const snapshot = makeSnapshot(
      [],
      [],
      [makeRecord({ taskId: 'TASK-ORPHAN', state: 'COMPLETE', source: 'ROADMAP', hasCheckpoint: true })],
    );
    const result = checkRoadmapConsistency(snapshot);
    expect(result.mismatches.some((m) => m.kind === 'TASK_ONLY_IN_ONE_SOURCE')).toBe(true);
  });
});

// ─── Full report builder — clean scenario ────────────────────────────────────

describe('buildDriftReport — clean scenario', () => {
  it('produces status OK when all sources are consistent', () => {
    const snapshot = makeSnapshot(
      [makeRecord({ taskId: 'BILLING-READY-01', state: 'LOCKED', source: 'TASKS', hasCheckpoint: true })],
      [makeRecord({ taskId: 'BILLING-READY-01', state: 'LOCKED', source: 'BACKLOG', hasCheckpoint: true })],
      [makeRecord({ taskId: 'BILLING-READY-01', state: 'LOCKED', source: 'ROADMAP', hasCheckpoint: true })],
    );
    const report: DriftDetectionResult = buildDriftReport(snapshot);
    expect(report.status).toBe('OK');
    expect(report.roadmapAlignment).toBe(true);
    expect(report.issues.filter((i) => i.severity === 'ERROR')).toHaveLength(0);
    expect(report.recommendedAction).toMatch(/No action required/);
  });

  it('includes taskStates cross-view in clean report', () => {
    const snapshot = makeSnapshot(
      [makeRecord({ taskId: 'BILLING-READY-01', state: 'LOCKED', source: 'TASKS', hasCheckpoint: true })],
      [],
      [],
    );
    const report = buildDriftReport(snapshot);
    expect(report.taskStates.some((t) => t.taskId === 'BILLING-READY-01')).toBe(true);
  });
});

// ─── Full report builder — drift scenario ────────────────────────────────────

describe('buildDriftReport — drift scenario', () => {
  it('produces status DRIFT_DETECTED when ACTIVE/COMPLETE mismatch exists', () => {
    const snapshot = makeSnapshot(
      [makeRecord({ taskId: 'TASK-01', state: 'ACTIVE', source: 'TASKS' })],
      [makeRecord({ taskId: 'TASK-01', state: 'COMPLETE', source: 'BACKLOG', hasCheckpoint: true })],
      [],
    );
    const report = buildDriftReport(snapshot);
    expect(report.status).toBe('DRIFT_DETECTED');
    expect(report.issues.some((i) => i.kind === 'ACTIVE_COMPLETE_MISMATCH')).toBe(true);
    expect(report.recommendedAction).toMatch(/BLOCK/);
  });

  it('produces status DRIFT_DETECTED for duplicate ACTIVE tasks', () => {
    const snapshot = makeSnapshot(
      [
        makeRecord({ taskId: 'TASK-A', state: 'ACTIVE', source: 'TASKS' }),
        makeRecord({ taskId: 'TASK-B', state: 'ACTIVE', source: 'TASKS' }),
      ],
      [],
      [],
    );
    const report = buildDriftReport(snapshot);
    expect(report.status).toBe('DRIFT_DETECTED');
    expect(report.issues.some((i) => i.kind === 'DUPLICATE_ACTIVE')).toBe(true);
  });

  it('flags COMPLETE with missing checkpoint as a warning', () => {
    const snapshot = makeSnapshot(
      [makeRecord({ taskId: 'TASK-Z', state: 'COMPLETE', source: 'TASKS', hasCheckpoint: false })],
      [],
      [],
    );
    const report = buildDriftReport(snapshot);
    const checkpointIssues = report.issues.filter((i) => i.kind === 'MISSING_CHECKPOINT');
    expect(checkpointIssues.length).toBeGreaterThan(0);
    expect(checkpointIssues[0].severity).toBe('WARNING');
  });

  it('includes summary string describing the drift', () => {
    const snapshot = makeSnapshot(
      [makeRecord({ taskId: 'TASK-01', state: 'ACTIVE', source: 'TASKS' })],
      [makeRecord({ taskId: 'TASK-01', state: 'COMPLETE', source: 'BACKLOG', hasCheckpoint: true })],
      [],
    );
    const report = buildDriftReport(snapshot);
    expect(report.summary).toMatch(/Drift detected/i);
  });
});

// ─── Report JSON shape ────────────────────────────────────────────────────────

describe('DriftDetectionResult shape', () => {
  it('always has all required fields', () => {
    const snapshot = makeSnapshot([], [], []);
    const report = buildDriftReport(snapshot);
    expect(report).toHaveProperty('status');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('issues');
    expect(report).toHaveProperty('taskStates');
    expect(report).toHaveProperty('roadmapAlignment');
    expect(report).toHaveProperty('recommendedAction');
    expect(Array.isArray(report.issues)).toBe(true);
    expect(Array.isArray(report.taskStates)).toBe(true);
  });
});
