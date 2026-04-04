import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Session } from '../entities/session.entity';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator';
import { type ApiKeyIdentity } from '../auth/api-key.config';
import { ApiKeyAuthGuard } from '../auth/api-key-auth.guard';
import { SessionService } from '../sessions/session.service';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import {
  PublicApiRateLimit,
  PublicApiRateLimitGuard,
} from './public-api-rate-limit.guard';

@Controller('v1/sessions')
@UseGuards(ApiKeyAuthGuard, PublicApiRateLimitGuard)
export class PublicSessionsController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly containerManagerHttpClient: ContainerManagerHttpClient,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @PublicApiRateLimit({ maxRequests: 20, windowMs: 60000 })
  async createSession(@AuthenticatedUser() identity: ApiKeyIdentity): Promise<Session> {
    const session = await this.sessionService.createSession(identity.userId);
    await this.containerManagerHttpClient.startSession(session.id, identity.userId);
    return session;
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @PublicApiRateLimit({ maxRequests: 60, windowMs: 60000 })
  async listSessions(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Query('includeTerminated') includeTerminated?: string,
  ): Promise<Session[]> {
    return await this.sessionService.getSessionsByUser(
      identity.userId,
      includeTerminated === 'true',
    );
  }
}
