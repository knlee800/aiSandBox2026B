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
      expect(limits.tokensPerDay).toBe(QuotaConfig.DEFAULT_QUOTA.tokensPerDay);
    });

    it('should return configured limits for key-2', () => {
      const limits = QuotaConfig.getQuotaLimits('key-2');
      expect(limits.requestsPerMinute).toBe(100);
      expect(limits.tokensPerDay).toBe(QuotaConfig.DEFAULT_QUOTA.tokensPerDay);
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

  describe('MAX_TOKENS_PER_24H', () => {
    const originalMaxTokensPer24h = process.env.MAX_TOKENS_PER_24H;

    afterEach(() => {
      if (originalMaxTokensPer24h === undefined) {
        delete process.env.MAX_TOKENS_PER_24H;
      } else {
        process.env.MAX_TOKENS_PER_24H = originalMaxTokensPer24h;
      }
    });

    function loadMaxTokensPer24h(): number {
      let limit = 0;
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { QuotaConfig: IsolatedQuotaConfig } = require('../quota.config');
        limit = IsolatedQuotaConfig.MAX_TOKENS_PER_24H;
      });
      return limit;
    }

    it('defaults to 1000000 when MAX_TOKENS_PER_24H is unset', () => {
      delete process.env.MAX_TOKENS_PER_24H;
      expect(loadMaxTokensPer24h()).toBe(1000000);
    });

    it('uses a valid MAX_TOKENS_PER_24H override', () => {
      process.env.MAX_TOKENS_PER_24H = '2500000';
      expect(loadMaxTokensPer24h()).toBe(2500000);
    });

    it('falls back to 1000000 when MAX_TOKENS_PER_24H is invalid', () => {
      process.env.MAX_TOKENS_PER_24H = 'not-a-number';
      expect(loadMaxTokensPer24h()).toBe(1000000);
    });
  });
});
