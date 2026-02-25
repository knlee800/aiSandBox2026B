import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Headers,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  AIServiceHttpClient,
  AIExecutionRequest,
  AIExecutionResult,
} from '../clients/ai-service-http.client';
import { ApiKeyAuthGuard } from '../auth/api-key-auth.guard';
import { AuthorizationGuard } from '../auth/authorization.guard';
import { QuotaGuard } from '../quota/quota.guard';
import { TokenQuotaGuard } from '../quota/token-quota.guard';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator';
import { RequireScope } from '../auth/decorators/require-scope.decorator';
import { ApiKeyIdentity } from '../auth/api-key.config';
import { UsageLedgerService } from '../usage-ledger/usage-ledger.service';
import { ExecutionSafetyGuard } from '../safety/execution-safety.guard';
import { GlobalSafetyLimitService } from '../safety/global-safety-limit.service';
import { LaunchGuard } from '../launch/launch.guard';
import { AbortGuard } from '../abort/abort.guard';
import { RateLimitGuard, RateLimit } from '../guards/rate-limit.guard';
import { IdempotencyGuard } from './idempotency.guard';
import { v4 as uuidv4 } from 'uuid';

/**
 * AIExecutionController
 *
 * Phase 18A: API Gateway Execution Controller
 * Phase 20A: API key authentication enforcement
 * Phase 20B: Scope-based authorization enforcement
 * Phase 21B: Quota and rate-limiting enforcement
 * Phase 22B: Usage ledger recording
 * Phase 26B: Production readiness (kill switches + safety limits)
 * Phase 28B-1: Launch state enforcement
 * Phase 28B-2: Abort mode enforcement
 * Phase 42A-3: Token quota enforcement (rolling 24h)
 * Phase 43A-2B: Idempotency via Idempotency-Key header
 * Phase 43A-2C: Idempotency short-circuit BEFORE quota (retry-safe)
 * Phase 43B-2: Two-phase execution record (write-before-call)
 *
 * Exposes POST /api/ai/execute endpoint.
 * Requires API key authentication (Phase 20A).
 * Requires 'ai:execute' scope authorization (Phase 20B).
 * Enforces kill switches and global safety limits (Phase 26B).
 * Enforces launch state restrictions (Phase 28B-1).
 * Enforces abort mode restrictions (Phase 28B-2).
 * Checks idempotency BEFORE quota (Phase 43A-2C).
 * Requires quota availability (Phase 21B).
 * Enforces token quota (Phase 42A-3).
 * Records execution intent BEFORE ai-service call (Phase 43B-2B).
 * Updates execution result AFTER ai-service success (Phase 43B-2C).
 * Forwards requests to ai-service with verified identity.
 *
 * NO business logic, NO retries, NO transformations.
 * Pure passthrough to ai-service with identity injection and two-phase usage recording.
 */
@Controller('ai')
export class AIExecutionController {
  constructor(
    private readonly aiServiceHttpClient: AIServiceHttpClient,
    private readonly usageLedgerService: UsageLedgerService,
    private readonly globalSafetyLimitService: GlobalSafetyLimitService,
  ) {}

