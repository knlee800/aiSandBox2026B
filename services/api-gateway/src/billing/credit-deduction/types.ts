import type { CreditCategory, CreditAmount, CreditBalance } from '../../credit-ledger';

/**
 * BILLING-READY-02A: Canonical credit deduction event types.
 *
 * These types define the ONLY contract through which usage events
 * are translated into credit deductions. No other path is permitted.
 */

/**
 * Source systems that may emit deduction events.
 * Each source maps to exactly one upstream usage pathway.
 */
export type CreditDeductionSource =
  | 'usage_ledger'
  | 'token_usage';

/**
 * A single category-level deduction request within an event.
 * One usage event may produce multiple line items (e.g. tokens + runtime).
 */
export interface CreditDeductionLineItem {
  readonly category: CreditCategory;
  readonly unit: string;
  readonly unitCount: number;
  readonly creditsRequested: CreditAmount;
}

/**
 * CreditDeductionEvent
 *
 * The canonical input to the credit deduction gateway.
 * Constructed by the caller from raw usage data; the gateway
 * does NOT reach back into usage tables.
 *
 * Invariants:
 *  - sourceEventId is globally unique per deduction attempt
 *  - ownerId is the billable user identity (never a session surrogate)
 *  - lineItems are pre-translated from raw usage units to credit amounts
 */
export interface CreditDeductionEvent {
  readonly source: CreditDeductionSource;
  readonly sourceEventId: string;
  readonly ownerId: string;
  readonly occurredAt: Date;
  readonly lineItems: readonly CreditDeductionLineItem[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Result of a single line-item deduction.
 */
export interface CreditDeductionLineItemResult {
  readonly category: CreditCategory;
  readonly creditsRequested: CreditAmount;
  readonly creditsApplied: CreditAmount;
  readonly creditsOverflow: CreditAmount;
  readonly skippedDuplicate: boolean;
}

/**
 * CreditDeductionResult
 *
 * The canonical output from the credit deduction gateway.
 * Returned synchronously; the gateway is not async in the
 * initial in-memory implementation.
 */
export interface CreditDeductionResult {
  readonly source: CreditDeductionSource;
  readonly sourceEventId: string;
  readonly ownerId: string;
  readonly occurredAt: Date;
  readonly totalCreditsRequested: CreditAmount;
  readonly totalCreditsApplied: CreditAmount;
  readonly totalCreditsOverflow: CreditAmount;
  readonly lineItems: readonly CreditDeductionLineItemResult[];
  readonly balanceAfter?: CreditBalance;
}
