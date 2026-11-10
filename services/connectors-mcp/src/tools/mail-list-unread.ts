import { ImapMailboxClient, shortenBody, type MailListInput, type MailboxClient, type UnreadMessage } from '../clients/imap-client';
import { capJsonItemsBodyFirst, errorText, mailLimit, mailPreset, redact, requiredString } from '../limits';

export interface MailListResult {
  messages: UnreadMessage[];
}

export function readMailArguments(raw: unknown): MailListInput {
  if (!raw || typeof raw !== 'object') {
    throw new Error('mail arguments are required');
  }
  const args = raw as Record<string, unknown>;
  const preset = mailPreset(args.preset);
  const username = requiredString(args.username, 'username');
  const appPassword = requiredString(args.appPassword, 'appPassword');
  const limit = mailLimit(args.limit);
  return { preset, username, appPassword, limit };
}

export async function mailListUnread(client: MailboxClient, raw: unknown): Promise<MailListResult> {
  const args = readMailArguments(raw);
  try {
    const messages = await client.listUnread(args);
    return {
      // D7: bodies are shortened (800, 400, 200, 0) before any message is dropped.
      messages: capJsonItemsBodyFirst(messages, (kept) => ({ messages: kept }), shortenBody),
    };
  } catch (error) {
    throw new Error(redact(errorText(error), [args.appPassword, args.username]));
  }
}

export function defaultMailboxClient(): MailboxClient {
  return new ImapMailboxClient();
}
