import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * COLLAB-AUDIT-01: Append-only audit_events.
 * user_id has no foreign key: a cascade delete would conflict with the
 * trigger that refuses UPDATE and DELETE.
 * Rows are immutable. down() drops the trigger, function, index, then table.
 */
export class CreateAuditEventsTable1800000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
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

    await queryRunner.query(
      `CREATE INDEX "idx_audit_events_subject_occurred" ON "audit_events" ("subject_type", "subject_id", "occurred_at")`,
    );

    await queryRunner.query(`
      CREATE FUNCTION "audit_events_refuse_change"()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'audit_events rows are immutable';
      END;
      $$
    `);

    await queryRunner.query(`
      CREATE TRIGGER "trg_audit_events_refuse_change"
      BEFORE UPDATE OR DELETE ON "audit_events"
      FOR EACH ROW
      EXECUTE FUNCTION "audit_events_refuse_change"()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "trg_audit_events_refuse_change" ON "audit_events"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS "audit_events_refuse_change"()`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_audit_events_subject_occurred"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_events"`);
  }
}
