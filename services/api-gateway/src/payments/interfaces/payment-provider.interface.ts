/**
 * Payment Provider Contracts (BILLING-READY-05A)
 *
 * Provider mode, typed result wrappers, error codes, operation signatures,
 * and legacy invoice-preview types for payment provider abstraction.
 *
 * Extends original Task 10B2 interface with mode-aware contracts.
 * No Stripe SDK. No provider API calls. Contracts only.
 */

// ---------------------------------------------------------------------------
// Provider Mode
// ---------------------------------------------------------------------------

export type ProviderMode = 'disabled' | 'stub' | 'test' | 'live';

export const VALID_PROVIDER_MODES: readonly ProviderMode[] = [
  'disabled',
  'stub',
  'test',
  'live',
] as const;

// ---------------------------------------------------------------------------
// Error Codes
// ---------------------------------------------------------------------------

export type ProviderErrorCode =
  | 'PROVIDER_DISABLED'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'INVALID_PARAMS'
  | 'PROVIDER_API_ERROR'
  | 'SIGNATURE_INVALID'
  | 'EVENT_PARSE_ERROR';

// ---------------------------------------------------------------------------
// Typed Result Wrapper
// ---------------------------------------------------------------------------

/**
 * Generic typed result wrapper for provider operations.
 * No secret values are ever included in results.
 * No user-facing UX text — callers map to localized messages.
 */
export interface ProviderResult<T> {
  success: boolean;
  data?: T;
  error?: ProviderErrorCode;
  message?: string;
}

// ---------------------------------------------------------------------------
// Internal Event Types (webhook event mapping)
// ---------------------------------------------------------------------------

export type InternalEventType =
  | 'checkout_completed'
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_deleted'
  | 'invoice_paid'
  | 'invoice_payment_failed';

// ---------------------------------------------------------------------------
// Operation Result Types
// ---------------------------------------------------------------------------

export interface CheckoutSessionResult {
  sessionId: string | null;
  url: string | null;
}

export interface CustomerResult {
  customerId: string | null;
  isNew: boolean;
}

export interface PortalSessionResult {
  url: string | null;
}

export interface WebhookVerificationResult {
  valid: boolean;
}

export interface ParsedWebhookEvent {
  eventId: string;
  eventType: InternalEventType | string;
  data: Record<string, unknown>;
}

export interface MappedEventType {
  internal: InternalEventType;
  stripe: string;
}

// ---------------------------------------------------------------------------
// Operation Parameter Types
// ---------------------------------------------------------------------------

export interface CreateCheckoutSessionParams {
  userId: string;
  userEmail: string;
  planId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CustomerParams {
  userId: string;
  email: string;
  name?: string;
}

export interface PortalSessionParams {
  customerId: string;
  returnUrl: string;
}

// ---------------------------------------------------------------------------
// PaymentProvider Interface
// ---------------------------------------------------------------------------

export interface PaymentProvider {
  /** Provider identifier (e.g. 'stripe'). */
  getProviderName(): string;

  /** Current resolved provider mode. */
  getProviderMode(): ProviderMode;

  /**
   * Prepare invoice for provider (preview/placeholder only).
   * Preserved from Task 10B2 for backward compatibility.
   */
  prepareInvoice(invoice: InvoicePreview): ProviderInvoiceContext;

  /**
   * Validate provider configuration for the current mode.
   * disabled → false, stub → true, test/live → checks key presence.
   */
  validateConfiguration(): boolean;

  /** Create a checkout session for plan subscription or one-time top-up. */
  createCheckoutSession(
    params: CreateCheckoutSessionParams,
  ): Promise<ProviderResult<CheckoutSessionResult>>;

  /** Create or retrieve a provider customer by platform user. */
  createOrRetrieveCustomer(
    params: CustomerParams,
  ): Promise<ProviderResult<CustomerResult>>;

  /** Create a billing portal session for self-service management. */
  createBillingPortalSession(
    params: PortalSessionParams,
  ): Promise<ProviderResult<PortalSessionResult>>;

  /** Verify webhook HMAC signature. Synchronous. */
  verifyWebhookSignature(
    rawBody: Buffer,
    signature: string,
  ): ProviderResult<WebhookVerificationResult>;

  /** Parse and validate a webhook event. Synchronous. */
  parseWebhookEvent(
    rawBody: Buffer,
    signature: string,
  ): ProviderResult<ParsedWebhookEvent>;

  /** Map provider event type string to internal event type. */
  mapEventType(providerEventType: string): MappedEventType | null;
}

// ---------------------------------------------------------------------------
// Legacy Types (Task 10B2 — preserved)
// ---------------------------------------------------------------------------

export interface InvoicePreview {
  userId: string;
  planType: string;
  totalCostUsd: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
}

export interface ProviderInvoiceContext {
  provider: string;
  externalCustomerId: string | null;
  externalInvoiceId: string | null;
  status: 'not_sent';
}
