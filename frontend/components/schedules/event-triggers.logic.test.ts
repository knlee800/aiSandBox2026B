import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  EVENT_TRIGGER_CALENDAR_STATES,
  EVENT_TRIGGER_ERROR_CODES,
  EVENT_TRIGGER_NEW_SKIP_REASONS,
  EVENT_TRIGGER_OUTCOMES,
  EVENT_TRIGGER_SKIP_REASONS,
  calendarDisplayState,
  calendarNeedsAttention,
  draftFromEventTrigger,
  draftToBody,
  emptyEventDraft,
  eventLimitReached,
  eventOutcomeKey,
  eventReasonKey,
  eventTriggerErrorKey,
  parseEventTrigger,
  parseEventTriggerList,
  parseEventTriggerRuns,
  showWorkflowCalendarWarning,
} from '@/components/schedules/event-triggers.logic';

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

const TRIGGER = {
  id: 'e1',
  target: { kind: 'workflow', workflowId: 'w1', name: 'Prep', status: 'enabled' },
  task: 'Prepare me',
  leadMinutes: 20,
  titleFilter: 'standup',
  timeZone: 'Europe/London',
  enabled: true,
  createdAt: 'x',
  updatedAt: 'x',
  lastRun: {
    eventStart: '2026-11-15T10:00:00.000Z',
    localDate: '2026-11-15',
    outcome: 'started',
    reason: null,
    collaborationRunId: 'run-1',
    at: 'x',
  },
};

describe('event trigger code lists are pinned to the backend source', () => {
  test('error codes match EVENT_TRIGGER_ERROR_CODES', () => {
    const source = backend('triggers/event-trigger-validation.ts');
    const start = source.indexOf('export const EVENT_TRIGGER_ERROR_CODES = {');
    const block = source.slice(start, source.indexOf('} as const', start));
    const codes = [...block.matchAll(/'(event_trigger_[a-z_]+)'/g)].map((match) => match[1]);
    assert.equal(codes.length, 13);
    assert.deepEqual([...EVENT_TRIGGER_ERROR_CODES].sort(), [...codes].sort());
  });

  test('the four new reasons match EVENT_TRIGGER_NEW_SKIP_REASONS and the full list adds them to the schedule reasons', () => {
    const source = backend('triggers/event-trigger-reasons.ts');
    const codes = quotedIn(source, 'export const EVENT_TRIGGER_NEW_SKIP_REASONS', '[', ']');
    assert.equal(codes.length, 4);
    assert.deepEqual([...EVENT_TRIGGER_NEW_SKIP_REASONS], codes);
    assert.match(
      source,
      /EVENT_TRIGGER_SKIP_REASONS = \[\.\.\.SCHEDULE_SKIP_REASONS, \.\.\.EVENT_TRIGGER_NEW_SKIP_REASONS\]/,
    );
    const scheduleCodes = quotedIn(backend('triggers/schedule-refusal.ts'), 'export const SCHEDULE_SKIP_REASONS', '[', ']');
    assert.equal(EVENT_TRIGGER_SKIP_REASONS.length, 18);
    assert.deepEqual([...EVENT_TRIGGER_SKIP_REASONS], [...scheduleCodes, ...codes]);
  });

  test('outcomes and calendar states match the entities', () => {
    const outcomes = quotedIn(
      backend('entities/agent-event-trigger-run.entity.ts'),
      'AGENT_EVENT_TRIGGER_RUN_OUTCOMES',
      '[',
      ']',
    );
    assert.deepEqual([...EVENT_TRIGGER_OUTCOMES], outcomes);
    const states = quotedIn(
      backend('entities/agent-event-trigger.entity.ts'),
      'AGENT_EVENT_TRIGGER_CALENDAR_STATES',
      '[',
      ']',
    );
    assert.deepEqual([...EVENT_TRIGGER_CALENDAR_STATES], states);
  });

  test('the limits match the backend constants', () => {
    const source = backend('triggers/event-trigger-validation.ts');
    assert.match(source, /EVENT_TRIGGERS_PER_OWNER_LIMIT = 3/);
    assert.match(source, /EVENT_TRIGGER_TASK_MAX_CHARS = 7500/);
    assert.match(source, /EVENT_TRIGGER_TITLE_FILTER_MAX_CHARS = 100/);
    assert.match(source, /EVENT_TRIGGER_LEAD_MIN_MINUTES = 5/);
    assert.match(source, /EVENT_TRIGGER_LEAD_MAX_MINUTES = 120/);
    assert.match(source, /EVENT_TRIGGER_LEAD_DEFAULT_MINUTES = 15/);
  });
});

