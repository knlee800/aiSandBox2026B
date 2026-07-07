/**
 * BILLING-READY-03D2: Concurrency & Idempotency Integration Validation
 *
 * Opt-in only: runs when RUN_CREDIT_DB_INTEGRATION=true.
 * Requires a live PostgreSQL instance with migration 1772100000000 applied.
 */

import { DataSource, Repository } from 'typeorm';
import { CreditBalance } from '../../../entities/credit-balance.entity';
import { CreditDeductionRecord } from '../../../entities/credit-deduction-record.entity';
import { CreditBalanceRepository } from '../credit-balance.repository';
import { CreditDeductionRecordRepository } from '../credit-deduction-record.repository';
import { CreditCalculationService } from '../credit-calculation.service';
import { PersistentCreditDeductionGateway } from '../persistent-credit-deduction.gateway';
import type { CreditDeductionEvent } from '../types';

const SHOULD_RUN = process.env.RUN_CREDIT_DB_INTEGRATION === 'true';

const TEST_OWNER_PREFIX = 'test-concurrency-';

function describeIf(condition: boolean) {
  return condition ? describe : describe.skip;
}

function makeEvent(
  ownerId: string,
  sourceEventId: string,
  creditsRequested: number,
): CreditDeductionEvent {
  return {
    source: 'usage_ledger',
    sourceEventId,
    ownerId,
    occurredAt: new Date(),
    lineItems: [
      {
        category: 'model_tokens',
        unit: '1K_tokens',
        unitCount: creditsRequested,
        creditsRequested,
      },
    ],
  };
}

