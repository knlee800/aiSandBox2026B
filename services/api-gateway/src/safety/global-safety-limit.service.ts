import { Injectable, Logger } from '@nestjs/common';
import { GlobalSafetyLimits } from './global-safety-limits.config';

/**
 * Global Safety Limit Enforcement Service
 *
 * Tracks platform-wide limits with sliding windows.
 * Deterministic, fail-fast enforcement.
 *
 * Phase 26B: Production Readiness
 */

interface RateWindow {
  count: number;
  windowStart: number; // Unix timestamp (seconds)
}

interface DailySpendWindow {
  totalUSD: number;
  dayStart: string; // YYYY-MM-DD (UTC)
}

@Injectable()
export class GlobalSafetyLimitService {
  private readonly logger = new Logger(GlobalSafetyLimitService.name);

  // Global rate limit tracking (sliding 1-minute window)
  private globalExecutionWindow: RateWindow = {
    count: 0,
    windowStart: this.getCurrentMinute(),
  };

  // Provider-specific rate limit tracking (sliding 1-minute windows)
  private providerExecutionWindows: Map<string, RateWindow> = new Map();

  // Daily spend tracking (UTC day boundary)
  private dailySpendWindow: DailySpendWindow = {
    totalUSD: 0,
    dayStart: this.getCurrentDay(),
  };

  /**
   * Check if execution is allowed (all limits)
   * Throws exception if any limit exceeded
   */
  checkExecutionAllowed(
    provider: string,
    requestedMaxTokens: number | undefined,
  ): void {
    // Check 1: Max tokens per execution
    if (requestedMaxTokens !== undefined) {
      if (requestedMaxTokens > GlobalSafetyLimits.MAX_TOKENS_PER_EXECUTION) {
        throw new Error(
          `Requested max_tokens (${requestedMaxTokens}) exceeds platform limit (${GlobalSafetyLimits.MAX_TOKENS_PER_EXECUTION})`,
        );
      }
    }

    // Check 2: Global rate limit
    this.checkGlobalRateLimit();

    // Check 3: Provider-specific rate limit
    this.checkProviderRateLimit(provider);

    // Check 4: Daily spend hard cap
    this.checkDailySpendHardCap();

    // All checks passed
  }

  /**
   * Record execution attempt (increment counters)
   */
  recordExecution(provider: string): void {
    // Increment global counter
    this.incrementGlobalCounter();

    // Increment provider counter
    this.incrementProviderCounter(provider);
  }

  /**
   * Record execution cost (for daily spend tracking)
   */
  recordExecutionCost(costUSD: number): void {
    const currentDay = this.getCurrentDay();

    // Reset window if day changed
    if (this.dailySpendWindow.dayStart !== currentDay) {
      this.dailySpendWindow = {
        totalUSD: 0,
        dayStart: currentDay,
      };
    }

    // Add cost
    this.dailySpendWindow.totalUSD += costUSD;

    // Check soft cap (warning only)
    if (
      this.dailySpendWindow.totalUSD >=
      GlobalSafetyLimits.MAX_DAILY_SPEND_SOFT_USD
    ) {
      this.logger.warn(
        `Daily spend soft cap exceeded: $${this.dailySpendWindow.totalUSD.toFixed(2)} >= $${GlobalSafetyLimits.MAX_DAILY_SPEND_SOFT_USD.toFixed(2)}`,
      );
    }
  }

  /**
   * Get current daily spend
   */
  getCurrentDailySpend(): number {
    const currentDay = this.getCurrentDay();

    // Reset if day changed
    if (this.dailySpendWindow.dayStart !== currentDay) {
      return 0;
    }

    return this.dailySpendWindow.totalUSD;
  }

  /**
   * Get current global rate (requests per minute)
   */
  getCurrentGlobalRate(): number {
    const currentMinute = this.getCurrentMinute();

    // Reset if window shifted
    if (this.globalExecutionWindow.windowStart !== currentMinute) {
      return 0;
    }

    return this.globalExecutionWindow.count;
  }

  /**
   * Get current provider rate (requests per minute)
   */
  getCurrentProviderRate(provider: string): number {
    const window = this.providerExecutionWindows.get(provider);
    if (!window) {
      return 0;
    }

    const currentMinute = this.getCurrentMinute();

    // Reset if window shifted
    if (window.windowStart !== currentMinute) {
      return 0;
    }

    return window.count;
  }

  // Private helper methods

  private checkGlobalRateLimit(): void {
    const currentMinute = this.getCurrentMinute();

    // Reset window if minute changed
    if (this.globalExecutionWindow.windowStart !== currentMinute) {
      this.globalExecutionWindow = {
        count: 0,
        windowStart: currentMinute,
      };
    }

    // Check limit
    if (
      this.globalExecutionWindow.count >=
      GlobalSafetyLimits.MAX_EXECUTIONS_PER_MINUTE_GLOBAL
    ) {
      throw new Error(
        `Platform rate limit exceeded (${GlobalSafetyLimits.MAX_EXECUTIONS_PER_MINUTE_GLOBAL} req/min)`,
      );
    }
  }

  private checkProviderRateLimit(provider: string): void {
    const currentMinute = this.getCurrentMinute();
    const limit = GlobalSafetyLimits.getProviderRateLimit(provider);

    // Get or create window
    let window = this.providerExecutionWindows.get(provider);
    if (!window) {
      window = { count: 0, windowStart: currentMinute };
      this.providerExecutionWindows.set(provider, window);
    }

    // Reset window if minute changed
    if (window.windowStart !== currentMinute) {
      window.count = 0;
      window.windowStart = currentMinute;
    }

    // Check limit
    if (window.count >= limit) {
      throw new Error(
        `Provider ${provider} rate limit exceeded (${limit} req/min)`,
      );
    }
  }

  private checkDailySpendHardCap(): void {
    const currentDay = this.getCurrentDay();

    // Reset window if day changed
    if (this.dailySpendWindow.dayStart !== currentDay) {
      this.dailySpendWindow = {
        totalUSD: 0,
        dayStart: currentDay,
      };
    }

    // Check hard cap
    if (
      this.dailySpendWindow.totalUSD >=
      GlobalSafetyLimits.MAX_DAILY_SPEND_HARD_USD
    ) {
      throw new Error(
        `Platform daily spend limit reached ($${GlobalSafetyLimits.MAX_DAILY_SPEND_HARD_USD.toFixed(2)})`,
      );
    }
  }

  private incrementGlobalCounter(): void {
    const currentMinute = this.getCurrentMinute();

    // Reset window if minute changed
    if (this.globalExecutionWindow.windowStart !== currentMinute) {
      this.globalExecutionWindow = {
        count: 0,
        windowStart: currentMinute,
      };
    }

    this.globalExecutionWindow.count++;
  }

  private incrementProviderCounter(provider: string): void {
    const currentMinute = this.getCurrentMinute();

    // Get or create window
    let window = this.providerExecutionWindows.get(provider);
    if (!window) {
      window = { count: 0, windowStart: currentMinute };
      this.providerExecutionWindows.set(provider, window);
    }

    // Reset window if minute changed
    if (window.windowStart !== currentMinute) {
      window.count = 0;
      window.windowStart = currentMinute;
    }

    window.count++;
  }

  private getCurrentMinute(): number {
    // Unix timestamp truncated to minute boundary
    return Math.floor(Date.now() / 1000 / 60);
  }

  private getCurrentDay(): string {
    // YYYY-MM-DD in UTC
    const now = new Date();
    return now.toISOString().split('T')[0];
  }
}
