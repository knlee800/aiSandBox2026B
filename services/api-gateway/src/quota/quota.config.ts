/**
 * QuotaConfig
 *
 * Phase 21B: Quota and Rate-Limiting Configuration
 * Phase 42A-1: Added MAX_ACTIVE_SESSIONS_PER_USER
 *
 * Defines static quota limits for API keys.
 * Two independent quota types:
 * 1. Request count quota (requests per minute)
 * 2. Token usage quota (tokens per day)
 *
 * IMPORTANT: This is a minimal implementation for Phase 21B.
 * No database, no Redis, no persistence.
 * In-memory state managed by QuotaService.
 */

export interface QuotaLimits {
  requestsPerMinute: number;
  tokensPerDay: number;
}

export class QuotaConfig {
  /**
   * PHASE-42A-1: Max active sessions per user
   * Enforced before container creation in POST /api/sessions
   * Hard limit: no container started if exceeded
   */
  static readonly MAX_ACTIVE_SESSIONS_PER_USER = 5;

  /**
   * Default quota limits applied to all API keys
   * unless overridden in API_KEY_QUOTAS
   */
  static readonly DEFAULT_QUOTA: QuotaLimits = {
    requestsPerMinute: 100, // 100 requests per minute
    tokensPerDay: 10000, // 10,000 tokens per day
  };

  /**
   * Per-API-key quota overrides
   * If apiKeyId not found here, DEFAULT_QUOTA is used
   */
  private static readonly API_KEY_QUOTAS: Map<string, QuotaLimits> = new Map([
    // Test key with higher limits for local daily-usage testing
    [
      'key-test',
      {
        requestsPerMinute: 100,
        tokensPerDay: 100000,
      },
    ],
    // Standard keys use default limits
    [
      'key-1',
      {
        requestsPerMinute: 100,
        tokensPerDay: 10000,
      },
    ],
    [
      'key-2',
      {
        requestsPerMinute: 100,
        tokensPerDay: 10000,
      },
    ],
  ]);

  /**
   * Get quota limits for a specific API key
   *
   * @param apiKeyId - API key ID to get quota limits for
   * @returns QuotaLimits for the API key (default if not found)
   */
  static getQuotaLimits(apiKeyId: string): QuotaLimits {
    return this.API_KEY_QUOTAS.get(apiKeyId) || this.DEFAULT_QUOTA;
  }

  /**
   * Conservative token estimate for pre-execution quota check
   * Used when actual token count is unknown before execution
   *
   * @param prompt - User prompt (optional, for length-based estimation)
   * @returns Estimated token count
   */
  static estimateTokens(prompt?: string): number {
    // Conservative fixed estimate (Phase 21B)
    // Future: could use prompt.length * multiplier
    return 1000;
  }
}
