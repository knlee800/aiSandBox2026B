import { Injectable, Logger } from '@nestjs/common';
import { CreditDeductionGateway } from './credit-deduction.gateway';
import type {
  CreditDeductionEvent,
  CreditDeductionResult,
  CreditDeductionLineItemResult,
} from './types';

/**
 * BILLING-READY-02A: No-op credit deduction gateway.
 *
 * Default implementation that satisfies the CreditDeductionGateway
 * contract but performs NO actual deduction.  Every event is
 * acknowledged with zero credits applied.
 *
 * Purpose:
 *  - Safe incremental rollout: call sites can be wired before
 *    real deduction logic exists.
 *  - Deterministic: same input always produces same output.
 *  - Observable: logs each event at DEBUG level for tracing.
 */
@Injectable()
export class NoOpCreditDeductionGateway extends CreditDeductionGateway {
  private readonly logger = new Logger(NoOpCreditDeductionGateway.name);

  applyDeduction(event: CreditDeductionEvent): CreditDeductionResult {
    const lineItems: CreditDeductionLineItemResult[] = event.lineItems.map(
      (item) => ({
        category: item.category,
        creditsRequested: item.creditsRequested,
        creditsApplied: 0,
        creditsOverflow: 0,
        skippedDuplicate: false,
      }),
    );

    const totalCreditsRequested = event.lineItems.reduce(
      (sum, item) => sum + item.creditsRequested,
      0,
    );

    this.logger.debug(
      `[noop] source=${event.source} sourceEventId=${event.sourceEventId} ownerId=${event.ownerId} totalCreditsRequested=${totalCreditsRequested}`,
    );

    return {
      source: event.source,
      sourceEventId: event.sourceEventId,
      ownerId: event.ownerId,
      occurredAt: event.occurredAt,
      totalCreditsRequested,
      totalCreditsApplied: 0,
      totalCreditsOverflow: 0,
      lineItems,
      balanceAfter: undefined,
    };
  }
}
