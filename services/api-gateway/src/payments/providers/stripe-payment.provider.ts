import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentProvider,
  ProviderMode,
  VALID_PROVIDER_MODES,
  ProviderResult,
  ProviderErrorCode,
  InvoicePreview,
  ProviderInvoiceContext,
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
} from '../interfaces/payment-provider.interface';

/**
 * Stripe event type → internal event type mapping.
 * Pure static mapping — works in any mode.
 */
const STRIPE_EVENT_TYPE_MAP: Record<string, InternalEventType> = {
  'checkout.session.completed': 'checkout_completed',
  'customer.subscription.created': 'subscription_created',
  'customer.subscription.updated': 'subscription_updated',
  'customer.subscription.deleted': 'subscription_deleted',
  'invoice.paid': 'invoice_paid',
  'invoice.payment_failed': 'invoice_payment_failed',
};

/**
 * StripePaymentProvider (BILLING-READY-05A)
 *
 * Mode-aware payment provider — replaces Task 10B2 stub.
 *
 * Modes:
 *  - disabled: provider is off, all operations return PROVIDER_DISABLED
 *  - stub:     returns deterministic placeholder data (development use)
 *  - test:     contract-ready but no SDK calls in 05A (deferred to 05C)
 *  - live:     contract-ready but no SDK calls in 05A (deferred to 05C)
 *
 * No Stripe SDK. No provider API calls. No secrets in results.
 */
