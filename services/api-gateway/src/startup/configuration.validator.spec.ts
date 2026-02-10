/**
 * Configuration Validator Tests
 *
 * Phase 27B: Production Hardening
 */

import { ConfigurationValidator } from './configuration.validator';

describe('ConfigurationValidator', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Set NODE_ENV for tests
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe('validateRequiredVariables', () => {
    it('should throw error when PORT not set', () => {
      delete process.env.PORT;
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      process.env.OPENAI_API_KEY = 'sk-test';

      expect(() => {
        ConfigurationValidator.validateRequiredVariables();
      }).toThrow('[STARTUP FAILURE] Required environment variable missing');

      expect(() => {
        ConfigurationValidator.validateRequiredVariables();
      }).toThrow('PORT not set');
    });

    it('should throw error when DATABASE_URL not set', () => {
      delete process.env.DATABASE_URL;
      process.env.PORT = '3000';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      process.env.OPENAI_API_KEY = 'sk-test';

      expect(() => {
        ConfigurationValidator.validateRequiredVariables();
      }).toThrow('DATABASE_URL not set');
    });

    it('should throw error when ANTHROPIC_API_KEY not set in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ANTHROPIC_API_KEY;
      process.env.PORT = '3000';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.OPENAI_API_KEY = 'sk-test';

      expect(() => {
        ConfigurationValidator.validateRequiredVariables();
      }).toThrow('ANTHROPIC_API_KEY not set');
    });

    it('should not require ANTHROPIC_API_KEY in development', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.ANTHROPIC_API_KEY;
      process.env.PORT = '3000';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';

      expect(() => {
        ConfigurationValidator.validateRequiredVariables();
      }).not.toThrow();
    });

    it('should throw error for invalid PORT (non-numeric)', () => {
      process.env.PORT = 'invalid';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      process.env.OPENAI_API_KEY = 'sk-test';

      expect(() => {
        ConfigurationValidator.validateRequiredVariables();
      }).toThrow('PORT is not a valid number');
    });

    it('should throw error for PORT out of range', () => {
      process.env.PORT = '99999';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      process.env.OPENAI_API_KEY = 'sk-test';

      expect(() => {
        ConfigurationValidator.validateRequiredVariables();
      }).toThrow('PORT out of valid range');
    });

    it('should throw error for invalid DATABASE_URL', () => {
      process.env.PORT = '3000';
      process.env.DATABASE_URL = 'not-a-url';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      process.env.OPENAI_API_KEY = 'sk-test';

      expect(() => {
        ConfigurationValidator.validateRequiredVariables();
      }).toThrow('DATABASE_URL is not a valid URL');
    });

    it('should accept valid configuration', () => {
      process.env.PORT = '3000';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      process.env.OPENAI_API_KEY = 'sk-test';

      expect(() => {
        ConfigurationValidator.validateRequiredVariables();
      }).not.toThrow();
    });
  });

  describe('validateKillSwitches', () => {
    it('should accept unset kill switches (default enabled)', () => {
      delete process.env.GLOBAL_EXECUTION_ENABLED;

      expect(() => {
        ConfigurationValidator.validateKillSwitches();
      }).not.toThrow();
    });

    it('should accept "true" for kill switches', () => {
      process.env.GLOBAL_EXECUTION_ENABLED = 'true';

      expect(() => {
        ConfigurationValidator.validateKillSwitches();
      }).not.toThrow();
    });

    it('should accept "false" for kill switches', () => {
      process.env.GLOBAL_EXECUTION_ENABLED = 'false';

      expect(() => {
        ConfigurationValidator.validateKillSwitches();
      }).not.toThrow();
    });

    it('should reject "yes" for kill switches', () => {
      process.env.GLOBAL_EXECUTION_ENABLED = 'yes';

      expect(() => {
        ConfigurationValidator.validateKillSwitches();
      }).toThrow('[STARTUP FAILURE] Configuration validation failed');

      expect(() => {
        ConfigurationValidator.validateKillSwitches();
      }).toThrow('GLOBAL_EXECUTION_ENABLED is not boolean-compatible');
    });

    it('should reject "1" for kill switches', () => {
      process.env.GLOBAL_EXECUTION_ENABLED = '1';

      expect(() => {
        ConfigurationValidator.validateKillSwitches();
      }).toThrow('not boolean-compatible');
    });

    it('should reject "enabled" for kill switches', () => {
      process.env.PROVIDER_OPENAI_ENABLED = 'enabled';

      expect(() => {
        ConfigurationValidator.validateKillSwitches();
      }).toThrow('not boolean-compatible');
    });

    it('should validate all kill switches', () => {
      process.env.GLOBAL_EXECUTION_ENABLED = 'true';
      process.env.PROVIDER_OPENAI_ENABLED = 'false';
      process.env.PROVIDER_ANTHROPIC_ENABLED = 'true';
      process.env.BILLING_SNAPSHOT_ENABLED = 'true';

      expect(() => {
        ConfigurationValidator.validateKillSwitches();
      }).not.toThrow();
    });
  });

  describe('validateSafetyLimits', () => {
    it('should accept unset safety limits (use defaults)', () => {
      delete process.env.MAX_TOKENS_PER_EXECUTION;

      expect(() => {
        ConfigurationValidator.validateSafetyLimits();
      }).not.toThrow();
    });

    it('should accept valid numeric limits', () => {
      process.env.MAX_TOKENS_PER_EXECUTION = '100000';
      process.env.MAX_EXECUTIONS_PER_MINUTE_GLOBAL = '10000';

      expect(() => {
        ConfigurationValidator.validateSafetyLimits();
      }).not.toThrow();
    });

    it('should reject non-numeric limits', () => {
      process.env.MAX_TOKENS_PER_EXECUTION = 'unlimited';

      expect(() => {
        ConfigurationValidator.validateSafetyLimits();
      }).toThrow('[STARTUP FAILURE] Safety limit validation failed');

      expect(() => {
        ConfigurationValidator.validateSafetyLimits();
      }).toThrow('MAX_TOKENS_PER_EXECUTION is not a valid number');
    });

    it('should reject limits below minimum', () => {
      process.env.MAX_TOKENS_PER_EXECUTION = '0';

      expect(() => {
        ConfigurationValidator.validateSafetyLimits();
      }).toThrow('must be greater than zero');
    });

    it('should reject limits above maximum', () => {
      process.env.MAX_TOKENS_PER_EXECUTION = '2000000';

      expect(() => {
        ConfigurationValidator.validateSafetyLimits();
      }).toThrow('out of bounds');
    });

    it('should reject when soft cap >= hard cap', () => {
      process.env.MAX_DAILY_SPEND_SOFT_USD = '20000';
      process.env.MAX_DAILY_SPEND_HARD_USD = '20000';

      expect(() => {
        ConfigurationValidator.validateSafetyLimits();
      }).toThrow('[STARTUP FAILURE] Safety limit validation failed');

      expect(() => {
        ConfigurationValidator.validateSafetyLimits();
      }).toThrow('MAX_DAILY_SPEND_SOFT_USD ≥ MAX_DAILY_SPEND_HARD_USD');
    });

    it('should accept when soft cap < hard cap', () => {
      process.env.MAX_DAILY_SPEND_SOFT_USD = '10000';
      process.env.MAX_DAILY_SPEND_HARD_USD = '20000';

      expect(() => {
        ConfigurationValidator.validateSafetyLimits();
      }).not.toThrow();
    });
  });

  describe('validateAll', () => {
    it('should run all validations', () => {
      process.env.PORT = '3000';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      process.env.OPENAI_API_KEY = 'sk-test';
      process.env.GLOBAL_EXECUTION_ENABLED = 'true';
      process.env.MAX_TOKENS_PER_EXECUTION = '100000';
      process.env.MAX_DAILY_SPEND_SOFT_USD = '10000';
      process.env.MAX_DAILY_SPEND_HARD_USD = '20000';
      process.env.LAUNCH_STATE = 'INTERNAL'; // Phase 32A: Required for validateAll
      process.env.ABORT_MODE = 'NONE'; // Phase 32A: Optional but good to set

      expect(() => {
        ConfigurationValidator.validateAll();
      }).not.toThrow();
    });

    it('should fail on first validation error', () => {
      delete process.env.PORT;

      expect(() => {
        ConfigurationValidator.validateAll();
      }).toThrow('PORT not set');
    });
  });
});
