import { Module } from '@nestjs/common';
import { CreditDeductionGateway } from './credit-deduction.gateway';
import { NoOpCreditDeductionGateway } from './noop-credit-deduction.gateway';

/**
 * BILLING-READY-02A: Credit Deduction Module.
 * BILLING-READY-02B: Now imported by UsageLedgerModule (single wiring point).
 *
 * Provides the CreditDeductionGateway token bound to the
 * NoOpCreditDeductionGateway implementation.
 *
 * Imported by: UsageLedgerModule (BILLING-READY-02B)
 * Wiring point: UsageLedgerService.updateExecutionResult() completion hook
 *
 * When a real implementation is ready, swap the useClass binding
 * here — all consumers automatically get the new behavior.
 */
@Module({
  providers: [
    {
      provide: CreditDeductionGateway,
      useClass: NoOpCreditDeductionGateway,
    },
  ],
  exports: [CreditDeductionGateway],
})
export class CreditDeductionModule {}
