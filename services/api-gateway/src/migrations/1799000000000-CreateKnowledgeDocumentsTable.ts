import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * KNOW-01: Owner-scoped knowledge documents.
 * Soft delete matches user_agents. The title unique index ignores deleted rows.
 */
export class CreateKnowledgeDocumentsTable1799000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "knowledge_documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "scope_id" VARCHAR(64) NOT NULL,
        "title" VARCHAR(200) NOT NULL,
        "content" TEXT NOT NULL,
        "content_hash" VARCHAR(64) NOT NULL,
        "byte_size" INTEGER NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMP NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_knowledge_documents_user_id_scope_id" ON "knowledge_documents" ("user_id", "scope_id")`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_knowledge_documents_user_scope_title_active" ON "knowledge_documents" ("user_id", "scope_id", "title") WHERE "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_knowledge_documents_user_scope_title_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_knowledge_documents_user_id_scope_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_documents"`);
  }
}
