import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class ExecutionStreamService implements OnModuleDestroy {
  private publisher: Redis;
  private subscriber: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }

    this.publisher = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);
  }

  publishToken(executionId: string, token: string) {
    const channel = `ai-execution-stream:${executionId}`;
    return this.publisher.publish(channel, token);
  }

  async subscribe(
    executionId: string,
    onMessage: (token: string) => void,
  ) {
    const channel = `ai-execution-stream:${executionId}`;

    await this.subscriber.subscribe(channel);

    this.subscriber.on('message', (incomingChannel, message) => {
      if (incomingChannel === channel) {
        onMessage(message);
      }
    });
  }

  async unsubscribe(executionId: string) {
    const channel = `ai-execution-stream:${executionId}`;
    await this.subscriber.unsubscribe(channel);
  }

  async onModuleDestroy() {
    await this.publisher.quit();
    await this.subscriber.quit();
  }
}
