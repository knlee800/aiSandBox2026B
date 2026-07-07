import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { EntityManager } from 'typeorm';
import { CreditDeductionRecord } from '../../../entities/credit-deduction-record.entity';
import { CreditDeductionRecordRepository } from '../credit-deduction-record.repository';

describe('CreditDeductionRecordRepository', () => {
  let repo: CreditDeductionRecordRepository;
  let mockTypeOrmRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockTypeOrmRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        CreditDeductionRecordRepository,
        {
          provide: getRepositoryToken(CreditDeductionRecord),
          useValue: mockTypeOrmRepo,
        },
      ],
    }).compile();

    repo = module.get(CreditDeductionRecordRepository);
  });

  describe('findBySourceEventId', () => {
    it('returns null when no record exists', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repo.findBySourceEventId('event-xyz');

      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { sourceEventId: 'event-xyz' },
      });
      expect(result).toBeNull();
    });

    it('returns existing record (idempotency lookup)', async () => {
      const record = new CreditDeductionRecord();
      record.sourceEventId = 'event-xyz';
      mockTypeOrmRepo.findOne.mockResolvedValue(record);

      const result = await repo.findBySourceEventId('event-xyz');

      expect(result).toBe(record);
      expect(result!.sourceEventId).toBe('event-xyz');
    });
  });

  describe('create', () => {
    const baseParams = {
      ownerId: 'user-1',
      sourceEventId: 'evt-001',
      sourceEventType: 'usage_ledger',
      requestedCredits: 10,
      appliedCredits: 10,
      overflowCredits: 0,
      balanceBefore: 100,
      balanceAfter: 90,
      lineItems: [
        {
          category: 'model_tokens' as const,
          creditsRequested: 10,
          creditsApplied: 10,
          creditsOverflow: 0,
          skippedDuplicate: false,
        },
      ],
    };

    it('uses default repository when manager is omitted', async () => {
      const entity = new CreditDeductionRecord();
      mockTypeOrmRepo.create.mockReturnValue(entity);
      mockTypeOrmRepo.save.mockResolvedValue(entity);

      const result = await repo.create(baseParams);

      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith({
        ownerId: 'user-1',
        sourceEventId: 'evt-001',
        sourceEventType: 'usage_ledger',
        agentId: null,
        sessionId: null,
        executionId: null,
        modelId: null,
        requestedCredits: 10,
        appliedCredits: 10,
        overflowCredits: 0,
        balanceBefore: 100,
        balanceAfter: 90,
        lineItems: baseParams.lineItems,
        metadata: null,
        status: 'applied',
      });
      expect(mockTypeOrmRepo.save).toHaveBeenCalledWith(entity);
      expect(result).toBe(entity);
    });

    it('uses manager when provided', async () => {
      const entity = new CreditDeductionRecord();
      const mockManager = {
        create: jest.fn().mockReturnValue(entity),
        save: jest.fn().mockResolvedValue(entity),
      } as unknown as EntityManager;

      const result = await repo.create(baseParams, mockManager);

      expect(mockManager.create).toHaveBeenCalledWith(CreditDeductionRecord, {
        ownerId: 'user-1',
        sourceEventId: 'evt-001',
        sourceEventType: 'usage_ledger',
        agentId: null,
        sessionId: null,
        executionId: null,
        modelId: null,
        requestedCredits: 10,
        appliedCredits: 10,
        overflowCredits: 0,
        balanceBefore: 100,
        balanceAfter: 90,
        lineItems: baseParams.lineItems,
        metadata: null,
        status: 'applied',
      });
      expect(mockManager.save).toHaveBeenCalledWith(entity);
      expect(mockTypeOrmRepo.create).not.toHaveBeenCalled();
      expect(mockTypeOrmRepo.save).not.toHaveBeenCalled();
      expect(result).toBe(entity);
    });

    it('passes optional fields when provided', async () => {
      const entity = new CreditDeductionRecord();
      mockTypeOrmRepo.create.mockReturnValue(entity);
      mockTypeOrmRepo.save.mockResolvedValue(entity);

      await repo.create({
        ownerId: 'user-1',
        sourceEventId: 'evt-002',
        sourceEventType: 'token_usage',
        agentId: 'agent-a',
        sessionId: 'sess-uuid',
        executionId: 'exec-uuid',
        modelId: 'claude-4.6-sonnet',
        requestedCredits: 5,
        appliedCredits: 3,
        overflowCredits: 2,
        balanceBefore: 3,
        balanceAfter: 0,
        lineItems: [],
        metadata: { foo: 'bar' },
        status: 'applied',
      });

      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent-a',
          sessionId: 'sess-uuid',
          executionId: 'exec-uuid',
          modelId: 'claude-4.6-sonnet',
          metadata: { foo: 'bar' },
        }),
      );
    });
  });

  describe('findByOwner', () => {
    it('queries by ownerId with DESC order', async () => {
      mockTypeOrmRepo.find.mockResolvedValue([]);

      await repo.findByOwner('user-1');

      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith({
        where: { ownerId: 'user-1' },
        order: { createdAt: 'DESC' },
        skip: undefined,
        take: undefined,
      });
    });

    it('supports pagination via offset/limit', async () => {
      mockTypeOrmRepo.find.mockResolvedValue([]);

      await repo.findByOwner('user-1', { offset: 10, limit: 20 });

      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith({
        where: { ownerId: 'user-1' },
        order: { createdAt: 'DESC' },
        skip: 10,
        take: 20,
      });
    });
  });

  describe('findBySession', () => {
    it('queries by sessionId with DESC order', async () => {
      mockTypeOrmRepo.find.mockResolvedValue([]);

      await repo.findBySession('sess-uuid');

      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith({
        where: { sessionId: 'sess-uuid' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findByExecution', () => {
    it('queries by executionId with DESC order', async () => {
      mockTypeOrmRepo.find.mockResolvedValue([]);

      await repo.findByExecution('exec-uuid');

      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith({
        where: { executionId: 'exec-uuid' },
        order: { createdAt: 'DESC' },
      });
    });
  });
});
