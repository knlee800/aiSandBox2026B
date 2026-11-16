import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  CHIEF_OF_STAFF_FOLDER_IDS,
  KNOWLEDGE_FOLDER_IDS,
  KNOWLEDGE_TRIGGER_ERROR_CODES,
  KNOWLEDGE_TRIGGER_OUTCOMES,
  KNOWLEDGE_TRIGGER_SKIP_REASONS,
  chiefCanReadFolder,
  chiefFolderRefused,
  draftFromKnowledgeTrigger,
  draftToBody,
  emptyKnowledgeDraft,
  knowledgeLimitReached,
  knowledgeOutcomeKey,
  knowledgeReasonKey,
  knowledgeTriggerErrorKey,
  parseKnowledgeTrigger,
  parseKnowledgeTriggerList,
  parseKnowledgeTriggerRuns,
  showWorkflowKnowledgeWarning,
} from '@/components/schedules/knowledge-triggers.logic';

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
  id: 'k1',
  target: { kind: 'workflow', workflowId: 'w1', name: 'Reader', status: 'enabled' },
  task: 'Summarise the new files',
  scopeId: 'policies',
  timeZone: 'Europe/London',
  enabled: true,
  createdAt: 'x',
  updatedAt: 'x',
  lastRun: {
    changedAt: '2026-11-15T10:00:00.000Z',
    localDate: '2026-11-15',
    outcome: 'started',
    reason: null,
    collaborationRunId: 'run-1',
    at: 'x',
  },
};

describe('knowledge trigger code lists are pinned to the backend source', () => {
  test('error codes match KNOWLEDGE_TRIGGER_ERROR_CODES', () => {
    const source = backend('triggers/knowledge-trigger-validation.ts');
    const start = source.indexOf('export const KNOWLEDGE_TRIGGER_ERROR_CODES = {');
    const block = source.slice(start, source.indexOf('} as const', start));
    const codes = [...block.matchAll(/'(knowledge_trigger_[a-z_]+)'/g)].map((match) => match[1]);
    assert.equal(codes.length, 13);
    assert.deepEqual([...KNOWLEDGE_TRIGGER_ERROR_CODES].sort(), [...codes].sort());
  });

  test('the reasons are the schedule reasons without missed, plus day_limit', () => {
    const source = backend('triggers/knowledge-trigger-reasons.ts');
    assert.match(source, /KNOWLEDGE_TRIGGER_SKIP_REASONS = \[\.\.\.KNOWLEDGE_TRIGGER_SCHEDULE_REASONS, 'day_limit'\]/);
    assert.match(source, /code !== 'missed'/);
    const scheduleCodes = quotedIn(backend('triggers/schedule-refusal.ts'), 'export const SCHEDULE_SKIP_REASONS', '[', ']');
    assert.equal(scheduleCodes.length, 14);
    assert.equal(KNOWLEDGE_TRIGGER_SKIP_REASONS.length, 14);
    assert.deepEqual(
      [...KNOWLEDGE_TRIGGER_SKIP_REASONS],
      [...scheduleCodes.filter((code) => code !== 'missed'), 'day_limit'],
    );
    assert.ok(!(KNOWLEDGE_TRIGGER_SKIP_REASONS as readonly string[]).includes('missed'));
  });

  test('outcomes match the run entity', () => {
    const outcomes = quotedIn(
      backend('entities/agent-knowledge-trigger-run.entity.ts'),
      'AGENT_KNOWLEDGE_TRIGGER_RUN_OUTCOMES',
      '[',
      ']',
    );
    assert.deepEqual([...KNOWLEDGE_TRIGGER_OUTCOMES], outcomes);
  });

  test('the nine folder ids match knowledge-scopes.ts', () => {
    const source = backend('knowledge/knowledge-scopes.ts');
    const ids = [...source.matchAll(/\{ id: '([a-z-]+)', type: '(?:shared|specialist)' \}/g)].map((match) => match[1]);
    assert.deepEqual([...KNOWLEDGE_FOLDER_IDS], ids);
  });

  test('the six Chief of Staff folders are the five shared ones plus contract-templates, as in the registry', () => {
    const source = backend('system-agents/system-agent-registry.ts');
    const shared = quotedIn(source, 'const SHARED_KNOWLEDGE_SCOPES', '[', '];').filter(
      (word) => word !== 'shared',
    );
    assert.equal(shared.length, 5);
    const chiefStart = source.indexOf("id: 'chief-of-staff',");
    const chiefBlock = source.slice(chiefStart, source.indexOf('...CHIEF_OF_STAFF_SPEC', chiefStart));
    assert.match(chiefBlock, /knowledgeScopes: scopes\(\{ id: 'contract-templates', type: 'specialist' \}\)/);
    assert.deepEqual([...CHIEF_OF_STAFF_FOLDER_IDS], [...shared, 'contract-templates']);
    assert.equal(CHIEF_OF_STAFF_FOLDER_IDS.length, 6);
  });

  test('the limits match the backend constants', () => {
    const source = backend('triggers/knowledge-trigger-validation.ts');
    assert.match(source, /KNOWLEDGE_TRIGGERS_PER_OWNER_LIMIT = 3/);
    assert.match(source, /KNOWLEDGE_TRIGGER_TASK_MAX_CHARS = 7000/);
  });
});

