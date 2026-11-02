jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    publish: jest.fn().mockResolvedValue(1),
    subscribe: jest.fn().mockResolvedValue(1),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
  }));
});

import Redis from 'ioredis';
import { ExecutionStreamService } from './execution-stream.service';

type RedisMockInstance = {
  publish: jest.Mock;
  subscribe: jest.Mock;
  unsubscribe: jest.Mock;
  on: jest.Mock;
  quit: jest.Mock;
};

describe('ExecutionStreamService', () => {
  const originalRedisUrl = process.env.REDIS_URL;
  let service: ExecutionStreamService;
  let subscriber: RedisMockInstance;

  function messageListener(): (channel: string, message: string) => void {
    const registration = subscriber.on.mock.calls.find((call) => call[0] === 'message');
    if (!registration) {
      throw new Error('expected a message listener');
    }
    return registration[1] as (channel: string, message: string) => void;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    service = new ExecutionStreamService();
    const constructed = (Redis as unknown as jest.Mock).mock.results;
    subscriber = constructed[1].value as RedisMockInstance;
  });

  afterEach(() => {
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
  });

  it('delivers one message to every viewer on that channel', async () => {
    const first = jest.fn();
    const second = jest.fn();

    await service.subscribe('exec-a', first);
    await service.subscribe('exec-a', second);
    messageListener()('ai-execution-stream:exec-a', 'token-a');

    expect(first).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledWith('token-a');
    expect(second).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith('token-a');
    expect(subscriber.subscribe).toHaveBeenCalledTimes(1);
    expect(subscriber.subscribe).toHaveBeenCalledWith('ai-execution-stream:exec-a');
  });

  it('does not deliver a message from another channel', async () => {
    const first = jest.fn();
    const second = jest.fn();

    await service.subscribe('exec-a', first);
    await service.subscribe('exec-a', second);
    messageListener()('ai-execution-stream:exec-b', 'other-token');

    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });

  it('keeps the remaining viewer subscribed when one leaves', async () => {
    const first = jest.fn();
    const second = jest.fn();

    await service.subscribe('exec-a', first);
    await service.subscribe('exec-a', second);
    await service.unsubscribe('exec-a', first);
    messageListener()('ai-execution-stream:exec-a', 'still-here');

    expect(subscriber.unsubscribe).not.toHaveBeenCalled();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith('still-here');
  });

  it('unsubscribes Redis when the last viewer leaves', async () => {
    const first = jest.fn();
    const second = jest.fn();

    await service.subscribe('exec-a', first);
    await service.subscribe('exec-a', second);
    await service.unsubscribe('exec-a', first);
    await service.unsubscribe('exec-a', second);
    messageListener()('ai-execution-stream:exec-a', 'after-last');

    expect(subscriber.unsubscribe).toHaveBeenCalledTimes(1);
    expect(subscriber.unsubscribe).toHaveBeenCalledWith('ai-execution-stream:exec-a');
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });

  it('registers a single message listener', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const otherChannel = jest.fn();

    await service.subscribe('exec-a', first);
    await service.subscribe('exec-a', second);
    await service.subscribe('exec-b', otherChannel);
    await service.unsubscribe('exec-b', otherChannel);

    const messageListeners = subscriber.on.mock.calls.filter((call) => call[0] === 'message');
    expect(messageListeners).toHaveLength(1);
  });

  it('continues delivery when one callback throws', async () => {
    const failing = jest.fn(() => {
      throw new Error('viewer failed');
    });
    const other = jest.fn();

    await service.subscribe('exec-a', failing);
    await service.subscribe('exec-a', other);

    expect(() => messageListener()('ai-execution-stream:exec-a', 'token-a')).not.toThrow();
    expect(failing).toHaveBeenCalledWith('token-a');
    expect(other).toHaveBeenCalledWith('token-a');
  });
});
