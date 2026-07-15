import { WebhookController } from '../webhook.controller';
import {
  WebhookService,
  WebhookVerificationError,
} from '../webhook.service';

describe('WebhookController (05D)', () => {
  let controller: WebhookController;
  let mockService: jest.Mocked<Partial<WebhookService>>;

  const createMockRequest = (
    overrides: {
      signature?: string | null;
      rawBody?: Buffer | null;
      body?: any;
    } = {},
  ) => {
    const statusFn = jest.fn();
    return {
      headers: overrides.signature !== null
        ? { 'stripe-signature': overrides.signature ?? 'test_sig' }
        : {},
      rawBody: overrides.rawBody !== null
        ? overrides.rawBody ?? Buffer.from('{"test":true}')
        : undefined,
      body: overrides.body ?? { test: true },
      res: { status: statusFn },
      _statusFn: statusFn,
    } as any;
  };

  beforeEach(() => {
    mockService = {
      processWebhook: jest.fn().mockResolvedValue({
        received: true,
        status: 'processed',
      }),
    };

    controller = new WebhookController(mockService as any);
  });

  describe('POST /api/billing/webhooks/stripe', () => {
    it('calls service and returns { received: true } for verified event', async () => {
      const req = createMockRequest();
      const result = await controller.handleStripeWebhook(req);
      expect(result).toEqual({ received: true });
      expect(mockService.processWebhook).toHaveBeenCalledWith(
        expect.any(Buffer),
        'test_sig',
      );
    });

    it('returns 400 with MISSING_SIGNATURE when stripe-signature header is absent', async () => {
      const req = createMockRequest({ signature: null });
      const result = await controller.handleStripeWebhook(req);
      expect(result).toEqual({ received: false, error: 'MISSING_SIGNATURE' });
      expect(req._statusFn).toHaveBeenCalledWith(400);
    });

    it('returns 400 with error code on WebhookVerificationError', async () => {
      mockService.processWebhook!.mockRejectedValue(
        new WebhookVerificationError('PROVIDER_DISABLED', 'disabled'),
      );
      const req = createMockRequest();
      const result = await controller.handleStripeWebhook(req);
      expect(result).toEqual({
        received: false,
        error: 'PROVIDER_DISABLED',
      });
      expect(req._statusFn).toHaveBeenCalledWith(400);
    });

    it('returns 400 with PROVIDER_NOT_CONFIGURED error', async () => {
      mockService.processWebhook!.mockRejectedValue(
        new WebhookVerificationError('PROVIDER_NOT_CONFIGURED', 'not configured'),
      );
      const req = createMockRequest();
      const result = await controller.handleStripeWebhook(req);
      expect(result.error).toBe('PROVIDER_NOT_CONFIGURED');
    });

    it('returns 400 with SIGNATURE_INVALID error', async () => {
      mockService.processWebhook!.mockRejectedValue(
        new WebhookVerificationError('SIGNATURE_INVALID', 'bad sig'),
      );
      const req = createMockRequest();
      const result = await controller.handleStripeWebhook(req);
      expect(result.error).toBe('SIGNATURE_INVALID');
    });

    it('returns { received: true } on unexpected processing error (200 to prevent retry)', async () => {
      mockService.processWebhook!.mockRejectedValue(
        new Error('Unexpected DB error'),
      );
      const req = createMockRequest();
      const result = await controller.handleStripeWebhook(req);
      expect(result).toEqual({ received: true });
    });

    it('uses rawBody from request when available', async () => {
      const rawBody = Buffer.from('raw-payload');
      const req = createMockRequest({ rawBody });
      await controller.handleStripeWebhook(req);
      expect(mockService.processWebhook).toHaveBeenCalledWith(
        rawBody,
        'test_sig',
      );
    });

    it('falls back to JSON.stringify(body) when rawBody is not available', async () => {
      const req = createMockRequest({ rawBody: null, body: { fallback: true } });
      await controller.handleStripeWebhook(req);
      const calledBody = mockService.processWebhook!.mock.calls[0][0];
      expect(calledBody.toString()).toBe(JSON.stringify({ fallback: true }));
    });
  });

  describe('auth boundary', () => {
    it('controller does not import SessionCookieGuard', () => {
      const source = require('fs').readFileSync(
        require('path').resolve(__dirname, '../webhook.controller.ts'),
        'utf-8',
      );
      expect(source).not.toMatch(/import\s.*SessionCookieGuard/);
      expect(source).not.toMatch(/@UseGuards\(.*SessionCookieGuard/);
    });

    it('controller does not import PublicApiKeyGuard or ApiKeyAuthGuard', () => {
      const source = require('fs').readFileSync(
        require('path').resolve(__dirname, '../webhook.controller.ts'),
        'utf-8',
      );
      expect(source).not.toMatch(/import\s.*PublicApiKeyGuard/);
      expect(source).not.toMatch(/import\s.*ApiKeyAuthGuard/);
      expect(source).not.toMatch(/@UseGuards\(.*ApiKeyAuthGuard/);
    });

    it('controller does not import InternalServiceAuthGuard', () => {
      const source = require('fs').readFileSync(
        require('path').resolve(__dirname, '../webhook.controller.ts'),
        'utf-8',
      );
      expect(source).not.toMatch(/import\s.*InternalServiceAuthGuard/);
      expect(source).not.toMatch(/@UseGuards\(.*InternalServiceAuthGuard/);
    });
  });

  describe('no Stripe SDK or env dependencies', () => {
    it('controller does not import stripe package', () => {
      const source = require('fs').readFileSync(
        require('path').resolve(__dirname, '../webhook.controller.ts'),
        'utf-8',
      );
      expect(source).not.toContain("from 'stripe'");
      expect(source).not.toContain('require("stripe")');
      expect(source).not.toContain("require('stripe')");
    });

    it('controller does not reference env secrets', () => {
      const source = require('fs').readFileSync(
        require('path').resolve(__dirname, '../webhook.controller.ts'),
        'utf-8',
      );
      expect(source).not.toContain('STRIPE_WEBHOOK_SECRET');
      expect(source).not.toContain('STRIPE_SECRET_KEY');
    });
  });
});
