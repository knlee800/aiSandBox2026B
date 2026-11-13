import { readdirSync } from 'fs';
import { join } from 'path';
import { getMetadataArgsStorage } from 'typeorm';
import { CreateChatLinkTables1808000000000 } from '../1808000000000-CreateChatLinkTables';
import { ChatLink } from '../../entities/chat-link.entity';
import { ChatLinkCode } from '../../entities/chat-link-code.entity';

/**
 * Mocked SQL-shape tests only.
 * These do not connect to PostgreSQL and do not run the migration.
 */
describe('CreateChatLinkTables1808000000000 (CHAT-DISCORD-01 A1, mocked)', () => {
  const timestamp = 1808000000000;

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
  let migration: CreateChatLinkTables1808000000000;

  function createRunner(
    options: { links?: unknown; codes?: unknown; probeRows?: unknown } = {},
  ): void {
    executed = [];
    queryRunner = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      query: jest.fn(async (sql: string) => {
        executed.push(sql.trim());
        if (sql.includes('"chat_links_exists"')) {
          if (options.probeRows !== undefined) {
            return options.probeRows;
          }
          return [
            {
              chat_links_exists: options.links ?? false,
              chat_link_codes_exists: options.codes ?? false,
            },
          ];
        }
        return [];
      }),
    };
    migration = new CreateChatLinkTables1808000000000();
  }

  const createLinks = compact(`
    CREATE TABLE "public"."chat_links" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "channel" varchar(16) NOT NULL,
      "external_user_id" varchar(32) NOT NULL,
      "locale" varchar(10) NOT NULL DEFAULT 'en',
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "last_used_at" timestamptz NULL
    )
  `);
  const uniqueExternal =
    'CREATE UNIQUE INDEX "uq_chat_links_channel_external_user_id" ON "public"."chat_links" ("channel", "external_user_id")';
  const uniqueOwner =
    'CREATE UNIQUE INDEX "uq_chat_links_user_id_channel" ON "public"."chat_links" ("user_id", "channel")';
  const createCodes = compact(`
    CREATE TABLE "public"."chat_link_codes" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "channel" varchar(16) NOT NULL,
      "code_hash" varchar(64) NOT NULL CONSTRAINT "chk_chat_link_codes_code_hash" CHECK ("code_hash" ~ '^[0-9a-f]{64}$'),
      "locale" varchar(10) NOT NULL DEFAULT 'en',
      "expires_at" timestamptz NOT NULL,
      "claimed_external_user_id" varchar(32) NULL,
      "claimed_display_name" varchar(64) NULL,
      "claimed_at" timestamptz NULL,
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const uniqueHash =
    'CREATE UNIQUE INDEX "uq_chat_link_codes_code_hash" ON "public"."chat_link_codes" ("code_hash")';
  const ownerIndex =
    'CREATE INDEX "idx_chat_link_codes_user_id_channel" ON "public"."chat_link_codes" ("user_id", "channel")';
  const dropCodes = 'DROP TABLE "public"."chat_link_codes"';
  const dropLinks = 'DROP TABLE "public"."chat_links"';

  const forbidden =
    /\bDELETE FROM\b|\bTRUNCATE\b|\bUPDATE\b|\bINSERT\b|\bALTER\b|\bRENAME\b|\bIF (NOT )?EXISTS\b/i;

  it('uses a timestamp after 1807000000000-AddUserAgentApprovalColumns, the latest before it', () => {
    const names = readdirSync(join(__dirname, '..')).filter(
      (name) => /^\d+-/.test(name) && name.endsWith('.ts'),
    );
    const stamps = names.map((name) => Number(name.slice(0, name.indexOf('-'))));
    expect(names.some((name) => name.startsWith('1807000000000-'))).toBe(true);
    expect(names.filter((name) => name.startsWith(`${timestamp}-`))).toEqual([
      '1808000000000-CreateChatLinkTables.ts',
    ]);
    expect(timestamp).toBeGreaterThan(1807000000000);
    expect(Math.max(...stamps.filter((stamp) => stamp < timestamp))).toBe(1807000000000);
    expect(Math.max(...stamps.filter((stamp) => stamp <= timestamp))).toBe(timestamp);
  });

  describe('entities map the same tables, columns and unique indexes', () => {
    const storage = getMetadataArgsStorage();

    function columnsOf(target: object) {
      return storage.columns.filter((entry) => entry.target === target);
    }

    it('chat_links', () => {
      const table = storage.tables.find((entry) => entry.target === ChatLink);
      expect(table?.name).toBe('chat_links');
      expect(table?.schema).toBe('public');
      const columns = columnsOf(ChatLink);
      const names = Object.fromEntries(
        columns.map((column) => [column.propertyName, column.options.name ?? column.propertyName]),
      );
      expect(names).toEqual({
        id: 'id',
        userId: 'user_id',
        channel: 'channel',
        externalUserId: 'external_user_id',
        locale: 'locale',
        createdAt: 'created_at',
        lastUsedAt: 'last_used_at',
      });
      for (const column of columns) {
        const name = column.options.name ?? column.propertyName;
        expect(createLinks).toContain(`"${name}" ${column.options.type}`);
        if (column.options.length !== undefined) {
          expect(createLinks).toContain(`"${name}" ${column.options.type}(${column.options.length})`);
        }
        expect(createLinks).toContain(
          column.options.nullable ? `"${name}" ${column.options.type} NULL` : `"${name}" ${column.options.type}`,
        );
      }
      const indices = storage.indices.filter((entry) => entry.target === ChatLink);
      expect(
        indices.map((index) => [index.name, index.columns, index.unique]).sort(),
      ).toEqual(
        [
          ['uq_chat_links_channel_external_user_id', ['channel', 'externalUserId'], true],
          ['uq_chat_links_user_id_channel', ['userId', 'channel'], true],
        ].sort(),
      );
      expect(storage.relations.some((entry) => entry.target === ChatLink)).toBe(false);
    });

    it('chat_link_codes', () => {
      const table = storage.tables.find((entry) => entry.target === ChatLinkCode);
      expect(table?.name).toBe('chat_link_codes');
      expect(table?.schema).toBe('public');
      const columns = columnsOf(ChatLinkCode);
      const names = Object.fromEntries(
        columns.map((column) => [column.propertyName, column.options.name ?? column.propertyName]),
      );
      expect(names).toEqual({
        id: 'id',
        userId: 'user_id',
        channel: 'channel',
        codeHash: 'code_hash',
        locale: 'locale',
        expiresAt: 'expires_at',
        claimedExternalUserId: 'claimed_external_user_id',
        claimedDisplayName: 'claimed_display_name',
        claimedAt: 'claimed_at',
        createdAt: 'created_at',
      });
      for (const column of columns) {
        const name = column.options.name ?? column.propertyName;
        if (column.options.length !== undefined) {
          expect(createCodes).toContain(`"${name}" ${column.options.type}(${column.options.length})`);
        } else {
          expect(createCodes).toContain(`"${name}" ${column.options.type}`);
        }
        if (column.options.nullable) {
          expect(createCodes).toMatch(new RegExp(`"${name}" [a-z]+(\\(\\d+\\))? NULL`));
        } else {
          expect(createCodes).toMatch(new RegExp(`"${name}" [a-z]+(\\(\\d+\\))? (NOT NULL|PRIMARY KEY)`));
        }
      }
      const indices = storage.indices.filter((entry) => entry.target === ChatLinkCode);
      expect(
        indices.map((index) => [index.name, index.columns, index.unique ?? false]).sort(),
      ).toEqual(
        [
          ['idx_chat_link_codes_user_id_channel', ['userId', 'channel'], false],
          ['uq_chat_link_codes_code_hash', ['codeHash'], true],
        ].sort(),
      );
      expect(storage.relations.some((entry) => entry.target === ChatLinkCode)).toBe(false);
    });
  });

  describe('up()', () => {
    it('creates both tables, both unique link indexes, the unique hash and the owner index', async () => {
      createRunner();
      await migration.up(queryRunner as never);

      expect(executed).toHaveLength(7);
      expect(compact(executed[1])).toBe(createLinks);
      expect(executed[2]).toBe(uniqueExternal);
      expect(executed[3]).toBe(uniqueOwner);
      expect(compact(executed[4])).toBe(createCodes);
      expect(executed[5]).toBe(uniqueHash);
      expect(executed[6]).toBe(ownerIndex);
      expect(executed.filter((sql) => /CREATE TABLE/i.test(sql))).toHaveLength(2);
      expect(executed.filter((sql) => /CREATE UNIQUE INDEX/i.test(sql))).toHaveLength(3);
      expect(executed.join('\n')).not.toMatch(/\bDROP\b/i);
      expect(executed.join('\n')).not.toMatch(forbidden);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('both tables go with the user (cascade on users)', () => {
      expect(createLinks).toContain('"user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE');
      expect(createCodes).toContain('"user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE');
    });

    it('the code column refuses anything but a SHA-256 hex hash', () => {
      const check = /CHECK \("code_hash" ~ '([^']+)'\)/.exec(createCodes)![1];
      const pattern = new RegExp(check);
      expect(pattern.test('a'.repeat(64))).toBe(true);
      expect(pattern.test('0123456789abcdef'.repeat(4))).toBe(true);
      expect(pattern.test('ABCD2345')).toBe(false);
      expect(pattern.test('ABCD-2345')).toBe(false);
      expect(pattern.test('A'.repeat(64))).toBe(false);
      expect(pattern.test('a'.repeat(63))).toBe(false);
    });

    it('holds no name, e-mail or avatar column on the link table', () => {
      expect(createLinks).not.toMatch(/name|email|avatar/i);
    });

    it('probes information_schema.tables for both tables', async () => {
      createRunner();
      await migration.up(queryRunner as never);
      const probe = executed[0];
      expect(probe).toContain('information_schema.tables');
      expect(probe).toContain("table_schema = 'public'");
      expect(probe).toContain("table_name = 'chat_links'");
      expect(probe).toContain("table_name = 'chat_link_codes'");
    });

    it.each([
      [true, false],
      [false, true],
      [true, true],
      ['t', 'f'],
      [1, 0],
    ])('fails closed when the probe says links=%p codes=%p and does not CREATE', async (links, codes) => {
      createRunner({ links, codes });
      await expect(migration.up(queryRunner as never)).rejects.toThrow(/already exists/);
      expect(executed.some((sql) => /CREATE/i.test(sql))).toBe(false);
    });

    it.each([[[]], [null], [[{}]], [[{ chat_links_exists: 'maybe', chat_link_codes_exists: false }]]])(
      'refuses an unreadable probe %j and does not CREATE',
      async (probeRows) => {
        createRunner({ probeRows });
        await expect(migration.up(queryRunner as never)).rejects.toThrow(
          /could not read chat link table state/,
        );
        expect(executed.some((sql) => /CREATE/i.test(sql))).toBe(false);
      },
    );
  });

  describe('down()', () => {
    it('drops only chat_link_codes and chat_links, in that order', async () => {
      createRunner({ links: true, codes: true });
      await migration.down(queryRunner as never);

      expect(executed).toHaveLength(3);
      expect(executed[1]).toBe(dropCodes);
      expect(executed[2]).toBe(dropLinks);
      expect(executed.join('\n')).not.toMatch(forbidden);
      expect(executed.slice(1).join('\n')).not.toMatch(/CASCADE/i);
      for (const keep of ['users', 'audit_events', 'collaboration_runs', 'connector_connections']) {
        expect(executed.slice(1).join('\n')).not.toContain(`"${keep}"`);
      }
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it.each([
      [false, false],
      [true, false],
      [false, true],
      ['f', 't'],
    ])('refuses when the probe says links=%p codes=%p and does not DROP', async (links, codes) => {
      createRunner({ links, codes });
      await expect(migration.down(queryRunner as never)).rejects.toThrow(/not both present/);
      expect(executed.some((sql) => /DROP/i.test(sql))).toBe(false);
    });

    it('refuses an unreadable probe and does not DROP', async () => {
      createRunner({ probeRows: [] });
      await expect(migration.down(queryRunner as never)).rejects.toThrow(
        /could not read chat link table state/,
      );
      expect(executed.some((sql) => /DROP/i.test(sql))).toBe(false);
    });

    it('up then down leaves the probe-driven state where it started', async () => {
      createRunner();
      await migration.up(queryRunner as never);
      expect(executed.filter((sql) => /CREATE TABLE/i.test(sql))).toHaveLength(2);
      createRunner({ links: true, codes: true });
      await migration.down(queryRunner as never);
      expect(executed.filter((sql) => /DROP TABLE/i.test(sql))).toEqual([dropCodes, dropLinks]);
    });
  });
});
