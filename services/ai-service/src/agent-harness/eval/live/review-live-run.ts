import * as fs from 'fs';
import * as path from 'path';
import { buildReviewResults, writeReviewResults } from '../eval-results';
import { createRunId } from '../eval-runner';
import { loadReviewTasks } from '../review-loader';
import { runReviewTask } from '../review-runner';
import { scoreReviewTask } from '../review-score';
import type { ReviewRunResults, ReviewTask, ReviewTaskResult } from '../review-types';
import {
  createAnthropicLiveAdapter,
  readAnthropicApiKey,
  resolveLiveModel,
  scrubSecret,
} from './live-adapter';
import {
  evalExecutionId,
  tokensToCredits,
  type LiveExecuteAdapter,
  type LiveTokenUsage,
} from './live-execute';
import { LIVE_MAX_RUN_TOKENS, parseLiveArgs } from './live-run';
import {
  createReviewLiveExecuteFn,
  DEFAULT_REVIEW_MAX_TOTAL_TOKENS,
} from './review-live-execute';

export { DEFAULT_REVIEW_MAX_TOTAL_TOKENS } from './review-live-execute';

export interface RunReviewLiveEvalOptions {
  readonly tasks: readonly ReviewTask[];
  readonly adapter: LiveExecuteAdapter;
  readonly model: string;
  readonly harnessVersion: string;
  readonly maxTotalTokens?: number;
  readonly outDir: string;
  readonly env?: NodeJS.ProcessEnv;
}

export interface ReviewLiveAnswer {
  readonly id: string;
  readonly answer: string | null;
}

export interface RunReviewLiveEvalOutcome {
  readonly results: ReviewRunResults;
  readonly resultsPath: string;
  readonly answersPath: string;
  readonly lines: readonly string[];
}

export interface RunReviewLiveCliDeps {
  readonly env?: NodeJS.ProcessEnv;
  readonly adapter?: LiveExecuteAdapter;
  readonly stdout?: (line: string) => void;
  readonly stderr?: (line: string) => void;
}

/**
 * Runs the loaded reviewer tasks on the live reviewer executeFn.
 * Step limit stays the eval default (8). maxRunTokens is LIVE_MAX_RUN_TOKENS.
 *
 * After the running token total reaches the cap, the task that was in
 * progress ends through the runner as error when it asks for another model
 * call. Tasks not yet started are scored with scoreReviewTask endedAs
 * not_run, so they are not passes. A task whose last model call finishes
 * the loop at the cap is scored normally; later tasks are not run.
 */
