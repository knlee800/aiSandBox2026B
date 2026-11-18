import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CONN-MAIL-AUTH-STATE-01 slice S1 (stage-start D2).
 *
 * Adds public.connector_connections.sign_in_refused_at (timestamptz NULL, no
 * default, so NULL): when the mail server last refused the saved password.
 * Existing rows take NULL ("not refused"). No row is updated, deleted or
 * rewritten, and no other column, index or table changes.
 *
 * Timestamp 1815000000000 is after CreateAgentChainTriggerTables1814000000000,
 * the latest before it. up() refuses when the column already exists or the
 * table is missing. down() refuses unless the column exists, then drops that
 * one column only; the refusal marks stored in it are lost on down().
 */
export class AddConnectorSignInRefusedAt1815000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const state = await this.columnState(queryRunner);
    if (!state.table) {
      throw new Error(
        'CONN-MAIL-AUTH-STATE-01: public.connector_connections is missing. Refusing to add sign_in_refused_at.',
      );
    }
    if (state.column) {
      throw new Error(
        'CONN-MAIL-AUTH-STATE-01: public.connector_connections.sign_in_refused_at already exists. Refusing to add it again.',
      );
    }

    await queryRunner.query(
      'ALTER TABLE "public"."connector_connections" ADD COLUMN "sign_in_refused_at" timestamptz NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const state = await this.columnState(queryRunner);
    if (!state.column) {
      throw new Error(
        'CONN-MAIL-AUTH-STATE-01 down(): public.connector_connections.sign_in_refused_at is not present. Refusing to drop it.',
      );
    }

    await queryRunner.query('ALTER TABLE "public"."connector_connections" DROP COLUMN "sign_in_refused_at"');
  }

  private async columnState(queryRunner: QueryRunner): Promise<{ table: boolean; column: boolean }> {
    const rows = await queryRunner.query(`
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'connector_connections'
        ) AS "connector_connections_exists",
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'connector_connections'
            AND column_name = 'sign_in_refused_at'
        ) AS "sign_in_refused_at_exists"
    `);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('CONN-MAIL-AUTH-STATE-01: could not read connector_connections column state.');
    }
    const row = rows[0] as { connector_connections_exists?: unknown; sign_in_refused_at_exists?: unknown };
    return {
      table: readFlag(row.connector_connections_exists),
      column: readFlag(row.sign_in_refused_at_exists),
    };
  }
}

function readFlag(value: unknown): boolean {
  if (value === true || value === 't' || value === 'true' || value === 1 || value === '1') {
    return true;
  }
  if (value === false || value === 'f' || value === 'false' || value === 0 || value === '0') {
    return false;
  }
  throw new Error('CONN-MAIL-AUTH-STATE-01: could not read connector_connections column state.');
}
