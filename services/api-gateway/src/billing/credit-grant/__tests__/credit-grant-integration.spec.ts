import { WebhookService, WebhookVerificationError } from '../../webhook/webhook.service';
import type { WebhookEventRepository } from '../../webhook/webhook-event.repository';
import type { SubscriptionRepository } from '../../subscription/subscription.repository';
import type { StripePaymentProvider } from '../../../payments/providers/stripe-payment.provider';
import type { CreditGrantService } from '../credit-grant.service';
import type { Repository } from 'typeorm';
import type { User } from '../../../entities/user.entity';
import type { WebhookEvent } from '../../../entities/webhook-event.entity';

describe('CreditGrant WebhookService Integration (05E)', () => {
  let service: WebhookService;
  let mockProvider: jest.Mocked<Partial<StripePaymentProvider>>;
  let mockWebhookRepo: jest.Mocked<Partial<WebhookEventRepository>>;
  let mockSubRepo: jest.Mocked<Partial<SubscriptionRepository>>;
  let mockUserRepo: jest.Mocked<Partial<Repository<User>>>;
  let mockCreditGrantService: jest.Mocked<Partial<CreditGrantService>>;

  const testUser = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    stripeCustomerId: 'cus_test_123',
    planType: 'starter',
    planStatus: 'active',
  } as User;

  const stubRawBody = Buffer.from('{"test":"payload"}');
  const stubSignature = 'test_sig_header';

  const createService = () => {
    return new WebhookService(
      mockProvider as any,
      mockWebhookRepo as any,
      mockSubRepo as any,
      mockUserRepo as any,
      mockCreditGrantService as any,
    );
  };

  beforeEach(() => {
    mockProvider = {
      verifyWebhookSignature: jest.fn().mockReturnValue({
        success: true,
        data: { valid: true },
      }),
      parseWebhookEvent: jest.fn(),
      mapEventType: jest.fn(),
    };

    mockWebhookRepo = {
      findByProviderEventId: jest.fn().mockResolvedValue(null),
      createEvent: jest.fn().mockResolvedValue({
        id: 'webhook-evt-uuid-1',
        providerEventId: 'evt_test_001',
        status: 'received',
        attempts: 1,
      } as WebhookEvent),
      updateEventStatus: jest.fn().mockResolvedValue({
        id: 'webhook-evt-uuid-1',
        status: 'processed',
      } as WebhookEvent),
      incrementAttempts: jest.fn().mockResolvedValue(undefined),
    };

    mockSubRepo = {
      findByStripeSubscriptionId: jest.fn().mockResolvedValue(null),
      findActiveByUserId: jest.fn().mockResolvedValue(null),
      createSubscription: jest.fn().mockResolvedValue({
        id: 'sub-uuid-1',
        userId: 'user-uuid-1',
        stripeSubscriptionId: 'sub_test_001',
        status: 'active',
        planType: 'starter',
      }),
      updateSubscription: jest.fn().mockResolvedValue({
        id: 'sub-uuid-1',
        status: 'active',
      }),
    };

    mockUserRepo = {
      findOne: jest.fn().mockResolvedValue(testUser),
      update: jest.fn().mockResolvedValue(undefined),
    };

    mockCreditGrantService = {
      processGrant: jest.fn().mockResolvedValue({
        grantId: 'grant-uuid-1',
        status: 'granted',
        amount: 1000,
        balanceBefore: 5000,
        balanceAfter: 6000,
      }),
    };

    service = createService();
  });

  // -------------------------------------------------------------------------
  // Top-up checkout_completed → CreditGrantService
  // -------------------------------------------------------------------------

  describe('top-up checkout_completed triggers credit grant', () => {
    beforeEach(() => {
      mockProvider.parseWebhookEvent!.mockReturnValue({
        success: true,
        data: {
          eventId: 'evt_topup_checkout',
          eventType: 'checkout.session.completed',
          data: {
            customer: 'cus_test_123',
            mode: 'payment',
            metadata: { aisandbox_topup_pack_id: 'topup_1000' },
          },
        },
      });
      mockProvider.mapEventType!.mockReturnValue({
        internal: 'checkout_completed',
        stripe: 'checkout.session.completed',
      });
    });

    it('should call CreditGrantService.processGrant for top-up checkout', async () => {
      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockCreditGrantService.processGrant).toHaveBeenCalledWith(
        expect.objectContaining({
          grantType: 'topup',
          ownerId: 'user-uuid-1',
          topUpPackId: 'topup_1000',
        }),
      );
    });

    it('should pass providerEventId to grant request', async () => {
      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockCreditGrantService.processGrant).toHaveBeenCalledWith(
        expect.objectContaining({
          providerEventId: 'evt_topup_checkout',
        }),
      );
    });

    it('should pass webhookEventId to grant request', async () => {
      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockCreditGrantService.processGrant).toHaveBeenCalledWith(
        expect.objectContaining({
          webhookEventId: 'webhook-evt-uuid-1',
        }),
      );
    });

    it('should pass metadata to grant request', async () => {
      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockCreditGrantService.processGrant).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { aisandbox_topup_pack_id: 'topup_1000' },
        }),
      );
    });

    it('should still return processed even if grant fails', async () => {
      mockCreditGrantService.processGrant!.mockRejectedValue(
        new Error('Grant processing failed'),
      );
      const result = await service.processWebhook(stubRawBody, stubSignature);
      expect(result.received).toBe(true);
      expect(result.status).toBe('processed');
    });
  });

  // -------------------------------------------------------------------------
  // Initial subscription checkout_completed → CreditGrantService
  // -------------------------------------------------------------------------

  describe('subscription checkout_completed triggers initial grant', () => {
    beforeEach(() => {
      mockProvider.parseWebhookEvent!.mockReturnValue({
        success: true,
        data: {
          eventId: 'evt_sub_checkout',
          eventType: 'checkout.session.completed',
          data: {
            customer: 'cus_test_123',
            subscription: 'sub_test_001',
            mode: 'subscription',
            current_period_start: 1700000000,
            current_period_end: 1702600000,
            metadata: { aisandbox_plan_id: 'pro' },
          },
        },
      });
      mockProvider.mapEventType!.mockReturnValue({
        internal: 'checkout_completed',
        stripe: 'checkout.session.completed',
      });
    });

    it('should call CreditGrantService.processGrant for initial subscription', async () => {
      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockCreditGrantService.processGrant).toHaveBeenCalledWith(
        expect.objectContaining({
          grantType: 'subscription_initial',
          ownerId: 'user-uuid-1',
        }),
      );
    });

    it('should pass planType resolved from event data', async () => {
      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockCreditGrantService.processGrant).toHaveBeenCalledWith(
        expect.objectContaining({
          planType: expect.any(String),
        }),
      );
    });

    it('should still create subscription even if grant fails', async () => {
      mockCreditGrantService.processGrant!.mockRejectedValue(
        new Error('Grant failed'),
      );
      const result = await service.processWebhook(stubRawBody, stubSignature);
      expect(result.received).toBe(true);
      expect(result.status).toBe('processed');
      expect(mockSubRepo.createSubscription).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // invoice_paid subscription renewal → CreditGrantService
  // -------------------------------------------------------------------------

  describe('invoice_paid subscription renewal triggers monthly grant', () => {
    beforeEach(() => {
      mockProvider.parseWebhookEvent!.mockReturnValue({
        success: true,
        data: {
          eventId: 'evt_invoice_renewal',
          eventType: 'invoice.paid',
          data: {
            subscription: 'sub_test_001',
            customer: 'cus_test_123',
            status: 'paid',
            current_period_start: 1702600000,
            current_period_end: 1705200000,
          },
        },
      });
      mockProvider.mapEventType!.mockReturnValue({
        internal: 'invoice_paid',
        stripe: 'invoice.paid',
      });

      mockSubRepo.findByStripeSubscriptionId!.mockResolvedValue({
        id: 'sub-uuid-1',
        userId: 'user-uuid-1',
        stripeSubscriptionId: 'sub_test_001',
        planType: 'starter',
        status: 'active',
      } as any);
    });

    it('should call CreditGrantService.processGrant for subscription renewal', async () => {
      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockCreditGrantService.processGrant).toHaveBeenCalledWith(
        expect.objectContaining({
          grantType: 'subscription_monthly',
          ownerId: 'user-uuid-1',
          planType: 'starter',
        }),
      );
    });

    it('should still update subscription period even if grant fails', async () => {
      mockCreditGrantService.processGrant!.mockRejectedValue(
        new Error('Grant failed'),
      );
      const result = await service.processWebhook(stubRawBody, stubSignature);
      expect(result.received).toBe(true);
      expect(result.status).toBe('processed');
      expect(mockSubRepo.updateSubscription).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // invoice_paid non-subscription → CreditGrantService top-up
  // -------------------------------------------------------------------------

  describe('invoice_paid non-subscription triggers top-up grant', () => {
    beforeEach(() => {
      mockProvider.parseWebhookEvent!.mockReturnValue({
        success: true,
        data: {
          eventId: 'evt_invoice_topup',
          eventType: 'invoice.paid',
          data: {
            customer: 'cus_test_123',
            status: 'paid',
            metadata: { aisandbox_topup_pack_id: 'topup_5000' },
          },
        },
      });
      mockProvider.mapEventType!.mockReturnValue({
        internal: 'invoice_paid',
        stripe: 'invoice.paid',
      });
    });

    it('should call CreditGrantService.processGrant for non-subscription invoice', async () => {
      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockCreditGrantService.processGrant).toHaveBeenCalledWith(
        expect.objectContaining({
          grantType: 'topup',
          ownerId: 'user-uuid-1',
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // No grant on ignored/unknown events
  // -------------------------------------------------------------------------

  describe('no credit mutation on ignored/unknown events', () => {
    it('should not call CreditGrantService for unknown event types', async () => {
      mockProvider.parseWebhookEvent!.mockReturnValue({
        success: true,
        data: {
          eventId: 'evt_unknown_type',
          eventType: 'customer.updated',
          data: {},
        },
      });
      mockProvider.mapEventType!.mockReturnValue(null);

      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockCreditGrantService.processGrant).not.toHaveBeenCalled();
    });

    it('should not call CreditGrantService for subscription_created events', async () => {
      mockProvider.parseWebhookEvent!.mockReturnValue({
        success: true,
        data: {
          eventId: 'evt_sub_created',
          eventType: 'customer.subscription.created',
          data: {
            id: 'sub_test_new',
            customer: 'cus_test_123',
            status: 'active',
            current_period_start: 1700000000,
            current_period_end: 1702600000,
          },
        },
      });
      mockProvider.mapEventType!.mockReturnValue({
        internal: 'subscription_created',
        stripe: 'customer.subscription.created',
      });

      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockCreditGrantService.processGrant).not.toHaveBeenCalled();
    });

    it('should not call CreditGrantService for subscription_deleted events', async () => {
      mockProvider.parseWebhookEvent!.mockReturnValue({
        success: true,
        data: {
          eventId: 'evt_sub_deleted',
          eventType: 'customer.subscription.deleted',
          data: {
            id: 'sub_test_001',
            customer: 'cus_test_123',
          },
        },
      });
      mockProvider.mapEventType!.mockReturnValue({
        internal: 'subscription_deleted',
        stripe: 'customer.subscription.deleted',
      });
      mockSubRepo.findByStripeSubscriptionId!.mockResolvedValue({
        id: 'sub-uuid-1',
        userId: 'user-uuid-1',
        stripeSubscriptionId: 'sub_test_001',
        planType: 'starter',
        status: 'active',
      } as any);

      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockCreditGrantService.processGrant).not.toHaveBeenCalled();
    });

    it('should not call CreditGrantService for invoice_payment_failed events', async () => {
      mockProvider.parseWebhookEvent!.mockReturnValue({
        success: true,
        data: {
          eventId: 'evt_pay_failed',
          eventType: 'invoice.payment_failed',
          data: {
            subscription: 'sub_test_001',
            customer: 'cus_test_123',
          },
        },
      });
      mockProvider.mapEventType!.mockReturnValue({
        internal: 'invoice_payment_failed',
        stripe: 'invoice.payment_failed',
      });
      mockSubRepo.findByStripeSubscriptionId!.mockResolvedValue({
        id: 'sub-uuid-1',
        userId: 'user-uuid-1',
        stripeSubscriptionId: 'sub_test_001',
        planType: 'starter',
        status: 'active',
      } as any);

      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockCreditGrantService.processGrant).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 05D webhook duplicate handling still prevents reprocessing
  // -------------------------------------------------------------------------

  describe('05D webhook duplicate — no credit grant', () => {
    it('should not call CreditGrantService on duplicate webhook event', async () => {
      mockWebhookRepo.findByProviderEventId!.mockResolvedValue({
        id: 'webhook-evt-uuid-1',
        providerEventId: 'evt_dupe',
        status: 'processed',
        attempts: 1,
      } as WebhookEvent);

      mockProvider.parseWebhookEvent!.mockReturnValue({
        success: true,
        data: {
          eventId: 'evt_dupe',
          eventType: 'checkout.session.completed',
          data: {
            customer: 'cus_test_123',
            mode: 'payment',
            metadata: { aisandbox_topup_pack_id: 'topup_1000' },
          },
        },
      });
      mockProvider.mapEventType!.mockReturnValue({
        internal: 'checkout_completed',
        stripe: 'checkout.session.completed',
      });

      const result = await service.processWebhook(stubRawBody, stubSignature);
      expect(result.duplicate).toBe(true);
      expect(mockCreditGrantService.processGrant).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // No provider dependency
  // -------------------------------------------------------------------------

  describe('no Stripe/provider API calls in integration', () => {
    it('should not import stripe package', () => {
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(
        path.resolve(
          __dirname,
          '../../webhook/webhook.service.ts',
        ),
        'utf8',
      );
      expect(source).not.toContain("from 'stripe'");
      expect(source).not.toContain('process.env.STRIPE');
    });
  });
});
