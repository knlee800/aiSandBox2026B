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
    config: { maxToolIterations: 3, maxToolResultBytes: 262_144 },
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
      makeOptions(executeFn, { config: { maxToolIterations: 1, maxToolResultBytes: 262_144 } }),
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
      makeOptions(executeFn, { config: { maxToolIterations: 0, maxToolResultBytes: 262_144 } }),
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

describe('executeAgentHarnessLoop token accounting and aggregate result budget', () => {
  it('sums tokensUsed across multiple model calls', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async () => ({ content: 'ok' }));

    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, [AIExecutionRequest, AIAdapterToolUseRequestOptions?]>(
      () => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(makeToolCallResult({ tokensUsed: 10 }));
        }
        return Promise.resolve(makeCompletedResult({ tokensUsed: 15 }));
      },
    );

    const loopResult = await executeAgentHarnessLoop(
      makeOptions(executeFn, { dispatcher }),
    );

    expect(loopResult.terminationReason).toBe('completed');
    expect(loopResult.result.tokensUsed).toBe(25);
  });

  it('treats undefined tokensUsed as 0', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async () => ({ content: 'ok' }));

    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, [AIExecutionRequest, AIAdapterToolUseRequestOptions?]>(
      () => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(
            makeToolCallResult({
              tokensUsed: undefined as unknown as number,
            }),
          );
        }
        return Promise.resolve(makeCompletedResult({ tokensUsed: 5 }));
      },
    );

    const loopResult = await executeAgentHarnessLoop(
      makeOptions(executeFn, { dispatcher }),
    );

    expect(loopResult.result.tokensUsed).toBe(5);
  });

  it('returns cumulative tokensUsed on max_iterations', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async () => ({ content: 'ok' }));

    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeToolCallResult({ tokensUsed: 7 }),
    );

    const loopResult = await executeAgentHarnessLoop(
      makeOptions(executeFn, {
        dispatcher,
        config: { maxToolIterations: 2, maxToolResultBytes: 262_144 },
      }),
    );

    expect(loopResult.terminationReason).toBe('max_iterations');
    expect(loopResult.result.tokensUsed).toBe(14);
  });

  it('enforces aggregate maxToolResultBytes and replaces over-budget results without ending the loop', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async (args) => ({
      content: `payload:${String(args.path)}`,
    }));

    const firstResultPayload = {
      callId: 'call-1',
      toolName: 'read_file',
      success: true,
      content: { content: 'payload:README.md' },
      errorMessage: undefined,
    };
    const firstResultBytes = Buffer.byteLength(
      JSON.stringify(firstResultPayload ?? {}),
      'utf8',
    );

    let callCount = 0;
    const executeFn = jest.fn<
      Promise<AIAdapterToolUseResult>,
      [AIExecutionRequest, AIAdapterToolUseRequestOptions?]
    >(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(
          makeToolCallResult({
            toolCalls: [
              {
                callId: 'call-1',
                toolName: 'read_file',
                arguments: { path: 'README.md' },
                providerKind: 'stub',
              },
            ],
            tokensUsed: 3,
          }),
        );
      }
      if (callCount === 2) {
        return Promise.resolve(
          makeToolCallResult({
            toolCalls: [
              {
                callId: 'call-2',
                toolName: 'read_file',
                arguments: { path: 'SECOND.md' },
                providerKind: 'stub',
              },
            ],
            tokensUsed: 4,
          }),
        );
      }
      return Promise.resolve(makeCompletedResult({ output: 'done', tokensUsed: 5 }));
    });

    const loopResult = await executeAgentHarnessLoop(
      makeOptions(executeFn, {
        dispatcher,
        config: {
          maxToolIterations: 4,
          maxToolResultBytes: firstResultBytes + 1,
        },
      }),
    );

    expect(loopResult.terminationReason).toBe('completed');
    expect(executeFn).toHaveBeenCalledTimes(3);

    const thirdCallOpts = executeFn.mock.calls[2][1];
    expect(thirdCallOpts?.toolResults).toHaveLength(1);
    expect(thirdCallOpts?.toolResults?.[0]).toEqual({
      callId: 'call-2',
      toolName: 'read_file',
      success: false,
      errorMessage:
        'Tool result exceeds aggregate maximum size (' +
        `${firstResultBytes + 1}` +
        ' bytes)',
    });
    expect(thirdCallOpts?.toolResults?.[0].errorMessage).not.toContain(
      'truncated',
    );
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
      makeOptions(executeFn, { dispatcher, config: { maxToolIterations: 2, maxToolResultBytes: 262_144 } }),
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

