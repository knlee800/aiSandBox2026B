import { ImapFlow, type ImapFlowOptions, type MessageEnvelopeObject } from 'imapflow';

import {
  IMAP_PORT,
  MAIL_PRESETS,
  MAIL_TIMEOUT_MS,
  errorText,
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
  };
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
        }, { uid: true });
        const byUid = new Map<number, UnreadMessage>();
        for (const message of fetched) {
          if (typeof message.uid !== 'number') {
            continue;
          }
          byUid.set(message.uid, messageFromEnvelope(message.uid, message.envelope));
        }
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
