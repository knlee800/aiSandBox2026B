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

@Controller('keys')
@UseGuards(JwtAuthGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Get()
  async listApiKeys(@Request() req): Promise<ApiKeyListItemDto[]> {
    console.log('JWT payload (GET /keys):', req.user);   // ← DEBUG

    const userId = req.user?.userId || req.user?.sub;    // ← TEMP SAFE FALLBACK
    console.log('Resolved userId:', userId);              // ← DEBUG

    return this.apiKeyService.listApiKeys(userId);
  }

  @Post()
  async createApiKey(
    @Request() req,
    @Body() createDto: CreateApiKeyDto,
  ): Promise<CreateApiKeyResponseDto> {
    console.log('JWT payload (POST /keys):', req.user);   // ← DEBUG

    const userId = req.user?.userId || req.user?.sub;     // ← TEMP SAFE FALLBACK
    console.log('Resolved userId:', userId);              // ← DEBUG

    return this.apiKeyService.createApiKey(userId, createDto.scopes);
  }

  @Delete(':id')
  async revokeApiKey(
    @Request() req,
    @Param('id') id: string,
  ): Promise<RevokeApiKeyResponseDto> {
    console.log('JWT payload (DELETE /keys):', req.user); // ← DEBUG

    const userId = req.user?.userId || req.user?.sub;     // ← TEMP SAFE FALLBACK
    console.log('Resolved userId:', userId);              // ← DEBUG

    await this.apiKeyService.revokeApiKey(id, userId);

    return {
      message: 'API key revoked successfully',
      keyId: id,
    };
  }
}

