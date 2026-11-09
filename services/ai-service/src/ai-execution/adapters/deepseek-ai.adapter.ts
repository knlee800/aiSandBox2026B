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
import { resolvePlainOutputTokenLimit } from '../../agent-harness/model-profiles/model-profile.registry';
import { appendHarnessEnvFileInstruction } from '../../agent-harness/prompts/harness-instructions';
import type {
  AIAdapterCanonicalToolCall,
  AIAdapterToolCallMetadata,
  AIAdapterToolUseFinishReason,
  AIAdapterToolUseRequestOptions,
  AIAdapterToolUseResult,
} from './adapter-tool-use.contracts';
import {
  mapAdapterToolDeclarationsToOpenAITools,
  mapAgentHarnessToolDefinitionsToAdapterToolDeclarations,
  mapCanonicalTranscriptToOpenAIMessages,
  parseToolArgumentsToObject,
} from './adapter-tool-use.mapper';

interface DeepSeekChatToolCall {
  readonly id?: unknown;
  readonly function?: {
    readonly name?: unknown;
    readonly arguments?: unknown;
  };
}

interface DeepSeekChatCompletionMessage {
  readonly content?: unknown;
  readonly tool_calls?: readonly DeepSeekChatToolCall[];
  readonly reasoning_content?: unknown;
}

