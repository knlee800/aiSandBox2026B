import type { AIAdapterToolUseResult } from '../../../ai-execution/adapters/adapter-tool-use.contracts';
import { selectAdvertisedAgentHarnessTools } from '../../../ai-execution/adapters/adapter-tool-use.mapper';
import type { AgentHarnessExecuteWithToolsFn } from '../../orchestrator/agent-harness-loop';
import type { AgentHarnessToolRegistryDefinitionV1 } from '../../tools/tool-registry.contracts';
import {
  buildAIExecutionRequest,
  buildExecutionPromptParts,
  mergeAdvertisedToolsIntoExecuteOptions,
  requireNonEmptyAdvertisedHarnessTools,
  resolveWorkerExecutionIntent,
} from '../../../worker/worker.processor';
import type { ReviewTask } from '../review-types';
import { scrubError } from './live-adapter';
import {
  evalExecutionId,
  TOKEN_CAP_REACHED_REASON,
  workspaceContextFromInitialFiles,
  type LiveExecuteAdapter,
  type LiveTokenUsage,
} from './live-execute';

/**
 * Approved whole-run cap for the reviewer eval. The harness live runner's
 * default is 300_000; this run is 150_000.
 */
export const DEFAULT_REVIEW_MAX_TOTAL_TOKENS = 150_000;

/**
 * Gateway startReferralExecution sets executionIntent: 'conversation' on
 * every collaboration hand-off job, including a coding-team reviewer step
 * (services/api-gateway/src/orchestration/orchestration.service.ts).
 * The worker passes resolveWorkerExecutionIntent(job.data.executionIntent)
 * into buildExecutionPromptParts (worker.processor.ts). For that gateway
 * value the resolver returns 'conversation'.
 */
export const REVIEW_LIVE_EXECUTION_INTENT = resolveWorkerExecutionIntent(
  'conversation',
);

/**
 * Handlers the worker registers for signedToolProfile 'review':
 * read_file, list_files, search_workspace, and run_validation.
 * write and delete stay off (the profile is not 'write').
 * Browser smoke stays off.
 * search_knowledge and read_knowledge are not registered. The worker adds
 * those only when the profile is 'read' and knowledge scopes are non-empty.
 * The coding-team reviewer profile is 'review' and has no knowledge scopes,
 * and this eval has no knowledge store.
 */
const REVIEW_REGISTERED_TOOL_IDS = [
  'read_file',
  'list_files',
  'search_workspace',
  'run_validation',
] as const;

export function advertisedReviewHarnessTools(): readonly AgentHarnessToolRegistryDefinitionV1[] {
  return requireNonEmptyAdvertisedHarnessTools(
    selectAdvertisedAgentHarnessTools({
      registeredHandlerNames: REVIEW_REGISTERED_TOOL_IDS,
      enableWriteTools: false,
      enableValidationTools: true,
      enableBrowserSmoke: false,
    }),
  );
}

export interface CreateReviewLiveExecuteFnOptions {
  readonly tasks: readonly ReviewTask[];
  readonly adapter: LiveExecuteAdapter;
  /** Default 150000. Compared against tokens already returned by the adapter. */
  readonly maxTotalTokens?: number;
  /** Shared counter. The suite reads it between tasks. */
  readonly tokenUsage?: LiveTokenUsage;
  /**
   * Environment that may hold ANTHROPIC_API_KEY. Used only to strip that
   * value from adapter errors. Never written to a request, log, or result.
   */
  readonly env?: NodeJS.ProcessEnv;
  /**
   * Full model output for a call that ends the loop (not a tool-call turn),
   * stored under the request executionId. The runner writes this text,
   * uncapped, into the answers file.
   */
  readonly completedOutputs?: Map<string, string>;
}

/**
 * Model call for one coding-team reviewer step.
 *
 * runReviewTask hands this function a stub request (provider "stub",
 * executionId eval-<taskId>, prompt = the hand-off task). This function
 * finds that review task, rebuilds the request the way the worker builds
 * a reviewer step, and calls the adapter with the review-profile tools.
 *
 * When tokenUsage.totalTokens is already at maxTotalTokens, it does not
 * call the adapter. It throws TOKEN_CAP_REACHED_REASON so the current task
 * ends as error. The suite records tasks not yet started as not run.
 */
export function createReviewLiveExecuteFn(
  options: CreateReviewLiveExecuteFnOptions,
): AgentHarnessExecuteWithToolsFn {
  const maxTotalTokens = options.maxTotalTokens ?? DEFAULT_REVIEW_MAX_TOTAL_TOKENS;
  if (!Number.isInteger(maxTotalTokens) || maxTotalTokens < 0) {
    throw new Error('maxTotalTokens must be a non-negative integer');
  }
  if (typeof options.adapter?.executeWithTools !== 'function') {
    throw new Error('review live execute requires an adapter with executeWithTools');
  }
  const usage = options.tokenUsage ?? { totalTokens: 0 };
  const tasksByExecutionId = new Map(
    options.tasks.map((task) => [evalExecutionId(task.id), task] as const),
  );
  const advertisedTools = advertisedReviewHarnessTools();
  const executeWithTools = options.adapter.executeWithTools.bind(options.adapter);
  const secret = options.env?.ANTHROPIC_API_KEY;
  const completedOutputs = options.completedOutputs;

  return async (request, executeOptions) => {
    if (usage.totalTokens >= maxTotalTokens) {
      throw new Error(TOKEN_CAP_REACHED_REASON);
    }
    const executionId = request.executionId ?? '';
    const task = tasksByExecutionId.get(executionId);
    if (!task) {
      throw new Error(
        `review live execute has no review task for executionId ${executionId}`,
      );
    }
    const promptParts = buildExecutionPromptParts(
      task.handoffTask,
      workspaceContextFromInitialFiles(task.initialFiles),
      undefined,
      task.reviewerPrompt,
      { useHarness: true, executionIntent: REVIEW_LIVE_EXECUTION_INTENT },
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
    if (completedOutputs && isCompletingModelResult(result)) {
      completedOutputs.set(
        executionId,
        typeof result.output === 'string' ? result.output : '',
      );
    }
    usage.totalTokens += finiteTokenCount(result);
    return result;
  };
}

function isCompletingModelResult(result: AIAdapterToolUseResult): boolean {
  const toolCalls =
    result.canonicalToolCalls && result.canonicalToolCalls.length > 0
      ? result.canonicalToolCalls.length
      : result.toolCalls?.length ?? 0;
  return result.finishReason !== 'tool_calls' || toolCalls === 0;
}

function finiteTokenCount(result: AIAdapterToolUseResult): number {
  const used = result.tokensUsed;
  return typeof used === 'number' && Number.isFinite(used) ? used : 0;
}
