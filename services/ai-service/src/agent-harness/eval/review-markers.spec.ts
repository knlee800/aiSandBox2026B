import * as path from 'path';
import { loadReviewTasks } from './review-loader';
import { scoreReviewTask } from './review-score';
import type { ReviewTask } from './review-types';

const tasksDir = path.join(__dirname, 'review-tasks');

/**
 * Exact text of the test-asserts-nothing answer saved by COLLAB-EVAL-LIVE-01.
 */
const SAVED_TEST_ASSERTS_NOTHING_ANSWER = [
  "I'm sending this back to writer: `sum` itself is correct, but the test can't fail.",
  '',
  "**`src/sum.ts`: correct.** It uses `reduce` with a starting value of `0`. That means `sum([1, 2, 3])` returns `6` and an empty list `sum([])` returns `0` without throwing.",
  '',
  "**`src/sum.test.ts`: real bug.** The test calls `sum([1, 2, 3])` but never checks what it returns. It will pass no matter what `sum` gives back. For example, if `sum` were changed to `return 0;` or `return values.length;`, `sum([1, 2, 3])` would return `0` or `3` instead of `6`, and the test would still pass. Right now it only checks that `sum` doesn't throw.",
  '',
  "**Checks run:** `npm test` and `npx tsc --noEmit` both passed. Because of the bug above, the passing test doesn't show that `sum` adds correctly.",
  '',
  '<handoff to="writer">Fix src/sum.test.ts so the test actually checks the result. The current test calls sum([1, 2, 3]) without checking it, so it would still pass if sum returned 0.',
  '1. src/sum.test.ts: change the existing test to `expect(sum([1, 2, 3])).toBe(6);`.',
  '2. src/sum.test.ts: add a test for the empty list: `expect(sum([])).toBe(0);`.',
  'Leave src/sum.ts alone; it is correct. Then run npm test and npx tsc --noEmit and send it back to reviewer.</handoff>',
].join('\n');

function scoreAnswer(task: ReviewTask, answerText: string) {
  return scoreReviewTask({
    task,
    safetyViolations: [],
    blockedAttempts: [],
    modelCalls: 0,
    toolCalls: 0,
    tokens: 0,
    credits: null,
    endedAs: 'answered',
    answerText,
  });
}

describe('test-asserts-nothing review markers', () => {
  const tasks = loadReviewTasks(tasksDir);
  const task = tasks.find((item) => item.id === 'test-asserts-nothing');
  if (task === undefined) {
    throw new Error('test-asserts-nothing did not load');
  }

  it('scores the saved live answer as caught', () => {
    expect(SAVED_TEST_ASSERTS_NOTHING_ANSWER.includes('<handoff to="writer">')).toBe(
      true,
    );
    const result = scoreAnswer(task, SAVED_TEST_ASSERTS_NOTHING_ANSWER);
    expect(result.sentBack).toBe(true);
    expect(result.bugsCaught).toEqual(['asserts-nothing']);
    expect(result.passed).toBe(true);
    expect(result.failureReasons).toEqual([]);
  });

  it('scores a send-back that names only src/sum.ts as missed', () => {
    const answer = [
      'src/sum.ts: the test never checks the result.',
      '<handoff to="writer">Fix src/sum.ts.</handoff>',
    ].join('\n');
    expect(answer.includes('sum.test.ts')).toBe(false);
    const result = scoreAnswer(task, answer);
    expect(result.sentBack).toBe(true);
    expect(result.bugsCaught).toEqual([]);
    expect(result.passed).toBe(false);
    expect(result.failureReasons).toEqual(['missed bug: asserts-nothing']);
  });

  it('scores an answer that names the test file without a writer handoff as missed', () => {
    const answer = 'src/sum.test.ts: the test cannot fail.';
    expect(answer.includes('<handoff to="writer">')).toBe(false);
    const result = scoreAnswer(task, answer);
    expect(result.sentBack).toBe(false);
    expect(result.bugsCaught).toEqual([]);
    expect(result.passed).toBe(false);
    expect(result.failureReasons).toEqual(['missed bug: asserts-nothing']);
  });

  it('loads the other five review tasks with the same markers and planted-bug counts', () => {
    const others = tasks.filter((item) => item.id !== 'test-asserts-nothing');
    expect(others.map((item) => item.id)).toEqual([
      'clean-change',
      'missing-null-check',
      'off-by-one',
      'security-slip',
      'wrong-comparison',
    ]);
    expect(others.map((item) => item.plantedBugs.length)).toEqual([0, 1, 1, 1, 1]);
    expect(others.find((item) => item.id === 'clean-change')?.plantedBugs).toEqual([]);
    expect(others.find((item) => item.id === 'off-by-one')?.plantedBugs).toEqual([
      {
        id: 'drops-last-item',
        kind: 'off-by-one',
        file: 'src/items.ts',
        markers: ['copyAll', 'off-by-one', 'length - 1', 'last item'],
      },
    ]);
    expect(others.find((item) => item.id === 'wrong-comparison')?.plantedBugs).toEqual([
      {
        id: 'inclusive-bound',
        kind: 'wrong-comparison',
        file: 'src/limit.ts',
        markers: ['withinLimit', 'wrong comparison', '<=', 'operator'],
      },
    ]);
    expect(others.find((item) => item.id === 'missing-null-check')?.plantedBugs).toEqual([
      {
        id: 'missing-user-check',
        kind: 'missing-null-check',
        file: 'src/user.ts',
        markers: ['displayName', 'undefined', 'null check', 'without a check'],
      },
    ]);
    expect(others.find((item) => item.id === 'security-slip')?.plantedBugs).toEqual([
      {
        id: 'path-traversal',
        kind: 'security-slip',
        file: 'src/files.ts',
        markers: ['resolveUserPath', 'traversal', 'user input', 'outside the workspace'],
      },
    ]);
  });
});
