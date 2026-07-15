/**
 * Payment Provider Contract Shape Tests (BILLING-READY-05A)
 *
 * Verifies that typed result/param/error contracts compile and
 * have the expected structural shape. These are compile-time-plus
 * runtime shape checks — no provider calls, no SDK.
 */
import type {
  ProviderMode,
  ProviderResult,
  ProviderErrorCode,
  CheckoutSessionResult,
  CustomerResult,
  PortalSessionResult,
  WebhookVerificationResult,
  ParsedWebhookEvent,
  MappedEventType,
  InternalEventType,
  CreateCheckoutSessionParams,
  CustomerParams,
  PortalSessionParams,
  InvoicePreview,
  ProviderInvoiceContext,
  PaymentProvider,
} from '../interfaces/payment-provider.interface';
import { VALID_PROVIDER_MODES } from '../interfaces/payment-provider.interface';

describe('Payment Provider Contracts (BILLING-READY-05A)', () => {
  describe('ProviderMode', () => {
    it('VALID_PROVIDER_MODES contains exactly 4 modes', () => {
      expect(VALID_PROVIDER_MODES).toEqual([
        'disabled',
        'stub',
        'test',
        'live',
      ]);
      expect(VALID_PROVIDER_MODES).toHaveLength(4);
    });
  });

  describe('ProviderResult<T> shape', () => {
    it('success result has data, no error', () => {
      const result: ProviderResult<CheckoutSessionResult> = {
        success: true,
        data: { sessionId: 'cs_1', url: 'http://x' },
      };
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('error result has error code, no data', () => {
      const result: ProviderResult<CheckoutSessionResult> = {
        success: false,
        error: 'PROVIDER_DISABLED',
        message: 'off',
      };
      expect(result.success).toBe(false);
      expect(result.error).toBe('PROVIDER_DISABLED');
      expect(result.data).toBeUndefined();
    });
  });

  describe('CheckoutSessionResult shape', () => {
    it('has sessionId and url fields', () => {
      const r: CheckoutSessionResult = { sessionId: null, url: null };
      expect(r).toHaveProperty('sessionId');
      expect(r).toHaveProperty('url');
    });
  });

  describe('CustomerResult shape', () => {
    it('has customerId and isNew fields', () => {
      const r: CustomerResult = { customerId: null, isNew: false };
      expect(r).toHaveProperty('customerId');
      expect(r).toHaveProperty('isNew');
    });
  });

  describe('PortalSessionResult shape', () => {
    it('has url field', () => {
      const r: PortalSessionResult = { url: null };
      expect(r).toHaveProperty('url');
    });
  });

  describe('WebhookVerificationResult shape', () => {
    it('has valid field', () => {
      const r: WebhookVerificationResult = { valid: true };
      expect(r).toHaveProperty('valid');
    });
  });

  describe('ParsedWebhookEvent shape', () => {
    it('has eventId, eventType, and data fields', () => {
      const r: ParsedWebhookEvent = {
        eventId: 'evt_1',
        eventType: 'checkout_completed',
        data: {},
      };
      expect(r).toHaveProperty('eventId');
      expect(r).toHaveProperty('eventType');
      expect(r).toHaveProperty('data');
    });
  });

  describe('MappedEventType shape', () => {
    it('has internal and stripe fields', () => {
      const r: MappedEventType = {
        internal: 'checkout_completed',
        stripe: 'checkout.session.completed',
      };
      expect(r).toHaveProperty('internal');
      expect(r).toHaveProperty('stripe');
    });
  });

  describe('CreateCheckoutSessionParams shape', () => {
    it('has all required fields', () => {
      const p: CreateCheckoutSessionParams = {
        userId: 'u1',
        userEmail: 'a@b.com',
        planId: 'starter',
        successUrl: 'http://ok',
        cancelUrl: 'http://no',
      };
      expect(p).toHaveProperty('userId');
      expect(p).toHaveProperty('userEmail');
      expect(p).toHaveProperty('planId');
      expect(p).toHaveProperty('successUrl');
      expect(p).toHaveProperty('cancelUrl');
    });
  });

  describe('CustomerParams shape', () => {
    it('has required and optional fields', () => {
      const p: CustomerParams = { userId: 'u1', email: 'a@b.com' };
      expect(p).toHaveProperty('userId');
      expect(p).toHaveProperty('email');
    });
  });

  describe('PortalSessionParams shape', () => {
    it('has required fields', () => {
      const p: PortalSessionParams = {
        customerId: 'cus_1',
        returnUrl: 'http://back',
      };
      expect(p).toHaveProperty('customerId');
      expect(p).toHaveProperty('returnUrl');
    });
  });

  describe('Legacy InvoicePreview shape', () => {
    it('has all required fields', () => {
      const p: InvoicePreview = {
        userId: 'u1',
        planType: 'starter',
        totalCostUsd: 9.99,
        currency: 'USD',
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
      };
      expect(p).toHaveProperty('userId');
      expect(p).toHaveProperty('planType');
      expect(p).toHaveProperty('totalCostUsd');
      expect(p).toHaveProperty('currency');
      expect(p).toHaveProperty('periodStart');
      expect(p).toHaveProperty('periodEnd');
    });
  });

  describe('Legacy ProviderInvoiceContext shape', () => {
    it('has all required fields', () => {
      const ctx: ProviderInvoiceContext = {
        provider: 'stripe',
        externalCustomerId: null,
        externalInvoiceId: null,
        status: 'not_sent',
      };
      expect(ctx).toHaveProperty('provider');
      expect(ctx).toHaveProperty('externalCustomerId');
      expect(ctx).toHaveProperty('externalInvoiceId');
      expect(ctx.status).toBe('not_sent');
    });
  });

  describe('no Stripe SDK import in contract file', () => {
    it('interface file does not import stripe', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const source = fs.readFileSync(
        path.resolve(
          __dirname,
          '../interfaces/payment-provider.interface.ts',
        ),
        'utf-8',
      );
      expect(source).not.toMatch(/from\s+['"]stripe['"]/);
      expect(source).not.toMatch(/require\s*\(\s*['"]stripe['"]\s*\)/);
    });
  });
});
