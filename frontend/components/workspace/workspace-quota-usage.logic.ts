interface QuotaRateLimitGuidanceInput {
  rawMessage?: string;
  fallbackMessage: string;
  statusCode?: number;
  retryAfterHeader?: string | null;
}

const QUOTA_GUIDANCE_MESSAGE =
  'Request blocked by quota limits. Review usage and try again after quota reset.';
const RATE_LIMIT_GUIDANCE_MESSAGE = 'Request blocked by rate limits. Retry shortly.';
const ACCESS_RULES_GUIDANCE_MESSAGE =
  'Request blocked by access rules. Check your API key permissions or launch access.';

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
  const hasQuotaSignals = includesQuotaSignals(trimmedRawMessage);
  const hasRateLimitSignals = includesRateLimitSignals(trimmedRawMessage);

  if (statusCode === 429) {
    if (retryAfterSeconds) {
      return `Request rate-limited. Retry in about ${retryAfterSeconds}s.`;
    }

    return hasQuotaSignals ? QUOTA_GUIDANCE_MESSAGE : RATE_LIMIT_GUIDANCE_MESSAGE;
  }

  if (hasQuotaSignals) {
    return QUOTA_GUIDANCE_MESSAGE;
  }

  if (hasRateLimitSignals) {
    return RATE_LIMIT_GUIDANCE_MESSAGE;
  }

  if (statusCode === 403) {
    return hasUsefulForbiddenMessage(trimmedRawMessage)
      ? trimmedRawMessage
      : ACCESS_RULES_GUIDANCE_MESSAGE;
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