export async function runReviewLiveEval(
  options: RunReviewLiveEvalOptions,
): Promise<RunReviewLiveEvalOutcome> {
  const maxTotalTokens = options.maxTotalTokens ?? DEFAULT_REVIEW_MAX_TOTAL_TOKENS;
  const usage: LiveTokenUsage = { totalTokens: 0 };
  const completedOutputs = new Map<string, string>();
  const executeFn = createReviewLiveExecuteFn({
    tasks: options.tasks,
    adapter: options.adapter,
    maxTotalTokens,
    tokenUsage: usage,
    env: options.env,
    completedOutputs,
  });
  const startedAt = new Date();
  const taskResults: ReviewTaskResult[] = [];
  let capClosed = false;
  for (const task of options.tasks) {
    if (capClosed || usage.totalTokens >= maxTotalTokens) {
      capClosed = true;
      taskResults.push(notRunResult(task));
      continue;
    }
    const result = await runReviewTask(task, {
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
  const results = buildReviewResults({
    runId: createRunId(startedAt),
    startedAt: startedAt.toISOString(),
    model: options.model,
    harnessVersion: options.harnessVersion,
    tasks: taskResults,
  });
  const secret = options.env?.ANTHROPIC_API_KEY;
  const stored = scrubResults(results, secret);
  const resultsPath = writeReviewResults(stored, options.outDir);
  const answers = stored.tasks.map((task) => ({
    id: task.id,
    answer: scrubAnswer(fullAnswerFor(task, completedOutputs), secret),
  }));
  const answersPath = writeReviewAnswers(stored.runId, answers, options.outDir, secret);
  scrubWrittenFile(resultsPath, secret);
  scrubWrittenFile(answersPath, secret);
  return {
    results: stored,
    resultsPath,
    answersPath,
    lines: formatReviewLiveReport(stored, resultsPath, answersPath),
  };
}

export function formatReviewLiveReport(
  results: ReviewRunResults,
  resultsPath: string,
  answersPath: string,
): string[] {
  const lines = results.tasks.map((task) => {
    const fields = [
      task.id,
      `caught=${task.bugsCaught.length}/${task.bugsPlanted}`,
    ];
    if (task.bugsPlanted === 0) {
      fields.push(`cleanSentBack=${task.sentBack}`);
    }
    fields.push(
      `endedAs=${task.endedAs}`,
      `modelCalls=${task.modelCalls}`,
      `toolCalls=${task.toolCalls}`,
      `tokens=${task.tokens}`,
      `safetyViolations=${task.safetyViolations.length}`,
    );
    if (task.endedAs === 'not_run') {
      fields.push('notRun=true');
    }
    return fields.join(' ');
  });
  const totals = results.totals;
  const credits = totals.credits === null ? 'n/a' : String(totals.credits);
  lines.push(
    `totals tasks=${totals.tasks} passed=${totals.passed} bugsPlanted=${totals.bugsPlanted} bugsCaught=${totals.bugsCaught} cleanSentBack=${totals.cleanSentBack} modelCalls=${totals.modelCalls} toolCalls=${totals.toolCalls} tokens=${totals.tokens} credits=${credits} safetyViolations=${totals.safetyViolations}`,
  );
  lines.push(`results ${resultsPath}`);
  lines.push(`answers ${answersPath}`);
  return lines;
}

/**
 * CLI body. Returns 0 when the run finished, including misses.
 * Returns 1 for setup failures. Prints one line per task, a totals line,
 * and the results and answers paths. The API key is never printed.
 */
export async function runReviewLiveCli(
  argv: readonly string[],
  deps: RunReviewLiveCliDeps = {},
): Promise<number> {
  const env = deps.env ?? process.env;
  const stdout = deps.stdout ?? ((line: string) => console.log(line));
  const stderr = deps.stderr ?? ((line: string) => console.error(line));
  try {
    const args = parseLiveArgs(argv);
    readAnthropicApiKey(env);
    const model = resolveLiveModel(args.model, env);
    const tasks = selectReviewTasks(loadReviewTasks(args.tasksDir), args.only);
    const adapter = deps.adapter ?? createAnthropicLiveAdapter(env, model);
    const outcome = await runReviewLiveEval({
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

function notRunResult(task: ReviewTask): ReviewTaskResult {
  return scoreReviewTask({
    task,
    safetyViolations: [],
    blockedAttempts: [],
    modelCalls: 0,
    toolCalls: 0,
    tokens: 0,
    credits: tokensToCredits(0),
    endedAs: 'not_run',
    answerText: null,
  });
}

function fullAnswerFor(
  task: ReviewTaskResult,
  completedOutputs: ReadonlyMap<string, string>,
): string | null {
  if (task.finalAnswer === null) {
    return null;
  }
  const full = completedOutputs.get(evalExecutionId(task.id));
  return full !== undefined ? full : task.finalAnswer;
}

function scrubAnswer(
  answer: string | null,
  secret: string | undefined,
): string | null {
  if (answer === null) {
    return null;
  }
  return scrubSecret(answer, secret);
}

function scrubResults(
  results: ReviewRunResults,
  secret: string | undefined,
): ReviewRunResults {
  return {
    ...results,
    tasks: results.tasks.map((task) => ({
      ...task,
      finalAnswer:
        task.finalAnswer === null ? null : scrubSecret(task.finalAnswer, secret),
      failureReasons: task.failureReasons.map((reason) => scrubSecret(reason, secret)),
      blockedAttempts: task.blockedAttempts.map((attempt) => ({
        ...attempt,
        message: scrubSecret(attempt.message, secret),
      })),
      safetyViolations: task.safetyViolations.map((violation) => ({
        ...violation,
        path: scrubSecret(violation.path, secret),
      })),
    })),
  };
}

function writeReviewAnswers(
  runId: string,
  answers: readonly ReviewLiveAnswer[],
  dir: string,
  secret: string | undefined,
): string {
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `answers-${runId}.json`);
  const body = scrubSecret(
    `${JSON.stringify({ runId, answers }, null, 2)}\n`,
    secret,
  );
  fs.writeFileSync(filePath, body, 'utf8');
  return filePath;
}

function scrubWrittenFile(filePath: string, secret: string | undefined): void {
  if (typeof secret !== 'string' || secret.length === 0) {
    return;
  }
  const body = fs.readFileSync(filePath, 'utf8');
  const scrubbed = scrubSecret(body, secret);
  if (scrubbed !== body) {
    fs.writeFileSync(filePath, scrubbed, 'utf8');
  }
}

function selectReviewTasks(
  tasks: readonly ReviewTask[],
  only: readonly string[] | undefined,
): ReviewTask[] {
  if (tasks.length === 0) {
    throw new Error('No review tasks to run');
  }
  if (only === undefined) {
    return [...tasks];
  }
  const known = new Set(tasks.map((task) => task.id));
  const missing = only.filter((id) => !known.has(id));
  if (missing.length > 0) {
    throw new Error(`Unknown review task id: ${missing.join(', ')}`);
  }
  const wanted = new Set(only);
  return tasks.filter((task) => wanted.has(task.id));
}
