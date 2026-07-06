import { PLAN_DEFINITIONS } from '../config/plan-definitions.config';
import { MONTHLY_CREDIT_ALLOCATIONS, PLAN_IDS } from '../types';

describe('plan-definitions.config', () => {
  it('contains all four plans', () => {
    expect(PLAN_DEFINITIONS).toHaveLength(4);
    expect(PLAN_DEFINITIONS.map((plan) => plan.id)).toEqual([...PLAN_IDS]);
  });

  it('has unique plan ids', () => {
    const ids = PLAN_DEFINITIONS.map((plan) => plan.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps plan order stable', () => {
    expect(PLAN_DEFINITIONS.map((plan) => plan.id)).toEqual([
      'free',
      'starter',
      'pro',
      'team',
    ]);
    expect(PLAN_DEFINITIONS.map((plan) => plan.order)).toEqual([1, 2, 3, 4]);
  });

  it('uses positive monthly credits with expected allocations', () => {
    for (const plan of PLAN_DEFINITIONS) {
      expect(plan.monthlyCredits).toBeGreaterThan(0);
    }

    const allocationByPlan = Object.fromEntries(
      PLAN_DEFINITIONS.map((plan) => [plan.id, plan.monthlyCredits]),
    );

    expect(allocationByPlan).toEqual({
      free: MONTHLY_CREDIT_ALLOCATIONS.free,
      starter: MONTHLY_CREDIT_ALLOCATIONS.starter,
      pro: MONTHLY_CREDIT_ALLOCATIONS.pro,
      team: MONTHLY_CREDIT_ALLOCATIONS.team,
    });
  });

  it('gives Free and Starter builder-only access', () => {
    const freePlan = PLAN_DEFINITIONS.find((plan) => plan.id === 'free');
    const starterPlan = PLAN_DEFINITIONS.find((plan) => plan.id === 'starter');

    expect(freePlan).toBeDefined();
    expect(starterPlan).toBeDefined();

    for (const plan of [freePlan, starterPlan]) {
      expect(plan?.includedEntitlements.agentAccess.accessTier).toBe(
        'builder_only',
      );
      expect(plan?.includedEntitlements.agentAccess.allowedAgentIds).toEqual([
        'builder',
      ]);
      expect(
        plan?.includedEntitlements.agentAccess.futureSpecialistAllowance,
      ).toBe(0);
    }
  });

  it('gives Pro builder access plus one future specialist allowance', () => {
    const proPlan = PLAN_DEFINITIONS.find((plan) => plan.id === 'pro');

    expect(proPlan).toBeDefined();
    expect(proPlan?.includedEntitlements.agentAccess.accessTier).toBe(
      'builder_plus_one_future_specialist',
    );
    expect(proPlan?.includedEntitlements.agentAccess.allowedAgentIds).toContain(
      'builder',
    );
    expect(
      proPlan?.includedEntitlements.agentAccess.futureSpecialistAllowance,
    ).toBe(1);
  });

  it('gives Team all current and future agent access', () => {
    const teamPlan = PLAN_DEFINITIONS.find((plan) => plan.id === 'team');

    expect(teamPlan).toBeDefined();
    expect(teamPlan?.includedEntitlements.agentAccess.accessTier).toBe(
      'all_current_and_future',
    );
    expect(teamPlan?.includedEntitlements.agentAccess.allowedAgentIds).toContain(
      '*',
    );
  });

  it('does not require Stripe/payment fields', () => {
    for (const plan of PLAN_DEFINITIONS) {
      expect(Object.prototype.hasOwnProperty.call(plan, 'stripePriceId')).toBe(
        false,
      );
      expect(
        Object.prototype.hasOwnProperty.call(plan, 'stripeProductId'),
      ).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(plan, 'paymentProvider')).toBe(
        false,
      );
      expect(Object.prototype.hasOwnProperty.call(plan, 'paymentMethod')).toBe(
        false,
      );
    }
  });
});
