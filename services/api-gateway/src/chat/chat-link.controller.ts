import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { EntitlementService } from '../auth/entitlement.service';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import {
  ChatLinkCancelled,
  ChatLinkCodeCreated,
  ChatLinkRemoved,
  ChatLinkService,
  ChatLinkState,
  ChatLinkView,
} from './chat-link.service';

/** The user SessionCookieGuard puts on request.user. */
interface SessionRequest {
  user?: { userId?: unknown };
}

/**
 * CHAT-DISCORD-01 A1: the link routes of stage-start section 5 (frozen route
 * shapes for slice A2).
 *
 * Session only: linking a Discord account is an account-level action like
 * creating an API key, so the routes use SessionCookieGuard as
 * auth/api-key.controller.ts does. An API key (Bearer) alone gets 401.
 * Harness access is then read live (EntitlementService.resolveHarnessEntitled,
 * the same table read the session guards use): without it 403. The writes are
 * covered by the global SameOriginWriteGuard (app.module.ts).
 * CHAT_DISCORD_ENABLED off: the GET answers enabled false and every write
 * answers 503 chat_link_unavailable, and nothing is written.
 */
@Controller('chat-links')
@UseGuards(SessionCookieGuard)
export class ChatLinkController {
  constructor(
    private readonly links: ChatLinkService,
    private readonly entitlements: EntitlementService,
  ) {}

  @Get()
  async getState(@Request() req: SessionRequest): Promise<ChatLinkState> {
    const userId = await this.assertEntitled(req);
    return this.links.getState(userId);
  }

  @Post('discord/code')
  @HttpCode(HttpStatus.CREATED)
  async createCode(
    @Request() req: SessionRequest,
    @Body() body: unknown,
  ): Promise<ChatLinkCodeCreated> {
    const userId = await this.assertEntitled(req);
    const locale =
      body !== null && typeof body === 'object' ? (body as { locale?: unknown }).locale : undefined;
    return this.links.createCode(userId, locale);
  }

  @Post('discord/confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(@Request() req: SessionRequest): Promise<ChatLinkView> {
    const userId = await this.assertEntitled(req);
    return this.links.confirm(userId);
  }

  @Post('discord/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Request() req: SessionRequest): Promise<ChatLinkCancelled> {
    const userId = await this.assertEntitled(req);
    return this.links.cancel(userId);
  }

  @Delete('discord')
  @HttpCode(HttpStatus.OK)
  async unlink(@Request() req: SessionRequest): Promise<ChatLinkRemoved> {
    const userId = await this.assertEntitled(req);
    return this.links.unlink(userId);
  }

  private async assertEntitled(req: SessionRequest): Promise<string> {
    const userId = req?.user?.userId;
    if (typeof userId !== 'string' || userId.length === 0) {
      throw new UnauthorizedException('Authentication required');
    }
    if ((await this.entitlements.resolveHarnessEntitled(userId)) !== true) {
      throw new ForbiddenException('Forbidden');
    }
    return userId;
  }
}
