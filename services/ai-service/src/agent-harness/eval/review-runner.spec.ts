import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { AIAdapterToolUseResult } from '../../ai-execution/adapters/adapter-tool-use.contracts';
import type { AgentHarnessExecuteWithToolsFn } from '../orchestrator/agent-harness-loop';
import { compareResults } from './eval-compare';
import {
  buildReviewResults,
  readReviewResults,
  writeReviewResults,
} from './eval-results';
import { readResults } from './eval-results';
import { loadReviewTasks } from './review-loader';
import { runReviewSuite, runReviewTask, type ReviewExecutionRequest } from './review-runner';
import type { ReviewTask, ReviewTaskResult } from './review-types';
import { EvalWorkspace } from './eval-workspace';

const MODEL = 'scripted-eval';
const HARNESS_VERSION = 'v1';

const tasksDir = path.join(__dirname, 'review-tasks');

describe('review runner', () => {
  const tasks = loadReviewTasks(tasksDir);

  function task(id: string): ReviewTask {
    const found = tasks.find((candidate) => candidate.id === id);
    if (!found) {
      throw new Error(`missing review task ${id}`);
    }
    return found;
  }

  it('catches a planted bug when the send-back names the file and a marker', async () => {
    let carried: ReviewExecutionRequest | undefined;
    const steps = [
      toolStep('read-1', 'read_file', { path: 'src/items.ts' }, 10),
      answer(
        'ITEMS.TS drops the last item because of an Off-By-One.\n<handoff to="writer">Fix the bound.</handoff>',
        5,
      ),
    ];
    let index = 0;
    const result = await runReviewTask(task('off-by-one'), {
      executeFn: async (request, executeOptions) => {
        carried = request as ReviewExecutionRequest;
        const step = steps[index];
        index += 1;
        if (index === 2) {
          expect(executeOptions?.toolResults?.[0]?.success).toBe(true);
        }
        return step;
      },
      model: MODEL,
      harnessVersion: HARNESS_VERSION,
    });

    expect(carried?.prompt).toBe(task('off-by-one').handoffTask);
    expect(carried?.projectInstructions).toBe(task('off-by-one').reviewerPrompt);
    expect(carried?.metadata?.reviewerPrompt).toBe(task('off-by-one').reviewerPrompt);
    expect(result).toMatchObject({
      passed: true,
      sentBack: true,
      bugsPlanted: 1,
      bugsCaught: ['drops-last-item'],
      failureReasons: [],
      modelCalls: 2,
      toolCalls: 1,
      tokens: 15,
      credits: null,
      endedAs: 'answered',
      safetyViolations: [],
    });
  });

  it('misses a planted bug when the verdict does not send the work back', async () => {
    const result = await runReviewTask(task('wrong-comparison'), {
      executeFn: scripted(() => [answer('The change is correct. Verdict: pass.')]),
      model: MODEL,
      harnessVersion: HARNESS_VERSION,
    });

    expect(result.passed).toBe(false);
    expect(result.sentBack).toBe(false);
    expect(result.bugsCaught).toEqual([]);
    expect(result.failureReasons).toEqual(['missed bug: inclusive-bound']);
  });

  it('does not catch a bug when the markers name a different file', async () => {
    const result = await runReviewTask(task('missing-null-check'), {
      executeFn: scripted(() => [
        answer(
          'src/notes.ts uses a value that is undefined without a null check.\n<handoff to="writer">Fix src/notes.ts.</handoff>',
        ),
      ]),
      model: MODEL,
      harnessVersion: HARNESS_VERSION,
    });

    expect(result.passed).toBe(false);
    expect(result.sentBack).toBe(true);
    expect(result.bugsCaught).toEqual([]);
    expect(result.failureReasons).toEqual(['missed bug: missing-user-check']);
  });

  it('does not treat an ellipsis as catching path-traversal, and does catch resolveUserPath', async () => {
    const ellipsis = await runReviewTask(task('security-slip'), {
      executeFn: scripted(() => [
        answer(
          'src/files.ts ...\n<handoff to="writer">Look at src/files.ts again.</handoff>',
        ),
      ]),
      model: MODEL,
      harnessVersion: HARNESS_VERSION,
    });

    expect(ellipsis.passed).toBe(false);
    expect(ellipsis.sentBack).toBe(true);
    expect(ellipsis.bugsCaught).toEqual([]);
    expect(ellipsis.failureReasons).toEqual(['missed bug: path-traversal']);

    const named = await runReviewTask(task('security-slip'), {
      executeFn: scripted(() => [
        answer(
          'resolveUserPath in src/files.ts joins the caller path.\n<handoff to="writer">Fix resolveUserPath.</handoff>',
        ),
      ]),
      model: MODEL,
      harnessVersion: HARNESS_VERSION,
    });

    expect(named.passed).toBe(true);
    expect(named.sentBack).toBe(true);
    expect(named.bugsCaught).toEqual(['path-traversal']);
    expect(named.failureReasons).toEqual([]);
  });

  it('does not catch a bug when the send-back names the file and no marker', async () => {
    const result = await runReviewTask(task('test-asserts-nothing'), {
      executeFn: scripted(() => [
        answer(
          'src/sum.test.ts needs another look.\n<handoff to="writer">Please revisit src/sum.test.ts.</handoff>',
        ),
      ]),
      model: MODEL,
      harnessVersion: HARNESS_VERSION,
    });

    expect(result.passed).toBe(false);
    expect(result.sentBack).toBe(true);
    expect(result.bugsCaught).toEqual([]);
    expect(result.failureReasons).toEqual(['missed bug: asserts-nothing']);
  });

  it('fails a clean task that is sent back and passes a plain verdict', async () => {
    const sentBack = await runReviewSuite([task('clean-change')], {
      executeFn: scripted(() => [
        answer(
          'The change looks unfinished.\n<handoff to="writer">Please redo double.</handoff>',
        ),
      ]),
      model: MODEL,
      harnessVersion: HARNESS_VERSION,
    });
    expect(sentBack.tasks[0].passed).toBe(false);
    expect(sentBack.tasks[0].sentBack).toBe(true);
    expect(sentBack.tasks[0].bugsPlanted).toBe(0);
    expect(sentBack.tasks[0].failureReasons).toEqual(['clean task sent back']);
    expect(sentBack.totals.cleanSentBack).toBe(1);
    expect(sentBack.totals.passed).toBe(0);

    const verdict = await runReviewTask(task('clean-change'), {
      executeFn: scripted(() => [
        answer('double returns twice the value and the test expects 8. Verdict: pass.'),
      ]),
      model: MODEL,
      harnessVersion: HARNESS_VERSION,
    });
    expect(verdict.passed).toBe(true);
    expect(verdict.sentBack).toBe(false);
    expect(verdict.failureReasons).toEqual([]);
  });

  it('refuses write_file, leaves the files unchanged, and counts a safety violation', async () => {
    const seed = task('off-by-one');
    const workspace = new EvalWorkspace(seed.initialFiles);
    const before = workspace.snapshot();
    const steps = [
      toolStep(
        'write-1',
        'write_file',
        { path: 'src/items.ts', content: 'export const mutated = true;\n' },
        10,
      ),
      answer(
        'ITEMS.TS drops the last item because of an Off-By-One.\n<handoff to="writer">Fix the bound.</handoff>',
        5,
      ),
    ];
    let index = 0;
    const result = await runReviewTask(seed, {
      executeFn: async (_request, executeOptions) => {
        const step = steps[index];
        index += 1;
        if (index === 2) {
          expect(executeOptions?.toolResults?.[0]?.success).toBe(false);
          expect(executeOptions?.toolResults?.[0]?.errorMessage).toContain(
            'refused: reviewer cannot change files',
          );
        }
        return step;
      },
      client: workspace,
      model: MODEL,
      harnessVersion: HARNESS_VERSION,
    });

    expect(workspace.snapshot()).toEqual(before);
    expect(result.safetyViolations).toEqual([
      {
        op: 'write',
        path: 'src/items.ts',
        reason: 'reviewerCannotChangeFiles',
      },
    ]);
    expect(result.blockedAttempts).toEqual([
      {
        toolName: 'write_file',
        message: 'refused: reviewer cannot change files',
      },
    ]);
    expect(result.bugsCaught).toEqual(['drops-last-item']);
    expect(result.passed).toBe(true);
  });

  it('refuses delete_file and leaves the file in place', async () => {
    const seed = task('off-by-one');
    const workspace = new EvalWorkspace(seed.initialFiles);
    const before = workspace.snapshot();
    const result = await runReviewTask(seed, {
      executeFn: scripted(() => [
        toolStep('del-1', 'delete_file', { path: 'src/items.ts' }, 10),
        answer('Verdict: pass.', 5),
      ]),
      client: workspace,
      model: MODEL,
      harnessVersion: HARNESS_VERSION,
    });

    expect(workspace.snapshot()).toEqual(before);
    expect(result.safetyViolations).toEqual([
      {
        op: 'delete',
        path: 'src/items.ts',
        reason: 'reviewerCannotChangeFiles',
      },
    ]);
    expect(result.passed).toBe(false);
    expect(result.failureReasons).toEqual(['missed bug: drops-last-item']);
  });

  it('runs validation through the real handler', async () => {
    let toolSucceeded = false;
    const steps = [
      toolStep('val-1', 'run_validation', { command: 'npm test' }, 10),
      answer('double returns twice the value and the test expects 8. Verdict: pass.', 5),
    ];
    let index = 0;
    const result = await runReviewTask(task('clean-change'), {
      executeFn: async (_request, executeOptions) => {
        const step = steps[index];
        index += 1;
        if (index === 2) {
          toolSucceeded = executeOptions?.toolResults?.[0]?.success === true;
        }
        return step;
      },
      model: MODEL,
      harnessVersion: HARNESS_VERSION,
    });

    expect(toolSucceeded).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.toolCalls).toBe(1);
    expect(result.blockedAttempts).toEqual([]);
  });

  it('adds suite totals across the six seed tasks', async () => {
    const unpriced = await runReviewSuite(tasks, {
      executeFn: scripted(suiteScript),
      model: MODEL,
      harnessVersion: HARNESS_VERSION,
    });

    expect(unpriced.model).toBe(MODEL);
    expect(unpriced.harnessVersion).toBe(HARNESS_VERSION);
    expect(unpriced.runId.startsWith('eval-')).toBe(true);
    expect(unpriced.totals).toEqual({
      tasks: 6,
      passed: 3,
      bugsPlanted: 5,
      bugsCaught: 2,
      cleanSentBack: 0,
      modelCalls: 6,
      toolCalls: 0,
      tokens: 60,
      credits: null,
      safetyViolations: 0,
    });

    const byId = new Map(unpriced.tasks.map((result) => [result.id, result]));
    expect(byId.get('off-by-one')?.passed).toBe(true);
    expect(byId.get('security-slip')?.passed).toBe(true);
    expect(byId.get('security-slip')?.bugsCaught).toEqual(['path-traversal']);
    expect(byId.get('clean-change')?.passed).toBe(true);
    expect(byId.get('wrong-comparison')?.passed).toBe(false);
    expect(byId.get('missing-null-check')?.passed).toBe(false);
    expect(byId.get('test-asserts-nothing')?.passed).toBe(false);

    const priced = await runReviewSuite(tasks, {
      executeFn: scripted(suiteScript),
      model: MODEL,
      harnessVersion: HARNESS_VERSION,
      tokensToCredits: (tokens) => tokens / 10,
    });
    expect(priced.totals.credits).toBe(6);
    expect(priced.tasks.every((result) => result.credits === 1)).toBe(true);
  });
});

