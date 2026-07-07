import { Injectable } from '@nestjs/common';
import {
  CREDIT_RATES,
  CREDIT_RATE_VERSION,
  type CreditCategory,
  type CreditRate,
} from '../../credit-ledger';
import type { CreditDeductionLineItem } from './types';

/**
 * BILLING-READY-02C: Deterministic Credit Calculation Service.
 *
 * Pure calculation layer that converts raw usage units into credit amounts
 * using the static CREDIT_RATES config from BILLING-READY-01.
 *
 * Guarantees:
 *  - Deterministic: same (category, unitCount) → same credits
 *  - No side effects: no persistence, no balance tracking, no provider calls
 *  - Explicit: calculation formula is unitCount × creditsPerUnit
 *  - Rate version is pinned and traceable
 */
@Injectable()
export class CreditCalculationService {
  private readonly ratesByCategory: ReadonlyMap<CreditCategory, CreditRate>;

  constructor() {
    const map = new Map<CreditCategory, CreditRate>();
    for (const rate of CREDIT_RATES) {
      map.set(rate.category, rate);
    }
    this.ratesByCategory = map;
  }

  /**
   * Get the current rate version string for audit/tracing.
   */
  getRateVersion(): string {
    return CREDIT_RATE_VERSION;
  }

  /**
   * Look up the credit rate for a given category.
   * Returns undefined if the category has no configured rate.
   */
  getRateForCategory(category: CreditCategory): CreditRate | undefined {
    return this.ratesByCategory.get(category);
  }

  /**
   * Calculate credits for a single (category, unitCount) pair.
   *
   * Formula: credits = unitCount × creditsPerUnit
   *
   * Returns 0 if:
   *  - category has no configured rate
   *  - unitCount is <= 0 or non-finite
   */
  calculateCredits(category: CreditCategory, unitCount: number): number {
    if (!Number.isFinite(unitCount) || unitCount <= 0) {
      return 0;
    }

    const rate = this.ratesByCategory.get(category);
    if (!rate) {
      return 0;
    }

    return unitCount * rate.creditsPerUnit;
  }

  /**
   * Calculate credits for a CreditDeductionLineItem.
   *
   * If the lineItem already has a non-zero creditsRequested, this method
   * RECALCULATES from unitCount to ensure deterministic behavior.
   * The caller's creditsRequested is treated as advisory.
   */
  calculateLineItemCredits(lineItem: CreditDeductionLineItem): number {
    return this.calculateCredits(lineItem.category, lineItem.unitCount);
  }
}
