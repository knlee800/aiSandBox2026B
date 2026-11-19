import { readdirSync } from 'fs';
import { join } from 'path';
import { getMetadataArgsStorage } from 'typeorm';
import { AddChatPersistedState1817000000000 } from '../1817000000000-AddChatPersistedState';
import { ChatApprovalToken } from '../../entities/chat-approval-token.entity';
import { CHAT_LIMIT_BUCKETS, ChatLimitHit } from '../../entities/chat-limit-hit.entity';
import { CHAT_RUN_DELIVERY_ORIGINS, ChatRunDelivery } from '../../entities/chat-run-delivery.entity';

/**
 * Mocked SQL-shape tests only.
 * These do not connect to PostgreSQL and do not run the migration.
 */
describe('AddChatPersistedState1817000000000 (CHAT-STATE-PERSIST-01, mocked)', () => {
  const timestamp = 1817000000000;

  type Probe = {
    deliveries?: unknown;
    partsSent?: unknown;
    origin?: unknown;
    limitHits?: unknown;
    approvalTokens?: unknown;
    probeRows?: unknown;
  };

  let executed: string[];
  let queryRunner: {
    query: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
  };
  let migration: AddChatPersistedState1817000000000;

  function createRunner(options: Probe = {}): void {
    executed = [];
    queryRunner = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      query: jest.fn(async (sql: string) => {
        executed.push(sql.trim());
        if (sql.includes('"chat_approval_tokens_exists"')) {
          if (options.probeRows !== undefined) {
            return options.probeRows;
          }
          return [
            {
              chat_run_deliveries_exists: options.deliveries ?? true,
              parts_sent_exists: options.partsSent ?? false,
              origin_exists: options.origin ?? false,
              chat_limit_hits_exists: options.limitHits ?? false,
              chat_approval_tokens_exists: options.approvalTokens ?? false,
            },
          ];
        }
        return [];
      }),
    };
    migration = new AddChatPersistedState1817000000000();
  }

  const present: Probe = { partsSent: true, origin: true, limitHits: true, approvalTokens: true };

  const alterSql =
    'ALTER TABLE "public"."chat_run_deliveries" ' +
    'ADD COLUMN "parts_sent" integer NOT NULL DEFAULT 0 CONSTRAINT "chk_chat_run_deliveries_parts_sent" CHECK ("parts_sent" >= 0), ' +
    'ADD COLUMN "send_failures" integer NOT NULL DEFAULT 0 CONSTRAINT "chk_chat_run_deliveries_send_failures" CHECK ("send_failures" >= 0), ' +
    'ADD COLUMN "next_attempt_at" timestamptz NULL, ' +
    'ADD COLUMN "held_at" timestamptz NULL, ' +
    'ADD COLUMN "claimed_by" varchar(36) NULL, ' +
    'ADD COLUMN "claimed_until" timestamptz NULL, ' +
    'ADD COLUMN "origin" text NULL CONSTRAINT "chk_chat_run_deliveries_origin" CHECK ("origin" IN (\'chat\', \'platform\'))';
  const originDefaultSql = 'ALTER TABLE "public"."chat_run_deliveries" ALTER COLUMN "origin" SET DEFAULT \'platform\'';
  const limitHitsSql = [
    'CREATE TABLE "public"."chat_limit_hits" (',
    '"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,',
    '"bucket" varchar(24) NOT NULL CONSTRAINT "chk_chat_limit_hits_bucket" CHECK ("bucket" IN (\'code_create\', \'claim_attempt\', \'claim_failed\', \'link_pause\', \'command\')),',
    '"subject_key" varchar(64) NOT NULL,',
    '"occurred_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP',
    ')',
  ].join(' ');
  const limitHitsIndexSql =
    'CREATE INDEX "idx_chat_limit_hits_bucket_subject_occurred_at" ON "public"."chat_limit_hits" ("bucket", "subject_key", "occurred_at")';
  const tokensSql = [
    'CREATE TABLE "public"."chat_approval_tokens" (',
    '"token_hash" varchar(64) PRIMARY KEY,',
    '"collaboration_run_id" text NOT NULL REFERENCES "public"."chat_run_deliveries"("collaboration_run_id") ON DELETE CASCADE,',
    '"link_id" uuid NOT NULL,',
    '"user_id" uuid NOT NULL,',
    '"referral_id" text NOT NULL,',
    '"step" integer NOT NULL,',
    '"expires_at" timestamptz NOT NULL,',
    '"created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP',
    ')',
  ].join(' ');
  const tokensReferralIndexSql =
    'CREATE UNIQUE INDEX "uq_chat_approval_tokens_referral_id" ON "public"."chat_approval_tokens" ("referral_id")';
  const tokensExpiryIndexSql =
    'CREATE INDEX "idx_chat_approval_tokens_expires_at" ON "public"."chat_approval_tokens" ("expires_at")';
  const upSql = [alterSql, originDefaultSql, limitHitsSql, limitHitsIndexSql, tokensSql, tokensReferralIndexSql, tokensExpiryIndexSql];
  const downSql = [
    'DROP TABLE "public"."chat_approval_tokens"',
    'DROP TABLE "public"."chat_limit_hits"',
    'ALTER TABLE "public"."chat_run_deliveries" DROP COLUMN "parts_sent", DROP COLUMN "send_failures", DROP COLUMN "next_attempt_at", DROP COLUMN "held_at", DROP COLUMN "claimed_by", DROP COLUMN "claimed_until", DROP COLUMN "origin"',
  ];

  /** One line per statement, whitespace collapsed (the CREATE TABLEs are template literals). */
  function flat(sql: string): string {
    return sql.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').trim();
  }
  const flatUp = upSql.map(flat);

  /** No row is deleted, updated or truncated; no IF EXISTS; the only DELETE is the foreign key's ON DELETE CASCADE. */
  function expectNoDestructiveStatement(statements: string[]): void {
    for (const sql of statements) {
      expect(sql).not.toMatch(/^\s*(DELETE|UPDATE|TRUNCATE|INSERT)\b/i);
      expect(sql.replace(/ON DELETE CASCADE/g, '')).not.toMatch(/\bDELETE\b|\bUPDATE\b|\bTRUNCATE\b|\bINSERT\b|\bIF (NOT )?EXISTS\b|\bRENAME\b/i);
    }
  }

  function columnOf(target: Function, propertyName: string) {
    const column = getMetadataArgsStorage().columns.find(
      (entry) => entry.target === target && entry.propertyName === propertyName,
    );
    expect(column).toBeDefined();
    return column!;
  }

  it('uses a timestamp after 1816000000000-AddChainTriggerFiresOn and is the newest migration', () => {
    const names = readdirSync(join(__dirname, '..')).filter((name) => /^\d+-/.test(name) && name.endsWith('.ts'));
    const stamps = names.map((name) => Number(name.slice(0, name.indexOf('-'))));
    expect(names.some((name) => name.startsWith('1816000000000-'))).toBe(true);
    expect(names.filter((name) => name.startsWith(`${timestamp}-`))).toEqual(['1817000000000-AddChatPersistedState.ts']);
    expect(Math.max(...stamps.filter((stamp) => stamp < timestamp))).toBe(1816000000000);
    expect(Math.max(...stamps)).toBe(timestamp);
    expect(new Set(stamps).size).toBe(stamps.length);
  });

  describe('entities match the SQL', () => {
    it('ChatRunDelivery maps the seven new columns', () => {
      const expected: Array<[string, Record<string, unknown>, string]> = [
        ['partsSent', { type: 'integer', name: 'parts_sent', default: 0 }, '"parts_sent" integer NOT NULL DEFAULT 0'],
        ['sendFailures', { type: 'integer', name: 'send_failures', default: 0 }, '"send_failures" integer NOT NULL DEFAULT 0'],
        ['nextAttemptAt', { type: 'timestamptz', name: 'next_attempt_at', nullable: true }, '"next_attempt_at" timestamptz NULL'],
        ['heldAt', { type: 'timestamptz', name: 'held_at', nullable: true }, '"held_at" timestamptz NULL'],
        ['claimedBy', { type: 'varchar', length: 36, name: 'claimed_by', nullable: true }, '"claimed_by" varchar(36) NULL'],
        ['claimedUntil', { type: 'timestamptz', name: 'claimed_until', nullable: true }, '"claimed_until" timestamptz NULL'],
      ];
      for (const [property, options, sql] of expected) {
        const column = columnOf(ChatRunDelivery, property);
        expect(column.options).toMatchObject(options);
        if (!options.nullable) expect(column.options.nullable).toBeFalsy();
        expect(alterSql).toContain(`ADD COLUMN ${sql}`);
      }
      const origin = columnOf(ChatRunDelivery, 'origin');
      expect(origin.options).toMatchObject({ type: 'text', nullable: true });
      expect((origin.options.default as () => string)()).toBe("'platform'");
      expect(alterSql).toContain('ADD COLUMN "origin" text NULL');
      expect(originDefaultSql).toContain(`SET DEFAULT ${(origin.options.default as () => string)()}`);
      expect(/CHECK \("origin" IN \(([^)]+)\)\)/.exec(alterSql)![1].split(', ').map((v) => v.replace(/'/g, ''))).toEqual([
        ...CHAT_RUN_DELIVERY_ORIGINS,
      ]);
    });

    it('ChatLimitHit matches chat_limit_hits, and the bucket CHECK lists exactly the entity buckets', () => {
      const id = getMetadataArgsStorage().generations.find((entry) => entry.target === ChatLimitHit);
      expect(id).toMatchObject({ propertyName: 'id', strategy: 'identity' });
      const idColumn = columnOf(ChatLimitHit, 'id');
      expect(idColumn.options).toMatchObject({ type: 'bigint', generatedIdentity: 'ALWAYS', primary: true });
      expect(columnOf(ChatLimitHit, 'bucket').options).toMatchObject({ type: 'varchar', length: 24 });
      expect(columnOf(ChatLimitHit, 'subjectKey').options).toMatchObject({ type: 'varchar', length: 64, name: 'subject_key' });
      expect(columnOf(ChatLimitHit, 'occurredAt').options).toMatchObject({ type: 'timestamptz', name: 'occurred_at' });
      expect(/CHECK \("bucket" IN \(([^)]+)\)\)/.exec(limitHitsSql)![1].split(', ').map((v) => v.replace(/'/g, ''))).toEqual([
        ...CHAT_LIMIT_BUCKETS,
      ]);
      const index = getMetadataArgsStorage().indices.find((entry) => entry.target === ChatLimitHit);
      expect(index).toMatchObject({ name: 'idx_chat_limit_hits_bucket_subject_occurred_at', columns: ['bucket', 'subjectKey', 'occurredAt'] });
    });

    it('ChatApprovalToken matches chat_approval_tokens: the hash is the key, one row per step, an expiry index', () => {
      const expected: Array<[string, Record<string, unknown>]> = [
        ['tokenHash', { type: 'varchar', length: 64, name: 'token_hash', primary: true }],
        ['collaborationRunId', { type: 'text', name: 'collaboration_run_id' }],
        ['linkId', { type: 'uuid', name: 'link_id' }],
        ['userId', { type: 'uuid', name: 'user_id' }],
        ['referralId', { type: 'text', name: 'referral_id' }],
        ['step', { type: 'integer' }],
        ['expiresAt', { type: 'timestamptz', name: 'expires_at' }],
        ['createdAt', { type: 'timestamptz', name: 'created_at' }],
      ];
      for (const [property, options] of expected) {
        const column = columnOf(ChatApprovalToken, property);
        expect(column.options).toMatchObject(options);
        expect(column.options.nullable).toBeFalsy();
        const name = (options.name as string | undefined) ?? property;
        expect(flat(tokensSql)).toContain(`"${name}" ${options.type}`);
      }
      const indices = getMetadataArgsStorage().indices.filter((entry) => entry.target === ChatApprovalToken);
      expect(indices.map((entry) => [entry.name, entry.columns, Boolean(entry.unique)])).toEqual(
        expect.arrayContaining([
          ['uq_chat_approval_tokens_referral_id', ['referralId'], true],
          ['idx_chat_approval_tokens_expires_at', ['expiresAt'], false],
        ]),
      );
    });
  });

  describe('up()', () => {
    it('probes, then one ALTER adding the seven columns, the origin default, two CREATE TABLE and three CREATE INDEX', async () => {
      createRunner();
      await migration.up(queryRunner as never);

      expect(executed).toHaveLength(8);
      expect(executed.slice(1).map(flat)).toEqual(flatUp);
      expect(executed[1].match(/ADD COLUMN/g)).toHaveLength(7);
      expect(executed.filter((sql) => /^CREATE TABLE/.test(sql))).toHaveLength(2);
      expect(executed.filter((sql) => /^CREATE (UNIQUE )?INDEX/.test(sql))).toHaveLength(3);
      expectNoDestructiveStatement(executed);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it('existing rows are never rewritten: the origin default is set after the column exists, so old rows keep NULL', async () => {
      createRunner();
      await migration.up(queryRunner as never);
      expect(executed[1]).toContain('ADD COLUMN "origin" text NULL CONSTRAINT');
      expect(executed[1]).not.toMatch(/"origin" text NULL DEFAULT/);
      expect(executed[2]).toBe(originDefaultSql);
    });

    it('the token table cascades with its delivery row; the limit table has no foreign key', async () => {
      createRunner();
      await migration.up(queryRunner as never);
      const tokens = flat(executed[5]);
      expect(tokens).toContain(
        '"collaboration_run_id" text NOT NULL REFERENCES "public"."chat_run_deliveries"("collaboration_run_id") ON DELETE CASCADE',
      );
      expect(flat(executed[3])).not.toContain('REFERENCES');
    });

    it('probes information_schema for the table, two columns and the two new tables', async () => {
      createRunner();
      await migration.up(queryRunner as never);
      const probe = executed[0];
      expect(probe).toContain('information_schema.tables');
      expect(probe).toContain('information_schema.columns');
      expect(probe).toContain("table_name = 'chat_run_deliveries'");
      expect(probe).toContain("column_name = 'parts_sent'");
      expect(probe).toContain("column_name = 'origin'");
      expect(probe).toContain("table_name = 'chat_limit_hits'");
      expect(probe).toContain("table_name = 'chat_approval_tokens'");
    });

    it('refuses when chat_run_deliveries is missing and changes nothing', async () => {
      createRunner({ deliveries: false });
      await expect(migration.up(queryRunner as never)).rejects.toThrow(/chat_run_deliveries is missing/);
      expect(executed).toHaveLength(1);
    });

    it.each([
      [{ partsSent: true }, /already has the persisted state columns/],
      [{ origin: 't' }, /already has the persisted state columns/],
      [{ limitHits: 1 }, /already exists/],
      [{ approvalTokens: 'true' }, /already exists/],
    ] as const)('refuses an unexpected state %j and changes nothing', async (probe, message) => {
      createRunner(probe);
      await expect(migration.up(queryRunner as never)).rejects.toThrow(message);
      expect(executed).toHaveLength(1);
    });

    it.each([[[]], [null], [[{}]], [[{ chat_run_deliveries_exists: 'maybe' }]]])(
      'refuses an unreadable probe %j and changes nothing',
      async (probeRows) => {
        createRunner({ probeRows });
        await expect(migration.up(queryRunner as never)).rejects.toThrow(/could not read the chat persisted state/);
        expect(executed).toHaveLength(1);
      },
    );
  });

  describe('down()', () => {
    it('drops the token table, the limit table, then the seven columns, nothing else', async () => {
      createRunner(present);
      await migration.down(queryRunner as never);
      expect(executed).toHaveLength(4);
      expect(executed.slice(1)).toEqual(downSql);
      expect(executed[3].match(/DROP COLUMN/g)).toHaveLength(7);
      for (const keep of ['collaboration_run_id', 'link_id', 'status', 'notified_referral_ids', 'created_at', 'delivered_at']) {
        expect(executed[3]).not.toContain(`"${keep}"`);
      }
      expect(executed.filter((sql) => /^DROP TABLE/.test(sql))).toEqual([
        'DROP TABLE "public"."chat_approval_tokens"',
        'DROP TABLE "public"."chat_limit_hits"',
      ]);
      expectNoDestructiveStatement(executed);
      expect(executed.join('\n')).not.toMatch(/CASCADE/);
    });

    it.each([
      { ...present, partsSent: false },
      { ...present, origin: 'f' },
      { ...present, limitHits: 0 },
      { ...present, approvalTokens: '0' },
      { deliveries: true },
    ])('refuses unless everything up() made is present (%j) and drops nothing', async (probe) => {
      createRunner(probe);
      await expect(migration.down(queryRunner as never)).rejects.toThrow(/not fully present/);
      expect(executed.some((sql) => /DROP/i.test(sql))).toBe(false);
    });

    it('refuses an unreadable probe and drops nothing', async () => {
      createRunner({ probeRows: [] });
      await expect(migration.down(queryRunner as never)).rejects.toThrow(/could not read the chat persisted state/);
      expect(executed.some((sql) => /DROP/i.test(sql))).toBe(false);
    });

    it('up then down round-trips: down removes exactly what up added', async () => {
      createRunner();
      await migration.up(queryRunner as never);
      const added = executed.slice(1).map(flat);
      createRunner(present);
      await migration.down(queryRunner as never);
      const dropped = executed.slice(1);
      const addedColumns = [...added[0].matchAll(/ADD COLUMN "([a-z_]+)"/g)].map((match) => match[1]);
      const droppedColumns = [...dropped[2].matchAll(/DROP COLUMN "([a-z_]+)"/g)].map((match) => match[1]);
      expect(droppedColumns).toEqual(addedColumns);
      const createdTables = added.flatMap((sql) => [...sql.matchAll(/^CREATE TABLE "public"\."([a-z_]+)"/g)].map((m) => m[1]));
      const droppedTables = dropped.flatMap((sql) => [...sql.matchAll(/^DROP TABLE "public"\."([a-z_]+)"/g)].map((m) => m[1]));
      expect([...droppedTables].sort()).toEqual([...createdTables].sort());
    });
  });
});
