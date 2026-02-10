/**
 * Configuration Validator
 *
 * Phase 27B: Production Hardening
 * Phase 28B-1: Launch state validation
 * Phase 28B-2: Abort mode and rollback validation
 *
 * Validates all required environment variables at startup.
 * Enforces Phase 27A configuration validation rules.
 *
 * LOCKED GUARANTEES:
 * - All required variables must be present (no defaults for critical config)
 * - Invalid values → immediate crash (exit 1)
 * - Boolean variables: "true", "false", or unset ONLY
 * - Numeric variables: valid numbers within bounds
 * - URL variables: valid URL format with correct protocol
 */

import { EnvironmentValidator, ValidEnvironment } from './environment.validator';
import { LaunchConfig } from '../launch/launch.config';
import { AbortConfig } from '../abort/abort.config';
import { RollbackValidator } from '../abort/rollback.validator';
import { LaunchState } from '../launch/launch-state.enum';

interface RequiredVariable {
  name: string;
  type: 'string' | 'number' | 'url' | 'boolean';
  required: boolean;
  environments: ValidEnvironment[];
  example?: string;
}

export class ConfigurationValidator {
  /**
   * Get list of required variables for current environment
   */
  private static getRequiredVariables(): RequiredVariable[] {
    const env = EnvironmentValidator.validateEnvironment();

    const variables: RequiredVariable[] = [
      // Core variables
      {
        name: 'NODE_ENV',
        type: 'string',
        required: true,
        environments: ['development', 'staging', 'production'],
        example: 'production',
      },
      {
        name: 'PORT',
        type: 'number',
        required: true,
        environments: ['development', 'staging', 'production'],
        example: '3000',
      },
      {
        name: 'DATABASE_URL',
        type: 'url',
        required: true,
        environments: ['development', 'staging', 'production'],
        example: 'postgresql://user:pass@host:5432/db',
      },

      // Provider API keys (required in staging and production)
      {
        name: 'ANTHROPIC_API_KEY',
        type: 'string',
        required: env === 'staging' || env === 'production',
        environments: ['staging', 'production'],
        example: 'sk-ant-...',
      },
      {
        name: 'OPENAI_API_KEY',
        type: 'string',
        required: env === 'staging' || env === 'production',
        environments: ['staging', 'production'],
        example: 'sk-...',
      },
    ];

    return variables.filter((v) => v.environments.includes(env));
  }

  /**
   * Validate all required environment variables
   *
   * @throws Error if any required variable missing or invalid
   */
  static validateRequiredVariables(): void {
    const variables = this.getRequiredVariables();

    for (const variable of variables) {
      const value = process.env[variable.name];

      // Check if required variable is missing
      if (variable.required && !value) {
        throw new Error(
          '[STARTUP FAILURE] Required environment variable missing\n' +
            `Reason: ${variable.name} not set\n` +
            `Expected: ${variable.type}\n` +
            'Actual: undefined\n' +
            'Remediation: Set environment variable\n' +
            (variable.example
              ? `  Example: export ${variable.name}="${variable.example}"\n`
              : '') +
            'Documentation: https://docs.aisandbox.dev/config/environment-variables\n' +
            'Exit Code: 1',
        );
      }

      // Validate type if present
      if (value) {
        this.validateVariableType(variable.name, value, variable.type);
      }
    }
  }

  /**
   * Validate variable type
   */
  private static validateVariableType(
    name: string,
    value: string,
    type: 'string' | 'number' | 'url' | 'boolean',
  ): void {
    // Phase 32A Trap: Detect whitespace-only values
    if (value !== value.trim()) {
      console.warn(
        `⚠️  ${name} contains leading/trailing whitespace.\n` +
          `   Value: "${value}"\n` +
          '   This may cause unexpected behavior.',
      );
    }

    switch (type) {
      case 'number':
        this.validateNumber(name, value);
        break;
      case 'url':
        this.validateURL(name, value);
        break;
      case 'boolean':
        this.validateBoolean(name, value);
        break;
      case 'string':
        // Phase 32A Enhancement: Strict empty/whitespace validation
        if (value.trim() === '') {
          throw new Error(
            `[STARTUP FAILURE] Configuration validation failed\n` +
              `Reason: ${name} is empty or whitespace-only\n` +
              `Expected: Non-empty string\n` +
              `Actual: "${value}"\n` +
              'Remediation: Set valid value\n' +
              'Exit Code: 1',
          );
        }
        break;
    }
  }

