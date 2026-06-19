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
import type { AIExecutionRequest } from '../ai-execution/types';
import type { WorkspaceContext } from '../queue/job.types';

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

const FILE_ACTION_OUTPUT_CONTRACT = `Execution output contract:
- If the user request requires creating, modifying, or deleting files, you MUST emit a fenced code block tagged \`file-actions\`.
- The \`file-actions\` block content MUST be valid JSON containing an array of actions.
- Each action MUST use action value "create", "write", "update", or "delete".
- "create", "write", and "update" actions MUST include string fields: "path" and "content".
- "delete" actions MUST include string field "path" and MUST NOT include or require "content".
- Do not claim that files were created, changed, or deleted unless matching \`file-actions\` entries are present.
- If the user request does not require file creation, modification, or deletion, respond normally in plain conversational text and do not emit \`file-actions\` blocks.`;

function buildWorkspaceContextBlock(
  workspaceContext?: WorkspaceContext,
): string | null {
  if (!workspaceContext || typeof workspaceContext !== 'object') {
    return null;
  }

  const normalizedFilePaths = Array.isArray(workspaceContext.filePaths)
    ? workspaceContext.filePaths
        .filter((path): path is string => typeof path === 'string')
        .map((path) => path.trim())
        .filter((path) => path.length > 0)
    : [];

  const normalizedSelectedFilePath =
    typeof workspaceContext.selectedFilePath === 'string' &&
    workspaceContext.selectedFilePath.trim().length > 0
      ? workspaceContext.selectedFilePath.trim()
      : null;
  const normalizedSelectedFileContent =
    typeof workspaceContext.selectedFileContent === 'string' &&
    workspaceContext.selectedFileContent.trim().length > 0
      ? workspaceContext.selectedFileContent.trim()
      : null;
  const normalizedNamedFileContents = Array.isArray(workspaceContext.namedFileContents)
    ? workspaceContext.namedFileContents
        .filter(
          (
            file,
          ): file is {
            path: string;
            content: string;
          } =>
            !!file &&
            typeof file === 'object' &&
            typeof file.path === 'string' &&
            typeof file.content === 'string',
        )
        .map((file) => ({
          path: file.path.trim(),
          content: file.content.trim(),
        }))
        .filter((file) => file.path.length > 0 && file.content.length > 0)
    : [];
  const normalizedRepoDocContents = Array.isArray(workspaceContext.repoDocContents)
    ? workspaceContext.repoDocContents
        .filter(
          (
            doc,
          ): doc is {
            path: string;
            content: string;
          } =>
            !!doc &&
            typeof doc === 'object' &&
            typeof doc.path === 'string' &&
            typeof doc.content === 'string',
        )
        .map((doc) => ({
          path: doc.path.trim(),
          content: doc.content.trim(),
        }))
        .filter((doc) => doc.path.length > 0 && doc.content.length > 0)
    : [];
  const normalizedSearchResults =
    workspaceContext.searchResults &&
    typeof workspaceContext.searchResults === 'object' &&
    typeof workspaceContext.searchResults.query === 'string' &&
    workspaceContext.searchResults.query.trim().length > 0
      ? {
          query: workspaceContext.searchResults.query.trim(),
          results: Array.isArray(workspaceContext.searchResults.results)
            ? workspaceContext.searchResults.results
                .filter(
                  (
                    result,
                  ): result is {
                    path: string;
                    line: number;
                    preview: string;
                  } =>
                    !!result &&
                    typeof result === 'object' &&
                    typeof result.path === 'string' &&
                    typeof result.line === 'number' &&
                    Number.isFinite(result.line) &&
                    typeof result.preview === 'string',
                )
                .map((result) => ({
                  path: result.path.trim(),
                  line: Math.max(1, Math.trunc(result.line)),
                  preview: result.preview.trim(),
                }))
                .filter((result) => result.path.length > 0 && result.preview.length > 0)
            : [],
          truncated: workspaceContext.searchResults.truncated === true,
        }
      : null;
  const normalizedProjectName =
    typeof workspaceContext.projectName === 'string' &&
    workspaceContext.projectName.trim().length > 0
      ? workspaceContext.projectName.trim()
      : null;
  const normalizedWorkspaceName =
    typeof workspaceContext.workspaceName === 'string' &&
    workspaceContext.workspaceName.trim().length > 0
      ? workspaceContext.workspaceName.trim()
      : null;

  if (
    normalizedFilePaths.length === 0 &&
    !normalizedSelectedFilePath &&
    !normalizedSelectedFileContent &&
    normalizedNamedFileContents.length === 0 &&
    normalizedRepoDocContents.length === 0 &&
    !normalizedSearchResults &&
    !normalizedProjectName &&
    !normalizedWorkspaceName
  ) {
    return null;
  }

  const sections: string[] = [];
  if (normalizedRepoDocContents.length > 0) {
    sections.push(
      [
        'Repo Docs:',
        ...normalizedRepoDocContents.map(
          (doc) => `Repo doc content: ${doc.path}\n${doc.content}`,
        ),
      ].join('\n\n'),
    );
  }
  if (normalizedProjectName) {
    sections.push(`Current project:\n${normalizedProjectName}`);
  }
  if (normalizedWorkspaceName) {
    sections.push(`Current workspace:\n${normalizedWorkspaceName}`);
  }
  if (normalizedFilePaths.length > 0) {
    sections.push(
      ['Current workspace files:', ...normalizedFilePaths.map((path) => `- ${path}`)].join('\n'),
    );
  }
  if (normalizedSelectedFilePath) {
    sections.push(`Currently open file:\n${normalizedSelectedFilePath}`);
  }
  if (normalizedSelectedFileContent) {
    sections.push(`Selected file content:\n${normalizedSelectedFileContent}`);
  }
  for (const namedFile of normalizedNamedFileContents) {
    sections.push(`Named file content: ${namedFile.path}\n${namedFile.content}`);
  }
  if (normalizedSearchResults) {
    const searchLines =
      normalizedSearchResults.results.length > 0
        ? normalizedSearchResults.results.map(
            (result) => `- ${result.path}:${result.line} - ${result.preview}`,
          )
        : ['(no matches found)'];
    if (normalizedSearchResults.truncated) {
      searchLines.push('[...results truncated]');
    }
    sections.push(
      [`Workspace search results for: ${normalizedSearchResults.query}`, ...searchLines].join(
        '\n',
      ),
    );
  }

  return sections.join('\n\n');
}

