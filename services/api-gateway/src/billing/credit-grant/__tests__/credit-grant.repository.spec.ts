import { CreditGrantRepository } from '../credit-grant.repository';
import type { CreditGrant } from '../../../entities/credit-grant.entity';
import type { Repository, EntityManager } from 'typeorm';

describe('CreditGrantRepository (05E)', () => {
  let repo: CreditGrantRepository;
  let mockTypeOrmRepo: jest.Mocked<Partial<Repository<CreditGrant>>>;
  let mockManager: jest.Mocked<Partial<EntityManager>>;

  const stubGrant: CreditGrant = {
    id: 'grant-uuid-1',
    ownerId: 'user-uuid-1',
    ownerType: 'user',
    grantType: 'topup',
    sourceType: 'webhook',
    sourceEventId: 'evt_test_001',
    provider: 'stripe',
    providerEventId: 'evt_test_001',
    webhookEventId: 'webhook-evt-uuid-1',
    planType: null,
    topUpPackId: 'topup_1000',
    amount: 1000,
    balanceBefore: 500,
    balanceAfter: 1500,
    status: 'pending',
    errorCode: null,
    errorMessage: null,
    grantedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockTypeOrmRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockReturnValue(stubGrant),
      save: jest.fn().mockResolvedValue(stubGrant),
      update: jest.fn().mockResolvedValue(undefined),
    };

    const mockManagerRepo = {
      create: jest.fn().mockReturnValue(stubGrant),
      save: jest.fn().mockResolvedValue(stubGrant),
      update: jest.fn().mockResolvedValue(undefined),
    };

    mockManager = {
      getRepository: jest.fn().mockReturnValue(mockManagerRepo),
    } as unknown as jest.Mocked<Partial<EntityManager>>;

    repo = new CreditGrantRepository(mockTypeOrmRepo as any);
  });

  describe('findBySourceEventId', () => {
    it('should return grant when found', async () => {
      mockTypeOrmRepo.findOne!.mockResolvedValue(stubGrant);
      const result = await repo.findBySourceEventId('evt_test_001');
      expect(result).toBe(stubGrant);
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { sourceEventId: 'evt_test_001' },
      });
    });

    it('should return null when not found', async () => {
      mockTypeOrmRepo.findOne!.mockResolvedValue(null);
      const result = await repo.findBySourceEventId('evt_nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('findByWebhookEventId', () => {
    it('should return grant when found', async () => {
      mockTypeOrmRepo.findOne!.mockResolvedValue(stubGrant);
      const result = await repo.findByWebhookEventId('webhook-evt-uuid-1');
      expect(result).toBe(stubGrant);
      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { webhookEventId: 'webhook-evt-uuid-1' },
      });
    });

    it('should return null when not found', async () => {
      mockTypeOrmRepo.findOne!.mockResolvedValue(null);
      const result = await repo.findByWebhookEventId('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('createGrant', () => {
    it('should create and save a grant with default values', async () => {
      const result = await repo.createGrant({
        ownerId: 'user-uuid-1',
        grantType: 'topup',
        sourceType: 'webhook',
        sourceEventId: 'evt_test_001',
        amount: 1000,
        balanceBefore: 500,
        balanceAfter: 1500,
      });
      expect(result).toBe(stubGrant);
      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: 'user-uuid-1',
          ownerType: 'user',
          grantType: 'topup',
          sourceType: 'webhook',
          sourceEventId: 'evt_test_001',
          provider: 'stripe',
          status: 'pending',
        }),
      );
      expect(mockTypeOrmRepo.save).toHaveBeenCalled();
    });

    it('should use EntityManager when provided', async () => {
      const result = await repo.createGrant(
        {
          ownerId: 'user-uuid-1',
          grantType: 'topup',
          sourceType: 'webhook',
          sourceEventId: 'evt_test_002',
          amount: 5000,
          balanceBefore: 0,
          balanceAfter: 5000,
        },
        mockManager as any,
      );
      expect(result).toBe(stubGrant);
      expect(mockManager.getRepository).toHaveBeenCalled();
    });

    it('should set nullable fields to null when not provided', async () => {
      await repo.createGrant({
        ownerId: 'user-uuid-1',
        grantType: 'topup',
        sourceType: 'webhook',
        sourceEventId: 'evt_test_003',
        amount: 1000,
        balanceBefore: 0,
        balanceAfter: 1000,
      });
      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          providerEventId: null,
          webhookEventId: null,
          planType: null,
          topUpPackId: null,
        }),
      );
    });
  });

  describe('markGranted', () => {
    it('should update status to granted with balance snapshots', async () => {
      await repo.markGranted('grant-uuid-1', 500, 1500);
      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: 'grant-uuid-1' },
        expect.objectContaining({
          status: 'granted',
          balanceBefore: 500,
          balanceAfter: 1500,
          grantedAt: expect.any(Date),
        }),
      );
    });

    it('should use EntityManager when provided', async () => {
      await repo.markGranted('grant-uuid-1', 500, 1500, mockManager as any);
      expect(mockManager.getRepository).toHaveBeenCalled();
    });
  });

  describe('markFailed', () => {
    it('should update status to failed with error details', async () => {
      await repo.markFailed(
        'grant-uuid-1',
        'BALANCE_NOT_FOUND',
        'No credit_balance row for owner',
      );
      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: 'grant-uuid-1' },
        {
          status: 'failed',
          errorCode: 'BALANCE_NOT_FOUND',
          errorMessage: 'No credit_balance row for owner',
        },
      );
    });

    it('should use EntityManager when provided', async () => {
      await repo.markFailed(
        'grant-uuid-1',
        'TRANSACTION_ERROR',
        'DB error',
        mockManager as any,
      );
      expect(mockManager.getRepository).toHaveBeenCalled();
    });
  });

  describe('markIgnored', () => {
    it('should update status to ignored', async () => {
      await repo.markIgnored('grant-uuid-1');
      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: 'grant-uuid-1' },
        {
          status: 'ignored',
          errorCode: null,
          errorMessage: null,
        },
      );
    });

    it('should include error details when provided', async () => {
      await repo.markIgnored(
        'grant-uuid-1',
        'UNKNOWN_PACK',
        'Pack not recognized',
      );
      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: 'grant-uuid-1' },
        {
          status: 'ignored',
          errorCode: 'UNKNOWN_PACK',
          errorMessage: 'Pack not recognized',
        },
      );
    });
  });

  describe('no provider dependency', () => {
    it('should not import stripe or call provider APIs', () => {
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(
        path.resolve(__dirname, '../credit-grant.repository.ts'),
        'utf8',
      );
      expect(source).not.toContain("from 'stripe'");
      expect(source).not.toContain('process.env');
    });
  });
});
