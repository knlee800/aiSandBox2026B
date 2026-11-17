import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  CHAIN_TRIGGER_ERROR_CODES,
  CHAIN_TRIGGER_OUTCOMES,
  CHAIN_TRIGGER_SKIP_REASONS,
  CHAIN_WARNING_NOTICE_KEYS,
  chainDraftSourceStatus,
  chainLimitReached,
  chainSourceName,
  chainSourceNotOn,
  chainSourceStatus,
  chainSwitchNoticeKey,
  chainOutcomeKey,
  chainReasonKey,
  chainSameWorkflow,
  chainTriggerErrorKey,
  chainWouldLoop,
  draftFromChainTrigger,
  draftToBody,
  emptyChainDraft,
  parseChainTrigger,
  parseChainTriggerList,
  parseChainTriggerRuns,
  type ChainTriggerItem,
} from '@/components/schedules/chain-triggers.logic';

const backend = (file: string) =>
  readFileSync(new URL(`../../../services/api-gateway/src/${file}`, import.meta.url), 'utf8');

/** The quoted values inside the first block that starts at `marker`. */
function quotedIn(source: string, marker: string, open: string, close: string): string[] {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `marker not found: ${marker}`);
  const from = source.indexOf(open, start);
  const to = source.indexOf(close, from);
  return [...source.slice(from, to).matchAll(/'([a-z_-]+)'/g)].map((match) => match[1]);
}

const TRIGGER = {
  id: 'c1',
  sourceWorkflowId: 'wA',
  target: { kind: 'workflow', workflowId: 'wB', name: 'Writer', status: 'enabled' },
  task: 'Write the follow-up',
  timeZone: 'Europe/London',
  enabled: true,
  createdAt: 'x',
  updatedAt: 'x',
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
};

function item(overrides: Record<string, unknown> = {}): ChainTriggerItem {
  const parsed = parseChainTrigger({ ...TRIGGER, ...overrides });
  assert.ok(parsed);
  return parsed;
}

describe('chain trigger code lists are pinned to the backend source', () => {
  test('error codes match CHAIN_TRIGGER_ERROR_CODES', () => {
    const source = backend('triggers/chain-trigger-validation.ts');
    const start = source.indexOf('export const CHAIN_TRIGGER_ERROR_CODES = {');
    assert.ok(start >= 0);
    const block = source.slice(start, source.indexOf('} as const', start));
    const codes = [...block.matchAll(/'(chain_trigger_[a-z_]+)'/g)].map((match) => match[1]);
    assert.equal(codes.length, 14);
    assert.deepEqual([...CHAIN_TRIGGER_ERROR_CODES].sort(), [...codes].sort());
  });

  test('the reasons are the schedule reasons without missed, plus day_limit and chain_depth', () => {
    const source = backend('triggers/chain-trigger-reasons.ts');
    assert.match(
      source,
      /CHAIN_TRIGGER_SKIP_REASONS = \[\.\.\.CHAIN_TRIGGER_SCHEDULE_REASONS, 'day_limit', 'chain_depth'\]/,
    );
    assert.match(source, /code !== 'missed'/);
    const scheduleCodes = quotedIn(backend('triggers/schedule-refusal.ts'), 'export const SCHEDULE_SKIP_REASONS', '[', ']');
    assert.equal(scheduleCodes.length, 14);
    assert.equal(CHAIN_TRIGGER_SKIP_REASONS.length, 15);
    assert.deepEqual(
      [...CHAIN_TRIGGER_SKIP_REASONS],
      [...scheduleCodes.filter((code) => code !== 'missed'), 'day_limit', 'chain_depth'],
    );
    assert.ok(!(CHAIN_TRIGGER_SKIP_REASONS as readonly string[]).includes('missed'));
  });

  test('outcomes match the run entity', () => {
    const outcomes = quotedIn(
      backend('entities/agent-chain-trigger-run.entity.ts'),
      'AGENT_CHAIN_TRIGGER_RUN_OUTCOMES',
      '[',
      ']',
    );
    assert.deepEqual([...CHAIN_TRIGGER_OUTCOMES], outcomes);
  });

  test('the limits match the backend constants', () => {
    const source = backend('triggers/chain-trigger-validation.ts');
    assert.match(source, /CHAIN_TRIGGERS_PER_OWNER_LIMIT = 3/);
    assert.match(source, /CHAIN_TRIGGER_TASK_MAX_CHARS = 7000/);
  });
});

