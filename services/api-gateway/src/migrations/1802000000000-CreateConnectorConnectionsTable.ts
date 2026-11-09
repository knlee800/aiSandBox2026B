import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CONN-02A: Connector credentials.
 * Creates connector_connections, the user foreign key, and the unique
 * owner+kind index. down() drops that index and table. No other table changes.
 */
export class CreateConnectorConnectionsTable1802000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "connector_connections" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "kind" varchar(16) NOT NULL,
        "preset" varchar(16) NULL,
        "username" varchar(254) NULL,
        "secret_ciphertext" text NOT NULL,
        "key_version" smallint NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "last_verified_at" timestamptz NULL
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_connector_connections_user_id_kind" ON "connector_connections" ("user_id", "kind")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_connector_connections_user_id_kind"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "connector_connections"`);
  }
}
