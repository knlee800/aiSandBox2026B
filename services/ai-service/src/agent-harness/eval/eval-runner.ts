import * as crypto from 'crypto';
import type { AIExecutionRequest } from '../../ai-execution/types';
import type { AIAdapterToolUseResult } from '../../ai-execution/adapters/adapter-tool-use.contracts';
import {
  executeAgentHarnessLoop,
  HarnessMaxIterationsError,
  type AgentHarnessExecuteWithToolsFn,
} from '../orchestrator/agent-harness-loop';
import { ToolDispatcher, type ToolHandler } from '../tools/tool-dispatcher';
import {
  createDeleteFileHandler,
  createListFilesHandler,
  createReadFileHandler,
  createSearchWorkspaceHandler,
  createWriteFileHandler,
} from '../tools/handlers/file-tool-handlers';
import { createRunValidationHandler } from '../tools/handlers/validation-tool-handlers';
import { scoreEvalTask } from './eval-score';
import {
  EVAL_ALLOWED_VALIDATION_COMMANDS,
  type EvalBlockedAttempt,
  type EvalEndedAs,
  type EvalRunResults,
  type EvalTask,
  type EvalTaskResult,
} from './eval-types';
import {
  asApiGatewayClient,
  EvalWorkspace,
  observeWorkspaceClient,
  type EvalWorkspaceClient,
} from './eval-workspace';
import { buildEvalResults } from './eval-results';

/**
 * Numeric limits copied from DEFAULT_AGENT_HARNESS_CONFIG_V1.
 * This module does not import that config, because the factory reads
 * process.env and throws on a bad flag. Eval must run without that.
 */
const EVAL_LIMITS = {
  maxToolIterations: 8,
  maxToolResultBytes: 262_144,
  maxFileReadBytes: 262_144,
  maxFileWriteBytes: 131_072,
  maxValidationOutputBytes: 131_072,
  toolTimeoutMs: 30_000,
  validationTimeoutMs: 120_000,
};

const EVAL_SESSION_ID = 'eval-session';

const HANDLER_REFUSAL_PREFIXES = [
  'path is required',
  'path contains unsafe traversal',
  'content is required',
  'content exceeds maximum write size',
  'delete target is unsafe',
  'delete target must be a file',
  'delete target must not contain glob',
  'refused: .env',
  'query is required',
  'command is required',
  'COMMAND_NOT_ALLOWED',
];

export interface EvalRunOptions {
  readonly executeFn: AgentHarnessExecuteWithToolsFn;
  /** Default is a fresh in-memory workspace per task. A later live run may pass another client. */
  readonly client?: EvalWorkspaceClient;
  /** Passed to every handler call. Default is eval-session. A live client that routes on this id should set it. */
  readonly sessionId?: string;
  readonly model: string;
  readonly harnessVersion: string;
  readonly config?: {
    readonly maxToolIterations?: number;
    readonly maxToolResultBytes?: number;
    readonly maxRunTokens?: number;
  };
  /** When omitted, credits is null. The suite does not invent a price. */
  readonly tokensToCredits?: (tokens: number) => number;
}

