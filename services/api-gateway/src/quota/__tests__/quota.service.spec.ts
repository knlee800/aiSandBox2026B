import { QuotaService } from '../quota.service';
import { QuotaConfig } from '../quota.config';

describe('QuotaService', () => {
  let quotaService: QuotaService;
  let originalDateNow: () => number;

  beforeEach(() => {
    quotaService = new QuotaService();
    // Save original Date.now
    originalDateNow = Date.now;
  });

  afterEach(() => {
    // Restore original Date.now
    Date.now = originalDateNow;
  });

  describe('checkRequestQuota', () => {
    it('should allow requests within quota', () => {
      const apiKeyId = 'key-test';
      const limits = QuotaConfig.getQuotaLimits(apiKeyId);

      // First request should be allowed
      expect(quotaService.checkRequestQuota(apiKeyId)).toBe(true);

      // Record requests up to limit - 1
      for (let i = 0; i < limits.requestsPerMinute - 1; i++) {
        quotaService.recordRequest(apiKeyId);
      }

      // Should still be allowed (at limit - 1)
      expect(quotaService.checkRequestQuota(apiKeyId)).toBe(true);
    });

    it('should deny requests when quota exceeded', () => {
      const apiKeyId = 'key-test';
      const limits = QuotaConfig.getQuotaLimits(apiKeyId);

      // Fill up quota
      for (let i = 0; i < limits.requestsPerMinute; i++) {
        quotaService.recordRequest(apiKeyId);
      }

      // Next request should be denied
      expect(quotaService.checkRequestQuota(apiKeyId)).toBe(false);
    });

    it('should reset quota at minute boundary', () => {
      const apiKeyId = 'key-test';
      const limits = QuotaConfig.getQuotaLimits(apiKeyId);
      const baseTime = 1000 * 60 * 10; // 10 minutes past epoch

      // Mock time at start of minute
      Date.now = jest.fn(() => baseTime);

      // Fill up quota
      for (let i = 0; i < limits.requestsPerMinute; i++) {
        quotaService.recordRequest(apiKeyId);
      }

      // Quota exhausted
      expect(quotaService.checkRequestQuota(apiKeyId)).toBe(false);

      // Advance to next minute
      Date.now = jest.fn(() => baseTime + 60000);

      // Quota should be reset
      expect(quotaService.checkRequestQuota(apiKeyId)).toBe(true);
    });

    it('should track quotas independently per apiKeyId', () => {
      const apiKeyId1 = 'key-1';
      const apiKeyId2 = 'key-2';
      const limits1 = QuotaConfig.getQuotaLimits(apiKeyId1);

      // Fill up quota for key-1
      for (let i = 0; i < limits1.requestsPerMinute; i++) {
        quotaService.recordRequest(apiKeyId1);
      }

      // key-1 exhausted
      expect(quotaService.checkRequestQuota(apiKeyId1)).toBe(false);

      // key-2 still has quota
      expect(quotaService.checkRequestQuota(apiKeyId2)).toBe(true);
    });
  });

  describe('checkTokenQuota', () => {
    it('should allow token usage within quota', () => {
      const apiKeyId = 'key-test';
      const limits = QuotaConfig.getQuotaLimits(apiKeyId);

      // Should allow tokens up to limit
      expect(quotaService.checkTokenQuota(apiKeyId, limits.tokensPerDay)).toBe(
        true,
      );
    });

    it('should deny token usage when quota would be exceeded', () => {
      const apiKeyId = 'key-test';
      const limits = QuotaConfig.getQuotaLimits(apiKeyId);

      // Use up most of quota
      quotaService.recordTokens(apiKeyId, limits.tokensPerDay - 100);

      // Should deny request that would exceed
      expect(quotaService.checkTokenQuota(apiKeyId, 200)).toBe(false);
    });

    it('should allow token usage exactly at quota limit', () => {
      const apiKeyId = 'key-test';
      const limits = QuotaConfig.getQuotaLimits(apiKeyId);

      // Use tokens exactly at limit
      quotaService.recordTokens(apiKeyId, limits.tokensPerDay);

      // No more tokens available
      expect(quotaService.checkTokenQuota(apiKeyId, 1)).toBe(false);
    });

    it('should reset token quota at day boundary', () => {
      const apiKeyId = 'key-test';
      const limits = QuotaConfig.getQuotaLimits(apiKeyId);
      const baseTime = 1000 * 60 * 60 * 24 * 5; // 5 days past epoch

      // Mock time at start of day
      Date.now = jest.fn(() => baseTime);

      // Fill up token quota
      quotaService.recordTokens(apiKeyId, limits.tokensPerDay);

      // Quota exhausted
      expect(quotaService.checkTokenQuota(apiKeyId, 1)).toBe(false);

      // Advance to next day
      Date.now = jest.fn(() => baseTime + 86400000);

      // Quota should be reset
      expect(quotaService.checkTokenQuota(apiKeyId, limits.tokensPerDay)).toBe(
        true,
      );
    });

    it('should track token quotas independently per apiKeyId', () => {
      const apiKeyId1 = 'key-1';
      const apiKeyId2 = 'key-2';
      const limits1 = QuotaConfig.getQuotaLimits(apiKeyId1);

      // Fill up token quota for key-1
      quotaService.recordTokens(apiKeyId1, limits1.tokensPerDay);

      // key-1 exhausted
      expect(quotaService.checkTokenQuota(apiKeyId1, 1)).toBe(false);

      // key-2 still has quota
      expect(quotaService.checkTokenQuota(apiKeyId2, 1000)).toBe(true);
    });
  });

  describe('recordRequest', () => {
    it('should increment request count', () => {
      const apiKeyId = 'key-test';

      // Record multiple requests
      quotaService.recordRequest(apiKeyId);
      quotaService.recordRequest(apiKeyId);
      quotaService.recordRequest(apiKeyId);

      const usage = quotaService.getCurrentUsage(apiKeyId);
      expect(usage.requests).toBe(3);
    });

    it('should reset count at window boundary', () => {
      const apiKeyId = 'key-test';
      const baseTime = 1000 * 60 * 10;

      Date.now = jest.fn(() => baseTime);

      // Record requests
      quotaService.recordRequest(apiKeyId);
      quotaService.recordRequest(apiKeyId);

      expect(quotaService.getCurrentUsage(apiKeyId).requests).toBe(2);

      // Advance to next minute
      Date.now = jest.fn(() => baseTime + 60000);

      // Record request in new window
      quotaService.recordRequest(apiKeyId);

      // Should show only 1 request
      expect(quotaService.getCurrentUsage(apiKeyId).requests).toBe(1);
    });
  });

  describe('recordTokens', () => {
    it('should increment token count', () => {
      const apiKeyId = 'key-test';

      // Record tokens
      quotaService.recordTokens(apiKeyId, 100);
      quotaService.recordTokens(apiKeyId, 200);
      quotaService.recordTokens(apiKeyId, 300);

      const usage = quotaService.getCurrentUsage(apiKeyId);
      expect(usage.tokens).toBe(600);
    });

    it('should reset count at window boundary', () => {
      const apiKeyId = 'key-test';
      const baseTime = 1000 * 60 * 60 * 24 * 5;

      Date.now = jest.fn(() => baseTime);

      // Record tokens
      quotaService.recordTokens(apiKeyId, 500);

      expect(quotaService.getCurrentUsage(apiKeyId).tokens).toBe(500);

      // Advance to next day
      Date.now = jest.fn(() => baseTime + 86400000);

      // Record tokens in new window
      quotaService.recordTokens(apiKeyId, 100);

      // Should show only 100 tokens
      expect(quotaService.getCurrentUsage(apiKeyId).tokens).toBe(100);
    });
  });

  describe('getCurrentUsage', () => {
    it('should return zero for unknown apiKeyId', () => {
      const usage = quotaService.getCurrentUsage('unknown-key');
      expect(usage.requests).toBe(0);
      expect(usage.tokens).toBe(0);
    });

    it('should return current usage for known apiKeyId', () => {
      const apiKeyId = 'key-test';

      quotaService.recordRequest(apiKeyId);
      quotaService.recordTokens(apiKeyId, 250);

      const usage = quotaService.getCurrentUsage(apiKeyId);
      expect(usage.requests).toBe(1);
      expect(usage.tokens).toBe(250);
    });

    it('should return zero for expired windows', () => {
      const apiKeyId = 'key-test';
      const baseTime = 1000 * 60 * 60 * 24 * 5;

      Date.now = jest.fn(() => baseTime);

      // Record usage
      quotaService.recordRequest(apiKeyId);
      quotaService.recordTokens(apiKeyId, 500);

      // Advance time beyond both windows
      Date.now = jest.fn(() => baseTime + 86400000 + 60000);

      const usage = quotaService.getCurrentUsage(apiKeyId);
      expect(usage.requests).toBe(0); // Minute window expired
      expect(usage.tokens).toBe(0); // Day window expired
    });
  });

  describe('clearAll', () => {
    it('should clear all quota state', () => {
      const apiKeyId1 = 'key-1';
      const apiKeyId2 = 'key-2';

      // Record usage for multiple keys
      quotaService.recordRequest(apiKeyId1);
      quotaService.recordTokens(apiKeyId1, 100);
      quotaService.recordRequest(apiKeyId2);
      quotaService.recordTokens(apiKeyId2, 200);

      // Clear all
      quotaService.clearAll();

      // All usage should be zero
      expect(quotaService.getCurrentUsage(apiKeyId1).requests).toBe(0);
      expect(quotaService.getCurrentUsage(apiKeyId1).tokens).toBe(0);
      expect(quotaService.getCurrentUsage(apiKeyId2).requests).toBe(0);
      expect(quotaService.getCurrentUsage(apiKeyId2).tokens).toBe(0);
    });
  });

  describe('deterministic behavior', () => {
    it('should produce same results for same inputs within window', () => {
      const apiKeyId = 'key-test';
      const baseTime = 1000 * 60 * 60 * 24 * 5;

      Date.now = jest.fn(() => baseTime);

      // Check quota multiple times without recording
      const result1 = quotaService.checkRequestQuota(apiKeyId);
      const result2 = quotaService.checkRequestQuota(apiKeyId);
      const result3 = quotaService.checkRequestQuota(apiKeyId);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('should produce consistent results across window transitions', () => {
      const apiKeyId = 'key-test';
      const limits = QuotaConfig.getQuotaLimits(apiKeyId);
      const baseTime = 1000 * 60 * 10;

      Date.now = jest.fn(() => baseTime);

      // Fill quota
      for (let i = 0; i < limits.requestsPerMinute; i++) {
        quotaService.recordRequest(apiKeyId);
      }

      // Exhausted
      expect(quotaService.checkRequestQuota(apiKeyId)).toBe(false);

      // Advance to next window
      Date.now = jest.fn(() => baseTime + 60000);

      // Available again
      expect(quotaService.checkRequestQuota(apiKeyId)).toBe(true);

      // Fill quota again
      for (let i = 0; i < limits.requestsPerMinute; i++) {
        quotaService.recordRequest(apiKeyId);
      }

      // Exhausted again
      expect(quotaService.checkRequestQuota(apiKeyId)).toBe(false);
    });
  });
});
