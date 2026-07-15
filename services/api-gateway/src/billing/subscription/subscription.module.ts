import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from '../../entities/subscription.entity';
import { SubscriptionRepository } from './subscription.repository';

/**
 * BILLING-READY-05B: Subscription persistence module.
 *
 * Registers the Subscription entity and provides SubscriptionRepository.
 * Kept as a focused module separate from BillingModule and PaymentsModule
 * to maintain bounded responsibility. Consumers (05C/05D) import this module.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Subscription])],
  providers: [SubscriptionRepository],
  exports: [SubscriptionRepository],
})
export class SubscriptionModule {}
