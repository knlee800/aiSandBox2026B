import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditPersistenceModule } from './credit-deduction/credit-persistence.module';
import { CreditBalanceGuard } from './credit-balance.guard';
import { User } from '../entities/user.entity';

/**
 * BILLING-READY-04A: Credit Balance Guard Module
 *
 * Provides CreditBalanceGuard with its dependencies:
 * - CreditBalanceRepository (via CreditPersistenceModule)
 * - Repository<User> (via TypeOrmModule.forFeature)
 *
 * Import this module into any module whose controllers
 * use CreditBalanceGuard in their @UseGuards() chain.
 */
@Module({
  imports: [
    CreditPersistenceModule,
    TypeOrmModule.forFeature([User]),
  ],
  providers: [CreditBalanceGuard],
  exports: [CreditBalanceGuard],
})
export class CreditBalanceGuardModule {}
