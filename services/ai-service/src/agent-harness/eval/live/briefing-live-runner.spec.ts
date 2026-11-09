import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { AIAdapterToolUseResult } from '../../../ai-execution/adapters/adapter-tool-use.contracts';
import {
  CONNECTOR_CALENDAR_TOOL_ID,
  CONNECTOR_MAIL_TOOL_ID,
} from '../../tools/connector-tool-definitions';
import { wrapConnectorResult } from '../../tools/handlers/connector-tool-handlers';
import { loadBriefingTasks } from '../briefing-loader';
import { advertisedBriefingTools, buildBriefingPromptParts } from '../briefing-prompt';
import type { BriefingTask } from '../briefing-types';
import { createAnthropicLiveAdapter, MISSING_ANTHROPIC_API_KEY_MESSAGE } from './live-adapter';
import type { LiveExecuteAdapter } from './live-execute';
import { TOKEN_CAP_REACHED_REASON } from './live-execute';
import { createBriefingLiveExecuteFn } from './briefing-live-execute';
import {
  BRIEFING_LIVE_CONFIRM_MISSING_MESSAGE,
  parseBriefingLiveArgs,
  runBriefingLiveCli,
  runBriefingLiveEval,
} from './briefing-live-run';

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: jest.fn() },
  }));
});

const FAKE_KEY = 'sk-ant-eval-live-FAKE-KEY-briefing-7d1e';
const MODEL = 'claude-opus-5-5';
const tasksDir = path.join(__dirname, '..', 'briefing-tasks');
const tasks = loadBriefingTasks(tasksDir);

function task(id: string): BriefingTask {
  return tasks.find((candidate) => candidate.id === id) as BriefingTask;
}

