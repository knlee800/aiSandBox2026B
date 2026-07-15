import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  BadGatewayException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StripePaymentProvider } from '../../payments/providers/stripe-payment.provider';
import { ChargeReadinessService } from '../../admin/charge-readiness.service';
import { SubscriptionRepository } from '../subscription/subscription.repository';
import { User } from '../../entities/user.entity';
import { validateCheckoutUrl } from './checkout-url.validator';
import {
  CHECKOUT_PLAN_PRICE_MAP,
  TOP_UP_PACK_MAP,
} from './config/checkout-price-map.config';
import type { CheckoutSessionResponseDto } from './dto/checkout-session-response.dto';

/**
 * BILLING-READY-05C: Checkout consumer service.
 *
 * Responsibility:
 * 1. Input validation (plan/pack allowlist, URL validation)
 * 2. ChargeReadinessService gate
 * 3. Customer resolution (reuse existing or delegate creation to provider)
 * 4. Provider delegation (createCheckoutSession via StripePaymentProvider)
 * 5. Result mapping to response DTO
 *
 * No Stripe SDK. No provider API calls. No env/secrets changes.
 * Calls existing StripePaymentProvider interface methods only.
 */
@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly stripePaymentProvider: StripePaymentProvider,
    private readonly chargeReadinessService: ChargeReadinessService,
    private readonly subscriptionRepository: SubscriptionRepository,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create a subscription checkout session.
   */
  async createSubscriptionCheckout(
    userId: string,
    userEmail: string,
    planId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<CheckoutSessionResponseDto> {
    const planEntry = CHECKOUT_PLAN_PRICE_MAP[planId];
    if (!planEntry) {
      throw new BadRequestException({
        error: 'INVALID_PLAN',
        message: `Invalid plan: ${planId}`,
      });
    }

    validateCheckoutUrl(successUrl, 'successUrl', this.configService);
    validateCheckoutUrl(cancelUrl, 'cancelUrl', this.configService);

    this.assertSystemReady();

    const existingSub =
      await this.subscriptionRepository.findActiveByUserId(userId);
    if (existingSub) {
      throw new ConflictException({
        error: 'SUBSCRIPTION_ALREADY_ACTIVE',
        message:
          'User already has an active subscription. Cancel or let it expire before subscribing to a new plan.',
      });
    }

    const customerId = await this.resolveCustomerId(userId, userEmail);

    const providerResult =
      await this.stripePaymentProvider.createCheckoutSession({
        userId,
        userEmail,
        planId: planEntry.stripePriceId,
        successUrl,
        cancelUrl,
      });

    return this.mapProviderResult(
      providerResult,
      'subscription',
      planId,
      undefined,
      customerId,
    );
  }

  /**
   * Create a credit top-up checkout session.
   */
  async createTopUpCheckout(
    userId: string,
    userEmail: string,
    topUpPackId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<CheckoutSessionResponseDto> {
    const packEntry = TOP_UP_PACK_MAP[topUpPackId];
    if (!packEntry) {
      throw new BadRequestException({
        error: 'INVALID_TOPUP_PACK',
        message: `Invalid top-up pack: ${topUpPackId}`,
      });
    }

    validateCheckoutUrl(successUrl, 'successUrl', this.configService);
    validateCheckoutUrl(cancelUrl, 'cancelUrl', this.configService);

    this.assertSystemReady();

    const customerId = await this.resolveCustomerId(userId, userEmail);

    const providerResult =
      await this.stripePaymentProvider.createCheckoutSession({
        userId,
        userEmail,
        planId: packEntry.stripePriceId,
        successUrl,
        cancelUrl,
      });

    return this.mapProviderResult(
      providerResult,
      'topup',
      undefined,
      topUpPackId,
      customerId,
    );
  }

  // ---------------------------------------------------------------------------
  // Gate
  // ---------------------------------------------------------------------------

  private assertSystemReady(): void {
    const readiness =
      this.chargeReadinessService.getSystemChargeReadiness();
    if (!readiness.ready) {
      this.logger.warn(
        `Checkout blocked — system not ready: ${readiness.blockingReasons.join(', ')}`,
      );
      throw new ServiceUnavailableException({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Payment system is not available',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Customer resolution
  // ---------------------------------------------------------------------------

  private async resolveCustomerId(
    userId: string,
    userEmail: string,
  ): Promise<string | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException({
        error: 'USER_NOT_FOUND',
        message: 'Authenticated user not found',
      });
    }

    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customerResult =
      await this.stripePaymentProvider.createOrRetrieveCustomer({
        userId,
        email: userEmail,
      });

    if (!customerResult.success) {
      this.logger.warn(
        `Customer resolution failed for user ${userId}: ${customerResult.error}`,
      );
      return null;
    }

    const newCustomerId = customerResult.data?.customerId ?? null;

    if (newCustomerId) {
      await this.userRepository.update(
        { id: userId },
        { stripeCustomerId: newCustomerId },
      );
      this.logger.log(
        `Persisted stripeCustomerId for user ${userId}`,
      );
    }

    return newCustomerId;
  }

  // ---------------------------------------------------------------------------
  // Result mapping
  // ---------------------------------------------------------------------------

  private mapProviderResult(
    result: import('../../payments/interfaces/payment-provider.interface').ProviderResult<
      import('../../payments/interfaces/payment-provider.interface').CheckoutSessionResult
    >,
    checkoutType: 'subscription' | 'topup',
    planType?: string,
    topUpPackage?: string,
    customerId?: string | null,
  ): CheckoutSessionResponseDto {
    if (!result.success) {
      switch (result.error) {
        case 'PROVIDER_DISABLED':
          throw new ServiceUnavailableException({
            error: 'SERVICE_UNAVAILABLE',
            message: 'Payment system is not available',
          });
        case 'PROVIDER_NOT_CONFIGURED':
          throw new ServiceUnavailableException({
            error: 'SERVICE_UNAVAILABLE',
            message: 'Payment provider is not configured',
          });
        case 'INVALID_PARAMS':
          throw new BadRequestException({
            error: 'INVALID_PARAMS',
            message: result.message ?? 'Invalid checkout parameters',
          });
        case 'PROVIDER_API_ERROR':
          throw new BadGatewayException({
            error: 'PROVIDER_ERROR',
            message: 'Payment provider encountered an error',
          });
        default:
          throw new ServiceUnavailableException({
            error: 'SERVICE_UNAVAILABLE',
            message: 'Payment system encountered an unexpected error',
          });
      }
    }

    const mode = this.stripePaymentProvider.getProviderMode();

    const response: CheckoutSessionResponseDto = {
      checkoutSessionId: result.data?.sessionId ?? null,
      checkoutUrl: result.data?.url ?? null,
      providerMode: mode,
      checkoutType,
    };

    if (planType !== undefined) {
      response.planType = planType;
    }
    if (topUpPackage !== undefined) {
      response.topUpPackage = topUpPackage;
    }
    if (customerId !== undefined) {
      response.customerId = customerId;
    }

    return response;
  }
}
