import { WebhookService, WebhookVerificationError } from '../webhook.service';
import type { WebhookEventRepository } from '../webhook-event.repository';
import type { SubscriptionRepository } from '../../subscription/subscription.repository';
import type { StripePaymentProvider } from '../../../payments/providers/stripe-payment.provider';
import type { CreditGrantService } from '../../credit-grant/credit-grant.service';
import type { Repository } from 'typeorm';
import type { User } from '../../../entities/user.entity';
import type { WebhookEvent } from '../../../entities/webhook-event.entity';

describe('WebhookService (05D)', () => {
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
    planType: 'free',
    planStatus: 'active',
  } as User;

  const stubRawBody = Buffer.from('{"test":"payload"}');
  const stubSignature = 'test_sig_header';

  beforeEach(() => {
    mockProvider = {
      verifyWebhookSignature: jest.fn().mockReturnValue({
        success: true,
        data: { valid: true },
      }),
      parseWebhookEvent: jest.fn().mockReturnValue({
        success: true,
        data: {
          eventId: 'evt_test_001',
          eventType: 'checkout.session.completed',
          data: {
            customer: 'cus_test_123',
            subscription: 'sub_test_001',
            mode: 'subscription',
            current_period_start: 1700000000,
            current_period_end: 1702600000,
          },
        },
      }),
      mapEventType: jest.fn().mockReturnValue({
        internal: 'checkout_completed',
        stripe: 'checkout.session.completed',
      }),
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
        grantId: 'grant-uuid-stub',
        status: 'granted',
        amount: 0,
        balanceBefore: 0,
        balanceAfter: 0,
      }),
    };

    service = new WebhookService(
      mockProvider as any,
      mockWebhookRepo as any,
      mockSubRepo as any,
      mockUserRepo as any,
      mockCreditGrantService as any,
    );
  });

  // ---------------------------------------------------------------------------
  // Signature verification
  // ---------------------------------------------------------------------------

  describe('signature verification', () => {
    it('throws WebhookVerificationError when provider returns PROVIDER_DISABLED', async () => {
      mockProvider.verifyWebhookSignature!.mockReturnValue({
        success: false,
        error: 'PROVIDER_DISABLED',
        message: 'Payment provider is disabled',
      });

      await expect(
        service.processWebhook(stubRawBody, stubSignature),
      ).rejects.toThrow(WebhookVerificationError);
    });

    it('throws WebhookVerificationError when provider returns PROVIDER_NOT_CONFIGURED', async () => {
      mockProvider.verifyWebhookSignature!.mockReturnValue({
        success: false,
        error: 'PROVIDER_NOT_CONFIGURED',
        message: 'Not configured',
      });

      await expect(
        service.processWebhook(stubRawBody, stubSignature),
      ).rejects.toThrow(WebhookVerificationError);
    });

    it('throws WebhookVerificationError when signature is invalid', async () => {
      mockProvider.verifyWebhookSignature!.mockReturnValue({
        success: false,
        error: 'SIGNATURE_INVALID',
        message: 'Invalid signature',
      });

      await expect(
        service.processWebhook(stubRawBody, stubSignature),
      ).rejects.toThrow(WebhookVerificationError);
    });

    it('stub mode signature accepted — processing continues', async () => {
      const result = await service.processWebhook(stubRawBody, stubSignature);
      expect(result.received).toBe(true);
      expect(mockProvider.verifyWebhookSignature).toHaveBeenCalledWith(
        stubRawBody,
        stubSignature,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Event parsing
  // ---------------------------------------------------------------------------

  describe('event parsing', () => {
    it('throws WebhookVerificationError when event parse fails', async () => {
      mockProvider.parseWebhookEvent!.mockReturnValue({
        success: false,
        error: 'EVENT_PARSE_ERROR',
        message: 'Failed to parse',
      });

      await expect(
        service.processWebhook(stubRawBody, stubSignature),
      ).rejects.toThrow(WebhookVerificationError);
    });

    it('calls parseWebhookEvent with rawBody and signature', async () => {
      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockProvider.parseWebhookEvent).toHaveBeenCalledWith(
        stubRawBody,
        stubSignature,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Event type mapping / allowlist
  // ---------------------------------------------------------------------------

  describe('event type mapping', () => {
    it('calls mapEventType with the parsed event type', async () => {
      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockProvider.mapEventType).toHaveBeenCalledWith(
        'checkout.session.completed',
      );
    });

    it('unknown event type persisted with status ignored', async () => {
      mockProvider.mapEventType!.mockReturnValue(null);

      const result = await service.processWebhook(stubRawBody, stubSignature);
      expect(result.received).toBe(true);
      expect(result.status).toBe('ignored');
      expect(mockWebhookRepo.updateEventStatus).toHaveBeenCalledWith(
        'webhook-evt-uuid-1',
        'ignored',
        'Unknown event type',
        'UNKNOWN_EVENT_TYPE',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Idempotency / duplicate handling
  // ---------------------------------------------------------------------------

  describe('idempotency', () => {
    it('returns duplicate=true for already-processed event', async () => {
      mockWebhookRepo.findByProviderEventId!.mockResolvedValue({
        id: 'existing-uuid',
        providerEventId: 'evt_test_001',
        status: 'processed',
        attempts: 1,
      } as WebhookEvent);

      const result = await service.processWebhook(stubRawBody, stubSignature);
      expect(result.received).toBe(true);
      expect(result.duplicate).toBe(true);
      expect(mockWebhookRepo.incrementAttempts).toHaveBeenCalledWith(
        'existing-uuid',
      );
    });

    it('does not reprocess duplicate events', async () => {
      mockWebhookRepo.findByProviderEventId!.mockResolvedValue({
        id: 'existing-uuid',
        providerEventId: 'evt_test_001',
        status: 'processed',
        attempts: 2,
      } as WebhookEvent);

      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockSubRepo.createSubscription).not.toHaveBeenCalled();
      expect(mockSubRepo.updateSubscription).not.toHaveBeenCalled();
      expect(mockUserRepo.update).not.toHaveBeenCalled();
    });

    it('increments attempts for duplicate ignored event', async () => {
      mockWebhookRepo.findByProviderEventId!.mockResolvedValue({
        id: 'existing-uuid',
        providerEventId: 'evt_test_001',
        status: 'ignored',
        attempts: 1,
      } as WebhookEvent);

      const result = await service.processWebhook(stubRawBody, stubSignature);
      expect(result.duplicate).toBe(true);
      expect(mockWebhookRepo.incrementAttempts).toHaveBeenCalledWith(
        'existing-uuid',
      );
    });

    it('increments attempts for duplicate failed event and does not reprocess', async () => {
      mockWebhookRepo.findByProviderEventId!.mockResolvedValue({
        id: 'existing-uuid',
        providerEventId: 'evt_test_001',
        status: 'failed',
        attempts: 3,
      } as WebhookEvent);

      const result = await service.processWebhook(stubRawBody, stubSignature);
      expect(result.duplicate).toBe(true);
      expect(mockSubRepo.createSubscription).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // webhook_events record creation
  // ---------------------------------------------------------------------------

  describe('event recording', () => {
    it('creates webhook_events record on first receipt', async () => {
      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockWebhookRepo.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          providerEventId: 'evt_test_001',
          provider: 'stripe',
          eventType: 'checkout.session.completed',
          internalEventType: 'checkout_completed',
          payloadHash: expect.any(String),
        }),
      );
    });

    it('status transitions: received → verified → processing → processed', async () => {
      await service.processWebhook(stubRawBody, stubSignature);

      const statusCalls = mockWebhookRepo.updateEventStatus!.mock.calls.map(
        (c) => c[1],
      );
      expect(statusCalls).toEqual(['verified', 'processing', 'processed']);
    });
  });

  // ---------------------------------------------------------------------------
  // checkout_completed (subscription)
  // ---------------------------------------------------------------------------

  describe('checkout_completed (subscription)', () => {
    it('creates subscription record', async () => {
      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockSubRepo.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-uuid-1',
          stripeSubscriptionId: 'sub_test_001',
          status: 'active',
        }),
      );
    });

    it('updates user plan type and status', async () => {
      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockUserRepo.update).toHaveBeenCalledWith(
        { id: 'user-uuid-1' },
        expect.objectContaining({
          planStatus: 'active',
        }),
      );
    });

    it('does not create duplicate subscription if already exists', async () => {
      mockSubRepo.findByStripeSubscriptionId!.mockResolvedValue({
        id: 'existing-sub',
        stripeSubscriptionId: 'sub_test_001',
      } as any);

      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockSubRepo.createSubscription).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // checkout_completed (top-up) — deferred to 05E
  // ---------------------------------------------------------------------------

  describe('checkout_completed (top-up / payment mode)', () => {
    it('defers top-up credit grant to 05E — no credit balance mutation', async () => {
      mockProvider.parseWebhookEvent!.mockReturnValue({
        success: true,
        data: {
          eventId: 'evt_topup_001',
          eventType: 'checkout.session.completed',
          data: {
            customer: 'cus_test_123',
            mode: 'payment',
          },
        },
      });

      const result = await service.processWebhook(stubRawBody, stubSignature);
      expect(result.received).toBe(true);
      expect(result.status).toBe('processed');
      expect(mockSubRepo.createSubscription).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // subscription_created
  // ---------------------------------------------------------------------------

  describe('subscription_created', () => {
    beforeEach(() => {
      mockProvider.parseWebhookEvent!.mockReturnValue({
        success: true,
        data: {
          eventId: 'evt_sub_created',
          eventType: 'customer.subscription.created',
          data: {
            id: 'sub_new_001',
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
    });

    it('creates subscription if not exists', async () => {
      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockSubRepo.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-uuid-1',
          stripeSubscriptionId: 'sub_new_001',
          status: 'active',
        }),
      );
    });

    it('skips creation if subscription already exists', async () => {
      mockSubRepo.findByStripeSubscriptionId!.mockResolvedValue({
        id: 'existing-sub',
      } as any);

      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockSubRepo.createSubscription).not.toHaveBeenCalled();
    });

    it('updates user plan', async () => {
      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockUserRepo.update).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // subscription_updated
  // ---------------------------------------------------------------------------

  describe('subscription_updated', () => {
    beforeEach(() => {
      mockProvider.parseWebhookEvent!.mockReturnValue({
        success: true,
        data: {
          eventId: 'evt_sub_updated',
          eventType: 'customer.subscription.updated',
          data: {
            id: 'sub_test_001',
            customer: 'cus_test_123',
            status: 'active',
            current_period_start: 1700000000,
            current_period_end: 1702600000,
            cancel_at_period_end: false,
          },
        },
      });
      mockProvider.mapEventType!.mockReturnValue({
        internal: 'subscription_updated',
        stripe: 'customer.subscription.updated',
      });
      mockSubRepo.findByStripeSubscriptionId!.mockResolvedValue({
        id: 'sub-uuid-1',
        stripeSubscriptionId: 'sub_test_001',
        status: 'active',
        planType: 'starter',
      } as any);
    });

    it('updates subscription status and period', async () => {
      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockSubRepo.updateSubscription).toHaveBeenCalledWith(
        'sub-uuid-1',
        expect.objectContaining({
          status: 'active',
          currentPeriodStart: expect.any(Date),
          currentPeriodEnd: expect.any(Date),
        }),
      );
    });

    it('fails with SUBSCRIPTION_NOT_FOUND if subscription missing', async () => {
      mockSubRepo.findByStripeSubscriptionId!.mockResolvedValue(null);

      const result = await service.processWebhook(stubRawBody, stubSignature);
      expect(result.status).toBe('failed');
      expect(mockWebhookRepo.updateEventStatus).toHaveBeenCalledWith(
        'webhook-evt-uuid-1',
        'failed',
        expect.stringContaining('not found'),
        'SUBSCRIPTION_NOT_FOUND',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // subscription_deleted
  // ---------------------------------------------------------------------------

  describe('subscription_deleted', () => {
    beforeEach(() => {
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
        stripeSubscriptionId: 'sub_test_001',
        status: 'active',
        planType: 'starter',
      } as any);
    });

    it('sets subscription status to cancelled', async () => {
      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockSubRepo.updateSubscription).toHaveBeenCalledWith(
        'sub-uuid-1',
        expect.objectContaining({
          status: 'cancelled',
          cancelledAt: expect.any(Date),
        }),
      );
    });

    it('sets user plan to free and status to cancelled', async () => {
      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockUserRepo.update).toHaveBeenCalledWith(
        { id: 'user-uuid-1' },
        { planType: 'free', planStatus: 'cancelled' },
      );
    });

    it('fails if subscription not found', async () => {
      mockSubRepo.findByStripeSubscriptionId!.mockResolvedValue(null);

      const result = await service.processWebhook(stubRawBody, stubSignature);
      expect(result.status).toBe('failed');
    });
  });

  // ---------------------------------------------------------------------------
  // invoice_paid
  // ---------------------------------------------------------------------------

  describe('invoice_paid', () => {
    beforeEach(() => {
      mockProvider.parseWebhookEvent!.mockReturnValue({
        success: true,
        data: {
          eventId: 'evt_invoice_paid',
          eventType: 'invoice.paid',
          data: {
            subscription: 'sub_test_001',
            status: 'paid',
            current_period_start: 1703000000,
            current_period_end: 1705600000,
          },
        },
      });
      mockProvider.mapEventType!.mockReturnValue({
        internal: 'invoice_paid',
        stripe: 'invoice.paid',
      });
      mockSubRepo.findByStripeSubscriptionId!.mockResolvedValue({
        id: 'sub-uuid-1',
        stripeSubscriptionId: 'sub_test_001',
        status: 'active',
      } as any);
    });

    it('updates subscription period on renewal', async () => {
      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockSubRepo.updateSubscription).toHaveBeenCalledWith(
        'sub-uuid-1',
        expect.objectContaining({
          currentPeriodStart: expect.any(Date),
          currentPeriodEnd: expect.any(Date),
          status: 'active',
        }),
      );
    });

    it('defers non-subscription invoice (top-up) to 05E', async () => {
      mockProvider.parseWebhookEvent!.mockReturnValue({
        success: true,
        data: {
          eventId: 'evt_invoice_paid_topup',
          eventType: 'invoice.paid',
          data: { status: 'paid' },
        },
      });

      const result = await service.processWebhook(stubRawBody, stubSignature);
      expect(result.status).toBe('processed');
      expect(mockSubRepo.updateSubscription).not.toHaveBeenCalled();
    });

    it('fails if subscription not found', async () => {
      mockSubRepo.findByStripeSubscriptionId!.mockResolvedValue(null);

      const result = await service.processWebhook(stubRawBody, stubSignature);
      expect(result.status).toBe('failed');
    });
  });

  // ---------------------------------------------------------------------------
  // invoice_payment_failed
  // ---------------------------------------------------------------------------

  describe('invoice_payment_failed', () => {
    beforeEach(() => {
      mockProvider.parseWebhookEvent!.mockReturnValue({
        success: true,
        data: {
          eventId: 'evt_invoice_failed',
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
        stripeSubscriptionId: 'sub_test_001',
        status: 'active',
        planType: 'starter',
      } as any);
    });

    it('sets subscription status to past_due', async () => {
      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockSubRepo.updateSubscription).toHaveBeenCalledWith(
        'sub-uuid-1',
        { status: 'past_due' },
      );
    });

    it('updates user plan status to past_due', async () => {
      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockUserRepo.update).toHaveBeenCalledWith(
        { id: 'user-uuid-1' },
        expect.objectContaining({ planStatus: 'past_due' }),
      );
    });

    it('fails if subscription not found', async () => {
      mockSubRepo.findByStripeSubscriptionId!.mockResolvedValue(null);

      const result = await service.processWebhook(stubRawBody, stubSignature);
      expect(result.status).toBe('failed');
    });
  });

  // ---------------------------------------------------------------------------
  // Stripe status spelling normalization
  // ---------------------------------------------------------------------------

  describe('Stripe status spelling normalization', () => {
    it('normalizes Stripe "canceled" to local "cancelled"', async () => {
      mockProvider.parseWebhookEvent!.mockReturnValue({
        success: true,
        data: {
          eventId: 'evt_spelling',
          eventType: 'customer.subscription.updated',
          data: {
            id: 'sub_test_001',
            customer: 'cus_test_123',
            status: 'canceled',
          },
        },
      });
      mockProvider.mapEventType!.mockReturnValue({
        internal: 'subscription_updated',
        stripe: 'customer.subscription.updated',
      });
      mockSubRepo.findByStripeSubscriptionId!.mockResolvedValue({
        id: 'sub-uuid-1',
        stripeSubscriptionId: 'sub_test_001',
        status: 'active',
        planType: 'starter',
      } as any);

      await service.processWebhook(stubRawBody, stubSignature);
      expect(mockSubRepo.updateSubscription).toHaveBeenCalledWith(
        'sub-uuid-1',
        expect.objectContaining({ status: 'cancelled' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Unknown customer / missing user
  // ---------------------------------------------------------------------------

  describe('unknown customer / missing user', () => {
    it('records event as failed with UNKNOWN_CUSTOMER when user not found', async () => {
      mockUserRepo.findOne!.mockResolvedValue(null);

      const result = await service.processWebhook(stubRawBody, stubSignature);
      expect(result.status).toBe('failed');
      expect(mockWebhookRepo.updateEventStatus).toHaveBeenCalledWith(
        'webhook-evt-uuid-1',
        'failed',
        expect.stringContaining('stripeCustomerId'),
        'UNKNOWN_CUSTOMER',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // No credit balance mutation
  // ---------------------------------------------------------------------------

  describe('no direct credit balance mutation in any handler', () => {
    it('service source does not directly reference credit_balances or credit_deduction_records', () => {
      const source = require('fs').readFileSync(
        require('path').resolve(__dirname, '../webhook.service.ts'),
        'utf-8',
      );
      // 05E: WebhookService delegates to CreditGrantService for credit mutations.
      // It must NOT directly reference balance or deduction entities/repositories.
      expect(source).not.toContain('credit_balance');
      expect(source).not.toContain('CreditBalance');
      expect(source).not.toContain('credit_deduction');
      expect(source).not.toContain('CreditDeduction');
      // 05E: CreditGrantService is now injected — this is the approved integration
      expect(source).toContain('CreditGrantService');
    });
  });

  // ---------------------------------------------------------------------------
  // No Stripe SDK / package / env
  // ---------------------------------------------------------------------------

  describe('no Stripe SDK or env dependencies', () => {
    it('does not import stripe package', () => {
      const source = require('fs').readFileSync(
        require('path').resolve(__dirname, '../webhook.service.ts'),
        'utf-8',
      );
      expect(source).not.toContain("from 'stripe'");
      expect(source).not.toContain('require("stripe")');
      expect(source).not.toContain("require('stripe')");
    });

    it('does not read STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY', () => {
      const source = require('fs').readFileSync(
        require('path').resolve(__dirname, '../webhook.service.ts'),
        'utf-8',
      );
      expect(source).not.toContain('STRIPE_WEBHOOK_SECRET');
      expect(source).not.toContain('STRIPE_SECRET_KEY');
    });
  });
});
