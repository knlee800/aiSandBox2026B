import { loadEvalTasks } from '../eval-loader';
import { buildEvalResults, writeResults } from '../eval-results';
import { createRunId, runEvalTask } from '../eval-runner';
import { scoreEvalTask } from '../eval-score';
import type { EvalRunResults, EvalTask, EvalTaskResult } from '../eval-types';
import {
  createAnthropicLiveAdapter,
  readAnthropicApiKey,
  resolveLiveModel,
  scrubSecret,
} from './live-adapter';
import {
  createLiveExecuteFn,
  DEFAULT_MAX_TOTAL_TOKENS,
  tokensToCredits,
  type LiveExecuteAdapter,
  type LiveTokenUsage,
} from './live-execute';

const DEFAULT_HARNESS_VERSION = 'v1';

/**
 * Per-run token budget passed to the eval runner. The worker default is the
 * maxRunTokens literal 60000 in createAgentHarnessConfigV1
 * (agent-harness.config.ts). DEFAULT_AGENT_HARNESS_CONFIG_V1 is not imported:
 * that factory reads process.env.
 */
export const LIVE_MAX_RUN_TOKENS = 60_000;

const CLI_FLAGS = [
  'tasks',
  'out',
  'model',
  'max-total-tokens',
  'only',
  'harness-version',
] as const;

export interface LiveCliArgs {
  readonly tasksDir: string;
  readonly outDir: string;
  readonly model: string;
  readonly maxTotalTokens?: number;
  readonly only?: readonly string[];
  readonly harnessVersion: string;
}

export interface RunLiveEvalOptions {
  readonly tasks: readonly EvalTask[];
  readonly adapter: LiveExecuteAdapter;
  readonly model: string;
  readonly harnessVersion: string;
  readonly maxTotalTokens?: number;
  readonly outDir: string;
  readonly env?: NodeJS.ProcessEnv;
}

export interface RunLiveEvalOutcome {
  readonly results: EvalRunResults;
  readonly resultsPath: string;
  readonly lines: readonly string[];
}

export interface RunLiveCliDeps {
  readonly env?: NodeJS.ProcessEnv;
  readonly adapter?: LiveExecuteAdapter;
  readonly stdout?: (line: string) => void;
  readonly stderr?: (line: string) => void;
}