describe('knowledge trigger parsing', () => {
  test('parseKnowledgeTrigger reads a workflow trigger and a Chief of Staff trigger', () => {
    const workflow = parseKnowledgeTrigger(TRIGGER);
    assert.ok(workflow);
    assert.deepEqual(workflow.target, { kind: 'workflow', workflowId: 'w1', name: 'Reader', missing: false });
    assert.equal(workflow.scopeId, 'policies');
    assert.equal(workflow.lastRun?.collaborationRunId, 'run-1');
    const chief = parseKnowledgeTrigger({ ...TRIGGER, target: { kind: 'chief-of-staff' }, lastRun: null });
    assert.deepEqual(chief?.target, { kind: 'chief-of-staff' });
    assert.equal(chief?.lastRun, null);
    assert.equal(parseKnowledgeTrigger({ ...TRIGGER, scopeId: 5 }), null);
    assert.equal(parseKnowledgeTrigger({ ...TRIGGER, scopeId: undefined }), null);
  });

  test('a workflow with status missing is marked gone', () => {
    const gone = parseKnowledgeTrigger({
      ...TRIGGER,
      target: { kind: 'workflow', workflowId: 'w1', name: null, status: 'missing' },
    });
    assert.deepEqual(gone?.target, { kind: 'workflow', workflowId: 'w1', name: null, missing: true });
  });

  test('the list keeps the switches, leaves malformed triggers out, and a bad body gives null', () => {
    const list = parseKnowledgeTriggerList({
      enabled: false,
      runsEnabled: true,
      limit: 3,
      triggers: [TRIGGER, { id: 'x' }, null],
    });
    assert.equal(list?.triggers.length, 1);
    assert.equal(list?.enabled, false);
    assert.equal(list?.runsEnabled, true);
    assert.equal(parseKnowledgeTriggerList({ triggers: 'no' }), null);
    assert.equal(parseKnowledgeTriggerList(null), null);
    assert.equal(parseKnowledgeTriggerList({ triggers: [] })?.limit, 3);
  });

  test('parseKnowledgeTriggerRuns keeps runs with an id and the document id', () => {
    const runs = parseKnowledgeTriggerRuns({
      runs: [
        { id: 'r1', documentId: 'd1', changedAt: 'x', localDate: '2026-11-15', outcome: 'skipped', reason: 'day_limit', collaborationRunId: null, at: 'x' },
        { localDate: 'bad' },
      ],
    });
    assert.equal(runs?.length, 1);
    assert.equal(runs?.[0].reason, 'day_limit');
    assert.equal(runs?.[0].documentId, 'd1');
    assert.equal(parseKnowledgeTriggerRuns({}), null);
  });
});

