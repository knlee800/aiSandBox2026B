import { Module } from '@nestjs/common';
import { BillingReadController } from './billing-read.controller';
import { CreditPersistenceModule } from './credit-deduction/credit-persistence.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { AuthModule } from '../auth/auth.module';

/**
 * BILLING-READY-05F: Billing read module.
 *
 * Provides GET /api/billing/balance and GET /api/billing/subscription
 * for the billing UI page. Imports existing persistence modules.
 * No new entities. No migrations. No provider calls.
 */
@Module({
  imports: [CreditPersistenceModule, SubscriptionModule, AuthModule],
  controllers: [BillingReadController],
})
export class BillingReadModule {}
