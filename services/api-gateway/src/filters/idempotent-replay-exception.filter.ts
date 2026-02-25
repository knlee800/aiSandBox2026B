import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { IdempotentReplayException } from '../ai/idempotent-replay.exception';

/**
 * IdempotentReplayExceptionFilter
 *
 * PHASE-43B-2-HOTFIX: Idempotent Replay Must Bypass Quota Guards
 *
 * Global exception filter that catches IdempotentReplayException thrown by
 * IdempotencyGuard and returns HTTP 200 with the cached AIExecutionResult.
 *
 * Purpose:
 * - Terminate guard pipeline BEFORE QuotaGuard/TokenQuotaGuard
 * - Return cached result without evaluating quota
 * - Preserve idempotency invariant (replay does NOT consume quota)
 *
 * Behavior:
 * - Catches IdempotentReplayException
 * - Returns HTTP 200 OK
 * - Response body is the embedded AIExecutionResult (exact shape, no wrapping)
 * - Does NOT alter response structure
 *
 * Invariants Preserved:
 * - Replay does NOT evaluate quota (QuotaGuard/TokenQuotaGuard NOT invoked)
 * - Replay does NOT call AI provider
 * - Replay does NOT write ledger
 * - Replay returns cached result deterministically
 */
@Catch(IdempotentReplayException)
export class IdempotentReplayExceptionFilter implements ExceptionFilter {
  catch(exception: IdempotentReplayException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Return HTTP 200 with cached AIExecutionResult
    // Do NOT wrap or alter the response shape
    response.status(HttpStatus.OK).json(exception.result);
  }
}