/**
 * DeepSeekAdapter
 *
 * Phase 19A: DeepSeek Adapter Implementation
 *
 * Real AI adapter that integrates with DeepSeek's Chat Completions API.
 * DeepSeek uses OpenAI-compatible API format.
 *
 * Responsibilities:
 * - Transform AIExecutionRequest to DeepSeek Chat Completions API format
 * - Execute requests via OpenAI SDK with DeepSeek baseURL
 * - Transform DeepSeek responses to AIExecutionResult
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
export class DeepSeekAdapter implements AIAdapter {
  private readonly logger = new Logger(DeepSeekAdapter.name);
  private readonly client: OpenAI;
  private readonly defaultModel = getStaticDefaultModel('deepseek');
  private readonly defaultTemperature = 1.0;
  private readonly defaultBaseURL = 'https://api.deepseek.com';

  readonly model: string;
  readonly supportsToolUse = true;

  /**
   * Construct DeepSeekAdapter
   *
   * @param apiKey - DeepSeek API key (required)
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
      throw new Error('DeepSeek API key is required');
    }

    this.model = options?.model ?? this.defaultModel;

    this.client = new OpenAI({
      apiKey,
      timeout: options?.timeout,
      baseURL: options?.baseURL ?? this.defaultBaseURL,
    });

    this.logger.log(`DeepSeekAdapter initialized with model: ${this.model}`);
  }

  /**
   * Execute AI request via DeepSeek API
   *
   * Transforms AIExecutionRequest to DeepSeek format, executes via SDK,
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
      `Executing DeepSeek request for session=${request.sessionId}, conversation=${request.conversationId}`,
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

      // Transform AIExecutionRequest to DeepSeek Chat Completions API format
      const deepseekRequest: OpenAI.Chat.ChatCompletionCreateParams = {
        model: executionModel,
        max_tokens: resolvePlainOutputTokenLimit(executionModel),
        temperature: this.defaultTemperature,
        messages,
      };

      // Execute request via OpenAI SDK with DeepSeek baseURL (Phase 47.4: forward signal for abort)
      const createOptions = request.signal ? { signal: request.signal } : {};
      const response = await this.client.chat.completions.create(
        deepseekRequest,
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
      `Executing DeepSeek tool-use request for session=${request.sessionId}, conversation=${request.conversationId}`,
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
      const transcriptMessages = mapCanonicalTranscriptToOpenAIMessages(
        options?.transcript,
      );
      // ChatCompletionMessageParam has no reasoning_content. This assertion
      // only satisfies the SDK; the assistant objects still carry that field.
      const messages = [
        {
          role: 'system' as const,
          content: appendHarnessEnvFileInstruction(
            normalizedSystemPrompt.length > 0 ? normalizedSystemPrompt : undefined,
          ),
        },
        {
          role: 'user' as const,
          content: request.prompt,
        },
        ...transcriptMessages,
      ] as OpenAI.Chat.ChatCompletionCreateParams['messages'];
      const openaiTools = mapAdapterToolDeclarationsToOpenAITools(
        mapAgentHarnessToolDefinitionsToAdapterToolDeclarations(options?.tools),
      );

      // Thinking stays at the provider default: do not send a `thinking` parameter.
      const deepseekRequest: OpenAI.Chat.ChatCompletionCreateParams = {
        model: executionModel,
        max_tokens: 16000,
        messages,
      };
      if (openaiTools.length > 0) {
        deepseekRequest.tools = openaiTools.map((tool) => ({
          type: 'function' as const,
          function: {
            name: tool.function.name,
            description: tool.function.description,
            parameters: { ...tool.function.parameters },
          },
        }));
        deepseekRequest.tool_choice = 'auto';
      }

      const createOptions = request.signal ? { signal: request.signal } : {};
      const response = await this.client.chat.completions.create(
        deepseekRequest,
        createOptions,
      );

      return this.transformToolUseResponse(response, executionModel);
    } catch (error) {
      this.handleError(error, request);
    }
  }

  /**
   * Transform DeepSeek response to AIExecutionResult
   *
   * Extracts:
   * - output: text content from choices[0].message.content
   * - tokensUsed: usage.total_tokens
   * - model: model identifier from response
   *
   * @param response - DeepSeek Chat Completions API response
   * @returns AIExecutionResult
   * @throws InternalServerErrorException if response is malformed
   */
  private transformResponse(
    response: OpenAI.Chat.ChatCompletion,
    fallbackModel: string,
  ): AIExecutionResult {
    // Validate response structure
    if (!response.choices || response.choices.length === 0) {
      this.logger.error('DeepSeek response missing choices field');
      throw new InternalServerErrorException(
        'Malformed DeepSeek response: missing choices',
      );
    }

    const content = response.choices[0].message.content;
    if (!content || content.trim().length === 0) {
      this.logger.error('DeepSeek response missing or empty content');
      throw new InternalServerErrorException(
        'Malformed DeepSeek response: missing content',
      );
    }

    if (!response.usage || typeof response.usage.total_tokens !== 'number') {
      this.logger.error('DeepSeek response missing usage field');
      throw new InternalServerErrorException(
        'Malformed DeepSeek response: missing usage',
      );
    }

    // Validate token counts
    if (response.usage.total_tokens < 0) {
      this.logger.error('Invalid token count in DeepSeek response', {
        total_tokens: response.usage.total_tokens,
      });
      throw new InternalServerErrorException(
        'Malformed DeepSeek response: invalid token count',
      );
    }

    // Extract values
    const output = content;
    const tokensUsed = response.usage.total_tokens;
    const model = response.model || fallbackModel;

    this.logger.debug(
      `DeepSeek response: output=${output.length} chars, tokens=${tokensUsed}, model=${model}`,
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
      this.logger.error('DeepSeek response missing choices field');
      throw new InternalServerErrorException(
        'Malformed DeepSeek response: missing choices',
      );
    }

    const message = response.choices[0]
      .message as DeepSeekChatCompletionMessage;
    const output = typeof message.content === 'string' ? message.content : '';
    const { toolCalls, canonicalToolCalls } = this.extractToolCalls(
      message.tool_calls,
    );

    if (output.trim().length === 0 && canonicalToolCalls.length === 0) {
      this.logger.error('DeepSeek response missing or empty content');
      throw new InternalServerErrorException(
        'Malformed DeepSeek response: missing content',
      );
    }

    if (!response.usage || typeof response.usage.total_tokens !== 'number') {
      this.logger.error('DeepSeek response missing usage field');
      throw new InternalServerErrorException(
        'Malformed DeepSeek response: missing usage',
      );
    }

    if (response.usage.total_tokens < 0) {
      this.logger.error('Invalid token count in DeepSeek response', {
        total_tokens: response.usage.total_tokens,
      });
      throw new InternalServerErrorException(
        'Malformed DeepSeek response: invalid token count',
      );
    }

    const tokensUsed = response.usage.total_tokens;
    const model = response.model || fallbackModel;
    const finishReason = this.mapToolUseFinishReason(
      response.choices[0].finish_reason,
      canonicalToolCalls,
    );
    const reasoningContent =
      typeof message.reasoning_content === 'string'
        ? message.reasoning_content
        : undefined;

    this.logger.debug(
      `DeepSeek tool-use response: output=${output.length} chars, tokens=${tokensUsed}, model=${model}`,
    );

    return {
      output,
      tokensUsed,
      model,
      finishReason,
      toolCalls,
      canonicalToolCalls,
      ...(canonicalToolCalls.length > 0 && reasoningContent !== undefined
        ? {
            providerState: {
              kind: 'deepseek-reasoning',
              reasoningContent,
            },
          }
        : {}),
    };
  }

  private extractToolCalls(toolCalls: readonly DeepSeekChatToolCall[] | undefined): {
    readonly toolCalls: readonly AIAdapterToolCallMetadata[];
    readonly canonicalToolCalls: readonly AIAdapterCanonicalToolCall[];
  } {
    const canonicalToolCalls: AIAdapterCanonicalToolCall[] = [];
    const metadata: AIAdapterToolCallMetadata[] = [];
    if (!Array.isArray(toolCalls)) {
      return { toolCalls: metadata, canonicalToolCalls };
    }

    for (const call of toolCalls) {
      if (!call || typeof call !== 'object') {
        continue;
      }
      const rawArguments = call.function?.arguments;
      const parsed = parseToolArgumentsToObject(rawArguments);
      const toolName =
        typeof call.function?.name === 'string' ? call.function.name : '';
      const usableCallId =
        typeof call.id === 'string' && call.id.trim().length > 0
          ? call.id
          : undefined;
      const providerKind = 'openai-tool_calls' as const;

      if (!usableCallId) {
        canonicalToolCalls.push({
          status: 'missing_id',
          toolName,
          rawArguments,
          providerKind,
        });
        continue;
      }

      if (parsed.ok === false) {
        canonicalToolCalls.push({
          status: 'malformed_arguments',
          callId: usableCallId,
          toolName,
          rawArguments,
          providerKind,
          errorMessage: parsed.errorMessage,
        });
        continue;
      }

      canonicalToolCalls.push({
        status: 'valid',
        callId: usableCallId,
        toolName,
        arguments: parsed.value,
        rawArguments,
        providerKind,
      });
      metadata.push({
        callId: usableCallId,
        toolName,
        arguments: parsed.value,
        providerKind,
      });
    }

    return { toolCalls: metadata, canonicalToolCalls };
  }

  private mapToolUseFinishReason(
    finishReason: string | null | undefined,
    toolCalls: readonly AIAdapterCanonicalToolCall[],
  ): AIAdapterToolUseFinishReason {
    if (toolCalls.length > 0 || finishReason === 'tool_calls') {
      return 'tool_calls';
    }
    if (finishReason === 'stop') {
      return 'stop';
    }
    if (finishReason === 'length') {
      return 'max_tokens';
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

    this.logger.error('DeepSeek API error', {
      sessionId: request.sessionId,
      conversationId: request.conversationId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Handle OpenAI SDK errors (check for status property)
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as any).status;
      const message = (error as any).message || 'Unknown error';

      if (status === 401) {
        throw new UnauthorizedException('Invalid DeepSeek API key', message);
      }

      if (status === 400) {
        throw new BadRequestException(
          'Invalid request to DeepSeek API',
          message,
        );
      }

      if (status === 429) {
        throw new ServiceUnavailableException(
          'DeepSeek API rate limit exceeded',
          message,
        );
      }

      if (status >= 500 && status < 600) {
        throw new InternalServerErrorException(
          'DeepSeek API server error',
          message,
        );
      }

      // Other API errors
      throw new InternalServerErrorException('DeepSeek API error', message);
    }

    // Handle network/timeout errors
    if (error instanceof Error) {
      if (
        error.name === 'TimeoutError' ||
        error.message.includes('timeout') ||
        error.message.includes('ETIMEDOUT')
      ) {
        throw new ServiceUnavailableException(
          'DeepSeek API timeout',
          error.message,
        );
      }

      if (
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      ) {
        throw new ServiceUnavailableException(
          'DeepSeek API connection error',
          error.message,
        );
      }
    }

    // Unknown error
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new InternalServerErrorException(
      'Unexpected error during DeepSeek API call',
      errorMessage,
    );
  }
}
