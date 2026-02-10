import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthorizationGuard } from '../authorization.guard';
import { ApiKeyIdentity } from '../api-key.config';

describe('AuthorizationGuard', () => {
  let guard: AuthorizationGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new AuthorizationGuard(reflector);
  });

  const createMockExecutionContext = (
    requiredScopes: string[] | null,
    identity: ApiKeyIdentity | null,
  ): ExecutionContext => {
    const mockRequest: any = identity ? { apiKeyIdentity: identity } : {};

    const context = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
      getHandler: () => ({}),
    } as ExecutionContext;

    // Mock Reflector.get to return required scopes
    jest.spyOn(reflector, 'get').mockReturnValue(requiredScopes);

    return context;
  };

  describe('canActivate', () => {
    it('should return true when no scopes are required', () => {
      const identity: ApiKeyIdentity = {
        userId: 'user-1',
        apiKeyId: 'key-1',
        scopes: [],
      };
      const context = createMockExecutionContext(null, identity);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true when required scope is granted', () => {
      const identity: ApiKeyIdentity = {
        userId: 'user-1',
        apiKeyId: 'key-1',
        scopes: ['ai:execute'],
      };
      const context = createMockExecutionContext(['ai:execute'], identity);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when required scope is missing', () => {
      const identity: ApiKeyIdentity = {
        userId: 'user-1',
        apiKeyId: 'key-1',
        scopes: ['conversations:read'],
      };
      const context = createMockExecutionContext(['ai:execute'], identity);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Insufficient permissions');
    });

    it('should throw ForbiddenException when scopes array is empty', () => {
      const identity: ApiKeyIdentity = {
        userId: 'user-1',
        apiKeyId: 'key-1',
        scopes: [],
      };
      const context = createMockExecutionContext(['ai:execute'], identity);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Insufficient permissions');
    });

    it('should return true when multiple required scopes are all granted', () => {
      const identity: ApiKeyIdentity = {
        userId: 'user-1',
        apiKeyId: 'key-1',
        scopes: ['ai:execute', 'conversations:read', 'conversations:write'],
      };
      const context = createMockExecutionContext(
        ['ai:execute', 'conversations:read'],
        identity,
      );

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when one of multiple required scopes is missing', () => {
      const identity: ApiKeyIdentity = {
        userId: 'user-1',
        apiKeyId: 'key-1',
        scopes: ['ai:execute'],
      };
      const context = createMockExecutionContext(
        ['ai:execute', 'admin:*'],
        identity,
      );

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Insufficient permissions');
    });

    it('should throw ForbiddenException when identity is missing', () => {
      const context = createMockExecutionContext(['ai:execute'], null);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Insufficient permissions');
    });

    it('should return true when empty scopes array is required', () => {
      const identity: ApiKeyIdentity = {
        userId: 'user-1',
        apiKeyId: 'key-1',
        scopes: [],
      };
      const context = createMockExecutionContext([], identity);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should be deterministic - same input produces same result', () => {
      const identity: ApiKeyIdentity = {
        userId: 'user-1',
        apiKeyId: 'key-1',
        scopes: ['conversations:read'],
      };

      // Call three times with same inputs
      const context1 = createMockExecutionContext(['ai:execute'], identity);
      const context2 = createMockExecutionContext(['ai:execute'], identity);
      const context3 = createMockExecutionContext(['ai:execute'], identity);

      expect(() => guard.canActivate(context1)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context2)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context3)).toThrow(ForbiddenException);
    });

    it('should handle identity with undefined scopes as empty array', () => {
      const identity: any = {
        userId: 'user-1',
        apiKeyId: 'key-1',
        // scopes is undefined
      };
      const context = createMockExecutionContext(['ai:execute'], identity);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Insufficient permissions');
    });
  });
});
