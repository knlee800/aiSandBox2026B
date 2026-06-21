import { Injectable, Logger } from '@nestjs/common';
import { AIAdapter } from './ai-adapter.interface';
import { AIExecutionRequest, AIExecutionResult } from '../types';
import type {
  AIAdapterToolUseRequestOptions,
  AIAdapterToolUseResult,
} from './adapter-tool-use.contracts';

/**
 * StubAIAdapter
 *
 * Stage C2-D: Stub Adapter Implementation
 *
 * Deterministic stub adapter for testing AI execution flow without real AI calls.
 *
 * Behavior:
 * - Returns fixed placeholder output
 * - No external API calls
 * - No SDK usage
 * - Zero tokens reported
 *
 * This adapter exists solely for wiring verification.
 * Real AI adapters will be introduced in later stages.
 */
@Injectable()
export class StubAIAdapter implements AIAdapter {
  private readonly logger = new Logger(StubAIAdapter.name);

  readonly model = 'stub';
  readonly supportsToolUse = false;

  /**
   * Execute AI request (stub)
   *
   * Returns deterministic placeholder response.
   * No actual AI execution occurs.
   *
   * @param request - AI execution request
   * @returns Stub AI execution result
   */
  async execute(request: AIExecutionRequest): Promise<AIExecutionResult> {
    this.logger.debug(
      `[Stage C2-D] StubAIAdapter.execute() called for session=${request.sessionId}`,
    );
    const executionModel =
      typeof request.model === 'string' && request.model.trim().length > 0
        ? request.model.trim()
        : this.model;

    // Phase 47.5: Delay for cancellation validation when prompt requests it
    if (request.prompt?.includes('Count slowly')) {
      await new Promise((r) => setTimeout(r, 3000));
    }

    // Stage C2-D: Deterministic stub response
    return {
      output: '[STUB] AI execution not implemented yet',
      tokensUsed: 0,
      model: executionModel,
    };
  }

  async executeWithTools(
    request: AIExecutionRequest,
    _options?: AIAdapterToolUseRequestOptions,
  ): Promise<AIAdapterToolUseResult> {
    const baseResult = await this.execute(request);
    return {
      ...baseResult,
      finishReason: 'completed',
      toolCalls: [],
    };
  }
}
