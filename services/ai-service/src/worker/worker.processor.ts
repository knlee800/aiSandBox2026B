import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { AIExecutionService } from '../ai-execution/ai-execution.service';
import { ExecutionStreamPublisher } from '../streaming/execution-stream.publisher';

@Injectable()
export class WorkerProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerProcessor.name);

  private connection: Redis;
  private worker: Worker;

  constructor(
    private readonly dataSource: DataSource,
    private readonly aiExecutionService: AIExecutionService,
    private readonly executionStreamPublisher: ExecutionStreamPublisher,
  ) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }

    this.connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker(
      'ai-execution',
      async (job: Job) => {
        const executionId = job.data.executionId;

        this.logger.log(
          `Worker received job ${job.id} executionId=${executionId}`,
        );

        const result = await this.dataSource.query(
          `
          UPDATE usage_records
          SET execution_status = 'running'
          WHERE execution_id = $1
          AND execution_status = 'pending'
          RETURNING execution_id
          `,
          [executionId],
        );

        if (result.length === 0) {
          this.logger.warn(
            `Duplicate job detected, skipping executionId=${executionId}`,
          );
          return;
        }

        this.logger.log(`Worker claimed executionId=${executionId}`);

        try {
          const aiResult = await this.aiExecutionService.execute({
            provider: job.data.provider,
            prompt: job.data.prompt,
            sessionId: job.data.sessionId,
            conversationId: job.data.conversationId,
            userId: job.data.userId,
          });

          this.logger.log(
            `AI execution completed executionId=${executionId} tokens=${aiResult.tokensUsed}`,
          );

          if (aiResult.output) {
            this.executionStreamPublisher.publishToken(
              executionId,
              aiResult.output,
            );
          }

          await this.dataSource.query(
            `
            UPDATE usage_records
            SET execution_status = 'completed',
                tokens_used = $2
            WHERE execution_id = $1
            `,
            [executionId, aiResult.tokensUsed ?? 0],
          );

          this.executionStreamPublisher.publishCompletion(executionId);

          this.logger.log(`Ledger finalized executionId=${executionId}`);
        } catch (error) {
          this.logger.error(
            `AI execution failed executionId=${executionId}: ${error.message}`,
          );

          await this.dataSource.query(
            `
            UPDATE usage_records
            SET execution_status = 'failed'
            WHERE execution_id = $1
            `,
            [executionId],
          );

          throw error;
        }
      },
      {
        connection: this.connection as any,
      },
    );

    this.logger.log('Worker connected to ai-execution queue');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    await this.connection.quit();
  }
}
