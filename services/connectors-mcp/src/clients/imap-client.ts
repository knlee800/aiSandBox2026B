import {
  ImapFlow,
  type FetchMessageObject,
  type ImapFlowOptions,
  type MessageEnvelopeObject,
  type MessageStructureObject,
} from 'imapflow';

import {
  IMAP_PORT,
  MAIL_PRESETS,
  MAIL_TIMEOUT_MS,
  MAX_BODY_CHARS,
  MAX_BODY_FETCH_BYTES,
  MAX_RECENT_MESSAGES,
  REPLACEMENT_CHARACTER,
  cleanBodyText,
  cutCodePoints,
  decodeCharset,
  decodeTransfer,
  errorText,
  htmlToText,
  limitText,
  mailLimit,
  mailPreset,
  redact,
  stripControls,
  type MailPreset,
} from '../limits';

export interface MailAddress {
  name: string;
  address: string;
}

export interface UnreadMessage {
  id: string;
  from: MailAddress;
  toCount: number;
  subject: string;
  date: string;
  /** CONN-03: a plain-text excerpt of the body, at most MAX_BODY_CHARS characters; empty when there is none. */
  bodyText: string;
  /** CONN-03: true when the excerpt is shorter than the body part. */
  bodyTruncated: boolean;
}

export interface MailListInput {
  preset: MailPreset | string;
  username: string;
  appPassword: string;
  limit?: number;
}

export interface MailboxClient {
  listUnread(input: MailListInput): Promise<UnreadMessage[]>;
}

export interface ImapSessionTarget {
  host: string;
  port: number;
  secure: boolean;
  rejectUnauthorized: boolean;
  doSTARTTLS?: false;
}

export interface MailAuth {
  username: string;
  appPassword: string;
}

export function presetTarget(preset: MailPreset): ImapSessionTarget {
  return {
    host: MAIL_PRESETS[preset],
    port: IMAP_PORT,
    secure: true,
    rejectUnauthorized: true,
  };
}

export function buildImapOptions(target: ImapSessionTarget, auth: MailAuth, timeoutMs: number): ImapFlowOptions {
  return {
    host: target.host,
    port: target.port,
    secure: target.secure,
    doSTARTTLS: target.secure ? undefined : false,
    tls: { rejectUnauthorized: target.rejectUnauthorized },
    auth: { user: auth.username, pass: auth.appPassword },
    logger: false,
    emitLogs: false,
    logRaw: false,
    disableAutoIdle: true,
    disableAutoEnable: true,
    disableCompression: true,
    disableIMAP4rev2: true,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
  };
}

function normalizeDate(value: Date | string | undefined): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  }
  const cleaned = stripControls(value || '').trim();
  if (!cleaned) {
    return '';
  }
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) {
    return limitText(cleaned);
  }
  return parsed.toISOString();
}

export function messageFromEnvelope(uid: number, envelope: MessageEnvelopeObject | undefined): UnreadMessage {
  const from = envelope?.from?.[0];
  const toCount = (envelope?.to || []).filter((entry) => (entry.address || '').includes('@')).length;
  return {
    id: String(uid),
    from: {
      name: limitText(from?.name || ''),
      address: limitText(from?.address || ''),
    },
    toCount,
    subject: limitText(envelope?.subject || ''),
    date: normalizeDate(envelope?.date),
    bodyText: '',
    bodyTruncated: false,
  };
}

/** The body part chosen for a message (D3), with what is needed to decode it. */
export interface BodyPartChoice {
  /** IMAP section, for example "1" or "1.2". */
  part: string;
  html: boolean;
  encoding: string;
  charset: string;
  size: number;
}

function isAttachment(node: MessageStructureObject): boolean {
  if (node.disposition === 'attachment') {
    return true;
  }
  return !!(node.dispositionParameters?.filename || node.parameters?.name);
}

/**
 * D3: the first text/plain part that is not an attachment, else the first text/html
 * part that is not an attachment, else none. Attachments, images and nested messages
 * (message/rfc822, which is not walked into) are ignored.
 */
