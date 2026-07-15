import { BillingReadController } from '../billing-read.controller';
import { SessionCookieGuard } from '../../auth/session-cookie.guard';
import { CreditBalanceRepository } from '../credit-deduction/credit-balance.repository';
import { SubscriptionRepository } from '../subscription/subscription.repository';

describe('BillingReadController', () => {
  let controller: BillingReadController;
  let creditBalanceRepo: jest.Mocked<CreditBalanceRepository>;
  let subscriptionRepo: jest.Mocked<SubscriptionRepository>;

  const mockUser = {
    userId: 'user-uuid-456',
    email: 'billing@example.com',
    role: 'user',
    plan: 'free',
  };

  const mockReq = { user: mockUser } as any;

  beforeEach(() => {
    creditBalanceRepo = {
      findByOwner: jest.fn(),
    } as any;

    subscriptionRepo = {
      findActiveByUserId: jest.fn(),
    } as any;

    controller = new BillingReadController(creditBalanceRepo, subscriptionRepo);
  });

  // ---------------------------------------------------------------------------
  // Guard metadata
  // ---------------------------------------------------------------------------

  describe('guard metadata', () => {
    it('should use SessionCookieGuard at controller level', () => {
      const guards = Reflect.getMetadata('__guards__', BillingReadController);
      expect(guards).toBeDefined();
      expect(guards).toContain(SessionCookieGuard);
    });

    it('should NOT use ApiKeyAuthGuard', () => {
      const guards = Reflect.getMetadata('__guards__', BillingReadController);
      const guardNames = (guards || []).map(
        (g: any) => g.name || g.constructor?.name,
      );
      expect(guardNames).not.toContain('ApiKeyAuthGuard');
      expect(guardNames).not.toContain('PublicApiKeyGuard');
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/billing/balance
  // ---------------------------------------------------------------------------

  describe('GET /api/billing/balance', () => {
    it('should return empty/free-state when no balance record exists', async () => {
      creditBalanceRepo.findByOwner.mockResolvedValue(null);

      const result = await controller.getBalance(mockReq);

      expect(creditBalanceRepo.findByOwner).toHaveBeenCalledWith(
        'user-uuid-456',
        'user',
      );
      expect(result).toEqual({
        balance: 0,
        monthlyAllocation: 0,
        planId: 'free',
        periodStart: null,
        periodEnd: null,
        status: 'active',
      });
    });

    it('should return balance data when record exists', async () => {
      const periodStart = new Date('2026-07-01T00:00:00.000Z');
      const periodEnd = new Date('2026-08-01T00:00:00.000Z');

      creditBalanceRepo.findByOwner.mockResolvedValue({
        id: 'balance-uuid',
        ownerId: 'user-uuid-456',
        ownerType: 'user',
        planId: 'pro',
        balance: 18500,
        monthlyAllocation: 25000,
        rolloverBalance: 0,
        status: 'active',
        periodStart,
        periodEnd,
        resetAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await controller.getBalance(mockReq);

      expect(result).toEqual({
        balance: 18500,
        monthlyAllocation: 25000,
        planId: 'pro',
        periodStart: '2026-07-01T00:00:00.000Z',
        periodEnd: '2026-08-01T00:00:00.000Z',
        status: 'active',
      });
    });

    it('should only read own user balance (no cross-user access)', async () => {
      creditBalanceRepo.findByOwner.mockResolvedValue(null);

      await controller.getBalance(mockReq);

      expect(creditBalanceRepo.findByOwner).toHaveBeenCalledWith(
        mockUser.userId,
        'user',
      );
    });

    it('should not contain provider secrets in response', async () => {
      creditBalanceRepo.findByOwner.mockResolvedValue({
        id: 'balance-uuid',
        ownerId: 'user-uuid-456',
        ownerType: 'user',
        planId: 'starter',
        balance: 4000,
        monthlyAllocation: 5000,
        rolloverBalance: 0,
        status: 'active',
        periodStart: new Date('2026-07-01'),
        periodEnd: new Date('2026-08-01'),
        resetAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await controller.getBalance(mockReq);

      const resultStr = JSON.stringify(result);
      expect(resultStr).not.toContain('stripe');
      expect(resultStr).not.toContain('secret');
      expect(resultStr).not.toContain('key');
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/billing/subscription
  // ---------------------------------------------------------------------------

  describe('GET /api/billing/subscription', () => {
    it('should return null when no active subscription exists', async () => {
      subscriptionRepo.findActiveByUserId.mockResolvedValue(null);

      const result = await controller.getSubscription(mockReq);

      expect(subscriptionRepo.findActiveByUserId).toHaveBeenCalledWith(
        'user-uuid-456',
      );
      expect(result).toBeNull();
    });

    it('should return subscription data when active subscription exists', async () => {
      const periodStart = new Date('2026-07-01T00:00:00.000Z');
      const periodEnd = new Date('2026-08-01T00:00:00.000Z');

      subscriptionRepo.findActiveByUserId.mockResolvedValue({
        id: 'sub-uuid',
        userId: 'user-uuid-456',
        stripeSubscriptionId: 'sub_test_123',
        stripePriceId: 'price_test_456',
        planType: 'pro',
        status: 'active',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAt: null,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await controller.getSubscription(mockReq);

      expect(result).toEqual({
        planType: 'pro',
        status: 'active',
        currentPeriodStart: '2026-07-01T00:00:00.000Z',
        currentPeriodEnd: '2026-08-01T00:00:00.000Z',
        cancelAt: null,
      });
    });

    it('should include cancelAt when subscription is pending cancellation', async () => {
      const cancelDate = new Date('2026-08-01T00:00:00.000Z');

      subscriptionRepo.findActiveByUserId.mockResolvedValue({
        id: 'sub-uuid',
        userId: 'user-uuid-456',
        stripeSubscriptionId: 'sub_test_789',
        stripePriceId: 'price_test_101',
        planType: 'starter',
        status: 'active',
        currentPeriodStart: new Date('2026-07-01T00:00:00.000Z'),
        currentPeriodEnd: cancelDate,
        cancelAt: cancelDate,
        cancelAtPeriodEnd: true,
        cancelledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await controller.getSubscription(mockReq);

      expect(result!.cancelAt).toBe('2026-08-01T00:00:00.000Z');
    });

    it('should not expose stripe/provider IDs in response', async () => {
      subscriptionRepo.findActiveByUserId.mockResolvedValue({
        id: 'sub-uuid',
        userId: 'user-uuid-456',
        stripeSubscriptionId: 'sub_test_secret',
        stripePriceId: 'price_test_secret',
        planType: 'team',
        status: 'active',
        currentPeriodStart: new Date('2026-07-01'),
        currentPeriodEnd: new Date('2026-08-01'),
        cancelAt: null,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await controller.getSubscription(mockReq);

      const resultStr = JSON.stringify(result);
      expect(resultStr).not.toContain('sub_test_secret');
      expect(resultStr).not.toContain('price_test_secret');
      expect(resultStr).not.toContain('stripeSubscriptionId');
      expect(resultStr).not.toContain('stripePriceId');
    });

    it('should only read own user subscription', async () => {
      subscriptionRepo.findActiveByUserId.mockResolvedValue(null);

      await controller.getSubscription(mockReq);

      expect(subscriptionRepo.findActiveByUserId).toHaveBeenCalledWith(
        mockUser.userId,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // No provider/portal calls
  // ---------------------------------------------------------------------------

  describe('no provider/portal calls', () => {
    it('should not call any provider or customer portal methods', async () => {
      creditBalanceRepo.findByOwner.mockResolvedValue(null);
      subscriptionRepo.findActiveByUserId.mockResolvedValue(null);

      await controller.getBalance(mockReq);
      await controller.getSubscription(mockReq);

      expect(creditBalanceRepo.findByOwner).toHaveBeenCalledTimes(1);
      expect(subscriptionRepo.findActiveByUserId).toHaveBeenCalledTimes(1);
    });
  });
});
