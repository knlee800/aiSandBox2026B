import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { EntitlementService } from '../auth/entitlement.service';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import {
  KnowledgeTriggerDeletedView,
  KnowledgeTriggerListView,
  KnowledgeTriggerRunsView,
  KnowledgeTriggerService,
  KnowledgeTriggerView,
} from './knowledge-trigger.service';

/** The user SessionCookieGuard puts on request.user. */
interface SessionRequest {
  user?: { userId?: unknown };
}

/**
 * TRIGGER-MORE-01 S1: the knowledge trigger routes of stage-start section 5
 * (route shapes frozen for slice S3 when S1 lands).
 *
 * Guarded exactly as the schedule, event trigger and mail trigger routes:
 * session only (SessionCookieGuard), so an API key (Bearer) alone gets 401.
 * Harness access is then read live (EntitlementService.resolveHarnessEntitled):
 * without it 403. The writes are covered by the global SameOriginWriteGuard
 * (app.module.ts); no CSRF code here. The routes work while
 * KNOWLEDGE_TRIGGERS_ENABLED is off; the GET reports it as `enabled`. Nothing
 * here reads a knowledge document or starts a run.
 */
@Controller('knowledge-triggers')
@UseGuards(SessionCookieGuard)
export class KnowledgeTriggerController {
  constructor(
    private readonly triggers: KnowledgeTriggerService,
    private readonly entitlements: EntitlementService,
  ) {}

  @Get()
  async list(@Request() req: SessionRequest): Promise<KnowledgeTriggerListView> {
    const userId = await this.assertEntitled(req);
    return this.triggers.list(userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req: SessionRequest, @Body() body: unknown): Promise<KnowledgeTriggerView> {
    const userId = await this.assertEntitled(req);
    return this.triggers.create(userId, body);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Request() req: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<KnowledgeTriggerView> {
    const userId = await this.assertEntitled(req);
    return this.triggers.update(userId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Request() req: SessionRequest, @Param('id') id: string): Promise<KnowledgeTriggerDeletedView> {
    const userId = await this.assertEntitled(req);
    return this.triggers.remove(userId, id);
  }

  @Get(':id/runs')
  async runs(@Request() req: SessionRequest, @Param('id') id: string): Promise<KnowledgeTriggerRunsView> {
    const userId = await this.assertEntitled(req);
    return this.triggers.history(userId, id);
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
