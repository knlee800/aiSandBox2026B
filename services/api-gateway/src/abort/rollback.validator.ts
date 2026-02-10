import { LaunchState } from '../launch/launch-state.enum';

/**
 * RollbackValidator
 *
 * Phase 28B-2: Abort & Rollback Controls
 *
 * Validates rollback safety for launch state transitions.
 * Ensures rollback is monotonic downward only (no forward transitions during abort).
 *
 * Valid Rollback Path (Monotonic Downward):
 * PUBLIC → EARLY_ACCESS → INTERNAL → CLOSED
 *
 * Invalid Rollbacks:
 * - Forward transitions (e.g., INTERNAL → PUBLIC)
 * - Skipping states (e.g., PUBLIC → CLOSED without passing through intermediates)
 *   Note: Skipping is ALLOWED (e.g., PUBLIC → CLOSED is valid emergency rollback)
 *
 * Principles:
 * - Fail-fast on invalid rollback configuration
 * - Deterministic validation
 * - No runtime state tracking (validates configuration only)
 */

export class RollbackValidator {
  /**
   * Launch state ordering (highest to lowest)
   * PUBLIC > EARLY_ACCESS > INTERNAL > CLOSED
   */
  private static readonly STATE_ORDER: Record<LaunchState, number> = {
    [LaunchState.PUBLIC]: 3,
    [LaunchState.EARLY_ACCESS]: 2,
    [LaunchState.INTERNAL]: 1,
    [LaunchState.CLOSED]: 0,
  };

  /**
   * Validate rollback transition
   *
   * Rollback is valid if:
   * - New state is lower or equal in the order (monotonic downward)
   * - States are different (no no-op transitions required, but allowed)
   *
   * @param previousState - Previous launch state
   * @param newState - New launch state
   * @returns true if rollback is valid
   */
  static isValidRollback(
    previousState: LaunchState,
    newState: LaunchState,
  ): boolean {
    const previousOrder = this.STATE_ORDER[previousState];
    const newOrder = this.STATE_ORDER[newState];

    // Rollback is valid if moving downward or staying same
    // (downward: new order <= previous order)
    return newOrder <= previousOrder;
  }

  /**
   * Validate rollback and throw on invalid transition
   *
   * @param previousState - Previous launch state
   * @param newState - New launch state
   * @throws Error if rollback is invalid
   */
  static validateRollback(
    previousState: LaunchState,
    newState: LaunchState,
  ): void {
    if (!this.isValidRollback(previousState, newState)) {
      throw new Error(
        `STARTUP FAILURE: Invalid rollback transition\n` +
          `Reason: Forward transition not allowed during rollback\n` +
          `Previous state: ${previousState}\n` +
          `New state: ${newState}\n` +
          `Expected: Monotonic downward (PUBLIC → EARLY_ACCESS → INTERNAL → CLOSED)\n` +
          `Remediation: Use valid rollback path or remove PREVIOUS_LAUNCH_STATE\n` +
          'Exit Code: 1',
      );
    }
  }

  /**
   * Get state order for comparison
   *
   * @param state - Launch state
   * @returns Numeric order (higher = more permissive)
   */
  static getStateOrder(state: LaunchState): number {
    return this.STATE_ORDER[state];
  }

  /**
   * Check if transition is a rollback (moving downward)
   *
   * @param previousState - Previous launch state
   * @param newState - New launch state
   * @returns true if transitioning to a less permissive state
   */
  static isRollback(
    previousState: LaunchState,
    newState: LaunchState,
  ): boolean {
    const previousOrder = this.STATE_ORDER[previousState];
    const newOrder = this.STATE_ORDER[newState];

    // Rollback is moving downward (new order < previous order)
    return newOrder < previousOrder;
  }
}
