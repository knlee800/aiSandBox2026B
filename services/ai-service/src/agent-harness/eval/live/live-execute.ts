import type { AIExecutionRequest } from '../../../ai-execution/types';
import type {
  AIAdapterToolUseRequestOptions,
  AIAdapterToolUseResult,
} from '../../../ai-execution/adapters/adapter-tool-use.contracts';
import { selectAdvertisedAgentHarnessTools } from '../../../ai-execution/adapters/adapter-tool-use.mapper';
import type { AgentHarnessExecuteWithToolsFn } from '../../orchestrator/agent-harness-loop';
import type { AgentHarnessToolRegistryDefinitionV1 } from '../../tools/tool-registry.contracts';
import type { WorkspaceContext } from '../../../queue/job.types';
import {
  buildAIExecutionRequest,
  buildExecutionPromptParts,
  mergeAdvertisedToolsIntoExecuteOptions,
  requireNonEmptyAdvertisedHarnessTools,
} from '../../../worker/worker.processor';
import type { EvalTask } from '../eval-types';
import { scrubError } from './live-adapter';

/** Whole-run cap used when the caller does not pass maxTotalTokens. */
export const DEFAULT_MAX_TOTAL_TOKENS = 300_000;

export const TOKEN_CAP_REACHED_REASON = 'token cap reached';

/**
 * Platform rate: 1 credit per 1,000 tokens, rounded up per task.
 * Zero tokens is zero credits.
 */
export function tokensToCredits(tokens: number): number {
  if (!Number.isFinite(tokens) || tokens <= 0) {
    return 0;
  }
  return Math.ceil(tokens / 1000);
}

export interface LiveTokenUsage {
  totalTokens: number;
}

export interface LiveExecuteAdapter {
  executeWithTools(
    request: AIExecutionRequest,
    options?: AIAdapterToolUseRequestOptions,
  ): Promise<AIAdapterToolUseResult>;
}

export interface CreateLiveExecuteFnOptions {
  readonly tasks: readonly EvalTask[];
  readonly adapter: LiveExecuteAdapter;
  /** Default 300000. Compared against tokens already returned by the adapter. */
  readonly maxTotalTokens?: number;
  /** Shared counter. The suite reads it between tasks. */
  readonly tokenUsage?: LiveTokenUsage;
  /**
   * Environment that may hold ANTHROPIC_API_KEY. Used only to strip that
   * value from adapter errors. Never written to a request, log, or result.
   */
  readonly env?: NodeJS.ProcessEnv;
}

/**
 * Handlers the eval runner registers. delete_file is included because the
 * runner registers it. selectAdvertisedAgentHarnessTools offers delete_file
 * when write tools are on.
 */
const EVAL_REGISTERED_TOOL_IDS = [
  'read_file',
  'list_files',
  'search_workspace',
  'write_file',
  'delete_file',
  'run_validation',
] as const;

/**
 * runEvalTask sets executionId to this form. The live executeFn uses it
 * to find the task whose user prompt and initial files build the request.
 */
export function evalExecutionId(taskId: string): string {
  return `eval-${taskId}`;
}

/**
 * Equivalent of the workspace context the worker forwards into
 * buildExecutionPromptParts. A real Agent job carries the file path list
 * from the client (sorted). Eval has that list as the task's initial files.
 * File bodies stay in the in-memory workspace and are read with tools.
 * There is no open file, project name, or repo-doc set on an eval task.
 */
export function workspaceContextFromInitialFiles(
  initialFiles: Readonly<Record<string, string>>,
): WorkspaceContext {
  const filePaths = Object.keys(initialFiles)
    .map((filePath) => filePath.trim())
    .filter((filePath) => filePath.length > 0)
    .sort((left, right) => left.localeCompare(right));
  return { filePaths };
}

export function advertisedEvalHarnessTools(): readonly AgentHarnessToolRegistryDefinitionV1[] {
  return requireNonEmptyAdvertisedHarnessTools(
    selectAdvertisedAgentHarnessTools({
      registeredHandlerNames: EVAL_REGISTERED_TOOL_IDS,
      enableWriteTools: true,
      enableValidationTools: true,
      enableBrowserSmoke: false,
    }),
  );
}

/**
 * Model call for one harness step.
 *
 * The eval runner hands this function a stub request (provider "stub",
 * prompt = the raw user request). This function rebuilds the request with
 * buildExecutionPromptParts(..., { useHarness: true }) and
 * buildAIExecutionRequest, keeps the runner's executionId, sessionId and
 * model, and calls adapter.executeWithTools with the tools
 * selectAdvertisedAgentHarnessTools returns for write and validation on
 * and browser smoke off, merged the way the worker merges them.
 *
 * When tokenUsage.totalTokens is already at maxTotalTokens, it does not
 * call the adapter. It throws TOKEN_CAP_REACHED_REASON so the current task
 * ends as error. The suite records tasks not yet started as not run.
 */
export function createLiveExecuteFn(
  options: CreateLiveExecuteFnOptions,
): AgentHarnessExecuteWithToolsFn {
  const maxTotalTokens = options.maxTotalTokens ?? DEFAULT_MAX_TOTAL_TOKENS;
  if (!Number.isInteger(maxTotalTokens) || maxTotalTokens < 0) {
    throw new Error('maxTotalTokens must be a non-negative integer');
  }
  if (typeof options.adapter?.executeWithTools !== 'function') {
    throw new Error('live execute requires an adapter with executeWithTools');
  }
  const usage = options.tokenUsage ?? { totalTokens: 0 };
  const tasksByExecutionId = new Map(
    options.tasks.map((task) => [evalExecutionId(task.id), task] as const),
  );
  const advertisedTools = advertisedEvalHarnessTools();
  const executeWithTools = options.adapter.executeWithTools.bind(options.adapter);
  const secret = options.env?.ANTHROPIC_API_KEY;

  return async (request, executeOptions) => {
    if (usage.totalTokens >= maxTotalTokens) {
      throw new Error(TOKEN_CAP_REACHED_REASON);
    }
    const executionId = request.executionId ?? '';
    const task = tasksByExecutionId.get(executionId);
    if (!task) {
      throw new Error(
        `live execute has no eval task for executionId ${executionId}`,
      );
    }
    const promptParts = buildExecutionPromptParts(
      task.userRequest,
      workspaceContextFromInitialFiles(task.initialFiles),
      undefined,
      undefined,
      { useHarness: true },
    );
    const executionRequest = buildAIExecutionRequest(
      {
        provider: 'anthropic',
        executionId,
        sessionId: request.sessionId,
        conversationId: request.conversationId,
        userId: request.userId,
        model: request.model,
      },
      promptParts,
      request.signal,
    );
    let result: AIAdapterToolUseResult;
    try {
      result = await executeWithTools(
        executionRequest,
        mergeAdvertisedToolsIntoExecuteOptions(executeOptions, advertisedTools),
      );
    } catch (err) {
      throw scrubError(err, secret);
    }
    usage.totalTokens += finiteTokenCount(result);
    return result;
  };
}

function finiteTokenCount(result: AIAdapterToolUseResult): number {
  const used = result.tokensUsed;
  return typeof used === 'number' && Number.isFinite(used) ? used : 0;
}
