import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  AIServiceHttpClient,
  AIExecutionRequest,
  AIExecutionResult,
} from '../clients/ai-service-http.client';
import { ApiKeyAuthGuard } from '../auth/api-key-auth.guard';
import { AuthorizationGuard } from '../auth/authorization.guard';
import { QuotaGuard } from '../quota/quota.guard';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator';
import { RequireScope } from '../auth/decorators/require-scope.decorator';
import { ApiKeyIdentity } from '../auth/api-key.config';
import { UsageLedgerService } from '../usage-ledger/usage-ledger.service';
import { ExecutionSafetyGuard } from '../safety/execution-safety.guard';
import { GlobalSafetyLimitService } from '../safety/global-safety-limit.service';
import { LaunchGuard } from '../launch/launch.guard';
import { AbortGuard } from '../abort/abort.guard';

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
 *
 * Exposes POST /api/ai/execute endpoint.
 * Requires API key authentication (Phase 20A).
 * Requires 'ai:execute' scope authorization (Phase 20B).
 * Enforces kill switches and global safety limits (Phase 26B).
 * Enforces launch state restrictions (Phase 28B-1).
 * Enforces abort mode restrictions (Phase 28B-2).
 * Requires quota availability (Phase 21B).
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
   * Phase 21B: Requires quota availability
   * Phase 22B: Records usage to ledger on success
   * - Authorization header: Bearer <api-key>
   * - API key validated by ApiKeyAuthGuard
   * - Scope validated by AuthorizationGuard
   * - Kill switches and safety limits enforced by ExecutionSafetyGuard
   * - Launch state enforced by LaunchGuard
   * - Abort mode enforced by AbortGuard
   * - Quota validated by QuotaGuard
   * - Verified userId injected into request
   * - apiKeyId added to metadata
   * - Usage recorded to ledger after success
   *
   * Accepts AIExecutionRequest (userId will be replaced)
   * Returns AIExecutionResult on success
   * Throws 401 on authentication failure
   * Throws 403 on authorization failure or launch state restriction
   * Throws 400 on invalid request (e.g., max_tokens too high)
   * Throws 429 on rate limit exceeded
   * Throws 503 on kill switch disabled, safety limit reached, or abort mode active
   * Throws 500 on ledger write failure
   * Propagates ai-service exceptions unchanged on execution failure
   */
  @Post('execute')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyAuthGuard, AuthorizationGuard, ExecutionSafetyGuard, LaunchGuard, AbortGuard, QuotaGuard)
  @RequireScope('ai:execute')
  async execute(
    @Body() request: AIExecutionRequest,
    @AuthenticatedUser() identity: ApiKeyIdentity,
  ): Promise<AIExecutionResult> {
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
    });

    // Phase 26B: Track execution cost for daily spend limit
    // Conservative estimate: $0.01 per 1000 tokens (matches billing pricing)
    const estimatedCostUSD = (result.tokensUsed / 1000) * 0.01;
    this.globalSafetyLimitService.recordExecutionCost(estimatedCostUSD);

    // Return result to client (after ledger write succeeds)
    return result;
  }
}
