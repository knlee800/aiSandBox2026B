import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { AIExecutionRequest } from '../../../ai-execution/types';
import type { AIAdapterToolUseResult } from '../../../ai-execution/adapters/adapter-tool-use.contracts';
import { selectAdvertisedAgentHarnessTools } from '../../../ai-execution/adapters/adapter-tool-use.mapper';
import * as harnessLoop from '../../orchestrator/agent-harness-loop';
import * as workerProcessor from '../../../worker/worker.processor';
import { EVAL_FINAL_ANSWER_CAP } from '../eval-types';
import { readReviewResults } from '../eval-results';
import type { ReviewTask } from '../review-types';
import {
  evalExecutionId,
  workspaceContextFromInitialFiles,
  type LiveExecuteAdapter,
} from './live-execute';
import { LIVE_MAX_RUN_TOKENS } from './live-run';
import {
  createReviewLiveExecuteFn,
  REVIEW_LIVE_EXECUTION_INTENT,
} from './review-live-execute';
import {
  DEFAULT_REVIEW_MAX_TOTAL_TOKENS,
  runReviewLiveCli,
  runReviewLiveEval,
} from './review-live-run';

const FAKE_KEY = 'sk-ant-eval-live-FAKE-KEY-9f3c2a';
const MODEL = 'claude-opus-5-5';

const REVIEW_HANDLERS = [
  'read_file',
  'list_files',
  'search_workspace',
  'run_validation',
] as const;