describe('chain trigger parsing', () => {
  test('parseChainTrigger reads a workflow target and a Chief of Staff target, with the source and last run', () => {
    const workflow = parseChainTrigger(TRIGGER);
    assert.ok(workflow);
    assert.equal(workflow.sourceWorkflowId, 'wA');
    assert.deepEqual(workflow.target, { kind: 'workflow', workflowId: 'wB', name: 'Writer', missing: false });
    assert.equal(workflow.lastRun?.depth, 2);
    assert.equal(workflow.lastRun?.sourceRunId, 'run-1');
    assert.equal(workflow.lastRun?.collaborationRunId, 'run-2');
    const chief = parseChainTrigger({ ...TRIGGER, target: { kind: 'chief-of-staff' }, lastRun: null });
    assert.deepEqual(chief?.target, { kind: 'chief-of-staff' });
    assert.equal(chief?.lastRun, null);
    assert.equal(parseChainTrigger({ ...TRIGGER, sourceWorkflowId: undefined }), null);
    assert.equal(parseChainTrigger({ ...TRIGGER, sourceWorkflowId: '' }), null);
    assert.equal(parseChainTrigger({ ...TRIGGER, enabled: 'yes' }), null);
  });

  test('a target with status missing is marked gone', () => {
    const gone = parseChainTrigger({
      ...TRIGGER,
      target: { kind: 'workflow', workflowId: 'wB', name: null, status: 'missing' },
    });
    assert.deepEqual(gone?.target, { kind: 'workflow', workflowId: 'wB', name: null, missing: true });
  });

  test('the list keeps the three switches and the limit, leaves malformed triggers out, and a bad body gives null', () => {
    const list = parseChainTriggerList({
      enabled: false,
      runsEnabled: true,
      resultToolEnabled: false,
      limit: 3,
      triggers: [TRIGGER, { id: 'x' }, null],
    });
    assert.equal(list?.triggers.length, 1);
    assert.equal(list?.enabled, false);
    assert.equal(list?.runsEnabled, true);
    assert.equal(list?.resultToolEnabled, false);
    assert.equal(parseChainTriggerList({ enabled: true, runsEnabled: true, triggers: [] })?.resultToolEnabled, false);
    assert.equal(parseChainTriggerList({ triggers: 'no' }), null);
    assert.equal(parseChainTriggerList(null), null);
    assert.equal(parseChainTriggerList({ triggers: [] })?.limit, 3);
  });

  test('parseChainTriggerRuns keeps runs with an id and the depth', () => {
    const runs = parseChainTriggerRuns({
      runs: [
        {
          id: 'r1',
          sourceRunId: 'run-1',
          sourceCompletedAt: 'x',
          localDate: '2026-11-16',
          depth: 3,
          outcome: 'skipped',
          reason: 'chain_depth',
          collaborationRunId: null,
          at: 'x',
        },
        { localDate: 'bad' },
      ],
    });
    assert.equal(runs?.length, 1);
    assert.equal(runs?.[0].reason, 'chain_depth');
    assert.equal(runs?.[0].depth, 3);
    assert.equal(parseChainTriggerRuns({}), null);
  });
});

