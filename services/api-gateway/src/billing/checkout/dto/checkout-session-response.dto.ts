import type { ProviderMode } from '../../../payments/interfaces/payment-provider.interface';

/**
 * BILLING-READY-05C: Checkout session response DTO.
 *
 * Returned to the caller after a checkout session is created.
 * No secret values (Stripe keys, webhook secrets) are ever included.
 */
export interface CheckoutSessionResponseDto {
  checkoutSessionId: string | null;
  checkoutUrl: string | null;
  providerMode: ProviderMode;
  checkoutType: 'subscription' | 'topup';
  planType?: string;
  topUpPackage?: string;
  customerId?: string | null;
}
