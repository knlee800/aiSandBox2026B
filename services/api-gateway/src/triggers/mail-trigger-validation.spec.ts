import { HttpException } from '@nestjs/common';
import {
  MAIL_TRIGGER_ERROR_CODES,
  MAIL_TRIGGER_SENDER_FILTER_MAX_CHARS,
  MAIL_TRIGGER_SUBJECT_FILTER_MAX_CHARS,
  MAIL_TRIGGER_TASK_MAX_CHARS,
  MAIL_TRIGGERS_PER_OWNER_LIMIT,
  isAcceptedSenderFilter,
  mailTriggerError,
  readMailTriggerCreate,
  readMailTriggerPatch,
} from './mail-trigger-validation';
import { SCHEDULE_ERROR_CODES } from './schedule-validation';

const WORKFLOW_ID = '33333333-3333-4333-8333-333333333333';
const MARKER = 'MARKER-FILTER-7c1d';

function valid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    target: { kind: 'chief-of-staff' },
    task: 'Summarise the new mail',
    senderFilter: 'boss@example.com',
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

describe('mail trigger validation (TRIGGER-MAIL-01 S2, stage-start sections 2 and 8)', () => {
  it('the limits are the approved constants', () => {
    expect(MAIL_TRIGGERS_PER_OWNER_LIMIT).toBe(3);
    expect(MAIL_TRIGGER_TASK_MAX_CHARS).toBe(7500);
    expect(MAIL_TRIGGER_SENDER_FILTER_MAX_CHARS).toBe(254);
    expect(MAIL_TRIGGER_SUBJECT_FILTER_MAX_CHARS).toBe(100);
  });

  it('every code is mail_trigger_* and mirrors the schedule set, with sender and subject in place of time and days', () => {
    const codes = Object.values(MAIL_TRIGGER_ERROR_CODES);
    for (const code of codes) {
      expect(code).toMatch(/^mail_trigger_[a-z_]+$/);
    }
    const mirrored = Object.values(SCHEDULE_ERROR_CODES)
      .map((code) => code.replace(/^schedule_/, 'mail_trigger_'))
      .filter((code) => code !== 'mail_trigger_invalid_time' && code !== 'mail_trigger_invalid_days');
    expect([...codes].sort()).toEqual(
      [...mirrored, 'mail_trigger_invalid_sender', 'mail_trigger_invalid_subject'].sort(),
    );
  });

  it('errors are { statusCode, message, error, code } and 400, 404 or 409', () => {
    expect(mailTriggerError(MAIL_TRIGGER_ERROR_CODES.invalidSender).getResponse()).toEqual({
      statusCode: 400,
      message: 'senderFilter must be one email address or @ and a domain, at most 254 characters',
      error: 'Bad Request',
      code: 'mail_trigger_invalid_sender',
    });
    expect(mailTriggerError(MAIL_TRIGGER_ERROR_CODES.invalidSubject).getResponse()).toEqual({
      statusCode: 400,
      message: 'subjectFilter must be empty or at most 100 characters',
      error: 'Bad Request',
      code: 'mail_trigger_invalid_subject',
    });
    expect(mailTriggerError(MAIL_TRIGGER_ERROR_CODES.notFound).getResponse()).toEqual({
      statusCode: 404,
      message: 'Mail trigger not found',
      error: 'Not Found',
      code: 'mail_trigger_not_found',
    });
    expect(mailTriggerError(MAIL_TRIGGER_ERROR_CODES.limitReached, { limit: 3 }).getResponse()).toEqual({
      statusCode: 409,
      message: 'At most 3 mail triggers per account',
      error: 'Conflict',
      code: 'mail_trigger_limit_reached',
      limit: 3,
    });
  });

  describe('readMailTriggerCreate', () => {
    it('reads a Chief of Staff trigger; subject defaults to null, enabled to true; the task is trimmed', () => {
      expect(readMailTriggerCreate(valid({ task: '  Summarise it \n' }))).toEqual({
        target: { kind: 'chief-of-staff' },
        task: 'Summarise it',
        senderFilter: 'boss@example.com',
        subjectFilter: null,
        timeZone: 'Asia/Taipei',
        enabled: true,
      });
    });

    it('reads a workflow trigger with a domain sender, a subject word and enabled false', () => {
      expect(
        readMailTriggerCreate(
          valid({
            target: { kind: 'workflow', workflowId: WORKFLOW_ID.toUpperCase() },
            senderFilter: '  @Example.COM ',
            subjectFilter: '  Invoice  ',
            enabled: false,
          }),
        ),
      ).toEqual({
        target: { kind: 'workflow', workflowId: WORKFLOW_ID },
        task: 'Summarise the new mail',
        senderFilter: '@example.com',
        subjectFilter: 'Invoice',
        timeZone: 'Asia/Taipei',
        enabled: false,
      });
    });

    it.each(['target', 'task', 'senderFilter', 'timeZone'])('refuses a missing %s', (field) => {
      const body = valid();
      delete body[field];
      const { status, body: response } = refusal(() => readMailTriggerCreate(body));
      expect(status).toBe(400);
      expect(response).toMatchObject({ code: MAIL_TRIGGER_ERROR_CODES.missingField, field });
    });

    it.each([[null], ['text'], [[]], [42]])('refuses a body that is not an object: %j', (body) => {
      expect(refusal(() => readMailTriggerCreate(body)).body.code).toBe(MAIL_TRIGGER_ERROR_CODES.invalidBody);
    });
  });

  describe('senderFilter: required, one address or @ and a domain, at most 254', () => {
    it.each([
      ['boss@example.com', 'boss@example.com'],
      ['Boss.Name@Example.com', 'boss.name@example.com'],
      ['first.last+tag@mail.example.co.uk', 'first.last+tag@mail.example.co.uk'],
      ["o'brien_x-y@example.org", "o'brien_x-y@example.org"],
      ['@example.com', '@example.com'],
      ['@EXAMPLE.com', '@example.com'],
      ['@xn--bcher-kva.example', '@xn--bcher-kva.example'],
      ['a@b.co', 'a@b.co'],
      ['  boss@example.com\t', 'boss@example.com'],
    ])('accepts %j as %j (trimmed, lower case)', (senderFilter, stored) => {
      expect(readMailTriggerCreate(valid({ senderFilter })).senderFilter).toBe(stored);
      expect(readMailTriggerPatch({ senderFilter })).toEqual({ senderFilter: stored });
    });

    it('accepts exactly 254 characters and refuses 255', () => {
      const domain = `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.com`; // 195 characters
      const at254 = `${'l'.repeat(254 - domain.length - 1)}@${domain}`;
      expect(at254.length).toBe(254);
      expect(254 - domain.length - 1).toBeLessThanOrEqual(64);
      expect(readMailTriggerCreate(valid({ senderFilter: at254 })).senderFilter).toBe(at254);
      // A valid local part (59) and domain (195), 255 in all: refused for the total only.
      const at255 = `${'l'.repeat(59)}@${domain}`;
      expect(at255.length).toBe(255);
      expect(refusal(() => readMailTriggerCreate(valid({ senderFilter: at255 }))).body.code).toBe(
        MAIL_TRIGGER_ERROR_CODES.invalidSender,
      );
    });

    it.each([
      ['empty', ''],
      ['blank', '   '],
      ['null (required)', null],
      ['a number', 42],
      ['an array', ['boss@example.com']],
      ['an object', { address: 'boss@example.com' }],
      ['no @', 'example.com'],
      ['only @', '@'],
      ['a local part only', 'boss@'],
      ['two @', 'boss@@example.com'],
      ['two addresses', 'a@example.com,b@example.com'],
      ['a list with a space', 'a@example.com b@example.com'],
      ['a display name', 'Boss <boss@example.com>'],
      ['angle brackets', '<boss@example.com>'],
      ['a quoted local part', '"boss"@example.com'],
      ['a space inside', 'bo ss@example.com'],
      ['a single-label domain', 'boss@localhost'],
      ['a domain alone after @', '@com'],
      ['a wildcard local part', '*@example.com'],
      ['a wildcard inside the local part', 'boss*@example.com'],
      ['a question mark in the local part', 'b?ss@example.com'],
      ['a wildcard domain', '@*.example.com'],
      ['an IP literal', 'boss@[192.168.0.1]'],
      ['an IP address domain', 'boss@192.168.0.1'],
      ['a leading dot in the local part', '.boss@example.com'],
      ['a trailing dot in the local part', 'boss.@example.com'],
      ['two dots in the local part', 'bo..ss@example.com'],
      ['a leading dot in the domain', '@.example.com'],
      ['a trailing dot in the domain', '@example.com.'],
      ['an empty label', 'boss@example..com'],
      ['a label starting with a hyphen', 'boss@-example.com'],
      ['a label ending with a hyphen', 'boss@example-.com'],
      ['a 64-character label', `boss@${'a'.repeat(64)}.com`],
      ['a 65-character local part', `${'l'.repeat(65)}@example.com`],
      ['an underscore in the domain', 'boss@ex_ample.com'],
      ['non-ASCII', 'bóss@example.com'],
      ['a newline inside', 'boss@exa\nmple.com'],
      ['a control character', 'boss@example.com\u0000'],
    ])('refuses %s', (_label, senderFilter) => {
      const { status, body } = refusal(() => readMailTriggerCreate(valid({ senderFilter })));
      expect(status).toBe(400);
      expect(body.code).toBe(MAIL_TRIGGER_ERROR_CODES.invalidSender);
      expect(refusal(() => readMailTriggerPatch({ senderFilter })).body.code).toBe(
        MAIL_TRIGGER_ERROR_CODES.invalidSender,
      );
    });

    it('a refusal never echoes the sender text', () => {
      const { body } = refusal(() => readMailTriggerCreate(valid({ senderFilter: `${MARKER} <x@example.com>` })));
      expect(JSON.stringify(body)).not.toContain(MARKER);
      expect(JSON.stringify(body)).not.toContain('x@example.com');
    });

    it('isAcceptedSenderFilter checks the stored (lower-case, trimmed) form only', () => {
      expect(isAcceptedSenderFilter('boss@example.com')).toBe(true);
      expect(isAcceptedSenderFilter('@example.com')).toBe(true);
      expect(isAcceptedSenderFilter('Boss@Example.com')).toBe(false);
      expect(isAcceptedSenderFilter(' boss@example.com')).toBe(false);
      expect(isAcceptedSenderFilter(undefined)).toBe(false);
    });
  });

  describe('subjectFilter: null, or a trimmed string of at most 100', () => {
    it('accepts 1 and 100 characters and keeps the case', () => {
      expect(readMailTriggerCreate(valid({ subjectFilter: 'a' })).subjectFilter).toBe('a');
      const hundred = 'B'.repeat(100);
      expect(readMailTriggerCreate(valid({ subjectFilter: hundred })).subjectFilter).toBe(hundred);
      expect(readMailTriggerCreate(valid({ subjectFilter: `  ${hundred}  ` })).subjectFilter).toBe(hundred);
    });

    it.each([[null], [''], ['   '], ['\n\t']])('%j means null (any subject from that sender)', (subjectFilter) => {
      expect(readMailTriggerCreate(valid({ subjectFilter })).subjectFilter).toBeNull();
      expect(readMailTriggerPatch({ subjectFilter })).toEqual({ subjectFilter: null });
    });

    it.each([['c'.repeat(101)], [42], [true], [['Invoice']], [{ contains: 'Invoice' }]])('refuses %j', (subjectFilter) => {
      const { status, body } = refusal(() => readMailTriggerCreate(valid({ subjectFilter })));
      expect(status).toBe(400);
      expect(body.code).toBe(MAIL_TRIGGER_ERROR_CODES.invalidSubject);
    });

    it('a refusal never echoes the subject text', () => {
      const { body } = refusal(() => readMailTriggerCreate(valid({ subjectFilter: `${MARKER}${'x'.repeat(100)}` })));
      expect(JSON.stringify(body)).not.toContain(MARKER);
    });
  });

  describe('task: trimmed, 1 to 7500', () => {
    it('accepts 7500 characters', () => {
      expect(readMailTriggerCreate(valid({ task: 'a'.repeat(7500) })).task).toHaveLength(7500);
    });

    it.each([
      ['empty', ''],
      ['blank', '   '],
      ['7501 characters', 'a'.repeat(7501)],
      ['a number', 42],
      ['null', null],
      ['an array', ['task']],
    ])('refuses %s', (_label, task) => {
      const { status, body } = refusal(() => readMailTriggerCreate(valid({ task })));
      expect(status).toBe(400);
      expect(body.code).toBe(MAIL_TRIGGER_ERROR_CODES.invalidTask);
    });
  });

  describe('timeZone', () => {
    it.each(['Asia/Taipei', 'Europe/London', 'UTC', 'America/New_York'])('accepts %j', (timeZone) => {
      expect(readMailTriggerCreate(valid({ timeZone })).timeZone).toBe(timeZone);
    });

    it.each([['Mars/Olympus_Mons'], [''], ['x'.repeat(65)], [8], [null]])('refuses %j', (timeZone) => {
      expect(refusal(() => readMailTriggerCreate(valid({ timeZone }))).body.code).toBe(
        MAIL_TRIGGER_ERROR_CODES.invalidTimeZone,
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
      expect(refusal(() => readMailTriggerCreate(valid({ target }))).body.code).toBe(
        MAIL_TRIGGER_ERROR_CODES.invalidTarget,
      );
    });

    it('a workflow id that is not a uuid answers 404 workflow_not_found', () => {
      const { status, body } = refusal(() =>
        readMailTriggerCreate(valid({ target: { kind: 'workflow', workflowId: 'not-a-uuid' } })),
      );
      expect(status).toBe(404);
      expect(body.code).toBe(MAIL_TRIGGER_ERROR_CODES.workflowNotFound);
    });
  });

  it('enabled must be a boolean', () => {
    expect(refusal(() => readMailTriggerCreate(valid({ enabled: 'true' }))).body.code).toBe(
      MAIL_TRIGGER_ERROR_CODES.invalidEnabled,
    );
    expect(refusal(() => readMailTriggerPatch({ enabled: 1 })).body.code).toBe(
      MAIL_TRIGGER_ERROR_CODES.invalidEnabled,
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
      'mailState',
      'calendarState',
      'leadMinutes',
      'titleFilter',
      'timeOfDay',
      'days',
      'sender_filter',
      'bodyFilter',
      'toFilter',
      'folder',
    ])('%s', (field) => {
      const { status, body } = refusal(() => readMailTriggerCreate(valid({ [field]: `${MARKER}` })));
      expect(status).toBe(400);
      expect(body).toMatchObject({ code: MAIL_TRIGGER_ERROR_CODES.unknownField, field });
      expect(JSON.stringify(body)).not.toContain(MARKER);
      expect(refusal(() => readMailTriggerPatch({ [field]: 1 })).body.code).toBe(
        MAIL_TRIGGER_ERROR_CODES.unknownField,
      );
    });
  });

  describe('readMailTriggerPatch', () => {
    it('reads only the fields sent', () => {
      expect(readMailTriggerPatch({ senderFilter: '@Example.org' })).toEqual({ senderFilter: '@example.org' });
      expect(readMailTriggerPatch({ subjectFilter: ' Report ', enabled: false })).toEqual({
        subjectFilter: 'Report',
        enabled: false,
      });
      expect(readMailTriggerPatch({ task: ' t ', timeZone: 'UTC' })).toEqual({ task: 't', timeZone: 'UTC' });
    });

    it('refuses an empty change', () => {
      expect(refusal(() => readMailTriggerPatch({})).body.code).toBe(MAIL_TRIGGER_ERROR_CODES.emptyChange);
      expect(refusal(() => readMailTriggerPatch({ task: undefined })).body.code).toBe(
        MAIL_TRIGGER_ERROR_CODES.emptyChange,
      );
    });

    it('the sender cannot be cleared: null and blank are refused on change too', () => {
      expect(refusal(() => readMailTriggerPatch({ senderFilter: null })).body.code).toBe(
        MAIL_TRIGGER_ERROR_CODES.invalidSender,
      );
      expect(refusal(() => readMailTriggerPatch({ senderFilter: '  ' })).body.code).toBe(
        MAIL_TRIGGER_ERROR_CODES.invalidSender,
      );
    });

    it('applies the same field rules as create', () => {
      expect(refusal(() => readMailTriggerPatch({ subjectFilter: 'z'.repeat(101) })).body.code).toBe(
        MAIL_TRIGGER_ERROR_CODES.invalidSubject,
      );
      expect(refusal(() => readMailTriggerPatch({ task: '' })).body.code).toBe(MAIL_TRIGGER_ERROR_CODES.invalidTask);
      expect(refusal(() => readMailTriggerPatch({ timeZone: 'Bad/Zone' })).body.code).toBe(
        MAIL_TRIGGER_ERROR_CODES.invalidTimeZone,
      );
    });
  });
});
