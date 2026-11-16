import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  MAIL_TRIGGER_ERROR_CODES,
  MAIL_TRIGGER_MAIL_STATES,
  MAIL_TRIGGER_OUTCOMES,
  MAIL_TRIGGER_SKIP_REASONS,
  draftFromMailTrigger,
  draftToBody,
  emptyMailDraft,
  looksLikeSenderFilter,
  mailLimitReached,
  mailOutcomeKey,
  mailReasonKey,
  mailTriggerErrorKey,
  mailboxDisplayState,
  mailboxNeedsAttention,
  parseMailTrigger,
  parseMailTriggerList,
  parseMailTriggerRuns,
  showWorkflowMailWarning,
} from '@/components/schedules/mail-triggers.logic';

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
  id: 'm1',
  target: { kind: 'workflow', workflowId: 'w1', name: 'Mail prep', status: 'enabled' },
  task: 'Summarise the new mail',
  senderFilter: 'boss@example.com',
  subjectFilter: 'invoice',
  timeZone: 'Europe/London',
  enabled: true,
  createdAt: 'x',
  updatedAt: 'x',
  lastRun: {
    arrivedAt: '2026-11-15T10:00:00.000Z',
    localDate: '2026-11-15',
    outcome: 'started',
    reason: null,
    collaborationRunId: 'run-1',
    at: 'x',
  },
};

describe('mail trigger code lists are pinned to the backend source', () => {
  test('error codes match MAIL_TRIGGER_ERROR_CODES', () => {
    const source = backend('triggers/mail-trigger-validation.ts');
    const start = source.indexOf('export const MAIL_TRIGGER_ERROR_CODES = {');
    const block = source.slice(start, source.indexOf('} as const', start));
    const codes = [...block.matchAll(/'(mail_trigger_[a-z_]+)'/g)].map((match) => match[1]);
    assert.equal(codes.length, 13);
    assert.deepEqual([...MAIL_TRIGGER_ERROR_CODES].sort(), [...codes].sort());
  });

  test('the reasons are the schedule reasons without missed, plus day_limit', () => {
    const source = backend('triggers/mail-trigger-reasons.ts');
    assert.match(source, /MAIL_TRIGGER_SKIP_REASONS = \[\.\.\.MAIL_TRIGGER_SCHEDULE_REASONS, 'day_limit'\]/);
    assert.match(source, /code !== 'missed'/);
    const scheduleCodes = quotedIn(backend('triggers/schedule-refusal.ts'), 'export const SCHEDULE_SKIP_REASONS', '[', ']');
    assert.equal(scheduleCodes.length, 14);
    assert.equal(MAIL_TRIGGER_SKIP_REASONS.length, 14);
    assert.deepEqual(
      [...MAIL_TRIGGER_SKIP_REASONS],
      [...scheduleCodes.filter((code) => code !== 'missed'), 'day_limit'],
    );
    assert.ok(!(MAIL_TRIGGER_SKIP_REASONS as readonly string[]).includes('missed'));
  });

  test('outcomes and mailbox states match the entities', () => {
    const outcomes = quotedIn(
      backend('entities/agent-mail-trigger-run.entity.ts'),
      'AGENT_MAIL_TRIGGER_RUN_OUTCOMES',
      '[',
      ']',
    );
    assert.deepEqual([...MAIL_TRIGGER_OUTCOMES], outcomes);
    const states = quotedIn(
      backend('entities/agent-mail-trigger.entity.ts'),
      'AGENT_MAIL_TRIGGER_MAIL_STATES',
      '[',
      ']',
    );
    assert.deepEqual([...MAIL_TRIGGER_MAIL_STATES], states);
  });

  test('the limits match the backend constants', () => {
    const source = backend('triggers/mail-trigger-validation.ts');
    assert.match(source, /MAIL_TRIGGERS_PER_OWNER_LIMIT = 3/);
    assert.match(source, /MAIL_TRIGGER_TASK_MAX_CHARS = 7500/);
    assert.match(source, /MAIL_TRIGGER_SENDER_FILTER_MAX_CHARS = 254/);
    assert.match(source, /MAIL_TRIGGER_SUBJECT_FILTER_MAX_CHARS = 100/);
  });
});

