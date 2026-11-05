import { ApiKeyConfig } from '../api-key.config';

describe('ApiKeyConfig', () => {
  describe('validateApiKey', () => {
    it('should return null for invalid API key', () => {
      const result = ApiKeyConfig.validateApiKey('invalid-key');

      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = ApiKeyConfig.validateApiKey('');

      expect(result).toBeNull();
    });

    it('should return identity for valid-api-key', () => {
      const result = ApiKeyConfig.validateApiKey('valid-api-key');

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('test-user');
      expect(result?.apiKeyId).toBe('key-test');
      expect(result?.scopes).toEqual(['ai:execute']); // Phase 20B
    });

    it('should return identity for test-api-key-user-1', () => {
      const result = ApiKeyConfig.validateApiKey('test-api-key-user-1');

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user-1');
      expect(result?.apiKeyId).toBe('key-1');
      expect(result?.scopes).toEqual(['ai:execute']); // Phase 20B
    });

    it('should return identity for test-api-key-user-2', () => {
      const result = ApiKeyConfig.validateApiKey('test-api-key-user-2');

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user-2');
      expect(result?.apiKeyId).toBe('key-2');
      expect(result?.scopes).toEqual(['ai:execute']); // Phase 20B
    });
  });

  describe('hasApiKey', () => {
    it('should return false for invalid API key', () => {
      const result = ApiKeyConfig.hasApiKey('invalid-key');

      expect(result).toBe(false);
    });

    it('should return true for valid API key', () => {
      const result = ApiKeyConfig.hasApiKey('valid-api-key');

      expect(result).toBe(true);
    });

    it('should return true for test-api-key-user-1', () => {
      const result = ApiKeyConfig.hasApiKey('test-api-key-user-1');

      expect(result).toBe(true);
    });

    it('should return true for test-api-key-user-2', () => {
      const result = ApiKeyConfig.hasApiKey('test-api-key-user-2');

      expect(result).toBe(true);
    });
  });

  describe('staticKeysAllowed', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('returns true only when NODE_ENV is exactly test or development', () => {
      process.env.NODE_ENV = 'test';
      expect(ApiKeyConfig.staticKeysAllowed()).toBe(true);

      process.env.NODE_ENV = 'development';
      expect(ApiKeyConfig.staticKeysAllowed()).toBe(true);
    });

    it('returns false for production, any other value, and when NODE_ENV is unset', () => {
      process.env.NODE_ENV = 'production';
      expect(ApiKeyConfig.staticKeysAllowed()).toBe(false);

      process.env.NODE_ENV = 'staging';
      expect(ApiKeyConfig.staticKeysAllowed()).toBe(false);

      process.env.NODE_ENV = 'Production';
      expect(ApiKeyConfig.staticKeysAllowed()).toBe(false);

      process.env.NODE_ENV = '';
      expect(ApiKeyConfig.staticKeysAllowed()).toBe(false);

      delete process.env.NODE_ENV;
      expect(ApiKeyConfig.staticKeysAllowed()).toBe(false);
    });

    it('reads NODE_ENV on each call', () => {
      process.env.NODE_ENV = 'production';
      expect(ApiKeyConfig.staticKeysAllowed()).toBe(false);

      process.env.NODE_ENV = 'test';
      expect(ApiKeyConfig.staticKeysAllowed()).toBe(true);
    });
  });
});
