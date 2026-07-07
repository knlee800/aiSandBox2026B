import { CreateCreditBalanceAndDeductionTables1772100000000 } from '../../../migrations/1772100000000-CreateCreditBalanceAndDeductionTables';

describe('CreateCreditBalanceAndDeductionTables migration', () => {
  let migration: CreateCreditBalanceAndDeductionTables1772100000000;
  let executedQueries: string[];
  let mockQueryRunner: { query: jest.Mock };

  beforeEach(() => {
    migration = new CreateCreditBalanceAndDeductionTables1772100000000();
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

    it('creates credit_balances table', () => {
      const createTable = executedQueries.find((q) =>
        q.includes('CREATE TABLE "credit_balances"'),
      );
      expect(createTable).toBeDefined();
    });

    it('creates credit_deduction_records table', () => {
      const createTable = executedQueries.find((q) =>
        q.includes('CREATE TABLE "credit_deduction_records"'),
      );
      expect(createTable).toBeDefined();
    });

    it('credit_balances has all required columns', () => {
      const sql = executedQueries.find((q) =>
        q.includes('CREATE TABLE "credit_balances"'),
      )!;
      expect(sql).toContain('"id" uuid PRIMARY KEY');
      expect(sql).toContain('"owner_id" VARCHAR(50) NOT NULL');
      expect(sql).toContain('"owner_type" VARCHAR(20) NOT NULL');
      expect(sql).toContain('"plan_id" VARCHAR(50) NOT NULL');
      expect(sql).toContain('"balance" INTEGER NOT NULL DEFAULT 0');
      expect(sql).toContain('"monthly_allocation" INTEGER NOT NULL DEFAULT 0');
      expect(sql).toContain('"rollover_balance" INTEGER NOT NULL DEFAULT 0');
      expect(sql).toContain('"status" VARCHAR(20) NOT NULL');
      expect(sql).toContain('"period_start" TIMESTAMP NOT NULL');
      expect(sql).toContain('"period_end" TIMESTAMP NOT NULL');
      expect(sql).toContain('"reset_at" TIMESTAMP NULL');
      expect(sql).toContain('"created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
      expect(sql).toContain('"updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
    });

    it('credit_balances has check constraints', () => {
      const sql = executedQueries.find((q) =>
        q.includes('CREATE TABLE "credit_balances"'),
      )!;
      expect(sql).toContain('chk_credit_balances_balance_non_negative');
      expect(sql).toContain('"balance" >= 0');
      expect(sql).toContain('chk_credit_balances_period_valid');
      expect(sql).toContain('"period_start" < "period_end"');
    });

    it('credit_deduction_records has all required columns', () => {
      const sql = executedQueries.find((q) =>
        q.includes('CREATE TABLE "credit_deduction_records"'),
      )!;
      expect(sql).toContain('"id" uuid PRIMARY KEY');
      expect(sql).toContain('"owner_id" VARCHAR(50) NOT NULL');
      expect(sql).toContain('"source_event_id" VARCHAR(255) NOT NULL');
      expect(sql).toContain('"source_event_type" VARCHAR(50) NOT NULL');
      expect(sql).toContain('"agent_id" VARCHAR(100) NULL');
      expect(sql).toContain('"session_id" uuid NULL');
      expect(sql).toContain('"execution_id" uuid NULL');
      expect(sql).toContain('"model_id" VARCHAR(100) NULL');
      expect(sql).toContain('"requested_credits" INTEGER NOT NULL DEFAULT 0');
      expect(sql).toContain('"applied_credits" INTEGER NOT NULL DEFAULT 0');
      expect(sql).toContain('"overflow_credits" INTEGER NOT NULL DEFAULT 0');
      expect(sql).toContain('"balance_before" INTEGER NOT NULL');
      expect(sql).toContain('"balance_after" INTEGER NOT NULL');
      expect(sql).toContain('"line_items" JSONB NOT NULL');
      expect(sql).toContain('"metadata" JSONB NULL');
      expect(sql).toContain('"status" VARCHAR(20) NOT NULL');
      expect(sql).toContain('"created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
    });

    it('credit_deduction_records has check constraints', () => {
      const sql = executedQueries.find((q) =>
        q.includes('CREATE TABLE "credit_deduction_records"'),
      )!;
      expect(sql).toContain('chk_credit_deduction_records_credits_non_negative');
      expect(sql).toContain(
        '"requested_credits" >= 0 AND "applied_credits" >= 0 AND "overflow_credits" >= 0',
      );
      expect(sql).toContain('chk_credit_deduction_records_balance_consistency');
      expect(sql).toContain('"balance_before" >= "balance_after"');
    });

    it('creates unique index on credit_balances (owner_id, owner_type)', () => {
      const idx = executedQueries.find((q) =>
        q.includes('idx_credit_balances_owner'),
      );
      expect(idx).toBeDefined();
      expect(idx).toContain('UNIQUE INDEX');
      expect(idx).toContain('"owner_id", "owner_type"');
    });

    it('creates index on credit_balances status', () => {
      const idx = executedQueries.find((q) =>
        q.includes('idx_credit_balances_status'),
      );
      expect(idx).toBeDefined();
      expect(idx).toContain('"status"');
    });

    it('creates partial index on credit_balances reset_at', () => {
      const idx = executedQueries.find((q) =>
        q.includes('idx_credit_balances_reset_at'),
      );
      expect(idx).toBeDefined();
      expect(idx).toContain('WHERE "reset_at" IS NOT NULL');
    });

    it('creates unique index on source_event_id for idempotency', () => {
      const idx = executedQueries.find((q) =>
        q.includes('idx_credit_deduction_records_source_event'),
      );
      expect(idx).toBeDefined();
      expect(idx).toContain('UNIQUE INDEX');
      expect(idx).toContain('"source_event_id"');
    });

    it('creates owner_created composite index with DESC ordering', () => {
      const idx = executedQueries.find((q) =>
        q.includes('idx_credit_deduction_records_owner_created'),
      );
      expect(idx).toBeDefined();
      expect(idx).toContain('"owner_id", "created_at" DESC');
    });

    it('creates owner_status composite index', () => {
      const idx = executedQueries.find((q) =>
        q.includes('idx_credit_deduction_records_owner_status'),
      );
      expect(idx).toBeDefined();
      expect(idx).toContain('"owner_id", "status"');
    });

    it('creates partial index on session_id', () => {
      const idx = executedQueries.find((q) =>
        q.includes('idx_credit_deduction_records_session'),
      );
      expect(idx).toBeDefined();
      expect(idx).toContain('WHERE "session_id" IS NOT NULL');
    });

    it('creates partial index on execution_id', () => {
      const idx = executedQueries.find((q) =>
        q.includes('idx_credit_deduction_records_execution'),
      );
      expect(idx).toBeDefined();
      expect(idx).toContain('WHERE "execution_id" IS NOT NULL');
    });

    it('creates index on created_at', () => {
      const idx = executedQueries.find((q) =>
        q.includes('idx_credit_deduction_records_created_at'),
      );
      expect(idx).toBeDefined();
    });

    it('uses gen_random_uuid() for UUID defaults (not uuid_generate_v4)', () => {
      const allSql = executedQueries.join('\n');
      expect(allSql).toContain('gen_random_uuid()');
      expect(allSql).not.toContain('uuid_generate_v4()');
    });
  });

  describe('down()', () => {
    beforeEach(async () => {
      await migration.down(mockQueryRunner as any);
    });

    it('drops all indexes before tables', () => {
      const dropIndexQueries = executedQueries.filter((q) =>
        q.includes('DROP INDEX'),
      );
      const dropTableQueries = executedQueries.filter((q) =>
        q.includes('DROP TABLE'),
      );

      expect(dropIndexQueries.length).toBe(9);
      expect(dropTableQueries.length).toBe(2);

      const lastDropIndex = executedQueries.lastIndexOf(
        dropIndexQueries[dropIndexQueries.length - 1],
      );
      const firstDropTable = executedQueries.indexOf(dropTableQueries[0]);
      expect(lastDropIndex).toBeLessThan(firstDropTable);
    });

    it('drops credit_deduction_records before credit_balances', () => {
      const dropRecords = executedQueries.findIndex((q) =>
        q.includes('DROP TABLE IF EXISTS "credit_deduction_records"'),
      );
      const dropBalances = executedQueries.findIndex((q) =>
        q.includes('DROP TABLE IF EXISTS "credit_balances"'),
      );
      expect(dropRecords).toBeLessThan(dropBalances);
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
