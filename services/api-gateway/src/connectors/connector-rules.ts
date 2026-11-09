import { isEmail } from 'class-validator';

export const CONNECTOR_MAX_BODY_BYTES = 4 * 1024;
export const CONNECTOR_KEY_VERSION = 1;

export const IMAP_PRESETS = ['gmail', 'yahoo', 'icloud'] as const;
export type ImapPreset = (typeof IMAP_PRESETS)[number];

export const CONNECTOR_KINDS = ['imap', 'ical'] as const;
export type ConnectorKind = (typeof CONNECTOR_KINDS)[number];

export const IMAP_PRESET_MESSAGE = 'Preset must be gmail, yahoo, or icloud.';
export const USERNAME_MESSAGE = 'Username must be an email address.';
export const APP_PASSWORD_MESSAGE = 'App password must be 8 to 64 characters.';
export const ICAL_URL_MESSAGE = 'Calendar link must be an https URL with a host name.';
export const INVALID_CONNECTOR_MESSAGE = 'Connector request is invalid.';
export const UNKNOWN_CONNECTOR_MESSAGE = 'Unknown connector.';
export const BODY_TOO_LARGE_MESSAGE = 'Request body is too large.';
export const CONNECTION_NOT_FOUND_MESSAGE = 'Connection not found.';
export const SAVE_FAILED_MESSAGE = 'Could not save the connection.';
export const DELETE_FAILED_MESSAGE = 'Could not delete the connection.';
export const LIST_FAILED_MESSAGE = 'Could not list connections.';

const ICAL_URL_MAX_LENGTH = 2048;
const USERNAME_MAX_LENGTH = 254;

export interface ConnectorHttpRequest {
  headers?: { [key: string]: string | string[] | undefined };
  rawBody?: unknown;
  body?: unknown;
}

export function isImapPreset(value: unknown): value is ImapPreset {
  return value === 'gmail' || value === 'yahoo' || value === 'icloud';
}

export function isConnectorKind(value: unknown): value is ConnectorKind {
  return value === 'imap' || value === 'ical';
}

export function isConnectorUsername(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > USERNAME_MAX_LENGTH) return false;
  return isEmail(value, {
    allow_display_name: false,
    require_tld: true,
    allow_ip_domain: false,
    ignore_max_length: false,
  });
}

export function normalizeConnectorAppPassword(value: string): string {
  return value.replace(/ /g, '');
}

export function isConnectorAppPassword(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = normalizeConnectorAppPassword(value);
  return normalized.length >= 8 && normalized.length <= 64;
}

export function isConnectorHostName(hostname: string): boolean {
  if (!hostname || hostname.length > 253 || hostname.includes(':')) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return false;
  const labels = hostname.split('.');
  return labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
}

export function isBlockedConnectorHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.+$/, '');
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  );
}

export function isConnectorIcalUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > ICAL_URL_MAX_LENGTH) return false;
  if (/\s/.test(value)) return false;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.username !== '' || parsed.password !== '') return false;
  if (!isConnectorHostName(parsed.hostname)) return false;
  return !isBlockedConnectorHostname(parsed.hostname);
}

export function connectorBodyIsTooLarge(request: ConnectorHttpRequest): boolean {
  const raw = Buffer.isBuffer(request.rawBody) ? request.rawBody.length : 0;
  const declared = declaredContentLength(request.headers?.['content-length']);
  const parsed = jsonByteLength(request.body);
  return (
    raw > CONNECTOR_MAX_BODY_BYTES ||
    declared > CONNECTOR_MAX_BODY_BYTES ||
    parsed > CONNECTOR_MAX_BODY_BYTES
  );
}

export function parsedBodyIsTooLarge(body: unknown): boolean {
  return jsonByteLength(body) > CONNECTOR_MAX_BODY_BYTES;
}

function declaredContentLength(header: string | string[] | undefined): number {
  if (Array.isArray(header)) {
    if (header.length === 0) return 0;
    return Math.max(...header.map((value) => oneContentLength(value)));
  }
  return oneContentLength(header);
}

function oneContentLength(value: string | undefined): number {
  if (value === undefined || value === '') return 0;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return Number.POSITIVE_INFINITY;
  return Number(trimmed);
}

function jsonByteLength(body: unknown): number {
  if (body === undefined || body === null) return 0;
  try {
    const json = typeof body === 'string' ? body : JSON.stringify(body);
    if (typeof json !== 'string') return Number.POSITIVE_INFINITY;
    return Buffer.byteLength(json, 'utf8');
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
