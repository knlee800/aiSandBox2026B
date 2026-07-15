import {
  CHECKOUT_PLAN_PRICE_MAP,
  VALID_CHECKOUT_PLAN_IDS,
  TOP_UP_PACK_MAP,
  VALID_TOP_UP_PACK_IDS,
  PlanPriceEntry,
  TopUpPackEntry,
} from '../config/checkout-price-map.config';

describe('checkout-price-map.config', () => {
  describe('CHECKOUT_PLAN_PRICE_MAP', () => {
    it('should contain exactly starter, pro, team', () => {
      expect(VALID_CHECKOUT_PLAN_IDS.sort()).toEqual(
        ['pro', 'starter', 'team'],
      );
    });

    it('should NOT contain free plan', () => {
      expect(CHECKOUT_PLAN_PRICE_MAP['free']).toBeUndefined();
    });

    it('should have valid PlanPriceEntry shape for each entry', () => {
      for (const key of VALID_CHECKOUT_PLAN_IDS) {
        const entry: PlanPriceEntry = CHECKOUT_PLAN_PRICE_MAP[key];
        expect(entry.planId).toBe(key);
        expect(typeof entry.displayName).toBe('string');
        expect(entry.displayName.length).toBeGreaterThan(0);
        expect(typeof entry.stripePriceId).toBe('string');
        expect(entry.stripePriceId).toMatch(/^price_placeholder_/);
        expect(typeof entry.monthlyCredits).toBe('number');
        expect(entry.monthlyCredits).toBeGreaterThan(0);
      }
    });

    it('should use placeholder price IDs (not real Stripe IDs)', () => {
      for (const key of VALID_CHECKOUT_PLAN_IDS) {
        const entry = CHECKOUT_PLAN_PRICE_MAP[key];
        expect(entry.stripePriceId).not.toMatch(/^price_[A-Za-z0-9]{14,}/);
        expect(entry.stripePriceId).toContain('placeholder');
      }
    });

    it('should not accept unknown plan IDs', () => {
      expect(CHECKOUT_PLAN_PRICE_MAP['enterprise']).toBeUndefined();
      expect(CHECKOUT_PLAN_PRICE_MAP['basic']).toBeUndefined();
      expect(CHECKOUT_PLAN_PRICE_MAP['']).toBeUndefined();
    });

    it('should have correct credit allocations matching MONTHLY_CREDIT_ALLOCATIONS', () => {
      expect(CHECKOUT_PLAN_PRICE_MAP['starter'].monthlyCredits).toBe(5000);
      expect(CHECKOUT_PLAN_PRICE_MAP['pro'].monthlyCredits).toBe(25000);
      expect(CHECKOUT_PLAN_PRICE_MAP['team'].monthlyCredits).toBe(100000);
    });
  });

  describe('TOP_UP_PACK_MAP', () => {
    it('should contain expected pack IDs', () => {
      expect(VALID_TOP_UP_PACK_IDS.sort()).toEqual(
        ['topup_1000', 'topup_20000', 'topup_5000'],
      );
    });

    it('should have valid TopUpPackEntry shape for each entry', () => {
      for (const key of VALID_TOP_UP_PACK_IDS) {
        const entry: TopUpPackEntry = TOP_UP_PACK_MAP[key];
        expect(entry.packId).toBe(key);
        expect(typeof entry.displayName).toBe('string');
        expect(entry.displayName.length).toBeGreaterThan(0);
        expect(typeof entry.credits).toBe('number');
        expect(entry.credits).toBeGreaterThan(0);
        expect(typeof entry.stripePriceId).toBe('string');
        expect(entry.stripePriceId).toContain('placeholder');
      }
    });

    it('should not accept unknown pack IDs', () => {
      expect(TOP_UP_PACK_MAP['topup_100']).toBeUndefined();
      expect(TOP_UP_PACK_MAP['topup_50000']).toBeUndefined();
      expect(TOP_UP_PACK_MAP['']).toBeUndefined();
    });

    it('should use placeholder price IDs (not real Stripe IDs)', () => {
      for (const key of VALID_TOP_UP_PACK_IDS) {
        const entry = TOP_UP_PACK_MAP[key];
        expect(entry.stripePriceId).not.toMatch(/^price_[A-Za-z0-9]{14,}/);
        expect(entry.stripePriceId).toContain('placeholder');
      }
    });
  });
});
