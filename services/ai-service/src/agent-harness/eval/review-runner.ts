import type { AIExecutionRequest } from '../../ai-execution/types';
import type { AIAdapterToolUseResult } from '../../ai-execution/adapters/adapter-tool-use.contracts';
import {
  executeAgentHarnessLoop,
  HarnessMaxIterationsError,
  type AgentHarnessExecuteWithToolsFn,
} from '../orchestrator/agent-harness-loop';
import { ToolDispatcher, type ToolHandler } from '../tools/tool-dispatcher';
import {
  createListFilesHandler,
  createReadFileHandler,
  createSearchWorkspaceHandler,
} from '../tools/handlers/file-tool-handlers';
import { createRunValidationHandler } from '../tools/handlers/validation-tool-handlers';
import { createRunId } from './eval-runner';
import { buildReviewResults } from './eval-results';
import { scoreReviewTask } from './review-score';
import type { ReviewRunResults, ReviewTask, ReviewTaskResult } from './review-types';
import {
  EVAL_ALLOWED_VALIDATION_COMMANDS,
  type EvalBlockedAttempt,
  type EvalEndedAs,
  type EvalSafetyViolation,
} from './eval-types';
import {
  asApiGatewayClient,
  EvalWorkspace,
  type EvalWorkspaceClient,
} from './eval-workspace';

/**
 * Numeric limits copied from DEFAULT_AGENT_HARNESS_CONFIG_V1.
 * This module does not import that config, because the factory reads
 * process.env and throws on a bad flag. Eval must run without that.
 */
const EVAL_LIMITS = {
  maxToolIterations: 8,
  maxToolResultBytes: 262_144,
  maxFileReadBytes: 262_144,
  maxValidationOutputBytes: 131_072,
  toolTimeoutMs: 30_000,
  validationTimeoutMs: 120_000,
};

const EVAL_SESSION_ID = 'eval-session';

const REVIEWER_MUTATION_REFUSAL = 'refused: reviewer cannot change files';

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

export interface ReviewRunOptions {
  readonly executeFn: AgentHarnessExecuteWithToolsFn;
  /** Default is a fresh in-memory workspace per task. */
  readonly client?: EvalWorkspaceClient;
  /** Passed to every handler call. Default is eval-session. */
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

/**
 * Request the loop passes to executeFn. projectInstructions is the task's
 * reviewerPrompt so a later live executeFn can hand it to
 * buildExecutionPromptParts as projectInstructions. The harness loop
 * forwards this same object.
 */
export interface ReviewExecutionRequest extends AIExecutionRequest {
  readonly projectInstructions: string;
}

export async function runReviewTask(
  task: ReviewTask,
  options: ReviewRunOptions,
): Promise<ReviewTaskResult> {
  assertRunOptions(options);
  const blockedAttempts: EvalBlockedAttempt[] = [];
  const safetyViolations: EvalSafetyViolation[] = [];
  const inner = options.client ?? new EvalWorkspace(task.initialFiles);
  const maxToolResultBytes =
    options.config?.maxToolResultBytes ?? EVAL_LIMITS.maxToolResultBytes;
  const sessionId =
    options.sessionId !== undefined && options.sessionId.trim().length > 0
      ? options.sessionId
      : EVAL_SESSION_ID;
  const dispatcher = buildDispatcher(
    inner,
    blockedAttempts,
    safetyViolations,
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

  const request: ReviewExecutionRequest = {
    executionId: `eval-${task.id}`,
    sessionId,
    conversationId: 'eval-conversation',
    userId: 'eval-user',
    prompt: task.handoffTask,
    provider: 'stub',
    model: options.model,
    projectInstructions: task.reviewerPrompt,
    metadata: {
      reviewerPrompt: task.reviewerPrompt,
    },
  };

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
    } else if (isAbortError(err)) {
      endedAs = 'aborted';
    } else if (isRefusalError(err)) {
      endedAs = 'refusal';
    } else {
      endedAs = 'error';
    }
  }

  const credits =
    options.tokensToCredits === undefined ? null : options.tokensToCredits(tokens);

  return scoreReviewTask({
    task,
    safetyViolations,
    blockedAttempts,
    modelCalls,
    toolCalls,
    tokens,
    credits,
    endedAs,
    answerText,
  });
}

export async function runReviewSuite(
  tasks: readonly ReviewTask[],
  options: ReviewRunOptions,
): Promise<ReviewRunResults> {
  assertRunOptions(options);
  const startedAt = new Date();
  const taskResults: ReviewTaskResult[] = [];
  for (const task of tasks) {
    taskResults.push(await runReviewTask(task, options));
  }
  return buildReviewResults({
    runId: createRunId(startedAt),
    startedAt: startedAt.toISOString(),
    model: options.model,
    harnessVersion: options.harnessVersion,
    tasks: taskResults,
  });
}

/**
 * Read, list, search, and validation use the real handlers on the in-memory
 * workspace. write_file and delete_file are registered only to refuse:
 * they do not call the workspace, so no file changes, and each call is a
 * safety violation.
 */
function buildDispatcher(
  client: EvalWorkspaceClient,
  blockedAttempts: EvalBlockedAttempt[],
  safetyViolations: EvalSafetyViolation[],
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
  dispatcher.registerHandler(
    'write_file',
    createRefusingMutationHandler(
      'write_file',
      'write',
      safetyViolations,
      blockedAttempts,
    ),
  );
  dispatcher.registerHandler(
    'delete_file',
    createRefusingMutationHandler(
      'delete_file',
      'delete',
      safetyViolations,
      blockedAttempts,
    ),
  );
  return dispatcher;
}

function createRefusingMutationHandler(
  toolName: 'write_file' | 'delete_file',
  op: 'write' | 'delete',
  safetyViolations: EvalSafetyViolation[],
  blockedAttempts: EvalBlockedAttempt[],
): ToolHandler {
  return async (args) => {
    const filePath = typeof args.path === 'string' ? args.path : '';
    safetyViolations.push({
      op,
      path: filePath,
      reason: 'reviewerCannotChangeFiles',
    });
    blockedAttempts.push({
      toolName,
      message: REVIEWER_MUTATION_REFUSAL,
    });
    throw new Error(REVIEWER_MUTATION_REFUSAL);
  };
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

function assertRunOptions(options: ReviewRunOptions): void {
  if (typeof options.executeFn !== 'function') {
    throw new Error('review run requires executeFn');
  }
  if (typeof options.model !== 'string' || options.model.trim().length === 0) {
    throw new Error('review run requires model');
  }
  if (
    typeof options.harnessVersion !== 'string' ||
    options.harnessVersion.trim().length === 0
  ) {
    throw new Error('review run requires harnessVersion');
  }
}
