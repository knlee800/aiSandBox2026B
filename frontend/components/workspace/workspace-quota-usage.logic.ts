export interface QuotaRateLimitGuidanceCopies {
  dailyCreditOwn: string;
  dailyCreditPlatform: string;
  dailyTokenWithTime: string;
  dailyTokenTomorrow: string;
  rateLimitWithSeconds: string;
  rateLimitShortly: string;
  quota: string;
  accessRules: string;
  providerUsageLimit?: string;
  /** PROVIDER-KEY-01: translated ai.providerKeyMissing. */
  providerKeyMissing?: string;
}

export interface QuotaRateLimitGuidanceInput {
  rawMessage?: string;
  fallbackMessage: string;
  statusCode?: number;
  retryAfterHeader?: string | null;
  payload?: unknown;
  locale?: string;
  /** PROVIDER-KEY-01: the allow-listed error.code from the run status answer (C2). */
  errorCode?: string;
  copies: QuotaRateLimitGuidanceCopies;
}

/** PROVIDER-KEY-01 (C2): the code the gateway returns for a run whose provider has no key. */
export const PROVIDER_KEY_MISSING_ERROR_CODE = 'provider_key_missing';

export interface ExecutionStatusError {
  code: string;
  message: string;
}

/**
 * PROVIDER-KEY-01 (C2): reads the `error` field of a run status answer.
 * Only `{ code: string, message: string }` counts; anything else is null.
 */
export function readExecutionStatusError(value: unknown): ExecutionStatusError | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.code !== 'string' || typeof record.message !== 'string') {
    return null;
  }
  const code = record.code.trim();
  if (!code) {
    return null;
  }
  return { code, message: record.message.trim() };
}

const DAILY_TOKEN_QUOTA_TYPE = 'max_tokens_per_24h';

function includesQuotaSignals(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('quota') ||
    normalizedMessage.includes('usage limit') ||
    normalizedMessage.includes('usage-limit')
  );
}

function includesRateLimitSignals(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('429') ||
    normalizedMessage.includes('rate limit') ||
    normalizedMessage.includes('rate-limit') ||
    normalizedMessage.includes('rate limited') ||
    normalizedMessage.includes('rate-limited') ||
    normalizedMessage.includes('too many requests') ||
    normalizedMessage.includes('retry-after')
  );
}

function hasUsefulForbiddenMessage(message: string): boolean {
  const normalizedMessage = message.trim().toLowerCase();
  if (!normalizedMessage) {
    return false;
  }

  return (
    normalizedMessage !== 'forbidden' &&
    normalizedMessage !== 'forbidden resource' &&
    normalizedMessage !== 'access denied'
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readCreditCap(payload: unknown): 'user' | 'platform' | null {
  const cap = asRecord(payload)?.cap;
  if (cap === 'user' || cap === 'platform') {
    return cap;
  }
  return null;
}

function readDetails(payload: unknown): Record<string, unknown> | null {
  return asRecord(asRecord(payload)?.details);
}

function readQuotaType(payload: unknown): string | null {
  const quotaType = readDetails(payload)?.quota_type;
  if (typeof quotaType !== 'string') {
    return null;
  }
  const trimmed = quotaType.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readResetAt(payload: unknown): string | null {
  const resetAt = readDetails(payload)?.reset_at;
  if (typeof resetAt !== 'string') {
    return null;
  }
  const trimmed = resetAt.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatResetTime(resetAt: string, locale?: string): string | null {
  const parsed = Date.parse(resetAt);
  if (Number.isNaN(parsed)) {
    return null;
  }
  const localeTag = locale?.trim();
  const formatted = new Date(parsed).toLocaleString(localeTag ? localeTag : undefined);
  if (!formatted.trim() || formatted === 'Invalid Date') {
    return null;
  }
  return formatted;
}

function fillToken(template: string, token: string, value: string): string {
  return template.replace(token, value);
}

function rateLimitMessage(copies: QuotaRateLimitGuidanceCopies, retryAfterSeconds: number | null): string {
  if (retryAfterSeconds) {
    return fillToken(copies.rateLimitWithSeconds, '{seconds}', String(retryAfterSeconds));
  }
  return copies.rateLimitShortly;
}

export function parseRetryAfterSeconds(retryAfterHeader?: string | null): number | null {
  if (!retryAfterHeader) {
    return null;
  }

  const normalizedValue = retryAfterHeader.trim();
  if (!normalizedValue) {
    return null;
  }

  const asSeconds = Number(normalizedValue);
  if (Number.isFinite(asSeconds) && asSeconds > 0) {
    return Math.ceil(asSeconds);
  }

  const asDateMs = Date.parse(normalizedValue);
  if (Number.isNaN(asDateMs)) {
    return null;
  }

  const deltaSeconds = Math.ceil((asDateMs - Date.now()) / 1000);
  return deltaSeconds > 0 ? deltaSeconds : null;
}

export function toQuotaRateLimitGuidance(input: QuotaRateLimitGuidanceInput): string {
  const trimmedRawMessage = (input.rawMessage ?? '').trim();
  const retryAfterSeconds = parseRetryAfterSeconds(input.retryAfterHeader);
  const statusCode = input.statusCode ?? null;
  const copies = input.copies;

  if (input.errorCode === PROVIDER_KEY_MISSING_ERROR_CODE) {
    return copies.providerKeyMissing ?? input.fallbackMessage;
  }

  if (trimmedRawMessage === 'AI provider usage limit reached') {
    return copies.providerUsageLimit ?? trimmedRawMessage;
  }

  if (statusCode === 429) {
    const cap = readCreditCap(input.payload);
    if (cap === 'user') {
      return copies.dailyCreditOwn;
    }
    if (cap === 'platform') {
      return copies.dailyCreditPlatform;
    }
    if (readQuotaType(input.payload) === DAILY_TOKEN_QUOTA_TYPE) {
      const resetAt = readResetAt(input.payload);
      const resetTime = resetAt ? formatResetTime(resetAt, input.locale) : null;
      if (resetTime) {
        return fillToken(copies.dailyTokenWithTime, '{time}', resetTime);
      }
      return copies.dailyTokenTomorrow;
    }
    if (includesQuotaSignals(trimmedRawMessage)) {
      return copies.quota;
    }
    return rateLimitMessage(copies, retryAfterSeconds);
  }

  if (includesQuotaSignals(trimmedRawMessage)) {
    return copies.quota;
  }

  if (includesRateLimitSignals(trimmedRawMessage)) {
    return copies.rateLimitShortly;
  }

  if (statusCode === 403) {
    return hasUsefulForbiddenMessage(trimmedRawMessage)
      ? trimmedRawMessage
      : copies.accessRules;
  }

  return trimmedRawMessage || input.fallbackMessage;
}

export function shouldRefreshDashboardForChatStatus(status: string): boolean {
  return (
    status === 'completed' ||
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'timeout'
  );
}
