import { CheckoutController } from '../checkout.controller';
import { CheckoutService } from '../checkout.service';
import { SessionCookieGuard } from '../../../auth/session-cookie.guard';
import type { CheckoutSessionResponseDto } from '../dto/checkout-session-response.dto';

describe('CheckoutController', () => {
  let controller: CheckoutController;
  let checkoutService: jest.Mocked<CheckoutService>;

  const mockUser = {
    userId: 'user-uuid-123',
    email: 'test@example.com',
    role: 'user',
    plan: 'free',
  };

  const stubSubscriptionResponse: CheckoutSessionResponseDto = {
    checkoutSessionId: 'stub_cs_placeholder',
    checkoutUrl: null,
    providerMode: 'stub',
    checkoutType: 'subscription',
    planType: 'starter',
    customerId: null,
  };

  const stubTopUpResponse: CheckoutSessionResponseDto = {
    checkoutSessionId: 'stub_cs_placeholder',
    checkoutUrl: null,
    providerMode: 'stub',
    checkoutType: 'topup',
    topUpPackage: 'topup_1000',
    customerId: null,
  };

  beforeEach(() => {
    checkoutService = {
      createSubscriptionCheckout: jest.fn(),
      createTopUpCheckout: jest.fn(),
    } as any;

    controller = new CheckoutController(checkoutService);
  });

  // -------------------------------------------------------------------------
  // Guard metadata
  // -------------------------------------------------------------------------

  describe('guard metadata', () => {
    it('should use SessionCookieGuard at controller level', () => {
      const guards = Reflect.getMetadata('__guards__', CheckoutController);
      expect(guards).toBeDefined();
      expect(guards).toContain(SessionCookieGuard);
    });

    it('should NOT use ApiKeyAuthGuard', () => {
      const guards = Reflect.getMetadata('__guards__', CheckoutController);
      const guardNames = (guards || []).map((g: any) => g.name || g.constructor?.name);
      expect(guardNames).not.toContain('ApiKeyAuthGuard');
    });
  });

  // -------------------------------------------------------------------------
  // Subscription checkout
  // -------------------------------------------------------------------------

  describe('POST /subscription', () => {
    it('should delegate to CheckoutService.createSubscriptionCheckout', async () => {
      checkoutService.createSubscriptionCheckout.mockResolvedValue(
        stubSubscriptionResponse,
      );

      const req = { user: mockUser } as any;
      const dto = {
        planId: 'starter',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };

      const result = await controller.createSubscriptionCheckout(dto, req);

      expect(checkoutService.createSubscriptionCheckout).toHaveBeenCalledWith(
        mockUser.userId,
        mockUser.email,
        'starter',
        'https://example.com/success',
        'https://example.com/cancel',
      );
      expect(result).toEqual(stubSubscriptionResponse);
    });

    it('should extract userId from request.user, not from body', async () => {
      checkoutService.createSubscriptionCheckout.mockResolvedValue(
        stubSubscriptionResponse,
      );

      const req = { user: mockUser } as any;
      const dto = {
        planId: 'pro',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };

      await controller.createSubscriptionCheckout(dto, req);

      expect(
        checkoutService.createSubscriptionCheckout,
      ).toHaveBeenCalledWith(
        'user-uuid-123',
        'test@example.com',
        'pro',
        expect.any(String),
        expect.any(String),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Top-up checkout
  // -------------------------------------------------------------------------

  describe('POST /topup', () => {
    it('should delegate to CheckoutService.createTopUpCheckout', async () => {
      checkoutService.createTopUpCheckout.mockResolvedValue(
        stubTopUpResponse,
      );

      const req = { user: mockUser } as any;
      const dto = {
        topUpPackId: 'topup_1000',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };

      const result = await controller.createTopUpCheckout(dto, req);

      expect(checkoutService.createTopUpCheckout).toHaveBeenCalledWith(
        mockUser.userId,
        mockUser.email,
        'topup_1000',
        'https://example.com/success',
        'https://example.com/cancel',
      );
      expect(result).toEqual(stubTopUpResponse);
    });
  });

  // -------------------------------------------------------------------------
  // Response shape
  // -------------------------------------------------------------------------

  describe('response shape', () => {
    it('should return checkoutSessionId, checkoutUrl, providerMode, checkoutType', async () => {
      checkoutService.createSubscriptionCheckout.mockResolvedValue(
        stubSubscriptionResponse,
      );

      const req = { user: mockUser } as any;
      const dto = {
        planId: 'starter',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };

      const result = await controller.createSubscriptionCheckout(dto, req);

      expect(result).toHaveProperty('checkoutSessionId');
      expect(result).toHaveProperty('checkoutUrl');
      expect(result).toHaveProperty('providerMode');
      expect(result).toHaveProperty('checkoutType');
    });
  });
});
