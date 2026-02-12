import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ApiKeyAuthGuard } from '../api-key-auth.guard';
import { ApiKeyConfig } from '../api-key.config';
import { ApiKeyService } from '../api-key.service';

describe('ApiKeyAuthGuard', () => {
  let guard: ApiKeyAuthGuard;
  let mockApiKeyService: jest.Mocked<ApiKeyService>;

  beforeEach(() => {
    mockApiKeyService = {
      validateApiKey: jest.fn(),
    } as any;

    guard = new ApiKeyAuthGuard(mockApiKeyService);
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
    it('should throw UnauthorizedException when Authorization header is missing', async () => {
      const context = createMockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('Missing authentication credentials');
    });

    it('should throw UnauthorizedException when Authorization header is malformed (no Bearer)', async () => {
      const context = createMockExecutionContext('invalid-format');

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('Invalid authentication scheme');
    });

    it('should throw UnauthorizedException when Authorization header has Bearer but no key', async () => {
      const context = createMockExecutionContext('Bearer ');

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('Missing API key');
    });

    it('should throw UnauthorizedException when Authorization header has Bearer with whitespace-only key', async () => {
      const context = createMockExecutionContext('Bearer    ');

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('Missing API key');
    });

    it('should throw ForbiddenException when API key is invalid (not in DB or static config)', async () => {
      const context = createMockExecutionContext('Bearer invalid-api-key');

      // Mock database returning null
      mockApiKeyService.validateApiKey.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Invalid API key');
    });

    it('should return true and attach identity when API key is valid in database', async () => {
      const mockRequest: any = { headers: { authorization: 'Bearer db-api-key' } };
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      // Mock database validation
      mockApiKeyService.validateApiKey.mockResolvedValue({
        userId: 'db-user',
        apiKeyId: 'db-key-id',
        scopes: ['ai:execute', 'sessions:read'],
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequest.apiKeyIdentity).toBeDefined();
      expect(mockRequest.apiKeyIdentity.userId).toBe('db-user');
      expect(mockRequest.apiKeyIdentity.apiKeyId).toBe('db-key-id');
      expect(mockRequest.apiKeyIdentity.scopes).toEqual(['ai:execute', 'sessions:read']);
    });

    it('should fallback to static config when database validation fails', async () => {
      const mockRequest: any = { headers: { authorization: 'Bearer valid-api-key' } };
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      // Mock database returning null (not found)
      mockApiKeyService.validateApiKey.mockResolvedValue(null);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequest.apiKeyIdentity).toBeDefined();
      expect(mockRequest.apiKeyIdentity.userId).toBe('test-user');
      expect(mockRequest.apiKeyIdentity.apiKeyId).toBe('key-test');
      expect(mockRequest.apiKeyIdentity.scopes).toEqual(['ai:execute']);
    });

    it('should attach correct identity for test-api-key-user-1 (static config)', async () => {
      const mockRequest: any = { headers: { authorization: 'Bearer test-api-key-user-1' } };
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      // Mock database returning null (fallback to static)
      mockApiKeyService.validateApiKey.mockResolvedValue(null);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequest.apiKeyIdentity.userId).toBe('user-1');
      expect(mockRequest.apiKeyIdentity.apiKeyId).toBe('key-1');
      expect(mockRequest.apiKeyIdentity.scopes).toEqual(['ai:execute']);
    });

    it('should attach correct identity for test-api-key-user-2 (static config)', async () => {
      const mockRequest: any = { headers: { authorization: 'Bearer test-api-key-user-2' } };
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      // Mock database returning null (fallback to static)
      mockApiKeyService.validateApiKey.mockResolvedValue(null);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequest.apiKeyIdentity.userId).toBe('user-2');
      expect(mockRequest.apiKeyIdentity.apiKeyId).toBe('key-2');
      expect(mockRequest.apiKeyIdentity.scopes).toEqual(['ai:execute']);
    });

    it('should handle database errors gracefully and fallback to static config', async () => {
      const mockRequest: any = { headers: { authorization: 'Bearer valid-api-key' } };
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      // Mock database throwing an error
      mockApiKeyService.validateApiKey.mockRejectedValue(new Error('Database connection failed'));

      const result = await guard.canActivate(context);

      // Should still succeed using static config
      expect(result).toBe(true);
      expect(mockRequest.apiKeyIdentity).toBeDefined();
      expect(mockRequest.apiKeyIdentity.userId).toBe('test-user');
    });
  });
});
