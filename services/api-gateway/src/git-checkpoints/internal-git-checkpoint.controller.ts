import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
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
  constructor(private readonly gitCheckpointService: GitCheckpointService) {}

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

    return { message: 'Git checkpoint recorded successfully' };
  }
}
