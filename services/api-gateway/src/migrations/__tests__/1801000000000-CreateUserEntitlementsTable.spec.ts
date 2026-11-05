import { CreateUserEntitlementsTable1801000000000 } from '../1801000000000-CreateUserEntitlementsTable';

/**
 * Mocked SQL-shape tests only.
 * These do not connect to PostgreSQL and do not run the migration.
 */
describe('CreateUserEntitlementsTable1801000000000 (ACCESS-01B, mocked)', () => {
  function compact(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim();
  }

  function createRunner(): {
    migration: CreateUserEntitlementsTable1801000000000;
    executed: string[];
    queryRunner: {
      query: jest.Mock;
      startTransaction: jest.Mock;
      commitTransaction: jest.Mock;
      rollbackTransaction: jest.Mock;
    };
  } {
    const executed: string[] = [];
    const queryRunner = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      query: jest.fn(async (sql: string) => {
        executed.push(sql.trim());
        return [];
      }),
    };
    return {
      migration: new CreateUserEntitlementsTable1801000000000(),
      executed,
      queryRunner,
    };
  }

  const createTable = compact(`
    CREATE TABLE "user_entitlements" (
      "user_id" uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      "harness_enabled" boolean NOT NULL DEFAULT false,
      "agent_write_enabled" boolean NOT NULL DEFAULT false,
      "plan_override" varchar(50) NULL,
      "daily_token_limit_override" integer NULL,
      "updated_by" uuid NOT NULL,
      "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK ("daily_token_limit_override" IS NULL OR "daily_token_limit_override" > 0)
    )
  `);

  describe('up()', () => {
    it('creates the table with ON DELETE CASCADE and the positive limit CHECK', async () => {
      const { migration, executed, queryRunner } = createRunner();
      await migration.up(queryRunner as never);

      expect(executed.map(compact)).toEqual([createTable]);
      expect(executed.join('\n')).toContain(
        'REFERENCES users(id) ON DELETE CASCADE',
      );
      expect(executed.join('\n')).toContain(
        'CHECK ("daily_token_limit_override" IS NULL OR "daily_token_limit_override" > 0)',
      );
      expect(executed.some((sql) => /ALTER TABLE/i.test(sql))).toBe(false);
      expect(executed.some((sql) => /CREATE INDEX/i.test(sql))).toBe(false);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });
  });

  describe('down()', () => {
    it('drops the table and makes no transaction calls', async () => {
      const { migration, executed, queryRunner } = createRunner();
      await migration.down(queryRunner as never);

      expect(executed).toEqual(['DROP TABLE IF EXISTS "user_entitlements"']);
      expect(executed.some((sql) => /ALTER TABLE/i.test(sql))).toBe(false);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });
  });
});
