import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

type AuthenticatedRequest = Request & {
  user?: {
    userId: string;
    email: string;
    role: string;
    plan: string;
  };
};

@Injectable()
export class SessionCookieGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawToken = request.cookies?.aisandbox_session;

    if (typeof rawToken !== 'string' || rawToken.trim().length === 0) {
      throw new UnauthorizedException('Authentication required');
    }

    const user = await this.authService.validateSessionToken(rawToken);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    request.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      plan: user.planType,
    };

    return true;
  }
}
