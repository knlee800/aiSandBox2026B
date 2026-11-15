import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SchedulesScreenView,
  describeRun,
  type SchedulesScreenViewProps,
} from '@/components/schedules/schedules-screen';
import {
  SCHEDULE_ERROR_CODES,
  SCHEDULE_OUTCOMES,
  SCHEDULE_SKIP_REASONS,
  draftFromSchedule,
  emptyDraft,
  parseSchedule,
  type ScheduleItem,
  type SchedulesList,
} from '@/components/schedules/schedules.logic';
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
  const value = readMessage(EN, `schedules.${key}`);
  assert.ok(value, `missing schedules.${key} in en`);
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
  return (key: string) => readMessage(messages, `schedules.${key}`) ?? `schedules.${key}`;
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

const WORKFLOW_SCHEDULE = parseSchedule({
  id: 's1',
  target: { kind: 'workflow', workflowId: 'w1', name: 'Morning digest', status: 'enabled' },
  task: 'Summarise the overnight news',
  timeOfDay: '07:30',
  days: [1, 3, 5],
  timeZone: 'Europe/London',
  enabled: true,
  lastRun: { localDate: '2026-11-14', outcome: 'started', reason: null, collaborationRunId: 'run-1', at: 'x' },
}) as ScheduleItem;

const GONE_SCHEDULE = parseSchedule({
  id: 's2',
  target: { kind: 'workflow', workflowId: 'w9', name: null, status: 'missing' },
  task: 'Old job',
  timeOfDay: '18:00',
  days: [7],
  timeZone: 'UTC',
  enabled: false,
  lastRun: { localDate: '2026-11-13', outcome: 'skipped', reason: 'runs_off', collaborationRunId: null, at: 'x' },
}) as ScheduleItem;

const CHIEF_SCHEDULE = parseSchedule({
  id: 's3',
  target: { kind: 'chief-of-staff' },
  task: 'Plan my day',
  timeOfDay: '08:00',
  days: [1, 2, 3, 4, 5],
  timeZone: 'Asia/Taipei',
  enabled: true,
  lastRun: null,
}) as ScheduleItem;

function list(schedules: ScheduleItem[], overrides: Partial<SchedulesList> = {}): SchedulesList {
  return { enabled: true, runsEnabled: true, limit: 5, schedules, ...overrides };
}

