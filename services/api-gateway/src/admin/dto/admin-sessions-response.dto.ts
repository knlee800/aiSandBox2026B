/**
 * Response contract for GET /api/internal/admin/sessions.
 */
export class AdminSessionVisibilityDto {
  sessionId: string;
  userId: string;
  userEmail: string;
  status: string;
  isTerminated: boolean;
  terminationReason: string | null;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
}

export class AdminSessionsResponseDto {
  sessions: AdminSessionVisibilityDto[];
}