describe('mail trigger parsing', () => {
  test('parseMailTrigger reads a workflow trigger and a Chief of Staff trigger', () => {
    const workflow = parseMailTrigger(TRIGGER);
    assert.ok(workflow);
    assert.deepEqual(workflow.target, { kind: 'workflow', workflowId: 'w1', name: 'Mail prep', missing: false });
    assert.equal(workflow.senderFilter, 'boss@example.com');
    assert.equal(workflow.subjectFilter, 'invoice');
    assert.equal(workflow.lastRun?.collaborationRunId, 'run-1');
    const chief = parseMailTrigger({ ...TRIGGER, target: { kind: 'chief-of-staff' }, subjectFilter: null, lastRun: null });
    assert.deepEqual(chief?.target, { kind: 'chief-of-staff' });
    assert.equal(chief?.subjectFilter, null);
    assert.equal(chief?.lastRun, null);
    assert.equal(parseMailTrigger({ ...TRIGGER, senderFilter: 5 }), null);
    assert.equal(parseMailTrigger({ ...TRIGGER, senderFilter: undefined }), null);
  });

  test('a workflow with status missing is marked gone', () => {
    const gone = parseMailTrigger({
      ...TRIGGER,
      target: { kind: 'workflow', workflowId: 'w1', name: null, status: 'missing' },
    });
    assert.deepEqual(gone?.target, { kind: 'workflow', workflowId: 'w1', name: null, missing: true });
  });

  test('the list keeps the switches and the mailbox, leaves malformed triggers out, and a bad body gives null', () => {
    const list = parseMailTriggerList({
      enabled: false,
      runsEnabled: true,
      limit: 3,
      mail: { connected: true, state: 'read_failed', stateAt: '2026-11-15T10:00:00.000Z' },
      triggers: [TRIGGER, { id: 'x' }, null],
    });
    assert.equal(list?.triggers.length, 1);
    assert.equal(list?.enabled, false);
    assert.equal(list?.runsEnabled, true);
    assert.deepEqual(list?.mail, { connected: true, state: 'read_failed', stateAt: '2026-11-15T10:00:00.000Z' });
    assert.equal(parseMailTriggerList({ triggers: 'no' }), null);
    assert.equal(parseMailTriggerList(null), null);
    const odd = parseMailTriggerList({ triggers: [], mail: { connected: true, state: 'weird' } });
    assert.equal(odd?.mail.state, 'ok');
    assert.equal(odd?.limit, 3);
  });

  test('parseMailTriggerRuns keeps runs with an id', () => {
    const runs = parseMailTriggerRuns({
      runs: [
        { id: 'r1', arrivedAt: 'x', localDate: '2026-11-15', outcome: 'skipped', reason: 'day_limit', collaborationRunId: null, at: 'x' },
        { localDate: 'bad' },
      ],
    });
    assert.equal(runs?.length, 1);
    assert.equal(runs?.[0].reason, 'day_limit');
    assert.equal(parseMailTriggerRuns({}), null);
  });
});

describe('mail trigger keys and helpers', () => {
  test('known codes map to their keys and unknown ones to the generic keys', () => {
    assert.equal(mailTriggerErrorKey('mail_trigger_limit_reached'), 'errors.mail_trigger_limit_reached');
    assert.equal(mailTriggerErrorKey('mail_trigger_invalid_sender'), 'errors.mail_trigger_invalid_sender');
    assert.equal(mailTriggerErrorKey('event_trigger_limit_reached'), 'errors.generic');
    assert.equal(mailTriggerErrorKey(null), 'errors.generic');
    assert.equal(mailReasonKey('day_limit'), 'reasons.day_limit');
    assert.equal(mailReasonKey('missed'), 'reasons.unknown');
    assert.equal(mailReasonKey('other'), 'reasons.unknown');
    assert.equal(mailOutcomeKey('started'), 'outcomes.started');
    assert.equal(mailOutcomeKey('other'), 'outcomes.unknown');
  });

  test('the mailbox shows not connected when no link is on file, whatever state was recorded', () => {
    assert.equal(mailboxDisplayState({ connected: false, state: 'ok', stateAt: null }), 'connector_missing');
    assert.equal(mailboxDisplayState({ connected: true, state: 'ok', stateAt: null }), 'ok');
    assert.equal(mailboxDisplayState({ connected: true, state: 'read_failed', stateAt: 'x' }), 'read_failed');
    assert.equal(mailboxNeedsAttention({ connected: true, state: 'ok', stateAt: null }), false);
    assert.equal(mailboxNeedsAttention({ connected: true, state: 'read_failed', stateAt: 'x' }), true);
    assert.equal(mailboxNeedsAttention({ connected: false, state: 'ok', stateAt: null }), true);
  });

  test('mailLimitReached is true at the limit', () => {
    const base = {
      enabled: true,
      runsEnabled: true,
      limit: 2,
      mail: { connected: true, state: 'ok' as const, stateAt: null },
      triggers: [] as never[],
    };
    assert.equal(mailLimitReached(base), false);
    const item = parseMailTrigger(TRIGGER)!;
    assert.equal(mailLimitReached({ ...base, triggers: [item, item] }), true);
  });

  test('the workflow mail warning shows for any workflow target and not for the Chief of Staff', () => {
    assert.equal(showWorkflowMailWarning({ targetId: '' }), false);
    assert.equal(showWorkflowMailWarning({ targetId: 'w1' }), true);
  });
});

