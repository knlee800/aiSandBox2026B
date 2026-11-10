import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { SessionIdPipe } from '../pipes/session-id.pipe';
import { SessionsService } from './sessions.service';

// CM-GIT-HOST-01 removed POST /api/sessions (create): no caller outside
// container-manager, and it reached host-side git through POST /api/git/:id/init.
@Controller('sessions')
export class SessionsController {
  constructor(private sessionsService: SessionsService) {}

  @Post(':id/start')
  async start(@Param('id', SessionIdPipe) id: string, @Body('userId') userId?: string) {
    await this.sessionsService.startSessionContainer(id, userId);
    return { message: 'Session container started successfully' };
  }

  @Get(':id')
  async get(@Param('id', SessionIdPipe) id: string) {
    return this.sessionsService.getSession(id);
  }

  @Get('user/:userId')
  async listUserSessions(@Param('userId') userId: string) {
    return this.sessionsService.listUserSessions(userId);
  }

  @Post(':id/stop')
  async stop(@Param('id', SessionIdPipe) id: string) {
    return this.sessionsService.stopSession(id);
  }

  @Delete(':id')
  async delete(@Param('id', SessionIdPipe) id: string) {
    return this.sessionsService.deleteSession(id);
  }
}
