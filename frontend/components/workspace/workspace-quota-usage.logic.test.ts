import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  parseRetryAfterSeconds,
  shouldRefreshDashboardForChatStatus,
  toQuotaRateLimitGuidance,
} from './workspace-quota-usage.logic';

describe('workspace quota usage logic', () => {
  test('parses numeric Retry-After seconds', () => {
    assert.equal(parseRetryAfterSeconds('30'), 30);
  });

  test('returns null for missing Retry-After', () => {
    assert.equal(parseRetryAfterSeconds(null), null);
    assert.equal(parseRetryAfterSeconds(''), null);
  });

  test('maps 429 with Retry-After to clear guidance', () => {
    const message = toQuotaRateLimitGuidance({
      rawMessage: 'Too many requests',
      fallbackMessage: 'Chat execution failed.',
      statusCode: 429,
      retryAfterHeader: '45',
    });
    assert.equal(message, 'Request rate-limited. Retry in about 45s.');
  });

  test('maps quota-like failures to quota guidance', () => {
    const message = toQuotaRateLimitGuidance({
      rawMessage: 'Quota exceeded for current window',
      fallbackMessage: 'Chat execution failed.',
      statusCode: 403,
    });
    assert.equal(
      message,
      'Request blocked by quota limits. Review usage and try again after quota reset.',
    );
  });

  test('maps usage-limit failures to quota guidance', () => {
    const message = toQuotaRateLimitGuidance({
      rawMessage: 'Usage limit exceeded for current workspace',
      fallbackMessage: 'Chat execution failed.',
      statusCode: 403,
    });
    assert.equal(
      message,
      'Request blocked by quota limits. Review usage and try again after quota reset.',
    );
  });

  test('maps 403 rate-limit wording to rate-limit guidance', () => {
    const message = toQuotaRateLimitGuidance({
      rawMessage: 'Rate limit exceeded for current window',
      fallbackMessage: 'Chat execution failed.',
      statusCode: 403,
    });
    assert.equal(message, 'Request blocked by rate limits. Retry shortly.');
  });

  test('maps generic 403 failures to access guidance', () => {
    const message = toQuotaRateLimitGuidance({
      rawMessage: 'Forbidden resource',
      fallbackMessage: 'Chat execution failed.',
      statusCode: 403,
    });
    assert.equal(
      message,
      'Request blocked by access rules. Check your API key permissions or launch access.',
    );
  });

  test('preserves useful 403 backend messages', () => {
    const message = toQuotaRateLimitGuidance({
      rawMessage: 'API key lacks ai:execute scope.',
      fallbackMessage: 'Chat execution failed.',
      statusCode: 403,
    });
    assert.equal(message, 'API key lacks ai:execute scope.');
  });

  test('returns raw or fallback message for non-quota failures', () => {
    assert.equal(
      toQuotaRateLimitGuidance({
        rawMessage: 'Network timeout',
        fallbackMessage: 'Chat execution failed.',
        statusCode: 500,
      }),
      'Network timeout',
    );

    assert.equal(
      toQuotaRateLimitGuidance({
        rawMessage: '',
        fallbackMessage: 'Chat execution failed.',
        statusCode: 500,
      }),
      'Chat execution failed.',
    );
  });

  test('marks only terminal chat statuses for dashboard refresh', () => {
    assert.equal(shouldRefreshDashboardForChatStatus('queued'), false);
    assert.equal(shouldRefreshDashboardForChatStatus('running'), false);
    assert.equal(shouldRefreshDashboardForChatStatus('completed'), true);
    assert.equal(shouldRefreshDashboardForChatStatus('failed'), true);
    assert.equal(shouldRefreshDashboardForChatStatus('cancelled'), true);
    assert.equal(shouldRefreshDashboardForChatStatus('timeout'), true);
  });
});
