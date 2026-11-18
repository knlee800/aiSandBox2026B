import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MailTriggersSectionView,
  describeMailRun,
  type MailTriggersSectionViewProps,
} from '@/components/schedules/mail-triggers-section';
import {
  MAIL_TRIGGER_MAIL_STATES,
  MAIL_TRIGGER_ERROR_CODES,
  MAIL_TRIGGER_OUTCOMES,
  MAIL_TRIGGER_SKIP_REASONS,
  draftFromMailTrigger,
  emptyMailDraft,
  parseMailTrigger,
  type MailTriggerItem,
  type MailTriggerList,
} from '@/components/schedules/mail-triggers.logic';
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
  const value = readMessage(EN, `schedules.mail.${key}`);
  assert.ok(value, `missing schedules.mail.${key} in en`);
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
  return (key: string) => readMessage(messages, `schedules.mail.${key}`) ?? `schedules.mail.${key}`;
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

const WORKFLOW_TRIGGER = parseMailTrigger({
  id: 'e1',
  target: { kind: 'workflow', workflowId: 'w1', name: 'Mail prep', status: 'active' },
  task: 'Summarise the new mail',
  senderFilter: 'boss@example.com',
  subjectFilter: 'invoice',
  timeZone: 'Europe/London',
  enabled: true,
  lastRun: {
    arrivedAt: '2026-11-14T10:00:00.000Z',
    localDate: '2026-11-14',
    outcome: 'started',
    reason: null,
    collaborationRunId: 'run-1',
    at: 'x',
  },
}) as MailTriggerItem;

const GONE_TRIGGER = parseMailTrigger({
  id: 'e2',
  target: { kind: 'workflow', workflowId: 'w9', name: null, status: 'missing' },
  task: 'Old job',
  senderFilter: '@example.org',
  subjectFilter: null,
  timeZone: 'UTC',
  enabled: false,
  lastRun: {
    arrivedAt: '2026-11-13T10:00:00.000Z',
    localDate: '2026-11-13',
    outcome: 'skipped',
    reason: 'day_limit',
    collaborationRunId: null,
    at: 'x',
  },
}) as MailTriggerItem;

const CHIEF_TRIGGER = parseMailTrigger({
  id: 'e3',
  target: { kind: 'chief-of-staff' },
  task: 'Brief me',
  senderFilter: 'news@example.net',
  subjectFilter: null,
  timeZone: 'Asia/Taipei',
  enabled: true,
  lastRun: null,
}) as MailTriggerItem;

function list(triggers: MailTriggerItem[], overrides: Partial<MailTriggerList> = {}): MailTriggerList {
  return {
    enabled: true,
    runsEnabled: true,
    limit: 3,
    mail: { connected: true, state: 'ok', stateAt: null },
    triggers,
    ...overrides,
  };
}

