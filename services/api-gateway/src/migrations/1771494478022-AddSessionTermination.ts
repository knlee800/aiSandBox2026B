import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSessionTermination1771494478022 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sessions"
            ADD COLUMN "terminated_at" TIMESTAMP NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "sessions"
            ADD COLUMN "termination_reason" VARCHAR(255) NULL
        `);

        await queryRunner.query(`
            CREATE INDEX "idx_sessions_terminated_at"
            ON "sessions" ("terminated_at")
        `);

        await queryRunner.query(`
            CREATE INDEX "idx_sessions_termination_reason"
            ON "sessions" ("termination_reason")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX "idx_sessions_termination_reason"
        `);

        await queryRunner.query(`
            DROP INDEX "idx_sessions_terminated_at"
        `);

        await queryRunner.query(`
            ALTER TABLE "sessions"
            DROP COLUMN "termination_reason"
        `);

        await queryRunner.query(`
            ALTER TABLE "sessions"
            DROP COLUMN "terminated_at"
        `);
    }
}
