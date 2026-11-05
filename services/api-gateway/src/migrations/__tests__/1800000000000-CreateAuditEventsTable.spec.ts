import { CreateAuditEventsTable1800000000000 } from '../1800000000000-CreateAuditEventsTable';

/**
 * Mocked SQL-shape tests only.
 * These do not connect to PostgreSQL and do not run the migration.
 */
describe('CreateAuditEventsTable1800000000000 (COLLAB-AUDIT-01, mocked)', () => {
  function compact(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim();
  }

  function createRunner(): {
    migration: CreateAuditEventsTable1800000000000;
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
      migration: new CreateAuditEventsTable1800000000000(),
      executed,
      queryRunner,
    };
  }

  const createTable = compact(`
    CREATE TABLE "audit_events" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "category" VARCHAR(32) NOT NULL,
      "event_type" VARCHAR(64) NOT NULL,
      "subject_type" VARCHAR(32) NOT NULL,
      "subject_id" VARCHAR(64) NOT NULL,
      "user_id" uuid NULL,
      "payload" JSONB NOT NULL,
      "occurred_at" TIMESTAMPTZ NOT NULL,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const subjectIndex =
    'CREATE INDEX "idx_audit_events_subject_occurred" ON "audit_events" ("subject_type", "subject_id", "occurred_at")';
  const refuseFunction = compact(`
    CREATE FUNCTION "audit_events_refuse_change"()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'audit_events rows are immutable';
    END;
    $$
  `);
  const refuseTrigger = compact(`
    CREATE TRIGGER "trg_audit_events_refuse_change"
    BEFORE UPDATE OR DELETE ON "audit_events"
    FOR EACH ROW
    EXECUTE FUNCTION "audit_events_refuse_change"()
  `);

  describe('up()', () => {
    it('creates the table, subject index, refuse function and trigger', async () => {
      const { migration, executed, queryRunner } = createRunner();
      await migration.up(queryRunner as never);

      expect(executed.map(compact)).toEqual([
        createTable,
        subjectIndex,
        refuseFunction,
        refuseTrigger,
      ]);
      expect(executed.join('\n')).toContain('"user_id" uuid NULL');
      expect(executed.join('\n')).not.toMatch(/REFERENCES|FOREIGN KEY/i);
      expect(executed.some((sql) => /ALTER TABLE/i.test(sql))).toBe(false);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });
  });

  describe('down()', () => {
    it('drops the trigger, function, index and then the table', async () => {
      const { migration, executed, queryRunner } = createRunner();
      await migration.down(queryRunner as never);

      expect(executed).toEqual([
        'DROP TRIGGER IF EXISTS "trg_audit_events_refuse_change" ON "audit_events"',
        'DROP FUNCTION IF EXISTS "audit_events_refuse_change"()',
        'DROP INDEX IF EXISTS "idx_audit_events_subject_occurred"',
        'DROP TABLE IF EXISTS "audit_events"',
      ]);
      expect(executed.some((sql) => /ALTER TABLE/i.test(sql))).toBe(false);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });
  });
});
