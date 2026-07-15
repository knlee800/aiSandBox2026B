import { Module } from '@nestjs/common';
import { StripePaymentProvider } from './providers/stripe-payment.provider';

/**
 * PaymentsModule (Task 10B2, extended BILLING-READY-05A)
 * Payment provider abstraction layer with mode-aware contracts.
 *
 * BILLING-READY-05A additions:
 * - StripePaymentProvider is mode-aware (disabled/stub/test/live)
 * - ConfigService injection via global ConfigModule (no import needed here)
 * - Extended PaymentProvider interface with checkout/customer/webhook contracts
 * - No Stripe SDK, no provider API calls, no env/secrets changes
 */
@Module({
  providers: [StripePaymentProvider],
  exports: [StripePaymentProvider],
})
export class PaymentsModule {}
