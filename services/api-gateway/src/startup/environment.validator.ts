/**
 * Environment Validator
 *
 * Phase 27B: Production Hardening
 *
 * Enforces environment detection and isolation rules from Phase 27A.
 *
 * LOCKED GUARANTEES:
 * - NODE_ENV must be set (no defaults)
 * - NODE_ENV must be valid: development, staging, production ONLY
 * - Invalid environment → immediate crash (exit 1)
 * - No cross-environment contamination
 */

export type ValidEnvironment = 'development' | 'staging' | 'production';

export class EnvironmentValidator {
  /**
   * Validate and return current environment
   *
   * @throws Error if NODE_ENV not set or invalid
   * @returns Validated environment
   */
  static validateEnvironment(): ValidEnvironment {
    const nodeEnv = process.env.NODE_ENV;

    // Phase 27A Rule: NODE_ENV must be set
    if (!nodeEnv) {
      throw new Error(
        '[STARTUP FAILURE] Environment detection failed\n' +
          'Reason: NODE_ENV not set\n' +
          'Expected: One of: development, staging, production\n' +
          'Actual: undefined\n' +
          'Remediation: Set NODE_ENV environment variable\n' +
          '  Example: export NODE_ENV=production\n' +
          'Documentation: https://docs.aisandbox.dev/config/environment\n' +
          'Exit Code: 1',
      );
    }

    // Phase 43B-4: Allow NODE_ENV=test ONLY during Jest execution
    if (nodeEnv === 'test' && process.env.JEST_WORKER_ID) {
      // Jest execution environment - treat as development for startup validation
      return 'development' as ValidEnvironment;
    }

    // Phase 27A Rule: NODE_ENV must be valid
    const validEnvironments: ValidEnvironment[] = [
      'development',
      'staging',
      'production',
    ];

    if (!validEnvironments.includes(nodeEnv as ValidEnvironment)) {
      throw new Error(
        '[STARTUP FAILURE] Environment detection failed\n' +
          'Reason: NODE_ENV is invalid\n' +
          `Expected: One of: ${validEnvironments.join(', ')}\n` +
          `Actual: "${nodeEnv}"\n` +
          'Remediation: Set NODE_ENV to valid environment\n' +
          '  Example: export NODE_ENV=production\n' +
          'Documentation: https://docs.aisandbox.dev/config/environment\n' +
          'Exit Code: 1',
      );
    }

    return nodeEnv as ValidEnvironment;
  }

  /**
   * Check if current environment is production
   */
  static isProduction(): boolean {
    try {
      return this.validateEnvironment() === 'production';
    } catch {
      return false;
    }
  }

  /**
   * Check if current environment is staging
   */
  static isStaging(): boolean {
    try {
      return this.validateEnvironment() === 'staging';
    } catch {
      return false;
    }
  }

  /**
   * Check if current environment is development
   */
  static isDevelopment(): boolean {
    try {
      return this.validateEnvironment() === 'development';
    } catch {
      return false;
    }
  }

  /**
   * Get environment-specific strictness level
   *
   * @returns Validation strictness for current environment
   */
  static getStrictnessLevel(): 'permissive' | 'strict' | 'strictest' {
    const env = this.validateEnvironment();

    switch (env) {
      case 'development':
        return 'permissive';
      case 'staging':
        return 'strict';
      case 'production':
        return 'strictest';
    }
  }
}
