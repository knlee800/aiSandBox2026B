import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  SCHEDULE_ERROR_CODES,
  SCHEDULE_OUTCOMES,
  SCHEDULE_SKIP_REASONS,
  TARGET_WARNING_NOTICE_KEYS,
  draftFromSchedule,
  draftTargetStatus,
  draftToBody,
  emptyDraft,
  limitReached,
  outcomeKey,
  parseSchedule,
  parseScheduleRuns,
  parseSchedulesList,
  readTargetStatus,
  reasonKey,
  scheduleErrorKey,
  targetNotOn,
  targetSwitchNoticeKey,
  targetWorkflowStatus,
  taskPreview,
  toggleDay,
  type ScheduleTarget,
  type WorkflowOption,
} from '@/components/schedules/schedules.logic';
import type { ResultsWorkflowOption } from '@/components/results/results-api';
import type { CollaborationWorkflowStatus } from '@/components/collaboration/collaboration-workflows';

const backend = (file: string) =>
  readFileSync(new URL(`../../../services/api-gateway/src/${file}`, import.meta.url), 'utf8');

/** The quoted values inside the first block that starts at `marker`. */
function quotedIn(source: string, marker: string, open: string, close: string): string[] {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `marker not found: ${marker}`);
  const from = source.indexOf(open, start);
  const to = source.indexOf(close, from);
  return [...source.slice(from, to).matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
}

const SCHEDULE = {
  id: 's1',
  target: { kind: 'workflow', workflowId: 'w1', name: 'Digest', status: 'active' },
  task: 'Summarise\n  the   news',
  timeOfDay: '07:30',
  days: [1, 3, 5],
  timeZone: 'Europe/London',
  enabled: true,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  lastRun: {
    localDate: '2026-11-14',
    outcome: 'started',
    reason: null,
    collaborationRunId: 'run-1',
    at: '2026-11-14T07:30:01.000Z',
  },
};

describe('workflow options (CHAIN-SOURCE-OFF-01)', () => {
  test('a status is optional, and the option types stay interchangeable with the workflows route status', () => {
    // Compile-time: the three shapes agree, with and without a status.
    const status: CollaborationWorkflowStatus = 'disabled';
    const fromResults: ResultsWorkflowOption = { id: 'w1', name: 'Digest', status };
    const asOption: WorkflowOption = fromResults;
    const back: ResultsWorkflowOption = asOption;
    const plain: WorkflowOption[] = [{ id: 'w2', name: 'Writer' }, back];
    assert.deepEqual(
      plain.map((option) => option.status ?? null),
      [null, 'disabled'],
    );
  });
});

describe('schedules code lists are pinned to the backend source', () => {
  test('error codes match SCHEDULE_ERROR_CODES', () => {
    const source = backend('triggers/schedule-validation.ts');
    const start = source.indexOf('export const SCHEDULE_ERROR_CODES = {');
    const block = source.slice(start, source.indexOf('} as const', start));
    const codes = [...block.matchAll(/'(schedule_[a-z_]+)'/g)].map((match) => match[1]);
    assert.equal(codes.length, 13);
    assert.deepEqual([...SCHEDULE_ERROR_CODES].sort(), [...codes].sort());
  });

  test('reason codes match SCHEDULE_SKIP_REASONS', () => {
    const source = backend('triggers/schedule-refusal.ts');
    const codes = quotedIn(source, 'export const SCHEDULE_SKIP_REASONS', '[', ']');
    assert.equal(codes.length, 14);
    assert.deepEqual([...SCHEDULE_SKIP_REASONS], codes);
  });

  test('outcomes match AGENT_SCHEDULE_RUN_OUTCOMES', () => {
    const source = backend('entities/agent-schedule-run.entity.ts');
    const codes = quotedIn(source, 'AGENT_SCHEDULE_RUN_OUTCOMES', '[', ']');
    assert.deepEqual([...SCHEDULE_OUTCOMES], codes);
  });

  test('the limit and task length match the backend constants', () => {
    const source = backend('triggers/schedule-validation.ts');
    assert.match(source, /SCHEDULES_PER_OWNER_LIMIT = 5/);
    assert.match(source, /SCHEDULE_TIME_ZONE_MAX_CHARS = 64/);
    assert.match(backend('orchestration/collaboration-team.ts'), /COLLABORATION_USER_TASK_MAX_CHARS = 8000/);
  });
});

