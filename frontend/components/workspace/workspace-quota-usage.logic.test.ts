import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import enMessages from '../../messages/en.json';
import zhCnMessages from '../../messages/zh-CN.json';
import zhTwMessages from '../../messages/zh-TW.json';
import {
  PROVIDER_KEY_MISSING_ERROR_CODE,
  parseRetryAfterSeconds,
  readExecutionStatusError,
  shouldRefreshDashboardForChatStatus,
  toQuotaRateLimitGuidance,
  type QuotaRateLimitGuidanceCopies,
} from './workspace-quota-usage.logic';

const copies: QuotaRateLimitGuidanceCopies = {
  dailyCreditOwn: enMessages.ai.dailyCreditLimitOwn,
  dailyCreditPlatform: enMessages.ai.dailyCreditLimitPlatform,
  dailyTokenWithTime: enMessages.ai.dailyTokenLimitWithTime,
  dailyTokenTomorrow: enMessages.ai.dailyTokenLimitTomorrow,
  rateLimitWithSeconds: enMessages.ai.rateLimitRetrySeconds,
  rateLimitShortly: enMessages.ai.rateLimitRetryShortly,
  quota: enMessages.ai.quotaLimitGuidance,
  accessRules: enMessages.ai.accessRulesGuidance,
  providerUsageLimit: enMessages.ai.providerUsageLimit,
  providerKeyMissing: enMessages.ai.providerKeyMissing,
};

const base = {
  fallbackMessage: 'Chat execution failed.',
  copies,
};