@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(StripePaymentProvider.name);
  private readonly resolvedMode: ProviderMode;

  constructor(private readonly configService: ConfigService) {
    this.resolvedMode = this.resolveMode(
      this.configService.get<string>('STRIPE_PROVIDER_MODE'),
    );
    this.logger.log(`Provider mode resolved: ${this.resolvedMode}`);
  }

  // ---------------------------------------------------------------------------
  // Mode Resolution
  // ---------------------------------------------------------------------------

  private resolveMode(raw: string | undefined): ProviderMode {
    const trimmed = (raw ?? '').trim().toLowerCase();

    if (!trimmed) {
      return 'disabled';
    }

    if (!VALID_PROVIDER_MODES.includes(trimmed as ProviderMode)) {
      this.logger.warn(
        `Invalid STRIPE_PROVIDER_MODE '${trimmed}', degrading to disabled`,
      );
      return 'disabled';
    }

    const candidate = trimmed as ProviderMode;

    if (candidate === 'test' || candidate === 'live') {
      const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
      if (!secretKey) {
        this.logger.error(
          `STRIPE_SECRET_KEY not set for '${candidate}' mode — degrading to disabled`,
        );
        return 'disabled';
      }

      // Key prefix / mode mismatch detection
      if (candidate === 'test' && secretKey.startsWith('sk_live_')) {
        this.logger.error(
          'Mode is test but STRIPE_SECRET_KEY is a live key — degrading to disabled to prevent accidental live charges',
        );
        return 'disabled';
      }
    }

    return candidate;
  }

  // ---------------------------------------------------------------------------
  // Identity & Mode
  // ---------------------------------------------------------------------------

  getProviderName(): string {
    return 'stripe';
  }

  getProviderMode(): ProviderMode {
    return this.resolvedMode;
  }

  // ---------------------------------------------------------------------------
  // Legacy — prepareInvoice (Task 10B2 compatibility)
  // ---------------------------------------------------------------------------

  prepareInvoice(_invoice: InvoicePreview): ProviderInvoiceContext {
    return {
      provider: 'stripe',
      externalCustomerId: null,
      externalInvoiceId: null,
      status: 'not_sent',
    };
  }

  // ---------------------------------------------------------------------------
  // Configuration Validation
  // ---------------------------------------------------------------------------

  validateConfiguration(): boolean {
    switch (this.resolvedMode) {
      case 'disabled':
        return false;
      case 'stub':
        return true;
      case 'test':
      case 'live':
        return !!this.configService.get<string>('STRIPE_SECRET_KEY');
      default:
        return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Checkout Session
  // ---------------------------------------------------------------------------

  async createCheckoutSession(
    _params: CreateCheckoutSessionParams,
  ): Promise<ProviderResult<CheckoutSessionResult>> {
    if (this.resolvedMode === 'disabled') {
      return this.disabledResult();
    }
    if (this.resolvedMode === 'stub') {
      return this.stubResult<CheckoutSessionResult>({
        sessionId: 'stub_cs_placeholder',
        url: null,
      });
    }
    return this.notConfiguredResult(
      `Stripe SDK not available — ${this.resolvedMode} mode deferred to 05C`,
    );
  }

  // ---------------------------------------------------------------------------
  // Customer
  // ---------------------------------------------------------------------------

  async createOrRetrieveCustomer(
    _params: CustomerParams,
  ): Promise<ProviderResult<CustomerResult>> {
    if (this.resolvedMode === 'disabled') {
      return this.disabledResult();
    }
    if (this.resolvedMode === 'stub') {
      return this.stubResult<CustomerResult>({
        customerId: null,
        isNew: false,
      });
    }
    return this.notConfiguredResult(
      `Stripe SDK not available — ${this.resolvedMode} mode deferred to 05C`,
    );
  }

  // ---------------------------------------------------------------------------
  // Billing Portal
  // ---------------------------------------------------------------------------

  async createBillingPortalSession(
    _params: PortalSessionParams,
  ): Promise<ProviderResult<PortalSessionResult>> {
    if (this.resolvedMode === 'disabled') {
      return this.disabledResult();
    }
    if (this.resolvedMode === 'stub') {
      return this.stubResult<PortalSessionResult>({ url: null });
    }
    return this.notConfiguredResult(
      `Stripe SDK not available — ${this.resolvedMode} mode deferred to 05C`,
    );
  }

  // ---------------------------------------------------------------------------
  // Webhook Signature Verification
  // ---------------------------------------------------------------------------

  verifyWebhookSignature(
    _rawBody: Buffer,
    _signature: string,
  ): ProviderResult<WebhookVerificationResult> {
    if (this.resolvedMode === 'disabled') {
      return this.disabledResult();
    }
    if (this.resolvedMode === 'stub') {
      return this.stubResult<WebhookVerificationResult>({ valid: true });
    }
    return this.notConfiguredResult(
      `Stripe SDK not available — ${this.resolvedMode} mode deferred to 05D`,
    );
  }

  // ---------------------------------------------------------------------------
  // Webhook Event Parsing
  // ---------------------------------------------------------------------------

  parseWebhookEvent(
    _rawBody: Buffer,
    _signature: string,
  ): ProviderResult<ParsedWebhookEvent> {
    if (this.resolvedMode === 'disabled') {
      return this.disabledResult();
    }
    if (this.resolvedMode === 'stub') {
      return this.stubResult<ParsedWebhookEvent>({
        eventId: 'stub_evt_placeholder',
        eventType: 'checkout_completed',
        data: {},
      });
    }
    return this.notConfiguredResult(
      `Stripe SDK not available — ${this.resolvedMode} mode deferred to 05D`,
    );
  }

  // ---------------------------------------------------------------------------
  // Event Type Mapping (works in all modes — pure static map)
  // ---------------------------------------------------------------------------

  mapEventType(providerEventType: string): MappedEventType | null {
    const internal = STRIPE_EVENT_TYPE_MAP[providerEventType];
    if (!internal) {
      return null;
    }
    return { internal, stripe: providerEventType };
  }

  // ---------------------------------------------------------------------------
  // Result Helpers
  // ---------------------------------------------------------------------------

  private disabledResult<T>(message?: string): ProviderResult<T> {
    return {
      success: false,
      error: 'PROVIDER_DISABLED' as ProviderErrorCode,
      message: message ?? 'Payment provider is disabled',
    };
  }

  private stubResult<T>(data: T): ProviderResult<T> {
    return { success: true, data };
  }

  private notConfiguredResult<T>(message?: string): ProviderResult<T> {
    return {
      success: false,
      error: 'PROVIDER_NOT_CONFIGURED' as ProviderErrorCode,
      message:
        message ?? 'Payment provider is not configured for this operation',
    };
  }
}
