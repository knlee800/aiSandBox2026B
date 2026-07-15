import { AlignSubscriptionsTableWithTypeORM1772200000000 } from '../../../migrations/1772200000000-AlignSubscriptionsTableWithTypeORM';
import { AddStripeCustomerIdUniqueIndex1772200100000 } from '../../../migrations/1772200100000-AddStripeCustomerIdUniqueIndex';

describe('AlignSubscriptionsTableWithTypeORM migration', () => {
  let migration: AlignSubscriptionsTableWithTypeORM1772200000000;
  let executedQueries: string[];
  let mockQueryRunner: { query: jest.Mock };

  beforeEach(() => {
    migration = new AlignSubscriptionsTableWithTypeORM1772200000000();
    executedQueries = [];
    mockQueryRunner = {
      query: jest.fn((sql: string) => {
        executedQueries.push(sql.trim());
        return Promise.resolve();
      }),
    };
  });

  describe('up()', () => {
    beforeEach(async () => {
      await migration.up(mockQueryRunner as any);
    });

    it('creates subscriptions table with IF NOT EXISTS', () => {
      const createTable = executedQueries.find((q) =>
        q.includes('CREATE TABLE IF NOT EXISTS "subscriptions"'),
      );
      expect(createTable).toBeDefined();
    });

    it('table definition includes all required columns', () => {
      const sql = executedQueries.find((q) =>
        q.includes('CREATE TABLE IF NOT EXISTS "subscriptions"'),
      )!;
      expect(sql).toContain('"id" uuid PRIMARY KEY');
      expect(sql).toContain('"user_id" uuid NOT NULL');
      expect(sql).toContain('"stripe_subscription_id" VARCHAR(255)');
      expect(sql).toContain('"stripe_price_id" VARCHAR(255)');
      expect(sql).toContain('"plan_type" VARCHAR(50) NOT NULL');
      expect(sql).toContain('"status" VARCHAR(20) NOT NULL');
      expect(sql).toContain('"current_period_start" TIMESTAMPTZ NOT NULL');
      expect(sql).toContain('"current_period_end" TIMESTAMPTZ NOT NULL');
      expect(sql).toContain('"cancel_at" TIMESTAMPTZ');
      expect(sql).toContain('"cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false');
      expect(sql).toContain('"cancelled_at" TIMESTAMPTZ');
      expect(sql).toContain('"created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()');
      expect(sql).toContain('"updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()');
    });

    it('uses gen_random_uuid() for UUID default', () => {
      const sql = executedQueries.find((q) =>
        q.includes('CREATE TABLE IF NOT EXISTS "subscriptions"'),
      )!;
      expect(sql).toContain('gen_random_uuid()');
    });

    it('adds FK constraint to users with IF NOT EXISTS guard', () => {
      const fk = executedQueries.find((q) =>
        q.includes('fk_subscriptions_user_id'),
      );
      expect(fk).toBeDefined();
      expect(fk).toContain('IF NOT EXISTS');
      expect(fk).toContain('REFERENCES "users"("id")');
      expect(fk).toContain('ON DELETE CASCADE');
    });

    it('adds missing columns with IF NOT EXISTS', () => {
      const addColumns = executedQueries.filter((q) =>
        q.includes('ADD COLUMN IF NOT EXISTS'),
      );
      expect(addColumns.length).toBeGreaterThanOrEqual(5);

      const columnNames = addColumns.map((q) => q);
      expect(columnNames.some((q) => q.includes('"stripe_price_id"'))).toBe(true);
      expect(columnNames.some((q) => q.includes('"cancel_at_period_end"'))).toBe(true);
      expect(columnNames.some((q) => q.includes('"cancelled_at"'))).toBe(true);
      expect(columnNames.some((q) => q.includes('"created_at"'))).toBe(true);
      expect(columnNames.some((q) => q.includes('"updated_at"'))).toBe(true);
    });

    it('updates plan_type CHECK to match PLAN_DEFINITIONS (free, starter, pro, team)', () => {
      const dropOld = executedQueries.find(
        (q) =>
          q.includes('DROP CONSTRAINT') &&
          q.includes('subscriptions_plan_type_check'),
      );
      expect(dropOld).toBeDefined();

      const addNew = executedQueries.find(
        (q) =>
          q.includes('ADD CONSTRAINT') &&
          q.includes('subscriptions_plan_type_check') &&
          q.includes("'free'") &&
          q.includes("'starter'") &&
          q.includes("'pro'") &&
          q.includes("'team'"),
      );
      expect(addNew).toBeDefined();
    });

    it('plan_type CHECK does not contain legacy enterprise value', () => {
      const addConstraint = executedQueries.find(
        (q) =>
          q.includes('ADD CONSTRAINT') &&
          q.includes('subscriptions_plan_type_check'),
      );
      expect(addConstraint).not.toContain("'enterprise'");
    });

    it('updates status CHECK to full lifecycle set', () => {
      const addNew = executedQueries.find(
        (q) =>
          q.includes('ADD CONSTRAINT') &&
          q.includes('subscriptions_status_check') &&
          q.includes("'active'") &&
          q.includes("'trialing'") &&
          q.includes("'past_due'") &&
          q.includes("'cancelled'") &&
          q.includes("'expired'") &&
          q.includes("'unpaid'"),
      );
      expect(addNew).toBeDefined();
    });

    it('creates unique partial index on stripe_subscription_id', () => {
      const idx = executedQueries.find((q) =>
        q.includes('idx_subscriptions_stripe_subscription_id'),
      );
      expect(idx).toBeDefined();
      expect(idx).toContain('UNIQUE INDEX');
      expect(idx).toContain('"stripe_subscription_id"');
      expect(idx).toContain('WHERE "stripe_subscription_id" IS NOT NULL');
    });

    it('creates partial unique index for one active subscription per user', () => {
      const idx = executedQueries.find((q) =>
        q.includes('idx_subscriptions_one_active_per_user'),
      );
      expect(idx).toBeDefined();
      expect(idx).toContain('UNIQUE INDEX');
      expect(idx).toContain('"user_id"');
      expect(idx).toContain("'active'");
      expect(idx).toContain("'trialing'");
      expect(idx).toContain("'past_due'");
    });

    it('creates user_id and status indexes', () => {
      const userIdx = executedQueries.find(
        (q) =>
          q.includes('idx_subscriptions_user_id') &&
          !q.includes('one_active'),
      );
      expect(userIdx).toBeDefined();

      const statusIdx = executedQueries.find(
        (q) =>
          q.includes('idx_subscriptions_status') &&
          !q.includes('user'),
      );
      expect(statusIdx).toBeDefined();
    });

    it('uses IF NOT EXISTS for all indexes', () => {
      const indexQueries = executedQueries.filter((q) =>
        q.includes('CREATE') && q.includes('INDEX'),
      );
      for (const q of indexQueries) {
        expect(q).toContain('IF NOT EXISTS');
      }
    });
  });

  describe('down()', () => {
    beforeEach(async () => {
      await migration.down(mockQueryRunner as any);
    });

    it('drops all indexes', () => {
      const dropIndexQueries = executedQueries.filter((q) =>
        q.includes('DROP INDEX IF EXISTS'),
      );
      expect(dropIndexQueries.length).toBe(4);
    });

    it('restores original CHECK constraints', () => {
      const planCheck = executedQueries.find(
        (q) =>
          q.includes('ADD CONSTRAINT') &&
          q.includes('subscriptions_plan_type_check') &&
          q.includes("'enterprise'"),
      );
      expect(planCheck).toBeDefined();

      const statusCheck = executedQueries.find(
        (q) =>
          q.includes('ADD CONSTRAINT') &&
          q.includes('subscriptions_status_check') &&
          q.includes("'active'") &&
          q.includes("'cancelled'") &&
          q.includes("'past_due'"),
      );
      expect(statusCheck).toBeDefined();
    });

    it('drops added columns', () => {
      const dropColumns = executedQueries.filter((q) =>
        q.includes('DROP COLUMN IF EXISTS'),
      );
      expect(dropColumns.length).toBe(5);
    });

    it('drops FK constraint', () => {
      const dropFk = executedQueries.find((q) =>
        q.includes('DROP CONSTRAINT IF EXISTS "fk_subscriptions_user_id"'),
      );
      expect(dropFk).toBeDefined();
    });

    it('uses IF EXISTS for safe rollback', () => {
      for (const q of executedQueries) {
        if (q.includes('DROP')) {
          expect(q).toContain('IF EXISTS');
        }
      }
    });
  });
});

