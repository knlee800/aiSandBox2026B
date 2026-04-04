/**
 * Response contract for GET /api/internal/admin/users.
 */
export class AdminUserSummaryDto {
  userId: string;
  email: string;
  role: string;
  planCode: string;
  planName: string;
  planType: string;
  planStatus: string;
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

export class AdminUserQuotaVisibilityDto {
  maxActiveSessions: number;
  maxSessions24h: number;
  maxTokens24h: number;
  currentActiveSessions: number;
  currentSessions24h: number;
  currentTokens24h: number;
}

export class AdminUserDetailDto extends AdminUserSummaryDto {
  quotas: AdminUserQuotaVisibilityDto;
}
