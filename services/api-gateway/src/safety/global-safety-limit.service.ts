import { Injectable } from '@nestjs/common';
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

@Injectable()
export class GlobalSafetyLimitService {
  // Global rate limit tracking (sliding 1-minute window)
  private globalExecutionWindow: RateWindow = {
    count: 0,
    windowStart: this.getCurrentMinute(),
  };

  // Provider-specific rate limit tracking (sliding 1-minute windows)
  private providerExecutionWindows: Map<string, RateWindow> = new Map();

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
}
