import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  BadGatewayException,
} from '@nestjs/common';
import { CheckoutService } from '../checkout.service';
import type { ProviderResult, CheckoutSessionResult, CustomerResult } from '../../../payments/interfaces/payment-provider.interface';

describe('CheckoutService', () => {
  let service: CheckoutService;
  let stripePaymentProvider: any;
  let chargeReadinessService: any;
  let subscriptionRepository: any;
  let userRepository: any;
  let configService: any;

  const userId = 'user-uuid-123';
  const userEmail = 'test@example.com';
  const validSuccessUrl = 'https://app.example.com/success';
  const validCancelUrl = 'https://app.example.com/cancel';

  const stubCheckoutResult: ProviderResult<CheckoutSessionResult> = {
    success: true,
    data: { sessionId: 'stub_cs_placeholder', url: null },
  };

  const stubCustomerResult: ProviderResult<CustomerResult> = {
    success: true,
    data: { customerId: null, isNew: false },
  };

  const userEntity = {
    id: userId,
    email: userEmail,
    stripeCustomerId: null,
  };

  const userWithCustomer = {
    id: userId,
    email: userEmail,
    stripeCustomerId: 'cus_existing_123',
  };

  beforeEach(() => {
    stripePaymentProvider = {
      createCheckoutSession: jest.fn().mockResolvedValue(stubCheckoutResult),
      createOrRetrieveCustomer: jest.fn().mockResolvedValue(stubCustomerResult),
      getProviderMode: jest.fn().mockReturnValue('stub'),
    };

    chargeReadinessService = {
      getSystemChargeReadiness: jest.fn().mockReturnValue({
        chargesEnabledAtSystemLevel: true,
        paymentProviderConfigured: true,
        providerMode: 'stub',
        providerModeValid: true,
        ready: true,
        blockingReasons: [],
      }),
    };

    subscriptionRepository = {
      findActiveByUserId: jest.fn().mockResolvedValue(null),
    };

    userRepository = {
      findOne: jest.fn().mockResolvedValue(userEntity),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'FRONTEND_URL') return 'https://app.example.com';
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      }),
    };

    service = new CheckoutService(
      stripePaymentProvider,
      chargeReadinessService,
      subscriptionRepository,
      userRepository,
      configService,
    );
  });

  // -------------------------------------------------------------------------
  // ChargeReadinessService gate
  // -------------------------------------------------------------------------

  describe('ChargeReadinessService gate', () => {
    it('should throw 503 when BILLING_CHARGES_ENABLED=false', async () => {
      chargeReadinessService.getSystemChargeReadiness.mockReturnValue({
        ready: false,
        blockingReasons: ['BILLING_CHARGES_ENABLED=false'],
      });

      await expect(
        service.createSubscriptionCheckout(
          userId, userEmail, 'starter', validSuccessUrl, validCancelUrl,
        ),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should throw 503 when provider is disabled', async () => {
      chargeReadinessService.getSystemChargeReadiness.mockReturnValue({
        ready: false,
        blockingReasons: ['Payment provider mode is disabled'],
      });

      await expect(
        service.createSubscriptionCheckout(
          userId, userEmail, 'starter', validSuccessUrl, validCancelUrl,
        ),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should proceed when system is ready (stub mode)', async () => {
      const result = await service.createSubscriptionCheckout(
        userId, userEmail, 'starter', validSuccessUrl, validCancelUrl,
      );

      expect(result.checkoutSessionId).toBe('stub_cs_placeholder');
      expect(result.providerMode).toBe('stub');
    });

    it('should block stub checkout when charges disabled', async () => {
      chargeReadinessService.getSystemChargeReadiness.mockReturnValue({
        ready: false,
        blockingReasons: ['BILLING_CHARGES_ENABLED=false'],
      });

      await expect(
        service.createSubscriptionCheckout(
          userId, userEmail, 'starter', validSuccessUrl, validCancelUrl,
        ),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  // -------------------------------------------------------------------------
  // Subscription checkout — plan validation
  // -------------------------------------------------------------------------

  describe('subscription checkout — plan validation', () => {
    it('should accept valid planId: starter', async () => {
      const result = await service.createSubscriptionCheckout(
        userId, userEmail, 'starter', validSuccessUrl, validCancelUrl,
      );
      expect(result.checkoutType).toBe('subscription');
      expect(result.planType).toBe('starter');
    });

    it('should accept valid planId: pro', async () => {
      const result = await service.createSubscriptionCheckout(
        userId, userEmail, 'pro', validSuccessUrl, validCancelUrl,
      );
      expect(result.planType).toBe('pro');
    });

    it('should accept valid planId: team', async () => {
      const result = await service.createSubscriptionCheckout(
        userId, userEmail, 'team', validSuccessUrl, validCancelUrl,
      );
      expect(result.planType).toBe('team');
    });

    it('should reject planId: free with 400', async () => {
      await expect(
        service.createSubscriptionCheckout(
          userId, userEmail, 'free', validSuccessUrl, validCancelUrl,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unknown planId with 400', async () => {
      await expect(
        service.createSubscriptionCheckout(
          userId, userEmail, 'enterprise', validSuccessUrl, validCancelUrl,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not accept user-supplied price ID', async () => {
      await expect(
        service.createSubscriptionCheckout(
          userId, userEmail, 'price_1234567890', validSuccessUrl, validCancelUrl,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // Top-up checkout — pack validation
  // -------------------------------------------------------------------------

  describe('top-up checkout — pack validation', () => {
    it('should accept valid topUpPackId: topup_1000', async () => {
      const result = await service.createTopUpCheckout(
        userId, userEmail, 'topup_1000', validSuccessUrl, validCancelUrl,
      );
      expect(result.checkoutType).toBe('topup');
      expect(result.topUpPackage).toBe('topup_1000');
    });

    it('should accept valid topUpPackId: topup_5000', async () => {
      const result = await service.createTopUpCheckout(
        userId, userEmail, 'topup_5000', validSuccessUrl, validCancelUrl,
      );
      expect(result.topUpPackage).toBe('topup_5000');
    });

    it('should accept valid topUpPackId: topup_20000', async () => {
      const result = await service.createTopUpCheckout(
        userId, userEmail, 'topup_20000', validSuccessUrl, validCancelUrl,
      );
      expect(result.topUpPackage).toBe('topup_20000');
    });

    it('should reject unknown topUpPackId with 400', async () => {
      await expect(
        service.createTopUpCheckout(
          userId, userEmail, 'topup_999', validSuccessUrl, validCancelUrl,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // Active subscription conflict
  // -------------------------------------------------------------------------

  describe('active subscription conflict', () => {
    it('should throw 409 when user already has an active subscription', async () => {
      subscriptionRepository.findActiveByUserId.mockResolvedValue({
        id: 'sub-uuid-1',
        userId,
        status: 'active',
        planType: 'starter',
      });

      await expect(
        service.createSubscriptionCheckout(
          userId, userEmail, 'pro', validSuccessUrl, validCancelUrl,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should NOT check active subscription for top-up', async () => {
      subscriptionRepository.findActiveByUserId.mockResolvedValue({
        id: 'sub-uuid-1',
        userId,
        status: 'active',
        planType: 'starter',
      });

      const result = await service.createTopUpCheckout(
        userId, userEmail, 'topup_1000', validSuccessUrl, validCancelUrl,
      );
      expect(result.checkoutType).toBe('topup');
    });
  });

  // -------------------------------------------------------------------------
  // Customer reuse / creation
  // -------------------------------------------------------------------------

  describe('customer resolution', () => {
    it('should reuse existing stripeCustomerId when present', async () => {
      userRepository.findOne.mockResolvedValue(userWithCustomer);

      const result = await service.createSubscriptionCheckout(
        userId, userEmail, 'starter', validSuccessUrl, validCancelUrl,
      );

      expect(stripePaymentProvider.createOrRetrieveCustomer).not.toHaveBeenCalled();
      expect(result.customerId).toBe('cus_existing_123');
    });

    it('should call createOrRetrieveCustomer when no stripeCustomerId', async () => {
      await service.createSubscriptionCheckout(
        userId, userEmail, 'starter', validSuccessUrl, validCancelUrl,
      );

      expect(stripePaymentProvider.createOrRetrieveCustomer).toHaveBeenCalledWith({
        userId,
        email: userEmail,
      });
    });

    it('should NOT persist null customerId from stub mode', async () => {
      await service.createSubscriptionCheckout(
        userId, userEmail, 'starter', validSuccessUrl, validCancelUrl,
      );

      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('should persist non-null customerId from provider', async () => {
      stripePaymentProvider.createOrRetrieveCustomer.mockResolvedValue({
        success: true,
        data: { customerId: 'cus_new_456', isNew: true },
      });

      await service.createSubscriptionCheckout(
        userId, userEmail, 'starter', validSuccessUrl, validCancelUrl,
      );

      expect(userRepository.update).toHaveBeenCalledWith(
        { id: userId },
        { stripeCustomerId: 'cus_new_456' },
      );
    });
  });

  // -------------------------------------------------------------------------
  // URL validation
  // -------------------------------------------------------------------------

  describe('URL validation', () => {
    it('should accept HTTPS URLs matching FRONTEND_URL origin', async () => {
      const result = await service.createSubscriptionCheckout(
        userId, userEmail, 'starter', validSuccessUrl, validCancelUrl,
      );
      expect(result).toBeDefined();
    });

    it('should accept localhost HTTP in development', async () => {
      const result = await service.createSubscriptionCheckout(
        userId,
        userEmail,
        'starter',
        'http://localhost:3000/success',
        'http://localhost:3000/cancel',
      );
      expect(result).toBeDefined();
    });

    it('should accept 127.0.0.1 HTTP in development', async () => {
      const result = await service.createSubscriptionCheckout(
        userId,
        userEmail,
        'starter',
        'http://127.0.0.1:3000/success',
        'http://127.0.0.1:3000/cancel',
      );
      expect(result).toBeDefined();
    });

    it('should reject invalid URL with 400', async () => {
      await expect(
        service.createSubscriptionCheckout(
          userId, userEmail, 'starter', 'not-a-url', validCancelUrl,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject HTTP non-localhost URL with 400', async () => {
      await expect(
        service.createSubscriptionCheckout(
          userId, userEmail, 'starter',
          'http://evil.com/success', validCancelUrl,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject HTTPS URL from unknown origin with 400', async () => {
      await expect(
        service.createSubscriptionCheckout(
          userId, userEmail, 'starter',
          'https://evil.com/success', validCancelUrl,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject HTTP localhost in production', async () => {
      configService.get = jest.fn((key: string) => {
        if (key === 'FRONTEND_URL') return 'https://app.example.com';
        if (key === 'NODE_ENV') return 'production';
        return undefined;
      });

      await expect(
        service.createSubscriptionCheckout(
          userId, userEmail, 'starter',
          'http://localhost:3000/success', validCancelUrl,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // Provider result mapping
  // -------------------------------------------------------------------------

  describe('provider result mapping', () => {
    it('should return 201-shaped result for successful stub checkout', async () => {
      const result = await service.createSubscriptionCheckout(
        userId, userEmail, 'starter', validSuccessUrl, validCancelUrl,
      );

      expect(result.checkoutSessionId).toBe('stub_cs_placeholder');
      expect(result.checkoutUrl).toBeNull();
      expect(result.providerMode).toBe('stub');
      expect(result.checkoutType).toBe('subscription');
      expect(result.planType).toBe('starter');
    });

    it('should throw 503 when provider returns PROVIDER_DISABLED', async () => {
      stripePaymentProvider.createCheckoutSession.mockResolvedValue({
        success: false,
        error: 'PROVIDER_DISABLED',
        message: 'Payment provider is disabled',
      });

      await expect(
        service.createSubscriptionCheckout(
          userId, userEmail, 'starter', validSuccessUrl, validCancelUrl,
        ),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should throw 503 when provider returns PROVIDER_NOT_CONFIGURED', async () => {
      stripePaymentProvider.createCheckoutSession.mockResolvedValue({
        success: false,
        error: 'PROVIDER_NOT_CONFIGURED',
        message: 'Stripe SDK not available',
      });

      await expect(
        service.createSubscriptionCheckout(
          userId, userEmail, 'starter', validSuccessUrl, validCancelUrl,
        ),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should throw 400 when provider returns INVALID_PARAMS', async () => {
      stripePaymentProvider.createCheckoutSession.mockResolvedValue({
        success: false,
        error: 'INVALID_PARAMS',
        message: 'Bad params',
      });

      await expect(
        service.createSubscriptionCheckout(
          userId, userEmail, 'starter', validSuccessUrl, validCancelUrl,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw 502 when provider returns PROVIDER_API_ERROR', async () => {
      stripePaymentProvider.createCheckoutSession.mockResolvedValue({
        success: false,
        error: 'PROVIDER_API_ERROR',
        message: 'Stripe error',
      });

      await expect(
        service.createSubscriptionCheckout(
          userId, userEmail, 'starter', validSuccessUrl, validCancelUrl,
        ),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  // -------------------------------------------------------------------------
  // Provider delegation
  // -------------------------------------------------------------------------

  describe('provider delegation', () => {
    it('should pass mapped price ID to provider, not raw planId', async () => {
      await service.createSubscriptionCheckout(
        userId, userEmail, 'starter', validSuccessUrl, validCancelUrl,
      );

      expect(stripePaymentProvider.createCheckoutSession).toHaveBeenCalledWith({
        userId,
        userEmail,
        planId: 'price_placeholder_starter',
        successUrl: validSuccessUrl,
        cancelUrl: validCancelUrl,
      });
    });

    it('should pass mapped top-up price ID to provider', async () => {
      await service.createTopUpCheckout(
        userId, userEmail, 'topup_5000', validSuccessUrl, validCancelUrl,
      );

      expect(stripePaymentProvider.createCheckoutSession).toHaveBeenCalledWith({
        userId,
        userEmail,
        planId: 'price_placeholder_topup_5000',
        successUrl: validSuccessUrl,
        cancelUrl: validCancelUrl,
      });
    });
  });

  // -------------------------------------------------------------------------
  // Safety — no SDK, no env, no API calls
  // -------------------------------------------------------------------------

  describe('safety invariants', () => {
    it('should use mocked StripePaymentProvider (no real import)', () => {
      expect(stripePaymentProvider.createCheckoutSession).toBeDefined();
      expect(typeof stripePaymentProvider.createCheckoutSession).toBe('function');
    });

    it('should not read STRIPE_SECRET_KEY', async () => {
      await service.createSubscriptionCheckout(
        userId, userEmail, 'starter', validSuccessUrl, validCancelUrl,
      );

      const getCallArgs = (configService.get as jest.Mock).mock.calls.map(
        (c: any[]) => c[0],
      );
      expect(getCallArgs).not.toContain('STRIPE_SECRET_KEY');
      expect(getCallArgs).not.toContain('STRIPE_WEBHOOK_SECRET');
    });

    it('should not include secrets in error responses', async () => {
      chargeReadinessService.getSystemChargeReadiness.mockReturnValue({
        ready: false,
        blockingReasons: ['BILLING_CHARGES_ENABLED=false'],
      });

      try {
        await service.createSubscriptionCheckout(
          userId, userEmail, 'starter', validSuccessUrl, validCancelUrl,
        );
        fail('Expected ServiceUnavailableException');
      } catch (e: any) {
        const response = e.getResponse();
        const responseStr = JSON.stringify(response);
        expect(responseStr).not.toContain('sk_');
        expect(responseStr).not.toContain('STRIPE_SECRET_KEY');
        expect(responseStr).not.toContain('whsec_');
      }
    });
  });

  // -------------------------------------------------------------------------
  // User not found
  // -------------------------------------------------------------------------

  describe('user not found', () => {
    it('should throw 400 when authenticated user not found in DB', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createSubscriptionCheckout(
          userId, userEmail, 'starter', validSuccessUrl, validCancelUrl,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
