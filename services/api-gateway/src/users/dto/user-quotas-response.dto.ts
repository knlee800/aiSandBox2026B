/**
 * UserQuotasResponseDto
 * Response contract for GET /api/users/me/quotas.
 */
export class UserQuotasResponseDto {
  planCode: string;
  planName: string;
  planStatus: 'active' | 'cancelled' | 'expired';
  maxActiveSessions: number;
  currentActiveSessions: number;
  maxSessions24h: number;
  currentSessions24h: number;
  maxTokens24h: number;
  currentTokens24h: number;
  resetAt: string | null;
}
