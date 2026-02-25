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
 * Records usage to ledger on success (Phase 22B).
 * Forwards requests to ai-service with verified identity.
 *
 * NO business logic, NO retries, NO transformations.
 * Pure passthrough to ai-service with identity injection and usage recording.
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
   * - Usage recorded to ledger after success (unless idempotent retry)
   *
   * Accepts AIExecutionRequest (userId will be replaced)
   * Returns AIExecutionResult on success
   * Throws 401 on authentication failure
   * Throws 403 on authorization failure, launch state restriction, or token quota exceeded
   * Throws 400 on invalid request (e.g., max_tokens too high, invalid Idempotency-Key)
   * Throws 429 on rate limit exceeded
   * Throws 503 on kill switch disabled, safety limit reached, or abort mode active
   * Throws 500 on ledger write failure
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
    // Phase 43A-2C: Check for idempotent result (set by IdempotencyGuard)
    // If present, return immediately without calling AI provider or writing ledger
    if (req && (req as any).idempotentResult) {
      return (req as any).idempotentResult as AIExecutionResult;
    }

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
    const result = await this.aiServiceHttpClient.execute(verifiedRequest);

    // Phase 22B: Calculate execution duration
    const executionDurationMs = Date.now() - startTime;

    // Phase 22B: Write usage record to ledger (success-only)
    // Phase 43A-2B: Include requestId for idempotent retries
    // Write occurs AFTER ai-service success, BEFORE client response
    // If write fails, entire request fails (throw)
    await this.usageLedgerService.writeRecord({
      apiKeyId: identity.apiKeyId,
      userId: identity.userId,
      sessionId: request.sessionId,
      conversationId: request.conversationId,
      provider: verifiedRequest.provider, // Phase 28: Use explicit provider
      adapter: verifiedRequest.provider, // Phase 28: Adapter matches provider
      model: result.model,
      tokensUsed: result.tokensUsed,
      executionDurationMs,
      requestId, // Phase 43A-2B: Optional idempotency key
    });

    // Phase 26B: Track execution cost for daily spend limit
    // Conservative estimate: $0.01 per 1000 tokens (matches billing pricing)
    const estimatedCostUSD = (result.tokensUsed / 1000) * 0.01;
    this.globalSafetyLimitService.recordExecutionCost(estimatedCostUSD);

    // Return result to client (after ledger write succeeds)
    return result;
  }
}
