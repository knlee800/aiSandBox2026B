/**
 * Provider Validator Tests
 *
 * Phase 32A: Deployment Hardening
 *
 * Tests provider configuration validation and fail-fast behavior.
 */

import { ProviderValidator } from './provider.validator';

describe('ProviderValidator', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('validateProviderConfiguration', () => {
    describe('Production Environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
      });

      it('should fail when AI_PROVIDER not set', () => {
        delete process.env.AI_PROVIDER;

        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).toThrow('[STARTUP FAILURE] Provider configuration invalid');
        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).toThrow('AI_PROVIDER not set');
      });

      it('should fail when AI_PROVIDER is empty string', () => {
        process.env.AI_PROVIDER = '';

        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).toThrow('[STARTUP FAILURE] Provider configuration invalid');
      });

      it('should fail when AI_PROVIDER is whitespace-only', () => {
        process.env.AI_PROVIDER = '   ';

        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).toThrow('whitespace-only');
      });

      it('should fail when AI_PROVIDER is invalid', () => {
        process.env.AI_PROVIDER = 'invalid-provider';

        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).toThrow('not a valid provider');
      });

      it('should fail when AI_PROVIDER is stub', () => {
        process.env.AI_PROVIDER = 'stub';

        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).toThrow('Stub provider not allowed in production/staging');
      });

      it('should fail when provider API key missing', () => {
        process.env.AI_PROVIDER = 'anthropic';
        delete process.env.ANTHROPIC_API_KEY;

        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).toThrow('ANTHROPIC_API_KEY not set');
      });

      it('should fail when provider API key is empty', () => {
        process.env.AI_PROVIDER = 'anthropic';
        process.env.ANTHROPIC_API_KEY = '';

        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).toThrow('ANTHROPIC_API_KEY not set');
      });

      it('should fail when provider API key is too short', () => {
        process.env.AI_PROVIDER = 'anthropic';
        process.env.ANTHROPIC_API_KEY = 'sk-ant-short';

        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).toThrow('appears invalid (too short)');
      });

      it('should succeed with valid anthropic configuration', () => {
        process.env.AI_PROVIDER = 'anthropic';
        process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-1234567890abcdef1234567890abcdef1234567890abcdef';

        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).not.toThrow();
      });

      it('should succeed with valid openai configuration', () => {
        process.env.AI_PROVIDER = 'openai';
        process.env.OPENAI_API_KEY = 'sk-1234567890abcdef1234567890abcdef1234567890abcdef';

        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).not.toThrow();
      });

      it('should succeed with valid groq configuration', () => {
        process.env.AI_PROVIDER = 'groq';
        process.env.GROQ_API_KEY = 'gsk_1234567890abcdef1234567890abcdef1234567890abcdef';

        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).not.toThrow();
      });
    });

    describe('Staging Environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'staging';
      });

      it('should fail when AI_PROVIDER not set', () => {
        delete process.env.AI_PROVIDER;

        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).toThrow('AI_PROVIDER not set');
      });

      it('should fail when AI_PROVIDER is stub', () => {
        process.env.AI_PROVIDER = 'stub';

        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).toThrow('Stub provider not allowed');
      });

      it('should succeed with valid provider', () => {
        process.env.AI_PROVIDER = 'anthropic';
        process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-1234567890abcdef1234567890abcdef1234567890abcdef';

        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).not.toThrow();
      });
    });

    describe('Development Environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
      });

      it('should allow missing AI_PROVIDER (defaults to stub)', () => {
        delete process.env.AI_PROVIDER;

        // Should not throw, but may warn
        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).not.toThrow();
      });

      it('should allow stub provider', () => {
        process.env.AI_PROVIDER = 'stub';

        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).not.toThrow();
      });

      it('should allow real provider without API key (with warning)', () => {
        process.env.AI_PROVIDER = 'anthropic';
        delete process.env.ANTHROPIC_API_KEY;

        // Should not throw in development, but may warn
        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).not.toThrow();
      });

      it('should succeed with valid provider and API key', () => {
        process.env.AI_PROVIDER = 'anthropic';
        process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-1234567890abcdef1234567890abcdef1234567890abcdef';

        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).not.toThrow();
      });
    });
  });

  describe('getValidatedProvider', () => {
    it('should return configured provider', () => {
      process.env.AI_PROVIDER = 'anthropic';

      const provider = ProviderValidator.getValidatedProvider();

      expect(provider).toBe('anthropic');
    });

    it('should return stub when not configured', () => {
      delete process.env.AI_PROVIDER;

      const provider = ProviderValidator.getValidatedProvider();

      expect(provider).toBe('stub');
    });

    it('should trim whitespace', () => {
      process.env.AI_PROVIDER = '  openai  ';

      const provider = ProviderValidator.getValidatedProvider();

      expect(provider).toBe('openai');
    });

    it('should convert to lowercase', () => {
      process.env.AI_PROVIDER = 'ANTHROPIC';

      const provider = ProviderValidator.getValidatedProvider();

      expect(provider).toBe('anthropic');
    });
  });
});
