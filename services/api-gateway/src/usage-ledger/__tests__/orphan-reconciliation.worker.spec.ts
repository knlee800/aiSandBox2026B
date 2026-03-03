import { Test, TestingModule } from '@nestjs/testing';
import { OrphanReconciliationWorker } from '../orphan-reconciliation.worker';
import { UsageLedgerService } from '../usage-ledger.service';
import { UsageRecord } from '../../entities/usage-record.entity';

describe('OrphanReconciliationWorker', () => {
  let worker: OrphanReconciliationWorker;
  let usageLedgerService: jest.Mocked<UsageLedgerService>;

  const mockOrphanRecord = (executionId: string, ageMinutes: number): Partial<UsageRecord> => ({
    executionId,
    userId: 'user-1',
    apiKeyId: 'key-1',
    sessionId: '11111111-1111-1111-1111-111111111111',
    conversationId: '22222222-2222-2222-2222-222222222222',
    provider: 'stub',
    adapter: 'stub',
    executionStatus: 'pending',
    timestamp: new Date(Date.now() - ageMinutes * 60 * 1000),
  });

  beforeEach(async () => {
    const mockUsageLedgerService = {
      findOrphanedPending: jest.fn(),
      batchTransitionOrphansToTimeout: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrphanReconciliationWorker,
        {
          provide: UsageLedgerService,
          useValue: mockUsageLedgerService,
        },
      ],
    }).compile();

    worker = module.get<OrphanReconciliationWorker>(OrphanReconciliationWorker);
    usageLedgerService = module.get(UsageLedgerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('runReconciliation', () => {
    it('should return zeros when no orphans found', async () => {
      usageLedgerService.findOrphanedPending.mockResolvedValue([]);

      const result = await worker.runReconciliation();

      expect(result).toEqual({ found: 0, transitioned: 0 });
      expect(usageLedgerService.findOrphanedPending).toHaveBeenCalledTimes(1);
      expect(usageLedgerService.batchTransitionOrphansToTimeout).not.toHaveBeenCalled();
    });

    it('should transition orphaned pending records to timeout', async () => {
      const orphans = [
        mockOrphanRecord('exec-1', 10),
        mockOrphanRecord('exec-2', 15),
        mockOrphanRecord('exec-3', 20),
      ] as UsageRecord[];

      usageLedgerService.findOrphanedPending.mockResolvedValue(orphans);
      usageLedgerService.batchTransitionOrphansToTimeout.mockResolvedValue(3);

      const result = await worker.runReconciliation();

      expect(result).toEqual({ found: 3, transitioned: 3 });
      expect(usageLedgerService.findOrphanedPending).toHaveBeenCalledTimes(1);
      expect(usageLedgerService.batchTransitionOrphansToTimeout).toHaveBeenCalledWith([
        'exec-1',
        'exec-2',
        'exec-3',
      ]);
    });

    it('should handle partial transitions (some already transitioned)', async () => {
      const orphans = [
        mockOrphanRecord('exec-1', 10),
        mockOrphanRecord('exec-2', 15),
      ] as UsageRecord[];

      usageLedgerService.findOrphanedPending.mockResolvedValue(orphans);
      usageLedgerService.batchTransitionOrphansToTimeout.mockResolvedValue(1);

      const result = await worker.runReconciliation();

      expect(result).toEqual({ found: 2, transitioned: 1 });
    });

    it('should not run concurrent scans', async () => {
      const orphans = [mockOrphanRecord('exec-1', 10)] as UsageRecord[];

      let resolveFirst: () => void;
      const firstScanPromise = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });

      usageLedgerService.findOrphanedPending.mockImplementationOnce(async () => {
        await firstScanPromise;
        return orphans;
      });
      usageLedgerService.batchTransitionOrphansToTimeout.mockResolvedValue(1);

      const firstScan = worker.runReconciliation();
      const secondScan = worker.runReconciliation();

      const secondResult = await secondScan;
      expect(secondResult).toEqual({ found: 0, transitioned: 0 });

      resolveFirst!();
      const firstResult = await firstScan;
      expect(firstResult).toEqual({ found: 1, transitioned: 1 });
    });
  });
});
