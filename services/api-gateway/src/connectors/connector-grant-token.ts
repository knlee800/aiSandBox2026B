import { createHmac, timingSafeEqual } from 'crypto';
import { connectorGrantTokenKey } from './connector-crypto';
import { findAllowlistedTool } from './connector-servers';

/**
 * CONN-GRANT-01: per-job connector grant token.
 *
 * Format: base64url(JSON {"v":1,"executionId","userId","tools":[sorted],"exp"})
 * + "." + base64url(HMAC-SHA256(key, <that base64url string>)).
 * The key is derived from the connector credentials key (connectorGrantTokenKey),
 * so only the gateway can mint or check a token. exp is in epoch seconds.
 * The token is never logged or audited.
 */

export const CONNECTOR_GRANT_TOKEN_VERSION = 1;
export const CONNECTOR_GRANT_TOKEN_TTL_SECONDS = 2 * 60 * 60;
export const CONNECTOR_GRANT_TOKEN_MAX_LENGTH = 2048;
export const CONNECTOR_GRANT_REFUSED_MESSAGE = 'The connector call is not granted.';

const BASE64URL = /^[A-Za-z0-9_-]+$/;

export interface ConnectorGrantTokenClaims {
  readonly v: 1;
  readonly executionId: string;
  readonly userId: string;
  readonly tools: readonly string[];
  readonly exp: number;
}

/** Allowlisted, de-duplicated, sorted connector tool ids. Unknown ids are dropped. */
export function normalizeConnectorToolIds(toolIds: readonly unknown[]): string[] {
  const out = new Set<string>();
  for (const id of toolIds) {
    const tool = findAllowlistedTool(id);
    if (tool) out.add(tool.id);
  }
  return [...out].sort();
}

/** Throws the fixed 503 from connector-crypto when the credentials key is missing or invalid. */
export function mintConnectorGrantToken(input: {
  readonly executionId: string;
  readonly userId: string;
  readonly tools: readonly string[];
  readonly nowMs: number;
}): string {
  const tools = normalizeConnectorToolIds(input.tools);
  if (tools.length === 0 || input.executionId.length === 0 || input.userId.length === 0) {
    throw new Error('connector grant token needs an execution, a user and at least one tool');
  }
  const key = connectorGrantTokenKey();
  const claims = {
    v: CONNECTOR_GRANT_TOKEN_VERSION,
    executionId: input.executionId,
    userId: input.userId,
    tools,
    exp: Math.floor(input.nowMs / 1000) + CONNECTOR_GRANT_TOKEN_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  return `${body}.${sign(key, body)}`;
}

/**
 * True only for a well-formed, correctly signed, unexpired token for this
 * execution and user that lists this tool. Never throws for a bad token.
 * Throws the fixed 503 from connector-crypto when the credentials key is missing or invalid.
 */
export function isConnectorCallGranted(input: {
  readonly grantToken: unknown;
  readonly executionId: unknown;
  readonly userId: unknown;
  readonly toolId: unknown;
  readonly nowMs: number;
}): boolean {
  const key = connectorGrantTokenKey();
  const claims = readSignedClaims(key, input.grantToken);
  if (!claims) return false;
  if (typeof input.executionId !== 'string' || input.executionId.length === 0) return false;
  if (typeof input.userId !== 'string' || input.userId.length === 0) return false;
  if (typeof input.toolId !== 'string' || input.toolId.length === 0) return false;
  if (claims.executionId !== input.executionId) return false;
  if (claims.userId !== input.userId) return false;
  if (!claims.tools.includes(input.toolId)) return false;
  if (claims.exp <= Math.floor(input.nowMs / 1000)) return false;
  return true;
}

function readSignedClaims(key: Buffer, token: unknown): ConnectorGrantTokenClaims | null {
  if (typeof token !== 'string' || token.length === 0 || token.length > CONNECTOR_GRANT_TOKEN_MAX_LENGTH) {
    return null;
  }
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!BASE64URL.test(body) || !BASE64URL.test(signature)) return null;
  const expected = Buffer.from(sign(key, body), 'utf8');
  const actual = Buffer.from(signature, 'utf8');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  return readClaims(parsed);
}

function readClaims(value: unknown): ConnectorGrantTokenClaims | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.v !== CONNECTOR_GRANT_TOKEN_VERSION) return null;
  if (typeof record.executionId !== 'string' || record.executionId.length === 0) return null;
  if (typeof record.userId !== 'string' || record.userId.length === 0) return null;
  if (typeof record.exp !== 'number' || !Number.isSafeInteger(record.exp)) return null;
  if (!Array.isArray(record.tools) || record.tools.length === 0) return null;
  const tools: string[] = [];
  for (const id of record.tools) {
    if (typeof id !== 'string' || !findAllowlistedTool(id)) return null;
    tools.push(id);
  }
  return {
    v: 1,
    executionId: record.executionId,
    userId: record.userId,
    tools,
    exp: record.exp,
  };
}

function sign(key: Buffer, body: string): string {
  return createHmac('sha256', key).update(body, 'utf8').digest('base64url');
}
