import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from '../entities/api-key.entity';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

/**
 * ApiKeyService
 *
 * Phase 36A: API Key Management Backend Foundation
 *
 * Responsibilities:
 * - Generate cryptographically secure API keys
 * - Hash and store API keys securely
 * - List user's API keys (masked)
 * - Revoke API keys
 * - Validate API keys against database
 *
 * Security Principles:
 * - Store only hashed keys (bcrypt)
 * - Return plaintext key ONLY ONCE at creation
 * - Never log plaintext keys
 * - Use crypto.randomBytes for key generation
 */
@Injectable()
export class ApiKeyService {
  private static readonly KEY_LENGTH = 32; // 32 bytes = 256 bits
  private static readonly BCRYPT_ROUNDS = 10;
  private static readonly KEY_PREFIX_LENGTH = 16; // Display first 16 chars

  constructor(
    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>,
  ) {}

  /**
   * Generate a new API key for a user
   *
   * Returns the plaintext key ONLY ONCE.
   * The key is hashed before storage.
   *
   * @param userId - User ID who owns the key
   * @param scopes - Permission scopes for the key
   * @returns Object containing plaintext key and key metadata
   */
  async createApiKey(
    userId: string,
    scopes: string[],
  ): Promise<{ apiKey: string; id: string; keyPrefix: string; createdAt: Date }> {
    // Generate cryptographically secure random key
    const randomBytes = crypto.randomBytes(ApiKeyService.KEY_LENGTH);
    const plaintextKey = `sk_${randomBytes.toString('hex')}`;

    // Extract prefix for display (e.g., "sk_a1b2c3d4e5f6...")
    const keyPrefix = plaintextKey.substring(0, ApiKeyService.KEY_PREFIX_LENGTH);

    // Hash the key for storage
    const hashedKey = await bcrypt.hash(plaintextKey, ApiKeyService.BCRYPT_ROUNDS);

    // Create and save the API key entity
    const apiKey = this.apiKeyRepository.create({
      hashedKey,
      keyPrefix,
      userId,
      scopes,
      revokedAt: null,
    });

    const savedKey = await this.apiKeyRepository.save(apiKey);

    // Return plaintext key ONLY ONCE
    return {
      apiKey: plaintextKey,
      id: savedKey.id,
      keyPrefix: savedKey.keyPrefix,
      createdAt: savedKey.createdAt,
    };
  }

  /**
   * List all API keys for a user (masked)
   *
   * Never returns the full key or hashed key.
   * Only returns metadata for display purposes.
   *
   * @param userId - User ID
   * @returns Array of masked API key metadata
   */
  async listApiKeys(userId: string): Promise<
    Array<{
      id: string;
      keyPrefix: string;
      scopes: string[];
      createdAt: Date;
      revokedAt: Date | null;
      isActive: boolean;
    }>
  > {
    const keys = await this.apiKeyRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return keys.map((key) => ({
      id: key.id,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      createdAt: key.createdAt,
      revokedAt: key.revokedAt,
      isActive: key.isActive(),
    }));
  }

  /**
   * Revoke an API key
   *
   * Sets revokedAt timestamp to current time.
   * Revoked keys cannot be used for authentication.
   *
   * @param keyId - API key ID
   * @param userId - User ID (for authorization check)
   * @throws NotFoundException if key doesn't exist
   * @throws ForbiddenException if user doesn't own the key
   */
  async revokeApiKey(keyId: string, userId: string): Promise<void> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id: keyId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    // Authorization check: user must own the key
    if (apiKey.userId !== userId) {
      throw new ForbiddenException('You do not have permission to revoke this API key');
    }

    // Set revocation timestamp
    apiKey.revokedAt = new Date();
    await this.apiKeyRepository.save(apiKey);
  }

  /**
   * Validate an API key and return identity
   *
   * Used by ApiKeyAuthGuard for authentication.
   *
   * @param plaintextKey - The plaintext API key from Authorization header
   * @returns ApiKeyIdentity if valid and active, null otherwise
   */
  async validateApiKey(plaintextKey: string): Promise<{
    userId: string;
    apiKeyId: string;
    scopes: string[];
  } | null> {
    // Find all non-revoked keys
    // We need to check all keys because we can't query by plaintext
    const allKeys = await this.apiKeyRepository.find({
      where: { revokedAt: null },
    });

    // Check each key's hash
    for (const key of allKeys) {
      const isMatch = await bcrypt.compare(plaintextKey, key.hashedKey);
      if (isMatch) {
        // Found matching key
        return {
          userId: key.userId,
          apiKeyId: key.id,
          scopes: key.scopes,
        };
      }
    }

    // No matching key found
    return null;
  }
}
