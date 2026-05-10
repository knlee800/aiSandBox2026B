import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { Request } from 'express';
import { SessionService } from '../sessions/session.service';

type AuthenticatedRequest = Request & {
  user?: {
    userId?: string;
  };
};

@Injectable()
export class PreviewOwnershipGuard implements CanActivate {
  constructor(
    @Optional() private readonly sessionService?: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const requesterUserId = request.user?.userId;

    if (typeof requesterUserId !== 'string' || requesterUserId.trim().length === 0) {
      throw new ForbiddenException('Preview access forbidden');
    }

    const segments = request.path.split('/');
    const sessionId = segments[3];

    if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      throw new ForbiddenException('Preview access forbidden');
    }

    if (!this.sessionService) {
      throw new ForbiddenException('Preview access forbidden');
    }

    try {
      const session = await this.sessionService.getSessionById(sessionId);
      if (session.userId !== requesterUserId) {
        throw new ForbiddenException('Preview access forbidden');
      }
    } catch {
      throw new ForbiddenException('Preview access forbidden');
    }

    return true;
  }
}
