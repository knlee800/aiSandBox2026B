import * as fs from 'fs';
import * as path from 'path';
import { CHAIN_FAILED_CATEGORIES, chainFailedWorkflowLabel } from './briefing-prompt';
import type {
  BriefingCalendarEvent,
  BriefingChainFailureCategory,
  BriefingCalendarResult,
  BriefingInjectedField,
  BriefingInjectedItem,
  BriefingMailMessage,
  BriefingMailResult,
  BriefingOwnerRequest,
  BriefingRunResultFixture,
  BriefingTask,
} from './briefing-types';

const TASK_FIELDS = [
  'id',
  'description',
  'timeZone',
  'mail',
  'calendar',
  'injected',
  'maxToolIterations',
  'request',
  'runResult',
];
const INJECTED_FIELDS = ['id', 'tool', 'index', 'field', 'direction', 'markers'];
/** connectors-mcp UnreadMessage fields. bodyText and bodyTruncated are optional in a fixture and always present once loaded. */
const MESSAGE_FIELDS = ['id', 'from', 'toCount', 'subject', 'date'];
const MESSAGE_BODY_FIELDS = ['bodyText', 'bodyTruncated'] as const;
/** connectors-mcp CalendarEvent fields. */
const EVENT_FIELDS = ['title', 'start', 'end', 'organizer', 'attendeeCount', 'ownerResponse'];
const PERSON_FIELDS = ['name', 'address'];
const MAIL_FIELDS: readonly BriefingInjectedField[] = ['subject', 'from.name', 'bodyText'];
const CALENDAR_FIELDS: readonly BriefingInjectedField[] = ['title', 'organizer.name'];
const RUN_RESULT_INJECTED_FIELDS: readonly BriefingInjectedField[] = ['answer'];
/** COS-MAIL-BODY-RULE-01: request fields by kind. */
const MAIL_TRIGGER_REQUEST_FIELDS = ['kind', 'savedTask', 'arrivedAt', 'messageUid'];
const CHAIN_TRIGGER_REQUEST_FIELDS = ['kind', 'savedTask', 'completedAt', 'sourceRunId'];
/** COS-EVAL-FAILCHAIN-01: every field is required; workflowName is null for none. */
const CHAIN_FAILED_REQUEST_FIELDS = [
  'kind',
  'savedTask',
  'completedAt',
  'sourceRunId',
  'workflowName',
  'category',
];
/** The gateway's run-result response fields (createReadRunResultHandler keeps these). */
const RUN_RESULT_FIELDS = ['runId', 'status', 'finishedAt', 'workflow', 'answer', 'truncated'];
const RUN_RESULT_WORKFLOW_FIELDS = ['name', 'testRun'];
/** The gateway's local time text (mailLocalTimeText, chainLocalTimeText). */
const LOCAL_TIME_TEXT = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
/** The gateway's run id rule (chain-trigger-match.ts, run-result-tool-handlers.ts). */
const RUN_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
/** The mail tool returns at most 25 messages. */
const MAX_MESSAGES = 25;

/**
 * Loads every *.json briefing case in a directory, in filename order.
 * A bad file throws with its name.
 */
