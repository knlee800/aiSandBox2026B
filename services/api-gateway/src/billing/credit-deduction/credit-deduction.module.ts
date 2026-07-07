import { Module } from '@nestjs/common';
import { CreditDeductionGateway } from './credit-deduction.gateway';
import { CalculatingCreditDeductionGateway } from './calculating-credit-deduction.gateway';
import { CreditCalculationService } from './credit-calculation.service';

/**
 * BILLING-READY-02A/02C: Credit Deduction Module.
 *
 * Provides the CreditDeductionGateway token bound to
 * CalculatingCreditDeductionGateway (BILLING-READY-02C).
 *
 * The calculating gateway uses CreditCalculationService to apply
 * deterministic credit rates from CREDIT_RATES config. No persistence,
 * no balance enforcement, no payment integration.
 *
 * Imported by: UsageLedgerModule (BILLING-READY-02B)
 * Wiring point: UsageLedgerService.updateExecutionResult() completion hook
 */
@Module({
  providers: [
    CreditCalculationService,
    {
      provide: CreditDeductionGateway,
      useClass: CalculatingCreditDeductionGateway,
    },
  ],
  exports: [CreditDeductionGateway, CreditCalculationService],
})
export class CreditDeductionModule {}
