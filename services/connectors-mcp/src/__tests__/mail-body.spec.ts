import {
  bodyFromPart,
  chooseBodyPart,
  shortenBody,
  type MailboxClient,
  type UnreadMessage,
} from '../clients/imap-client';
import {
  MAX_BODY_CHARS,
  MAX_BODY_FETCH_BYTES,
  MAX_RESULT_BYTES,
  MAX_RESULT_CHARS,
  capJsonItemsBodyFirst,
  cleanBodyText,
  cutCodePoints,
  decodeBase64,
  decodeCharset,
  decodeEntities,
  decodeQuotedPrintable,
  htmlToText,
} from '../limits';
import { mailListUnread } from '../tools/mail-list-unread';

const ARGS = { preset: 'gmail', username: 'user@example.com', appPassword: 's3cret-app-password' };

function message(id: number, overrides: Partial<UnreadMessage> = {}): UnreadMessage {
  return {
    id: String(id),
    from: { name: 'Ada', address: 'ada@example.com' },
    toCount: 1,
    subject: `Subject ${id}`,
    date: '2026-11-09T01:00:00.000Z',
    bodyText: '',
    bodyTruncated: false,
    ...overrides,
  };
}

function clientReturning(messages: UnreadMessage[]): MailboxClient {
  return { listUnread: async () => messages };
}

describe('CONN-03 result cap: bodies are shortened before messages drop', () => {
  type Item = { body: string; pad: string };
  const shorten = (item: Item, maxChars: number): Item => ({ ...item, body: cutCodePoints(item.body, maxChars).text });
  const items = (pad: number): Item[] => Array.from({ length: 10 }, () => ({ body: 'x'.repeat(800), pad: 'p'.repeat(pad) }));
  const wrap = (kept: Item[]) => ({ items: kept });

  it.each([
    [2_000, 800, 10],
    [2_500, 400, 10],
    [2_900, 200, 10],
    [3_100, 0, 10],
    [4_000, 0, 7],
  ])('padding %i: bodies at %i characters, %i items kept', (pad, bodyLength, count) => {
    const kept = capJsonItemsBodyFirst(items(pad), wrap, shorten);
    expect(kept).toHaveLength(count);
    for (const item of kept) {
      expect(item.body).toHaveLength(bodyLength);
    }
    expect(JSON.stringify(wrap(kept)).length).toBeLessThanOrEqual(MAX_RESULT_CHARS);
  });

  it('keeps 25 messages with 800-character bodies under the cap', async () => {
    const messages = Array.from({ length: 25 }, (_, index) => message(index + 1, {
      subject: 'S'.repeat(150),
      from: { name: 'N'.repeat(60), address: `${'a'.repeat(40)}@example.com` },
      bodyText: 'b'.repeat(MAX_BODY_CHARS),
      bodyTruncated: true,
    }));
    const result = await mailListUnread(clientReturning(messages), ARGS);
    expect(result.messages).toHaveLength(25);
    expect(result.messages.every((kept) => kept.bodyText.length === MAX_BODY_CHARS)).toBe(true);
  });

  it('shortens every body, never drops a message, when 25 long bodies are over 32,000 characters', async () => {
    const messages = Array.from({ length: 25 }, (_, index) => message(index + 1, {
      subject: 'S'.repeat(300),
      from: { name: 'N'.repeat(300), address: 'a'.repeat(300) },
      bodyText: 'b'.repeat(MAX_BODY_CHARS),
    }));
    const result = await mailListUnread(clientReturning(messages), ARGS);
    expect(result.messages.map((kept) => kept.id)).toEqual(messages.map((original) => original.id));
    const lengths = new Set(result.messages.map((kept) => kept.bodyText.length));
    expect(lengths.size).toBe(1);
    expect([400, 200]).toContain([...lengths][0]);
    expect(result.messages.every((kept) => kept.bodyTruncated)).toBe(true);
    expect(JSON.stringify(result).length).toBeLessThanOrEqual(MAX_RESULT_CHARS);
  });

  it('also keeps Chinese mail under the byte cap for the gateway, bodies first', async () => {
    const zh = (count: number) => '中'.repeat(count);
    const shortened = await mailListUnread(clientReturning(Array.from({ length: 25 }, (_, index) => message(index + 1, {
      subject: zh(300),
      bodyText: zh(MAX_BODY_CHARS),
    }))), ARGS);
    expect(shortened.messages).toHaveLength(25);
    expect(shortened.messages.every((kept) => kept.bodyText === zh(400) && kept.bodyTruncated)).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(shortened), 'utf8')).toBeLessThanOrEqual(MAX_RESULT_BYTES);

    const dropped = await mailListUnread(clientReturning(Array.from({ length: 25 }, (_, index) => message(index + 1, {
      subject: zh(300),
      from: { name: zh(300), address: zh(300) },
      bodyText: zh(MAX_BODY_CHARS),
    }))), ARGS);
    expect(dropped.messages.length).toBeLessThan(25);
    expect(dropped.messages.length).toBeGreaterThan(0);
    expect(dropped.messages.map((kept) => kept.id)).toEqual(Array.from({ length: dropped.messages.length }, (_, index) => String(index + 1)));
    expect(dropped.messages.every((kept) => kept.bodyText === '' && kept.bodyTruncated)).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(dropped), 'utf8')).toBeLessThanOrEqual(MAX_RESULT_BYTES);
  });

  it('leaves a short body alone and marks a shortened one truncated', () => {
    const short = message(1, { bodyText: 'hello' });
    expect(shortenBody(short, 400)).toBe(short);
    expect(shortenBody(message(2, { bodyText: 'x'.repeat(500) }), 400)).toMatchObject({ bodyText: 'x'.repeat(400), bodyTruncated: true });
    expect(shortenBody(message(3, { bodyText: 'abc' }), 0)).toMatchObject({ bodyText: '', bodyTruncated: true });
  });
});

