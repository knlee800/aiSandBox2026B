/**
 * AbortConfig Unit Tests
 *
 * Phase 28B-2: Abort & Rollback Controls
 *
 * Tests abort configuration validation and initialization.
 */

import { AbortConfig } from '../abort.config';
import { AbortMode } from '../abort-mode.enum';

describe('AbortConfig', () => {
  beforeEach(() => {
    // Reset AbortConfig before each test
    AbortConfig.reset();
    delete process.env.ABORT_MODE;
  });

  describe('Valid abort modes', () => {
    it('should default to NONE when ABORT_MODE not set', () => {
      delete process.env.ABORT_MODE;
      AbortConfig.initialize();

      expect(AbortConfig.getCurrentMode()).toBe(AbortMode.NONE);
      expect(AbortConfig.isAbortActive()).toBe(false);
    });

    it('should initialize with NONE mode', () => {
      process.env.ABORT_MODE = 'NONE';
      AbortConfig.initialize();

      expect(AbortConfig.getCurrentMode()).toBe(AbortMode.NONE);
      expect(AbortConfig.isAbortActive()).toBe(false);
    });

    it('should initialize with EXECUTION_BLOCKED mode', () => {
      process.env.ABORT_MODE = 'EXECUTION_BLOCKED';
      AbortConfig.initialize();

      expect(AbortConfig.getCurrentMode()).toBe(AbortMode.EXECUTION_BLOCKED);
      expect(AbortConfig.isAbortActive()).toBe(true);
    });

    it('should initialize with FULL_SHUTDOWN mode', () => {
      process.env.ABORT_MODE = 'FULL_SHUTDOWN';
      AbortConfig.initialize();

      expect(AbortConfig.getCurrentMode()).toBe(AbortMode.FULL_SHUTDOWN);
      expect(AbortConfig.isAbortActive()).toBe(true);
    });

    it('should handle lowercase mode values', () => {
      process.env.ABORT_MODE = 'none';
      AbortConfig.initialize();

      expect(AbortConfig.getCurrentMode()).toBe(AbortMode.NONE);
    });

    it('should handle mixed case mode values', () => {
      process.env.ABORT_MODE = 'Execution_Blocked';
      AbortConfig.initialize();

      expect(AbortConfig.getCurrentMode()).toBe(AbortMode.EXECUTION_BLOCKED);
    });

    it('should default to NONE when empty string', () => {
      process.env.ABORT_MODE = '';
      AbortConfig.initialize();

      expect(AbortConfig.getCurrentMode()).toBe(AbortMode.NONE);
    });

    it('should default to NONE when whitespace only', () => {
      process.env.ABORT_MODE = '   ';
      AbortConfig.initialize();

      expect(AbortConfig.getCurrentMode()).toBe(AbortMode.NONE);
    });
  });

  describe('Invalid abort modes', () => {
    it('should throw on invalid mode value', () => {
      process.env.ABORT_MODE = 'INVALID';

      expect(() => AbortConfig.initialize()).toThrow(
        'STARTUP FAILURE: Invalid ABORT_MODE="INVALID"',
      );
      expect(() => AbortConfig.initialize()).toThrow(
        'Valid values: NONE, EXECUTION_BLOCKED, FULL_SHUTDOWN',
      );
    });

    it('should throw on partial mode match', () => {
      process.env.ABORT_MODE = 'EXECUTION';

      expect(() => AbortConfig.initialize()).toThrow('STARTUP FAILURE');
    });

    it('should throw on numeric value', () => {
      process.env.ABORT_MODE = '1';

      expect(() => AbortConfig.initialize()).toThrow('STARTUP FAILURE');
    });

    it('should throw on boolean value', () => {
      process.env.ABORT_MODE = 'true';

      expect(() => AbortConfig.initialize()).toThrow('STARTUP FAILURE');
    });
  });

  describe('Initialization state', () => {
    it('should report not initialized before initialize()', () => {
      expect(AbortConfig.isInitialized()).toBe(false);
    });

    it('should report initialized after initialize()', () => {
      process.env.ABORT_MODE = 'NONE';
      AbortConfig.initialize();

      expect(AbortConfig.isInitialized()).toBe(true);
    });

    it('should throw when getting mode before initialization', () => {
      expect(() => AbortConfig.getCurrentMode()).toThrow(
        'AbortConfig not initialized',
      );
    });

    it('should allow multiple getCurrentMode() calls after initialization', () => {
      process.env.ABORT_MODE = 'EXECUTION_BLOCKED';
      AbortConfig.initialize();

      expect(AbortConfig.getCurrentMode()).toBe(AbortMode.EXECUTION_BLOCKED);
      expect(AbortConfig.getCurrentMode()).toBe(AbortMode.EXECUTION_BLOCKED);
      expect(AbortConfig.getCurrentMode()).toBe(AbortMode.EXECUTION_BLOCKED);
    });
  });

  describe('Reset functionality', () => {
    it('should reset initialization state', () => {
      process.env.ABORT_MODE = 'FULL_SHUTDOWN';
      AbortConfig.initialize();

      expect(AbortConfig.isInitialized()).toBe(true);

      AbortConfig.reset();

      expect(AbortConfig.isInitialized()).toBe(false);
    });

    it('should require re-initialization after reset', () => {
      process.env.ABORT_MODE = 'NONE';
      AbortConfig.initialize();

      AbortConfig.reset();

      expect(() => AbortConfig.getCurrentMode()).toThrow(
        'AbortConfig not initialized',
      );
    });

    it('should allow re-initialization with different mode', () => {
      process.env.ABORT_MODE = 'NONE';
      AbortConfig.initialize();
      expect(AbortConfig.getCurrentMode()).toBe(AbortMode.NONE);

      AbortConfig.reset();

      process.env.ABORT_MODE = 'FULL_SHUTDOWN';
      AbortConfig.initialize();
      expect(AbortConfig.getCurrentMode()).toBe(AbortMode.FULL_SHUTDOWN);
    });
  });

  describe('Immutability', () => {
    it('should not allow mode change without reset', () => {
      process.env.ABORT_MODE = 'NONE';
      AbortConfig.initialize();

      expect(AbortConfig.getCurrentMode()).toBe(AbortMode.NONE);

      // Change environment variable (should not affect current mode)
      process.env.ABORT_MODE = 'FULL_SHUTDOWN';

      // Mode should remain NONE (no runtime mutation)
      expect(AbortConfig.getCurrentMode()).toBe(AbortMode.NONE);
    });

    it('should require restart (reset + initialize) to change mode', () => {
      process.env.ABORT_MODE = 'NONE';
      AbortConfig.initialize();

      expect(AbortConfig.getCurrentMode()).toBe(AbortMode.NONE);

      // Simulate restart: reset + change env + initialize
      AbortConfig.reset();
      process.env.ABORT_MODE = 'EXECUTION_BLOCKED';
      AbortConfig.initialize();

      expect(AbortConfig.getCurrentMode()).toBe(AbortMode.EXECUTION_BLOCKED);
    });
  });

  describe('isAbortActive()', () => {
    it('should return false for NONE mode', () => {
      process.env.ABORT_MODE = 'NONE';
      AbortConfig.initialize();

      expect(AbortConfig.isAbortActive()).toBe(false);
    });

    it('should return true for EXECUTION_BLOCKED mode', () => {
      process.env.ABORT_MODE = 'EXECUTION_BLOCKED';
      AbortConfig.initialize();

      expect(AbortConfig.isAbortActive()).toBe(true);
    });

    it('should return true for FULL_SHUTDOWN mode', () => {
      process.env.ABORT_MODE = 'FULL_SHUTDOWN';
      AbortConfig.initialize();

      expect(AbortConfig.isAbortActive()).toBe(true);
    });
  });
});