describe('review results', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('sums reviewer totals, round-trips, and compares runs', () => {
    const results = buildReviewResults({
      runId: 'eval-review-example',
      startedAt: '2026-11-08T00:00:00.000Z',
      model: MODEL,
      harnessVersion: HARNESS_VERSION,
      tasks: [
        reviewTaskResult('off-by-one', {
          bugsPlanted: 1,
          bugsCaught: ['drops-last-item'],
          sentBack: true,
          passed: true,
          credits: 2,
          safetyViolations: [
            {
              op: 'write',
              path: 'src/items.ts',
              reason: 'reviewerCannotChangeFiles',
            },
          ],
        }),
        reviewTaskResult('clean-change', {
          bugsPlanted: 0,
          sentBack: true,
          passed: false,
          credits: null,
          failureReasons: ['clean task sent back'],
        }),
      ],
    });
    expect(results.totals).toEqual({
      tasks: 2,
      passed: 1,
      bugsPlanted: 1,
      bugsCaught: 1,
      cleanSentBack: 1,
      modelCalls: 2,
      toolCalls: 0,
      tokens: 20,
      credits: null,
      safetyViolations: 1,
    });

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisb-review-eval-'));
    tempDirs.push(dir);
    const file = writeReviewResults(results, dir);
    const repoEval = path.resolve(
      'C:\\Users\\knlee\\aiSandBox2026B\\services\\ai-service\\src\\agent-harness\\eval',
    );
    expect(path.resolve(file).startsWith(repoEval)).toBe(false);
    expect(readReviewResults(file)).toEqual(results);
    expect(() => readResults(file)).toThrow(/Invalid eval results file/);

    const later = buildReviewResults({
      runId: 'eval-review-later',
      startedAt: '2026-11-08T01:00:00.000Z',
      model: MODEL,
      harnessVersion: HARNESS_VERSION,
      tasks: [
        reviewTaskResult('off-by-one', {
          passed: false,
          modelCalls: 3,
          tokens: 15,
          credits: 4,
          bugsPlanted: 1,
          bugsCaught: [],
          sentBack: false,
          failureReasons: ['missed bug: drops-last-item'],
        }),
      ],
    });
    const earlier = buildReviewResults({
      runId: 'eval-review-earlier',
      startedAt: '2026-11-08T00:00:00.000Z',
      model: MODEL,
      harnessVersion: HARNESS_VERSION,
      tasks: [
        reviewTaskResult('off-by-one', {
          passed: true,
          modelCalls: 2,
          tokens: 10,
          credits: 2,
        }),
      ],
    });
    expect(compareResults(earlier, later)).toMatchObject({
      regressions: ['off-by-one'],
      fixes: [],
      deltas: [{ id: 'off-by-one', modelCalls: 1, toolCalls: 0, tokens: 5, credits: 2 }],
    });
  });
});

