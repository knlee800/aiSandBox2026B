import {
  executeAgentHarnessLoop,
  type AgentHarnessLoopOptions,
  type AgentHarnessExecuteWithToolsFn,
} from './agent-harness-loop';
import type { AIExecutionRequest } from '../../ai-execution/types';
import type {
  AIAdapterToolUseResult,
  AIAdapterToolUseRequestOptions,
} from '../../ai-execution/adapters/adapter-tool-use.contracts';
import { ToolDispatcher } from '../tools/tool-dispatcher';

function makeRequest(overrides?: Partial<AIExecutionRequest>): AIExecutionRequest {
  return {
    provider: 'stub',
    prompt: 'test prompt',
    sessionId: 'sess-1',
    conversationId: 'conv-1',
    userId: 'user-1',
    ...overrides,
  };
}

function makeCompletedResult(
  overrides?: Partial<AIAdapterToolUseResult>,
): AIAdapterToolUseResult {
  return {
    output: 'Hello from the model.',
    tokensUsed: 42,
    model: 'stub',
    finishReason: 'completed',
    toolCalls: [],
    ...overrides,
  };
}

function makeToolCallResult(
  overrides?: Partial<AIAdapterToolUseResult>,
): AIAdapterToolUseResult {
  return {
    output: 'I want to use a tool.',
    tokensUsed: 50,
    model: 'stub',
    finishReason: 'tool_calls',
    toolCalls: [
      {
        callId: 'call-1',
        toolName: 'read_file',
        arguments: { path: 'README.md' },
        providerKind: 'stub',
      },
    ],
    ...overrides,
  };
}

function makeOptions(
  executeFn: AgentHarnessExecuteWithToolsFn,
  overrides?: Partial<Omit<AgentHarnessLoopOptions, 'executeFn'>>,
): AgentHarnessLoopOptions {
  return {
    executeFn,
    request: makeRequest(),
    config: { maxToolIterations: 3 },
    ...overrides,
  };
}

