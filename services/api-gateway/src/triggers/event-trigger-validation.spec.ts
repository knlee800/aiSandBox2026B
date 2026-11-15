import { HttpException } from '@nestjs/common';
import {
  EVENT_TRIGGER_ERROR_CODES,
  EVENT_TRIGGER_LEAD_DEFAULT_MINUTES,
  EVENT_TRIGGER_LEAD_MAX_MINUTES,
  EVENT_TRIGGER_LEAD_MIN_MINUTES,
  EVENT_TRIGGER_TASK_MAX_CHARS,
  EVENT_TRIGGER_TITLE_FILTER_MAX_CHARS,
  EVENT_TRIGGERS_PER_OWNER_LIMIT,
  eventTriggerError,
  readEventTriggerCreate,
  readEventTriggerPatch,
} from './event-trigger-validation';
import { SCHEDULE_ERROR_CODES } from './schedule-validation';

const WORKFLOW_ID = '33333333-3333-4333-8333-333333333333';
const MARKER = 'MARKER-FILTER-5b2e';

function valid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    target: { kind: 'chief-of-staff' },
    task: 'Prepare me for this meeting',
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

describe('event trigger validation (TRIGGER-EVENT-01 S2, stage-start sections 2 and 8)', () => {
  it('the limits are the approved constants', () => {
    expect(EVENT_TRIGGERS_PER_OWNER_LIMIT).toBe(3);
    expect(EVENT_TRIGGER_TASK_MAX_CHARS).toBe(7500);
    expect(EVENT_TRIGGER_TITLE_FILTER_MAX_CHARS).toBe(100);
    expect(EVENT_TRIGGER_LEAD_MIN_MINUTES).toBe(5);
    expect(EVENT_TRIGGER_LEAD_MAX_MINUTES).toBe(120);
    expect(EVENT_TRIGGER_LEAD_DEFAULT_MINUTES).toBe(15);
  });

  it('every code is event_trigger_* and mirrors the schedule set, with lead and filter in place of time and days', () => {
    const codes = Object.values(EVENT_TRIGGER_ERROR_CODES);
    for (const code of codes) {
      expect(code).toMatch(/^event_trigger_[a-z_]+$/);
    }
    const mirrored = Object.values(SCHEDULE_ERROR_CODES)
      .map((code) => code.replace(/^schedule_/, 'event_trigger_'))
      .filter((code) => code !== 'event_trigger_invalid_time' && code !== 'event_trigger_invalid_days');
    expect([...codes].sort()).toEqual(
      [...mirrored, 'event_trigger_invalid_lead', 'event_trigger_invalid_filter'].sort(),
    );
  });

  it('errors are { statusCode, message, error, code } and 400, 404 or 409', () => {
    expect(eventTriggerError(EVENT_TRIGGER_ERROR_CODES.invalidLead).getResponse()).toEqual({
      statusCode: 400,
      message: 'leadMinutes must be a whole number from 5 to 120',
      error: 'Bad Request',
      code: 'event_trigger_invalid_lead',
    });
    expect(eventTriggerError(EVENT_TRIGGER_ERROR_CODES.notFound).getResponse()).toEqual({
      statusCode: 404,
      message: 'Event trigger not found',
      error: 'Not Found',
      code: 'event_trigger_not_found',
    });
    expect(eventTriggerError(EVENT_TRIGGER_ERROR_CODES.limitReached, { limit: 3 }).getResponse()).toEqual({
      statusCode: 409,
      message: 'At most 3 event triggers per account',
      error: 'Conflict',
      code: 'event_trigger_limit_reached',
      limit: 3,
    });
  });

  describe('readEventTriggerCreate', () => {
    it('reads a Chief of Staff trigger; lead defaults to 15, filter to null, enabled to true; the task is trimmed', () => {
      expect(readEventTriggerCreate(valid({ task: '  Prepare me \n' }))).toEqual({
        target: { kind: 'chief-of-staff' },
        task: 'Prepare me',
        leadMinutes: 15,
        titleFilter: null,
        timeZone: 'Asia/Taipei',
        enabled: true,
      });
    });

    it('reads a workflow trigger with a lead, a filter and enabled false', () => {
      expect(
        readEventTriggerCreate(
          valid({
            target: { kind: 'workflow', workflowId: WORKFLOW_ID.toUpperCase() },
            leadMinutes: 30,
            titleFilter: '  Board  ',
            enabled: false,
          }),
        ),
      ).toEqual({
        target: { kind: 'workflow', workflowId: WORKFLOW_ID },
        task: 'Prepare me for this meeting',
        leadMinutes: 30,
        titleFilter: 'Board',
        timeZone: 'Asia/Taipei',
        enabled: false,
      });
    });

    it.each(['target', 'task', 'timeZone'])('refuses a missing %s', (field) => {
      const body = valid();
      delete body[field];
      const { status, body: response } = refusal(() => readEventTriggerCreate(body));
      expect(status).toBe(400);
      expect(response).toMatchObject({ code: EVENT_TRIGGER_ERROR_CODES.missingField, field });
    });

    it.each([[null], ['text'], [[]], [42]])('refuses a body that is not an object: %j', (body) => {
      expect(refusal(() => readEventTriggerCreate(body)).body.code).toBe(EVENT_TRIGGER_ERROR_CODES.invalidBody);
    });
  });

  describe('leadMinutes: an integer 5 to 120', () => {
    it.each([5, 6, 15, 60, 119, 120])('accepts %j', (leadMinutes) => {
      expect(readEventTriggerCreate(valid({ leadMinutes })).leadMinutes).toBe(leadMinutes);
    });

    it.each([[4], [121], [0], [-5], [15.5], [Number.NaN], [Number.POSITIVE_INFINITY], ['15'], [null], [true], [[15]], [{}]])(
      'refuses %j',
      (leadMinutes) => {
        const { status, body } = refusal(() => readEventTriggerCreate(valid({ leadMinutes })));
        expect(status).toBe(400);
        expect(body.code).toBe(EVENT_TRIGGER_ERROR_CODES.invalidLead);
      },
    );
  });

  describe('titleFilter: null, or a trimmed string of at most 100', () => {
    it('accepts 1 and 100 characters', () => {
      expect(readEventTriggerCreate(valid({ titleFilter: 'a' })).titleFilter).toBe('a');
      const hundred = 'b'.repeat(100);
      expect(readEventTriggerCreate(valid({ titleFilter: hundred })).titleFilter).toBe(hundred);
      expect(readEventTriggerCreate(valid({ titleFilter: `  ${hundred}  ` })).titleFilter).toBe(hundred);
    });

    it.each([[null], [''], ['   '], ['\n\t']])('%j means null (every timed event)', (titleFilter) => {
      expect(readEventTriggerCreate(valid({ titleFilter })).titleFilter).toBeNull();
      expect(readEventTriggerPatch({ titleFilter })).toEqual({ titleFilter: null });
    });

    it.each([['c'.repeat(101)], [42], [true], [['Board']], [{ contains: 'Board' }]])('refuses %j', (titleFilter) => {
      const { status, body } = refusal(() => readEventTriggerCreate(valid({ titleFilter })));
      expect(status).toBe(400);
      expect(body.code).toBe(EVENT_TRIGGER_ERROR_CODES.invalidFilter);
    });

    it('a refusal never echoes the filter text', () => {
      const { body } = refusal(() => readEventTriggerCreate(valid({ titleFilter: `${MARKER}${'x'.repeat(100)}` })));
      expect(JSON.stringify(body)).not.toContain(MARKER);
    });
  });

  describe('task: trimmed, 1 to 7500', () => {
    it('accepts 7500 characters', () => {
      expect(readEventTriggerCreate(valid({ task: 'a'.repeat(7500) })).task).toHaveLength(7500);
    });

    it.each([
      ['empty', ''],
      ['blank', '   '],
      ['7501 characters', 'a'.repeat(7501)],
      ['a number', 42],
      ['null', null],
      ['an array', ['task']],
    ])('refuses %s', (_label, task) => {
      const { status, body } = refusal(() => readEventTriggerCreate(valid({ task })));
      expect(status).toBe(400);
      expect(body.code).toBe(EVENT_TRIGGER_ERROR_CODES.invalidTask);
    });
  });

  describe('timeZone', () => {
    it.each(['Asia/Taipei', 'Europe/London', 'UTC', 'America/New_York'])('accepts %j', (timeZone) => {
      expect(readEventTriggerCreate(valid({ timeZone })).timeZone).toBe(timeZone);
    });

    it.each([['Mars/Olympus_Mons'], [''], ['x'.repeat(65)], [8], [null]])('refuses %j', (timeZone) => {
      expect(refusal(() => readEventTriggerCreate(valid({ timeZone }))).body.code).toBe(
        EVENT_TRIGGER_ERROR_CODES.invalidTimeZone,
      );
    });
  });

  describe('target', () => {
    it.each([
      [{ kind: 'coding' }],
      [{ kind: 'chief-of-staff', workflowId: WORKFLOW_ID }],
      [{ kind: 'workflow' }],
      [{ kind: 'workflow', workflowId: 7 }],
      [{ kind: 'workflow', workflowId: WORKFLOW_ID, name: 'x' }],
      ['chief-of-staff'],
      [null],
      [[]],
    ])('refuses %j as invalid_target', (target) => {
      expect(refusal(() => readEventTriggerCreate(valid({ target }))).body.code).toBe(
        EVENT_TRIGGER_ERROR_CODES.invalidTarget,
      );
    });

    it('a workflow id that is not a uuid answers 404 workflow_not_found', () => {
      const { status, body } = refusal(() =>
        readEventTriggerCreate(valid({ target: { kind: 'workflow', workflowId: 'not-a-uuid' } })),
      );
      expect(status).toBe(404);
      expect(body.code).toBe(EVENT_TRIGGER_ERROR_CODES.workflowNotFound);
    });
  });

  it('enabled must be a boolean', () => {
    expect(refusal(() => readEventTriggerCreate(valid({ enabled: 'true' }))).body.code).toBe(
      EVENT_TRIGGER_ERROR_CODES.invalidEnabled,
    );
    expect(refusal(() => readEventTriggerPatch({ enabled: 1 })).body.code).toBe(
      EVENT_TRIGGER_ERROR_CODES.invalidEnabled,
    );
  });

  describe('unknown fields are refused, by name only', () => {
    it.each([
      'provider',
      'model',
      'approvalMode',
      'budgetPerDayCredits',
      'toolProfile',
      'sessionId',
      'testRun',
      'userId',
      'armedAt',
      'calendarState',
      'timeOfDay',
      'days',
      'lead_minutes',
    ])('%s', (field) => {
      const { status, body } = refusal(() => readEventTriggerCreate(valid({ [field]: `${MARKER}` })));
      expect(status).toBe(400);
      expect(body).toMatchObject({ code: EVENT_TRIGGER_ERROR_CODES.unknownField, field });
      expect(JSON.stringify(body)).not.toContain(MARKER);
      expect(refusal(() => readEventTriggerPatch({ [field]: 1 })).body.code).toBe(
        EVENT_TRIGGER_ERROR_CODES.unknownField,
      );
    });
  });

  describe('readEventTriggerPatch', () => {
    it('reads only the fields sent', () => {
      expect(readEventTriggerPatch({ leadMinutes: 45 })).toEqual({ leadMinutes: 45 });
      expect(readEventTriggerPatch({ titleFilter: ' Standup ', enabled: false })).toEqual({
        titleFilter: 'Standup',
        enabled: false,
      });
      expect(readEventTriggerPatch({ task: ' t ', timeZone: 'UTC' })).toEqual({ task: 't', timeZone: 'UTC' });
    });

    it('refuses an empty change', () => {
      expect(refusal(() => readEventTriggerPatch({})).body.code).toBe(EVENT_TRIGGER_ERROR_CODES.emptyChange);
      expect(refusal(() => readEventTriggerPatch({ task: undefined })).body.code).toBe(
        EVENT_TRIGGER_ERROR_CODES.emptyChange,
      );
    });

    it('applies the same field rules as create', () => {
      expect(refusal(() => readEventTriggerPatch({ leadMinutes: 121 })).body.code).toBe(
        EVENT_TRIGGER_ERROR_CODES.invalidLead,
      );
      expect(refusal(() => readEventTriggerPatch({ titleFilter: 'z'.repeat(101) })).body.code).toBe(
        EVENT_TRIGGER_ERROR_CODES.invalidFilter,
      );
      expect(refusal(() => readEventTriggerPatch({ task: '' })).body.code).toBe(EVENT_TRIGGER_ERROR_CODES.invalidTask);
      expect(refusal(() => readEventTriggerPatch({ timeZone: 'Bad/Zone' })).body.code).toBe(
        EVENT_TRIGGER_ERROR_CODES.invalidTimeZone,
      );
    });
  });
});
