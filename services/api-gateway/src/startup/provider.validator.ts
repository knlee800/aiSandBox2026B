/**
 * Provider Configuration Validator
 *
 * Phase 32A: Deployment Hardening
 * PRIVATE-BETA-STAGING-EXECUTION-04D2: Private-beta health-only stub exception
 *
 * Validates AI provider configuration at startup to prevent misconfiguration.
 *
 * LOCKED GUARANTEES:
 * - AI_PROVIDER must be set and valid (no defaulting in production/staging)
 * - Required provider API key must exist for selected provider
 * - Stub provider allowed in development
 * - Stub provider allowed in production/staging ONLY when GLOBAL_EXECUTION_ENABLED
 *   is false (private-beta health-only / execution-disabled startup)
 * - Stub provider rejected in production/staging when AI execution is enabled
 * - Invalid provider configuration → immediate crash (exit 1)
 *
 * FAIL-FAST TRAPS:
 * - Missing AI_PROVIDER in production/staging
 * - Invalid provider name
 * - Missing API key for selected provider
 * - Stub provider in production/staging with AI execution enabled
 * - Empty/whitespace provider values
 */

import { EnvironmentValidator } from './environment.validator';
import { KillSwitchConfig } from '../safety/kill-switch.config';

export type ValidProvider =
  | 'stub'
  | 'openai'
  | 'anthropic'
  | 'groq'
  | 'xai'
  | 'deepseek';

interface ProviderConfig {
  name: ValidProvider;
  apiKeyEnvVar: string;
  apiKeyPrefix?: string;
  allowedEnvironments: ('development' | 'staging' | 'production')[];
}

export class ProviderValidator {
  /**
   * Provider configuration map
   */
  private static readonly PROVIDERS: Record<ValidProvider, ProviderConfig> = {
    stub: {
      name: 'stub',
      apiKeyEnvVar: 'NONE',
      allowedEnvironments: ['development'],
    },
    openai: {
      name: 'openai',
      apiKeyEnvVar: 'OPENAI_API_KEY',
      apiKeyPrefix: 'sk-',
      allowedEnvironments: ['development', 'staging', 'production'],
    },
    anthropic: {
      name: 'anthropic',
      apiKeyEnvVar: 'ANTHROPIC_API_KEY',
      apiKeyPrefix: 'sk-ant-',
      allowedEnvironments: ['development', 'staging', 'production'],
    },
    groq: {
      name: 'groq',
      apiKeyEnvVar: 'GROQ_API_KEY',
      apiKeyPrefix: 'gsk_',
      allowedEnvironments: ['development', 'staging', 'production'],
    },
    xai: {
      name: 'xai',
      apiKeyEnvVar: 'XAI_API_KEY',
      allowedEnvironments: ['development', 'staging', 'production'],
    },
    deepseek: {
      name: 'deepseek',
      apiKeyEnvVar: 'DEEPSEEK_API_KEY',
      allowedEnvironments: ['development', 'staging', 'production'],
    },
  };

