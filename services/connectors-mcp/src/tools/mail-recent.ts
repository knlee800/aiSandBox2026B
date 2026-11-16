import {
  ImapRecentMailClient,
  type RecentMailClient,
  type RecentMailInput,
  type RecentMessage,
} from '../clients/imap-client';
import {
  MAX_RECENT_MESSAGES,
  RECENT_MAIL_MAX_LOOKBACK_MS,
  capJsonItems,
  errorText,
  mailPreset,
  redact,
  requiredString,
} from '../limits';

/**
 * TRIGGER-MAIL-01 S1: the gateway-only recent-mail read for mail triggers. The
 * gateway never offers this tool to a model or a workflow; it calls it itself, as
 * the owner. It returns the Inbox's UIDVALIDITY and, for the newest unread messages
 * that arrived at or after `since`, the UID, the sender's address, the subject and
 * the arrival time only.
 */
export interface MailRecentResult {
  uidValidity: number;
  messages: RecentMessage[];
}

/** An ISO 8601 instant with a date, a time and a zone (Z or an offset). */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** `since` is an ISO instant, not after `now` and at most 2 hours before it. */
export function readSince(value: unknown, now: Date): Date {
  if (typeof value !== 'string' || !ISO_INSTANT.test(value)) {
    throw new Error('since must be an ISO time');
  }
  const since = new Date(value);
  if (Number.isNaN(since.getTime())) {
    throw new Error('since must be an ISO time');
  }
  if (since.getTime() > now.getTime()) {
    throw new Error('since must not be in the future');
  }
  if (now.getTime() - since.getTime() > RECENT_MAIL_MAX_LOOKBACK_MS) {
    throw new Error('since must be at most 2 hours ago');
  }
  return since;
}

export function readRecentMailArguments(raw: unknown, now: Date): RecentMailInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('mail arguments are required');
  }
  const args = raw as Record<string, unknown>;
  const preset = mailPreset(args.preset);
  const username = requiredString(args.username, 'username');
  const appPassword = requiredString(args.appPassword, 'appPassword');
  const since = readSince(args.since, now);
  return { preset, username, appPassword, since };
}

/** Keeps exactly uid, fromAddress, subject and arrivedAt of each message. */
function onlyRecentFields(message: RecentMessage): RecentMessage {
  return {
    uid: message.uid,
    fromAddress: message.fromAddress,
    subject: message.subject,
    arrivedAt: message.arrivedAt,
  };
}

export async function mailListRecent(
  client: RecentMailClient,
  raw: unknown,
  now: () => Date = () => new Date(),
): Promise<MailRecentResult> {
  const args = readRecentMailArguments(raw, now());
  try {
    const listed = await client.listRecent(args);
    const since = args.since.getTime();
    const messages = listed.messages
      .filter((message) => Date.parse(message.arrivedAt) >= since)
      .slice(0, MAX_RECENT_MESSAGES)
      .map(onlyRecentFields);
    const uidValidity = listed.uidValidity;
    return {
      uidValidity,
      messages: capJsonItems(messages, (kept) => ({ uidValidity, messages: kept })),
    };
  } catch (error) {
    throw new Error(redact(errorText(error), [args.appPassword, args.username]));
  }
}

export function defaultRecentMailClient(): RecentMailClient {
  return new ImapRecentMailClient();
}