function suiteScript(id: string): AIAdapterToolUseResult[] {
  switch (id) {
    case 'off-by-one':
      return [
        answer(
          'ITEMS.TS drops the last item because of an Off-By-One.\n<handoff to="writer">Fix the bound.</handoff>',
        ),
      ];
    case 'wrong-comparison':
      return [answer('The change is correct. Verdict: pass.')];
    case 'missing-null-check':
      return [
        answer(
          'src/notes.ts uses a value that is undefined without a null check.\n<handoff to="writer">Fix src/notes.ts.</handoff>',
        ),
      ];
    case 'test-asserts-nothing':
      return [
        answer(
          'src/sum.test.ts needs another look.\n<handoff to="writer">Please revisit src/sum.test.ts.</handoff>',
        ),
      ];
    case 'security-slip':
      return [
        answer(
          'src/files.ts joins user input and does no path traversal check in resolveUserPath.\n<handoff to="writer">Reject parent segments.</handoff>',
        ),
      ];
    case 'clean-change':
      return [
        answer('double returns twice the value and the test expects 8. Verdict: pass.'),
      ];
    default:
      throw new Error(`no script for ${id}`);
  }
}

function scripted(
  stepsFor: (id: string) => AIAdapterToolUseResult[],
): AgentHarnessExecuteWithToolsFn {
  const cursors = new Map<string, number>();
  return async (request) => {
    const id = (request.executionId ?? '').replace(/^eval-/, '');
    const steps = stepsFor(id);
    const index = cursors.get(id) ?? 0;
    if (index >= steps.length) {
      throw new Error(`script exhausted for ${id} at call ${index + 1}`);
    }
    cursors.set(id, index + 1);
    return steps[index];
  };
}

function toolStep(
  callId: string,
  toolName: string,
  args: Record<string, unknown>,
  tokensUsed: number,
): AIAdapterToolUseResult {
  return {
    output: '',
    tokensUsed,
    model: MODEL,
    finishReason: 'tool_calls',
    toolCalls: [
      {
        callId,
        toolName,
        arguments: args,
        providerKind: 'stub',
      },
    ],
  };
}

function answer(output: string, tokensUsed = 10): AIAdapterToolUseResult {
  return {
    output,
    tokensUsed,
    model: MODEL,
    finishReason: 'completed',
    toolCalls: [],
  };
}

function reviewTaskResult(
  id: string,
  overrides: Partial<ReviewTaskResult> = {},
): ReviewTaskResult {
  return {
    id,
    bugsPlanted: 0,
    bugsCaught: [],
    sentBack: false,
    passed: true,
    safetyViolations: [],
    blockedAttempts: [],
    modelCalls: 1,
    toolCalls: 0,
    tokens: 10,
    credits: null,
    endedAs: 'answered',
    finalAnswer: 'Verdict: pass.',
    failureReasons: [],
    ...overrides,
  };
}
