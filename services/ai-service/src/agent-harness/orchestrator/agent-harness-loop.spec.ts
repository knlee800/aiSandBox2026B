import {
  executeAgentHarnessLoop,
  HarnessInvalidExecutionIdError,
  HarnessMaxIterationsError,
  HARNESS_INVALID_EXECUTION_ID_ERROR_NAME,
  HARNESS_INVALID_EXECUTION_ID_ERROR_MESSAGE,
  HARNESS_MAX_ITERATIONS_ERROR_NAME,
  HARNESS_MAX_ITERATIONS_ERROR_MESSAGE,
  type AgentHarnessLoopOptions,
  type AgentHarnessExecuteWithToolsFn,
} from './agent-harness-loop';
import type { AIExecutionRequest } from '../../ai-execution/types';
import type {
  AIAdapterToolUseResult,
  AIAdapterToolUseRequestOptions,
} from '../../ai-execution/adapters/adapter-tool-use.contracts';
import { ToolDispatcher } from '../tools/tool-dispatcher';
import { InMemoryHarnessAuditRecorder } from '../audit/harness-audit-recorder';
import type { HarnessAuditEvent } from '../audit/harness-audit-events';

function makeRequest(overrides?: Partial<AIExecutionRequest>): AIExecutionRequest {
  return {
    provider: 'stub',
    prompt: 'test prompt',
    executionId: 'exec-1',
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

  it('preserves cumulative tokensUsed on max_iterations typed failure', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async () => ({ content: 'ok' }));

    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeToolCallResult({ tokensUsed: 7 }),
    );

    await expect(
      executeAgentHarnessLoop(
        makeOptions(executeFn, {
          dispatcher,
          config: { maxToolIterations: 2, maxToolResultBytes: 262_144 },
        }),
      ),
    ).rejects.toMatchObject({
      name: HARNESS_MAX_ITERATIONS_ERROR_NAME,
      terminationReason: 'max_iterations',
      tokensUsed: 14,
      iterationsUsed: 2,
      toolCallsReceived: 2,
    });
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

    await expect(
      executeAgentHarnessLoop(
        makeOptions(executeFn, { dispatcher, config: { maxToolIterations: 2, maxToolResultBytes: 262_144 } }),
      ),
    ).rejects.toMatchObject({
      name: HARNESS_MAX_ITERATIONS_ERROR_NAME,
      terminationReason: 'max_iterations',
      iterationsUsed: 2,
    });
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

    await expect(
      executeAgentHarnessLoop(
        makeOptions(executeFn, {
          dispatcher,
          createCheckpointFn,
          mutatingToolNames: MUTATING_TOOLS,
          config: { maxToolIterations: 2, maxToolResultBytes: 262_144 },
        }),
      ),
    ).rejects.toMatchObject({
      name: HARNESS_MAX_ITERATIONS_ERROR_NAME,
      terminationReason: 'max_iterations',
      iterationsUsed: 2,
    });
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

describe('executeAgentHarnessLoop audit events', () => {
  function getEventTypes(recorder: InMemoryHarnessAuditRecorder): string[] {
    return recorder.getEvents().map((e) => e.eventType);
  }

  it('works without recorder (no regression)', async () => {
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeCompletedResult(),
    );

    const loopResult = await executeAgentHarnessLoop(makeOptions(executeFn));

    expect(loopResult.terminationReason).toBe('completed');
    expect(loopResult.iterationsUsed).toBe(1);
  });

  it('emits loop_started event', async () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeCompletedResult(),
    );

    await executeAgentHarnessLoop(makeOptions(executeFn, { recorder }));

    const events = recorder.getEvents();
    expect(events[0].eventType).toBe('harness.loop_started');
    const startEvent = events[0] as Extract<HarnessAuditEvent, { eventType: 'harness.loop_started' }>;
    expect(startEvent.maxToolIterations).toBe(3);
    expect(startEvent.harnessVersion).toBe('v1');
    expect(startEvent.sessionId).toBe('sess-1');
    expect(startEvent.toolTimeoutMs).toBe(0);
  });

  it('emits configured toolTimeoutMs in loop_started event when provided', async () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeCompletedResult(),
    );

    await executeAgentHarnessLoop(
      makeOptions(executeFn, {
        recorder,
        toolTimeoutMs: 30_000,
      }),
    );

    const startEvent = recorder.getEvents().find(
      (e) => e.eventType === 'harness.loop_started',
    ) as Extract<HarnessAuditEvent, { eventType: 'harness.loop_started' }>;
    expect(startEvent).toBeDefined();
    expect(startEvent.toolTimeoutMs).toBe(30_000);
  });

  it('emits model_invocation_started and model_invocation_completed events', async () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeCompletedResult({ tokensUsed: 42, model: 'stub', provider: 'test-provider' }),
    );

    await executeAgentHarnessLoop(makeOptions(executeFn, { recorder }));

    const types = getEventTypes(recorder);
    expect(types).toContain('harness.model_invocation_started');
    expect(types).toContain('harness.model_invocation_completed');

    const completed = recorder.getEvents().find(
      (e) => e.eventType === 'harness.model_invocation_completed',
    ) as Extract<HarnessAuditEvent, { eventType: 'harness.model_invocation_completed' }>;
    expect(completed.iteration).toBe(0);
    expect(completed.model).toBe('stub');
    expect(completed.tokensUsed).toBe(42);
    expect(completed.cumulativeTokensUsed).toBe(42);
    expect(completed.finishReason).toBe('completed');
  });

  it('emits model_invocation_failed event when executeFn throws', async () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockRejectedValue(
      new Error('Provider API failed'),
    );

    await expect(
      executeAgentHarnessLoop(makeOptions(executeFn, { recorder })),
    ).rejects.toThrow('Provider API failed');

    const failedEvent = recorder.getEvents().find(
      (e) => e.eventType === 'harness.model_invocation_failed',
    ) as Extract<HarnessAuditEvent, { eventType: 'harness.model_invocation_failed' }>;
    expect(failedEvent).toBeDefined();
    expect(failedEvent.iteration).toBe(0);
    expect(failedEvent.errorMessage).toBe('Provider API failed');
  });

  it('emits tool_dispatch_started and tool_dispatch_completed events', async () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async () => ({ content: 'ok' }));

    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(makeToolCallResult());
      return Promise.resolve(makeCompletedResult());
    });

    await executeAgentHarnessLoop(makeOptions(executeFn, { dispatcher, recorder }));

    const types = getEventTypes(recorder);
    expect(types).toContain('harness.tool_dispatch_started');
    expect(types).toContain('harness.tool_dispatch_completed');

    const started = recorder.getEvents().find(
      (e) => e.eventType === 'harness.tool_dispatch_started',
    ) as Extract<HarnessAuditEvent, { eventType: 'harness.tool_dispatch_started' }>;
    expect(started.callId).toBe('call-1');
    expect(started.toolName).toBe('read_file');

    const completed = recorder.getEvents().find(
      (e) => e.eventType === 'harness.tool_dispatch_completed',
    ) as Extract<HarnessAuditEvent, { eventType: 'harness.tool_dispatch_completed' }>;
    expect(completed.callId).toBe('call-1');
    expect(completed.toolName).toBe('read_file');
    expect(completed.resultBytes).toBeGreaterThan(0);
  });

  it('emits tool_dispatch_failed with timeout error code', async () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const dispatcher = new ToolDispatcher({ toolTimeoutMs: 1 });
    dispatcher.registerHandler('read_file', async () => {
      await new Promise((r) => setTimeout(r, 100));
      return { content: 'late' };
    });

    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(makeToolCallResult());
      return Promise.resolve(makeCompletedResult());
    });

    await executeAgentHarnessLoop(makeOptions(executeFn, { dispatcher, recorder }));

    const failedEvent = recorder.getEvents().find(
      (e) => e.eventType === 'harness.tool_dispatch_failed',
    ) as Extract<HarnessAuditEvent, { eventType: 'harness.tool_dispatch_failed' }>;
    expect(failedEvent).toBeDefined();
    expect(failedEvent.errorCode).toBe('TOOL_TIMEOUT');
    expect(failedEvent.toolName).toBe('read_file');
  });

  it('emits tool_dispatch_failed with abort error code', async () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const abortController = new AbortController();
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async () => {
      abortController.abort();
      return { content: 'data' };
    });

    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(makeToolCallResult({
        toolCalls: [
          { callId: 'c1', toolName: 'read_file', arguments: { path: 'a' }, providerKind: 'stub' },
          { callId: 'c2', toolName: 'read_file', arguments: { path: 'b' }, providerKind: 'stub' },
        ],
      }));
      return Promise.resolve(makeCompletedResult());
    });

    await executeAgentHarnessLoop(
      makeOptions(executeFn, { dispatcher, recorder, signal: abortController.signal }),
    );

    const failedEvents = recorder.getEvents().filter(
      (e) => e.eventType === 'harness.tool_dispatch_failed',
    ) as Extract<HarnessAuditEvent, { eventType: 'harness.tool_dispatch_failed' }>[];
    const abortEvent = failedEvents.find((e) => e.errorCode === 'ABORTED');
    expect(abortEvent).toBeDefined();
  });

  it('emits tool_result_budget_exceeded event', async () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async () => ({ content: 'payload-data' }));

    const firstResult = {
      callId: 'call-1',
      toolName: 'read_file',
      success: true,
      content: { content: 'payload-data' },
      errorMessage: undefined,
    };
    const firstBytes = Buffer.byteLength(JSON.stringify(firstResult ?? {}), 'utf8');

    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(makeToolCallResult({ tokensUsed: 3 }));
      if (callCount === 2) return Promise.resolve(makeToolCallResult({
        toolCalls: [{ callId: 'call-2', toolName: 'read_file', arguments: { path: 'b' }, providerKind: 'stub' }],
        tokensUsed: 4,
      }));
      return Promise.resolve(makeCompletedResult({ tokensUsed: 5 }));
    });

    await executeAgentHarnessLoop(
      makeOptions(executeFn, {
        dispatcher,
        recorder,
        config: { maxToolIterations: 4, maxToolResultBytes: firstBytes + 1 },
      }),
    );

    const budgetEvent = recorder.getEvents().find(
      (e) => e.eventType === 'harness.tool_result_budget_exceeded',
    ) as Extract<HarnessAuditEvent, { eventType: 'harness.tool_result_budget_exceeded' }>;
    expect(budgetEvent).toBeDefined();
    expect(budgetEvent.callId).toBe('call-2');
    expect(budgetEvent.maxBytes).toBe(firstBytes + 1);
    expect(budgetEvent.candidateBytes).toBeGreaterThan(0);
  });

  it('emits loop_completed event', async () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeCompletedResult(),
    );

    await executeAgentHarnessLoop(makeOptions(executeFn, { recorder }));

    const completedEvent = recorder.getEvents().find(
      (e) => e.eventType === 'harness.loop_completed',
    ) as Extract<HarnessAuditEvent, { eventType: 'harness.loop_completed' }>;
    expect(completedEvent).toBeDefined();
    expect(completedEvent.terminationReason).toBe('completed');
  });

  it('emits loop_max_turns event', async () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async () => ({ content: 'data' }));

    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeToolCallResult(),
    );

    await expect(
      executeAgentHarnessLoop(
        makeOptions(executeFn, {
          dispatcher,
          recorder,
          config: { maxToolIterations: 2, maxToolResultBytes: 262_144 },
        }),
      ),
    ).rejects.toBeInstanceOf(HarnessMaxIterationsError);

    const maxTurnsEvent = recorder.getEvents().find(
      (e) => e.eventType === 'harness.loop_max_turns',
    ) as Extract<HarnessAuditEvent, { eventType: 'harness.loop_max_turns' }>;
    expect(maxTurnsEvent).toBeDefined();
    expect(maxTurnsEvent.terminationReason).toBe('max_iterations');
    expect(maxTurnsEvent.maxToolIterations).toBe(2);
  });

  it('emits loop_aborted event', async () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const abortController = new AbortController();
    abortController.abort();

    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>();

    await executeAgentHarnessLoop(
      makeOptions(executeFn, { recorder, signal: abortController.signal }),
    );

    const abortedEvent = recorder.getEvents().find(
      (e) => e.eventType === 'harness.loop_aborted',
    ) as Extract<HarnessAuditEvent, { eventType: 'harness.loop_aborted' }>;
    expect(abortedEvent).toBeDefined();
    expect(abortedEvent.terminationReason).toBe('aborted');
  });

  it('emits loop_no_dispatcher event', async () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeToolCallResult(),
    );

    await executeAgentHarnessLoop(makeOptions(executeFn, { recorder }));

    const noDispatcherEvent = recorder.getEvents().find(
      (e) => e.eventType === 'harness.loop_no_dispatcher',
    ) as Extract<HarnessAuditEvent, { eventType: 'harness.loop_no_dispatcher' }>;
    expect(noDispatcherEvent).toBeDefined();
    expect(noDispatcherEvent.terminationReason).toBe('no_dispatcher');
  });

  it('events do not contain content, output, arguments, prompt, or full result fields', async () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async () => ({ content: 'secret file data' }));

    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(makeToolCallResult());
      return Promise.resolve(makeCompletedResult());
    });

    await executeAgentHarnessLoop(makeOptions(executeFn, { dispatcher, recorder }));

    const allEvents = recorder.getEvents();
    for (const event of allEvents) {
      const serialized = JSON.stringify(event);
      expect(serialized).not.toContain('secret file data');
      expect(serialized).not.toContain('test prompt');
      expect(serialized).not.toContain('README.md');

      const eventObj = event as unknown as Record<string, unknown>;
      expect(eventObj).not.toHaveProperty('content');
      expect(eventObj).not.toHaveProperty('output');
      expect(eventObj).not.toHaveProperty('arguments');
      expect(eventObj).not.toHaveProperty('prompt');
      expect(eventObj).not.toHaveProperty('result');
    }
  });

  it('durationMs is non-negative in all events that have it', async () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async () => ({ content: 'ok' }));

    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(makeToolCallResult());
      return Promise.resolve(makeCompletedResult());
    });

    await executeAgentHarnessLoop(makeOptions(executeFn, { dispatcher, recorder }));

    const allEvents = recorder.getEvents();
    for (const event of allEvents) {
      if ('durationMs' in event) {
        expect((event as { durationMs: number }).durationMs).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('uses the canonical request executionId on loop_started, distinct from sessionId', async () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeCompletedResult(),
    );
    const request = makeRequest({
      executionId: 'canonical-exec-id',
      sessionId: 'workspace-session-id',
    });

    await executeAgentHarnessLoop(makeOptions(executeFn, { recorder, request }));

    const startEvent = recorder.getEvents().find(
      (e) => e.eventType === 'harness.loop_started',
    ) as Extract<HarnessAuditEvent, { eventType: 'harness.loop_started' }>;
    expect(startEvent.executionId).toBe('canonical-exec-id');
    expect(startEvent.sessionId).toBe('workspace-session-id');
    expect(startEvent.executionId).not.toBe(startEvent.sessionId);
  });

  it('keeps the same canonical executionId on completion and termination events', async () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeCompletedResult(),
    );
    const request = makeRequest({
      executionId: 'canonical-exec-id',
      sessionId: 'workspace-session-id',
    });

    await executeAgentHarnessLoop(makeOptions(executeFn, { recorder, request }));

    const completedEvent = recorder.getEvents().find(
      (e) => e.eventType === 'harness.loop_completed',
    ) as Extract<HarnessAuditEvent, { eventType: 'harness.loop_completed' }>;
    expect(completedEvent.executionId).toBe('canonical-exec-id');
    expect(completedEvent.sessionId).toBe('workspace-session-id');
  });

  it('keeps the same canonical executionId on tool dispatch events', async () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async () => ({ content: 'ok' }));
    const request = makeRequest({
      executionId: 'canonical-exec-id',
      sessionId: 'workspace-session-id',
    });

    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(makeToolCallResult());
      return Promise.resolve(makeCompletedResult());
    });

    await executeAgentHarnessLoop(
      makeOptions(executeFn, { dispatcher, recorder, request }),
    );

    const dispatchEvents = recorder.getEvents().filter(
      (e) =>
        e.eventType === 'harness.tool_dispatch_started' ||
        e.eventType === 'harness.tool_dispatch_completed',
    );
    expect(dispatchEvents.length).toBeGreaterThan(0);
    for (const event of dispatchEvents) {
      expect(event.executionId).toBe('canonical-exec-id');
      expect(event.sessionId).toBe('workspace-session-id');
    }
  });

  it('never uses sessionId as the audit executionId across the whole loop', async () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async () => ({ content: 'ok' }));
    const request = makeRequest({
      executionId: 'canonical-exec-id',
      sessionId: 'workspace-session-id',
    });

    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(makeToolCallResult());
      return Promise.resolve(makeCompletedResult());
    });

    await executeAgentHarnessLoop(
      makeOptions(executeFn, { dispatcher, recorder, request }),
    );

    const allEvents = recorder.getEvents();
    expect(allEvents.length).toBeGreaterThan(0);
    for (const event of allEvents) {
      expect(event.executionId).toBe('canonical-exec-id');
      expect(event.sessionId).toBe('workspace-session-id');
      expect(event.executionId).not.toBe(event.sessionId);
    }
  });
});

