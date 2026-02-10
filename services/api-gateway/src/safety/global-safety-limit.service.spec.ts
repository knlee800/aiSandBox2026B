import { Test, TestingModule } from '@nestjs/testing';
import { GlobalSafetyLimitService } from './global-safety-limit.service';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';

describe('GlobalSafetyLimitService', () => {
  let service: GlobalSafetyLimitService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GlobalSafetyLimitService],
    }).compile();

    service = module.get<GlobalSafetyLimitService>(GlobalSafetyLimitService);
  });

  afterEach(() => {
    // Reset service state between tests
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkExecutionAllowed - max tokens validation', () => {
    it('should allow execution within max tokens limit', () => {
      expect(() => {
        service.checkExecutionAllowed('anthropic', 50000);
      }).not.toThrow();
    });

    it('should allow execution at exactly max tokens limit', () => {
      expect(() => {
        service.checkExecutionAllowed('anthropic', 100000);
      }).not.toThrow();
    });

    it('should throw Error when max tokens exceeded', () => {
      expect(() => {
        service.checkExecutionAllowed('anthropic', 100001);
      }).toThrow(Error);
      expect(() => {
        service.checkExecutionAllowed('anthropic', 100001);
      }).toThrow('exceeds platform limit');
    });

    it('should allow execution with undefined max_tokens', () => {
      expect(() => {
        service.checkExecutionAllowed('anthropic', undefined);
      }).not.toThrow();
    });
  });

  describe('checkExecutionAllowed - global rate limiting', () => {
    it('should allow executions up to global rate limit', () => {
      // Record 9,999 executions using different providers to avoid provider limits
      // Use groq which has 10,000/min limit
      for (let i = 0; i < 9999; i++) {
        service.recordExecution('groq');
      }

      // Should still allow check (9999 < 10000 global limit)
      expect(() => {
        service.checkExecutionAllowed('groq', 1000);
      }).not.toThrow();
    });

    it('should throw error when global rate limit exceeded', () => {
      // Record 10,000 executions using high-limit provider
      for (let i = 0; i < 10000; i++) {
        service.recordExecution('groq');
      }

      // Now the next check should fail (count >= 10000)
      expect(() => {
        service.checkExecutionAllowed('groq', 1000);
      }).toThrow('Platform rate limit exceeded');
    });
  });

  describe('checkExecutionAllowed - provider rate limiting', () => {
    it('should allow executions up to provider rate limit', () => {
      // Anthropic provider rate limit is 3000/min - record 2999 (under limit)
      for (let i = 0; i < 2999; i++) {
        service.recordExecution('anthropic');
      }

      // Should still allow check (2999 < 3000)
      expect(() => {
        service.checkExecutionAllowed('anthropic', 1000);
      }).not.toThrow();
    });

    it('should throw error when provider rate limit exceeded', () => {
      // Record 3000 executions for anthropic (at 3000/min limit)
      for (let i = 0; i < 3000; i++) {
        service.recordExecution('anthropic');
      }

      // Next check should fail (count >= 3000)
      expect(() => {
        service.checkExecutionAllowed('anthropic', 1000);
      }).toThrow('Provider anthropic rate limit exceeded');
    });

    it('should enforce different rate limits for different providers', () => {
      // OpenAI limit is 5000/min, Anthropic is 3000/min
      // Record 3000 anthropic executions (at anthropic limit)
      for (let i = 0; i < 3000; i++) {
        service.recordExecution('anthropic');
      }

      // Anthropic should be at limit
      expect(() => {
        service.checkExecutionAllowed('anthropic', 1000);
      }).toThrow('Provider anthropic rate limit exceeded');

      // But OpenAI should still work (different limit)
      expect(() => {
        service.checkExecutionAllowed('openai', 1000);
      }).not.toThrow();
    });

    it('should track providers separately', () => {
      // Record with lowercase provider names (as guard normalizes them)
      for (let i = 0; i < 1000; i++) {
        service.recordExecution('anthropic');
      }

      // Check that anthropic is tracked
      expect(service.getCurrentProviderRate('anthropic')).toBe(1000);

      // Different provider should be independent
      expect(service.getCurrentProviderRate('openai')).toBe(0);
    });

    it('should use default rate limit for unknown providers', () => {
      // Unknown provider gets 1000/min default limit
      for (let i = 0; i < 1000; i++) {
        service.recordExecution('unknown-provider');
      }

      // Should be at limit
      expect(() => {
        service.checkExecutionAllowed('unknown-provider', 1000);
      }).toThrow('Provider unknown-provider rate limit exceeded');
    });
  });

  describe('checkExecutionAllowed - daily spend limits', () => {
    it('should allow execution within soft daily spend limit', () => {
      // Record $5,000 in costs (under $10,000 soft limit)
      service.recordExecutionCost(5000);

      expect(() => {
        service.checkExecutionAllowed('anthropic', 1000);
      }).not.toThrow();
    });

    it('should log warning at soft daily spend limit but not throw', () => {
      // Spy on logger warn
      const loggerWarnSpy = jest
        .spyOn(service['logger'], 'warn')
        .mockImplementation();

      // Record $10,000 in costs (at soft limit)
      service.recordExecutionCost(10000);

      // Check should still pass (soft limit is warning only)
      expect(() => {
        service.checkExecutionAllowed('anthropic', 1000);
      }).not.toThrow();

      // Should have logged warning
      expect(loggerWarnSpy).toHaveBeenCalled();
      expect(loggerWarnSpy.mock.calls[0][0]).toContain('Daily spend soft cap');

      loggerWarnSpy.mockRestore();
    });

    it('should throw error at hard daily spend limit', () => {
      // Record $20,000 in costs (at hard limit)
      service.recordExecutionCost(20000);

      expect(() => {
        service.checkExecutionAllowed('anthropic', 1000);
      }).toThrow('Platform daily spend limit reached');
    });

    it('should block execution when exceeding hard daily spend limit', () => {
      // Record $20,001 in costs (over hard limit)
      service.recordExecutionCost(20001);

      expect(() => {
        service.checkExecutionAllowed('anthropic', 1000);
      }).toThrow('Platform daily spend limit reached');
    });
  });

  describe('recordExecution', () => {
    it('should increment global execution count', () => {
      const initialRate = service.getCurrentGlobalRate();
      service.recordExecution('anthropic');
      const newRate = service.getCurrentGlobalRate();

      expect(newRate).toBe(initialRate + 1);
    });

    it('should increment provider-specific execution count', () => {
      const initialRate = service.getCurrentProviderRate('anthropic');
      service.recordExecution('anthropic');
      const newRate = service.getCurrentProviderRate('anthropic');

      expect(newRate).toBe(initialRate + 1);
    });

    it('should handle multiple providers independently', () => {
      service.recordExecution('anthropic');
      service.recordExecution('openai');

      expect(service.getCurrentProviderRate('anthropic')).toBe(1);
      expect(service.getCurrentProviderRate('openai')).toBe(1);
      expect(service.getCurrentGlobalRate()).toBe(2);
    });

    it('should track provider names as provided', () => {
      // Service doesn't normalize - guard does
      service.recordExecution('anthropic');
      service.recordExecution('anthropic');
      service.recordExecution('anthropic');

      // Should all count for same provider
      expect(service.getCurrentProviderRate('anthropic')).toBe(3);
    });
  });

  describe('recordExecutionCost', () => {
    it('should accumulate daily spend', () => {
      const initialSpend = service.getCurrentDailySpend();

      service.recordExecutionCost(10.5);
      service.recordExecutionCost(5.25);

      const finalSpend = service.getCurrentDailySpend();
      expect(finalSpend).toBe(initialSpend + 15.75);
    });

    it('should handle zero cost', () => {
      const initialSpend = service.getCurrentDailySpend();
      service.recordExecutionCost(0);
      expect(service.getCurrentDailySpend()).toBe(initialSpend);
    });

    it('should handle fractional cents', () => {
      service.recordExecutionCost(0.001);
      service.recordExecutionCost(0.002);
      expect(service.getCurrentDailySpend()).toBe(0.003);
    });
  });

  describe('getCurrentGlobalRate', () => {
    it('should return 0 when no executions recorded', () => {
      expect(service.getCurrentGlobalRate()).toBe(0);
    });

    it('should return correct count after executions', () => {
      service.recordExecution('anthropic');
      service.recordExecution('openai');
      service.recordExecution('groq');

      expect(service.getCurrentGlobalRate()).toBe(3);
    });
  });

  describe('getCurrentProviderRate', () => {
    it('should return 0 for provider with no executions', () => {
      expect(service.getCurrentProviderRate('anthropic')).toBe(0);
    });

    it('should return correct count for specific provider', () => {
      service.recordExecution('anthropic');
      service.recordExecution('anthropic');
      service.recordExecution('openai');

      expect(service.getCurrentProviderRate('anthropic')).toBe(2);
      expect(service.getCurrentProviderRate('openai')).toBe(1);
    });

    it('should track provider rates correctly', () => {
      service.recordExecution('anthropic');
      // Provider names should match exactly as recorded
      expect(service.getCurrentProviderRate('anthropic')).toBe(1);
    });
  });

  describe('getCurrentDailySpend', () => {
    it('should return 0 when no costs recorded', () => {
      expect(service.getCurrentDailySpend()).toBe(0);
    });

    it('should return accumulated costs', () => {
      service.recordExecutionCost(100);
      service.recordExecutionCost(50);
      service.recordExecutionCost(25.5);

      expect(service.getCurrentDailySpend()).toBe(175.5);
    });
  });

  describe('Deterministic behavior', () => {
    it('should produce same result for same inputs (idempotent checks)', () => {
      // Same check multiple times should work
      service.checkExecutionAllowed('anthropic', 1000);
      service.checkExecutionAllowed('anthropic', 1000);
      service.checkExecutionAllowed('anthropic', 1000);

      // Should not throw (checks don't modify state)
      expect(() => {
        service.checkExecutionAllowed('anthropic', 1000);
      }).not.toThrow();
    });

    it('should enforce limits deterministically across multiple checks', () => {
      // Record exactly at global limit
      for (let i = 0; i < 10000; i++) {
        service.recordExecution('anthropic');
      }

      // Every subsequent check should fail consistently (count >= 10000)
      expect(() => {
        service.checkExecutionAllowed('anthropic', 1000);
      }).toThrow('Platform rate limit exceeded');

      expect(() => {
        service.checkExecutionAllowed('anthropic', 1000);
      }).toThrow('Platform rate limit exceeded');
    });

    it('should enforce same limits regardless of provider order', () => {
      // Record in different order
      const service1 = new GlobalSafetyLimitService();
      service1.recordExecution('anthropic');
      service1.recordExecution('openai');

      const service2 = new GlobalSafetyLimitService();
      service2.recordExecution('openai');
      service2.recordExecution('anthropic');

      // Both should have same global rate
      expect(service1.getCurrentGlobalRate()).toBe(2);
      expect(service2.getCurrentGlobalRate()).toBe(2);
    });
  });

  describe('Edge cases', () => {
    it('should throw error for undefined provider', () => {
      // Service expects valid provider string, config will crash on undefined
      service.recordExecution(undefined as any);

      // checkExecutionAllowed should throw when getting provider limit
      expect(() => {
        service.checkExecutionAllowed(undefined as any, 1000);
      }).toThrow();
    });

    it('should handle empty string provider', () => {
      expect(() => {
        service.recordExecution('');
      }).not.toThrow();

      expect(service.getCurrentProviderRate('')).toBe(1);
    });

    it('should handle negative max tokens', () => {
      expect(() => {
        service.checkExecutionAllowed('anthropic', -1);
      }).not.toThrow(); // Negative is treated as undefined/default
    });

    it('should throw for very large token counts', () => {
      expect(() => {
        service.checkExecutionAllowed('anthropic', 1000000);
      }).toThrow('exceeds platform limit');
    });

    it('should handle very small cost amounts', () => {
      service.recordExecutionCost(0.0001);
      expect(service.getCurrentDailySpend()).toBe(0.0001);
    });

    it('should handle very large cost amounts', () => {
      service.recordExecutionCost(50000);
      expect(service.getCurrentDailySpend()).toBe(50000);
    });
  });

  describe('Multiple limit interactions', () => {
    it('should enforce all limits in priority order', () => {
      // Exceed max tokens first (should fail immediately)
      expect(() => {
        service.checkExecutionAllowed('anthropic', 200000);
      }).toThrow('exceeds platform limit');
    });

    it('should check global rate before provider rate', () => {
      // Fill up global limit with different providers
      for (let i = 0; i < 5000; i++) {
        service.recordExecution('openai');
      }
      for (let i = 0; i < 5000; i++) {
        service.recordExecution('anthropic');
      }

      // Global limit reached (10000 >= 10000)
      expect(() => {
        service.checkExecutionAllowed('groq', 1000);
      }).toThrow('Platform rate limit exceeded');
    });

    it('should check provider rate after global rate', () => {
      // Hit provider limit but not global limit
      for (let i = 0; i < 3000; i++) {
        service.recordExecution('anthropic');
      }

      // Global rate: 3000 (under 10,000 limit)
      // Anthropic rate: 3000 (at 3,000 limit)
      expect(() => {
        service.checkExecutionAllowed('anthropic', 1000);
      }).toThrow('Provider anthropic rate limit exceeded');
    });

    it('should check daily spend after rate limits', () => {
      // Hit hard daily spend limit
      service.recordExecutionCost(20000);

      // Should fail on daily spend, not rate limits
      expect(() => {
        service.checkExecutionAllowed('anthropic', 1000);
      }).toThrow('Platform daily spend limit reached');
    });
  });
});
