import {
  Injectable,
  Logger,
  InternalServerErrorException,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AIAdapter } from './ai-adapter.interface';
import { AIExecutionRequest, AIExecutionResult } from '../types';
import type {
  AIAdapterToolCallMetadata,
  AIAdapterToolUseFinishReason,
  AIAdapterToolUseRequestOptions,
  AIAdapterToolUseResult,
} from './adapter-tool-use.contracts';
import {
  mapAgentHarnessToolDefinitionsToAdapterToolDeclarations,
  mapAdapterToolDeclarationsToAnthropicTools,
} from './adapter-tool-use.mapper';

/**
 * AnthropicAdapter
 *
 * Stage C2-H: Anthropic Claude Adapter Implementation
 *
 * Real AI adapter that integrates with Anthropic's Claude API.
 *
 * Responsibilities:
 * - Transform AIExecutionRequest to Anthropic Messages API format
 * - Execute requests via Anthropic SDK
 * - Transform Anthropic responses to AIExecutionResult
 * - Extract token usage (input_tokens + output_tokens)
 * - Throw on all failures (no error payloads)
 *
 * Design Principles:
 * - Implements AIAdapter interface exactly
 * - Stateless (no conversation history management)
 * - Deterministic (same request → same behavior)
 * - Fail-fast (missing API key throws at construction)
 *
 * Token Accounting:
 * - Adapters return token usage via AIExecutionResult
 * - Token recording is performed by AIExecutionService (ADR-12B)
 * - Adapters DO NOT persist, record, or bill tokens
 */
@Injectable()
export class AnthropicAdapter implements AIAdapter {
  private readonly logger = new Logger(AnthropicAdapter.name);
  private readonly client: Anthropic;
  private readonly defaultMaxTokens = 4096;
  private readonly defaultTemperature = 1.0;

  readonly model: string;
  readonly supportsToolUse = true;