describe('schedules parsing', () => {
  test('parseSchedule reads a workflow schedule and a Chief of Staff schedule', () => {
    const workflow = parseSchedule(SCHEDULE);
    assert.ok(workflow);
    assert.deepEqual(workflow.target, { kind: 'workflow', workflowId: 'w1', name: 'Digest', missing: false, status: 'active' });
    assert.equal(workflow.lastRun?.collaborationRunId, 'run-1');
    const chief = parseSchedule({ ...SCHEDULE, target: { kind: 'chief-of-staff' }, lastRun: null });
    assert.deepEqual(chief?.target, { kind: 'chief-of-staff' });
    assert.equal(chief?.lastRun, null);
  });

  test('a workflow with status missing is marked gone', () => {
    const gone = parseSchedule({
      ...SCHEDULE,
      target: { kind: 'workflow', workflowId: 'w1', name: null, status: 'missing' },
    });
    assert.deepEqual(gone?.target, { kind: 'workflow', workflowId: 'w1', name: null, missing: true });
  });

  test('malformed schedules are left out of the list and a bad body gives null', () => {
    const list = parseSchedulesList({
      enabled: false,
      runsEnabled: true,
      limit: 5,
      schedules: [SCHEDULE, { id: 'x' }, null],
    });
    assert.equal(list?.schedules.length, 1);
    assert.equal(list?.enabled, false);
    assert.equal(list?.runsEnabled, true);
    assert.equal(parseSchedulesList({ schedules: 'no' }), null);
    assert.equal(parseSchedulesList(null), null);
  });

  test('parseScheduleRuns keeps runs with an id', () => {
    const runs = parseScheduleRuns({
      runs: [{ id: 'r1', localDate: '2026-11-14', outcome: 'skipped', reason: 'missed', collaborationRunId: null, at: 'x' }, { localDate: 'bad' }],
    });
    assert.equal(runs?.length, 1);
    assert.equal(runs?.[0].reason, 'missed');
    assert.equal(parseScheduleRuns({}), null);
  });
});

describe('schedules keys and helpers', () => {
  test('known codes map to their keys and unknown ones to the generic keys', () => {
    assert.equal(scheduleErrorKey('schedule_limit_reached'), 'errors.schedule_limit_reached');
    assert.equal(scheduleErrorKey('nope'), 'errors.generic');
    assert.equal(scheduleErrorKey(null), 'errors.generic');
    assert.equal(reasonKey('missed'), 'reasons.missed');
    assert.equal(reasonKey('other'), 'reasons.unknown');
    assert.equal(outcomeKey('started'), 'outcomes.started');
    assert.equal(outcomeKey('other'), 'outcomes.unknown');
  });

  test('taskPreview flattens whitespace and truncates', () => {
    assert.equal(taskPreview('a\n  b'), 'a b');
    const long = taskPreview('x'.repeat(200));
    assert.equal(long.length, 90);
    assert.ok(long.endsWith('…'));
  });

  test('toggleDay adds and removes in order', () => {
    assert.deepEqual(toggleDay([1, 3], 2), [1, 2, 3]);
    assert.deepEqual(toggleDay([1, 2, 3], 2), [1, 3]);
  });

  test('limitReached is true at the limit', () => {
    const base = { enabled: true, runsEnabled: true, limit: 2, schedules: [] as never[] };
    assert.equal(limitReached(base), false);
    const item = parseSchedule(SCHEDULE)!;
    assert.equal(limitReached({ ...base, schedules: [item, item] }), true);
  });
});

