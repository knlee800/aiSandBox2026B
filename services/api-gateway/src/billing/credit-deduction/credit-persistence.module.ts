import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditBalance } from '../../entities/credit-balance.entity';
import { CreditDeductionRecord } from '../../entities/credit-deduction-record.entity';
import { CreditBalanceRepository } from './credit-balance.repository';
import { CreditDeductionRecordRepository } from './credit-deduction-record.repository';

/**
 * BILLING-READY-03B: Credit Persistence Module.
 *
 * Registers TypeORM entities and repository providers for credit
 * balance and deduction record persistence.
 *
 * Can be imported by CreditDeductionModule when the persistent
 * gateway is wired (BILLING-READY-03C). Does NOT swap any
 * gateway binding itself.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([CreditBalance, CreditDeductionRecord]),
  ],
  providers: [CreditBalanceRepository, CreditDeductionRecordRepository],
  exports: [CreditBalanceRepository, CreditDeductionRecordRepository],
})
export class CreditPersistenceModule {}
