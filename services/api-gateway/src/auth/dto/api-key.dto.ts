import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';

/**
 * DTOs for API Key Management
 *
 * Phase 36A: API Key Management Backend Foundation
 */

/**
 * DTO for creating a new API key
 */
export class CreateApiKeyDto {
  /**
   * Permission scopes for the API key
   * Example: ["ai:execute", "sessions:read"]
   */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  scopes: string[];
}

/**
 * Response DTO for newly created API key
 * Contains the plaintext key (returned ONLY ONCE)
 */
export class CreateApiKeyResponseDto {
  /**
   * The plaintext API key
   * CRITICAL: This is the ONLY time the user will see this value
   */
  apiKey: string;

  /**
   * API key ID (UUID)
   */
  id: string;

  /**
   * Key prefix for display (e.g., "sk_a1b2c3d4e5f6...")
   */
  keyPrefix: string;

  /**
   * Creation timestamp
   */
  createdAt: Date;
}

/**
 * Response DTO for listing API keys
 * Never includes the full key or hashed key
 */
export class ApiKeyListItemDto {
  /**
   * API key ID (UUID)
   */
  id: string;

  /**
   * Key prefix for display (e.g., "sk_a1b2c3d4e5f6...")
   */
  keyPrefix: string;

  /**
   * Permission scopes
   */
  scopes: string[];

  /**
   * Creation timestamp
   */
  createdAt: Date;

  /**
   * Revocation timestamp (null if active)
   */
  revokedAt: Date | null;

  /**
   * Whether the key is active (not revoked)
   */
  isActive: boolean;
}

/**
 * Response DTO for API key revocation
 */
export class RevokeApiKeyResponseDto {
  /**
   * Success message
   */
  message: string;

  /**
   * Revoked key ID
   */
  keyId: string;
}