  /**
   * Construct AnthropicAdapter
   *
   * @param apiKey - Anthropic API key (required)
   * @param options - Optional configuration
   * @throws Error if API key is missing
   */
  constructor(
    apiKey: string,
    options?: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      timeout?: number;
      baseURL?: string;
    },
  ) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('Anthropic API key is required');
    }
    if (!options?.model || options.model.trim().length === 0) {
      throw new Error('Anthropic model is required');
    }

    this.model = options.model.trim();

    this.client = new Anthropic({
      apiKey,
      timeout: options?.timeout,
      baseURL: options?.baseURL,
    });

    this.logger.log(`AnthropicAdapter initialized with model: ${this.model}`);
  }

  /**
   * Execute AI request via Anthropic API
   *
   * Transforms AIExecutionRequest to Anthropic format, executes via SDK,
   * and transforms response to AIExecutionResult.
   *
   * @param request - AI execution request
   * @returns AI execution result with output, tokensUsed, and model
   * @throws UnauthorizedException for 401 (invalid API key)
   * @throws BadRequestException for 400 (validation errors)
   * @throws ServiceUnavailableException for network/timeout errors
   * @throws InternalServerErrorException for malformed responses or server errors
   */
  async execute(request: AIExecutionRequest): Promise<AIExecutionResult> {
    this.logger.debug(
      `Executing Anthropic request for session=${request.sessionId}, conversation=${request.conversationId}`,
    );

    try {
      const executionModel =
        typeof request.model === 'string' && request.model.trim().length > 0
          ? request.model.trim()
          : this.model;
      const normalizedSystemPrompt =
        typeof request.systemPrompt === 'string'
          ? request.systemPrompt.trim()
          : '';

      // Transform AIExecutionRequest to Anthropic Messages API format
      const anthropicRequest: Anthropic.MessageCreateParams = {
        model: executionModel,
        max_tokens: this.defaultMaxTokens,
        temperature: this.defaultTemperature,
        messages: [
          {
            role: 'user',
            content: request.prompt,
          },
        ],
      };
      if (normalizedSystemPrompt.length > 0) {
        anthropicRequest.system = normalizedSystemPrompt;
      }

      // Execute request via Anthropic SDK (Phase 47.4: forward signal for abort)
      const createOptions = request.signal ? { signal: request.signal } : {};
      const response = await this.client.messages.create(
        anthropicRequest,
        createOptions,
      );

      // Transform response to AIExecutionResult
      return this.transformResponse(response, executionModel);
    } catch (error) {
      // Transform SDK errors to NestJS exceptions
      this.handleError(error, request);
    }
  }

  async executeWithTools(
    request: AIExecutionRequest,
    options?: AIAdapterToolUseRequestOptions,
  ): Promise<AIAdapterToolUseResult> {
    this.logger.debug(
      `Executing Anthropic tool-use request for session=${request.sessionId}, conversation=${request.conversationId}`,
    );

    try {
      const executionModel =
        typeof request.model === 'string' && request.model.trim().length > 0
          ? request.model.trim()
          : this.model;
      const normalizedSystemPrompt =
        typeof request.systemPrompt === 'string'
          ? request.systemPrompt.trim()
          : '';
      const adapterTools = mapAgentHarnessToolDefinitionsToAdapterToolDeclarations(
        options?.tools,
      );
      const anthropicTools = mapAdapterToolDeclarationsToAnthropicTools(
        adapterTools,
      );

      const anthropicRequest: Anthropic.MessageCreateParams = {
        model: executionModel,
        max_tokens: this.defaultMaxTokens,
        temperature: this.defaultTemperature,
        messages: [
          {
            role: 'user',
            content: request.prompt,
          },
        ],
      };
      if (normalizedSystemPrompt.length > 0) {
        anthropicRequest.system = normalizedSystemPrompt;
      }
      if (anthropicTools.length > 0) {
        anthropicRequest.tools =
          anthropicTools as Anthropic.MessageCreateParams['tools'];
      }

      const createOptions = request.signal ? { signal: request.signal } : {};
      const response = await this.client.messages.create(
        anthropicRequest,
        createOptions,
      );

      return this.transformToolUseResponse(response, executionModel);
    } catch (error) {
      this.handleError(error, request);
    }
  }

  /**
   * Transform Anthropic response to AIExecutionResult
   *
   * Extracts:
   * - output: text content from first text block
   * - tokensUsed: sum of input_tokens + output_tokens
   * - model: model identifier from response
   *
   * @param response - Anthropic Messages API response
   * @returns AIExecutionResult
   * @throws InternalServerErrorException if response is malformed
   */
  private transformResponse(
    response: Anthropic.Message,
    fallbackModel: string,
  ): AIExecutionResult {
    // Validate response structure
    if (!response.content || response.content.length === 0) {
      this.logger.error('Anthropic response missing content field');
      throw new InternalServerErrorException(
        'Malformed Anthropic response: missing content',
      );
    }

    if (!response.usage) {
      this.logger.error('Anthropic response missing usage field');
      throw new InternalServerErrorException(
        'Malformed Anthropic response: missing usage',
      );
    }

    // Extract text content from content blocks
    const textBlocks = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text);

    if (textBlocks.length === 0) {
      this.logger.error('Anthropic response contains no text blocks');
      throw new InternalServerErrorException(
        'Malformed Anthropic response: no text content',
      );
    }

    // Concatenate multiple text blocks with newline separator
    const output = textBlocks.join('\n\n');

    // Calculate total tokens used
    const tokensUsed =
      response.usage.input_tokens + response.usage.output_tokens;

    // Validate token counts
    if (
      typeof response.usage.input_tokens !== 'number' ||
      typeof response.usage.output_tokens !== 'number' ||
      response.usage.input_tokens < 0 ||
      response.usage.output_tokens < 0
    ) {
      this.logger.error('Invalid token counts in Anthropic response', {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      });
      throw new InternalServerErrorException(
        'Malformed Anthropic response: invalid token counts',
      );
    }

    // Extract model identifier (use response model or fallback to instance model)
    const model = response.model || fallbackModel;

    this.logger.debug(
      `Anthropic response: output=${output.length} chars, tokens=${tokensUsed}, model=${model}`,
    );

    return {
      output,
      tokensUsed,
      model,
    };
  }

  private transformToolUseResponse(
    response: Anthropic.Message,
    fallbackModel: string,
  ): AIAdapterToolUseResult {
    if (!response.content || response.content.length === 0) {
      this.logger.error('Anthropic tool-use response missing content field');
      throw new InternalServerErrorException(
        'Malformed Anthropic response: missing content',
      );
    }

    if (!response.usage) {
      this.logger.error('Anthropic tool-use response missing usage field');
      throw new InternalServerErrorException(
        'Malformed Anthropic response: missing usage',
      );
    }

    const textBlocks = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text);
    const output = textBlocks.join('\n\n');
    const toolCalls = this.extractToolCalls(response.content);

    if (textBlocks.length === 0 && toolCalls.length === 0) {
      this.logger.error('Anthropic tool-use response contains no usable blocks');
      throw new InternalServerErrorException(
        'Malformed Anthropic response: no text or tool_use content',
      );
    }

    if (
      typeof response.usage.input_tokens !== 'number' ||
      typeof response.usage.output_tokens !== 'number' ||
      response.usage.input_tokens < 0 ||
      response.usage.output_tokens < 0
    ) {
      this.logger.error('Invalid token counts in Anthropic response', {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      });
      throw new InternalServerErrorException(
        'Malformed Anthropic response: invalid token counts',
      );
    }

    const tokensUsed =
      response.usage.input_tokens + response.usage.output_tokens;
    const model = response.model || fallbackModel;
    const finishReason = this.mapFinishReason(response.stop_reason, toolCalls);

    return {
      output,
      tokensUsed,
      model,
      finishReason,
      toolCalls,
    };
  }

  private extractToolCalls(
    blocks: readonly Anthropic.ContentBlock[],
  ): readonly AIAdapterToolCallMetadata[] {
    const toolUseBlocks = blocks.filter((block) => block.type === 'tool_use');
    return toolUseBlocks.map((block, index) => {
      const toolUseBlock = block as Anthropic.ToolUseBlock;
      return {
        callId: toolUseBlock.id || `anthropic-tool-use-${index + 1}`,
        toolName: toolUseBlock.name,
        arguments:
          typeof toolUseBlock.input === 'object' && toolUseBlock.input !== null
            ? (toolUseBlock.input as Record<string, unknown>)
            : {},
        providerKind: 'anthropic-tool_use',
      };
    });
  }

  private mapFinishReason(
    stopReason: string | null | undefined,
    toolCalls: readonly AIAdapterToolCallMetadata[],
  ): AIAdapterToolUseFinishReason {
    if (toolCalls.length > 0 || stopReason === 'tool_use') {
      return 'tool_calls';
    }
    if (stopReason === 'end_turn') {
      return 'completed';
    }
    if (stopReason === 'max_tokens') {
      return 'max_tokens';
    }
    if (stopReason === 'stop_sequence') {
      return 'stop';
    }

    return 'unknown';
  }

  /**
   * Handle SDK errors and transform to NestJS exceptions
   *
   * Error categories:
   * - 401 Unauthorized → UnauthorizedException
   * - 400 Bad Request → BadRequestException
   * - 429 Rate Limit → ServiceUnavailableException
   * - 500 Server Error → InternalServerErrorException
   * - Network/Timeout → ServiceUnavailableException
   * - Unknown → InternalServerErrorException
   *
   * @param error - Error from Anthropic SDK
   * @param request - Original AIExecutionRequest (for context)
   * @throws Never returns, always throws
   */
  private handleError(error: unknown, request: AIExecutionRequest): never {
    // If error is already a NestJS HTTP exception, re-throw it directly
    if (
      error instanceof InternalServerErrorException ||
      error instanceof UnauthorizedException ||
      error instanceof BadRequestException ||
      error instanceof ServiceUnavailableException
    ) {
      throw error;
    }

    this.logger.error('Anthropic API error', {
      sessionId: request.sessionId,
      conversationId: request.conversationId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Handle Anthropic SDK errors
    if (error instanceof Anthropic.APIError) {
      const status = error.status;

      // Check for specific error types first
      if (error.constructor.name === 'AuthenticationError' || status === 401) {
        throw new UnauthorizedException(
          'Invalid Anthropic API key',
          error.message,
        );
      }

      if (error.constructor.name === 'BadRequestError' || status === 400) {
        throw new BadRequestException(
          'Invalid request to Anthropic API',
          error.message,
        );
      }

      if (error.constructor.name === 'RateLimitError' || status === 429) {
        throw new ServiceUnavailableException(
          'Anthropic API rate limit exceeded',
          error.message,
        );
      }

      if (
        error.constructor.name === 'InternalServerError' ||
        (status && status >= 500 && status < 600)
      ) {
        throw new InternalServerErrorException(
          'Anthropic API server error',
          error.message,
        );
      }

      // Other API errors
      throw new InternalServerErrorException(
        'Anthropic API error',
        error.message,
      );
    }

    // Handle network/timeout errors
    if (error instanceof Error) {
      if (
        error.name === 'TimeoutError' ||
        error.message.includes('timeout') ||
        error.message.includes('ETIMEDOUT')
      ) {
        throw new ServiceUnavailableException(
          'Anthropic API timeout',
          error.message,
        );
      }

      if (
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      ) {
        throw new ServiceUnavailableException(
          'Anthropic API connection error',
          error.message,
        );
      }
    }

    // Unknown error
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new InternalServerErrorException(
      'Unexpected error during Anthropic API call',
      errorMessage,
    );
  }
}
