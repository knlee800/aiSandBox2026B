import { SetMetadata } from '@nestjs/common';

/**
 * CM-AUTH-01 (D1, D2): marks one handler as open without
 * X-Internal-Service-Key. The global InternalServiceAuthGuard reads it from
 * the handler only (never the class), so a class-level mark opens nothing.
 *
 * Only one handler carries it: GET /api/health (HealthController.getHealth).
 * Same name and semantics as ai-service (AI-SERVICE-AUTH-01).
 */
export const INTERNAL_KEY_EXEMPT = 'aisb:internal-key-exempt';

export const InternalKeyExempt = () => SetMetadata(INTERNAL_KEY_EXEMPT, true);
