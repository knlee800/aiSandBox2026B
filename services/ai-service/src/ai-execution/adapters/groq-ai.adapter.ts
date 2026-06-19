import {
  Injectable,
  Logger,
  InternalServerErrorException,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import Groq from 'groq-sdk';
import type {
  ChatCompletionCreateParams,
  ChatCompletion,
} from 'groq-sdk/resources/chat/completions';
import { AIAdapter } from './ai-adapter.interface';
import { AIExecutionRequest, AIExecutionResult } from '../types';

/**
 * GroqAdapter
 *
 * Stage C2-J: Groq Adapter Implementation
 *
 * Real AI adapter that integrates with Groq's Chat Completions API.
 *
 * Responsibilities:
 * - Transform AIExecutionRequest to Groq Chat Completions API format
 * - Execute requests via Groq SDK
 * - Transform Groq responses to AIExecutionResult
 * - Extract token usage from usage.total_tokens
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
export class GroqAdapter implements AIAdapter {
  private readonly logger = new Logger(GroqAdapter.name);
  private readonly client: Groq;
  private readonly defaultModel = 'mixtral-8x7b-32768';
  private readonly defaultMaxTokens = 4096;
  private readonly defaultTemperature = 1.0;

  readonly model: string;

  /**
   * Construct GroqAdapter
   *
   * @param apiKey - Groq API key (required)
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
      throw new Error('Groq API key is required');
    }

    this.model = options?.model ?? this.defaultModel;

    this.client = new Groq({
      apiKey,
      timeout: options?.timeout,
      baseURL: options?.baseURL,
    });

    this.logger.log(`GroqAdapter initialized with model: ${this.model}`);
  }

  /**
   * Execute AI request via Groq API
   *
   * Transforms AIExecutionRequest to Groq format, executes via SDK,
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
      `Executing Groq request for session=${request.sessionId}, conversation=${request.conversationId}`,
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
      const messages: ChatCompletionCreateParams['messages'] =
        normalizedSystemPrompt.length > 0
          ? [
              {
                role: 'system',
                content: normalizedSystemPrompt,
              },
              {
                role: 'user',
                content: request.prompt,
              },
            ]
          : [
              {
                role: 'user',
                content: request.prompt,
              },
            ];

      // Transform AIExecutionRequest to Groq Chat Completions API format
      const groqRequest: ChatCompletionCreateParams = {
        model: executionModel,
        max_tokens: this.defaultMaxTokens,
        temperature: this.defaultTemperature,
        messages,
      };

      // Execute request via Groq SDK (Phase 47.4: forward signal for abort)
      const createOptions = request.signal ? { signal: request.signal } : {};
      const response = await this.client.chat.completions.create(
        groqRequest,
        createOptions,
      );

      // Transform response to AIExecutionResult
      return this.transformResponse(response, executionModel);
    } catch (error) {
      // Transform SDK errors to NestJS exceptions
      this.handleError(error, request);
    }
  }

  /**
   * Transform Groq response to AIExecutionResult
   *
   * Extracts:
   * - output: text content from choices[0].message.content
   * - tokensUsed: usage.total_tokens
   * - model: model identifier from response
   *
   * @param response - Groq Chat Completions API response
   * @returns AIExecutionResult
   * @throws InternalServerErrorException if response is malformed
   */
  private transformResponse(
    response: ChatCompletion,
    fallbackModel: string,
  ): AIExecutionResult {
    // Validate response structure
    if (!response.choices || response.choices.length === 0) {
      this.logger.error('Groq response missing choices field');
      throw new InternalServerErrorException(
        'Malformed Groq response: missing choices',
      );
    }

    const content = response.choices[0].message.content;
    if (!content || content.trim().length === 0) {
      this.logger.error('Groq response missing or empty content');
      throw new InternalServerErrorException(
        'Malformed Groq response: missing content',
      );
    }

    if (!response.usage || typeof response.usage.total_tokens !== 'number') {
      this.logger.error('Groq response missing usage field');
      throw new InternalServerErrorException(
        'Malformed Groq response: missing usage',
      );
    }

    // Validate token counts
    if (response.usage.total_tokens < 0) {
      this.logger.error('Invalid token count in Groq response', {
        total_tokens: response.usage.total_tokens,
      });
      throw new InternalServerErrorException(
        'Malformed Groq response: invalid token count',
      );
    }

    // Extract values
    const output = content;
    const tokensUsed = response.usage.total_tokens;
    const model = response.model || fallbackModel;

    this.logger.debug(
      `Groq response: output=${output.length} chars, tokens=${tokensUsed}, model=${model}`,
    );

    return {
      output,
      tokensUsed,
      model,
    };
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
   * @param error - Error from Groq SDK
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

    this.logger.error('Groq API error', {
      sessionId: request.sessionId,
      conversationId: request.conversationId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Handle Groq SDK errors (check for status property)
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as any).status;
      const message = (error as any).message || 'Unknown error';

      if (status === 401) {
        throw new UnauthorizedException('Invalid Groq API key', message);
      }

      if (status === 400) {
        throw new BadRequestException(
          'Invalid request to Groq API',
          message,
        );
      }

      if (status === 429) {
        throw new ServiceUnavailableException(
          'Groq API rate limit exceeded',
          message,
        );
      }

      if (status >= 500 && status < 600) {
        throw new InternalServerErrorException(
          'Groq API server error',
          message,
        );
      }

      // Other API errors
      throw new InternalServerErrorException('Groq API error', message);
    }

    // Handle network/timeout errors
    if (error instanceof Error) {
      if (
        error.name === 'TimeoutError' ||
        error.message.includes('timeout') ||
        error.message.includes('ETIMEDOUT')
      ) {
        throw new ServiceUnavailableException(
          'Groq API timeout',
          error.message,
        );
      }

      if (
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      ) {
        throw new ServiceUnavailableException(
          'Groq API connection error',
          error.message,
        );
      }
    }

    // Unknown error
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new InternalServerErrorException(
      'Unexpected error during Groq API call',
      errorMessage,
    );
  }
}
