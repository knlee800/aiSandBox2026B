/**
 * BILLING-READY-02A/02B/02C/03B: Credit Deduction Gateway barrel exports.
 *
 * This module defines the SINGLE canonical entry point for credit
 * deductions.  Imported by UsageLedgerModule (BILLING-READY-02B).
 */
export { CreditDeductionGateway } from './credit-deduction.gateway';
export { CreditDeductionModule } from './credit-deduction.module';
export { NoOpCreditDeductionGateway } from './noop-credit-deduction.gateway';
export { CalculatingCreditDeductionGateway } from './calculating-credit-deduction.gateway';
export { CreditCalculationService } from './credit-calculation.service';
export { PersistentCreditDeductionGateway } from './persistent-credit-deduction.gateway';
export { CreditPersistenceModule } from './credit-persistence.module';
export { CreditBalanceRepository } from './credit-balance.repository';
export { CreditDeductionRecordRepository } from './credit-deduction-record.repository';
export type {
  CreateCreditBalanceParams,
  ResetBalanceParams,
} from './credit-balance.repository';
export type {
  CreateDeductionRecordParams,
  PaginationOptions,
} from './credit-deduction-record.repository';
export type {
  CreditDeductionEvent,
  CreditDeductionLineItem,
  CreditDeductionLineItemResult,
  CreditDeductionResult,
  CreditDeductionSource,
} from './types';
