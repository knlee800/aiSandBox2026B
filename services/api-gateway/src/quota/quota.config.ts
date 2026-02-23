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
   * PHASE-42A-2: Max sessions per rolling 24h window
   * Enforced before container creation in POST /api/sessions
   * Hard limit: no container started if exceeded
   */
  static readonly MAX_SESSIONS_PER_24H = 20;

  /**
   * PHASE-42A-3: Max tokens per rolling 24h window
   * Enforced before AI provider call in POST /api/ai/execute
   * Hard limit: no AI provider called if exceeded
   */
  static readonly MAX_TOKENS_PER_24H = 100000;

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
   * PHASE-42B-2: Enhanced estimation for advisory lock quota enforcement
   * - Conservative estimate prevents under-quota violations
   * - Includes prompt, context, response, and buffer
   * - Pessimistic approach: better to over-estimate than under-estimate
   *
   * @param prompt - User prompt (optional, for length-based estimation)
   * @returns Estimated token count
   */
  static estimateTokens(prompt?: string): number {
    // Base estimate: typical AI execution
    // - User prompt: ~200 tokens
    // - Context/history: ~2000 tokens
    // - AI response: ~1000 tokens
    // - Buffer (safety margin): ~4800 tokens
    // Total: ~8000 tokens (conservative)
    const baseEstimate = 8000;

    // If prompt provided, adjust based on length
    if (prompt && typeof prompt === 'string') {
      // Rough approximation: 1 token ≈ 4 characters
      const promptTokens = Math.ceil(prompt.length / 4);
      
      // Use max(baseEstimate, promptTokens * 2) to be conservative
      // Multiply by 2 to account for context + response
      return Math.max(baseEstimate, promptTokens * 2);
    }

    return baseEstimate;
  }
}
