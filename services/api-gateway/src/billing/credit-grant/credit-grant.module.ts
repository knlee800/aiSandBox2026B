import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditGrant } from '../../entities/credit-grant.entity';
import { WebhookEvent } from '../../entities/webhook-event.entity';
import { CreditPersistenceModule } from '../credit-deduction/credit-persistence.module';
import { CreditGrantRepository } from './credit-grant.repository';
import { CreditGrantService } from './credit-grant.service';

/**
 * BILLING-READY-05E: Credit grant module.
 *
 * Imports:
 * - CreditPersistenceModule: CreditBalanceRepository for balance mutations
 * - TypeOrmModule: CreditGrant entity + WebhookEvent entity for audit references
 *
 * No Stripe SDK. No provider API calls. No env/secrets changes.
 */
@Module({
  imports: [
    CreditPersistenceModule,
    TypeOrmModule.forFeature([CreditGrant, WebhookEvent]),
  ],
  providers: [CreditGrantRepository, CreditGrantService],
  exports: [CreditGrantService],
})
export class CreditGrantModule {}
