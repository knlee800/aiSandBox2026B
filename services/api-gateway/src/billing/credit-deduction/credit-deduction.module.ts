import { Module } from '@nestjs/common';
import { CreditDeductionGateway } from './credit-deduction.gateway';
import { PersistentCreditDeductionGateway } from './persistent-credit-deduction.gateway';
import { CreditCalculationService } from './credit-calculation.service';
import { CreditPersistenceModule } from './credit-persistence.module';

/**
 * BILLING-READY-03C2: Credit Deduction Module.
 *
 * Provides the CreditDeductionGateway token bound to
 * PersistentCreditDeductionGateway (BILLING-READY-03C2).
 *
 * The persistent gateway uses CreditCalculationService for rate
 * calculation and CreditPersistenceModule repositories for balance
 * mutation and deduction record storage.
 *
 * Imported by: UsageLedgerModule (BILLING-READY-02B)
 * Wiring point: UsageLedgerService.updateExecutionResult() completion hook
 */
@Module({
  imports: [CreditPersistenceModule],
  providers: [
    CreditCalculationService,
    {
      provide: CreditDeductionGateway,
      useClass: PersistentCreditDeductionGateway,
    },
  ],
  exports: [CreditDeductionGateway, CreditCalculationService],
})
export class CreditDeductionModule {}
