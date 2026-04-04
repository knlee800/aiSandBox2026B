import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Worker, Job, Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { AIExecutionService } from '../ai-execution/ai-execution.service';
import { ExecutionStreamPublisher } from '../streaming/execution-stream.publisher';
import {
  incExecutionStarted,
  incExecutionCompleted,
  incExecutionFailed,
  incExecutionCancelled,
  observeExecutionLatency,
} from '../observability/execution-metrics';
import { observeQueueLag } from '../observability/queue-metrics';
import {
  incrementWorkerClaim,
  incrementStuckRecovered,
} from '../observability/worker-metrics';

/**
 * Phase-51.3: Conservative classifier for transient (retryable) errors.
 * Retries only for: timeout, connection reset, 429, 503, overloaded.
 * Non-transient: 400 validation, auth, quota, prompt errors.
 */
function isRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /timeout|timed out|ECONNRESET|ENOTFOUND|429|503|overloaded/i.test(msg);
}

/**
 * Phase-51.3: Sleep with AbortSignal support. Rejects if aborted during wait.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timeout = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timeout);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

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
  private queueEventsConnection: Redis;
  private queue: Queue;
  private queueEvents: QueueEvents;
  private worker: Worker;
  private readonly workerId = process.pid;
  private stuckScanIntervalHandle: ReturnType<typeof setInterval> | null = null;

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

  /**
   * Phase-51.2: QueueEvents handlers for worker crash resilience.
   * Monitors queue lifecycle events to maintain ledger consistency.
   */
  private setupQueueEventsHandlers(): void {
    this.queueEvents.on('failed', async ({ jobId, failedReason }) => {
      const executionId = await this.getExecutionIdFromJob(jobId);
      this.logger.log(
        `QueueEvent: job failed executionId=${executionId ?? 'unknown'} workerId=${this.workerId} jobId=${jobId}`,
      );
      if (executionId) {
        const result = await this.dataSource.query(
          `
          UPDATE usage_records
          SET execution_status = 'failed'
          WHERE execution_id = $1
          AND execution_status = 'running'
          RETURNING execution_id
          `,
          [executionId],
        );
        if (result.length > 0) {
          incExecutionFailed();
          this.executionStreamPublisher.publishCompletion(executionId);
        }
      }
    });

    this.queueEvents.on('stalled', async ({ jobId }) => {
      const executionId = await this.getExecutionIdFromJob(jobId);
      this.logger.log(
        `QueueEvent: job stalled executionId=${executionId ?? 'unknown'} workerId=${this.workerId} jobId=${jobId}`,
      );
    });

    this.queueEvents.on('completed', async ({ jobId }) => {
      const executionId = await this.getExecutionIdFromJob(jobId);
      this.logger.debug(
        `QueueEvent: job completed executionId=${executionId ?? 'unknown'} workerId=${this.workerId} jobId=${jobId}`,
      );
    });
  }

  private async getExecutionIdFromJob(jobId: string): Promise<string | null> {
    try {
      const job = await this.queue.getJob(jobId);
      return job?.data?.executionId ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Phase-51.5: Stuck execution watchdog scanner.
   * Detects executions stuck in 'running' beyond allowed timeout.
   * Read-only detection; only updates ledger when confirmed stuck.
   * Never triggers AI execution.
   */
  private async scanForStuckExecutions(): Promise<void> {
    const EXECUTION_TIMEOUT_MS = parseInt(
      process.env.EXECUTION_TIMEOUT_MS ?? '20000',
      10,
    );
    const stuckThresholdSeconds = Math.ceil(
      (EXECUTION_TIMEOUT_MS * 2) / 1000,
    );

    const rows = (await this.dataSource.query(
      `
      SELECT execution_id, timestamp
      FROM usage_records
      WHERE execution_status = 'running'
      AND timestamp < NOW() - INTERVAL '1 second' * $1
      LIMIT 50
      `,
      [stuckThresholdSeconds],
    )) as Array<{ execution_id: string; timestamp: string }>;

    for (const row of rows) {
      const executionId = row.execution_id;
      const result = await this.dataSource.query(
        `
        UPDATE usage_records
        SET execution_status = 'failed'
        WHERE execution_id = $1
        AND execution_status = 'running'
        RETURNING execution_id
        `,
        [executionId],
      );

      if (result.length > 0) {
        incExecutionFailed();
        incrementStuckRecovered();
        this.executionStreamPublisher.publishCompletion(executionId);
        const runtimeMs = Math.round(
          Date.now() - new Date(row.timestamp).getTime(),
        );
        this.logger.warn(
          `Recovered stuck execution executionId=${executionId} workerId=${this.workerId} runtime_ms=${runtimeMs}`,
        );
      }
    }
  }

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }

    this.connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    this.queueEventsConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    this.queue = new Queue('ai-execution', {
      connection: this.connection as any,
    });

    this.queueEvents = new QueueEvents('ai-execution', {
      connection: this.queueEventsConnection as any,
    });

    this.setupQueueEventsHandlers();

    const concurrency = Math.max(
      1,
      parseInt(process.env.EXECUTION_WORKER_CONCURRENCY ?? '4', 10) || 4,
    );

    const EXECUTION_TIMEOUT_MS = parseInt(
      process.env.EXECUTION_TIMEOUT_MS ?? '20000',
      10,
    );
    const lockDuration = Math.max(EXECUTION_TIMEOUT_MS + 10000, 30000);

    const EXECUTION_PROVIDER_RETRY_ATTEMPTS = Math.max(
      1,
      Math.min(10, parseInt(process.env.EXECUTION_PROVIDER_RETRY_ATTEMPTS ?? '3', 10) || 3),
    );
    const EXECUTION_PROVIDER_RETRY_BASE_DELAY_MS = Math.max(
      50,
      Math.min(10000, parseInt(process.env.EXECUTION_PROVIDER_RETRY_BASE_DELAY_MS ?? '250', 10) || 250),
    );
    const stalledInterval = Math.min(15000, Math.floor(lockDuration / 2));

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
          const statusCheck = await this.dataSource.query(
            `SELECT execution_status FROM usage_records WHERE execution_id = $1`,
            [executionId],
          );
          const currentStatus = statusCheck[0]?.execution_status;

          if (currentStatus === 'running') {
            const stalledResult = await this.dataSource.query(
              `
              UPDATE usage_records
              SET execution_status = 'failed'
              WHERE execution_id = $1
              AND execution_status = 'running'
              RETURNING execution_id
              `,
              [executionId],
            );
            if (stalledResult.length > 0) {
              incExecutionFailed();
              incrementStuckRecovered();
              this.executionStreamPublisher.publishCompletion(executionId);
              this.logger.warn(
                `Stalled job recovered, marked failed executionId=${executionId} workerId=${this.workerId}`,
              );
            }
          } else if (currentStatus === 'cancel_requested') {
            await this.dataSource.query(
              `
              UPDATE usage_records
              SET execution_status = 'cancelled'
              WHERE execution_id = $1
              `,
              [executionId],
            );
            this.executionStreamPublisher.publishCompletion(executionId);
            this.logger.warn(
              `Claim failed, cancel_requested: set cancelled executionId=${executionId}`,
            );
          } else {
            this.logger.warn(
              `Duplicate job detected, skipping executionId=${executionId}`,
            );
          }
          return;
        }

        const claimTime = Date.now();
        incrementWorkerClaim();
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

        if (queueWaitMs != null) {
          observeQueueLag(queueWaitMs / 1000);
        }

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

          incExecutionCancelled();
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

        incExecutionStarted();
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
            incExecutionFailed();
            this.executionStreamPublisher.publishCompletion(executionId);
            this.metrics.execution_timeout_total++;
            const durationMs = Math.round(performance.now() - executionStartTime);
            observeExecutionLatency(durationMs / 1000);
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
          let aiResult: Awaited<ReturnType<AIExecutionService['execute']>>;
          let lastError: unknown;
          for (let attempt = 0; attempt < EXECUTION_PROVIDER_RETRY_ATTEMPTS; attempt++) {
            try {
              aiResult = await this.aiExecutionService.execute({
                provider: job.data.provider,
                prompt: job.data.prompt,
                sessionId: job.data.sessionId,
                conversationId: job.data.conversationId,
                userId: job.data.userId,
                signal: abortController.signal,
              });
              break;
            } catch (err) {
              lastError = err;
              if (abortController.signal.aborted) throw err;
              if (!isRetryableError(err)) throw err;
              if (attempt === EXECUTION_PROVIDER_RETRY_ATTEMPTS - 1) throw err;
              const delay = EXECUTION_PROVIDER_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
              this.logger.log(
                `Transient retry attempt ${attempt + 1}/${EXECUTION_PROVIDER_RETRY_ATTEMPTS} for executionId=${executionId}, delay=${delay}ms`,
              );
              await sleep(delay, abortController.signal);
            }
          }
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

            incExecutionCancelled();
            this.metrics.execution_cancelled_total++;
            const durationMs = Math.round(performance.now() - executionStartTime);
            observeExecutionLatency(durationMs / 1000);
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

          const safeFileActions = Array.isArray(aiResult.fileActions)
            ? aiResult.fileActions
            : [];

          if (aiResult.output) {
            this.executionStreamPublisher.publishToken(
              executionId,
              aiResult.output,
            );
          }

          this.executionStreamPublisher.publishFileActions(
            executionId,
            safeFileActions,
          );

          const metadataRows = await this.dataSource.query(
            `
            SELECT metadata
            FROM usage_records
            WHERE execution_id = $1
            `,
            [executionId],
          );

          const metadataValue = metadataRows[0]?.metadata;
          let existingMetadata: Record<string, unknown> = {};
          if (metadataValue && typeof metadataValue === 'object') {
            existingMetadata = metadataValue as Record<string, unknown>;
          } else if (typeof metadataValue === 'string') {
            try {
              const parsed = JSON.parse(metadataValue) as unknown;
              if (parsed && typeof parsed === 'object') {
                existingMetadata = parsed as Record<string, unknown>;
              }
            } catch {
              existingMetadata = {};
            }
          }

          const nextMetadata = {
            ...existingMetadata,
            aiExecutionResult: {
              output: aiResult.output,
              tokensUsed: aiResult.tokensUsed ?? 0,
              model: aiResult.model,
              provider: job.data.provider,
              fileActions: safeFileActions,
            },
          };

          await this.dataSource.query(
            `
            UPDATE usage_records
            SET execution_status = 'completed',
                tokens_used = $2,
                metadata = $3::jsonb
            WHERE execution_id = $1
            `,
            [executionId, aiResult.tokensUsed ?? 0, JSON.stringify(nextMetadata)],
          );

          this.executionStreamPublisher.publishCompletion(executionId);

          incExecutionCompleted();
          this.metrics.execution_completed_total++;
          const durationMs = Math.round(performance.now() - executionStartTime);
          observeExecutionLatency(durationMs / 1000);
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

            incExecutionCancelled();
            this.metrics.execution_cancelled_total++;
            const durationMs = Math.round(performance.now() - executionStartTime);
            observeExecutionLatency(durationMs / 1000);
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

          incExecutionFailed();
          this.metrics.execution_failed_total++;
          const durationMs = Math.round(performance.now() - executionStartTime);
          observeExecutionLatency(durationMs / 1000);
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
        lockDuration,
        stalledInterval,
        maxStalledCount: 1,
      },
    );

    this.logger.log('Worker connected to ai-execution queue');

    const scanIntervalMs = parseInt(
      process.env.EXECUTION_STUCK_SCAN_INTERVAL_MS ?? '30000',
      10,
    );
    this.stuckScanIntervalHandle = setInterval(() => {
      this.scanForStuckExecutions().catch((err) => {
        this.logger.error(
          `Stuck execution scan failed: ${err?.message ?? String(err)}`,
        );
      });
    }, scanIntervalMs);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.stuckScanIntervalHandle) {
      clearInterval(this.stuckScanIntervalHandle);
      this.stuckScanIntervalHandle = null;
    }
    await this.queueEvents.close();
    await this.worker.close();
    await this.queueEventsConnection.quit();
    await this.connection.quit();
  }
}
