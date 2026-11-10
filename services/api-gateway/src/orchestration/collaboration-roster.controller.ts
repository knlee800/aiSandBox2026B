import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator';
import type { ApiKeyIdentity } from '../auth/api-key.config';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import { CollaborationRosterService, readRosterPutBody, type RosterView } from './collaboration-roster';

/**
 * COS-FRONTDOOR-01 D9 login routes. Same guard and entitlement rule as the
 * collaboration routes: 401 without identity, 403 without harness access.
 * Owner-scoped: the owner id comes from the identity only, never the body,
 * so an owner reads and writes only their own roster.
 *
 * GET /api/collaboration/roster  -> { members, choices }
 * PUT /api/collaboration/roster  { memberIds: string[] } -> { members, choices }
 *
 * A bad PUT is 400 with a stable code (ROSTER_REFUSAL_CODES) and saves
 * nothing; another owner's workflow id answers exactly as a missing one.
 */
@Controller('collaboration/roster')
@UseGuards(SessionOrApiKeyAuthGuard)
export class CollaborationRosterController {
  constructor(private readonly roster: CollaborationRosterService) {}

  @Get()
  async get(@AuthenticatedUser() identity: ApiKeyIdentity): Promise<RosterView> {
    const caller = this.assertEntitled(identity);
    return this.roster.view(caller.userId);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  async put(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Body() body: unknown,
  ): Promise<RosterView> {
    const caller = this.assertEntitled(identity);
    return this.roster.put(caller.userId, readRosterPutBody(body));
  }

  /** The same rule as CollaborationController.assertEntitled. */
  private assertEntitled(identity: ApiKeyIdentity | undefined): ApiKeyIdentity {
    if (!identity?.userId || typeof identity.apiKeyId !== 'string' || identity.apiKeyId.length === 0) {
      throw new UnauthorizedException('Missing authentication credentials');
    }
    if (identity.harnessEntitled !== true) {
      throw new ForbiddenException('Forbidden');
    }
    return identity;
  }
}
