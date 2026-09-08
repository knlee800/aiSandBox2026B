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
 *
 * Rollback: dropping a populated api_keys table is data-loss, not harmless.
 * down() refuses to DROP when any rows exist. down() does not use DROP TABLE IF EXISTS,
 * so it cannot drop a pre-existing table that up() never created.
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
          'Refusing to adopt an unknown table (no IF NOT EXISTS).',
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
      CREATE TABLE "api_keys" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "hashed_key" character varying(255) NOT NULL,
        "key_prefix" character varying(20) NOT NULL,
        "user_id" uuid NOT NULL,
        "scopes" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "revoked_at" TIMESTAMP NULL,
        CONSTRAINT "fk_api_keys_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_api_key_hashed" ON "api_keys" ("hashed_key")`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_api_key_user_id" ON "api_keys" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const counts = await queryRunner.query(`
      SELECT COUNT(*)::int AS "row_count" FROM "api_keys"
    `);
    const rowCount = CreateApiKeysTable1772950000000.rowCount(counts);

    if (rowCount > 0) {
      throw new Error(
        [
          `AGENT-PLATFORM-EXEC-01C-SCHEMA-01 down(): refusing to DROP populated public.api_keys (${rowCount} rows).`,
          'Dropping a populated API-key table is data-loss, not a harmless rollback.',
          'Restore from a pre-apply snapshot, or obtain explicit authorization to destroy API-key rows.',
          'This down() does not use IF EXISTS and will not drop a table that up() did not create.',
        ].join(' '),
      );
    }

    await queryRunner.query(`DROP INDEX "idx_api_key_user_id"`);
    await queryRunner.query(`DROP INDEX "idx_api_key_hashed"`);
    await queryRunner.query(`DROP TABLE "api_keys"`);
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

  private static rowCount(rows: unknown): number {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error(
        'AGENT-PLATFORM-EXEC-01C-SCHEMA-01 down(): could not read api_keys row count; aborting DROP.',
      );
    }
    const value = (rows[0] as { row_count?: unknown }).row_count;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(
        'AGENT-PLATFORM-EXEC-01C-SCHEMA-01 down(): invalid api_keys row count; aborting DROP.',
      );
    }
    return n;
  }
}
