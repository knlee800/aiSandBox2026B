import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { readSessionCookie } from './platform-cookies';

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
    // COOKIE-PREFIX-01: the current mode's name only (__Host- in secure mode).
    const rawToken = readSessionCookie(request);

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
