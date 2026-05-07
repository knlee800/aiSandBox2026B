import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

type CsrfRequest = Request & {
  cookies?: {
    aisandbox_csrf?: string;
  };
};

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<CsrfRequest>();
    const csrfCookie = request.cookies?.aisandbox_csrf;
    const csrfHeader = request.headers['x-csrf-token'];
    const csrfToken = Array.isArray(csrfHeader) ? csrfHeader[0] : csrfHeader;

    if (
      typeof csrfCookie !== 'string' ||
      csrfCookie.length === 0 ||
      typeof csrfToken !== 'string' ||
      csrfToken.length === 0 ||
      csrfCookie !== csrfToken
    ) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }
}