  /**
   * Validate number variable
   */
  private static validateNumber(name: string, value: string): void {
    const parsed = parseInt(value, 10);

    if (isNaN(parsed)) {
      throw new Error(
        '[STARTUP FAILURE] Configuration validation failed\n' +
          `Reason: ${name} is not a valid number\n` +
          'Expected: Valid integer\n' +
          `Actual: "${value}"\n` +
          'Remediation: Set numeric value\n' +
          `  Example: export ${name}=3000\n` +
          'Exit Code: 1',
      );
    }

    // PORT-specific validation
    if (name === 'PORT') {
      if (parsed < 1 || parsed > 65535) {
        throw new Error(
          '[STARTUP FAILURE] Configuration validation failed\n' +
            `Reason: ${name} out of valid range\n` +
            'Expected: 1-65535\n' +
            `Actual: ${parsed}\n` +
            'Remediation: Use valid port number\n' +
            '  Example: export PORT=3000\n' +
            'Exit Code: 1',
        );
      }
    }
  }

  /**
   * Validate URL variable
   */
  private static validateURL(name: string, value: string): void {
    try {
      const url = new URL(value);

      // Validate protocol
      if (name === 'DATABASE_URL') {
        if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
          throw new Error('Invalid protocol for DATABASE_URL');
        }
      }
    } catch (error) {
      throw new Error(
        '[STARTUP FAILURE] Configuration validation failed\n' +
          `Reason: ${name} is not a valid URL\n` +
          'Expected: Valid URL with protocol\n' +
          `Actual: "${value}"\n` +
          'Remediation: Set valid URL\n' +
          (name === 'DATABASE_URL'
            ? '  Example: export DATABASE_URL="postgresql://user:pass@host:5432/db"\n'
            : '') +
          'Exit Code: 1',
      );
    }
  }

  /**
   * Validate boolean variable
   *
   * Phase 27A Rule: Must be "true", "false", or unset ONLY
   */
  private static validateBoolean(name: string, value: string): void {
    const validValues = ['true', 'false'];

    if (!validValues.includes(value)) {
      throw new Error(
        '[STARTUP FAILURE] Configuration validation failed\n' +
          `Reason: ${name} is not boolean-compatible\n` +
          'Expected: "true", "false", or unset\n' +
          `Actual: "${value}"\n` +
          'Remediation: Use valid boolean value\n' +
          `  Example: export ${name}=true\n` +
          'Invalid values: "yes", "1", "enabled", etc.\n' +
          'Exit Code: 1',
      );
    }
  }

  /**
   * Validate kill switch environment variables
   *
   * Phase 27A Rule: Kill switches must be boolean-compatible
   */
  static validateKillSwitches(): void {
    const killSwitches = [
      'GLOBAL_EXECUTION_ENABLED',
      'PROVIDER_OPENAI_ENABLED',
      'PROVIDER_ANTHROPIC_ENABLED',
      'PROVIDER_GROQ_ENABLED',
      'PROVIDER_XAI_ENABLED',
      'PROVIDER_DEEPSEEK_ENABLED',
      'BILLING_SNAPSHOT_ENABLED',
      'INVOICE_GENERATION_ENABLED',
      'PAYMENT_EXECUTION_ENABLED',
    ];

    for (const switchName of killSwitches) {
      const value = process.env[switchName];

      // Kill switches are optional (default to enabled)
      if (value !== undefined) {
        this.validateBoolean(switchName, value);
      }
    }
  }

  /**
   * Validate safety limit environment variables
   *
   * Phase 27A Rule: Safety limits must be valid numbers within bounds
   */
  static validateSafetyLimits(): void {
    const limits = [
      {
        name: 'MAX_TOKENS_PER_EXECUTION',
        min: 1,
        max: 1000000,
        default: 100000,
      },
      {
        name: 'MAX_EXECUTIONS_PER_MINUTE_GLOBAL',
        min: 1,
        max: 1000000,
        default: 10000,
      },
      {
        name: 'MAX_DAILY_SPEND_SOFT_USD',
        min: 1,
        max: 1000000,
        default: 10000,
      },
      {
        name: 'MAX_DAILY_SPEND_HARD_USD',
        min: 1,
        max: 1000000,
        default: 20000,
      },
      {
        name: 'MAX_REQUESTS_PER_MINUTE_OPENAI',
        min: 1,
        max: 100000,
        default: 5000,
      },
      {
        name: 'MAX_REQUESTS_PER_MINUTE_ANTHROPIC',
        min: 1,
        max: 100000,
        default: 3000,
      },
      {
        name: 'MAX_REQUESTS_PER_MINUTE_GROQ',
        min: 1,
        max: 100000,
        default: 10000,
      },
    ];

    for (const limit of limits) {
      const value = process.env[limit.name];

      // Safety limits are optional (have defaults)
      if (value !== undefined) {
        const parsed = parseFloat(value);

        if (isNaN(parsed)) {
          throw new Error(
            '[STARTUP FAILURE] Safety limit validation failed\n' +
              `Reason: ${limit.name} is not a valid number\n` +
              'Expected: Valid number\n' +
              `Actual: "${value}"\n` +
              'Remediation: Set numeric value\n' +
              `  Example: export ${limit.name}=${limit.default}\n` +
              'Exit Code: 1',
          );
        }

        if (parsed <= 0) {
          throw new Error(
            '[STARTUP FAILURE] Safety limit validation failed\n' +
              `Reason: ${limit.name} must be greater than zero\n` +
              'Expected: > 0\n' +
              `Actual: ${parsed}\n` +
              'Remediation: Use positive value\n' +
              'Exit Code: 1',
          );
        }

        if (parsed < limit.min || parsed > limit.max) {
          throw new Error(
            '[STARTUP FAILURE] Safety limit validation failed\n' +
              `Reason: ${limit.name} out of bounds\n` +
              `Expected: ${limit.min}-${limit.max}\n` +
              `Actual: ${parsed}\n` +
              'Remediation: Use value within bounds\n' +
              `  Example: export ${limit.name}=${limit.default}\n` +
              'Exit Code: 1',
          );
        }
      }
    }

    // Phase 27A Rule: Soft cap < Hard cap
    const softCap = parseFloat(
      process.env.MAX_DAILY_SPEND_SOFT_USD || '10000',
    );
    const hardCap = parseFloat(
      process.env.MAX_DAILY_SPEND_HARD_USD || '20000',
    );

    if (softCap >= hardCap) {
      throw new Error(
        '[STARTUP FAILURE] Safety limit validation failed\n' +
          'Reason: MAX_DAILY_SPEND_SOFT_USD ≥ MAX_DAILY_SPEND_HARD_USD\n' +
          'Expected: Soft cap < Hard cap\n' +
          `Actual: Soft=${softCap}, Hard=${hardCap}\n` +
          'Remediation: Adjust environment variables\n' +
          '  Example: MAX_DAILY_SPEND_SOFT_USD=10000 MAX_DAILY_SPEND_HARD_USD=20000\n' +
          'Documentation: https://docs.aisandbox.dev/config/safety-limits\n' +
          'Exit Code: 1',
      );
    }
  }

  /**
   * Validate launch state configuration
   *
   * Phase 28B-1: Launch state must be explicitly set and valid
   */
  static validateLaunchState(): void {
    try {
      LaunchConfig.initialize();
    } catch (error) {
      // Re-throw with startup failure format
      throw error;
    }
  }

  /**
   * Validate abort mode configuration
   *
   * Phase 28B-2: Abort mode must be valid if set
   */
  static validateAbortMode(): void {
    try {
      AbortConfig.initialize();
    } catch (error) {
      // Re-throw with startup failure format
      throw error;
    }
  }

  /**
   * Validate rollback safety
   *
   * Phase 28B-2: If PREVIOUS_LAUNCH_STATE is set, validate rollback is monotonic downward
   */
  static validateRollbackSafety(): void {
    const previousStateEnv = process.env.PREVIOUS_LAUNCH_STATE;

    // No previous state: no rollback validation needed
    if (!previousStateEnv || previousStateEnv.trim() === '') {
      return;
    }

    // Validate previous state is valid
    const previousStateUpper = previousStateEnv.toUpperCase();
    const validStates = Object.values(LaunchState);

    if (!validStates.includes(previousStateUpper as LaunchState)) {
      throw new Error(
        `STARTUP FAILURE: Invalid PREVIOUS_LAUNCH_STATE="${previousStateEnv}"\n` +
          `Valid values: ${validStates.join(', ')}\n` +
          'Exit Code: 1',
      );
    }

    // Get current launch state
    const currentState = LaunchConfig.getCurrentState();
    const previousState = previousStateUpper as LaunchState;

    // Validate rollback is monotonic downward
    RollbackValidator.validateRollback(previousState, currentState);
  }

  /**
   * Run all configuration validations
   *
   * @throws Error if any validation fails
   */
  static validateAll(): void {
    this.validateRequiredVariables();
    this.validateKillSwitches();
    this.validateSafetyLimits();
    this.validateLaunchState(); // Phase 28B-1
    this.validateAbortMode(); // Phase 28B-2
    this.validateRollbackSafety(); // Phase 28B-2
  }
}