export function chooseBodyPart(structure: MessageStructureObject | undefined): BodyPartChoice | null {
  if (!structure || typeof structure !== 'object') {
    return null;
  }
  const found: { plain?: MessageStructureObject; html?: MessageStructureObject } = {};
  const walk = (node: MessageStructureObject, depth: number): void => {
    if (found.plain || depth > 16 || !node || typeof node !== 'object') {
      return;
    }
    const type = (node.type || '').toLowerCase();
    if (type.startsWith('multipart/')) {
      for (const child of node.childNodes || []) {
        walk(child, depth + 1);
      }
      return;
    }
    if (type === 'message/rfc822' || isAttachment(node)) {
      return;
    }
    if (type === 'text/plain') {
      found.plain = node;
    } else if (type === 'text/html' && !found.html) {
      found.html = node;
    }
  };
  walk(structure, 0);
  const chosen = found.plain || found.html;
  if (!chosen) {
    return null;
  }
  // A message that is not multipart has no part number; its body is section 1.
  const part = chosen.part || '1';
  if (!/^\d+(\.\d+)*$/.test(part)) {
    return null;
  }
  return {
    part,
    html: !found.plain,
    encoding: chosen.encoding || '',
    charset: chosen.parameters?.charset || '',
    size: typeof chosen.size === 'number' ? chosen.size : 0,
  };
}

/**
 * D5 to D7: decode the fetched bytes (at most MAX_BODY_FETCH_BYTES of the part) into a
 * plain-text excerpt of at most MAX_BODY_CHARS characters.
 */
export function bodyFromPart(
  raw: Buffer,
  choice: BodyPartChoice,
  transferDecoded = false,
): { bodyText: string; bodyTruncated: boolean } {
  const partial = raw.length >= MAX_BODY_FETCH_BYTES || choice.size > raw.length;
  const bytes = transferDecoded ? raw : decodeTransfer(raw, choice.encoding);
  let text = decodeCharset(bytes, choice.charset);
  if (partial) {
    // a character cut by the partial fetch
    let end = text.length;
    while (end > 0 && text[end - 1] === REPLACEMENT_CHARACTER) {
      end -= 1;
    }
    text = text.slice(0, end);
  }
  if (choice.html) {
    text = htmlToText(text);
  }
  const cleaned = cleanBodyText(text);
  const limited = cutCodePoints(cleaned, MAX_BODY_CHARS);
  return {
    bodyText: limited.text,
    bodyTruncated: limited.cut || (partial && limited.text.length > 0),
  };
}

/** D7: shorten one message's body for the result cap. */
export function shortenBody(message: UnreadMessage, maxChars: number): UnreadMessage {
  const body = typeof message.bodyText === 'string' ? message.bodyText : '';
  const limited = cutCodePoints(body, maxChars);
  if (!limited.cut) {
    return message;
  }
  return { ...message, bodyText: limited.text, bodyTruncated: true };
}

/**
 * D2, D4 and D8: one partial BODY.PEEK fetch per distinct part section, for all the
 * messages whose chosen part has that section (a FETCH names the same sections for
 * every message in it). A failed fetch leaves those bodies empty; it never fails the tool.
 */
async function fillBodies(
  client: ImapFlow,
  byUid: Map<number, UnreadMessage>,
  choices: Map<number, BodyPartChoice>,
): Promise<void> {
  const groups = new Map<string, number[]>();
  for (const [uid, choice] of choices) {
    const list = groups.get(choice.part) || [];
    list.push(uid);
    groups.set(choice.part, list);
  }
  for (const [part, uids] of groups) {
    let fetched: FetchMessageObject[];
    try {
      fetched = await client.fetchAll(uids, {
        uid: true,
        bodyParts: [{ key: part, start: 0, maxLength: MAX_BODY_FETCH_BYTES }],
      }, { uid: true });
    } catch {
      // D8: these messages keep their headers with empty bodies.
      continue;
    }
    const key = part.toLowerCase();
    for (const message of fetched) {
      const uid = message.uid;
      const target = typeof uid === 'number' ? byUid.get(uid) : undefined;
      const choice = typeof uid === 'number' ? choices.get(uid) : undefined;
      const raw = message.bodyParts?.get(key);
      if (!target || !choice || !raw) {
        continue;
      }
      try {
        const body = bodyFromPart(raw.subarray(0, MAX_BODY_FETCH_BYTES), choice, !!message.binaryParts?.has(key));
        target.bodyText = body.bodyText;
        target.bodyTruncated = body.bodyTruncated;
      } catch {
        // D8: this message keeps its headers with an empty body.
      }
    }
  }
}

