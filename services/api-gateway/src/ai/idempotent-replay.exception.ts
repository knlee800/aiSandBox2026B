import { AIExecutionResult } from '../clients/ai-service-http.client';

/**
 * IdempotentReplayException
 *
 * PHASE-43B-2-HOTFIX: Idempotent Replay Must Bypass Quota Guards
 *
 * Custom exception thrown by IdempotencyGuard when a completed execution
 * is replayed with the same Idempotency-Key.
 *
 * Purpose:
 * - Short-circuit guard pipeline BEFORE QuotaGuard/TokenQuotaGuard
 * - Prevent replay from evaluating quota (preserve invariant)
 * - Carry cached AIExecutionResult for response
 *
 * Handling:
 * - Caught by IdempotentReplayExceptionFilter (global filter)
 * - Returns HTTP 200 with embedded AIExecutionResult
 * - Does NOT wrap/alter response shape (returns exact AIExecutionResult)
 *
 * Invariants Preserved:
 * - Replay does NOT evaluate quota
 * - Replay does NOT call AI provider
 * - Replay does NOT write ledger
 * - Replay returns cached result deterministically
 */
export class IdempotentReplayException extends Error {
  constructor(public readonly result: AIExecutionResult) {
    super('Idempotent replay');
    this.name = 'IdempotentReplayException';
  }
}
