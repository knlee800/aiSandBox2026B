/**
 * LaunchConfig Unit Tests
 *
 * Phase 28B-1: Launch Readiness Implementation
 *
 * Tests launch configuration validation and initialization.
 */

import { LaunchConfig } from '../launch.config';
import { LaunchState } from '../launch-state.enum';

describe('LaunchConfig', () => {
  beforeEach(() => {
    // Reset LaunchConfig before each test
    LaunchConfig.reset();
    delete process.env.LAUNCH_STATE;
  });

  describe('Valid launch states', () => {
    it('should initialize with CLOSED state', () => {
      process.env.LAUNCH_STATE = 'CLOSED';
      LaunchConfig.initialize();

      expect(LaunchConfig.getCurrentState()).toBe(LaunchState.CLOSED);
    });

    it('should initialize with INTERNAL state', () => {
      process.env.LAUNCH_STATE = 'INTERNAL';
      LaunchConfig.initialize();

      expect(LaunchConfig.getCurrentState()).toBe(LaunchState.INTERNAL);
    });

    it('should initialize with EARLY_ACCESS state', () => {
      process.env.LAUNCH_STATE = 'EARLY_ACCESS';
      LaunchConfig.initialize();

      expect(LaunchConfig.getCurrentState()).toBe(LaunchState.EARLY_ACCESS);
    });

    it('should initialize with PUBLIC state', () => {
      process.env.LAUNCH_STATE = 'PUBLIC';
      LaunchConfig.initialize();

      expect(LaunchConfig.getCurrentState()).toBe(LaunchState.PUBLIC);
    });

    it('should handle lowercase state values', () => {
      process.env.LAUNCH_STATE = 'public';
      LaunchConfig.initialize();

      expect(LaunchConfig.getCurrentState()).toBe(LaunchState.PUBLIC);
    });

    it('should handle mixed case state values', () => {
      process.env.LAUNCH_STATE = 'Early_Access';
      LaunchConfig.initialize();

      expect(LaunchConfig.getCurrentState()).toBe(LaunchState.EARLY_ACCESS);
    });
  });

  describe('Invalid launch states', () => {
    it('should throw on missing LAUNCH_STATE', () => {
      delete process.env.LAUNCH_STATE;

      expect(() => LaunchConfig.initialize()).toThrow(
        'STARTUP FAILURE: LAUNCH_STATE environment variable not set',
      );
    });

    it('should throw on empty LAUNCH_STATE', () => {
      process.env.LAUNCH_STATE = '';

      expect(() => LaunchConfig.initialize()).toThrow(
        'STARTUP FAILURE: LAUNCH_STATE environment variable not set',
      );
    });

    it('should throw on invalid state value', () => {
      process.env.LAUNCH_STATE = 'INVALID';

      expect(() => LaunchConfig.initialize()).toThrow(
        'STARTUP FAILURE: Invalid LAUNCH_STATE="INVALID"',
      );
      expect(() => LaunchConfig.initialize()).toThrow(
        'Valid values: CLOSED, INTERNAL, EARLY_ACCESS, PUBLIC',
      );
    });

    it('should throw on partial state match', () => {
      process.env.LAUNCH_STATE = 'PUBLIC_BETA';

      expect(() => LaunchConfig.initialize()).toThrow('STARTUP FAILURE');
    });

    it('should throw on numeric value', () => {
      process.env.LAUNCH_STATE = '1';

      expect(() => LaunchConfig.initialize()).toThrow('STARTUP FAILURE');
    });

    it('should throw on boolean value', () => {
      process.env.LAUNCH_STATE = 'true';

      expect(() => LaunchConfig.initialize()).toThrow('STARTUP FAILURE');
    });
  });

  describe('Initialization state', () => {
    it('should report not initialized before initialize()', () => {
      expect(LaunchConfig.isInitialized()).toBe(false);
    });

    it('should report initialized after initialize()', () => {
      process.env.LAUNCH_STATE = 'PUBLIC';
      LaunchConfig.initialize();

      expect(LaunchConfig.isInitialized()).toBe(true);
    });

    it('should throw when getting state before initialization', () => {
      expect(() => LaunchConfig.getCurrentState()).toThrow(
        'LaunchConfig not initialized',
      );
    });

    it('should allow multiple getCurrentState() calls after initialization', () => {
      process.env.LAUNCH_STATE = 'INTERNAL';
      LaunchConfig.initialize();

      expect(LaunchConfig.getCurrentState()).toBe(LaunchState.INTERNAL);
      expect(LaunchConfig.getCurrentState()).toBe(LaunchState.INTERNAL);
      expect(LaunchConfig.getCurrentState()).toBe(LaunchState.INTERNAL);
    });
  });

  describe('Reset functionality', () => {
    it('should reset initialization state', () => {
      process.env.LAUNCH_STATE = 'PUBLIC';
      LaunchConfig.initialize();

      expect(LaunchConfig.isInitialized()).toBe(true);

      LaunchConfig.reset();

      expect(LaunchConfig.isInitialized()).toBe(false);
    });

    it('should require re-initialization after reset', () => {
      process.env.LAUNCH_STATE = 'PUBLIC';
      LaunchConfig.initialize();

      LaunchConfig.reset();

      expect(() => LaunchConfig.getCurrentState()).toThrow(
        'LaunchConfig not initialized',
      );
    });

    it('should allow re-initialization with different state', () => {
      process.env.LAUNCH_STATE = 'INTERNAL';
      LaunchConfig.initialize();
      expect(LaunchConfig.getCurrentState()).toBe(LaunchState.INTERNAL);

      LaunchConfig.reset();

      process.env.LAUNCH_STATE = 'PUBLIC';
      LaunchConfig.initialize();
      expect(LaunchConfig.getCurrentState()).toBe(LaunchState.PUBLIC);
    });
  });

  describe('Immutability', () => {
    it('should not allow state change without reset', () => {
      process.env.LAUNCH_STATE = 'INTERNAL';
      LaunchConfig.initialize();

      expect(LaunchConfig.getCurrentState()).toBe(LaunchState.INTERNAL);

      // Change environment variable (should not affect current state)
      process.env.LAUNCH_STATE = 'PUBLIC';

      // State should remain INTERNAL (no runtime mutation)
      expect(LaunchConfig.getCurrentState()).toBe(LaunchState.INTERNAL);
    });

    it('should require restart (reset + initialize) to change state', () => {
      process.env.LAUNCH_STATE = 'INTERNAL';
      LaunchConfig.initialize();

      expect(LaunchConfig.getCurrentState()).toBe(LaunchState.INTERNAL);

      // Simulate restart: reset + change env + initialize
      LaunchConfig.reset();
      process.env.LAUNCH_STATE = 'PUBLIC';
      LaunchConfig.initialize();

      expect(LaunchConfig.getCurrentState()).toBe(LaunchState.PUBLIC);
    });
  });
});
