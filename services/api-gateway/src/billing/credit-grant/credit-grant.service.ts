import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreditGrantRepository } from './credit-grant.repository';
import { CreditBalanceRepository } from '../credit-deduction/credit-balance.repository';
import { TOP_UP_PACK_MAP } from '../checkout/config/checkout-price-map.config';
import {
  MONTHLY_CREDIT_ALLOCATIONS,
  type PlanId,
  PLAN_IDS,
} from '../../credit-ledger/types/plan-definition';
import type { CreditGrant } from '../../entities/credit-grant.entity';

export interface CreditGrantRequest {
  ownerId: string;
  ownerType?: string;
  grantType: 'topup' | 'subscription_monthly' | 'subscription_initial';
  sourceEventId: string;
  providerEventId?: string | null;
  webhookEventId?: string | null;
  topUpPackId?: string | null;
  planType?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreditGrantResult {
  grantId: string;
  status: 'granted' | 'failed' | 'ignored' | 'duplicate';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * BILLING-READY-05E: Credit grant service.
 *
 * Atomic grant processing with three-layer idempotency:
 * 1. 05D webhook duplicate handling (upstream)
 * 2. credit_grants source_event_id pre-check
 * 3. unique constraint / 23505 fallback
 *
 * Transaction boundary covers credit_grant insert + credit balance add.
 * No Stripe/provider calls. No env/package dependency.
 */
@Injectable()
export class CreditGrantService {
  private readonly logger = new Logger(CreditGrantService.name);

  constructor(
    private readonly creditGrantRepository: CreditGrantRepository,
    private readonly creditBalanceRepository: CreditBalanceRepository,
    private readonly dataSource: DataSource,
  ) {}

  async processGrant(request: CreditGrantRequest): Promise<CreditGrantResult> {
    const ownerType = request.ownerType ?? 'user';

    // Layer 2: pre-transaction source_event_id check
    const existingGrant =
      await this.creditGrantRepository.findBySourceEventId(
        request.sourceEventId,
      );

    if (existingGrant) {
      if (existingGrant.status === 'granted') {
        this.logger.debug(
          `Credit grant already exists for sourceEventId=${request.sourceEventId}, returning duplicate`,
        );
        return {
          grantId: existingGrant.id,
          status: 'duplicate',
          amount: existingGrant.amount,
          balanceBefore: existingGrant.balanceBefore,
          balanceAfter: existingGrant.balanceAfter,
        };
      }
      if (existingGrant.status === 'failed') {
        this.logger.warn(
          `Previously failed grant for sourceEventId=${request.sourceEventId} — not auto-retrying`,
        );
        return {
          grantId: existingGrant.id,
          status: 'failed',
          amount: existingGrant.amount,
          balanceBefore: existingGrant.balanceBefore,
          balanceAfter: existingGrant.balanceAfter,
          errorCode: existingGrant.errorCode ?? undefined,
          errorMessage: existingGrant.errorMessage ?? undefined,
        };
      }
    }

    // Resolve grant amount
    let amount: number;
    let topUpPackId: string | null = null;
    let planType: string | null = request.planType ?? null;

    try {
      if (request.grantType === 'topup') {
        const resolved = this.resolveTopUpAmount(request);
        amount = resolved.amount;
        topUpPackId = resolved.packId;
      } else {
        const resolved = this.resolveSubscriptionAmount(request);
        amount = resolved.amount;
        planType = resolved.planType;
      }
    } catch (error) {
      return this.recordFailedGrant(request, ownerType, error);
    }

    // Atomic transaction: lock balance → insert grant → update balance → mark granted
    try {
      return await this.dataSource.transaction(async (manager) => {
        const balance =
          await this.creditBalanceRepository.findByOwnerForUpdate(
            request.ownerId,
            ownerType,
            manager,
          );

        if (!balance) {
          const grantRecord =
            await this.creditGrantRepository.createGrant(
              {
                ownerId: request.ownerId,
                ownerType,
                grantType: request.grantType,
                sourceType: 'webhook',
                sourceEventId: request.sourceEventId,
                providerEventId: request.providerEventId ?? null,
                webhookEventId: request.webhookEventId ?? null,
                planType,
                topUpPackId,
                amount,
                balanceBefore: 0,
                balanceAfter: 0,
                status: 'failed',
              },
              manager,
            );

          await this.creditGrantRepository.markFailed(
            grantRecord.id,
            'BALANCE_NOT_FOUND',
            'No credit_balance row for owner',
            manager,
          );

          return {
            grantId: grantRecord.id,
            status: 'failed' as const,
            amount,
            balanceBefore: 0,
            balanceAfter: 0,
            errorCode: 'BALANCE_NOT_FOUND',
            errorMessage: 'No credit_balance row for owner',
          };
        }

        const balanceBefore = balance.balance;
        const balanceAfter = balanceBefore + amount;

        const grantRecord =
          await this.creditGrantRepository.createGrant(
            {
              ownerId: request.ownerId,
              ownerType,
              grantType: request.grantType,
              sourceType: 'webhook',
              sourceEventId: request.sourceEventId,
              providerEventId: request.providerEventId ?? null,
              webhookEventId: request.webhookEventId ?? null,
              planType,
              topUpPackId,
              amount,
              balanceBefore,
              balanceAfter,
            },
            manager,
          );

        await this.creditBalanceRepository.addBalance(
          balance.id,
          balanceAfter,
          manager,
        );

        await this.creditGrantRepository.markGranted(
          grantRecord.id,
          balanceBefore,
          balanceAfter,
          manager,
        );

        this.logger.log(
          `Credit grant ${grantRecord.id} — ${request.grantType} — ${amount} credits to owner ${request.ownerId}`,
        );

        return {
          grantId: grantRecord.id,
          status: 'granted' as const,
          amount,
          balanceBefore,
          balanceAfter,
        };
      });
    } catch (error: unknown) {
      // Layer 3: 23505 unique constraint race fallback
      if (this.isUniqueConstraintViolation(error)) {
        const raceGrant =
          await this.creditGrantRepository.findBySourceEventId(
            request.sourceEventId,
          );
        if (raceGrant) {
          this.logger.debug(
            `Credit grant race-duplicate resolved for sourceEventId=${request.sourceEventId}`,
          );
          return {
            grantId: raceGrant.id,
            status: 'duplicate',
            amount: raceGrant.amount,
            balanceBefore: raceGrant.balanceBefore,
            balanceAfter: raceGrant.balanceAfter,
          };
        }
      }

      this.logger.error(
        `Credit grant transaction failed for sourceEventId=${request.sourceEventId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      return this.recordFailedGrant(request, ownerType, error);
    }
  }

  private resolveTopUpAmount(
    request: CreditGrantRequest,
  ): { amount: number; packId: string } {
    const packId =
      request.topUpPackId ??
      (request.metadata?.aisandbox_topup_pack_id as string | undefined);

    if (!packId) {
      throw new CreditGrantAmountError(
        'AMOUNT_RESOLUTION_FAILED',
        'Cannot determine credit amount — no topUpPackId in request or metadata',
      );
    }

    const pack = TOP_UP_PACK_MAP[packId];
    if (!pack) {
      throw new CreditGrantAmountError(
        'UNKNOWN_PACK',
        `Top-up pack ID not in TOP_UP_PACK_MAP: ${packId}`,
      );
    }

    return { amount: pack.credits, packId };
  }

  private resolveSubscriptionAmount(
    request: CreditGrantRequest,
  ): { amount: number; planType: string } {
    const planType = request.planType;

    if (!planType) {
      throw new CreditGrantAmountError(
        'AMOUNT_RESOLUTION_FAILED',
        'Cannot determine credit amount — no planType for subscription grant',
      );
    }

    if (!PLAN_IDS.includes(planType as PlanId)) {
      throw new CreditGrantAmountError(
        'AMOUNT_RESOLUTION_FAILED',
        `Unknown plan type for subscription grant: ${planType}`,
      );
    }

    const amount = MONTHLY_CREDIT_ALLOCATIONS[planType as PlanId];
    return { amount, planType };
  }

  private async recordFailedGrant(
    request: CreditGrantRequest,
    ownerType: string,
    error: unknown,
  ): Promise<CreditGrantResult> {
    const errorCode =
      error instanceof CreditGrantAmountError
        ? error.code
        : 'TRANSACTION_ERROR';
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    try {
      const grantRecord =
        await this.creditGrantRepository.createGrant({
          ownerId: request.ownerId,
          ownerType,
          grantType: request.grantType,
          sourceType: 'webhook',
          sourceEventId: request.sourceEventId,
          providerEventId: request.providerEventId ?? null,
          webhookEventId: request.webhookEventId ?? null,
          planType: request.planType ?? null,
          topUpPackId: request.topUpPackId ?? null,
          amount: 1, // placeholder — failed grants need a positive amount for CHECK constraint
          balanceBefore: 0,
          balanceAfter: 0,
          status: 'failed',
        });

      await this.creditGrantRepository.markFailed(
        grantRecord.id,
        errorCode,
        errorMessage,
      );

      return {
        grantId: grantRecord.id,
        status: 'failed',
        amount: 0,
        balanceBefore: 0,
        balanceAfter: 0,
        errorCode,
        errorMessage,
      };
    } catch (recordError) {
      // If we can't even record the failure (e.g., duplicate source_event_id),
      // return failure without persisted record
      this.logger.error(
        `Failed to record grant failure for sourceEventId=${request.sourceEventId}: ${recordError instanceof Error ? recordError.message : 'Unknown'}`,
      );
      return {
        grantId: '',
        status: 'failed',
        amount: 0,
        balanceBefore: 0,
        balanceAfter: 0,
        errorCode,
        errorMessage,
      };
    }
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const pgCode = (error as Error & { code?: string }).code;
    if (pgCode === '23505') return true;
    const msg = error.message ?? '';
    return msg.includes('duplicate key') || msg.includes('unique constraint');
  }
}

export class CreditGrantAmountError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'CreditGrantAmountError';
  }
}
