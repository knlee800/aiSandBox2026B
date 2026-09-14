import { CreateCollaborationOrchestrationTables1773100000000 } from '../1773100000000-CreateCollaborationOrchestrationTables';

/**
 * Mocked SQL-shape tests only.
 * These do not connect to PostgreSQL and do not prove live locking, concurrency,
 * or transaction behavior. Later Lightsail PostgreSQL validation remains required.
 */
describe('CreateCollaborationOrchestrationTables1773100000000 (ORCH-PERSIST-01, mocked)', () => {
  let migration: CreateCollaborationOrchestrationTables1773100000000;
  let executedQueries: string[];
  let mockQueryRunner: {
    isTransactionActive: boolean;
    query: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
  };

  const createRunner = (options?: {
    tableExists?: boolean | string;
    runsExists?: boolean | string;
    referralsExists?: boolean | string;
    rowCount?: unknown;
    referralRowCount?: unknown;
    runRowCount?: unknown;
    omitRowCount?: boolean;
    countRows?: unknown;
    isTransactionActive?: boolean;
    lockError?: Error;
  }) => {
    executedQueries = [];
    mockQueryRunner = {
      isTransactionActive: options?.isTransactionActive ?? true,
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      query: jest.fn(async (sql: string) => {
        const trimmed = sql.trim();
        if (/LOCK TABLE/i.test(trimmed) && options?.lockError) {
          executedQueries.push(trimmed);
          throw options.lockError;
        }
        executedQueries.push(trimmed);
        if (sql.includes('"table_exists"')) {
          const existsFor = (flag: boolean | string | undefined) =>
            flag ?? options?.tableExists ?? false;
          if (sql.includes("'collaboration_runs'")) {
            return [{ table_exists: existsFor(options?.runsExists) }];
          }
          if (sql.includes("'collaboration_referrals'")) {
            return [{ table_exists: existsFor(options?.referralsExists) }];
          }
          return [{ table_exists: options?.tableExists ?? false }];
        }
        if (sql.includes('"row_count"') || /COUNT\(\*\)/i.test(sql)) {
          const isReferrals = sql.includes('collaboration_referrals');
          const selectedCount = isReferrals
            ? options?.referralRowCount
            : options?.runRowCount;
          const rowCount =
            selectedCount !== undefined ? selectedCount : options?.rowCount;
          if (options?.countRows !== undefined) {
            return options.countRows;
          }
          if (options?.omitRowCount) {
            return [{}];
          }
          if (Object.prototype.hasOwnProperty.call(options ?? {}, 'rowCount') ||
            Object.prototype.hasOwnProperty.call(options ?? {}, isReferrals ? 'referralRowCount' : 'runRowCount')) {
            return [{ row_count: rowCount }];
          }
          return [{ row_count: 0 }];
        }
        return [];
      }),
    };
    migration = new CreateCollaborationOrchestrationTables1773100000000();
  };

  const lockSql =
    'LOCK TABLE "public"."collaboration_referrals", "public"."collaboration_runs" IN ACCESS EXCLUSIVE MODE NOWAIT';

  describe('up()', () => {
    beforeEach(async () => {
      createRunner({ tableExists: false });
      await migration.up(mockQueryRunner as any);
    });

    it('creates both tables without IF NOT EXISTS', () => {
      const createTables = executedQueries.filter((q) => q.includes('CREATE TABLE'));
      expect(createTables).toHaveLength(2);
      expect(createTables[0]).toContain('CREATE TABLE "public"."collaboration_runs"');
      expect(createTables[1]).toContain(
        'CREATE TABLE "public"."collaboration_referrals"',
      );
      for (const createTable of createTables) {
        expect(createTable).not.toContain('IF NOT EXISTS');
      }
    });

    it('includes required collaboration_runs columns, CHECKs, and defaults', () => {
      const createTable = executedQueries.find((q) =>
        q.includes('CREATE TABLE "public"."collaboration_runs"'),
      )!;
      expect(createTable).toContain('"collaboration_run_id" text NOT NULL');
      expect(createTable).toContain('"user_id" text NOT NULL');
      expect(createTable).toContain('"project_id" text NOT NULL');
      expect(createTable).toContain('"initiator_agent_role" text NOT NULL');
      expect(createTable).toContain('"initiator_builder_profile_id" text NOT NULL');
      expect(createTable).toContain('"orchestration_mode" text NOT NULL');
      expect(createTable).toContain('"status" text NOT NULL');
      expect(createTable).toContain(
        '"referral_ids" jsonb NOT NULL DEFAULT \'[]\'::jsonb',
      );
      expect(createTable).toContain('"active_builder_profile_ids" jsonb NOT NULL');
      expect(createTable).toContain('"timeout_ms" integer NOT NULL');
      expect(createTable).toContain('"created_at" timestamptz NOT NULL');
      expect(createTable).toContain('"updated_at" timestamptz NOT NULL');
      expect(createTable).toContain('"completed_at" timestamptz NULL');
      expect(createTable).toContain(
        'CONSTRAINT "collaboration_runs_pkey" PRIMARY KEY ("collaboration_run_id")',
      );
      expect(createTable).toContain('CONSTRAINT "chk_collaboration_runs_status"');
      expect(createTable).toContain(
        "CHECK (\"status\" IN ('active','completed','failed','cancelled','timed_out'))",
      );
      expect(createTable).toContain('CONSTRAINT "chk_collaboration_runs_mode"');
      expect(createTable).toContain(
        `CHECK ("orchestration_mode" = 'read_only')`,
      );
    });

    it('includes required collaboration_referrals columns, CHECKs, and FK', () => {
      const createTable = executedQueries.find((q) =>
        q.includes('CREATE TABLE "public"."collaboration_referrals"'),
      )!;
      expect(createTable).toContain('"referral_id" text NOT NULL');
      expect(createTable).toContain('"collaboration_run_id" text NOT NULL');
      expect(createTable).toContain('"referral_trace_id" text NOT NULL');
      expect(createTable).toContain('"idempotency_key" text NOT NULL');
      expect(createTable).toContain('"execution_id" text NULL');
      expect(createTable).toContain('"constraint_read_only" boolean NOT NULL');
      expect(createTable).toContain(
        '"constraint_allow_write_tools" boolean NOT NULL',
      );
      expect(createTable).toContain('"constraint_allowed_tools" jsonb NOT NULL');
      expect(createTable).toContain('"result_status" text NULL');
      expect(createTable).toContain(
        'CONSTRAINT "collaboration_referrals_pkey" PRIMARY KEY ("referral_id")',
      );
      expect(createTable).toContain(
        'CONSTRAINT "chk_collaboration_referrals_status"',
      );
      expect(createTable).toContain(
        'CONSTRAINT "chk_collaboration_referrals_cancel_status"',
      );
      expect(createTable).toContain(
        'CONSTRAINT "chk_collaboration_referrals_read_only"',
      );
      expect(createTable).toContain(`CHECK ("constraint_read_only" = true)`);
      expect(createTable).toContain(
        'CONSTRAINT "chk_collaboration_referrals_allow_write_tools"',
      );
      expect(createTable).toContain(
        `CHECK ("constraint_allow_write_tools" = false)`,
      );
      expect(createTable).toContain(
        'CONSTRAINT "chk_collaboration_referrals_result_status"',
      );
      expect(createTable).toContain('CONSTRAINT "fk_collaboration_referrals_run"');
      expect(createTable).toContain(
        'FOREIGN KEY ("collaboration_run_id")',
      );
      expect(createTable).toContain(
        'REFERENCES "public"."collaboration_runs"("collaboration_run_id") ON DELETE CASCADE',
      );
    });

    it('creates required indexes including partial unique indexes', () => {
      expect(
        executedQueries.some((q) =>
          q.includes(
            'CREATE INDEX "idx_collaboration_runs_user_id" ON "public"."collaboration_runs" ("user_id")',
          ),
        ),
      ).toBe(true);
      expect(
        executedQueries.some((q) =>
          q.includes(
            'CREATE INDEX "idx_collaboration_runs_status" ON "public"."collaboration_runs" ("status")',
          ),
        ),
      ).toBe(true);
      expect(
        executedQueries.some((q) =>
          q.includes(
            'CREATE UNIQUE INDEX "uq_collaboration_referrals_trace_id" ON "public"."collaboration_referrals" ("referral_trace_id")',
          ),
        ),
      ).toBe(true);
      expect(
        executedQueries.some((q) =>
          q.includes(
            'CREATE INDEX "idx_collaboration_referrals_run_id" ON "public"."collaboration_referrals" ("collaboration_run_id")',
          ),
        ),
      ).toBe(true);
      expect(
        executedQueries.some((q) =>
          q.includes(
            'CREATE INDEX "idx_collaboration_referrals_parent_trace" ON "public"."collaboration_referrals" ("parent_referral_trace_id")',
          ),
        ),
      ).toBe(true);
      expect(
        executedQueries.some((q) =>
          q.includes(
            'CREATE INDEX "idx_collaboration_referrals_status" ON "public"."collaboration_referrals" ("status")',
          ),
        ),
      ).toBe(true);
      expect(
        executedQueries.some((q) =>
          q.includes(
            `CREATE UNIQUE INDEX "uq_collaboration_referrals_idempotency_active" ON "public"."collaboration_referrals" ("collaboration_run_id", "idempotency_key") WHERE "status" NOT IN ('failed','cancelled','timed_out')`,
          ),
        ),
      ).toBe(true);
      expect(
        executedQueries.some((q) =>
          q.includes(
            'CREATE UNIQUE INDEX "uq_collaboration_referrals_execution_id" ON "public"."collaboration_referrals" ("execution_id") WHERE "execution_id" IS NOT NULL',
          ),
        ),
      ).toBe(true);
    });

    it('does not create an audit table', () => {
      expect(
        executedQueries.some((q) => q.includes('orchestration_audit')),
      ).toBe(false);
    });

    it('does not insert rows or GRANT privileges', () => {
      const mutating = executedQueries.filter(
        (q) =>
          /\bINSERT\b/i.test(q) ||
          /\bUPDATE\b/i.test(q) ||
          /\bGRANT\b/i.test(q) ||
          /\bCOPY\b/i.test(q),
      );
      expect(mutating).toEqual([]);
    });
  });

  describe('up() existing-table conflict', () => {
    it('fails closed when collaboration_runs already exists and does not CREATE TABLE', async () => {
      createRunner({ runsExists: true, referralsExists: false });
      await expect(migration.up(mockQueryRunner as any)).rejects.toThrow(
        /AGENT-PLATFORM-ORCH-PERSIST-01: public\.collaboration_runs already exists/,
      );
      expect(executedQueries.some((q) => q.includes('CREATE TABLE'))).toBe(false);
    });

    it('fails closed when collaboration_referrals already exists and does not CREATE TABLE', async () => {
      createRunner({ runsExists: false, referralsExists: true });
      await expect(migration.up(mockQueryRunner as any)).rejects.toThrow(
        /AGENT-PLATFORM-ORCH-PERSIST-01: public\.collaboration_referrals already exists/,
      );
      expect(executedQueries.some((q) => q.includes('CREATE TABLE'))).toBe(false);
    });
  });

  describe('down()', () => {
    const expectNoDrops = () => {
      expect(executedQueries.some((q) => /\bDROP TABLE\b/i.test(q))).toBe(false);
      expect(executedQueries.some((q) => /\bDROP INDEX\b/i.test(q))).toBe(false);
    };

    it('rejects when QueryRunner has no active transaction before rollback SQL', async () => {
      createRunner({ isTransactionActive: false, rowCount: 0 });
      await expect(migration.down(mockQueryRunner as any)).rejects.toThrow(
        /no active QueryRunner transaction/,
      );
      expect(executedQueries).toEqual([]);
    });

    it('takes ACCESS EXCLUSIVE NOWAIT before emptiness query and all DROPs', async () => {
      createRunner({ rowCount: 0 });
      await migration.down(mockQueryRunner as any);
      const lockIdx = executedQueries.findIndex((q) => q.includes(lockSql));
      const countIdx = executedQueries.findIndex((q) => /COUNT\(\*\)/i.test(q));
      const dropIdxs = executedQueries
        .map((q, i) => (/\bDROP\b/i.test(q) ? i : -1))
        .filter((i) => i >= 0);
      expect(lockIdx).toBe(0);
      expect(countIdx).toBeGreaterThan(lockIdx);
      expect(dropIdxs.length).toBeGreaterThan(0);
      expect(Math.min(...dropIdxs)).toBeGreaterThan(countIdx);
    });

    it('does not count or DROP when the lock fails', async () => {
      createRunner({
        rowCount: 0,
        lockError: new Error(
          'could not obtain lock on relation "collaboration_referrals"',
        ),
      });
      await expect(migration.down(mockQueryRunner as any)).rejects.toThrow(
        /could not obtain lock/,
      );
      expect(executedQueries.some((q) => /COUNT\(\*\)/i.test(q))).toBe(false);
      expectNoDrops();
    });

    it('rejects a positive referrals row count without DROP', async () => {
      createRunner({ referralRowCount: 3, runRowCount: 0 });
      await expect(migration.down(mockQueryRunner as any)).rejects.toThrow(
        /refusing to DROP populated public\.collaboration_referrals \(3 rows\)/,
      );
      expect(executedQueries.some((q) => q.includes(lockSql))).toBe(true);
      expectNoDrops();
    });

    it('rejects a positive runs row count without DROP', async () => {
      createRunner({ referralRowCount: 0, runRowCount: 2 });
      await expect(migration.down(mockQueryRunner as any)).rejects.toThrow(
        /refusing to DROP populated public\.collaboration_runs \(2 rows\)/,
      );
      expectNoDrops();
    });

    it('rejects missing count without DROP', async () => {
      createRunner({ omitRowCount: true });
      await expect(migration.down(mockQueryRunner as any)).rejects.toThrow(
        /row_count missing from count result/,
      );
      expectNoDrops();
    });

    it('rejects empty count rows without DROP', async () => {
      createRunner({ countRows: [] });
      await expect(migration.down(mockQueryRunner as any)).rejects.toThrow(
        /could not read collaboration_referrals row count/,
      );
      expectNoDrops();
    });

    it.each([
      ['null', null],
      ['empty string', ''],
      ['boolean false', false],
      ['boolean true', true],
      ['malformed string', '3 rows'],
      ['leading-zero string', '00'],
    ])('rejects %s count without DROP', async (_label, rowCount) => {
      createRunner({ rowCount });
      await expect(migration.down(mockQueryRunner as any)).rejects.toThrow(
        /invalid collaboration_referrals row count/,
      );
      expectNoDrops();
    });

    it('permits schema-qualified rollback only for explicit integer zero', async () => {
      createRunner({ rowCount: 0 });
      await migration.down(mockQueryRunner as any);
      expect(executedQueries[0]).toBe(lockSql);
      expect(
        executedQueries.some((q) => /FROM "public"\."collaboration_referrals"/.test(q)),
      ).toBe(true);
      expect(
        executedQueries.some((q) => /FROM "public"\."collaboration_runs"/.test(q)),
      ).toBe(true);
      expect(executedQueries).toContain(
        'DROP INDEX "public"."uq_collaboration_referrals_execution_id"',
      );
      expect(executedQueries).toContain(
        'DROP INDEX "public"."uq_collaboration_referrals_idempotency_active"',
      );
      expect(executedQueries).toContain(
        'DROP INDEX "public"."idx_collaboration_referrals_status"',
      );
      expect(executedQueries).toContain(
        'DROP INDEX "public"."idx_collaboration_referrals_parent_trace"',
      );
      expect(executedQueries).toContain(
        'DROP INDEX "public"."idx_collaboration_referrals_run_id"',
      );
      expect(executedQueries).toContain(
        'DROP INDEX "public"."uq_collaboration_referrals_trace_id"',
      );
      expect(executedQueries).toContain(
        'DROP TABLE "public"."collaboration_referrals"',
      );
      expect(executedQueries).toContain(
        'DROP INDEX "public"."idx_collaboration_runs_status"',
      );
      expect(executedQueries).toContain(
        'DROP INDEX "public"."idx_collaboration_runs_user_id"',
      );
      expect(executedQueries).toContain('DROP TABLE "public"."collaboration_runs"');
      expect(executedQueries.some((q) => q.includes('IF EXISTS'))).toBe(false);
    });

    it('permits schema-qualified rollback for canonical digit string zero', async () => {
      createRunner({ rowCount: '0' });
      await migration.down(mockQueryRunner as any);
      expect(executedQueries).toContain(
        'DROP TABLE "public"."collaboration_referrals"',
      );
      expect(executedQueries).toContain('DROP TABLE "public"."collaboration_runs"');
    });

    it('does not start, commit, or roll back the QueryRunner transaction', async () => {
      createRunner({ rowCount: 0 });
      await migration.down(mockQueryRunner as any);
      expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.query).not.toHaveBeenCalledWith(
        expect.stringMatching(/^\s*(COMMIT|ROLLBACK)\b/i),
      );
    });
  });
});
