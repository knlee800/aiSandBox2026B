import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ApiKeyAuthGuard } from '../api-key-auth.guard';
import { ApiKeyConfig } from '../api-key.config';

describe('ApiKeyAuthGuard', () => {
  let guard: ApiKeyAuthGuard;

  beforeEach(() => {
    guard = new ApiKeyAuthGuard();
  });

  const createMockExecutionContext = (authHeader?: string): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: authHeader ? { authorization: authHeader } : {},
        }),
      }),
    } as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should throw UnauthorizedException when Authorization header is missing', () => {
      const context = createMockExecutionContext();

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Missing authentication credentials');
    });

    it('should throw UnauthorizedException when Authorization header is malformed (no Bearer)', () => {
      const context = createMockExecutionContext('invalid-format');

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Invalid authentication scheme');
    });

    it('should throw UnauthorizedException when Authorization header has Bearer but no key', () => {
      const context = createMockExecutionContext('Bearer ');

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Missing API key');
    });

    it('should throw UnauthorizedException when Authorization header has Bearer with whitespace-only key', () => {
      const context = createMockExecutionContext('Bearer    ');

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Missing API key');
    });

    it('should throw ForbiddenException when API key is invalid', () => {
      const context = createMockExecutionContext('Bearer invalid-api-key');

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Invalid API key');
    });

    it('should return true and attach identity when API key is valid', () => {
      const mockRequest: any = { headers: { authorization: 'Bearer valid-api-key' } };
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequest.apiKeyIdentity).toBeDefined();
      expect(mockRequest.apiKeyIdentity.userId).toBe('test-user');
      expect(mockRequest.apiKeyIdentity.apiKeyId).toBe('key-test');
      expect(mockRequest.apiKeyIdentity.scopes).toEqual(['ai:execute']); // Phase 20B
    });

    it('should attach correct identity for test-api-key-user-1', () => {
      const mockRequest: any = { headers: { authorization: 'Bearer test-api-key-user-1' } };
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequest.apiKeyIdentity.userId).toBe('user-1');
      expect(mockRequest.apiKeyIdentity.apiKeyId).toBe('key-1');
      expect(mockRequest.apiKeyIdentity.scopes).toEqual(['ai:execute']); // Phase 20B
    });

    it('should attach correct identity for test-api-key-user-2', () => {
      const mockRequest: any = { headers: { authorization: 'Bearer test-api-key-user-2' } };
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequest.apiKeyIdentity.userId).toBe('user-2');
      expect(mockRequest.apiKeyIdentity.apiKeyId).toBe('key-2');
      expect(mockRequest.apiKeyIdentity.scopes).toEqual(['ai:execute']); // Phase 20B
    });
  });
});
