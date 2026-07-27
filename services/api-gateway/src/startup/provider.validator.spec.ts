/**
 * Provider Validator Tests
 *
 * Phase 32A: Deployment Hardening
 * PRIVATE-BETA-STAGING-EXECUTION-04D2: Private-beta health-only stub exception
 *
 * Tests provider configuration validation and fail-fast behavior.
 */

import { ProviderValidator } from './provider.validator';
import { KillSwitchConfig } from '../safety/kill-switch.config';

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

      it('should fail when AI_PROVIDER is stub and AI execution is enabled', () => {
        process.env.AI_PROVIDER = 'stub';
        process.env.GLOBAL_EXECUTION_ENABLED = 'true';

        expect(KillSwitchConfig.GLOBAL_EXECUTION_ENABLED).toBe(true);
        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).toThrow('Stub provider not allowed in production/staging');
      });

      it('should fail when AI_PROVIDER is stub and execution is not proven disabled (enabled)', () => {
        process.env.AI_PROVIDER = 'stub';
        process.env.GLOBAL_EXECUTION_ENABLED = 'true';

        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).toThrow('stub with AI execution enabled');
      });

      it('should allow AI_PROVIDER=stub in production when GLOBAL_EXECUTION_ENABLED=false (private-beta health-only)', () => {
        process.env.AI_PROVIDER = 'stub';
        process.env.GLOBAL_EXECUTION_ENABLED = 'false';

        expect(KillSwitchConfig.GLOBAL_EXECUTION_ENABLED).toBe(false);
        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).not.toThrow();
        // Exception does not flip execution on
        expect(KillSwitchConfig.GLOBAL_EXECUTION_ENABLED).toBe(false);
      });

      it('should allow AI_PROVIDER=stub when GLOBAL_EXECUTION_ENABLED is unset (fail-safe execution disabled)', () => {
        process.env.AI_PROVIDER = 'stub';
        delete process.env.GLOBAL_EXECUTION_ENABLED;

        expect(KillSwitchConfig.GLOBAL_EXECUTION_ENABLED).toBe(false);
        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).not.toThrow();
        expect(KillSwitchConfig.GLOBAL_EXECUTION_ENABLED).toBe(false);
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

      it('should still succeed with real provider when GLOBAL_EXECUTION_ENABLED=true', () => {
        process.env.AI_PROVIDER = 'anthropic';
        process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-1234567890abcdef1234567890abcdef1234567890abcdef';
        process.env.GLOBAL_EXECUTION_ENABLED = 'true';

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

      it('should fail when AI_PROVIDER is stub and AI execution is enabled', () => {
        process.env.AI_PROVIDER = 'stub';
        process.env.GLOBAL_EXECUTION_ENABLED = 'true';

        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).toThrow('Stub provider not allowed');
      });

      it('should allow AI_PROVIDER=stub in staging when GLOBAL_EXECUTION_ENABLED=false (private-beta health-only)', () => {
        process.env.AI_PROVIDER = 'stub';
        process.env.GLOBAL_EXECUTION_ENABLED = 'false';

        expect(KillSwitchConfig.GLOBAL_EXECUTION_ENABLED).toBe(false);
        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).not.toThrow();
        expect(KillSwitchConfig.GLOBAL_EXECUTION_ENABLED).toBe(false);
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

    describe('04D2 private-beta health-only stub policy invariants', () => {
      it('does not enable AI execution when stub is permitted', () => {
        process.env.NODE_ENV = 'production';
        process.env.AI_PROVIDER = 'stub';
        process.env.GLOBAL_EXECUTION_ENABLED = 'false';
        process.env.BILLING_SNAPSHOT_ENABLED = 'false';
        process.env.PAYMENT_EXECUTION_ENABLED = 'false';

        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).not.toThrow();

        expect(KillSwitchConfig.GLOBAL_EXECUTION_ENABLED).toBe(false);
        expect(process.env.GLOBAL_EXECUTION_ENABLED).toBe('false');
        expect(process.env.BILLING_SNAPSHOT_ENABLED).toBe('false');
        expect(process.env.PAYMENT_EXECUTION_ENABLED).toBe('false');
      });

      it('does not disable provider validation — invalid provider still rejected', () => {
        process.env.NODE_ENV = 'production';
        process.env.GLOBAL_EXECUTION_ENABLED = 'false';
        process.env.AI_PROVIDER = 'not-a-provider';

        expect(() => {
          ProviderValidator.validateProviderConfiguration();
        }).toThrow('not a valid provider');
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
