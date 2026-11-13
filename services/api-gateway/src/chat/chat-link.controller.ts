import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyIdentity } from '../auth/api-key.config';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import {
  ChatLinkCancelled,
  ChatLinkCodeCreated,
  ChatLinkRemoved,
  ChatLinkService,
  ChatLinkState,
  ChatLinkView,
} from './chat-link.service';

/**
 * CHAT-DISCORD-01 A1: the link routes of stage-start section 5 (frozen route
 * shapes for slice A2).
 *
 * The same guard and harness-access check as the Chief of Staff front door
 * and the Connections page (collaboration.controller.ts, connectors.controller.ts):
 * no credentials 401, no harness access 403. The writes are covered by the
 * global SameOriginWriteGuard (app.module.ts). CHAT_DISCORD_ENABLED off: the
 * GET answers enabled false and every write answers 503 chat_link_unavailable,
 * and nothing is written.
 */
@Controller('chat-links')
@UseGuards(SessionOrApiKeyAuthGuard)
export class ChatLinkController {
  constructor(private readonly links: ChatLinkService) {}

  @Get()
  getState(@AuthenticatedUser() identity: ApiKeyIdentity): Promise<ChatLinkState> {
    const caller = this.assertEntitled(identity);
    return this.links.getState(caller.userId);
  }

  @Post('discord/code')
  @HttpCode(HttpStatus.CREATED)
  createCode(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Body() body: unknown,
  ): Promise<ChatLinkCodeCreated> {
    const caller = this.assertEntitled(identity);
    const locale =
      body !== null && typeof body === 'object' ? (body as { locale?: unknown }).locale : undefined;
    return this.links.createCode(caller.userId, locale);
  }

  @Post('discord/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(@AuthenticatedUser() identity: ApiKeyIdentity): Promise<ChatLinkView> {
    const caller = this.assertEntitled(identity);
    return this.links.confirm(caller.userId);
  }

  @Post('discord/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@AuthenticatedUser() identity: ApiKeyIdentity): Promise<ChatLinkCancelled> {
    const caller = this.assertEntitled(identity);
    return this.links.cancel(caller.userId);
  }

  @Delete('discord')
  @HttpCode(HttpStatus.OK)
  unlink(@AuthenticatedUser() identity: ApiKeyIdentity): Promise<ChatLinkRemoved> {
    const caller = this.assertEntitled(identity);
    return this.links.unlink(caller.userId);
  }

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