async function closeQuietly(client: ImapFlow): Promise<void> {
  try {
    if (!client.isClosed) {
      await client.logout();
    }
  } catch {
    try {
      client.close();
    } catch {
      // The socket is already gone.
    }
  }
}

export async function fetchUnreadHeaders(
  target: ImapSessionTarget,
  auth: MailAuth,
  limit: number,
  timeoutMs: number,
): Promise<UnreadMessage[]> {
  const bounded = mailLimit(limit);
  const client = new ImapFlow(buildImapOptions(target, auth, timeoutMs));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const secrets = [auth.appPassword, auth.username];
  try {
    const work = (async () => {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX', { readOnly: true });
      try {
        const found = await client.search({ seen: false }, { uid: true });
        if (!Array.isArray(found)) {
          throw new Error('mail search failed');
        }
        const uids = found.slice(-bounded);
        if (uids.length === 0) {
          return [];
        }
        const fetched = await client.fetchAll(uids, {
          uid: true,
          envelope: true,
          bodyStructure: true,
        }, { uid: true });
        const byUid = new Map<number, UnreadMessage>();
        const choices = new Map<number, BodyPartChoice>();
        for (const message of fetched) {
          if (typeof message.uid !== 'number') {
            continue;
          }
          byUid.set(message.uid, messageFromEnvelope(message.uid, message.envelope));
          const choice = chooseBodyPart(message.bodyStructure);
          if (choice) {
            choices.set(message.uid, choice);
          }
        }
        await fillBodies(client, byUid, choices);
        return uids.slice().reverse().map((uid) => byUid.get(uid)).filter((message): message is UnreadMessage => !!message);
      } finally {
        lock.release();
      }
    })();
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        client.close();
        reject(new Error('mail request timed out'));
      }, timeoutMs);
    });
    return await Promise.race([work, timeout]);
  } catch (error) {
    throw new Error(redact(errorText(error), secrets));
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
    await closeQuietly(client);
  }
}

export class ImapMailboxClient implements MailboxClient {
  async listUnread(input: MailListInput): Promise<UnreadMessage[]> {
    const preset = mailPreset(input.preset);
    const limit = mailLimit(input.limit);
    return fetchUnreadHeaders(
      presetTarget(preset),
      { username: input.username, appPassword: input.appPassword },
      limit,
      MAIL_TIMEOUT_MS,
    );
  }
}

/* ------------------------------------------------------------------ */
/* TRIGGER-MAIL-01 S1: the gateway-only recent-mail read.              */
/* ------------------------------------------------------------------ */

/**
 * One unread Inbox message for mail triggers: the server's UID, the sender's
 * address only (lower-case, no display name), the subject and the server's
 * arrival time (INTERNALDATE). No body, no recipients, no Date header.
 */
export interface RecentMessage {
  uid: number;
  fromAddress: string;
  subject: string;
  arrivedAt: string;
}

export interface RecentMailList {
  /** The Inbox's UIDVALIDITY, so a caller can key a message by (uidValidity, uid). */
  uidValidity: number;
  messages: RecentMessage[];
}

export interface RecentMailInput {
  preset: MailPreset | string;
  username: string;
  appPassword: string;
  /** Only messages that arrived at or after this instant are returned. */
  since: Date;
}

export interface RecentMailClient {
  listRecent(input: RecentMailInput): Promise<RecentMailList>;
}

const MAX_UID_VALIDITY = 0xffffffff;

/** UIDVALIDITY is a non-zero 32-bit number (RFC 3501); anything else is refused. */
export function uidValidityOf(mailbox: unknown): number {
  const raw = mailbox && typeof mailbox === 'object' ? (mailbox as { uidValidity?: unknown }).uidValidity : undefined;
  const value = typeof raw === 'bigint' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > MAX_UID_VALIDITY) {
    throw new Error('mail mailbox has no UIDVALIDITY');
  }
  return value;
}

/**
 * IMAP SINCE matches whole days (the arrival date, ignoring time). The search asks
 * from the UTC day before `since`, so no time zone of the server can leave a
 * message out; the exact instant is applied after the fetch.
 */
