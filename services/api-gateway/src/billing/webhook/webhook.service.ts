import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { StripePaymentProvider } from '../../payments/providers/stripe-payment.provider';
import { SubscriptionRepository } from '../subscription/subscription.repository';
import { WebhookEventRepository } from './webhook-event.repository';
import { User } from '../../entities/user.entity';
import type { InternalEventType } from '../../payments/interfaces/payment-provider.interface';

/**
 * Webhook processing result returned to the controller.
 */
export interface WebhookProcessingResult {
  received: boolean;
  duplicate?: boolean;
  status?: string;
}

/**
 * Stripe subscription status → local subscription status mapping.
 * Stripe uses American English 'canceled'; we normalize to British 'cancelled'.
 */
const STRIPE_STATUS_MAP: Record<string, string> = {
  active: 'active',
  trialing: 'trialing',
  past_due: 'past_due',
  canceled: 'cancelled',
  unpaid: 'unpaid',
  incomplete_expired: 'expired',
};

/**
 * BILLING-READY-05D: Webhook ingestion service.
 *
 * Responsibility:
 * 1. Signature verification via StripePaymentProvider
 * 2. Event parsing via StripePaymentProvider
 * 3. Idempotency check via WebhookEventRepository
 * 4. Event routing to subscription/user update handlers
 * 5. Event status persistence
 *
 * No Stripe SDK. No provider API calls. No credit balance mutations.
 * Uses existing 05A provider webhook contracts and 05B persistence.
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly stripePaymentProvider: StripePaymentProvider,
    private readonly webhookEventRepository: WebhookEventRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Process an inbound Stripe webhook event.
   *
   * Flow:
   * 1. Verify signature
   * 2. Parse event
   * 3. Record event (idempotency check)
   * 4. Map event type
   * 5. Route to handler
   * 6. Update event status
   */
  async processWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<WebhookProcessingResult> {
    const payloadHash = createHash('sha256').update(rawBody).digest('hex');

    // 1. Verify signature
    const verifyResult = this.stripePaymentProvider.verifyWebhookSignature(
      rawBody,
      signature,
    );

    if (!verifyResult.success) {
      this.logger.warn(
        `Webhook signature verification failed: ${verifyResult.error}`,
      );
      throw new WebhookVerificationError(
        verifyResult.error ?? 'SIGNATURE_INVALID',
        verifyResult.message ?? 'Signature verification failed',
      );
    }

    // 2. Parse event
    const parseResult = this.stripePaymentProvider.parseWebhookEvent(
      rawBody,
      signature,
    );

    if (!parseResult.success || !parseResult.data) {
      this.logger.warn(
        `Webhook event parse failed: ${parseResult.error}`,
      );
      throw new WebhookVerificationError(
        parseResult.error ?? 'EVENT_PARSE_ERROR',
        parseResult.message ?? 'Event parsing failed',
      );
    }

    const parsed = parseResult.data;
    const mapped = this.stripePaymentProvider.mapEventType(parsed.eventType);

    // 3. Idempotency check
    const existingEvent = await this.webhookEventRepository.findByProviderEventId(
      'stripe',
      parsed.eventId,
    );

    if (existingEvent) {
      await this.webhookEventRepository.incrementAttempts(existingEvent.id);
      this.logger.log(
        `Duplicate webhook event ${parsed.eventId} (attempt ${existingEvent.attempts + 1}), skipping`,
      );
      return { received: true, duplicate: true };
    }

    // 4. Record new event
    const webhookEvent = await this.webhookEventRepository.createEvent({
      providerEventId: parsed.eventId,
      provider: 'stripe',
      eventType: parsed.eventType,
      internalEventType: mapped?.internal ?? null,
      payloadHash,
    });

    // Mark verified
    await this.webhookEventRepository.updateEventStatus(
      webhookEvent.id,
      'verified',
    );

    // 5. Route based on mapped event type
    if (!mapped) {
      await this.webhookEventRepository.updateEventStatus(
        webhookEvent.id,
        'ignored',
        'Unknown event type',
        'UNKNOWN_EVENT_TYPE',
      );
      this.logger.log(
        `Ignored unknown webhook event type: ${parsed.eventType}`,
      );
      return { received: true, status: 'ignored' };
    }

    // Mark processing
    await this.webhookEventRepository.updateEventStatus(
      webhookEvent.id,
      'processing',
    );

    try {
      await this.routeEvent(mapped.internal, parsed.data, webhookEvent.id);
      await this.webhookEventRepository.updateEventStatus(
        webhookEvent.id,
        'processed',
      );
      return { received: true, status: 'processed' };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown processing error';
      const errorCode =
        error instanceof WebhookProcessingError
          ? error.code
          : 'PROCESSING_ERROR';
      this.logger.error(
        `Webhook processing failed for ${parsed.eventId}: ${errorMessage}`,
      );
      await this.webhookEventRepository.updateEventStatus(
        webhookEvent.id,
        'failed',
        errorMessage,
        errorCode,
      );
      return { received: true, status: 'failed' };
    }
  }

  // ---------------------------------------------------------------------------
  // Event routing
  // ---------------------------------------------------------------------------

  private async routeEvent(
    internalType: InternalEventType,
    data: Record<string, unknown>,
    _eventId: string,
  ): Promise<void> {
    switch (internalType) {
      case 'checkout_completed':
        await this.handleCheckoutCompleted(data);
        break;
      case 'subscription_created':
        await this.handleSubscriptionCreated(data);
        break;
      case 'subscription_updated':
        await this.handleSubscriptionUpdated(data);
        break;
      case 'subscription_deleted':
        await this.handleSubscriptionDeleted(data);
        break;
      case 'invoice_paid':
        await this.handleInvoicePaid(data);
        break;
      case 'invoice_payment_failed':
        await this.handleInvoicePaymentFailed(data);
        break;
      default:
        this.logger.warn(`No handler for internal event type: ${internalType}`);
    }
  }

  // ---------------------------------------------------------------------------
  // checkout_completed
  // ---------------------------------------------------------------------------

  private async handleCheckoutCompleted(
    data: Record<string, unknown>,
  ): Promise<void> {
    const mode = data.mode as string | undefined;

    // Top-up checkouts (mode = 'payment') are deferred to 05E
    if (mode === 'payment') {
      this.logger.log(
        'Top-up checkout completed — credit grant deferred to 05E',
      );
      return;
    }

    const subscriptionId = data.subscription as string | undefined;
    const customerId = data.customer as string | undefined;

    if (!customerId) {
      throw new WebhookProcessingError(
        'UNKNOWN_CUSTOMER',
        'checkout_completed event missing customer field',
      );
    }

    const user = await this.findUserByCustomerId(customerId);

    if (subscriptionId) {
      const existing =
        await this.subscriptionRepository.findByStripeSubscriptionId(
          subscriptionId,
        );
      if (!existing) {
        await this.subscriptionRepository.createSubscription({
          userId: user.id,
          stripeSubscriptionId: subscriptionId,
          stripePriceId: (data.stripe_price_id as string) ?? null,
          planType: this.resolvePlanType(data),
          status: 'active',
          currentPeriodStart: this.toDate(data.current_period_start),
          currentPeriodEnd: this.toDate(data.current_period_end),
        });
      }
    }

    await this.updateUserPlan(user.id, this.resolvePlanType(data), 'active');
  }

  // ---------------------------------------------------------------------------
  // subscription_created
  // ---------------------------------------------------------------------------

  private async handleSubscriptionCreated(
    data: Record<string, unknown>,
  ): Promise<void> {
    const subscriptionId = data.id as string | undefined;
    const customerId = data.customer as string | undefined;

    if (!subscriptionId) {
      throw new WebhookProcessingError(
        'PROCESSING_ERROR',
        'subscription_created event missing subscription id',
      );
    }
    if (!customerId) {
      throw new WebhookProcessingError(
        'UNKNOWN_CUSTOMER',
        'subscription_created event missing customer field',
      );
    }

    const user = await this.findUserByCustomerId(customerId);

    const existing =
      await this.subscriptionRepository.findByStripeSubscriptionId(
        subscriptionId,
      );
    if (existing) {
      this.logger.log(
        `Subscription ${subscriptionId} already exists, skipping create`,
      );
      return;
    }

    const stripeStatus = (data.status as string) ?? 'active';
    const localStatus = STRIPE_STATUS_MAP[stripeStatus] ?? 'active';

    await this.subscriptionRepository.createSubscription({
      userId: user.id,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: this.extractPriceId(data),
      planType: this.resolvePlanType(data),
      status: localStatus,
      currentPeriodStart: this.toDate(data.current_period_start),
      currentPeriodEnd: this.toDate(data.current_period_end),
    });

    await this.updateUserPlan(user.id, this.resolvePlanType(data), localStatus);
  }

  // ---------------------------------------------------------------------------
  // subscription_updated
  // ---------------------------------------------------------------------------

  private async handleSubscriptionUpdated(
    data: Record<string, unknown>,
  ): Promise<void> {
    const subscriptionId = data.id as string | undefined;
    const customerId = data.customer as string | undefined;

    if (!subscriptionId) {
      throw new WebhookProcessingError(
        'PROCESSING_ERROR',
        'subscription_updated event missing subscription id',
      );
    }
    if (!customerId) {
      throw new WebhookProcessingError(
        'UNKNOWN_CUSTOMER',
        'subscription_updated event missing customer field',
      );
    }

    await this.findUserByCustomerId(customerId);

    const existing =
      await this.subscriptionRepository.findByStripeSubscriptionId(
        subscriptionId,
      );
    if (!existing) {
      throw new WebhookProcessingError(
        'SUBSCRIPTION_NOT_FOUND',
        `Subscription ${subscriptionId} not found for update`,
      );
    }

    const stripeStatus = (data.status as string) ?? existing.status;
    const localStatus = STRIPE_STATUS_MAP[stripeStatus] ?? existing.status;

    const updates: Record<string, unknown> = {
      status: localStatus,
    };

    if (data.current_period_start !== undefined) {
      updates.currentPeriodStart = this.toDate(data.current_period_start);
    }
    if (data.current_period_end !== undefined) {
      updates.currentPeriodEnd = this.toDate(data.current_period_end);
    }

    const cancelAtPeriodEnd = data.cancel_at_period_end;
    if (cancelAtPeriodEnd !== undefined) {
      updates.cancelAtPeriodEnd = !!cancelAtPeriodEnd;
      if (cancelAtPeriodEnd) {
        updates.cancelAt = data.cancel_at
          ? this.toDate(data.cancel_at)
          : null;
      } else {
        updates.cancelAt = null;
      }
    }

    const priceid = this.extractPriceId(data);
    if (priceid) {
      updates.stripePriceId = priceid;
    }

    await this.subscriptionRepository.updateSubscription(
      existing.id,
      updates as any,
    );

    const user = await this.findUserByCustomerId(customerId);
    await this.updateUserPlan(
      user.id,
      this.resolvePlanType(data) || existing.planType,
      localStatus,
    );
  }

  // ---------------------------------------------------------------------------
  // subscription_deleted
  // ---------------------------------------------------------------------------

  private async handleSubscriptionDeleted(
    data: Record<string, unknown>,
  ): Promise<void> {
    const subscriptionId = data.id as string | undefined;
    const customerId = data.customer as string | undefined;

    if (!subscriptionId) {
      throw new WebhookProcessingError(
        'PROCESSING_ERROR',
        'subscription_deleted event missing subscription id',
      );
    }
    if (!customerId) {
      throw new WebhookProcessingError(
        'UNKNOWN_CUSTOMER',
        'subscription_deleted event missing customer field',
      );
    }

    const user = await this.findUserByCustomerId(customerId);

    const existing =
      await this.subscriptionRepository.findByStripeSubscriptionId(
        subscriptionId,
      );
    if (!existing) {
      throw new WebhookProcessingError(
        'SUBSCRIPTION_NOT_FOUND',
        `Subscription ${subscriptionId} not found for deletion`,
      );
    }

    await this.subscriptionRepository.updateSubscription(existing.id, {
      status: 'cancelled',
      cancelledAt: new Date(),
    });

    await this.updateUserPlan(user.id, 'free', 'cancelled');
  }

  // ---------------------------------------------------------------------------
  // invoice_paid
  // ---------------------------------------------------------------------------

  private async handleInvoicePaid(
    data: Record<string, unknown>,
  ): Promise<void> {
    const subscriptionId = data.subscription as string | undefined;

    if (!subscriptionId) {
      // Non-subscription invoice (e.g., one-time payment / top-up) — deferred to 05E
      this.logger.log(
        'invoice_paid without subscription — top-up credit grant deferred to 05E',
      );
      return;
    }

    const existing =
      await this.subscriptionRepository.findByStripeSubscriptionId(
        subscriptionId,
      );
    if (!existing) {
      throw new WebhookProcessingError(
        'SUBSCRIPTION_NOT_FOUND',
        `Subscription ${subscriptionId} not found for invoice_paid`,
      );
    }

    const updates: Record<string, unknown> = {};
    if (data.current_period_start !== undefined) {
      updates.currentPeriodStart = this.toDate(data.current_period_start);
    }
    if (data.current_period_end !== undefined) {
      updates.currentPeriodEnd = this.toDate(data.current_period_end);
    }

    // Paid invoice implies active status (renewal success)
    if (data.status === 'paid') {
      updates.status = 'active';
    }

    if (Object.keys(updates).length > 0) {
      await this.subscriptionRepository.updateSubscription(
        existing.id,
        updates as any,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // invoice_payment_failed
  // ---------------------------------------------------------------------------

  private async handleInvoicePaymentFailed(
    data: Record<string, unknown>,
  ): Promise<void> {
    const subscriptionId = data.subscription as string | undefined;

    if (!subscriptionId) {
      this.logger.log(
        'invoice_payment_failed without subscription — ignoring',
      );
      return;
    }

    const existing =
      await this.subscriptionRepository.findByStripeSubscriptionId(
        subscriptionId,
      );
    if (!existing) {
      throw new WebhookProcessingError(
        'SUBSCRIPTION_NOT_FOUND',
        `Subscription ${subscriptionId} not found for invoice_payment_failed`,
      );
    }

    await this.subscriptionRepository.updateSubscription(existing.id, {
      status: 'past_due',
    });

    const customerId = data.customer as string | undefined;
    if (customerId) {
      try {
        const user = await this.findUserByCustomerId(customerId);
        await this.updateUserPlan(user.id, existing.planType, 'past_due');
      } catch {
        this.logger.warn(
          `Could not update user plan status for invoice_payment_failed — customer ${customerId} not found`,
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async findUserByCustomerId(customerId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { stripeCustomerId: customerId },
    });
    if (!user) {
      throw new WebhookProcessingError(
        'UNKNOWN_CUSTOMER',
        `No user found with stripeCustomerId: ${customerId}`,
      );
    }
    return user;
  }

  private async updateUserPlan(
    userId: string,
    planType: string,
    planStatus: string,
  ): Promise<void> {
    await this.userRepository.update({ id: userId }, { planType, planStatus });
  }

  private toDate(
    value: unknown,
  ): Date {
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value * 1000);
    return new Date();
  }

  private resolvePlanType(data: Record<string, unknown>): string {
    if (typeof data.plan_type === 'string') return data.plan_type;
    if (typeof data.metadata === 'object' && data.metadata !== null) {
      const meta = data.metadata as Record<string, unknown>;
      if (typeof meta.aisandbox_plan_id === 'string') {
        return meta.aisandbox_plan_id;
      }
    }
    return 'starter';
  }

  private extractPriceId(data: Record<string, unknown>): string | null {
    if (typeof data.stripe_price_id === 'string') return data.stripe_price_id;
    if (typeof data.plan === 'object' && data.plan !== null) {
      const plan = data.plan as Record<string, unknown>;
      if (typeof plan.id === 'string') return plan.id;
    }
    if (typeof data.items === 'object' && data.items !== null) {
      const items = data.items as { data?: Array<{ price?: { id?: string } }> };
      if (items.data?.[0]?.price?.id) return items.data[0].price.id;
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class WebhookVerificationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}

export class WebhookProcessingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'WebhookProcessingError';
  }
}
