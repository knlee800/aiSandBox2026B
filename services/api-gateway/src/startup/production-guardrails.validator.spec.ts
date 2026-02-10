/**
 * Production Guardrails Validator Tests
 *
 * Phase 32A: Deployment Hardening
 *
 * Tests production-specific guardrail validation and fail-fast behavior.
 */

import { ProductionGuardrailsValidator } from './production-guardrails.validator';
import { LaunchConfig } from '../launch/launch.config';

describe('ProductionGuardrailsValidator', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    // Reset LaunchConfig state
    LaunchConfig.reset();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    // Reset LaunchConfig state
    LaunchConfig.reset();
  });

  describe('validateProductionRequirements', () => {
    describe('Production Environment', () => {
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
        process.env.BILLING_CHARGES_ENABLED = 'yes';

        expect(() => {
          ProductionGuardrailsValidator.validateProductionRequirements();
        }).toThrow('not boolean-compatible');
      });

      it('should succeed when BILLING_CHARGES_ENABLED is true', () => {
        process.env.BILLING_CHARGES_ENABLED = 'true';

        expect(() => {
          ProductionGuardrailsValidator.validateProductionRequirements();
        }).not.toThrow();
      });

      it('should succeed when BILLING_CHARGES_ENABLED is false', () => {
        process.env.BILLING_CHARGES_ENABLED = 'false';

        expect(() => {
          ProductionGuardrailsValidator.validateProductionRequirements();
        }).not.toThrow();
      });

      it('should fail when unsafe dev flag SKIP_AUTH is enabled', () => {
        process.env.BILLING_CHARGES_ENABLED = 'true';
        process.env.SKIP_AUTH = 'true';

        expect(() => {
          ProductionGuardrailsValidator.validateProductionRequirements();
        }).toThrow('Unsafe development flag enabled: SKIP_AUTH');
      });

      it('should fail when unsafe dev flag SKIP_QUOTA is enabled', () => {
        process.env.BILLING_CHARGES_ENABLED = 'true';
        process.env.SKIP_QUOTA = '1';

        expect(() => {
          ProductionGuardrailsValidator.validateProductionRequirements();
        }).toThrow('Unsafe development flag enabled: SKIP_QUOTA');
      });

      it('should fail when unsafe dev flag DEBUG_MODE is enabled', () => {
        process.env.BILLING_CHARGES_ENABLED = 'true';
        process.env.DEBUG_MODE = 'yes';

        expect(() => {
          ProductionGuardrailsValidator.validateProductionRequirements();
        }).toThrow('Unsafe development flag enabled: DEBUG_MODE');
      });

      it('should fail when ALLOW_STUB_PROVIDER is enabled', () => {
        process.env.BILLING_CHARGES_ENABLED = 'true';
        process.env.ALLOW_STUB_PROVIDER = 'true';

        expect(() => {
          ProductionGuardrailsValidator.validateProductionRequirements();
        }).toThrow('Unsafe development flag enabled: ALLOW_STUB_PROVIDER');
      });

      it('should fail when DISABLE_RATE_LIMITING is enabled', () => {
        process.env.BILLING_CHARGES_ENABLED = 'true';
        process.env.DISABLE_RATE_LIMITING = 'true';

        expect(() => {
          ProductionGuardrailsValidator.validateProductionRequirements();
        }).toThrow('Unsafe development flag enabled: DISABLE_RATE_LIMITING');
      });

      it('should succeed with safe configuration', () => {
        process.env.BILLING_CHARGES_ENABLED = 'true';
        process.env.GLOBAL_EXECUTION_ENABLED = 'true';

        expect(() => {
          ProductionGuardrailsValidator.validateProductionRequirements();
        }).not.toThrow();
      });
    });

    describe('Staging Environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'staging';
        process.env.LAUNCH_STATE = 'INTERNAL';
        LaunchConfig.initialize();
      });

      it('should not enforce BILLING_CHARGES_ENABLED requirement', () => {
        delete process.env.BILLING_CHARGES_ENABLED;

        // Should not throw in staging (only warns)
        expect(() => {
          ProductionGuardrailsValidator.validateProductionRequirements();
        }).not.toThrow();
      });
    });

    describe('Development Environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
        process.env.LAUNCH_STATE = 'INTERNAL';
        LaunchConfig.initialize();
      });

      it('should not enforce production requirements', () => {
        delete process.env.BILLING_CHARGES_ENABLED;

        expect(() => {
          ProductionGuardrailsValidator.validateProductionRequirements();
        }).not.toThrow();
      });

      it('should allow unsafe dev flags', () => {
        process.env.SKIP_AUTH = 'true';
        process.env.DEBUG_MODE = 'true';

        expect(() => {
          ProductionGuardrailsValidator.validateProductionRequirements();
        }).not.toThrow();
      });
    });
  });

  describe('validateStagingRequirements', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'staging';
      process.env.LAUNCH_STATE = 'INTERNAL';
      LaunchConfig.initialize();
    });

    it('should not throw on missing BILLING_CHARGES_ENABLED', () => {
      delete process.env.BILLING_CHARGES_ENABLED;

      // Should warn but not throw
      expect(() => {
        ProductionGuardrailsValidator.validateStagingRequirements();
      }).not.toThrow();
    });

    it('should not throw on stub provider', () => {
      process.env.AI_PROVIDER = 'stub';

      // Should warn but not throw
      expect(() => {
        ProductionGuardrailsValidator.validateStagingRequirements();
      }).not.toThrow();
    });

    it('should succeed with production-like configuration', () => {
      process.env.BILLING_CHARGES_ENABLED = 'false';
      process.env.AI_PROVIDER = 'anthropic';

      expect(() => {
        ProductionGuardrailsValidator.validateStagingRequirements();
      }).not.toThrow();
    });
  });

  describe('validateAll', () => {
    it('should validate production requirements in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.LAUNCH_STATE = 'INTERNAL';
      LaunchConfig.initialize();
      delete process.env.BILLING_CHARGES_ENABLED;

      expect(() => {
        ProductionGuardrailsValidator.validateAll();
      }).toThrow('BILLING_CHARGES_ENABLED not explicitly set');
    });

    it('should validate staging requirements in staging', () => {
      process.env.NODE_ENV = 'staging';
      process.env.LAUNCH_STATE = 'INTERNAL';
      LaunchConfig.initialize();

      // Should not throw (only warns)
      expect(() => {
        ProductionGuardrailsValidator.validateAll();
      }).not.toThrow();
    });

    it('should skip validation in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.LAUNCH_STATE = 'INTERNAL';
      LaunchConfig.initialize();

      expect(() => {
        ProductionGuardrailsValidator.validateAll();
      }).not.toThrow();
    });
  });

  describe('Launch State Consistency', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.BILLING_CHARGES_ENABLED = 'true';
    });

    it('should warn on PUBLIC launch state without confirmation', () => {
      process.env.LAUNCH_STATE = 'PUBLIC';
      LaunchConfig.initialize();
      delete process.env.PUBLIC_LAUNCH_CONFIRMED;

      // Should not throw, but may warn
      expect(() => {
        ProductionGuardrailsValidator.validateProductionRequirements();
      }).not.toThrow();
    });

    it('should not warn on PUBLIC launch state with confirmation', () => {
      process.env.LAUNCH_STATE = 'PUBLIC';
      process.env.PUBLIC_LAUNCH_CONFIRMED = 'true';
      LaunchConfig.initialize();

      expect(() => {
        ProductionGuardrailsValidator.validateProductionRequirements();
      }).not.toThrow();
    });

    it('should warn on CLOSED launch state in production', () => {
      process.env.LAUNCH_STATE = 'CLOSED';
      LaunchConfig.initialize();

      // Should not throw, but may warn
      expect(() => {
        ProductionGuardrailsValidator.validateProductionRequirements();
      }).not.toThrow();
    });
  });
});
