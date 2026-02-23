import { QuotaConfig } from '../quota.config';

describe('QuotaConfig', () => {
  describe('getQuotaLimits', () => {
    it('should return configured limits for known API keys', () => {
      const limits = QuotaConfig.getQuotaLimits('key-test');
      expect(limits).toBeDefined();
      expect(limits.requestsPerMinute).toBe(100);
      expect(limits.tokensPerDay).toBe(100000);
    });

    it('should return default limits for unknown API keys', () => {
      const limits = QuotaConfig.getQuotaLimits('unknown-key');
      expect(limits).toBeDefined();
      expect(limits.requestsPerMinute).toBe(QuotaConfig.DEFAULT_QUOTA.requestsPerMinute);
      expect(limits.tokensPerDay).toBe(QuotaConfig.DEFAULT_QUOTA.tokensPerDay);
    });

    it('should return configured limits for key-1', () => {
      const limits = QuotaConfig.getQuotaLimits('key-1');
      expect(limits.requestsPerMinute).toBe(100);
      expect(limits.tokensPerDay).toBe(10000);
    });

    it('should return configured limits for key-2', () => {
      const limits = QuotaConfig.getQuotaLimits('key-2');
      expect(limits.requestsPerMinute).toBe(100);
      expect(limits.tokensPerDay).toBe(10000);
    });

    it('should return consistent limits for same API key', () => {
      const limits1 = QuotaConfig.getQuotaLimits('key-test');
      const limits2 = QuotaConfig.getQuotaLimits('key-test');
      expect(limits1).toEqual(limits2);
    });
  });

  describe('estimateTokens', () => {
    it('should return conservative fixed estimate when no prompt provided', () => {
      const estimate = QuotaConfig.estimateTokens();
      expect(estimate).toBe(8000); // PHASE-42B-2: Conservative base estimate
    });

    it('should adjust estimate based on prompt length', () => {
      const estimate1 = QuotaConfig.estimateTokens(); // No prompt: 8000
      const estimate2 = QuotaConfig.estimateTokens('short'); // Short prompt: 8000 (base)
      const estimate3 = QuotaConfig.estimateTokens('a'.repeat(40000)); // Long prompt: 20000 tokens (40000 chars / 4 * 2)
      
      expect(estimate1).toBe(8000);
      expect(estimate2).toBe(8000); // Short prompt uses base estimate
      expect(estimate3).toBeGreaterThan(8000); // Long prompt increases estimate
    });

    it('should return positive non-zero estimate', () => {
      const estimate = QuotaConfig.estimateTokens();
      expect(estimate).toBeGreaterThan(0);
    });
  });

  describe('DEFAULT_QUOTA', () => {
    it('should have reasonable default values', () => {
      expect(QuotaConfig.DEFAULT_QUOTA.requestsPerMinute).toBeGreaterThan(0);
      expect(QuotaConfig.DEFAULT_QUOTA.tokensPerDay).toBeGreaterThan(0);
    });

    it('should have requests per minute less than reasonable burst', () => {
      // Sanity check: shouldn't be absurdly high
      expect(QuotaConfig.DEFAULT_QUOTA.requestsPerMinute).toBeLessThan(10000);
    });

    it('should have tokens per day sufficient for meaningful work', () => {
      // Sanity check: should be at least 1000 tokens
      expect(QuotaConfig.DEFAULT_QUOTA.tokensPerDay).toBeGreaterThanOrEqual(1000);
    });
  });
});
