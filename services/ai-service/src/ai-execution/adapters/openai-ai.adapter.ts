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
import {
  mapAgentHarnessToolDefinitionsToAdapterToolDeclarations,
  mapAdapterToolDeclarationsToOpenAITools,
  mapCanonicalTranscriptToOpenAIMessages,
  parseToolArgumentsToObject,
} from './adapter-tool-use.mapper';
import type {
  AIAdapterCanonicalToolCall,
  AIAdapterToolCallMetadata,
  AIAdapterToolUseFinishReason,
  AIAdapterToolUseRequestOptions,
  AIAdapterToolUseResult,
} from './adapter-tool-use.contracts';
import { getStaticDefaultModel } from '../provider-model.catalogue';

/**
 * OpenAIAdapter
 *
 * Stage C2-I: OpenAI Adapter Implementation
 *
 * Real AI adapter that integrates with OpenAI's Chat Completions API.
 *
 * Responsibilities:
 * - Transform AIExecutionRequest to OpenAI Chat Completions API format
 * - Execute requests via OpenAI SDK
 * - Transform OpenAI responses to AIExecutionResult
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
export class OpenAIAdapter implements AIAdapter {
  private readonly logger = new Logger(OpenAIAdapter.name);
  private readonly client: OpenAI;
  private readonly defaultModel = getStaticDefaultModel('openai');
  private readonly defaultMaxTokens = 4096;
  private readonly defaultTemperature = 1.0;

  readonly model: string;
  readonly supportsToolUse = true;

  /**
   * Construct OpenAIAdapter
   *
   * @param apiKey - OpenAI API key (required)
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
      organization?: string;
    },
  ) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('OpenAI API key is required');
    }

    this.model = options?.model ?? this.defaultModel;

    this.client = new OpenAI({
      apiKey,
      timeout: options?.timeout,
      baseURL: options?.baseURL,
      organization: options?.organization,
    });

    this.logger.log(`OpenAIAdapter initialized with model: ${this.model}`);
  }

  /**
   * Execute AI request via OpenAI API
   *
   * Transforms AIExecutionRequest to OpenAI format, executes via SDK,
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
      `Executing OpenAI request for session=${request.sessionId}, conversation=${request.conversationId}`,
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
      const messages: OpenAI.Chat.ChatCompletionCreateParams['messages'] =
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

      // Transform AIExecutionRequest to OpenAI Chat Completions API format
      const openaiRequest: OpenAI.Chat.ChatCompletionCreateParams = {
        model: executionModel,
        max_tokens: this.defaultMaxTokens,
        temperature: this.defaultTemperature,
        messages,
      };

      // Execute request via OpenAI SDK (Phase 47.4: forward signal for abort)
      const createOptions = request.signal ? { signal: request.signal } : {};
      const response = await this.client.chat.completions.create(
        openaiRequest,
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
      `Executing OpenAI tool-use request for session=${request.sessionId}, conversation=${request.conversationId}`,
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
      const initialMessages: OpenAI.Chat.ChatCompletionCreateParams['messages'] =
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
      const transcriptMessages = mapCanonicalTranscriptToOpenAIMessages(
        options?.transcript,
      );
      const messages: OpenAI.Chat.ChatCompletionCreateParams['messages'] = [
        ...initialMessages,
        ...(transcriptMessages as OpenAI.Chat.ChatCompletionCreateParams['messages']),
      ];
      const adapterTools = mapAgentHarnessToolDefinitionsToAdapterToolDeclarations(
        options?.tools,
      );
      const openaiTools = mapAdapterToolDeclarationsToOpenAITools(adapterTools);

      const openaiRequest: OpenAI.Chat.ChatCompletionCreateParams = {
        model: executionModel,
        max_tokens: this.defaultMaxTokens,
        temperature: this.defaultTemperature,
        messages,
      };
      if (openaiTools.length > 0) {
        openaiRequest.tools = openaiTools.map((tool) => ({
          type: 'function' as const,
          function: {
            name: tool.function.name,
            description: tool.function.description,
            parameters: { ...tool.function.parameters },
          },
        }));
        openaiRequest.tool_choice = 'auto';
      }

      const createOptions = request.signal ? { signal: request.signal } : {};
      const response = await this.client.chat.completions.create(
        openaiRequest,
        createOptions,
      );

      return this.transformToolUseResponse(response, executionModel);
    } catch (error) {
      this.handleError(error, request);
    }
  }

  /**
   * Transform OpenAI response to AIExecutionResult
   *
   * Extracts:
   * - output: text content from choices[0].message.content
   * - tokensUsed: usage.total_tokens
   * - model: model identifier from response
   *
   * @param response - OpenAI Chat Completions API response
   * @returns AIExecutionResult
   * @throws InternalServerErrorException if response is malformed
   */
  private transformResponse(
    response: OpenAI.Chat.ChatCompletion,
    fallbackModel: string,
  ): AIExecutionResult {
    // Validate response structure
    if (!response.choices || response.choices.length === 0) {
      this.logger.error('OpenAI response missing choices field');
      throw new InternalServerErrorException(
        'Malformed OpenAI response: missing choices',
      );
    }

    const content = response.choices[0].message.content;
    if (!content || content.trim().length === 0) {
      this.logger.error('OpenAI response missing or empty content');
      throw new InternalServerErrorException(
        'Malformed OpenAI response: missing content',
      );
    }

    if (!response.usage || typeof response.usage.total_tokens !== 'number') {
      this.logger.error('OpenAI response missing usage field');
      throw new InternalServerErrorException(
        'Malformed OpenAI response: missing usage',
      );
    }

    // Validate token counts
    if (response.usage.total_tokens < 0) {
      this.logger.error('Invalid token count in OpenAI response', {
        total_tokens: response.usage.total_tokens,
      });
      throw new InternalServerErrorException(
        'Malformed OpenAI response: invalid token count',
      );
    }

    // Extract values
    const output = content;
    const tokensUsed = response.usage.total_tokens;
    const model = response.model || fallbackModel;

    this.logger.debug(
      `OpenAI response: output=${output.length} chars, tokens=${tokensUsed}, model=${model}`,
    );

    return {
      output,
      tokensUsed,
      model,
    };
  }

  private transformToolUseResponse(
    response: OpenAI.Chat.ChatCompletion,
    fallbackModel: string,
  ): AIAdapterToolUseResult {
    if (!response.choices || response.choices.length === 0) {
      this.logger.error('OpenAI response missing choices field');
      throw new InternalServerErrorException(
        'Malformed OpenAI response: missing choices',
      );
    }

    if (!response.usage || typeof response.usage.total_tokens !== 'number') {
      this.logger.error('OpenAI response missing usage field');
      throw new InternalServerErrorException(
        'Malformed OpenAI response: missing usage',
      );
    }
    if (response.usage.total_tokens < 0) {
      this.logger.error('Invalid token count in OpenAI response', {
        total_tokens: response.usage.total_tokens,
      });
      throw new InternalServerErrorException(
        'Malformed OpenAI response: invalid token count',
      );
    }

    const firstChoice = response.choices[0];
    const message = firstChoice.message;
    const { toolCalls, canonicalToolCalls } = this.extractToolCalls(message);
    const output = typeof message.content === 'string' ? message.content : '';
    if (output.trim().length === 0 && canonicalToolCalls.length === 0) {
      this.logger.error('OpenAI tool-use response missing content and tool_calls');
      throw new InternalServerErrorException(
        'Malformed OpenAI response: missing content',
      );
    }

    const finishReason = this.mapFinishReason(
      firstChoice.finish_reason,
      canonicalToolCalls,
    );
    const model = response.model || fallbackModel;

    return {
      output,
      tokensUsed: response.usage.total_tokens,
      model,
      finishReason,
      toolCalls,
      canonicalToolCalls,
    };
  }

  private extractToolCalls(
    message: OpenAI.Chat.ChatCompletionMessage,
  ): {
    readonly toolCalls: readonly AIAdapterToolCallMetadata[];
    readonly canonicalToolCalls: readonly AIAdapterCanonicalToolCall[];
  } {
    const canonicalToolCalls: AIAdapterCanonicalToolCall[] = [];
    const toolCalls: AIAdapterToolCallMetadata[] = [];

    if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      for (const call of message.tool_calls) {
        if (call.type !== 'function') {
          continue;
        }
        const rawArguments = call.function.arguments;
        const parsed = parseToolArgumentsToObject(rawArguments);
        const usableCallId =
          typeof call.id === 'string' && call.id.trim().length > 0
            ? call.id
            : undefined;
        if (!usableCallId) {
          canonicalToolCalls.push({
            status: 'missing_id',
            toolName: call.function.name,
            rawArguments,
            providerKind: 'openai-tool_calls',
          });
          continue;
        }
        if (parsed.ok === false) {
          canonicalToolCalls.push({
            status: 'malformed_arguments',
            callId: usableCallId,
            toolName: call.function.name,
            rawArguments,
            providerKind: 'openai-tool_calls',
            errorMessage: parsed.errorMessage,
          });
          continue;
        }
        const validCall: AIAdapterCanonicalToolCall = {
          status: 'valid',
          callId: usableCallId,
          toolName: call.function.name,
          arguments: parsed.value,
          rawArguments,
          providerKind: 'openai-tool_calls',
        };
        canonicalToolCalls.push(validCall);
        toolCalls.push({
          callId: usableCallId,
          toolName: call.function.name,
          arguments: parsed.value,
          providerKind: 'openai-tool_calls',
        });
      }
    }

    if (
      canonicalToolCalls.length === 0 &&
      message.function_call &&
      typeof message.function_call.name === 'string'
    ) {
      canonicalToolCalls.push({
        status: 'missing_id',
        toolName: message.function_call.name,
        rawArguments: message.function_call.arguments,
        providerKind: 'openai-function_call',
      });
    }

    return { toolCalls, canonicalToolCalls };
  }

  private mapFinishReason(
    finishReason: string | null | undefined,
    toolCalls: readonly { readonly status?: string }[] | readonly AIAdapterToolCallMetadata[],
  ): AIAdapterToolUseFinishReason {
    if (
      toolCalls.length > 0 ||
      finishReason === 'tool_calls' ||
      finishReason === 'function_call'
    ) {
      return 'tool_calls';
    }
    if (finishReason === 'stop') {
      return 'completed';
    }
    if (finishReason === 'length') {
      return 'max_tokens';
    }
    if (finishReason === 'content_filter') {
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

    this.logger.error('OpenAI API error', {
      sessionId: request.sessionId,
      conversationId: request.conversationId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Handle OpenAI SDK errors (check for status property)
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as any).status;
      const message = (error as any).message || 'Unknown error';

      if (status === 401) {
        throw new UnauthorizedException('Invalid OpenAI API key', message);
      }

      if (status === 400) {
        throw new BadRequestException(
          'Invalid request to OpenAI API',
          message,
        );
      }

      if (status === 429) {
        throw new ServiceUnavailableException(
          'OpenAI API rate limit exceeded',
          message,
        );
      }

      if (status >= 500 && status < 600) {
        throw new InternalServerErrorException(
          'OpenAI API server error',
          message,
        );
      }

      // Other API errors
      throw new InternalServerErrorException('OpenAI API error', message);
    }

    // Handle network/timeout errors
    if (error instanceof Error) {
      if (
        error.name === 'TimeoutError' ||
        error.message.includes('timeout') ||
        error.message.includes('ETIMEDOUT')
      ) {
        throw new ServiceUnavailableException(
          'OpenAI API timeout',
          error.message,
        );
      }

      if (
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      ) {
        throw new ServiceUnavailableException(
          'OpenAI API connection error',
          error.message,
        );
      }
    }

    // Unknown error
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new InternalServerErrorException(
      'Unexpected error during OpenAI API call',
      errorMessage,
    );
  }
}
