import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ForbiddenException, RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { InternalServiceAuthGuard } from '../guards/internal-service-auth.guard';
import { GitModule } from './git.module';
import { InternalCheckpointHistoryController } from './internal-checkpoint-history.controller';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const HEAD = 'abc123abc123abc123abc123abc123abc123abcd';

describe('InternalCheckpointHistoryController', () => {
  let controller: InternalCheckpointHistoryController;
  let gitService: {
    saveProjectHistory: jest.Mock<any>;
    restoreProjectHistory: jest.Mock<any>;
  };

  beforeEach(() => {
    gitService = {
      saveProjectHistory: jest.fn<any>(),
      restoreProjectHistory: jest.fn<any>(),
    };
    controller = new InternalCheckpointHistoryController(gitService as any);
  });

  it('POST :sessionId/save and POST :sessionId/restore are registered on the internal controller', () => {
    expect(Reflect.getMetadata(PATH_METADATA, InternalCheckpointHistoryController)).toBe(
      'internal/checkpoint-history',
    );
    expect(Reflect.getMetadata(PATH_METADATA, InternalCheckpointHistoryController.prototype.save)).toBe(
      ':sessionId/save',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, InternalCheckpointHistoryController.prototype.save)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(PATH_METADATA, InternalCheckpointHistoryController.prototype.restore)).toBe(
      ':sessionId/restore',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, InternalCheckpointHistoryController.prototype.restore)).toBe(
      RequestMethod.POST,
    );
  });

  it('returns the save responses from GitService', async () => {
    gitService.saveProjectHistory.mockResolvedValueOnce({ status: 'saved', bytes: 4096 });
    await expect(controller.save(SESSION_ID, PROJECT_ID)).resolves.toEqual({
      status: 'saved',
      bytes: 4096,
    });

    gitService.saveProjectHistory.mockResolvedValueOnce({ status: 'skipped' });
    await expect(controller.save(SESSION_ID, PROJECT_ID)).resolves.toEqual({ status: 'skipped' });

    expect(gitService.saveProjectHistory).toHaveBeenNthCalledWith(1, SESSION_ID, PROJECT_ID);
    expect(gitService.saveProjectHistory).toHaveBeenNthCalledWith(2, SESSION_ID, PROJECT_ID);
  });

  it('returns the restore responses from GitService', async () => {
    gitService.restoreProjectHistory.mockResolvedValueOnce({ status: 'restored', head: HEAD });
    await expect(controller.restore(SESSION_ID, PROJECT_ID)).resolves.toEqual({
      status: 'restored',
      head: HEAD,
    });

    gitService.restoreProjectHistory.mockResolvedValueOnce({ status: 'none' });
    await expect(controller.restore(SESSION_ID, PROJECT_ID)).resolves.toEqual({ status: 'none' });

    expect(gitService.restoreProjectHistory).toHaveBeenNthCalledWith(1, SESSION_ID, PROJECT_ID);
    expect(gitService.restoreProjectHistory).toHaveBeenNthCalledWith(2, SESSION_ID, PROJECT_ID);
  });

  it('returns 400 for an invalid id on save and does not call GitService', async () => {
    await expect(controller.save('not-a-uuid', PROJECT_ID)).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.save(SESSION_ID, '../project')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.save(SESSION_ID, undefined as unknown as string)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(gitService.saveProjectHistory).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid id on restore and does not call GitService', async () => {
    await expect(controller.restore('session/1', PROJECT_ID)).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.restore(SESSION_ID, 'project-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(gitService.restoreProjectHistory).not.toHaveBeenCalled();
  });

  it('registers the controller on GitModule behind InternalServiceAuthGuard', () => {
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, GitModule);
    expect(controllers).toContain(InternalCheckpointHistoryController);

    const guards = Reflect.getMetadata(GUARDS_METADATA, InternalCheckpointHistoryController);
    expect(guards).toContain(InternalServiceAuthGuard);
  });
});

describe('InternalServiceAuthGuard for checkpoint history', () => {
  const originalKey = process.env.INTERNAL_SERVICE_KEY;

  beforeEach(() => {
    process.env.INTERNAL_SERVICE_KEY = 'test-internal-key';
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.INTERNAL_SERVICE_KEY;
    } else {
      process.env.INTERNAL_SERVICE_KEY = originalKey;
    }
  });

  function contextFor(key?: string) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: key === undefined ? {} : { 'x-internal-service-key': key },
        }),
      }),
    };
  }

  it('rejects a missing or wrong service key and allows the configured key', () => {
    const guard = new InternalServiceAuthGuard();

    expect(() => guard.canActivate(contextFor(undefined) as any)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor('wrong-key') as any)).toThrow(ForbiddenException);
    expect(guard.canActivate(contextFor('test-internal-key') as any)).toBe(true);
  });
});
