import { HttpException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { KNOWLEDGE_SCOPE_ID_VALUES } from '../knowledge/knowledge-scopes';
import { CHIEF_OF_STAFF_KNOWLEDGE_SCOPE_IDS } from '../system-agents/system-agent-registry';
import {
  KNOWLEDGE_TRIGGER_ERROR_CODES,
  KNOWLEDGE_TRIGGER_TASK_MAX_CHARS,
  KNOWLEDGE_TRIGGERS_PER_OWNER_LIMIT,
  assertTargetCanReadFolder,
  canTargetReadFolder,
  isKnowledgeTriggerFolder,
  knowledgeTriggerError,
  readKnowledgeTriggerCreate,
  readKnowledgeTriggerPatch,
} from './knowledge-trigger-validation';
import { SCHEDULE_ERROR_CODES } from './schedule-validation';

const WORKFLOW_ID = '33333333-3333-4333-8333-333333333333';
const MARKER = 'MARKER-TASK-4b7e';

/** The nine fixed folders (knowledge-scopes.ts) and the six the Chief of Staff reads (stage-start 1.3). */
const NINE_FOLDERS = [
  'company-monthly-reports',
  'three-year-goals',
  'strategy-docs',
  'policies',
  'meeting-summaries',
  'codebase-context',
  'contract-templates',
  'market-data',
  'tech-landscape',
];
const CHIEF_OF_STAFF_FOLDERS = [
  'company-monthly-reports',
  'three-year-goals',
  'strategy-docs',
  'policies',
  'meeting-summaries',
  'contract-templates',
];
const NOT_CHIEF_OF_STAFF_FOLDERS = ['codebase-context', 'market-data', 'tech-landscape'];

function valid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    target: { kind: 'chief-of-staff' },
    task: 'Summarise the new document',
    scopeId: 'policies',
    timeZone: 'Asia/Taipei',
    ...overrides,
  };
}

function refusal(work: () => unknown): { status: number; body: Record<string, unknown> } {
  try {
    work();
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    const http = error as HttpException;
    return { status: http.getStatus(), body: http.getResponse() as Record<string, unknown> };
  }
  throw new Error('expected a refusal');
}

