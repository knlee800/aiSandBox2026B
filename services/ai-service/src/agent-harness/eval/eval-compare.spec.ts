import { compareResults } from './eval-compare';
import type { EvalRunResults, EvalTaskResult } from './eval-types';

describe('compareResults', () => {
  it('reports a regression, a fix, new and missing ids, and token deltas', () => {
    const previous = run([
      task('alpha', { passed: true, modelCalls: 2, toolCalls: 1, tokens: 100, credits: 4 }),
      task('beta', { passed: false, modelCalls: 5, toolCalls: 4, tokens: 80, credits: null }),
      task('gamma', { passed: true, modelCalls: 1, toolCalls: 0, tokens: 10, credits: 1 }),
    ]);
    const current = run([
      task('alpha', { passed: false, modelCalls: 4, toolCalls: 3, tokens: 140, credits: 6 }),
      task('beta', { passed: true, modelCalls: 3, toolCalls: 2, tokens: 50, credits: null }),
      task('delta', { passed: true, modelCalls: 1, toolCalls: 1, tokens: 5, credits: 1 }),
    ]);

    const comparison = compareResults(previous, current);

    expect(comparison.regressions).toEqual(['alpha']);
    expect(comparison.fixes).toEqual(['beta']);
    expect(comparison.newTaskIds).toEqual(['delta']);
    expect(comparison.missingTaskIds).toEqual(['gamma']);
    expect(comparison.deltas).toEqual([
      { id: 'alpha', modelCalls: 2, toolCalls: 2, tokens: 40, credits: 2 },
      { id: 'beta', modelCalls: -2, toolCalls: -2, tokens: -30, credits: null },
    ]);
    expect(comparison.summary).toBe(
      [
        'id | change | dModel | dTools | dTokens | dCredits',
        'alpha | regression | +2 | +2 | +40 | +2',
        'beta | fix | -2 | -2 | -30 | n/a',
        'delta | new',
        'gamma | missing',
      ].join('\n'),
    );
  });
});

function run(tasks: EvalTaskResult[]): EvalRunResults {
  return {
    runId: 'eval-example',
    startedAt: '2026-11-04T00:00:00.000Z',
    model: 'scripted-eval',
    harnessVersion: 'v1',
    tasks,
    totals: {
      tasks: tasks.length,
      passed: tasks.filter((item) => item.passed).length,
      failed: tasks.filter((item) => !item.passed).length,
      safetyViolations: 0,
      blockedAttempts: 0,
      modelCalls: 0,
      toolCalls: 0,
      tokens: 0,
      credits: null,
    },
  };
}

function task(
  id: string,
  overrides: Partial<EvalTaskResult>,
): EvalTaskResult {
  return {
    id,
    passed: false,
    safetyViolations: [],
    blockedAttempts: [],
    modelCalls: 0,
    toolCalls: 0,
    tokens: 0,
    credits: null,
    endedAs: 'answered',
    finalAnswer: null,
    failureReasons: [],
    ...overrides,
  };
}
