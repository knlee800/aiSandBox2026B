import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StripePaymentProvider } from '../providers/stripe-payment.provider';
import type {
  ProviderMode,
  CheckoutSessionResult,
  CustomerResult,
  PortalSessionResult,
  WebhookVerificationResult,
  ParsedWebhookEvent,
} from '../interfaces/payment-provider.interface';

function createMockConfigService(
  overrides: Record<string, string | undefined> = {},
): { get: jest.Mock } {
  const store: Record<string, string | undefined> = { ...overrides };
  return {
    get: jest.fn((key: string) => store[key]),
  };
}

async function buildProvider(
  envOverrides: Record<string, string | undefined> = {},
): Promise<StripePaymentProvider> {
  const mockConfig = createMockConfigService(envOverrides);
  const module = await Test.createTestingModule({
    providers: [
      StripePaymentProvider,
      { provide: ConfigService, useValue: mockConfig },
    ],
  }).compile();
  return module.get(StripePaymentProvider);
}

describe('StripePaymentProvider (BILLING-READY-05A)', () => {
  // -----------------------------------------------------------------------
  // Mode Resolution
  // -----------------------------------------------------------------------

  describe('mode resolution', () => {
    it('defaults to disabled when STRIPE_PROVIDER_MODE is not set', async () => {
      const provider = await buildProvider({});
      expect(provider.getProviderMode()).toBe('disabled');
    });

    it('defaults to disabled when STRIPE_PROVIDER_MODE is empty string', async () => {
      const provider = await buildProvider({ STRIPE_PROVIDER_MODE: '' });
      expect(provider.getProviderMode()).toBe('disabled');
    });

    it('defaults to disabled when STRIPE_PROVIDER_MODE is whitespace', async () => {
      const provider = await buildProvider({ STRIPE_PROVIDER_MODE: '  ' });
      expect(provider.getProviderMode()).toBe('disabled');
    });

    it('recognizes explicit disabled mode', async () => {
      const provider = await buildProvider({
        STRIPE_PROVIDER_MODE: 'disabled',
      });
      expect(provider.getProviderMode()).toBe('disabled');
    });

    it('recognizes explicit stub mode', async () => {
      const provider = await buildProvider({ STRIPE_PROVIDER_MODE: 'stub' });
      expect(provider.getProviderMode()).toBe('stub');
    });

    it('recognizes explicit test mode when secret key is present', async () => {
      const provider = await buildProvider({
        STRIPE_PROVIDER_MODE: 'test',
        STRIPE_SECRET_KEY: 'sk_test_abc123',
      });
      expect(provider.getProviderMode()).toBe('test');
    });

    it('recognizes explicit live mode when secret key is present', async () => {
      const provider = await buildProvider({
        STRIPE_PROVIDER_MODE: 'live',
        STRIPE_SECRET_KEY: 'sk_live_abc123',
      });
      expect(provider.getProviderMode()).toBe('live');
    });

    it('degrades invalid mode to disabled', async () => {
      const provider = await buildProvider({
        STRIPE_PROVIDER_MODE: 'banana',
      });
      expect(provider.getProviderMode()).toBe('disabled');
    });

    it('degrades test mode to disabled when STRIPE_SECRET_KEY is missing', async () => {
      const provider = await buildProvider({ STRIPE_PROVIDER_MODE: 'test' });
      expect(provider.getProviderMode()).toBe('disabled');
    });

    it('degrades live mode to disabled when STRIPE_SECRET_KEY is missing', async () => {
      const provider = await buildProvider({ STRIPE_PROVIDER_MODE: 'live' });
      expect(provider.getProviderMode()).toBe('disabled');
    });

    it('degrades test mode to disabled when key is a live key (mismatch)', async () => {
      const provider = await buildProvider({
        STRIPE_PROVIDER_MODE: 'test',
        STRIPE_SECRET_KEY: 'sk_live_mismatched',
      });
      expect(provider.getProviderMode()).toBe('disabled');
    });

    it('handles case-insensitive mode values', async () => {
      const provider = await buildProvider({ STRIPE_PROVIDER_MODE: 'STUB' });
      expect(provider.getProviderMode()).toBe('stub');
    });

    it('trims whitespace from mode value', async () => {
      const provider = await buildProvider({
        STRIPE_PROVIDER_MODE: ' stub ',
      });
      expect(provider.getProviderMode()).toBe('stub');
    });
  });

  // -----------------------------------------------------------------------
  // Identity
  // -----------------------------------------------------------------------

  describe('getProviderName', () => {
    it('returns stripe', async () => {
      const provider = await buildProvider({});
      expect(provider.getProviderName()).toBe('stripe');
    });
  });

  // -----------------------------------------------------------------------
  // validateConfiguration
  // -----------------------------------------------------------------------

  describe('validateConfiguration', () => {
    it('returns false when disabled', async () => {
      const provider = await buildProvider({
        STRIPE_PROVIDER_MODE: 'disabled',
      });
      expect(provider.validateConfiguration()).toBe(false);
    });

    it('returns true when stub', async () => {
      const provider = await buildProvider({ STRIPE_PROVIDER_MODE: 'stub' });
      expect(provider.validateConfiguration()).toBe(true);
    });

    it('returns true when test mode with valid key', async () => {
      const provider = await buildProvider({
        STRIPE_PROVIDER_MODE: 'test',
        STRIPE_SECRET_KEY: 'sk_test_abc123',
      });
      expect(provider.validateConfiguration()).toBe(true);
    });

    it('returns true when live mode with valid key', async () => {
      const provider = await buildProvider({
        STRIPE_PROVIDER_MODE: 'live',
        STRIPE_SECRET_KEY: 'sk_live_abc123',
      });
      expect(provider.validateConfiguration()).toBe(true);
    });

    it('returns false when mode degrades to disabled from missing key', async () => {
      const provider = await buildProvider({ STRIPE_PROVIDER_MODE: 'test' });
      expect(provider.validateConfiguration()).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Disabled Mode — all operations return PROVIDER_DISABLED
  // -----------------------------------------------------------------------

  describe('disabled mode operations', () => {
    let provider: StripePaymentProvider;

    beforeEach(async () => {
      provider = await buildProvider({ STRIPE_PROVIDER_MODE: 'disabled' });
    });

    it('createCheckoutSession returns PROVIDER_DISABLED', async () => {
      const result = await provider.createCheckoutSession({
        userId: 'u1',
        userEmail: 'a@b.com',
        planId: 'starter',
        successUrl: 'http://ok',
        cancelUrl: 'http://no',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('PROVIDER_DISABLED');
      expect(result.data).toBeUndefined();
    });

    it('createOrRetrieveCustomer returns PROVIDER_DISABLED', async () => {
      const result = await provider.createOrRetrieveCustomer({
        userId: 'u1',
        email: 'a@b.com',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('PROVIDER_DISABLED');
    });

    it('createBillingPortalSession returns PROVIDER_DISABLED', async () => {
      const result = await provider.createBillingPortalSession({
        customerId: 'cus_1',
        returnUrl: 'http://back',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('PROVIDER_DISABLED');
    });

    it('verifyWebhookSignature returns PROVIDER_DISABLED', () => {
      const result = provider.verifyWebhookSignature(
        Buffer.from('{}'),
        'sig',
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('PROVIDER_DISABLED');
    });

    it('parseWebhookEvent returns PROVIDER_DISABLED', () => {
      const result = provider.parseWebhookEvent(Buffer.from('{}'), 'sig');
      expect(result.success).toBe(false);
      expect(result.error).toBe('PROVIDER_DISABLED');
    });
  });

  // -----------------------------------------------------------------------
  // Stub Mode — deterministic placeholders
  // -----------------------------------------------------------------------

  describe('stub mode operations', () => {
    let provider: StripePaymentProvider;

    beforeEach(async () => {
      provider = await buildProvider({ STRIPE_PROVIDER_MODE: 'stub' });
    });

    it('createCheckoutSession returns stub placeholder', async () => {
      const result = await provider.createCheckoutSession({
        userId: 'u1',
        userEmail: 'a@b.com',
        planId: 'starter',
        successUrl: 'http://ok',
        cancelUrl: 'http://no',
      });
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      const data = result.data as CheckoutSessionResult;
      expect(data.sessionId).toBe('stub_cs_placeholder');
      expect(data.url).toBeNull();
    });

    it('createOrRetrieveCustomer returns stub placeholder', async () => {
      const result = await provider.createOrRetrieveCustomer({
        userId: 'u1',
        email: 'a@b.com',
      });
      expect(result.success).toBe(true);
      const data = result.data as CustomerResult;
      expect(data.customerId).toBeNull();
      expect(data.isNew).toBe(false);
    });

    it('createBillingPortalSession returns stub placeholder', async () => {
      const result = await provider.createBillingPortalSession({
        customerId: 'cus_1',
        returnUrl: 'http://back',
      });
      expect(result.success).toBe(true);
      const data = result.data as PortalSessionResult;
      expect(data.url).toBeNull();
    });

    it('verifyWebhookSignature returns valid in stub mode', () => {
      const result = provider.verifyWebhookSignature(
        Buffer.from('{}'),
        'sig',
      );
      expect(result.success).toBe(true);
      const data = result.data as WebhookVerificationResult;
      expect(data.valid).toBe(true);
    });

    it('parseWebhookEvent returns stub placeholder event', () => {
      const result = provider.parseWebhookEvent(Buffer.from('{}'), 'sig');
      expect(result.success).toBe(true);
      const data = result.data as ParsedWebhookEvent;
      expect(data.eventId).toBe('stub_evt_placeholder');
      expect(data.eventType).toBeDefined();
      expect(data.data).toEqual({});
    });

    it('prepareInvoice returns placeholder context (legacy compatibility)', async () => {
      const ctx = provider.prepareInvoice({
        userId: 'u1',
        planType: 'starter',
        totalCostUsd: 9.99,
        currency: 'USD',
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
      });
      expect(ctx.provider).toBe('stripe');
      expect(ctx.externalCustomerId).toBeNull();
      expect(ctx.externalInvoiceId).toBeNull();
      expect(ctx.status).toBe('not_sent');
    });
  });

  // -----------------------------------------------------------------------
  // Test Mode — recognized but no SDK calls in 05A
  // -----------------------------------------------------------------------

  describe('test mode operations (no SDK in 05A)', () => {
    let provider: StripePaymentProvider;

    beforeEach(async () => {
      provider = await buildProvider({
        STRIPE_PROVIDER_MODE: 'test',
        STRIPE_SECRET_KEY: 'sk_test_abc123',
      });
    });

    it('getProviderMode returns test', () => {
      expect(provider.getProviderMode()).toBe('test');
    });

    it('createCheckoutSession returns PROVIDER_NOT_CONFIGURED', async () => {
      const result = await provider.createCheckoutSession({
        userId: 'u1',
        userEmail: 'a@b.com',
        planId: 'starter',
        successUrl: 'http://ok',
        cancelUrl: 'http://no',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('PROVIDER_NOT_CONFIGURED');
    });

    it('createOrRetrieveCustomer returns PROVIDER_NOT_CONFIGURED', async () => {
      const result = await provider.createOrRetrieveCustomer({
        userId: 'u1',
        email: 'a@b.com',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('PROVIDER_NOT_CONFIGURED');
    });

    it('createBillingPortalSession returns PROVIDER_NOT_CONFIGURED', async () => {
      const result = await provider.createBillingPortalSession({
        customerId: 'cus_1',
        returnUrl: 'http://back',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('PROVIDER_NOT_CONFIGURED');
    });

    it('verifyWebhookSignature returns PROVIDER_NOT_CONFIGURED', () => {
      const result = provider.verifyWebhookSignature(
        Buffer.from('{}'),
        'sig',
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('PROVIDER_NOT_CONFIGURED');
    });

    it('parseWebhookEvent returns PROVIDER_NOT_CONFIGURED', () => {
      const result = provider.parseWebhookEvent(Buffer.from('{}'), 'sig');
      expect(result.success).toBe(false);
      expect(result.error).toBe('PROVIDER_NOT_CONFIGURED');
    });
  });

  // -----------------------------------------------------------------------
  // Live Mode — recognized but no SDK calls in 05A
  // -----------------------------------------------------------------------

  describe('live mode operations (no SDK in 05A)', () => {
    let provider: StripePaymentProvider;

    beforeEach(async () => {
      provider = await buildProvider({
        STRIPE_PROVIDER_MODE: 'live',
        STRIPE_SECRET_KEY: 'sk_live_abc123',
      });
    });

    it('getProviderMode returns live', () => {
      expect(provider.getProviderMode()).toBe('live');
    });

    it('createCheckoutSession returns PROVIDER_NOT_CONFIGURED', async () => {
      const result = await provider.createCheckoutSession({
        userId: 'u1',
        userEmail: 'a@b.com',
        planId: 'starter',
        successUrl: 'http://ok',
        cancelUrl: 'http://no',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('PROVIDER_NOT_CONFIGURED');
    });
  });

  // -----------------------------------------------------------------------
  // mapEventType (works in all modes)
  // -----------------------------------------------------------------------

  describe('mapEventType', () => {
    let provider: StripePaymentProvider;

    beforeEach(async () => {
      provider = await buildProvider({ STRIPE_PROVIDER_MODE: 'stub' });
    });

    it('maps checkout.session.completed', () => {
      const mapped = provider.mapEventType('checkout.session.completed');
      expect(mapped).toEqual({
        internal: 'checkout_completed',
        stripe: 'checkout.session.completed',
      });
    });

    it('maps customer.subscription.created', () => {
      const mapped = provider.mapEventType('customer.subscription.created');
      expect(mapped).toEqual({
        internal: 'subscription_created',
        stripe: 'customer.subscription.created',
      });
    });

    it('maps customer.subscription.updated', () => {
      const mapped = provider.mapEventType('customer.subscription.updated');
      expect(mapped).toEqual({
        internal: 'subscription_updated',
        stripe: 'customer.subscription.updated',
      });
    });

    it('maps customer.subscription.deleted', () => {
      const mapped = provider.mapEventType('customer.subscription.deleted');
      expect(mapped).toEqual({
        internal: 'subscription_deleted',
        stripe: 'customer.subscription.deleted',
      });
    });

    it('maps invoice.paid', () => {
      const mapped = provider.mapEventType('invoice.paid');
      expect(mapped).toEqual({
        internal: 'invoice_paid',
        stripe: 'invoice.paid',
      });
    });

    it('maps invoice.payment_failed', () => {
      const mapped = provider.mapEventType('invoice.payment_failed');
      expect(mapped).toEqual({
        internal: 'invoice_payment_failed',
        stripe: 'invoice.payment_failed',
      });
    });

    it('returns null for unrecognized event type', () => {
      expect(provider.mapEventType('unknown.event')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(provider.mapEventType('')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // No Stripe SDK / secrets safety
  // -----------------------------------------------------------------------

  describe('safety invariants', () => {
    it('no stripe SDK import exists in provider source', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const providerSource = fs.readFileSync(
        path.resolve(
          __dirname,
          '../providers/stripe-payment.provider.ts',
        ),
        'utf-8',
      );
      expect(providerSource).not.toMatch(/from\s+['"]stripe['"]/);
      expect(providerSource).not.toMatch(/require\s*\(\s*['"]stripe['"]\s*\)/);
    });

    it('no secret values in disabled mode results', async () => {
      const provider = await buildProvider({
        STRIPE_PROVIDER_MODE: 'disabled',
      });
      const result = await provider.createCheckoutSession({
        userId: 'u1',
        userEmail: 'a@b.com',
        planId: 'starter',
        successUrl: 'http://ok',
        cancelUrl: 'http://no',
      });
      const serialized = JSON.stringify(result);
      expect(serialized).not.toMatch(/sk_test_/);
      expect(serialized).not.toMatch(/sk_live_/);
      expect(serialized).not.toMatch(/whsec_/);
    });

    it('no secret values in stub mode results', async () => {
      const provider = await buildProvider({ STRIPE_PROVIDER_MODE: 'stub' });
      const checkoutResult = await provider.createCheckoutSession({
        userId: 'u1',
        userEmail: 'a@b.com',
        planId: 'starter',
        successUrl: 'http://ok',
        cancelUrl: 'http://no',
      });
      const customerResult = await provider.createOrRetrieveCustomer({
        userId: 'u1',
        email: 'a@b.com',
      });
      const portalResult = await provider.createBillingPortalSession({
        customerId: 'cus_1',
        returnUrl: 'http://back',
      });
      const webhookResult = provider.verifyWebhookSignature(
        Buffer.from('{}'),
        'sig',
      );
      const parseResult = provider.parseWebhookEvent(
        Buffer.from('{}'),
        'sig',
      );

      const allSerialized = JSON.stringify([
        checkoutResult,
        customerResult,
        portalResult,
        webhookResult,
        parseResult,
      ]);
      expect(allSerialized).not.toMatch(/sk_test_/);
      expect(allSerialized).not.toMatch(/sk_live_/);
      expect(allSerialized).not.toMatch(/whsec_/);
    });
  });
});
