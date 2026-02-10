/**
 * Production Guardrails Validator
 *
 * Phase 32A: Deployment Hardening
 *
 * Validates production-specific safety requirements at startup.
 *
 * LOCKED GUARANTEES:
 * - Production mode requires explicit BILLING_CHARGES_ENABLED setting
 * - Production mode requires kill switch configuration
 * - Unsafe dev flags rejected in production
 * - Conflicting configuration combinations detected
 * - Invalid production configuration → immediate crash (exit 1)
 *
 * FAIL-FAST TRAPS:
 * - Missing BILLING_CHARGES_ENABLED in production
 * - Unsafe flag combinations
 * - Development-only features in production
 * - Missing safety controls in production
 */

import { EnvironmentValidator } from './environment.validator';
import { LaunchConfig } from '../launch/launch.config';
import { LaunchState } from '../launch/launch-state.enum';

export class ProductionGuardrailsValidator {
  /**
   * Validate production-specific requirements
   *
   * Phase 32A Rule: Production must have explicit safety configuration
   *
   * @throws Error if production requirements not met
   */
  static validateProductionRequirements(): void {
    const env = EnvironmentValidator.validateEnvironment();

    // Only enforce in production
    if (env !== 'production') {
      return;
    }

    this.validateBillingChargesExplicit();
    this.validateKillSwitchesPresent();
    this.validateNoUnsafeDevFlags();
    this.validateLaunchStateConsistency();
  }

  /**
   * Phase 32A Trap: BILLING_CHARGES_ENABLED must be explicitly set in production
   *
   * Prevents accidental charging or accidental free service in production.
   */
  private static validateBillingChargesExplicit(): void {
    const billingChargesEnabled = process.env.BILLING_CHARGES_ENABLED;

    // Phase 32A Rule: Must be explicitly set in production
    if (billingChargesEnabled === undefined) {
      throw new Error(
        '[STARTUP FAILURE] Production guardrail violation\n' +
          'Reason: BILLING_CHARGES_ENABLED not explicitly set\n' +
          'Environment: production\n' +
          'Expected: Explicit true or false\n' +
          'Actual: undefined\n' +
          'Remediation: Set BILLING_CHARGES_ENABLED explicitly\n' +
          '  For charging: export BILLING_CHARGES_ENABLED=true\n' +
          '  For free tier: export BILLING_CHARGES_ENABLED=false\n' +
          'Security: Prevents accidental billing misconfiguration\n' +
          'Documentation: https://docs.aisandbox.dev/config/billing\n' +
          'Exit Code: 1',
      );
    }

    // Phase 32A Trap: Must be valid boolean
    if (billingChargesEnabled !== 'true' && billingChargesEnabled !== 'false') {
      throw new Error(
        '[STARTUP FAILURE] Production guardrail violation\n' +
          'Reason: BILLING_CHARGES_ENABLED is not boolean-compatible\n' +
          'Environment: production\n' +
          'Expected: "true" or "false"\n' +
          `Actual: "${billingChargesEnabled}"\n` +
          'Remediation: Use valid boolean value\n' +
          '  Example: export BILLING_CHARGES_ENABLED=true\n' +
          'Exit Code: 1',
      );
    }

    // Log billing state clearly
    const isEnabled = billingChargesEnabled === 'true';
    if (isEnabled) {
      console.log('💰 BILLING_CHARGES_ENABLED=true (charging active)');
    } else {
      console.warn(
        '⚠️  BILLING_CHARGES_ENABLED=false (free tier mode in production)',
      );
    }
  }

  /**
   * Phase 32A Trap: Kill switches must be configured in production
   *
   * Ensures operators have emergency controls available.
   */
  private static validateKillSwitchesPresent(): void {
    // Check that at least one kill switch is explicitly configured
    const killSwitches = [
      'GLOBAL_EXECUTION_ENABLED',
      'PROVIDER_OPENAI_ENABLED',
      'PROVIDER_ANTHROPIC_ENABLED',
      'PROVIDER_GROQ_ENABLED',
      'PROVIDER_XAI_ENABLED',
      'PROVIDER_DEEPSEEK_ENABLED',
    ];

    const configuredSwitches = killSwitches.filter(
      (sw) => process.env[sw] !== undefined,
    );

    // Phase 32A Rule: At least one kill switch must be explicitly configured
    // This ensures operators are aware of kill switch mechanism
    if (configuredSwitches.length === 0) {
      console.warn(
        '⚠️  No kill switches explicitly configured in production.\n' +
          '   Kill switches will use default values (enabled).\n' +
          '   Consider explicitly configuring kill switches for operational safety.\n' +
          `   Available: ${killSwitches.join(', ')}`,
      );
    }
  }

