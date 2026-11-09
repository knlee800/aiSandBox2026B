import { createDecipheriv, randomBytes } from 'crypto';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  CONNECTOR_CREDENTIALS_UNAVAILABLE_MESSAGE,
  ConnectorDecryptError,
  assertConnectorCredentialsConfigured,
  decryptConnectorSecret,
  encryptConnectorSecret,
} from './connector-crypto';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const PLAINTEXT = 'S3cret!Pass';
const KEY = randomBytes(32).toString('base64');

describe('connector credentials crypto', () => {
  const original = process.env.CONNECTOR_CREDENTIALS_KEY;

  beforeEach(() => {
    process.env.CONNECTOR_CREDENTIALS_KEY = KEY;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.CONNECTOR_CREDENTIALS_KEY;
    else process.env.CONNECTOR_CREDENTIALS_KEY = original;
  });

  it('encrypts with AES-256-GCM, a fresh 12-byte IV, and AAD connector:v1:<userId>:<kind>', () => {
    const first = encryptConnectorSecret(USER, 'imap', PLAINTEXT);
    const second = encryptConnectorSecret(USER, 'imap', PLAINTEXT);

    expect(first).not.toBe(second);
    expect(first.split('.')[1]).not.toBe(second.split('.')[1]);
    expect(openWithAad(first, USER, 'imap', KEY)).toBe(PLAINTEXT);
    expect(openWithAad(second, USER, 'imap', KEY)).toBe(PLAINTEXT);
    expect(decryptConnectorSecret(USER, 'imap', first)).toBe(PLAINTEXT);
    expect(() => openWithAad(first, USER, 'imap', KEY, 'connector:v2:')).toThrow();
  });

  it('refuses to decrypt for another user, another kind, or a tampered tag', () => {
    const stored = encryptConnectorSecret(USER, 'imap', PLAINTEXT);

    expect(() => decryptConnectorSecret(OTHER, 'imap', stored)).toThrow(ConnectorDecryptError);
    expect(() => decryptConnectorSecret(USER, 'ical', stored)).toThrow(ConnectorDecryptError);

    const parts = stored.split('.');
    const tag = Buffer.from(parts[2], 'base64url');
    tag[0] ^= 0xff;
    parts[2] = tag.toString('base64url');
    let caught: unknown;
    try {
      decryptConnectorSecret(USER, 'imap', parts.join('.'));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ConnectorDecryptError);
    expect(String(caught).includes(PLAINTEXT)).toBe(false);
    expect(JSON.stringify(caught).includes(PLAINTEXT)).toBe(false);
  });

  it('rejects a missing or invalid credentials key with a fixed message', () => {
    const cases: Array<string | undefined> = [
      undefined,
      '',
      '   \t',
      'not-a-key',
      'bad-key-material',
      randomBytes(31).toString('base64'),
      randomBytes(33).toString('base64'),
      randomBytes(32).toString('base64url'),
    ];

    for (const value of cases) {
      if (value === undefined) delete process.env.CONNECTOR_CREDENTIALS_KEY;
      else process.env.CONNECTOR_CREDENTIALS_KEY = value;
      let caught: unknown;
      try {
        assertConnectorCredentialsConfigured();
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(ServiceUnavailableException);
      const exception = caught as ServiceUnavailableException;
      expect(exception.message).toBe(CONNECTOR_CREDENTIALS_UNAVAILABLE_MESSAGE);
      const rendered = `${exception.message} ${JSON.stringify(exception.getResponse())} ${String(exception)}`;
      const needle = value?.trim();
      if (needle) expect(rendered.includes(needle)).toBe(false);
      expect(rendered.includes(PLAINTEXT)).toBe(false);
    }

    process.env.CONNECTOR_CREDENTIALS_KEY = `\n${KEY}\n`;
    expect(decryptConnectorSecret(USER, 'ical', encryptConnectorSecret(USER, 'ical', PLAINTEXT))).toBe(
      PLAINTEXT,
    );
  });
});

function openWithAad(
  stored: string,
  userId: string,
  kind: string,
  keyBase64: string,
  prefix = 'connector:v1:',
): string {
  const [version, ivPart, tagPart, bodyPart] = stored.split('.');
  expect(version).toBe('v1');
  expect(stored).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  for (const part of [ivPart, tagPart, bodyPart]) {
    expect(part.includes('+')).toBe(false);
    expect(part.includes('/')).toBe(false);
    expect(part.includes('=')).toBe(false);
  }
  const key = Buffer.from(keyBase64, 'base64');
  expect(key).toHaveLength(32);
  const iv = Buffer.from(ivPart, 'base64url');
  const tag = Buffer.from(tagPart, 'base64url');
  expect(iv).toHaveLength(12);
  expect(tag).toHaveLength(16);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(`${prefix}${userId}:${kind}`, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(Buffer.from(bodyPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