function render(overrides: Partial<SchedulesScreenViewProps> = {}, messages: Messages = EN): string {
  const props: SchedulesScreenViewProps = {
    t: translator(messages),
    locale: 'en',
    authReady: true,
    phase: 'ready',
    data: list([WORKFLOW_SCHEDULE, GONE_SCHEDULE, CHIEF_SCHEDULE]),
    workflows: [{ id: 'w1', name: 'Morning digest' }],
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
  return renderToStaticMarkup(<SchedulesScreenView {...props} />);
}

describe('schedules messages', () => {
  test('all three locales have the same schedules keys, none empty, and the dashboard link', () => {
    const reference = leafKeys(EN.schedules, 'schedules').sort();
    assert.ok(reference.length > 80);
    for (const { code, messages } of LOCALES) {
      assert.deepEqual(leafKeys(messages.schedules, 'schedules').sort(), reference, `keys differ in ${code}`);
      for (const key of reference) {
        const value = readMessage(messages, key);
        assert.ok(value && value.trim().length > 0, `empty ${key} in ${code}`);
      }
      assert.ok(readMessage(messages, 'platform.openSchedules'), `platform.openSchedules missing in ${code}`);
    }
  });

  test('every error code, reason code and outcome has a key in all three locales', () => {
    const keys = [
      ...SCHEDULE_ERROR_CODES.map((code) => `schedules.errors.${code}`),
      ...SCHEDULE_SKIP_REASONS.map((code) => `schedules.reasons.${code}`),
      ...SCHEDULE_OUTCOMES.map((code) => `schedules.outcomes.${code}`),
      'schedules.errors.generic',
      'schedules.errors.network',
      'schedules.reasons.unknown',
      'schedules.outcomes.unknown',
    ];
    for (const { code, messages } of LOCALES) {
      for (const key of keys) {
        assert.ok(readMessage(messages, key), `missing ${key} in ${code}`);
      }
    }
  });

  test('the Chinese files hold real translations, not the English text', () => {
    for (const { code, messages } of LOCALES.filter((locale) => locale.code !== 'en')) {
      for (const key of ['title', 'banner.off', 'banner.runsOff', 'form.readOnlyHint', 'reasons.runs_off', 'errors.schedule_invalid_days']) {
        const value = readMessage(messages, `schedules.${key}`);
        assert.ok(value && /[一-鿿]/.test(value), `${key} is not Chinese in ${code}`);
        assert.notEqual(value, en(key));
      }
    }
    assert.notEqual(readMessage(zhTwMessages as Messages, 'schedules.title'), readMessage(zhCnMessages as Messages, 'schedules.title'));
  });
});

describe('schedules screen states', () => {
  test('loading before sign-in is confirmed', () => {
    const html = render({ authReady: false, phase: 'loading', data: null });
    assert.match(html, /data-testid="schedules-auth-loading"/);
    assert.ok(has(html, en('loading')));
  });

  test('loading, failed with retry, and forbidden', () => {
    const loading = render({ phase: 'loading', data: null });
    assert.match(loading, /data-testid="schedules-loading"/);
    const failed = render({ phase: 'failed', data: null });
    assert.match(failed, /data-testid="schedules-error"/);
    assert.match(failed, /data-testid="schedules-retry"/);
    assert.ok(has(failed, en('loadError')));
    const forbidden = render({ phase: 'forbidden', data: null });
    assert.match(forbidden, /data-testid="schedules-forbidden"/);
    assert.ok(has(forbidden, en('forbiddenTitle')));
    assert.doesNotMatch(forbidden, /data-testid="schedules-new"/);
  });

  test('empty state', () => {
    const html = render({ data: list([]) });
    assert.match(html, /data-testid="schedules-empty"/);
    assert.ok(has(html, en('emptyTitle')));
    assert.match(html, /data-testid="schedules-new"/);
  });

  test('the switched-off banner and the runs-off banner show only when their switch is off', () => {
    const both = render({ data: list([CHIEF_SCHEDULE], { enabled: false, runsEnabled: false }) });
    assert.match(both, /data-testid="schedules-banner-off"/);
    assert.match(both, /data-testid="schedules-banner-runs-off"/);
    assert.ok(has(both, 'Schedules are switched off; nothing will start.'));
    const none = render();
    assert.doesNotMatch(none, /schedules-banner-off/);
    assert.doesNotMatch(none, /schedules-banner-runs-off/);
  });

  test('the list shows target, task, time, days, zone, state and the last run', () => {
    const html = render();
    assert.match(html, /data-testid="schedule-row-s1"/);
    assert.ok(has(html, 'Workflow: Morning digest'));
    assert.ok(has(html, 'Summarise the overnight news'));
    assert.ok(has(html, '07:30 on Mon, Wed, Fri (Europe/London)'));
    assert.ok(has(html, 'Chief of Staff'));
    assert.ok(has(html, en('target.workflowGone')));
    assert.ok(has(html, en('row.neverRan')));
    assert.ok(has(html, '2026-11-13'));
    assert.ok(has(html, en('reasons.runs_off')));
    assert.match(html, /data-testid="schedule-last-s1-result"[^>]*>/);
    assert.match(html, /href="\/en\/results"/);
    assert.doesNotMatch(html, /data-testid="schedule-last-s2-result"/);
  });

  test('the limit line, and the limit notice with New disabled once five are used', () => {
    assert.ok(has(render(), '3 of 5 schedules used'));
    const items = [1, 2, 3, 4, 5].map((n) => ({ ...CHIEF_SCHEDULE, id: `c${n}` }));
    const full = render({ data: list(items) });
    assert.match(full, /data-testid="schedules-limit-reached"/);
    assert.match(full, /<button[^>]*disabled=""[^>]*data-testid="schedules-new"/);
  });

  test('switch state, edit, history and delete controls per row', () => {
    const html = render();
    assert.match(html, /data-testid="schedule-switch-s1"/);
    assert.match(html, /aria-checked="true"/);
    assert.match(html, /aria-checked="false"/);
    assert.match(html, /data-testid="schedule-edit-s1"/);
    assert.match(html, /data-testid="schedule-history-toggle-s1"/);
    assert.match(html, /data-testid="schedule-delete-s1"/);
  });

  test('delete asks for a confirm step first', () => {
    const html = render({ confirmDeleteId: 's1' });
    assert.match(html, /data-testid="schedule-delete-confirm-s1"/);
    assert.match(html, /data-testid="schedule-delete-yes-s1"/);
    assert.ok(has(html, en('row.deleteConfirm')));
    assert.doesNotMatch(html, /data-testid="schedule-delete-s1"/);
  });

  test('saved, deleted and switched notices, and a row error', () => {
    for (const key of ['notice.saved', 'notice.deleted', 'notice.switchedOn', 'notice.switchedOff']) {
      const html = render({ noticeKey: key });
      assert.match(html, /data-testid="schedules-notice"/);
      assert.ok(has(html, en(key)));
    }
    const failed = render({ rowError: { scheduleId: 's1', errorKey: 'errors.schedule_not_found' } });
    assert.match(failed, /data-testid="schedule-row-error-s1"/);
    assert.ok(has(failed, en('errors.schedule_not_found')));
  });

  test('history: loading, empty, failed and runs with their reasons', () => {
    const loading = render({ history: { scheduleId: 's1', phase: 'loading', runs: [] } });
    assert.match(loading, /data-testid="schedule-history-loading"/);
    const empty = render({ history: { scheduleId: 's1', phase: 'ready', runs: [] } });
    assert.match(empty, /data-testid="schedule-history-empty"/);
    const failed = render({ history: { scheduleId: 's1', phase: 'failed', runs: [] } });
    assert.match(failed, /data-testid="schedule-history-error"/);
    const ready = render({
      history: {
        scheduleId: 's1',
        phase: 'ready',
        runs: [{ id: 'r1', localDate: '2026-11-12', outcome: 'skipped', reason: 'no_credits', collaborationRunId: null, at: 'x' }],
      },
    });
    assert.match(ready, /data-testid="schedule-history-run-r1"/);
    assert.ok(has(ready, en('reasons.no_credits')));
  });

  test('describeRun translates the outcome and the reason in every locale', () => {
    for (const { messages } of LOCALES) {
      const t = translator(messages);
      for (const outcome of SCHEDULE_OUTCOMES) {
        for (const reason of [null, ...SCHEDULE_SKIP_REASONS]) {
          const described = describeRun(t, { localDate: 'd', outcome, reason, collaborationRunId: null, at: '' });
          assert.ok(!described.outcome.startsWith('schedules.'));
          assert.ok(described.reason === null || !described.reason.startsWith('schedules.'));
        }
      }
    }
  });
});

describe('schedules form', () => {
  const create = { editingId: null, draft: { ...emptyDraft('Asia/Taipei'), task: 'Brief me' }, saving: false, errorKey: null };

  test('create form: target picker, task, time, days, time zone, enabled and the read-only hint', () => {
    const html = render({ form: create });
    assert.match(html, /data-testid="schedule-form"/);
    assert.ok(has(html, en('form.createTitle')));
    assert.ok(has(html, en('form.readOnlyHint')));
    assert.match(html, /data-testid="schedule-target"/);
    assert.ok(has(html, 'Workflow: Morning digest'));
    assert.match(html, /data-testid="schedule-task"/);
    assert.match(html, /type="time"[^>]*value="09:00"/);
    assert.match(html, /value="Asia\/Taipei"/);
    for (const day of [1, 2, 3, 4, 5, 6, 7]) {
      assert.match(html, new RegExp(`data-testid="schedule-day-${day}"`));
    }
    assert.match(html, /data-testid="schedule-enabled"/);
    assert.ok(has(html, '8 of 8000 characters'));
    assert.match(html, /<button[^>]*disabled=""[^>]*data-testid="schedules-new"/);
  });

  test('edit form starts from the saved schedule', () => {
    const html = render({
      form: { editingId: 's1', draft: draftFromSchedule(WORKFLOW_SCHEDULE), saving: false, errorKey: null },
    });
    assert.ok(has(html, en('form.editTitle')));
    assert.ok(has(html, 'Summarise the overnight news'));
    assert.match(html, /value="07:30"/);
    assert.match(html, /<option value="w1" selected/);
  });

  test('a workflow that is gone stays selectable as the saved target', () => {
    const html = render({
      form: { editingId: 's2', draft: draftFromSchedule(GONE_SCHEDULE), saving: false, errorKey: null },
    });
    assert.match(html, /<option value="w9" selected/);
    assert.ok(has(html, en('target.workflowGone')));
  });

  test('saving disables the fields and shows the saving label', () => {
    const html = render({ form: { ...create, saving: true } });
    assert.ok(has(html, en('form.saving')));
    assert.match(html, /<button[^>]*disabled=""[^>]*data-testid="schedule-save"/);
  });

  test('a save error shows a translated sentence in every locale', () => {
    for (const { messages } of LOCALES) {
      const html = render({ form: { ...create, errorKey: 'errors.schedule_invalid_days' } }, messages);
      assert.match(html, /data-testid="schedule-form-error"/);
      assert.ok(has(html, readMessage(messages, 'schedules.errors.schedule_invalid_days') as string));
    }
  });

  test('the page renders in Traditional and Simplified Chinese without English chrome', () => {
    for (const { messages } of LOCALES.filter((locale) => locale.code !== 'en')) {
      const html = render({ data: list([CHIEF_SCHEDULE], { enabled: false, runsEnabled: false }) }, messages);
      assert.ok(has(html, readMessage(messages, 'schedules.title') as string));
      assert.ok(has(html, readMessage(messages, 'schedules.banner.off') as string));
      assert.doesNotMatch(html, /schedules\.[a-zA-Z]/);
    }
  });
});

describe('schedules screen: the Before a meeting slot', () => {
  test('the events section renders below the schedules and does not change them', () => {
    const slot = <section data-testid="events-slot">slot</section>;
    const html = render({ eventsSection: slot });
    assert.match(html, /data-testid="events-slot"/);
    assert.ok(html.indexOf('data-testid="schedules-list"') < html.indexOf('data-testid="events-slot"'));
    assert.match(html, /data-testid="schedules-new"/);
  });

  test('the slot still shows when the schedules themselves failed to load, so each section fails on its own', () => {
    const slot = <section data-testid="events-slot">slot</section>;
    for (const phase of ['failed', 'forbidden'] as const) {
      const html = render({ phase, data: null, eventsSection: slot });
      assert.match(html, /data-testid="events-slot"/);
    }
  });

  test('without the slot the page is exactly the schedules page', () => {
    assert.doesNotMatch(render(), /events-slot|event-triggers-section/);
  });
});
