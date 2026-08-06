import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';
import { ApiKeyAuthGuard } from '../auth/api-key-auth.guard';
import { AuthorizationGuard } from '../auth/authorization.guard';
import { RequireScope } from '../auth/decorators/require-scope.decorator';
import { QuotaGuard } from '../quota/quota.guard';
import { TokenQuotaGuard } from '../quota/token-quota.guard';
import { ExecutionSafetyGuard } from '../safety/execution-safety.guard';
import { LaunchGuard } from '../launch/launch.guard';
import { AbortGuard } from '../abort/abort.guard';
import { IdempotencyGuard } from '../ai/idempotency.guard';
import { CreditBalanceGuard } from '../billing/credit-balance.guard';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator';
import { type ApiKeyIdentity } from '../auth/api-key.config';
import { UsageLedgerService } from '../usage-ledger/usage-ledger.service';
import { QueueService } from '../queue/queue.service';
import { ExecutionResultService } from '../ai/execution-result.service';
import {
  PublicApiRateLimit,
  PublicApiRateLimitGuard,
} from './public-api-rate-limit.guard';
import { AIExecutionRequest } from '../clients/ai-service-http.client';
import {
  GatewayAIProvider,
  GatewayProviderModelValidationError,
  normalizeModelInput,
  resolveGatewayProviderModelSelection,
} from '../ai/provider-model.catalogue';

@Controller('v1/ai')
@UseGuards(ApiKeyAuthGuard, PublicApiRateLimitGuard)
export class PublicAIController {
  constructor(
    private readonly usageLedgerService: UsageLedgerService,
    private readonly queueService: QueueService,
    private readonly executionResultService: ExecutionResultService,
  ) {}

  private resolveProviderAndModel(
    requestProvider: unknown,
    requestModel: unknown,
  ): {
    provider: GatewayAIProvider;
    resolvedModel: string;
    requestedModel: string | undefined;
  } {
    const requestedModel = normalizeModelInput(requestModel);
    try {
      const selection = resolveGatewayProviderModelSelection({
        provider: requestProvider,
        model: requestModel,
        fallbackProviderEnv: process.env.AI_PROVIDER,
        anthropicModel: process.env.ANTHROPIC_MODEL,
      });
      return {
        provider: selection.provider,
        resolvedModel: selection.model,
        requestedModel,
      };
    } catch (error) {
      if (error instanceof GatewayProviderModelValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Post('execute')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(
    AuthorizationGuard,
    ExecutionSafetyGuard,
    LaunchGuard,
    AbortGuard,
    IdempotencyGuard,
    CreditBalanceGuard,
    QuotaGuard,
    TokenQuotaGuard,
  )
  @RequireScope('ai:execute')
  @PublicApiRateLimit({ maxRequests: 20, windowMs: 60000 })
  async execute(
    @Body() request: AIExecutionRequest,
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Req() _req?: Request,
  ): Promise<{ executionId: string; status: string }> {
    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new BadRequestException('prompt is required');
    }
    if (!request.sessionId || request.sessionId.trim().length === 0) {
      throw new BadRequestException('sessionId is required');
    }
    if (!request.conversationId || request.conversationId.trim().length === 0) {
      throw new BadRequestException('conversationId is required');
    }

    let requestId: string | undefined;
    if (idempotencyKey !== undefined) {
      const normalized = idempotencyKey.trim();
      if (normalized.length === 0) {
        throw new BadRequestException('Idempotency-Key must not be empty');
      }
      if (normalized.length > 100) {
        throw new BadRequestException('Idempotency-Key must not exceed 100 characters');
      }
      requestId = normalized;
    }

    const {
      provider,
      resolvedModel,
      requestedModel,
    } = this.resolveProviderAndModel(request.provider, request.model);
    const executionId = uuidv4();

    await this.usageLedgerService.writeExecutionIntent({
      executionId,
      apiKeyId: identity.apiKeyId,
      userId: identity.userId,
      sessionId: request.sessionId,
      conversationId: request.conversationId,
      provider,
      adapter: provider,
      requestId,
      metadata: {
        promptLength: request.prompt.length,
        source: 'public-api-v1',
        requestedProvider: provider,
        requestedModel,
      },
    });

    await this.queueService.enqueueExecution({
      executionId,
      apiKeyId: identity.apiKeyId,
      userId: identity.userId,
      sessionId: request.sessionId,
      conversationId: request.conversationId,
      prompt: request.prompt,
      provider,
      adapter: provider,
      model: resolvedModel,
      metadata: request.metadata,
    });

    return {
      executionId,
      status: 'queued',
    };
  }

  @Get('executions/:executionId')
  @HttpCode(HttpStatus.OK)
  @PublicApiRateLimit({ maxRequests: 60, windowMs: 60000 })
  async getExecution(
    @Param('executionId') executionId: string,
    @AuthenticatedUser() identity: ApiKeyIdentity,
  ): Promise<{
    executionId: string;
    status: string;
    output?: string;
    provider?: string;
    model?: string;
    tokensUsed?: number;
  }> {
    const record = await this.executionResultService.getExecution(executionId);
    if (!record) {
      throw new NotFoundException(`Execution ${executionId} not found`);
    }
    if (record.user_id !== identity.userId) {
      throw new NotFoundException(`Execution ${executionId} not found`);
    }

    const metadata =
      record.metadata && typeof record.metadata === 'object'
        ? (record.metadata as Record<string, unknown>)
        : null;
    const aiExecutionResult =
      metadata && typeof metadata.aiExecutionResult === 'object'
        ? (metadata.aiExecutionResult as Record<string, unknown>)
        : null;
    const output =
      aiExecutionResult && typeof aiExecutionResult.output === 'string'
        ? aiExecutionResult.output
        : undefined;
    const provider =
      aiExecutionResult && typeof aiExecutionResult.provider === 'string'
        ? aiExecutionResult.provider
        : record.provider ?? undefined;
    const model =
      aiExecutionResult && typeof aiExecutionResult.model === 'string'
        ? aiExecutionResult.model
        : record.model ?? undefined;

    return {
      executionId: record.execution_id,
      status: record.execution_status,
      output,
      provider,
      model,
      tokensUsed:
        typeof record.tokens_used === 'number' ? (record.tokens_used as number) : undefined,
    };
  }
}
