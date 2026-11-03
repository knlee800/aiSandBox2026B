import { describe, expect, it, jest } from '@jest/globals';
import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { InternalServiceAuthGuard } from '../guards/internal-service-auth.guard';
import { GitModule } from './git.module';
import { InternalWorktreeDiffController } from './internal-worktree-diff.controller';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const COMMIT = 'abc123abc123abc123abc123abc123abc123abcd';

describe('InternalWorktreeDiffController', () => {
  it('GET :sessionId/worktree-diff/:commitHash is registered behind InternalServiceAuthGuard', () => {
    expect(Reflect.getMetadata(PATH_METADATA, InternalWorktreeDiffController)).toBe('internal/git');
    expect(
      Reflect.getMetadata(PATH_METADATA, InternalWorktreeDiffController.prototype.worktreeDiff),
    ).toBe(':sessionId/worktree-diff/:commitHash');
    expect(
      Reflect.getMetadata(METHOD_METADATA, InternalWorktreeDiffController.prototype.worktreeDiff),
    ).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(GUARDS_METADATA, InternalWorktreeDiffController)).toContain(
      InternalServiceAuthGuard,
    );

    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, GitModule);
    expect(controllers).toContain(InternalWorktreeDiffController);
  });

  it('returns the diff from GitService', async () => {
    const gitService = {
      getWorkingTreeDiff: jest.fn(async () => ({
        commitHash: COMMIT,
        diff: 'diff --git a/src/form.ts b/src/form.ts\n',
        truncated: false,
      })),
    };
    const controller = new InternalWorktreeDiffController(gitService as never);
    await expect(controller.worktreeDiff(SESSION_ID, COMMIT)).resolves.toEqual({
      commitHash: COMMIT,
      diff: 'diff --git a/src/form.ts b/src/form.ts\n',
      truncated: false,
    });
    expect(gitService.getWorkingTreeDiff).toHaveBeenCalledWith(SESSION_ID, COMMIT);
  });
});
