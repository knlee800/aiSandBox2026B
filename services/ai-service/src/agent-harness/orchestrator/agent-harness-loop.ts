import type { AIExecutionRequest, AIExecutionResult } from '../../ai-execution/types';
import type {
  AIAdapterToolUseRequestOptions,
  AIAdapterToolUseResult,
} from '../../ai-execution/adapters/adapter-tool-use.contracts';
import type { AgentHarnessConfigV1 } from '../contracts/agent-harness.contracts';

/**
 * Function signature accepted by the loop helper.
 * Wraps adapter.executeWithTools() so the loop is adapter-agnostic.
 */
export type AgentHarnessExecuteWithToolsFn = (
  request: AIExecutionRequest,
  options?: AIAdapterToolUseRequestOptions,
) => Promise<AIAdapterToolUseResult>;

export type AgentHarnessLoopTerminationReason =
  | 'completed'
  | 'no_dispatcher'
  | 'max_iterations'
  | 'aborted';

export interface AgentHarnessLoopOptions {
  readonly executeFn: AgentHarnessExecuteWithToolsFn;
  readonly request: AIExecutionRequest;
  readonly config: Pick<AgentHarnessConfigV1, 'maxToolIterations'>;
  readonly signal?: AbortSignal;
}

export interface AgentHarnessLoopResult {
  readonly result: AIExecutionResult;
  readonly iterationsUsed: number;
  readonly terminationReason: AgentHarnessLoopTerminationReason;
  readonly toolCallsReceived: number;
}

const NO_DISPATCHER_FALLBACK =
  '[Agent Harness] The model requested tool calls, but no tool dispatcher is available. ' +
  'Tool execution is disabled until a future slice provides a dispatcher.';

/**
 * Bounded multi-turn tool loop foundation for Agent Harness v1.
 *
 * Current behavior (no dispatcher available):
 * - Calls executeFn once.
 * - If the adapter returns no tool calls → returns the completed result.
 * - If the adapter returns tool calls → returns a safe fallback (no_dispatcher).
 *
 * Future behavior (when a dispatcher is wired):
 * - Calls executeFn, dispatches tools, feeds results back, and repeats
 *   until the model finishes or maxToolIterations is reached.
 *
 * Safety invariants:
 * - maxToolIterations is a hard ceiling.
 * - No filesystem/write/delete/validation/browser tool executes.
 * - No tool results are generated.
 * - AbortSignal is checked before each iteration.
 */
export async function executeAgentHarnessLoop(
  options: AgentHarnessLoopOptions,
): Promise<AgentHarnessLoopResult> {
  const { executeFn, request, config, signal } = options;
  const maxIterations = Math.max(1, config.maxToolIterations);
  let totalToolCallsReceived = 0;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    if (signal?.aborted) {
      return {
        result: { output: '', tokensUsed: 0, model: '' },
        iterationsUsed: iteration,
        terminationReason: 'aborted',
        toolCallsReceived: totalToolCallsReceived,
      };
    }

    const adapterResult = await executeFn(request);
    const toolCalls = adapterResult.toolCalls ?? [];
    totalToolCallsReceived += toolCalls.length;

    if (adapterResult.finishReason !== 'tool_calls' || toolCalls.length === 0) {
      return {
        result: {
          output: adapterResult.output,
          tokensUsed: adapterResult.tokensUsed,
          model: adapterResult.model,
          provider: adapterResult.provider,
          fileActions: adapterResult.fileActions,
        },
        iterationsUsed: iteration + 1,
        terminationReason: 'completed',
        toolCallsReceived: totalToolCallsReceived,
      };
    }

    // Tool calls requested but no dispatcher exists in this slice.
    // Future: dispatch tools, collect results, build next request, continue loop.
    return {
      result: {
        output: adapterResult.output
          ? `${adapterResult.output}\n\n${NO_DISPATCHER_FALLBACK}`
          : NO_DISPATCHER_FALLBACK,
        tokensUsed: adapterResult.tokensUsed,
        model: adapterResult.model,
        provider: adapterResult.provider,
        fileActions: adapterResult.fileActions,
      },
      iterationsUsed: iteration + 1,
      terminationReason: 'no_dispatcher',
      toolCallsReceived: totalToolCallsReceived,
    };
  }

  return {
    result: {
      output: '[Agent Harness] Maximum tool iterations reached without completion.',
      tokensUsed: 0,
      model: '',
    },
    iterationsUsed: maxIterations,
    terminationReason: 'max_iterations',
    toolCallsReceived: totalToolCallsReceived,
  };
}