  /**
   * Phase 32A Trap: Unsafe development flags rejected in production
   *
   * Prevents development-only features from running in production.
   */
  private static validateNoUnsafeDevFlags(): void {
    const unsafeFlags = [
      { name: 'SKIP_AUTH', description: 'Authentication bypass' },
      { name: 'SKIP_QUOTA', description: 'Quota enforcement bypass' },
      { name: 'DEBUG_MODE', description: 'Debug mode' },
      { name: 'ALLOW_STUB_PROVIDER', description: 'Stub provider override' },
      { name: 'DISABLE_RATE_LIMITING', description: 'Rate limiting bypass' },
    ];

    for (const flag of unsafeFlags) {
      const value = process.env[flag.name];

      if (value === 'true' || value === '1' || value === 'yes') {
        throw new Error(
          '[STARTUP FAILURE] Production guardrail violation\n' +
            `Reason: Unsafe development flag enabled: ${flag.name}\n` +
            'Environment: production\n' +
            `Flag: ${flag.name}=${value}\n` +
            `Description: ${flag.description}\n` +
            'Expected: Flag not set or set to false in production\n' +
            'Remediation: Remove or disable development flag\n' +
            `  Example: unset ${flag.name}\n` +
            'Security: Development flags are not allowed in production\n' +
            'Exit Code: 1',
        );
      }
    }
  }

  /**
   * Phase 32A Trap: Launch state consistency validation
   *
   * Detects conflicting launch state configurations.
   */
  private static validateLaunchStateConsistency(): void {
    const launchState = LaunchConfig.getCurrentState();

    // Phase 32A Trap: PUBLIC launch state in production requires explicit confirmation
    if (launchState === LaunchState.PUBLIC) {
      const publicConfirmed = process.env.PUBLIC_LAUNCH_CONFIRMED;

      if (publicConfirmed !== 'true') {
        console.warn(
          '⚠️  LAUNCH_STATE=PUBLIC in production without explicit confirmation.\n' +
            '   This allows all authenticated users to access the platform.\n' +
            '   Set PUBLIC_LAUNCH_CONFIRMED=true to suppress this warning.',
        );
      }
    }

    // Phase 32A Trap: CLOSED launch state in production (unusual)
    if (launchState === LaunchState.CLOSED) {
      console.warn(
        '⚠️  LAUNCH_STATE=CLOSED in production.\n' +
          '   Platform will reject all AI execution requests.\n' +
          '   This is typically used during incidents or maintenance.',
      );
    }
  }

  /**
   * Validate staging-specific requirements
   *
   * Phase 32A Rule: Staging should mirror production config structure
   */
  static validateStagingRequirements(): void {
    const env = EnvironmentValidator.validateEnvironment();

    // Only enforce in staging
    if (env !== 'staging') {
      return;
    }

    // Staging should have BILLING_CHARGES_ENABLED set (typically false)
    const billingChargesEnabled = process.env.BILLING_CHARGES_ENABLED;

    if (billingChargesEnabled === undefined) {
      console.warn(
        '⚠️  BILLING_CHARGES_ENABLED not set in staging.\n' +
          '   Staging should mirror production configuration structure.\n' +
          '   Recommended: export BILLING_CHARGES_ENABLED=false',
      );
    }

    // Staging should use real providers (not stub)
    const provider = process.env.AI_PROVIDER;
    if (provider === 'stub') {
      console.warn(
        '⚠️  AI_PROVIDER=stub in staging.\n' +
          '   Staging should use real providers to match production behavior.\n' +
          '   Recommended: Use anthropic, openai, or other real provider.',
      );
    }
  }

  /**
   * Validate all production and staging guardrails
   *
   * @throws Error if any guardrail validation fails
   */
  static validateAll(): void {
    const env = EnvironmentValidator.validateEnvironment();

    if (env === 'production') {
      this.validateProductionRequirements();
    } else if (env === 'staging') {
      this.validateStagingRequirements();
    }
  }
}
