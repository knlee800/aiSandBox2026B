import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
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
   * When manager is provided, uses the transactional EntityManager
   * to ensure the lock is held within the caller's transaction.
   */
  async findByOwnerForUpdate(
    ownerId: string,
    ownerType: string = 'user',
    manager?: EntityManager,
  ): Promise<CreditBalance | null> {
    const qb = manager
      ? manager.createQueryBuilder(CreditBalance, 'cb')
      : this.repository.createQueryBuilder('cb');
    return await qb
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
    manager?: EntityManager,
  ): Promise<CreditBalance> {
    if (manager) {
      await manager.update(CreditBalance, { id }, { balance: newBalance });
      const updated = await manager.findOne(CreditBalance, { where: { id } });
      if (!updated) {
        throw new Error(`CreditBalance not found after update: ${id}`);
      }
      return updated;
    }
    await this.repository.update({ id }, { balance: newBalance });
    const updated = await this.repository.findOne({ where: { id } });
    if (!updated) {
      throw new Error(`CreditBalance not found after update: ${id}`);
    }
    return updated;
  }

  /**
   * BILLING-READY-05E: Increment balance for credit grants.
   * Symmetric to deductBalance(). Uses the same EntityManager pattern
   * for transactional atomicity with FOR UPDATE locks.
   */
  async addBalance(
    id: string,
    newBalance: number,
    manager?: EntityManager,
  ): Promise<CreditBalance> {
    if (manager) {
      await manager.update(CreditBalance, { id }, { balance: newBalance });
      const updated = await manager.findOne(CreditBalance, { where: { id } });
      if (!updated) {
        throw new Error(`CreditBalance not found after update: ${id}`);
      }
      return updated;
    }
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