describe('executeAgentHarnessLoop', () => {
  it('returns completed result when adapter returns no tool calls', async () => {
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeCompletedResult(),
    );

    const loopResult = await executeAgentHarnessLoop(makeOptions(executeFn));

    expect(loopResult.terminationReason).toBe('completed');
    expect(loopResult.iterationsUsed).toBe(1);
    expect(loopResult.toolCallsReceived).toBe(0);
    expect(loopResult.result.output).toBe('Hello from the model.');
    expect(loopResult.result.tokensUsed).toBe(42);
    expect(loopResult.result.model).toBe('stub');
    expect(executeFn).toHaveBeenCalledTimes(1);
  });

  it('returns completed result when finishReason is stop (not tool_calls)', async () => {
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeCompletedResult({ finishReason: 'stop' }),
    );

    const loopResult = await executeAgentHarnessLoop(makeOptions(executeFn));

    expect(loopResult.terminationReason).toBe('completed');
    expect(loopResult.iterationsUsed).toBe(1);
  });

  it('returns no_dispatcher fallback when adapter returns tool calls', async () => {
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeToolCallResult(),
    );

    const loopResult = await executeAgentHarnessLoop(makeOptions(executeFn));

    expect(loopResult.terminationReason).toBe('no_dispatcher');
    expect(loopResult.iterationsUsed).toBe(1);
    expect(loopResult.toolCallsReceived).toBe(1);
    expect(loopResult.result.output).toContain('I want to use a tool.');
    expect(loopResult.result.output).toContain('no tool dispatcher is available');
    expect(executeFn).toHaveBeenCalledTimes(1);
  });

  it('includes fallback message even when adapter output is empty', async () => {
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeToolCallResult({ output: '' }),
    );

    const loopResult = await executeAgentHarnessLoop(makeOptions(executeFn));

    expect(loopResult.terminationReason).toBe('no_dispatcher');
    expect(loopResult.result.output).toContain('no tool dispatcher is available');
    expect(loopResult.result.output).not.toContain('\n\n[Agent');
  });

  it('enforces maxToolIterations as the loop ceiling', async () => {
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeCompletedResult(),
    );

    const loopResult = await executeAgentHarnessLoop(
      makeOptions(executeFn, { config: { maxToolIterations: 1 } }),
    );

    expect(loopResult.terminationReason).toBe('completed');
    expect(loopResult.iterationsUsed).toBe(1);
    expect(executeFn).toHaveBeenCalledTimes(1);
  });

  it('clamps maxToolIterations to at least 1 when config value is 0', async () => {
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeCompletedResult(),
    );

    const loopResult = await executeAgentHarnessLoop(
      makeOptions(executeFn, { config: { maxToolIterations: 0 } }),
    );

    expect(loopResult.terminationReason).toBe('completed');
    expect(loopResult.iterationsUsed).toBe(1);
    expect(executeFn).toHaveBeenCalledTimes(1);
  });

  it('returns aborted result when signal is already aborted before loop starts', async () => {
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>();
    const abortController = new AbortController();
    abortController.abort();

    const loopResult = await executeAgentHarnessLoop(
      makeOptions(executeFn, { signal: abortController.signal }),
    );

    expect(loopResult.terminationReason).toBe('aborted');
    expect(loopResult.iterationsUsed).toBe(0);
    expect(loopResult.toolCallsReceived).toBe(0);
    expect(executeFn).not.toHaveBeenCalled();
  });

  it('returns AIExecutionResult-compatible shape with all required fields', async () => {
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeCompletedResult({
        output: 'response text',
        tokensUsed: 100,
        model: 'claude-sonnet-4',
        provider: 'anthropic',
        fileActions: [{ action: 'create', path: 'test.ts', content: 'x' }],
      }),
    );

    const loopResult = await executeAgentHarnessLoop(makeOptions(executeFn));

    expect(loopResult.result).toEqual({
      output: 'response text',
      tokensUsed: 100,
      model: 'claude-sonnet-4',
      provider: 'anthropic',
      fileActions: [{ action: 'create', path: 'test.ts', content: 'x' }],
    });
  });

  it('does not call any tool dispatcher or execution function', async () => {
    const dispatcherSpy = jest.fn();
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeToolCallResult(),
    );

    await executeAgentHarnessLoop(makeOptions(executeFn));

    expect(dispatcherSpy).not.toHaveBeenCalled();
  });

  it('treats tool calls as metadata only — no side effects', async () => {
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeToolCallResult({
        toolCalls: [
          { callId: 'c1', toolName: 'write_file', arguments: { path: 'a.ts', content: 'x' }, providerKind: 'stub' },
          { callId: 'c2', toolName: 'delete_file', arguments: { path: 'b.ts' }, providerKind: 'stub' },
        ],
      }),
    );

    const loopResult = await executeAgentHarnessLoop(makeOptions(executeFn));

    expect(loopResult.terminationReason).toBe('no_dispatcher');
    expect(loopResult.toolCallsReceived).toBe(2);
    expect(executeFn).toHaveBeenCalledTimes(1);
  });

  it('preserves fileActions from adapter result when model completes without tool calls', async () => {
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeCompletedResult({
        fileActions: [
          { action: 'write', path: 'index.ts', content: 'console.log("hi")' },
        ],
      }),
    );

    const loopResult = await executeAgentHarnessLoop(makeOptions(executeFn));

    expect(loopResult.result.fileActions).toEqual([
      { action: 'write', path: 'index.ts', content: 'console.log("hi")' },
    ]);
  });

  it('propagates executeFn errors without catching them', async () => {
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockRejectedValue(
      new Error('Provider API failed'),
    );

    await expect(
      executeAgentHarnessLoop(makeOptions(executeFn)),
    ).rejects.toThrow('Provider API failed');
  });
});

