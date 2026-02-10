/**
 * Abort and Rollback Startup Validation Tests
 *
 * Phase 28B-2: Abort & Rollback Controls
 *
 * Tests that invalid abort mode or rollback configuration causes startup failure.
 */

import { AbortConfig } from '../abort.config';
import { LaunchConfig } from '../../launch/launch.config';
import { ConfigurationValidator } from '../../startup/configuration.validator';

describe('Abort and Rollback Startup Validation', () => {
  beforeEach(() => {
    AbortConfig.reset();
    LaunchConfig.reset();
    delete process.env.ABORT_MODE;
    delete process.env.LAUNCH_STATE;
    delete process.env.PREVIOUS_LAUNCH_STATE;

    // Set minimum required variables for ConfigurationValidator
    process.env.NODE_ENV = 'development';
    process.env.PORT = '3000';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  });

  describe('Abort mode validation', () => {
    it('should pass with ABORT_MODE=NONE', () => {
      process.env.ABORT_MODE = 'NONE';
      process.env.LAUNCH_STATE = 'PUBLIC';

      expect(() => ConfigurationValidator.validateAbortMode()).not.toThrow();
      expect(AbortConfig.isInitialized()).toBe(true);
      expect(AbortConfig.getCurrentMode()).toBe('NONE');
    });

    it('should pass with ABORT_MODE=EXECUTION_BLOCKED', () => {
      process.env.ABORT_MODE = 'EXECUTION_BLOCKED';
      process.env.LAUNCH_STATE = 'PUBLIC';

      expect(() => ConfigurationValidator.validateAbortMode()).not.toThrow();
      expect(AbortConfig.getCurrentMode()).toBe('EXECUTION_BLOCKED');
    });

    it('should pass with ABORT_MODE=FULL_SHUTDOWN', () => {
      process.env.ABORT_MODE = 'FULL_SHUTDOWN';
      process.env.LAUNCH_STATE = 'PUBLIC';

      expect(() => ConfigurationValidator.validateAbortMode()).not.toThrow();
      expect(AbortConfig.getCurrentMode()).toBe('FULL_SHUTDOWN');
    });

    it('should default to NONE when ABORT_MODE not set', () => {
      delete process.env.ABORT_MODE;
      process.env.LAUNCH_STATE = 'PUBLIC';

      expect(() => ConfigurationValidator.validateAbortMode()).not.toThrow();
      expect(AbortConfig.getCurrentMode()).toBe('NONE');
    });

    it('should fail with invalid ABORT_MODE', () => {
      process.env.ABORT_MODE = 'INVALID';
      process.env.LAUNCH_STATE = 'PUBLIC';

      expect(() => ConfigurationValidator.validateAbortMode()).toThrow(
        'STARTUP FAILURE: Invalid ABORT_MODE="INVALID"',
      );
    });
  });

  describe('Rollback safety validation', () => {
    it('should pass with no PREVIOUS_LAUNCH_STATE', () => {
      delete process.env.PREVIOUS_LAUNCH_STATE;
      process.env.LAUNCH_STATE = 'PUBLIC';

      LaunchConfig.initialize();
      expect(() => ConfigurationValidator.validateRollbackSafety()).not.toThrow();
    });

    it('should pass with valid rollback PUBLIC → CLOSED', () => {
      process.env.PREVIOUS_LAUNCH_STATE = 'PUBLIC';
      process.env.LAUNCH_STATE = 'CLOSED';

      LaunchConfig.initialize();
      expect(() => ConfigurationValidator.validateRollbackSafety()).not.toThrow();
    });

    it('should pass with valid rollback PUBLIC → EARLY_ACCESS', () => {
      process.env.PREVIOUS_LAUNCH_STATE = 'PUBLIC';
      process.env.LAUNCH_STATE = 'EARLY_ACCESS';

      LaunchConfig.initialize();
      expect(() => ConfigurationValidator.validateRollbackSafety()).not.toThrow();
    });

    it('should pass with valid rollback EARLY_ACCESS → INTERNAL', () => {
      process.env.PREVIOUS_LAUNCH_STATE = 'EARLY_ACCESS';
      process.env.LAUNCH_STATE = 'INTERNAL';

      LaunchConfig.initialize();
      expect(() => ConfigurationValidator.validateRollbackSafety()).not.toThrow();
    });

    it('should pass with same state (no-op)', () => {
      process.env.PREVIOUS_LAUNCH_STATE = 'PUBLIC';
      process.env.LAUNCH_STATE = 'PUBLIC';

      LaunchConfig.initialize();
      expect(() => ConfigurationValidator.validateRollbackSafety()).not.toThrow();
    });

    it('should fail with forward transition CLOSED → PUBLIC', () => {
      process.env.PREVIOUS_LAUNCH_STATE = 'CLOSED';
      process.env.LAUNCH_STATE = 'PUBLIC';

      LaunchConfig.initialize();
      expect(() => ConfigurationValidator.validateRollbackSafety()).toThrow(
        'STARTUP FAILURE: Invalid rollback transition',
      );
      expect(() => ConfigurationValidator.validateRollbackSafety()).toThrow(
        'Forward transition not allowed',
      );
    });

    it('should fail with forward transition INTERNAL → PUBLIC', () => {
      process.env.PREVIOUS_LAUNCH_STATE = 'INTERNAL';
      process.env.LAUNCH_STATE = 'PUBLIC';

      LaunchConfig.initialize();
      expect(() => ConfigurationValidator.validateRollbackSafety()).toThrow(
        'STARTUP FAILURE',
      );
    });

    it('should fail with invalid PREVIOUS_LAUNCH_STATE', () => {
      process.env.PREVIOUS_LAUNCH_STATE = 'INVALID';
      process.env.LAUNCH_STATE = 'PUBLIC';

      LaunchConfig.initialize();
      expect(() => ConfigurationValidator.validateRollbackSafety()).toThrow(
        'STARTUP FAILURE: Invalid PREVIOUS_LAUNCH_STATE="INVALID"',
      );
    });
  });

  describe('Integration with ConfigurationValidator.validateAll()', () => {
    it('should call validateAbortMode as part of validateAll', () => {
      process.env.ABORT_MODE = 'NONE';
      process.env.LAUNCH_STATE = 'PUBLIC';

      expect(() => ConfigurationValidator.validateAll()).not.toThrow();
      expect(AbortConfig.isInitialized()).toBe(true);
    });

    it('should call validateRollbackSafety as part of validateAll', () => {
      process.env.PREVIOUS_LAUNCH_STATE = 'PUBLIC';
      process.env.LAUNCH_STATE = 'CLOSED';

      expect(() => ConfigurationValidator.validateAll()).not.toThrow();
    });

    it('should fail validateAll with invalid abort mode', () => {
      process.env.ABORT_MODE = 'INVALID';
      process.env.LAUNCH_STATE = 'PUBLIC';

      expect(() => ConfigurationValidator.validateAll()).toThrow(
        'STARTUP FAILURE',
      );
    });

    it('should fail validateAll with invalid rollback', () => {
      process.env.PREVIOUS_LAUNCH_STATE = 'CLOSED';
      process.env.LAUNCH_STATE = 'PUBLIC';

      expect(() => ConfigurationValidator.validateAll()).toThrow(
        'STARTUP FAILURE',
      );
    });
  });

  describe('Error messages', () => {
    it('should include valid modes in abort error message', () => {
      process.env.ABORT_MODE = 'WRONG';
      process.env.LAUNCH_STATE = 'PUBLIC';

      try {
        ConfigurationValidator.validateAbortMode();
        fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('NONE');
        expect(error.message).toContain('EXECUTION_BLOCKED');
        expect(error.message).toContain('FULL_SHUTDOWN');
      }
    });

    it('should include state details in rollback error message', () => {
      process.env.PREVIOUS_LAUNCH_STATE = 'CLOSED';
      process.env.LAUNCH_STATE = 'PUBLIC';

      LaunchConfig.initialize();

      try {
        ConfigurationValidator.validateRollbackSafety();
        fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('Previous state: CLOSED');
        expect(error.message).toContain('New state: PUBLIC');
        expect(error.message).toContain('Monotonic downward');
      }
    });
  });
});
