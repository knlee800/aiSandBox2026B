import { Controller, Post, Get, Param, Body, Query } from '@nestjs/common';
import { SessionIdPipe } from '../pipes/session-id.pipe';
import { GitService } from './git.service';

@Controller('git')
export class GitController {
  constructor(private gitService: GitService) {}

  @Post(':sessionId/init')
  async init(
    @Param('sessionId', SessionIdPipe) sessionId: string,
    @Body('userId') userId: string
  ) {
    return this.gitService.initializeGit(sessionId, userId);
  }

  @Post(':sessionId/commit')
  async commit(
    @Param('sessionId', SessionIdPipe) sessionId: string,
    @Body('userId') userId: string,
    @Body('messageNumber') messageNumber: number,
    @Body('description') description?: string,
    @Body('allowEmpty') allowEmpty?: boolean,
  ) {
    return this.gitService.commit(
      sessionId,
      userId,
      messageNumber,
      description,
      allowEmpty,
    );
  }

  @Get(':sessionId/history')
  async history(
    @Param('sessionId', SessionIdPipe) sessionId: string,
    @Query('limit') limit?: number
  ) {
    return this.gitService.getHistory(sessionId, limit ? parseInt(limit.toString()) : 10);
  }

  @Post(':sessionId/revert')
  async revert(
    @Param('sessionId', SessionIdPipe) sessionId: string,
    @Body('userId') userId: string,
    @Body('commitHash') commitHash: string
  ) {
    return this.gitService.revert(sessionId, userId, commitHash);
  }

  @Get(':sessionId/checkpoints')
  async checkpoints(
    @Param('sessionId', SessionIdPipe) sessionId: string,
    @Query('limit') limit?: number
  ) {
    return this.gitService.getCheckpoints(sessionId, limit ? parseInt(limit.toString()) : 10);
  }

  @Get(':sessionId/diff/:commitHash')
  async diff(
    @Param('sessionId', SessionIdPipe) sessionId: string,
    @Param('commitHash') commitHash: string
  ) {
    return this.gitService.getDiff(sessionId, commitHash);
  }
}
