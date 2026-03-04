import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class ExecutionStreamPublisher implements OnModuleDestroy {
  private redis: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }

    this.redis = new Redis(redisUrl);
  }

  publishToken(executionId: string, token: string) {
    const channel = `ai-execution-stream:${executionId}`;

    const payload = JSON.stringify({
      type: 'token',
      content: token
    });

    return this.redis.publish(channel, payload);
  }

  publishCompletion(executionId: string) {
    const channel = `ai-execution-stream:${executionId}`;

    const payload = JSON.stringify({
      type: 'complete'
    });

    return this.redis.publish(channel, payload);
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
