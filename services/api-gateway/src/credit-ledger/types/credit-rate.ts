import type { CreditCategory } from './credit-category';

/**
 * Static credit rate definition.
 * Rates are deterministic config values and do not call any providers.
 */
export interface CreditRate {
  category: CreditCategory;
  unit: string;
  creditsPerUnit: number;
  description: string;
}
