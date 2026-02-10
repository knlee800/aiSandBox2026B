/**
 * Provider Configuration Validator
 *
 * Phase 32A: Deployment Hardening
 *
 * Validates AI provider configuration at startup to prevent misconfiguration.
 *
 * LOCKED GUARANTEES:
 * - AI_PROVIDER must be set and valid (no defaulting in production/staging)
 * - Required provider API key must exist for selected provider
 * - Stub provider allowed only in development
 * - Invalid provider configuration → immediate crash (exit 1)
 *
 * FAIL-FAST TRAPS:
 * - Missing AI_PROVIDER in production/staging
 * - Invalid provider name
 * - Missing API key for selected provider
 * - Stub provider in production/staging
 * - Empty/whitespace provider values
 */

import { EnvironmentValidator } from './environment.validator';

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

    // Phase 32A Trap: Stub provider in production/staging
    if (provider === 'stub' && (env === 'production' || env === 'staging')) {
      throw new Error(
        '[STARTUP FAILURE] Provider configuration invalid\n' +
          'Reason: Stub provider not allowed in production/staging\n' +
          `Environment: ${env}\n` +
          `Provider: ${provider}\n` +
          'Expected: Real AI provider (openai, anthropic, groq, xai, deepseek)\n' +
          'Actual: stub\n' +
          'Remediation: Configure real AI provider\n' +
          '  Example: export AI_PROVIDER=anthropic\n' +
          'Security: Stub provider is for development/testing only\n' +
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
