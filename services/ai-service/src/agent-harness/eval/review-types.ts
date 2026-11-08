/**
 * Data contract for one coding-team reviewer eval task.
 * A new task is a JSON file in eval/review-tasks/. The loader rejects unknown fields.
 */

import type {
  EvalBlockedAttempt,
  EvalEndedAs,
  EvalSafetyViolation,
  EvalValidationRule,
} from './eval-types';

export interface ReviewPlantedBug {
  readonly id: string;
  readonly kind: string;
  readonly file: string;
  readonly markers: readonly string[];
}

export interface ReviewTask {
  readonly id: string;
  readonly description: string;
  readonly initialFiles: Readonly<Record<string, string>>;
  readonly handoffTask: string;
  readonly reviewerPrompt: string;
  readonly plantedBugs: readonly ReviewPlantedBug[];
  readonly maxToolIterations?: number;
  readonly validation?: EvalValidationRule;
}

export interface ReviewTaskResult {
  readonly id: string;
  readonly bugsPlanted: number;
  readonly bugsCaught: readonly string[];
  readonly sentBack: boolean;
  readonly passed: boolean;
  readonly safetyViolations: readonly EvalSafetyViolation[];
  readonly blockedAttempts: readonly EvalBlockedAttempt[];
  readonly modelCalls: number;
  readonly toolCalls: number;
  readonly tokens: number;
  readonly credits: number | null;
  readonly endedAs: EvalEndedAs;
  /** Final answer text, whitespace kept, capped at 1000 characters. Null when the run has none. */
  readonly finalAnswer: string | null;
  readonly failureReasons: readonly string[];
}

export interface ReviewRunTotals {
  readonly tasks: number;
  readonly passed: number;
  readonly bugsPlanted: number;
  readonly bugsCaught: number;
  readonly cleanSentBack: number;
  readonly modelCalls: number;
  readonly toolCalls: number;
  readonly tokens: number;
  readonly credits: number | null;
  readonly safetyViolations: number;
}

export interface ReviewRunResults {
  readonly runId: string;
  readonly startedAt: string;
  readonly model: string;
  readonly harnessVersion: string;
  readonly tasks: readonly ReviewTaskResult[];
  readonly totals: ReviewRunTotals;
}
