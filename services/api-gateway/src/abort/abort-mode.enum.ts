/**
 * AbortMode Enum
 *
 * Phase 28B-2: Abort & Rollback Controls
 *
 * Defines the three valid abort modes for emergency shutdown.
 * Abort mode is read from configuration at startup and enforced
 * throughout the application lifecycle.
 *
 * State is immutable (no runtime mutation allowed).
 */

export enum AbortMode {
  /**
   * NONE: Normal operation (no abort active)
   * - All execution allowed (subject to launch state and other guards)
   * - Default allowed state
   * - No blocking at AbortGuard
   */
  NONE = 'NONE',

  /**
   * EXECUTION_BLOCKED: Block AI execution only
   * - All /api/ai/execute requests blocked with 503
   * - Other endpoints (health, admin) remain operational
   * - Used for partial shutdown (e.g., provider outage)
   */
  EXECUTION_BLOCKED = 'EXECUTION_BLOCKED',

  /**
   * FULL_SHUTDOWN: Block all execution-related endpoints
   * - All AI execution blocked with 503
   * - All execution-related endpoints blocked
   * - Health endpoints remain operational (for monitoring)
   * - Used for complete emergency shutdown
   */
  FULL_SHUTDOWN = 'FULL_SHUTDOWN',
}
