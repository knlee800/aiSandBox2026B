/**
 * Data contract for one Agent Harness eval task.
 * A new task is a JSON file in eval/tasks/. The loader rejects unknown fields.
 */

export const EVAL_ALLOWED_VALIDATION_COMMANDS: readonly string[] = [
  'npm test',
  'npm run build',
  'npx tsc --noEmit',
];

export type EvalContentMatch = 'must' | 'must-not';

export interface EvalContentCheck {
  readonly path: string;
  readonly substring?: string;
  readonly regex?: string;
  readonly match: EvalContentMatch;
}

/** Checked against the model's final answer text, not against a file. */
export interface EvalAnswerCheck {
  readonly substring?: string;
  readonly regex?: string;
  readonly match: EvalContentMatch;
}

export const EVAL_FINAL_ANSWER_CAP = 1000;
const FINAL_ANSWER_TRUNCATION_MARK = '[...truncated]';

/**
 * How the in-memory workspace decides runWorkspaceValidation.
 * allContentChecks: exit 0 only when every content check holds against current files.
 */
export interface EvalValidationRule {
  readonly command: string;
  readonly passWhen: 'allContentChecks';
}

export interface EvalExpectedOutcome {
  readonly filesCreated?: readonly string[];
  readonly filesModified?: readonly string[];
  readonly filesDeleted?: readonly string[];
  readonly unchangedFiles?: readonly string[];
  readonly contentChecks?: readonly EvalContentCheck[];
  readonly answerChecks?: readonly EvalAnswerCheck[];
  readonly validationPasses?: boolean;
  readonly mustNotWrite?: readonly string[];
}

export interface EvalTask {
  readonly id: string;
  readonly description: string;
  readonly initialFiles: Readonly<Record<string, string>>;
  readonly userRequest: string;
  readonly expected: EvalExpectedOutcome;
  readonly maxToolIterations?: number;
  readonly validation?: EvalValidationRule;
}

export interface EvalWriteAttempt {
  readonly op: 'write';
  readonly path: string;
  readonly content: string;
  succeeded: boolean;
}

export interface EvalDeleteAttempt {
  readonly op: 'delete';
  readonly path: string;
  succeeded: boolean;
}

export type EvalMutationAttempt = EvalWriteAttempt | EvalDeleteAttempt;

export interface EvalValidationRun {
  readonly command: string;
  readonly exitCode: number;
}

export type EvalSafetyReason = 'mustNotWrite' | 'outsideWorkspace' | 'envFile';

export interface EvalSafetyViolation {
  readonly op: 'write' | 'delete';
  readonly path: string;
  readonly reason: EvalSafetyReason;
}

export interface EvalBlockedAttempt {
  readonly toolName: string;
  readonly message: string;
}

export type EvalEndedAs =
  | 'answered'
  | 'step_limit'
  | 'refusal'
  | 'error'
  | 'aborted'
  | 'not_run';

export interface EvalTaskResult {
  readonly id: string;
  readonly passed: boolean;
  readonly safetyViolations: readonly EvalSafetyViolation[];
  readonly blockedAttempts: readonly EvalBlockedAttempt[];
  readonly modelCalls: number;
  readonly toolCalls: number;
  readonly tokens: number;
  readonly credits: number | null;
  readonly endedAs: EvalEndedAs;
  /**
   * True when a live run recorded the task without starting it.
   * Absent on tasks that ran. A not-run task is never a pass.
   */
  readonly notRun?: boolean;
  /** Final answer text, whitespace kept, capped at 1000 characters. Null when the run has none. */
  readonly finalAnswer: string | null;
  readonly failureReasons: readonly string[];
}

export interface EvalRunTotals {
  readonly tasks: number;
  readonly passed: number;
  readonly failed: number;
  readonly safetyViolations: number;
  readonly blockedAttempts: number;
  readonly modelCalls: number;
  readonly toolCalls: number;
  readonly tokens: number;
  readonly credits: number | null;
}

export interface EvalRunResults {
  readonly runId: string;
  readonly startedAt: string;
  readonly model: string;
  readonly harnessVersion: string;
  readonly tasks: readonly EvalTaskResult[];
  readonly totals: EvalRunTotals;
}

export function normalizeEvalPath(rawPath: string): string {
  let normalized = rawPath.trim().replace(/\\/g, '/');
  while (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }
  if (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function isOutsideWorkspacePath(rawPath: string): boolean {
  const trimmed = rawPath.trim();
  if (trimmed.length === 0) {
    return true;
  }
  if (/^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith('\\\\')) {
    return true;
  }
  const segments = normalizeEvalPath(trimmed).split('/');
  return segments.some((segment) => segment === '..');
}

/** A `.env` file, including `.env.local`. Does not treat `.envrc` as one. */
export function isEnvFilePath(rawPath: string): boolean {
  const base = normalizeEvalPath(rawPath).split('/').pop() ?? '';
  return base === '.env' || base.startsWith('.env.');
}

/**
 * Stores at most 1000 characters. A longer answer keeps the first characters
 * and ends with `[...truncated]` inside that cap. Short answers are unchanged,
 * including leading and trailing whitespace.
 */
export function capFinalAnswer(text: string): string {
  if (text.length <= EVAL_FINAL_ANSWER_CAP) {
    return text;
  }
  const keep = EVAL_FINAL_ANSWER_CAP - FINAL_ANSWER_TRUNCATION_MARK.length;
  return text.slice(0, keep) + FINAL_ANSWER_TRUNCATION_MARK;
}

export function answerCheckFailure(
  text: string,
  check: EvalAnswerCheck,
): string | null {
  const pattern = check.substring ?? check.regex ?? '';
  let matched = false;
  if (check.substring !== undefined) {
    matched = text.includes(check.substring);
  } else {
    try {
      matched = new RegExp(check.regex as string).test(text);
    } catch {
      return `answer check failed: ${pattern}`;
    }
  }
  if (check.match === 'must' && !matched) {
    return `answer check failed: ${pattern}`;
  }
  if (check.match === 'must-not' && matched) {
    return `answer check matched forbidden text: ${pattern}`;
  }
  return null;
}

export function contentCheckFailure(
  content: string | undefined,
  check: EvalContentCheck,
): string | null {
  if (content === undefined) {
    return `missing file: ${check.path}`;
  }
  let matched = false;
  if (check.substring !== undefined) {
    matched = content.includes(check.substring);
  } else {
    try {
      matched = new RegExp(check.regex as string).test(content);
    } catch {
      return `content check invalid regex: ${check.path}`;
    }
  }
  if (check.match === 'must' && !matched) {
    return `content check failed: ${check.path}`;
  }
  if (check.match === 'must-not' && matched) {
    return `content check matched forbidden text: ${check.path}`;
  }
  return null;
}

export function contentChecksHold(
  files: ReadonlyMap<string, string> | Readonly<Record<string, string>>,
  checks: readonly EvalContentCheck[],
): boolean {
  return checks.every((check) => {
    const content =
      files instanceof Map ? files.get(check.path) : files[check.path];
    return contentCheckFailure(content, check) === null;
  });
}
