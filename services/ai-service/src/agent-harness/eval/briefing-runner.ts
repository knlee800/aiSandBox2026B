import type { ApiGatewayHttpClient } from '../../clients/api-gateway-http.client';
import type { AIExecutionRequest } from '../../ai-execution/types';
import type { AIAdapterToolUseResult } from '../../ai-execution/adapters/adapter-tool-use.contracts';
import {
  executeAgentHarnessLoop,
  HarnessMaxIterationsError,
  type AgentHarnessExecuteWithToolsFn,
} from '../orchestrator/agent-harness-loop';
import {
  CONNECTOR_MAIL_TOOL_ID,
  CONNECTOR_TOOL_IDS,
  isConnectorToolId,
} from '../tools/connector-tool-definitions';
import { createConnectorToolHandler } from '../tools/handlers/connector-tool-handlers';
import { ToolDispatcher, type ToolHandler } from '../tools/tool-dispatcher';
import { mergeAdvertisedToolsIntoExecuteOptions } from '../../worker/worker.processor';
import { createRunId } from './eval-runner';
import type { EvalEndedAs } from './eval-types';
import {
  advertisedBriefingTools,
  BRIEFING_WORKER_REGISTERED_TOOL_IDS,
  buildBriefingExecutionRequest,
} from './briefing-prompt';
import { buildBriefingResults } from './briefing-results';
import { scoreBriefingTask } from './briefing-score';
import type {
  BriefingRunResults,
  BriefingTask,
  BriefingTaskResult,
} from './briefing-types';

/**
 * Numeric limits copied from DEFAULT_AGENT_HARNESS_CONFIG_V1, as the other
 * eval runners do (that factory reads process.env).
 */
const EVAL_LIMITS = {
  maxToolIterations: 8,
  maxToolResultBytes: 262_144,
  toolTimeoutMs: 30_000,
};

const EVAL_SESSION_ID = 'eval-session';
const EVAL_CONVERSATION_ID = 'eval-conversation';
const EVAL_USER_ID = 'eval-user';

/**
 * Stands in for the signed grant token the gateway puts on the job. It has
 * the shape resolveConnectorGrants accepts; nothing checks a signature here
 * because the fake gateway client below answers every call.
 */
export const BRIEFING_EVAL_GRANT_TOKEN = 'eval-grant.eval-signature';

/** Error a non-connector tool returns in this eval. The call also fails the case. */
export const BRIEFING_NON_CONNECTOR_REFUSAL =
  'refused: the briefing eval serves only the connector tools';

export function briefingExecutionId(taskId: string): string {
  return `eval-${taskId}`;
}

/** One call the fake gateway client received, as the real handler sent it. */
export interface BriefingConnectorCall {
  readonly userId: string;
  readonly toolId: string;
  readonly arguments: Record<string, unknown>;
  readonly executionId: string;
  readonly grantToken: string;
}

export interface BriefingRunOptions {
  readonly executeFn: AgentHarnessExecuteWithToolsFn;
  readonly model: string;
  readonly harnessVersion: string;
  /** Provider on the request. Default 'stub'; the live runner passes 'anthropic'. */
  readonly provider?: AIExecutionRequest['provider'];
  readonly sessionId?: string;
  readonly config?: {
    readonly maxToolIterations?: number;
    readonly maxToolResultBytes?: number;
    readonly maxRunTokens?: number;
  };
  /** When omitted, credits is null. */
  readonly tokensToCredits?: (tokens: number) => number;
  /** Sees each connector call the real handler makes. Tests use it. */
  readonly onConnectorCall?: (call: BriefingConnectorCall) => void;
}

/**
 * Runs one briefing case through the real harness loop.
 *
 * The request is the worker's (briefing-prompt.ts). Every model call gets
 * the worker's advertised tool list merged into its options, as the worker's
 * executeFn does. mail_list_unread_metadata and calendar_list_today use the
 * real createConnectorToolHandler with a fake gateway client that returns
 * the case's fixture, so the model receives results wrapped exactly as in
 * the worker (<connector_result tool="..."> with <, > and & escaped). The
 * worker's other read-profile tools are registered to refuse. Every tool name
 * the model asks for is recorded and scored.
 */
