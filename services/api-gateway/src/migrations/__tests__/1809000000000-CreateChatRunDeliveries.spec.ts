import { readdirSync } from 'fs';
import { join } from 'path';
import { getMetadataArgsStorage } from 'typeorm';
import { CreateChatRunDeliveries1809000000000 } from '../1809000000000-CreateChatRunDeliveries';
import { CHAT_RUN_DELIVERY_STATUSES, ChatRunDelivery } from '../../entities/chat-run-delivery.entity';

/**
 * Mocked SQL-shape tests only.
 * These do not connect to PostgreSQL and do not run the migration.
 */
describe('CreateChatRunDeliveries1809000000000 (CHAT-DISCORD-01 C1, mocked)', () => {
  const timestamp = 1809000000000;

  function compact(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim();
  }

  let executed: string[];
  let queryRunner: {
    query: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
  };
  let migration: CreateChatRunDeliveries1809000000000;

  function createRunner(options: { deliveries?: unknown; links?: unknown; probeRows?: unknown } = {}): void {
    executed = [];
    queryRunner = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      query: jest.fn(async (sql: string) => {
        executed.push(sql.trim());
        if (sql.includes('"chat_run_deliveries_exists"')) {
          if (options.probeRows !== undefined) {
            return options.probeRows;
          }
          return [
            {
              chat_run_deliveries_exists: options.deliveries ?? false,
              chat_links_exists: options.links ?? true,
            },
          ];
        }
        return [];
      }),
    };
    migration = new CreateChatRunDeliveries1809000000000();
  }

  const createTable = compact(`
    CREATE TABLE "public"."chat_run_deliveries" (
      "collaboration_run_id" text PRIMARY KEY,
      "link_id" uuid NOT NULL REFERENCES "public"."chat_links"(id) ON DELETE CASCADE,
      "status" varchar(16) NOT NULL DEFAULT 'waiting' CONSTRAINT "chk_chat_run_deliveries_status" CHECK ("status" IN ('waiting', 'delivered', 'failed', 'dropped')),
      "notified_referral_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "delivered_at" timestamptz NULL
    )
  `);
  const linkStatusIndex =
    'CREATE INDEX "idx_chat_run_deliveries_link_id_status" ON "public"."chat_run_deliveries" ("link_id", "status")';
  const statusCreatedIndex =
    'CREATE INDEX "idx_chat_run_deliveries_status_created_at" ON "public"."chat_run_deliveries" ("status", "created_at")';
  const dropTable = 'DROP TABLE "public"."chat_run_deliveries"';

  const forbidden =
    /\bDELETE FROM\b|\bTRUNCATE\b|\bUPDATE\b|\bINSERT\b|\bALTER\b|\bRENAME\b|\bIF (NOT )?EXISTS\b/i;

  it('uses a timestamp after 1808000000000-CreateChatLinkTables, the latest before it', () => {
    const names = readdirSync(join(__dirname, '..')).filter(
      (name) => /^\d+-/.test(name) && name.endsWith('.ts'),
    );
    const stamps = names.map((name) => Number(name.slice(0, name.indexOf('-'))));
    expect(names.some((name) => name.startsWith('1808000000000-'))).toBe(true);
    expect(names.filter((name) => name.startsWith(`${timestamp}-`))).toEqual([
      '1809000000000-CreateChatRunDeliveries.ts',
    ]);
    expect(timestamp).toBeGreaterThan(1808000000000);
    expect(Math.max(...stamps.filter((stamp) => stamp < timestamp))).toBe(1808000000000);
    expect(Math.max(...stamps.filter((stamp) => stamp <= timestamp))).toBe(timestamp);
  });

  it('the entity maps the same table, columns, indexes and states', () => {
    const storage = getMetadataArgsStorage();
    const table = storage.tables.find((entry) => entry.target === ChatRunDelivery);
    expect(table?.name).toBe('chat_run_deliveries');
    expect(table?.schema).toBe('public');
    const columns = storage.columns.filter((entry) => entry.target === ChatRunDelivery);
    const names = Object.fromEntries(
      columns.map((column) => [column.propertyName, column.options.name ?? column.propertyName]),
    );
    expect(names).toEqual({
      collaborationRunId: 'collaboration_run_id',
      linkId: 'link_id',
      status: 'status',
      notifiedReferralIds: 'notified_referral_ids',
      createdAt: 'created_at',
      deliveredAt: 'delivered_at',
    });
    for (const column of columns) {
      const name = column.options.name ?? column.propertyName;
      if (column.options.length !== undefined) {
        expect(createTable).toContain(`"${name}" ${column.options.type}(${column.options.length})`);
      } else {
        expect(createTable).toContain(`"${name}" ${column.options.type}`);
      }
      if (column.options.nullable) {
        expect(createTable).toMatch(new RegExp(`"${name}" [a-z]+(\\(\\d+\\))? NULL`));
      } else {
        expect(createTable).toMatch(new RegExp(`"${name}" [a-z]+(\\(\\d+\\))? (NOT NULL|PRIMARY KEY)`));
      }
    }
    const indices = storage.indices.filter((entry) => entry.target === ChatRunDelivery);
    expect(indices.map((index) => [index.name, index.columns, index.unique ?? false]).sort()).toEqual(
      [
        ['idx_chat_run_deliveries_link_id_status', ['linkId', 'status'], false],
        ['idx_chat_run_deliveries_status_created_at', ['status', 'createdAt'], false],
      ].sort(),
    );
    expect(storage.relations.some((entry) => entry.target === ChatRunDelivery)).toBe(false);
    const check = /CHECK \("status" IN \(([^)]+)\)\)/.exec(createTable)![1];
    expect(check.split(', ').map((value) => value.replace(/'/g, ''))).toEqual([...CHAT_RUN_DELIVERY_STATUSES]);
  });

  describe('up()', () => {
    it('creates the table and its two indexes, after the probe', async () => {
      createRunner();
      await migration.up(queryRunner as never);
      expect(executed).toHaveLength(4);
      expect(compact(executed[1])).toBe(createTable);
      expect(executed[2]).toBe(linkStatusIndex);
      expect(executed[3]).toBe(statusCreatedIndex);
      expect(executed.join('\n')).not.toMatch(/\bDROP\b/i);
      expect(executed.join('\n')).not.toMatch(forbidden);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('rows go with the link (cascade on chat_links); no message or result text column', () => {
      expect(createTable).toContain('"link_id" uuid NOT NULL REFERENCES "public"."chat_links"(id) ON DELETE CASCADE');
      expect(createTable).not.toMatch(/text_|message|summary|answer|prompt|content|external_user_id/i);
      expect(createTable.match(/\btext\b/g)).toEqual(['text']);
    });

    it('probes information_schema.tables for the new table and chat_links', async () => {
      createRunner();
      await migration.up(queryRunner as never);
      expect(executed[0]).toContain('information_schema.tables');
      expect(executed[0]).toContain("table_schema = 'public'");
      expect(executed[0]).toContain("table_name = 'chat_run_deliveries'");
      expect(executed[0]).toContain("table_name = 'chat_links'");
    });

    it.each([[true], ['t'], [1]])('fails closed when the table already exists (%p) and does not CREATE', async (deliveries) => {
      createRunner({ deliveries });
      await expect(migration.up(queryRunner as never)).rejects.toThrow(/already exists/);
      expect(executed.some((sql) => /CREATE/i.test(sql))).toBe(false);
    });

    it('refuses without chat_links and does not CREATE', async () => {
      createRunner({ links: false });
      await expect(migration.up(queryRunner as never)).rejects.toThrow(/chat_links is missing/);
      expect(executed.some((sql) => /CREATE/i.test(sql))).toBe(false);
    });

    it.each([[[]], [null], [[{}]], [[{ chat_run_deliveries_exists: 'maybe', chat_links_exists: true }]]])(
      'refuses an unreadable probe %j and does not CREATE',
      async (probeRows) => {
        createRunner({ probeRows });
        await expect(migration.up(queryRunner as never)).rejects.toThrow(
          /could not read chat run delivery table state/,
        );
        expect(executed.some((sql) => /CREATE/i.test(sql))).toBe(false);
      },
    );
  });

  describe('down()', () => {
    it('drops only chat_run_deliveries', async () => {
      createRunner({ deliveries: true });
      await migration.down(queryRunner as never);
      expect(executed).toHaveLength(2);
      expect(executed[1]).toBe(dropTable);
      expect(executed.join('\n')).not.toMatch(forbidden);
      expect(executed.slice(1).join('\n')).not.toMatch(/CASCADE/i);
      for (const keep of ['chat_links', 'chat_link_codes', 'collaboration_runs', 'audit_events', 'users']) {
        expect(executed.slice(1).join('\n')).not.toContain(`"${keep}"`);
      }
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it.each([[false], ['f'], [0]])('refuses when the table is not present (%p) and does not DROP', async (deliveries) => {
      createRunner({ deliveries });
      await expect(migration.down(queryRunner as never)).rejects.toThrow(/is not present/);
      expect(executed.some((sql) => /DROP/i.test(sql))).toBe(false);
    });

    it('refuses an unreadable probe and does not DROP', async () => {
      createRunner({ probeRows: [] });
      await expect(migration.down(queryRunner as never)).rejects.toThrow(
        /could not read chat run delivery table state/,
      );
      expect(executed.some((sql) => /DROP/i.test(sql))).toBe(false);
    });

    it('up then down leaves the probe-driven state where it started', async () => {
      createRunner();
      await migration.up(queryRunner as never);
      expect(executed.filter((sql) => /CREATE TABLE/i.test(sql))).toHaveLength(1);
      createRunner({ deliveries: true });
      await migration.down(queryRunner as never);
      expect(executed.filter((sql) => /DROP TABLE/i.test(sql))).toEqual([dropTable]);
    });
  });
});
