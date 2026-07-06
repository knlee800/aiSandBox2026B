import {
  CREDIT_RATES,
  CREDIT_RATE_VERSION,
} from '../config/credit-rates.config';
import { CREDIT_CATEGORIES } from '../types';

describe('credit-rates.config', () => {
  it('has a rate for every credit category', () => {
    const configuredCategories = CREDIT_RATES.map((rate) => rate.category);
    expect(configuredCategories).toHaveLength(CREDIT_CATEGORIES.length);
    expect(new Set(configuredCategories)).toEqual(new Set(CREDIT_CATEGORIES));
  });

  it('uses unique categories across rates', () => {
    const categories = CREDIT_RATES.map((rate) => rate.category);
    expect(new Set(categories).size).toBe(categories.length);
  });

  it('uses positive creditsPerUnit values', () => {
    for (const rate of CREDIT_RATES) {
      expect(rate.creditsPerUnit).toBeGreaterThan(0);
    }
  });

  it('uses non-empty unit strings', () => {
    for (const rate of CREDIT_RATES) {
      expect(typeof rate.unit).toBe('string');
      expect(rate.unit.trim().length).toBeGreaterThan(0);
    }
  });

  it('stays static without provider or Stripe dependencies', () => {
    expect(CREDIT_RATE_VERSION).toBe('2026-07-v1');

    for (const rate of CREDIT_RATES) {
      expect(Object.prototype.hasOwnProperty.call(rate, 'provider')).toBe(
        false,
      );
      expect(Object.prototype.hasOwnProperty.call(rate, 'stripePriceId')).toBe(
        false,
      );
      expect(
        Object.prototype.hasOwnProperty.call(rate, 'stripeProductId'),
      ).toBe(false);
      expect(
        Object.prototype.hasOwnProperty.call(rate, 'runtimeSource'),
      ).toBe(false);
    }
  });
});
