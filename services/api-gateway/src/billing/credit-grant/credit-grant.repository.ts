import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { CreditGrant } from '../../entities/credit-grant.entity';

export interface CreateCreditGrantParams {
  ownerId: string;
  ownerType?: string;
  grantType: string;
  sourceType: string;
  sourceEventId: string;
  provider?: string;
  providerEventId?: string | null;
  webhookEventId?: string | null;
  planType?: string | null;
  topUpPackId?: string | null;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  status?: string;
  grantedByUserId?: string | null;
  reason?: string | null;
}

/**
 * BILLING-READY-05E: Credit grant repository.
 *
 * Persistence layer for credit_grants table.
 * Provides idempotent grant recording, duplicate detection, and status transitions.
 * No provider API calls. No Stripe SDK.
 */
@Injectable()
export class CreditGrantRepository {
  constructor(
    @InjectRepository(CreditGrant)
    private readonly repository: Repository<CreditGrant>,
  ) {}

  async findBySourceEventId(
    sourceEventId: string,
  ): Promise<CreditGrant | null> {
    return await this.repository.findOne({
      where: { sourceEventId },
    });
  }

  async findByWebhookEventId(
    webhookEventId: string,
  ): Promise<CreditGrant | null> {
    return await this.repository.findOne({
      where: { webhookEventId },
    });
  }

  async createGrant(
    params: CreateCreditGrantParams,
    manager?: EntityManager,
  ): Promise<CreditGrant> {
    const repo = manager
      ? manager.getRepository(CreditGrant)
      : this.repository;
    const entity = repo.create({
      ownerId: params.ownerId,
      ownerType: params.ownerType ?? 'user',
      grantType: params.grantType,
      sourceType: params.sourceType,
      sourceEventId: params.sourceEventId,
      provider: params.provider ?? 'stripe',
      providerEventId: params.providerEventId ?? null,
      webhookEventId: params.webhookEventId ?? null,
      planType: params.planType ?? null,
      topUpPackId: params.topUpPackId ?? null,
      grantedByUserId: params.grantedByUserId ?? null,
      reason: params.reason ?? null,
      amount: params.amount,
      balanceBefore: params.balanceBefore,
      balanceAfter: params.balanceAfter,
      status: params.status ?? 'pending',
    });
    return await repo.save(entity);
  }

  async markGranted(
    id: string,
    balanceBefore: number,
    balanceAfter: number,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(CreditGrant)
      : this.repository;
    await repo.update(
      { id },
      {
        status: 'granted',
        balanceBefore,
        balanceAfter,
        grantedAt: new Date(),
      },
    );
  }

  async markFailed(
    id: string,
    errorCode: string,
    errorMessage: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(CreditGrant)
      : this.repository;
    await repo.update(
      { id },
      {
        status: 'failed',
        errorCode,
        errorMessage,
      },
    );
  }

  async markIgnored(
    id: string,
    errorCode?: string,
    errorMessage?: string,
  ): Promise<void> {
    await this.repository.update(
      { id },
      {
        status: 'ignored',
        errorCode: errorCode ?? null,
        errorMessage: errorMessage ?? null,
      },
    );
  }
}
