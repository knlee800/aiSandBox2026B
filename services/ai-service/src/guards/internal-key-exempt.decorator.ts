import { SetMetadata } from '@nestjs/common';

/**
 * AI-SERVICE-AUTH-01 (D3): marks one handler as open without
 * X-Internal-Service-Key. The global InternalServiceAuthGuard reads it from
 * the handler only (never the class), so a class-level mark opens nothing.
 *
 * Only three handlers carry it: GET /api/conversations (health),
 * POST /api/messages/health and GET /metrics.
 */
export const INTERNAL_KEY_EXEMPT = 'aisb:internal-key-exempt';

export const InternalKeyExempt = () => SetMetadata(INTERNAL_KEY_EXEMPT, true);