describe('event trigger parsing', () => {
  test('parseEventTrigger reads a workflow trigger and a Chief of Staff trigger', () => {
    const workflow = parseEventTrigger(TRIGGER);
    assert.ok(workflow);
    assert.deepEqual(workflow.target, { kind: 'workflow', workflowId: 'w1', name: 'Prep', missing: false });
    assert.equal(workflow.leadMinutes, 20);
    assert.equal(workflow.titleFilter, 'standup');
    assert.equal(workflow.lastRun?.collaborationRunId, 'run-1');
    const chief = parseEventTrigger({ ...TRIGGER, target: { kind: 'chief-of-staff' }, titleFilter: null, lastRun: null });
    assert.deepEqual(chief?.target, { kind: 'chief-of-staff' });
    assert.equal(chief?.titleFilter, null);
    assert.equal(chief?.lastRun, null);
    assert.equal(parseEventTrigger({ ...TRIGGER, leadMinutes: '20' }), null);
  });

  test('a workflow with status missing is marked gone', () => {
    const gone = parseEventTrigger({
      ...TRIGGER,
      target: { kind: 'workflow', workflowId: 'w1', name: null, status: 'missing' },
    });
    assert.deepEqual(gone?.target, { kind: 'workflow', workflowId: 'w1', name: null, missing: true });
  });

  test('the list keeps the switches and the calendar, leaves malformed triggers out, and a bad body gives null', () => {
    const list = parseEventTriggerList({
      enabled: false,
      runsEnabled: true,
      limit: 3,
      calendar: { connected: true, state: 'read_failed', stateAt: '2026-11-15T10:00:00.000Z' },
      triggers: [TRIGGER, { id: 'x' }, null],
    });
    assert.equal(list?.triggers.length, 1);
    assert.equal(list?.enabled, false);
    assert.equal(list?.runsEnabled, true);
    assert.deepEqual(list?.calendar, { connected: true, state: 'read_failed', stateAt: '2026-11-15T10:00:00.000Z' });
    assert.equal(parseEventTriggerList({ triggers: 'no' }), null);
    assert.equal(parseEventTriggerList(null), null);
    const odd = parseEventTriggerList({ triggers: [], calendar: { connected: true, state: 'weird' } });
    assert.equal(odd?.calendar.state, 'ok');
    assert.equal(odd?.limit, 3);
  });

  test('parseEventTriggerRuns keeps runs with an id', () => {
    const runs = parseEventTriggerRuns({
      runs: [
        { id: 'r1', eventStart: 'x', localDate: '2026-11-15', outcome: 'skipped', reason: 'event_changed', collaborationRunId: null, at: 'x' },
        { localDate: 'bad' },
      ],
    });
    assert.equal(runs?.length, 1);
    assert.equal(runs?.[0].reason, 'event_changed');
    assert.equal(parseEventTriggerRuns({}), null);
  });
});

