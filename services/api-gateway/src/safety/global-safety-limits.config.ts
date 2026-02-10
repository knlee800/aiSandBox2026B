/**
 * Global Safety Limits Configuration
 *
 * Platform-wide caps that override per-key quotas.
 * Prevents runaway costs and abuse.
 *
 * Phase 26B: Production Readiness
 */

export class GlobalSafetyLimits {
  /**
   * Max tokens per single execution request
   * Default: 100,000 tokens
   */
  static readonly MAX_TOKENS_PER_EXECUTION = parseInt(
    process.env.MAX_TOKENS_PER_EXECUTION || '100000',
    10,
  );

  /**
   * Max executions per minute (global, all users)
   * Default: 10,000 requests/minute
   */
  static readonly MAX_EXECUTIONS_PER_MINUTE_GLOBAL = parseInt(
    process.env.MAX_EXECUTIONS_PER_MINUTE_GLOBAL || '10000',
    10,
  );

  /**
   * Max daily spend (soft cap, warning only)
   * Default: $10,000 USD per day
   */
  static readonly MAX_DAILY_SPEND_SOFT_USD = parseFloat(
    process.env.MAX_DAILY_SPEND_SOFT_USD || '10000',
  );

  /**
   * Max daily spend (hard cap, blocks execution)
   * Default: $20,000 USD per day
   */
  static readonly MAX_DAILY_SPEND_HARD_USD = parseFloat(
    process.env.MAX_DAILY_SPEND_HARD_USD || '20000',
  );

  /**
   * Provider-specific rate limits (requests per minute)
   */
  static readonly MAX_REQUESTS_PER_MINUTE_OPENAI = parseInt(
    process.env.MAX_REQUESTS_PER_MINUTE_OPENAI || '5000',
    10,
  );

  static readonly MAX_REQUESTS_PER_MINUTE_ANTHROPIC = parseInt(
    process.env.MAX_REQUESTS_PER_MINUTE_ANTHROPIC || '3000',
    10,
  );

  static readonly MAX_REQUESTS_PER_MINUTE_GROQ = parseInt(
    process.env.MAX_REQUESTS_PER_MINUTE_GROQ || '10000',
    10,
  );

  static readonly MAX_REQUESTS_PER_MINUTE_XAI = parseInt(
    process.env.MAX_REQUESTS_PER_MINUTE_XAI || '5000',
    10,
  );

  static readonly MAX_REQUESTS_PER_MINUTE_DEEPSEEK = parseInt(
    process.env.MAX_REQUESTS_PER_MINUTE_DEEPSEEK || '5000',
    10,
  );

  /**
   * Get provider-specific rate limit
   */
  static getProviderRateLimit(provider: string): number {
    const normalizedProvider = provider.toLowerCase();

    switch (normalizedProvider) {
      case 'openai':
        return this.MAX_REQUESTS_PER_MINUTE_OPENAI;
      case 'anthropic':
        return this.MAX_REQUESTS_PER_MINUTE_ANTHROPIC;
      case 'groq':
        return this.MAX_REQUESTS_PER_MINUTE_GROQ;
      case 'xai':
        return this.MAX_REQUESTS_PER_MINUTE_XAI;
      case 'deepseek':
        return this.MAX_REQUESTS_PER_MINUTE_DEEPSEEK;
      default:
        // Unknown providers: default to 1000 req/min
        return 1000;
    }
  }

  /**
   * Get all safety limit values (for observability)
   */
  static getSafetyLimitValues(): Record<string, number> {
    return {
      MAX_TOKENS_PER_EXECUTION: this.MAX_TOKENS_PER_EXECUTION,
      MAX_EXECUTIONS_PER_MINUTE_GLOBAL: this.MAX_EXECUTIONS_PER_MINUTE_GLOBAL,
      MAX_DAILY_SPEND_SOFT_USD: this.MAX_DAILY_SPEND_SOFT_USD,
      MAX_DAILY_SPEND_HARD_USD: this.MAX_DAILY_SPEND_HARD_USD,
      MAX_REQUESTS_PER_MINUTE_OPENAI: this.MAX_REQUESTS_PER_MINUTE_OPENAI,
      MAX_REQUESTS_PER_MINUTE_ANTHROPIC:
        this.MAX_REQUESTS_PER_MINUTE_ANTHROPIC,
      MAX_REQUESTS_PER_MINUTE_GROQ: this.MAX_REQUESTS_PER_MINUTE_GROQ,
      MAX_REQUESTS_PER_MINUTE_XAI: this.MAX_REQUESTS_PER_MINUTE_XAI,
      MAX_REQUESTS_PER_MINUTE_DEEPSEEK: this.MAX_REQUESTS_PER_MINUTE_DEEPSEEK,
    };
  }
}
