import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiKeyService } from './api-key.service';
import {
  CreateApiKeyDto,
  CreateApiKeyResponseDto,
  ApiKeyListItemDto,
  RevokeApiKeyResponseDto,
} from './dto/api-key.dto';

/**
 * ApiKeyController
 *
 * Phase 36A: API Key Management Backend Foundation
 *
 * Endpoints:
 * - GET /api/keys - List user's API keys (masked)
 * - POST /api/keys - Create new API key
 * - DELETE /api/keys/:id - Revoke API key
 *
 * All endpoints require JWT authentication.
 * Users can only manage their own API keys.
 */
@Controller('keys')
@UseGuards(JwtAuthGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  /**
   * List all API keys for the authenticated user
   *
   * Returns masked key information (prefix only, no full key).
   *
   * @param req - Express request with authenticated user
   * @returns Array of API key metadata
   */
  @Get()
  async listApiKeys(@Request() req): Promise<ApiKeyListItemDto[]> {
    const userId = req.user.userId;
    return this.apiKeyService.listApiKeys(userId);
  }

  /**
   * Create a new API key
   *
   * Returns the plaintext key ONLY ONCE.
   * The user must save this key immediately.
   *
   * @param req - Express request with authenticated user
   * @param createDto - API key creation parameters
   * @returns Plaintext API key and metadata
   */
  @Post()
  async createApiKey(
    @Request() req,
    @Body() createDto: CreateApiKeyDto,
  ): Promise<CreateApiKeyResponseDto> {
    const userId = req.user.userId;
    return this.apiKeyService.createApiKey(userId, createDto.scopes);
  }

  /**
   * Revoke an API key
   *
   * Sets the revocation timestamp.
   * Revoked keys cannot be used for authentication.
   *
   * @param req - Express request with authenticated user
   * @param id - API key ID to revoke
   * @returns Success message
   */
  @Delete(':id')
  async revokeApiKey(
    @Request() req,
    @Param('id') id: string,
  ): Promise<RevokeApiKeyResponseDto> {
    const userId = req.user.userId;
    await this.apiKeyService.revokeApiKey(id, userId);
    return {
      message: 'API key revoked successfully',
      keyId: id,
    };
  }
}
