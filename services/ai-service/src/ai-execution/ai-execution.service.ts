import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ServiceUnavailableException,
  InternalServerErrorException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AIExecutionRequest, AIExecutionResult } from './types';
import { extractFileActionsFromOutput } from './file-actions.parser';
import { AIAdapter } from './adapters/ai-adapter.interface';
import { StubAIAdapter } from './adapters/stub-ai.adapter';
import { AnthropicAdapter } from './adapters/anthropic-ai.adapter';
import { OpenAIAdapter } from './adapters/openai-ai.adapter';
import { GroqAdapter } from './adapters/groq-ai.adapter';
import { XAIAdapter } from './adapters/xai-ai.adapter';
import { DeepSeekAdapter } from './adapters/deepseek-ai.adapter';
import { TestToolCapableStubAdapter } from './adapters/test-harness-stub-ai.adapter';
import { observeProviderLatency } from '../observability/execution-metrics';
import {
  ProviderModelValidationError,
  resolveProviderModelSelection,
} from './provider-model.catalogue';

/**
 * AIExecutionService
 *
 * Stage C2-B: Service skeleton established
 * Stage C2-D: Adapter interface wired, delegation pattern implemented
 * Phase 17B: Observability logging added
 * Phase 28: Per-request provider selection (caller-owned)
 *
 * Purpose:
 * This service defines the orchestration boundary for AI execution.
 * It selects and instantiates adapters based on request.provider field.
 *
 * Design:
 * - Provider-agnostic orchestration
 * - Per-request adapter selection (Phase 28)
 * - Adapter pattern for execution delegation
 * - No direct SDK dependencies
 * - Synchronous observability logging (Phase 17A/17B)
 */
