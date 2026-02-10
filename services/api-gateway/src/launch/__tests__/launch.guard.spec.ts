/**
 * LaunchGuard Unit Tests
 *
 * Phase 28B-1: Launch Readiness Implementation
 *
 * Tests launch state enforcement logic for all four states.
 */

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { LaunchGuard } from '../launch.guard';
import { LaunchConfig } from '../launch.config';
import { LaunchState } from '../launch-state.enum';
import { ApiKeyIdentity } from '../../auth/api-key.config';

describe('LaunchGuard', () => {
  let guard: LaunchGuard;
  let mockContext: ExecutionContext;
  let mockRequest: any;

  beforeEach(() => {
    guard = new LaunchGuard();

    // Reset LaunchConfig before each test
    LaunchConfig.reset();

    // Create a shared mock request object
    mockRequest = {
      apiKeyIdentity: undefined,
    };

    // Mock ExecutionContext
    mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as any;
  });

  describe('PUBLIC state', () => {
    beforeEach(() => {
      process.env.LAUNCH_STATE = 'PUBLIC';
      LaunchConfig.initialize();
    });

    it('should allow all authenticated keys', () => {
      const identity: ApiKeyIdentity = {
        userId: 'user-1',
        apiKeyId: 'key-1',
        scopes: ['ai:execute'],
      };

      mockRequest.apiKeyIdentity = identity;

      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('should allow internal keys', () => {
      const identity: ApiKeyIdentity = {
        userId: 'internal-user',
        apiKeyId: 'internal-key',
        scopes: ['ai:execute'],
        isInternal: true,
      };

      mockRequest.apiKeyIdentity = identity;

      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('should allow early access keys', () => {
      const identity: ApiKeyIdentity = {
        userId: 'early-user',
        apiKeyId: 'early-key',
        scopes: ['ai:execute'],
        isEarlyAccess: true,
      };

      mockRequest.apiKeyIdentity = identity;

      expect(guard.canActivate(mockContext)).toBe(true);
    });
  });

  describe('CLOSED state', () => {
    beforeEach(() => {
      process.env.LAUNCH_STATE = 'CLOSED';
      LaunchConfig.initialize();
    });

    it('should block all keys', () => {
      const identity: ApiKeyIdentity = {
        userId: 'user-1',
        apiKeyId: 'key-1',
        scopes: ['ai:execute'],
      };

      mockRequest.apiKeyIdentity = identity;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        'AI execution is currently unavailable',
      );
    });

    it('should block internal keys', () => {
      const identity: ApiKeyIdentity = {
        userId: 'internal-user',
        apiKeyId: 'internal-key',
        scopes: ['ai:execute'],
        isInternal: true,
      };

      mockRequest.apiKeyIdentity = identity;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should block early access keys', () => {
      const identity: ApiKeyIdentity = {
        userId: 'early-user',
        apiKeyId: 'early-key',
        scopes: ['ai:execute'],
        isEarlyAccess: true,
      };

      mockRequest.apiKeyIdentity = identity;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });

  describe('INTERNAL state', () => {
    beforeEach(() => {
      process.env.LAUNCH_STATE = 'INTERNAL';
      LaunchConfig.initialize();
    });

    it('should allow internal keys', () => {
      const identity: ApiKeyIdentity = {
        userId: 'internal-user',
        apiKeyId: 'internal-key',
        scopes: ['ai:execute'],
        isInternal: true,
      };

      mockRequest.apiKeyIdentity = identity;

      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('should block public keys', () => {
      const identity: ApiKeyIdentity = {
        userId: 'user-1',
        apiKeyId: 'key-1',
        scopes: ['ai:execute'],
      };

      mockRequest.apiKeyIdentity = identity;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        'AI execution is currently in internal testing phase',
      );
    });

    it('should block early access keys', () => {
      const identity: ApiKeyIdentity = {
        userId: 'early-user',
        apiKeyId: 'early-key',
        scopes: ['ai:execute'],
        isEarlyAccess: true,
      };

      mockRequest.apiKeyIdentity = identity;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        'AI execution is currently in internal testing phase',
      );
    });

    it('should block keys with isInternal=false', () => {
      const identity: ApiKeyIdentity = {
        userId: 'user-1',
        apiKeyId: 'key-1',
        scopes: ['ai:execute'],
        isInternal: false,
      };

      mockRequest.apiKeyIdentity = identity;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });

  describe('EARLY_ACCESS state', () => {
    beforeEach(() => {
      process.env.LAUNCH_STATE = 'EARLY_ACCESS';
      LaunchConfig.initialize();
    });

    it('should allow internal keys', () => {
      const identity: ApiKeyIdentity = {
        userId: 'internal-user',
        apiKeyId: 'internal-key',
        scopes: ['ai:execute'],
        isInternal: true,
      };

      mockRequest.apiKeyIdentity = identity;

      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('should allow early access keys', () => {
      const identity: ApiKeyIdentity = {
        userId: 'early-user',
        apiKeyId: 'early-key',
        scopes: ['ai:execute'],
        isEarlyAccess: true,
      };

      mockRequest.apiKeyIdentity = identity;

      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('should allow keys with both flags', () => {
      const identity: ApiKeyIdentity = {
        userId: 'special-user',
        apiKeyId: 'special-key',
        scopes: ['ai:execute'],
        isInternal: true,
        isEarlyAccess: true,
      };

      mockRequest.apiKeyIdentity = identity;

      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('should block public keys', () => {
      const identity: ApiKeyIdentity = {
        userId: 'user-1',
        apiKeyId: 'key-1',
        scopes: ['ai:execute'],
      };

      mockRequest.apiKeyIdentity = identity;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        'AI execution is currently in early access phase',
      );
    });

    it('should block keys with both flags false', () => {
      const identity: ApiKeyIdentity = {
        userId: 'user-1',
        apiKeyId: 'key-1',
        scopes: ['ai:execute'],
        isInternal: false,
        isEarlyAccess: false,
      };

      mockRequest.apiKeyIdentity = identity;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });

  describe('Missing identity', () => {
    beforeEach(() => {
      process.env.LAUNCH_STATE = 'INTERNAL';
      LaunchConfig.initialize();
    });

    it('should throw if identity not attached', () => {
      // No identity attached
      mockRequest.apiKeyIdentity = undefined;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        'Execution not allowed in current launch state',
      );
    });
  });

  describe('Uninitialized LaunchConfig', () => {
    it('should throw if LaunchConfig not initialized', () => {
      // Don't initialize LaunchConfig
      LaunchConfig.reset();

      const identity: ApiKeyIdentity = {
        userId: 'user-1',
        apiKeyId: 'key-1',
        scopes: ['ai:execute'],
      };

      mockRequest.apiKeyIdentity = identity;

      expect(() => guard.canActivate(mockContext)).toThrow(
        'LaunchConfig not initialized',
      );
    });
  });
});
