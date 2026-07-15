import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookEvent } from '../../entities/webhook-event.entity';
import { User } from '../../entities/user.entity';
import { PaymentsModule } from '../../payments/payments.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { WebhookEventRepository } from './webhook-event.repository';

/**
 * BILLING-READY-05D: Webhook ingestion module.
 *
 * Imports:
 * - PaymentsModule: StripePaymentProvider for signature verification / event parsing
 * - SubscriptionModule: SubscriptionRepository for subscription persistence
 * - TypeOrmModule: WebhookEvent entity + User entity for customer mapping
 *
 * No Stripe SDK. No provider API calls. No env/secrets changes.
 */
@Module({
  imports: [
    PaymentsModule,
    SubscriptionModule,
    TypeOrmModule.forFeature([WebhookEvent, User]),
  ],
  controllers: [WebhookController],
  providers: [WebhookService, WebhookEventRepository],
  exports: [WebhookService],
})
export class WebhookModule {}