describe('review live runner', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    jest.restoreAllMocks();
  });

  it('builds the reviewer request with project instructions and the hand-off task', async () => {
    const task = makeTask('off-by-one', {
      handoffTask: 'I changed copyAll. Please review.',
      reviewerPrompt: 'You are reviewer.\nName each real bug.',
      initialFiles: { 'src/items.ts': 'export const n = 1;\n' },
    });
    const seen: AIExecutionRequest[] = [];
    const adapter = mockAdapter(async (request) => {
      seen.push(request);
      return completed('Noted.', 10);
    });
    const promptSpy = jest.spyOn(workerProcessor, 'buildExecutionPromptParts');
    const executeFn = createReviewLiveExecuteFn({
      tasks: [task],
      adapter,
      env: { ANTHROPIC_API_KEY: FAKE_KEY },
    });
    const signal = new AbortController().signal;

    await executeFn(
      {
        executionId: evalExecutionId(task.id),
        sessionId: 'eval-session',
        conversationId: 'eval-conversation',
        userId: 'eval-user',
        prompt: task.handoffTask,
        provider: 'stub',
        model: MODEL,
        signal,
      },
      { toolResults: [] },
    );

    expect(REVIEW_LIVE_EXECUTION_INTENT).toBe('conversation');
    expect(promptSpy).toHaveBeenCalledWith(
      task.handoffTask,
      workspaceContextFromInitialFiles(task.initialFiles),
      undefined,
      task.reviewerPrompt,
      { useHarness: true, executionIntent: 'conversation' },
    );
    expect(seen).toHaveLength(1);
    const request = seen[0];
    const expected = workerProcessor.buildExecutionPromptParts(
      task.handoffTask,
      workspaceContextFromInitialFiles(task.initialFiles),
      undefined,
      task.reviewerPrompt,
      { useHarness: true, executionIntent: 'conversation' },
    );
    expect(request.provider).toBe('anthropic');
    expect(request.systemPrompt).toBe(expected.system);
    expect(request.prompt).toBe(expected.user);
    expect(request.systemPrompt).toContain(
      `Project AI Instructions:\n${task.reviewerPrompt}`,
    );
    expect(request.prompt).toContain(`User request:\n${task.handoffTask}`);
    expect(request.prompt).toContain('- src/items.ts');
    expect(request.model).toBe(MODEL);
    expect(request.executionId).toBe('eval-off-by-one');
    expect(request.sessionId).toBe('eval-session');
    expect(request.conversationId).toBe('eval-conversation');
    expect(request.userId).toBe('eval-user');
    expect(request.signal).toBe(signal);
    expect(JSON.stringify(seen)).not.toContain(FAKE_KEY);
  });

  it('advertises the review-profile tools and not write, delete, or knowledge tools', async () => {
    const task = makeTask('tools');
    const seen: string[][] = [];
    const adapter = mockAdapter(async (_request, executeOptions) => {
      seen.push((executeOptions?.tools ?? []).map((tool) => tool.name));
      return completed('Noted.', 5);
    });
    const executeFn = createReviewLiveExecuteFn({
      tasks: [task],
      adapter,
    });

    await executeFn(stubRequest(task), { toolResults: [] });

    const advertised = selectAdvertisedAgentHarnessTools({
      registeredHandlerNames: REVIEW_HANDLERS,
      enableWriteTools: false,
      enableValidationTools: true,
      enableBrowserSmoke: false,
    });
    expect(seen).toEqual([advertised.map((tool) => tool.name)]);
    expect(seen[0]).not.toContain('write_file');
    expect(seen[0]).not.toContain('delete_file');
    expect(seen[0]).not.toContain('search_knowledge');
    expect(seen[0]).not.toContain('read_knowledge');
    expect(seen[0]).toEqual(
      expect.arrayContaining([
        'read_file',
        'list_files',
        'search_workspace',
        'run_validation',
      ]),
    );
  });

  it('throws for an unknown executionId and does not call the adapter', async () => {
    const adapter = mockAdapter(async () => completed('Noted.', 1));
    const executeFn = createReviewLiveExecuteFn({
      tasks: [makeTask('known')],
      adapter,
    });

    await expect(
      executeFn(
        {
          ...stubRequest(makeTask('known')),
          executionId: 'eval-missing',
        },
        { toolResults: [] },
      ),
    ).rejects.toThrow(
      'review live execute has no review task for executionId eval-missing',
    );
    expect(adapter.executeWithTools).not.toHaveBeenCalled();
  });

  it('stops at the token cap and marks tasks that have not started as not run and not passes', async () => {
    const tasks = [
      makeTask('first'),
      makeTask('second'),
      makeTask('clean', { plantedBugs: [] }),
    ];
    let calls = 0;
    const adapter = mockAdapter(async (request) => {
      calls += 1;
      if (request.executionId === evalExecutionId('first')) {
        return toolCall(100);
      }
      return completed('done', 100);
    });
    const outcome = await runReviewLiveEval({
      tasks,
      adapter,
      model: MODEL,
      harnessVersion: 'v1',
      maxTotalTokens: 100,
      outDir: tempDir(),
    });

    expect(calls).toBe(1);
    expect(outcome.results.tasks.map((task) => task.id)).toEqual([
      'first',
      'second',
      'clean',
    ]);
    expect(outcome.results.tasks[0].endedAs).toBe('error');
    expect(outcome.results.tasks[0].passed).toBe(false);
    expect(outcome.results.tasks[0].endedAs).not.toBe('not_run');
    for (const task of outcome.results.tasks.slice(1)) {
      expect(task.passed).toBe(false);
      expect(task.endedAs).toBe('not_run');
      expect(task.modelCalls).toBe(0);
      expect(task.tokens).toBe(0);
    }
    const reread = readReviewResults(outcome.resultsPath);
    expect(reread.tasks[1].endedAs).toBe('not_run');
    expect(reread.tasks[1].passed).toBe(false);
    expect(reread.tasks[2].passed).toBe(false);
    const answers = readAnswers(outcome.answersPath);
    expect(answers.answers.map((entry) => entry.id)).toEqual([
      'first',
      'second',
      'clean',
    ]);
    expect(answers.answers.every((entry) => entry.answer === null)).toBe(true);
    const report = outcome.lines.join('\n');
    expect(report).toContain('second caught=0/1 endedAs=not_run');
    expect(report).toContain('notRun=true');
    expect(report).toContain('clean caught=0/0 cleanSentBack=false endedAs=not_run');
    expect(report).toContain(`results ${outcome.resultsPath}`);
    expect(report).toContain(`answers ${outcome.answersPath}`);
  });

  it('scores a task that finishes on the cap, then does not run the rest', async () => {
    const tasks = [makeTask('done-task'), makeTask('later-task')];
    const adapter = mockAdapter(async () => completed('done', 100));
    const outcome = await runReviewLiveEval({
      tasks,
      adapter,
      model: MODEL,
      harnessVersion: 'v1',
      maxTotalTokens: 100,
      outDir: tempDir(),
    });

    expect(adapter.executeWithTools).toHaveBeenCalledTimes(1);
    expect(outcome.results.tasks[0].endedAs).toBe('answered');
    expect(outcome.results.tasks[0].passed).toBe(false);
    expect(outcome.results.tasks[0].tokens).toBe(100);
    expect(outcome.results.tasks[1].endedAs).toBe('not_run');
    expect(outcome.results.tasks[1].passed).toBe(false);
  });

  it('defaults the whole-run cap to 150000 tokens', async () => {
    expect(DEFAULT_REVIEW_MAX_TOTAL_TOKENS).toBe(150_000);

    const under = await runReviewLiveEval({
      tasks: [makeTask('under-a'), makeTask('under-b')],
      adapter: mockAdapter(async () => completed('done', 149_999)),
      model: MODEL,
      harnessVersion: 'v1',
      outDir: tempDir(),
    });
    expect(under.results.tasks[1].endedAs).not.toBe('not_run');
    expect(under.results.tasks[1].modelCalls).toBe(1);

    const atCap = await runReviewLiveEval({
      tasks: [makeTask('at-a'), makeTask('at-b')],
      adapter: mockAdapter(async () => completed('done', 150_000)),
      model: MODEL,
      harnessVersion: 'v1',
      outDir: tempDir(),
    });
    expect(atCap.results.tasks[0].endedAs).toBe('answered');
    expect(atCap.results.tasks[1].endedAs).toBe('not_run');
    expect(atCap.results.tasks[1].passed).toBe(false);
  });

  it('stores the full final answer, not the capped results text', async () => {
    const longAnswer = `${'x'.repeat(EVAL_FINAL_ANSWER_CAP + 250)} tail`;
    const outcome = await runReviewLiveEval({
      tasks: [makeTask('long')],
      adapter: mockAdapter(async () => completed(longAnswer, 20)),
      model: MODEL,
      harnessVersion: 'v1',
      outDir: tempDir(),
    });

    expect(outcome.results.tasks[0].finalAnswer).toHaveLength(EVAL_FINAL_ANSWER_CAP);
    expect(outcome.results.tasks[0].finalAnswer).not.toBe(longAnswer);
    const answers = readAnswers(outcome.answersPath);
    expect(answers.answers).toEqual([{ id: 'long', answer: longAnswer }]);
  });

  it('uses the eval step limit of 8 and the worker maxRunTokens', async () => {
    const loop = jest.spyOn(harnessLoop, 'executeAgentHarnessLoop');
    const adapter = mockAdapter(async () => toolCall(1));
    const outcome = await runReviewLiveEval({
      tasks: [makeTask('steps')],
      adapter,
      model: MODEL,
      harnessVersion: 'v1',
      outDir: tempDir(),
    });

    expect(adapter.executeWithTools).toHaveBeenCalledTimes(8);
    expect(outcome.results.tasks[0].endedAs).toBe('step_limit');
    expect(outcome.results.tasks[0].modelCalls).toBe(8);
    expect(LIVE_MAX_RUN_TOKENS).toBe(60_000);
    expect(loop).toHaveBeenCalled();
    for (const call of loop.mock.calls) {
      expect(call[0].config.maxToolIterations).toBe(8);
      expect(call[0].config.maxRunTokens).toBe(60_000);
    }
  });

  it('never writes the API key into printed lines, the results file, or the answers file', async () => {
    const tasksDir = tempDir();
    const outDir = tempDir();
    writeTaskFile(tasksDir, makeTask('leak-task'));
    const stdout: string[] = [];
    const stderr: string[] = [];
    const consoleText: string[] = [];
    jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      consoleText.push(args.map((arg) => String(arg)).join(' '));
    });
    jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      consoleText.push(args.map((arg) => String(arg)).join(' '));
    });
    const thrown = mockAdapter(async () => {
      throw new Error(`provider rejected ${FAKE_KEY} authorization`);
    });

    const thrownCode = await runReviewLiveCli(cliArgs(tasksDir, outDir), {
      env: { ANTHROPIC_API_KEY: FAKE_KEY },
      adapter: thrown,
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    });

    expect(thrownCode).toBe(0);
    const thrownBlob = collectedOutput(stdout, stderr, consoleText, outDir);
    expect(thrownBlob).not.toContain(FAKE_KEY);
    expect(stdout.join('\n')).toContain('leak-task');

    const answerDir = tempDir();
    const answerStdout: string[] = [];
    const answering = mockAdapter(async () =>
      completed(`verdict ${FAKE_KEY} stays hidden`, 8),
    );
    const answerCode = await runReviewLiveCli(cliArgs(tasksDir, answerDir), {
      env: { ANTHROPIC_API_KEY: FAKE_KEY },
      adapter: answering,
      stdout: (line) => answerStdout.push(line),
      stderr: (line) => stderr.push(line),
    });

    expect(answerCode).toBe(0);
    const answerBlob = collectedOutput(answerStdout, stderr, consoleText, answerDir);
    expect(answerBlob).not.toContain(FAKE_KEY);
    expect(answerBlob).toContain('[redacted]');
    const answersPath = answerStdout
      .find((line) => line.startsWith('answers '))
      ?.slice('answers '.length);
    expect(answersPath).toBeDefined();
    const answers = readAnswers(answersPath as string);
    expect(answers.answers[0].answer).toBe('verdict [redacted] stays hidden');
    expect(JSON.stringify(answering.executeWithTools.mock.calls)).not.toContain(FAKE_KEY);
  });

  it('scrubs a thrown adapter error that contains the key', async () => {
    const task = makeTask('scrub');
    const executeFn = createReviewLiveExecuteFn({
      tasks: [task],
      adapter: mockAdapter(async () => {
        throw new Error(`provider rejected ${FAKE_KEY} authorization`);
      }),
      env: { ANTHROPIC_API_KEY: FAKE_KEY },
    });

    await expect(executeFn(stubRequest(task), { toolResults: [] })).rejects.toThrow(
      'provider rejected [redacted] authorization',
    );
  });

  it('exits 1 on argument parsing errors and does not print the key', async () => {
    const dir = tempDir();
    const cases = [
      ['--tasks'],
      ['--tasks', dir, '--out', dir],
      ['--tasks', dir, '--out', dir, '--model', MODEL, '--nope', 'x'],
      ['--tasks', dir, '--out', dir, '--model', MODEL, '--max-total-tokens', 'no'],
    ];
    for (const argv of cases) {
      const stderr: string[] = [];
      const stdout: string[] = [];
      const code = await runReviewLiveCli(argv, {
        env: { ANTHROPIC_API_KEY: FAKE_KEY },
        stderr: (line) => stderr.push(line),
        stdout: (line) => stdout.push(line),
      });
      expect(code).toBe(1);
      expect(stdout).toEqual([]);
      expect(stderr.join('\n')).not.toContain(FAKE_KEY);
      expect(stderr[0]?.length).toBeGreaterThan(0);
    }
  });

  function tempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisb-review-live-'));
    tempDirs.push(dir);
    return dir;
  }
});

