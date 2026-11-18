import type { ApiGatewayHttpClient } from '../../clients/api-gateway-http.client';
import type { AIExecutionRequest } from '../../ai-execution/types';
import type { AIAdapterToolUseResult } from '../../ai-execution/adapters/adapter-tool-use.contracts';
import {
  executeAgentHarnessLoop,
  HarnessMaxIterationsError,
  type AgentHarnessExecuteWithToolsFn,
} from '../orchestrator/agent-harness-loop';
import {
  CONNECTOR_MAIL_READ_TOOL_ID,
  CONNECTOR_MAIL_TOOL_ID,
  CONNECTOR_TOOL_IDS,
  isConnectorToolId,
} from '../tools/connector-tool-definitions';
import {
  CONNECTOR_MAIL_MESSAGE_NOT_FOUND_MESSAGE,
  createConnectorToolHandler,
} from '../tools/handlers/connector-tool-handlers';
import {
  createReadRunResultHandler,
  READ_RUN_RESULT_TOOL_ID,
} from '../tools/handlers/run-result-tool-handlers';
import { ToolDispatcher, type ToolHandler } from '../tools/tool-dispatcher';
import { mergeAdvertisedToolsIntoExecuteOptions } from '../../worker/worker.processor';
import { createRunId } from './eval-runner';
import type { EvalEndedAs } from './eval-types';
import {
  advertisedBriefingTools,
  briefingRegisteredToolIds,
  briefingRunResultToolOn,
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

/**
 * COS-MAIL-BODY-RULE-01: what the fake gateway client throws for a run id
 * other than the case's; the real handler turns any failure into
 * RUN_RESULT_NOT_FOUND_MESSAGE.
 */
export const BRIEFING_RUN_RESULT_MISS = 'eval: no such run';

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
  /** Sees each run-result read the real handler makes. Tests use it. */
  readonly onRunResultCall?: (call: BriefingRunResultCall) => void;
}

/** One run-result read the fake gateway client received, as the real handler sent it. */
export interface BriefingRunResultCall {
  readonly userId: string;
  readonly runId: string;
}

/**
 * Runs one briefing case through the real harness loop.
 *
 * The request is the worker's (briefing-prompt.ts). Every model call gets
 * the worker's advertised tool list merged into its options, as the worker's
 * executeFn does. mail_list_unread_metadata, mail_read_message (CONN-MAIL-READ-01,
 * one message of the case's mail fixture by id) and calendar_list_today use the
 * real createConnectorToolHandler with a fake gateway client that returns
 * the case's fixture, so the model receives results wrapped exactly as in
 * the worker (<connector_result tool="..."> with <, > and & escaped). On a
 * chain-trigger case read_run_result uses the real createReadRunResultHandler
 * with a fake client that returns the case's runResult (<run_result> tags).
 * COS-EVAL-FAILCHAIN-01: on a chain-failed case read_run_result is registered
 * the same way with no runResult, so every read answers the handler's not-found
 * text, as the gateway's result route answers 404 for a failed run.
 * The worker's other read-profile tools are registered to refuse. Every tool
 * name the model asks for is recorded and scored.
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

  const dispatcher = buildDispatcher(
    task,
    executionId,
    maxToolResultBytes,
    options.onConnectorCall,
    options.onRunResultCall,
  );
  const advertisedTools = advertisedBriefingTools(task);
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

/** CONN-MAIL-READ-01: the gateway's messageId rule (an IMAP UID, 1 to 4294967295, no leading zero). */
const BRIEFING_MESSAGE_ID = /^[1-9][0-9]{0,9}$/;

/**
 * CONN-MAIL-READ-01: an error shaped as the internal route's HTTP error, so the
 * real handler maps it as in the worker: the fixed 404 not-found text is passed
 * on, anything else becomes the fixed failure message.
 */
export function briefingGatewayError(status: number, message: string): Error {
  return Object.assign(new Error(`eval gateway ${status}`), {
    response: { status, data: { statusCode: status, message } },
  });
}

/**
 * CONN-MAIL-READ-01: what the gateway answers for mail_read_message on this
 * case: { message } for an id in the case's mail fixture (the unread tool's
 * fields), the fixed 404 for an id that is not there, the fixed 400 for an id
 * that is not a UID.
 */
function briefingMailRead(task: BriefingTask, args: Readonly<Record<string, unknown>>): unknown {
  const messageId = args.messageId;
  const keys = Object.keys(args);
  if (
    keys.length !== 1 ||
    typeof messageId !== 'string' ||
    !BRIEFING_MESSAGE_ID.test(messageId) ||
    Number(messageId) > 0xffffffff
  ) {
    throw briefingGatewayError(400, 'Connector arguments are invalid.');
  }
  const found = task.mail.messages.find((message) => message.id === messageId);
  if (!found) {
    throw briefingGatewayError(404, CONNECTOR_MAIL_MESSAGE_NOT_FOUND_MESSAGE);
  }
  return JSON.parse(
    JSON.stringify({
      message: {
        id: found.id,
        from: found.from,
        toCount: found.toCount,
        subject: found.subject,
        date: found.date,
        bodyText: found.bodyText,
        bodyTruncated: found.bodyTruncated,
      },
    }),
  ) as unknown;
}

/**
 * The gateway's internal connector route returns the tool's JSON
 * ({ messages }, { events } or, for mail_read_message, { message }). The fake
 * client returns a copy of the case's fixture for that tool.
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
      if (input.toolId === CONNECTOR_MAIL_READ_TOOL_ID) {
        return briefingMailRead(task, input.arguments);
      }
      const fixture = input.toolId === CONNECTOR_MAIL_TOOL_ID ? task.mail : task.calendar;
      return JSON.parse(JSON.stringify(fixture)) as unknown;
    },
  };
}

/**
 * COS-MAIL-BODY-RULE-01: the gateway's run-result route for a chain-trigger
 * case. It returns a copy of the case's runResult for that run id and throws
 * for any other id (as the route's 404 does). COS-EVAL-FAILCHAIN-01: a
 * chain-failed case has no runResult, so it throws for every id, the failed
 * run's included (the route answers 404 for any run that is not completed).
 */
export function createBriefingRunResultClient(
  task: BriefingTask,
  onCall?: (call: BriefingRunResultCall) => void,
): Pick<ApiGatewayHttpClient, 'readRunResult'> {
  return {
    readRunResult: async (input) => {
      onCall?.({ userId: input.userId, runId: input.runId });
      if (task.runResult === undefined || input.runId !== task.runResult.runId) {
        throw new Error(BRIEFING_RUN_RESULT_MISS);
      }
      return JSON.parse(JSON.stringify(task.runResult)) as NonNullable<BriefingTask['runResult']>;
    },
  };
}

function buildDispatcher(
  task: BriefingTask,
  executionId: string,
  maxToolResultBytes: number,
  onConnectorCall: ((call: BriefingConnectorCall) => void) | undefined,
  onRunResultCall: ((call: BriefingRunResultCall) => void) | undefined,
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
  // RESULT-TOOL-01 as the worker registers it: the real handler, owner from the job.
  if (briefingRunResultToolOn(task)) {
    dispatcher.registerHandler(
      READ_RUN_RESULT_TOOL_ID,
      createReadRunResultHandler({
        client: createBriefingRunResultClient(task, onRunResultCall),
        userId: EVAL_USER_ID,
        maxToolResultBytes,
      }),
    );
  }
  for (const name of briefingRegisteredToolIds(task)) {
    if (!isConnectorToolId(name) && name !== READ_RUN_RESULT_TOOL_ID) {
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
