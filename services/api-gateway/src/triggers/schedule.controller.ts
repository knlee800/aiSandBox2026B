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
  ScheduleDeletedView,
  ScheduleListView,
  ScheduleRunsView,
  ScheduleService,
  ScheduleView,
} from './schedule.service';

/** The user SessionCookieGuard puts on request.user. */
interface SessionRequest {
  user?: { userId?: unknown };
}

/**
 * TRIGGER-01 S1: the schedule routes of stage-start section 7 (frozen route
 * shapes for TRIGGER-UI-01).
 *
 * Session only: a schedule is a standing instruction to spend, so the routes
 * use SessionCookieGuard as the chat link routes do (Keith's Q7). An API key
 * (Bearer) alone gets 401. Harness access is then read live
 * (EntitlementService.resolveHarnessEntitled): without it 403. The writes are
 * covered by the global SameOriginWriteGuard (app.module.ts); no CSRF code
 * here. The routes work while SCHEDULES_ENABLED is off (Keith's Q5); the GET
 * reports it as `enabled`.
 */
@Controller('schedules')
@UseGuards(SessionCookieGuard)
export class ScheduleController {
  constructor(
    private readonly schedules: ScheduleService,
    private readonly entitlements: EntitlementService,
  ) {}

  @Get()
  async list(@Request() req: SessionRequest): Promise<ScheduleListView> {
    const userId = await this.assertEntitled(req);
    return this.schedules.list(userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req: SessionRequest, @Body() body: unknown): Promise<ScheduleView> {
    const userId = await this.assertEntitled(req);
    return this.schedules.create(userId, body);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Request() req: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<ScheduleView> {
    const userId = await this.assertEntitled(req);
    return this.schedules.update(userId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Request() req: SessionRequest, @Param('id') id: string): Promise<ScheduleDeletedView> {
    const userId = await this.assertEntitled(req);
    return this.schedules.remove(userId, id);
  }

  @Get(':id/runs')
  async runs(@Request() req: SessionRequest, @Param('id') id: string): Promise<ScheduleRunsView> {
    const userId = await this.assertEntitled(req);
    return this.schedules.history(userId, id);
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
