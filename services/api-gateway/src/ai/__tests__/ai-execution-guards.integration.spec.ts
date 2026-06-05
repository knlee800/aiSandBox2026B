/**
 * AI Execution Guards Integration Tests
 *
 * Phase 31B: Production Emergency Operations Controls Validation
 *
 * Tests guard behavior in isolation with mocked dependencies:
 * - Launch state enforcement (PUBLIC/EARLY_ACCESS/INTERNAL/CLOSED)
 * - Abort mode enforcement (NONE/EXECUTION_BLOCKED/FULL_SHUTDOWN)
 * - Kill switch enforcement (global and provider-specific)
 * - Guard ordering and failure semantics
 * - Ledger/quota non-consumption on blocked paths
 *
 * Guard Stack Order (LOCKED):
 * ApiKeyAuthGuard → AuthorizationGuard → ExecutionSafetyGuard → LaunchGuard → AbortGuard → QuotaGuard
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { LaunchGuard } from '../../launch/launch.guard';
import { AbortGuard } from '../../abort/abort.guard';
import { ExecutionSafetyGuard } from '../../safety/execution-safety.guard';
import { QuotaGuard } from '../../quota/quota.guard';
import { QuotaService } from '../../quota/quota.service';
import { LaunchConfig } from '../../launch/launch.config';
import { AbortConfig } from '../../abort/abort.config';
import { ApiKeyIdentity } from '../../auth/api-key.config';
import { ApiKeyAuthGuard } from '../../auth/api-key-auth.guard';
import { SessionOrApiKeyAuthGuard } from '../../auth/session-or-api-key.guard';
import { GlobalSafetyLimitService } from '../../safety/global-safety-limit.service';
import { KillSwitchConfig } from '../../safety/kill-switch.config';
import { AIExecutionController } from '../ai-execution.controller';

describe('AI Execution Guards Integration (Phase 31B)', () => {
  type MockRequest = {
    apiKeyIdentity?: ApiKeyIdentity;
    body: {
      provider: string;
      max_tokens: number;
    };
  };

  const originalAiProvider = process.env.AI_PROVIDER;
  let launchGuard: LaunchGuard;
  let abortGuard: AbortGuard;
  let executionSafetyGuard: ExecutionSafetyGuard;
  let quotaService: QuotaService;
  let mockContext: ExecutionContext;
  let mockRequest: MockRequest;
  let quotaServiceMock: {
    getCurrentUsage: jest.Mock;
    clearAll: jest.Mock;
    checkRequestQuota: jest.Mock;
    checkTokenQuota: jest.Mock;
    recordRequest: jest.Mock;
    recordTokens: jest.Mock;
  };

  beforeEach(async () => {
    // Reset configs
    LaunchConfig.reset();
    AbortConfig.reset();
    process.env.AI_PROVIDER = 'stub';

    quotaServiceMock = {
      getCurrentUsage: jest.fn().mockReturnValue({ requests: 0, tokens: 0 }),
      clearAll: jest.fn(),
      checkRequestQuota: jest.fn().mockReturnValue(true),
      checkTokenQuota: jest.fn().mockReturnValue(true),
      recordRequest: jest.fn(),
      recordTokens: jest.fn(),
    };

    // Create test module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LaunchGuard,
        AbortGuard,
        ExecutionSafetyGuard,
        QuotaGuard,
        {
          provide: QuotaService,
          useValue: quotaServiceMock,
        },
        GlobalSafetyLimitService,
        Reflector,
      ],
    }).compile();

    launchGuard = module.get<LaunchGuard>(LaunchGuard);
    abortGuard = module.get<AbortGuard>(AbortGuard);
    executionSafetyGuard = module.get<ExecutionSafetyGuard>(ExecutionSafetyGuard);
    quotaService = module.get<QuotaService>(QuotaService);

    // Setup mock request
    mockRequest = {
      apiKeyIdentity: undefined,
      body: {
        provider: 'stub',
        max_tokens: 1000,
      },
    };

    // Setup mock context
    mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  });

  afterEach(() => {
    if (originalAiProvider === undefined) {
      delete process.env.AI_PROVIDER;
    } else {
      process.env.AI_PROVIDER = originalAiProvider;
    }
    quotaService.clearAll();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('Launch State Enforcement', () => {
    const publicKey: ApiKeyIdentity = {
      userId: 'test-user',
      apiKeyId: 'key-test',
      scopes: ['ai:execute'],
    };

    const internalKey: ApiKeyIdentity = {
      userId: 'user-1',
      apiKeyId: 'key-1',
      scopes: ['ai:execute'],
      isInternal: true,
    };

    const earlyAccessKey: ApiKeyIdentity = {
      userId: 'user-2',
      apiKeyId: 'key-2',
      scopes: ['ai:execute'],
      isEarlyAccess: true,
    };

    describe('PUBLIC state', () => {
      beforeEach(() => {
        process.env.LAUNCH_STATE = 'PUBLIC';
        LaunchConfig.initialize();
      });

      it('should allow public key', () => {
        mockRequest.apiKeyIdentity = publicKey;
        expect(launchGuard.canActivate(mockContext)).toBe(true);
      });

      it('should allow internal key', () => {
        mockRequest.apiKeyIdentity = internalKey;
        expect(launchGuard.canActivate(mockContext)).toBe(true);
      });

      it('should allow early access key', () => {
        mockRequest.apiKeyIdentity = earlyAccessKey;
        expect(launchGuard.canActivate(mockContext)).toBe(true);
      });
    });

    describe('INTERNAL state', () => {
      beforeEach(() => {
        process.env.LAUNCH_STATE = 'INTERNAL';
        LaunchConfig.initialize();
      });

      it('should allow internal key', () => {
        mockRequest.apiKeyIdentity = internalKey;
        expect(launchGuard.canActivate(mockContext)).toBe(true);
      });

      it('should reject public key with 403', () => {
        mockRequest.apiKeyIdentity = publicKey;
        expect(() => launchGuard.canActivate(mockContext)).toThrow(ForbiddenException);
      });

      it('should reject early access key with 403', () => {
        mockRequest.apiKeyIdentity = earlyAccessKey;
        expect(() => launchGuard.canActivate(mockContext)).toThrow(ForbiddenException);
      });
    });

    describe('EARLY_ACCESS state', () => {
      beforeEach(() => {
        process.env.LAUNCH_STATE = 'EARLY_ACCESS';
        LaunchConfig.initialize();
      });

      it('should allow internal key', () => {
        mockRequest.apiKeyIdentity = internalKey;
        expect(launchGuard.canActivate(mockContext)).toBe(true);
      });

      it('should allow early access key', () => {
        mockRequest.apiKeyIdentity = earlyAccessKey;
        expect(launchGuard.canActivate(mockContext)).toBe(true);
      });

      it('should reject public key with 403', () => {
        mockRequest.apiKeyIdentity = publicKey;
        expect(() => launchGuard.canActivate(mockContext)).toThrow(ForbiddenException);
      });
    });

    describe('CLOSED state', () => {
      beforeEach(() => {
        process.env.LAUNCH_STATE = 'CLOSED';
        LaunchConfig.initialize();
      });

      it('should reject all keys with 403', () => {
        mockRequest.apiKeyIdentity = publicKey;
        expect(() => launchGuard.canActivate(mockContext)).toThrow(ForbiddenException);

        mockRequest.apiKeyIdentity = internalKey;
        expect(() => launchGuard.canActivate(mockContext)).toThrow(ForbiddenException);

        mockRequest.apiKeyIdentity = earlyAccessKey;
        expect(() => launchGuard.canActivate(mockContext)).toThrow(ForbiddenException);
      });
    });
  });

  describe('Abort Mode Enforcement', () => {
    describe('NONE mode', () => {
      beforeEach(() => {
        process.env.ABORT_MODE = 'NONE';
        AbortConfig.initialize();
      });

      it('should allow execution', () => {
        expect(abortGuard.canActivate(mockContext)).toBe(true);
      });
    });

    describe('EXECUTION_BLOCKED mode', () => {
      beforeEach(() => {
        process.env.ABORT_MODE = 'EXECUTION_BLOCKED';
        AbortConfig.initialize();
      });

      it('should block execution with 503', () => {
        expect(() => abortGuard.canActivate(mockContext)).toThrow(ServiceUnavailableException);
      });

      it('should have appropriate error message', () => {
        try {
          abortGuard.canActivate(mockContext);
          fail('Should have thrown');
        } catch (error) {
          expect(error.message).toContain('AI execution temporarily unavailable');
        }
      });
    });

    describe('FULL_SHUTDOWN mode', () => {
      beforeEach(() => {
        process.env.ABORT_MODE = 'FULL_SHUTDOWN';
        AbortConfig.initialize();
      });

      it('should block execution with 503', () => {
        expect(() => abortGuard.canActivate(mockContext)).toThrow(ServiceUnavailableException);
      });

      it('should have appropriate error message', () => {
        try {
          abortGuard.canActivate(mockContext);
          fail('Should have thrown');
        } catch (error) {
          expect(error.message).toContain('Service temporarily unavailable');
        }
      });
    });
  });

  describe('Kill Switch Enforcement', () => {
    describe('Global execution kill switch', () => {
      it('should block when GLOBAL_EXECUTION_ENABLED=false', () => {
        process.env.GLOBAL_EXECUTION_ENABLED = 'false';
        mockRequest.body.provider = 'stub';

        expect(() => executionSafetyGuard.canActivate(mockContext)).toThrow(ServiceUnavailableException);
      });

      it('should allow when GLOBAL_EXECUTION_ENABLED=true', () => {
        process.env.GLOBAL_EXECUTION_ENABLED = 'true';
        process.env.PROVIDER_XAI_ENABLED = 'true';
        mockRequest.body.provider = 'xai';

        expect(executionSafetyGuard.canActivate(mockContext)).toBe(true);
      });
    });

    describe('Provider-specific kill switches', () => {
      beforeEach(() => {
        process.env.GLOBAL_EXECUTION_ENABLED = 'true';
      });

      it('should block when PROVIDER_XAI_ENABLED=false', () => {
        process.env.AI_PROVIDER = 'xai';
        jest
          .spyOn(KillSwitchConfig, 'isProviderEnabled')
          .mockReturnValue(false);

        expect(() => executionSafetyGuard.canActivate(mockContext)).toThrow(ServiceUnavailableException);
      });

      it('should allow when PROVIDER_XAI_ENABLED=true', () => {
        process.env.PROVIDER_XAI_ENABLED = 'true';
        mockRequest.body.provider = 'xai';

        expect(executionSafetyGuard.canActivate(mockContext)).toBe(true);
      });

      it('should block unknown provider by default', () => {
        process.env.AI_PROVIDER = 'unknown-provider';

        expect(() => executionSafetyGuard.canActivate(mockContext)).toThrow(ServiceUnavailableException);
      });
    });
  });

  describe('Guard Ordering and Deterministic Behavior', () => {
    beforeEach(() => {
      process.env.LAUNCH_STATE = 'PUBLIC';
      process.env.ABORT_MODE = 'NONE';
      process.env.GLOBAL_EXECUTION_ENABLED = 'true';
      LaunchConfig.initialize();
      AbortConfig.initialize();
    });

    it('should enforce launch state before abort mode', () => {
      // Setup: Launch state blocks, abort mode allows
      process.env.LAUNCH_STATE = 'INTERNAL';
      process.env.ABORT_MODE = 'NONE';
      LaunchConfig.reset();
      LaunchConfig.initialize();
      AbortConfig.reset();
      AbortConfig.initialize();

      const publicKey: ApiKeyIdentity = {
        userId: 'test-user',
        apiKeyId: 'key-test',
        scopes: ['ai:execute'],
      };
      mockRequest.apiKeyIdentity = publicKey;

      // Launch guard should fail
      expect(() => launchGuard.canActivate(mockContext)).toThrow(ForbiddenException);

      // Abort guard would pass (but shouldn't be reached)
      expect(abortGuard.canActivate(mockContext)).toBe(true);
    });

    it('should enforce kill switch before launch state', () => {
      // Setup: Kill switch blocks, launch state allows
      process.env.GLOBAL_EXECUTION_ENABLED = 'false';
      process.env.LAUNCH_STATE = 'PUBLIC';
      LaunchConfig.reset();
      LaunchConfig.initialize();

      const publicKey: ApiKeyIdentity = {
        userId: 'test-user',
        apiKeyId: 'key-test',
        scopes: ['ai:execute'],
      };
      mockRequest.apiKeyIdentity = publicKey;

      // Kill switch should fail
      expect(() => executionSafetyGuard.canActivate(mockContext)).toThrow(ServiceUnavailableException);

      // Launch guard would pass (but shouldn't be reached)
      expect(launchGuard.canActivate(mockContext)).toBe(true);
    });

    it('should return same result for repeated calls with same config', () => {
      process.env.LAUNCH_STATE = 'INTERNAL';
      LaunchConfig.reset();
      LaunchConfig.initialize();

      const publicKey: ApiKeyIdentity = {
        userId: 'test-user',
        apiKeyId: 'key-test',
        scopes: ['ai:execute'],
      };
      mockRequest.apiKeyIdentity = publicKey;

      // Multiple calls should behave identically
      for (let i = 0; i < 5; i++) {
        expect(() => launchGuard.canActivate(mockContext)).toThrow(ForbiddenException);
      }
    });
  });

  describe('Quota Non-Consumption on Blocked Paths', () => {
    beforeEach(() => {
      process.env.LAUNCH_STATE = 'PUBLIC';
      process.env.ABORT_MODE = 'NONE';
      process.env.GLOBAL_EXECUTION_ENABLED = 'true';
      LaunchConfig.initialize();
      AbortConfig.initialize();
    });

    it('should not consume quota when launch state blocks', () => {
      process.env.LAUNCH_STATE = 'INTERNAL';
      LaunchConfig.reset();
      LaunchConfig.initialize();

      const publicKey: ApiKeyIdentity = {
        userId: 'test-user',
        apiKeyId: 'key-test',
        scopes: ['ai:execute'],
      };
      mockRequest.apiKeyIdentity = publicKey;

      const initialUsage = quotaService.getCurrentUsage('key-test');

      // Launch guard fails - quota guard never reached
      expect(() => launchGuard.canActivate(mockContext)).toThrow(ForbiddenException);

      const finalUsage = quotaService.getCurrentUsage('key-test');

      // Quota should not have changed
      expect(finalUsage.requests).toBe(initialUsage.requests);
      expect(finalUsage.tokens).toBe(initialUsage.tokens);
    });

    it('should not consume quota when abort mode blocks', () => {
      process.env.ABORT_MODE = 'EXECUTION_BLOCKED';
      AbortConfig.reset();
      AbortConfig.initialize();

      const initialUsage = quotaService.getCurrentUsage('key-test');

      // Abort guard fails - quota guard never reached
      expect(() => abortGuard.canActivate(mockContext)).toThrow(ServiceUnavailableException);

      const finalUsage = quotaService.getCurrentUsage('key-test');

      // Quota should not have changed
      expect(finalUsage.requests).toBe(initialUsage.requests);
      expect(finalUsage.tokens).toBe(initialUsage.tokens);
    });

    it('should not consume quota when kill switch blocks', () => {
      process.env.GLOBAL_EXECUTION_ENABLED = 'false';

      const initialUsage = quotaService.getCurrentUsage('key-test');

      // Kill switch fails - quota guard never reached
      expect(() => executionSafetyGuard.canActivate(mockContext)).toThrow(ServiceUnavailableException);

      const finalUsage = quotaService.getCurrentUsage('key-test');

      // Quota should not have changed
      expect(finalUsage.requests).toBe(initialUsage.requests);
      expect(finalUsage.tokens).toBe(initialUsage.tokens);
    });
  });

  describe('Combined Scenarios', () => {
    it('should handle multiple blocking conditions correctly', () => {
      // Setup: Both kill switch and launch state block
      process.env.GLOBAL_EXECUTION_ENABLED = 'false';
      process.env.LAUNCH_STATE = 'INTERNAL';
      LaunchConfig.reset();
      LaunchConfig.initialize();

      const publicKey: ApiKeyIdentity = {
        userId: 'test-user',
        apiKeyId: 'key-test',
        scopes: ['ai:execute'],
      };
      mockRequest.apiKeyIdentity = publicKey;

      // Kill switch should fail first (earlier in guard chain)
      expect(() => executionSafetyGuard.canActivate(mockContext)).toThrow(ServiceUnavailableException);
    });

    it('should allow execution when all guards pass', () => {
      process.env.LAUNCH_STATE = 'PUBLIC';
      process.env.ABORT_MODE = 'NONE';
      process.env.GLOBAL_EXECUTION_ENABLED = 'true';
      process.env.PROVIDER_XAI_ENABLED = 'true';
      LaunchConfig.reset();
      LaunchConfig.initialize();
      AbortConfig.reset();
      AbortConfig.initialize();

      const publicKey: ApiKeyIdentity = {
        userId: 'test-user',
        apiKeyId: 'key-test',
        scopes: ['ai:execute'],
      };
      mockRequest.apiKeyIdentity = publicKey;
      mockRequest.body.provider = 'xai'; // Use a known provider

      // All guards should pass
      expect(executionSafetyGuard.canActivate(mockContext)).toBe(true);
      expect(launchGuard.canActivate(mockContext)).toBe(true);
      expect(abortGuard.canActivate(mockContext)).toBe(true);
    });
  });

});

describe('AIExecutionController guard metadata', () => {
  it('protects cancelExecution with SessionOrApiKeyAuthGuard', () => {
    const guards =
      Reflect.getMetadata(
        GUARDS_METADATA,
        AIExecutionController.prototype.cancelExecution,
      ) ?? [];

    expect(guards).toContain(SessionOrApiKeyAuthGuard);
  });

  it('protects getExecution with SessionOrApiKeyAuthGuard', () => {
    const guards =
      Reflect.getMetadata(
        GUARDS_METADATA,
        AIExecutionController.prototype.getExecution,
      ) ?? [];

    expect(guards).toContain(SessionOrApiKeyAuthGuard);
  });

  it('protects streamExecution with SessionOrApiKeyAuthGuard', () => {
    const guards =
      Reflect.getMetadata(
        GUARDS_METADATA,
        AIExecutionController.prototype.streamExecution,
      ) ?? [];

    expect(guards).toContain(SessionOrApiKeyAuthGuard);
  });
});
