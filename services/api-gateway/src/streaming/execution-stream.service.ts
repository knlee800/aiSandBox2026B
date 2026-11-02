import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class ExecutionStreamService implements OnModuleDestroy {
  private publisher: Redis;
  private subscriber: Redis;
  private readonly callbacksByChannel = new Map<string, Set<(token: string) => void>>();

  constructor() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }

    this.publisher = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);
    this.subscriber.on('message', (incomingChannel: string, message: string) => {
      const callbacks = this.callbacksByChannel.get(incomingChannel);
      if (!callbacks) {
        return;
      }
      // Snapshot so one viewer's throw, or an unsubscribe during delivery, does not skip the others.
      for (const callback of Array.from(callbacks)) {
        try {
          callback(message);
        } catch {
          // One throwing viewer must not stop delivery to the others.
        }
      }
    });
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
    let callbacks = this.callbacksByChannel.get(channel);
    const isFirst = callbacks === undefined;
    if (callbacks === undefined) {
      callbacks = new Set<(token: string) => void>();
      this.callbacksByChannel.set(channel, callbacks);
    }
    callbacks.add(onMessage);
    if (isFirst) {
      await this.subscriber.subscribe(channel);
    }
  }

  async unsubscribe(
    executionId: string,
    onMessage: (token: string) => void,
  ) {
    const channel = `ai-execution-stream:${executionId}`;
    const callbacks = this.callbacksByChannel.get(channel);
    if (!callbacks) {
      return;
    }
    callbacks.delete(onMessage);
    if (callbacks.size === 0) {
      this.callbacksByChannel.delete(channel);
      await this.subscriber.unsubscribe(channel);
    }
  }

  async onModuleDestroy() {
    await this.publisher.quit();
    await this.subscriber.quit();
  }
}
