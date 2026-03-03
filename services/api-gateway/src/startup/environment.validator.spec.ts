/**
 * Environment Validator Tests
 *
 * Phase 27B: Production Hardening
 */

import { EnvironmentValidator } from './environment.validator';

describe('EnvironmentValidator', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe('validateEnvironment', () => {
    it('should throw error when NODE_ENV not set', () => {
      delete process.env.NODE_ENV;

      expect(() => {
        EnvironmentValidator.validateEnvironment();
      }).toThrow('[STARTUP FAILURE] Environment detection failed');

      expect(() => {
        EnvironmentValidator.validateEnvironment();
      }).toThrow('NODE_ENV not set');
    });

    it('should throw error when NODE_ENV is invalid', () => {
      process.env.NODE_ENV = 'invalid';

      expect(() => {
        EnvironmentValidator.validateEnvironment();
      }).toThrow('[STARTUP FAILURE] Environment detection failed');

      expect(() => {
        EnvironmentValidator.validateEnvironment();
      }).toThrow('NODE_ENV is invalid');
    });

    it('should accept development environment', () => {
      process.env.NODE_ENV = 'development';
      expect(EnvironmentValidator.validateEnvironment()).toBe('development');
    });

    it('should accept staging environment', () => {
      process.env.NODE_ENV = 'staging';
      expect(EnvironmentValidator.validateEnvironment()).toBe('staging');
    });

    it('should accept production environment', () => {
      process.env.NODE_ENV = 'production';
      expect(EnvironmentValidator.validateEnvironment()).toBe('production');
    });

    it('should allow test environment during Jest execution', () => {
      process.env.NODE_ENV = 'test';
      process.env.JEST_WORKER_ID = '1';

      const result = EnvironmentValidator.validateEnvironment();
      expect(result).toBe('development');
    });

    it('should reject test environment outside Jest', () => {
      process.env.NODE_ENV = 'test';
      delete process.env.JEST_WORKER_ID;

      expect(() => {
        EnvironmentValidator.validateEnvironment();
      }).toThrow('NODE_ENV is invalid');
    });

    it('should reject local environment', () => {
      process.env.NODE_ENV = 'local';

      expect(() => {
        EnvironmentValidator.validateEnvironment();
      }).toThrow('NODE_ENV is invalid');
    });
  });

  describe('isProduction', () => {
    it('should return true for production', () => {
      process.env.NODE_ENV = 'production';
      expect(EnvironmentValidator.isProduction()).toBe(true);
    });

    it('should return false for development', () => {
      process.env.NODE_ENV = 'development';
      expect(EnvironmentValidator.isProduction()).toBe(false);
    });

    it('should return false for staging', () => {
      process.env.NODE_ENV = 'staging';
      expect(EnvironmentValidator.isProduction()).toBe(false);
    });

    it('should return false when NODE_ENV not set', () => {
      delete process.env.NODE_ENV;
      expect(EnvironmentValidator.isProduction()).toBe(false);
    });
  });

  describe('isStaging', () => {
    it('should return true for staging', () => {
      process.env.NODE_ENV = 'staging';
      expect(EnvironmentValidator.isStaging()).toBe(true);
    });

    it('should return false for production', () => {
      process.env.NODE_ENV = 'production';
      expect(EnvironmentValidator.isStaging()).toBe(false);
    });
  });

  describe('isDevelopment', () => {
    it('should return true for development', () => {
      process.env.NODE_ENV = 'development';
      expect(EnvironmentValidator.isDevelopment()).toBe(true);
    });

    it('should return false for production', () => {
      process.env.NODE_ENV = 'production';
      expect(EnvironmentValidator.isDevelopment()).toBe(false);
    });
  });

  describe('getStrictnessLevel', () => {
    it('should return permissive for development', () => {
      process.env.NODE_ENV = 'development';
      expect(EnvironmentValidator.getStrictnessLevel()).toBe('permissive');
    });

    it('should return strict for staging', () => {
      process.env.NODE_ENV = 'staging';
      expect(EnvironmentValidator.getStrictnessLevel()).toBe('strict');
    });

    it('should return strictest for production', () => {
      process.env.NODE_ENV = 'production';
      expect(EnvironmentValidator.getStrictnessLevel()).toBe('strictest');
    });
  });
});
