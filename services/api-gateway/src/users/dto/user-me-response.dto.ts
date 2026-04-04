/**
 * UserMeResponseDto
 * Response contract for GET /api/users/me.
 */
export class UserMeResponseDto {
  userId: string;
  email: string;
  createdAt: string;
  planCode: string;
  planName: string;
  planStatus: 'active' | 'cancelled' | 'expired';
}