@Injectable()
export class AIExecutionService {
  private readonly logger = new Logger(AIExecutionService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Execute AI request
   *
   * Phase 28: Adapter selected per-request based on request.provider
   * Phase 17B: Adds observability logging
   *
   * @param request - AI execution request (must include provider)
   * @returns AI execution result from adapter
   */
  async execute(request: AIExecutionRequest): Promise<AIExecutionResult> {
    // Phase 17B: Generate unique executionId
    const executionId = randomUUID();
    const executionStartTime = performance.now();

    // Phase 28: Validate provider is present
    if (
      typeof request.provider !== 'string' ||
      request.provider.trim().length === 0
    ) {
      throw new BadRequestException(
        'Provider field is required in execution request',
      );
    }

    const selection = this.resolveProviderModelOrThrow(
      request.provider,
      request.model,
    );
    const adapter = this.getAdapter(selection.provider, selection.model);
    const provider = selection.provider;
    const executionModel = selection.model;

    // Phase 17B: Log execution entry signal (structured)
    this.logger.log({
      signal: 'execution.entry',
      executionId,
      adapter: provider,
      provider,
      model: executionModel,
      sessionId: request.sessionId,
      userId: request.userId,
      conversationId: request.conversationId,
      timestamp: new Date().toISOString(),
    });

    // Maintain backward compatibility with existing debug logs
    this.logger.debug(
      `Executing AI request via adapter (model=${executionModel}, provider=${provider}, session=${request.sessionId})`,
    );

    const adapterStartTime = performance.now();
    try {
      const result = await adapter.execute({
        ...request,
        provider,
        model: executionModel,
        signal: request.signal,
      });
      const parsed = extractFileActionsFromOutput(result.output ?? '');
      const normalizedResult: AIExecutionResult = {
        ...result,
        provider,
        output: parsed.textOutput,
        fileActions: parsed.fileActions,
        parseMethod: parsed.parseMethod,
        workspaceMutationAttempted: parsed.workspaceMutationAttempted,
      };
      const adapterDurationMs = Math.round(
        performance.now() - adapterStartTime,
      );
      observeProviderLatency(adapterDurationMs / 1000);

      // Calculate total execution time
      const totalDurationMs = Math.round(performance.now() - executionStartTime);

      // Phase 17B: Log execution exit success signal
      this.logger.log({
        signal: 'execution.exit.success',
        executionId,
        adapter: provider,
        provider,
        model: normalizedResult.model,
        tokensUsed: normalizedResult.tokensUsed,
        durationMs: totalDurationMs,
        adapterDurationMs,
        outcome: 'success',
        sessionId: request.sessionId,
        userId: request.userId,
        conversationId: request.conversationId,
        timestamp: new Date().toISOString(),
      });

      return normalizedResult;
    } catch (error) {
      const adapterDurationMs = Math.round(
        performance.now() - adapterStartTime,
      );
      observeProviderLatency(adapterDurationMs / 1000);

      // Calculate total execution time before failure
      const totalDurationMs = Math.round(performance.now() - executionStartTime);

      // Phase 17B: Log execution exit failure signal
      this.logger.error({
        signal: 'execution.exit.failure',
        executionId,
        adapter: provider,
        provider,
        model: executionModel,
        errorType: error?.constructor?.name || 'Error',
        errorCategory: this.categorizeError(error),
        errorMessage: error?.message,
        durationMs: totalDurationMs,
        outcome: 'failure',
        sessionId: request.sessionId,
        userId: request.userId,
        conversationId: request.conversationId,
        timestamp: new Date().toISOString(),
      });

      // Re-throw exception unchanged (Phase 15A: throw-only semantics)
      throw error;
    }
  }

  /**
   * Phase 28: Get adapter instance based on provider
   *
   * Instantiates adapter with API key from ConfigService.
   * Provider selection is caller-owned (comes from request).
   * ai-service MUST NOT guess or infer provider.
   *
   * @param provider - Provider name from request
   * @returns Adapter instance
   * @throws ServiceUnavailableException if provider unknown
   * @throws Error if API key missing for non-stub provider
   */
  getAdapter(
    provider: AIExecutionRequest['provider'] | string,
    resolvedModel?: string,
  ): AIAdapter {
    const selection = this.resolveProviderModelOrThrow(provider, resolvedModel);

    switch (selection.provider) {
      case 'stub':
        return new StubAIAdapter();

      case 'anthropic': {
        const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
        if (!apiKey || apiKey.trim().length === 0) {
          throw new Error(
            'ANTHROPIC_API_KEY environment variable is required when provider is "anthropic"',
          );
        }
        return new AnthropicAdapter(apiKey, {
          model: selection.model,
        });
      }

      case 'openai': {
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');
        if (!apiKey || apiKey.trim().length === 0) {
          throw new Error(
            'OPENAI_API_KEY environment variable is required when provider is "openai"',
          );
        }
        return new OpenAIAdapter(apiKey, {
          model: selection.model,
        });
      }

      case 'groq': {
        const apiKey = this.configService.get<string>('GROQ_API_KEY');
        if (!apiKey || apiKey.trim().length === 0) {
          throw new Error(
            'GROQ_API_KEY environment variable is required when provider is "groq"',
          );
        }
        return new GroqAdapter(apiKey, {
          model: selection.model,
        });
      }

      case 'xai': {
        const apiKey = this.configService.get<string>('XAI_API_KEY');
        if (!apiKey || apiKey.trim().length === 0) {
          throw new Error(
            'XAI_API_KEY environment variable is required when provider is "xai"',
          );
        }
        return new XAIAdapter(apiKey, {
          model: selection.model,
        });
      }

      case 'deepseek': {
        const apiKey = this.configService.get<string>('DEEPSEEK_API_KEY');
        if (!apiKey || apiKey.trim().length === 0) {
          throw new Error(
            'DEEPSEEK_API_KEY environment variable is required when provider is "deepseek"',
          );
        }
        return new DeepSeekAdapter(apiKey, {
          model: selection.model,
        });
      }

      case 'test-harness-stub':
        return new TestToolCapableStubAdapter();

      default:
        throw new ServiceUnavailableException(
          `Unknown AI provider: ${provider}. Supported providers: stub, anthropic, openai, groq, xai, deepseek, test-harness-stub`,
        );
    }
  }

  private resolveProviderModelOrThrow(
    provider: unknown,
    model: unknown,
  ): { provider: AIExecutionRequest['provider']; model: string } {
    try {
      const selection = resolveProviderModelSelection({
        provider,
        model,
        anthropicModel: this.configService.get<string>('ANTHROPIC_MODEL'),
      });
      return {
        provider: selection.provider,
        model: selection.model,
      };
    } catch (error) {
      if (error instanceof ProviderModelValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * Phase 17B: Categorize error into Phase 15C failure taxonomy
   *
   * Maps exception types to failure categories:
   * - validation: Request is malformed (BadRequestException)
   * - provider: Provider API error (InternalServerErrorException)
   * - rate_limit: Rate limiting (ServiceUnavailableException with rate limit message)
   * - timeout: Request timeout (ServiceUnavailableException with timeout message)
   * - unknown: Unexpected failures
   */
  private categorizeError(error: any): string {
    // Phase 15C: validation category
    if (error instanceof BadRequestException) {
      return 'validation';
    }

    // Phase 15C: rate_limit or timeout category
    if (error instanceof ServiceUnavailableException) {
      const message = error?.message?.toLowerCase() || '';
      if (message.includes('rate limit')) {
        return 'rate_limit';
      }
      if (message.includes('timeout')) {
        return 'timeout';
      }
      // ServiceUnavailableException without specific message → provider
      return 'provider';
    }

    // Phase 15C: provider category
    if (error instanceof InternalServerErrorException) {
      return 'provider';
    }

    // Phase 15C: unknown category (fallback)
    return 'unknown';
  }
}
