import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { PaymentsModule } from '../../payments/payments.module';
import { AdminModule } from '../../admin/admin.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { AuthModule } from '../../auth/auth.module';
import { User } from '../../entities/user.entity';

/**
 * BILLING-READY-05C: Checkout module.
 *
 * Wires the checkout controller and service with required dependencies:
 * - PaymentsModule (StripePaymentProvider)
 * - AdminModule (ChargeReadinessService)
 * - SubscriptionModule (SubscriptionRepository — active subscription check)
 * - AuthModule (SessionCookieGuard / AuthService)
 * - TypeOrmModule.forFeature([User]) (user lookup for stripeCustomerId)
 */
@Module({
  imports: [
    PaymentsModule,
    AdminModule,
    SubscriptionModule,
    AuthModule,
    TypeOrmModule.forFeature([User]),
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
