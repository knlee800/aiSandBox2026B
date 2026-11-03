import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { InternalServiceAuthGuard } from '../guards/internal-service-auth.guard';
import { GitService, WorkingTreeDiffResult } from './git.service';

/**
 * Read-only working-tree diff for one session.
 * GET /api/internal/git/:sessionId/worktree-diff/:commitHash
 */
@Controller('internal/git')
@UseGuards(InternalServiceAuthGuard)
export class InternalWorktreeDiffController {
  constructor(private readonly gitService: GitService) {}

  @Get(':sessionId/worktree-diff/:commitHash')
  async worktreeDiff(
    @Param('sessionId') sessionId: string,
    @Param('commitHash') commitHash: string,
  ): Promise<WorkingTreeDiffResult> {
    return this.gitService.getWorkingTreeDiff(sessionId, commitHash);
  }
}
