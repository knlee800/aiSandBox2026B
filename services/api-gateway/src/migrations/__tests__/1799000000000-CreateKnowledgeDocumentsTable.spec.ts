import { CreateKnowledgeDocumentsTable1799000000000 } from '../1799000000000-CreateKnowledgeDocumentsTable';

/**
 * Mocked SQL-shape tests only.
 * These do not connect to PostgreSQL and do not run the migration.
 */
describe('CreateKnowledgeDocumentsTable1799000000000 (KNOW-01, mocked)', () => {
  function compact(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim();
  }

  function createRunner(): {
    migration: CreateKnowledgeDocumentsTable1799000000000;
    executed: string[];
    queryRunner: {
      query: jest.Mock;
      startTransaction: jest.Mock;
      commitTransaction: jest.Mock;
      rollbackTransaction: jest.Mock;
    };
  } {
    const executed: string[] = [];
    const queryRunner = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      query: jest.fn(async (sql: string) => {
        executed.push(sql.trim());
        return [];
      }),
    };
    return {
      migration: new CreateKnowledgeDocumentsTable1799000000000(),
      executed,
      queryRunner,
    };
  }

  const createTable = compact(`
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
  const userScopeIndex =
    'CREATE INDEX "idx_knowledge_documents_user_id_scope_id" ON "knowledge_documents" ("user_id", "scope_id")';
  const activeTitleIndex =
    'CREATE UNIQUE INDEX "uq_knowledge_documents_user_scope_title_active" ON "knowledge_documents" ("user_id", "scope_id", "title") WHERE "deleted_at" IS NULL';

  describe('up()', () => {
    it('creates the table, the pair index and the active title unique index', async () => {
      const { migration, executed, queryRunner } = createRunner();
      await migration.up(queryRunner as never);

      expect(executed.map(compact)).toEqual([createTable, userScopeIndex, activeTitleIndex]);
      expect(executed.join('\n')).toContain('"deleted_at" TIMESTAMP NULL');
      expect(executed.join('\n')).toContain('WHERE "deleted_at" IS NULL');
      expect(executed.some((sql) => /ALTER TABLE/i.test(sql))).toBe(false);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });
  });

  describe('down()', () => {
    it('drops the indexes and then the table', async () => {
      const { migration, executed, queryRunner } = createRunner();
      await migration.down(queryRunner as never);

      expect(executed).toEqual([
        'DROP INDEX IF EXISTS "uq_knowledge_documents_user_scope_title_active"',
        'DROP INDEX IF EXISTS "idx_knowledge_documents_user_id_scope_id"',
        'DROP TABLE IF EXISTS "knowledge_documents"',
      ]);
      expect(executed.some((sql) => /ALTER TABLE/i.test(sql))).toBe(false);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });
  });
});
