import { MONTHLY_CREDIT_ALLOCATIONS } from '../../../credit-ledger/types/plan-definition';
import {
  BackfillCreditBalancesForExistingUsers1772700000000,
  FROZEN_MONTHLY_CREDIT_ALLOCATIONS,
} from '../../../migrations/1772700000000-BackfillCreditBalancesForExistingUsers';

describe('BackfillCreditBalancesForExistingUsers migration', () => {
  const normalizeSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim();

  let migration: BackfillCreditBalancesForExistingUsers1772700000000;
  let executedQueries: string[];
  let mockQueryRunner: { query: jest.Mock };

  beforeEach(() => {
    migration = new BackfillCreditBalancesForExistingUsers1772700000000();
    executedQueries = [];
    mockQueryRunner = {
      query: jest.fn((sql: string) => {
        executedQueries.push(normalizeSql(sql));
        return Promise.resolve({ rowCount: 0 });
      }),
    };
  });

  describe('up()', () => {
    let sql: string;

    beforeEach(async () => {
      await migration.up(mockQueryRunner as any);
      expect(executedQueries).toHaveLength(1);
      sql = executedQueries[0];
    });

    it('inserts only users missing a user-owned credit balance', () => {
      expect(sql).toContain('INSERT INTO "credit_balances"');
      expect(sql).toContain('FROM "users" u');
      expect(sql).toContain('AND NOT EXISTS (');
      expect(sql).toContain('FROM "credit_balances" cb');
      expect(sql).toContain('cb."owner_id" = u."id"::text');
      expect(sql).toContain('cb."owner_type" = \'user\'');
    });

    it('uses the approved frozen supported-plan allocations', () => {
      expect(sql).toContain("WHEN 'free' THEN 500");
      expect(sql).toContain("WHEN 'starter' THEN 5000");
      expect(sql).toContain("WHEN 'pro' THEN 25000");
      expect(sql).toContain("WHEN 'team' THEN 100000");

      expect(sql.match(/WHEN 'free' THEN 500/g)).toHaveLength(2);
      expect(sql.match(/WHEN 'starter' THEN 5000/g)).toHaveLength(2);
      expect(sql.match(/WHEN 'pro' THEN 25000/g)).toHaveLength(2);
      expect(sql.match(/WHEN 'team' THEN 100000/g)).toHaveLength(2);

      expect(FROZEN_MONTHLY_CREDIT_ALLOCATIONS).toEqual({
        free: MONTHLY_CREDIT_ALLOCATIONS.free,
        starter: MONTHLY_CREDIT_ALLOCATIONS.starter,
        pro: MONTHLY_CREDIT_ALLOCATIONS.pro,
        team: MONTHLY_CREDIT_ALLOCATIONS.team,
      });
    });

    it('preserves existing balances and excludes them from insertion', () => {
      expect(sql).toContain('NOT EXISTS');
      expect(sql).toContain('FROM "credit_balances" cb');
      expect(sql).not.toMatch(/\bUPDATE\s+"credit_balances"\b/i);
      expect(sql).not.toMatch(/\bDELETE\s+FROM\s+"credit_balances"\b/i);
    });

    it('excludes unsupported plans and ineligible users', () => {
      expect(sql).toContain('u."is_active" = true');
      expect(sql).toContain('u."role" IN (\'user\', \'beta\')');
      expect(sql).toContain(
        'u."plan_type" IN (\'free\', \'starter\', \'pro\', \'team\')',
      );
      expect(sql).not.toContain('ELSE');
    });

    it('is idempotent through NOT EXISTS and exact owner conflict protection', () => {
      expect(sql).toContain('NOT EXISTS');
      expect(sql).toContain(
        'ON CONFLICT ("owner_id", "owner_type") DO NOTHING',
      );
      expect(sql).not.toContain('ON CONFLICT DO NOTHING');
    });

    it('populates UTC current-month and next-month period boundaries', () => {
      expect(sql).toContain(`date_trunc('month', now() AT TIME ZONE 'UTC')`);
      expect(sql).toContain(
        `date_trunc('month', now() AT TIME ZONE 'UTC') + interval '1 month'`,
      );
    });

    it('does not update or delete users, balances, grants, or deductions', () => {
      expect(sql).not.toMatch(/\bUPDATE\s+"users"\b/i);
      expect(sql).not.toMatch(/\bDELETE\s+FROM\s+"users"\b/i);
      expect(sql).not.toMatch(/\bUPDATE\s+"credit_balances"\b/i);
      expect(sql).not.toMatch(/\bDELETE\s+FROM\s+"credit_balances"\b/i);
      expect(sql).not.toMatch(
        /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+"credit_grants"\b/i,
      );
      expect(sql).not.toMatch(
        /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+"credit_deduction_records"\b/i,
      );
    });
  });

  describe('down()', () => {
    it('is a successful no-op with no query execution', async () => {
      await expect(migration.down(mockQueryRunner as any)).resolves.toBeUndefined();
      expect(mockQueryRunner.query).not.toHaveBeenCalled();
    });
  });
});
