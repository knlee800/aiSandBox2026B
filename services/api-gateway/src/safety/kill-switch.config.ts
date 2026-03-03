/**
 * Kill Switch Configuration
 *
 * Centralized kill switches for emergency operational control.
 * Fail-safe defaults: disabled blocks execution.
 *
 * Phase 26B: Production Readiness
 */

export class KillSwitchConfig {
  /**
   * Global execution kill switch
   * When false: All AI execution requests return 503
   *
   * Implemented as a static getter so jest.spyOn(..., 'get') works in tests.
   */
  static get GLOBAL_EXECUTION_ENABLED(): boolean {
    return process.env.GLOBAL_EXECUTION_ENABLED !== 'false'; // Default: true
  }

  /**
   * Provider-specific kill switches
   * When false: Requests for that provider return 503
   */
  static readonly PROVIDER_OPENAI_ENABLED =
    process.env.PROVIDER_OPENAI_ENABLED !== 'false'; // Default: true

  static readonly PROVIDER_ANTHROPIC_ENABLED =
    process.env.PROVIDER_ANTHROPIC_ENABLED !== 'false'; // Default: true

  static readonly PROVIDER_GROQ_ENABLED =
    process.env.PROVIDER_GROQ_ENABLED !== 'false'; // Default: true

  static readonly PROVIDER_XAI_ENABLED =
    process.env.PROVIDER_XAI_ENABLED !== 'false'; // Default: true

  static readonly PROVIDER_DEEPSEEK_ENABLED =
    process.env.PROVIDER_DEEPSEEK_ENABLED !== 'false'; // Default: true

  /**
   * Billing snapshot creation kill switch
   * When false: Snapshot creation returns early (no-op)
   */
  static readonly BILLING_SNAPSHOT_ENABLED =
    process.env.BILLING_SNAPSHOT_ENABLED !== 'false'; // Default: true

  /**
   * Invoice generation kill switch
   * When false: Invoice creation returns early (no-op)
   */
  static readonly INVOICE_GENERATION_ENABLED =
    process.env.INVOICE_GENERATION_ENABLED !== 'false'; // Default: true

  /**
   * Payment execution kill switch (future-proofing)
   * When false: Payment attempts return early (no-op)
   */
  static readonly PAYMENT_EXECUTION_ENABLED =
    process.env.PAYMENT_EXECUTION_ENABLED !== 'false'; // Default: true

  /**
   * Check if provider is enabled
   */
  static isProviderEnabled(provider: string): boolean {
    const normalizedProvider = provider.toLowerCase();

    switch (normalizedProvider) {
      case 'openai':
        return this.PROVIDER_OPENAI_ENABLED;
      case 'anthropic':
        return this.PROVIDER_ANTHROPIC_ENABLED;
      case 'groq':
        return this.PROVIDER_GROQ_ENABLED;
      case 'xai':
        return this.PROVIDER_XAI_ENABLED;
      case 'deepseek':
        return this.PROVIDER_DEEPSEEK_ENABLED;
      case 'stub':
        return true;
      default:
        // Unknown providers disabled by default (fail-safe)
        return false;
    }
  }

  /**
   * Get all kill switch states (for observability)
   */
  static getKillSwitchStates(): Record<string, boolean> {
    return {
      GLOBAL_EXECUTION_ENABLED: this.GLOBAL_EXECUTION_ENABLED,
      PROVIDER_OPENAI_ENABLED: this.PROVIDER_OPENAI_ENABLED,
      PROVIDER_ANTHROPIC_ENABLED: this.PROVIDER_ANTHROPIC_ENABLED,
      PROVIDER_GROQ_ENABLED: this.PROVIDER_GROQ_ENABLED,
      PROVIDER_XAI_ENABLED: this.PROVIDER_XAI_ENABLED,
      PROVIDER_DEEPSEEK_ENABLED: this.PROVIDER_DEEPSEEK_ENABLED,
      BILLING_SNAPSHOT_ENABLED: this.BILLING_SNAPSHOT_ENABLED,
      INVOICE_GENERATION_ENABLED: this.INVOICE_GENERATION_ENABLED,
      PAYMENT_EXECUTION_ENABLED: this.PAYMENT_EXECUTION_ENABLED,
    };
  }
}
