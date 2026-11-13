import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AIExecutionService, KeyedProviderId } from './ai-execution.service';
import { AIExecutionRequest, AIExecutionResult } from './types';

/**
 * AIExecutionController
 *
 * Exposes POST /api/execute endpoint for ai-service
 * Used by api-gateway AIServiceHttpClient
 *
 * PROVIDER-KEY-01: GET /api/internal/provider-availability answers which
 * providers have a key, booleans only. Like every route here it needs
 * X-Internal-Service-Key (global InternalServiceAuthGuard, no exemption).
 */
@Controller()
export class AIExecutionController {
  constructor(private readonly aiExecutionService: AIExecutionService) {}

  @Post('execute')
  @HttpCode(HttpStatus.OK)
  async execute(@Body() request: AIExecutionRequest): Promise<AIExecutionResult> {
    return await this.aiExecutionService.execute(request);
  }

  @Get('internal/provider-availability')
  providerAvailability(): { providers: Record<KeyedProviderId, boolean> } {
    return { providers: this.aiExecutionService.getProviderKeyAvailability() };
  }
}