describe('executeAgentHarnessLoop with dispatcher', () => {
  it('still returns no_dispatcher when no dispatcher is passed and tool calls appear', async () => {
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeToolCallResult(),
    );

    const loopResult = await executeAgentHarnessLoop(makeOptions(executeFn));

    expect(loopResult.terminationReason).toBe('no_dispatcher');
    expect(loopResult.result.output).toContain('no tool dispatcher is available');
  });

  it('dispatches tool calls and feeds results back via priorToolResults', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async (args) => {
      return { content: `contents of ${args.path}` };
    });

    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, [AIExecutionRequest, AIAdapterToolUseRequestOptions?]>(
      (_req, _opts) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(makeToolCallResult());
        }
        return Promise.resolve(makeCompletedResult({ output: 'Done after tool use.' }));
      },
    );

    const loopResult = await executeAgentHarnessLoop(
      makeOptions(executeFn, { dispatcher }),
    );

    expect(loopResult.terminationReason).toBe('completed');
    expect(loopResult.iterationsUsed).toBe(2);
    expect(loopResult.toolCallsReceived).toBe(1);
    expect(loopResult.result.output).toBe('Done after tool use.');
    expect(executeFn).toHaveBeenCalledTimes(2);

    const secondCallOpts = executeFn.mock.calls[1][1];
    expect(secondCallOpts).toBeDefined();
    expect(secondCallOpts!.toolResults).toBeDefined();
    expect(secondCallOpts!.toolResults).toHaveLength(1);
    expect(secondCallOpts!.toolResults![0].callId).toBe('call-1');
    expect(secondCallOpts!.toolResults![0].success).toBe(true);
    expect(secondCallOpts!.toolResults![0].content).toEqual({ content: 'contents of README.md' });
  });

  it('feeds TOOL_NOT_FOUND results back when empty dispatcher receives tool calls', async () => {
    const dispatcher = new ToolDispatcher();

    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, [AIExecutionRequest, AIAdapterToolUseRequestOptions?]>(
      (_req, _opts) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(makeToolCallResult());
        }
        return Promise.resolve(makeCompletedResult({ output: 'Done.' }));
      },
    );

    const loopResult = await executeAgentHarnessLoop(
      makeOptions(executeFn, { dispatcher }),
    );

    expect(loopResult.terminationReason).toBe('completed');
    expect(loopResult.iterationsUsed).toBe(2);
    expect(executeFn).toHaveBeenCalledTimes(2);

    const secondCallOpts = executeFn.mock.calls[1][1];
    expect(secondCallOpts!.toolResults).toHaveLength(1);
    expect(secondCallOpts!.toolResults![0].success).toBe(false);
    expect(secondCallOpts!.toolResults![0].errorMessage).toContain('read_file');
  });

  it('enforces maxToolIterations with dispatcher — stops at ceiling', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async () => ({ content: 'data' }));

    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeToolCallResult(),
    );

    const loopResult = await executeAgentHarnessLoop(
      makeOptions(executeFn, { dispatcher, config: { maxToolIterations: 2 } }),
    );

    expect(loopResult.terminationReason).toBe('max_iterations');
    expect(loopResult.iterationsUsed).toBe(2);
    expect(executeFn).toHaveBeenCalledTimes(2);
  });

  it('does not pass priorToolResults on the first executeFn call', async () => {
    const dispatcher = new ToolDispatcher();

    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, [AIExecutionRequest, AIAdapterToolUseRequestOptions?]>(
      () => Promise.resolve(makeCompletedResult()),
    );

    await executeAgentHarnessLoop(makeOptions(executeFn, { dispatcher }));

    const firstCallOpts = executeFn.mock.calls[0][1];
    expect(firstCallOpts).toBeUndefined();
  });

  it('empty dispatcher does not execute real tools', async () => {
    const realToolSpy = jest.fn();
    const dispatcher = new ToolDispatcher();

    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(makeToolCallResult({
          toolCalls: [
            { callId: 'c1', toolName: 'write_file', arguments: { path: 'a.ts', content: 'x' }, providerKind: 'stub' },
            { callId: 'c2', toolName: 'delete_file', arguments: { path: 'b.ts' }, providerKind: 'stub' },
          ],
        }));
      }
      return Promise.resolve(makeCompletedResult());
    });

    await executeAgentHarnessLoop(makeOptions(executeFn, { dispatcher }));

    expect(realToolSpy).not.toHaveBeenCalled();
    expect(dispatcher.registeredToolCount).toBe(0);
  });

  it('preserves fileActions from final adapter result with dispatcher', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async () => ({ content: 'data' }));

    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(makeToolCallResult());
      }
      return Promise.resolve(makeCompletedResult({
        fileActions: [{ action: 'write', path: 'out.ts', content: 'code' }],
      }));
    });

    const loopResult = await executeAgentHarnessLoop(
      makeOptions(executeFn, { dispatcher }),
    );

    expect(loopResult.result.fileActions).toEqual([
      { action: 'write', path: 'out.ts', content: 'code' },
    ]);
  });
});
