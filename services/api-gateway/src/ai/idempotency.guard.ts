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
import { IdempotentReplayException } from './idempotent-replay.exception';

/**
 * IdempotencyGuard
 *
 * PHASE-43A-2C: Idempotency Short-Circuit BEFORE Quota (Retry-Safe)
 * PHASE-43B-2C: Handle 'pending' status records (execution in progress)
 * PHASE-43B-2-HOTFIX: Throw IdempotentReplayException to bypass quota guards
 * PHASE-43B-3: Deterministic replay body persistence (read from metadata)
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
 *       - If status = 'completed': THROW IdempotentReplayException (short-circuit)
 *       - If status = 'pending': Return 409 Conflict (execution in progress)
 *       - If status = 'timeout': Allow retry (original execution abandoned)
 *       - If status = 'failed': Allow retry (original execution failed)
 *    d. If no existing record:
 *       - Allow normal flow (quota check, provider call, ledger write)
 *
 * Deterministic Behavior:
 * - Same (userId, requestId) with status 'completed' → IdempotentReplayException → HTTP 200
 * - Same (userId, requestId) with status 'pending' → 409 Conflict
 * - No quota consumed on replay (QuotaGuard/TokenQuotaGuard NOT invoked)
 * - No second ledger write on replay
 * - No AI provider call on replay
 *
 * Response Reconstruction (Phase 43B-3):
 * Reads full AIExecutionResult from metadata.aiExecutionResult:
 * {
 *   output: <original AI output>,
 *   tokensUsed: <from usage_records>,
 *   model: <from usage_records>
 * }
 *
 * Fallback (if metadata.aiExecutionResult not present):
 * {
 *   output: "[Duplicate request - original response not stored]",
 *   tokensUsed: <from usage_records>,
 *   model: <from usage_records>
 * }
 *
 * HOTFIX (Phase 43B-2):
 * - Throws IdempotentReplayException instead of attaching to request
 * - Exception terminates guard pipeline (QuotaGuard/TokenQuotaGuard NOT invoked)
 * - IdempotentReplayExceptionFilter catches and returns HTTP 200 with result
 *
 * IMPORTANT:
 * - Requires ApiKeyAuthGuard to run first (attaches user identity)
 * - Must run BEFORE TokenQuotaGuard (to prevent quota blocking retries)
 * - Phase 43B-2C: Handles 'pending' status (execution in progress)
 * - Phase 43B-2-HOTFIX: Throws exception to bypass quota guards
 * - Phase 43B-3: Reads full result from metadata for deterministic replay
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

    // Phase 43B-2C: Handle execution status
    const status = existingRecord.executionStatus;

    if (status === 'completed') {
      // Existing completed record found - reconstruct response and short-circuit
      
      // Phase 43B-3: Read full AIExecutionResult from metadata for deterministic replay
      let reconstructedResult: AIExecutionResult;
      
      if (existingRecord.metadata?.aiExecutionResult) {
        // Deterministic replay: return EXACT original response
        reconstructedResult = {
          output: existingRecord.metadata.aiExecutionResult.output,
          tokensUsed: existingRecord.metadata.aiExecutionResult.tokensUsed,
          model: existingRecord.metadata.aiExecutionResult.model,
        };
      } else {
        // Fallback for records created before Phase 43B-3
        // (Should not happen for new executions)
        reconstructedResult = {
          output: '[Duplicate request - original response not stored]',
          tokensUsed: existingRecord.tokensUsed!,
          model: existingRecord.model!,
        };
      }

      // HOTFIX (Phase 43B-2): Throw IdempotentReplayException to bypass quota guards
      // This terminates the guard pipeline immediately, preventing QuotaGuard/TokenQuotaGuard
      // from running. IdempotentReplayExceptionFilter catches this and returns HTTP 200.
      throw new IdempotentReplayException(reconstructedResult);
    } else if (status === 'pending') {
      // Execution in progress - return 409 Conflict
      // Client should retry later or poll for completion
      throw new HttpException(
        {
          statusCode: HttpStatus.CONFLICT,
          message: 'Execution in progress',
          error: 'Conflict',
          details: {
            executionId: existingRecord.executionId,
            requestId: normalized,
            status: 'pending',
            hint: 'Another request with the same Idempotency-Key is currently being processed. Please retry in a few seconds.',
          },
        },
        HttpStatus.CONFLICT,
      );
    } else if (status === 'timeout' || status === 'failed') {
      // Original execution abandoned or failed - allow retry
      // Client can retry with same Idempotency-Key (will create new execution)
      // Note: This allows retry but does NOT delete the old record
      // The old record remains for audit purposes
      return true;
    } else {
      // Unknown status - fail-safe: allow normal flow
      // Log warning for investigation
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Unknown execution status',
          error: 'Internal Server Error',
          details: {
            executionId: existingRecord.executionId,
            requestId: normalized,
            status,
            hint: 'Unexpected execution status. Please contact support.',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
