import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AIExecutionService } from './ai-execution.service';
import { AIExecutionRequest, AIExecutionResult } from './types';

/**
 * AIExecutionController
 *
 * Exposes POST /api/execute endpoint for ai-service
 * Used by api-gateway AIServiceHttpClient
 */
@Controller()
export class AIExecutionController {
  constructor(private readonly aiExecutionService: AIExecutionService) {}

  @Post('execute')
  @HttpCode(HttpStatus.OK)
  async execute(@Body() request: AIExecutionRequest): Promise<AIExecutionResult> {
    return await this.aiExecutionService.execute(request);
  }
}
