import {
  Injectable,
  Logger,
  InternalServerErrorException,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import OpenAI from 'openai';
import { AIAdapter } from './ai-adapter.interface';
import { AIExecutionRequest, AIExecutionResult } from '../types';
import { getStaticDefaultModel } from '../provider-model.catalogue';

const XAI_STRUCTURED_JSON_OUTPUT_CONTRACT = `IMPORTANT: Your entire response MUST be a single valid JSON object with these fields:
- "assistantText": (string) Your conversational response to show the user.
- "workspaceMutationAttempted": (boolean, optional advisory field) true if you attempted to create, modify, or delete files; false otherwise.
- "fileActions": (array) File actions to apply to the workspace. Each action object must include "action" (one of "create", "write", "update", "delete"), "path" (relative file path), and "content" (required for "create", "write", and "update"; use empty string "" for "delete"). Use [] when no file actions are produced.

Do not include any text outside the JSON object. Do not use fenced code blocks. Include full file content directly in fileActions.`;

/**
 * XAIAdapter
 *
 * Phase 19A: xAI (Grok) Adapter Implementation
 *
 * Real AI adapter that integrates with xAI's Chat Completions API.
 * xAI uses OpenAI-compatible API format.
 *
 * Responsibilities:
 * - Transform AIExecutionRequest to xAI Chat Completions API format
 * - Execute requests via OpenAI SDK with xAI baseURL
 * - Transform xAI responses to AIExecutionResult
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
export class XAIAdapter implements AIAdapter {
  private readonly logger = new Logger(XAIAdapter.name);
  private readonly client: OpenAI;
  private readonly defaultModel = getStaticDefaultModel('xai');
  private readonly defaultMaxTokens = 4096;
  private readonly defaultTemperature = 1.0;
  private readonly defaultBaseURL = 'https://api.x.ai/v1';

  readonly model: string;

  /**
   * Construct XAIAdapter
   *
   * @param apiKey - xAI API key (required)
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
      throw new Error('xAI API key is required');
    }

    this.model = options?.model ?? this.defaultModel;

    this.client = new OpenAI({
      apiKey,
      timeout: options?.timeout,
      baseURL: options?.baseURL ?? this.defaultBaseURL,
    });

    this.logger.log(`XAIAdapter initialized with model: ${this.model}`);
  }

  /**
   * Execute AI request via xAI API
   *
   * Transforms AIExecutionRequest to xAI format, executes via SDK,
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
      `Executing xAI request for session=${request.sessionId}, conversation=${request.conversationId}`,
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
      const structuredSystemPrompt =
        normalizedSystemPrompt.length > 0
          ? `${normalizedSystemPrompt}\n\n${XAI_STRUCTURED_JSON_OUTPUT_CONTRACT}`
          : XAI_STRUCTURED_JSON_OUTPUT_CONTRACT;
      const messages: OpenAI.Chat.ChatCompletionCreateParams['messages'] =
        [
          {
            role: 'system',
            content: structuredSystemPrompt,
          },
          {
            role: 'user',
            content: request.prompt ?? '',
          },
        ];

      // Transform AIExecutionRequest to xAI Chat Completions API format
      // TASK-56A: content must be string (xAI 422 if missing); coerce undefined/null to ''
      const xaiRequest: OpenAI.Chat.ChatCompletionCreateParams = {
        model: executionModel,
        max_tokens: this.defaultMaxTokens,
        temperature: this.defaultTemperature,
        messages,
        response_format: {
          type: 'json_object',
        },
      };

      // Execute request via OpenAI SDK with xAI baseURL (Phase 47.4: forward signal for abort)
      const createOptions = request.signal ? { signal: request.signal } : {};
      const response = await this.client.chat.completions.create(
        xaiRequest,
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
   * Transform xAI response to AIExecutionResult
   *
   * Extracts:
   * - output: text content from choices[0].message.content
   * - tokensUsed: usage.total_tokens
   * - model: model identifier from response
   *
   * @param response - xAI Chat Completions API response
   * @returns AIExecutionResult
   * @throws InternalServerErrorException if response is malformed
   */
  private transformResponse(
    response: OpenAI.Chat.ChatCompletion,
    fallbackModel: string,
  ): AIExecutionResult {
    // Validate response structure
    if (!response.choices || response.choices.length === 0) {
      this.logger.error('xAI response missing choices field');
      throw new InternalServerErrorException(
        'Malformed xAI response: missing choices',
      );
    }

    const content = response.choices[0].message.content;
    if (!content || content.trim().length === 0) {
      this.logger.error('xAI response missing or empty content');
      throw new InternalServerErrorException(
        'Malformed xAI response: missing content',
      );
    }

    if (!response.usage || typeof response.usage.total_tokens !== 'number') {
      this.logger.error('xAI response missing usage field');
      throw new InternalServerErrorException(
        'Malformed xAI response: missing usage',
      );
    }

    // Validate token counts
    if (response.usage.total_tokens < 0) {
      this.logger.error('Invalid token count in xAI response', {
        total_tokens: response.usage.total_tokens,
      });
      throw new InternalServerErrorException(
        'Malformed xAI response: invalid token count',
      );
    }

    // Extract values
    const output = content;
    const tokensUsed = response.usage.total_tokens;
    const model = response.model || fallbackModel;

    this.logger.debug(
      `xAI response: output=${output.length} chars, tokens=${tokensUsed}, model=${model}`,
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
   * @param error - Error from OpenAI SDK
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

    this.logger.error('xAI API error', {
      sessionId: request.sessionId,
      conversationId: request.conversationId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Handle OpenAI SDK errors (check for status property)
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as any).status;
      const message = (error as any).message || 'Unknown error';

      if (status === 401) {
        throw new UnauthorizedException('Invalid xAI API key', message);
      }

      if (status === 400) {
        throw new BadRequestException(
          'Invalid request to xAI API',
          message,
        );
      }

      if (status === 429) {
        throw new ServiceUnavailableException(
          'xAI API rate limit exceeded',
          message,
        );
      }

      if (status >= 500 && status < 600) {
        throw new InternalServerErrorException(
          'xAI API server error',
          message,
        );
      }

      // Other API errors
      throw new InternalServerErrorException('xAI API error', message);
    }

    // Handle network/timeout errors
    if (error instanceof Error) {
      if (
        error.name === 'TimeoutError' ||
        error.message.includes('timeout') ||
        error.message.includes('ETIMEDOUT')
      ) {
        throw new ServiceUnavailableException(
          'xAI API timeout',
          error.message,
        );
      }

      if (
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      ) {
        throw new ServiceUnavailableException(
          'xAI API connection error',
          error.message,
        );
      }
    }

    // Unknown error
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new InternalServerErrorException(
      'Unexpected error during xAI API call',
      errorMessage,
    );
  }
}
