import { ServiceUnavailableException } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CONNECTOR_GRANT_TOKEN_TTL_SECONDS,
  isConnectorCallGranted,
  mintConnectorGrantToken,
  normalizeConnectorToolIds,
} from './connector-grant-token';

const KEY = randomBytes(32).toString('base64');
const OWNER = '11111111-1111-4111-8111-111111111111';
const NOW = Date.parse('2026-11-09T08:00:00.000Z');

describe('CONN-GRANT-01 connector grant token', () => {
  const original = process.env.CONNECTOR_CREDENTIALS_KEY;

  beforeEach(() => {
    process.env.CONNECTOR_CREDENTIALS_KEY = KEY;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.CONNECTOR_CREDENTIALS_KEY;
    else process.env.CONNECTOR_CREDENTIALS_KEY = original;
  });

  it('is base64url claims {v,executionId,userId,tools sorted,exp} and an HMAC-SHA256 under the derived key', () => {
    const token = mintConnectorGrantToken({
      executionId: 'exec-1',
      userId: OWNER,
      tools: ['mail_list_unread_metadata', 'calendar_list_today', 'mail_list_unread_metadata'],
      nowMs: NOW,
    });
    const [body, signature] = token.split('.');
    expect(token.split('.')).toHaveLength(2);
    expect(body).toMatch(/^[A-Za-z0-9_-]+$/);
    const json = Buffer.from(body, 'base64url').toString('utf8');
    expect(json).toBe(
      JSON.stringify({
        v: 1,
        executionId: 'exec-1',
        userId: OWNER,
        tools: ['calendar_list_today', 'mail_list_unread_metadata'],
        exp: Math.floor(NOW / 1000) + 2 * 60 * 60,
      }),
    );
    expect(CONNECTOR_GRANT_TOKEN_TTL_SECONDS).toBe(7200);
    const derived = createHmac('sha256', Buffer.from(KEY, 'base64'))
      .update('connector-grant-token:v1', 'utf8')
      .digest();
    expect(signature).toBe(createHmac('sha256', derived).update(body, 'utf8').digest('base64url'));
    // The raw credentials key does not sign tokens.
    expect(signature).not.toBe(
      createHmac('sha256', Buffer.from(KEY, 'base64')).update(body, 'utf8').digest('base64url'),
    );
  });

  it('checks execution, user, tool and expiry', () => {
    const token = mintConnectorGrantToken({
      executionId: 'exec-1',
      userId: OWNER,
      tools: ['mail_list_unread_metadata'],
      nowMs: NOW,
    });
    const base = {
      grantToken: token,
      executionId: 'exec-1',
      userId: OWNER,
      toolId: 'mail_list_unread_metadata',
      nowMs: NOW + 1000,
    };
    expect(isConnectorCallGranted(base)).toBe(true);
    expect(isConnectorCallGranted({ ...base, executionId: 'exec-2' })).toBe(false);
    expect(isConnectorCallGranted({ ...base, userId: '22222222-2222-4222-8222-222222222222' })).toBe(false);
    expect(isConnectorCallGranted({ ...base, toolId: 'calendar_list_today' })).toBe(false);
    expect(isConnectorCallGranted({ ...base, nowMs: NOW + 7200 * 1000 })).toBe(false);
    expect(isConnectorCallGranted({ ...base, nowMs: NOW + 7199 * 1000 })).toBe(true);
    expect(isConnectorCallGranted({ ...base, grantToken: undefined })).toBe(false);
    expect(isConnectorCallGranted({ ...base, grantToken: `${token}x` })).toBe(false);
  });

  it('has no token without a valid credentials key, with the CONN-02A fixed 503', () => {
    delete process.env.CONNECTOR_CREDENTIALS_KEY;
    expect(() =>
      mintConnectorGrantToken({ executionId: 'e', userId: OWNER, tools: ['mail_list_unread_metadata'], nowMs: NOW }),
    ).toThrow(ServiceUnavailableException);
    process.env.CONNECTOR_CREDENTIALS_KEY = 'not-base64-32-bytes';
    expect(() =>
      isConnectorCallGranted({ grantToken: 'a.b', executionId: 'e', userId: OWNER, toolId: 'mail_list_unread_metadata', nowMs: NOW }),
    ).toThrow('connections are not configured');
  });

  it('keeps only allowlisted tool ids and refuses to mint an empty grant', () => {
    expect(normalizeConnectorToolIds(['calendar_list_today', 'evil_tool', 'mail_list_unread_metadata'])).toEqual([
      'calendar_list_today',
      'mail_list_unread_metadata',
    ]);
    expect(() =>
      mintConnectorGrantToken({ executionId: 'e', userId: OWNER, tools: ['evil_tool'], nowMs: NOW }),
    ).toThrow();
  });

  it('is never written to a logger or an audit row by the gateway sources', () => {
    for (const file of [
      'connector-grant-token.ts',
      'internal-connectors.controller.ts',
      join('..', 'orchestration', 'collaboration-connector-grants.ts'),
    ]) {
      const source = readFileSync(join(__dirname, file), 'utf8');
      expect(source).not.toMatch(/logger\.[a-z]+\([^)]*[Tt]oken/);
      expect(source).not.toMatch(/audit[A-Za-z]*\([^)]*[Tt]oken/);
    }
    const service = readFileSync(join(__dirname, '..', 'orchestration', 'orchestration.service.ts'), 'utf8');
    const grantStart = service.indexOf('private async connectorGrantJobFields(');
    const grantEnd = service.indexOf('private withHarnessEntitlementProof<', grantStart);
    const grantBlock = service.slice(grantStart, grantEnd);
    expect(grantStart).toBeGreaterThan(-1);
    expect(grantBlock).toContain('this.logger.warn');
    expect(grantBlock).not.toMatch(/logger\.[a-z]+\([^;]*(connectorGrantToken|fields)/);
  });
});
