import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { AIExecutionRequest } from '../../../ai-execution/types';
import type { AIAdapterToolUseResult } from '../../../ai-execution/adapters/adapter-tool-use.contracts';
import { selectAdvertisedAgentHarnessTools } from '../../../ai-execution/adapters/adapter-tool-use.mapper';
import { AnthropicAdapter } from '../../../ai-execution/adapters/anthropic-ai.adapter';
import * as harnessLoop from '../../orchestrator/agent-harness-loop';
import { buildExecutionPromptParts } from '../../../worker/worker.processor';
import {
  HARNESS_CONNECTOR_DATA_INSTRUCTION,
  withWorkerHarnessInstructions,
} from '../../../worker/connector-grants';
import {
  appendHarnessEnvFileInstruction,
  HARNESS_ENV_FILE_INSTRUCTION,
} from '../../prompts/harness-instructions';
import { readResults } from '../eval-results';
import type { EvalTask } from '../eval-types';
import {
  MISSING_ANTHROPIC_API_KEY_MESSAGE,
  createAnthropicLiveAdapter,
} from './live-adapter';
import {
  createLiveExecuteFn,
  evalExecutionId,
  tokensToCredits,
  workspaceContextFromInitialFiles,
  type LiveExecuteAdapter,
} from './live-execute';
import { LIVE_MAX_RUN_TOKENS, runLiveCli, runLiveEval } from './live-run';

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: jest.fn() },
  }));
});

const FAKE_KEY = 'sk-ant-eval-live-FAKE-KEY-9f3c2a';
const MODEL = 'claude-opus-5-5';

