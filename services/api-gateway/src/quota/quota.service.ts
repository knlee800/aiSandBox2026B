import { Injectable } from '@nestjs/common';
import { QuotaConfig } from './quota.config';

/**
 * QuotaService
 *
 * Phase 21B: In-memory quota state management
 *
 * Tracks quota usage per apiKeyId with fixed time windows:
 * - Request count: per-minute window
 * - Token usage: per-day window
 *
 * IMPORTANT: In-memory state only (no Redis, no database)
 * State is lost on service restart (acceptable for Phase 21B)
 * Single-instance deployment only (no distributed coordination)
 *
 * Deterministic behavior:
 * - Same inputs → same decision (within same window)
 * - Window boundaries based on clock time
 * - No sliding windows
 */

interface QuotaUsage {
  requests: number; // Request count in current minute window
  tokens: number; // Token count in current day window
  requestWindowStart: number; // Timestamp of current minute window start (ms)
  tokenWindowStart: number; // Timestamp of current day window start (ms)
}

@Injectable()
export class QuotaService {
  /**
   * In-memory quota usage state
   * Key: apiKeyId
   * Value: QuotaUsage
   */
  private readonly usageMap: Map<string, QuotaUsage> = new Map();

  /**
   * Check if request count quota is available
   *
   * @param apiKeyId - API key ID to check quota for
   * @returns true if quota available, false if exceeded
   */
  checkRequestQuota(apiKeyId: string): boolean {
    const limits = QuotaConfig.getQuotaLimits(apiKeyId);
    const usage = this.getOrCreateUsage(apiKeyId);
    const now = Date.now();

    // Reset window if expired
    const currentMinuteStart = this.getMinuteWindowStart(now);
    if (usage.requestWindowStart !== currentMinuteStart) {
      usage.requests = 0;
      usage.requestWindowStart = currentMinuteStart;
    }

    // Check quota
    return usage.requests < limits.requestsPerMinute;
  }

  /**
   * Check if token usage quota is available
   *
   * @param apiKeyId - API key ID to check quota for
   * @param estimatedTokens - Estimated token count for this request
   * @returns true if quota available, false if exceeded
   */
  checkTokenQuota(apiKeyId: string, estimatedTokens: number): boolean {
    const limits = QuotaConfig.getQuotaLimits(apiKeyId);
    const usage = this.getOrCreateUsage(apiKeyId);
    const now = Date.now();

    // Reset window if expired
    const currentDayStart = this.getDayWindowStart(now);
    if (usage.tokenWindowStart !== currentDayStart) {
      usage.tokens = 0;
      usage.tokenWindowStart = currentDayStart;
    }

    // Check quota
    return usage.tokens + estimatedTokens <= limits.tokensPerDay;
  }

  /**
   * Record a request (increments request count)
   *
   * @param apiKeyId - API key ID to record request for
   */
  recordRequest(apiKeyId: string): void {
    const usage = this.getOrCreateUsage(apiKeyId);
    const now = Date.now();

    // Ensure window is current
    const currentMinuteStart = this.getMinuteWindowStart(now);
    if (usage.requestWindowStart !== currentMinuteStart) {
      usage.requests = 0;
      usage.requestWindowStart = currentMinuteStart;
    }

    // Increment request count
    usage.requests++;
  }

  /**
   * Record token usage (increments token count)
   *
   * @param apiKeyId - API key ID to record tokens for
   * @param tokens - Token count to record
   */
  recordTokens(apiKeyId: string, tokens: number): void {
    const usage = this.getOrCreateUsage(apiKeyId);
    const now = Date.now();

    // Ensure window is current
    const currentDayStart = this.getDayWindowStart(now);
    if (usage.tokenWindowStart !== currentDayStart) {
      usage.tokens = 0;
      usage.tokenWindowStart = currentDayStart;
    }

    // Increment token count
    usage.tokens += tokens;
  }

  /**
   * Get current usage for an API key (for testing/debugging)
   *
   * @param apiKeyId - API key ID to get usage for
   * @returns Current usage stats
   */
  getCurrentUsage(apiKeyId: string): {
    requests: number;
    tokens: number;
  } {
    const usage = this.usageMap.get(apiKeyId);
    if (!usage) {
      return { requests: 0, tokens: 0 };
    }

    const now = Date.now();
    const currentMinuteStart = this.getMinuteWindowStart(now);
    const currentDayStart = this.getDayWindowStart(now);

    // Return 0 if windows expired
    return {
      requests:
        usage.requestWindowStart === currentMinuteStart ? usage.requests : 0,
      tokens: usage.tokenWindowStart === currentDayStart ? usage.tokens : 0,
    };
  }

  /**
   * Clear all quota state (for testing)
   */
  clearAll(): void {
    this.usageMap.clear();
  }

  /**
   * Get or create usage record for an API key
   *
   * @param apiKeyId - API key ID
   * @returns QuotaUsage record
   */
  private getOrCreateUsage(apiKeyId: string): QuotaUsage {
    let usage = this.usageMap.get(apiKeyId);
    if (!usage) {
      const now = Date.now();
      usage = {
        requests: 0,
        tokens: 0,
        requestWindowStart: this.getMinuteWindowStart(now),
        tokenWindowStart: this.getDayWindowStart(now),
      };
      this.usageMap.set(apiKeyId, usage);
    }
    return usage;
  }

  /**
   * Get start timestamp of current minute window
   * Window boundary: HH:MM:00.000
   *
   * @param timestamp - Current timestamp (ms)
   * @returns Window start timestamp (ms)
   */
  private getMinuteWindowStart(timestamp: number): number {
    // Round down to minute boundary
    return Math.floor(timestamp / 60000) * 60000;
  }

  /**
   * Get start timestamp of current day window (UTC)
   * Window boundary: 00:00:00.000 UTC
   *
   * @param timestamp - Current timestamp (ms)
   * @returns Window start timestamp (ms)
   */
  private getDayWindowStart(timestamp: number): number {
    // Round down to day boundary (UTC)
    return Math.floor(timestamp / 86400000) * 86400000;
  }
}