describe('chain trigger keys and helpers', () => {
  test('known codes map to their keys and unknown ones to the generic keys', () => {
    assert.equal(chainTriggerErrorKey('chain_trigger_cycle'), 'errors.chain_trigger_cycle');
    assert.equal(chainTriggerErrorKey('chain_trigger_same_workflow'), 'errors.chain_trigger_same_workflow');
    assert.equal(chainTriggerErrorKey('knowledge_trigger_limit_reached'), 'errors.generic');
    assert.equal(chainTriggerErrorKey(null), 'errors.generic');
    assert.equal(chainReasonKey('chain_depth'), 'reasons.chain_depth');
    assert.equal(chainReasonKey('day_limit'), 'reasons.day_limit');
    assert.equal(chainReasonKey('missed'), 'reasons.unknown');
    assert.equal(chainReasonKey('other'), 'reasons.unknown');
    assert.equal(chainOutcomeKey('started'), 'outcomes.started');
    assert.equal(chainOutcomeKey('other'), 'outcomes.unknown');
  });

  test('chainLimitReached is true at the limit', () => {
    const base = { enabled: true, runsEnabled: true, resultToolEnabled: true, limit: 2, triggers: [] as never[] };
    assert.equal(chainLimitReached(base), false);
    assert.equal(chainLimitReached({ ...base, triggers: [item(), item()] }), true);
  });

  test('chainSameWorkflow is true only when both pickers name one workflow', () => {
    assert.equal(chainSameWorkflow({ sourceId: 'wA', targetId: 'wA' }), true);
    assert.equal(chainSameWorkflow({ sourceId: 'wA', targetId: 'wB' }), false);
    assert.equal(chainSameWorkflow({ sourceId: 'wA', targetId: '' }), false);
    assert.equal(chainSameWorkflow({ sourceId: '', targetId: '' }), false);
  });
});

describe('chain trigger loop check mirrors the gateway rule', () => {
  const aToB = item({ id: 'c1', sourceWorkflowId: 'wA', target: { kind: 'workflow', workflowId: 'wB', name: 'B', status: 'enabled' } });
  const bToC = item({ id: 'c2', sourceWorkflowId: 'wB', target: { kind: 'workflow', workflowId: 'wC', name: 'C', status: 'enabled' }, enabled: false });
  const aToChief = item({ id: 'c3', sourceWorkflowId: 'wA', target: { kind: 'chief-of-staff' } });

  test('A to B then B to A loops', () => {
    assert.equal(chainWouldLoop([aToB], { sourceId: 'wB', targetId: 'wA' }, null), true);
  });

  test('A to B, B to C, then C to A loops, and switched-off triggers count', () => {
    assert.equal(chainWouldLoop([aToB, bToC], { sourceId: 'wC', targetId: 'wA' }, null), true);
  });

  test('a chain that does not close is fine, and an edge to the Chief of Staff never closes one', () => {
    assert.equal(chainWouldLoop([aToB], { sourceId: 'wB', targetId: 'wC' }, null), false);
    assert.equal(chainWouldLoop([aToChief], { sourceId: 'wB', targetId: 'wA' }, null), false);
    assert.equal(chainWouldLoop([aToB], { sourceId: 'wA', targetId: '' }, null), false);
    assert.equal(chainWouldLoop([], { sourceId: 'wA', targetId: 'wA' }, null), false);
  });

  test('editing a trigger ignores its own saved edge', () => {
    assert.equal(chainWouldLoop([aToB], { sourceId: 'wA', targetId: 'wC' }, 'c1'), false);
    assert.equal(chainWouldLoop([aToB, bToC], { sourceId: 'wB', targetId: 'wA' }, 'c2'), true);
    assert.equal(chainWouldLoop([aToB, bToC], { sourceId: 'wB', targetId: 'wC' }, 'c2'), false);
  });
});

