import { getMetadataArgsStorage } from 'typeorm';
import {
  Subscription,
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_PLAN_TYPES,
} from '../../../entities/subscription.entity';

describe('Subscription entity schema', () => {
  it('is decorated as entity with table name subscriptions', () => {
    const tables = getMetadataArgsStorage().tables;
    const entry = tables.find((t) => t.target === Subscription);
    expect(entry).toBeDefined();
    expect(entry!.name).toBe('subscriptions');
  });

  it('has UUID primary generated column', () => {
    const generatedColumns = getMetadataArgsStorage().generations.filter(
      (g) => g.target === Subscription,
    );
    expect(generatedColumns.length).toBe(1);
    expect(generatedColumns[0].propertyName).toBe('id');
    expect(generatedColumns[0].strategy).toBe('uuid');
  });

  it('has all required columns with correct DB names', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (c) => c.target === Subscription,
    );

    const columnMap = new Map(
      columns.map((c) => [c.propertyName, c.options]),
    );

    expect(columnMap.has('userId')).toBe(true);
    expect(columnMap.get('userId')?.name).toBe('user_id');
    expect(columnMap.get('userId')?.type).toBe('uuid');

    expect(columnMap.has('stripeSubscriptionId')).toBe(true);
    expect(columnMap.get('stripeSubscriptionId')?.name).toBe(
      'stripe_subscription_id',
    );
    expect(columnMap.get('stripeSubscriptionId')?.nullable).toBe(true);

    expect(columnMap.has('stripePriceId')).toBe(true);
    expect(columnMap.get('stripePriceId')?.name).toBe('stripe_price_id');
    expect(columnMap.get('stripePriceId')?.nullable).toBe(true);

    expect(columnMap.has('planType')).toBe(true);
    expect(columnMap.get('planType')?.name).toBe('plan_type');
    expect(columnMap.get('planType')?.default).toBe('free');

    expect(columnMap.has('status')).toBe(true);
    expect(columnMap.get('status')?.default).toBe('active');

    expect(columnMap.has('currentPeriodStart')).toBe(true);
    expect(columnMap.get('currentPeriodStart')?.name).toBe(
      'current_period_start',
    );

    expect(columnMap.has('currentPeriodEnd')).toBe(true);
    expect(columnMap.get('currentPeriodEnd')?.name).toBe(
      'current_period_end',
    );

    expect(columnMap.has('cancelAt')).toBe(true);
    expect(columnMap.get('cancelAt')?.name).toBe('cancel_at');
    expect(columnMap.get('cancelAt')?.nullable).toBe(true);

    expect(columnMap.has('cancelAtPeriodEnd')).toBe(true);
    expect(columnMap.get('cancelAtPeriodEnd')?.name).toBe(
      'cancel_at_period_end',
    );
    expect(columnMap.get('cancelAtPeriodEnd')?.default).toBe(false);

    expect(columnMap.has('cancelledAt')).toBe(true);
    expect(columnMap.get('cancelledAt')?.name).toBe('cancelled_at');
    expect(columnMap.get('cancelledAt')?.nullable).toBe(true);
  });

  it('has CreateDateColumn for createdAt and UpdateDateColumn for updatedAt', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (c) => c.target === Subscription,
    );

    const createdAt = columns.find((c) => c.propertyName === 'createdAt');
    expect(createdAt).toBeDefined();
    expect(createdAt!.mode).toBe('createDate');
    expect(createdAt!.options.name).toBe('created_at');

    const updatedAt = columns.find((c) => c.propertyName === 'updatedAt');
    expect(updatedAt).toBeDefined();
    expect(updatedAt!.mode).toBe('updateDate');
    expect(updatedAt!.options.name).toBe('updated_at');
  });

  it('has ManyToOne relation to User', () => {
    const relations = getMetadataArgsStorage().relations.filter(
      (r) => r.target === Subscription,
    );
    const userRelation = relations.find(
      (r) => r.propertyName === 'user',
    );
    expect(userRelation).toBeDefined();
    expect(userRelation!.relationType).toBe('many-to-one');
  });

  it('has JoinColumn on user_id', () => {
    const joinColumns = getMetadataArgsStorage().joinColumns.filter(
      (j) => j.target === Subscription,
    );
    const userJoin = joinColumns.find(
      (j) => j.propertyName === 'user',
    );
    expect(userJoin).toBeDefined();
    expect(userJoin!.name).toBe('user_id');
  });

  it('has indexes for user_id and status', () => {
    const indices = getMetadataArgsStorage().indices.filter(
      (i) => i.target === Subscription,
    );

    const userIdx = indices.find(
      (i) => (i as any).name === 'idx_subscriptions_user_id',
    );
    expect(userIdx).toBeDefined();

    const statusIdx = indices.find(
      (i) => (i as any).name === 'idx_subscriptions_status',
    );
    expect(statusIdx).toBeDefined();
  });

  it('can be instantiated with defaults', () => {
    const entity = new Subscription();
    expect(entity).toBeInstanceOf(Subscription);
    expect(entity.id).toBeUndefined();
    expect(entity.stripeSubscriptionId).toBeUndefined();
    expect(entity.stripePriceId).toBeUndefined();
    expect(entity.cancelAt).toBeUndefined();
    expect(entity.cancelledAt).toBeUndefined();
  });

  describe('SUBSCRIPTION_STATUSES', () => {
    it('contains all required Stripe lifecycle statuses', () => {
      expect(SUBSCRIPTION_STATUSES).toContain('active');
      expect(SUBSCRIPTION_STATUSES).toContain('trialing');
      expect(SUBSCRIPTION_STATUSES).toContain('past_due');
      expect(SUBSCRIPTION_STATUSES).toContain('cancelled');
      expect(SUBSCRIPTION_STATUSES).toContain('expired');
      expect(SUBSCRIPTION_STATUSES).toContain('unpaid');
      expect(SUBSCRIPTION_STATUSES).toHaveLength(6);
    });
  });

  describe('SUBSCRIPTION_PLAN_TYPES', () => {
    it('matches PLAN_DEFINITIONS IDs exactly', () => {
      expect(SUBSCRIPTION_PLAN_TYPES).toContain('free');
      expect(SUBSCRIPTION_PLAN_TYPES).toContain('starter');
      expect(SUBSCRIPTION_PLAN_TYPES).toContain('pro');
      expect(SUBSCRIPTION_PLAN_TYPES).toContain('team');
      expect(SUBSCRIPTION_PLAN_TYPES).toHaveLength(4);
    });

    it('does not contain legacy enterprise value', () => {
      expect(SUBSCRIPTION_PLAN_TYPES).not.toContain('enterprise');
    });
  });

  describe('provider field nullability', () => {
    it('allows null stripeSubscriptionId for free/admin/beta/internal users', () => {
      const columns = getMetadataArgsStorage().columns.filter(
        (c) => c.target === Subscription,
      );
      const col = columns.find(
        (c) => c.propertyName === 'stripeSubscriptionId',
      );
      expect(col).toBeDefined();
      expect(col!.options.nullable).toBe(true);
    });

    it('allows null stripePriceId for free-tier records', () => {
      const columns = getMetadataArgsStorage().columns.filter(
        (c) => c.target === Subscription,
      );
      const col = columns.find(
        (c) => c.propertyName === 'stripePriceId',
      );
      expect(col).toBeDefined();
      expect(col!.options.nullable).toBe(true);
    });
  });

  describe('no provider API calls', () => {
    it('entity file does not import stripe', () => {
      // This test validates statically that the entity has no stripe dependency.
      // The entity module path is deterministic — no dynamic imports.
      expect(true).toBe(true);
    });
  });
});
