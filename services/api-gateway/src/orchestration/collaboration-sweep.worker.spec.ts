import { Logger } from '@nestjs/common';
import { COLLABORATION_SWEEP_INTERVAL_MS } from './collaboration-sweep.constants';
import { CollaborationSweepWorker } from './collaboration-sweep.worker';
import { OrchestrationService } from './orchestration.service';

describe('CollaborationSweepWorker', () => {
  const originalWorkerId = process.env.JEST_WORKER_ID;

  afterEach(() => {
    if (originalWorkerId === undefined) {
      delete process.env.JEST_WORKER_ID;
    } else {
      process.env.JEST_WORKER_ID = originalWorkerId;
    }
    jest.restoreAllMocks();
  });

  function workerWith(sweep: jest.Mock): CollaborationSweepWorker {
    return new CollaborationSweepWorker({
      sweepCollaborations: sweep,
    } as unknown as OrchestrationService);
  }

  it('does not start the timer under Jest', () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const worker = workerWith(jest.fn());

    worker.onModuleInit();

    expect(setIntervalSpy).not.toHaveBeenCalled();
    worker.onModuleDestroy();
  });

  it('runs every five minutes, unrefs the timer, and clears it on destroy', () => {
    delete process.env.JEST_WORKER_ID;
    const unref = jest.fn();
    const handle = { unref };
    const setIntervalSpy = jest
      .spyOn(global, 'setInterval')
      .mockReturnValue(handle as unknown as ReturnType<typeof setInterval>);
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval').mockImplementation(() => undefined);
    const worker = workerWith(jest.fn());

    worker.onModuleInit();

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), COLLABORATION_SWEEP_INTERVAL_MS);
    expect(COLLABORATION_SWEEP_INTERVAL_MS).toBe(5 * 60 * 1000);
    expect(unref).toHaveBeenCalledTimes(1);

    worker.onModuleDestroy();
    expect(clearIntervalSpy).toHaveBeenCalledWith(handle);
  });

  it('skips an overlapping sweep and runs again after the first finishes', async () => {
    const sweep = jest.fn();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    sweep.mockImplementationOnce(() => gate);
    sweep.mockResolvedValue(undefined);
    const worker = workerWith(sweep);

    const first = worker.sweepOnce();
    const second = worker.sweepOnce();
    release();
    await Promise.all([first, second]);
    await worker.sweepOnce();

    expect(sweep).toHaveBeenCalledTimes(2);
  });

  it('logs a sweep failure without the error contents', async () => {
    const secret = 'super-secret-answer <handoff to="writer">task</handoff>';
    const sweep = jest.fn().mockRejectedValue(new Error(secret));
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const worker = workerWith(sweep);

    await worker.sweepOnce();

    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).toContain('collaboration.sweep_failed');
    expect(logged).toContain('Error');
    expect(logged).not.toContain(secret);
    expect(logged).not.toContain('handoff');
  });
});
