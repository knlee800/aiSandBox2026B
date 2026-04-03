jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    publish: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue(undefined),
  }));
});

import Redis from 'ioredis';
import { ExecutionStreamPublisher } from '../execution-stream.publisher';

describe('ExecutionStreamPublisher', () => {
  it('publishes file_actions payload and completion payload', async () => {
    process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
    const publisher = new ExecutionStreamPublisher();
    const redisInstance = (Redis as unknown as jest.Mock).mock.results[0]
      .value as {
      publish: jest.Mock;
      quit: jest.Mock;
    };

    await publisher.publishFileActions('exec-123', [
      { action: 'write', path: 'src/app.ts', content: 'x' },
    ]);
    await publisher.publishCompletion('exec-123');

    expect(redisInstance.publish).toHaveBeenNthCalledWith(
      1,
      'ai-execution-stream:exec-123',
      JSON.stringify({
        type: 'file_actions',
        actions: [{ action: 'write', path: 'src/app.ts', content: 'x' }],
      }),
    );
    expect(redisInstance.publish).toHaveBeenNthCalledWith(
      2,
      'ai-execution-stream:exec-123',
      JSON.stringify({ type: 'complete' }),
    );
  });
});
