import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { ExecutionSafetyGuard } from './execution-safety.guard';
import { GlobalSafetyLimitService } from './global-safety-limit.service';
import { DailyCreditCapService } from './daily-credit-cap.service';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { KillSwitchConfig } from './kill-switch.config';

type CapQuery = {
  select: () => CapQuery;
  where: () => CapQuery;
  andWhere: () => CapQuery;
  getRawOne: () => Promise<{ total: string }>;
};

function ledgerReturning(total: string): { createQueryBuilder: () => CapQuery } {
  return {
    createQueryBuilder: () => {
      const qb: CapQuery = {
        select: () => qb,
        where: () => qb,
        andWhere: () => qb,
        getRawOne: async () => ({ total }),
      };
      return qb;
    },
  };
}

describe('ExecutionSafetyGuard', () => {
  let guard: ExecutionSafetyGuard;
  let globalSafetyLimitService: GlobalSafetyLimitService;

  // Mock execution context
  const createMockExecutionContext = (body: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          body,
        }),
      }),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    // Ensure kill switches are ON regardless of developer machine .env values.
    // KillSwitchConfig.GLOBAL_EXECUTION_ENABLED is a static getter that reads
    // process.env live on every call, so setting it here takes effect immediately.
    process.env.GLOBAL_EXECUTION_ENABLED = 'true';

    const module: TestingModule = await Test.createTestingModule({
      providers: [ExecutionSafetyGuard, GlobalSafetyLimitService],
    }).compile();

    guard = module.get<ExecutionSafetyGuard>(ExecutionSafetyGuard);
    globalSafetyLimitService = module.get<GlobalSafetyLimitService>(
      GlobalSafetyLimitService,
    );
  });

  afterEach(() => {
    // restoreAllMocks resets spy implementations (including getter spies on
    // KillSwitchConfig) so they do not bleed into subsequent tests.
    jest.restoreAllMocks();
    // Restore kill switch env var to avoid cross-test pollution from .env files.
    process.env.GLOBAL_EXECUTION_ENABLED = 'true';
  });

  // The guard reads provider from process.env.AI_PROVIDER, NOT from request body.
  // All provider assertions must use the actual runtime provider.
  const testProvider = (process.env.AI_PROVIDER || 'stub').toLowerCase();

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate - successful execution', () => {
    it('should return true when all checks pass', () => {
      const context = createMockExecutionContext({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
      });

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should return true for request without max_tokens', () => {
      const context = createMockExecutionContext({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
      });

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should return true for request with valid max_tokens at limit', () => {
      const context = createMockExecutionContext({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100000, // Exactly at limit
      });

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  describe('canActivate - global kill switch enforcement', () => {
    it('should throw ServiceUnavailableException when global execution disabled', () => {
      // Mock kill switch as disabled
      jest
        .spyOn(KillSwitchConfig, 'GLOBAL_EXECUTION_ENABLED', 'get')
        .mockReturnValue(false);

      const context = createMockExecutionContext({
        provider: 'anthropic',
        max_tokens: 1000,
      });

      expect(() => {
        guard.canActivate(context);
      }).toThrow(ServiceUnavailableException);

      expect(() => {
        guard.canActivate(context);
      }).toThrow('AI execution temporarily disabled for maintenance');
    });

    it('should NOT call safety limit service when global kill switch disabled', () => {
      jest
        .spyOn(KillSwitchConfig, 'GLOBAL_EXECUTION_ENABLED', 'get')
        .mockReturnValue(false);

      const checkSpy = jest.spyOn(
        globalSafetyLimitService,
        'checkExecutionAllowed',
      );

      const context = createMockExecutionContext({
        provider: 'anthropic',
        max_tokens: 1000,
      });

      try {
        guard.canActivate(context);
      } catch (e) {
        // Expected to throw
      }

      // Should NOT have called safety checks (kill switch fails first)
      expect(checkSpy).not.toHaveBeenCalled();
    });
  });

  describe('canActivate - provider kill switch enforcement', () => {
    it('should throw ServiceUnavailableException when provider disabled', () => {
      jest
        .spyOn(KillSwitchConfig, 'isProviderEnabled')
        .mockReturnValue(false);

      const context = createMockExecutionContext({
        provider: testProvider,
        max_tokens: 1000,
      });

      expect(() => {
        guard.canActivate(context);
      }).toThrow(ServiceUnavailableException);

      expect(() => {
        guard.canActivate(context);
      }).toThrow(`Provider ${testProvider} temporarily unavailable`);
    });

    it('should normalize provider name when checking kill switch', () => {
      const isProviderEnabledSpy = jest.spyOn(
        KillSwitchConfig,
        'isProviderEnabled',
      );

      const context = createMockExecutionContext({
        provider: 'Anthropic', // body.provider is ignored by the guard
        max_tokens: 1000,
      });

      guard.canActivate(context);

      // Guard uses process.env.AI_PROVIDER (already normalized to lowercase)
      expect(isProviderEnabledSpy).toHaveBeenCalledWith(testProvider);
    });

    it('should handle missing provider gracefully', () => {
      const context = createMockExecutionContext({
        max_tokens: 1000,
        // No provider field
      });

      // Should use 'unknown' as default
      expect(() => {
        guard.canActivate(context);
      }).not.toThrow();
    });

    it('should NOT call safety limit service when provider kill switch disabled', () => {
      jest
        .spyOn(KillSwitchConfig, 'isProviderEnabled')
        .mockReturnValue(false);

      const checkSpy = jest.spyOn(
        globalSafetyLimitService,
        'checkExecutionAllowed',
      );

      const context = createMockExecutionContext({
        provider: 'openai',
        max_tokens: 1000,
      });

      try {
        guard.canActivate(context);
      } catch (e) {
        // Expected to throw
      }

      // Should NOT have called safety checks (kill switch fails first)
      expect(checkSpy).not.toHaveBeenCalled();
    });
  });

  describe('canActivate - global safety limit enforcement', () => {
    it('should call checkExecutionAllowed with correct parameters', () => {
      const checkSpy = jest.spyOn(
        globalSafetyLimitService,
        'checkExecutionAllowed',
      );

      const context = createMockExecutionContext({
        provider: 'anthropic', // body.provider is ignored; guard uses process.env.AI_PROVIDER
        max_tokens: 5000,
      });

      guard.canActivate(context);

      expect(checkSpy).toHaveBeenCalledWith(testProvider, 5000);
    });

    it('should throw BadRequestException when max_tokens exceeds limit', () => {
      const context = createMockExecutionContext({
        provider: 'anthropic',
        max_tokens: 200000, // Over 100,000 limit
      });

      expect(() => {
        guard.canActivate(context);
      }).toThrow(BadRequestException);
    });

    it('should propagate rate limit errors as-is', () => {
      // Fill up global rate limit (global counter is provider-agnostic)
      for (let i = 0; i < 10000; i++) {
        globalSafetyLimitService.recordExecution(testProvider);
      }

      const context = createMockExecutionContext({
        provider: testProvider,
        max_tokens: 1000,
      });

      expect(() => {
        guard.canActivate(context);
      }).toThrow('rate limit exceeded');
    });

  });

  describe('canActivate - recordExecution call', () => {
    it('should call recordExecution after successful checks', () => {
      const recordSpy = jest.spyOn(globalSafetyLimitService, 'recordExecution');

      const context = createMockExecutionContext({
        provider: 'anthropic', // body.provider is ignored; guard uses process.env.AI_PROVIDER
        max_tokens: 1000,
      });

      guard.canActivate(context);

      expect(recordSpy).toHaveBeenCalledWith(testProvider);
    });

    it('should NOT call recordExecution when checks fail', () => {
      const recordSpy = jest.spyOn(globalSafetyLimitService, 'recordExecution');

      jest
        .spyOn(KillSwitchConfig, 'GLOBAL_EXECUTION_ENABLED', 'get')
        .mockReturnValue(false);

      const context = createMockExecutionContext({
        provider: 'anthropic',
        max_tokens: 1000,
      });

      try {
        guard.canActivate(context);
      } catch (e) {
        // Expected to throw
      }

      expect(recordSpy).not.toHaveBeenCalled();
    });

    it('should call recordExecution with normalized provider name', () => {
      const recordSpy = jest.spyOn(globalSafetyLimitService, 'recordExecution');

      const context = createMockExecutionContext({
        provider: 'Anthropic', // body.provider is ignored; guard uses process.env.AI_PROVIDER
        max_tokens: 1000,
      });

      guard.canActivate(context);

      expect(recordSpy).toHaveBeenCalledWith(testProvider);
    });
  });

  describe('Error handling and mapping', () => {
    it('should map invalid token error to BadRequestException', () => {
      const context = createMockExecutionContext({
        provider: 'anthropic',
        max_tokens: 150000, // Over limit
      });

      expect(() => {
        guard.canActivate(context);
      }).toThrow(BadRequestException);
    });

    it('should map rate limit error to error with rate limit message', () => {
      // Hit provider rate limit — must use testProvider to fill the correct bucket
      for (let i = 0; i < 1000; i++) {
        globalSafetyLimitService.recordExecution(testProvider);
      }

      const context = createMockExecutionContext({
        provider: 'anthropic',
        max_tokens: 1000,
      });

      expect(() => {
        guard.canActivate(context);
      }).toThrow('rate limit');
    });

  });

  describe('Integration with request body', () => {
    it('should handle empty request body', () => {
      const context = createMockExecutionContext({});

      // Should not throw (uses defaults)
      expect(() => {
        guard.canActivate(context);
      }).not.toThrow();
    });

    it('should handle null request body', () => {
      const context = createMockExecutionContext(null);

      // Should not throw (uses empty object fallback)
      expect(() => {
        guard.canActivate(context);
      }).not.toThrow();
    });

    it('should handle undefined request body', () => {
      const context = createMockExecutionContext(undefined);

      // Should not throw (uses empty object fallback)
      expect(() => {
        guard.canActivate(context);
      }).not.toThrow();
    });

    it('should extract provider from body correctly', () => {
      const checkSpy = jest.spyOn(
        globalSafetyLimitService,
        'checkExecutionAllowed',
      );

      const context = createMockExecutionContext({
        provider: 'openai', // body.provider is ignored; guard uses process.env.AI_PROVIDER
        max_tokens: 2000,
      });

      guard.canActivate(context);

      expect(checkSpy).toHaveBeenCalledWith(testProvider, 2000);
    });

    it('should extract max_tokens from body correctly', () => {
      const checkSpy = jest.spyOn(
        globalSafetyLimitService,
        'checkExecutionAllowed',
      );

      const context = createMockExecutionContext({
        provider: 'anthropic', // body.provider is ignored; guard uses process.env.AI_PROVIDER
        max_tokens: 50000,
      });

      guard.canActivate(context);

      expect(checkSpy).toHaveBeenCalledWith(testProvider, 50000);
    });
  });

  describe('Deterministic behavior', () => {
    it('should produce consistent results for identical requests', () => {
      const context1 = createMockExecutionContext({
        provider: 'anthropic',
        max_tokens: 1000,
      });

      const context2 = createMockExecutionContext({
        provider: 'anthropic',
        max_tokens: 1000,
      });

      const result1 = guard.canActivate(context1);
      const result2 = guard.canActivate(context2);

      expect(result1).toBe(result2);
      expect(result1).toBe(true);
    });

    it('should consistently reject when kill switch disabled', () => {
      jest
        .spyOn(KillSwitchConfig, 'GLOBAL_EXECUTION_ENABLED', 'get')
        .mockReturnValue(false);

      const context = createMockExecutionContext({
        provider: 'anthropic',
        max_tokens: 1000,
      });

      expect(() => {
        guard.canActivate(context);
      }).toThrow(ServiceUnavailableException);

      expect(() => {
        guard.canActivate(context);
      }).toThrow(ServiceUnavailableException);
    });

    it('should consistently enforce limits at boundary', () => {
      // At exact limit
      const context = createMockExecutionContext({
        provider: 'anthropic',
        max_tokens: 100000,
      });

      expect(() => {
        guard.canActivate(context);
      }).not.toThrow();

      // Just over limit
      const contextOver = createMockExecutionContext({
        provider: 'anthropic',
        max_tokens: 100001,
      });

      expect(() => {
        guard.canActivate(contextOver);
      }).toThrow(BadRequestException);
    });
  });

  describe('Guard execution order invariants', () => {
    it('should check global kill switch before provider kill switch', () => {
      const globalKillSwitchSpy = jest
        .spyOn(KillSwitchConfig, 'GLOBAL_EXECUTION_ENABLED', 'get')
        .mockReturnValue(false);

      const providerKillSwitchSpy = jest.spyOn(
        KillSwitchConfig,
        'isProviderEnabled',
      );

      const context = createMockExecutionContext({
        provider: 'anthropic',
        max_tokens: 1000,
      });

      try {
        guard.canActivate(context);
      } catch (e) {
        // Expected to throw
      }

      // Global kill switch should be checked
      expect(globalKillSwitchSpy).toHaveBeenCalled();

      // Provider kill switch should NOT be checked (global failed first)
      expect(providerKillSwitchSpy).not.toHaveBeenCalled();
    });

    it('should check kill switches before safety limits', () => {
      jest
        .spyOn(KillSwitchConfig, 'GLOBAL_EXECUTION_ENABLED', 'get')
        .mockReturnValue(false);

      const checkSpy = jest.spyOn(
        globalSafetyLimitService,
        'checkExecutionAllowed',
      );

      const context = createMockExecutionContext({
        provider: 'anthropic',
        max_tokens: 1000,
      });

      try {
        guard.canActivate(context);
      } catch (e) {
        // Expected to throw
      }

      // Safety limits should NOT be checked (kill switch failed first)
      expect(checkSpy).not.toHaveBeenCalled();
    });

    it('should check safety limits before recording execution', () => {
      // Set up to fail safety check
      jest
        .spyOn(globalSafetyLimitService, 'checkExecutionAllowed')
        .mockImplementation(() => {
          throw new BadRequestException('Test error');
        });

      const recordSpy = jest.spyOn(globalSafetyLimitService, 'recordExecution');

      const context = createMockExecutionContext({
        provider: 'anthropic',
        max_tokens: 1000,
      });

      try {
        guard.canActivate(context);
      } catch (e) {
        // Expected to throw
      }

      // Should NOT have recorded execution (check failed)
      expect(recordSpy).not.toHaveBeenCalled();
    });
  });

  describe('P0 Kill-switch default-disabled behavior', () => {
    it('should throw ServiceUnavailableException when GLOBAL_EXECUTION_ENABLED is unset (fail-safe default)', () => {
      delete process.env.GLOBAL_EXECUTION_ENABLED;
      jest.restoreAllMocks();

      const context = createMockExecutionContext({});

      expect(() => {
        guard.canActivate(context);
      }).toThrow(ServiceUnavailableException);

      expect(() => {
        guard.canActivate(context);
      }).toThrow('AI execution temporarily disabled for maintenance');
    });

    it('should block before any safety-limit or recording side effect when disabled by default', () => {
      delete process.env.GLOBAL_EXECUTION_ENABLED;
      jest.restoreAllMocks();

      const checkSpy = jest.spyOn(globalSafetyLimitService, 'checkExecutionAllowed');
      const recordSpy = jest.spyOn(globalSafetyLimitService, 'recordExecution');

      const context = createMockExecutionContext({
        provider: 'anthropic',
        max_tokens: 1000,
      });

      try {
        guard.canActivate(context);
      } catch (e) {
        // Expected to throw
      }

      expect(checkSpy).not.toHaveBeenCalled();
      expect(recordSpy).not.toHaveBeenCalled();
    });

    it('should allow execution when GLOBAL_EXECUTION_ENABLED is explicitly set to true', () => {
      process.env.GLOBAL_EXECUTION_ENABLED = 'true';

      const context = createMockExecutionContext({});

      expect(() => {
        guard.canActivate(context);
      }).not.toThrow();
    });
  });

  describe('daily credit cap', () => {
    const originalPlatform = process.env.MAX_DAILY_CREDITS_PLATFORM;
    const originalUser = process.env.MAX_DAILY_CREDITS_PER_USER;

    beforeEach(() => {
      process.env.MAX_DAILY_CREDITS_PLATFORM = '1000';
      process.env.MAX_DAILY_CREDITS_PER_USER = '500';
    });

    afterEach(() => {
      if (originalPlatform === undefined) {
        delete process.env.MAX_DAILY_CREDITS_PLATFORM;
      } else {
        process.env.MAX_DAILY_CREDITS_PLATFORM = originalPlatform;
      }
      if (originalUser === undefined) {
        delete process.env.MAX_DAILY_CREDITS_PER_USER;
      } else {
        process.env.MAX_DAILY_CREDITS_PER_USER = originalUser;
      }
    });

    function collaborationContext(userId?: string): ExecutionContext {
      const apiKeyIdentity: { apiKeyId: string; userId?: string } = {
        apiKeyId: 'apikey-01',
      };
      if (userId !== undefined) {
        apiKeyIdentity.userId = userId;
      }
      return {
        switchToHttp: () => ({
          getRequest: () => ({
            body: {
              prompt: 'Review the plan',
              provider: 'stub',
            },
            apiKeyIdentity,
          }),
        }),
      } as ExecutionContext;
    }

    it('allows a collaboration request identified only by apiKeyIdentity.userId', async () => {
      const seenUserIds: Array<string | undefined> = [];
      const repo = {
        createQueryBuilder: () => {
          let userId: string | undefined;
          const qb: CapQuery = {
            select: () => qb,
            where: () => qb,
            andWhere: (_clause?: string, params?: { userId: string }) => {
              userId = params?.userId;
              return qb;
            },
            getRawOne: async () => {
              seenUserIds.push(userId);
              return { total: '10' };
            },
          };
          return qb;
        },
      };
      const capped = new ExecutionSafetyGuard(
        globalSafetyLimitService,
        new DailyCreditCapService(repo as never),
      );

      await expect(
        capped.canActivate(collaborationContext('user-01')),
      ).resolves.toBe(true);
      expect(seenUserIds).toContain('user-01');
    });

    it('refuses a request that has no user id', async () => {
      const repo = ledgerReturning('0');
      const queried = jest.spyOn(repo, 'createQueryBuilder');
      const capped = new ExecutionSafetyGuard(
        globalSafetyLimitService,
        new DailyCreditCapService(repo as never),
      );
      const recordSpy = jest.spyOn(globalSafetyLimitService, 'recordExecution');

      try {
        await capped.canActivate(collaborationContext());
        throw new Error('expected refusal');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(429);
        expect((error as HttpException).message).toBe('Daily credit limit reached');
      }
      expect(queried).not.toHaveBeenCalled();
      expect(recordSpy).not.toHaveBeenCalled();
    });

    it('logs one warning and skips the cap when the cap service is absent', () => {
      const warnSpy = jest
        .spyOn(guard['logger'], 'warn')
        .mockImplementation(() => undefined);
      const context = createMockExecutionContext({ max_tokens: 1000 });

      expect(guard.canActivate(context)).toBe(true);
      expect(guard.canActivate(context)).toBe(true);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });
});
