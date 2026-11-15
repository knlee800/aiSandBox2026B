import { HttpException } from '@nestjs/common';
import { COLLABORATION_USER_TASK_MAX_CHARS } from '../orchestration/collaboration-team';
import {
  SCHEDULE_ERROR_CODES,
  SCHEDULE_TASK_MAX_CHARS,
  SCHEDULES_PER_OWNER_LIMIT,
  daysToMask,
  formatTimeOfDay,
  isAcceptedTimeZone,
  maskToDays,
  readScheduleCreate,
  readSchedulePatch,
} from './schedule-validation';

const WORKFLOW_ID = '33333333-3333-4333-8333-333333333333';

function valid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    target: { kind: 'chief-of-staff' },
    task: 'Summarise my week',
    timeOfDay: '07:30',
    days: [1, 2, 3, 4, 5],
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

describe('schedule validation (TRIGGER-01 S1, stage-start section 7)', () => {
  it('the limits are the approved constants', () => {
    expect(SCHEDULES_PER_OWNER_LIMIT).toBe(5);
    expect(SCHEDULE_TASK_MAX_CHARS).toBe(8000);
    expect(SCHEDULE_TASK_MAX_CHARS).toBe(COLLABORATION_USER_TASK_MAX_CHARS);
  });

  describe('readScheduleCreate', () => {
    it('reads a Chief of Staff schedule; enabled defaults to true; the task is trimmed', () => {
      expect(readScheduleCreate(valid({ task: '  Summarise my week \n' }))).toEqual({
        target: { kind: 'chief-of-staff' },
        task: 'Summarise my week',
        timeOfDay: 7 * 60 + 30,
        days: 1 | 2 | 4 | 8 | 16,
        timeZone: 'Asia/Taipei',
        enabled: true,
      });
    });

    it('reads a workflow schedule and enabled false', () => {
      expect(
        readScheduleCreate(
          valid({ target: { kind: 'workflow', workflowId: WORKFLOW_ID }, enabled: false, days: [7] }),
        ),
      ).toMatchObject({ target: { kind: 'workflow', workflowId: WORKFLOW_ID }, enabled: false, days: 64 });
    });

    it.each(['target', 'task', 'timeOfDay', 'days', 'timeZone'])('refuses a missing %s', (field) => {
      const body = valid();
      delete body[field];
      const { status, body: response } = refusal(() => readScheduleCreate(body));
      expect(status).toBe(400);
      expect(response).toEqual({
        statusCode: 400,
        message: 'A required field is missing',
        error: 'Bad Request',
        code: SCHEDULE_ERROR_CODES.missingField,
        field,
      });
    });

    it.each([[null], [[]], ['text'], [42], [undefined]])('refuses a body that is not an object (%j)', (body) => {
      const { status, body: response } = refusal(() => readScheduleCreate(body));
      expect(status).toBe(400);
      expect(response.code).toBe(SCHEDULE_ERROR_CODES.invalidBody);
    });

    it.each(['provider', 'model', 'approvalMode', 'budgetPerRunCredits', 'toolProfile', 'profile', 'sessionId', 'testRun', 'workflowId', 'userId', 'id', 'armedAt'])(
      'refuses the unlisted field %s and names only the field',
      (field) => {
        const { status, body } = refusal(() => readScheduleCreate(valid({ [field]: 'secret-value' })));
        expect(status).toBe(400);
        expect(body.code).toBe(SCHEDULE_ERROR_CODES.unknownField);
        expect(body.field).toBe(field);
        expect(JSON.stringify(body)).not.toContain('secret-value');
      },
    );
  });

  describe('task', () => {
    it.each([[''], ['   '], ['\n\t'], [42], [null], [['a']]])('refuses %j', (task) => {
      const { status, body } = refusal(() => readScheduleCreate(valid({ task })));
      expect(status).toBe(400);
      expect(body.code).toBe(SCHEDULE_ERROR_CODES.invalidTask);
    });

    it('accepts 8000 characters after trimming and refuses 8001', () => {
      expect(readScheduleCreate(valid({ task: ` ${'a'.repeat(8000)} ` })).task).toHaveLength(8000);
      const { body } = refusal(() => readScheduleCreate(valid({ task: 'a'.repeat(8001) })));
      expect(body.code).toBe(SCHEDULE_ERROR_CODES.invalidTask);
    });

    it('a refusal never echoes the task text', () => {
      const { body } = refusal(() => readScheduleCreate(valid({ task: `MARKER-${'x'.repeat(8000)}` })));
      expect(JSON.stringify(body)).not.toContain('MARKER');
    });
  });

  describe('timeOfDay', () => {
    it.each([
      ['00:00', 0],
      ['00:01', 1],
      ['09:05', 545],
      ['12:00', 720],
      ['23:59', 1439],
    ])('reads %s as %d minutes', (timeOfDay, minutes) => {
      expect(readScheduleCreate(valid({ timeOfDay })).timeOfDay).toBe(minutes);
    });

    it.each(['24:00', '23:60', '7:30', '07:3', '0730', '07:30:00', ' 07:30', '07:30 ', '', 'ab:cd', '-1:00'])(
      'refuses %j',
      (timeOfDay) => {
        const { body } = refusal(() => readScheduleCreate(valid({ timeOfDay })));
        expect(body.code).toBe(SCHEDULE_ERROR_CODES.invalidTime);
      },
    );

    it.each([[450], [null], [{ hours: 7 }]])('refuses a non-string %j', (timeOfDay) => {
      const { body } = refusal(() => readScheduleCreate(valid({ timeOfDay })));
      expect(body.code).toBe(SCHEDULE_ERROR_CODES.invalidTime);
    });

    it('formats minutes back to HH:MM', () => {
      expect([0, 1, 545, 720, 1439].map(formatTimeOfDay)).toEqual(['00:00', '00:01', '09:05', '12:00', '23:59']);
    });
  });

  describe('days', () => {
    it('Monday = 1 is bit 1, Sunday = 7 is bit 64; every day is 127', () => {
      expect(readScheduleCreate(valid({ days: [1] })).days).toBe(1);
      expect(readScheduleCreate(valid({ days: [7] })).days).toBe(64);
      expect(readScheduleCreate(valid({ days: [7, 1, 3] })).days).toBe(1 + 4 + 64);
      expect(readScheduleCreate(valid({ days: [1, 2, 3, 4, 5, 6, 7] })).days).toBe(127);
    });

    it.each([
      [[]],
      [[0]],
      [[8]],
      [[1, 1]],
      [[1.5]],
      [['1']],
      [[1, 2, 3, 4, 5, 6, 7, 1]],
      [[null]],
      [1],
      ['1,2'],
      [{ 1: true }],
      [null],
    ])('refuses %j (the empty day set included)', (days) => {
      const { body } = refusal(() => readScheduleCreate(valid({ days })));
      expect(body.code).toBe(SCHEDULE_ERROR_CODES.invalidDays);
    });

    it('mask and day numbers round-trip in order', () => {
      for (let mask = 1; mask <= 127; mask += 1) {
        const days = maskToDays(mask);
        expect(days).toEqual([...days].sort((a, b) => a - b));
        expect(daysToMask(days)).toBe(mask);
      }
    });
  });

  describe('timeZone', () => {
    it.each(['UTC', 'Asia/Taipei', 'America/New_York', 'Europe/London', 'Asia/Singapore', 'Pacific/Kiritimati'])(
      'accepts %s',
      (timeZone) => {
        expect(readScheduleCreate(valid({ timeZone })).timeZone).toBe(timeZone);
      },
    );

    it.each(['Mars/Olympus_Mons', 'Not a zone', '', 'Asia/Taipei2', 'x'.repeat(65)])('refuses the invalid zone %j', (timeZone) => {
      const { body } = refusal(() => readScheduleCreate(valid({ timeZone })));
      expect(body.code).toBe(SCHEDULE_ERROR_CODES.invalidTimeZone);
    });

    it.each([[8], [null], [['UTC']]])('refuses a non-string %j', (timeZone) => {
      const { body } = refusal(() => readScheduleCreate(valid({ timeZone })));
      expect(body.code).toBe(SCHEDULE_ERROR_CODES.invalidTimeZone);
    });

    it('allows at most 64 characters even when the rest would pass', () => {
      expect(isAcceptedTimeZone('America/Argentina/ComodRivadavia')).toBe(true);
      expect(isAcceptedTimeZone('A'.repeat(65))).toBe(false);
    });
  });

  describe('target', () => {
    it.each([
      [null],
      ['chief-of-staff'],
      [{}],
      [{ kind: 'coding' }],
      [{ kind: 'advisors' }],
      [{ kind: 'chief-of-staff', workflowId: WORKFLOW_ID }],
      [{ kind: 'chief-of-staff', sessionId: WORKFLOW_ID }],
      [{ kind: 'workflow' }],
      [{ kind: 'workflow', workflowId: 42 }],
      [{ kind: 'workflow', workflowId: WORKFLOW_ID, name: 'x' }],
      [{ kind: 'workflow', workflowId: WORKFLOW_ID, testRun: true }],
    ])('refuses %j with 400', (target) => {
      const { status, body } = refusal(() => readScheduleCreate(valid({ target })));
      expect(status).toBe(400);
      expect(body.code).toBe(SCHEDULE_ERROR_CODES.invalidTarget);
    });

    it.each(['not-a-uuid', '', '33333333-3333-4333-8333-33333333333', 'chief-of-staff'])(
      'a workflow id that is not a uuid (%j) answers 404 like an unknown workflow',
      (workflowId) => {
        const { status, body } = refusal(() =>
          readScheduleCreate(valid({ target: { kind: 'workflow', workflowId } })),
        );
        expect(status).toBe(404);
        expect(body).toEqual({
          statusCode: 404,
          message: 'Workflow not found',
          error: 'Not Found',
          code: SCHEDULE_ERROR_CODES.workflowNotFound,
        });
      },
    );

    it('lower-cases a workflow uuid', () => {
      expect(
        readScheduleCreate(valid({ target: { kind: 'workflow', workflowId: WORKFLOW_ID.toUpperCase() } })).target,
      ).toEqual({ kind: 'workflow', workflowId: WORKFLOW_ID });
    });
  });

  describe('enabled', () => {
    it.each([['true'], [1], [null], [0]])('refuses %j', (enabled) => {
      const { body } = refusal(() => readScheduleCreate(valid({ enabled })));
      expect(body.code).toBe(SCHEDULE_ERROR_CODES.invalidEnabled);
    });
  });

  describe('readSchedulePatch', () => {
    it('returns only the fields that were sent', () => {
      expect(readSchedulePatch({ enabled: false })).toEqual({ enabled: false });
      expect(readSchedulePatch({ timeOfDay: '06:00', days: [6, 7] })).toEqual({ timeOfDay: 360, days: 32 + 64 });
      expect(readSchedulePatch({ task: ' New task ' })).toEqual({ task: 'New task' });
    });

    it('refuses an empty change', () => {
      const { status, body } = refusal(() => readSchedulePatch({}));
      expect(status).toBe(400);
      expect(body.code).toBe(SCHEDULE_ERROR_CODES.emptyChange);
    });

    it('applies the same field rules and refuses unlisted fields', () => {
      expect(refusal(() => readSchedulePatch({ timeZone: 'Nowhere/Land' })).body.code).toBe(
        SCHEDULE_ERROR_CODES.invalidTimeZone,
      );
      expect(refusal(() => readSchedulePatch({ days: [] })).body.code).toBe(SCHEDULE_ERROR_CODES.invalidDays);
      expect(refusal(() => readSchedulePatch({ model: 'gpt' })).body.code).toBe(SCHEDULE_ERROR_CODES.unknownField);
      expect(refusal(() => readSchedulePatch({ enabled: true, budget: 1 })).body.code).toBe(
        SCHEDULE_ERROR_CODES.unknownField,
      );
      expect(refusal(() => readSchedulePatch([])).body.code).toBe(SCHEDULE_ERROR_CODES.invalidBody);
    });
  });
});