describe('executeAgentHarnessLoop canonical executionId entry guard', () => {
  async function expectInvalidExecutionIdRejected(
    executionId: string | undefined,
  ): Promise<void> {
    const executeFn = jest
      .fn<Promise<AIAdapterToolUseResult>, any>()
      .mockResolvedValue({
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
      });
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('write_file', async () => ({ ok: true }));
    const dispatchSpy = jest.spyOn(dispatcher, 'dispatch');
    const createCheckpointFn = jest.fn(async () => ({
      commitHash: 'should-not-create',
      filesChanged: 0,
    }));
    const recorder = new InMemoryHarnessAuditRecorder();

    let caught: unknown;
    try {
      await executeAgentHarnessLoop(
        makeOptions(executeFn, {
          request: makeRequest({ executionId }),
          recorder,
          dispatcher,
          createCheckpointFn,
          mutatingToolNames: new Set(['write_file', 'delete_file']),
        }),
      );
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(HarnessInvalidExecutionIdError);
    expect(caught).toMatchObject({
      name: HARNESS_INVALID_EXECUTION_ID_ERROR_NAME,
      message: HARNESS_INVALID_EXECUTION_ID_ERROR_MESSAGE,
    });
    expect(executeFn).not.toHaveBeenCalled();
    expect(recorder.getEvents()).toEqual([]);
    expect(dispatchSpy).not.toHaveBeenCalled();
    expect(createCheckpointFn).not.toHaveBeenCalled();
  }

  it('rejects undefined executionId before any Harness side effect', async () => {
    await expectInvalidExecutionIdRejected(undefined);
  });

  it('rejects empty executionId before any Harness side effect', async () => {
    await expectInvalidExecutionIdRejected('');
  });

  it('rejects whitespace-only executionId before any Harness side effect', async () => {
    await expectInvalidExecutionIdRejected(' \t\n');
  });
});

describe('AGENT-PLATFORM-EXEC-01C3 loop-owned canonical transcript', () => {
  it('passes accumulated assistant and tool-result turns on the next executeFn call', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('list_files', async () => ({ entries: ['README.md'] }));
    dispatcher.registerHandler('read_file', async (args) => ({
      content: `contents of ${String(args.path)}`,
    }));

    let callCount = 0;
    const executeFn = jest.fn<
      Promise<AIAdapterToolUseResult>,
      [AIExecutionRequest, AIAdapterToolUseRequestOptions?]
    >(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(
          makeToolCallResult({
            output: 'I will look those up.',
            toolCalls: [
              {
                callId: 'call_aaa',
                toolName: 'list_files',
                arguments: { path: '.' },
                providerKind: 'openai-tool_calls',
              },
              {
                callId: 'call_bbb',
                toolName: 'read_file',
                arguments: { path: 'README.md' },
                providerKind: 'openai-tool_calls',
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeCompletedResult({ output: 'Done after both tools.' }));
    });

    const loopResult = await executeAgentHarnessLoop(
      makeOptions(executeFn, { dispatcher }),
    );

    expect(loopResult.terminationReason).toBe('completed');
    expect(executeFn).toHaveBeenCalledTimes(2);
    expect(executeFn.mock.calls[0][1]).toBeUndefined();

    const secondOpts = executeFn.mock.calls[1][1];
    expect(secondOpts?.toolResults).toHaveLength(2);
    expect(secondOpts?.toolResults?.map((result) => result.callId)).toEqual([
      'call_aaa',
      'call_bbb',
    ]);
    expect(secondOpts?.transcript).toEqual([
      {
        kind: 'assistant_tool_turn',
        content: 'I will look those up.',
        toolCalls: [
          {
            status: 'valid',
            callId: 'call_aaa',
            toolName: 'list_files',
            arguments: { path: '.' },
            rawArguments: { path: '.' },
            providerKind: 'openai-tool_calls',
          },
          {
            status: 'valid',
            callId: 'call_bbb',
            toolName: 'read_file',
            arguments: { path: 'README.md' },
            rawArguments: { path: 'README.md' },
            providerKind: 'openai-tool_calls',
          },
        ],
      },
      {
        kind: 'tool_result_turn',
        results: secondOpts?.toolResults,
      },
    ]);
    expect(dispatcher.registeredToolCount).toBe(2);
  });

  it('keeps last-turn toolResults while accumulating transcript across two tool turns', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async (args) => ({
      content: String(args.path),
    }));

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
                arguments: { path: 'ONE.md' },
                providerKind: 'stub',
              },
            ],
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
                arguments: { path: 'TWO.md' },
                providerKind: 'stub',
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeCompletedResult({ output: 'done' }));
    });

    await executeAgentHarnessLoop(
      makeOptions(executeFn, {
        dispatcher,
        config: { maxToolIterations: 4, maxToolResultBytes: 262_144 },
      }),
    );

    const thirdOpts = executeFn.mock.calls[2][1];
    expect(thirdOpts?.toolResults).toHaveLength(1);
    expect(thirdOpts?.toolResults?.[0].callId).toBe('call-2');
    expect(thirdOpts?.transcript).toHaveLength(4);
    expect(thirdOpts?.transcript?.[0]).toEqual(
      expect.objectContaining({ kind: 'assistant_tool_turn' }),
    );
    expect(thirdOpts?.transcript?.[1]).toEqual(
      expect.objectContaining({ kind: 'tool_result_turn' }),
    );
    expect(thirdOpts?.transcript?.[2]).toEqual(
      expect.objectContaining({ kind: 'assistant_tool_turn' }),
    );
    expect(thirdOpts?.transcript?.[3]).toEqual(
      expect.objectContaining({ kind: 'tool_result_turn' }),
    );
    const firstResultTurn = thirdOpts?.transcript?.[1];
    const secondResultTurn = thirdOpts?.transcript?.[3];
    expect(firstResultTurn?.kind).toBe('tool_result_turn');
    expect(secondResultTurn?.kind).toBe('tool_result_turn');
    if (firstResultTurn?.kind === 'tool_result_turn') {
      expect(firstResultTurn.results[0].callId).toBe('call-1');
    }
    if (secondResultTurn?.kind === 'tool_result_turn') {
      expect(secondResultTurn.results[0].callId).toBe('call-2');
    }
  });

  it('does not leak transcript between sequential or concurrent loop executions', async () => {
    const dispatcherA = new ToolDispatcher();
    dispatcherA.registerHandler('read_file', async () => ({ content: 'A' }));
    const dispatcherB = new ToolDispatcher();
    dispatcherB.registerHandler('read_file', async () => ({ content: 'B' }));

    const executeA = jest.fn<
      Promise<AIAdapterToolUseResult>,
      [AIExecutionRequest, AIAdapterToolUseRequestOptions?]
    >((_req, opts) => {
      if (!opts?.transcript || opts.transcript.length === 0) {
        return Promise.resolve(
          makeToolCallResult({
            toolCalls: [
              {
                callId: 'call-A',
                toolName: 'read_file',
                arguments: { path: 'A.md' },
                providerKind: 'stub',
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeCompletedResult({ output: 'done-A' }));
    });
    const executeB = jest.fn<
      Promise<AIAdapterToolUseResult>,
      [AIExecutionRequest, AIAdapterToolUseRequestOptions?]
    >((_req, opts) => {
      if (!opts?.transcript || opts.transcript.length === 0) {
        return Promise.resolve(
          makeToolCallResult({
            toolCalls: [
              {
                callId: 'call-B',
                toolName: 'read_file',
                arguments: { path: 'B.md' },
                providerKind: 'stub',
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeCompletedResult({ output: 'done-B' }));
    });

    await Promise.all([
      executeAgentHarnessLoop(makeOptions(executeA, { dispatcher: dispatcherA })),
      executeAgentHarnessLoop(makeOptions(executeB, { dispatcher: dispatcherB })),
    ]);

    const secondA = executeA.mock.calls[1][1];
    const secondB = executeB.mock.calls[1][1];
    expect(JSON.stringify(secondA?.transcript)).toContain('call-A');
    expect(JSON.stringify(secondA?.transcript)).not.toContain('call-B');
    expect(JSON.stringify(secondB?.transcript)).toContain('call-B');
    expect(JSON.stringify(secondB?.transcript)).not.toContain('call-A');

    const executeC = jest.fn<
      Promise<AIAdapterToolUseResult>,
      [AIExecutionRequest, AIAdapterToolUseRequestOptions?]
    >(() => Promise.resolve(makeCompletedResult({ output: 'done-C' })));
    await executeAgentHarnessLoop(makeOptions(executeC));
    expect(executeC.mock.calls[0][1]).toBeUndefined();
  });

  it('passes a copied transcript so executeFn cannot mutate loop-owned state', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async () => ({ content: 'ok' }));
    let callCount = 0;
    const executeFn = jest.fn<
      Promise<AIAdapterToolUseResult>,
      [AIExecutionRequest, AIAdapterToolUseRequestOptions?]
    >((_req, opts) => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(makeToolCallResult());
      }
      if (callCount === 2) {
        const mutable = [...(opts?.transcript ?? [])] as unknown as unknown[];
        (opts?.transcript as unknown as unknown[] | undefined)?.push({
          kind: 'injected',
        });
        mutable.push({ kind: 'should-not-matter' });
        return Promise.resolve(
          makeToolCallResult({
            toolCalls: [
              {
                callId: 'call-2',
                toolName: 'read_file',
                arguments: { path: 'TWO.md' },
                providerKind: 'stub',
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeCompletedResult({ output: 'done' }));
    });

    await executeAgentHarnessLoop(
      makeOptions(executeFn, {
        dispatcher,
        config: { maxToolIterations: 3, maxToolResultBytes: 262_144 },
      }),
    );

    const thirdOpts = executeFn.mock.calls[2]?.[1];
    expect(JSON.stringify(thirdOpts?.transcript ?? [])).not.toContain('injected');
    expect(executeFn).toHaveBeenCalledTimes(3);
  });
});

describe('AGENT-PLATFORM-EXEC-01C3 malformed and missing-ID fail-closed dispatch', () => {
  it('does not dispatch invalid JSON as {} and returns a typed error on the original call ID', async () => {
    const dispatcher = new ToolDispatcher();
    const handler = jest.fn(async () => ({ content: 'should-not-run' }));
    dispatcher.registerHandler('read_file', handler);
    const dispatchSpy = jest.spyOn(dispatcher, 'dispatch');

    let callCount = 0;
    const executeFn = jest.fn<
      Promise<AIAdapterToolUseResult>,
      [AIExecutionRequest, AIAdapterToolUseRequestOptions?]
    >(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(
          makeToolCallResult({
            toolCalls: [],
            canonicalToolCalls: [
              {
                status: 'malformed_arguments',
                callId: 'call_bad_json',
                toolName: 'read_file',
                rawArguments: '{not-json',
                providerKind: 'openai-tool_calls',
                errorMessage:
                  'MALFORMED_TOOL_ARGUMENTS: arguments are not valid JSON object',
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeCompletedResult({ output: 'acknowledged error' }));
    });

    const loopResult = await executeAgentHarnessLoop(
      makeOptions(executeFn, { dispatcher }),
    );

    expect(loopResult.terminationReason).toBe('completed');
    expect(handler).not.toHaveBeenCalled();
    expect(dispatchSpy).not.toHaveBeenCalled();
    const secondOpts = executeFn.mock.calls[1][1];
    expect(secondOpts?.toolResults).toEqual([
      {
        callId: 'call_bad_json',
        toolName: 'read_file',
        success: false,
        errorMessage:
          'MALFORMED_TOOL_ARGUMENTS: arguments are not valid JSON object',
      },
    ]);
    expect(secondOpts?.toolResults?.[0]).not.toEqual(
      expect.objectContaining({ content: {} }),
    );
  });

  it('never dispatches missing-ID calls and does not invent a fallback call ID', async () => {
    const dispatcher = new ToolDispatcher();
    const handler = jest.fn(async () => ({ entries: [] }));
    dispatcher.registerHandler('list_files', handler);
    const dispatchSpy = jest.spyOn(dispatcher, 'dispatch');

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
                callId: 'call_good',
                toolName: 'list_files',
                arguments: { path: '.' },
                providerKind: 'openai-tool_calls',
              },
            ],
            canonicalToolCalls: [
              {
                status: 'valid',
                callId: 'call_good',
                toolName: 'list_files',
                arguments: { path: '.' },
                rawArguments: '{"path":"."}',
                providerKind: 'openai-tool_calls',
              },
              {
                status: 'missing_id',
                toolName: 'list_files',
                rawArguments: '{"path":"."}',
                providerKind: 'openai-tool_calls',
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeCompletedResult({ output: 'done' }));
    });

    await executeAgentHarnessLoop(makeOptions(executeFn, { dispatcher }));

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy.mock.calls[0][0].callId).toBe('call_good');
    expect(handler).toHaveBeenCalledTimes(1);
    const secondOpts = executeFn.mock.calls[1][1];
    expect(secondOpts?.toolResults?.map((result) => result.callId)).toEqual([
      'call_good',
    ]);
    expect(JSON.stringify(secondOpts)).not.toContain('openai-tool-call-');
    expect(JSON.stringify(secondOpts)).not.toContain('anthropic-tool-use-');
  });

  it('returns TOOL_NOT_FOUND on the original call ID without inventing a handler', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async () => ({ content: 'ok' }));
    const dispatchSpy = jest.spyOn(dispatcher, 'dispatch');

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
                callId: 'call_unknown',
                toolName: 'search_workspace',
                arguments: { query: 'secret' },
                providerKind: 'openai-tool_calls',
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeCompletedResult({ output: 'unknown tool noted' }));
    });

    await executeAgentHarnessLoop(makeOptions(executeFn, { dispatcher }));

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy.mock.calls[0][0].callId).toBe('call_unknown');
    expect(dispatchSpy.mock.calls[0][0].toolName).toBe('search_workspace');
    const secondOpts = executeFn.mock.calls[1][1];
    expect(secondOpts?.toolResults).toHaveLength(1);
    expect(secondOpts?.toolResults?.[0].callId).toBe('call_unknown');
    expect(secondOpts?.toolResults?.[0].success).toBe(false);
    expect(secondOpts?.toolResults?.[0].errorMessage).toContain('search_workspace');
    expect(dispatcher.hasHandler('search_workspace')).toBe(false);
  });
});

describe('AGENT-PLATFORM-EXEC-01C3 max-iteration typed failure', () => {
  const RETRYABLE_ERROR_PATTERN =
    /timeout|timed out|ECONNRESET|ENOTFOUND|429|503|overloaded/i;

  it('throws a typed non-retryable failure after the final permitted tool-call turn', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async () => ({ content: 'data' }));
    const recorder = new InMemoryHarnessAuditRecorder();
    const executeFn = jest
      .fn<Promise<AIAdapterToolUseResult>, any>()
      .mockResolvedValue(makeToolCallResult({ tokensUsed: 7 }));

    let caught: unknown;
    try {
      await executeAgentHarnessLoop(
        makeOptions(executeFn, {
          dispatcher,
          recorder,
          config: { maxToolIterations: 2, maxToolResultBytes: 262_144 },
        }),
      );
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(HarnessMaxIterationsError);
    expect(caught).toMatchObject({
      name: HARNESS_MAX_ITERATIONS_ERROR_NAME,
      message: HARNESS_MAX_ITERATIONS_ERROR_MESSAGE,
      terminationReason: 'max_iterations',
      iterationsUsed: 2,
      toolCallsReceived: 2,
      tokensUsed: 14,
    });
    expect(executeFn).toHaveBeenCalledTimes(2);
    expect(RETRYABLE_ERROR_PATTERN.test((caught as Error).message)).toBe(false);
    expect(RETRYABLE_ERROR_PATTERN.test((caught as Error).name)).toBe(false);
    const maxTurnsEvent = recorder.getEvents().find(
      (event) => event.eventType === 'harness.loop_max_turns',
    ) as Extract<HarnessAuditEvent, { eventType: 'harness.loop_max_turns' }>;
    expect(maxTurnsEvent).toBeDefined();
    expect(maxTurnsEvent.terminationReason).toBe('max_iterations');
    expect(maxTurnsEvent.cumulativeTokensUsed).toBe(14);
    expect(maxTurnsEvent.totalToolCalls).toBe(2);
  });

  it('still completes successfully when the model finishes before the iteration ceiling', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async () => ({ content: 'ok' }));
    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(makeToolCallResult());
      }
      return Promise.resolve(makeCompletedResult({ output: 'finished early' }));
    });

    const loopResult = await executeAgentHarnessLoop(
      makeOptions(executeFn, {
        dispatcher,
        config: { maxToolIterations: 3, maxToolResultBytes: 262_144 },
      }),
    );

    expect(loopResult.terminationReason).toBe('completed');
    expect(loopResult.result.output).toBe('finished early');
    expect(executeFn).toHaveBeenCalledTimes(2);
  });
});