function makeTask(
  id: string,
  options?: {
    handoffTask?: string;
    reviewerPrompt?: string;
    initialFiles?: Readonly<Record<string, string>>;
    plantedBugs?: ReviewTask['plantedBugs'];
  },
): ReviewTask {
  const initialFiles = options?.initialFiles ?? {
    'src/a.ts': 'export const a = 1;\n',
  };
  return {
    id,
    description: id,
    initialFiles,
    handoffTask: options?.handoffTask ?? `Please review ${id}.`,
    reviewerPrompt: options?.reviewerPrompt ?? `You are reviewer for ${id}.`,
    plantedBugs:
      options?.plantedBugs ??
      [
        {
          id: `${id}-bug`,
          kind: 'off-by-one',
          file: 'src/a.ts',
          markers: ['a'],
        },
      ],
  };
}

function writeTaskFile(dir: string, task: ReviewTask): void {
  fs.writeFileSync(
    path.join(dir, `${task.id}.json`),
    `${JSON.stringify(task, null, 2)}\n`,
    'utf8',
  );
}

function cliArgs(tasksDir: string, outDir: string): string[] {
  return ['--tasks', tasksDir, '--out', outDir, '--model', MODEL];
}

function stubRequest(task: ReviewTask): AIExecutionRequest {
  return {
    executionId: evalExecutionId(task.id),
    sessionId: 'eval-session',
    conversationId: 'eval-conversation',
    userId: 'eval-user',
    prompt: task.handoffTask,
    provider: 'stub',
    model: MODEL,
  };
}