describe('knowledge trigger validation (TRIGGER-MORE-01 S1, stage-start sections 4 and 5)', () => {
  it('the limits are the approved constants', () => {
    expect(KNOWLEDGE_TRIGGERS_PER_OWNER_LIMIT).toBe(3);
    expect(KNOWLEDGE_TRIGGER_TASK_MAX_CHARS).toBe(7000);
  });

  it('every code is knowledge_trigger_* and mirrors the schedule set, with folder codes in place of time and days', () => {
    const codes = Object.values(KNOWLEDGE_TRIGGER_ERROR_CODES);
    for (const code of codes) {
      expect(code).toMatch(/^knowledge_trigger_[a-z_]+$/);
    }
    const mirrored = Object.values(SCHEDULE_ERROR_CODES)
      .map((code) => code.replace(/^schedule_/, 'knowledge_trigger_'))
      .filter((code) => code !== 'knowledge_trigger_invalid_time' && code !== 'knowledge_trigger_invalid_days');
    expect([...codes].sort()).toEqual(
      [...mirrored, 'knowledge_trigger_invalid_folder', 'knowledge_trigger_folder_not_readable'].sort(),
    );
    expect(codes).toContain('knowledge_trigger_folder_not_readable');
  });

  it('errors are { statusCode, message, error, code } and 400, 404 or 409', () => {
    expect(knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.folderNotReadable).getResponse()).toEqual({
      statusCode: 400,
      message: 'The Chief of Staff cannot read this Knowledge folder',
      error: 'Bad Request',
      code: 'knowledge_trigger_folder_not_readable',
    });
    expect(knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.invalidFolder).getResponse()).toEqual({
      statusCode: 400,
      message: 'scopeId must be one of the Knowledge folders',
      error: 'Bad Request',
      code: 'knowledge_trigger_invalid_folder',
    });
    expect(knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.notFound).getResponse()).toEqual({
      statusCode: 404,
      message: 'Knowledge trigger not found',
      error: 'Not Found',
      code: 'knowledge_trigger_not_found',
    });
    expect(knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.limitReached, { limit: 3 }).getResponse()).toEqual({
      statusCode: 409,
      message: 'At most 3 knowledge triggers per account',
      error: 'Conflict',
      code: 'knowledge_trigger_limit_reached',
      limit: 3,
    });
  });

  describe('the folders', () => {
    it('the nine fixed folder ids come from knowledge-scopes.ts', () => {
      expect([...KNOWLEDGE_SCOPE_ID_VALUES]).toEqual(NINE_FOLDERS);
      for (const id of NINE_FOLDERS) {
        expect(isKnowledgeTriggerFolder(id)).toBe(true);
      }
    });

    it.each([
      [''],
      ['legal-contracts'],
      ['Policies'],
      [' policies'],
      ['policies '],
      ['__proto__'],
      ['constructor'],
      ['toString'],
      [7],
      [null],
      [['policies']],
      [{ id: 'policies' }],
    ])('%j is not a folder', (value) => {
      expect(isKnowledgeTriggerFolder(value)).toBe(false);
    });

    it("the Chief of Staff's folders are the registry's own list (imported, not copied): the five shared and contract-templates", () => {
      expect([...CHIEF_OF_STAFF_KNOWLEDGE_SCOPE_IDS]).toEqual(CHIEF_OF_STAFF_FOLDERS);
      for (const id of CHIEF_OF_STAFF_KNOWLEDGE_SCOPE_IDS) {
        expect(NINE_FOLDERS).toContain(id);
      }
      const source = readFileSync(join(__dirname, 'knowledge-trigger-validation.ts'), 'utf8');
      expect(source).toContain(
        "import { CHIEF_OF_STAFF_KNOWLEDGE_SCOPE_IDS } from '../system-agents/system-agent-registry';",
      );
      expect(source).toContain("import { findKnowledgeScope } from '../knowledge/knowledge-scopes';");
      // No folder id is written into this file: both lists are imported.
      for (const id of NINE_FOLDERS) {
        expect(source).not.toContain(`'${id}'`);
      }
    });

    it.each(CHIEF_OF_STAFF_FOLDERS)('the Chief of Staff can read %s', (id) => {
      expect(canTargetReadFolder('chief-of-staff', id)).toBe(true);
      expect(() => assertTargetCanReadFolder('chief-of-staff', id)).not.toThrow();
    });

    it.each(NOT_CHIEF_OF_STAFF_FOLDERS)('the Chief of Staff cannot read %s; a workflow may', (id) => {
      expect(canTargetReadFolder('chief-of-staff', id)).toBe(false);
      expect(canTargetReadFolder('workflow', id)).toBe(true);
      const { status, body } = refusal(() => assertTargetCanReadFolder('chief-of-staff', id));
      expect(status).toBe(400);
      expect(body.code).toBe(KNOWLEDGE_TRIGGER_ERROR_CODES.folderNotReadable);
      expect(JSON.stringify(body)).not.toContain(id);
    });
  });

  describe('readKnowledgeTriggerCreate', () => {
    it('reads a Chief of Staff trigger; enabled defaults to true; the task is trimmed', () => {
      expect(readKnowledgeTriggerCreate(valid({ task: '  Summarise it \n' }))).toEqual({
        target: { kind: 'chief-of-staff' },
        task: 'Summarise it',
        scopeId: 'policies',
        timeZone: 'Asia/Taipei',
        enabled: true,
      });
    });

    it('reads a workflow trigger on a folder the Chief of Staff cannot read, with enabled false', () => {
      expect(
        readKnowledgeTriggerCreate(
          valid({
            target: { kind: 'workflow', workflowId: WORKFLOW_ID.toUpperCase() },
            scopeId: 'market-data',
            enabled: false,
          }),
        ),
      ).toEqual({
        target: { kind: 'workflow', workflowId: WORKFLOW_ID },
        task: 'Summarise the new document',
        scopeId: 'market-data',
        timeZone: 'Asia/Taipei',
        enabled: false,
      });
    });

    it.each(NINE_FOLDERS)('a workflow trigger is accepted on %s', (scopeId) => {
      expect(
        readKnowledgeTriggerCreate(valid({ target: { kind: 'workflow', workflowId: WORKFLOW_ID }, scopeId })).scopeId,
      ).toBe(scopeId);
    });

    it.each(NOT_CHIEF_OF_STAFF_FOLDERS)('a Chief of Staff trigger on %s is refused with knowledge_trigger_folder_not_readable', (scopeId) => {
      const { status, body } = refusal(() => readKnowledgeTriggerCreate(valid({ scopeId, task: MARKER })));
      expect(status).toBe(400);
      expect(body).toEqual({
        statusCode: 400,
        message: 'The Chief of Staff cannot read this Knowledge folder',
        error: 'Bad Request',
        code: 'knowledge_trigger_folder_not_readable',
      });
      expect(JSON.stringify(body)).not.toContain(MARKER);
    });

    it.each(['target', 'task', 'scopeId', 'timeZone'])('refuses a missing %s', (field) => {
      const body = valid();
      delete body[field];
      const { status, body: response } = refusal(() => readKnowledgeTriggerCreate(body));
      expect(status).toBe(400);
      expect(response).toMatchObject({ code: KNOWLEDGE_TRIGGER_ERROR_CODES.missingField, field });
    });

    it.each([[null], ['text'], [[]], [42]])('refuses a body that is not an object: %j', (body) => {
      expect(refusal(() => readKnowledgeTriggerCreate(body)).body.code).toBe(KNOWLEDGE_TRIGGER_ERROR_CODES.invalidBody);
    });

    it.each([
      ['an unknown folder', { scopeId: 'legal-contracts' }, 'knowledge_trigger_invalid_folder'],
      ['a folder in another case', { scopeId: 'POLICIES' }, 'knowledge_trigger_invalid_folder'],
      ['a padded folder', { scopeId: ' policies ' }, 'knowledge_trigger_invalid_folder'],
      ['an empty folder', { scopeId: '' }, 'knowledge_trigger_invalid_folder'],
      ['a null folder', { scopeId: null }, 'knowledge_trigger_invalid_folder'],
      ['a list of folders', { scopeId: ['policies', 'strategy-docs'] }, 'knowledge_trigger_invalid_folder'],
      ['an empty task', { task: '   ' }, 'knowledge_trigger_invalid_task'],
      ['a task that is not text', { task: 5 }, 'knowledge_trigger_invalid_task'],
      ['a task over 7000 characters', { task: 'a'.repeat(7001) }, 'knowledge_trigger_invalid_task'],
      ['an invalid zone', { timeZone: 'Mars/Olympus_Mons' }, 'knowledge_trigger_invalid_time_zone'],
      ['a zone over 64 characters', { timeZone: 'A'.repeat(65) }, 'knowledge_trigger_invalid_time_zone'],
      ['enabled as text', { enabled: 'true' }, 'knowledge_trigger_invalid_enabled'],
      ['a team target', { target: { kind: 'coding' } }, 'knowledge_trigger_invalid_target'],
      ['a target with extra fields', { target: { kind: 'chief-of-staff', workflowId: WORKFLOW_ID } }, 'knowledge_trigger_invalid_target'],
      ['a workflow without an id', { target: { kind: 'workflow' } }, 'knowledge_trigger_invalid_target'],
      ['a workflow id that is not a uuid', { target: { kind: 'workflow', workflowId: 'nope' } }, 'knowledge_trigger_workflow_not_found'],
      ['a provider', { provider: 'openai' }, 'knowledge_trigger_unknown_field'],
      ['a model', { model: { choice: 'pinned' } }, 'knowledge_trigger_unknown_field'],
      ['a session id', { sessionId: WORKFLOW_ID }, 'knowledge_trigger_unknown_field'],
      ['an armed time', { armedAt: '2026-01-01T00:00:00Z' }, 'knowledge_trigger_unknown_field'],
      ['a document id', { documentId: WORKFLOW_ID }, 'knowledge_trigger_unknown_field'],
      ['a list of folders under another name', { scopeIds: ['policies'] }, 'knowledge_trigger_unknown_field'],
      ['a mail sender', { senderFilter: 'a@example.com' }, 'knowledge_trigger_unknown_field'],
      ['an owner', { userId: WORKFLOW_ID }, 'knowledge_trigger_unknown_field'],
    ])('refuses %s', (_label, overrides, code) => {
      const { status, body } = refusal(() => readKnowledgeTriggerCreate(valid(overrides)));
      expect(status).toBe(code === 'knowledge_trigger_workflow_not_found' ? 404 : 400);
      expect(body.code).toBe(code);
    });

    it('accepts the edges: a 1-character and a 7000-character task, a 64-character limit on the zone', () => {
      expect(readKnowledgeTriggerCreate(valid({ task: 'a' })).task).toBe('a');
      expect(readKnowledgeTriggerCreate(valid({ task: 'a'.repeat(7000) })).task).toHaveLength(7000);
      expect(readKnowledgeTriggerCreate(valid({ timeZone: 'UTC' })).timeZone).toBe('UTC');
    });

    it('an unknown field is named without its value', () => {
      const { body } = refusal(() => readKnowledgeTriggerCreate(valid({ [`x${'y'.repeat(100)}`]: MARKER })));
      expect(body.code).toBe('knowledge_trigger_unknown_field');
      expect(String(body.field)).toHaveLength(64);
      expect(JSON.stringify(body)).not.toContain(MARKER);
    });

    it('a refused task, folder or zone is never echoed', () => {
      for (const overrides of [
        { task: `${MARKER}${'x'.repeat(7000)}` },
        { scopeId: MARKER },
        { timeZone: MARKER },
      ]) {
        expect(JSON.stringify(refusal(() => readKnowledgeTriggerCreate(valid(overrides))).body)).not.toContain(MARKER);
      }
    });
  });

  describe('readKnowledgeTriggerPatch', () => {
    it('reads any non-empty subset', () => {
      expect(readKnowledgeTriggerPatch({ enabled: false })).toEqual({ enabled: false });
      expect(readKnowledgeTriggerPatch({ scopeId: 'codebase-context' })).toEqual({ scopeId: 'codebase-context' });
      expect(readKnowledgeTriggerPatch({ task: ' t ', timeZone: 'UTC' })).toEqual({ task: 't', timeZone: 'UTC' });
      expect(readKnowledgeTriggerPatch({ target: { kind: 'chief-of-staff' } })).toEqual({
        target: { kind: 'chief-of-staff' },
      });
    });

    it('refuses an empty change', () => {
      expect(refusal(() => readKnowledgeTriggerPatch({})).body.code).toBe(KNOWLEDGE_TRIGGER_ERROR_CODES.emptyChange);
    });

    it('refuses an unknown field and a bad value', () => {
      expect(refusal(() => readKnowledgeTriggerPatch({ userId: WORKFLOW_ID })).body.code).toBe(
        KNOWLEDGE_TRIGGER_ERROR_CODES.unknownField,
      );
      expect(refusal(() => readKnowledgeTriggerPatch({ scopeId: 'nope' })).body.code).toBe(
        KNOWLEDGE_TRIGGER_ERROR_CODES.invalidFolder,
      );
      expect(refusal(() => readKnowledgeTriggerPatch({ timeZone: 'Bad/Zone' })).body.code).toBe(
        KNOWLEDGE_TRIGGER_ERROR_CODES.invalidTimeZone,
      );
    });

    it('a body that sends the Chief of Staff and a folder it cannot read is refused here; the service checks the merged row otherwise', () => {
      expect(
        refusal(() => readKnowledgeTriggerPatch({ target: { kind: 'chief-of-staff' }, scopeId: 'tech-landscape' })).body.code,
      ).toBe(KNOWLEDGE_TRIGGER_ERROR_CODES.folderNotReadable);
      expect(
        readKnowledgeTriggerPatch({ target: { kind: 'workflow', workflowId: WORKFLOW_ID }, scopeId: 'tech-landscape' }),
      ).toEqual({ target: { kind: 'workflow', workflowId: WORKFLOW_ID }, scopeId: 'tech-landscape' });
    });
  });

  it('the validation file is pure: no table, no timer, no run start', () => {
    const source = readFileSync(join(__dirname, 'knowledge-trigger-validation.ts'), 'utf8');
    expect(source).not.toMatch(/Repository|InjectRepository|EntityManager|setInterval|setTimeout|CollaborationStartService|approveStep/);
    expect(source).toContain("import { isAcceptedTimeZone, isUuid } from './schedule-validation';");
  });
});
