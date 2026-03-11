/**
 * UserUsageResponseDto
 * Response contract for GET /api/users/me/usage.
 */
export class UserUsageResponseDto {
  activeSessions: number;
  sessionsCreated24h: number;
  tokensUsed24h: number;
  estimatedCost: number;
  resetAt: string | null;
}
