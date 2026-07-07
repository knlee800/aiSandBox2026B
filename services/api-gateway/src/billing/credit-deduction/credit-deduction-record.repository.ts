import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditDeductionRecord } from '../../entities/credit-deduction-record.entity';
import type { CreditDeductionLineItemResult } from './types';

/**
 * BILLING-READY-03B: CreditDeductionRecord repository.
 *
 * Data access layer for the credit_deduction_records table.
 * Provides domain methods per design doc Section 5.2.
 *
 * Records are immutable after creation.
 */

export interface CreateDeductionRecordParams {
  ownerId: string;
  sourceEventId: string;
  sourceEventType: string;
  agentId?: string | null;
  sessionId?: string | null;
  executionId?: string | null;
  modelId?: string | null;
  requestedCredits: number;
  appliedCredits: number;
  overflowCredits: number;
  balanceBefore: number;
  balanceAfter: number;
  lineItems: CreditDeductionLineItemResult[];
  metadata?: Record<string, unknown> | null;
  status?: string;
}

export interface PaginationOptions {
  offset?: number;
  limit?: number;
}

@Injectable()
export class CreditDeductionRecordRepository {
  constructor(
    @InjectRepository(CreditDeductionRecord)
    private readonly repository: Repository<CreditDeductionRecord>,
  ) {}

  async findBySourceEventId(
    sourceEventId: string,
  ): Promise<CreditDeductionRecord | null> {
    return await this.repository.findOne({
      where: { sourceEventId },
    });
  }

  async create(
    params: CreateDeductionRecordParams,
  ): Promise<CreditDeductionRecord> {
    const entity = this.repository.create({
      ownerId: params.ownerId,
      sourceEventId: params.sourceEventId,
      sourceEventType: params.sourceEventType,
      agentId: params.agentId ?? null,
      sessionId: params.sessionId ?? null,
      executionId: params.executionId ?? null,
      modelId: params.modelId ?? null,
      requestedCredits: params.requestedCredits,
      appliedCredits: params.appliedCredits,
      overflowCredits: params.overflowCredits,
      balanceBefore: params.balanceBefore,
      balanceAfter: params.balanceAfter,
      lineItems: params.lineItems,
      metadata: params.metadata ?? null,
      status: params.status ?? 'applied',
    });

    return await this.repository.save(entity);
  }

  async findByOwner(
    ownerId: string,
    options?: PaginationOptions,
  ): Promise<CreditDeductionRecord[]> {
    return await this.repository.find({
      where: { ownerId },
      order: { createdAt: 'DESC' },
      skip: options?.offset,
      take: options?.limit,
    });
  }

  async findBySession(sessionId: string): Promise<CreditDeductionRecord[]> {
    return await this.repository.find({
      where: { sessionId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByExecution(
    executionId: string,
  ): Promise<CreditDeductionRecord[]> {
    return await this.repository.find({
      where: { executionId },
      order: { createdAt: 'DESC' },
    });
  }
}