describe('CONN-03 body decoding without a dependency', () => {
  it('decodes quoted-printable soft breaks and escapes, and drops an escape cut at the end', () => {
    expect(decodeQuotedPrintable(Buffer.from('a=3Db=\r\nc =E4=B8=AD')).toString('utf8')).toBe('a=bc 中');
    expect(decodeQuotedPrintable(Buffer.from('soft=  \nline')).toString('utf8')).toBe('softline');
    expect(decodeQuotedPrintable(Buffer.from('cut =E')).toString('utf8')).toBe('cut ');
    expect(decodeQuotedPrintable(Buffer.from('cut =')).toString('utf8')).toBe('cut ');
    expect(decodeQuotedPrintable(Buffer.from('not =ZZ hex')).toString('utf8')).toBe('not =ZZ hex');
  });

  it('decodes base64 across line breaks and drops a quad cut at the end', () => {
    const encoded = Buffer.from('hello world', 'utf8').toString('base64');
    expect(decodeBase64(Buffer.from(`${encoded.slice(0, 8)}\r\n${encoded.slice(8)}`)).toString('utf8')).toBe('hello world');
    expect(decodeBase64(Buffer.from(encoded.slice(0, 10))).toString('utf8')).toBe('hello ');
  });

  it('decodes the charset with TextDecoder and falls back to UTF-8', () => {
    expect(decodeCharset(Buffer.from([0xa4, 0xa4, 0xa4, 0xe5]), 'big5')).toBe('中文');
    expect(decodeCharset(Buffer.from([0xd6, 0xd0, 0xce, 0xc4]), 'GB2312')).toBe('中文');
    expect(decodeCharset(Buffer.from([0xe9]), 'iso-8859-1')).toBe('é');
    expect(decodeCharset(Buffer.from('中', 'utf8'), 'no-such-charset')).toBe('中');
    expect(decodeCharset(Buffer.from([0x61, 0xff]), '')).toBe('a�');
  });

  it('turns HTML into text', () => {
    expect(htmlToText('<head><title>x</title></head><style>.a{}</style><script>evil()</script><!-- c --><p>One</p><div>Two<br/>Three</div><li>Four</li><span>Fi</span>ve'))
      .toBe('One\nTwo\nThree\nFour\nFive');
    expect(htmlToText('<p>&lt;b&gt; &amp;amp; &#20013; &#x6587; &nbsp;&copy; &unknown;</p>')).toBe('<b> &amp; 中 文  © &unknown;\n');
    expect(htmlToText('text <a href="https://example.com/very-long')).toBe('text ');
    expect(htmlToText('ok <script>never closed')).toBe('ok ');
  });

  it('cleans text: controls go, whitespace collapses, quoted reply lines are dropped', () => {
    expect(cleanBodyText('  Hello\u0007\tthere \u200B\r\n\r\n\r\n> quoted\r\n   >also quoted\r\nBye\u00A0 now  ')).toBe('Hello there\nBye now');
  });

  it('cuts at a code point boundary', () => {
    const text = `${'a'.repeat(MAX_BODY_CHARS - 1)}😀😀`;
    const cut = cutCodePoints(text, MAX_BODY_CHARS);
    expect(cut.cut).toBe(true);
    expect(Array.from(cut.text)).toHaveLength(MAX_BODY_CHARS);
    expect(cut.text.endsWith('😀')).toBe(true);
    expect(/[\uD800-\uDBFF]$/.test(cut.text)).toBe(false);
  });

  it('drops a character cut by the partial fetch and marks the excerpt truncated', () => {
    const bytes = Buffer.concat([Buffer.from('a'.repeat(MAX_BODY_FETCH_BYTES - 1)), Buffer.from('中', 'utf8').subarray(0, 1)]);
    const body = bodyFromPart(bytes, { part: '1', html: false, encoding: '8bit', charset: 'utf-8', size: 50_000 });
    expect(body.bodyText).toBe('a'.repeat(MAX_BODY_CHARS));
    expect(body.bodyTruncated).toBe(true);
    const whole = bodyFromPart(Buffer.from('short'), { part: '1', html: false, encoding: '7bit', charset: 'utf-8', size: 5 });
    expect(whole).toEqual({ bodyText: 'short', bodyTruncated: false });
  });
});

