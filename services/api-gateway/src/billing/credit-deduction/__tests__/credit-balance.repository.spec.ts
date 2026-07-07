import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { EntityManager } from 'typeorm';
import { CreditBalance } from '../../../entities/credit-balance.entity';
import { CreditBalanceRepository } from '../credit-balance.repository';

describe('CreditBalanceRepository', () => {
  let repo: CreditBalanceRepository;
  let mockTypeOrmRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockTypeOrmRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        CreditBalanceRepository,
        {
          provide: getRepositoryToken(CreditBalance),
          useValue: mockTypeOrmRepo,
        },
      ],
    }).compile();

    repo = module.get(CreditBalanceRepository);
  });

  describe('findByOwner', () => {
    it('queries by ownerId with default ownerType "user"', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repo.findByOwner('user-123');

      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { ownerId: 'user-123', ownerType: 'user' },
      });
      expect(result).toBeNull();
    });

    it('accepts custom ownerType', async () => {
      const entity = new CreditBalance();
      mockTypeOrmRepo.findOne.mockResolvedValue(entity);

      const result = await repo.findByOwner('team-1', 'team');

      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { ownerId: 'team-1', ownerType: 'team' },
      });
      expect(result).toBe(entity);
    });
  });

  describe('findByOwnerForUpdate', () => {
    it('uses default repository when manager is omitted', async () => {
      const mockQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockTypeOrmRepo.createQueryBuilder.mockReturnValue(mockQb);

      await repo.findByOwnerForUpdate('user-123');

      expect(mockTypeOrmRepo.createQueryBuilder).toHaveBeenCalledWith('cb');
      expect(mockQb.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(mockQb.where).toHaveBeenCalledWith(
        'cb.owner_id = :ownerId',
        { ownerId: 'user-123' },
      );
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'cb.owner_type = :ownerType',
        { ownerType: 'user' },
      );
      expect(mockQb.getOne).toHaveBeenCalled();
    });

    it('uses manager.createQueryBuilder when manager is provided', async () => {
      const mockQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      const mockManager = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      } as unknown as EntityManager;

      await repo.findByOwnerForUpdate('user-123', 'user', mockManager);

      expect(mockManager.createQueryBuilder).toHaveBeenCalledWith(
        CreditBalance,
        'cb',
      );
      expect(mockTypeOrmRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(mockQb.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(mockQb.where).toHaveBeenCalledWith(
        'cb.owner_id = :ownerId',
        { ownerId: 'user-123' },
      );
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'cb.owner_type = :ownerType',
        { ownerType: 'user' },
      );
    });
  });

  describe('create', () => {
    it('creates and saves a new CreditBalance', async () => {
      const entity = new CreditBalance();
      mockTypeOrmRepo.create.mockReturnValue(entity);
      mockTypeOrmRepo.save.mockResolvedValue(entity);

      const params = {
        ownerId: 'user-1',
        planId: 'free',
        balance: 500,
        monthlyAllocation: 500,
        periodStart: new Date('2026-07-01'),
        periodEnd: new Date('2026-08-01'),
      };

      const result = await repo.create(params);

      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith({
        ownerId: 'user-1',
        ownerType: 'user',
        planId: 'free',
        balance: 500,
        monthlyAllocation: 500,
        rolloverBalance: 0,
        status: 'active',
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        resetAt: null,
      });
      expect(mockTypeOrmRepo.save).toHaveBeenCalledWith(entity);
      expect(result).toBe(entity);
    });
  });

  describe('deductBalance', () => {
    it('uses default repository when manager is omitted', async () => {
      const entity = new CreditBalance();
      entity.balance = 400;
      mockTypeOrmRepo.update.mockResolvedValue({ affected: 1 });
      mockTypeOrmRepo.findOne.mockResolvedValue(entity);

      const result = await repo.deductBalance('balance-id', 400);

      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: 'balance-id' },
        { balance: 400 },
      );
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'balance-id' },
      });
      expect(result).toBe(entity);
    });

    it('uses manager when provided', async () => {
      const entity = new CreditBalance();
      entity.balance = 400;
      const mockManager = {
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        findOne: jest.fn().mockResolvedValue(entity),
      } as unknown as EntityManager;

      const result = await repo.deductBalance('balance-id', 400, mockManager);

      expect(mockManager.update).toHaveBeenCalledWith(
        CreditBalance,
        { id: 'balance-id' },
        { balance: 400 },
      );
      expect(mockManager.findOne).toHaveBeenCalledWith(CreditBalance, {
        where: { id: 'balance-id' },
      });
      expect(mockTypeOrmRepo.update).not.toHaveBeenCalled();
      expect(mockTypeOrmRepo.findOne).not.toHaveBeenCalled();
      expect(result).toBe(entity);
    });

    it('throws if entity not found after update', async () => {
      mockTypeOrmRepo.update.mockResolvedValue({ affected: 1 });
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(repo.deductBalance('bad-id', 0)).rejects.toThrow(
        'CreditBalance not found after update: bad-id',
      );
    });

    it('throws if entity not found after update via manager', async () => {
      const mockManager = {
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        findOne: jest.fn().mockResolvedValue(null),
      } as unknown as EntityManager;

      await expect(
        repo.deductBalance('bad-id', 0, mockManager),
      ).rejects.toThrow('CreditBalance not found after update: bad-id');
    });
  });

  describe('resetForNewPeriod', () => {
    it('sets balance to monthlyAllocation + rolloverBalance', async () => {
      const entity = new CreditBalance();
      entity.balance = 600;
      mockTypeOrmRepo.update.mockResolvedValue({ affected: 1 });
      mockTypeOrmRepo.findOne.mockResolvedValue(entity);

      const params = {
        monthlyAllocation: 500,
        rolloverBalance: 100,
        periodStart: new Date('2026-08-01'),
        periodEnd: new Date('2026-09-01'),
      };

      const result = await repo.resetForNewPeriod('balance-id', params);

      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: 'balance-id' },
        {
          balance: 600,
          monthlyAllocation: 500,
          rolloverBalance: 100,
          periodStart: params.periodStart,
          periodEnd: params.periodEnd,
          resetAt: null,
        },
      );
      expect(result).toBe(entity);
    });

    it('throws if entity not found after reset', async () => {
      mockTypeOrmRepo.update.mockResolvedValue({ affected: 1 });
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(
        repo.resetForNewPeriod('bad-id', {
          monthlyAllocation: 500,
          rolloverBalance: 0,
          periodStart: new Date(),
          periodEnd: new Date(),
        }),
      ).rejects.toThrow('CreditBalance not found after reset: bad-id');
    });
  });
});