function completed(output: string, tokensUsed: number): AIAdapterToolUseResult {
  return {
    output,
    tokensUsed,
    model: MODEL,
    finishReason: 'completed',
    toolCalls: [],
  };
}

function toolCall(tokensUsed: number): AIAdapterToolUseResult {
  return {
    output: '',
    tokensUsed,
    model: MODEL,
    finishReason: 'tool_calls',
    toolCalls: [
      {
        callId: 'call-1',
        toolName: 'read_file',
        arguments: { path: 'src/a.ts' },
        providerKind: 'anthropic-tool_use',
      },
    ],
  };
}

function mockAdapter(
  impl: LiveExecuteAdapter['executeWithTools'],
): LiveExecuteAdapter & {
  executeWithTools: jest.MockedFunction<LiveExecuteAdapter['executeWithTools']>;
} {
  return {
    executeWithTools: jest.fn(impl),
  };
}

function readAnswers(file: string): {
  runId: string;
  answers: Array<{ id: string; answer: string | null }>;
} {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as {
    runId: string;
    answers: Array<{ id: string; answer: string | null }>;
  };
}

function collectedOutput(
  stdout: readonly string[],
  stderr: readonly string[],
  consoleText: readonly string[],
  outDir: string,
): string {
  const files = fs.readdirSync(outDir).map((name) =>
    fs.readFileSync(path.join(outDir, name), 'utf8'),
  );
  return [stdout.join('\n'), stderr.join('\n'), consoleText.join('\n'), ...files].join(
    '\n',
  );
}
