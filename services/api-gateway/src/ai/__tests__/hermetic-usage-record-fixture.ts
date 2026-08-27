import { DataSource, EntitySchema, Repository } from 'typeorm';

/**
 * TEST-ONLY portable shape for usage_records under better-sqlite3.
 * Not production UsageRecord metadata. Do not register the decorated
 * production entity with this DataSource.
 */
type HermeticUsageRecord = {
  executionId: string;
  requestId?: string | null;
  apiKeyId: string;
  userId: string;
  sessionId: string;
  conversationId: string;
  provider: string;
  adapter: string;
  model?: string | null;
  tokensUsed?: number | null;
  executionDurationMs?: number | null;
  executionStatus: string;
  timestamp: Date;
  metadata?: Record<string, unknown> | null;
};

/**
 * Test-only EntitySchema for the Class 2 AI-execution suites.
 * SQLite-portable types: varchar / datetime / simple-json.
 * Partial unique index on (userId, requestId) WHERE request_id IS NOT NULL.
 */
export const testUsageRecordSchema = new EntitySchema<HermeticUsageRecord>({
  name: 'UsageRecord',
  tableName: 'usage_records',
  columns: {
    executionId: {
      type: 'varchar',
      primary: true,
      name: 'execution_id',
    },
    requestId: {
      type: 'varchar',
      length: 100,
      nullable: true,
      name: 'request_id',
    },
    apiKeyId: {
      type: 'varchar',
      length: 50,
      name: 'api_key_id',
    },
    userId: {
      type: 'varchar',
      length: 50,
      name: 'user_id',
    },
    sessionId: {
      type: 'varchar',
      name: 'session_id',
    },
    conversationId: {
      type: 'varchar',
      name: 'conversation_id',
    },
    provider: {
      type: 'varchar',
      length: 50,
    },
    adapter: {
      type: 'varchar',
      length: 50,
    },
    model: {
      type: 'varchar',
      length: 100,
      nullable: true,
    },
    tokensUsed: {
      type: 'integer',
      nullable: true,
      name: 'tokens_used',
    },
    executionDurationMs: {
      type: 'integer',
      nullable: true,
      name: 'execution_duration_ms',
    },
    executionStatus: {
      type: 'varchar',
      length: 20,
      default: 'pending',
      name: 'execution_status',
    },
    timestamp: {
      type: 'datetime',
      createDate: true,
      name: 'timestamp',
    },
    metadata: {
      type: 'simple-json',
      nullable: true,
    },
  },
  indices: [
    {
      name: 'idx_usage_records_user_request_id',
      columns: ['userId', 'requestId'],
      unique: true,
      where: '"request_id" IS NOT NULL',
    },
  ],
});

export type HermeticUsageRecordRepository = Repository<HermeticUsageRecord>;

export interface HermeticUsageRecordFixture {
  dataSource: DataSource;
  repository: HermeticUsageRecordRepository;
  clear: () => Promise<void>;
  destroy: () => Promise<void>;
}

/**
 * In-process better-sqlite3 ':memory:' DataSource + real TypeORM repository.
 * Callers bridge repository into Nest via getRepositoryToken(UsageRecord).
 */
export async function createHermeticUsageRecordFixture(): Promise<HermeticUsageRecordFixture> {
  const dataSource = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: [testUsageRecordSchema],
    synchronize: true,
    dropSchema: true,
    logging: false,
  });

  await dataSource.initialize();
  const repository = dataSource.getRepository(testUsageRecordSchema);

  return {
    dataSource,
    repository,
    clear: async () => {
      await repository.clear();
    },
    destroy: async () => {
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    },
  };
}
