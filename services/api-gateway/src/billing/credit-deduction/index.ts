/**
 * BILLING-READY-02A/02B: Credit Deduction Gateway barrel exports.
 *
 * This module defines the SINGLE canonical entry point for credit
 * deductions.  Imported by UsageLedgerModule (BILLING-READY-02B).
 */
export { CreditDeductionGateway } from './credit-deduction.gateway';
export { CreditDeductionModule } from './credit-deduction.module';
export { NoOpCreditDeductionGateway } from './noop-credit-deduction.gateway';
export type {
  CreditDeductionEvent,
  CreditDeductionLineItem,
  CreditDeductionLineItemResult,
  CreditDeductionResult,
  CreditDeductionSource,
} from './types';
