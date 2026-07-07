import { Global, Module } from '@nestjs/common';
import { PersistentCreditDeductionGateway } from '../persistent-credit-deduction.gateway';
import { CreditDeductionGateway } from '../credit-deduction.gateway';
import { CreditCalculationService } from '../credit-calculation.service';
import { CreditBalanceRepository } from '../credit-balance.repository';
import { CreditDeductionRecordRepository } from '../credit-deduction-record.repository';
import { CalculatingCreditDeductionGateway } from '../calculating-credit-deduction.gateway';
import { CreditDeductionModule } from '../credit-deduction.module';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';
import type { CreditDeductionEvent } from '../types';
import { CreditBalance } from '../../../entities/credit-balance.entity';
import { CreditDeductionRecord } from '../../../entities/credit-deduction-record.entity';

@Global()
@Module({
  providers: [{ provide: DataSource, useValue: {} }],
  exports: [DataSource],
})
class MockDataSourceModule {}

function makeEvent(
  overrides: Partial<CreditDeductionEvent> = {},
): CreditDeductionEvent {
  return {
    source: 'usage_ledger',
    sourceEventId: 'evt-persist-001',
    ownerId: 'user-500',
    occurredAt: new Date('2026-07-07T12:00:00.000Z'),
    lineItems: [
      {
        category: 'model_tokens',
        unit: '1K_tokens',
        unitCount: 5,
        creditsRequested: 0,
      },
      {
        category: 'tool_call',
        unit: 'call',
        unitCount: 2,
        creditsRequested: 0,
      },
    ],
    ...overrides,
  };
}