describeIf(SHOULD_RUN)(
  'BILLING-READY-03D2: Credit Deduction Concurrency Integration',
  () => {
    let dataSource: DataSource;
    let balanceRepo: CreditBalanceRepository;
    let recordRepo: CreditDeductionRecordRepository;
    let calcService: CreditCalculationService;
    let gateway: PersistentCreditDeductionGateway;
    let rawBalanceRepo: Repository<CreditBalance>;
    let rawRecordRepo: Repository<CreditDeductionRecord>;

    beforeAll(async () => {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error(
          'DATABASE_URL must be set for credit deduction integration tests',
        );
      }

      dataSource = new DataSource({
        type: 'postgres',
        url: databaseUrl,
        entities: [CreditBalance, CreditDeductionRecord],
        synchronize: false,
        logging: false,
      });

      await dataSource.initialize();

      rawBalanceRepo = dataSource.getRepository(CreditBalance);
      rawRecordRepo = dataSource.getRepository(CreditDeductionRecord);

      // Inject the raw TypeORM repository via reflection to bypass @InjectRepository
      balanceRepo = new CreditBalanceRepository(rawBalanceRepo as any);
      recordRepo = new CreditDeductionRecordRepository(rawRecordRepo as any);
      calcService = new CreditCalculationService();
      gateway = new PersistentCreditDeductionGateway(
        calcService,
        balanceRepo,
        recordRepo,
        dataSource,
      );

      // Cleanup any leftover test data
      await rawRecordRepo
        .createQueryBuilder()
        .delete()
        .where('owner_id LIKE :prefix', { prefix: `${TEST_OWNER_PREFIX}%` })
        .execute();
      await rawBalanceRepo
        .createQueryBuilder()
        .delete()
        .where('owner_id LIKE :prefix', { prefix: `${TEST_OWNER_PREFIX}%` })
        .execute();
    }, 30_000);

    afterAll(async () => {
      if (!dataSource?.isInitialized) return;

      // Final cleanup
      await rawRecordRepo
        .createQueryBuilder()
        .delete()
        .where('owner_id LIKE :prefix', { prefix: `${TEST_OWNER_PREFIX}%` })
        .execute();
      await rawBalanceRepo
        .createQueryBuilder()
        .delete()
        .where('owner_id LIKE :prefix', { prefix: `${TEST_OWNER_PREFIX}%` })
        .execute();

      // Verify zero test rows remain
      const remainingRecords = await rawRecordRepo
        .createQueryBuilder('r')
        .where('r.owner_id LIKE :prefix', { prefix: `${TEST_OWNER_PREFIX}%` })
        .getCount();
      const remainingBalances = await rawBalanceRepo
        .createQueryBuilder('b')
        .where('b.owner_id LIKE :prefix', { prefix: `${TEST_OWNER_PREFIX}%` })
        .getCount();

      expect(remainingRecords).toBe(0);
      expect(remainingBalances).toBe(0);

      await dataSource.destroy();
    }, 30_000);

    async function createBalance(
      ownerId: string,
      balance: number,
    ): Promise<CreditBalance> {
      return balanceRepo.create({
        ownerId,
        ownerType: 'user',
        planId: 'free',
        balance,
        monthlyAllocation: balance,
        rolloverBalance: 0,
        status: 'active',
        periodStart: new Date('2026-07-01'),
        periodEnd: new Date('2026-08-01'),
      });
    }

    describe('A. Concurrent same-sourceEventId', () => {
      const OWNER_ID = `${TEST_OWNER_PREFIX}same-A`;
      const SOURCE_EVENT_ID = `evt-concurrent-same-${Date.now()}`;
      const CONCURRENCY = 8;
      const CREDITS_PER_EVENT = 100;

      beforeAll(async () => {
        await createBalance(OWNER_ID, 1000);
      });

      it('should deduct exactly once despite concurrent identical events', async () => {
        const promises = Array.from({ length: CONCURRENCY }, () =>
          gateway.applyDeduction(
            makeEvent(OWNER_ID, SOURCE_EVENT_ID, CREDITS_PER_EVENT),
          ),
        );

        const results = await Promise.allSettled(promises);
        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        expect(fulfilled.length).toBe(CONCURRENCY);

        // Exactly 1 deduction record for this sourceEventId
        const records = await rawRecordRepo.find({
          where: { sourceEventId: SOURCE_EVENT_ID },
        });
        expect(records).toHaveLength(1);
        expect(records[0].appliedCredits).toBe(CREDITS_PER_EVENT);

        // Balance deducted once only
        const bal = await balanceRepo.findByOwner(OWNER_ID);
        expect(bal).not.toBeNull();
        expect(bal!.balance).toBe(1000 - CREDITS_PER_EVENT);

        // Duplicate results should have skippedDuplicate = true on line items
        const fulfilledResults = fulfilled.map(
          (r) => (r as PromiseFulfilledResult<any>).value,
        );
        const duplicates = fulfilledResults.filter((r) =>
          r.lineItems.some(
            (li: { skippedDuplicate: boolean }) => li.skippedDuplicate,
          ),
        );
        expect(duplicates.length).toBe(CONCURRENCY - 1);
      }, 30_000);
    });

    describe('B. Serial retry idempotency', () => {
      const OWNER_ID = `${TEST_OWNER_PREFIX}same-B`;
      const SOURCE_EVENT_ID = `evt-serial-idem-${Date.now()}`;
      const CREDITS = 50;

      beforeAll(async () => {
        await createBalance(OWNER_ID, 500);
      });

      it('should produce exactly 1 record after repeated serial calls', async () => {
        for (let i = 0; i < 5; i++) {
          await gateway.applyDeduction(
            makeEvent(OWNER_ID, SOURCE_EVENT_ID, CREDITS),
          );
        }

        const records = await rawRecordRepo.find({
          where: { sourceEventId: SOURCE_EVENT_ID },
        });
        expect(records).toHaveLength(1);

        const bal = await balanceRepo.findByOwner(OWNER_ID);
        expect(bal).not.toBeNull();
        expect(bal!.balance).toBe(500 - CREDITS);
      }, 30_000);
    });

    describe('C. Concurrent different-sourceEventId', () => {
      const OWNER_ID = `${TEST_OWNER_PREFIX}different-C`;
      const STARTING_BALANCE = 500;
      const CREDITS_PER_EVENT = 100;
      const EVENT_COUNT = 10;

      beforeAll(async () => {
        await createBalance(OWNER_ID, STARTING_BALANCE);
      });

      it('should serialize deductions, apply up to balance, overflow the rest', async () => {
        const events = Array.from({ length: EVENT_COUNT }, (_, i) =>
          makeEvent(
            OWNER_ID,
            `evt-diff-${Date.now()}-${i}`,
            CREDITS_PER_EVENT,
          ),
        );

        const promises = events.map((e) => gateway.applyDeduction(e));
        const results = await Promise.allSettled(promises);
        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        expect(fulfilled.length).toBe(EVENT_COUNT);

        // All 10 records exist
        const records = await rawRecordRepo.find({
          where: { ownerId: OWNER_ID },
        });
        expect(records).toHaveLength(EVENT_COUNT);

        // Total applied should equal starting balance
        const totalApplied = records.reduce(
          (sum, r) => sum + r.appliedCredits,
          0,
        );
        expect(totalApplied).toBe(STARTING_BALANCE);

        // Total overflow should equal total requested minus starting balance
        const totalOverflow = records.reduce(
          (sum, r) => sum + r.overflowCredits,
          0,
        );
        expect(totalOverflow).toBe(
          EVENT_COUNT * CREDITS_PER_EVENT - STARTING_BALANCE,
        );

        // Final balance = 0
        const bal = await balanceRepo.findByOwner(OWNER_ID);
        expect(bal).not.toBeNull();
        expect(bal!.balance).toBe(0);

        // No record has balanceAfter < 0 (enforced by CHECK but verify data)
        for (const record of records) {
          expect(record.balanceAfter).toBeGreaterThanOrEqual(0);
        }
      }, 60_000);
    });

    describe('D. Over-balance single deduction', () => {
      const OWNER_ID = `${TEST_OWNER_PREFIX}same-D`;
      const STARTING_BALANCE = 50;
      const CREDITS_REQUESTED = 200;

      beforeAll(async () => {
        await createBalance(OWNER_ID, STARTING_BALANCE);
      });

      it('should cap at available balance and overflow the rest', async () => {
        const result = await gateway.applyDeduction(
          makeEvent(OWNER_ID, `evt-overbal-${Date.now()}`, CREDITS_REQUESTED),
        );

        expect(result.totalCreditsApplied).toBe(STARTING_BALANCE);
        expect(result.totalCreditsOverflow).toBe(
          CREDITS_REQUESTED - STARTING_BALANCE,
        );
        expect(result.balanceAfter).toBe(0);

        const bal = await balanceRepo.findByOwner(OWNER_ID);
        expect(bal).not.toBeNull();
        expect(bal!.balance).toBe(0);
      }, 15_000);
    });

    describe('E. One-record-per-sourceEventId invariant', () => {
      it('should have exactly 1 record per sourceEventId for all test data', async () => {
        const records = await rawRecordRepo
          .createQueryBuilder('r')
          .select('r.source_event_id', 'source_event_id')
          .addSelect('COUNT(*)', 'cnt')
          .where('r.owner_id LIKE :prefix', {
            prefix: `${TEST_OWNER_PREFIX}%`,
          })
          .groupBy('r.source_event_id')
          .getRawMany<{ source_event_id: string; cnt: string }>();

        for (const row of records) {
          expect(Number(row.cnt)).toBe(1);
        }

        expect(records.length).toBeGreaterThan(0);
      }, 15_000);
    });

    describe('F. Cleanup verification', () => {
      it('afterAll will verify zero test rows remain (see afterAll block)', () => {
        // Actual verification happens in afterAll
        expect(true).toBe(true);
      });
    });
  },
);
