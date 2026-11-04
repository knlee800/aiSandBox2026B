import * as fs from 'fs';
import * as path from 'path';
import type {
  EvalEndedAs,
  EvalRunResults,
  EvalRunTotals,
  EvalTaskResult,
} from './eval-types';

const ENDED_AS: readonly EvalEndedAs[] = [
  'answered',
  'step_limit',
  'refusal',
  'error',
  'aborted',
];

export function buildEvalResults(input: {
  readonly runId: string;
  readonly startedAt: string;
  readonly model: string;
  readonly harnessVersion: string;
  readonly tasks: readonly EvalTaskResult[];
}): EvalRunResults {
  return {
    runId: input.runId,
    startedAt: input.startedAt,
    model: input.model,
    harnessVersion: input.harnessVersion,
    tasks: input.tasks,
    totals: totalsFor(input.tasks),
  };
}

export function writeResults(results: EvalRunResults, dir: string): string {
  const checked = assertEvalResults(results, dir);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `eval-results-${checked.runId}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(checked, null, 2)}\n`, 'utf8');
  return filePath;
}

export function readResults(file: string): EvalRunResults {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid eval results file ${file}: ${message}`);
  }
  return assertEvalResults(parsed, file);
}

function totalsFor(tasks: readonly EvalTaskResult[]): EvalRunTotals {
  let passed = 0;
  let safetyViolations = 0;
  let blockedAttempts = 0;
  let modelCalls = 0;
  let toolCalls = 0;
  let tokens = 0;
  let credits = 0;
  let creditsKnown = true;
  for (const task of tasks) {
    if (task.passed) {
      passed += 1;
    }
    safetyViolations += task.safetyViolations.length;
    blockedAttempts += task.blockedAttempts.length;
    modelCalls += task.modelCalls;
    toolCalls += task.toolCalls;
    tokens += task.tokens;
    if (task.credits === null) {
      creditsKnown = false;
    } else {
      credits += task.credits;
    }
  }
  return {
    tasks: tasks.length,
    passed,
    failed: tasks.length - passed,
    safetyViolations,
    blockedAttempts,
    modelCalls,
    toolCalls,
    tokens,
    credits: creditsKnown ? credits : null,
  };
}

export function assertEvalResults(value: unknown, label: string): EvalRunResults {
  const fail = (message: string): never => {
    throw new Error(`Invalid eval results file ${label}: ${message}`);
  };
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('results must be an object');
  }
  const record = value as Record<string, unknown>;
  const runId = readString(record.runId, 'runId', fail);
  const startedAt = readString(record.startedAt, 'startedAt', fail);
  const model = readString(record.model, 'model', fail);
  const harnessVersion = readString(record.harnessVersion, 'harnessVersion', fail);
  const taskEntries = record.tasks;
  if (!Array.isArray(taskEntries)) {
    fail('tasks must be an array');
  }
  const seen = new Set<string>();
  const tasks = (taskEntries as unknown[]).map((entry) => {
    const task = readTaskResult(entry, fail);
    if (seen.has(task.id)) {
      fail(`duplicate task id ${task.id}`);
    }
    seen.add(task.id);
    return task;
  });
  if (record.totals === null || typeof record.totals !== 'object') {
    fail('totals must be an object');
  }
  const totals = readTotals(record.totals as Record<string, unknown>, fail);
  return { runId, startedAt, model, harnessVersion, tasks, totals };
}

function readTaskResult(
  value: unknown,
  fail: (message: string) => never,
): EvalTaskResult {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('task result must be an object');
  }
  const record = value as Record<string, unknown>;
  const id = readString(record.id, 'task.id', fail);
  if (typeof record.passed !== 'boolean') {
    fail(`task ${id} passed must be a boolean`);
  }
  if (!Array.isArray(record.safetyViolations)) {
    fail(`task ${id} safetyViolations must be an array`);
  }
  if (!Array.isArray(record.blockedAttempts)) {
    fail(`task ${id} blockedAttempts must be an array`);
  }
  if (!Array.isArray(record.failureReasons)) {
    fail(`task ${id} failureReasons must be an array`);
  }
  const endedAs = record.endedAs;
  if (typeof endedAs !== 'string' || !ENDED_AS.includes(endedAs as EvalEndedAs)) {
    fail(`task ${id} endedAs is invalid`);
  }
  const credits = record.credits;
  if (credits !== null && typeof credits !== 'number') {
    fail(`task ${id} credits must be a number or null`);
  }
  return {
    id,
    passed: record.passed,
    safetyViolations: record.safetyViolations as EvalTaskResult['safetyViolations'],
    blockedAttempts: record.blockedAttempts as EvalTaskResult['blockedAttempts'],
    modelCalls: readNumber(record.modelCalls, `${id}.modelCalls`, fail),
    toolCalls: readNumber(record.toolCalls, `${id}.toolCalls`, fail),
    tokens: readNumber(record.tokens, `${id}.tokens`, fail),
    credits: credits as number | null,
    endedAs: endedAs as EvalEndedAs,
    finalAnswer: readFinalAnswer(record.finalAnswer, id, fail),
    failureReasons: record.failureReasons as string[],
  };
}

function readTotals(
  record: Record<string, unknown>,
  fail: (message: string) => never,
): EvalRunTotals {
  const credits = record.credits;
  if (credits !== null && typeof credits !== 'number') {
    fail('totals.credits must be a number or null');
  }
  return {
    tasks: readNumber(record.tasks, 'totals.tasks', fail),
    passed: readNumber(record.passed, 'totals.passed', fail),
    failed: readNumber(record.failed, 'totals.failed', fail),
    safetyViolations: readNumber(
      record.safetyViolations,
      'totals.safetyViolations',
      fail,
    ),
    blockedAttempts: readNumber(
      record.blockedAttempts,
      'totals.blockedAttempts',
      fail,
    ),
    modelCalls: readNumber(record.modelCalls, 'totals.modelCalls', fail),
    toolCalls: readNumber(record.toolCalls, 'totals.toolCalls', fail),
    tokens: readNumber(record.tokens, 'totals.tokens', fail),
    credits: credits as number | null,
  };
}

function readFinalAnswer(
  value: unknown,
  id: string,
  fail: (message: string) => never,
): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    fail(`task ${id} finalAnswer must be a string or null`);
  }
  return value;
}

function readString(
  value: unknown,
  field: string,
  fail: (message: string) => never,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${field} must be a non-empty string`);
  }
  return value;
}

function readNumber(
  value: unknown,
  field: string,
  fail: (message: string) => never,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${field} must be a finite number`);
  }
  return value;
}