describe('COS-EVAL-01 briefing live entry point (never calls a provider)', () => {
  const tempDirs: string[] = [];
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    jest.restoreAllMocks();
  });

  function tempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisb-briefing-live-'));
    tempDirs.push(dir);
    return dir;
  }

  it('parses the live flags and requires --confirm provider-call', () => {
    const args = parseBriefingLiveArgs([
      '--tasks', tasksDir, '--out', 'out', '--model', MODEL,
      '--only', 'inject-mixed,clean-control', '--confirm', 'provider-call',
    ]);
    expect(args).toMatchObject({
      tasksDir,
      outDir: 'out',
      model: MODEL,
      only: ['inject-mixed', 'clean-control'],
      harnessVersion: 'v1',
      confirmed: true,
    });
    const without = ['--tasks', tasksDir, '--out', 'out', '--model', MODEL];
    expect(() => parseBriefingLiveArgs(without)).toThrow(BRIEFING_LIVE_CONFIRM_MISSING_MESSAGE);
    expect(() => parseBriefingLiveArgs([...without, '--confirm', 'yes'])).toThrow(
      BRIEFING_LIVE_CONFIRM_MISSING_MESSAGE,
    );
    expect(() =>
      parseBriefingLiveArgs([...without, '--confirm', 'provider-call', '--confirm', 'provider-call']),
    ).toThrow('Duplicate argument: --confirm');
    expect(() => parseBriefingLiveArgs(['--out', 'o', '--model', MODEL, '--confirm', 'provider-call'])).toThrow(
      'Missing required argument: --tasks',
    );
  });

  it('refuses without the confirmation flag or the API key, before any adapter call', async () => {
    const adapter = mockAdapter(async () => answer('unused'));
    const errors: string[] = [];
    const base = ['--tasks', tasksDir, '--out', tempDir(), '--model', MODEL];

    const noConfirm = await runBriefingLiveCli(base, {
      env: { ANTHROPIC_API_KEY: FAKE_KEY },
      adapter,
      stderr: (line) => errors.push(line),
      stdout: () => undefined,
    });
    const noKey = await runBriefingLiveCli([...base, '--confirm', 'provider-call'], {
      env: {},
      adapter,
      stderr: (line) => errors.push(line),
      stdout: () => undefined,
    });

    expect(noConfirm).toBe(1);
    expect(noKey).toBe(1);
    expect(errors).toEqual([BRIEFING_LIVE_CONFIRM_MISSING_MESSAGE, MISSING_ANTHROPIC_API_KEY_MESSAGE]);
    expect(adapter.executeWithTools).not.toHaveBeenCalled();
  });

  it('runs selected cases on an injected adapter, writes results and answers, and never prints the key', async () => {
    const out = tempDir();
    const lines: string[] = [];
    const adapter = mockAdapter(async (request, options) => {
      expect(request.provider).toBe('anthropic');
      if (!options?.toolResults || options.toolResults.length === 0) {
        return toolCalls();
      }
      return answer(`${FAKE_KEY}\nToday's calendar:\n- standup\n\nUnread mail:\n- Alice Chen\n\nFor you:\n- Nothing.`);
    });
    const code = await runBriefingLiveCli(
      ['--tasks', tasksDir, '--out', out, '--model', MODEL, '--only', 'clean-control', '--confirm', 'provider-call'],
      { env: { ANTHROPIC_API_KEY: FAKE_KEY }, adapter, stdout: (line) => lines.push(line), stderr: (line) => lines.push(line) },
    );
    expect(code).toBe(0);
    expect(lines[0]).toMatch(/^clean-control passed=true reported=0\/0 flagged=0\/0 flags=0 /);
    expect(lines[1]).toMatch(/^totals tasks=1 passed=1 /);
    const files = fs.readdirSync(out).sort();
    expect(files).toHaveLength(2);
    expect(files[0]).toMatch(/^briefing-answers-eval-/);
    expect(files[1]).toMatch(/^briefing-results-eval-/);
    for (const file of files) {
      const body = fs.readFileSync(path.join(out, file), 'utf8');
      expect(body).not.toContain(FAKE_KEY);
      expect(body).toContain('[redacted]');
    }
    expect(lines.join('\n')).not.toContain(FAKE_KEY);
  });

  it('stops at the whole-run token cap and marks later cases not run', async () => {
    const adapter = mockAdapter(async (_request, options) =>
      options?.toolResults && options.toolResults.length > 0 ? answer('x', 60) : toolCalls(60),
    );
    const outcome = await runBriefingLiveEval({
      tasks: [task('clean-control'), task('inject-mixed')],
      adapter,
      model: MODEL,
      harnessVersion: 'v1',
      maxTotalTokens: 100,
      outDir: tempDir(),
    });
    expect(outcome.results.tasks.map((t) => t.endedAs)).toEqual(['answered', 'not_run']);
    expect(outcome.results.tasks[1].passed).toBe(false);
    const execute = createBriefingLiveExecuteFn({ adapter, maxTotalTokens: 0 });
    await expect(
      execute({ prompt: 'p', provider: 'anthropic', sessionId: 's', conversationId: 'c', userId: 'u', executionId: 'e' }, { tools: advertisedBriefingTools() }),
    ).rejects.toThrow(TOKEN_CAP_REACHED_REASON);
  });

  it('through the real Anthropic adapter (SDK mocked): worker system prompt, tool list, and wrapped tool results', async () => {
    const adapter = createAnthropicLiveAdapter({ ANTHROPIC_API_KEY: FAKE_KEY }, MODEL);
    const create = (adapter as unknown as { client: { messages: { create: jest.Mock } } }).client
      .messages.create;
    const t = task('inject-mixed');
    create
      .mockResolvedValueOnce({
        id: 'msg_1',
        model: MODEL,
        role: 'assistant',
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'toolu_mail', name: CONNECTOR_MAIL_TOOL_ID, input: { limit: 25 } },
          { type: 'tool_use', id: 'toolu_cal', name: CONNECTOR_CALENDAR_TOOL_ID, input: { timeZone: t.timeZone } },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
      })
      .mockResolvedValueOnce({
        id: 'msg_2',
        model: MODEL,
        role: 'assistant',
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: "Today's calendar:\n- x\n\nUnread mail:\n- y\n\nFor you:\n- z" }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });

    await runBriefingLiveEval({
      tasks: [t],
      adapter,
      model: MODEL,
      harnessVersion: 'v1',
      outDir: tempDir(),
      env: { ANTHROPIC_API_KEY: FAKE_KEY },
    });

    expect(create).toHaveBeenCalledTimes(2);
    const first = create.mock.calls[0][0] as {
      system: string;
      tools: Array<{ name: string }>;
      messages: Array<{ role: string; content: unknown }>;
    };
    expect(first.system).toBe(buildBriefingPromptParts(t).system);
    expect(first.messages[0]).toEqual({
      role: 'user',
      content: buildBriefingPromptParts(t).user,
    });
    expect(first.tools.map((tool) => tool.name)).toEqual(
      advertisedBriefingTools().map((tool) => tool.name),
    );

    const second = create.mock.calls[1][0] as {
      system: string;
      messages: Array<{ role: string; content: unknown }>;
    };
    expect(second.system).toBe(first.system);
    const toolResults = second.messages
      .flatMap((message) => (Array.isArray(message.content) ? message.content : []))
      .filter((block: { type?: string }) => block.type === 'tool_result') as Array<{
      tool_use_id: string;
      content: string;
    }>;
    expect(toolResults.map((block) => block.tool_use_id)).toEqual(['toolu_mail', 'toolu_cal']);
    expect(JSON.parse(toolResults[0].content)).toEqual({
      tool: CONNECTOR_MAIL_TOOL_ID,
      connectorResult: wrapConnectorResult(CONNECTOR_MAIL_TOOL_ID, t.mail),
    });
    expect(JSON.parse(toolResults[1].content)).toEqual({
      tool: CONNECTOR_CALENDAR_TOOL_ID,
      connectorResult: wrapConnectorResult(CONNECTOR_CALENDAR_TOOL_ID, t.calendar),
    });
    expect(JSON.stringify(create.mock.calls)).not.toContain(FAKE_KEY);
  });
});

function toolCalls(tokensUsed = 10): AIAdapterToolUseResult {
  return {
    output: '',
    tokensUsed,
    model: MODEL,
    finishReason: 'tool_calls',
    toolCalls: [
      { callId: 'c1', toolName: CONNECTOR_MAIL_TOOL_ID, arguments: {}, providerKind: 'anthropic-tool_use' },
      { callId: 'c2', toolName: CONNECTOR_CALENDAR_TOOL_ID, arguments: { timeZone: 'UTC' }, providerKind: 'anthropic-tool_use' },
    ],
  };
}

function answer(output: string, tokensUsed = 5): AIAdapterToolUseResult {
  return { output, tokensUsed, model: MODEL, finishReason: 'completed', toolCalls: [] };
}

function mockAdapter(
  impl: LiveExecuteAdapter['executeWithTools'],
): LiveExecuteAdapter & {
  executeWithTools: jest.MockedFunction<LiveExecuteAdapter['executeWithTools']>;
} {
  return { executeWithTools: jest.fn(impl) };
}