export async function runEvalTask(
  task: EvalTask,
  options: EvalRunOptions,
): Promise<EvalTaskResult> {
  assertRunOptions(options);
  const blockedAttempts: EvalBlockedAttempt[] = [];
  const inner =
    options.client ??
    new EvalWorkspace(
      task.initialFiles,
      task.expected.contentChecks ?? [],
    );
  const observed = observeWorkspaceClient(inner);
  const maxToolResultBytes =
    options.config?.maxToolResultBytes ?? EVAL_LIMITS.maxToolResultBytes;
  const sessionId =
    options.sessionId !== undefined && options.sessionId.trim().length > 0
      ? options.sessionId
      : EVAL_SESSION_ID;
  const dispatcher = buildDispatcher(
    observed.client,
    blockedAttempts,
    maxToolResultBytes,
    sessionId,
  );

  const maxToolIterations =
    task.maxToolIterations ??
    options.config?.maxToolIterations ??
    EVAL_LIMITS.maxToolIterations;

  let modelCalls = 0;
  let toolCalls = 0;
  let tokens = 0;
  const wrappedExecute: AgentHarnessExecuteWithToolsFn = async (request, executeOptions) => {
    modelCalls += 1;
    const result = await options.executeFn(request, executeOptions);
    tokens += finiteTokenCount(result);
    toolCalls += countToolCalls(result);
    return result;
  };

  const request: AIExecutionRequest = {
    executionId: `eval-${task.id}`,
    sessionId,
    conversationId: 'eval-conversation',
    userId: 'eval-user',
    prompt: task.userRequest,
    provider: 'stub',
    model: options.model,
  };

  let endedAs: EvalEndedAs = 'error';
  let errorMessage: string | undefined;
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
      // Same mutating set as the worker. No checkpoint function is passed,
      // so the loop does not create a pre-apply checkpoint during eval.
      mutatingToolNames: new Set(['write_file', 'delete_file']),
    });
    endedAs = classifyLoopEnd(loopResult.terminationReason, loopResult.result.output);
    if (endedAs === 'answered' || endedAs === 'refusal') {
      answerText = loopResult.result.output ?? '';
    }
    if (loopResult.terminationReason === 'no_dispatcher') {
      errorMessage = 'no tool dispatcher';
    }
  } catch (err) {
    if (err instanceof HarnessMaxIterationsError) {
      endedAs = 'step_limit';
    } else if (isAbortError(err)) {
      endedAs = 'aborted';
      errorMessage = shortError(err);
    } else if (isRefusalError(err)) {
      endedAs = 'refusal';
      errorMessage = shortError(err);
    } else {
      endedAs = 'error';
      errorMessage = shortError(err);
    }
  }

  const credits =
    options.tokensToCredits === undefined ? null : options.tokensToCredits(tokens);

  return scoreEvalTask({
    task,
    attempts: observed.observation.attempts,
    validationRuns: observed.observation.validationRuns,
    blockedAttempts,
    modelCalls,
    toolCalls,
    tokens,
    credits,
    endedAs,
    answerText,
    errorMessage,
  });
}

export async function runEvalSuite(
  tasks: readonly EvalTask[],
  options: EvalRunOptions,
): Promise<EvalRunResults> {
  assertRunOptions(options);
  const startedAt = new Date();
  const taskResults: EvalTaskResult[] = [];
  for (const task of tasks) {
    // A caller-supplied client is shared across tasks. When client is omitted,
    // runEvalTask builds a fresh workspace from that task's initial files.
    taskResults.push(await runEvalTask(task, options));
  }
  return buildEvalResults({
    runId: createRunId(startedAt),
    startedAt: startedAt.toISOString(),
    model: options.model,
    harnessVersion: options.harnessVersion,
    tasks: taskResults,
  });
}

/**
 * Mirrors the worker's ToolDispatcher registration for the workspace tools.
 * Write, delete, and validation are always registered here. The worker hides
 * them behind env flags that default off; this suite is the measuring tool
 * and must be able to score edits without those flags.
 * Browser smoke and the progress publisher are not registered.
 */
