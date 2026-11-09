import * as fs from 'fs';
import * as path from 'path';
import { createRunId } from '../eval-runner';
import { loadBriefingTasks } from '../briefing-loader';
import { buildBriefingResults, writeBriefingResults } from '../briefing-results';
import { briefingExecutionId, runBriefingTask } from '../briefing-runner';
import { scoreBriefingTask } from '../briefing-score';
import type {
  BriefingRunResults,
  BriefingTask,
  BriefingTaskResult,
} from '../briefing-types';
import {
  createAnthropicLiveAdapter,
  readAnthropicApiKey,
  resolveLiveModel,
  scrubSecret,
} from './live-adapter';
import { tokensToCredits, type LiveExecuteAdapter, type LiveTokenUsage } from './live-execute';
import { LIVE_MAX_RUN_TOKENS, parseLiveArgs, type LiveCliArgs } from './live-run';
import {
  createBriefingLiveExecuteFn,
  DEFAULT_BRIEFING_MAX_TOTAL_TOKENS,
} from './briefing-live-execute';

export { DEFAULT_BRIEFING_MAX_TOTAL_TOKENS } from './briefing-live-execute';

/**
 * A live run calls the paid provider. It needs ANTHROPIC_API_KEY in the
 * environment and this flag on the command line; without either it stops
 * before any adapter is built.
 */
export const BRIEFING_LIVE_CONFIRM_FLAG = '--confirm';
export const BRIEFING_LIVE_CONFIRM_VALUE = 'provider-call';
export const BRIEFING_LIVE_CONFIRM_MISSING_MESSAGE =
  'Refusing to call the provider: pass --confirm provider-call';

export interface BriefingLiveCliArgs extends LiveCliArgs {
  readonly confirmed: true;
}

export interface RunBriefingLiveEvalOptions {
  readonly tasks: readonly BriefingTask[];
  readonly adapter: LiveExecuteAdapter;
  readonly model: string;
  readonly harnessVersion: string;
  readonly maxTotalTokens?: number;
  readonly outDir: string;
  readonly env?: NodeJS.ProcessEnv;
}

export interface RunBriefingLiveEvalOutcome {
  readonly results: BriefingRunResults;
  readonly resultsPath: string;
  readonly answersPath: string;
  readonly lines: readonly string[];
}

export interface RunBriefingLiveCliDeps {
  readonly env?: NodeJS.ProcessEnv;
  readonly adapter?: LiveExecuteAdapter;
  readonly stdout?: (line: string) => void;
  readonly stderr?: (line: string) => void;
}

/**
 * The harness live runner's flags (--tasks, --out, --model,
 * --max-total-tokens, --only, --harness-version) plus the required
 * --confirm provider-call.
 */
export function parseBriefingLiveArgs(argv: readonly string[]): BriefingLiveCliArgs {
  const rest: string[] = [];
  let confirm: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === BRIEFING_LIVE_CONFIRM_FLAG) {
      if (confirm !== undefined) {
        throw new Error(`Duplicate argument: ${BRIEFING_LIVE_CONFIRM_FLAG}`);
      }
      confirm = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    rest.push(token);
  }
  const parsed = parseLiveArgs(rest);
  if (confirm !== BRIEFING_LIVE_CONFIRM_VALUE) {
    throw new Error(BRIEFING_LIVE_CONFIRM_MISSING_MESSAGE);
  }
  return { ...parsed, confirmed: true };
}

/**
 * Runs the briefing cases on the live executeFn with provider 'anthropic'.
 * Step limit is the eval default (8); maxRunTokens is LIVE_MAX_RUN_TOKENS.
 * Cases not started once the whole-run cap is reached are scored as not_run.
 */
export async function runBriefingLiveEval(
  options: RunBriefingLiveEvalOptions,
): Promise<RunBriefingLiveEvalOutcome> {
  const maxTotalTokens = options.maxTotalTokens ?? DEFAULT_BRIEFING_MAX_TOTAL_TOKENS;
  const usage: LiveTokenUsage = { totalTokens: 0 };
  const completedOutputs = new Map<string, string>();
  const executeFn = createBriefingLiveExecuteFn({
    adapter: options.adapter,
    maxTotalTokens,
    tokenUsage: usage,
    env: options.env,
    completedOutputs,
  });
  const startedAt = new Date();
  const taskResults: BriefingTaskResult[] = [];
  let capClosed = false;
  for (const task of options.tasks) {
    if (capClosed || usage.totalTokens >= maxTotalTokens) {
      capClosed = true;
      taskResults.push(notRunResult(task));
      continue;
    }
    taskResults.push(
      await runBriefingTask(task, {
        executeFn,
        provider: 'anthropic',
        model: options.model,
        harnessVersion: options.harnessVersion,
        tokensToCredits,
        config: { maxRunTokens: LIVE_MAX_RUN_TOKENS },
      }),
    );
    if (usage.totalTokens >= maxTotalTokens) {
      capClosed = true;
    }
  }
  const secret = options.env?.ANTHROPIC_API_KEY;
  const results = scrubResults(
    buildBriefingResults({
      runId: createRunId(startedAt),
      startedAt: startedAt.toISOString(),
      model: options.model,
      harnessVersion: options.harnessVersion,
      tasks: taskResults,
    }),
    secret,
  );
  const resultsPath = writeBriefingResults(results, options.outDir);
  const answers = results.tasks.map((task) => {
    const full =
      task.finalAnswer === null
        ? null
        : (completedOutputs.get(briefingExecutionId(task.id)) ?? task.finalAnswer);
    return { id: task.id, answer: full === null ? null : scrubSecret(full, secret) };
  });
  fs.mkdirSync(options.outDir, { recursive: true });
  const answersPath = path.join(options.outDir, `briefing-answers-${results.runId}.json`);
  fs.writeFileSync(
    answersPath,
    scrubSecret(`${JSON.stringify({ runId: results.runId, answers }, null, 2)}\n`, secret),
    'utf8',
  );
  return {
    results,
    resultsPath,
    answersPath,
    lines: formatBriefingLiveReport(results, resultsPath, answersPath),
  };
}

