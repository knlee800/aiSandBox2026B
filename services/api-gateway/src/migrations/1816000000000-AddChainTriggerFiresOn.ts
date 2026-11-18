import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * TRIGGER-CHAIN-FAILED-01 slice S1 (stage-start sections 2.1 and 4.1).
 *
 * Adds public.agent_chain_triggers.fires_on (varchar(16) NOT NULL DEFAULT
 * 'completed', CHECK fires_on IN ('completed', 'failed')): whether the
 * trigger starts its target when a run of the source workflow completes or
 * when one fails. One ALTER TABLE ... ADD COLUMN with the default and the
 * CHECK; existing rows take 'completed', which is what they are. No row is
 * updated, deleted or rewritten by hand, and no other column, index or table
 * changes.
 *
 * Timestamp 1816000000000 is after AddConnectorSignInRefusedAt1815000000000,
 * the latest before it. up() refuses when the column already exists or the
 * table is missing. down() refuses unless the column exists, then drops that
 * one column; its CHECK goes with it. down() loses which triggers were
 * failure triggers: they would all read as completed triggers again.
 */
export class AddChainTriggerFiresOn1816000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const state = await this.columnState(queryRunner);
    if (!state.table) {
      throw new Error(
        'TRIGGER-CHAIN-FAILED-01: public.agent_chain_triggers is missing. Refusing to add fires_on.',
      );
    }
    if (state.column) {
      throw new Error(
        'TRIGGER-CHAIN-FAILED-01: public.agent_chain_triggers.fires_on already exists. Refusing to add it again.',
      );
    }

    await queryRunner.query(
      'ALTER TABLE "public"."agent_chain_triggers" ADD COLUMN "fires_on" varchar(16) NOT NULL DEFAULT \'completed\' CONSTRAINT "chk_agent_chain_triggers_fires_on" CHECK ("fires_on" IN (\'completed\', \'failed\'))',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const state = await this.columnState(queryRunner);
    if (!state.column) {
      throw new Error(
        'TRIGGER-CHAIN-FAILED-01 down(): public.agent_chain_triggers.fires_on is not present. Refusing to drop it.',
      );
    }

    await queryRunner.query('ALTER TABLE "public"."agent_chain_triggers" DROP COLUMN "fires_on"');
  }

  private async columnState(queryRunner: QueryRunner): Promise<{ table: boolean; column: boolean }> {
    const rows = await queryRunner.query(`
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'agent_chain_triggers'
        ) AS "agent_chain_triggers_exists",
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'agent_chain_triggers'
            AND column_name = 'fires_on'
        ) AS "fires_on_exists"
    `);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('TRIGGER-CHAIN-FAILED-01: could not read agent_chain_triggers column state.');
    }
    const row = rows[0] as { agent_chain_triggers_exists?: unknown; fires_on_exists?: unknown };
    return {
      table: readFlag(row.agent_chain_triggers_exists),
      column: readFlag(row.fires_on_exists),
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
  throw new Error('TRIGGER-CHAIN-FAILED-01: could not read agent_chain_triggers column state.');
}
