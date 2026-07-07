import type { CreditDeductionEvent, CreditDeductionResult } from './types';

/**
 * BILLING-READY-02A: Canonical Credit Deduction Gateway.
 *
 * This abstract class is the SINGLE AUTHORITATIVE ENTRY POINT
 * for all credit deductions in the platform.
 *
 * Rules (enforced by architecture, not just convention):
 *
 *  1. ONE GATEWAY — There is exactly one concrete implementation
 *     bound to this token at any time.
 *
 *  2. ONE CALL SITE — Each upstream flow (usage-ledger completion,
 *     token-usage recording) calls the gateway at most once per
 *     source event.  Duplicate detection is the gateway's job.
 *
 *  3. NO SIDE-CHANNEL — No service may deduct credits by any path
 *     other than submitting a CreditDeductionEvent through this
 *     gateway.  Direct balance manipulation is forbidden.
 *
 *  4. CALLER OWNS IDENTITY — The caller must resolve ownerId to a
 *     real billable user before calling.  Session-scoped surrogates
 *     (e.g. "session:<id>") are rejected.
 *
 *  5. IDEMPOTENT — Re-submitting an event with the same
 *     sourceEventId + source is safe and returns the prior result.
 *
 * The default bound implementation is NoOpCreditDeductionGateway,
 * which satisfies the contract but performs no actual deduction.
 * This enables safe incremental rollout: wire the call site first,
 * swap the implementation later.
 */
export abstract class CreditDeductionGateway<
  TResult extends CreditDeductionResult | Promise<CreditDeductionResult> = CreditDeductionResult,
> {
  /**
   * Apply a credit deduction event.
   *
   * Default contract is synchronous to preserve existing call sites.
   * Async implementations may opt-in via a Promise result type parameter.
   *
   * @param event — fully pre-translated deduction event
   * @returns deduction result with per-line-item breakdown
   */
  abstract applyDeduction(event: CreditDeductionEvent): TResult;
}
