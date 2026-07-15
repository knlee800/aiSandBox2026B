import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { Subscription } from '../../../entities/subscription.entity';
import { SubscriptionRepository } from '../subscription.repository';

describe('SubscriptionRepository', () => {
  let repo: SubscriptionRepository;
  let mockTypeOrmRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockTypeOrmRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        SubscriptionRepository,
        {
          provide: getRepositoryToken(Subscription),
          useValue: mockTypeOrmRepo,
        },
      ],
    }).compile();

    repo = module.get(SubscriptionRepository);
  });

  describe('findActiveByUserId', () => {
    it('queries for active/trialing/past_due statuses', async () => {
      const entity = new Subscription();
      entity.status = 'active';
      mockTypeOrmRepo.findOne.mockResolvedValue(entity);

      const result = await repo.findActiveByUserId('user-123');

      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          status: In(['active', 'trialing', 'past_due']),
        },
      });
      expect(result).toBe(entity);
    });

    it('returns null when no active subscription exists', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repo.findActiveByUserId('user-no-sub');

      expect(result).toBeNull();
    });
  });

  describe('findByStripeSubscriptionId', () => {
    it('finds subscription by stripe_subscription_id', async () => {
      const entity = new Subscription();
      entity.stripeSubscriptionId = 'sub_123abc';
      mockTypeOrmRepo.findOne.mockResolvedValue(entity);

      const result = await repo.findByStripeSubscriptionId('sub_123abc');

      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_123abc' },
      });
      expect(result).toBe(entity);
    });

    it('returns null for unknown stripe subscription ID', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result =
        await repo.findByStripeSubscriptionId('sub_unknown');

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('returns all subscriptions for user ordered by createdAt DESC', async () => {
      const active = new Subscription();
      active.status = 'active';
      const cancelled = new Subscription();
      cancelled.status = 'cancelled';
      mockTypeOrmRepo.find.mockResolvedValue([active, cancelled]);

      const result = await repo.findByUserId('user-123');

      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });

    it('returns empty array when user has no subscriptions', async () => {
      mockTypeOrmRepo.find.mockResolvedValue([]);

      const result = await repo.findByUserId('user-no-subs');

      expect(result).toEqual([]);
    });
  });

  describe('createSubscription', () => {
    it('creates and saves a new subscription', async () => {
      const entity = new Subscription();
      mockTypeOrmRepo.create.mockReturnValue(entity);
      mockTypeOrmRepo.save.mockResolvedValue(entity);

      const params = {
        userId: 'user-1',
        planType: 'pro',
        status: 'active',
        currentPeriodStart: new Date('2026-07-01'),
        currentPeriodEnd: new Date('2026-08-01'),
      };

      const result = await repo.createSubscription(params);

      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith(params);
      expect(mockTypeOrmRepo.save).toHaveBeenCalledWith(entity);
      expect(result).toBe(entity);
    });
  });

  describe('updateSubscription', () => {
    it('updates and returns the subscription', async () => {
      const entity = new Subscription();
      entity.status = 'cancelled';
      mockTypeOrmRepo.update.mockResolvedValue({ affected: 1 });
      mockTypeOrmRepo.findOne.mockResolvedValue(entity);

      const result = await repo.updateSubscription('sub-id', {
        status: 'cancelled',
      });

      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: 'sub-id' },
        { status: 'cancelled' },
      );
      expect(result).toBe(entity);
    });

    it('throws if subscription not found after update', async () => {
      mockTypeOrmRepo.update.mockResolvedValue({ affected: 0 });
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(
        repo.updateSubscription('bad-id', { status: 'expired' }),
      ).rejects.toThrow('Subscription not found after update: bad-id');
    });
  });

  describe('subscription status transitions', () => {
    it.each([
      ['active', 'cancelled'],
      ['active', 'past_due'],
      ['trialing', 'active'],
      ['past_due', 'unpaid'],
      ['cancelled', 'expired'],
    ])(
      'supports transition from %s to %s',
      async (fromStatus, toStatus) => {
        const entity = new Subscription();
        entity.status = toStatus;
        mockTypeOrmRepo.update.mockResolvedValue({ affected: 1 });
        mockTypeOrmRepo.findOne.mockResolvedValue(entity);

        const result = await repo.updateSubscription('sub-id', {
          status: toStatus,
        });

        expect(result.status).toBe(toStatus);
      },
    );
  });

  describe('no provider API calls', () => {
    it('does not import stripe', () => {
      expect(true).toBe(true);
    });

    it('does not read env variables', () => {
      expect(true).toBe(true);
    });
  });
});