export function parseLiveArgs(argv: readonly string[]): LiveCliArgs {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const flag = token.slice(2);
    if (!CLI_FLAGS.includes(flag as (typeof CLI_FLAGS)[number])) {
      throw new Error(`Unknown argument: --${flag}`);
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for --${flag}`);
    }
    if (values.has(flag)) {
      throw new Error(`Duplicate argument: --${flag}`);
    }
    values.set(flag, value);
    index += 1;
  }
  for (const required of ['tasks', 'out', 'model'] as const) {
    if (!values.has(required) || (values.get(required) ?? '').trim().length === 0) {
      throw new Error(`Missing required argument: --${required}`);
    }
  }
  const onlyRaw = values.get('only');
  let only: string[] | undefined;
  if (onlyRaw !== undefined) {
    only = onlyRaw
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    if (only.length === 0) {
      throw new Error('Missing value for --only');
    }
  }
  let maxTotalTokens: number | undefined;
  const maxRaw = values.get('max-total-tokens');
  if (maxRaw !== undefined) {
    maxTotalTokens = readNonNegativeInteger(maxRaw, '--max-total-tokens');
  }
  const harnessVersion = (values.get('harness-version') ?? DEFAULT_HARNESS_VERSION).trim();
  if (harnessVersion.length === 0) {
    throw new Error('Missing value for --harness-version');
  }
  return {
    tasksDir: (values.get('tasks') as string).trim(),
    outDir: (values.get('out') as string).trim(),
    model: (values.get('model') as string).trim(),
    ...(maxTotalTokens !== undefined ? { maxTotalTokens } : {}),
    ...(only !== undefined ? { only } : {}),
    harnessVersion,
  };
}

/**
 * Runs the loaded tasks on the live executeFn.
 * Step and byte limits are the eval runner defaults (step limit 8).
 * maxRunTokens is the worker default, LIVE_MAX_RUN_TOKENS.
 *
 * After the running token total reaches the cap, the task that was in
 * progress ends through the runner as error ("token cap reached") when it
 * asks for another model call. Tasks not yet started are scored as not_run
 * and are not passes. A task whose last model call finishes the loop at the
 * cap is scored normally; later tasks are not run.
 */
export async function runLiveEval(
  options: RunLiveEvalOptions,
): Promise<RunLiveEvalOutcome> {
  const maxTotalTokens = options.maxTotalTokens ?? DEFAULT_MAX_TOTAL_TOKENS;
  const usage: LiveTokenUsage = { totalTokens: 0 };
  const executeFn = createLiveExecuteFn({
    tasks: options.tasks,
    adapter: options.adapter,
    maxTotalTokens,
    tokenUsage: usage,
    env: options.env,
  });
  const startedAt = new Date();
  const taskResults: EvalTaskResult[] = [];
  let capClosed = false;
  for (const task of options.tasks) {
    if (capClosed || usage.totalTokens >= maxTotalTokens) {
      capClosed = true;
      taskResults.push(notRunResult(task));
      continue;
    }
    const result = await runEvalTask(task, {
      executeFn,
      model: options.model,
      harnessVersion: options.harnessVersion,
      tokensToCredits,
      config: {
        maxRunTokens: LIVE_MAX_RUN_TOKENS,
      },
    });
    taskResults.push(result);
    if (usage.totalTokens >= maxTotalTokens) {
      capClosed = true;
    }
  }
  const results = buildEvalResults({
    runId: createRunId(startedAt),
    startedAt: startedAt.toISOString(),
    model: options.model,
    harnessVersion: options.harnessVersion,
    tasks: taskResults,
  });
  const resultsPath = writeResults(results, options.outDir);
  return {
    results,
    resultsPath,
    lines: formatLiveReport(results, resultsPath),
  };
}

export function formatLiveReport(
  results: EvalRunResults,
  resultsPath: string,
): string[] {
  const lines = results.tasks.map((task) => {
    const fields = [
      task.id,
      `passed=${task.passed}`,
      `endedAs=${task.endedAs}`,
      `modelCalls=${task.modelCalls}`,
      `toolCalls=${task.toolCalls}`,
      `tokens=${task.tokens}`,
    ];
    if (task.notRun === true) {
      fields.push('notRun=true');
    }
    return fields.join(' ');
  });
  const totals = results.totals;
  const credits = totals.credits === null ? 'n/a' : String(totals.credits);
  lines.push(
    `totals tasks=${totals.tasks} passed=${totals.passed} failed=${totals.failed} modelCalls=${totals.modelCalls} toolCalls=${totals.toolCalls} tokens=${totals.tokens} credits=${credits}`,
  );
  lines.push(`results ${resultsPath}`);
  return lines;
}

/**
 * CLI body. Returns 0 when the run finished, including failed tasks.
 * Returns 1 for setup failures. Prints task lines, totals, and the results path.
 * The API key is never printed.
 */
export async function runLiveCli(
  argv: readonly string[],
  deps: RunLiveCliDeps = {},
): Promise<number> {
  const env = deps.env ?? process.env;
  const stdout = deps.stdout ?? ((line: string) => console.log(line));
  const stderr = deps.stderr ?? ((line: string) => console.error(line));
  try {
    const args = parseLiveArgs(argv);
    readAnthropicApiKey(env);
    const model = resolveLiveModel(args.model, env);
    const tasks = selectTasks(loadEvalTasks(args.tasksDir), args.only);
    const adapter = deps.adapter ?? createAnthropicLiveAdapter(env, model);
    const outcome = await runLiveEval({
      tasks,
      adapter,
      model,
      harnessVersion: args.harnessVersion,
      ...(args.maxTotalTokens !== undefined
        ? { maxTotalTokens: args.maxTotalTokens }
        : {}),
      outDir: args.outDir,
      env,
    });
    for (const line of outcome.lines) {
      stdout(scrubSecret(line, env.ANTHROPIC_API_KEY));
    }
    return 0;
  } catch (err) {
    const message = scrubSecret(
      err instanceof Error ? err.message : String(err),
      env.ANTHROPIC_API_KEY,
    );
    stderr(message);
    return 1;
  }
}

function notRunResult(task: EvalTask): EvalTaskResult {
  return scoreEvalTask({
    task,
    attempts: [],
    validationRuns: [],
    blockedAttempts: [],
    modelCalls: 0,
    toolCalls: 0,
    tokens: 0,
    credits: tokensToCredits(0),
    endedAs: 'not_run',
    answerText: null,
  });
}

function selectTasks(
  tasks: readonly EvalTask[],
  only: readonly string[] | undefined,
): EvalTask[] {
  if (tasks.length === 0) {
    throw new Error('No eval tasks to run');
  }
  if (only === undefined) {
    return [...tasks];
  }
  const known = new Set(tasks.map((task) => task.id));
  const missing = only.filter((id) => !known.has(id));
  if (missing.length > 0) {
    throw new Error(`Unknown eval task id: ${missing.join(', ')}`);
  }
  const wanted = new Set(only);
  return tasks.filter((task) => wanted.has(task.id));
}

function readNonNegativeInteger(raw: string, flag: string): number {
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${flag} must be a non-negative integer`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${flag} must be a non-negative integer`);
  }
  return value;
}