function buildDispatcher(
  client: EvalWorkspaceClient,
  blockedAttempts: EvalBlockedAttempt[],
  maxToolResultBytes: number,
  sessionId: string,
): ToolDispatcher {
  const gatewayClient = asApiGatewayClient(client);
  const dispatcher = new ToolDispatcher({
    toolTimeoutMs: EVAL_LIMITS.toolTimeoutMs,
    maxToolResultBytes,
  });

  dispatcher.registerHandler(
    'read_file',
    recordRefusals(
      'read_file',
      createReadFileHandler({
        client: gatewayClient,
        sessionId,
        maxFileReadBytes: EVAL_LIMITS.maxFileReadBytes,
      }),
      blockedAttempts,
    ),
  );
  dispatcher.registerHandler(
    'list_files',
    recordRefusals(
      'list_files',
      createListFilesHandler({ client: gatewayClient, sessionId }),
      blockedAttempts,
    ),
  );
  dispatcher.registerHandler(
    'search_workspace',
    recordRefusals(
      'search_workspace',
      createSearchWorkspaceHandler({ client: gatewayClient, sessionId }),
      blockedAttempts,
    ),
  );
  dispatcher.registerHandler(
    'write_file',
    recordRefusals(
      'write_file',
      createWriteFileHandler({
        client: gatewayClient,
        sessionId,
        maxFileWriteBytes: EVAL_LIMITS.maxFileWriteBytes,
      }),
      blockedAttempts,
    ),
  );
  dispatcher.registerHandler(
    'delete_file',
    recordRefusals(
      'delete_file',
      createDeleteFileHandler({ client: gatewayClient, sessionId }),
      blockedAttempts,
    ),
  );
  dispatcher.registerHandler(
    'run_validation',
    recordRefusals(
      'run_validation',
      createRunValidationHandler({
        client: gatewayClient,
        sessionId,
        allowedValidationCommands: EVAL_ALLOWED_VALIDATION_COMMANDS,
        validationTimeoutMs: EVAL_LIMITS.validationTimeoutMs,
        maxValidationOutputBytes: EVAL_LIMITS.maxValidationOutputBytes,
      }),
      blockedAttempts,
    ),
  );
  return dispatcher;
}

function recordRefusals(
  toolName: string,
  handler: ToolHandler,
  blockedAttempts: EvalBlockedAttempt[],
): ToolHandler {
  return async (args, signal) => {
    try {
      return await handler(args, signal);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isHandlerRefusal(message)) {
        blockedAttempts.push({ toolName, message });
      }
      throw err;
    }
  };
}

function isHandlerRefusal(message: string): boolean {
  return HANDLER_REFUSAL_PREFIXES.some((prefix) => message.startsWith(prefix));
}

function classifyLoopEnd(
  terminationReason: string,
  output: string | undefined,
): EvalEndedAs {
  if (terminationReason === 'aborted') {
    return 'aborted';
  }
  if (terminationReason === 'max_iterations') {
    return 'step_limit';
  }
  if (terminationReason === 'no_dispatcher') {
    return 'error';
  }
  if (isRefusalText(output)) {
    return 'refusal';
  }
  return 'answered';
}

function isRefusalText(output: string | undefined): boolean {
  return /^\s*(i refuse|i won't|i will not|refusing)\b/i.test(output ?? '');
}

function isRefusalError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }
  return /refusal/i.test(err.name) || /refusal/i.test(err.message);
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

function finiteTokenCount(result: AIAdapterToolUseResult): number {
  const used = result.tokensUsed;
  return typeof used === 'number' && Number.isFinite(used) ? used : 0;
}

function countToolCalls(result: AIAdapterToolUseResult): number {
  if (result.canonicalToolCalls && result.canonicalToolCalls.length > 0) {
    return result.canonicalToolCalls.length;
  }
  return result.toolCalls?.length ?? 0;
}

function shortError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.length > 300 ? message.slice(0, 300) : message;
}

function assertRunOptions(options: EvalRunOptions): void {
  if (typeof options.executeFn !== 'function') {
    throw new Error('eval run requires executeFn');
  }
  if (typeof options.model !== 'string' || options.model.trim().length === 0) {
    throw new Error('eval run requires model');
  }
  if (
    typeof options.harnessVersion !== 'string' ||
    options.harnessVersion.trim().length === 0
  ) {
    throw new Error('eval run requires harnessVersion');
  }
}

export function createRunId(startedAt: Date): string {
  const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
  const suffix = crypto.randomBytes(3).toString('hex');
  return `eval-${stamp}-${suffix}`;
}
