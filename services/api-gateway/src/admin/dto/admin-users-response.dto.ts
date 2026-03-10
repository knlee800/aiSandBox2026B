/**
 * Response contract for GET /api/internal/admin/users.
 */
export class AdminUserSummaryDto {
  userId: string;
  email: string;
  role: string;
  planType: string;
  isActive: boolean;
  activeSessions: number;
  totalSessions: number;
  sessionsCreated24h: number;
  tokensUsed24h: number;
  estimatedCost: number;
  quotaStatus: 'OK' | 'WARN' | 'EXCEEDED';
  createdAt: string;
}

export class AdminUsersResponseDto {
  users: AdminUserSummaryDto[];
}
