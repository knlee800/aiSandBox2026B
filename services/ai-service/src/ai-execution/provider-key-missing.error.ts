/**
 * PROVIDER-KEY-01 (contract C1): stored when a run names a provider for which
 * the AI service has no key. The sentence is fixed and holds no credential
 * word, env variable name or key text.
 */
export const PROVIDER_KEY_MISSING_CODE = 'provider_key_missing';
export const PROVIDER_KEY_MISSING_MESSAGE = 'AI provider is not configured';

/**
 * Raised by AIExecutionService.getAdapter before any adapter is built or any
 * provider is called. The worker's sanitiser recognises it by type.
 */
export class ProviderKeyMissingError extends Error {
  readonly code = PROVIDER_KEY_MISSING_CODE;

  constructor() {
    super(PROVIDER_KEY_MISSING_MESSAGE);
    this.name = 'ProviderKeyMissingError';
    Object.setPrototypeOf(this, ProviderKeyMissingError.prototype);
  }
}