describe('CONN-03 body part choice', () => {
  it('prefers text/plain, falls back to text/html, and ignores attachments, images and nested messages', () => {
    expect(chooseBodyPart({ type: 'text/plain', parameters: { charset: 'utf-8' }, encoding: 'quoted-printable', size: 10 }))
      .toEqual({ part: '1', html: false, encoding: 'quoted-printable', charset: 'utf-8', size: 10 });
    expect(chooseBodyPart({ type: 'text/html', size: 3 })).toMatchObject({ part: '1', html: true });
    expect(chooseBodyPart({
      type: 'multipart/mixed',
      childNodes: [
        { part: '1', type: 'text/plain', disposition: 'attachment', dispositionParameters: { filename: 'a.txt' } },
        { part: '2', type: 'message/rfc822', childNodes: [{ part: '2', type: 'text/plain' }] },
        { part: '3', type: 'text/html' },
        { part: '4', type: 'multipart/alternative', childNodes: [{ part: '4.1', type: 'text/plain' }, { part: '4.2', type: 'text/html' }] },
      ],
    })).toMatchObject({ part: '4.1', html: false });
    expect(chooseBodyPart({
      type: 'multipart/mixed',
      childNodes: [{ part: '1', type: 'image/png' }, { part: '2', type: 'text/html', parameters: { name: 'page.html' } }],
    })).toBeNull();
    expect(chooseBodyPart(undefined)).toBeNull();
  });
});
