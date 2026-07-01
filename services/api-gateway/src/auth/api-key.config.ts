/**
 * ApiKeyConfig
 *
 * Phase 20A: Static API key configuration
 * Phase 20B: Added scope-based authorization
 *
 * Provides in-memory API key validation without persistence.
 * Maps API keys to user identities and permission scopes.
 *
 * IMPORTANT: This is a minimal implementation for Phase 20A/20B.
 * No database, no external auth service, no persistence.
 */

export interface ApiKeyIdentity {
  userId: string;
  apiKeyId: string;
  scopes: string[]; // Phase 20B: Authorization scopes
  isInternal?: boolean; // Phase 28B-1: Internal/test key flag (for INTERNAL launch state)
  isEarlyAccess?: boolean; // Phase 28B-1: Early access key flag (for EARLY_ACCESS launch state)
  harnessEntitled?: boolean; // AGENT-HARNESS-05C7: Explicit harness entitlement
}

export class ApiKeyConfig {
  /**
   * Static API key registry
   * In production, this would be replaced with database lookup
   */
  private static readonly API_KEYS: Map<string, ApiKeyIdentity> = new Map([
    // Test API keys for development and testing
    // Phase 20B: All keys have 'ai:execute' scope by default
    // Phase 28B-1: Added launch state flags (isInternal, isEarlyAccess)
    [
      'test-harness-api-key',
      {
        userId: 'user-harness',
        apiKeyId: 'key-harness',
        scopes: ['ai:execute', 'ai:harness'],
        isInternal: true,
        harnessEntitled: true,
      },
    ],
    [
      'test-api-key-user-1',
      {
        userId: 'user-1',
        apiKeyId: 'key-1',
        scopes: ['ai:execute'],
        isInternal: true, // Internal test key
      },
    ],
    [
      'test-api-key-user-2',
      {
        userId: 'user-2',
        apiKeyId: 'key-2',
        scopes: ['ai:execute'],
        isEarlyAccess: true, // Early access key
      },
    ],
    [
      'valid-api-key',
      {
        userId: 'test-user',
        apiKeyId: 'key-test',
        scopes: ['ai:execute'],
        // No flags: public key
      },
    ],
  ]);

  /**
   * Validate API key and resolve identity
   *
   * @param apiKey - API key to validate
   * @returns ApiKeyIdentity if valid, null if invalid
   */
  static validateApiKey(apiKey: string): ApiKeyIdentity | null {
    return this.API_KEYS.get(apiKey) || null;
  }

  /**
   * Check if API key exists (for testing)
   *
   * @param apiKey - API key to check
   * @returns true if key exists, false otherwise
   */
  static hasApiKey(apiKey: string): boolean {
    return this.API_KEYS.has(apiKey);
  }
}
