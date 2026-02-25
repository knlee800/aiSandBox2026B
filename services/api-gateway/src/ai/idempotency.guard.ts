import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { UsageLedgerService } from '../usage-ledger/usage-ledger.service';
import { ApiKeyIdentity } from '../auth/api-key.config';
import { AIExecutionResult } from '../clients/ai-service-http.client';

/**
 * IdempotencyGuard
 *
 * PHASE-43A-2C: Idempotency Short-Circuit BEFORE Quota (Retry-Safe)
 *
 * Ensures that retrying a completed AI execution with the same Idempotency-Key
 * returns the prior response WITHOUT consuming quota or calling the AI provider.
 *
 * Execution Order (CRITICAL):
 * ApiKeyAuthGuard → AuthorizationGuard → ExecutionSafetyGuard → LaunchGuard → 
 * AbortGuard → **IdempotencyGuard** → QuotaGuard → TokenQuotaGuard → RateLimitGuard → Controller
 *
 * Logic:
 * 1. If Idempotency-Key header is NOT present:
 *    - Allow normal flow (no short-circuit)
 * 2. If Idempotency-Key header IS present:
 *    a. Validate and normalize key (trim, check length)
 *    b. Query usage_records for existing record: (user_id, request_id)
 *    c. If existing record found:
 *       - Reconstruct AIExecutionResult from stored metadata
 *       - Attach to request object for controller to return
 *       - Short-circuit: STOP (no quota check, no provider call, no ledger write)
 *    d. If no existing record:
 *       - Allow normal flow (quota check, provider call, ledger write)
 *
 * Deterministic Behavior:
 * - Same (userId, requestId) → same response
 * - No quota consumed on retry
 * - No second ledger write
 * - No AI provider call
 *
 * Response Reconstruction:
 * Since usage_records does NOT store output text, we reconstruct a minimal
 * AIExecutionResult with metadata only:
 * {
 *   output: "[Duplicate request - original response not stored]",
 *   tokensUsed: <from usage_records>,
 *   model: <from usage_records>
 * }
 *
 * This is deterministic and safe, though not ideal. Future phases may add
 * response caching if needed.
 *
 * IMPORTANT:
 * - Requires ApiKeyAuthGuard to run first (attaches user identity)
 * - Must run BEFORE TokenQuotaGuard (to prevent quota blocking retries)
 * - No schema changes (uses existing usage_records table)
 * - Minimal/additive only (no refactors)
 */
@Injectable()
export class IdempotencyGuard implements CanActivate {
  constructor(private readonly usageLedgerService: UsageLedgerService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Extract Idempotency-Key header
    const idempotencyKey = request.headers['idempotency-key'];

    // If no Idempotency-Key, allow normal flow
    if (!idempotencyKey) {
      return true;
    }

    // Normalize and validate idempotency key
    const normalized = idempotencyKey.trim();

    if (normalized.length === 0) {
      // Invalid key - let controller handle validation
      return true;
    }

    if (normalized.length > 100) {
      // Invalid key - let controller handle validation
      return true;
    }

    // Get verified identity (attached by ApiKeyAuthGuard)
    const identity = request.apiKeyIdentity as ApiKeyIdentity;

    if (!identity || !identity.userId) {
      // Auth guard should have caught this, but fail-safe
      throw new HttpException(
        'Idempotency check failed: missing identity',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Check for existing execution by (userId, requestId)
    const existingRecord = await this.usageLedgerService.findByRequestId(
      identity.userId,
      normalized,
    );

    // If no existing record, allow normal flow
    if (!existingRecord) {
      return true;
    }

    // Existing record found - reconstruct response and short-circuit
    // Since usage_records does NOT store output text, we return a deterministic
    // placeholder response with metadata from the original execution
    const reconstructedResult: AIExecutionResult = {
      output: '[Duplicate request - original response not stored]',
      tokensUsed: existingRecord.tokensUsed,
      model: existingRecord.model,
    };

    // Attach reconstructed result to request for controller to return
    // This signals to the controller that the request was already processed
    request.idempotentResult = reconstructedResult;

    // Short-circuit: return true to allow controller execution
    // Controller will detect idempotentResult and return it immediately
    return true;
  }
}