export async function runBriefingTask(
  task: BriefingTask,
  options: BriefingRunOptions,
): Promise<BriefingTaskResult> {
  assertRunOptions(options);
  const executionId = briefingExecutionId(task.id);
  const sessionId =
    options.sessionId !== undefined && options.sessionId.trim().length > 0
      ? options.sessionId
      : EVAL_SESSION_ID;
  const maxToolResultBytes =
    options.config?.maxToolResultBytes ?? EVAL_LIMITS.maxToolResultBytes;
  const maxToolIterations =
    task.maxToolIterations ??
    options.config?.maxToolIterations ??
    EVAL_LIMITS.maxToolIterations;

  const dispatcher = buildDispatcher(task, executionId, maxToolResultBytes, options.onConnectorCall);
  const advertisedTools = advertisedBriefingTools();
  const toolCallNames: string[] = [];
  let modelCalls = 0;
  let toolCalls = 0;
  let tokens = 0;
  const wrappedExecute: AgentHarnessExecuteWithToolsFn = async (request, executeOptions) => {
    modelCalls += 1;
    const result = await options.executeFn(
      request,
      mergeAdvertisedToolsIntoExecuteOptions(executeOptions, advertisedTools),
    );
    tokens += finiteTokenCount(result);
    const names = requestedToolNames(result);
    toolCalls += names.length;
    toolCallNames.push(...names);
    return result;
  };

  const request = buildBriefingExecutionRequest(task, {
    provider: options.provider ?? 'stub',
    executionId,
    sessionId,
    conversationId: EVAL_CONVERSATION_ID,
    userId: EVAL_USER_ID,
    model: options.model,
  });

  let endedAs: EvalEndedAs = 'error';
  let answerText: string | null = null;
  try {
    const loopResult = await executeAgentHarnessLoop({
      executeFn: wrappedExecute,
      request,
      config: {
        maxToolIterations,
        maxToolResultBytes,
        ...(options.config?.maxRunTokens !== undefined
          ? { maxRunTokens: options.config.maxRunTokens }
          : {}),
      },
      toolTimeoutMs: EVAL_LIMITS.toolTimeoutMs,
      dispatcher,
    });
    endedAs = classifyLoopEnd(loopResult.terminationReason, loopResult.result.output);
    if (endedAs === 'answered' || endedAs === 'refusal') {
      answerText = loopResult.result.output ?? '';
    }
  } catch (err) {
    if (err instanceof HarnessMaxIterationsError) {
      endedAs = 'step_limit';
    } else if (err instanceof Error && err.name === 'AbortError') {
      endedAs = 'aborted';
    } else {
      endedAs = 'error';
    }
  }

  return scoreBriefingTask({
    task,
    toolCallNames,
    modelCalls,
    toolCalls,
    tokens,
    credits: options.tokensToCredits === undefined ? null : options.tokensToCredits(tokens),
    endedAs,
    answerText,
  });
}

export async function runBriefingSuite(
  tasks: readonly BriefingTask[],
  options: BriefingRunOptions,
): Promise<BriefingRunResults> {
  assertRunOptions(options);
  const startedAt = new Date();
  const results: BriefingTaskResult[] = [];
  for (const task of tasks) {
    results.push(await runBriefingTask(task, options));
  }
  return buildBriefingResults({
    runId: createRunId(startedAt),
    startedAt: startedAt.toISOString(),
    model: options.model,
    harnessVersion: options.harnessVersion,
    tasks: results,
  });
}

/**
 * The gateway's internal connector route returns the tool's JSON
 * ({ messages } or { events }). The fake client returns a copy of the case's
 * fixture for that tool.
 */
export function createBriefingGatewayClient(
  task: BriefingTask,
  onCall?: (call: BriefingConnectorCall) => void,
): Pick<ApiGatewayHttpClient, 'callConnectorTool'> {
  return {
    callConnectorTool: async (input) => {
      onCall?.({
        userId: input.userId,
        toolId: input.toolId,
        arguments: { ...input.arguments },
        executionId: input.executionId,
        grantToken: input.grantToken,
      });
      const fixture = input.toolId === CONNECTOR_MAIL_TOOL_ID ? task.mail : task.calendar;
      return JSON.parse(JSON.stringify(fixture)) as unknown;
    },
  };
}

function buildDispatcher(
  task: BriefingTask,
  executionId: string,
  maxToolResultBytes: number,
  onConnectorCall: ((call: BriefingConnectorCall) => void) | undefined,
): ToolDispatcher {
  const dispatcher = new ToolDispatcher({
    toolTimeoutMs: EVAL_LIMITS.toolTimeoutMs,
    maxToolResultBytes,
  });
  const client = createBriefingGatewayClient(task, onConnectorCall);
  for (const toolId of CONNECTOR_TOOL_IDS) {
    dispatcher.registerHandler(
      toolId,
      createConnectorToolHandler({
        client,
        toolId,
        userId: EVAL_USER_ID,
        executionId,
        grantToken: BRIEFING_EVAL_GRANT_TOKEN,
      }),
    );
  }
  for (const name of BRIEFING_WORKER_REGISTERED_TOOL_IDS) {
    if (!isConnectorToolId(name)) {
      dispatcher.registerHandler(name, refusingHandler());
    }
  }
  return dispatcher;
}

function refusingHandler(): ToolHandler {
  return async () => {
    throw new Error(BRIEFING_NON_CONNECTOR_REFUSAL);
  };
}

function requestedToolNames(result: AIAdapterToolUseResult): string[] {
  if (result.canonicalToolCalls && result.canonicalToolCalls.length > 0) {
    return result.canonicalToolCalls.map((call) => call.toolName);
  }
  return (result.toolCalls ?? []).map((call) => call.toolName);
}

function classifyLoopEnd(terminationReason: string, output: string | undefined): EvalEndedAs {
  if (terminationReason === 'aborted') {
    return 'aborted';
  }
  if (terminationReason === 'max_iterations') {
    return 'step_limit';
  }
  if (terminationReason === 'no_dispatcher') {
    return 'error';
  }
  if (/^\s*(i refuse|i won't|i will not|refusing)\b/i.test(output ?? '')) {
    return 'refusal';
  }
  return 'answered';
}

function finiteTokenCount(result: AIAdapterToolUseResult): number {
  const used = result.tokensUsed;
  return typeof used === 'number' && Number.isFinite(used) ? used : 0;
}

function assertRunOptions(options: BriefingRunOptions): void {
  if (typeof options.executeFn !== 'function') {
    throw new Error('briefing run requires executeFn');
  }
  if (typeof options.model !== 'string' || options.model.trim().length === 0) {
    throw new Error('briefing run requires model');
  }
  if (typeof options.harnessVersion !== 'string' || options.harnessVersion.trim().length === 0) {
    throw new Error('briefing run requires harnessVersion');
  }
}
