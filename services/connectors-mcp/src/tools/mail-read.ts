import {
  ImapMessageReadClient,
  shortenBody,
  type MailReadInput,
  type MessageReadClient,
  type UnreadMessage,
} from '../clients/imap-client';
import {
  MAIL_MESSAGE_NOT_FOUND_MESSAGE,
  capJsonItemsBodyFirst,
  errorText,
  mailMessageId,
  mailPreset,
  redact,
  requiredString,
} from '../limits';

/**
 * CONN-MAIL-READ-01: one Inbox message by its id (the UID the unread-mail tool
 * returns as id and the mail trigger gives), read or unread, with the unread-mail
 * tool's fields and body excerpt. Nothing is marked read and the mailbox is not
 * changed. An id that is not in the Inbox answers MAIL_MESSAGE_NOT_FOUND_MESSAGE.
 */
export interface MailReadResult {
  message: UnreadMessage;
}

export function readMailReadArguments(raw: unknown): MailReadInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('mail arguments are required');
  }
  const args = raw as Record<string, unknown>;
  const preset = mailPreset(args.preset);
  const username = requiredString(args.username, 'username');
  const appPassword = requiredString(args.appPassword, 'appPassword');
  const messageId = mailMessageId(args.messageId);
  return { preset, username, appPassword, messageId };
}

/** Keeps exactly the unread-mail tool's fields of one message. */
function onlyMessageFields(message: UnreadMessage): UnreadMessage {
  return {
    id: message.id,
    from: { name: message.from.name, address: message.from.address },
    toCount: message.toCount,
    subject: message.subject,
    date: message.date,
    bodyText: message.bodyText,
    bodyTruncated: message.bodyTruncated,
  };
}

export async function mailReadMessage(client: MessageReadClient, raw: unknown): Promise<MailReadResult> {
  const args = readMailReadArguments(raw);
  let found: UnreadMessage | null;
  try {
    found = await client.readMessage(args);
  } catch (error) {
    throw new Error(redact(errorText(error), [args.appPassword, args.username]));
  }
  if (!found || found.id !== String(args.messageId) || !found.from) {
    throw new Error(MAIL_MESSAGE_NOT_FOUND_MESSAGE);
  }
  // The same result cap as the unread-mail tool: the body is shortened first.
  const [message] = capJsonItemsBodyFirst([onlyMessageFields(found)], (kept) => ({ message: kept[0] }), shortenBody);
  return { message };
}

export function defaultMessageReadClient(): MessageReadClient {
  return new ImapMessageReadClient();
}