function render(overrides: Partial<MailTriggersSectionViewProps> = {}, messages: Messages = EN): string {
  const props: MailTriggersSectionViewProps = {
    t: translator(messages),
    locale: 'en',
    phase: 'ready',
    data: list([WORKFLOW_TRIGGER, GONE_TRIGGER, CHIEF_TRIGGER]),
    workflows: [{ id: 'w1', name: 'Mail prep' }],
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
  return renderToStaticMarkup(<MailTriggersSectionView {...props} />);
}

describe('mail triggers messages', () => {
  test('all three locales have the same schedules.mail keys and none is empty', () => {
    const reference = leafKeys((EN.schedules as Messages).mail, 'schedules.mail').sort();
    assert.ok(reference.length > 70);
    for (const { code, messages } of LOCALES) {
      assert.deepEqual(
        leafKeys((messages.schedules as Messages).mail, 'schedules.mail').sort(),
        reference,
        `keys differ in ${code}`,
      );
      for (const key of reference) {
        const value = readMessage(messages, key);
        assert.ok(value && value.trim().length > 0, `empty ${key} in ${code}`);
      }
    }
  });

  test('every mail_trigger_* code, reason, outcome and mailbox state has a key in all three locales', () => {
    const keys = [
      ...MAIL_TRIGGER_ERROR_CODES.map((code) => `schedules.mail.errors.${code}`),
      ...MAIL_TRIGGER_SKIP_REASONS.map((code) => `schedules.mail.reasons.${code}`),
      ...MAIL_TRIGGER_OUTCOMES.map((code) => `schedules.mail.outcomes.${code}`),
      ...MAIL_TRIGGER_MAIL_STATES.map((code) => `schedules.mail.mailbox.${code}`),
      'schedules.mail.errors.generic',
      'schedules.mail.errors.network',
      'schedules.mail.reasons.unknown',
      'schedules.mail.outcomes.unknown',
      'schedules.mail.mailbox.openConnections',
      'schedules.mail.form.workflowWarning',
      'schedules.mail.readNotice',
    ];
    for (const { code, messages } of LOCALES) {
      for (const key of keys) {
        assert.ok(readMessage(messages, key), `missing ${key} in ${code}`);
      }
    }
    assert.ok(MAIL_TRIGGER_SKIP_REASONS.includes('day_limit'));
    assert.equal(MAIL_TRIGGER_SKIP_REASONS.length, 14);
  });

  test('the Chinese files hold real translations, not the English text, and differ from each other', () => {
    const keys = [
      'title',
      'banner.off',
      'banner.runsOff',
      'mailbox.connector_missing',
      'mailbox.read_failed',
      'mailbox.sign_in_refused',
      'form.workflowWarning',
      'reasons.day_limit',
      'reasons.workflow_not_tested',
      'form.senderHint',
      'unreadNotice',
      'mailbox.openConnections',
      'errors.mail_trigger_invalid_sender',
      'errors.mail_trigger_limit_reached',
    ];
    for (const { code, messages } of LOCALES.filter((locale) => locale.code !== 'en')) {
      for (const key of keys) {
        const value = readMessage(messages, `schedules.mail.${key}`);
        assert.ok(value && /[一-鿿]/.test(value), `${key} is not Chinese in ${code}`);
        assert.notEqual(value, en(key));
      }
    }
    assert.notEqual(
      readMessage(zhTwMessages as Messages, 'schedules.mail.title'),
      readMessage(zhCnMessages as Messages, 'schedules.mail.title'),
    );
  });
});

describe('mail triggers section states', () => {
  test('loading, failed with retry, and forbidden', () => {
    const loading = render({ phase: 'loading', data: null });
    assert.match(loading, /data-testid="mail-triggers-loading"/);
    assert.ok(has(loading, en('loading')));
    const failed = render({ phase: 'failed', data: null });
    assert.match(failed, /data-testid="mail-triggers-error"/);
    assert.match(failed, /data-testid="mail-triggers-retry"/);
    assert.ok(has(failed, en('loadError')));
    const forbidden = render({ phase: 'forbidden', data: null });
    assert.match(forbidden, /data-testid="mail-triggers-forbidden"/);
    assert.ok(has(forbidden, en('forbiddenTitle')));
    assert.doesNotMatch(forbidden, /data-testid="mail-triggers-new"/);
  });

  test('the heading shows in every state, so a failed load still leaves the section labelled', () => {
    for (const phase of ['loading', 'failed', 'forbidden', 'ready'] as const) {
      const html = render({ phase, data: phase === 'ready' ? list([]) : null });
      assert.match(html, /data-testid="mail-triggers-section"/);
      assert.ok(has(html, en('title')), phase);
    }
  });

  test('empty state', () => {
    const html = render({ data: list([]) });
    assert.match(html, /data-testid="mail-triggers-empty"/);
    assert.ok(has(html, en('emptyTitle')));
    assert.match(html, /data-testid="mail-triggers-new"/);
    assert.doesNotMatch(html, /data-testid="mail-triggers-list"/);
  });

  test('the switched-off banner and the runs-off banner show only when their switch is off', () => {
    const both = render({ data: list([CHIEF_TRIGGER], { enabled: false, runsEnabled: false }) });
    assert.match(both, /data-testid="mail-triggers-banner-off"/);
    assert.match(both, /data-testid="mail-triggers-banner-runs-off"/);
    assert.ok(has(both, 'Mail triggers are switched off; nothing will start.'));
    const none = render();
    assert.doesNotMatch(none, /mail-triggers-banner-off/);
    assert.doesNotMatch(none, /mail-triggers-banner-runs-off/);
  });

  test('the mailbox states: ok has no link; not connected and unreadable link to Connections', () => {
    const ok = render();
    assert.match(ok, /data-mailbox-state="ok"/);
    assert.ok(has(ok, en('mailbox.ok')));
    assert.doesNotMatch(ok, /data-testid="mail-triggers-mailbox-link"/);
    const missing = render({ data: list([], { mail: { connected: false, state: 'ok', stateAt: null } }) });
    assert.match(missing, /data-mailbox-state="connector_missing"/);
    assert.ok(has(missing, en('mailbox.connector_missing')));
    assert.match(missing, /data-testid="mail-triggers-mailbox-link"/);
    assert.match(missing, /href="\/en\/connections"/);
    const unreadable = render({
      data: list([], { mail: { connected: true, state: 'read_failed', stateAt: '2026-11-15T10:00:00.000Z' } }),
    });
    assert.match(unreadable, /data-mailbox-state="read_failed"/);
    assert.ok(has(unreadable, en('mailbox.read_failed')));
    assert.match(unreadable, /href="\/en\/connections"/);
    const refused = render({
      data: list([], { mail: { connected: true, state: 'sign_in_refused', stateAt: '2026-11-15T10:00:00.000Z' } }),
    });
    assert.match(refused, /data-mailbox-state="sign_in_refused"/);
    assert.ok(has(refused, en('mailbox.sign_in_refused')));
    assert.match(refused, /data-testid="mail-triggers-mailbox-link"/);
    assert.match(refused, /href="\/en\/connections"/);
    const recorded = render({
      data: list([], { mail: { connected: true, state: 'connector_missing', stateAt: 'x' } }),
    });
    assert.match(recorded, /data-mailbox-state="connector_missing"/);
  });

  test('the ten-minute read notice shows', () => {
    const html = render();
    assert.match(html, /data-testid="mail-triggers-read-notice"/);
    assert.ok(has(html, 'While a trigger is on, the platform signs in to your mailbox about every 10 minutes (about once an hour after repeated failures) to look for new mail.'));
  });

  test('the unread-only sentence shows', () => {
    const html = render();
    assert.match(html, /data-testid="mail-triggers-unread-notice"/);
    assert.ok(has(html, 'It only looks at unread mail, never marks mail as read, and never changes your mailbox.'));
  });

  test('the list shows target, task, sender, subject word, zone, state and the last run', () => {
    const html = render();
    assert.match(html, /data-testid="mail-trigger-row-e1"/);
    assert.ok(has(html, 'Workflow: Mail prep'));
    assert.ok(has(html, 'Summarise the new mail'));
    assert.ok(has(html, 'boss@example.com'));
    assert.match(html, /data-testid="mail-trigger-sender-e1"/);
    assert.ok(has(html, 'invoice'));
    assert.ok(has(html, '@example.org'));
    assert.ok(has(html, en('row.anySubject')));
    assert.ok(has(html, 'Europe/London'));
    assert.ok(has(html, 'Chief of Staff'));
    assert.ok(has(html, en('target.workflowGone')));
    assert.ok(has(html, en('row.neverRan')));
    assert.ok(has(html, '2026-11-13'));
    assert.ok(has(html, en('reasons.day_limit')));
    assert.match(html, /data-testid="mail-trigger-last-e1-result"/);
    assert.match(html, /href="\/en\/results"/);
    assert.doesNotMatch(html, /data-testid="mail-trigger-last-e2-result"/);
  });

  test('the limit line, and the limit notice with New disabled once three are used', () => {
    assert.ok(has(render(), '3 of 3 mail triggers used'));
    assert.ok(has(render({ data: list([CHIEF_TRIGGER]) }), '1 of 3 mail triggers used'));
    assert.doesNotMatch(render({ data: list([CHIEF_TRIGGER]) }), /mail-triggers-limit-reached/);
    const full = render();
    assert.match(full, /data-testid="mail-triggers-limit-reached"/);
    assert.ok(has(full, 'You have reached the limit of 3 mail triggers. Delete one to add another.'));
    assert.match(full, /<button[^>]*disabled=""[^>]*data-testid="mail-triggers-new"/);
  });

  test('switch state, edit, history and delete controls per row', () => {
    const html = render();
    assert.match(html, /data-testid="mail-trigger-switch-e1"/);
    assert.match(html, /aria-checked="true"/);
    assert.match(html, /aria-checked="false"/);
    assert.match(html, /data-testid="mail-trigger-edit-e1"/);
    assert.match(html, /data-testid="mail-trigger-history-toggle-e1"/);
    assert.match(html, /data-testid="mail-trigger-delete-e1"/);
  });

  test('delete asks for a confirm step first', () => {
    const html = render({ confirmDeleteId: 'e1' });
    assert.match(html, /data-testid="mail-trigger-delete-confirm-e1"/);
    assert.match(html, /data-testid="mail-trigger-delete-yes-e1"/);
    assert.ok(has(html, en('row.deleteConfirm')));
    assert.doesNotMatch(html, /data-testid="mail-trigger-delete-e1"/);
  });

  test('saved, deleted and switched notices, and a row error', () => {
    for (const key of ['notice.saved', 'notice.deleted', 'notice.switchedOn', 'notice.switchedOff']) {
      const html = render({ noticeKey: key });
      assert.match(html, /data-testid="mail-triggers-notice"/);
      assert.ok(has(html, en(key)));
    }
    const failed = render({ rowError: { triggerId: 'e1', errorKey: 'errors.mail_trigger_not_found' } });
    assert.match(failed, /data-testid="mail-trigger-row-error-e1"/);
    assert.ok(has(failed, en('errors.mail_trigger_not_found')));
  });

  test('history: loading, empty, failed and runs with their reasons', () => {
    const loading = render({ history: { triggerId: 'e1', phase: 'loading', runs: [] } });
    assert.match(loading, /data-testid="mail-trigger-history-loading"/);
    const empty = render({ history: { triggerId: 'e1', phase: 'ready', runs: [] } });
    assert.match(empty, /data-testid="mail-trigger-history-empty"/);
    const failed = render({ history: { triggerId: 'e1', phase: 'failed', runs: [] } });
    assert.match(failed, /data-testid="mail-trigger-history-error"/);
    const ready = render({
      history: {
        triggerId: 'e1',
        phase: 'ready',
        runs: [
          { id: 'r1', arrivedAt: 'x', localDate: '2026-11-12', outcome: 'skipped', reason: 'workflow_off', collaborationRunId: null, at: 'x' },
          { id: 'r2', arrivedAt: 'x', localDate: '2026-11-11', outcome: 'skipped', reason: 'no_credits', collaborationRunId: null, at: 'x' },
        ],
      },
    });
    assert.match(ready, /data-testid="mail-trigger-history-run-r1"/);
    assert.ok(has(ready, en('reasons.workflow_off')));
    assert.ok(has(ready, en('reasons.no_credits')));
  });

  test('describeMailRun translates the outcome and every reason in every locale', () => {
    for (const { messages } of LOCALES) {
      const t = translator(messages);
      for (const outcome of MAIL_TRIGGER_OUTCOMES) {
        for (const reason of [null, ...MAIL_TRIGGER_SKIP_REASONS]) {
          const described = describeMailRun(t, {
            arrivedAt: '',
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

describe('mail triggers form', () => {
  const create = {
    editingId: null,
    draft: { ...emptyMailDraft('Asia/Taipei'), task: 'Brief me' },
    saving: false,
    errorKey: null,
  };

  test('create form: target picker, task with counter, sender with its rule, subject word, zone, enabled and the hint', () => {
    const html = render({ form: create });
    assert.match(html, /data-testid="mail-trigger-form"/);
    assert.ok(has(html, en('form.createTitle')));
    assert.ok(has(html, en('form.hint')));
    assert.match(html, /data-testid="mail-trigger-target"/);
    assert.ok(has(html, 'Workflow: Mail prep'));
    assert.match(html, /data-testid="mail-trigger-task"/);
    assert.match(html, /data-testid="mail-trigger-sender"/);
    assert.match(html, /maxLength="254"/);
    assert.match(html, /data-testid="mail-trigger-sender-rule"/);
    assert.ok(has(html, en('form.senderHint')));
    assert.match(html, /data-testid="mail-trigger-subject"/);
    assert.match(html, /maxLength="100"/);
    assert.match(html, /value="Asia\/Taipei"/);
    assert.match(html, /data-testid="mail-trigger-enabled"/);
    assert.ok(has(html, '8 of 7500 characters'));
    assert.match(html, /<button[^>]*disabled=""[^>]*data-testid="mail-triggers-new"/);
  });

  test('the form says the run is told only that mail arrived and its number', () => {
    const html = render({ form: create });
    assert.match(html, /data-testid="mail-trigger-hint"/);
    assert.ok(has(html, 'The run is told only that mail arrived and its message number.'));
  });

  test('a sender rule error shows its sentence', () => {
    const html = render({ form: { ...create, errorKey: 'errors.mail_trigger_invalid_sender' } });
    assert.match(html, /data-testid="mail-trigger-form-error"/);
    assert.ok(has(html, en('errors.mail_trigger_invalid_sender')));
  });

  test('the workflow warning shows for a workflow target only', () => {
    assert.doesNotMatch(render({ form: create }), /data-testid="mail-trigger-workflow-warning"/);
    const html = render({ form: { ...create, draft: { ...create.draft, targetId: 'w1' } } });
    assert.match(html, /data-testid="mail-trigger-workflow-warning"/);
    assert.ok(has(html, en('form.workflowWarning')));
  });

  test('edit form starts from the saved trigger', () => {
    const html = render({
      form: { editingId: 'e1', draft: draftFromMailTrigger(WORKFLOW_TRIGGER), saving: false, errorKey: null },
    });
    assert.ok(has(html, en('form.editTitle')));
    assert.ok(has(html, 'Summarise the new mail'));
    assert.match(html, /value="boss@example.com"/);
    assert.match(html, /value="invoice"/);
    assert.match(html, /<option value="w1" selected/);
  });

  test('a workflow that is gone stays selectable as the saved target', () => {
    const html = render({
      form: { editingId: 'e2', draft: draftFromMailTrigger(GONE_TRIGGER), saving: false, errorKey: null },
    });
    assert.match(html, /<option value="w9" selected/);
    assert.ok(has(html, en('target.workflowGone')));
  });

  test('saving disables the fields and shows the saving label', () => {
    const html = render({ form: { ...create, saving: true } });
    assert.ok(has(html, en('form.saving')));
    assert.match(html, /<button[^>]*disabled=""[^>]*data-testid="mail-trigger-save"/);
  });

  test('a save error shows a translated sentence in every locale, for every mail_trigger_* code', () => {
    for (const { messages } of LOCALES) {
      for (const code of MAIL_TRIGGER_ERROR_CODES) {
        const html = render({ form: { ...create, errorKey: `errors.${code}` } }, messages);
        assert.match(html, /data-testid="mail-trigger-form-error"/);
        assert.ok(has(html, readMessage(messages, `schedules.mail.errors.${code}`) as string), code);
      }
    }
  });

  test('the section renders in Traditional and Simplified Chinese without English chrome', () => {
    for (const { messages } of LOCALES.filter((locale) => locale.code !== 'en')) {
      const html = render(
        { data: list([CHIEF_TRIGGER], { enabled: false, runsEnabled: false, mail: { connected: false, state: 'ok', stateAt: null } }) },
        messages,
      );
      assert.ok(has(html, readMessage(messages, 'schedules.mail.title') as string));
      assert.ok(has(html, readMessage(messages, 'schedules.mail.banner.off') as string));
      assert.ok(has(html, readMessage(messages, 'schedules.mail.mailbox.connector_missing') as string));
      assert.doesNotMatch(html, /schedules\.mail\./);
    }
  });
});

describe('a switched-off target (TRIGGER-TARGET-OFF-01: warn, not refuse)', () => {
  const NEW_KEYS = [
    'target.offNote',
    'target.draftNote',
    'form.targetOffWarning',
    'form.targetDraftWarning',
    'notice.switchedOnTargetOff',
  ];

  const WITH_STATUS = [
    { id: 'wA', name: 'Researcher', status: 'active' as const },
    { id: 'wD', name: 'Drafter', status: 'draft' as const },
    { id: 'wO', name: 'Night shift', status: 'disabled' as const },
  ];

  function trigger(id: string, target: Record<string, unknown>): MailTriggerItem {
    return parseMailTrigger({
      id,
      target,
      task: `Task ${id}`,
      senderFilter: 'news@example.net',
      subjectFilter: null,
      timeZone: 'UTC',
      enabled: true,
      lastRun: null,
    }) as MailTriggerItem;
  }

  const ACTIVE = trigger('t1', { kind: 'workflow', workflowId: 'wA', name: 'Researcher', status: 'active' });
  const OFF = trigger('t2', { kind: 'workflow', workflowId: 'wO', name: 'Night shift', status: 'disabled' });
  const DRAFT = trigger('t3', { kind: 'workflow', workflowId: 'wD', name: 'Drafter', status: 'draft' });
  const GONE = trigger('t4', { kind: 'workflow', workflowId: 'wG', name: null, status: 'missing' });
  const CHIEF = trigger('t5', { kind: 'chief-of-staff' });
  const NO_STATUS = trigger('t6', { kind: 'workflow', workflowId: 'wA', name: 'Researcher' });
  const UNKNOWN = trigger('t7', { kind: 'workflow', workflowId: 'wA', name: 'Researcher', status: 'paused' });

  test('the new strings are in all three locales, real Chinese, and say the trigger will not start until the workflow is on', () => {
    for (const { code, messages } of LOCALES) {
      for (const key of NEW_KEYS) {
        const value = readMessage(messages, `schedules.mail.${key}`);
        assert.ok(value && value.trim().length > 0, `missing ${key} in ${code}`);
        if (code !== 'en') {
          assert.ok(/[\u4e00-\u9fff]/.test(value), `${key} is not Chinese in ${code}`);
          assert.notEqual(value, en(key));
        }
      }
    }
    for (const key of NEW_KEYS) {
      assert.notEqual(
        readMessage(zhTwMessages as Messages, `schedules.mail.${key}`),
        readMessage(zhCnMessages as Messages, `schedules.mail.${key}`),
        key,
      );
      assert.match(en(key), /will not start anything until/);
    }
  });

  test('a row shows an amber target line for a switched-off and a draft target, and nothing for the others', () => {
    const html = render({
      data: list([ACTIVE, OFF, DRAFT, GONE, CHIEF, NO_STATUS, UNKNOWN], { limit: 8 }),
      workflows: WITH_STATUS,
    });
    assert.match(html, /data-testid="mail-trigger-target-status-t2" data-status="disabled"/);
    assert.ok(has(html, en('target.offNote')));
    assert.match(html, /data-testid="mail-trigger-target-status-t3" data-status="draft"/);
    assert.ok(has(html, en('target.draftNote')));
    for (const id of ['t1', 't4', 't5', 't6', 't7']) {
      assert.doesNotMatch(html, new RegExp(`mail-trigger-target-status-${id}"`), id);
    }
    // The deleted target keeps its label and test id.
    assert.ok(has(html, en('target.workflowGone')));
    assert.match(html, /data-testid="mail-trigger-target-t4"/);
    const line = html.slice(html.indexOf('data-testid="mail-trigger-target-status-t2"'));
    assert.match(line.slice(0, 600), /<svg[^>]*aria-hidden="true"/);
  });

  test('the form warns under the target picker when the chosen workflow is not on; saving stays possible', () => {
    const form = (targetId: string) => ({
      editingId: null,
      draft: { ...emptyMailDraft('UTC'), targetId, task: 'Brief me' },
      saving: false,
      errorKey: null,
    });
    const off = render({ form: form('wO'), data: list([]), workflows: WITH_STATUS });
    assert.match(off, /data-testid="mail-trigger-target-warning"/);
    assert.ok(has(off, en('form.targetOffWarning')));
    assert.match(off, /aria-describedby="mail-trigger-target-warning"/);
    assert.match(off, /id="mail-trigger-target-warning"/);
    assert.doesNotMatch(off, /<button[^>]*disabled=""[^>]*data-testid="mail-trigger-save"/);
    assert.doesNotMatch(off, /data-testid="mail-trigger-form-error"/);

    const draft = render({ form: form('wD'), data: list([]), workflows: WITH_STATUS });
    assert.ok(has(draft, en('form.targetDraftWarning')));
    assert.doesNotMatch(draft, new RegExp(escapeHtml(en('form.targetOffWarning'))));

    for (const html of [
      render({ form: form('wA'), data: list([]), workflows: WITH_STATUS }),
      render({ form: form(''), data: list([]), workflows: WITH_STATUS }),
      render({ form: form('wA'), data: list([]), workflows: [{ id: 'wA', name: 'Researcher' }] }),
    ]) {
      assert.doesNotMatch(html, /data-testid="mail-trigger-target-warning"/);
    }
  });

  test("editing a trigger whose list entry has no status warns from the trigger's own target", () => {
    const html = render({
      form: { editingId: 't2', draft: draftFromMailTrigger(OFF), saving: false, errorKey: null },
      data: list([OFF]),
      workflows: [{ id: 'wO', name: 'Night shift' }],
    });
    assert.match(html, /data-testid="mail-trigger-target-warning"/);
    assert.ok(has(html, en('form.targetOffWarning')));
    // Picking another, active workflow in the same form clears it.
    const moved = render({
      form: { editingId: 't2', draft: { ...draftFromMailTrigger(OFF), targetId: 'wA' }, saving: false, errorKey: null },
      data: list([OFF]),
      workflows: WITH_STATUS,
    });
    assert.doesNotMatch(moved, /data-testid="mail-trigger-target-warning"/);
  });

  test('the switch-on notice for a target that is not on is its own amber notice; the others stay as they were', () => {
    const warn = render({ noticeKey: 'notice.switchedOnTargetOff' });
    assert.match(warn, /data-testid="mail-triggers-notice" data-tone="warning"/);
    assert.ok(has(warn, en('notice.switchedOnTargetOff')));
    assert.match(warn, /text-amber-200/);
    assert.notEqual(en('notice.switchedOnTargetOff'), en('notice.switchedOn'));
    for (const key of ['notice.saved', 'notice.deleted', 'notice.switchedOn', 'notice.switchedOff']) {
      const html = render({ noticeKey: key });
      assert.match(html, /data-testid="mail-triggers-notice"/);
      assert.doesNotMatch(html, /data-tone="warning"/);
    }
  });

  test('the switch handler picks the notice from the answered target and never blocks the switch', () => {
    const source = readFileSync(new URL('./mail-triggers-section.tsx', import.meta.url), 'utf8');
    assert.match(source, /setNoticeKey\(targetSwitchNoticeKey\(result\.value\.enabled, result\.value\.target\)\)/);
    assert.match(source, /setNoticeKey\('notice\.saved'\)/);
    assert.doesNotMatch(source, /errorKey: [^\n]*target(Off|Draft)Warning/);
  });

  test('the new lines render in Traditional and Simplified Chinese without English chrome', () => {
    for (const { messages } of LOCALES.filter((locale) => locale.code !== 'en')) {
      const html = render(
        {
          data: list([OFF, DRAFT]),
          workflows: WITH_STATUS,
          noticeKey: 'notice.switchedOnTargetOff',
          form: { editingId: null, draft: { ...emptyMailDraft('UTC'), targetId: 'wO', task: 'x' }, saving: false, errorKey: null },
        },
        messages,
      );
      for (const key of ['target.offNote', 'target.draftNote', 'form.targetOffWarning', 'notice.switchedOnTargetOff']) {
        assert.ok(has(html, readMessage(messages, `schedules.mail.${key}`) as string), key);
      }
      assert.doesNotMatch(html, /schedules\.(events|mail|knowledge)\./);
    }
  });
});