export function searchDayBefore(since: Date): Date {
  const day = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate()));
  return new Date(day.getTime() - 24 * 60 * 60 * 1000);
}

function arrivalOf(value: Date | string | undefined): Date | null {
  if (value === undefined) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The sender's address only: control characters dropped, trimmed, cut at 300 characters, lower-case. */
export function senderAddressOf(envelope: MessageEnvelopeObject | undefined): string {
  return limitText(stripControls(envelope?.from?.[0]?.address || '').trim()).toLowerCase();
}

/** A fetched message that arrived at or after `since`, or null (no UID, no arrival time, or older). */
export function recentFromFetch(message: FetchMessageObject, since: Date): RecentMessage | null {
  const uid = message.uid;
  if (typeof uid !== 'number' || !Number.isSafeInteger(uid) || uid < 1) {
    return null;
  }
  const arrived = arrivalOf(message.internalDate);
  if (!arrived || arrived.getTime() < since.getTime()) {
    return null;
  }
  return {
    uid,
    fromAddress: senderAddressOf(message.envelope),
    subject: limitText(message.envelope?.subject || ''),
    arrivedAt: arrived.toISOString(),
  };
}

/** Newest arrival first; the same arrival time by the higher UID first. */
export function newestRecentFirst(messages: RecentMessage[]): RecentMessage[] {
  return messages.slice().sort((left, right) => {
    const byTime = Date.parse(right.arrivedAt) - Date.parse(left.arrivedAt);
    return byTime !== 0 ? byTime : right.uid - left.uid;
  });
}

/**
 * TRIGGER-MAIL-01 S1: EXAMINE INBOX (read-only), UID SEARCH UNSEEN SINCE <the day
 * before>, and one UID FETCH of UID, ENVELOPE and INTERNALDATE for the newest
 * MAX_RECENT_MESSAGES UIDs. No BODY section is fetched, so nothing is marked read,
 * and no command changes flags or the mailbox.
 */
export async function fetchRecentHeaders(
  target: ImapSessionTarget,
  auth: MailAuth,
  since: Date,
  timeoutMs: number,
): Promise<RecentMailList> {
  if (!(since instanceof Date) || Number.isNaN(since.getTime())) {
    throw new Error('since must be an ISO time');
  }
  const client = new ImapFlow(buildImapOptions(target, auth, timeoutMs));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const secrets = [auth.appPassword, auth.username];
  try {
    const work = (async (): Promise<RecentMailList> => {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX', { readOnly: true });
      try {
        const uidValidity = uidValidityOf(client.mailbox);
        const found = await client.search({ seen: false, since: searchDayBefore(since) }, { uid: true });
        if (!Array.isArray(found)) {
          throw new Error('mail search failed');
        }
        const uids = found
          .filter((uid) => Number.isSafeInteger(uid) && uid > 0)
          .sort((left, right) => left - right)
          .slice(-MAX_RECENT_MESSAGES);
        if (uids.length === 0) {
          return { uidValidity, messages: [] };
        }
        const fetched = await client.fetchAll(uids, {
          uid: true,
          envelope: true,
          internalDate: true,
        }, { uid: true });
        const messages: RecentMessage[] = [];
        for (const message of fetched) {
          const recent = recentFromFetch(message, since);
          if (recent) {
            messages.push(recent);
          }
        }
        return { uidValidity, messages: newestRecentFirst(messages).slice(0, MAX_RECENT_MESSAGES) };
      } finally {
        lock.release();
      }
    })();
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        client.close();
        reject(new Error('mail request timed out'));
      }, timeoutMs);
    });
    return await Promise.race([work, timeout]);
  } catch (error) {
    throw new Error(redact(errorText(error), secrets));
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
    await closeQuietly(client);
  }
}

export class ImapRecentMailClient implements RecentMailClient {
  async listRecent(input: RecentMailInput): Promise<RecentMailList> {
    const preset = mailPreset(input.preset);
    return fetchRecentHeaders(
      presetTarget(preset),
      { username: input.username, appPassword: input.appPassword },
      input.since,
      MAIL_TIMEOUT_MS,
    );
  }
}
