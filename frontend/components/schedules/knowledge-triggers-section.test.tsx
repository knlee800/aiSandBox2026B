import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  KnowledgeTriggersSectionView,
  describeKnowledgeRun,
  type KnowledgeTriggersSectionViewProps,
} from '@/components/schedules/knowledge-triggers-section';
import {
  CHIEF_OF_STAFF_FOLDER_IDS,
  KNOWLEDGE_FOLDER_IDS,
  KNOWLEDGE_TRIGGER_ERROR_CODES,
  KNOWLEDGE_TRIGGER_OUTCOMES,
  KNOWLEDGE_TRIGGER_SKIP_REASONS,
  draftFromKnowledgeTrigger,
  emptyKnowledgeDraft,
  parseKnowledgeTrigger,
  type KnowledgeTriggerItem,
  type KnowledgeTriggerList,
} from '@/components/schedules/knowledge-triggers.logic';
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
  const value = readMessage(EN, `schedules.knowledge.${key}`);
  assert.ok(value, `missing schedules.knowledge.${key} in en`);
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
  return (key: string) => readMessage(messages, `schedules.knowledge.${key}`) ?? `schedules.knowledge.${key}`;
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

const WORKFLOW_TRIGGER = parseKnowledgeTrigger({
  id: 'k1',
  target: { kind: 'workflow', workflowId: 'w1', name: 'Reader', status: 'enabled' },
  task: 'Summarise the new files',
  scopeId: 'market-data',
  timeZone: 'Europe/London',
  enabled: true,
  lastRun: {
    changedAt: '2026-11-14T10:00:00.000Z',
    localDate: '2026-11-14',
    outcome: 'started',
    reason: null,
    collaborationRunId: 'run-1',
    at: 'x',
  },
}) as KnowledgeTriggerItem;

const GONE_TRIGGER = parseKnowledgeTrigger({
  id: 'k2',
  target: { kind: 'workflow', workflowId: 'w9', name: null, status: 'missing' },
  task: 'Old job',
  scopeId: 'tech-landscape',
  timeZone: 'UTC',
  enabled: false,
  lastRun: {
    changedAt: '2026-11-13T10:00:00.000Z',
    localDate: '2026-11-13',
    outcome: 'skipped',
    reason: 'day_limit',
    collaborationRunId: null,
    at: 'x',
  },
}) as KnowledgeTriggerItem;

const CHIEF_TRIGGER = parseKnowledgeTrigger({
  id: 'k3',
  target: { kind: 'chief-of-staff' },
  task: 'Brief me',
  scopeId: 'policies',
  timeZone: 'Asia/Taipei',
  enabled: true,
  lastRun: null,
}) as KnowledgeTriggerItem;

function list(triggers: KnowledgeTriggerItem[], overrides: Partial<KnowledgeTriggerList> = {}): KnowledgeTriggerList {
  return { enabled: true, runsEnabled: true, limit: 3, triggers, ...overrides };
}

function folderTranslator(messages: Messages) {
  return (id: string) => readMessage(messages, `knowledge.scopes.${id}`) ?? `knowledge.scopes.${id}`;
}