describe('knowledge trigger keys and helpers', () => {
  test('known codes map to their keys and unknown ones to the generic keys', () => {
    assert.equal(knowledgeTriggerErrorKey('knowledge_trigger_limit_reached'), 'errors.knowledge_trigger_limit_reached');
    assert.equal(
      knowledgeTriggerErrorKey('knowledge_trigger_folder_not_readable'),
      'errors.knowledge_trigger_folder_not_readable',
    );
    assert.equal(knowledgeTriggerErrorKey('mail_trigger_limit_reached'), 'errors.generic');
    assert.equal(knowledgeTriggerErrorKey(null), 'errors.generic');
    assert.equal(knowledgeReasonKey('day_limit'), 'reasons.day_limit');
    assert.equal(knowledgeReasonKey('missed'), 'reasons.unknown');
    assert.equal(knowledgeReasonKey('other'), 'reasons.unknown');
    assert.equal(knowledgeOutcomeKey('started'), 'outcomes.started');
    assert.equal(knowledgeOutcomeKey('other'), 'outcomes.unknown');
  });

  test('knowledgeLimitReached is true at the limit', () => {
    const base = { enabled: true, runsEnabled: true, limit: 2, triggers: [] as never[] };
    assert.equal(knowledgeLimitReached(base), false);
    const item = parseKnowledgeTrigger(TRIGGER)!;
    assert.equal(knowledgeLimitReached({ ...base, triggers: [item, item] }), true);
  });

  test('the workflow warning shows for any workflow target and not for the Chief of Staff', () => {
    assert.equal(showWorkflowKnowledgeWarning({ targetId: '' }), false);
    assert.equal(showWorkflowKnowledgeWarning({ targetId: 'w1' }), true);
  });

  test('the Chief of Staff can read six folders and not the other three', () => {
    for (const id of CHIEF_OF_STAFF_FOLDER_IDS) assert.equal(chiefCanReadFolder(id), true, id);
    for (const id of ['codebase-context', 'market-data', 'tech-landscape']) {
      assert.equal(chiefCanReadFolder(id), false, id);
      assert.equal(chiefFolderRefused({ targetId: '', scopeId: id }), true, id);
      assert.equal(chiefFolderRefused({ targetId: 'w1', scopeId: id }), false, id);
    }
  });
});

describe('knowledge trigger draft', () => {
  test('emptyKnowledgeDraft uses the given time zone, the first folder and is switched on', () => {
    const draft = emptyKnowledgeDraft('Asia/Taipei');
    assert.equal(draft.timeZone, 'Asia/Taipei');
    assert.equal(draft.scopeId, 'company-monthly-reports');
    assert.equal(draft.targetId, '');
    assert.equal(draft.enabled, true);
  });

  test('draftToBody builds the request body for each target', () => {
    const chief = draftToBody({ ...emptyKnowledgeDraft('UTC'), task: '  Summarise  ', scopeId: 'policies' });
    assert.ok(chief.ok);
    assert.deepEqual(chief.body, {
      target: { kind: 'chief-of-staff' },
      task: 'Summarise',
      scopeId: 'policies',
      timeZone: 'UTC',
      enabled: true,
    });
    const workflow = draftToBody({
      ...emptyKnowledgeDraft('UTC'),
      task: 't',
      targetId: 'w1',
      scopeId: 'market-data',
    });
    assert.ok(workflow.ok);
    assert.deepEqual(workflow.body.target, { kind: 'workflow', workflowId: 'w1' });
    assert.equal(workflow.body.scopeId, 'market-data');
  });

  test('draftToBody refuses the obvious mistakes with the gateway error keys', () => {
    const base = { ...emptyKnowledgeDraft('UTC'), task: 'ok' };
    assert.ok(draftToBody(base).ok);
    assert.deepEqual(draftToBody({ ...base, task: '   ' }), { ok: false, errorKey: 'errors.knowledge_trigger_invalid_task' });
    assert.deepEqual(draftToBody({ ...base, task: 'x'.repeat(7001) }), { ok: false, errorKey: 'errors.knowledge_trigger_invalid_task' });
    assert.ok(draftToBody({ ...base, task: 'x'.repeat(7000) }).ok);
    assert.deepEqual(draftToBody({ ...base, scopeId: 'nope' }), { ok: false, errorKey: 'errors.knowledge_trigger_invalid_folder' });
    assert.deepEqual(draftToBody({ ...base, timeZone: ' ' }), { ok: false, errorKey: 'errors.knowledge_trigger_invalid_time_zone' });
  });

  test('a Chief of Staff trigger on a folder it cannot read is refused; a workflow one is not', () => {
    const base = { ...emptyKnowledgeDraft('UTC'), task: 'ok', scopeId: 'codebase-context' };
    assert.deepEqual(draftToBody(base), { ok: false, errorKey: 'errors.knowledge_trigger_folder_not_readable' });
    assert.ok(draftToBody({ ...base, targetId: 'w1' }).ok);
  });

  test('draftFromKnowledgeTrigger round-trips an edit', () => {
    const draft = draftFromKnowledgeTrigger(parseKnowledgeTrigger(TRIGGER)!);
    assert.equal(draft.targetId, 'w1');
    assert.equal(draft.scopeId, 'policies');
    assert.equal(draft.timeZone, 'Europe/London');
    assert.equal(draft.task, 'Summarise the new files');
  });
});
