import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ChainTriggersSectionView,
  describeChainRun,
  type ChainTriggersSectionViewProps,
} from '@/components/schedules/chain-triggers-section';
import {
  CHAIN_TRIGGER_ERROR_CODES,
  CHAIN_TRIGGER_OUTCOMES,
  CHAIN_TRIGGER_SKIP_REASONS,
  draftFromChainTrigger,
  emptyChainDraft,
  parseChainTrigger,
  type ChainTriggerItem,
  type ChainTriggerList,
} from '@/components/schedules/chain-triggers.logic';
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
  const value = readMessage(EN, `schedules.chain.${key}`);
  assert.ok(value, `missing schedules.chain.${key} in en`);
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
  return (key: string) => readMessage(messages, `schedules.chain.${key}`) ?? `schedules.chain.${key}`;
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

const WORKFLOW_TRIGGER = parseChainTrigger({
  id: 'c1',
  sourceWorkflowId: 'wA',
  target: { kind: 'workflow', workflowId: 'wB', name: 'Writer', status: 'enabled' },
  task: 'Write the follow-up',
  timeZone: 'Europe/London',
  enabled: true,
  lastRun: {
    sourceRunId: 'run-1',
    sourceCompletedAt: '2026-11-16T10:00:00.000Z',
    localDate: '2026-11-16',
    depth: 2,
    outcome: 'started',
    reason: null,
    collaborationRunId: 'run-2',
    at: 'x',
  },
}) as ChainTriggerItem;

/** Its source (w9) is not in the workflows the page loaded, and its target is gone. */
const GONE_TRIGGER = parseChainTrigger({
  id: 'c2',
  sourceWorkflowId: 'w9',
  target: { kind: 'workflow', workflowId: 'w8', name: null, status: 'missing' },
  task: 'Old job',
  timeZone: 'UTC',
  enabled: false,
  lastRun: {
    sourceRunId: 'run-3',
    sourceCompletedAt: 'x',
    localDate: '2026-11-15',
    depth: 1,
    outcome: 'skipped',
    reason: 'day_limit',
    collaborationRunId: null,
    at: 'x',
  },
}) as ChainTriggerItem;

const CHIEF_TRIGGER = parseChainTrigger({
  id: 'c3',
  sourceWorkflowId: 'wB',
  target: { kind: 'chief-of-staff' },
  task: 'Brief me',
  timeZone: 'Asia/Taipei',
  enabled: true,
  lastRun: null,
}) as ChainTriggerItem;

function list(triggers: ChainTriggerItem[], overrides: Partial<ChainTriggerList> = {}): ChainTriggerList {
  return { enabled: true, runsEnabled: true, resultToolEnabled: true, limit: 3, triggers, ...overrides };
}

const WORKFLOWS = [
  { id: 'wA', name: 'Researcher' },
  { id: 'wB', name: 'Writer' },
  { id: 'wC', name: 'Reviewer' },
];