function render(overrides: Partial<KnowledgeTriggersSectionViewProps> = {}, messages: Messages = EN): string {
  const props: KnowledgeTriggersSectionViewProps = {
    t: translator(messages),
    folderName: folderTranslator(messages),
    locale: 'en',
    phase: 'ready',
    data: list([WORKFLOW_TRIGGER, GONE_TRIGGER, CHIEF_TRIGGER]),
    workflows: [{ id: 'w1', name: 'Reader' }],
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
  return renderToStaticMarkup(<KnowledgeTriggersSectionView {...props} />);
}

describe('knowledge triggers messages', () => {
  test('all three locales have the same schedules.knowledge keys and none is empty', () => {
    const reference = leafKeys((EN.schedules as Messages).knowledge, 'schedules.knowledge').sort();
    assert.ok(reference.length > 70);
    for (const { code, messages } of LOCALES) {
      assert.deepEqual(
        leafKeys((messages.schedules as Messages).knowledge, 'schedules.knowledge').sort(),
        reference,
        `keys differ in ${code}`,
      );
      for (const key of reference) {
        const value = readMessage(messages, key);
        assert.ok(value && value.trim().length > 0, `empty ${key} in ${code}`);
      }
    }
  });

  test('every knowledge_trigger_* code, reason and outcome has a key in all three locales', () => {
    const keys = [
      ...KNOWLEDGE_TRIGGER_ERROR_CODES.map((code) => `schedules.knowledge.errors.${code}`),
      ...KNOWLEDGE_TRIGGER_SKIP_REASONS.map((code) => `schedules.knowledge.reasons.${code}`),
      ...KNOWLEDGE_TRIGGER_OUTCOMES.map((code) => `schedules.knowledge.outcomes.${code}`),
      'schedules.knowledge.errors.generic',
      'schedules.knowledge.errors.network',
      'schedules.knowledge.reasons.unknown',
      'schedules.knowledge.outcomes.unknown',
      'schedules.knowledge.form.workflowWarning',
      'schedules.knowledge.batchNotice',
      ...KNOWLEDGE_FOLDER_IDS.map((id) => `knowledge.scopes.${id}`),
    ];
    for (const { code, messages } of LOCALES) {
      for (const key of keys) {
        assert.ok(readMessage(messages, key), `missing ${key} in ${code}`);
      }
    }
    assert.ok(KNOWLEDGE_TRIGGER_SKIP_REASONS.includes('day_limit'));
    assert.equal(KNOWLEDGE_TRIGGER_SKIP_REASONS.length, 14);
    assert.equal(KNOWLEDGE_TRIGGER_ERROR_CODES.length, 13);
  });

  test('the Chinese files hold real translations, not the English text, and differ from each other', () => {
    const keys = [
      'title',
      'banner.off',
      'banner.runsOff',
      'batchNotice',
      'privacyNotice',
      'form.workflowWarning',
      'form.folderRule',
      'reasons.day_limit',
      'reasons.workflow_not_tested',
      'errors.knowledge_trigger_folder_not_readable',
      'errors.knowledge_trigger_invalid_folder',
      'errors.knowledge_trigger_limit_reached',
    ];
    for (const { code, messages } of LOCALES.filter((locale) => locale.code !== 'en')) {
      for (const key of keys) {
        const value = readMessage(messages, `schedules.knowledge.${key}`);
        assert.ok(value && /[一-鿿]/.test(value), `${key} is not Chinese in ${code}`);
        assert.notEqual(value, en(key));
      }
    }
    assert.notEqual(
      readMessage(zhTwMessages as Messages, 'schedules.knowledge.title'),
      readMessage(zhCnMessages as Messages, 'schedules.knowledge.title'),
    );
  });
});

describe('knowledge triggers section states', () => {
  test('loading, failed with retry, and forbidden', () => {
    const loading = render({ phase: 'loading', data: null });
    assert.match(loading, /data-testid="knowledge-triggers-loading"/);
    assert.ok(has(loading, en('loading')));
    const failed = render({ phase: 'failed', data: null });
    assert.match(failed, /data-testid="knowledge-triggers-error"/);
    assert.match(failed, /data-testid="knowledge-triggers-retry"/);
    assert.ok(has(failed, en('loadError')));
    const forbidden = render({ phase: 'forbidden', data: null });
    assert.match(forbidden, /data-testid="knowledge-triggers-forbidden"/);
    assert.ok(has(forbidden, en('forbiddenTitle')));
    assert.doesNotMatch(forbidden, /data-testid="knowledge-triggers-new"/);
  });

  test('the heading shows in every state, so a failed load still leaves the section labelled', () => {
    for (const phase of ['loading', 'failed', 'forbidden', 'ready'] as const) {
      const html = render({ phase, data: phase === 'ready' ? list([]) : null });
      assert.match(html, /data-testid="knowledge-triggers-section"/);
      assert.ok(has(html, en('title')), phase);
    }
  });

  test('empty state', () => {
    const html = render({ data: list([]) });
    assert.match(html, /data-testid="knowledge-triggers-empty"/);
    assert.ok(has(html, en('emptyTitle')));
    assert.match(html, /data-testid="knowledge-triggers-new"/);
    assert.doesNotMatch(html, /data-testid="knowledge-triggers-list"/);
  });

  test('the switched-off banner and the runs-off banner show only when their switch is off', () => {
    const both = render({ data: list([CHIEF_TRIGGER], { enabled: false, runsEnabled: false }) });
    assert.match(both, /data-testid="knowledge-triggers-banner-off"/);
    assert.match(both, /data-testid="knowledge-triggers-banner-runs-off"/);
    assert.ok(has(both, 'File triggers are switched off; nothing will start.'));
    assert.ok(has(both, en('banner.runsOff')));
    const none = render();
    assert.doesNotMatch(none, /knowledge-triggers-banner-off/);
    assert.doesNotMatch(none, /knowledge-triggers-banner-runs-off/);
  });

  test('the batch sentence and the privacy hint show', () => {
    const html = render();
    assert.match(html, /data-testid="knowledge-triggers-batch-notice"/);
    assert.ok(has(html, 'Files added together start one run, a few minutes after the last one.'));
    assert.match(html, /data-testid="knowledge-triggers-privacy-notice"/);
    assert.ok(has(html, 'The run is told only the folder, the time and the documents’ ids, and reads the files itself.'));
  });

  test('the list shows target, task, folder name, zone, state and the last run', () => {
    const html = render();
    assert.match(html, /data-testid="knowledge-trigger-row-k1"/);
    assert.ok(has(html, 'Workflow: Reader'));
    assert.ok(has(html, 'Summarise the new files'));
    assert.match(html, /data-testid="knowledge-trigger-folder-k1"/);
    assert.ok(has(html, 'Market data'));
    assert.ok(has(html, 'Technology landscape'));
    assert.ok(has(html, 'Policies'));
    assert.ok(has(html, 'Europe/London'));
    assert.ok(has(html, 'Chief of Staff'));
    assert.ok(has(html, en('target.workflowGone')));
    assert.ok(has(html, en('row.neverRan')));
    assert.ok(has(html, '2026-11-13'));
    assert.ok(has(html, en('reasons.day_limit')));
    assert.match(html, /data-testid="knowledge-trigger-last-k1-result"/);
    assert.match(html, /href="\/en\/results"/);
    assert.doesNotMatch(html, /data-testid="knowledge-trigger-last-k2-result"/);
  });

  test('the limit line, and the limit notice with New disabled once three are used', () => {
    assert.ok(has(render(), '3 of 3 file triggers used'));
    assert.ok(has(render({ data: list([CHIEF_TRIGGER]) }), '1 of 3 file triggers used'));
    assert.doesNotMatch(render({ data: list([CHIEF_TRIGGER]) }), /knowledge-triggers-limit-reached/);
    const full = render();
    assert.match(full, /data-testid="knowledge-triggers-limit-reached"/);
    assert.ok(has(full, 'You have reached the limit of 3 file triggers. Delete one to add another.'));
    assert.match(full, /<button[^>]*disabled=""[^>]*data-testid="knowledge-triggers-new"/);
  });

  test('switch state, edit, history and delete controls per row', () => {
    const html = render();
    assert.match(html, /data-testid="knowledge-trigger-switch-k1"/);
    assert.match(html, /aria-checked="true"/);
    assert.match(html, /aria-checked="false"/);
    assert.match(html, /data-testid="knowledge-trigger-edit-k1"/);
    assert.match(html, /data-testid="knowledge-trigger-history-toggle-k1"/);
    assert.match(html, /data-testid="knowledge-trigger-delete-k1"/);
  });

  test('delete asks for a confirm step first', () => {
    const html = render({ confirmDeleteId: 'k1' });
    assert.match(html, /data-testid="knowledge-trigger-delete-confirm-k1"/);
    assert.match(html, /data-testid="knowledge-trigger-delete-yes-k1"/);
    assert.ok(has(html, en('row.deleteConfirm')));
    assert.doesNotMatch(html, /data-testid="knowledge-trigger-delete-k1"/);
  });

  test('saved, deleted and switched notices, and a row error', () => {
    for (const key of ['notice.saved', 'notice.deleted', 'notice.switchedOn', 'notice.switchedOff']) {
      const html = render({ noticeKey: key });
      assert.match(html, /data-testid="knowledge-triggers-notice"/);
      assert.ok(has(html, en(key)));
    }
    const failed = render({ rowError: { triggerId: 'k1', errorKey: 'errors.knowledge_trigger_not_found' } });
    assert.match(failed, /data-testid="knowledge-trigger-row-error-k1"/);
    assert.ok(has(failed, en('errors.knowledge_trigger_not_found')));
  });

  test('history: loading, empty, failed and runs with their reasons', () => {
    const loading = render({ history: { triggerId: 'k1', phase: 'loading', runs: [] } });
    assert.match(loading, /data-testid="knowledge-trigger-history-loading"/);
    const empty = render({ history: { triggerId: 'k1', phase: 'ready', runs: [] } });
    assert.match(empty, /data-testid="knowledge-trigger-history-empty"/);
    const failed = render({ history: { triggerId: 'k1', phase: 'failed', runs: [] } });
    assert.match(failed, /data-testid="knowledge-trigger-history-error"/);
    const ready = render({
      history: {
        triggerId: 'k1',
        phase: 'ready',
        runs: [
          { id: 'r1', documentId: 'd1', changedAt: 'x', localDate: '2026-11-12', outcome: 'skipped', reason: 'workflow_off', collaborationRunId: null, at: 'x' },
          { id: 'r2', documentId: 'd2', changedAt: 'x', localDate: '2026-11-11', outcome: 'skipped', reason: 'no_credits', collaborationRunId: null, at: 'x' },
        ],
      },
    });
    assert.match(ready, /data-testid="knowledge-trigger-history-run-r1"/);
    assert.ok(has(ready, en('reasons.workflow_off')));
    assert.ok(has(ready, en('reasons.no_credits')));
  });

  test('describeKnowledgeRun translates the outcome and every reason in every locale', () => {
    for (const { messages } of LOCALES) {
      const t = translator(messages);
      for (const outcome of KNOWLEDGE_TRIGGER_OUTCOMES) {
        for (const reason of [null, ...KNOWLEDGE_TRIGGER_SKIP_REASONS]) {
          const described = describeKnowledgeRun(t, {
            changedAt: '',
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

describe('knowledge triggers form', () => {
  const create = {
    editingId: null,
    draft: { ...emptyKnowledgeDraft('Asia/Taipei'), task: 'Brief me' },
    saving: false,
    errorKey: null,
  };

  test('create form: target picker, task with counter, folder picker with its rule, zone, enabled and the hint', () => {
    const html = render({ form: create });
    assert.match(html, /data-testid="knowledge-trigger-form"/);
    assert.ok(has(html, en('form.createTitle')));
    assert.ok(has(html, en('form.hint')));
    assert.match(html, /data-testid="knowledge-trigger-target"/);
    assert.ok(has(html, 'Workflow: Reader'));
    assert.match(html, /data-testid="knowledge-trigger-task"/);
    assert.match(html, /maxLength="7000"/);
    assert.ok(has(html, '8 of 7000 characters'));
    assert.match(html, /data-testid="knowledge-trigger-folder"/);
    assert.match(html, /data-testid="knowledge-trigger-folder-rule"/);
    assert.match(html, /value="Asia\/Taipei"/);
    assert.match(html, /data-testid="knowledge-trigger-enabled"/);
    assert.match(html, /<button[^>]*disabled=""[^>]*data-testid="knowledge-triggers-new"/);
  });

  test('the folder picker lists all nine folders by their existing names and marks the three a workflow alone can watch', () => {
    const html = render({ form: create });
    for (const id of KNOWLEDGE_FOLDER_IDS) {
      assert.match(html, new RegExp(`<option value="${id}"`), id);
    }
    for (const id of CHIEF_OF_STAFF_FOLDER_IDS) {
      const name = readMessage(EN, `knowledge.scopes.${id}`) as string;
      assert.ok(html.includes(`>${escapeHtml(name)}<`), id);
    }
    assert.ok(has(html, 'Codebase context (workflow only)'));
    assert.ok(has(html, 'Market data (workflow only)'));
    assert.ok(has(html, 'Technology landscape (workflow only)'));
    assert.ok(!has(html, 'Policies (workflow only)'));
    assert.ok(has(html, 'The Chief of Staff can read these folders: '));
    assert.ok(has(html, 'The other folders can only be watched by a workflow.'));
  });

  test('the form says the run is told only the folder, the time and the ids', () => {
    const html = render({ form: create });
    assert.match(html, /data-testid="knowledge-trigger-hint"/);
    assert.ok(has(html, 'The run is told only the folder, the time and the ids of the added or replaced documents.'));
  });

  test('the Chief of Staff refusal shows for the Chief of Staff on a folder it cannot read, and not otherwise', () => {
    const refused = render({ form: { ...create, draft: { ...create.draft, scopeId: 'codebase-context' } } });
    assert.match(refused, /data-testid="knowledge-trigger-folder-refusal"/);
    assert.ok(has(refused, en('errors.knowledge_trigger_folder_not_readable')));
    assert.doesNotMatch(render({ form: create }), /data-testid="knowledge-trigger-folder-refusal"/);
    const workflow = render({
      form: { ...create, draft: { ...create.draft, targetId: 'w1', scopeId: 'codebase-context' } },
    });
    assert.doesNotMatch(workflow, /data-testid="knowledge-trigger-folder-refusal"/);
  });

  test('the workflow warning shows for a workflow target only', () => {
    assert.doesNotMatch(render({ form: create }), /data-testid="knowledge-trigger-workflow-warning"/);
    const html = render({ form: { ...create, draft: { ...create.draft, targetId: 'w1' } } });
    assert.match(html, /data-testid="knowledge-trigger-workflow-warning"/);
    assert.ok(has(html, en('form.workflowWarning')));
  });

  test('a save error shows its sentence', () => {
    const html = render({ form: { ...create, errorKey: 'errors.knowledge_trigger_invalid_folder' } });
    assert.match(html, /data-testid="knowledge-trigger-form-error"/);
    assert.ok(has(html, en('errors.knowledge_trigger_invalid_folder')));
  });

  test('edit form starts from the saved trigger', () => {
    const html = render({
      form: { editingId: 'k1', draft: draftFromKnowledgeTrigger(WORKFLOW_TRIGGER), saving: false, errorKey: null },
    });
    assert.ok(has(html, en('form.editTitle')));
    assert.ok(has(html, 'Summarise the new files'));
    assert.match(html, /<option value="market-data" selected/);
    assert.match(html, /<option value="w1" selected/);
    assert.match(html, /value="Europe\/London"/);
  });

  test('a workflow that is gone stays selectable as the saved target', () => {
    const html = render({
      form: { editingId: 'k2', draft: draftFromKnowledgeTrigger(GONE_TRIGGER), saving: false, errorKey: null },
    });
    assert.match(html, /<option value="w9" selected/);
    assert.ok(has(html, en('target.workflowGone')));
  });

  test('saving disables the fields and shows the saving label', () => {
    const html = render({ form: { ...create, saving: true } });
    assert.ok(has(html, en('form.saving')));
    assert.match(html, /<button[^>]*disabled=""[^>]*data-testid="knowledge-trigger-save"/);
  });

  test('a save error shows a translated sentence in every locale, for every knowledge_trigger_* code', () => {
    for (const { messages } of LOCALES) {
      for (const code of KNOWLEDGE_TRIGGER_ERROR_CODES) {
        const html = render({ form: { ...create, errorKey: `errors.${code}` } }, messages);
        assert.match(html, /data-testid="knowledge-trigger-form-error"/);
        assert.ok(has(html, readMessage(messages, `schedules.knowledge.errors.${code}`) as string), code);
      }
    }
  });

  test('the section renders in Traditional and Simplified Chinese without English chrome', () => {
    for (const { messages } of LOCALES.filter((locale) => locale.code !== 'en')) {
      const html = render(
        { data: list([CHIEF_TRIGGER], { enabled: false, runsEnabled: false }), form: create },
        messages,
      );
      assert.ok(has(html, readMessage(messages, 'schedules.knowledge.title') as string));
      assert.ok(has(html, readMessage(messages, 'schedules.knowledge.banner.off') as string));
      assert.ok(has(html, readMessage(messages, 'knowledge.scopes.policies') as string));
      assert.doesNotMatch(html, /schedules\.knowledge\./);
      assert.doesNotMatch(html, /knowledge\.scopes\./);
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

  function trigger(id: string, target: Record<string, unknown>): KnowledgeTriggerItem {
    return parseKnowledgeTrigger({
      id,
      target,
      task: `Task ${id}`,
      scopeId: 'policies',
      timeZone: 'UTC',
      enabled: true,
      lastRun: null,
    }) as KnowledgeTriggerItem;
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
        const value = readMessage(messages, `schedules.knowledge.${key}`);
        assert.ok(value && value.trim().length > 0, `missing ${key} in ${code}`);
        if (code !== 'en') {
          assert.ok(/[\u4e00-\u9fff]/.test(value), `${key} is not Chinese in ${code}`);
          assert.notEqual(value, en(key));
        }
      }
    }
    for (const key of NEW_KEYS) {
      assert.notEqual(
        readMessage(zhTwMessages as Messages, `schedules.knowledge.${key}`),
        readMessage(zhCnMessages as Messages, `schedules.knowledge.${key}`),
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
    assert.match(html, /data-testid="knowledge-trigger-target-status-t2" data-status="disabled"/);
    assert.ok(has(html, en('target.offNote')));
    assert.match(html, /data-testid="knowledge-trigger-target-status-t3" data-status="draft"/);
    assert.ok(has(html, en('target.draftNote')));
    for (const id of ['t1', 't4', 't5', 't6', 't7']) {
      assert.doesNotMatch(html, new RegExp(`knowledge-trigger-target-status-${id}"`), id);
    }
    // The deleted target keeps its label and test id.
    assert.ok(has(html, en('target.workflowGone')));
    assert.match(html, /data-testid="knowledge-trigger-target-t4"/);
    const line = html.slice(html.indexOf('data-testid="knowledge-trigger-target-status-t2"'));
    assert.match(line.slice(0, 600), /<svg[^>]*aria-hidden="true"/);
  });

  test('the form warns under the target picker when the chosen workflow is not on; saving stays possible', () => {
    const form = (targetId: string) => ({
      editingId: null,
      draft: { ...emptyKnowledgeDraft('UTC'), targetId, task: 'Brief me' },
      saving: false,
      errorKey: null,
    });
    const off = render({ form: form('wO'), data: list([]), workflows: WITH_STATUS });
    assert.match(off, /data-testid="knowledge-trigger-target-warning"/);
    assert.ok(has(off, en('form.targetOffWarning')));
    assert.match(off, /aria-describedby="knowledge-trigger-target-warning"/);
    assert.match(off, /id="knowledge-trigger-target-warning"/);
    assert.doesNotMatch(off, /<button[^>]*disabled=""[^>]*data-testid="knowledge-trigger-save"/);
    assert.doesNotMatch(off, /data-testid="knowledge-trigger-form-error"/);

    const draft = render({ form: form('wD'), data: list([]), workflows: WITH_STATUS });
    assert.ok(has(draft, en('form.targetDraftWarning')));
    assert.doesNotMatch(draft, new RegExp(escapeHtml(en('form.targetOffWarning'))));

    for (const html of [
      render({ form: form('wA'), data: list([]), workflows: WITH_STATUS }),
      render({ form: form(''), data: list([]), workflows: WITH_STATUS }),
      render({ form: form('wA'), data: list([]), workflows: [{ id: 'wA', name: 'Researcher' }] }),
    ]) {
      assert.doesNotMatch(html, /data-testid="knowledge-trigger-target-warning"/);
    }
  });

  test("editing a trigger whose list entry has no status warns from the trigger's own target", () => {
    const html = render({
      form: { editingId: 't2', draft: draftFromKnowledgeTrigger(OFF), saving: false, errorKey: null },
      data: list([OFF]),
      workflows: [{ id: 'wO', name: 'Night shift' }],
    });
    assert.match(html, /data-testid="knowledge-trigger-target-warning"/);
    assert.ok(has(html, en('form.targetOffWarning')));
    // Picking another, active workflow in the same form clears it.
    const moved = render({
      form: { editingId: 't2', draft: { ...draftFromKnowledgeTrigger(OFF), targetId: 'wA' }, saving: false, errorKey: null },
      data: list([OFF]),
      workflows: WITH_STATUS,
    });
    assert.doesNotMatch(moved, /data-testid="knowledge-trigger-target-warning"/);
  });

  test('the switch-on notice for a target that is not on is its own amber notice; the others stay as they were', () => {
    const warn = render({ noticeKey: 'notice.switchedOnTargetOff' });
    assert.match(warn, /data-testid="knowledge-triggers-notice" data-tone="warning"/);
    assert.ok(has(warn, en('notice.switchedOnTargetOff')));
    assert.match(warn, /text-amber-200/);
    assert.notEqual(en('notice.switchedOnTargetOff'), en('notice.switchedOn'));
    for (const key of ['notice.saved', 'notice.deleted', 'notice.switchedOn', 'notice.switchedOff']) {
      const html = render({ noticeKey: key });
      assert.match(html, /data-testid="knowledge-triggers-notice"/);
      assert.doesNotMatch(html, /data-tone="warning"/);
    }
  });

  test('the switch handler picks the notice from the answered target and never blocks the switch', () => {
    const source = readFileSync(new URL('./knowledge-triggers-section.tsx', import.meta.url), 'utf8');
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
          form: { editingId: null, draft: { ...emptyKnowledgeDraft('UTC'), targetId: 'wO', task: 'x' }, saving: false, errorKey: null },
        },
        messages,
      );
      for (const key of ['target.offNote', 'target.draftNote', 'form.targetOffWarning', 'notice.switchedOnTargetOff']) {
        assert.ok(has(html, readMessage(messages, `schedules.knowledge.${key}`) as string), key);
      }
      assert.doesNotMatch(html, /schedules\.(events|mail|knowledge)\./);
    }
  });
});