describe('live eval runner', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    jest.restoreAllMocks();
  });

  it('sends the harness prompts, model, and the worker advertised tools', async () => {
    const task = makeTask('read-notes', 'Read src/a.ts and stop.', {
      'src/a.ts': 'export const a = 1;\n',
    });
    const seen: Array<{
      request: AIExecutionRequest;
      toolNames: string[];
    }> = [];
    const adapter = mockAdapter(async (request, executeOptions) => {
      seen.push({
        request,
        toolNames: (executeOptions?.tools ?? []).map((tool) => tool.name),
      });
      return completed('The file exports a.', 20);
    });
    const executeFn = createLiveExecuteFn({
      tasks: [task],
      adapter,
      env: { ANTHROPIC_API_KEY: FAKE_KEY },
    });

    await executeFn(
      {
        executionId: evalExecutionId(task.id),
        sessionId: 'eval-session',
        conversationId: 'eval-conversation',
        userId: 'eval-user',
        prompt: task.userRequest,
        provider: 'stub',
        model: MODEL,
      },
      { toolResults: [] },
    );

    const base = buildExecutionPromptParts(
      task.userRequest,
      workspaceContextFromInitialFiles(task.initialFiles),
      undefined,
      undefined,
      { useHarness: true },
    );
    const expected = withWorkerHarnessInstructions(base, { connectorTools: false });
    expect(seen).toHaveLength(1);
    const call = seen[0];
    expect(call.request.provider).toBe('anthropic');
    expect(call.request.systemPrompt).toBe(expected.system);
    expect(call.request.systemPrompt).toBe(
      `${base.system.trim()}\n${HARNESS_ENV_FILE_INSTRUCTION}`,
    );
    expect(call.request.systemPrompt).not.toContain(HARNESS_CONNECTOR_DATA_INSTRUCTION);
    // COS-EVAL-01: the provider receives the same system text as before the
    // worker's harness lines were added here (the adapter appends the .env
    // line once and skips it when present).
    expect(appendHarnessEnvFileInstruction(call.request.systemPrompt)).toBe(
      appendHarnessEnvFileInstruction(base.system),
    );
    expect(call.request.prompt).toBe(expected.user);
    expect(call.request.systemPrompt).toContain(
      'You work through the tools you are given.',
    );
    expect(call.request.prompt).toContain('User request:\nRead src/a.ts and stop.');
    expect(call.request.prompt).toContain('- src/a.ts');
    expect(call.request.model).toBe(MODEL);
    expect(call.request.executionId).toBe('eval-read-notes');
    expect(call.request.sessionId).toBe('eval-session');
    const advertised = selectAdvertisedAgentHarnessTools({
      registeredHandlerNames: [
        'read_file',
        'list_files',
        'search_workspace',
        'write_file',
        'delete_file',
        'run_validation',
      ],
      enableWriteTools: true,
      enableValidationTools: true,
      enableBrowserSmoke: false,
    });
    expect(call.toolNames).toEqual(advertised.map((tool) => tool.name));
    expect(call.toolNames).toContain('delete_file');
    expect(JSON.stringify(seen)).not.toContain(FAKE_KEY);
  });

  it('stops at the token cap and marks tasks that have not started as not run', async () => {
    const tasks = [makeTask('first'), makeTask('second'), makeTask('third')];
    let calls = 0;
    const adapter = mockAdapter(async (request) => {
      calls += 1;
      if (request.executionId === evalExecutionId('first')) {
        return toolCall(100);
      }
      return completed('done', 100);
    });
    const outcome = await runLiveEval({
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
      'third',
    ]);
    expect(outcome.results.tasks[0].endedAs).toBe('error');
    expect(outcome.results.tasks[0].passed).toBe(false);
    expect(outcome.results.tasks[0].failureReasons.join(' ')).toContain(
      'token cap reached',
    );
    expect(outcome.results.tasks[0].notRun).toBeUndefined();
    for (const task of outcome.results.tasks.slice(1)) {
      expect(task.passed).toBe(false);
      expect(task.endedAs).toBe('not_run');
      expect(task.notRun).toBe(true);
      expect(task.modelCalls).toBe(0);
      expect(task.tokens).toBe(0);
      expect(task.failureReasons).toEqual(['not run']);
    }
    const reread = readResults(outcome.resultsPath);
    expect(reread.tasks[1].notRun).toBe(true);
    expect(reread.tasks[1].endedAs).toBe('not_run');
    expect(reread.tasks[2].passed).toBe(false);
  });

  it('scores a task that finishes on the cap, then does not run the rest', async () => {
    const tasks = [makeTask('done-task'), makeTask('later-task')];
    const adapter = mockAdapter(async () => completed('done', 100));
    const outcome = await runLiveEval({
      tasks,
      adapter,
      model: MODEL,
      harnessVersion: 'v1',
      maxTotalTokens: 100,
      outDir: tempDir(),
    });

    expect(adapter.executeWithTools).toHaveBeenCalledTimes(1);
    expect(outcome.results.tasks[0].endedAs).toBe('answered');
    expect(outcome.results.tasks[0].passed).toBe(true);
    expect(outcome.results.tasks[0].tokens).toBe(100);
    expect(outcome.results.tasks[1].notRun).toBe(true);
    expect(outcome.results.tasks[1].passed).toBe(false);
  });

  it('charges ceil(tokens / 1000) credits per task', async () => {
    expect(tokensToCredits(0)).toBe(0);
    expect(tokensToCredits(1)).toBe(1);
    expect(tokensToCredits(1000)).toBe(1);
    expect(tokensToCredits(1001)).toBe(2);

    const planned = [1000, 1001, 0];
    let index = 0;
    const adapter = mockAdapter(async () => completed('done', planned[index++] ?? 0));
    const outcome = await runLiveEval({
      tasks: [makeTask('c1'), makeTask('c2'), makeTask('c3')],
      adapter,
      model: MODEL,
      harnessVersion: 'v1',
      outDir: tempDir(),
    });

    expect(outcome.results.tasks.map((task) => task.credits)).toEqual([1, 2, 0]);
    expect(outcome.results.totals.credits).toBe(3);
  });

  it('fails clearly when ANTHROPIC_API_KEY is missing', async () => {
    const stderr: string[] = [];
    const stdout: string[] = [];
    const code = await runLiveCli(cliArgs(tempDir(), tempDir()), {
      env: {},
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    });

    expect(code).toBe(1);
    expect(stderr).toEqual([MISSING_ANTHROPIC_API_KEY_MESSAGE]);
    expect(stdout).toEqual([]);
    expect(stderr.join('\n')).not.toContain(FAKE_KEY);
  });

  it('never writes the API key into output, results, or errors', async () => {
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
    const adapter = mockAdapter(async () => {
      throw new Error(`provider rejected ${FAKE_KEY} authorization`);
    });

    const code = await runLiveCli(cliArgs(tasksDir, outDir), {
      env: { ANTHROPIC_API_KEY: FAKE_KEY },
      adapter,
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    });

    expect(code).toBe(0);
    const resultsLine = stdout.find((line) => line.startsWith('results '));
    expect(resultsLine).toBeDefined();
    const resultsPath = (resultsLine as string).slice('results '.length);
    const body = fs.readFileSync(resultsPath, 'utf8');
    const blob = [stdout.join('\n'), stderr.join('\n'), consoleText.join('\n'), body].join(
      '\n',
    );
    expect(blob).not.toContain(FAKE_KEY);
    expect(body).toContain('[redacted]');
    expect(body).not.toContain('x-api-key');
    expect(JSON.stringify(adapter.executeWithTools.mock.calls)).not.toContain(FAKE_KEY);
  });

  it('runs only the named tasks', async () => {
    const tasksDir = tempDir();
    const outDir = tempDir();
    for (const id of ['alpha', 'beta', 'gamma']) {
      writeTaskFile(tasksDir, makeTask(id));
    }
    const seen: string[] = [];
    const adapter = mockAdapter(async (request) => {
      seen.push(request.executionId ?? '');
      return completed('done', 5);
    });
    const stdout: string[] = [];
    const code = await runLiveCli(
      [...cliArgs(tasksDir, outDir), '--only', 'gamma,alpha'],
      {
        env: { ANTHROPIC_API_KEY: FAKE_KEY },
        adapter,
        stdout: (line) => stdout.push(line),
      },
    );

    expect(code).toBe(0);
    expect(seen).toEqual(['eval-alpha', 'eval-gamma']);
    const ids = stdout
      .filter((line) => !line.startsWith('totals ') && !line.startsWith('results '))
      .map((line) => line.split(' ')[0]);
    expect(ids).toEqual(['alpha', 'gamma']);
  });

  it('uses the eval runner step limit of 8 and the worker maxRunTokens', async () => {
    const loop = jest.spyOn(harnessLoop, 'executeAgentHarnessLoop');
    const adapter = mockAdapter(async () => toolCall(1));
    const outcome = await runLiveEval({
      tasks: [makeTask('steps', 'Keep reading.', { 'a.txt': 'hello\n' })],
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
      expect(call[0].config.maxRunTokens).toBe(60_000);
    }
  });

  it('builds an Anthropic adapter from ANTHROPIC_API_KEY without printing the key', () => {
    const chunks: string[] = [];
    const spy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        chunks.push(String(chunk));
        return true;
      });
    try {
      const adapter = createAnthropicLiveAdapter(
        { ANTHROPIC_API_KEY: FAKE_KEY },
        MODEL,
      );
      expect(adapter).toBeInstanceOf(AnthropicAdapter);
      expect(typeof adapter.executeWithTools).toBe('function');
      expect(adapter.model).toBe(MODEL);
      expect(chunks.join('')).not.toContain(FAKE_KEY);
    } finally {
      spy.mockRestore();
    }
  });

  function tempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisb-eval-live-'));
    tempDirs.push(dir);
    return dir;
  }
});

function makeTask(
  id: string,
  userRequest = `Do ${id}.`,
  initialFiles: Readonly<Record<string, string>> = {},
): EvalTask {
  return {
    id,
    description: id,
    initialFiles,
    userRequest,
    expected: {},
  };
}

function writeTaskFile(dir: string, task: EvalTask): void {
  fs.writeFileSync(
    path.join(dir, `${task.id}.json`),
    `${JSON.stringify(task, null, 2)}\n`,
    'utf8',
  );
}

function cliArgs(tasksDir: string, outDir: string): string[] {
  return ['--tasks', tasksDir, '--out', outDir, '--model', MODEL];
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
        arguments: { path: 'a.txt' },
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