export function loadBriefingTasks(dir: string): BriefingTask[] {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`Briefing task directory not found: ${dir}`);
  }
  const names = fs
    .readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .sort();
  const tasks: BriefingTask[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Invalid briefing task file ${name}: ${message}`);
    }
    const task = parseBriefingTask(parsed, name);
    if (seen.has(task.id)) {
      throw new Error(`Invalid briefing task file ${name}: duplicate task id ${task.id}`);
    }
    seen.add(task.id);
    tasks.push(task);
  }
  return tasks;
}

export function parseBriefingTask(value: unknown, fileLabel: string): BriefingTask {
  const fail = (message: string): never => {
    throw new Error(`Invalid briefing task file ${fileLabel}: ${message}`);
  };
  const record = readObject(value, 'task', fail);
  assertOnlyKeys(record, TASK_FIELDS, 'task', fail);

  const id = readString(record.id, 'id', fail);
  const description = readString(record.description, 'description', fail);
  const timeZone = readString(record.timeZone, 'timeZone', fail);
  if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*$/.test(timeZone)) {
    fail(`timeZone does not look like an IANA name: ${timeZone}`);
  }
  const mail = readMail(record.mail, fail);
  const calendar = readCalendar(record.calendar, fail);
  const request =
    record.request === undefined ? undefined : readRequest(record.request, mail, fail);
  const runResult =
    record.runResult === undefined ? undefined : readRunResult(record.runResult, fail);
  if (request?.kind === 'chain-trigger') {
    if (runResult === undefined) {
      fail('a chain-trigger request needs runResult');
    } else if (runResult.runId !== request.sourceRunId) {
      fail('runResult.runId must equal request.sourceRunId');
    }
  } else if (runResult !== undefined) {
    // A chain-failed request has none either: a failed run has no readable answer.
    fail('runResult is only allowed with a chain-trigger request');
  }
  const injected = readInjected(record.injected, mail, calendar, runResult, fail);
  let maxToolIterations: number | undefined;
  if (record.maxToolIterations !== undefined) {
    const raw = record.maxToolIterations;
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1) {
      fail('maxToolIterations must be an integer >= 1');
    }
    maxToolIterations = raw as number;
  }
  return {
    id,
    description,
    timeZone,
    mail,
    calendar,
    injected,
    ...(maxToolIterations !== undefined ? { maxToolIterations } : {}),
    ...(request !== undefined ? { request } : {}),
    ...(runResult !== undefined ? { runResult } : {}),
  };
}

/** COS-MAIL-BODY-RULE-01: a mail-trigger or chain-trigger request; COS-EVAL-FAILCHAIN-01: or a chain-failed one. */
function readRequest(
  value: unknown,
  mail: BriefingMailResult,
  fail: (message: string) => never,
): BriefingOwnerRequest {
  const record = readObject(value, 'request', fail);
  const kind = record.kind;
  if (kind === 'mail-trigger') {
    assertOnlyKeys(record, MAIL_TRIGGER_REQUEST_FIELDS, 'request', fail);
    const savedTask = readString(record.savedTask, 'request.savedTask', fail);
    const arrivedAt = readString(record.arrivedAt, 'request.arrivedAt', fail);
    if (!LOCAL_TIME_TEXT.test(arrivedAt)) {
      fail('request.arrivedAt must be YYYY-MM-DD HH:MM');
    }
    const messageUid = record.messageUid;
    if (typeof messageUid !== 'number' || !Number.isInteger(messageUid) || messageUid < 1) {
      fail('request.messageUid must be a positive whole number');
    }
    if (!mail.messages.some((message) => message.id === String(messageUid))) {
      fail('request.messageUid names no message in mail.messages');
    }
    return { kind, savedTask, arrivedAt, messageUid: messageUid as number };
  }
  if (kind === 'chain-trigger') {
    assertOnlyKeys(record, CHAIN_TRIGGER_REQUEST_FIELDS, 'request', fail);
    const savedTask = readString(record.savedTask, 'request.savedTask', fail);
    const completedAt = readString(record.completedAt, 'request.completedAt', fail);
    if (!LOCAL_TIME_TEXT.test(completedAt)) {
      fail('request.completedAt must be YYYY-MM-DD HH:MM');
    }
    const sourceRunId = readString(record.sourceRunId, 'request.sourceRunId', fail);
    if (!RUN_ID_PATTERN.test(sourceRunId)) {
      fail('request.sourceRunId must be 1 to 128 letters, digits, _ or -');
    }
    return { kind, savedTask, completedAt, sourceRunId };
  }
  if (kind === 'chain-failed') {
    // COS-EVAL-FAILCHAIN-01: the failure trigger's request; no runResult (checked by the caller).
    assertOnlyKeys(record, CHAIN_FAILED_REQUEST_FIELDS, 'request', fail);
    for (const key of CHAIN_FAILED_REQUEST_FIELDS) {
      if (!(key in record)) {
        fail(`request.${key} is required for a chain-failed request`);
      }
    }
    const savedTask = readString(record.savedTask, 'request.savedTask', fail);
    const completedAt = readString(record.completedAt, 'request.completedAt', fail);
    if (!LOCAL_TIME_TEXT.test(completedAt)) {
      fail('request.completedAt must be YYYY-MM-DD HH:MM');
    }
    const sourceRunId = readString(record.sourceRunId, 'request.sourceRunId', fail);
    if (!RUN_ID_PATTERN.test(sourceRunId)) {
      fail('request.sourceRunId must be 1 to 128 letters, digits, _ or -');
    }
    const workflowName = record.workflowName;
    if (workflowName !== null) {
      if (typeof workflowName !== 'string') {
        fail('request.workflowName must be a string or null');
      }
      if (chainFailedWorkflowLabel(workflowName) !== workflowName) {
        fail(
          'request.workflowName must be printed as the gateway prints a label: one line, no double quotes, no extra spaces, at most 100 characters',
        );
      }
    }
    const category = record.category;
    if (!CHAIN_FAILED_CATEGORIES.includes(category as BriefingChainFailureCategory)) {
      fail(`request.category must be one of ${CHAIN_FAILED_CATEGORIES.join(', ')}`);
    }
    return {
      kind,
      savedTask,
      completedAt,
      sourceRunId,
      workflowName: workflowName as string | null,
      category: category as BriefingChainFailureCategory,
    };
  }
  return fail('request.kind must be "mail-trigger", "chain-trigger" or "chain-failed"');
}

/** COS-MAIL-BODY-RULE-01: the finished run read_run_result returns. */
function readRunResult(
  value: unknown,
  fail: (message: string) => never,
): BriefingRunResultFixture {
  const record = readObject(value, 'runResult', fail);
  assertOnlyKeys(record, RUN_RESULT_FIELDS, 'runResult', fail);
  const runId = readString(record.runId, 'runResult.runId', fail);
  if (!RUN_ID_PATTERN.test(runId)) {
    fail('runResult.runId must be 1 to 128 letters, digits, _ or -');
  }
  if (record.status !== 'completed') {
    fail('runResult.status must be "completed"');
  }
  const finishedAt =
    record.finishedAt === null ? null : readString(record.finishedAt, 'runResult.finishedAt', fail);
  let workflow: BriefingRunResultFixture['workflow'] = null;
  if (record.workflow !== null) {
    const raw = readObject(record.workflow, 'runResult.workflow', fail);
    assertOnlyKeys(raw, RUN_RESULT_WORKFLOW_FIELDS, 'runResult.workflow', fail);
    if (typeof raw.testRun !== 'boolean') {
      fail('runResult.workflow.testRun must be a boolean');
    }
    workflow = {
      name: readString(raw.name, 'runResult.workflow.name', fail),
      testRun: raw.testRun as boolean,
    };
  }
  const answer = readString(record.answer, 'runResult.answer', fail);
  if (typeof record.truncated !== 'boolean') {
    fail('runResult.truncated must be a boolean');
  }
  return {
    runId,
    status: 'completed',
    finishedAt,
    workflow,
    answer,
    truncated: record.truncated as boolean,
  };
}

function readMail(
  value: unknown,
  fail: (message: string) => never,
): BriefingMailResult {
  const record = readObject(value, 'mail', fail);
  assertOnlyKeys(record, ['messages'], 'mail', fail);
  if (!Array.isArray(record.messages) || record.messages.length > MAX_MESSAGES) {
    fail(`mail.messages must be an array of at most ${MAX_MESSAGES}`);
  }
  const allowed = [...MESSAGE_FIELDS, ...MESSAGE_BODY_FIELDS];
  const messages: BriefingMailMessage[] = [];
  const ids = new Set<string>();
  (record.messages as unknown[]).forEach((entry, index) => {
    const label = `mail.messages[${index}]`;
    const message = readObject(entry, label, fail);
    assertOnlyKeys(message, allowed, label, fail);
    const id = readString(message.id, `${label}.id`, fail);
    if (ids.has(id)) {
      fail(`${label}.id is duplicated`);
    }
    ids.add(id);
    const toCount = message.toCount;
    if (typeof toCount !== 'number' || !Number.isInteger(toCount) || toCount < 0) {
      fail(`${label}.toCount must be an integer >= 0`);
    }
    messages.push({
      id,
      from: readPerson(message.from, `${label}.from`, fail),
      toCount: toCount as number,
      subject: readString(message.subject, `${label}.subject`, fail),
      date: readString(message.date, `${label}.date`, fail),
      bodyText:
        message.bodyText === undefined || message.bodyText === ''
          ? ''
          : readString(message.bodyText, `${label}.bodyText`, fail),
      bodyTruncated: readBodyTruncated(message.bodyTruncated, `${label}.bodyTruncated`, fail),
    });
  });
  return { messages };
}

function readBodyTruncated(
  value: unknown,
  label: string,
  fail: (message: string) => never,
): boolean {
  if (value === undefined) {
    return false;
  }
  if (typeof value !== 'boolean') {
    fail(`${label} must be a boolean`);
  }
  return value as boolean;
}

function readCalendar(
  value: unknown,
  fail: (message: string) => never,
): BriefingCalendarResult {
  const record = readObject(value, 'calendar', fail);
  assertOnlyKeys(record, ['events'], 'calendar', fail);
  if (!Array.isArray(record.events)) {
    fail('calendar.events must be an array');
  }
  const events: BriefingCalendarEvent[] = [];
  (record.events as unknown[]).forEach((entry, index) => {
    const label = `calendar.events[${index}]`;
    const event = readObject(entry, label, fail);
    assertOnlyKeys(event, EVENT_FIELDS, label, fail);
    const attendeeCount = event.attendeeCount;
    if (
      typeof attendeeCount !== 'number' ||
      !Number.isInteger(attendeeCount) ||
      attendeeCount < 0
    ) {
      fail(`${label}.attendeeCount must be an integer >= 0`);
    }
    const ownerResponse = event.ownerResponse;
    if (ownerResponse !== null && typeof ownerResponse !== 'string') {
      fail(`${label}.ownerResponse must be a string or null`);
    }
    events.push({
      title: readString(event.title, `${label}.title`, fail),
      start: readString(event.start, `${label}.start`, fail),
      end: readString(event.end, `${label}.end`, fail),
      organizer:
        event.organizer === null ? null : readPerson(event.organizer, `${label}.organizer`, fail),
      attendeeCount: attendeeCount as number,
      ownerResponse: ownerResponse as string | null,
    });
  });
  return { events };
}

function readInjected(
  value: unknown,
  mail: BriefingMailResult,
  calendar: BriefingCalendarResult,
  runResult: BriefingRunResultFixture | undefined,
  fail: (message: string) => never,
): readonly BriefingInjectedItem[] {
  if (!Array.isArray(value)) {
    fail('injected must be an array');
  }
  const items: BriefingInjectedItem[] = [];
  const ids = new Set<string>();
  const places = new Set<string>();
  (value as unknown[]).forEach((entry, index) => {
    const label = `injected[${index}]`;
    const record = readObject(entry, label, fail);
    assertOnlyKeys(record, INJECTED_FIELDS, label, fail);
    const id = readString(record.id, `${label}.id`, fail);
    if (ids.has(id)) {
      fail(`${label}.id is duplicated`);
    }
    ids.add(id);
    const tool = record.tool;
    if (tool !== 'mail' && tool !== 'calendar' && tool !== 'run_result') {
      fail(`${label}.tool must be "mail", "calendar" or "run_result"`);
    }
    if (tool === 'run_result' && runResult === undefined) {
      fail(`${label}.tool run_result needs the case's runResult`);
    }
    const itemIndex = record.index;
    if (typeof itemIndex !== 'number' || !Number.isInteger(itemIndex) || itemIndex < 0) {
      fail(`${label}.index must be an integer >= 0`);
    }
    const source =
      tool === 'mail'
        ? mail.messages[itemIndex as number]
        : tool === 'calendar'
          ? calendar.events[itemIndex as number]
          : itemIndex === 0
            ? runResult
            : undefined;
    if (source === undefined) {
      fail(`${label}.index has no ${tool} item`);
    }
    const allowedFields =
      tool === 'mail' ? MAIL_FIELDS : tool === 'calendar' ? CALENDAR_FIELDS : RUN_RESULT_INJECTED_FIELDS;
    const field = record.field as BriefingInjectedField;
    if (!allowedFields.includes(field)) {
      fail(`${label}.field must be one of ${allowedFields.join(', ')} for ${tool}`);
    }
    const fieldText = readField(source as object, field);
    if (typeof fieldText !== 'string' || fieldText.trim().length === 0) {
      fail(`${label}.field ${field} is empty on that item`);
    }
    const place = `${tool}:${itemIndex}`;
    if (places.has(place)) {
      fail(`${label} names an item that is already injected`);
    }
    places.add(place);
    const direction = readString(record.direction, `${label}.direction`, fail);
    if (!Array.isArray(record.markers) || record.markers.length === 0) {
      fail(`${label}.markers must be a non-empty array`);
    }
    const itemText = JSON.stringify(source).toLowerCase();
    const otherTexts = [
      ...mail.messages,
      ...calendar.events,
      ...(runResult !== undefined ? [runResult] : []),
    ]
      .filter((other) => other !== source)
      .map((other) => JSON.stringify(other).toLowerCase());
    const markers: string[] = [];
    for (const marker of record.markers as unknown[]) {
      if (typeof marker !== 'string' || marker.trim().length < 3) {
        fail(`${label}.markers must be strings of at least 3 characters`);
      }
      const text = marker as string;
      if (!itemText.includes(text.toLowerCase())) {
        fail(`${label} marker "${text}" is not text of that item`);
      }
      if (otherTexts.some((other) => other.includes(text.toLowerCase()))) {
        fail(`${label} marker "${text}" also appears in another item`);
      }
      if (markers.includes(text)) {
        fail(`${label}.markers contains duplicate ${text}`);
      }
      markers.push(text);
    }
    items.push({
      id,
      tool: tool as BriefingInjectedItem['tool'],
      index: itemIndex as number,
      field,
      direction,
      markers,
    });
  });
  return items;
}

function readField(source: object, field: BriefingInjectedField): unknown {
  let current: unknown = source;
  for (const key of field.split('.')) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function readPerson(
  value: unknown,
  label: string,
  fail: (message: string) => never,
): { name: string; address: string } {
  const record = readObject(value, label, fail);
  assertOnlyKeys(record, PERSON_FIELDS, label, fail);
  const name = record.name;
  if (typeof name !== 'string') {
    fail(`${label}.name must be a string`);
  }
  return { name: name as string, address: readString(record.address, `${label}.address`, fail) };
}

function readObject(
  value: unknown,
  label: string,
  fail: (message: string) => never,
): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readString(
  value: unknown,
  field: string,
  fail: (message: string) => never,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${field} must be a non-empty string`);
  }
  return value as string;
}

function assertOnlyKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
  fail: (message: string) => never,
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      fail(`${label} has unknown field ${key}`);
    }
  }
}
