import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthSchemaFoundation1771700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "password_hash" DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "auth_provider" character varying(50) NOT NULL DEFAULT 'email'
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "oauth_id" character varying(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "stripe_customer_id" character varying(255)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "oauth_accounts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "provider" character varying(50) NOT NULL,
        "provider_account_id" character varying(255) NOT NULL,
        "provider_email" character varying(255),
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'fk_oauth_accounts_user_id'
        ) THEN
          ALTER TABLE "oauth_accounts"
          ADD CONSTRAINT "fk_oauth_accounts_user_id"
          FOREIGN KEY ("user_id")
          REFERENCES "users"("id")
          ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_oauth_accounts_provider_provider_account_id"
      ON "oauth_accounts" ("provider", "provider_account_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_oauth_accounts_user_id"
      ON "oauth_accounts" ("user_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "verification_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "token_hash" character varying(255) NOT NULL,
        "type" character varying(50) NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "used_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'fk_verification_tokens_user_id'
        ) THEN
          ALTER TABLE "verification_tokens"
          ADD CONSTRAINT "fk_verification_tokens_user_id"
          FOREIGN KEY ("user_id")
          REFERENCES "users"("id")
          ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_verification_tokens_token_hash"
      ON "verification_tokens" ("token_hash")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_verification_tokens_user_id_type"
      ON "verification_tokens" ("user_id", "type")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "auth_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "session_token_hash" character varying(255) NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "last_active_at" TIMESTAMP NOT NULL DEFAULT now(),
        "revoked_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'fk_auth_sessions_user_id'
        ) THEN
          ALTER TABLE "auth_sessions"
          ADD CONSTRAINT "fk_auth_sessions_user_id"
          FOREIGN KEY ("user_id")
          REFERENCES "users"("id")
          ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_auth_sessions_session_token_hash"
      ON "auth_sessions" ("session_token_hash")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_auth_sessions_user_id"
      ON "auth_sessions" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_auth_sessions_expires_at"
      ON "auth_sessions" ("expires_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "auth_sessions"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "verification_tokens"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "oauth_accounts"
    `);

    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "stripe_customer_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "last_login_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "oauth_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "auth_provider"
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM "users"
          WHERE "password_hash" IS NULL
        ) THEN
          RAISE EXCEPTION 'Cannot restore users.password_hash to NOT NULL while null values exist';
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "password_hash" SET NOT NULL
    `);
  }
}
