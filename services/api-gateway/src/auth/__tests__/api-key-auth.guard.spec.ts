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
        isInternal: false,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequest.apiKeyIdentity).toBeDefined();
      expect(mockRequest.apiKeyIdentity.userId).toBe('db-user');
      expect(mockRequest.apiKeyIdentity.apiKeyId).toBe('db-key-id');
      expect(mockRequest.apiKeyIdentity.scopes).toEqual(['ai:execute', 'sessions:read']);
      expect(mockRequest.apiKeyIdentity.isInternal).toBe(false);
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

    it('should propagate isInternal true from a DB key onto the identity (L4)', async () => {
      const mockRequest: any = { headers: { authorization: 'Bearer db-internal-key' } };
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      mockApiKeyService.validateApiKey.mockResolvedValue({
        userId: 'db-user',
        apiKeyId: 'db-key-id',
        scopes: ['ai:execute'],
        isInternal: true,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequest.apiKeyIdentity.isInternal).toBe(true);
      expect(mockRequest.apiKeyIdentity.userId).toBe('db-user');
      expect(mockRequest.apiKeyIdentity.apiKeyId).toBe('db-key-id');
      expect(mockRequest.apiKeyIdentity.scopes).toEqual(['ai:execute']);
    });

    it('should propagate isInternal false from a DB key onto the identity (L5)', async () => {
      const mockRequest: any = { headers: { authorization: 'Bearer db-ordinary-key' } };
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      mockApiKeyService.validateApiKey.mockResolvedValue({
        userId: 'db-user',
        apiKeyId: 'db-key-id',
        scopes: ['ai:execute'],
        isInternal: false,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequest.apiKeyIdentity.isInternal).toBe(false);
      expect(mockRequest.apiKeyIdentity.userId).toBe('db-user');
    });

    it('should not grant harnessEntitled from isInternal true without ai:harness (H1)', async () => {
      const mockRequest: any = { headers: { authorization: 'Bearer db-internal-no-harness' } };
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      mockApiKeyService.validateApiKey.mockResolvedValue({
        userId: 'db-user',
        apiKeyId: 'db-key-id',
        scopes: ['ai:execute'],
        isInternal: true,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequest.apiKeyIdentity.isInternal).toBe(true);
      expect(mockRequest.apiKeyIdentity.harnessEntitled).toBe(false);
    });

    it('should keep harnessEntitled independent of isInternal false (H2)', async () => {
      const mockRequest: any = { headers: { authorization: 'Bearer db-harness-not-internal' } };
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      mockApiKeyService.validateApiKey.mockResolvedValue({
        userId: 'db-user',
        apiKeyId: 'db-key-id',
        scopes: ['ai:harness'],
        isInternal: false,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequest.apiKeyIdentity.harnessEntitled).toBe(true);
      expect(mockRequest.apiKeyIdentity.isInternal).toBe(false);
    });
  });

  describe('static key environment gate', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    let validateSpy: jest.SpyInstance;

    const staticKeys = [
      {
        key: 'test-harness-api-key',
        identity: {
          userId: 'user-harness',
          apiKeyId: 'key-harness',
          scopes: ['ai:execute', 'ai:harness'],
          isInternal: true,
          harnessEntitled: true,
        },
      },
      {
        key: 'test-api-key-user-1',
        identity: {
          userId: 'user-1',
          apiKeyId: 'key-1',
          scopes: ['ai:execute'],
          isInternal: true,
        },
      },
      {
        key: 'test-api-key-user-2',
        identity: {
          userId: 'user-2',
          apiKeyId: 'key-2',
          scopes: ['ai:execute'],
          isEarlyAccess: true,
        },
      },
      {
        key: 'valid-api-key',
        identity: {
          userId: 'test-user',
          apiKeyId: 'key-test',
          scopes: ['ai:execute'],
        },
      },
    ];

    beforeEach(() => {
      validateSpy = jest.spyOn(ApiKeyConfig, 'validateApiKey');
    });

    afterEach(() => {
      validateSpy.mockRestore();
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    function useNodeEnv(nodeEnv: string | undefined): void {
      if (nodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = nodeEnv;
      }
    }

    async function expectStaticKeyRefused(key: string): Promise<void> {
      mockApiKeyService.validateApiKey.mockResolvedValue(null);
      const context = createMockExecutionContext(`Bearer ${key}`);

      let thrown: unknown;
      try {
        await guard.canActivate(context);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(ForbiddenException);
      expect((thrown as ForbiddenException).message).toBe('Invalid API key');
      expect((thrown as ForbiddenException).getStatus()).toBe(403);
      expect(validateSpy).not.toHaveBeenCalled();
    }

    async function expectStaticKeyAccepted(
      key: string,
      identity: (typeof staticKeys)[number]['identity'],
    ): Promise<void> {
      mockApiKeyService.validateApiKey.mockResolvedValue(null);
      const mockRequest: any = { headers: { authorization: `Bearer ${key}` } };
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequest.apiKeyIdentity).toEqual(identity);
      expect(validateSpy).toHaveBeenCalledTimes(1);
      expect(validateSpy).toHaveBeenCalledWith(key);
    }

    it.each(staticKeys)(
      'refuses $key when NODE_ENV is production',
      async ({ key }) => {
        useNodeEnv('production');
        await expectStaticKeyRefused(key);
      },
    );

    it.each(staticKeys)('refuses $key when NODE_ENV is unset', async ({ key }) => {
      useNodeEnv(undefined);
      await expectStaticKeyRefused(key);
    });

    it.each(staticKeys)('accepts $key when NODE_ENV is test', async ({ key, identity }) => {
      useNodeEnv('test');
      await expectStaticKeyAccepted(key, identity);
    });

    it.each(staticKeys)(
      'accepts $key when NODE_ENV is development',
      async ({ key, identity }) => {
        useNodeEnv('development');
        await expectStaticKeyAccepted(key, identity);
      },
    );

    it('refuses valid-api-key when NODE_ENV is any other value', async () => {
      useNodeEnv('staging');
      await expectStaticKeyRefused('valid-api-key');
    });

    it('accepts a database key when NODE_ENV is production', async () => {
      useNodeEnv('production');
      const mockRequest: any = {
        headers: { authorization: 'Bearer db-production-key' },
      };
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      mockApiKeyService.validateApiKey.mockResolvedValue({
        userId: 'db-user',
        apiKeyId: 'db-key-id',
        scopes: ['ai:execute'],
        isInternal: false,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequest.apiKeyIdentity).toEqual({
        userId: 'db-user',
        apiKeyId: 'db-key-id',
        scopes: ['ai:execute'],
        isInternal: false,
        harnessEntitled: false,
      });
      expect(validateSpy).not.toHaveBeenCalled();
    });
  });
});
