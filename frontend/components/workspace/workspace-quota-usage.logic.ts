interface QuotaRateLimitGuidanceInput {
  rawMessage?: string;
  fallbackMessage: string;
  statusCode?: number;
  retryAfterHeader?: string | null;
}

function includesQuotaOrRateLimitSignals(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('429') ||
    normalizedMessage.includes('rate limit') ||
    normalizedMessage.includes('rate-limit') ||
    normalizedMessage.includes('too many requests') ||
    normalizedMessage.includes('retry-after') ||
    normalizedMessage.includes('quota')
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
  const hasQuotaOrRateLimitSignals =
    includesQuotaOrRateLimitSignals(trimmedRawMessage) || statusCode === 429 || statusCode === 403;

  if (hasQuotaOrRateLimitSignals) {
    if (statusCode === 429 && retryAfterSeconds) {
      return `Request rate-limited. Retry in about ${retryAfterSeconds}s.`;
    }

    if (statusCode === 403 || trimmedRawMessage.toLowerCase().includes('quota')) {
      return 'Request blocked by quota limits. Review usage and try again after quota reset.';
    }

    return 'Request blocked by rate limits. Retry shortly.';
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
