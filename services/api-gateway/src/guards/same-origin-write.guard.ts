import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { requestHasSessionCookie } from '../auth/platform-cookies';
import { resolveHttpCorsOrigin } from '../cors/http-cors-origin';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Apple posts its sign-in form from its own origin by design (OAuth state protects it). */
export const SAME_ORIGIN_WRITE_EXEMPT_PATH = '/api/auth/apple/callback';

export const CROSS_ORIGIN_REFUSED_MESSAGE = 'Cross-origin request refused';

/**
 * True only when resolveHttpCorsOrigin (the HTTP CORS rule) allows this origin:
 * it must equal the APP_BASE_URL origin. APP_BASE_URL unset or not a URL,
 * an unparsable origin, "null" or an empty value: false. The resolver answers
 * synchronously; if it ever did not, this stays false (fail closed).
 */
function isAppOrigin(origin: string): boolean {
  let allowed = false;
  resolveHttpCorsOrigin(origin, (err, allow) => {
    allowed = !err && typeof allow === 'string' && allow.length > 0;
  });
  return allowed;
}

/**
 * SameOriginWriteGuard (CSRF-AUDIT-01).
 * Global guard for every write (any method other than GET, HEAD, OPTIONS):
 * 1. POST /api/auth/apple/callback (exact path): allowed.
 * 2. Origin present: must be the APP_BASE_URL origin (resolveHttpCorsOrigin), else 403.
 * 3. Origin absent and a session cookie present under either name
 *    (aisandbox_session or __Host-aisandbox_session, exact name; COOKIE-PREFIX-01): 403.
 * 4. Origin absent and no session cookie (internal services, Stripe, API-key
 *    clients): allowed; the route's own guards decide.
 * Never logs cookies or headers.
 */
@Injectable()
export class SameOriginWriteGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const method = String(request.method ?? '').toUpperCase();
    if (READ_METHODS.has(method)) {
      return true;
    }

    if (request.path === SAME_ORIGIN_WRITE_EXEMPT_PATH) {
      return true;
    }

    const origin = request.headers?.origin;
    if (origin !== undefined) {
      if (typeof origin === 'string' && isAppOrigin(origin)) {
        return true;
      }
      throw new ForbiddenException(CROSS_ORIGIN_REFUSED_MESSAGE);
    }

    if (requestHasSessionCookie(request)) {
      throw new ForbiddenException(CROSS_ORIGIN_REFUSED_MESSAGE);
    }

    return true;
  }
}