function render(overrides: Partial<ChainTriggersSectionViewProps> = {}, messages: Messages = EN): string {
  const props: ChainTriggersSectionViewProps = {
    t: translator(messages),
    locale: 'en',
    phase: 'ready',
    data: list([WORKFLOW_TRIGGER, GONE_TRIGGER, CHIEF_TRIGGER]),
    workflows: WORKFLOWS,
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
  return renderToStaticMarkup(<ChainTriggersSectionView {...props} />);
}

describe('chain triggers messages', () => {
  test('all three locales have the same schedules.chain keys and none is empty', () => {
    const reference = leafKeys((EN.schedules as Messages).chain, 'schedules.chain').sort();
    assert.ok(reference.length > 80);
    for (const { code, messages } of LOCALES) {
      assert.deepEqual(
        leafKeys((messages.schedules as Messages).chain, 'schedules.chain').sort(),
        reference,
        `keys differ in ${code}`,
      );
      for (const key of reference) {
        const value = readMessage(messages, key);
        assert.ok(value && value.trim().length > 0, `empty ${key} in ${code}`);
      }
    }
  });

  test('every chain_trigger_* code, reason and outcome has a key in all three locales', () => {
    const keys = [
      ...CHAIN_TRIGGER_ERROR_CODES.map((code) => `schedules.chain.errors.${code}`),
      ...CHAIN_TRIGGER_SKIP_REASONS.map((code) => `schedules.chain.reasons.${code}`),
      ...CHAIN_TRIGGER_OUTCOMES.map((code) => `schedules.chain.outcomes.${code}`),
      'schedules.chain.errors.generic',
      'schedules.chain.errors.network',
      'schedules.chain.reasons.unknown',
      'schedules.chain.outcomes.unknown',
      'schedules.chain.reasons.chain_depth',
      'schedules.chain.errors.chain_trigger_same_workflow',
      'schedules.chain.errors.chain_trigger_cycle',
      'schedules.chain.banner.resultToolOff',
      'schedules.chain.delayNotice',
      'schedules.chain.source.workflowGone',
    ];
    for (const { code, messages } of LOCALES) {
      for (const key of keys) {
        assert.ok(readMessage(messages, key), `missing ${key} in ${code}`);
      }
    }
    assert.ok(CHAIN_TRIGGER_SKIP_REASONS.includes('chain_depth'));
    assert.ok(CHAIN_TRIGGER_SKIP_REASONS.includes('day_limit'));
    assert.equal(CHAIN_TRIGGER_SKIP_REASONS.length, 15);
    assert.equal(CHAIN_TRIGGER_ERROR_CODES.length, 14);
  });

  test('the Chinese files hold real translations, not the English text, and differ from each other', () => {
    const keys = [
      'title',
      'banner.off',
      'banner.runsOff',
      'banner.resultToolOff',
      'delayNotice',
      'privacyNotice',
      'source.workflowGone',
      'form.hint',
      'form.loopRule',
      'reasons.chain_depth',
      'reasons.day_limit',
      'reasons.workflow_not_tested',
      'errors.chain_trigger_same_workflow',
      'errors.chain_trigger_cycle',
      'errors.chain_trigger_invalid_source',
      'errors.chain_trigger_limit_reached',
    ];
    for (const { code, messages } of LOCALES.filter((locale) => locale.code !== 'en')) {
      for (const key of keys) {
        const value = readMessage(messages, `schedules.chain.${key}`);
        assert.ok(value && /[一-鿿]/.test(value), `${key} is not Chinese in ${code}`);
        assert.notEqual(value, en(key));
      }
    }
    assert.notEqual(
      readMessage(zhTwMessages as Messages, 'schedules.chain.title'),
      readMessage(zhCnMessages as Messages, 'schedules.chain.title'),
    );
  });
});

describe('chain triggers section states', () => {
  test('loading, failed with retry, and forbidden', () => {
    const loading = render({ phase: 'loading', data: null });
    assert.match(loading, /data-testid="chain-triggers-loading"/);
    assert.ok(has(loading, en('loading')));
    const failed = render({ phase: 'failed', data: null });
    assert.match(failed, /data-testid="chain-triggers-error"/);
    assert.match(failed, /data-testid="chain-triggers-retry"/);
    assert.ok(has(failed, en('loadError')));
    const forbidden = render({ phase: 'forbidden', data: null });
    assert.match(forbidden, /data-testid="chain-triggers-forbidden"/);
    assert.ok(has(forbidden, en('forbiddenTitle')));
    assert.doesNotMatch(forbidden, /data-testid="chain-triggers-new"/);
  });

  test('the heading shows in every state, so a failed load still leaves the section labelled', () => {
    for (const phase of ['loading', 'failed', 'forbidden', 'ready'] as const) {
      const html = render({ phase, data: phase === 'ready' ? list([]) : null });
      assert.match(html, /data-testid="chain-triggers-section"/);
      assert.ok(has(html, en('title')), phase);
    }
    assert.equal(en('title'), 'After a workflow finishes');
  });

  test('empty state', () => {
    const html = render({ data: list([]) });
    assert.match(html, /data-testid="chain-triggers-empty"/);
    assert.ok(has(html, en('emptyTitle')));
    assert.match(html, /data-testid="chain-triggers-new"/);
    assert.doesNotMatch(html, /data-testid="chain-triggers-list"/);
  });

  test('each of the three banners shows only when its switch is off', () => {
    const all = render({ data: list([CHIEF_TRIGGER], { enabled: false, runsEnabled: false, resultToolEnabled: false }) });
    assert.match(all, /data-testid="chain-triggers-banner-off"/);
    assert.match(all, /data-testid="chain-triggers-banner-runs-off"/);
    assert.match(all, /data-testid="chain-triggers-banner-result-tool-off"/);
    assert.ok(has(all, 'Workflow triggers are switched off; nothing will start.'));
    assert.ok(has(all, en('banner.runsOff')));
    assert.ok(
      has(all, 'The run result tool is switched off, so nothing starts after a workflow finishes until it is switched on.'),
    );
    const toolOnly = render({ data: list([CHIEF_TRIGGER], { resultToolEnabled: false }) });
    assert.match(toolOnly, /data-testid="chain-triggers-banner-result-tool-off"/);
    assert.doesNotMatch(toolOnly, /chain-triggers-banner-off/);
    assert.doesNotMatch(toolOnly, /chain-triggers-banner-runs-off/);
    const none = render();
    assert.doesNotMatch(none, /chain-triggers-banner-/);
  });

  test('the delay sentence and the privacy hint show', () => {
    const html = render();
    assert.match(html, /data-testid="chain-triggers-delay-notice"/);
    assert.ok(has(html, 'A run starts a few minutes after the source workflow finishes.'));
    assert.match(html, /data-testid="chain-triggers-privacy-notice"/);
    assert.ok(has(html, 'The next run is told only the finished run’s id and time, and reads its answer itself.'));
  });

  test('the list shows source, what starts next, task, zone, state, the last run with its step, and the deleted-source label', () => {
    const html = render();
    assert.match(html, /data-testid="chain-trigger-row-c1"/);
    assert.ok(has(html, 'Workflow: Researcher'));
    assert.ok(has(html, 'Workflow: Writer'));
    assert.ok(has(html, 'Write the follow-up'));
    assert.ok(has(html, 'Europe/London'));
    assert.ok(has(html, 'Chief of Staff'));
    assert.ok(has(html, en('target.workflowGone')));
    assert.ok(has(html, en('row.neverRan')));
    assert.ok(has(html, '2026-11-15'));
    assert.ok(has(html, 'Step 2 of a chain'));
    assert.ok(has(html, en('reasons.day_limit')));
    assert.match(html, /data-testid="chain-trigger-last-c1-result"/);
    assert.match(html, /href="\/en\/results"/);
    assert.doesNotMatch(html, /data-testid="chain-trigger-last-c2-result"/);
    // c2's source is not among the loaded workflows: the deleted label and its note show, and only there.
    assert.match(html, /data-testid="chain-trigger-source-gone-c2"/);
    assert.ok(has(html, '(deleted workflow)'));
    assert.doesNotMatch(html, /data-testid="chain-trigger-source-gone-c1"/);
    assert.doesNotMatch(html, /data-testid="chain-trigger-source-gone-c3"/);
  });

  test('the limit line, and the limit notice with New disabled once three are used', () => {
    assert.ok(has(render(), '3 of 3 workflow triggers used'));
    assert.ok(has(render({ data: list([CHIEF_TRIGGER]) }), '1 of 3 workflow triggers used'));
    assert.doesNotMatch(render({ data: list([CHIEF_TRIGGER]) }), /chain-triggers-limit-reached/);
    const full = render();
    assert.match(full, /data-testid="chain-triggers-limit-reached"/);
    assert.ok(has(full, 'You have reached the limit of 3 workflow triggers. Delete one to add another.'));
    assert.match(full, /<button[^>]*disabled=""[^>]*data-testid="chain-triggers-new"/);
  });

  test('switch state, edit, history and delete controls per row', () => {
    const html = render();
    assert.match(html, /data-testid="chain-trigger-switch-c1"/);
    assert.match(html, /aria-checked="true"/);
    assert.match(html, /aria-checked="false"/);
    assert.match(html, /data-testid="chain-trigger-edit-c1"/);
    assert.match(html, /data-testid="chain-trigger-history-toggle-c1"/);
    assert.match(html, /data-testid="chain-trigger-delete-c1"/);
  });

  test('delete asks for a confirm step first', () => {
    const html = render({ confirmDeleteId: 'c1' });
    assert.match(html, /data-testid="chain-trigger-delete-confirm-c1"/);
    assert.match(html, /data-testid="chain-trigger-delete-yes-c1"/);
    assert.ok(has(html, en('row.deleteConfirm')));
    assert.doesNotMatch(html, /data-testid="chain-trigger-delete-c1"/);
  });

  test('saved, deleted and switched notices, and a row error', () => {
    for (const key of ['notice.saved', 'notice.deleted', 'notice.switchedOn', 'notice.switchedOff']) {
      const html = render({ noticeKey: key });
      assert.match(html, /data-testid="chain-triggers-notice"/);
      assert.ok(has(html, en(key)));
    }
    const failed = render({ rowError: { triggerId: 'c1', errorKey: 'errors.chain_trigger_not_found' } });
    assert.match(failed, /data-testid="chain-trigger-row-error-c1"/);
    assert.ok(has(failed, en('errors.chain_trigger_not_found')));
    assert.doesNotMatch(render(), /chain-triggers-notice/);
  });

  test('history: loading, empty, failed and runs with their reasons and depth', () => {
    const loading = render({ history: { triggerId: 'c1', phase: 'loading', runs: [] } });
    assert.match(loading, /data-testid="chain-trigger-history-loading"/);
    const empty = render({ history: { triggerId: 'c1', phase: 'ready', runs: [] } });
    assert.match(empty, /data-testid="chain-trigger-history-empty"/);
    const failed = render({ history: { triggerId: 'c1', phase: 'failed', runs: [] } });
    assert.match(failed, /data-testid="chain-trigger-history-error"/);
    const ready = render({
      history: {
        triggerId: 'c1',
        phase: 'ready',
        runs: [
          { id: 'r1', sourceRunId: 'a', sourceCompletedAt: 'x', localDate: '2026-11-14', depth: 3, outcome: 'skipped', reason: 'chain_depth', collaborationRunId: null, at: 'x' },
          { id: 'r2', sourceRunId: 'b', sourceCompletedAt: 'x', localDate: '2026-11-13', depth: 1, outcome: 'started', reason: null, collaborationRunId: 'run-9', at: 'x' },
        ],
      },
    });
    assert.match(ready, /data-testid="chain-trigger-history-run-r1"/);
    assert.ok(has(ready, en('reasons.chain_depth')));
    assert.ok(has(ready, 'Step 3 of a chain'));
    assert.match(ready, /data-testid="chain-trigger-history-run-r2-result"/);
  });

  test('describeChainRun translates the outcome, every reason and the step in every locale', () => {
    for (const { messages } of LOCALES) {
      const t = translator(messages);
      for (const outcome of CHAIN_TRIGGER_OUTCOMES) {
        for (const reason of [null, ...CHAIN_TRIGGER_SKIP_REASONS]) {
          const described = describeChainRun(t, {
            sourceRunId: 'r',
            sourceCompletedAt: '',
            localDate: 'd',
            depth: 2,
            outcome,
            reason,
            collaborationRunId: null,
            at: '',
          });
          assert.ok(!described.outcome.startsWith('schedules.'));
          assert.ok(described.reason === null || !described.reason.startsWith('schedules.'));
          assert.ok(!described.depth.startsWith('schedules.') && !described.depth.includes('{depth}'));
        }
      }
    }
  });
});

describe('chain triggers form', () => {
  const create = {
    editingId: null,
    draft: { ...emptyChainDraft('Asia/Taipei'), sourceId: 'wA', task: 'Brief me' },
    saving: false,
    errorKey: null,
  };

  test('create form: source and target pickers from the loaded workflows, task with counter, zone, enabled and the hint', () => {
    const html = render({ form: create, data: list([]) });
    assert.match(html, /data-testid="chain-trigger-form"/);
    assert.ok(has(html, en('form.createTitle')));
    assert.ok(has(html, 'The next run is told only the id and the time of the finished run.'));
    assert.match(html, /data-testid="chain-trigger-source"/);
    assert.match(html, /<option value="wA" selected/);
    assert.match(html, /<option value="wB">/);
    assert.match(html, /<option value="wC">/);
    assert.ok(has(html, 'Workflow: Researcher'));
    assert.match(html, /data-testid="chain-trigger-target"/);
    assert.ok(has(html, en('form.sourcePlaceholder')));
    assert.match(html, /data-testid="chain-trigger-task"/);
    assert.match(html, /maxLength="7000"/);
    assert.ok(has(html, '8 of 7000 characters'));
    assert.match(html, /value="Asia\/Taipei"/);
    assert.match(html, /data-testid="chain-trigger-enabled"/);
    assert.match(html, /data-testid="chain-trigger-loop-rule"/);
    assert.match(html, /<button[^>]*disabled=""[^>]*data-testid="chain-triggers-new"/);
  });

  test('the same-workflow refusal shows only when source and target are one workflow', () => {
    const same = render({ form: { ...create, draft: { ...create.draft, targetId: 'wA' } } });
    assert.match(same, /data-testid="chain-trigger-same-refusal"/);
    assert.ok(has(same, en('errors.chain_trigger_same_workflow')));
    assert.doesNotMatch(render({ form: create }), /data-testid="chain-trigger-same-refusal"/);
    assert.doesNotMatch(
      render({ form: { ...create, draft: { ...create.draft, targetId: 'wB' } } }),
      /data-testid="chain-trigger-same-refusal"/,
    );
  });

  test('the cycle refusal shows when the draft would loop back, and not for a chain that ends', () => {
    // c1 saved: wA to wB. Drafting wB to wA closes the loop.
    const loops = render({
      form: { ...create, draft: { ...create.draft, sourceId: 'wB', targetId: 'wA' } },
      data: list([WORKFLOW_TRIGGER]),
    });
    assert.match(loops, /data-testid="chain-trigger-cycle-refusal"/);
    assert.ok(has(loops, en('errors.chain_trigger_cycle')));
    const fine = render({
      form: { ...create, draft: { ...create.draft, sourceId: 'wB', targetId: 'wC' } },
      data: list([WORKFLOW_TRIGGER]),
    });
    assert.doesNotMatch(fine, /data-testid="chain-trigger-cycle-refusal"/);
    assert.doesNotMatch(render({ form: create }), /data-testid="chain-trigger-cycle-refusal"/);
  });

  test('a save error shows its sentence', () => {
    const html = render({ form: { ...create, errorKey: 'errors.chain_trigger_invalid_source' } });
    assert.match(html, /data-testid="chain-trigger-form-error"/);
    assert.ok(has(html, en('errors.chain_trigger_invalid_source')));
  });

  test('edit form starts from the saved trigger', () => {
    const html = render({
      form: { editingId: 'c1', draft: draftFromChainTrigger(WORKFLOW_TRIGGER), saving: false, errorKey: null },
    });
    assert.ok(has(html, en('form.editTitle')));
    assert.ok(has(html, 'Write the follow-up'));
    assert.match(html, /<option value="wA" selected/);
    assert.match(html, /<option value="wB" selected/);
    assert.match(html, /value="Europe\/London"/);
  });

  test('a deleted source or target stays selectable as the saved value, with its deleted label', () => {
    const html = render({
      form: { editingId: 'c2', draft: draftFromChainTrigger(GONE_TRIGGER), saving: false, errorKey: null },
    });
    assert.match(html, /<option value="w9" selected[^>]*>\(deleted workflow\)<\/option>/);
    assert.match(html, /<option value="w8" selected/);
    assert.ok(has(html, en('target.workflowGone')));
  });

  test('saving disables the fields and shows the saving label', () => {
    const html = render({ form: { ...create, saving: true } });
    assert.ok(has(html, en('form.saving')));
    assert.match(html, /<button[^>]*disabled=""[^>]*data-testid="chain-trigger-save"/);
    assert.match(html, /<select[^>]*disabled=""[^>]*data-testid="chain-trigger-source"/);
  });

  test('a save error shows a translated sentence in every locale, for every chain_trigger_* code', () => {
    for (const { messages } of LOCALES) {
      for (const code of CHAIN_TRIGGER_ERROR_CODES) {
        const html = render({ form: { ...create, errorKey: `errors.${code}` } }, messages);
        assert.match(html, /data-testid="chain-trigger-form-error"/);
        assert.ok(has(html, readMessage(messages, `schedules.chain.errors.${code}`) as string), code);
      }
    }
  });

  test('the section renders in Traditional and Simplified Chinese without English chrome', () => {
    for (const { messages } of LOCALES.filter((locale) => locale.code !== 'en')) {
      const html = render(
        {
          data: list([WORKFLOW_TRIGGER, GONE_TRIGGER], { enabled: false, runsEnabled: false, resultToolEnabled: false }),
          form: { ...create, draft: { ...create.draft, targetId: 'wA' } },
        },
        messages,
      );
      assert.ok(has(html, readMessage(messages, 'schedules.chain.title') as string));
      assert.ok(has(html, readMessage(messages, 'schedules.chain.banner.off') as string));
      assert.ok(has(html, readMessage(messages, 'schedules.chain.banner.resultToolOff') as string));
      assert.ok(has(html, readMessage(messages, 'schedules.chain.errors.chain_trigger_same_workflow') as string));
      assert.ok(has(html, readMessage(messages, 'schedules.chain.source.workflowGone') as string));
      assert.doesNotMatch(html, /schedules\.chain\./);
    }
  });
});
