import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreditDeductionGateway } from './credit-deduction.gateway';
import { CreditCalculationService } from './credit-calculation.service';
import { CreditBalanceRepository } from './credit-balance.repository';
import { CreditDeductionRecordRepository } from './credit-deduction-record.repository';
import type { CreditDeductionRecord } from '../../entities/credit-deduction-record.entity';
import type {
  CreditDeductionEvent,
  CreditDeductionResult,
  CreditDeductionLineItemResult,
} from './types';

/**
 * BILLING-READY-03D1: Persistent Credit Deduction Gateway with transaction hardening.
 *
 * Persists deduction records and mutates balance via repository layer
 * within a single atomic TypeORM transaction. The balance lock,
 * record insert, and balance update all share the same transactional
 * EntityManager — if any step fails the entire transaction rolls back.
 *
 * Implements sourceEventId idempotency (pre-transaction check +
 * unique constraint race fallback), overflow enforcement, and
 * balanceAfter population from actual stored balance.
 *
 * Design authority: docs/BILLING-READY-03A-SCHEMA-PERSISTENCE-DESIGN.md
 * Sections 3 (Idempotency), 4 (Transaction), 5.3 (Gateway).
 */
@Injectable()
export class PersistentCreditDeductionGateway extends CreditDeductionGateway<Promise<CreditDeductionResult>> {
  private readonly logger = new Logger(PersistentCreditDeductionGateway.name);

  constructor(
    private readonly creditCalculationService: CreditCalculationService,
    private readonly creditBalanceRepository: CreditBalanceRepository,
    private readonly deductionRecordRepository: CreditDeductionRecordRepository,
    @Inject(DataSource) private readonly dataSource: DataSource,
  ) {
    super();
  }

  async applyDeduction(
    event: CreditDeductionEvent,
  ): Promise<CreditDeductionResult> {
    const existingRecord =
      await this.deductionRecordRepository.findBySourceEventId(
        event.sourceEventId,
      );

    if (existingRecord) {
      this.logger.debug(
        JSON.stringify({
          event: 'credit_deduction.duplicate_detected',
          sourceEventId: event.sourceEventId,
          ownerId: event.ownerId,
          existingRecordId: existingRecord.id,
        }),
      );
      return this.buildResultFromRecord(event, existingRecord, true);
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const balance =
          await this.creditBalanceRepository.findByOwnerForUpdate(
            event.ownerId,
            'user',
            manager,
          );

        if (!balance) {
          throw new Error(
            `CreditBalance not found for owner: ${event.ownerId}. ` +
              'Balance must be provisioned before deduction.',
          );
        }

        const lineItemCredits = event.lineItems.map((item) =>
          this.creditCalculationService.calculateLineItemCredits(item),
        );

        const totalRequestedCredits = lineItemCredits.reduce(
          (sum, c) => sum + c,
          0,
        );

        const availableBalance = balance.balance;
        const appliedCredits = Math.min(
          totalRequestedCredits,
          availableBalance,
        );
        const overflowCredits = Math.max(
          totalRequestedCredits - availableBalance,
          0,
        );
        const balanceAfter = availableBalance - appliedCredits;

        let remainingBudget = appliedCredits;
        const finalLineItems: CreditDeductionLineItemResult[] =
          event.lineItems.map((item, i) => {
            const requested = lineItemCredits[i];
            const itemApplied = Math.min(requested, remainingBudget);
            const itemOverflow = requested - itemApplied;
            remainingBudget -= itemApplied;
            return {
              category: item.category,
              creditsRequested: requested,
              creditsApplied: itemApplied,
              creditsOverflow: itemOverflow,
              skippedDuplicate: false,
            };
          });

        const record = await this.deductionRecordRepository.create(
          {
            ownerId: event.ownerId,
            sourceEventId: event.sourceEventId,
            sourceEventType: event.source,
            requestedCredits: totalRequestedCredits,
            appliedCredits,
            overflowCredits,
            balanceBefore: availableBalance,
            balanceAfter,
            lineItems: finalLineItems,
            metadata: event.metadata ? { ...event.metadata } : null,
            status: 'applied',
          },
          manager,
        );

        await this.creditBalanceRepository.deductBalance(
          balance.id,
          balanceAfter,
          manager,
        );

        this.logger.debug(
          JSON.stringify({
            event: 'credit_deduction.persisted',
            sourceEventId: event.sourceEventId,
            ownerId: event.ownerId,
            recordId: record.id,
            totalRequestedCredits,
            appliedCredits,
            overflowCredits,
            balanceBefore: availableBalance,
            balanceAfter,
          }),
        );

        return {
          source: event.source,
          sourceEventId: event.sourceEventId,
          ownerId: event.ownerId,
          occurredAt: event.occurredAt,
          totalCreditsRequested: totalRequestedCredits,
          totalCreditsApplied: appliedCredits,
          totalCreditsOverflow: overflowCredits,
          lineItems: finalLineItems,
          balanceAfter,
        };
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintViolation(error)) {
        const raceRecord =
          await this.deductionRecordRepository.findBySourceEventId(
            event.sourceEventId,
          );
        if (raceRecord) {
          this.logger.debug(
            JSON.stringify({
              event: 'credit_deduction.race_duplicate_resolved',
              sourceEventId: event.sourceEventId,
              ownerId: event.ownerId,
            }),
          );
          return this.buildResultFromRecord(event, raceRecord, true);
        }
      }
      throw error;
    }
  }

  private buildResultFromRecord(
    event: CreditDeductionEvent,
    record: CreditDeductionRecord,
    isDuplicate: boolean,
  ): CreditDeductionResult {
    const lineItems: CreditDeductionLineItemResult[] = record.lineItems.map(
      (item) => ({
        ...item,
        skippedDuplicate: isDuplicate,
      }),
    );

    return {
      source: event.source,
      sourceEventId: record.sourceEventId,
      ownerId: record.ownerId,
      occurredAt: event.occurredAt,
      totalCreditsRequested: record.requestedCredits,
      totalCreditsApplied: record.appliedCredits,
      totalCreditsOverflow: record.overflowCredits,
      lineItems,
      balanceAfter: record.balanceAfter,
    };
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const pgCode = (error as Error & { code?: string }).code;
    if (pgCode === '23505') return true;
    const msg = error.message ?? '';
    return (
      msg.includes('duplicate key') || msg.includes('unique constraint')
    );
  }
}
