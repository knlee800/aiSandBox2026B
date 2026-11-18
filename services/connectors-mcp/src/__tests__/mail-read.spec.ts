import type { MailReadInput, MessageReadClient, UnreadMessage } from '../clients/imap-client';
import {
  MAIL_MESSAGE_NOT_FOUND_MESSAGE,
  MAX_BODY_CHARS,
  MAX_MESSAGE_UID,
  MAX_RESULT_BYTES,
  MAX_RESULT_CHARS,
  MESSAGE_ID_MESSAGE,
  mailMessageId,
} from '../limits';
import { mailReadMessage, readMailReadArguments } from '../tools/mail-read';

const PASSWORD = 's3cret-app-password';
const USERNAME = 'user@example.com';
const ARGS = { preset: 'gmail', username: USERNAME, appPassword: PASSWORD };

function message(id: string, overrides: Partial<UnreadMessage> = {}): UnreadMessage {
  return {
    id,
    from: { name: 'Ada', address: 'ada@example.com' },
    toCount: 1,
    subject: `Subject ${id}`,
    date: '2026-11-09T01:00:00.000Z',
    bodyText: 'hello',
    bodyTruncated: false,
    ...overrides,
  };
}

function clientAnswering(answer: (input: MailReadInput) => UnreadMessage | null, calls: MailReadInput[] = []): MessageReadClient {
  return {
    async readMessage(input) {
      calls.push(input);
      return answer(input);
    },
  };
}

describe('CONN-MAIL-READ-01 messageId', () => {
  it.each([
    ['1', 1],
    ['9', 9],
    ['4601', 4601],
    ['4294967295', MAX_MESSAGE_UID],
  ])('accepts %p as UID %p', (text, uid) => {
    expect(mailMessageId(text)).toBe(uid);
  });

  it.each(['0', '00', '01', '4294967296', '9999999999', '12345678901', '-1', '+1', '1.0', '1e3', ' 1', '1 ', '0x1F', '', 'abc', '١٢', 7, 0, null, undefined, {}, ['1']])(
    'refuses %p with the fixed message',
    (value) => {
      expect(() => mailMessageId(value)).toThrow(MESSAGE_ID_MESSAGE);
    },
  );

  it('reads the mailbox fields as the unread tool does and refuses a missing or bad one', () => {
    expect(readMailReadArguments({ ...ARGS, messageId: '4601' })).toEqual({ ...ARGS, messageId: 4601 });
    expect(() => readMailReadArguments({ ...ARGS, preset: 'other', messageId: '1' })).toThrow(/preset/);
    expect(() => readMailReadArguments({ preset: 'gmail', appPassword: PASSWORD, messageId: '1' })).toThrow('username is required');
    expect(() => readMailReadArguments({ preset: 'gmail', username: USERNAME, messageId: '1' })).toThrow('appPassword is required');
    expect(() => readMailReadArguments(ARGS)).toThrow(MESSAGE_ID_MESSAGE);
    expect(() => readMailReadArguments(null)).toThrow('mail arguments are required');
    expect(() => readMailReadArguments([ARGS])).toThrow('mail arguments are required');
  });
});

describe('CONN-MAIL-READ-01 mail_read_message', () => {
  it('returns { message } with exactly the unread tool fields', async () => {
    const calls: MailReadInput[] = [];
    const found = { ...message('4601'), extra: 'not ours' } as UnreadMessage;
    const result = await mailReadMessage(clientAnswering(() => found, calls), { ...ARGS, messageId: '4601' });
    expect(result).toEqual({ message: message('4601') });
    expect(Object.keys(result)).toEqual(['message']);
    expect(Object.keys(result.message)).toEqual(['id', 'from', 'toCount', 'subject', 'date', 'bodyText', 'bodyTruncated']);
    expect(calls).toEqual([{ ...ARGS, messageId: 4601 }]);
  });

  it('answers the fixed not-found text, with no mail content, when the Inbox has no such message', async () => {
    await expect(mailReadMessage(clientAnswering(() => null), { ...ARGS, messageId: '5' })).rejects.toThrow(
      new Error(MAIL_MESSAGE_NOT_FOUND_MESSAGE),
    );
    // A different message is never passed off as the one asked for.
    const other = mailReadMessage(clientAnswering(() => message('6', { subject: 'Secret plans' })), { ...ARGS, messageId: '5' });
    await expect(other).rejects.toThrow(new Error(MAIL_MESSAGE_NOT_FOUND_MESSAGE));
    expect(MAIL_MESSAGE_NOT_FOUND_MESSAGE).not.toMatch(/secret|subject|5/i);
  });

  it('refuses a malformed id before calling the mailbox', async () => {
    const calls: MailReadInput[] = [];
    await expect(mailReadMessage(clientAnswering(() => message('1'), calls), { ...ARGS, messageId: '01' })).rejects.toThrow(MESSAGE_ID_MESSAGE);
    expect(calls).toHaveLength(0);
  });

  it('keeps the app password and the username out of an error', async () => {
    const failing: MessageReadClient = {
      async readMessage(input) {
        throw new Error(`login failed for ${input.username} with ${input.appPassword}`);
      },
    };
    const error = await mailReadMessage(failing, { ...ARGS, messageId: '7' }).then(() => null, (caught) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).not.toContain(PASSWORD);
    expect(error.message).not.toContain(USERNAME);
    expect(error.message).toContain('[redacted]');
  });

  it('keeps the 800-character excerpt and stays under the same character and byte cap, body first', async () => {
    const zh = (count: number) => '中'.repeat(count);
    const long = message('9', {
      subject: zh(300),
      from: { name: zh(300), address: zh(300) },
      bodyText: zh(MAX_BODY_CHARS),
      bodyTruncated: true,
    });
    const result = await mailReadMessage(clientAnswering(() => long), { ...ARGS, messageId: '9' });
    expect(result.message.bodyText).toBe(zh(MAX_BODY_CHARS));
    const json = JSON.stringify(result);
    expect(json.length).toBeLessThanOrEqual(MAX_RESULT_CHARS);
    expect(Buffer.byteLength(json, 'utf8')).toBeLessThanOrEqual(MAX_RESULT_BYTES);
  });
});
