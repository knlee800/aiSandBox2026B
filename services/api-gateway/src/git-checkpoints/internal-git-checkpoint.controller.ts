import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import { GitCheckpointService } from './git-checkpoint.service';

/**
 * DTO for recording git checkpoint
 */
class RecordCheckpointDto {
  @IsString()
  sessionId: string;

  @IsString()
  commitHash: string;

  @IsInt()
  @Min(0)
  filesChanged: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  messageNumber?: number | null;

  @IsOptional()
  @IsString()
  description?: string | null;
}

/**
 * Internal Git Checkpoint Controller
 * HTTP endpoints for container-manager → api-gateway communication
 * NOT exposed to public API (use /api/internal/* routes)
 */
@Controller('internal/git-checkpoints')
export class InternalGitCheckpointController {
  private readonly logger = new Logger(InternalGitCheckpointController.name);

  constructor(
    private readonly gitCheckpointService: GitCheckpointService,
    private readonly containerManagerHttpClient: ContainerManagerHttpClient,
  ) {}

  /**
   * Record a git checkpoint after auto-commit
   * Called by container-manager after each git commit
   * POST /api/internal/git-checkpoints
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async recordCheckpoint(@Body() dto: RecordCheckpointDto): Promise<{ message: string }> {
    await this.gitCheckpointService.recordCheckpoint({
      sessionId: dto.sessionId,
      commitHash: dto.commitHash,
      filesChanged: dto.filesChanged,
      messageNumber: dto.messageNumber ?? null,
      description: dto.description ?? null,
    });

    void this.saveCheckpointHistoryInBackground(dto.sessionId).catch(
      (error: unknown) => {
        const detail = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to save checkpoint history for session ${dto.sessionId}: ${detail}`,
        );
      },
    );

    return { message: 'Git checkpoint recorded successfully' };
  }

  private async saveCheckpointHistoryInBackground(sessionId: string): Promise<void> {
    const owner = await this.gitCheckpointService.getSessionOwnerAndProject(sessionId);
    const projectId = owner?.projectId;
    if (!projectId) {
      return;
    }
    await this.containerManagerHttpClient.saveCheckpointHistory(sessionId, projectId);
  }
}
