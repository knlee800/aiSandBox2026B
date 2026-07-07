import { Injectable, Logger } from '@nestjs/common';
import { CreditDeductionGateway } from './credit-deduction.gateway';
import { CreditCalculationService } from './credit-calculation.service';
import type {
  CreditDeductionEvent,
  CreditDeductionResult,
  CreditDeductionLineItemResult,
} from './types';

/**
 * BILLING-READY-02C: Calculating Credit Deduction Gateway.
 *
 * Replaces NoOpCreditDeductionGateway with deterministic credit calculation.
 * Uses CreditCalculationService to convert line-item unit counts into credit
 * amounts via the static CREDIT_RATES config.
 *
 * Boundaries (deliberately NOT implemented):
 *  - No persistence (credits are calculated but not stored)
 *  - No balance tracking or enforcement
 *  - No Stripe/payment integration
 *  - No subscription/entitlement checks
 *  - No invoice generation
 *
 * Behavior:
 *  - creditsApplied = calculated amount (assumes infinite balance)
 *  - creditsOverflow = 0 (no ceiling enforcement)
 *  - balanceAfter = undefined (no balance tracking)
 *  - Deterministic: same event → same result
 *  - Idempotent by nature (pure function of input + static rates)
 */
@Injectable()
export class CalculatingCreditDeductionGateway extends CreditDeductionGateway {
  private readonly logger = new Logger(CalculatingCreditDeductionGateway.name);

  constructor(
    private readonly creditCalculationService: CreditCalculationService,
  ) {
    super();
  }

  applyDeduction(event: CreditDeductionEvent): CreditDeductionResult {
    const lineItems: CreditDeductionLineItemResult[] = event.lineItems.map(
      (item) => {
        const calculatedCredits =
          this.creditCalculationService.calculateLineItemCredits(item);

        return {
          category: item.category,
          creditsRequested: calculatedCredits,
          creditsApplied: calculatedCredits,
          creditsOverflow: 0,
          skippedDuplicate: false,
        };
      },
    );

    const totalCreditsRequested = lineItems.reduce(
      (sum, item) => sum + item.creditsRequested,
      0,
    );
    const totalCreditsApplied = lineItems.reduce(
      (sum, item) => sum + item.creditsApplied,
      0,
    );

    this.logger.debug(
      JSON.stringify({
        event: 'credit_deduction.calculated',
        timestamp: new Date().toISOString(),
        source: event.source,
        sourceEventId: event.sourceEventId,
        ownerId: event.ownerId,
        rateVersion: this.creditCalculationService.getRateVersion(),
        totalCreditsRequested,
        totalCreditsApplied,
        lineItemCount: lineItems.length,
      }),
    );

    return {
      source: event.source,
      sourceEventId: event.sourceEventId,
      ownerId: event.ownerId,
      occurredAt: event.occurredAt,
      totalCreditsRequested,
      totalCreditsApplied,
      totalCreditsOverflow: 0,
      lineItems,
      balanceAfter: undefined,
    };
  }
}
