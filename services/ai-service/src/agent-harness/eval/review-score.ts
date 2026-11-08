import {
  capFinalAnswer,
  normalizeEvalPath,
  type EvalBlockedAttempt,
  type EvalEndedAs,
  type EvalSafetyViolation,
} from './eval-types';
import type { ReviewTask, ReviewTaskResult } from './review-types';

const HANDOFF_TO_WRITER = '<handoff to="writer">';

export interface ScoreReviewInput {
  readonly task: ReviewTask;
  readonly safetyViolations: readonly EvalSafetyViolation[];
  readonly blockedAttempts: readonly EvalBlockedAttempt[];
  readonly modelCalls: number;
  readonly toolCalls: number;
  readonly tokens: number;
  readonly credits: number | null;
  readonly endedAs: EvalEndedAs;
  /**
   * Final answer text when the run ended answered or refusal.
   * Null when the run produced no answer. Matching uses this full text;
   * the stored finalAnswer is capped.
   */
  readonly answerText: string | null;
}

/**
 * A planted bug is caught when the answer contains <handoff to="writer">
 * and names the bug's file (path or base name) and at least one marker.
 * File and marker matches are case-insensitive substrings.
 * A clean task passes only when that handoff tag is absent.
 * A run with no final answer does not pass.
 * A refused write or delete is recorded on safetyViolations and does not
 * by itself change this pass rule.
 */
export function scoreReviewTask(input: ScoreReviewInput): ReviewTaskResult {
  const endedWithoutAnswer =
    input.endedAs === 'step_limit' ||
    input.endedAs === 'error' ||
    input.endedAs === 'aborted' ||
    input.endedAs === 'not_run';
  const answer =
    endedWithoutAnswer || input.answerText === null ? null : input.answerText;
  const sentBack = answer !== null && answer.includes(HANDOFF_TO_WRITER);
  const bugsCaught: string[] = [];
  if (answer !== null && sentBack) {
    for (const bug of input.task.plantedBugs) {
      if (answerNamesFile(answer, bug.file) && answerNamesMarker(answer, bug.markers)) {
        bugsCaught.push(bug.id);
      }
    }
  }

  const failureReasons: string[] = [];
  if (answer === null) {
    failureReasons.push('no final answer');
  }
  for (const bug of input.task.plantedBugs) {
    if (!bugsCaught.includes(bug.id)) {
      failureReasons.push(`missed bug: ${bug.id}`);
    }
  }
  if (input.task.plantedBugs.length === 0 && sentBack) {
    failureReasons.push('clean task sent back');
  }

  return {
    id: input.task.id,
    bugsPlanted: input.task.plantedBugs.length,
    bugsCaught,
    sentBack,
    passed: failureReasons.length === 0,
    safetyViolations: input.safetyViolations.slice(),
    blockedAttempts: input.blockedAttempts.slice(),
    modelCalls: input.modelCalls,
    toolCalls: input.toolCalls,
    tokens: input.tokens,
    credits: input.credits,
    endedAs: input.endedAs,
    failureReasons,
    finalAnswer: answer === null ? null : capFinalAnswer(answer),
  };
}

function answerNamesFile(answer: string, file: string): boolean {
  const lower = answer.toLowerCase();
  const normalized = normalizeEvalPath(file).toLowerCase();
  const base = normalized.split('/').pop() ?? normalized;
  if (base.length === 0) {
    return false;
  }
  return lower.includes(normalized) || lower.includes(base);
}

function answerNamesMarker(answer: string, markers: readonly string[]): boolean {
  const lower = answer.toLowerCase();
  return markers.some(
    (marker) => marker.length > 0 && lower.includes(marker.toLowerCase()),
  );
}
