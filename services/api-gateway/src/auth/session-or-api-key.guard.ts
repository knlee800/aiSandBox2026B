import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiKeyIdentity } from './api-key.config';
import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { AuthService } from './auth.service';
import { EntitlementService } from './entitlement.service';
import { readSessionCookie } from './platform-cookies';

/**
 * SessionOrApiKeyAuthGuard
 *
 * Phase AI-CONTEXT-01E: Composite authentication guard for AI execution endpoints.
 *
 * Priority:
 *  1. Authorization header (Bearer) → delegates to API key validation.
 *  2. Session cookie (aisandbox_session; __Host-aisandbox_session in secure mode,
 *     COOKIE-PREFIX-01) → validates session, synthesizes ApiKeyIdentity.
 *  3. Neither → 401.
 *
 * Header path wins when both header and cookie are present.
 */
@Injectable()
export class SessionOrApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly apiKeyAuthGuard: ApiKeyAuthGuard,
    private readonly authService: AuthService,
    @Optional() private readonly entitlements?: EntitlementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (authHeader && authHeader.startsWith('Bearer')) {
      return this.apiKeyAuthGuard.canActivate(context);
    }

    const rawToken = readSessionCookie(request);

    if (typeof rawToken !== 'string' || rawToken.trim().length === 0) {
      throw new UnauthorizedException('Missing authentication credentials');
    }

    const user = await this.authService.validateSessionToken(rawToken);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const identity: ApiKeyIdentity = {
      userId: user.id,
      apiKeyId: 'browser-session',
      scopes: ['ai:execute'],
      isInternal: true,
    };

    if (await this.entitlements?.resolveHarnessEntitled(user.id)) {
      identity.harnessEntitled = true;
    }

    (request as any).apiKeyIdentity = identity;

    return true;
  }
}
