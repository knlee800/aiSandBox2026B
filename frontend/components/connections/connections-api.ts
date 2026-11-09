import { knowledgeFetch } from '@/components/knowledge/knowledge-api';

export const CONNECTION_PRESETS = ['gmail', 'yahoo', 'icloud'] as const;
export type ConnectionPreset = (typeof CONNECTION_PRESETS)[number];
export type ConnectionKind = 'imap' | 'ical';

export interface MailConnection {
  kind: 'imap';
  preset: ConnectionPreset;
  username: string;
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt: string | null;
}

export interface CalendarConnection {
  kind: 'ical';
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt: string | null;
}

export interface ConnectionsState {
  imap: MailConnection | null;
  ical: CalendarConnection | null;
}

export type ConnectionsFetcher = (path: string, init?: RequestInit) => Promise<Response>;

/** The gateway's fixed 503 text when CONNECTOR_CREDENTIALS_KEY is missing (CONN-02A). */
export const CONNECTIONS_NOT_CONFIGURED_MESSAGE = 'connections are not configured';

/**
 * The gateway's fixed error messages (CONN-02A connector-rules.ts, CONN-02B connector-servers.ts)
 * mapped to keys under connections.errors. The page never shows raw server text.
 */
export const CONNECTION_SERVER_MESSAGE_KEYS: Record<string, string> = {
  'Preset must be gmail, yahoo, or icloud.': 'errors.preset',
  'Username must be an email address.': 'errors.username',
  'App password must be 8 to 64 characters.': 'errors.appPassword',
  'Calendar link must be an https URL with a host name.': 'errors.icalUrl',
  'Connector request is invalid.': 'errors.invalid',
  'Unknown connector.': 'errors.unknownConnector',
  'Request body is too large.': 'errors.bodyTooLarge',
  'Connection not found.': 'errors.notFound',
  'Could not save the connection.': 'errors.saveFailed',
  'Could not delete the connection.': 'errors.deleteFailed',
  'could not reach the mail server': 'errors.mailVerifyFailed',
  'the calendar link could not be read': 'errors.calendarVerifyFailed',
};

export type ConnectionsResult<T> =
  | { type: 'ok'; value: T }
  | { type: 'unauthorized' }
  | { type: 'forbidden' }
  | { type: 'unavailable' }
  | { type: 'failed'; errorKey: string };

export function connectionErrorKey(message: string | null, fallbackKey: string): string {
  if (message && Object.prototype.hasOwnProperty.call(CONNECTION_SERVER_MESSAGE_KEYS, message)) {
    return CONNECTION_SERVER_MESSAGE_KEYS[message];
  }
  return fallbackKey;
}

export function isConnectionPreset(value: unknown): value is ConnectionPreset {
  return value === 'gmail' || value === 'yahoo' || value === 'icloud';
}

async function readServerMessage(response: Response): Promise<string | null> {
  try {
    const payload = (await response.json()) as { message?: unknown };
    if (typeof payload.message === 'string') {
      return payload.message;
    }
    if (Array.isArray(payload.message) && typeof payload.message[0] === 'string') {
      return payload.message[0];
    }
    return null;
  } catch {
    return null;
  }
}

async function failedResult<T>(
  response: Response,
  fallbackKey: string,
): Promise<ConnectionsResult<T>> {
  if (response.status === 401) {
    return { type: 'unauthorized' };
  }
  if (response.status === 403) {
    return { type: 'forbidden' };
  }
  const message = await readServerMessage(response);
  if (response.status === 503 && message === CONNECTIONS_NOT_CONFIGURED_MESSAGE) {
    return { type: 'unavailable' };
  }
  return { type: 'failed', errorKey: connectionErrorKey(message, fallbackKey) };
}

function optionalDate(value: unknown): string | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'string' ? value : undefined;
}

/** Keeps only the public fields; anything else the server might send is dropped. */
export function parseConnection(entry: unknown): MailConnection | CalendarConnection | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const row = entry as Record<string, unknown>;
  const lastVerifiedAt = optionalDate(row.lastVerifiedAt);
  if (
    typeof row.createdAt !== 'string' ||
    typeof row.updatedAt !== 'string' ||
    lastVerifiedAt === undefined
  ) {
    return null;
  }
  if (row.kind === 'imap') {
    if (!isConnectionPreset(row.preset) || typeof row.username !== 'string') {
      return null;
    }
    return {
      kind: 'imap',
      preset: row.preset,
      username: row.username,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastVerifiedAt,
    };
  }
  if (row.kind === 'ical') {
    return {
      kind: 'ical',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastVerifiedAt,
    };
  }
  return null;
}

