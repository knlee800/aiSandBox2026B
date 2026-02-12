import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Add API Keys Table Migration
 *
 * Phase 36A: API Key Management Backend Foundation
 *
 * Creates api_keys table with:
 * - Secure hashed key storage
 * - Key prefix for display
 * - User ownership
 * - Scopes (JSONB)
 * - Revocation support
 */
export class AddApiKeysTable1770889928593 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create api_keys table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS api_keys (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                hashed_key VARCHAR(255) NOT NULL,
                key_prefix VARCHAR(20) NOT NULL,
                user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                revoked_at TIMESTAMP NULL
            )
        `);

        // Create indexes for performance
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_api_key_hashed ON api_keys(hashed_key)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_api_key_user_id ON api_keys(user_id)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS idx_api_key_user_id`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_api_key_hashed`);

        // Drop table
        await queryRunner.query(`DROP TABLE IF EXISTS api_keys`);
    }

}