describe('event trigger keys and helpers', () => {
  test('known codes map to their keys and unknown ones to the generic keys', () => {
    assert.equal(eventTriggerErrorKey('event_trigger_limit_reached'), 'errors.event_trigger_limit_reached');
    assert.equal(eventTriggerErrorKey('schedule_limit_reached'), 'errors.generic');
    assert.equal(eventTriggerErrorKey(null), 'errors.generic');
    assert.equal(eventReasonKey('day_limit'), 'reasons.day_limit');
    assert.equal(eventReasonKey('missed'), 'reasons.missed');
    assert.equal(eventReasonKey('other'), 'reasons.unknown');
    assert.equal(eventOutcomeKey('started'), 'outcomes.started');
    assert.equal(eventOutcomeKey('other'), 'outcomes.unknown');
  });

  test('the calendar shows not connected when no link is on file, whatever state was recorded', () => {
    assert.equal(calendarDisplayState({ connected: false, state: 'ok', stateAt: null }), 'connector_missing');
    assert.equal(calendarDisplayState({ connected: true, state: 'ok', stateAt: null }), 'ok');
    assert.equal(calendarDisplayState({ connected: true, state: 'read_failed', stateAt: 'x' }), 'read_failed');
    assert.equal(calendarNeedsAttention({ connected: true, state: 'ok', stateAt: null }), false);
    assert.equal(calendarNeedsAttention({ connected: true, state: 'read_failed', stateAt: 'x' }), true);
    assert.equal(calendarNeedsAttention({ connected: false, state: 'ok', stateAt: null }), true);
  });

  test('eventLimitReached is true at the limit', () => {
    const base = {
      enabled: true,
      runsEnabled: true,
      limit: 2,
      calendar: { connected: true, state: 'ok' as const, stateAt: null },
      triggers: [] as never[],
    };
    assert.equal(eventLimitReached(base), false);
    const item = parseEventTrigger(TRIGGER)!;
    assert.equal(eventLimitReached({ ...base, triggers: [item, item] }), true);
  });

  test('the workflow calendar warning shows for any workflow target and not for the Chief of Staff', () => {
    assert.equal(showWorkflowCalendarWarning({ targetId: '' }), false);
    assert.equal(showWorkflowCalendarWarning({ targetId: 'w1' }), true);
  });
});

describe('event trigger draft', () => {
  test('emptyEventDraft uses the given time zone, 15 minutes and switched on', () => {
    const draft = emptyEventDraft('Asia/Taipei');
    assert.equal(draft.timeZone, 'Asia/Taipei');
    assert.equal(draft.leadMinutes, '15');
    assert.equal(draft.titleFilter, '');
    assert.equal(draft.targetId, '');
    assert.equal(draft.enabled, true);
  });

  test('draftToBody builds the request body for each target and turns a blank word into null', () => {
    const chief = draftToBody({ ...emptyEventDraft('UTC'), task: '  Prepare me  ', titleFilter: '   ' });
    assert.ok(chief.ok);
    assert.deepEqual(chief.body.target, { kind: 'chief-of-staff' });
    assert.equal(chief.body.task, 'Prepare me');
    assert.equal(chief.body.leadMinutes, 15);
    assert.equal(chief.body.titleFilter, null);
    const workflow = draftToBody({ ...emptyEventDraft('UTC'), task: 't', targetId: 'w1', leadMinutes: '120', titleFilter: ' standup ' });
    assert.ok(workflow.ok);
    assert.deepEqual(workflow.body.target, { kind: 'workflow', workflowId: 'w1' });
    assert.equal(workflow.body.leadMinutes, 120);
    assert.equal(workflow.body.titleFilter, 'standup');
  });

  test('draftToBody refuses the obvious mistakes with the gateway error keys', () => {
    const base = { ...emptyEventDraft('UTC'), task: 'ok' };
    assert.deepEqual(draftToBody({ ...base, task: '   ' }), { ok: false, errorKey: 'errors.event_trigger_invalid_task' });
    assert.deepEqual(draftToBody({ ...base, task: 'x'.repeat(7501) }), { ok: false, errorKey: 'errors.event_trigger_invalid_task' });
    for (const lead of ['4', '121', '', '1.5', 'abc', '-5']) {
      assert.deepEqual(draftToBody({ ...base, leadMinutes: lead }), { ok: false, errorKey: 'errors.event_trigger_invalid_lead' }, lead);
    }
    assert.ok(draftToBody({ ...base, leadMinutes: '5' }).ok);
    assert.deepEqual(draftToBody({ ...base, titleFilter: 'x'.repeat(101) }), { ok: false, errorKey: 'errors.event_trigger_invalid_filter' });
    assert.deepEqual(draftToBody({ ...base, timeZone: ' ' }), { ok: false, errorKey: 'errors.event_trigger_invalid_time_zone' });
  });

  test('draftFromEventTrigger round-trips an edit', () => {
    const draft = draftFromEventTrigger(parseEventTrigger(TRIGGER)!);
    assert.equal(draft.targetId, 'w1');
    assert.equal(draft.leadMinutes, '20');
    assert.equal(draft.titleFilter, 'standup');
    assert.equal(draft.timeZone, 'Europe/London');
  });
});
