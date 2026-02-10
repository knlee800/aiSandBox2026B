import { LaunchState } from './launch-state.enum';

/**
 * LaunchConfig
 *
 * Phase 28B-1: Launch Readiness Implementation
 *
 * Manages launch state configuration for the platform.
 * Launch state is read from environment variable at startup.
 *
 * Principles:
 * - Fail-fast on invalid or missing launch state
 * - No defaulting (explicit configuration required)
 * - No runtime mutation (restart required to change state)
 * - Deterministic validation
 *
 * Environment Variable:
 * - LAUNCH_STATE: One of ['CLOSED', 'INTERNAL', 'EARLY_ACCESS', 'PUBLIC']
 *
 * Invalid or missing launch state causes startup failure (exit 1).
 */

export class LaunchConfig {
  private static currentState: LaunchState | null = null;

  /**
   * Initialize launch configuration from environment
   *
   * MUST be called during application startup (before accepting traffic).
   * Throws error on invalid or missing launch state.
   *
   * @throws Error if LAUNCH_STATE invalid or missing
   */
  static initialize(): void {
    const envValue = process.env.LAUNCH_STATE;

    // Missing launch state
    if (!envValue) {
      throw new Error(
        'STARTUP FAILURE: LAUNCH_STATE environment variable not set. ' +
          'Valid values: CLOSED, INTERNAL, EARLY_ACCESS, PUBLIC',
      );
    }

    // Validate launch state
    const upperValue = envValue.toUpperCase();
    const validStates = Object.values(LaunchState);

    if (!validStates.includes(upperValue as LaunchState)) {
      throw new Error(
        `STARTUP FAILURE: Invalid LAUNCH_STATE="${envValue}". ` +
          `Valid values: ${validStates.join(', ')}`,
      );
    }

    // Set current state
    this.currentState = upperValue as LaunchState;
  }

  /**
   * Get current launch state
   *
   * @returns Current launch state
   * @throws Error if not initialized
   */
  static getCurrentState(): LaunchState {
    if (this.currentState === null) {
      throw new Error(
        'LaunchConfig not initialized. Call initialize() during startup.',
      );
    }

    return this.currentState;
  }

  /**
   * Check if launch state is initialized
   *
   * @returns true if initialized, false otherwise
   */
  static isInitialized(): boolean {
    return this.currentState !== null;
  }

  /**
   * Reset state (for testing only)
   *
   * DO NOT use in production code.
   */
  static reset(): void {
    this.currentState = null;
  }
}