describe('executeAgentHarnessLoop with pre-apply checkpoint', () => {
  const MUTATING_TOOLS = new Set(['write_file', 'delete_file']);

  function makeWriteToolCallResult(
    overrides?: Partial<AIAdapterToolUseResult>,
  ): AIAdapterToolUseResult {
    return {
      output: 'I want to write a file.',
      tokensUsed: 50,
      model: 'stub',
      finishReason: 'tool_calls',
      toolCalls: [
        {
          callId: 'call-w1',
          toolName: 'write_file',
          arguments: { path: 'src/app.ts', content: 'const x = 1;' },
          providerKind: 'stub',
        },
      ],
      ...overrides,
    };
  }

  function makeDeleteToolCallResult(
    overrides?: Partial<AIAdapterToolUseResult>,
  ): AIAdapterToolUseResult {
    return {
      output: 'I want to delete a file.',
      tokensUsed: 50,
      model: 'stub',
      finishReason: 'tool_calls',
      toolCalls: [
        {
          callId: 'call-d1',
          toolName: 'delete_file',
          arguments: { path: 'old.ts' },
          providerKind: 'stub',
        },
      ],
      ...overrides,
    };
  }

  it('calls checkpoint callback before first write_file dispatch', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('write_file', async () => ({ ok: true }));

    const callOrder: string[] = [];
    const createCheckpointFn = jest.fn(async () => {
      callOrder.push('checkpoint');
      return { commitHash: 'cp-hash-1', filesChanged: 0 };
    });

    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(makeWriteToolCallResult());
      return Promise.resolve(makeCompletedResult({ output: 'Done.' }));
    });

    const originalDispatch = dispatcher.dispatch.bind(dispatcher);
    dispatcher.dispatch = async (...args) => {
      callOrder.push('dispatch');
      return originalDispatch(...args);
    };

    const loopResult = await executeAgentHarnessLoop(
      makeOptions(executeFn, {
        dispatcher,
        createCheckpointFn,
        mutatingToolNames: MUTATING_TOOLS,
      }),
    );

    expect(createCheckpointFn).toHaveBeenCalledTimes(1);
    expect(callOrder[0]).toBe('checkpoint');
    expect(callOrder[1]).toBe('dispatch');
    expect(loopResult.preApplyCheckpointHash).toBe('cp-hash-1');
  });

  it('calls checkpoint callback before first delete_file dispatch', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('delete_file', async () => ({ ok: true }));

    const createCheckpointFn = jest.fn(async () => {
      return { commitHash: 'cp-hash-del', filesChanged: 0 };
    });

    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(makeDeleteToolCallResult());
      return Promise.resolve(makeCompletedResult({ output: 'Done.' }));
    });

    const loopResult = await executeAgentHarnessLoop(
      makeOptions(executeFn, {
        dispatcher,
        createCheckpointFn,
        mutatingToolNames: MUTATING_TOOLS,
      }),
    );

    expect(createCheckpointFn).toHaveBeenCalledTimes(1);
    expect(loopResult.preApplyCheckpointHash).toBe('cp-hash-del');
  });

  it('calls checkpoint callback only once per loop execution', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('write_file', async () => ({ ok: true }));
    dispatcher.registerHandler('delete_file', async () => ({ ok: true }));

    const createCheckpointFn = jest.fn(async () => {
      return { commitHash: 'cp-once', filesChanged: 0 };
    });

    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(makeWriteToolCallResult());
      if (callCount === 2) return Promise.resolve(makeDeleteToolCallResult());
      return Promise.resolve(makeCompletedResult({ output: 'Done.' }));
    });

    await executeAgentHarnessLoop(
      makeOptions(executeFn, {
        dispatcher,
        createCheckpointFn,
        mutatingToolNames: MUTATING_TOOLS,
      }),
    );

    expect(createCheckpointFn).toHaveBeenCalledTimes(1);
  });

  it('does not call checkpoint callback for read_file/list_files only', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async () => ({ content: 'data' }));

    const createCheckpointFn = jest.fn(async () => {
      return { commitHash: 'should-not', filesChanged: 0 };
    });

    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(makeToolCallResult());
      return Promise.resolve(makeCompletedResult({ output: 'Done.' }));
    });

    const loopResult = await executeAgentHarnessLoop(
      makeOptions(executeFn, {
        dispatcher,
        createCheckpointFn,
        mutatingToolNames: MUTATING_TOOLS,
      }),
    );

    expect(createCheckpointFn).not.toHaveBeenCalled();
    expect(loopResult.preApplyCheckpointHash).toBeUndefined();
  });

  it('does not dispatch mutating tool if checkpoint callback fails', async () => {
    const dispatcher = new ToolDispatcher();
    const writeHandlerSpy = jest.fn(async () => ({ ok: true }));
    dispatcher.registerHandler('write_file', writeHandlerSpy);

    const createCheckpointFn = jest.fn(async () => {
      throw new Error('Checkpoint service unavailable');
    });

    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(makeWriteToolCallResult());
      return Promise.resolve(makeCompletedResult({ output: 'Acknowledged error.' }));
    });

    const loopResult = await executeAgentHarnessLoop(
      makeOptions(executeFn, {
        dispatcher,
        createCheckpointFn,
        mutatingToolNames: MUTATING_TOOLS,
      }),
    );

    expect(writeHandlerSpy).not.toHaveBeenCalled();
    expect(loopResult.preApplyCheckpointHash).toBeUndefined();
    expect(loopResult.terminationReason).toBe('completed');

    const secondCallOpts = executeFn.mock.calls[1][1];
    expect(secondCallOpts!.toolResults).toHaveLength(1);
    expect(secondCallOpts!.toolResults![0].success).toBe(false);
    expect(secondCallOpts!.toolResults![0].errorMessage).toContain('CHECKPOINT_FAILED');
  });

  it('includes preApplyCheckpointHash in AgentHarnessLoopResult after checkpoint creation', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('write_file', async () => ({ ok: true }));

    const createCheckpointFn = jest.fn(async () => {
      return { commitHash: 'result-hash-abc', filesChanged: 2 };
    });

    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(makeWriteToolCallResult());
      return Promise.resolve(makeCompletedResult({ output: 'Done.' }));
    });

    const loopResult = await executeAgentHarnessLoop(
      makeOptions(executeFn, {
        dispatcher,
        createCheckpointFn,
        mutatingToolNames: MUTATING_TOOLS,
      }),
    );

    expect(loopResult.preApplyCheckpointHash).toBe('result-hash-abc');
  });

  it('preserves no_dispatcher behavior when dispatcher is absent with checkpoint options', async () => {
    const createCheckpointFn = jest.fn(async () => {
      return { commitHash: 'unused', filesChanged: 0 };
    });

    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeWriteToolCallResult(),
    );

    const loopResult = await executeAgentHarnessLoop(
      makeOptions(executeFn, {
        createCheckpointFn,
        mutatingToolNames: MUTATING_TOOLS,
      }),
    );

    expect(loopResult.terminationReason).toBe('no_dispatcher');
    expect(createCheckpointFn).not.toHaveBeenCalled();
  });

  it('still enforces maxToolIterations with checkpoint callback', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('write_file', async () => ({ ok: true }));

    const createCheckpointFn = jest.fn(async () => {
      return { commitHash: 'cp-max', filesChanged: 0 };
    });

    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeWriteToolCallResult(),
    );

    const loopResult = await executeAgentHarnessLoop(
      makeOptions(executeFn, {
        dispatcher,
        createCheckpointFn,
        mutatingToolNames: MUTATING_TOOLS,
        config: { maxToolIterations: 2, maxToolResultBytes: 262_144 },
      }),
    );

    expect(loopResult.terminationReason).toBe('max_iterations');
    expect(loopResult.iterationsUsed).toBe(2);
    expect(executeFn).toHaveBeenCalledTimes(2);
  });

  it('preserves toolResults field behavior with checkpoint', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('write_file', async () => ({ ok: true }));

    const createCheckpointFn = jest.fn(async () => {
      return { commitHash: 'cp-tr', filesChanged: 0 };
    });

    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, [AIExecutionRequest, AIAdapterToolUseRequestOptions?]>(
      (_req, _opts) => {
        callCount++;
        if (callCount === 1) return Promise.resolve(makeWriteToolCallResult());
        return Promise.resolve(makeCompletedResult({ output: 'Done.' }));
      },
    );

    await executeAgentHarnessLoop(
      makeOptions(executeFn, {
        dispatcher,
        createCheckpointFn,
        mutatingToolNames: MUTATING_TOOLS,
      }),
    );

    const secondCallOpts = executeFn.mock.calls[1][1];
    expect(secondCallOpts).toBeDefined();
    expect(secondCallOpts!.toolResults).toBeDefined();
    expect(secondCallOpts!.toolResults).toHaveLength(1);
    expect(secondCallOpts!.toolResults![0].callId).toBe('call-w1');
    expect(secondCallOpts!.toolResults![0].success).toBe(true);
  });
});