  /**
   * Validate AI provider configuration at startup
   *
   * Phase 32A Rule: Provider must be explicitly configured in production/staging
   *
   * @throws Error if provider configuration invalid
   */
  static validateProviderConfiguration(): void {
    const env = EnvironmentValidator.validateEnvironment();
    const providerEnv = process.env.AI_PROVIDER;

    // Phase 32A Trap: Missing AI_PROVIDER in production/staging
    if (!providerEnv) {
      if (env === 'production' || env === 'staging') {
        throw new Error(
          '[STARTUP FAILURE] Provider configuration invalid\n' +
            'Reason: AI_PROVIDER not set\n' +
            `Environment: ${env}\n` +
            'Expected: Explicit provider selection required in production/staging\n' +
            'Actual: undefined\n' +
            'Remediation: Set AI_PROVIDER environment variable\n' +
            '  Valid values: openai, anthropic, groq, xai, deepseek\n' +
            '  Example: export AI_PROVIDER=anthropic\n' +
            'Documentation: https://docs.aisandbox.dev/config/ai-providers\n' +
            'Exit Code: 1',
        );
      }

      // Development: allow missing (will default to stub at runtime)
      // But warn about it
      console.warn(
        '⚠️  AI_PROVIDER not set in development. Will default to stub provider.',
      );
      return;
    }

    // Phase 32A Trap: Whitespace-only provider value
    const provider = providerEnv.trim().toLowerCase();
    if (provider === '') {
      if (env === 'production' || env === 'staging') {
        throw new Error(
          '[STARTUP FAILURE] Provider configuration invalid\n' +
            'Reason: AI_PROVIDER is whitespace-only\n' +
            `Environment: ${env}\n` +
            `Actual: "${providerEnv}"\n` +
            'Remediation: Set valid provider name\n' +
            '  Valid values: openai, anthropic, groq, xai, deepseek\n' +
            'Exit Code: 1',
        );
      }

      // Development: warn but allow
      console.warn(
        '⚠️  AI_PROVIDER is whitespace-only in development. Will default to stub provider.',
      );
      return;
    }

    // Phase 32A Trap: Invalid provider name
    const validProviders = Object.keys(this.PROVIDERS);
    if (!validProviders.includes(provider)) {
      throw new Error(
        '[STARTUP FAILURE] Provider configuration invalid\n' +
          'Reason: AI_PROVIDER is not a valid provider\n' +
          `Expected: One of: ${validProviders.join(', ')}\n` +
          `Actual: "${provider}"\n` +
          'Remediation: Set valid provider name\n' +
          '  Example: export AI_PROVIDER=anthropic\n' +
          'Documentation: https://docs.aisandbox.dev/config/ai-providers\n' +
          'Exit Code: 1',
      );
    }

    const providerConfig = this.PROVIDERS[provider as ValidProvider];

    // Phase 32A Trap + 04D2 exception:
    // Stub provider in production/staging is rejected unless AI execution is
    // proven disabled via GLOBAL_EXECUTION_ENABLED (private-beta health-only).
    if (provider === 'stub' && (env === 'production' || env === 'staging')) {
      if (this.isPrivateBetaHealthOnlyStubPermitted()) {
        console.warn(
          '[STARTUP POLICY] stub provider permitted for private-beta health-only startup because execution remains disabled.\n' +
            `Environment: ${env}\n` +
            'Provider: stub\n' +
            'Condition: GLOBAL_EXECUTION_ENABLED=false\n' +
            'Security: AI execution remains blocked by kill switch; stub does not enable provider calls, billing, or container execution.',
        );
        // Stub needs no API key; skip allowedEnvironments (dev-only) for this narrow exception.
        return;
      }

      throw new Error(
        '[STARTUP FAILURE] Provider configuration invalid\n' +
          'Reason: Stub provider not allowed in production/staging\n' +
          `Environment: ${env}\n` +
          `Provider: ${provider}\n` +
          'Expected: Real AI provider (openai, anthropic, groq, xai, deepseek)\n' +
          '  OR stub only when GLOBAL_EXECUTION_ENABLED=false (private-beta health-only)\n' +
          'Actual: stub with AI execution enabled\n' +
          'Remediation: Configure real AI provider, or disable AI execution for health-only startup\n' +
          '  Example: export AI_PROVIDER=anthropic\n' +
          '  Health-only: export GLOBAL_EXECUTION_ENABLED=false\n' +
          'Security: Stub provider is for development/testing or private-beta health-only when execution is disabled\n' +
          'Exit Code: 1',
      );
    }

    // Phase 32A Trap: Provider not allowed in current environment
    if (!providerConfig.allowedEnvironments.includes(env)) {
      throw new Error(
        '[STARTUP FAILURE] Provider configuration invalid\n' +
          `Reason: Provider "${provider}" not allowed in ${env}\n` +
          `Allowed environments: ${providerConfig.allowedEnvironments.join(', ')}\n` +
          'Remediation: Use different provider or environment\n' +
          'Exit Code: 1',
      );
    }

    // Phase 32A Trap: Missing API key for selected provider
    if (provider !== 'stub') {
      this.validateProviderApiKey(provider as ValidProvider, env);
    }
  }