describe('AddStripeCustomerIdUniqueIndex migration', () => {
  let migration: AddStripeCustomerIdUniqueIndex1772200100000;
  let executedQueries: string[];
  let mockQueryRunner: { query: jest.Mock };

  beforeEach(() => {
    migration = new AddStripeCustomerIdUniqueIndex1772200100000();
    executedQueries = [];
    mockQueryRunner = {
      query: jest.fn((sql: string) => {
        executedQueries.push(sql.trim());
        return Promise.resolve();
      }),
    };
  });

  describe('up()', () => {
    beforeEach(async () => {
      await migration.up(mockQueryRunner as any);
    });

    it('creates unique partial index on users.stripe_customer_id', () => {
      expect(executedQueries).toHaveLength(1);
      const sql = executedQueries[0];
      expect(sql).toContain('UNIQUE INDEX');
      expect(sql).toContain('idx_users_stripe_customer_id');
      expect(sql).toContain('"users"');
      expect(sql).toContain('"stripe_customer_id"');
      expect(sql).toContain('WHERE "stripe_customer_id" IS NOT NULL');
    });

    it('uses IF NOT EXISTS for idempotency', () => {
      expect(executedQueries[0]).toContain('IF NOT EXISTS');
    });
  });

  describe('down()', () => {
    beforeEach(async () => {
      await migration.down(mockQueryRunner as any);
    });

    it('drops the index', () => {
      expect(executedQueries).toHaveLength(1);
      expect(executedQueries[0]).toContain('DROP INDEX IF EXISTS');
      expect(executedQueries[0]).toContain('idx_users_stripe_customer_id');
    });
  });
});
