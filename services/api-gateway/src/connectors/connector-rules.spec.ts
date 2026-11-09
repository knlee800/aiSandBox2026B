import { BadRequestException } from '@nestjs/common';
import { parseIcalConnection, parseImapConnection } from './connector-input';
import {
  APP_PASSWORD_MESSAGE,
  CONNECTOR_MAX_BODY_BYTES,
  ICAL_URL_MESSAGE,
  IMAP_PRESET_MESSAGE,
  USERNAME_MESSAGE,
  connectorBodyIsTooLarge,
  isConnectorAppPassword,
  isConnectorIcalUrl,
  isConnectorUsername,
  normalizeConnectorAppPassword,
  parsedBodyIsTooLarge,
} from './connector-rules';

describe('connector input checks', () => {
  const email = 'owner@example.com';

  it('accepts the three presets, an email of at most 254 characters, and an app password of 8 to 64 characters after spaces are removed', async () => {
    const address = emailOfLength(254);
    expect(address.length).toBe(254);
    expect(isConnectorUsername(address)).toBe(true);
    expect(isConnectorUsername(`${address}x`)).toBe(false);
    expect(isConnectorUsername(email)).toBe(true);
    expect(isConnectorUsername('not-an-email')).toBe(false);
    expect(isConnectorUsername(' owner@example.com')).toBe(false);
    expect(isConnectorUsername('a@b')).toBe(false);

    expect(isConnectorAppPassword('a'.repeat(8))).toBe(true);
    expect(isConnectorAppPassword('a'.repeat(64))).toBe(true);
    expect(isConnectorAppPassword('a'.repeat(7))).toBe(false);
    expect(isConnectorAppPassword('a'.repeat(65))).toBe(false);
    expect(isConnectorAppPassword('abcd efgh')).toBe(true);
    expect(normalizeConnectorAppPassword('abcd efgh')).toBe('abcdefgh');
    expect(isConnectorAppPassword(' '.repeat(8))).toBe(false);
    expect(isConnectorAppPassword(`${'a'.repeat(64)} `)).toBe(true);
    expect(isConnectorAppPassword(8)).toBe(false);

    for (const preset of ['gmail', 'yahoo', 'icloud'] as const) {
      const parsed = await parseImapConnection({
        preset,
        username: email,
        appPassword: 'ab cd ef gh',
      });
      expect(parsed).toEqual({ preset, username: email, appPassword: 'abcdefgh' });
    }

    const longSecret = `S3cret!${'a'.repeat(60)}`;
    await expectRejected(
      parseImapConnection({ preset: 'hotmail', username: email, appPassword: longSecret }),
      IMAP_PRESET_MESSAGE,
      longSecret,
    );
    await expectRejected(
      parseImapConnection({ preset: 'gmail', username: 'not-an-email', appPassword: longSecret }),
      USERNAME_MESSAGE,
      longSecret,
    );
    await expectRejected(
      parseImapConnection({ preset: 'gmail', username: email, appPassword: longSecret }),
      APP_PASSWORD_MESSAGE,
      longSecret,
    );
  });

  it('accepts an https iCal url with a host name and rejects the other shapes', async () => {
    const prefix = 'https://calendar.example.com/';
    const fitted = prefix + 'a'.repeat(2048 - prefix.length);
    expect(fitted.length).toBe(2048);
    expect(isConnectorIcalUrl(fitted)).toBe(true);
    expect(isConnectorIcalUrl(`${fitted}a`)).toBe(false);
    expect(isConnectorIcalUrl('https://calendar.example.com/feeds/token')).toBe(true);
    expect(isConnectorIcalUrl('https://calendar.example.com:443/feeds/token')).toBe(true);
    expect(isConnectorIcalUrl('https://localhost/feeds/token')).toBe(true);
    expect(isConnectorIcalUrl('http://calendar.example.com/feeds/token')).toBe(false);
    expect(isConnectorIcalUrl('https://user:secret@calendar.example.com/feeds/token')).toBe(false);
    expect(isConnectorIcalUrl('https://user@calendar.example.com/feeds/token')).toBe(false);
    expect(isConnectorIcalUrl('https://127.0.0.1/feeds/token')).toBe(false);
    expect(isConnectorIcalUrl('https://[::1]/feeds/token')).toBe(false);
    expect(isConnectorIcalUrl('https://')).toBe(false);
    expect(isConnectorIcalUrl('https://.')).toBe(false);

    const secretUrl = 'https://user:ical-secret-token@calendar.example.com/feed';
    await expectRejected(parseIcalConnection({ url: secretUrl }), ICAL_URL_MESSAGE, 'ical-secret-token');
    const parsed = await parseIcalConnection({ url: 'https://calendar.example.com/feeds/ical-secret-token' });
    expect(parsed.url).toBe('https://calendar.example.com/feeds/ical-secret-token');
  });

  it('treats a request body over 4 KB as too large and a 4 KB body as allowed', () => {
    expect(CONNECTOR_MAX_BODY_BYTES).toBe(4096);
    expect(connectorBodyIsTooLarge({ headers: { 'content-length': '4096' } })).toBe(false);
    expect(connectorBodyIsTooLarge({ headers: { 'content-length': '4097' } })).toBe(true);
    expect(connectorBodyIsTooLarge({ rawBody: Buffer.alloc(4096) })).toBe(false);
    expect(connectorBodyIsTooLarge({ rawBody: Buffer.alloc(4097) })).toBe(true);
    expect(
      connectorBodyIsTooLarge({
        headers: { 'content-length': '10' },
        rawBody: Buffer.alloc(4097),
      }),
    ).toBe(true);
    expect(connectorBodyIsTooLarge({ headers: { 'content-length': 'nope' } })).toBe(true);
    expect(connectorBodyIsTooLarge({})).toBe(false);
    expect(connectorBodyIsTooLarge({ body: { pad: 'x'.repeat(5000) } })).toBe(true);
    expect(parsedBodyIsTooLarge({ preset: 'gmail' })).toBe(false);
    expect(parsedBodyIsTooLarge({ pad: 'x'.repeat(5000) })).toBe(true);
  });
});

function emailOfLength(length: number): string {
  const local = 'a'.repeat(64);
  const tld = '.com';
  const labels: string[] = [];
  let left = length - local.length - 1 - tld.length;
  while (left > 0) {
    const take = Math.min(63, left);
    labels.push('b'.repeat(take));
    left -= take;
    if (left > 0) left -= 1;
  }
  return `${local}@${labels.join('.')}${tld}`;
}

async function expectRejected(pending: Promise<unknown>, message: string, secret: string): Promise<void> {
  let caught: unknown;
  try {
    await pending;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(BadRequestException);
  const exception = caught as BadRequestException;
  expect(exception.message).toBe(message);
  const rendered = `${exception.message} ${JSON.stringify(exception.getResponse())}`;
  expect(rendered.includes(secret)).toBe(false);
}