export function parseConnections(payload: unknown): ConnectionsState | null {
  if (!payload || typeof payload !== 'object' || !('connections' in payload)) {
    return null;
  }
  const list = (payload as { connections?: unknown }).connections;
  if (!Array.isArray(list)) {
    return null;
  }
  const state: ConnectionsState = { imap: null, ical: null };
  for (const entry of list) {
    const parsed = parseConnection(entry);
    if (!parsed) {
      return null;
    }
    if (parsed.kind === 'imap') {
      state.imap = parsed;
    } else {
      state.ical = parsed;
    }
  }
  return state;
}

export async function loadConnections(
  fetcher: ConnectionsFetcher = knowledgeFetch,
): Promise<ConnectionsResult<ConnectionsState>> {
  try {
    const response = await fetcher('/api/connectors');
    if (!response.ok) {
      return failedResult(response, 'loadError');
    }
    const parsed = parseConnections(await response.json());
    return parsed ? { type: 'ok', value: parsed } : { type: 'failed', errorKey: 'loadError' };
  } catch {
    return { type: 'failed', errorKey: 'loadError' };
  }
}

export interface MailConnectInput {
  preset: string;
  username: string;
  appPassword: string;
}

export async function connectMail(
  input: MailConnectInput,
  fetcher: ConnectionsFetcher = knowledgeFetch,
): Promise<ConnectionsResult<MailConnection>> {
  try {
    const response = await fetcher('/api/connectors/imap', {
      method: 'POST',
      body: JSON.stringify({
        preset: input.preset,
        username: input.username.trim(),
        appPassword: input.appPassword,
      }),
    });
    if (!response.ok) {
      return failedResult(response, 'errors.connectFailed');
    }
    const parsed = parseConnection(await response.json());
    return parsed && parsed.kind === 'imap'
      ? { type: 'ok', value: parsed }
      : { type: 'failed', errorKey: 'errors.connectFailed' };
  } catch {
    return { type: 'failed', errorKey: 'errors.network' };
  }
}

export async function connectCalendar(
  url: string,
  fetcher: ConnectionsFetcher = knowledgeFetch,
): Promise<ConnectionsResult<CalendarConnection>> {
  try {
    const response = await fetcher('/api/connectors/ical', {
      method: 'POST',
      body: JSON.stringify({ url: url.trim() }),
    });
    if (!response.ok) {
      return failedResult(response, 'errors.connectFailed');
    }
    const parsed = parseConnection(await response.json());
    return parsed && parsed.kind === 'ical'
      ? { type: 'ok', value: parsed }
      : { type: 'failed', errorKey: 'errors.connectFailed' };
  } catch {
    return { type: 'failed', errorKey: 'errors.network' };
  }
}

export async function verifyConnection(
  kind: ConnectionKind,
  fetcher: ConnectionsFetcher = knowledgeFetch,
): Promise<ConnectionsResult<{ lastVerifiedAt: string }>> {
  const fallbackKey = kind === 'imap' ? 'errors.mailVerifyFailed' : 'errors.calendarVerifyFailed';
  try {
    const response = await fetcher(`/api/connectors/${kind}/verify`, { method: 'POST' });
    if (!response.ok) {
      return failedResult(response, fallbackKey);
    }
    const payload = (await response.json()) as { ok?: unknown; lastVerifiedAt?: unknown };
    if (payload.ok !== true || typeof payload.lastVerifiedAt !== 'string') {
      return { type: 'failed', errorKey: fallbackKey };
    }
    return { type: 'ok', value: { lastVerifiedAt: payload.lastVerifiedAt } };
  } catch {
    return { type: 'failed', errorKey: 'errors.network' };
  }
}

export async function disconnectConnection(
  kind: ConnectionKind,
  fetcher: ConnectionsFetcher = knowledgeFetch,
): Promise<ConnectionsResult<null>> {
  try {
    const response = await fetcher(`/api/connectors/${kind}`, { method: 'DELETE' });
    if (!response.ok) {
      return failedResult(response, 'errors.disconnectFailed');
    }
    return { type: 'ok', value: null };
  } catch {
    return { type: 'failed', errorKey: 'errors.network' };
  }
}

export function formatConnectionDate(value: string, locale: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleString(locale);
}
