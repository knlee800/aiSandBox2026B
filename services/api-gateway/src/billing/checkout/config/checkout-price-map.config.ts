/**
 * BILLING-READY-05C: Static plan/pack → price ID mapping.
 *
 * Uses deterministic placeholder price IDs suitable for stub/test-ready
 * contracts. Real Stripe price IDs will be supplied later via environment
 * configuration (STRIPE_PRICE_ID_STARTER, STRIPE_PRICE_ID_PRO, etc.)
 * in an approved env/config task.
 *
 * No env keys. No user-supplied price IDs. Server-side only.
 */

// -------------------------------------------------------------------------
// Subscription plan price mapping
// -------------------------------------------------------------------------

export interface PlanPriceEntry {
  planId: string;
  displayName: string;
  /** Placeholder — real Stripe price ID deferred to approved env/config work */
  stripePriceId: string;
  monthlyCredits: number;
}

export const CHECKOUT_PLAN_PRICE_MAP: Readonly<Record<string, PlanPriceEntry>> =
  {
    starter: {
      planId: 'starter',
      displayName: 'Starter',
      stripePriceId: 'price_placeholder_starter',
      monthlyCredits: 5_000,
    },
    pro: {
      planId: 'pro',
      displayName: 'Pro',
      stripePriceId: 'price_placeholder_pro',
      monthlyCredits: 25_000,
    },
    team: {
      planId: 'team',
      displayName: 'Team',
      stripePriceId: 'price_placeholder_team',
      monthlyCredits: 100_000,
    },
  } as const;

export const VALID_CHECKOUT_PLAN_IDS = Object.keys(
  CHECKOUT_PLAN_PRICE_MAP,
) as string[];

// -------------------------------------------------------------------------
// Credit top-up pack mapping
// -------------------------------------------------------------------------

export interface TopUpPackEntry {
  packId: string;
  displayName: string;
  credits: number;
  /** Placeholder — real Stripe price ID deferred to approved env/config work */
  stripePriceId: string;
}

export const TOP_UP_PACK_MAP: Readonly<Record<string, TopUpPackEntry>> = {
  topup_1000: {
    packId: 'topup_1000',
    displayName: '1,000 Credits',
    credits: 1_000,
    stripePriceId: 'price_placeholder_topup_1000',
  },
  topup_5000: {
    packId: 'topup_5000',
    displayName: '5,000 Credits',
    credits: 5_000,
    stripePriceId: 'price_placeholder_topup_5000',
  },
  topup_20000: {
    packId: 'topup_20000',
    displayName: '20,000 Credits',
    credits: 20_000,
    stripePriceId: 'price_placeholder_topup_20000',
  },
} as const;

export const VALID_TOP_UP_PACK_IDS = Object.keys(
  TOP_UP_PACK_MAP,
) as string[];