  /**
   * PRIVATE-BETA-STAGING-EXECUTION-04D2
   *
   * Narrow exception: allow AI_PROVIDER=stub in production/staging only when
   * the existing GLOBAL_EXECUTION_ENABLED kill switch proves AI execution is
   * disabled. Uses the same KillSwitchConfig signal that ExecutionSafetyGuard
   * enforces at request time (503 when false).
   *
   * Does NOT enable AI/billing/container execution.
   * Does NOT disable StartupGuard or provider validation.
   */
  private static isPrivateBetaHealthOnlyStubPermitted(): boolean {
    return KillSwitchConfig.GLOBAL_EXECUTION_ENABLED === false;
  }

  /**
   * Validate provider API key exists and has correct format
   *
   * Phase 32A Rule: API key must exist for selected provider
   *
   * @param provider Provider name
   * @param env Current environment
   * @throws Error if API key missing or invalid
   */
  private static validateProviderApiKey(
    provider: ValidProvider,
    env: 'development' | 'staging' | 'production',
  ): void {
    const config = this.PROVIDERS[provider];
    const apiKey = process.env[config.apiKeyEnvVar];

    // Phase 32A Trap: Missing API key
    if (!apiKey || apiKey.trim() === '') {
      // In development, missing API key is a warning, not a failure
      if (env === 'development') {
        console.warn(
          `⚠️  ${config.apiKeyEnvVar} not set for provider "${provider}". ` +
            'AI execution will fail at runtime.',
        );
        return;
      }

      // In staging/production, missing API key is a startup failure
      throw new Error(
        '[STARTUP FAILURE] Provider configuration invalid\n' +
          `Reason: ${config.apiKeyEnvVar} not set\n` +
          `Provider: ${provider}\n` +
          `Environment: ${env}\n` +
          'Expected: Valid API key for selected provider\n' +
          'Actual: undefined or empty\n' +
          'Remediation: Set provider API key\n' +
          `  Example: export ${config.apiKeyEnvVar}="sk-..."\n` +
          'Documentation: https://docs.aisandbox.dev/config/ai-providers\n' +
          'Security: API keys are required in staging/production\n' +
          'Exit Code: 1',
      );
    }

    // Phase 32A Trap: API key format validation (if prefix defined)
    if (config.apiKeyPrefix && !apiKey.startsWith(config.apiKeyPrefix)) {
      // Format warning (not fatal, as providers may change formats)
      console.warn(
        `⚠️  ${config.apiKeyEnvVar} format unexpected.\n` +
          `   Expected prefix: ${config.apiKeyPrefix}\n` +
          `   Actual: ${apiKey.substring(0, 10)}...\n` +
          '   This may indicate a misconfigured API key.',
      );
    }

    // Phase 32A Trap: API key too short (likely invalid)
    if (apiKey.length < 20) {
      throw new Error(
        '[STARTUP FAILURE] Provider configuration invalid\n' +
          `Reason: ${config.apiKeyEnvVar} appears invalid (too short)\n` +
          `Provider: ${provider}\n` +
          `Length: ${apiKey.length} characters\n` +
          'Expected: Valid API key (typically 40+ characters)\n' +
          'Remediation: Check API key value\n' +
          `  Variable: ${config.apiKeyEnvVar}\n` +
          'Documentation: https://docs.aisandbox.dev/config/ai-providers\n' +
          'Exit Code: 1',
      );
    }
  }

  /**
   * Get validated provider name
   *
   * @returns Validated provider name
   * @throws Error if provider not configured
   */
  static getValidatedProvider(): ValidProvider {
    const providerEnv = process.env.AI_PROVIDER;

    if (!providerEnv || providerEnv.trim() === '') {
      // Development default
      return 'stub';
    }

    return providerEnv.trim().toLowerCase() as ValidProvider;
  }
}
