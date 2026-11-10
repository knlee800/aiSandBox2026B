export const MAIL_TIMEOUT_MS = 20_000;
export const CALENDAR_TIMEOUT_MS = 10_000;
export const MAX_CALENDAR_BYTES = 2 * 1024 * 1024;
export const MAX_TEXT_CHARS = 300;
export const MAX_MAIL_MESSAGES = 25;
export const MAX_RESULT_CHARS = 32_000;
export const IMAP_PORT = 993;

/** CONN-03: each mail body excerpt is at most this many characters (code points). */
export const MAX_BODY_CHARS = 800;
/** CONN-03: at most this many bytes of the chosen body part are fetched (BODY.PEEK partial). */
export const MAX_BODY_FETCH_BYTES = 16_384;
/** CONN-03: when the mail result is over the cap, every body is shortened to these lengths in turn before a message is dropped. */
export const BODY_SHRINK_STEPS = [400, 200, 0] as const;
/**
 * CONN-03: the mail result must also stay under the gateway's 64 KB connector cap
 * (CONNECTOR_MAX_RESULT_BYTES). Chinese text is three bytes a character in UTF-8, so
 * 32,000 characters alone could be over it.
 */
export const MAX_RESULT_BYTES = 60 * 1024;

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

function fitsResultCap(value: unknown): boolean {
  const json = JSON.stringify(value);
  return json.length <= MAX_RESULT_CHARS && Buffer.byteLength(json, 'utf8') <= MAX_RESULT_BYTES;
}

/**
 * CONN-03 (D7): bodies are shortened before any item is dropped. Every body is cut to
 * 400, then 200, then 0 characters; only then are items dropped from the end, as
 * capJsonItems does. The cap is MAX_RESULT_CHARS characters and MAX_RESULT_BYTES bytes.
 */
export function capJsonItemsBodyFirst<T>(
  items: T[],
  wrapper: (kept: T[]) => unknown,
  shortenBody: (item: T, maxChars: number) => T,
): T[] {
  let kept = items.slice();
  if (fitsResultCap(wrapper(kept))) {
    return kept;
  }
  for (const maxChars of BODY_SHRINK_STEPS) {
    kept = items.map((item) => shortenBody(item, maxChars));
    if (fitsResultCap(wrapper(kept))) {
      return kept;
    }
  }
  while (kept.length > 1 && !fitsResultCap(wrapper(kept))) {
    kept = kept.slice(0, -1);
  }
  return kept;
}

/** Cuts text at a code point boundary. */
export function cutCodePoints(value: string, maxChars: number): { text: string; cut: boolean } {
  const points = Array.from(value);
  if (points.length <= maxChars) {
    return { text: value, cut: false };
  }
  return { text: points.slice(0, Math.max(0, maxChars)).join('').trimEnd(), cut: true };
}

/* ------------------------------------------------------------------ */
/* CONN-03 body decoding (D5) and HTML to text (D6). No dependency.    */
/* ------------------------------------------------------------------ */

const HEX = /^[0-9A-Fa-f]{2}$/;

/** Quoted-printable (RFC 2045) by hand. A cut escape at the end of a partial fetch is dropped. */
export function decodeQuotedPrintable(raw: Buffer): Buffer {
  const out: number[] = [];
  const length = raw.length;
  for (let index = 0; index < length; index += 1) {
    const byte = raw[index];
    if (byte !== 0x3d) {
      out.push(byte);
      continue;
    }
    // "=" then CRLF or LF (optionally after trailing spaces) is a soft line break.
    let next = index + 1;
    while (next < length && (raw[next] === 0x20 || raw[next] === 0x09)) {
      next += 1;
    }
    if (next < length && raw[next] === 0x0d && raw[next + 1] === 0x0a) {
      index = next + 1;
      continue;
    }
    if (next < length && raw[next] === 0x0a) {
      index = next;
      continue;
    }
    if (next >= length || index + 2 >= length) {
      // "=", "=X" or "=" and spaces at the very end: the partial fetch cut the escape.
      break;
    }
    const hex = String.fromCharCode(raw[index + 1], raw[index + 2]);
    if (HEX.test(hex)) {
      out.push(parseInt(hex, 16));
      index += 2;
      continue;
    }
    out.push(byte);
  }
  return Buffer.from(out);
}

