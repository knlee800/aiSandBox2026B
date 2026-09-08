import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AGENT-PLATFORM-EXEC-01C-SCHEMA-01
 *
 * Additive create of the base public.api_keys table required by
 * AGENT-PLATFORM-EXEC-01C-IDENTITY-01 (is_internal column) and DB API-key auth.
 *
 * Timestamp 1772950000000 is after AddAdminGrantAuditColumns1772900000000 and
 * before AddInternalAccessToApiKeys1773000000000. IDENTITY-01 remains responsible
 * for adding is_internal. This migration must not create that column.
 *
 * Existing-table policy: fail closed with an actionable diagnostic.
 * Do not use CREATE TABLE IF NOT EXISTS. Do not silently adopt an unknown table.
 * Omitting IF EXISTS does not prove this migration created the relation; provenance
 * is TypeORM migration history plus the refusal to adopt a pre-existing table.
 *
 * Rollback: dropping a populated api_keys table is data-loss, not harmless.
 * down() requires the runner's open transaction, takes ACCESS EXCLUSIVE NOWAIT,
 * then refuses DROP when any rows exist. This class does not commit or roll back
 * the QueryRunner transaction.
 */
export class CreateApiKeysTable1772950000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'api_keys'
      ) AS "table_exists"
    `);

    if (CreateApiKeysTable1772950000000.tableExists(existing)) {
      throw new Error(
        [
          'AGENT-PLATFORM-EXEC-01C-SCHEMA-01: public.api_keys already exists.',
          'Refusing to adopt an unknown table.',
          'CREATE TABLE IF NOT EXISTS is forbidden here so a pre-existing relation cannot be recorded as this migration\'s create.',
          'Inspect before retrying:',
          `  SELECT column_name, data_type, column_default, is_nullable`,
          `    FROM information_schema.columns`,
          `    WHERE table_schema = 'public' AND table_name = 'api_keys'`,
          `    ORDER BY ordinal_position;`,
          `  SELECT conname, pg_get_constraintdef(oid)`,
          `    FROM pg_constraint`,
          `    WHERE conrelid = 'public.api_keys'::regclass;`,
          `  SELECT indexname, indexdef`,
          `    FROM pg_indexes`,
          `    WHERE schemaname = 'public' AND tablename = 'api_keys';`,
        ].join(' '),
      );
    }

    await queryRunner.query(`
      CREATE TABLE "public"."api_keys" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "hashed_key" character varying(255) NOT NULL,
        "key_prefix" character varying(20) NOT NULL,
        "user_id" uuid NOT NULL,
        "scopes" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "revoked_at" TIMESTAMP NULL,
        CONSTRAINT "fk_api_keys_user"
          FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_api_key_hashed" ON "public"."api_keys" ("hashed_key")`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_api_key_user_id" ON "public"."api_keys" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    CreateApiKeysTable1772950000000.assertActiveTransaction(queryRunner);

    await queryRunner.query(
      `LOCK TABLE "public"."api_keys" IN ACCESS EXCLUSIVE MODE NOWAIT`,
    );

    const counts = await queryRunner.query(`
      SELECT COUNT(*)::int AS "row_count" FROM "public"."api_keys"
    `);
    const rowCount = CreateApiKeysTable1772950000000.parseRowCount(counts);

    if (rowCount > 0) {
      throw new Error(
        [
          `AGENT-PLATFORM-EXEC-01C-SCHEMA-01 down(): refusing to DROP populated public.api_keys (${rowCount} rows).`,
          'Dropping a populated API-key table is data-loss, not a harmless rollback.',
          'Restore from a verified pre-apply Lightsail snapshot, or obtain explicit authorization to destroy API-key rows.',
          'Provenance is TypeORM migration history, not the absence of IF EXISTS.',
          'This class does not commit or roll back the QueryRunner transaction.',
        ].join(' '),
      );
    }

    await queryRunner.query(`DROP INDEX "public"."idx_api_key_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_api_key_hashed"`);
    await queryRunner.query(`DROP TABLE "public"."api_keys"`);
  }

  private static assertActiveTransaction(queryRunner: QueryRunner): void {
    if (queryRunner.isTransactionActive !== true) {
      throw new Error(
        [
          'AGENT-PLATFORM-EXEC-01C-SCHEMA-01 down(): no active QueryRunner transaction.',
          'Refusing rollback SQL so ACCESS EXCLUSIVE cannot be taken or released outside the runner-owned transaction.',
          'This class does not start, commit, or roll back that transaction.',
        ].join(' '),
      );
    }
  }

  private static tableExists(rows: unknown): boolean {
    if (!Array.isArray(rows) || rows.length === 0) {
      return false;
    }
    const value = (rows[0] as { table_exists?: unknown }).table_exists;
    return (
      value === true ||
      value === 't' ||
      value === 'true' ||
      value === 1 ||
      value === '1'
    );
  }

  /**
   * Empty-table is only number 0 or a canonical digit string "0".
   * Number(null), Number(''), and Number(false) are 0 and must not pass.
   */
  private static parseRowCount(rows: unknown): number {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error(
        'AGENT-PLATFORM-EXEC-01C-SCHEMA-01 down(): could not read api_keys row count; aborting DROP.',
      );
    }
    if (!Object.prototype.hasOwnProperty.call(rows[0], 'row_count')) {
      throw new Error(
        'AGENT-PLATFORM-EXEC-01C-SCHEMA-01 down(): row_count missing from count result; aborting DROP.',
      );
    }
    const value = (rows[0] as { row_count: unknown }).row_count;
    if (typeof value === 'number') {
      if (!Number.isInteger(value) || value < 0 || Object.is(value, -0)) {
        throw new Error(
          'AGENT-PLATFORM-EXEC-01C-SCHEMA-01 down(): invalid api_keys row count; aborting DROP.',
        );
      }
      return value;
    }
    if (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)) {
      return Number.parseInt(value, 10);
    }
    throw new Error(
      'AGENT-PLATFORM-EXEC-01C-SCHEMA-01 down(): invalid api_keys row count; aborting DROP.',
    );
  }
}
