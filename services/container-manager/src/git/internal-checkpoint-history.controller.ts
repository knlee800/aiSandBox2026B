import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InternalServiceAuthGuard } from '../guards/internal-service-auth.guard';
import {
  CheckpointHistoryRestoreResult,
  CheckpointHistorySaveResult,
  GitService,
  isUuid,
} from './git.service';

@Controller('internal/checkpoint-history')
@UseGuards(InternalServiceAuthGuard)
export class InternalCheckpointHistoryController {
  constructor(private readonly gitService: GitService) {}

  @Post(':sessionId/save')
  @HttpCode(HttpStatus.OK)
  async save(
    @Param('sessionId') sessionId: string,
    @Body('projectId') projectId: string,
  ): Promise<CheckpointHistorySaveResult> {
    this.assertIds(sessionId, projectId);
    return this.gitService.saveProjectHistory(sessionId, projectId);
  }

  @Post(':sessionId/restore')
  @HttpCode(HttpStatus.OK)
  async restore(
    @Param('sessionId') sessionId: string,
    @Body('projectId') projectId: string,
  ): Promise<CheckpointHistoryRestoreResult> {
    this.assertIds(sessionId, projectId);
    return this.gitService.restoreProjectHistory(sessionId, projectId);
  }

  private assertIds(sessionId: string, projectId: string): void {
    if (!isUuid(sessionId) || !isUuid(projectId)) {
      throw new BadRequestException('Invalid id');
    }
  }
}
