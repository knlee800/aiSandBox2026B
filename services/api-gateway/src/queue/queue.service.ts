import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);

  private connection: Redis;
  private queue: Queue;

  constructor() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }

    this.connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    this.queue = new Queue('ai-execution', {
      connection: this.connection,
    });

    this.logger.log('QueueService connected to Redis');
  }

  /**
   * Enqueue AI execution job.
   *
   * Phase-51.3: attempts=1 (no BullMQ retries).
   * Transient failure handling is done in-worker via in-job retry loop.
   * BullMQ retries would re-run the job after ledger claim, risking
   * duplicate execution or ledger inconsistency. In-worker retry keeps
   * exactly-once semantics and ledger as source of truth.
   */
  async enqueueExecution(jobData: any): Promise<void> {
    await this.queue.add('execute-ai', jobData, {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }
}