describe('chain trigger source status (CHAIN-SOURCE-OFF-01)', () => {
  const WORKFLOWS = [
    { id: 'wA', name: 'Researcher', status: 'active' as const },
    { id: 'wD', name: 'Drafted', status: 'draft' as const },
    { id: 'wO', name: 'Switched off', status: 'disabled' as const },
    { id: 'wU', name: 'No status' },
  ];

  test('parseChainTrigger reads the source view for each status, and null when absent or for another id', () => {
    for (const status of ['active', 'draft', 'disabled'] as const) {
      assert.deepEqual(item({ source: { workflowId: 'wA', name: 'Researcher', status } }).source, {
        workflowId: 'wA',
        name: 'Researcher',
        status,
      });
    }
    assert.deepEqual(item({ source: { workflowId: 'wA', name: null, status: 'missing' } }).source, {
      workflowId: 'wA',
      name: null,
      status: 'missing',
    });
    // An unknown status fails closed, as the workflows route reads one.
    assert.equal(item({ source: { workflowId: 'wA', name: 'Researcher', status: 'archived' } }).source?.status, 'disabled');
    assert.equal(item().source, null);
    assert.equal(item({ source: null }).source, null);
    assert.equal(item({ source: 'wA' }).source, null);
    assert.equal(item({ source: { workflowId: 'wZ', name: 'Other', status: 'active' } }).source, null);
    // A malformed source never drops the trigger.
    assert.equal(item({ source: { nope: true } }).sourceWorkflowId, 'wA');
  });

  test('chainSourceStatus prefers the gateway source, and falls back to the workflow list without it', () => {
    const off = item({ source: { workflowId: 'wA', name: 'Researcher', status: 'disabled' } });
    // The gateway's answer wins over the list.
    assert.equal(chainSourceStatus(off, WORKFLOWS), 'disabled');
    assert.equal(chainSourceStatus(item({ source: { workflowId: 'wA', name: null, status: 'missing' } }), WORKFLOWS), 'missing');
    // Without it: the list's status, 'active' when the list carries none, 'missing' when not listed.
    assert.equal(chainSourceStatus(item(), WORKFLOWS), 'active');
    assert.equal(chainSourceStatus(item({ sourceWorkflowId: 'wD' }), WORKFLOWS), 'draft');
    assert.equal(chainSourceStatus(item({ sourceWorkflowId: 'wO' }), WORKFLOWS), 'disabled');
    assert.equal(chainSourceStatus(item({ sourceWorkflowId: 'wU' }), WORKFLOWS), 'active');
    assert.equal(chainSourceStatus(item({ sourceWorkflowId: 'w9' }), WORKFLOWS), 'missing');
    assert.equal(chainSourceStatus(item(), [{ id: 'wA', name: 'Researcher' }]), 'active');
  });

  test('chainSourceName uses the gateway name, then the list, and null for a gone source', () => {
    assert.equal(chainSourceName(item({ source: { workflowId: 'wA', name: 'Renamed', status: 'disabled' } }), WORKFLOWS), 'Renamed');
    assert.equal(chainSourceName(item({ source: { workflowId: 'wA', name: 'Renamed', status: 'disabled' } }), []), 'Renamed');
    assert.equal(chainSourceName(item(), WORKFLOWS), 'Researcher');
    assert.equal(chainSourceName(item({ sourceWorkflowId: 'w9' }), WORKFLOWS), null);
    assert.equal(chainSourceName(item({ source: { workflowId: 'wA', name: null, status: 'missing' } }), WORKFLOWS), null);
  });

  test('chainDraftSourceStatus reads the chosen workflow from the list, with the saved source as a fallback', () => {
    assert.equal(chainDraftSourceStatus(WORKFLOWS, ''), null);
    assert.equal(chainDraftSourceStatus(WORKFLOWS, 'wA'), 'active');
    assert.equal(chainDraftSourceStatus(WORKFLOWS, 'wD'), 'draft');
    assert.equal(chainDraftSourceStatus(WORKFLOWS, 'wO'), 'disabled');
    assert.equal(chainDraftSourceStatus(WORKFLOWS, 'wU'), null);
    assert.equal(chainDraftSourceStatus(WORKFLOWS, 'w9'), null);
    const saved = { workflowId: 'wU', name: 'No status', status: 'disabled' as const };
    assert.equal(chainDraftSourceStatus(WORKFLOWS, 'wU', saved), 'disabled');
    // The saved source answers only for itself, and the list's own status wins.
    assert.equal(chainDraftSourceStatus(WORKFLOWS, 'wA', { ...saved, workflowId: 'wA' }), 'active');
    assert.equal(chainDraftSourceStatus(WORKFLOWS, 'wU', { ...saved, workflowId: 'wO' }), null);
    assert.equal(chainDraftSourceStatus(WORKFLOWS, 'wU', { ...saved, status: 'missing' }), null);
  });

  test('chainSourceNotOn is true for draft and disabled only', () => {
    assert.equal(chainSourceNotOn('draft'), true);
    assert.equal(chainSourceNotOn('disabled'), true);
    assert.equal(chainSourceNotOn('active'), false);
    assert.equal(chainSourceNotOn('missing'), false);
    assert.equal(chainSourceNotOn(null), false);
  });

  test('chainSwitchNoticeKey: a switch-on with a source that is not on (or gone) gets its own notice', () => {
    assert.equal(chainSwitchNoticeKey(true, 'active'), 'notice.switchedOn');
    assert.equal(chainSwitchNoticeKey(true, 'disabled'), 'notice.switchedOnSourceOff');
    assert.equal(chainSwitchNoticeKey(true, 'draft'), 'notice.switchedOnSourceOff');
    assert.equal(chainSwitchNoticeKey(true, 'missing'), 'notice.switchedOnSourceGone');
    for (const status of ['active', 'draft', 'disabled', 'missing'] as const) {
      assert.equal(chainSwitchNoticeKey(false, status), 'notice.switchedOff');
    }
    assert.deepEqual([...CHAIN_WARNING_NOTICE_KEYS], ['notice.switchedOnSourceOff', 'notice.switchedOnSourceGone']);
  });
});