  /**
   * Execute AI request
   *
   * POST /api/ai/execute
   *
   * Phase 20A: Requires API key authentication
   * Phase 20B: Requires 'ai:execute' scope authorization
   * Phase 26B: Enforces kill switches and global safety limits
   * Phase 28B-1: Enforces launch state restrictions
   * Phase 28B-2: Enforces abort mode restrictions
   * Phase 43A-2C: Checks idempotency BEFORE quota (retry-safe)
   * Phase 21B: Requires quota availability
   * Phase 42A-3: Enforces token quota (rolling 24h)
   * Phase 22B: Records usage to ledger on success
   * Phase 43B-2B: Writes execution intent BEFORE ai-service call
   * Phase 43B-2C: Updates execution result AFTER ai-service success
   * Phase 41B: Rate limited to 20 requests per minute per IP
   * Phase 43A-2B: Accepts optional Idempotency-Key header for idempotent retries
   * - Authorization header: Bearer <api-key>
   * - Idempotency-Key header (optional): Client-provided idempotency key (max 100 chars)
   * - API key validated by ApiKeyAuthGuard
   * - Scope validated by AuthorizationGuard
   * - Kill switches and safety limits enforced by ExecutionSafetyGuard
   * - Launch state enforced by LaunchGuard
   * - Abort mode enforced by AbortGuard
   * - Idempotency checked by IdempotencyGuard (Phase 43A-2C) - BEFORE quota
   * - Quota validated by QuotaGuard (legacy Phase 21B)
   * - Token quota validated by TokenQuotaGuard (Phase 42A-3)
   * - Rate limit enforced by RateLimitGuard
   * - Verified userId injected into request
   * - apiKeyId added to metadata
   * - Execution intent written BEFORE ai-service call (Phase 43B-2B)
   * - Execution result updated AFTER ai-service success (Phase 43B-2C)
   *
   * Accepts AIExecutionRequest (userId will be replaced)
   * Returns AIExecutionResult on success
   * Throws 401 on authentication failure
   * Throws 403 on authorization failure, launch state restriction, or token quota exceeded
   * Throws 400 on invalid request (e.g., max_tokens too high, invalid Idempotency-Key)
   * Throws 409 on concurrent execution with same Idempotency-Key (Phase 43B-2C)
   * Throws 429 on rate limit exceeded
   * Throws 503 on kill switch disabled, safety limit reached, or abort mode active
   * Throws 500 on ledger write failure or execution intent write failure
   * Propagates ai-service exceptions unchanged on execution failure
   */
  @Post('execute')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyAuthGuard, AuthorizationGuard, ExecutionSafetyGuard, LaunchGuard, AbortGuard, IdempotencyGuard, QuotaGuard, TokenQuotaGuard, RateLimitGuard)
  @RequireScope('ai:execute')
  @RateLimit({ maxRequests: 20, windowMs: 60000 })
  async execute(
    @Body() request: AIExecutionRequest,
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Req() req?: Request,
  ): Promise<AIExecutionResult> {
    // Phase 43B-2-HOTFIX: IdempotencyGuard now throws IdempotentReplayException
    // instead of attaching to request. No need to check req.idempotentResult.
    // If we reach here, it's NOT a replay (or replay was for 'timeout'/'failed' status).

    // Phase 43A-2B: Validate and normalize idempotency key
    let requestId: string | undefined;
    if (idempotencyKey !== undefined) {
      // Normalize: trim whitespace
      const normalized = idempotencyKey.trim();
      
      // Validate: must not be empty
      if (normalized.length === 0) {
        throw new BadRequestException('Idempotency-Key must not be empty');
      }
      
      // Validate: must not exceed 100 characters (matches DB constraint)
      if (normalized.length > 100) {
        throw new BadRequestException('Idempotency-Key must not exceed 100 characters');
      }
      
      requestId = normalized;
    }

    // Phase 22B: Start timing execution
    const startTime = Date.now();

    // Phase 28: Determine AI provider from environment
    // api-gateway owns provider selection; ai-service MUST NOT guess
    const provider = (process.env.AI_PROVIDER || 'stub') as AIExecutionRequest['provider'];

    // Phase 43B-2B: Generate execution ID (for two-phase write)
    const executionId = uuidv4();

    // Phase 43B-2B: Write execution intent BEFORE ai-service call
    // This ensures we have a record even if network/DB fails after AI success
    // Status: 'pending' (model, tokensUsed, executionDurationMs are NULL)
    await this.usageLedgerService.writeExecutionIntent({
      executionId,
      apiKeyId: identity.apiKeyId,
      userId: identity.userId,
      sessionId: request.sessionId,
      conversationId: request.conversationId,
      provider,
      adapter: provider, // Phase 28: Adapter matches provider
      requestId, // Phase 43A-2B: Optional idempotency key
      metadata: {
        ...request.metadata,
        apiKeyId: identity.apiKeyId, // INJECTED for audit
      },
    });

    // Phase 20A: Replace untrusted userId with verified userId
    const verifiedRequest: AIExecutionRequest = {
      ...request,
      userId: identity.userId, // REPLACED with verified identity
      provider, // Phase 28: Explicit provider selection
      metadata: {
        ...request.metadata,
        apiKeyId: identity.apiKeyId, // INJECTED for audit
      },
    };

    // Forward to ai-service with verified identity
    // If this fails, execution intent remains 'pending' (will be cleaned up by cron)
    const result = await this.aiServiceHttpClient.execute(verifiedRequest);

    // Phase 22B: Calculate execution duration
    const executionDurationMs = Date.now() - startTime;

    // Phase 43B-2C: Update execution record with result (status: 'completed')
    // Phase 43B-3: Store full AIExecutionResult in metadata for deterministic replay
    // This transitions from 'pending' → 'completed'
    // If this fails, execution intent remains 'pending' but AI execution succeeded
    // (CRITICAL: This is the failure mode we're protecting against)
    await this.usageLedgerService.updateExecutionResult({
      executionId,
      model: result.model,
      tokensUsed: result.tokensUsed,
      executionDurationMs,
      executionStatus: 'completed',
      output: result.output, // Phase 43B-3: Store output for deterministic replay
    });

    // Phase 26B: Track execution cost for daily spend limit
    // Conservative estimate: $0.01 per 1000 tokens (matches billing pricing)
    const estimatedCostUSD = (result.tokensUsed / 1000) * 0.01;
    this.globalSafetyLimitService.recordExecutionCost(estimatedCostUSD);

    // Return result to client (after execution result update succeeds)
    return result;
  }
}
