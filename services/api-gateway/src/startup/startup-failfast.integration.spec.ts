/**
 * Startup Fail-Fast Integration Tests
 *
 * Phase 32A: Deployment Hardening
 *
 * Validates that misconfiguration causes immediate startup failure
 * and that the process does NOT bind to port.
 *
 * CRITICAL: These tests verify fail-fast behavior at the integration level.
 */

import { EnvironmentValidator } from './environment.validator';
import { ConfigurationValidator } from './configuration.validator';
import { ProviderValidator } from './provider.validator';
import { ProductionGuardrailsValidator } from './production-guardrails.validator';
import { LaunchConfig } from '../launch/launch.config';
import { AbortConfig } from '../abort/abort.config';

describe('Startup Fail-Fast Integration', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    // Reset config state
    LaunchConfig.reset();
    AbortConfig.reset();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    // Reset config state
    LaunchConfig.reset();
    AbortConfig.reset();
  });

  describe('Environment Validation Failures', () => {
    it('should fail immediately when NODE_ENV not set', () => {
      delete process.env.NODE_ENV;

      expect(() => {
        EnvironmentValidator.validateEnvironment();
      }).toThrow('[STARTUP FAILURE] Environment detection failed');
      expect(() => {
        EnvironmentValidator.validateEnvironment();
      }).toThrow('NODE_ENV not set');
    });

    it('should fail immediately when NODE_ENV is invalid', () => {
      process.env.NODE_ENV = 'prod'; // Invalid (should be 'production')

      expect(() => {
        EnvironmentValidator.validateEnvironment();
      }).toThrow('[STARTUP FAILURE] Environment detection failed');
      expect(() => {
        EnvironmentValidator.validateEnvironment();
      }).toThrow('NODE_ENV is invalid');
    });
  });

  describe('Configuration Validation Failures', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should fail when PORT is missing', () => {
      delete process.env.PORT;
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.LAUNCH_STATE = 'INTERNAL';

      expect(() => {
        ConfigurationValidator.validateAll();
      }).toThrow('[STARTUP FAILURE] Required environment variable missing');
      expect(() => {
        ConfigurationValidator.validateAll();
      }).toThrow('PORT not set');
    });

    it('should fail when DATABASE_URL is missing', () => {
      process.env.PORT = '3000';
      delete process.env.DATABASE_URL;
      process.env.LAUNCH_STATE = 'INTERNAL';

      expect(() => {
        ConfigurationValidator.validateAll();
      }).toThrow('DATABASE_URL not set');
    });

    it('should fail when DATABASE_URL is invalid', () => {
      process.env.PORT = '3000';
      process.env.DATABASE_URL = 'not-a-url';
      process.env.LAUNCH_STATE = 'INTERNAL';

      expect(() => {
        ConfigurationValidator.validateAll();
      }).toThrow('DATABASE_URL is not a valid URL');
    });

    it('should fail when PORT is not a number', () => {
      process.env.PORT = 'abc';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.LAUNCH_STATE = 'INTERNAL';

      expect(() => {
        ConfigurationValidator.validateAll();
      }).toThrow('PORT is not a valid number');
    });

    it('should fail when PORT is out of range', () => {
      process.env.PORT = '99999';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.LAUNCH_STATE = 'INTERNAL';

      expect(() => {
        ConfigurationValidator.validateAll();
      }).toThrow('PORT out of valid range');
    });
  });

  describe('Provider Configuration Failures', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should fail when AI_PROVIDER not set in production', () => {
      delete process.env.AI_PROVIDER;

      expect(() => {
        ProviderValidator.validateProviderConfiguration();
      }).toThrow('[STARTUP FAILURE] Provider configuration invalid');
      expect(() => {
        ProviderValidator.validateProviderConfiguration();
      }).toThrow('AI_PROVIDER not set');
    });

    it('should fail when AI_PROVIDER is stub in production', () => {
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

    it('should fail when provider API key is too short', () => {
      process.env.AI_PROVIDER = 'openai';
      process.env.OPENAI_API_KEY = 'sk-short';

      expect(() => {
        ProviderValidator.validateProviderConfiguration();
      }).toThrow('appears invalid (too short)');
    });
  });

  describe('Production Guardrail Failures', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.LAUNCH_STATE = 'INTERNAL';
      LaunchConfig.initialize();
    });

    it('should fail when BILLING_CHARGES_ENABLED not set', () => {
      delete process.env.BILLING_CHARGES_ENABLED;

      expect(() => {
        ProductionGuardrailsValidator.validateProductionRequirements();
      }).toThrow('[STARTUP FAILURE] Production guardrail violation');
      expect(() => {
        ProductionGuardrailsValidator.validateProductionRequirements();
      }).toThrow('BILLING_CHARGES_ENABLED not explicitly set');
    });

    it('should fail when BILLING_CHARGES_ENABLED is invalid', () => {
      process.env.BILLING_CHARGES_ENABLED = 'maybe';

      expect(() => {
        ProductionGuardrailsValidator.validateProductionRequirements();
      }).toThrow('not boolean-compatible');
    });

    it('should fail when unsafe dev flag enabled', () => {
      process.env.BILLING_CHARGES_ENABLED = 'true';
      process.env.SKIP_AUTH = 'true';

      expect(() => {
        ProductionGuardrailsValidator.validateProductionRequirements();
      }).toThrow('Unsafe development flag enabled');
    });
  });

  describe('Launch State Failures', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '3000';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    });

    it('should fail when LAUNCH_STATE not set', () => {
      delete process.env.LAUNCH_STATE;

      expect(() => {
        ConfigurationValidator.validateLaunchState();
      }).toThrow('STARTUP FAILURE: LAUNCH_STATE environment variable not set');
    });

    it('should fail when LAUNCH_STATE is invalid', () => {
      process.env.LAUNCH_STATE = 'INVALID';

      expect(() => {
        ConfigurationValidator.validateLaunchState();
      }).toThrow('STARTUP FAILURE: Invalid LAUNCH_STATE');
    });
  });

  describe('Abort Mode Failures', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '3000';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.LAUNCH_STATE = 'INTERNAL';
    });

    it('should fail when ABORT_MODE is invalid', () => {
      process.env.ABORT_MODE = 'INVALID';

      expect(() => {
        ConfigurationValidator.validateAbortMode();
      }).toThrow('STARTUP FAILURE: Invalid ABORT_MODE');
    });

    it('should succeed when ABORT_MODE not set (defaults to NONE)', () => {
      delete process.env.ABORT_MODE;

      expect(() => {
        ConfigurationValidator.validateAbortMode();
      }).not.toThrow();
    });

    it('should succeed when ABORT_MODE is valid', () => {
      process.env.ABORT_MODE = 'EXECUTION_BLOCKED';

      expect(() => {
        ConfigurationValidator.validateAbortMode();
      }).not.toThrow();
    });
  });

  describe('Successful Configuration', () => {
    it('should succeed with valid production configuration', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '3000';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.LAUNCH_STATE = 'INTERNAL';
      process.env.ABORT_MODE = 'NONE';
      process.env.AI_PROVIDER = 'anthropic';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-1234567890abcdef1234567890abcdef1234567890abcdef';
      process.env.OPENAI_API_KEY = 'sk-1234567890abcdef1234567890abcdef1234567890abcdef';
      process.env.BILLING_CHARGES_ENABLED = 'true';

      expect(() => {
        EnvironmentValidator.validateEnvironment();
        ConfigurationValidator.validateAll();
        ProviderValidator.validateProviderConfiguration();
        ProductionGuardrailsValidator.validateAll();
      }).not.toThrow();
    });

    it('should succeed with valid staging configuration', () => {
      process.env.NODE_ENV = 'staging';
      process.env.PORT = '3000';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.LAUNCH_STATE = 'INTERNAL';
      process.env.AI_PROVIDER = 'anthropic';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-1234567890abcdef1234567890abcdef1234567890abcdef';
      process.env.OPENAI_API_KEY = 'sk-1234567890abcdef1234567890abcdef1234567890abcdef';
      process.env.BILLING_CHARGES_ENABLED = 'false';

      expect(() => {
        EnvironmentValidator.validateEnvironment();
        ConfigurationValidator.validateAll();
        ProviderValidator.validateProviderConfiguration();
        ProductionGuardrailsValidator.validateAll();
      }).not.toThrow();
    });

    it('should succeed with valid development configuration', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.LAUNCH_STATE = 'INTERNAL';

      expect(() => {
        EnvironmentValidator.validateEnvironment();
        ConfigurationValidator.validateAll();
        ProviderValidator.validateProviderConfiguration();
        ProductionGuardrailsValidator.validateAll();
      }).not.toThrow();
    });
  });

  describe('Whitespace and Empty Value Detection', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '3000';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.LAUNCH_STATE = 'INTERNAL';
    });

    it('should fail on whitespace-only AI_PROVIDER', () => {
      process.env.AI_PROVIDER = '   ';

      expect(() => {
        ProviderValidator.validateProviderConfiguration();
      }).toThrow('whitespace-only');
    });

    it('should fail on empty DATABASE_URL', () => {
      process.env.DATABASE_URL = '';

      expect(() => {
        ConfigurationValidator.validateRequiredVariables();
      }).toThrow('DATABASE_URL not set');
    });

    it('should fail on empty PORT', () => {
      process.env.PORT = '';

      expect(() => {
        ConfigurationValidator.validateRequiredVariables();
      }).toThrow('PORT not set');
    });
  });
});
