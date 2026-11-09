import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';
import { ServiceUnavailableException } from '@nestjs/common';
import { ConnectorKind } from './connector-rules';

export const CONNECTOR_CREDENTIALS_UNAVAILABLE_MESSAGE = 'connections are not configured';

export class ConnectorDecryptError extends Error {
  constructor() {
    super('connector ciphertext could not be decrypted');
    this.name = 'ConnectorDecryptError';
  }
}

/**
 * Read at call time. Missing and invalid keys share one fixed message.
 * The value itself is never copied into the exception.
 */
export function assertConnectorCredentialsConfigured(): void {
  readConnectorCredentialsKey();
}

/** CONN-GRANT-01: label for the grant-token key derived from CONNECTOR_CREDENTIALS_KEY. */
export const CONNECTOR_GRANT_TOKEN_KEY_LABEL = 'connector-grant-token:v1';

/**
 * CONN-GRANT-01: HMAC-SHA256(credentials key bytes, "connector-grant-token:v1").
 * Read at call time with the same checks and fixed 503 as the other helpers,
 * so a missing or invalid key means no grant token can be minted or checked.
 */
export function connectorGrantTokenKey(): Buffer {
  const key = readConnectorCredentialsKey();
  return createHmac('sha256', key).update(CONNECTOR_GRANT_TOKEN_KEY_LABEL, 'utf8').digest();
}

export function encryptConnectorSecret(
  userId: string,
  kind: ConnectorKind,
  plaintext: string,
): string {
  const key = readConnectorCredentialsKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(connectorAad(userId, kind));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptConnectorSecret(
  userId: string,
  kind: ConnectorKind,
  stored: string,
): string {
  const key = readConnectorCredentialsKey();
  const parts = splitCiphertext(stored);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, parts.iv);
    decipher.setAAD(connectorAad(userId, kind));
    decipher.setAuthTag(parts.tag);
    const plain = Buffer.concat([decipher.update(parts.ciphertext), decipher.final()]);
    return plain.toString('utf8');
  } catch (error) {
    if (error instanceof ServiceUnavailableException) {
      throw error;
    }
    throw new ConnectorDecryptError();
  }
}

function connectorAad(userId: string, kind: ConnectorKind): Buffer {
  return Buffer.from(`connector:v1:${userId}:${kind}`, 'utf8');
}

function readConnectorCredentialsKey(): Buffer {
  const raw = process.env.CONNECTOR_CREDENTIALS_KEY;
  if (typeof raw !== 'string') {
    throw new ServiceUnavailableException(CONNECTOR_CREDENTIALS_UNAVAILABLE_MESSAGE);
  }
  const trimmed = raw.trim();
  const key = Buffer.from(trimmed, 'base64');
  if (trimmed.length === 0 || key.length !== 32 || key.toString('base64') !== trimmed) {
    throw new ServiceUnavailableException(CONNECTOR_CREDENTIALS_UNAVAILABLE_MESSAGE);
  }
  return key;
}

function splitCiphertext(stored: string): { iv: Buffer; tag: Buffer; ciphertext: Buffer } {
  const parts = stored.split('.');
  if (
    parts.length !== 4 ||
    parts[0] !== 'v1' ||
    parts.some((part) => part.length === 0 || !/^[A-Za-z0-9_-]+$/.test(part))
  ) {
    throw new ConnectorDecryptError();
  }
  const iv = Buffer.from(parts[1], 'base64url');
  const tag = Buffer.from(parts[2], 'base64url');
  const ciphertext = Buffer.from(parts[3], 'base64url');
  if (iv.length !== 12 || tag.length !== 16) {
    throw new ConnectorDecryptError();
  }
  return { iv, tag, ciphertext };
}