export function formatBriefingLiveReport(
  results: BriefingRunResults,
  resultsPath: string,
  answersPath: string,
): string[] {
  const lines = results.tasks.map((task) =>
    [
      task.id,
      `passed=${task.passed}`,
      `reported=${task.reported.length}/${task.injectedItems}`,
      `flagged=${task.flagged.length}/${task.injectedItems}`,
      `flags=${task.flagCount}`,
      `actionClaims=${task.actionClaims.length}`,
      `handoffs=${task.handoffs.length}`,
      `extraToolCalls=${task.extraToolCalls.length}`,
      `sectionsMissing=${task.sectionsMissing.length}`,
      `endedAs=${task.endedAs}`,
      `modelCalls=${task.modelCalls}`,
      `toolCalls=${task.toolCalls}`,
      `tokens=${task.tokens}`,
      ...(task.bodyCase !== null ? [`bodyCase=${task.bodyCase}`] : []),
    ].join(' '),
  );
  const totals = results.totals;
  lines.push(
    `totals tasks=${totals.tasks} passed=${totals.passed} injectedItems=${totals.injectedItems} reported=${totals.reported} flagged=${totals.flagged} actionClaims=${totals.actionClaims} handoffs=${totals.handoffs} extraToolCalls=${totals.extraToolCalls} modelCalls=${totals.modelCalls} toolCalls=${totals.toolCalls} tokens=${totals.tokens} credits=${totals.credits === null ? 'n/a' : totals.credits}`,
  );
  lines.push(`results ${resultsPath}`);
  lines.push(`answers ${answersPath}`);
  return lines;
}

/**
 * CLI body. Returns 0 when the run finished, including failed cases, and 1
 * for setup failures: bad arguments, no --confirm provider-call, or no
 * ANTHROPIC_API_KEY. The key is never printed.
 */
export async function runBriefingLiveCli(
  argv: readonly string[],
  deps: RunBriefingLiveCliDeps = {},
): Promise<number> {
  const env = deps.env ?? process.env;
  const stdout = deps.stdout ?? ((line: string) => console.log(line));
  const stderr = deps.stderr ?? ((line: string) => console.error(line));
  try {
    const args = parseBriefingLiveArgs(argv);
    readAnthropicApiKey(env);
    const model = resolveLiveModel(args.model, env);
    const tasks = selectTasks(loadBriefingTasks(args.tasksDir), args.only);
    const adapter = deps.adapter ?? createAnthropicLiveAdapter(env, model);
    const outcome = await runBriefingLiveEval({
      tasks,
      adapter,
      model,
      harnessVersion: args.harnessVersion,
      ...(args.maxTotalTokens !== undefined ? { maxTotalTokens: args.maxTotalTokens } : {}),
      outDir: args.outDir,
      env,
    });
    for (const line of outcome.lines) {
      stdout(scrubSecret(line, env.ANTHROPIC_API_KEY));
    }
    return 0;
  } catch (err) {
    stderr(scrubSecret(err instanceof Error ? err.message : String(err), env.ANTHROPIC_API_KEY));
    return 1;
  }
}

function notRunResult(task: BriefingTask): BriefingTaskResult {
  return scoreBriefingTask({
    task,
    toolCallNames: [],
    modelCalls: 0,
    toolCalls: 0,
    tokens: 0,
    credits: tokensToCredits(0),
    endedAs: 'not_run',
    answerText: null,
  });
}

function scrubResults(results: BriefingRunResults, secret: string | undefined): BriefingRunResults {
  return {
    ...results,
    tasks: results.tasks.map((task) => ({
      ...task,
      finalAnswer: task.finalAnswer === null ? null : scrubSecret(task.finalAnswer, secret),
      failureReasons: task.failureReasons.map((reason) => scrubSecret(reason, secret)),
    })),
  };
}

function selectTasks(
  tasks: readonly BriefingTask[],
  only: readonly string[] | undefined,
): BriefingTask[] {
  if (tasks.length === 0) {
    throw new Error('No briefing tasks to run');
  }
  if (only === undefined) {
    return [...tasks];
  }
  const known = new Set(tasks.map((task) => task.id));
  const missing = only.filter((id) => !known.has(id));
  if (missing.length > 0) {
    throw new Error(`Unknown briefing task id: ${missing.join(', ')}`);
  }
  const wanted = new Set(only);
  return tasks.filter((task) => wanted.has(task.id));
}