/** Base64 with Node's Buffer. Characters outside the alphabet are ignored; a cut quad is dropped. */
export function decodeBase64(raw: Buffer): Buffer {
  const cleaned = raw.toString('latin1').replace(/[^A-Za-z0-9+/=]/g, '');
  const whole = cleaned.slice(0, cleaned.length - (cleaned.length % 4));
  return Buffer.from(whole, 'base64');
}

export function decodeTransfer(raw: Buffer, encoding: string | undefined): Buffer {
  const name = (encoding || '').trim().toLowerCase();
  if (name === 'quoted-printable') {
    return decodeQuotedPrintable(raw);
  }
  if (name === 'base64') {
    return decodeBase64(raw);
  }
  return raw;
}

/** The charset with Node's TextDecoder; UTF-8 when the charset is unknown. Bad bytes become U+FFFD. */
export function decodeCharset(bytes: Buffer, charset: string | undefined): string {
  const label = (charset || '').trim().toLowerCase();
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(label || 'utf-8', { fatal: false });
  } catch {
    decoder = new TextDecoder('utf-8', { fatal: false });
  }
  return decoder.decode(bytes);
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '\u00A9',
  reg: '\u00AE',
  trade: '\u2122',
  hellip: '\u2026',
  mdash: '\u2014',
  ndash: '\u2013',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201C',
  rdquo: '\u201D',
  bull: '\u2022',
  middot: '\u00B7',
  laquo: '\u00AB',
  raquo: '\u00BB',
  euro: '\u20AC',
  pound: '\u00A3',
  yen: '\u00A5',
  cent: '\u00A2',
  deg: '\u00B0',
  times: '\u00D7',
  zwnj: '',
  zwj: '',
  shy: '',
};

/** U+FFFD, the Unicode replacement character. */
export const REPLACEMENT_CHARACTER = String.fromCharCode(0xfffd);

function codePointText(value: number): string {
  if (!Number.isFinite(value) || value <= 0 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) {
    return REPLACEMENT_CHARACTER;
  }
  return String.fromCodePoint(value);
}

/** One pass, so "&amp;lt;" becomes "&lt;" and not "<". */
export function decodeEntities(value: string): string {
  return value.replace(/&(#[xX][0-9A-Fa-f]{1,6}|#[0-9]{1,7}|[A-Za-z][A-Za-z0-9]{1,31});/g, (match, body: string) => {
    if (body[0] === '#') {
      const hex = body[1] === 'x' || body[1] === 'X';
      return codePointText(parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10));
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named === undefined ? match : named;
  });
}

/** D6: HTML to text. Blocks that are never text are removed, a few tags become line breaks, all other tags go. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
      .replace(/<(script|style|head)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, '')
      .replace(/<br\b[^>]*>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6])\s*>/gi, '\n')
      .replace(/<\/(td|th)\s*>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      // a tag cut by the partial fetch
      .replace(/<[A-Za-z/!][^>]*$/, ''),
  );
}

const BODY_CONTROL_CHARS = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g;
const INVISIBLE_FORMAT_CHARS = /[\u00AD\u034F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

/**
 * D6: control characters go except line breaks, runs of whitespace collapse, empty
 * lines go, and quoted reply lines that start with ">" are dropped.
 */
export function cleanBodyText(value: string): string {
  const normalized = value
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(BODY_CONTROL_CHARS, '')
    .replace(INVISIBLE_FORMAT_CHARS, '');
  return normalized
    .split('\n')
    .map((line) => line.replace(/ {2,}/g, ' ').trim())
    .filter((line) => line.length > 0 && !line.startsWith('>'))
    .join('\n');
}