describe('mail trigger sender rule', () => {
  test('one address or @domain is accepted', () => {
    for (const ok of ['boss@example.com', '@example.com', 'a.b+c@mail.example.co.uk']) {
      assert.equal(looksLikeSenderFilter(ok), true, ok);
    }
  });

  test('display names, lists, wildcards, spaces, missing parts and non-ASCII are refused', () => {
    for (const bad of [
      '',
      'example.com',
      'Boss <boss@example.com>',
      'a@example.com, b@example.com',
      '*@example.com',
      '@*.example.com',
      'boss@exam ple.com',
      'boss@@example.com',
      '@localhost',
      'boss@',
      '@.example.com',
      'bøss@example.com',
      `${'a'.repeat(250)}@example.com`,
    ]) {
      assert.equal(looksLikeSenderFilter(bad), false, bad);
    }
  });
});

describe('mail trigger draft', () => {
  test('emptyMailDraft uses the given time zone and is switched on', () => {
    const draft = emptyMailDraft('Asia/Taipei');
    assert.equal(draft.timeZone, 'Asia/Taipei');
    assert.equal(draft.senderFilter, '');
    assert.equal(draft.subjectFilter, '');
    assert.equal(draft.targetId, '');
    assert.equal(draft.enabled, true);
  });

  test('draftToBody builds the request body for each target, lower-cases the sender and turns a blank subject into null', () => {
    const chief = draftToBody({
      ...emptyMailDraft('UTC'),
      task: '  Summarise  ',
      senderFilter: '  Boss@Example.COM ',
      subjectFilter: '   ',
    });
    assert.ok(chief.ok);
    assert.deepEqual(chief.body.target, { kind: 'chief-of-staff' });
    assert.equal(chief.body.task, 'Summarise');
    assert.equal(chief.body.senderFilter, 'boss@example.com');
    assert.equal(chief.body.subjectFilter, null);
    const workflow = draftToBody({
      ...emptyMailDraft('UTC'),
      task: 't',
      targetId: 'w1',
      senderFilter: '@example.com',
      subjectFilter: ' invoice ',
    });
    assert.ok(workflow.ok);
    assert.deepEqual(workflow.body.target, { kind: 'workflow', workflowId: 'w1' });
    assert.equal(workflow.body.subjectFilter, 'invoice');
  });

  test('draftToBody refuses the obvious mistakes with the gateway error keys', () => {
    const base = { ...emptyMailDraft('UTC'), task: 'ok', senderFilter: 'a@example.com' };
    assert.ok(draftToBody(base).ok);
    assert.deepEqual(draftToBody({ ...base, task: '   ' }), { ok: false, errorKey: 'errors.mail_trigger_invalid_task' });
    assert.deepEqual(draftToBody({ ...base, task: 'x'.repeat(7501) }), { ok: false, errorKey: 'errors.mail_trigger_invalid_task' });
    for (const sender of ['', '   ', 'Name <a@example.com>', 'example.com', '*@example.com']) {
      assert.deepEqual(draftToBody({ ...base, senderFilter: sender }), { ok: false, errorKey: 'errors.mail_trigger_invalid_sender' }, sender);
    }
    assert.deepEqual(draftToBody({ ...base, subjectFilter: 'x'.repeat(101) }), { ok: false, errorKey: 'errors.mail_trigger_invalid_subject' });
    assert.ok(draftToBody({ ...base, subjectFilter: 'x'.repeat(100) }).ok);
    assert.deepEqual(draftToBody({ ...base, timeZone: ' ' }), { ok: false, errorKey: 'errors.mail_trigger_invalid_time_zone' });
  });

  test('draftFromMailTrigger round-trips an edit', () => {
    const draft = draftFromMailTrigger(parseMailTrigger(TRIGGER)!);
    assert.equal(draft.targetId, 'w1');
    assert.equal(draft.senderFilter, 'boss@example.com');
    assert.equal(draft.subjectFilter, 'invoice');
    assert.equal(draft.timeZone, 'Europe/London');
  });
});