function buildGlobalInstructionsBlock(
  globalInstructions?: string | null,
): string | null {
  if (typeof globalInstructions !== 'string') {
    return null;
  }
  const normalizedGlobalInstructions = globalInstructions.trim();
  if (normalizedGlobalInstructions.length === 0) {
    return null;
  }
  return `Global AI Instructions:\n${normalizedGlobalInstructions}`;
}

function buildProjectInstructionsBlock(
  projectInstructions?: string | null,
): string | null {
  if (typeof projectInstructions !== 'string') {
    return null;
  }
  const normalizedProjectInstructions = projectInstructions.trim();
  if (normalizedProjectInstructions.length === 0) {
    return null;
  }
  return `Project AI Instructions:\n${normalizedProjectInstructions}`;
}

export function buildExecutionPromptParts(
  userPrompt: string,
  workspaceContext?: WorkspaceContext,
  globalInstructions?: string | null,
  projectInstructions?: string | null,
): { system: string; user: string } {
  const normalizedPrompt = typeof userPrompt === 'string' ? userPrompt : '';
  const globalInstructionsBlock = buildGlobalInstructionsBlock(globalInstructions);
  const projectInstructionsBlock =
    buildProjectInstructionsBlock(projectInstructions);
  const workspaceContextBlock = buildWorkspaceContextBlock(workspaceContext);
  const systemSections: string[] = [FILE_ACTION_OUTPUT_CONTRACT];
  if (globalInstructionsBlock) {
    systemSections.push(globalInstructionsBlock);
  }
  if (projectInstructionsBlock) {
    systemSections.push(projectInstructionsBlock);
  }
  const userSections: string[] = [];
  if (workspaceContextBlock) {
    userSections.push(workspaceContextBlock);
  }
  userSections.push(`User request:\n${normalizedPrompt}`);
  return {
    system: systemSections.join('\n\n'),
    user: userSections.join('\n\n'),
  };
}

export function buildAIExecutionRequest(
  jobData: {
    provider: AIExecutionRequest['provider'];
    sessionId: string;
    conversationId: string;
    userId: string;
    model?: string;
  },
  promptParts: { system: string; user: string },
  signal?: AbortSignal,
): AIExecutionRequest {
  return {
    provider: jobData.provider,
    prompt: promptParts.user,
    systemPrompt: promptParts.system,
    sessionId: jobData.sessionId,
    conversationId: jobData.conversationId,
    userId: jobData.userId,
    model: jobData.model,
    signal,
  };
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
              const promptParts = buildExecutionPromptParts(
                job.data.prompt ?? '',
                job.data.workspaceContext,
                job.data.globalInstructions,
                job.data.projectInstructions,
              );
              aiResult = await this.aiExecutionService.execute(
                buildAIExecutionRequest(job.data, promptParts, abortController.signal),
              );
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
