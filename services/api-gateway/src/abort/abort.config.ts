import { AbortMode } from './abort-mode.enum';

/**
 * AbortConfig
 *
 * Phase 28B-2: Abort & Rollback Controls
 *
 * Manages abort mode configuration for emergency shutdown.
 * Abort mode is read from environment variable at startup.
 *
 * Principles:
 * - Fail-fast on invalid or missing abort mode
 * - NONE is acceptable default (no abort)
 * - No runtime mutation (restart required to change mode)
 * - Deterministic validation
 *
 * Environment Variable:
 * - ABORT_MODE: One of ['NONE', 'EXECUTION_BLOCKED', 'FULL_SHUTDOWN']
 *
 * Missing ABORT_MODE defaults to NONE (safe default).
 * Invalid abort mode causes startup failure (exit 1).
 */

export class AbortConfig {
  private static currentMode: AbortMode | null = null;

  /**
   * Initialize abort configuration from environment
   *
   * MUST be called during application startup (before accepting traffic).
   * Throws error on invalid abort mode.
   * Defaults to NONE if not set (safe default).
   *
   * @throws Error if ABORT_MODE invalid
   */
  static initialize(): void {
    const envValue = process.env.ABORT_MODE;

    // Missing abort mode: default to NONE (safe default)
    if (!envValue || envValue.trim() === '') {
      this.currentMode = AbortMode.NONE;
      return;
    }

    // Validate abort mode
    const upperValue = envValue.toUpperCase();
    const validModes = Object.values(AbortMode);

    if (!validModes.includes(upperValue as AbortMode)) {
      throw new Error(
        `STARTUP FAILURE: Invalid ABORT_MODE="${envValue}". ` +
          `Valid values: ${validModes.join(', ')}`,
      );
    }

    // Set current mode
    this.currentMode = upperValue as AbortMode;
  }

  /**
   * Get current abort mode
   *
   * @returns Current abort mode
   * @throws Error if not initialized
   */
  static getCurrentMode(): AbortMode {
    if (this.currentMode === null) {
      throw new Error(
        'AbortConfig not initialized. Call initialize() during startup.',
      );
    }

    return this.currentMode;
  }

  /**
   * Check if abort mode is initialized
   *
   * @returns true if initialized, false otherwise
   */
  static isInitialized(): boolean {
    return this.currentMode !== null;
  }

  /**
   * Check if currently in abort mode (not NONE)
   *
   * @returns true if abort active, false otherwise
   */
  static isAbortActive(): boolean {
    const mode = this.getCurrentMode();
    return mode !== AbortMode.NONE;
  }

  /**
   * Reset state (for testing only)
   *
   * DO NOT use in production code.
   */
  static reset(): void {
    this.currentMode = null;
  }
}