describe('chain trigger draft', () => {
  test('emptyChainDraft uses the given time zone, has no source yet and is switched on', () => {
    const draft = emptyChainDraft('Asia/Taipei');
    assert.deepEqual(draft, { sourceId: '', targetId: '', task: '', timeZone: 'Asia/Taipei', enabled: true });
  });

  test('draftToBody builds the request body for each target', () => {
    const chief = draftToBody({ ...emptyChainDraft('UTC'), sourceId: 'wA', task: '  Brief me  ' });
    assert.ok(chief.ok);
    assert.deepEqual(chief.body, {
      sourceWorkflowId: 'wA',
      target: { kind: 'chief-of-staff' },
      task: 'Brief me',
      timeZone: 'UTC',
      enabled: true,
    });
    const workflow = draftToBody({ ...emptyChainDraft('UTC'), sourceId: 'wA', targetId: 'wB', task: 't' });
    assert.ok(workflow.ok);
    assert.deepEqual(workflow.body.target, { kind: 'workflow', workflowId: 'wB' });
    assert.equal(workflow.body.sourceWorkflowId, 'wA');
  });

  test('draftToBody refuses the obvious mistakes with the gateway error keys', () => {
    const base = { ...emptyChainDraft('UTC'), sourceId: 'wA', task: 'ok' };
    assert.ok(draftToBody(base).ok);
    assert.deepEqual(draftToBody({ ...base, sourceId: '' }), { ok: false, errorKey: 'errors.chain_trigger_invalid_source' });
    assert.deepEqual(draftToBody({ ...base, targetId: 'wA' }), { ok: false, errorKey: 'errors.chain_trigger_same_workflow' });
    assert.deepEqual(draftToBody({ ...base, task: '   ' }), { ok: false, errorKey: 'errors.chain_trigger_invalid_task' });
    assert.deepEqual(draftToBody({ ...base, task: 'x'.repeat(7001) }), { ok: false, errorKey: 'errors.chain_trigger_invalid_task' });
    assert.ok(draftToBody({ ...base, task: 'x'.repeat(7000) }).ok);
    assert.deepEqual(draftToBody({ ...base, timeZone: ' ' }), { ok: false, errorKey: 'errors.chain_trigger_invalid_time_zone' });
  });

  test('draftToBody refuses a draft that would close a loop, with the cycle key', () => {
    const aToB = item({ sourceWorkflowId: 'wA', target: { kind: 'workflow', workflowId: 'wB', name: 'B', status: 'enabled' } });
    const draft = { ...emptyChainDraft('UTC'), sourceId: 'wB', targetId: 'wA', task: 'ok' };
    assert.deepEqual(draftToBody(draft, { triggers: [aToB], editingId: null }), {
      ok: false,
      errorKey: 'errors.chain_trigger_cycle',
    });
    assert.ok(draftToBody(draft).ok);
  });

  test('draftFromChainTrigger round-trips an edit', () => {
    const draft = draftFromChainTrigger(item());
    assert.equal(draft.sourceId, 'wA');
    assert.equal(draft.targetId, 'wB');
    assert.equal(draft.timeZone, 'Europe/London');
    assert.equal(draft.task, 'Write the follow-up');
    assert.equal(draftFromChainTrigger(item({ target: { kind: 'chief-of-staff' } })).targetId, '');
  });
});
