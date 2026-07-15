import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * BILLING-READY-05C: Checkout URL validator.
 *
 * Validates successUrl / cancelUrl against safe origin rules:
 * - Must be a valid URL (parseable by URL constructor)
 * - Must be HTTPS in production; HTTP allowed for localhost/127.0.0.1 in dev
 * - Must match the FRONTEND_URL origin (or localhost in development)
 * - Max 2048 chars (enforced by DTO @MaxLength, double-checked here)
 * - Rejects open redirects to unknown origins
 *
 * No env config for URLs in 05C — uses FRONTEND_URL (already exists).
 */

const LOCALHOST_HOSTNAMES = ['localhost', '127.0.0.1'];

export function validateCheckoutUrl(
  url: string,
  fieldName: 'successUrl' | 'cancelUrl',
  configService: ConfigService,
): void {
  if (url.length > 2048) {
    throw new BadRequestException({
      error: 'INVALID_URL',
      field: fieldName,
      message: `${fieldName} exceeds maximum length of 2048 characters`,
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException({
      error: 'INVALID_URL',
      field: fieldName,
      message: `${fieldName} is not a valid URL`,
    });
  }

  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const isLocalhost = LOCALHOST_HOSTNAMES.includes(parsed.hostname);

  if (parsed.protocol !== 'https:') {
    if (parsed.protocol === 'http:' && isLocalhost && !isProduction) {
      // Allow http://localhost and http://127.0.0.1 in non-production
    } else {
      throw new BadRequestException({
        error: 'INVALID_URL',
        field: fieldName,
        message: isProduction
          ? `${fieldName} must use HTTPS`
          : `${fieldName} must use HTTPS (HTTP allowed only for localhost)`,
      });
    }
  }

  const frontendUrl = configService.get<string>('FRONTEND_URL');

  if (isLocalhost && !isProduction) {
    return;
  }

  if (frontendUrl) {
    try {
      const frontendOrigin = new URL(frontendUrl).origin;
      if (parsed.origin === frontendOrigin) {
        return;
      }
    } catch {
      // FRONTEND_URL misconfigured — fall through to reject
    }
  }

  throw new BadRequestException({
    error: 'INVALID_URL',
    field: fieldName,
    message: `${fieldName} origin is not in the allowed list`,
  });
}
