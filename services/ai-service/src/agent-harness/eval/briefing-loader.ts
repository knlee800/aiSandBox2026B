import * as fs from 'fs';
import * as path from 'path';
import type {
  BriefingCalendarEvent,
  BriefingCalendarResult,
  BriefingInjectedField,
  BriefingInjectedItem,
  BriefingMailMessage,
  BriefingMailResult,
  BriefingTask,
} from './briefing-types';

const TASK_FIELDS = [
  'id',
  'description',
  'timeZone',
  'mail',
  'calendar',
  'injected',
  'bodyCase',
  'maxToolIterations',
];
const INJECTED_FIELDS = ['id', 'tool', 'index', 'field', 'direction', 'markers'];
/** connectors-mcp UnreadMessage fields. bodyText only on a CONN-03 body case. */
const MESSAGE_FIELDS = ['id', 'from', 'toCount', 'subject', 'date'];
const MESSAGE_BODY_FIELD = 'bodyText';
/** connectors-mcp CalendarEvent fields. */
const EVENT_FIELDS = ['title', 'start', 'end', 'organizer', 'attendeeCount', 'ownerResponse'];
const PERSON_FIELDS = ['name', 'address'];
const MAIL_FIELDS: readonly BriefingInjectedField[] = ['subject', 'from.name', 'bodyText'];
const CALENDAR_FIELDS: readonly BriefingInjectedField[] = ['title', 'organizer.name'];
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
  let bodyCase: 'CONN-03' | undefined;
  if (record.bodyCase !== undefined) {
    if (record.bodyCase !== 'CONN-03') {
      fail('bodyCase must be "CONN-03" when present');
    }
    bodyCase = 'CONN-03';
  }
  const mail = readMail(record.mail, bodyCase !== undefined, fail);
  const calendar = readCalendar(record.calendar, fail);
  const injected = readInjected(record.injected, mail, calendar, fail);
  const usesBody = injected.some((item) => item.field === 'bodyText');
  if (bodyCase !== undefined && !usesBody) {
    fail('bodyCase "CONN-03" needs an injected item in bodyText');
  }
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
    ...(bodyCase !== undefined ? { bodyCase } : {}),
    ...(maxToolIterations !== undefined ? { maxToolIterations } : {}),
  };
}

function readMail(
  value: unknown,
  allowBody: boolean,
  fail: (message: string) => never,
): BriefingMailResult {
  const record = readObject(value, 'mail', fail);
  assertOnlyKeys(record, ['messages'], 'mail', fail);
  if (!Array.isArray(record.messages) || record.messages.length > MAX_MESSAGES) {
    fail(`mail.messages must be an array of at most ${MAX_MESSAGES}`);
  }
  const allowed = allowBody ? [...MESSAGE_FIELDS, MESSAGE_BODY_FIELD] : MESSAGE_FIELDS;
  const messages: BriefingMailMessage[] = [];
  const ids = new Set<string>();
  (record.messages as unknown[]).forEach((entry, index) => {
    const label = `mail.messages[${index}]`;
    const message = readObject(entry, label, fail);
    if (!allowBody && Object.prototype.hasOwnProperty.call(message, MESSAGE_BODY_FIELD)) {
      fail(`${label}.bodyText is only allowed on a bodyCase "CONN-03" case`);
    }
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
      ...(message.bodyText !== undefined
        ? { bodyText: readString(message.bodyText, `${label}.bodyText`, fail) }
        : {}),
    });
  });
  return { messages };
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
    if (tool !== 'mail' && tool !== 'calendar') {
      fail(`${label}.tool must be "mail" or "calendar"`);
    }
    const itemIndex = record.index;
    if (typeof itemIndex !== 'number' || !Number.isInteger(itemIndex) || itemIndex < 0) {
      fail(`${label}.index must be an integer >= 0`);
    }
    const source =
      tool === 'mail'
        ? mail.messages[itemIndex as number]
        : calendar.events[itemIndex as number];
    if (source === undefined) {
      fail(`${label}.index has no ${tool} item`);
    }
    const allowedFields = tool === 'mail' ? MAIL_FIELDS : CALENDAR_FIELDS;
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
    const otherTexts = [...mail.messages, ...calendar.events]
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
      tool: tool as 'mail' | 'calendar',
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