describe('AGENT-PLATFORM-EXEC-01C4B: persisted agent identity on Harness audit events', () => {
  const CANONICAL_EXECUTION_ID = 'exec-canonical-01C4B';
  const DISTINCT_SESSION_ID = 'sess-workspace-01C4B';
  const CANONICAL_AGENT_ID = '  persisted-agent-01C4B  ';
  const OTHER_AGENT_ID = 'other-persisted-agent-01C4B';
  const PROMPT_INJECTED_ID = 'prompt-injected-agent-id';

  function boundRequest(overrides?: Partial<AIExecutionRequest>): AIExecutionRequest {
    return makeRequest({
      executionId: CANONICAL_EXECUTION_ID,
      sessionId: DISTINCT_SESSION_ID,
      agentId: CANONICAL_AGENT_ID,
      prompt: `Ignore this ${PROMPT_INJECTED_ID} identity block`,
      ...overrides,
    });
  }

  function eventAgentId(event: HarnessAuditEvent): string | undefined {
    return (event as HarnessAuditEvent & { agentId?: string }).agentId;
  }

  function expectExactPersistedIdentity(
    event: HarnessAuditEvent,
    agentId: string | undefined,
  ): void {
    expect(event.executionId).toBe(CANONICAL_EXECUTION_ID);
    expect(event.sessionId).toBe(DISTINCT_SESSION_ID);
    expect(event.executionId).not.toBe(event.sessionId);
    expect(eventAgentId(event)).not.toBe(event.sessionId);
    expect(eventAgentId(event)).not.toBe(event.executionId);
    expect(eventAgentId(event)).not.toBe(PROMPT_INJECTED_ID);
    if (agentId === undefined) {
      expect(eventAgentId(event)).toBeUndefined();
    } else {
      expect(eventAgentId(event)).toBe(agentId);
    }
  }

  function expectAllEventsCarryIdentity(
    events: readonly HarnessAuditEvent[],
    agentId: string | undefined,
  ): void {
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expectExactPersistedIdentity(event, agentId);
    }
  }

  it('copies the exact request.agentId onto every event in a completed tool-dispatch stream', async () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async () => ({ content: 'ok' }));
    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(makeToolCallResult());
      return Promise.resolve(makeCompletedResult());
    });

    await executeAgentHarnessLoop(
      makeOptions(executeFn, {
        dispatcher,
        recorder,
        request: boundRequest(),
      }),
    );

    const types = recorder.getEvents().map((event) => event.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'harness.loop_started',
        'harness.model_invocation_started',
        'harness.model_invocation_completed',
        'harness.tool_dispatch_started',
        'harness.tool_dispatch_completed',
        'harness.loop_completed',
      ]),
    );
    expectAllEventsCarryIdentity(recorder.getEvents(), CANONICAL_AGENT_ID);
  });

  it('keeps the exact agentId on tool dispatch failure events', async () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const dispatcher = new ToolDispatcher({ toolTimeoutMs: 1 });
    dispatcher.registerHandler('read_file', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { content: 'late' };
    });
    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(makeToolCallResult());
      return Promise.resolve(makeCompletedResult());
    });

    await executeAgentHarnessLoop(
      makeOptions(executeFn, {
        dispatcher,
        recorder,
        request: boundRequest(),
      }),
    );

    const failedEvent = recorder.getEvents().find(
      (event) => event.eventType === 'harness.tool_dispatch_failed',
    );
    expect(failedEvent).toBeDefined();
    expectAllEventsCarryIdentity(recorder.getEvents(), CANONICAL_AGENT_ID);
  });

  it('keeps the exact agentId on the tool-result budget path', async () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async () => ({ content: 'payload-data' }));
    const firstResult = {
      callId: 'call-1',
      toolName: 'read_file',
      success: true,
      content: { content: 'payload-data' },
      errorMessage: undefined,
    };
    const firstBytes = Buffer.byteLength(JSON.stringify(firstResult ?? {}), 'utf8');
    let callCount = 0;
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(makeToolCallResult({ tokensUsed: 3 }));
      if (callCount === 2) {
        return Promise.resolve(
          makeToolCallResult({
            toolCalls: [
              {
                callId: 'call-2',
                toolName: 'read_file',
                arguments: { path: 'b' },
                providerKind: 'stub',
              },
            ],
            tokensUsed: 4,
          }),
        );
      }
      return Promise.resolve(makeCompletedResult({ tokensUsed: 5 }));
    });

    await executeAgentHarnessLoop(
      makeOptions(executeFn, {
        dispatcher,
        recorder,
        request: boundRequest(),
        config: { maxToolIterations: 4, maxToolResultBytes: firstBytes + 1 },
      }),
    );

    const budgetEvent = recorder.getEvents().find(
      (event) => event.eventType === 'harness.tool_result_budget_exceeded',
    );
    expect(budgetEvent).toBeDefined();
    expectAllEventsCarryIdentity(recorder.getEvents(), CANONICAL_AGENT_ID);
  });

  it('records the exact agentId on max-iteration termination before the typed throw', async () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('read_file', async () => ({ content: 'data' }));
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeToolCallResult(),
    );

    await expect(
      executeAgentHarnessLoop(
        makeOptions(executeFn, {
          dispatcher,
          recorder,
          request: boundRequest(),
          config: { maxToolIterations: 2, maxToolResultBytes: 262_144 },
        }),
      ),
    ).rejects.toBeInstanceOf(HarnessMaxIterationsError);

    const maxTurnsEvent = recorder.getEvents().find(
      (event) => event.eventType === 'harness.loop_max_turns',
    );
    expect(maxTurnsEvent).toBeDefined();
    expectAllEventsCarryIdentity(recorder.getEvents(), CANONICAL_AGENT_ID);
  });

  it('omits invented agent identity from unbound loop events', async () => {
    const recorder = new InMemoryHarnessAuditRecorder();
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeCompletedResult(),
    );

    await executeAgentHarnessLoop(
      makeOptions(executeFn, {
        recorder,
        request: makeRequest({
          executionId: CANONICAL_EXECUTION_ID,
          sessionId: DISTINCT_SESSION_ID,
        }),
      }),
    );

    const events = recorder.getEvents();
    expect(events.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        'harness.loop_started',
        'harness.model_invocation_started',
        'harness.model_invocation_completed',
        'harness.loop_completed',
      ]),
    );
    expectAllEventsCarryIdentity(events, undefined);
  });

  it('does not leak agentId between sequential loop executions', async () => {
    const firstRecorder = new InMemoryHarnessAuditRecorder();
    const secondRecorder = new InMemoryHarnessAuditRecorder();
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeCompletedResult(),
    );

    await executeAgentHarnessLoop(
      makeOptions(executeFn, {
        recorder: firstRecorder,
        request: boundRequest({ agentId: CANONICAL_AGENT_ID }),
      }),
    );
    await executeAgentHarnessLoop(
      makeOptions(executeFn, {
        recorder: secondRecorder,
        request: boundRequest({
          executionId: 'exec-canonical-01C4B-b',
          sessionId: 'sess-workspace-01C4B-b',
          agentId: OTHER_AGENT_ID,
        }),
      }),
    );

    for (const event of firstRecorder.getEvents()) {
      expect(eventAgentId(event)).toBe(CANONICAL_AGENT_ID);
      expect(event.executionId).toBe(CANONICAL_EXECUTION_ID);
      expect(eventAgentId(event)).not.toBe(OTHER_AGENT_ID);
    }
    for (const event of secondRecorder.getEvents()) {
      expect(eventAgentId(event)).toBe(OTHER_AGENT_ID);
      expect(event.executionId).toBe('exec-canonical-01C4B-b');
      expect(eventAgentId(event)).not.toBe(CANONICAL_AGENT_ID);
    }
  });

  it('does not leak agentId between concurrent loop executions', async () => {
    const firstRecorder = new InMemoryHarnessAuditRecorder();
    const secondRecorder = new InMemoryHarnessAuditRecorder();
    const executeFn = jest.fn<Promise<AIAdapterToolUseResult>, any>().mockResolvedValue(
      makeCompletedResult(),
    );

    await Promise.all([
      executeAgentHarnessLoop(
        makeOptions(executeFn, {
          recorder: firstRecorder,
          request: boundRequest({ agentId: CANONICAL_AGENT_ID }),
        }),
      ),
      executeAgentHarnessLoop(
        makeOptions(executeFn, {
          recorder: secondRecorder,
          request: boundRequest({
            executionId: 'exec-canonical-01C4B-c',
            sessionId: 'sess-workspace-01C4B-c',
            agentId: OTHER_AGENT_ID,
          }),
        }),
      ),
    ]);

    for (const event of firstRecorder.getEvents()) {
      expect(eventAgentId(event)).toBe(CANONICAL_AGENT_ID);
      expect(event.executionId).toBe(CANONICAL_EXECUTION_ID);
      expect(eventAgentId(event)).not.toBe(OTHER_AGENT_ID);
    }
    for (const event of secondRecorder.getEvents()) {
      expect(eventAgentId(event)).toBe(OTHER_AGENT_ID);
      expect(event.executionId).toBe('exec-canonical-01C4B-c');
      expect(eventAgentId(event)).not.toBe(CANONICAL_AGENT_ID);
    }
  });
});
