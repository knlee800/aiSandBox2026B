import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditBalance } from '../../entities/credit-balance.entity';

/**
 * BILLING-READY-03B: CreditBalance repository.
 *
 * Data access layer for the credit_balances table.
 * Provides domain methods per design doc Section 5.1.
 */

export interface CreateCreditBalanceParams {
  ownerId: string;
  ownerType?: string;
  planId: string;
  balance: number;
  monthlyAllocation: number;
  rolloverBalance?: number;
  status?: string;
  periodStart: Date;
  periodEnd: Date;
  resetAt?: Date | null;
}

export interface ResetBalanceParams {
  monthlyAllocation: number;
  rolloverBalance: number;
  periodStart: Date;
  periodEnd: Date;
  resetAt?: Date | null;
}

@Injectable()
export class CreditBalanceRepository {
  constructor(
    @InjectRepository(CreditBalance)
    private readonly repository: Repository<CreditBalance>,
  ) {}

  async findByOwner(
    ownerId: string,
    ownerType: string = 'user',
  ): Promise<CreditBalance | null> {
    return await this.repository.findOne({
      where: { ownerId, ownerType },
    });
  }

  /**
   * Acquire row lock (FOR UPDATE) within an active transaction.
   * Must be called from within a transaction manager context.
   */
  async findByOwnerForUpdate(
    ownerId: string,
    ownerType: string = 'user',
  ): Promise<CreditBalance | null> {
    return await this.repository
      .createQueryBuilder('cb')
      .setLock('pessimistic_write')
      .where('cb.owner_id = :ownerId', { ownerId })
      .andWhere('cb.owner_type = :ownerType', { ownerType })
      .getOne();
  }

  async create(params: CreateCreditBalanceParams): Promise<CreditBalance> {
    const entity = this.repository.create({
      ownerId: params.ownerId,
      ownerType: params.ownerType ?? 'user',
      planId: params.planId,
      balance: params.balance,
      monthlyAllocation: params.monthlyAllocation,
      rolloverBalance: params.rolloverBalance ?? 0,
      status: params.status ?? 'active',
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      resetAt: params.resetAt ?? null,
    });

    return await this.repository.save(entity);
  }

  async deductBalance(
    id: string,
    newBalance: number,
  ): Promise<CreditBalance> {
    await this.repository.update({ id }, { balance: newBalance });
    const updated = await this.repository.findOne({ where: { id } });
    if (!updated) {
      throw new Error(`CreditBalance not found after update: ${id}`);
    }
    return updated;
  }

  async resetForNewPeriod(
    id: string,
    params: ResetBalanceParams,
  ): Promise<CreditBalance> {
    const newBalance = params.monthlyAllocation + params.rolloverBalance;

    await this.repository.update(
      { id },
      {
        balance: newBalance,
        monthlyAllocation: params.monthlyAllocation,
        rolloverBalance: params.rolloverBalance,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        resetAt: params.resetAt ?? null,
      },
    );

    const updated = await this.repository.findOne({ where: { id } });
    if (!updated) {
      throw new Error(`CreditBalance not found after reset: ${id}`);
    }
    return updated;
  }
}
