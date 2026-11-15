import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  EventTriggersSectionView,
  describeEventRun,
  type EventTriggersSectionViewProps,
} from '@/components/schedules/event-triggers-section';
import {
  EVENT_TRIGGER_CALENDAR_STATES,
  EVENT_TRIGGER_ERROR_CODES,
  EVENT_TRIGGER_OUTCOMES,
  EVENT_TRIGGER_SKIP_REASONS,
  draftFromEventTrigger,
  emptyEventDraft,
  parseEventTrigger,
  type EventTriggerItem,
  type EventTriggerList,
} from '@/components/schedules/event-triggers.logic';
import enMessages from '@/messages/en.json';
import zhTwMessages from '@/messages/zh-TW.json';
import zhCnMessages from '@/messages/zh-CN.json';

type Messages = Record<string, unknown>;

const EN = enMessages as Messages;
const LOCALES = [
  { code: 'en', messages: EN },
  { code: 'zh-TW', messages: zhTwMessages as Messages },
  { code: 'zh-CN', messages: zhCnMessages as Messages },
];

function readMessage(source: Messages, path: string): string | null {
  let current: unknown = source;
  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object' || !(part in current)) return null;
    current = (current as Messages)[part];
  }
  return typeof current === 'string' ? current : null;
}

function en(key: string): string {
  const value = readMessage(EN, `schedules.events.${key}`);
  assert.ok(value, `missing schedules.events.${key} in en`);
  return value;
}

function leafKeys(value: unknown, prefix: string): string[] {
  if (typeof value === 'string') return [prefix];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Messages).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