function makeBalance(overrides: Partial<CreditBalance> = {}): CreditBalance {
  return {
    id: 'bal-uuid-001',
    ownerId: 'user-500',
    ownerType: 'user',
    planId: 'free',
    balance: 100,
    monthlyAllocation: 100,
    rolloverBalance: 0,
    status: 'active',
    periodStart: new Date('2026-07-01'),
    periodEnd: new Date('2026-08-01'),
    resetAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRecord(
  overrides: Partial<CreditDeductionRecord> = {},
): CreditDeductionRecord {
  return {
    id: 'rec-uuid-001',
    ownerId: 'user-500',
    sourceEventId: 'evt-persist-001',
    sourceEventType: 'usage_ledger',
    agentId: null,
    sessionId: null,
    executionId: null,
    modelId: null,
    requestedCredits: 9,
    appliedCredits: 9,
    overflowCredits: 0,
    balanceBefore: 100,
    balanceAfter: 91,
    lineItems: [
      {
        category: 'model_tokens',
        creditsRequested: 5,
        creditsApplied: 5,
        creditsOverflow: 0,
        skippedDuplicate: false,
      },
      {
        category: 'tool_call',
        creditsRequested: 4,
        creditsApplied: 4,
        creditsOverflow: 0,
        skippedDuplicate: false,
      },
    ],
    metadata: null,
    status: 'applied',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('PersistentCreditDeductionGateway', () => {
  let gateway: PersistentCreditDeductionGateway;
  let calculationService: CreditCalculationService;
  let mockBalanceRepo: jest.Mocked<CreditBalanceRepository>;
  let mockRecordRepo: jest.Mocked<CreditDeductionRecordRepository>;
  let mockDataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let mockManager: EntityManager;

  beforeEach(() => {
    calculationService = new CreditCalculationService();

    mockBalanceRepo = {
      findByOwner: jest.fn(),
      findByOwnerForUpdate: jest.fn(),
      create: jest.fn(),
      deductBalance: jest.fn(),
      resetForNewPeriod: jest.fn(),
    } as unknown as jest.Mocked<CreditBalanceRepository>;

    mockRecordRepo = {
      findBySourceEventId: jest.fn(),
      create: jest.fn(),
      findByOwner: jest.fn(),
      findBySession: jest.fn(),
      findByExecution: jest.fn(),
    } as unknown as jest.Mocked<CreditDeductionRecordRepository>;

    mockManager = { _isTransactionalManager: true } as unknown as EntityManager;
    mockDataSource = {
      transaction: jest.fn(async (cb: any) => cb(mockManager)),
    } as any;

    gateway = new PersistentCreditDeductionGateway(
      calculationService,
      mockBalanceRepo,
      mockRecordRepo,
      mockDataSource as unknown as DataSource,
    );
  });

  describe('class hierarchy', () => {
    it('extends CreditDeductionGateway', () => {
      expect(gateway).toBeInstanceOf(CreditDeductionGateway);
    });

    it('has an async applyDeduction method', () => {
      expect(typeof gateway.applyDeduction).toBe('function');
    });
  });

  describe('new deduction with sufficient balance', () => {
    beforeEach(() => {
      mockRecordRepo.findBySourceEventId.mockResolvedValue(null);
      mockBalanceRepo.findByOwnerForUpdate.mockResolvedValue(makeBalance());
      mockRecordRepo.create.mockImplementation(async (params) =>
        makeRecord({
          requestedCredits: params.requestedCredits,
          appliedCredits: params.appliedCredits,
          overflowCredits: params.overflowCredits,
          balanceBefore: params.balanceBefore,
          balanceAfter: params.balanceAfter,
          lineItems: params.lineItems,
        }),
      );
      mockBalanceRepo.deductBalance.mockResolvedValue(
        makeBalance({ balance: 91 }),
      );
    });

    it('calculates credits and deducts from balance', async () => {
      const result = await gateway.applyDeduction(makeEvent());

      // model_tokens: 5 × 1 = 5, tool_call: 2 × 2 = 4 → total = 9
      expect(result.totalCreditsRequested).toBe(9);
      expect(result.totalCreditsApplied).toBe(9);
      expect(result.totalCreditsOverflow).toBe(0);
      expect(result.balanceAfter).toBe(91); // 100 - 9
    });

    it('returns per-line-item breakdown', async () => {
      const result = await gateway.applyDeduction(makeEvent());

      expect(result.lineItems).toHaveLength(2);
      expect(result.lineItems[0]).toEqual({
        category: 'model_tokens',
        creditsRequested: 5,
        creditsApplied: 5,
        creditsOverflow: 0,
        skippedDuplicate: false,
      });
      expect(result.lineItems[1]).toEqual({
        category: 'tool_call',
        creditsRequested: 4,
        creditsApplied: 4,
        creditsOverflow: 0,
        skippedDuplicate: false,
      });
    });

    it('preserves source metadata in result', async () => {
      const event = makeEvent({
        source: 'token_usage',
        sourceEventId: 'tu-abc',
        ownerId: 'user-789',
      });
      mockBalanceRepo.findByOwnerForUpdate.mockResolvedValue(
        makeBalance({ ownerId: 'user-789' }),
      );

      const result = await gateway.applyDeduction(event);

      expect(result.source).toBe('token_usage');
      expect(result.sourceEventId).toBe('tu-abc');
      expect(result.ownerId).toBe('user-789');
    });

    it('calls findByOwnerForUpdate with transactional manager for row lock', async () => {
      await gateway.applyDeduction(makeEvent());

      expect(mockBalanceRepo.findByOwnerForUpdate).toHaveBeenCalledWith(
        'user-500',
        'user',
        mockManager,
      );
    });

    it('creates a deduction record with transactional manager', async () => {
      await gateway.applyDeduction(makeEvent());

      expect(mockRecordRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: 'user-500',
          sourceEventId: 'evt-persist-001',
          sourceEventType: 'usage_ledger',
          requestedCredits: 9,
          appliedCredits: 9,
          overflowCredits: 0,
          balanceBefore: 100,
          balanceAfter: 91,
          status: 'applied',
        }),
        mockManager,
      );
    });

    it('updates balance via deductBalance with transactional manager', async () => {
      await gateway.applyDeduction(makeEvent());

      expect(mockBalanceRepo.deductBalance).toHaveBeenCalledWith(
        'bal-uuid-001',
        91,
        mockManager,
      );
    });

    it('passes metadata to deduction record', async () => {
      const event = makeEvent({
        metadata: { model: 'gpt-4', sessionId: 'sess-abc' },
      });

      await gateway.applyDeduction(event);

      expect(mockRecordRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { model: 'gpt-4', sessionId: 'sess-abc' },
        }),
        mockManager,
      );
    });

    it('stores null metadata when event has no metadata', async () => {
      const event = makeEvent();

      await gateway.applyDeduction(event);

      expect(mockRecordRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: null,
        }),
        mockManager,
      );
    });
  });

  describe('new deduction with insufficient balance (overflow)', () => {
    beforeEach(() => {
      mockRecordRepo.findBySourceEventId.mockResolvedValue(null);
      mockBalanceRepo.findByOwnerForUpdate.mockResolvedValue(
        makeBalance({ balance: 3 }),
      );
      mockRecordRepo.create.mockImplementation(async (params) =>
        makeRecord({
          requestedCredits: params.requestedCredits,
          appliedCredits: params.appliedCredits,
          overflowCredits: params.overflowCredits,
          balanceBefore: params.balanceBefore,
          balanceAfter: params.balanceAfter,
          lineItems: params.lineItems,
        }),
      );
      mockBalanceRepo.deductBalance.mockResolvedValue(
        makeBalance({ balance: 0 }),
      );
    });

    it('applies only available balance and reports overflow', async () => {
      const result = await gateway.applyDeduction(makeEvent());

      // Requested 9, only 3 available
      expect(result.totalCreditsRequested).toBe(9);
      expect(result.totalCreditsApplied).toBe(3);
      expect(result.totalCreditsOverflow).toBe(6);
      expect(result.balanceAfter).toBe(0);
    });

    it('distributes applied credits sequentially across line items', async () => {
      const result = await gateway.applyDeduction(makeEvent());

      // First line item (model_tokens, 5 requested): gets 3 (all remaining budget)
      expect(result.lineItems[0].creditsRequested).toBe(5);
      expect(result.lineItems[0].creditsApplied).toBe(3);
      expect(result.lineItems[0].creditsOverflow).toBe(2);

      // Second line item (tool_call, 4 requested): gets 0 (budget exhausted)
      expect(result.lineItems[1].creditsRequested).toBe(4);
      expect(result.lineItems[1].creditsApplied).toBe(0);
      expect(result.lineItems[1].creditsOverflow).toBe(4);
    });

    it('creates record with overflow amounts via transactional manager', async () => {
      await gateway.applyDeduction(makeEvent());

      expect(mockRecordRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          appliedCredits: 3,
          overflowCredits: 6,
          balanceBefore: 3,
          balanceAfter: 0,
        }),
        mockManager,
      );
    });

    it('deducts balance to zero via transactional manager', async () => {
      await gateway.applyDeduction(makeEvent());

      expect(mockBalanceRepo.deductBalance).toHaveBeenCalledWith(
        'bal-uuid-001',
        0,
        mockManager,
      );
    });
  });

  describe('zero balance — full overflow', () => {
    beforeEach(() => {
      mockRecordRepo.findBySourceEventId.mockResolvedValue(null);
      mockBalanceRepo.findByOwnerForUpdate.mockResolvedValue(
        makeBalance({ balance: 0 }),
      );
      mockRecordRepo.create.mockImplementation(async (params) =>
        makeRecord({
          requestedCredits: params.requestedCredits,
          appliedCredits: params.appliedCredits,
          overflowCredits: params.overflowCredits,
          balanceBefore: params.balanceBefore,
          balanceAfter: params.balanceAfter,
          lineItems: params.lineItems,
        }),
      );
      mockBalanceRepo.deductBalance.mockResolvedValue(
        makeBalance({ balance: 0 }),
      );
    });

    it('reports all credits as overflow when balance is zero', async () => {
      const result = await gateway.applyDeduction(makeEvent());

      expect(result.totalCreditsApplied).toBe(0);
      expect(result.totalCreditsOverflow).toBe(9);
      expect(result.balanceAfter).toBe(0);
    });

    it('keeps balanceAfter 0 and creditsOverflow > 0', async () => {
      const result = await gateway.applyDeduction(makeEvent());

      expect(result.balanceAfter).toBe(0);
      expect(result.totalCreditsOverflow).toBeGreaterThan(0);
      expect(result.totalCreditsApplied).toBe(0);
    });
  });

  describe('duplicate sourceEventId — idempotency', () => {
    it('returns existing result without balance mutation', async () => {
      const existingRecord = makeRecord();
      mockRecordRepo.findBySourceEventId.mockResolvedValue(existingRecord);

      const result = await gateway.applyDeduction(makeEvent());

      expect(result.sourceEventId).toBe('evt-persist-001');
      expect(result.totalCreditsRequested).toBe(9);
      expect(result.totalCreditsApplied).toBe(9);
      expect(result.balanceAfter).toBe(91);
    });

    it('marks all line items as skippedDuplicate', async () => {
      mockRecordRepo.findBySourceEventId.mockResolvedValue(makeRecord());

      const result = await gateway.applyDeduction(makeEvent());

      expect(result.lineItems.every((li) => li.skippedDuplicate)).toBe(true);
    });

    it('does not start a transaction', async () => {
      mockRecordRepo.findBySourceEventId.mockResolvedValue(makeRecord());

      await gateway.applyDeduction(makeEvent());

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('does not call findByOwnerForUpdate', async () => {
      mockRecordRepo.findBySourceEventId.mockResolvedValue(makeRecord());

      await gateway.applyDeduction(makeEvent());

      expect(mockBalanceRepo.findByOwnerForUpdate).not.toHaveBeenCalled();
    });

    it('does not create a new deduction record', async () => {
      mockRecordRepo.findBySourceEventId.mockResolvedValue(makeRecord());

      await gateway.applyDeduction(makeEvent());

      expect(mockRecordRepo.create).not.toHaveBeenCalled();
    });

    it('does not call deductBalance', async () => {
      mockRecordRepo.findBySourceEventId.mockResolvedValue(makeRecord());

      await gateway.applyDeduction(makeEvent());

      expect(mockBalanceRepo.deductBalance).not.toHaveBeenCalled();
    });
  });

  describe('unique constraint race condition', () => {
    it('falls back to SELECT when INSERT hits unique violation inside transaction', async () => {
      const existingRecord = makeRecord();
      mockRecordRepo.findBySourceEventId
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingRecord);
      mockBalanceRepo.findByOwnerForUpdate.mockResolvedValue(makeBalance());

      const uniqueError = new Error('duplicate key value violates unique constraint');
      (uniqueError as Error & { code: string }).code = '23505';
      mockRecordRepo.create.mockRejectedValue(uniqueError);

      const result = await gateway.applyDeduction(makeEvent());

      expect(result.sourceEventId).toBe('evt-persist-001');
      expect(result.lineItems.every((li) => li.skippedDuplicate)).toBe(true);
      expect(mockBalanceRepo.deductBalance).not.toHaveBeenCalled();
    });

    it('rethrows 23505 when fallback record is not found', async () => {
      mockRecordRepo.findBySourceEventId
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockBalanceRepo.findByOwnerForUpdate.mockResolvedValue(makeBalance());

      const uniqueError = new Error('duplicate key value violates unique constraint');
      (uniqueError as Error & { code: string }).code = '23505';
      mockRecordRepo.create.mockRejectedValue(uniqueError);

      await expect(gateway.applyDeduction(makeEvent())).rejects.toThrow(
        'duplicate key value violates unique constraint',
      );
    });
  });

  describe('missing balance — not provisioned', () => {
    it('throws when balance does not exist for owner', async () => {
      mockRecordRepo.findBySourceEventId.mockResolvedValue(null);
      mockBalanceRepo.findByOwnerForUpdate.mockResolvedValue(null);

      await expect(gateway.applyDeduction(makeEvent())).rejects.toThrow(
        /CreditBalance not found for owner: user-500/,
      );
    });

    it('does not create a deduction record when balance is missing', async () => {
      mockRecordRepo.findBySourceEventId.mockResolvedValue(null);
      mockBalanceRepo.findByOwnerForUpdate.mockResolvedValue(null);

      await expect(gateway.applyDeduction(makeEvent())).rejects.toThrow();
      expect(mockRecordRepo.create).not.toHaveBeenCalled();
    });

    it('does not call deductBalance when balance is missing', async () => {
      mockRecordRepo.findBySourceEventId.mockResolvedValue(null);
      mockBalanceRepo.findByOwnerForUpdate.mockResolvedValue(null);

      await expect(gateway.applyDeduction(makeEvent())).rejects.toThrow();
      expect(mockBalanceRepo.deductBalance).not.toHaveBeenCalled();
    });
  });

  describe('transaction boundary', () => {
    beforeEach(() => {
      mockRecordRepo.findBySourceEventId.mockResolvedValue(null);
      mockBalanceRepo.findByOwnerForUpdate.mockResolvedValue(makeBalance());
      mockRecordRepo.create.mockImplementation(async (params) =>
        makeRecord({
          requestedCredits: params.requestedCredits,
          appliedCredits: params.appliedCredits,
          overflowCredits: params.overflowCredits,
          balanceBefore: params.balanceBefore,
          balanceAfter: params.balanceAfter,
          lineItems: params.lineItems,
        }),
      );
      mockBalanceRepo.deductBalance.mockResolvedValue(
        makeBalance({ balance: 91 }),
      );
    });

    it('uses dataSource.transaction() for new deductions', async () => {
      await gateway.applyDeduction(makeEvent());

      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockDataSource.transaction).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it('passes transactional manager to balance lock', async () => {
      await gateway.applyDeduction(makeEvent());

      expect(mockBalanceRepo.findByOwnerForUpdate).toHaveBeenCalledWith(
        'user-500',
        'user',
        mockManager,
      );
    });

    it('passes transactional manager to record create', async () => {
      await gateway.applyDeduction(makeEvent());

      const [, managerArg] = mockRecordRepo.create.mock.calls[0];
      expect(managerArg).toBe(mockManager);
    });

    it('passes transactional manager to balance update', async () => {
      await gateway.applyDeduction(makeEvent());

      expect(mockBalanceRepo.deductBalance).toHaveBeenCalledWith(
        'bal-uuid-001',
        91,
        mockManager,
      );
    });

    it('create failure prevents balance update and rejects', async () => {
      mockRecordRepo.create.mockRejectedValue(
        new Error('Insert failed'),
      );

      await expect(gateway.applyDeduction(makeEvent())).rejects.toThrow(
        'Insert failed',
      );
      expect(mockBalanceRepo.deductBalance).not.toHaveBeenCalled();
    });

    it('balance update failure rejects through transaction', async () => {
      mockBalanceRepo.deductBalance.mockRejectedValue(
        new Error('Balance update failed'),
      );

      await expect(gateway.applyDeduction(makeEvent())).rejects.toThrow(
        'Balance update failed',
      );
    });

    it('unexpected transaction error propagates', async () => {
      mockDataSource.transaction = jest.fn(async () => {
        throw new Error('Connection reset');
      }) as any;

      await expect(gateway.applyDeduction(makeEvent())).rejects.toThrow(
        'Connection reset',
      );
    });
  });

  describe('repository failure propagation', () => {
    it('propagates findBySourceEventId failure', async () => {
      mockRecordRepo.findBySourceEventId.mockRejectedValue(
        new Error('DB connection lost'),
      );

      await expect(gateway.applyDeduction(makeEvent())).rejects.toThrow(
        'DB connection lost',
      );
    });

    it('propagates findByOwnerForUpdate failure', async () => {
      mockRecordRepo.findBySourceEventId.mockResolvedValue(null);
      mockBalanceRepo.findByOwnerForUpdate.mockRejectedValue(
        new Error('Lock timeout'),
      );

      await expect(gateway.applyDeduction(makeEvent())).rejects.toThrow(
        'Lock timeout',
      );
    });

    it('propagates deduction record create failure (non-unique)', async () => {
      mockRecordRepo.findBySourceEventId.mockResolvedValue(null);
      mockBalanceRepo.findByOwnerForUpdate.mockResolvedValue(makeBalance());
      mockRecordRepo.create.mockRejectedValue(
        new Error('Unexpected DB error'),
      );

      await expect(gateway.applyDeduction(makeEvent())).rejects.toThrow(
        'Unexpected DB error',
      );
    });

    it('propagates deductBalance failure', async () => {
      mockRecordRepo.findBySourceEventId.mockResolvedValue(null);
      mockBalanceRepo.findByOwnerForUpdate.mockResolvedValue(makeBalance());
      mockRecordRepo.create.mockResolvedValue(makeRecord());
      mockBalanceRepo.deductBalance.mockRejectedValue(
        new Error('Balance update failed'),
      );

      await expect(gateway.applyDeduction(makeEvent())).rejects.toThrow(
        'Balance update failed',
      );
    });
  });

  describe('runtime binding invariants', () => {
    it('CalculatingCreditDeductionGateway remains unaffected', () => {
      const calcService = new CreditCalculationService();
      const calcGateway = new CalculatingCreditDeductionGateway(calcService);

      const event = makeEvent();
      const result = calcGateway.applyDeduction(event);

      expect(result.totalCreditsRequested).toBe(9);
      expect(result.totalCreditsApplied).toBe(9);
      expect(result.totalCreditsOverflow).toBe(0);
      expect(result.balanceAfter).toBeUndefined();
    });

    it('CreditDeductionModule binds PersistentCreditDeductionGateway (BILLING-READY-03C2)', async () => {
      const module = await Test.createTestingModule({
        imports: [MockDataSourceModule, CreditDeductionModule],
      })
        .overrideProvider(getRepositoryToken(CreditBalance))
        .useValue({})
        .overrideProvider(getRepositoryToken(CreditDeductionRecord))
        .useValue({})
        .compile();

      const bound = module.get(CreditDeductionGateway);
      expect(bound).toBeInstanceOf(PersistentCreditDeductionGateway);
      expect(bound).not.toBeInstanceOf(CalculatingCreditDeductionGateway);
    });
  });
});
