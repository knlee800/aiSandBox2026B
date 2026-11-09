import type { AIAdapterToolUseResult } from '../../../ai-execution/adapters/adapter-tool-use.contracts';
import type { AgentHarnessExecuteWithToolsFn } from '../../orchestrator/agent-harness-loop';
import { scrubError } from './live-adapter';
import {
  TOKEN_CAP_REACHED_REASON,
  type LiveExecuteAdapter,
  type LiveTokenUsage,
} from './live-execute';

/**
 * Whole-run cap for the briefing injection eval (nine cases, two or three
 * model calls each). Same as the reviewer eval's cap.
 */
export const DEFAULT_BRIEFING_MAX_TOTAL_TOKENS = 150_000;

export interface CreateBriefingLiveExecuteFnOptions {
  readonly adapter: LiveExecuteAdapter;
  /** Default 150000. Compared against tokens already returned by the adapter. */
  readonly maxTotalTokens?: number;
  /** Shared counter. The suite reads it between cases. */
  readonly tokenUsage?: LiveTokenUsage;
  /**
   * Environment that may hold ANTHROPIC_API_KEY. Used only to strip that
   * value from adapter errors. Never written to a request, log, or result.
   */
  readonly env?: NodeJS.ProcessEnv;
  /** Full output of a call that ends the loop, by executionId. */
  readonly completedOutputs?: Map<string, string>;
}

/**
 * Model call for one briefing step.
 *
 * Unlike the coding and reviewer live mirrors, this function does not
 * rebuild the request: runBriefingTask already builds the worker's request
 * (briefing-prompt.ts, with provider 'anthropic' when the live runner asks
 * for it) and merges the worker's advertised tools into every call. So the
 * scripted tests and a live run send the same prompt and tool list.
 *
 * When tokenUsage.totalTokens is already at maxTotalTokens it does not call
 * the adapter and throws TOKEN_CAP_REACHED_REASON.
 */
export function createBriefingLiveExecuteFn(
  options: CreateBriefingLiveExecuteFnOptions,
): AgentHarnessExecuteWithToolsFn {
  const maxTotalTokens = options.maxTotalTokens ?? DEFAULT_BRIEFING_MAX_TOTAL_TOKENS;
  if (!Number.isInteger(maxTotalTokens) || maxTotalTokens < 0) {
    throw new Error('maxTotalTokens must be a non-negative integer');
  }
  if (typeof options.adapter?.executeWithTools !== 'function') {
    throw new Error('briefing live execute requires an adapter with executeWithTools');
  }
  const usage = options.tokenUsage ?? { totalTokens: 0 };
  const executeWithTools = options.adapter.executeWithTools.bind(options.adapter);
  const secret = options.env?.ANTHROPIC_API_KEY;

  return async (request, executeOptions) => {
    if (usage.totalTokens >= maxTotalTokens) {
      throw new Error(TOKEN_CAP_REACHED_REASON);
    }
    if (request.provider !== 'anthropic') {
      throw new Error('briefing live execute expects an anthropic request');
    }
    if (!executeOptions?.tools || executeOptions.tools.length === 0) {
      throw new Error('briefing live execute expects the advertised tools');
    }
    let result: AIAdapterToolUseResult;
    try {
      result = await executeWithTools(request, executeOptions);
    } catch (err) {
      throw scrubError(err, secret);
    }
    if (options.completedOutputs && isCompletingModelResult(result)) {
      options.completedOutputs.set(
        request.executionId ?? '',
        typeof result.output === 'string' ? result.output : '',
      );
    }
    const used = result.tokensUsed;
    usage.totalTokens += typeof used === 'number' && Number.isFinite(used) ? used : 0;
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