describe('schedules draft', () => {
  test('emptyDraft uses the given time zone and weekdays at 09:00', () => {
    const draft = emptyDraft('Asia/Taipei');
    assert.equal(draft.timeZone, 'Asia/Taipei');
    assert.equal(draft.timeOfDay, '09:00');
    assert.deepEqual(draft.days, [1, 2, 3, 4, 5]);
    assert.equal(draft.targetId, '');
    assert.equal(draft.enabled, true);
  });

  test('draftToBody builds the request body for each target', () => {
    const chief = draftToBody({ ...emptyDraft('UTC'), task: '  Brief me  ' });
    assert.deepEqual(chief.ok && chief.body.target, { kind: 'chief-of-staff' });
    assert.equal(chief.ok && chief.body.task, 'Brief me');
    const workflow = draftToBody({ ...emptyDraft('UTC'), task: 't', targetId: 'w1', days: [5, 1] });
    assert.ok(workflow.ok);
    assert.deepEqual(workflow.body.target, { kind: 'workflow', workflowId: 'w1' });
    assert.deepEqual(workflow.body.days, [1, 5]);
  });

  test('draftToBody refuses the obvious mistakes with the gateway error keys', () => {
    const base = { ...emptyDraft('UTC'), task: 'ok' };
    assert.deepEqual(draftToBody({ ...base, task: '   ' }), { ok: false, errorKey: 'errors.schedule_invalid_task' });
    assert.deepEqual(draftToBody({ ...base, task: 'x'.repeat(8001) }), { ok: false, errorKey: 'errors.schedule_invalid_task' });
    assert.deepEqual(draftToBody({ ...base, timeOfDay: '24:00' }), { ok: false, errorKey: 'errors.schedule_invalid_time' });
    assert.deepEqual(draftToBody({ ...base, days: [] }), { ok: false, errorKey: 'errors.schedule_invalid_days' });
    assert.deepEqual(draftToBody({ ...base, timeZone: ' ' }), { ok: false, errorKey: 'errors.schedule_invalid_time_zone' });
  });

  test('draftFromSchedule round-trips an edit', () => {
    const draft = draftFromSchedule(parseSchedule(SCHEDULE)!);
    assert.equal(draft.targetId, 'w1');
    assert.equal(draft.timeZone, 'Europe/London');
    assert.deepEqual(draft.days, [1, 3, 5]);
  });
});

