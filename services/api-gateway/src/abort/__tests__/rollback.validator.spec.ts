/**
 * RollbackValidator Unit Tests
 *
 * Phase 28B-2: Abort & Rollback Controls
 *
 * Tests rollback safety validation (monotonic downward transitions only).
 */

import { RollbackValidator } from '../rollback.validator';
import { LaunchState } from '../../launch/launch-state.enum';

describe('RollbackValidator', () => {
  describe('Valid rollbacks (monotonic downward)', () => {
    it('should allow PUBLIC → EARLY_ACCESS', () => {
      expect(
        RollbackValidator.isValidRollback(
          LaunchState.PUBLIC,
          LaunchState.EARLY_ACCESS,
        ),
      ).toBe(true);
      expect(
        RollbackValidator.isRollback(
          LaunchState.PUBLIC,
          LaunchState.EARLY_ACCESS,
        ),
      ).toBe(true);
    });

    it('should allow PUBLIC → INTERNAL', () => {
      expect(
        RollbackValidator.isValidRollback(
          LaunchState.PUBLIC,
          LaunchState.INTERNAL,
        ),
      ).toBe(true);
      expect(
        RollbackValidator.isRollback(
          LaunchState.PUBLIC,
          LaunchState.INTERNAL,
        ),
      ).toBe(true);
    });

    it('should allow PUBLIC → CLOSED', () => {
      expect(
        RollbackValidator.isValidRollback(
          LaunchState.PUBLIC,
          LaunchState.CLOSED,
        ),
      ).toBe(true);
      expect(
        RollbackValidator.isRollback(LaunchState.PUBLIC, LaunchState.CLOSED),
      ).toBe(true);
    });

    it('should allow EARLY_ACCESS → INTERNAL', () => {
      expect(
        RollbackValidator.isValidRollback(
          LaunchState.EARLY_ACCESS,
          LaunchState.INTERNAL,
        ),
      ).toBe(true);
      expect(
        RollbackValidator.isRollback(
          LaunchState.EARLY_ACCESS,
          LaunchState.INTERNAL,
        ),
      ).toBe(true);
    });

    it('should allow EARLY_ACCESS → CLOSED', () => {
      expect(
        RollbackValidator.isValidRollback(
          LaunchState.EARLY_ACCESS,
          LaunchState.CLOSED,
        ),
      ).toBe(true);
      expect(
        RollbackValidator.isRollback(
          LaunchState.EARLY_ACCESS,
          LaunchState.CLOSED,
        ),
      ).toBe(true);
    });

    it('should allow INTERNAL → CLOSED', () => {
      expect(
        RollbackValidator.isValidRollback(
          LaunchState.INTERNAL,
          LaunchState.CLOSED,
        ),
      ).toBe(true);
      expect(
        RollbackValidator.isRollback(LaunchState.INTERNAL, LaunchState.CLOSED),
      ).toBe(true);
    });

    it('should allow same state (no-op)', () => {
      expect(
        RollbackValidator.isValidRollback(
          LaunchState.PUBLIC,
          LaunchState.PUBLIC,
        ),
      ).toBe(true);
      expect(
        RollbackValidator.isRollback(LaunchState.PUBLIC, LaunchState.PUBLIC),
      ).toBe(false); // Not a rollback, just staying same
    });
  });

  describe('Invalid rollbacks (forward transitions)', () => {
    it('should reject CLOSED → INTERNAL', () => {
      expect(
        RollbackValidator.isValidRollback(
          LaunchState.CLOSED,
          LaunchState.INTERNAL,
        ),
      ).toBe(false);
    });

    it('should reject CLOSED → EARLY_ACCESS', () => {
      expect(
        RollbackValidator.isValidRollback(
          LaunchState.CLOSED,
          LaunchState.EARLY_ACCESS,
        ),
      ).toBe(false);
    });

    it('should reject CLOSED → PUBLIC', () => {
      expect(
        RollbackValidator.isValidRollback(
          LaunchState.CLOSED,
          LaunchState.PUBLIC,
        ),
      ).toBe(false);
    });

    it('should reject INTERNAL → EARLY_ACCESS', () => {
      expect(
        RollbackValidator.isValidRollback(
          LaunchState.INTERNAL,
          LaunchState.EARLY_ACCESS,
        ),
      ).toBe(false);
    });

    it('should reject INTERNAL → PUBLIC', () => {
      expect(
        RollbackValidator.isValidRollback(
          LaunchState.INTERNAL,
          LaunchState.PUBLIC,
        ),
      ).toBe(false);
    });

    it('should reject EARLY_ACCESS → PUBLIC', () => {
      expect(
        RollbackValidator.isValidRollback(
          LaunchState.EARLY_ACCESS,
          LaunchState.PUBLIC,
        ),
      ).toBe(false);
    });
  });

  describe('validateRollback() error handling', () => {
    it('should not throw on valid rollback', () => {
      expect(() =>
        RollbackValidator.validateRollback(
          LaunchState.PUBLIC,
          LaunchState.CLOSED,
        ),
      ).not.toThrow();
    });

    it('should throw on invalid rollback with detailed message', () => {
      try {
        RollbackValidator.validateRollback(
          LaunchState.CLOSED,
          LaunchState.PUBLIC,
        );
        fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('STARTUP FAILURE');
        expect(error.message).toContain('Invalid rollback transition');
        expect(error.message).toContain('Forward transition not allowed');
        expect(error.message).toContain('Previous state: CLOSED');
        expect(error.message).toContain('New state: PUBLIC');
        expect(error.message).toContain('Monotonic downward');
      }
    });
  });

  describe('getStateOrder()', () => {
    it('should return correct order for all states', () => {
      expect(RollbackValidator.getStateOrder(LaunchState.CLOSED)).toBe(0);
      expect(RollbackValidator.getStateOrder(LaunchState.INTERNAL)).toBe(1);
      expect(RollbackValidator.getStateOrder(LaunchState.EARLY_ACCESS)).toBe(
        2,
      );
      expect(RollbackValidator.getStateOrder(LaunchState.PUBLIC)).toBe(3);
    });

    it('should have PUBLIC as highest order', () => {
      const publicOrder = RollbackValidator.getStateOrder(LaunchState.PUBLIC);
      const closedOrder = RollbackValidator.getStateOrder(LaunchState.CLOSED);

      expect(publicOrder).toBeGreaterThan(closedOrder);
    });
  });

  describe('isRollback() vs isValidRollback()', () => {
    it('should distinguish between valid rollback and no-op', () => {
      // Valid rollback (moving down)
      expect(
        RollbackValidator.isValidRollback(
          LaunchState.PUBLIC,
          LaunchState.CLOSED,
        ),
      ).toBe(true);
      expect(
        RollbackValidator.isRollback(LaunchState.PUBLIC, LaunchState.CLOSED),
      ).toBe(true);

      // No-op (staying same) - valid but not a rollback
      expect(
        RollbackValidator.isValidRollback(
          LaunchState.PUBLIC,
          LaunchState.PUBLIC,
        ),
      ).toBe(true);
      expect(
        RollbackValidator.isRollback(LaunchState.PUBLIC, LaunchState.PUBLIC),
      ).toBe(false);

      // Invalid (moving up)
      expect(
        RollbackValidator.isValidRollback(
          LaunchState.CLOSED,
          LaunchState.PUBLIC,
        ),
      ).toBe(false);
      expect(
        RollbackValidator.isRollback(LaunchState.CLOSED, LaunchState.PUBLIC),
      ).toBe(false);
    });
  });
});
