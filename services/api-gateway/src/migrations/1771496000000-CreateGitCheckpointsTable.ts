import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * PHASE-76G: Create missing git_checkpoints table
 *
 * Root cause: InitSchema20260123 migration was marked as applied but the
 * git_checkpoints table was never created in the database (database was
 * pre-populated from a different schema). This migration creates the table
 * using the same schema as the original init migration, with IF NOT EXISTS
 * safety to avoid conflicts if the table already exists.
 */
export class CreateGitCheckpointsTable1771496000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "git_checkpoints" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "session_id" uuid NOT NULL,
                "commit_hash" character varying(40) NOT NULL,
                "message_number" integer,
                "description" character varying(500),
                "files_changed" integer NOT NULL DEFAULT 0,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "fk_git_checkpoint_session" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_git_checkpoint_session_id" ON "git_checkpoints" ("session_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_git_checkpoint_commit_hash" ON "git_checkpoints" ("commit_hash")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_git_checkpoint_created_at" ON "git_checkpoints" ("created_at")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "git_checkpoints"`);
    }

}
