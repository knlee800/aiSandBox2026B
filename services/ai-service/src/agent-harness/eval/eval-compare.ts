/**
 * Fields shared by a harness task result and a reviewer task result.
 * Comparison reads only these, so reviewer runs compare the same way
 * as harness runs, and harness baselines keep their existing deltas.
 */
export interface EvalComparableTask {
  readonly id: string;
  readonly passed: boolean;
  readonly modelCalls: number;
  readonly toolCalls: number;
  readonly tokens: number;
  readonly credits: number | null;
}

export interface EvalComparableRun {
  readonly tasks: readonly EvalComparableTask[];
}

export interface EvalTaskDelta {
  readonly id: string;
  readonly modelCalls: number;
  readonly toolCalls: number;
  readonly tokens: number;
  readonly credits: number | null;
}

export interface EvalComparison {
  readonly regressions: readonly string[];
  readonly fixes: readonly string[];
  readonly newTaskIds: readonly string[];
  readonly missingTaskIds: readonly string[];
  readonly deltas: readonly EvalTaskDelta[];
  readonly summary: string;
}

export function compareResults(
  previous: EvalComparableRun,
  current: EvalComparableRun,
): EvalComparison {
  const previousById = indexTasks(previous.tasks);
  const currentById = indexTasks(current.tasks);
  const shared = [...previousById.keys()]
    .filter((id) => currentById.has(id))
    .sort();
  const regressions: string[] = [];
  const fixes: string[] = [];
  const deltas: EvalTaskDelta[] = [];

  for (const id of shared) {
    const before = previousById.get(id) as EvalComparableTask;
    const after = currentById.get(id) as EvalComparableTask;
    if (before.passed && !after.passed) {
      regressions.push(id);
    } else if (!before.passed && after.passed) {
      fixes.push(id);
    }
    deltas.push({
      id,
      modelCalls: after.modelCalls - before.modelCalls,
      toolCalls: after.toolCalls - before.toolCalls,
      tokens: after.tokens - before.tokens,
      credits: creditDelta(before.credits, after.credits),
    });
  }

  const newTaskIds = [...currentById.keys()]
    .filter((id) => !previousById.has(id))
    .sort();
  const missingTaskIds = [...previousById.keys()]
    .filter((id) => !currentById.has(id))
    .sort();

  const comparison: EvalComparison = {
    regressions,
    fixes,
    newTaskIds,
    missingTaskIds,
    deltas,
    summary: '',
  };
  return {
    ...comparison,
    summary: formatSummary(comparison),
  };
}

function formatSummary(comparison: EvalComparison): string {
  const lines = ['id | change | dModel | dTools | dTokens | dCredits'];
  for (const delta of comparison.deltas) {
    let change = 'same';
    if (comparison.regressions.includes(delta.id)) {
      change = 'regression';
    } else if (comparison.fixes.includes(delta.id)) {
      change = 'fix';
    }
    lines.push(
      [
        delta.id,
        change,
        formatSigned(delta.modelCalls),
        formatSigned(delta.toolCalls),
        formatSigned(delta.tokens),
        delta.credits === null ? 'n/a' : formatSigned(delta.credits),
      ].join(' | '),
    );
  }
  for (const id of comparison.newTaskIds) {
    lines.push(`${id} | new`);
  }
  for (const id of comparison.missingTaskIds) {
    lines.push(`${id} | missing`);
  }
  return lines.join('\n');
}

function formatSigned(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }
  return String(value);
}

function creditDelta(
  previous: number | null,
  current: number | null,
): number | null {
  if (previous === null || current === null) {
    return null;
  }
  return current - previous;
}

function indexTasks(
  tasks: readonly EvalComparableTask[],
): Map<string, EvalComparableTask> {
  const map = new Map<string, EvalComparableTask>();
  for (const task of tasks) {
    if (map.has(task.id)) {
      throw new Error(`duplicate eval task id ${task.id}`);
    }
    map.set(task.id, task);
  }
  return map;
}
