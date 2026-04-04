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
