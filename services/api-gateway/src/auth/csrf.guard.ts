import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { readCsrfCookie } from './platform-cookies';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    // COOKIE-PREFIX-01: the current mode's name only (__Host- in secure mode).
    const csrfCookie = readCsrfCookie(request);
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
