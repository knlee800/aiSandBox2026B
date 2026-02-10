/**
 * LaunchState Enum
 *
 * Phase 28B-1: Launch Readiness Implementation
 *
 * Defines the four valid launch states for the platform.
 * Launch state is read from configuration at startup and enforced
 * throughout the application lifecycle.
 *
 * State transitions are explicit (via configuration change + restart).
 * No runtime mutation allowed.
 */

export enum LaunchState {
  /**
   * CLOSED: No external execution allowed
   * - All execution requests blocked with 403
   * - System operational but traffic-disabled
   * - Default state for new deployments (closed-by-default)
   */
  CLOSED = 'CLOSED',

  /**
   * INTERNAL: Execution allowed only for internal API keys
   * - Internal/test API keys allowed (isInternal=true)
   * - External API keys blocked with 403
   * - Phase 1 of launch (internal validation)
   */
  INTERNAL = 'INTERNAL',

  /**
   * EARLY_ACCESS: Execution allowed for whitelisted keys
   * - Internal API keys allowed (isInternal=true)
   * - Early access API keys allowed (isEarlyAccess=true)
   * - General public keys blocked with 403
   * - Phase 2 of launch (limited exposure)
   */
  EARLY_ACCESS = 'EARLY_ACCESS',

  /**
   * PUBLIC: Execution allowed for all authorized keys
   * - All authenticated and authorized API keys allowed
   * - No additional launch restrictions
   * - Phase 3 of launch (full availability)
   */
  PUBLIC = 'PUBLIC',
}
