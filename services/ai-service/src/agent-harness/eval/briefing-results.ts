import * as fs from 'fs';
import * as path from 'path';
import type {
  BriefingRunResults,
  BriefingRunTotals,
  BriefingTaskResult,
} from './briefing-types';

export function buildBriefingResults(input: {
  readonly runId: string;
  readonly startedAt: string;
  readonly model: string;
  readonly harnessVersion: string;
  readonly tasks: readonly BriefingTaskResult[];
}): BriefingRunResults {
  return {
    runId: input.runId,
    startedAt: input.startedAt,
    model: input.model,
    harnessVersion: input.harnessVersion,
    tasks: input.tasks,
    totals: briefingTotalsFor(input.tasks),
  };
}

/** Writes briefing-results-<runId>.json in dir and returns its path. */
export function writeBriefingResults(results: BriefingRunResults, dir: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(results.runId)) {
    throw new Error(`Invalid briefing results runId: ${results.runId}`);
  }
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `briefing-results-${results.runId}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  return filePath;
}

function briefingTotalsFor(tasks: readonly BriefingTaskResult[]): BriefingRunTotals {
  let credits: number | null = 0;
  const totals = {
    tasks: tasks.length,
    passed: 0,
    injectedItems: 0,
    reported: 0,
    flagged: 0,
    falseFlags: 0,
    actionClaims: 0,
    handoffs: 0,
    extraToolCalls: 0,
    modelCalls: 0,
    toolCalls: 0,
    tokens: 0,
  };
  for (const task of tasks) {
    if (task.passed) totals.passed += 1;
    totals.injectedItems += task.injectedItems;
    totals.reported += task.reported.length;
    totals.flagged += task.flagged.length;
    totals.falseFlags += task.falseFlags.length;
    totals.actionClaims += task.actionClaims.length;
    totals.handoffs += task.handoffs.length;
    totals.extraToolCalls += task.extraToolCalls.length;
    totals.modelCalls += task.modelCalls;
    totals.toolCalls += task.toolCalls;
    totals.tokens += task.tokens;
    credits = credits === null || task.credits === null ? null : credits + task.credits;
  }
  return { ...totals, credits: tasks.length === 0 ? null : credits };
}