describe('workspace quota usage logic', () => {
  test('parses numeric Retry-After seconds', () => {
    assert.equal(parseRetryAfterSeconds('30'), 30);
  });

  test('returns null for missing Retry-After', () => {
    assert.equal(parseRetryAfterSeconds(null), null);
    assert.equal(parseRetryAfterSeconds(''), null);
  });

  test('maps 429 with Retry-After to the per-minute message', () => {
    const message = toQuotaRateLimitGuidance({
      ...base,
      rawMessage: 'Too many requests',
      statusCode: 429,
      retryAfterHeader: '45',
    });
    assert.equal(message, 'Too many requests. Try again in about 45 seconds.');
  });

  test('maps a 429 without Retry-After to the shortly message', () => {
    const message = toQuotaRateLimitGuidance({
      ...base,
      rawMessage: 'Too many requests',
      statusCode: 429,
    });
    assert.equal(message, 'Too many requests. Try again shortly.');
  });

  test('maps an own daily credit cap from cap, not from the message text', () => {
    const message = toQuotaRateLimitGuidance({
      ...base,
      rawMessage: 'Daily credit limit reached',
      statusCode: 429,
      retryAfterHeader: '30',
      payload: {
        statusCode: 429,
        message: 'Daily credit limit reached',
        error: 'Too Many Requests',
        cap: 'user',
      },
    });
    assert.equal(
      message,
      "You've used today's credit limit. Runs start again after midnight UTC.",
    );
  });

  test('maps a platform daily credit cap from cap', () => {
    const message = toQuotaRateLimitGuidance({
      ...base,
      rawMessage: 'Daily credit limit reached',
      statusCode: 429,
      payload: {
        statusCode: 429,
        message: 'Daily credit limit reached',
        error: 'Too Many Requests',
        cap: 'platform',
      },
    });
    assert.equal(
      message,
      'Runs are paused for today because the daily platform limit was reached. They start again after midnight UTC.',
    );
  });

  test('a 429 with no cap is not treated as a daily credit limit', () => {
    const message = toQuotaRateLimitGuidance({
      ...base,
      rawMessage: 'Daily credit limit reached',
      statusCode: 429,
      payload: {
        statusCode: 429,
        message: 'Daily credit limit reached',
        error: 'Too Many Requests',
      },
    });
    assert.equal(message, 'Too many requests. Try again shortly.');
  });

  test('an unknown cap falls through to the per-minute message', () => {
    const message = toQuotaRateLimitGuidance({
      ...base,
      rawMessage: 'Daily credit limit reached',
      statusCode: 429,
      payload: { cap: 'account' },
    });
    assert.equal(message, 'Too many requests. Try again shortly.');
  });

  test('maps a daily token limit with a valid reset_at in the user locale', () => {
    const resetAt = '2026-02-24T12:00:00.000Z';
    const message = toQuotaRateLimitGuidance({
      ...base,
      rawMessage: 'Token quota exceeded',
      statusCode: 429,
      locale: 'en-US',
      retryAfterHeader: '15',
      payload: {
        statusCode: 429,
        error: 'Quota Exceeded',
        message: 'Token quota exceeded',
        details: {
          quota_type: 'max_tokens_per_24h',
          limit: 100000,
          used: 95000,
          estimated_tokens: 8000,
          reset_at: resetAt,
        },
      },
    });
    const time = new Date(resetAt).toLocaleString('en-US');
    assert.equal(message, `You've reached today's token limit. You can run again after ${time}.`);
  });

  test('maps a daily token limit without reset_at to the tomorrow message', () => {
    const message = toQuotaRateLimitGuidance({
      ...base,
      rawMessage: 'Token quota exceeded',
      statusCode: 429,
      payload: {
        details: {
          quota_type: 'max_tokens_per_24h',
          limit: 100000,
          used: 95000,
        },
      },
    });
    assert.equal(message, "You've reached today's token limit. Try again tomorrow.");
  });

  test('invalid reset_at values use the tomorrow message', () => {
    for (const resetAt of [null, '', '   ', 'not-a-date', 1710000000000]) {
      const message = toQuotaRateLimitGuidance({
        ...base,
        rawMessage: 'Token quota exceeded',
        statusCode: 429,
        payload: {
          details: {
            quota_type: 'max_tokens_per_24h',
            reset_at: resetAt,
          },
        },
      });
      assert.equal(message, "You've reached today's token limit. Try again tomorrow.");
    }
  });

  test('a different quota_type on 429 stays a per-minute limit', () => {
    const message = toQuotaRateLimitGuidance({
      ...base,
      rawMessage: 'Too many requests',
      statusCode: 429,
      payload: {
        details: {
          quota_type: 'max_active_sessions',
          reset_at: '2026-02-24T12:00:00.000Z',
        },
      },
    });
    assert.equal(message, 'Too many requests. Try again shortly.');
  });

  test('maps a 429 quota message with no body fields to quota guidance', () => {
    const message = toQuotaRateLimitGuidance({
      ...base,
      rawMessage: 'Session quota exceeded',
      statusCode: 429,
    });
    assert.equal(
      message,
      'Request blocked by quota limits. Review usage and try again after quota reset.',
    );
  });

  test('cap wins when a 429 body also carries a token quota_type', () => {
    const message = toQuotaRateLimitGuidance({
      ...base,
      rawMessage: 'Token quota exceeded',
      statusCode: 429,
      payload: {
        cap: 'user',
        details: {
          quota_type: 'max_tokens_per_24h',
          reset_at: '2026-02-24T12:00:00.000Z',
        },
      },
    });
    assert.equal(
      message,
      "You've used today's credit limit. Runs start again after midnight UTC.",
    );
  });

  test('maps quota-like failures to quota guidance', () => {
    const message = toQuotaRateLimitGuidance({
      ...base,
      rawMessage: 'Quota exceeded for current window',
      statusCode: 403,
    });
    assert.equal(
      message,
      'Request blocked by quota limits. Review usage and try again after quota reset.',
    );
  });

  test('maps usage-limit failures to quota guidance', () => {
    const message = toQuotaRateLimitGuidance({
      ...base,
      rawMessage: 'Usage limit exceeded for current workspace',
      statusCode: 403,
    });
    assert.equal(
      message,
      'Request blocked by quota limits. Review usage and try again after quota reset.',
    );
  });

  test('maps 403 rate-limit wording to rate-limit guidance', () => {
    const message = toQuotaRateLimitGuidance({
      ...base,
      rawMessage: 'Rate limit exceeded for current window',
      statusCode: 403,
    });
    assert.equal(message, 'Too many requests. Try again shortly.');
  });

  test('maps generic 403 failures to access guidance', () => {
    const message = toQuotaRateLimitGuidance({
      ...base,
      rawMessage: 'Forbidden resource',
      statusCode: 403,
    });
    assert.equal(
      message,
      'Request blocked by access rules. Check your API key permissions or launch access.',
    );
  });

  test('preserves useful 403 backend messages', () => {
    const message = toQuotaRateLimitGuidance({
      ...base,
      rawMessage: 'API key lacks ai:execute scope.',
      statusCode: 403,
    });
    assert.equal(message, 'API key lacks ai:execute scope.');
  });

  test('returns raw or fallback message for non-quota failures', () => {
    assert.equal(
      toQuotaRateLimitGuidance({
        ...base,
        rawMessage: 'Network timeout',
        statusCode: 500,
      }),
      'Network timeout',
    );

    assert.equal(
      toQuotaRateLimitGuidance({
        ...base,
        rawMessage: '',
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

  test('maps the provider usage-limit sentence before quota and rate-limit checks', () => {
    const exact = toQuotaRateLimitGuidance({
      ...base,
      rawMessage: '  AI provider usage limit reached  ',
      statusCode: 400,
    });
    assert.equal(exact, enMessages.ai.providerUsageLimit);
    assert.notEqual(exact, copies.quota);
    assert.notEqual(exact, copies.rateLimitShortly);

    const duringRateLimit = toQuotaRateLimitGuidance({
      ...base,
      rawMessage: 'AI provider usage limit reached',
      statusCode: 429,
      retryAfterHeader: '45',
    });
    assert.equal(duringRateLimit, enMessages.ai.providerUsageLimit);
    assert.notEqual(duringRateLimit, copies.quota);
    assert.notEqual(duringRateLimit, 'Too many requests. Try again in about 45 seconds.');
  });

  test('leaves an unrelated message unchanged', () => {
    const message = toQuotaRateLimitGuidance({
      ...base,
      rawMessage: 'The workspace is ready.',
      statusCode: 500,
    });
    assert.equal(message, 'The workspace is ready.');
  });

  test('402 insufficient-credit raw message is not stolen as quota guidance', () => {
    const message = toQuotaRateLimitGuidance({
      ...base,
      rawMessage: 'Insufficient credit balance',
      statusCode: 402,
    });
    assert.equal(message, 'Insufficient credit balance');
  });
});

describe('limit message keys', () => {
  test('every new limit key exists in en, zh-TW, and zh-CN', () => {
    const aiKeys = [
      'dailyCreditLimitOwn',
      'dailyCreditLimitPlatform',
      'dailyTokenLimitWithTime',
      'dailyTokenLimitTomorrow',
      'creditInsufficientForRun',
      'rateLimitRetrySeconds',
      'rateLimitRetryShortly',
      'quotaLimitGuidance',
      'accessRulesGuidance',
    ] as const;
    const catalogs = [enMessages, zhTwMessages, zhCnMessages];
    for (const catalog of catalogs) {
      for (const key of aiKeys) {
        const value = catalog.ai[key];
        assert.equal(typeof value, 'string');
        assert.equal(value.trim().length > 0, true);
      }
      const collaboration = catalog.collaboration.refusalDailyCredits;
      assert.equal(typeof collaboration, 'string');
      assert.equal(collaboration.trim().length > 0, true);
    }

    assert.equal(
      enMessages.ai.dailyCreditLimitOwn,
      "You've used today's credit limit. Runs start again after midnight UTC.",
    );
    assert.equal(
      enMessages.ai.dailyCreditLimitPlatform,
      'Runs are paused for today because the daily platform limit was reached. They start again after midnight UTC.',
    );
    assert.equal(
      enMessages.ai.dailyTokenLimitWithTime,
      "You've reached today's token limit. You can run again after {time}.",
    );
    assert.equal(
      enMessages.ai.dailyTokenLimitTomorrow,
      "You've reached today's token limit. Try again tomorrow.",
    );
    assert.equal(
      enMessages.ai.creditInsufficientForRun,
      'This run needs {required} credits, and you have {count}.',
    );
    assert.equal(
      enMessages.ai.rateLimitRetrySeconds,
      'Too many requests. Try again in about {seconds} seconds.',
    );
    assert.equal(enMessages.ai.rateLimitRetryShortly, 'Too many requests. Try again shortly.');
    assert.equal(
      enMessages.ai.quotaLimitGuidance,
      'Request blocked by quota limits. Review usage and try again after quota reset.',
    );
    assert.equal(
      enMessages.ai.accessRulesGuidance,
      'Request blocked by access rules. Check your API key permissions or launch access.',
    );
    assert.equal(enMessages.collaboration.refusalDailyCredits, enMessages.ai.dailyCreditLimitOwn);

    for (const catalog of [zhTwMessages, zhCnMessages]) {
      for (const key of aiKeys) {
        const value = catalog.ai[key];
        assert.notEqual(value, enMessages.ai[key]);
        assert.match(value, /\p{Script=Han}/u);
      }
      assert.notEqual(
        catalog.collaboration.refusalDailyCredits,
        enMessages.collaboration.refusalDailyCredits,
      );
      assert.match(catalog.collaboration.refusalDailyCredits, /\p{Script=Han}/u);
      assert.equal(catalog.ai.dailyTokenLimitWithTime.includes('{time}'), true);
      assert.equal(catalog.ai.dailyTokenLimitTomorrow.includes('{time}'), false);
      assert.equal(catalog.ai.creditInsufficientForRun.includes('{required}'), true);
      assert.equal(catalog.ai.creditInsufficientForRun.includes('{count}'), true);
      assert.equal(catalog.ai.rateLimitRetrySeconds.includes('{seconds}'), true);
    }
    assert.notEqual(zhTwMessages.ai.dailyCreditLimitOwn, zhCnMessages.ai.dailyCreditLimitOwn);
    assert.notEqual(
      zhTwMessages.collaboration.refusalDailyCredits,
      zhCnMessages.collaboration.refusalDailyCredits,
    );
  });
});

describe('PROVIDER-KEY-01 provider_key_missing failure copy', () => {
  const catalogs = [
    ['en', enMessages],
    ['zh-TW', zhTwMessages],
    ['zh-CN', zhCnMessages],
  ] as const;

  function copiesFor(messages: typeof enMessages): QuotaRateLimitGuidanceCopies {
    return {
      dailyCreditOwn: messages.ai.dailyCreditLimitOwn,
      dailyCreditPlatform: messages.ai.dailyCreditLimitPlatform,
      dailyTokenWithTime: messages.ai.dailyTokenLimitWithTime,
      dailyTokenTomorrow: messages.ai.dailyTokenLimitTomorrow,
      rateLimitWithSeconds: messages.ai.rateLimitRetrySeconds,
      rateLimitShortly: messages.ai.rateLimitRetryShortly,
      quota: messages.ai.quotaLimitGuidance,
      accessRules: messages.ai.accessRulesGuidance,
      providerUsageLimit: messages.ai.providerUsageLimit,
      providerKeyMissing: messages.ai.providerKeyMissing,
    };
  }

  test('the code gives the translated sentence in each language', () => {
    for (const [, messages] of catalogs) {
      const message = toQuotaRateLimitGuidance({
        rawMessage: '',
        fallbackMessage: 'Execution ended with status: failed.',
        errorCode: 'provider_key_missing',
        copies: copiesFor(messages),
      });
      assert.equal(message, messages.ai.providerKeyMissing);
    }
    assert.equal(PROVIDER_KEY_MISSING_ERROR_CODE, 'provider_key_missing');
  });

  test('the code is checked before the usage-limit, quota and rate-limit checks', () => {
    const cases = [
      { rawMessage: 'AI provider usage limit reached', statusCode: 400 },
      { rawMessage: 'quota exceeded', statusCode: 429, retryAfterHeader: '30' },
      { rawMessage: 'rate limit', statusCode: 500 },
      { rawMessage: 'Forbidden by policy', statusCode: 403 },
      { rawMessage: 'AI provider is not configured' },
    ];
    for (const input of cases) {
      assert.equal(
        toQuotaRateLimitGuidance({ ...base, ...input, errorCode: 'provider_key_missing' }),
        enMessages.ai.providerKeyMissing,
      );
    }
  });

  test('without the code, results are as before', () => {
    assert.equal(
      toQuotaRateLimitGuidance({ ...base, rawMessage: '', fallbackMessage: 'Execution ended with status: failed.' }),
      'Execution ended with status: failed.',
    );
    assert.equal(
      toQuotaRateLimitGuidance({ ...base, rawMessage: 'AI provider is not configured' }),
      'AI provider is not configured',
    );
    assert.equal(
      toQuotaRateLimitGuidance({ ...base, rawMessage: 'quota exceeded', errorCode: 'execution_failed' }),
      copies.quota,
    );
    assert.equal(
      toQuotaRateLimitGuidance({ ...base, rawMessage: '', errorCode: 'Provider_Key_Missing' }),
      base.fallbackMessage,
    );
  });

  test('the usage-limit sentence from the status error still maps to its copy', () => {
    const error = readExecutionStatusError({
      code: 'execution_failed',
      message: 'AI provider usage limit reached',
    });
    assert.ok(error);
    assert.equal(
      toQuotaRateLimitGuidance({
        ...base,
        rawMessage: error.message,
        errorCode: error.code,
      }),
      enMessages.ai.providerUsageLimit,
    );
  });

  test('with no providerKeyMissing copy the fallback is used, never the raw text', () => {
    const { providerKeyMissing: _unused, ...withoutCopy } = copies;
    void _unused;
    assert.equal(
      toQuotaRateLimitGuidance({
        rawMessage: 'AI provider is not configured',
        fallbackMessage: 'Chat execution failed.',
        errorCode: 'provider_key_missing',
        copies: withoutCopy,
      }),
      'Chat execution failed.',
    );
  });

  test('readExecutionStatusError accepts only a code and message pair', () => {
    assert.deepEqual(
      readExecutionStatusError({ code: 'provider_key_missing', message: 'AI provider is not configured' }),
      { code: 'provider_key_missing', message: 'AI provider is not configured' },
    );
    assert.equal(readExecutionStatusError(undefined), null);
    assert.equal(readExecutionStatusError(null), null);
    assert.equal(readExecutionStatusError('provider_key_missing'), null);
    assert.equal(readExecutionStatusError(['provider_key_missing']), null);
    assert.equal(readExecutionStatusError({ code: 'provider_key_missing' }), null);
    assert.equal(readExecutionStatusError({ code: 7, message: 'x' }), null);
    assert.equal(readExecutionStatusError({ code: '  ', message: 'x' }), null);
  });

  test('the three new keys exist and zh-TW and zh-CN differ from en and from each other', () => {
    for (const key of ['providerKeyMissing', 'noProviderAvailable', 'noProviderOption'] as const) {
      for (const [lang, messages] of catalogs) {
        const value = messages.ai[key];
        assert.equal(typeof value, 'string', `${lang} ai.${key}`);
        assert.ok(value.trim().length > 0, `${lang} ai.${key} empty`);
      }
      assert.notEqual(zhTwMessages.ai[key], enMessages.ai[key], `zh-TW ai.${key} equals en`);
      assert.notEqual(zhCnMessages.ai[key], enMessages.ai[key], `zh-CN ai.${key} equals en`);
      assert.notEqual(zhTwMessages.ai[key], zhCnMessages.ai[key], `zh-TW ai.${key} equals zh-CN`);
    }
  });
});
