import { CreateWebhookEventsTable1772300000000 } from '../../../migrations/1772300000000-CreateWebhookEventsTable';

describe('CreateWebhookEventsTable Migration (05D)', () => {
  let migration: CreateWebhookEventsTable1772300000000;
  let executedQueries: string[];
  let mockQueryRunner: { query: jest.Mock };

  beforeEach(() => {
    executedQueries = [];
    mockQueryRunner = {
      query: jest.fn((sql: string) => {
        executedQueries.push(sql.trim());
        return Promise.resolve();
      }),
    };
    migration = new CreateWebhookEventsTable1772300000000();
  });

  describe('up migration', () => {
    beforeEach(async () => {
      await migration.up(mockQueryRunner as any);
    });

    it('creates webhook_events table with IF NOT EXISTS', () => {
      const createTable = executedQueries.find((q) =>
        q.includes('CREATE TABLE IF NOT EXISTS "webhook_events"'),
      );
      expect(createTable).toBeDefined();
    });

    it('includes all required columns', () => {
      const createTable = executedQueries.find((q) =>
        q.includes('CREATE TABLE IF NOT EXISTS "webhook_events"'),
      )!;
      expect(createTable).toContain('"id" uuid PRIMARY KEY');
      expect(createTable).toContain('"provider_event_id" VARCHAR(255) NOT NULL');
      expect(createTable).toContain('"provider" VARCHAR(50) NOT NULL');
      expect(createTable).toContain('"event_type" VARCHAR(100) NOT NULL');
      expect(createTable).toContain('"internal_event_type" VARCHAR(100)');
      expect(createTable).toContain('"status" VARCHAR(20) NOT NULL');
      expect(createTable).toContain('"payload_hash" VARCHAR(64)');
      expect(createTable).toContain('"error_message" TEXT');
      expect(createTable).toContain('"error_code" VARCHAR(50)');
      expect(createTable).toContain('"attempts" INTEGER NOT NULL DEFAULT 1');
      expect(createTable).toContain('"received_at" TIMESTAMPTZ NOT NULL');
      expect(createTable).toContain('"processed_at" TIMESTAMPTZ');
      expect(createTable).toContain('"created_at" TIMESTAMPTZ NOT NULL');
      expect(createTable).toContain('"updated_at" TIMESTAMPTZ NOT NULL');
    });

    it('creates unique index on (provider, provider_event_id)', () => {
      const uq = executedQueries.find((q) =>
        q.includes('uq_webhook_events_provider_event_id'),
      );
      expect(uq).toBeDefined();
      expect(uq).toContain('CREATE UNIQUE INDEX IF NOT EXISTS');
      expect(uq).toContain('"provider"');
      expect(uq).toContain('"provider_event_id"');
    });

    it('creates index on event_type', () => {
      const idx = executedQueries.find((q) =>
        q.includes('idx_webhook_events_event_type'),
      );
      expect(idx).toBeDefined();
      expect(idx).toContain('CREATE INDEX IF NOT EXISTS');
    });

    it('creates index on status', () => {
      const idx = executedQueries.find((q) =>
        q.includes('idx_webhook_events_status') &&
        !q.includes('DROP') &&
        !q.includes('CHECK'),
      );
      expect(idx).toBeDefined();
      expect(idx).toContain('CREATE INDEX IF NOT EXISTS');
    });

    it('creates index on received_at DESC', () => {
      const idx = executedQueries.find((q) =>
        q.includes('idx_webhook_events_received_at'),
      );
      expect(idx).toBeDefined();
      expect(idx).toContain('DESC');
    });

    it('adds CHECK constraint for valid statuses', () => {
      const check = executedQueries.find((q) =>
        q.includes('webhook_events_status_check') &&
        q.includes('ADD CONSTRAINT'),
      );
      expect(check).toBeDefined();
      expect(check).toContain("'received'");
      expect(check).toContain("'verified'");
      expect(check).toContain("'processing'");
      expect(check).toContain("'processed'");
      expect(check).toContain("'ignored'");
      expect(check).toContain("'failed'");
    });

    it('uses idempotent IF NOT EXISTS guards throughout', () => {
      const createStatements = executedQueries.filter(
        (q) => q.includes('CREATE') && !q.includes('DROP'),
      );
      createStatements.forEach((stmt) => {
        expect(stmt).toContain('IF NOT EXISTS');
      });
    });
  });

  describe('down migration', () => {
    beforeEach(async () => {
      await migration.down(mockQueryRunner as any);
    });

    it('drops CHECK constraint', () => {
      const drop = executedQueries.find((q) =>
        q.includes('DROP CONSTRAINT IF EXISTS "webhook_events_status_check"'),
      );
      expect(drop).toBeDefined();
    });

    it('drops all indexes', () => {
      expect(
        executedQueries.some((q) =>
          q.includes('DROP INDEX IF EXISTS "idx_webhook_events_received_at"'),
        ),
      ).toBe(true);
      expect(
        executedQueries.some((q) =>
          q.includes('DROP INDEX IF EXISTS "idx_webhook_events_status"'),
        ),
      ).toBe(true);
      expect(
        executedQueries.some((q) =>
          q.includes('DROP INDEX IF EXISTS "idx_webhook_events_event_type"'),
        ),
      ).toBe(true);
      expect(
        executedQueries.some((q) =>
          q.includes('DROP INDEX IF EXISTS "uq_webhook_events_provider_event_id"'),
        ),
      ).toBe(true);
    });

    it('drops webhook_events table', () => {
      const drop = executedQueries.find((q) =>
        q.includes('DROP TABLE IF EXISTS "webhook_events"'),
      );
      expect(drop).toBeDefined();
    });

    it('uses IF EXISTS guards for safe reversal', () => {
      executedQueries.forEach((stmt) => {
        if (stmt.includes('DROP')) {
          expect(stmt).toContain('IF EXISTS');
        }
      });
    });

    it('does not mutate data', () => {
      executedQueries.forEach((stmt) => {
        expect(stmt.toUpperCase()).not.toContain('INSERT');
        expect(stmt.toUpperCase()).not.toContain('UPDATE');
        expect(stmt.toUpperCase()).not.toContain('DELETE FROM');
      });
    });
  });

  describe('no Stripe SDK or env dependencies', () => {
    it('migration does not import stripe', () => {
      const source = require('fs').readFileSync(
        require('path').resolve(
          __dirname,
          '../../../migrations/1772300000000-CreateWebhookEventsTable.ts',
        ),
        'utf-8',
      );
      expect(source).not.toContain("from 'stripe'");
    });
  });
});
