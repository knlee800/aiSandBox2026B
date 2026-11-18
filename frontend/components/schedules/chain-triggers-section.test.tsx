import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  target: { kind: 'workflow', workflowId: 'wB', name: 'Writer', status: 'active' },
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
      'schedules.chain.errors.chain_trigger_invalid_fires_on',
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
    assert.equal(CHAIN_TRIGGER_ERROR_CODES.length, 15);
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
      'subtitle',
      'emptyBody',
      'form.firesOn',
      'form.firesOnCompleted',
      'form.firesOnFailed',
      'form.firesOnFailedHelp',
      'form.hintFailed',
      'row.whenCompleted',
      'row.whenFailed',
      'errors.chain_trigger_invalid_fires_on',
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
      has(
        all,
        'The run result tool is switched off, so triggers for a run that finishes normally start nothing until it is switched on. Triggers for a run that fails still work.',
      ),
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
    assert.ok(has(html, "A run starts a few minutes after the source workflow's run ends."));
    assert.match(html, /data-testid="chain-triggers-privacy-notice"/);
    assert.ok(
      has(html, 'After a run that finishes normally, the next run is told only its id and time, and reads its answer itself.'),
    );
    assert.ok(has(html, "After a run that fails, the next run is told the workflow's name, the run's id and time"));
    assert.ok(has(html, 'The platform never reads an answer or an error text to start a run.'));
  });

  test('S3: the subtitle and the empty text name both outcomes, and each row says which it is', () => {
    assert.equal(en('subtitle'), 'Start a run when one of your workflows finishes a run or fails.');
    assert.ok(has(render(), en('subtitle')));
    const empty = render({ data: list([]) });
    assert.ok(has(empty, 'when one of your workflows finishes a run or fails.'));
    const failedTrigger = { ...CHIEF_TRIGGER, id: 'c4', firesOn: 'failed' as const };
    const html = render({ data: list([WORKFLOW_TRIGGER, failedTrigger]) });
    assert.match(html, /data-testid="chain-trigger-fires-on-c1"[^>]*data-fires-on="completed"[^>]*>When it finishes normally</);
    assert.match(html, /data-testid="chain-trigger-fires-on-c4"[^>]*data-fires-on="failed"[^>]*>When it fails</);
    for (const { messages } of LOCALES) {
      const zh = render({ data: list([failedTrigger]) }, messages);
      assert.ok(has(zh, readMessage(messages, 'schedules.chain.row.whenFailed') as string));
    }
  });

  test('S3: a trigger parsed from a view without firesOn shows the finishes-normally label', () => {
    assert.equal(WORKFLOW_TRIGGER.firesOn, 'completed');
    assert.ok(has(render({ data: list([WORKFLOW_TRIGGER]) }), 'When it finishes normally'));
    assert.ok(!has(render({ data: list([WORKFLOW_TRIGGER]) }), 'When it fails'));
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

  test('S3: the outcome choice defaults to Finishes normally, with the original help and hint', () => {
    const html = render({ form: create, data: list([]) });
    assert.match(html, /data-testid="chain-trigger-fires-on"/);
    assert.ok(has(html, 'Start when the run'));
    assert.match(html, /<input[^>]*type="radio"[^>]*data-testid="chain-trigger-fires-on-completed"[^>]*checked=""/);
    assert.doesNotMatch(html, /<input[^>]*data-testid="chain-trigger-fires-on-failed"[^>]*checked=""/);
    assert.ok(has(html, 'Finishes normally') && has(html, 'Fails'));
    assert.ok(has(html, en('form.sourceHelp')));
    assert.ok(has(html, en('form.hint')));
    assert.ok(!has(html, en('form.firesOnFailedHelp')));
    assert.ok(!has(html, en('form.hintFailed')));
  });

  test('S3: choosing Fails swaps the help and the hint in every locale', () => {
    for (const { messages } of LOCALES) {
      const text = (key: string) => readMessage(messages, `schedules.chain.${key}`) as string;
      const html = render({ form: { ...create, draft: { ...create.draft, firesOn: 'failed' } }, data: list([]) }, messages);
      assert.match(html, /<input[^>]*type="radio"[^>]*data-testid="chain-trigger-fires-on-failed"[^>]*checked=""/);
      assert.ok(has(html, text('form.firesOnFailedHelp')));
      assert.ok(has(html, text('form.hintFailed')));
      assert.ok(has(html, text('form.firesOn')));
      assert.ok(!has(html, text('form.sourceHelp')));
      assert.ok(!has(html, text('form.hint')));
    }
    assert.ok(has(render({ form: { ...create, draft: { ...create.draft, firesOn: 'failed' } } }), 'A run counts as failed when a step fails'));
  });

  test('S3: an edit loads the stored outcome, and saving disables the choice', () => {
    const failedTrigger = { ...WORKFLOW_TRIGGER, firesOn: 'failed' as const };
    const html = render({
      form: { editingId: 'c1', draft: draftFromChainTrigger(failedTrigger), saving: false, errorKey: null },
      data: list([failedTrigger]),
    });
    assert.match(html, /<input[^>]*data-testid="chain-trigger-fires-on-failed"[^>]*checked=""/);
    const saving = render({ form: { ...create, saving: true } });
    assert.match(saving, /<fieldset[^>]*disabled=""[^>]*data-testid="chain-trigger-fires-on"/);
  });

  test('S3: the invalid-fires-on error shows its sentence in the form in every locale', () => {
    assert.equal(
      en('errors.chain_trigger_invalid_fires_on'),
      'Choose whether the trigger starts when the run finishes normally or when it fails.',
    );
    for (const { messages } of LOCALES) {
      const html = render({ form: { ...create, errorKey: 'errors.chain_trigger_invalid_fires_on' } }, messages);
      assert.match(html, /data-testid="chain-trigger-form-error"/);
      assert.ok(has(html, readMessage(messages, 'schedules.chain.errors.chain_trigger_invalid_fires_on') as string));
    }
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

describe('a switched-off source (CHAIN-SOURCE-OFF-01: warn, not refuse)', () => {
  const NEW_KEYS = [
    'source.offNote',
    'source.draftNote',
    'form.sourceOffWarning',
    'form.sourceDraftWarning',
    'notice.switchedOnSourceOff',
    'notice.switchedOnSourceGone',
  ];

  /** The page's workflow list as the workflows route now answers it, with each status. */
  const WITH_STATUS = [
    { id: 'wA', name: 'Researcher', status: 'active' as const },
    { id: 'wB', name: 'Writer', status: 'active' as const },
    { id: 'wD', name: 'Drafter', status: 'draft' as const },
    { id: 'wO', name: 'Night shift', status: 'disabled' as const },
  ];

  function trigger(id: string, source: Record<string, unknown> | undefined, sourceWorkflowId: string): ChainTriggerItem {
    return parseChainTrigger({
      id,
      sourceWorkflowId,
      ...(source ? { source } : {}),
      target: { kind: 'chief-of-staff' },
      task: `Task ${id}`,
      timeZone: 'UTC',
      enabled: true,
      lastRun: null,
    }) as ChainTriggerItem;
  }

  const ACTIVE = trigger('s1', { workflowId: 'wA', name: 'Researcher', status: 'active' }, 'wA');
  const OFF = trigger('s2', { workflowId: 'wO', name: 'Night shift', status: 'disabled' }, 'wO');
  const DRAFT = trigger('s3', { workflowId: 'wD', name: 'Drafter', status: 'draft' }, 'wD');
  const GONE = trigger('s4', { workflowId: 'wG', name: null, status: 'missing' }, 'wG');

  test('the new strings are in all three locales, and the Chinese ones are real and differ from each other', () => {
    for (const { code, messages } of LOCALES) {
      for (const key of NEW_KEYS) {
        const value = readMessage(messages, `schedules.chain.${key}`);
        assert.ok(value && value.trim().length > 0, `missing ${key} in ${code}`);
        if (code !== 'en') {
          assert.ok(/[一-鿿]/.test(value), `${key} is not Chinese in ${code}`);
          assert.notEqual(value, en(key));
        }
      }
    }
    for (const key of NEW_KEYS) {
      assert.notEqual(
        readMessage(zhTwMessages as Messages, `schedules.chain.${key}`),
        readMessage(zhCnMessages as Messages, `schedules.chain.${key}`),
        key,
      );
    }
    // Each says plainly that the trigger will not start until the source workflow is switched on.
    for (const key of ['source.offNote', 'source.draftNote', 'form.sourceOffWarning', 'form.sourceDraftWarning', 'notice.switchedOnSourceOff']) {
      assert.match(en(key), /will not start anything until/);
      assert.match(en(key), /switched on/);
    }
    assert.notEqual(en('notice.switchedOnSourceOff'), en('notice.switchedOn'));
  });

  test('a row shows an amber status line for a switched-off, a draft and a deleted source, and nothing for an active one', () => {
    const html = render({ data: list([ACTIVE, OFF, DRAFT, GONE], { limit: 5 }), workflows: WITH_STATUS });
    assert.match(html, /data-testid="chain-trigger-source-status-s2" data-status="disabled"/);
    assert.ok(has(html, en('source.offNote')));
    assert.match(html, /data-testid="chain-trigger-source-status-s3" data-status="draft"/);
    assert.ok(has(html, en('source.draftNote')));
    // A deleted source keeps the existing test id and note.
    assert.match(html, /data-testid="chain-trigger-source-gone-s4" data-status="missing"/);
    assert.ok(has(html, en('source.goneNote')));
    assert.ok(has(html, en('source.workflowGone')));
    for (const id of ['s1']) {
      assert.doesNotMatch(html, new RegExp(`chain-trigger-source-status-${id}`));
      assert.doesNotMatch(html, new RegExp(`chain-trigger-source-gone-${id}`));
    }
    assert.doesNotMatch(html, /chain-trigger-source-gone-s2|chain-trigger-source-gone-s3|chain-trigger-source-status-s4/);
    // The status line carries the outline warning icon, hidden from screen readers.
    const line = html.slice(html.indexOf('data-testid="chain-trigger-source-status-s2"'));
    assert.match(line.slice(0, 600), /<svg[^>]*aria-hidden="true"/);
    // The rows still show the source names.
    assert.ok(has(html, 'Workflow: Night shift'));
    assert.ok(has(html, 'Workflow: Drafter'));
  });

  test("the gateway's source wins over the page's list: its name and status show even when the list lacks the workflow", () => {
    const html = render({ data: list([OFF]), workflows: WORKFLOWS });
    assert.ok(has(html, 'Workflow: Night shift'));
    assert.match(html, /data-testid="chain-trigger-source-status-s2"/);
    assert.doesNotMatch(html, /chain-trigger-source-gone-s2/);
    // A source the gateway calls deleted reads as deleted, even if the list still has it.
    const gone = render({ data: list([trigger('s5', { workflowId: 'wA', name: null, status: 'missing' }, 'wA')]), workflows: WORKFLOWS });
    assert.match(gone, /data-testid="chain-trigger-source-gone-s5"/);
    assert.ok(has(gone, en('source.workflowGone')));
  });

  test('without source (an older gateway) the row falls back to the workflow list and its status', () => {
    const older = [trigger('o1', undefined, 'wO'), trigger('o2', undefined, 'wD'), trigger('o3', undefined, 'wA'), trigger('o4', undefined, 'w9')];
    assert.ok(older.every((entry) => entry.source === null));
    const html = render({ data: list(older, { limit: 4 }), workflows: WITH_STATUS });
    assert.match(html, /data-testid="chain-trigger-source-status-o1" data-status="disabled"/);
    assert.match(html, /data-testid="chain-trigger-source-status-o2" data-status="draft"/);
    assert.doesNotMatch(html, /chain-trigger-source-(status|gone)-o3/);
    assert.match(html, /data-testid="chain-trigger-source-gone-o4"/);
    assert.ok(has(html, 'Workflow: Night shift'));
    // A list without statuses shows nothing extra for a listed source (today's behaviour).
    const plain = render({ data: list([trigger('o5', undefined, 'wA')]), workflows: WORKFLOWS });
    assert.doesNotMatch(plain, /chain-trigger-source-(status|gone)-o5/);
  });

  test('the form warns under the source picker when the chosen workflow is switched off or not yet on; saving stays possible', () => {
    const form = (sourceId: string) => ({
      editingId: null,
      draft: { ...emptyChainDraft('UTC'), sourceId, task: 'Brief me' },
      saving: false,
      errorKey: null,
    });
    const off = render({ form: form('wO'), data: list([]), workflows: WITH_STATUS });
    assert.match(off, /data-testid="chain-trigger-source-warning"/);
    assert.ok(has(off, en('form.sourceOffWarning')));
    assert.match(off, /aria-describedby="chain-trigger-source-help chain-trigger-source-warning"/);
    assert.match(off, /id="chain-trigger-source-warning"/);
    assert.doesNotMatch(off, /<button[^>]*disabled=""[^>]*data-testid="chain-trigger-save"/);
    assert.doesNotMatch(off, /data-testid="chain-trigger-form-error"/);

    const draft = render({ form: form('wD'), data: list([]), workflows: WITH_STATUS });
    assert.ok(has(draft, en('form.sourceDraftWarning')));
    assert.doesNotMatch(draft, new RegExp(escapeHtml(en('form.sourceOffWarning'))));

    for (const html of [
      render({ form: form('wA'), data: list([]), workflows: WITH_STATUS }),
      render({ form: form(''), data: list([]), workflows: WITH_STATUS }),
      render({ form: form('wA'), data: list([]), workflows: WORKFLOWS }),
    ]) {
      assert.doesNotMatch(html, /data-testid="chain-trigger-source-warning"/);
      assert.match(html, /aria-describedby="chain-trigger-source-help"/);
    }
  });

  test("editing a trigger whose list entry has no status warns from the trigger's own source", () => {
    const listed = [...WORKFLOWS, { id: 'wO', name: 'Night shift' }];
    const html = render({
      form: { editingId: 's2', draft: draftFromChainTrigger(OFF), saving: false, errorKey: null },
      data: list([OFF]),
      workflows: listed,
    });
    assert.match(html, /data-testid="chain-trigger-source-warning"/);
    assert.ok(has(html, en('form.sourceOffWarning')));
    // Picking another, active source in the same form clears it.
    const moved = render({
      form: { editingId: 's2', draft: { ...draftFromChainTrigger(OFF), sourceId: 'wA' }, saving: false, errorKey: null },
      data: list([OFF]),
      workflows: WITH_STATUS,
    });
    assert.doesNotMatch(moved, /data-testid="chain-trigger-source-warning"/);
  });

  test('the switch-on notice for a source that is not on (or gone) is its own amber notice; the others stay as they were', () => {
    for (const key of ['notice.switchedOnSourceOff', 'notice.switchedOnSourceGone']) {
      const html = render({ noticeKey: key });
      assert.match(html, /data-testid="chain-triggers-notice" data-tone="warning"/);
      assert.ok(has(html, en(key)));
      assert.match(html, /text-amber-200/);
    }
    for (const key of ['notice.saved', 'notice.deleted', 'notice.switchedOn', 'notice.switchedOff']) {
      const html = render({ noticeKey: key });
      assert.match(html, /data-testid="chain-triggers-notice"/);
      assert.doesNotMatch(html, /data-tone="warning"/);
    }
  });

  test('the switch handler picks the notice from the answered source, and the save path is unchanged (no new refusal)', () => {
    const source = readFileSync(new URL('./chain-triggers-section.tsx', import.meta.url), 'utf8');
    // TRIGGER-TARGET-OFF-01: the notice now also reads the answered target.
    assert.match(
      source,
      /chainSwitchNoticeKeyFor\(result\.value\.enabled, chainSourceStatus\(result\.value, workflows\), result\.value\.target\)/,
    );
    assert.match(source, /setNoticeKey\('notice\.saved'\)/);
    // The source status never blocks a save or a switch: no errorKey is set from it.
    assert.doesNotMatch(source, /errorKey: [^\n]*source(Off|Draft)Warning/);
  });

  test('the new lines render in Traditional and Simplified Chinese without English chrome', () => {
    for (const { messages } of LOCALES.filter((locale) => locale.code !== 'en')) {
      const html = render(
        {
          data: list([OFF, DRAFT]),
          workflows: WITH_STATUS,
          noticeKey: 'notice.switchedOnSourceOff',
          form: { editingId: null, draft: { ...emptyChainDraft('UTC'), sourceId: 'wO', task: 'x' }, saving: false, errorKey: null },
        },
        messages,
      );
      for (const key of ['source.offNote', 'source.draftNote', 'form.sourceOffWarning', 'notice.switchedOnSourceOff']) {
        assert.ok(has(html, readMessage(messages, `schedules.chain.${key}`) as string), key);
      }
      assert.doesNotMatch(html, /schedules\.chain\./);
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
    'notice.switchedOnBothOff',
  ];

  const WITH_STATUS = [
    { id: 'wA', name: 'Researcher', status: 'active' as const },
    { id: 'wB', name: 'Writer', status: 'active' as const },
    { id: 'wD', name: 'Drafter', status: 'draft' as const },
    { id: 'wO', name: 'Night shift', status: 'disabled' as const },
  ];

  function trigger(id: string, target: Record<string, unknown>, source?: Record<string, unknown>): ChainTriggerItem {
    return parseChainTrigger({
      id,
      sourceWorkflowId: 'wA',
      ...(source ? { source } : {}),
      target,
      task: `Task ${id}`,
      timeZone: 'UTC',
      enabled: true,
      lastRun: null,
    }) as ChainTriggerItem;
  }

  const ACTIVE = trigger('t1', { kind: 'workflow', workflowId: 'wB', name: 'Writer', status: 'active' });
  const OFF = trigger('t2', { kind: 'workflow', workflowId: 'wO', name: 'Night shift', status: 'disabled' });
  const DRAFT = trigger('t3', { kind: 'workflow', workflowId: 'wD', name: 'Drafter', status: 'draft' });
  const GONE = trigger('t4', { kind: 'workflow', workflowId: 'wG', name: null, status: 'missing' });
  const CHIEF = trigger('t5', { kind: 'chief-of-staff' });
  const NO_STATUS = trigger('t6', { kind: 'workflow', workflowId: 'wB', name: 'Writer' });
  const UNKNOWN = trigger('t7', { kind: 'workflow', workflowId: 'wB', name: 'Writer', status: 'paused' });

  test('the new strings are in all three locales, real Chinese, and say the trigger will not start until the workflow is on', () => {
    for (const { code, messages } of LOCALES) {
      for (const key of NEW_KEYS) {
        const value = readMessage(messages, `schedules.chain.${key}`);
        assert.ok(value && value.trim().length > 0, `missing ${key} in ${code}`);
        if (code !== 'en') {
          assert.ok(/[一-鿿]/.test(value), `${key} is not Chinese in ${code}`);
          assert.notEqual(value, en(key));
        }
      }
    }
    for (const key of NEW_KEYS) {
      assert.notEqual(
        readMessage(zhTwMessages as Messages, `schedules.chain.${key}`),
        readMessage(zhCnMessages as Messages, `schedules.chain.${key}`),
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
    assert.match(html, /data-testid="chain-trigger-target-status-t2" data-status="disabled"/);
    assert.ok(has(html, en('target.offNote')));
    assert.match(html, /data-testid="chain-trigger-target-status-t3" data-status="draft"/);
    assert.ok(has(html, en('target.draftNote')));
    for (const id of ['t1', 't4', 't5', 't6', 't7']) {
      assert.doesNotMatch(html, new RegExp(`chain-trigger-target-status-${id}"`), id);
    }
    // The deleted target keeps its label and test id.
    assert.ok(has(html, en('target.workflowGone')));
    assert.match(html, /data-testid="chain-trigger-target-t4"/);
    const line = html.slice(html.indexOf('data-testid="chain-trigger-target-status-t2"'));
    assert.match(line.slice(0, 600), /<svg[^>]*aria-hidden="true"/);
  });

  test('a trigger with a source and a target that are both off shows two distinct lines', () => {
    const both = trigger(
      't8',
      { kind: 'workflow', workflowId: 'wO', name: 'Night shift', status: 'disabled' },
      { workflowId: 'wA', name: 'Researcher', status: 'draft' },
    );
    const html = render({ data: list([both]), workflows: WITH_STATUS });
    assert.match(html, /data-testid="chain-trigger-source-status-t8" data-status="draft"/);
    assert.match(html, /data-testid="chain-trigger-target-status-t8" data-status="disabled"/);
    assert.ok(has(html, en('source.draftNote')));
    assert.ok(has(html, en('target.offNote')));
  });

  test('the form warns under the target picker when the chosen workflow is not on; saving stays possible', () => {
    const form = (targetId: string, sourceId = 'wA') => ({
      editingId: null,
      draft: { ...emptyChainDraft('UTC'), sourceId, targetId, task: 'Brief me' },
      saving: false,
      errorKey: null,
    });
    const off = render({ form: form('wO'), data: list([]), workflows: WITH_STATUS });
    assert.match(off, /data-testid="chain-trigger-target-warning"/);
    assert.ok(has(off, en('form.targetOffWarning')));
    assert.match(off, /aria-describedby="chain-trigger-loop-rule chain-trigger-target-warning"/);
    assert.doesNotMatch(off, /<button[^>]*disabled=""[^>]*data-testid="chain-trigger-save"/);
    assert.doesNotMatch(off, /data-testid="chain-trigger-form-error"/);
    // The loop rule stays.
    assert.match(off, /data-testid="chain-trigger-loop-rule"/);

    const draft = render({ form: form('wD'), data: list([]), workflows: WITH_STATUS });
    assert.ok(has(draft, en('form.targetDraftWarning')));

    for (const html of [
      render({ form: form('wB'), data: list([]), workflows: WITH_STATUS }),
      render({ form: form(''), data: list([]), workflows: WITH_STATUS }),
      render({ form: form('wB'), data: list([]), workflows: WORKFLOWS }),
    ]) {
      assert.doesNotMatch(html, /data-testid="chain-trigger-target-warning"/);
      assert.match(html, /aria-describedby="chain-trigger-loop-rule"/);
    }
    // A source warning and a target warning can show together, each its own line.
    const both = render({ form: form('wO', 'wD'), data: list([]), workflows: WITH_STATUS });
    assert.match(both, /data-testid="chain-trigger-source-warning"/);
    assert.match(both, /data-testid="chain-trigger-target-warning"/);
  });

  test("editing a trigger whose list entry has no status warns from the trigger's own target", () => {
    const listed = [...WORKFLOWS, { id: 'wO', name: 'Night shift' }];
    const html = render({
      form: { editingId: 't2', draft: draftFromChainTrigger(OFF), saving: false, errorKey: null },
      data: list([OFF]),
      workflows: listed,
    });
    assert.match(html, /data-testid="chain-trigger-target-warning"/);
    assert.ok(has(html, en('form.targetOffWarning')));
  });

  test('the switch-on notices for a target that is not on are amber', () => {
    for (const key of ['notice.switchedOnTargetOff', 'notice.switchedOnBothOff']) {
      const html = render({ noticeKey: key });
      assert.match(html, /data-testid="chain-triggers-notice" data-tone="warning"/);
      assert.ok(has(html, en(key)));
    }
  });

  test('the new lines render in Traditional and Simplified Chinese without English chrome', () => {
    for (const { messages } of LOCALES.filter((locale) => locale.code !== 'en')) {
      const html = render(
        {
          data: list([OFF, DRAFT]),
          workflows: WITH_STATUS,
          noticeKey: 'notice.switchedOnTargetOff',
          form: {
            editingId: null,
            draft: { ...emptyChainDraft('UTC'), sourceId: 'wA', targetId: 'wO', task: 'x' },
            saving: false,
            errorKey: null,
          },
        },
        messages,
      );
      for (const key of ['target.offNote', 'target.draftNote', 'form.targetOffWarning', 'notice.switchedOnTargetOff']) {
        assert.ok(has(html, readMessage(messages, `schedules.chain.${key}`) as string), key);
      }
      assert.doesNotMatch(html, /schedules\.chain\./);
    }
  });
});
