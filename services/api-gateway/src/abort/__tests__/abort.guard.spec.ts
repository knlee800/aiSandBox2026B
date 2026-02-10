/**
 * AbortGuard Unit Tests
 *
 * Phase 28B-2: Abort & Rollback Controls
 *
 * Tests abort mode enforcement logic for all three modes.
 */

import { ExecutionContext, ServiceUnavailableException } from '@nestjs/common';
import { AbortGuard } from '../abort.guard';
import { AbortConfig } from '../abort.config';
import { AbortMode } from '../abort-mode.enum';

describe('AbortGuard', () => {
  let guard: AbortGuard;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    guard = new AbortGuard();

    // Reset AbortConfig before each test
    AbortConfig.reset();

    // Mock ExecutionContext
    mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as any;
  });

  describe('NONE mode', () => {
    beforeEach(() => {
      process.env.ABORT_MODE = 'NONE';
      AbortConfig.initialize();
    });

    it('should allow execution', () => {
      expect(guard.canActivate(mockContext)).toBe(true);
    });
  });

  describe('EXECUTION_BLOCKED mode', () => {
    beforeEach(() => {
      process.env.ABORT_MODE = 'EXECUTION_BLOCKED';
      AbortConfig.initialize();
    });

    it('should block execution with 503', () => {
      expect(() => guard.canActivate(mockContext)).toThrow(
        ServiceUnavailableException,
      );
    });

    it('should have appropriate error message', () => {
      try {
        guard.canActivate(mockContext);
        fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('AI execution temporarily unavailable');
        expect(error.message).toContain('system maintenance');
      }
    });
  });

  describe('FULL_SHUTDOWN mode', () => {
    beforeEach(() => {
      process.env.ABORT_MODE = 'FULL_SHUTDOWN';
      AbortConfig.initialize();
    });

    it('should block execution with 503', () => {
      expect(() => guard.canActivate(mockContext)).toThrow(
        ServiceUnavailableException,
      );
    });

    it('should have appropriate error message', () => {
      try {
        guard.canActivate(mockContext);
        fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('Service temporarily unavailable');
        expect(error.message).toContain('emergency maintenance');
      }
    });
  });

  describe('Uninitialized AbortConfig', () => {
    it('should throw if AbortConfig not initialized', () => {
      // Don't initialize AbortConfig
      AbortConfig.reset();

      expect(() => guard.canActivate(mockContext)).toThrow(
        'AbortConfig not initialized',
      );
    });
  });

  describe('Mode transitions', () => {
    it('should enforce new mode after restart', () => {
      // Start with NONE
      process.env.ABORT_MODE = 'NONE';
      AbortConfig.initialize();
      expect(guard.canActivate(mockContext)).toBe(true);

      // Simulate restart: reset + initialize with new mode
      AbortConfig.reset();
      process.env.ABORT_MODE = 'EXECUTION_BLOCKED';
      AbortConfig.initialize();

      expect(() => guard.canActivate(mockContext)).toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
