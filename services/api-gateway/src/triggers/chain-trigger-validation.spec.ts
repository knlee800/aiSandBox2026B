import { HttpException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CHAIN_TRIGGER_ERROR_CODES,
  CHAIN_TRIGGER_TASK_MAX_CHARS,
  CHAIN_TRIGGERS_PER_OWNER_LIMIT,
  ChainTriggerEdge,
  chainTriggerError,
  closesChainCycle,
  readChainTriggerCreate,
  readChainTriggerPatch,
} from './chain-trigger-validation';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const MARKER = 'MARKER-TASK-7b2e';

function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sourceWorkflowId: A,
    target: { kind: 'chief-of-staff' },
    task: `${MARKER} read the finished run`,
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

function edge(id: string, source: string, target: string | null): ChainTriggerEdge {
  return target === null
    ? { id, sourceWorkflowId: source, targetKind: 'chief-of-staff', workflowId: null }
    : { id, sourceWorkflowId: source, targetKind: 'workflow', workflowId: target };
}

describe('chain trigger validation (TRIGGER-CHAIN-01 S1)', () => {
  it('the limits of stage-start section 4', () => {
    expect(CHAIN_TRIGGER_TASK_MAX_CHARS).toBe(7000);
    expect(CHAIN_TRIGGERS_PER_OWNER_LIMIT).toBe(3);
  });

  it('every error code is chain_trigger_* and answers { statusCode, message, error, code }', () => {
    const expected: Record<string, number> = {
      chain_trigger_invalid_body: 400,
      chain_trigger_unknown_field: 400,
      chain_trigger_missing_field: 400,
      chain_trigger_empty_change: 400,
      chain_trigger_invalid_source: 400,
      chain_trigger_invalid_target: 400,
      chain_trigger_same_workflow: 400,
      chain_trigger_invalid_task: 400,
      chain_trigger_invalid_time_zone: 400,
      chain_trigger_invalid_enabled: 400,
      chain_trigger_not_found: 404,
      chain_trigger_workflow_not_found: 404,
      chain_trigger_limit_reached: 409,
      chain_trigger_cycle: 409,
    };
    expect(Object.values(CHAIN_TRIGGER_ERROR_CODES).sort()).toEqual(Object.keys(expected).sort());
    for (const code of Object.values(CHAIN_TRIGGER_ERROR_CODES)) {
      const error = chainTriggerError(code);
      expect(error.getStatus()).toBe(expected[code]);
      const response = error.getResponse() as Record<string, unknown>;
      expect(Object.keys(response).sort()).toEqual(['code', 'error', 'message', 'statusCode']);
      expect(response.code).toBe(code);
      expect(response.statusCode).toBe(expected[code]);
    }
  });

  describe('readChainTriggerCreate', () => {
    it('reads a Chief of Staff trigger, trims the task and defaults enabled to true', () => {
      expect(readChainTriggerCreate(body({ task: `  ${MARKER} x  ` }))).toEqual({
        sourceWorkflowId: A,
        target: { kind: 'chief-of-staff' },
        task: `${MARKER} x`,
        timeZone: 'Asia/Taipei',
        enabled: true,
      });
    });

    it('reads a workflow target and lower-cases both ids', () => {
      expect(
        readChainTriggerCreate(
          body({ sourceWorkflowId: A.toUpperCase(), target: { kind: 'workflow', workflowId: B.toUpperCase() }, enabled: false }),
        ),
      ).toEqual({
        sourceWorkflowId: A,
        target: { kind: 'workflow', workflowId: B },
        task: `${MARKER} read the finished run`,
        timeZone: 'Asia/Taipei',
        enabled: false,
      });
    });

    it.each([['sourceWorkflowId'], ['target'], ['task'], ['timeZone']])('%s is required', (field) => {
      const payload = body();
      delete payload[field];
      const { status, body: response } = refusal(() => readChainTriggerCreate(payload));
      expect(status).toBe(400);
      expect(response).toMatchObject({ code: CHAIN_TRIGGER_ERROR_CODES.missingField, field });
    });

    it.each([
      ['null', null],
      ['a number', 7],
      ['the Chief of Staff', 'chief-of-staff'],
      ['an object', { kind: 'workflow', workflowId: A }],
      ['a short string', 'abc'],
      ['an empty string', ''],
    ])('a source that is %s is chain_trigger_invalid_source', (_label, sourceWorkflowId) => {
      const { status, body: response } = refusal(() => readChainTriggerCreate(body({ sourceWorkflowId })));
      expect(status).toBe(400);
      expect(response.code).toBe(CHAIN_TRIGGER_ERROR_CODES.invalidSource);
      expect(JSON.stringify(response)).not.toContain('chief-of-staff');
    });

    it('a workflow target equal to the source is chain_trigger_same_workflow (any case)', () => {
      for (const workflowId of [A, A.toUpperCase()]) {
        const { status, body: response } = refusal(() =>
          readChainTriggerCreate(body({ target: { kind: 'workflow', workflowId } })),
        );
        expect(status).toBe(400);
        expect(response.code).toBe(CHAIN_TRIGGER_ERROR_CODES.sameWorkflow);
      }
    });

    it.each([
      ['null', null, CHAIN_TRIGGER_ERROR_CODES.invalidTarget],
      ['a string', 'workflow', CHAIN_TRIGGER_ERROR_CODES.invalidTarget],
      ['an unknown kind', { kind: 'coding' }, CHAIN_TRIGGER_ERROR_CODES.invalidTarget],
      ['a Chief of Staff target with extra keys', { kind: 'chief-of-staff', workflowId: B }, CHAIN_TRIGGER_ERROR_CODES.invalidTarget],
      ['a workflow target without an id', { kind: 'workflow' }, CHAIN_TRIGGER_ERROR_CODES.invalidTarget],
      ['a workflow target with a number id', { kind: 'workflow', workflowId: 5 }, CHAIN_TRIGGER_ERROR_CODES.invalidTarget],
      ['a workflow target with a malformed id', { kind: 'workflow', workflowId: 'nope' }, CHAIN_TRIGGER_ERROR_CODES.workflowNotFound],
    ])('a target that is %s is refused', (_label, target, code) => {
      expect(refusal(() => readChainTriggerCreate(body({ target }))).body.code).toBe(code);
    });

    it.each([
      ['empty', ''],
      ['blank', '   '],
      ['7001 characters', 'a'.repeat(7001)],
      ['a number', 12],
      ['null', null],
    ])('a task that is %s is chain_trigger_invalid_task', (_label, task) => {
      const { status, body: response } = refusal(() => readChainTriggerCreate(body({ task })));
      expect(status).toBe(400);
      expect(response.code).toBe(CHAIN_TRIGGER_ERROR_CODES.invalidTask);
    });

    it('the task edges: 1 and 7000 characters are accepted', () => {
      expect(readChainTriggerCreate(body({ task: 'a' })).task).toBe('a');
      expect(readChainTriggerCreate(body({ task: 'a'.repeat(7000) })).task).toHaveLength(7000);
    });

    it.each([['Mars/Olympus_Mons'], [''], ['x'.repeat(65)], [3]])('the zone %j is chain_trigger_invalid_time_zone', (timeZone) => {
      expect(refusal(() => readChainTriggerCreate(body({ timeZone }))).body.code).toBe(
        CHAIN_TRIGGER_ERROR_CODES.invalidTimeZone,
      );
    });

    it('accepts IANA zones and UTC', () => {
      for (const timeZone of ['UTC', 'Europe/London', 'America/New_York']) {
        expect(readChainTriggerCreate(body({ timeZone })).timeZone).toBe(timeZone);
      }
    });

    it.each([['true'], [1], [null]])('enabled %j is chain_trigger_invalid_enabled', (enabled) => {
      expect(refusal(() => readChainTriggerCreate(body({ enabled }))).body.code).toBe(
        CHAIN_TRIGGER_ERROR_CODES.invalidEnabled,
      );
    });

    it.each([
      ['provider'],
      ['model'],
      ['approvalMode'],
      ['toolProfile'],
      ['sessionId'],
      ['armedAt'],
      ['depth'],
      ['sourceRunId'],
      ['scopeId'],
      ['userId'],
      ['workflowId'],
    ])('the unknown field %s is refused with its name only', (field) => {
      const { status, body: response } = refusal(() => readChainTriggerCreate(body({ [field]: `${MARKER}-value` })));
      expect(status).toBe(400);
      expect(response).toMatchObject({ code: CHAIN_TRIGGER_ERROR_CODES.unknownField, field });
      expect(JSON.stringify(response)).not.toContain(MARKER);
    });

    it.each([[null], [[]], ['text'], [5]])('a body that is %j is chain_trigger_invalid_body', (payload) => {
      expect(refusal(() => readChainTriggerCreate(payload)).body.code).toBe(CHAIN_TRIGGER_ERROR_CODES.invalidBody);
    });

    it('no refusal echoes the task text', () => {
      for (const payload of [
        body({ timeZone: 'Bad/Zone' }),
        body({ target: { kind: 'workflow', workflowId: A } }),
        body({ task: `${MARKER}${'x'.repeat(7000)}` }),
        body({ extra: MARKER }),
      ]) {
        expect(JSON.stringify(refusal(() => readChainTriggerCreate(payload)).body)).not.toContain(MARKER);
      }
    });
  });

  describe('readChainTriggerPatch', () => {
    it('reads only the fields sent', () => {
      expect(readChainTriggerPatch({ enabled: false })).toEqual({ enabled: false });
      expect(readChainTriggerPatch({ sourceWorkflowId: C })).toEqual({ sourceWorkflowId: C });
      expect(readChainTriggerPatch({ target: { kind: 'workflow', workflowId: D }, task: ' t ' })).toEqual({
        target: { kind: 'workflow', workflowId: D },
        task: 't',
      });
      expect(readChainTriggerPatch({ timeZone: 'UTC' })).toEqual({ timeZone: 'UTC' });
    });

    it('refuses an empty change', () => {
      expect(refusal(() => readChainTriggerPatch({})).body.code).toBe(CHAIN_TRIGGER_ERROR_CODES.emptyChange);
    });

    it('refuses a source and a target that are the same workflow when both are sent', () => {
      expect(
        refusal(() => readChainTriggerPatch({ sourceWorkflowId: B, target: { kind: 'workflow', workflowId: B } })).body
          .code,
      ).toBe(CHAIN_TRIGGER_ERROR_CODES.sameWorkflow);
    });

    it('refuses the same field errors and unknown fields as POST', () => {
      expect(refusal(() => readChainTriggerPatch({ sourceWorkflowId: null })).body.code).toBe(
        CHAIN_TRIGGER_ERROR_CODES.invalidSource,
      );
      expect(refusal(() => readChainTriggerPatch({ task: '' })).body.code).toBe(CHAIN_TRIGGER_ERROR_CODES.invalidTask);
      expect(refusal(() => readChainTriggerPatch({ timeZone: 'Bad/Zone' })).body.code).toBe(
        CHAIN_TRIGGER_ERROR_CODES.invalidTimeZone,
      );
      expect(refusal(() => readChainTriggerPatch({ userId: A })).body.code).toBe(CHAIN_TRIGGER_ERROR_CODES.unknownField);
    });
  });

  describe('closesChainCycle (stage-start section 3, bound 1)', () => {
    it('A to B with nothing stored closes no cycle', () => {
      expect(closesChainCycle([], edge('new', A, B))).toBe(false);
    });

    it('A to B, then B to A closes a cycle', () => {
      expect(closesChainCycle([edge('t1', A, B)], edge('new', B, A))).toBe(true);
    });

    it('A to B, B to C, then C to A closes a cycle', () => {
      expect(closesChainCycle([edge('t1', A, B), edge('t2', B, C)], edge('new', C, A))).toBe(true);
    });

    it('A to B, B to C, then A to C (a diamond, no loop) closes no cycle', () => {
      expect(closesChainCycle([edge('t1', A, B), edge('t2', B, C)], edge('new', A, C))).toBe(false);
    });

    it('several triggers on one source (fan-out) close no cycle', () => {
      expect(closesChainCycle([edge('t1', A, B), edge('t2', A, C)], edge('new', A, D))).toBe(false);
    });

    it('an edge to the Chief of Staff never closes a cycle', () => {
      expect(closesChainCycle([edge('t1', A, B), edge('t2', B, A)], edge('new', A, null))).toBe(false);
      expect(closesChainCycle([edge('t1', A, null), edge('t2', B, null)], edge('new', B, A))).toBe(false);
    });

    it('a target equal to the source is a cycle of one', () => {
      expect(closesChainCycle([], edge('new', A, A))).toBe(true);
    });

    it('a change replaces the stored edge of the same trigger', () => {
      // t2 is B to A; changing it to B to C leaves A to B, B to C: no cycle.
      expect(closesChainCycle([edge('t1', A, B), edge('t2', B, A)], edge('t2', B, C))).toBe(false);
      // Changing t2 (B to Chief of Staff) to B to A closes A to B to A.
      expect(closesChainCycle([edge('t1', A, B), edge('t2', B, null)], edge('t2', B, A))).toBe(true);
      // Changing t1's source closes the loop through t2 and t3.
      expect(closesChainCycle([edge('t1', D, A), edge('t2', A, B), edge('t3', B, C)], edge('t1', C, A))).toBe(true);
    });

    it('stored edges are counted whatever their switch (the rule takes no enabled flag)', () => {
      const source = readFileSync(join(__dirname, 'chain-trigger-validation.ts'), 'utf8');
      const rule = source.slice(source.indexOf('export function closesChainCycle'));
      expect(rule.slice(0, rule.indexOf('\n}\n'))).not.toMatch(/enabled/);
    });

    it('terminates on a stored graph that already loops elsewhere', () => {
      expect(closesChainCycle([edge('t1', B, C), edge('t2', C, B)], edge('new', A, B))).toBe(false);
    });
  });
});
