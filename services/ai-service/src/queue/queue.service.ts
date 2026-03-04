import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private connection: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }

    this.connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    this.logger.log('QueueService connected to Redis');
  }

  createQueue(name: string): Queue {
    return new Queue(name, {
      connection: this.connection as any,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection.quit();
  }
}
