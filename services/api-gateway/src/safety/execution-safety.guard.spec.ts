import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { ExecutionSafetyGuard } from './execution-safety.guard';
import { GlobalSafetyLimitService } from './global-safety-limit.service';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { KillSwitchConfig } from './kill-switch.config';

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
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExecutionSafetyGuard, GlobalSafetyLimitService],
    }).compile();

    guard = module.get<ExecutionSafetyGuard>(ExecutionSafetyGuard);
    globalSafetyLimitService = module.get<GlobalSafetyLimitService>(
      GlobalSafetyLimitService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

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
        provider: 'openai',
        max_tokens: 1000,
      });

      expect(() => {
        guard.canActivate(context);
      }).toThrow(ServiceUnavailableException);

      expect(() => {
        guard.canActivate(context);
      }).toThrow('Provider openai temporarily unavailable');
    });

    it('should normalize provider name when checking kill switch', () => {
      const isProviderEnabledSpy = jest.spyOn(
        KillSwitchConfig,
        'isProviderEnabled',
      );

      const context = createMockExecutionContext({
        provider: 'Anthropic', // Mixed case
        max_tokens: 1000,
      });

      guard.canActivate(context);

      // Should have called with lowercase
      expect(isProviderEnabledSpy).toHaveBeenCalledWith('anthropic');
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
        provider: 'anthropic',
        max_tokens: 5000,
      });

      guard.canActivate(context);

      expect(checkSpy).toHaveBeenCalledWith('anthropic', 5000);
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
      // Fill up global rate limit
      for (let i = 0; i < 10000; i++) {
        globalSafetyLimitService.recordExecution('anthropic');
      }

      const context = createMockExecutionContext({
        provider: 'anthropic',
        max_tokens: 1000,
      });

      expect(() => {
        guard.canActivate(context);
      }).toThrow('Global execution rate limit exceeded');
    });

    it('should propagate daily spend limit errors as ServiceUnavailableException', () => {
      // Hit hard daily spend limit
      globalSafetyLimitService.recordExecutionCost(20000);

      const context = createMockExecutionContext({
        provider: 'anthropic',
        max_tokens: 1000,
      });

      expect(() => {
        guard.canActivate(context);
      }).toThrow(ServiceUnavailableException);
    });
  });

  describe('canActivate - recordExecution call', () => {
    it('should call recordExecution after successful checks', () => {
      const recordSpy = jest.spyOn(globalSafetyLimitService, 'recordExecution');

      const context = createMockExecutionContext({
        provider: 'anthropic',
        max_tokens: 1000,
      });

      guard.canActivate(context);

      expect(recordSpy).toHaveBeenCalledWith('anthropic');
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
        provider: 'Anthropic', // Mixed case
        max_tokens: 1000,
      });

      guard.canActivate(context);

      expect(recordSpy).toHaveBeenCalledWith('anthropic');
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
      // Hit provider rate limit
      for (let i = 0; i < 1000; i++) {
        globalSafetyLimitService.recordExecution('anthropic');
      }

      const context = createMockExecutionContext({
        provider: 'anthropic',
        max_tokens: 1000,
      });

      expect(() => {
        guard.canActivate(context);
      }).toThrow('rate limit');
    });

    it('should map daily spend error to ServiceUnavailableException', () => {
      globalSafetyLimitService.recordExecutionCost(25000);

      const context = createMockExecutionContext({
        provider: 'anthropic',
        max_tokens: 1000,
      });

      expect(() => {
        guard.canActivate(context);
      }).toThrow(ServiceUnavailableException);
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
        provider: 'openai',
        max_tokens: 2000,
      });

      guard.canActivate(context);

      expect(checkSpy).toHaveBeenCalledWith('openai', 2000);
    });

    it('should extract max_tokens from body correctly', () => {
      const checkSpy = jest.spyOn(
        globalSafetyLimitService,
        'checkExecutionAllowed',
      );

      const context = createMockExecutionContext({
        provider: 'anthropic',
        max_tokens: 50000,
      });

      guard.canActivate(context);

      expect(checkSpy).toHaveBeenCalledWith('anthropic', 50000);
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
});