function translator(messages: Messages) {
  return (key: string) => readMessage(messages, `schedules.events.${key}`) ?? `schedules.events.${key}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function has(html: string, text: string): boolean {
  return html.includes(escapeHtml(text));
}

const WORKFLOW_TRIGGER = parseEventTrigger({
  id: 'e1',
  target: { kind: 'workflow', workflowId: 'w1', name: 'Meeting prep', status: 'enabled' },
  task: 'Prepare me for the meeting',
  leadMinutes: 20,
  titleFilter: 'standup',
  timeZone: 'Europe/London',
  enabled: true,
  lastRun: {
    eventStart: '2026-11-14T10:00:00.000Z',
    localDate: '2026-11-14',
    outcome: 'started',
    reason: null,
    collaborationRunId: 'run-1',
    at: 'x',
  },
}) as EventTriggerItem;

const GONE_TRIGGER = parseEventTrigger({
  id: 'e2',
  target: { kind: 'workflow', workflowId: 'w9', name: null, status: 'missing' },
  task: 'Old job',
  leadMinutes: 10,
  titleFilter: null,
  timeZone: 'UTC',
  enabled: false,
  lastRun: {
    eventStart: '2026-11-13T10:00:00.000Z',
    localDate: '2026-11-13',
    outcome: 'skipped',
    reason: 'day_limit',
    collaborationRunId: null,
    at: 'x',
  },
}) as EventTriggerItem;

const CHIEF_TRIGGER = parseEventTrigger({
  id: 'e3',
  target: { kind: 'chief-of-staff' },
  task: 'Brief me',
  leadMinutes: 15,
  titleFilter: null,
  timeZone: 'Asia/Taipei',
  enabled: true,
  lastRun: null,
}) as EventTriggerItem;

function list(triggers: EventTriggerItem[], overrides: Partial<EventTriggerList> = {}): EventTriggerList {
  return {
    enabled: true,
    runsEnabled: true,
    limit: 3,
    calendar: { connected: true, state: 'ok', stateAt: null },
    triggers,
    ...overrides,
  };
}

function render(overrides: Partial<EventTriggersSectionViewProps> = {}, messages: Messages = EN): string {
  const props: EventTriggersSectionViewProps = {
    t: translator(messages),
    locale: 'en',
    phase: 'ready',
    data: list([WORKFLOW_TRIGGER, GONE_TRIGGER, CHIEF_TRIGGER]),
    workflows: [{ id: 'w1', name: 'Meeting prep' }],
    timeZones: ['UTC', 'Europe/London'],
    form: null,
    noticeKey: null,
    rowError: null,
    busyId: null,
    confirmDeleteId: null,
    history: null,
    onRetry: () => undefined,
    onNew: () => undefined,
    onEdit: () => undefined,
    onDraftChange: () => undefined,
    onSave: () => undefined,
    onCancelForm: () => undefined,
    onSwitch: () => undefined,
    onAskDelete: () => undefined,
    onCancelDelete: () => undefined,
    onConfirmDelete: () => undefined,
    onToggleHistory: () => undefined,
    ...overrides,
  };
  return renderToStaticMarkup(<EventTriggersSectionView {...props} />);
}

describe('event triggers messages', () => {
  test('all three locales have the same schedules.events keys and none is empty', () => {
    const reference = leafKeys((EN.schedules as Messages).events, 'schedules.events').sort();
    assert.ok(reference.length > 70);
    for (const { code, messages } of LOCALES) {
      assert.deepEqual(
        leafKeys((messages.schedules as Messages).events, 'schedules.events').sort(),
        reference,
        `keys differ in ${code}`,
      );
      for (const key of reference) {
        const value = readMessage(messages, key);
        assert.ok(value && value.trim().length > 0, `empty ${key} in ${code}`);
      }
    }
  });

  test('every event_trigger_* code, reason, outcome and calendar state has a key in all three locales', () => {
    const keys = [
      ...EVENT_TRIGGER_ERROR_CODES.map((code) => `schedules.events.errors.${code}`),
      ...EVENT_TRIGGER_SKIP_REASONS.map((code) => `schedules.events.reasons.${code}`),
      ...EVENT_TRIGGER_OUTCOMES.map((code) => `schedules.events.outcomes.${code}`),
      ...EVENT_TRIGGER_CALENDAR_STATES.map((code) => `schedules.events.calendar.${code}`),
      'schedules.events.errors.generic',
      'schedules.events.errors.network',
      'schedules.events.reasons.unknown',
      'schedules.events.outcomes.unknown',
      'schedules.events.calendar.openConnections',
      'schedules.events.form.workflowWarning',
      'schedules.events.readNotice',
    ];
    for (const { code, messages } of LOCALES) {
      for (const key of keys) {
        assert.ok(readMessage(messages, key), `missing ${key} in ${code}`);
      }
    }
    for (const reason of ['day_limit', 'event_changed', 'calendar_read_failed', 'connector_missing']) {
      assert.ok(EVENT_TRIGGER_SKIP_REASONS.includes(reason as never));
    }
  });

  test('the Chinese files hold real translations, not the English text, and differ from each other', () => {
    const keys = [
      'title',
      'banner.off',
      'banner.runsOff',
      'calendar.connector_missing',
      'calendar.read_failed',
      'form.workflowWarning',
      'reasons.day_limit',
      'reasons.event_changed',
      'reasons.calendar_read_failed',
      'reasons.connector_missing',
      'errors.event_trigger_invalid_lead',
      'errors.event_trigger_limit_reached',
    ];
    for (const { code, messages } of LOCALES.filter((locale) => locale.code !== 'en')) {
      for (const key of keys) {
        const value = readMessage(messages, `schedules.events.${key}`);
        assert.ok(value && /[一-鿿]/.test(value), `${key} is not Chinese in ${code}`);
        assert.notEqual(value, en(key));
      }
    }
    assert.notEqual(
      readMessage(zhTwMessages as Messages, 'schedules.events.title'),
      readMessage(zhCnMessages as Messages, 'schedules.events.title'),
    );
  });
});

describe('event triggers section states', () => {
  test('loading, failed with retry, and forbidden', () => {
    const loading = render({ phase: 'loading', data: null });
    assert.match(loading, /data-testid="event-triggers-loading"/);
    assert.ok(has(loading, en('loading')));
    const failed = render({ phase: 'failed', data: null });
    assert.match(failed, /data-testid="event-triggers-error"/);
    assert.match(failed, /data-testid="event-triggers-retry"/);
    assert.ok(has(failed, en('loadError')));
    const forbidden = render({ phase: 'forbidden', data: null });
    assert.match(forbidden, /data-testid="event-triggers-forbidden"/);
    assert.ok(has(forbidden, en('forbiddenTitle')));
    assert.doesNotMatch(forbidden, /data-testid="event-triggers-new"/);
  });

  test('the heading shows in every state, so a failed load still leaves the section labelled', () => {
    for (const phase of ['loading', 'failed', 'forbidden', 'ready'] as const) {
      const html = render({ phase, data: phase === 'ready' ? list([]) : null });
      assert.match(html, /data-testid="event-triggers-section"/);
      assert.ok(has(html, en('title')), phase);
    }
  });

  test('empty state', () => {
    const html = render({ data: list([]) });
    assert.match(html, /data-testid="event-triggers-empty"/);
    assert.ok(has(html, en('emptyTitle')));
    assert.match(html, /data-testid="event-triggers-new"/);
    assert.doesNotMatch(html, /data-testid="event-triggers-list"/);
  });

  test('the switched-off banner and the runs-off banner show only when their switch is off', () => {
    const both = render({ data: list([CHIEF_TRIGGER], { enabled: false, runsEnabled: false }) });
    assert.match(both, /data-testid="event-triggers-banner-off"/);
    assert.match(both, /data-testid="event-triggers-banner-runs-off"/);
    assert.ok(has(both, 'Event triggers are switched off; nothing will start.'));
    const none = render();
    assert.doesNotMatch(none, /event-triggers-banner-off/);
    assert.doesNotMatch(none, /event-triggers-banner-runs-off/);
  });

  test('the calendar states: ok has no link; not connected and unreadable link to Connections', () => {
    const ok = render();
    assert.match(ok, /data-calendar-state="ok"/);
    assert.ok(has(ok, en('calendar.ok')));
    assert.doesNotMatch(ok, /data-testid="event-triggers-calendar-link"/);
    const missing = render({ data: list([], { calendar: { connected: false, state: 'ok', stateAt: null } }) });
    assert.match(missing, /data-calendar-state="connector_missing"/);
    assert.ok(has(missing, en('calendar.connector_missing')));
    assert.match(missing, /data-testid="event-triggers-calendar-link"/);
    assert.match(missing, /href="\/en\/connections"/);
    const unreadable = render({
      data: list([], { calendar: { connected: true, state: 'read_failed', stateAt: '2026-11-15T10:00:00.000Z' } }),
    });
    assert.match(unreadable, /data-calendar-state="read_failed"/);
    assert.ok(has(unreadable, en('calendar.read_failed')));
    assert.match(unreadable, /href="\/en\/connections"/);
    const recorded = render({
      data: list([], { calendar: { connected: true, state: 'connector_missing', stateAt: 'x' } }),
    });
    assert.match(recorded, /data-calendar-state="connector_missing"/);
  });

  test('the ten-minute read notice shows', () => {
    const html = render();
    assert.match(html, /data-testid="event-triggers-read-notice"/);
    assert.ok(has(html, 'While a trigger is on, the platform reads your calendar about every 10 minutes.'));
  });

  test('the list shows target, task, lead, title word, zone, state and the last run', () => {
    const html = render();
    assert.match(html, /data-testid="event-trigger-row-e1"/);
    assert.ok(has(html, 'Workflow: Meeting prep'));
    assert.ok(has(html, 'Prepare me for the meeting'));
    assert.ok(has(html, '20 minutes before a timed event'));
    assert.ok(has(html, 'standup'));
    assert.ok(has(html, en('row.anyTitle')));
    assert.ok(has(html, 'Europe/London'));
    assert.ok(has(html, 'Chief of Staff'));
    assert.ok(has(html, en('target.workflowGone')));
    assert.ok(has(html, en('row.neverRan')));
    assert.ok(has(html, '2026-11-13'));
    assert.ok(has(html, en('reasons.day_limit')));
    assert.match(html, /data-testid="event-trigger-last-e1-result"/);
    assert.match(html, /href="\/en\/results"/);
    assert.doesNotMatch(html, /data-testid="event-trigger-last-e2-result"/);
  });

  test('the limit line, and the limit notice with New disabled once three are used', () => {
    assert.ok(has(render(), '3 of 3 event triggers used'));
    assert.ok(has(render({ data: list([CHIEF_TRIGGER]) }), '1 of 3 event triggers used'));
    assert.doesNotMatch(render({ data: list([CHIEF_TRIGGER]) }), /event-triggers-limit-reached/);
    const full = render();
    assert.match(full, /data-testid="event-triggers-limit-reached"/);
    assert.ok(has(full, 'You have reached the limit of 3 event triggers. Delete one to add another.'));
    assert.match(full, /<button[^>]*disabled=""[^>]*data-testid="event-triggers-new"/);
  });

  test('switch state, edit, history and delete controls per row', () => {
    const html = render();
    assert.match(html, /data-testid="event-trigger-switch-e1"/);
    assert.match(html, /aria-checked="true"/);
    assert.match(html, /aria-checked="false"/);
    assert.match(html, /data-testid="event-trigger-edit-e1"/);
    assert.match(html, /data-testid="event-trigger-history-toggle-e1"/);
    assert.match(html, /data-testid="event-trigger-delete-e1"/);
  });

  test('delete asks for a confirm step first', () => {
    const html = render({ confirmDeleteId: 'e1' });
    assert.match(html, /data-testid="event-trigger-delete-confirm-e1"/);
    assert.match(html, /data-testid="event-trigger-delete-yes-e1"/);
    assert.ok(has(html, en('row.deleteConfirm')));
    assert.doesNotMatch(html, /data-testid="event-trigger-delete-e1"/);
  });

  test('saved, deleted and switched notices, and a row error', () => {
    for (const key of ['notice.saved', 'notice.deleted', 'notice.switchedOn', 'notice.switchedOff']) {
      const html = render({ noticeKey: key });
      assert.match(html, /data-testid="event-triggers-notice"/);
      assert.ok(has(html, en(key)));
    }
    const failed = render({ rowError: { triggerId: 'e1', errorKey: 'errors.event_trigger_not_found' } });
    assert.match(failed, /data-testid="event-trigger-row-error-e1"/);
    assert.ok(has(failed, en('errors.event_trigger_not_found')));
  });

  test('history: loading, empty, failed and runs with their reasons', () => {
    const loading = render({ history: { triggerId: 'e1', phase: 'loading', runs: [] } });
    assert.match(loading, /data-testid="event-trigger-history-loading"/);
    const empty = render({ history: { triggerId: 'e1', phase: 'ready', runs: [] } });
    assert.match(empty, /data-testid="event-trigger-history-empty"/);
    const failed = render({ history: { triggerId: 'e1', phase: 'failed', runs: [] } });
    assert.match(failed, /data-testid="event-trigger-history-error"/);
    const ready = render({
      history: {
        triggerId: 'e1',
        phase: 'ready',
        runs: [
          { id: 'r1', eventStart: 'x', localDate: '2026-11-12', outcome: 'skipped', reason: 'event_changed', collaborationRunId: null, at: 'x' },
          { id: 'r2', eventStart: 'x', localDate: '2026-11-11', outcome: 'skipped', reason: 'calendar_read_failed', collaborationRunId: null, at: 'x' },
        ],
      },
    });
    assert.match(ready, /data-testid="event-trigger-history-run-r1"/);
    assert.ok(has(ready, en('reasons.event_changed')));
    assert.ok(has(ready, en('reasons.calendar_read_failed')));
  });

  test('describeEventRun translates the outcome and every reason in every locale', () => {
    for (const { messages } of LOCALES) {
      const t = translator(messages);
      for (const outcome of EVENT_TRIGGER_OUTCOMES) {
        for (const reason of [null, ...EVENT_TRIGGER_SKIP_REASONS]) {
          const described = describeEventRun(t, {
            eventStart: '',
            localDate: 'd',
            outcome,
            reason,
            collaborationRunId: null,
            at: '',
          });
          assert.ok(!described.outcome.startsWith('schedules.'));
          assert.ok(described.reason === null || !described.reason.startsWith('schedules.'));
        }
      }
    }
  });
});

describe('event triggers form', () => {
  const create = {
    editingId: null,
    draft: { ...emptyEventDraft('Asia/Taipei'), task: 'Brief me' },
    saving: false,
    errorKey: null,
  };

  test('create form: target picker, task with counter, lead, title word, zone, enabled and the hint', () => {
    const html = render({ form: create });
    assert.match(html, /data-testid="event-trigger-form"/);
    assert.ok(has(html, en('form.createTitle')));
    assert.ok(has(html, en('form.hint')));
    assert.match(html, /data-testid="event-trigger-target"/);
    assert.ok(has(html, 'Workflow: Meeting prep'));
    assert.match(html, /data-testid="event-trigger-task"/);
    assert.match(html, /type="number"[^>]*value="15"/);
    assert.match(html, /min="5"/);
    assert.match(html, /max="120"/);
    assert.match(html, /data-testid="event-trigger-filter"/);
    assert.match(html, /maxLength="100"/);
    assert.match(html, /value="Asia\/Taipei"/);
    assert.match(html, /data-testid="event-trigger-enabled"/);
    assert.ok(has(html, '8 of 7500 characters'));
    assert.match(html, /<button[^>]*disabled=""[^>]*data-testid="event-triggers-new"/);
  });

  test('the workflow warning shows for a workflow target only', () => {
    assert.doesNotMatch(render({ form: create }), /data-testid="event-trigger-workflow-warning"/);
    const html = render({ form: { ...create, draft: { ...create.draft, targetId: 'w1' } } });
    assert.match(html, /data-testid="event-trigger-workflow-warning"/);
    assert.ok(has(html, en('form.workflowWarning')));
  });

  test('edit form starts from the saved trigger', () => {
    const html = render({
      form: { editingId: 'e1', draft: draftFromEventTrigger(WORKFLOW_TRIGGER), saving: false, errorKey: null },
    });
    assert.ok(has(html, en('form.editTitle')));
    assert.ok(has(html, 'Prepare me for the meeting'));
    assert.match(html, /value="20"/);
    assert.match(html, /value="standup"/);
    assert.match(html, /<option value="w1" selected/);
  });

  test('a workflow that is gone stays selectable as the saved target', () => {
    const html = render({
      form: { editingId: 'e2', draft: draftFromEventTrigger(GONE_TRIGGER), saving: false, errorKey: null },
    });
    assert.match(html, /<option value="w9" selected/);
    assert.ok(has(html, en('target.workflowGone')));
  });

  test('saving disables the fields and shows the saving label', () => {
    const html = render({ form: { ...create, saving: true } });
    assert.ok(has(html, en('form.saving')));
    assert.match(html, /<button[^>]*disabled=""[^>]*data-testid="event-trigger-save"/);
  });

  test('a save error shows a translated sentence in every locale, for every event_trigger_* code', () => {
    for (const { messages } of LOCALES) {
      for (const code of EVENT_TRIGGER_ERROR_CODES) {
        const html = render({ form: { ...create, errorKey: `errors.${code}` } }, messages);
        assert.match(html, /data-testid="event-trigger-form-error"/);
        assert.ok(has(html, readMessage(messages, `schedules.events.errors.${code}`) as string), code);
      }
    }
  });

  test('the section renders in Traditional and Simplified Chinese without English chrome', () => {
    for (const { messages } of LOCALES.filter((locale) => locale.code !== 'en')) {
      const html = render(
        { data: list([CHIEF_TRIGGER], { enabled: false, runsEnabled: false, calendar: { connected: false, state: 'ok', stateAt: null } }) },
        messages,
      );
      assert.ok(has(html, readMessage(messages, 'schedules.events.title') as string));
      assert.ok(has(html, readMessage(messages, 'schedules.events.banner.off') as string));
      assert.ok(has(html, readMessage(messages, 'schedules.events.calendar.connector_missing') as string));
      assert.doesNotMatch(html, /schedules\.events\./);
    }
  });
});
