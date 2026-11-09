export const MAIL_TIMEOUT_MS = 20_000;
export const CALENDAR_TIMEOUT_MS = 10_000;
export const MAX_CALENDAR_BYTES = 2 * 1024 * 1024;
export const MAX_TEXT_CHARS = 300;
export const MAX_MAIL_MESSAGES = 25;
export const MAX_RESULT_CHARS = 32_000;
export const IMAP_PORT = 993;

export const MAIL_PRESETS = {
  gmail: 'imap.gmail.com',
  yahoo: 'imap.mail.yahoo.com',
  icloud: 'imap.mail.me.com',
} as const;

export type MailPreset = keyof typeof MAIL_PRESETS;

export const FORBIDDEN_IMAP_VERBS = [
  'SELECT',
  'STORE',
  'APPEND',
  'EXPUNGE',
  'COPY',
  'MOVE',
  'DELETE',
  'CREATE',
] as const;

const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;

export function stripControls(value: string): string {
  return value.replace(CONTROL_CHARS, '');
}

export function limitText(value: string, maxChars: number = MAX_TEXT_CHARS): string {
  const stripped = stripControls(value);
  return Array.from(stripped).slice(0, maxChars).join('');
}

export function mailPreset(value: unknown): MailPreset {
  if (value === 'gmail' || value === 'yahoo' || value === 'icloud') {
    return value;
  }
  throw new Error('preset must be gmail, yahoo, or icloud');
}

export function mailLimit(value: unknown): number {
  if (value === undefined) {
    return MAX_MAIL_MESSAGES;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_MAIL_MESSAGES) {
    throw new Error('limit must be an integer from 1 to 25');
  }
  return value;
}

export function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} is required`);
  }
  return value;
}

export function optionalString(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error('optional text must be a string');
  }
  return value;
}

export function optionalNow(value: unknown): Date {
  if (value === undefined) {
    return new Date();
  }
  if (typeof value !== 'string') {
    throw new Error('now must be an ISO time');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('now must be an ISO time');
  }
  return date;
}

export function errorText(error: unknown): string {
  if (error instanceof Error) {
    const extra = error as Error & { response?: unknown; responseText?: unknown };
    const parts = [error.message];
    if (typeof extra.responseText === 'string') {
      parts.push(extra.responseText);
    }
    if (typeof extra.response === 'string') {
      parts.push(extra.response);
    }
    return parts.join(' ');
  }
  return 'request failed';
}

export function redact(message: string, secrets: Array<string | undefined>): string {
  const unique = [...new Set(secrets.filter((secret): secret is string => typeof secret === 'string' && secret.length > 0))];
  unique.sort((left, right) => right.length - left.length);
  let out = message;
  for (const secret of unique) {
    out = out.split(secret).join('[redacted]');
  }
  return out;
}

export function capJsonItems<T>(items: T[], wrapper: (kept: T[]) => unknown): T[] {
  let kept = items.slice();
  while (kept.length > 0 && JSON.stringify(wrapper(kept)).length > MAX_RESULT_CHARS) {
    if (kept.length === 1) {
      break;
    }
    kept = kept.slice(0, -1);
  }
  return kept;
}