describe('target workflow status (TRIGGER-TARGET-OFF-01)', () => {
  const target = (status?: unknown, extra: Record<string, unknown> = {}) =>
    parseSchedule({
      id: 's1',
      target: { kind: 'workflow', workflowId: 'w1', name: 'Digest', ...(status === undefined ? {} : { status }), ...extra },
      task: 'x',
      timeOfDay: '09:00',
      days: [1],
      timeZone: 'UTC',
      enabled: true,
      lastRun: null,
    })?.target as ScheduleTarget;

  test('readTargetStatus keeps active, draft and disabled and drops anything else', () => {
    assert.equal(readTargetStatus('active'), 'active');
    assert.equal(readTargetStatus('draft'), 'draft');
    assert.equal(readTargetStatus('disabled'), 'disabled');
    for (const value of ['missing', 'enabled', '', 3, null, undefined, {}]) {
      assert.equal(readTargetStatus(value), undefined, String(value));
    }
  });

  test('a parsed workflow target carries its status; an absent or unknown one behaves as before', () => {
    assert.deepEqual(target('disabled'), { kind: 'workflow', workflowId: 'w1', name: 'Digest', missing: false, status: 'disabled' });
    assert.equal((target('draft') as { status?: string }).status, 'draft');
    assert.equal((target('active') as { status?: string }).status, 'active');
    // Absent, unknown and missing add no status key at all.
    for (const status of [undefined, 'paused', 'enabled']) {
      const parsed = target(status);
      assert.deepEqual(parsed, { kind: 'workflow', workflowId: 'w1', name: 'Digest', missing: false });
      assert.equal('status' in parsed, false);
    }
    const gone = parseSchedule({
      id: 's2',
      target: { kind: 'workflow', workflowId: 'w2', name: null, status: 'missing' },
      task: 'x',
      timeOfDay: '09:00',
      days: [1],
      timeZone: 'UTC',
      enabled: true,
      lastRun: null,
    })?.target;
    assert.deepEqual(gone, { kind: 'workflow', workflowId: 'w2', name: null, missing: true });
  });

  test('targetWorkflowStatus is null for the Chief of Staff, a deleted workflow and an unknown status', () => {
    assert.equal(targetWorkflowStatus({ kind: 'chief-of-staff' }), null);
    assert.equal(targetWorkflowStatus({ kind: 'workflow', workflowId: 'w', name: null, missing: true, status: 'disabled' }), null);
    assert.equal(targetWorkflowStatus(target(undefined)), null);
    assert.equal(targetWorkflowStatus(target('active')), 'active');
    assert.equal(targetWorkflowStatus(target('draft')), 'draft');
    assert.equal(targetWorkflowStatus(target('disabled')), 'disabled');
  });

  test('targetNotOn is true only for draft and disabled', () => {
    assert.equal(targetNotOn('draft'), true);
    assert.equal(targetNotOn('disabled'), true);
    assert.equal(targetNotOn('active'), false);
    assert.equal(targetNotOn(null), false);
  });

  test("draftTargetStatus reads the page's list, falls back to the saved target, and is null otherwise", () => {
    const withStatus: WorkflowOption[] = [
      { id: 'a', name: 'A', status: 'active' },
      { id: 'd', name: 'D', status: 'draft' },
      { id: 'o', name: 'O', status: 'disabled' },
    ];
    assert.equal(draftTargetStatus(withStatus, 'a'), 'active');
    assert.equal(draftTargetStatus(withStatus, 'd'), 'draft');
    assert.equal(draftTargetStatus(withStatus, 'o'), 'disabled');
    assert.equal(draftTargetStatus(withStatus, ''), null);
    assert.equal(draftTargetStatus(withStatus, 'zzz'), null);
    // A list without statuses: the saved target answers for its own workflow only.
    const plain: WorkflowOption[] = [{ id: 'w1', name: 'Digest' }, { id: 'w2', name: 'Other' }];
    const saved = target('disabled');
    assert.equal(draftTargetStatus(plain, 'w1', saved), 'disabled');
    assert.equal(draftTargetStatus(plain, 'w2', saved), null);
    assert.equal(draftTargetStatus(plain, 'w1', null), null);
    assert.equal(draftTargetStatus(plain, 'w1', { kind: 'chief-of-staff' }), null);
    // The list wins over the saved target.
    assert.equal(draftTargetStatus([{ id: 'w1', name: 'Digest', status: 'active' }], 'w1', saved), 'active');
  });

  test('targetSwitchNoticeKey: only a switch-on with a target that is not on gets the amber notice', () => {
    assert.equal(targetSwitchNoticeKey(true, target('active')), 'notice.switchedOn');
    assert.equal(targetSwitchNoticeKey(true, target('disabled')), 'notice.switchedOnTargetOff');
    assert.equal(targetSwitchNoticeKey(true, target('draft')), 'notice.switchedOnTargetOff');
    assert.equal(targetSwitchNoticeKey(true, target(undefined)), 'notice.switchedOn');
    assert.equal(targetSwitchNoticeKey(true, { kind: 'chief-of-staff' }), 'notice.switchedOn');
    for (const status of ['active', 'disabled', 'draft']) {
      assert.equal(targetSwitchNoticeKey(false, target(status)), 'notice.switchedOff');
    }
    assert.deepEqual([...TARGET_WARNING_NOTICE_KEYS], ['notice.switchedOnTargetOff']);
  });
});
