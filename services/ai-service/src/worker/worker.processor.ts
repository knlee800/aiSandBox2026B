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

interface ExecutionCompletionLog {
  event: string;
  executionId: string;
  provider: string;
  workerId?: number;
  queue_wait_ms?: number;
  duration_ms: number;
  tokens?: number;
  execution_status: string;
  metrics?: {
    execution_completed_total: number;
    execution_failed_total: number;
    execution_cancelled_total: number;
    execution_timeout_total: number;
  };
}

@Injectable()
export class WorkerProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerProcessor.name);

  private metrics = {
    execution_completed_total: 0,
    execution_failed_total: 0,
    execution_cancelled_total: 0,
    execution_timeout_total: 0,
  };

  private connection: Redis;
  private worker: Worker;
  private readonly workerId = process.pid;

  constructor(
    private readonly dataSource: DataSource,
    private readonly aiExecutionService: AIExecutionService,
    private readonly executionStreamPublisher: ExecutionStreamPublisher,
  ) {}

  /**
   * Phase-49: Expose metrics for internal endpoint.
   * Returns a copy to prevent external mutation.
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Phase-49: Emit structured execution completion log.
   * Non-intrusive, read-only instrumentation.
   */
  private logExecutionCompletion(payload: ExecutionCompletionLog): void {
    this.logger.log(JSON.stringify(payload));
  }

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }

    this.connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    const concurrency = Math.max(
      1,
      parseInt(process.env.EXECUTION_WORKER_CONCURRENCY ?? '4', 10) || 4,
    );

    this.worker = new Worker(
      'ai-execution',
      async (job: Job) => {
        const executionId = job.data.executionId;
        const provider = job.data.provider ?? 'unknown';
        const executionStartTime = performance.now();

        this.logger.log(
          `Worker received job ${job.id} executionId=${executionId} workerId=${this.workerId}`,
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

        const claimTime = Date.now();
        this.logger.log(
          `Worker claimed executionId=${executionId} workerId=${this.workerId}`,
        );

        const cancelCheck = await this.dataSource.query(
          `
          SELECT execution_status, created_at
          FROM usage_records
          WHERE execution_id = $1
          `,
          [executionId],
        );

        const intentCreatedAt = cancelCheck[0]?.created_at;
        const queueWaitMs =
          intentCreatedAt != null
            ? Math.round(claimTime - new Date(intentCreatedAt).getTime())
            : undefined;

        if (cancelCheck[0]?.execution_status === 'cancel_requested') {
          await this.dataSource.query(
            `
            UPDATE usage_records
            SET execution_status = 'cancelled'
            WHERE execution_id = $1
            `,
            [executionId],
          );

          this.executionStreamPublisher.publishCompletion(executionId);

          this.metrics.execution_cancelled_total++;
          const durationMs = Math.round(performance.now() - executionStartTime);
          this.logExecutionCompletion({
            event: 'execution_completed',
            executionId,
            provider,
            workerId: this.workerId,
            ...(queueWaitMs != null && { queue_wait_ms: queueWaitMs }),
            duration_ms: durationMs,
            tokens: 0,
            execution_status: 'cancelled',
            metrics: { ...this.metrics },
          });

          this.logger.warn(
            `Execution cancelled before start executionId=${executionId}`,
          );
          return;
        }

        const EXECUTION_TIMEOUT_MS = parseInt(
          process.env.EXECUTION_TIMEOUT_MS ?? '20000',
          10,
        );

        const abortController = new AbortController();
        let cancelled = false;
        let timedOut = false;
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

        const clearTimeoutWatchdog = () => {
          if (timeoutHandle !== null) {
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
          }
        };

        timeoutHandle = setTimeout(async () => {
          if (abortController.signal.aborted || cancelled || timedOut) return;
          timedOut = true;
          abortController.abort();

          const result = await this.dataSource.query(
            `
            UPDATE usage_records
            SET execution_status = 'timeout'
            WHERE execution_id = $1
            AND execution_status = 'running'
            RETURNING execution_id
            `,
            [executionId],
          );

          if (result.length > 0) {
            this.executionStreamPublisher.publishCompletion(executionId);
            this.metrics.execution_timeout_total++;
            const durationMs = Math.round(performance.now() - executionStartTime);
            this.logExecutionCompletion({
              event: 'execution_completed',
              executionId,
              provider,
              workerId: this.workerId,
              ...(queueWaitMs != null && { queue_wait_ms: queueWaitMs }),
              duration_ms: durationMs,
              tokens: 0,
              execution_status: 'timeout',
              metrics: { ...this.metrics },
            });
            this.logger.warn(
              `Execution timed out executionId=${executionId}`,
            );
          }
        }, EXECUTION_TIMEOUT_MS);

        const pollCancel = async () => {
          if (abortController.signal.aborted || cancelled) return;

          const poll = await this.dataSource.query(
            `SELECT execution_status FROM usage_records WHERE execution_id = $1`,
            [executionId],
          );

          if (poll[0]?.execution_status === 'cancel_requested') {
            abortController.abort();
            return;
          }

          setTimeout(pollCancel, 1000);
        };

        pollCancel();

        try {
          const aiResult = await this.aiExecutionService.execute({
            provider: job.data.provider,
            prompt: job.data.prompt,
            sessionId: job.data.sessionId,
            conversationId: job.data.conversationId,
            userId: job.data.userId,
            signal: abortController.signal,
          });

          cancelled = true;
          clearTimeoutWatchdog();

          this.logger.log(
            `AI execution completed executionId=${executionId} tokens=${aiResult.tokensUsed}`,
          );

          const statusCheck = await this.dataSource.query(
            `
            SELECT execution_status
            FROM usage_records
            WHERE execution_id = $1
            `,
            [executionId],
          );

          if (statusCheck[0]?.execution_status === 'cancel_requested') {
            cancelled = true;
            abortController.abort();
            clearTimeoutWatchdog();

            await this.dataSource.query(
              `
              UPDATE usage_records
              SET execution_status = 'cancelled'
              WHERE execution_id = $1
              `,
              [executionId],
            );

            this.executionStreamPublisher.publishCompletion(executionId);

            this.metrics.execution_cancelled_total++;
            const durationMs = Math.round(performance.now() - executionStartTime);
            this.logExecutionCompletion({
              event: 'execution_completed',
              executionId,
              provider,
              workerId: this.workerId,
              ...(queueWaitMs != null && { queue_wait_ms: queueWaitMs }),
              duration_ms: durationMs,
              tokens: aiResult.tokensUsed ?? 0,
              execution_status: 'cancelled',
              metrics: { ...this.metrics },
            });

            this.logger.warn(
              `Execution cancelled during run executionId=${executionId}`,
            );
            return;
          }

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

          this.metrics.execution_completed_total++;
          const durationMs = Math.round(performance.now() - executionStartTime);
          this.logExecutionCompletion({
            event: 'execution_completed',
            executionId,
            provider,
            workerId: this.workerId,
            ...(queueWaitMs != null && { queue_wait_ms: queueWaitMs }),
            duration_ms: durationMs,
            tokens: aiResult.tokensUsed ?? 0,
            execution_status: 'completed',
            metrics: { ...this.metrics },
          });

          this.logger.log(`Ledger finalized executionId=${executionId}`);
        } catch (error) {
          cancelled = true;

          const isAbort =
            error instanceof Error &&
            (error.name === 'AbortError' || abortController.signal.aborted);

          if (isAbort) {
            if (timedOut) {
              return;
            }
            clearTimeoutWatchdog();
            await this.dataSource.query(
              `
              UPDATE usage_records
              SET execution_status = 'cancelled'
              WHERE execution_id = $1
              `,
              [executionId],
            );

            this.executionStreamPublisher.publishCompletion(executionId);

            this.metrics.execution_cancelled_total++;
            const durationMs = Math.round(performance.now() - executionStartTime);
            this.logExecutionCompletion({
              event: 'execution_completed',
              executionId,
              provider,
              workerId: this.workerId,
              ...(queueWaitMs != null && { queue_wait_ms: queueWaitMs }),
              duration_ms: durationMs,
              tokens: 0,
              execution_status: 'cancelled',
              metrics: { ...this.metrics },
            });

            this.logger.warn(
              `Execution aborted executionId=${executionId}`,
            );
            return;
          }

          clearTimeoutWatchdog();

          this.metrics.execution_failed_total++;
          const durationMs = Math.round(performance.now() - executionStartTime);
          this.logExecutionCompletion({
            event: 'execution_completed',
            executionId,
            provider,
            workerId: this.workerId,
            ...(queueWaitMs != null && { queue_wait_ms: queueWaitMs }),
            duration_ms: durationMs,
            tokens: 0,
            execution_status: 'failed',
            metrics: { ...this.metrics },
          });

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
        concurrency,
      },
    );

    this.logger.log('Worker connected to ai-execution queue');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    await this.connection.quit();
  }
}
