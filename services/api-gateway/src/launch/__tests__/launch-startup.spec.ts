/**
 * Startup Validation Tests for Launch State
 *
 * Phase 28B-1: Launch Readiness Implementation
 *
 * Tests that invalid launch state configuration causes startup failure.
 */

import { LaunchConfig } from '../launch.config';
import { ConfigurationValidator } from '../../startup/configuration.validator';

describe('Launch State Startup Validation', () => {
  beforeEach(() => {
    LaunchConfig.reset();
    delete process.env.LAUNCH_STATE;

    // Set minimum required variables for ConfigurationValidator
    process.env.NODE_ENV = 'development';
    process.env.PORT = '3000';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  });

  describe('Valid configurations', () => {
    it('should pass startup validation with CLOSED state', () => {
      process.env.LAUNCH_STATE = 'CLOSED';

      expect(() => ConfigurationValidator.validateLaunchState()).not.toThrow();
      expect(LaunchConfig.isInitialized()).toBe(true);
      expect(LaunchConfig.getCurrentState()).toBe('CLOSED');
    });

    it('should pass startup validation with INTERNAL state', () => {
      process.env.LAUNCH_STATE = 'INTERNAL';

      expect(() => ConfigurationValidator.validateLaunchState()).not.toThrow();
      expect(LaunchConfig.getCurrentState()).toBe('INTERNAL');
    });

    it('should pass startup validation with EARLY_ACCESS state', () => {
      process.env.LAUNCH_STATE = 'EARLY_ACCESS';

      expect(() => ConfigurationValidator.validateLaunchState()).not.toThrow();
      expect(LaunchConfig.getCurrentState()).toBe('EARLY_ACCESS');
    });

    it('should pass startup validation with PUBLIC state', () => {
      process.env.LAUNCH_STATE = 'PUBLIC';

      expect(() => ConfigurationValidator.validateLaunchState()).not.toThrow();
      expect(LaunchConfig.getCurrentState()).toBe('PUBLIC');
    });
  });

  describe('Invalid configurations - startup failure', () => {
    it('should fail startup validation with missing LAUNCH_STATE', () => {
      delete process.env.LAUNCH_STATE;

      expect(() => ConfigurationValidator.validateLaunchState()).toThrow(
        'STARTUP FAILURE: LAUNCH_STATE environment variable not set',
      );
      expect(LaunchConfig.isInitialized()).toBe(false);
    });

    it('should fail startup validation with empty LAUNCH_STATE', () => {
      process.env.LAUNCH_STATE = '';

      expect(() => ConfigurationValidator.validateLaunchState()).toThrow(
        'STARTUP FAILURE',
      );
      expect(LaunchConfig.isInitialized()).toBe(false);
    });

    it('should fail startup validation with invalid state', () => {
      process.env.LAUNCH_STATE = 'INVALID';

      expect(() => ConfigurationValidator.validateLaunchState()).toThrow(
        'STARTUP FAILURE: Invalid LAUNCH_STATE="INVALID"',
      );
      expect(() => ConfigurationValidator.validateLaunchState()).toThrow(
        'Valid values: CLOSED, INTERNAL, EARLY_ACCESS, PUBLIC',
      );
      expect(LaunchConfig.isInitialized()).toBe(false);
    });

    it('should fail startup validation with partial match', () => {
      process.env.LAUNCH_STATE = 'PUBLIC_BETA';

      expect(() => ConfigurationValidator.validateLaunchState()).toThrow(
        'STARTUP FAILURE',
      );
    });

    it('should fail startup validation with numeric value', () => {
      process.env.LAUNCH_STATE = '1';

      expect(() => ConfigurationValidator.validateLaunchState()).toThrow(
        'STARTUP FAILURE',
      );
    });
  });

  describe('Integration with ConfigurationValidator.validateAll()', () => {
    it('should call validateLaunchState as part of validateAll', () => {
      process.env.LAUNCH_STATE = 'PUBLIC';

      expect(() => ConfigurationValidator.validateAll()).not.toThrow();
      expect(LaunchConfig.isInitialized()).toBe(true);
    });

    it('should fail validateAll if launch state invalid', () => {
      process.env.LAUNCH_STATE = 'INVALID';

      expect(() => ConfigurationValidator.validateAll()).toThrow(
        'STARTUP FAILURE',
      );
    });

    it('should fail validateAll if launch state missing', () => {
      delete process.env.LAUNCH_STATE;

      expect(() => ConfigurationValidator.validateAll()).toThrow(
        'STARTUP FAILURE: LAUNCH_STATE environment variable not set',
      );
    });
  });

  describe('Error messages', () => {
    it('should include valid values in error message', () => {
      process.env.LAUNCH_STATE = 'WRONG';

      try {
        ConfigurationValidator.validateLaunchState();
        fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('CLOSED');
        expect(error.message).toContain('INTERNAL');
        expect(error.message).toContain('EARLY_ACCESS');
        expect(error.message).toContain('PUBLIC');
      }
    });

    it('should include actual value in error message', () => {
      process.env.LAUNCH_STATE = 'PRODUCTION';

      try {
        ConfigurationValidator.validateLaunchState();
        fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('PRODUCTION');
      }
    });

    it('should clearly indicate startup failure', () => {
      process.env.LAUNCH_STATE = 'INVALID';

      try {
        ConfigurationValidator.validateLaunchState();
        fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('STARTUP FAILURE');
      }
    });
  });
});
