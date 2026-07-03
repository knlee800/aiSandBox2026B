import {
  ToolDispatcher,
  TOOL_DISPATCH_ERROR_NOT_FOUND,
  TOOL_DISPATCH_ERROR_HANDLER,
  TOOL_DISPATCH_ERROR_ABORTED,
  TOOL_DISPATCH_ERROR_TIMEOUT,
  TOOL_DISPATCH_ERROR_RESULT_TOO_LARGE,
} from './tool-dispatcher';
import type { AIAdapterToolCallMetadata } from '../../ai-execution/adapters/adapter-tool-use.contracts';

function makeToolCall(overrides?: Partial<AIAdapterToolCallMetadata>): AIAdapterToolCallMetadata {
  return {
    callId: 'call-1',
    toolName: 'test_tool',
    arguments: { key: 'value' },
    providerKind: 'stub',
    ...overrides,
  };
}

describe('ToolDispatcher', () => {
  it('returns TOOL_NOT_FOUND when no handler is registered', async () => {
    const dispatcher = new ToolDispatcher();
    const result = await dispatcher.dispatch(makeToolCall());

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(TOOL_DISPATCH_ERROR_NOT_FOUND);
    expect(result.callId).toBe('call-1');
    expect(result.toolName).toBe('test_tool');
    expect(result.errorMessage).toContain('test_tool');
  });

  it('routes correctly when a handler is registered', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('test_tool', async (args) => {
      return { echo: args.key };
    });

    const result = await dispatcher.dispatch(makeToolCall());

    expect(result.success).toBe(true);
    expect(result.content).toEqual({ echo: 'value' });
    expect(result.callId).toBe('call-1');
    expect(result.toolName).toBe('test_tool');
    expect(result.errorCode).toBeUndefined();
  });

  it('wraps handler errors into typed error results', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('failing_tool', async () => {
      throw new Error('Handler exploded');
    });

    const result = await dispatcher.dispatch(
      makeToolCall({ toolName: 'failing_tool' }),
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(TOOL_DISPATCH_ERROR_HANDLER);
    expect(result.errorMessage).toBe('Handler exploded');
    expect(result.callId).toBe('call-1');
  });

  it('wraps non-Error throws into typed error results', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('string_throw', async () => {
      throw 'raw string error';
    });

    const result = await dispatcher.dispatch(
      makeToolCall({ toolName: 'string_throw' }),
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(TOOL_DISPATCH_ERROR_HANDLER);
    expect(result.errorMessage).toBe('raw string error');
  });

  it('returns ABORTED result when signal is already aborted', async () => {
    const dispatcher = new ToolDispatcher();
    const handler = jest.fn(async () => ({ ok: true }));
    dispatcher.registerHandler('test_tool', handler);

    const abortController = new AbortController();
    abortController.abort();

    const result = await dispatcher.dispatch(
      makeToolCall(),
      abortController.signal,
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(TOOL_DISPATCH_ERROR_ABORTED);
    expect(handler).not.toHaveBeenCalled();
  });

  it('passes a derived AbortSignal to the handler', async () => {
    const dispatcher = new ToolDispatcher();
    let receivedSignal: AbortSignal | undefined;
    dispatcher.registerHandler('signal_tool', async (_args, signal) => {
      receivedSignal = signal;
      return { ok: true };
    });

    const abortController = new AbortController();
    await dispatcher.dispatch(makeToolCall({ toolName: 'signal_tool' }), abortController.signal);

    expect(receivedSignal).toBeDefined();
    expect(receivedSignal).not.toBe(abortController.signal);
    expect(receivedSignal?.aborted).toBe(false);
  });

  it('has no built-in handlers on construction', () => {
    const dispatcher = new ToolDispatcher();
    expect(dispatcher.registeredToolCount).toBe(0);
    expect(dispatcher.hasHandler('read_file')).toBe(false);
    expect(dispatcher.hasHandler('list_files')).toBe(false);
    expect(dispatcher.hasHandler('write_file')).toBe(false);
    expect(dispatcher.hasHandler('delete_file')).toBe(false);
    expect(dispatcher.hasHandler('run_validation')).toBe(false);
    expect(dispatcher.hasHandler('browser_smoke')).toBe(false);
  });

  it('returns TOOL_NOT_FOUND for unregistered tool even when other tools are registered', async () => {
    const dispatcher = new ToolDispatcher();
    dispatcher.registerHandler('other_tool', async () => ({ ok: true }));

    const result = await dispatcher.dispatch(
      makeToolCall({ toolName: 'unknown_tool' }),
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(TOOL_DISPATCH_ERROR_NOT_FOUND);
    expect(result.toolName).toBe('unknown_tool');
  });

  it('tracks registered handler count correctly', () => {
    const dispatcher = new ToolDispatcher();
    expect(dispatcher.registeredToolCount).toBe(0);

    dispatcher.registerHandler('tool_a', async () => ({}));
    expect(dispatcher.registeredToolCount).toBe(1);

    dispatcher.registerHandler('tool_b', async () => ({}));
    expect(dispatcher.registeredToolCount).toBe(2);
  });

  it('times out a slow handler and returns TOOL_TIMEOUT', async () => {
    const dispatcher = new ToolDispatcher({ toolTimeoutMs: 20 });
    dispatcher.registerHandler(
      'slow_tool',
      async () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 200)),
    );

    const result = await dispatcher.dispatch(
      makeToolCall({ toolName: 'slow_tool' }),
    );

    expect(result).toMatchObject({
      callId: 'call-1',
      toolName: 'slow_tool',
      success: false,
      errorCode: TOOL_DISPATCH_ERROR_TIMEOUT,
    });
    expect(result.errorMessage).toContain('timed out after 20ms');
  });

  it('returns ABORTED when externally aborted during dispatch', async () => {
    const dispatcher = new ToolDispatcher({ toolTimeoutMs: 250 });
    dispatcher.registerHandler(
      'blocking_tool',
      async (_args, signal) =>
        new Promise((_, reject) => {
          signal?.addEventListener(
            'abort',
            () => reject(new Error('aborted by signal')),
            { once: true },
          );
        }),
    );

    const abortController = new AbortController();
    const dispatchPromise = dispatcher.dispatch(
      makeToolCall({ toolName: 'blocking_tool' }),
      abortController.signal,
    );

    setTimeout(() => abortController.abort(), 10);
    const result = await dispatchPromise;

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(TOOL_DISPATCH_ERROR_ABORTED);
  });

  it('returns RESULT_TOO_LARGE when handler result exceeds maxToolResultBytes', async () => {
    const dispatcher = new ToolDispatcher({ maxToolResultBytes: 32 });
    dispatcher.registerHandler('big_result_tool', async () => ({ data: 'x'.repeat(128) }));

    const result = await dispatcher.dispatch(
      makeToolCall({ toolName: 'big_result_tool' }),
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(TOOL_DISPATCH_ERROR_RESULT_TOO_LARGE);
    expect(result.errorMessage).toContain('32 bytes');
    expect(result.errorMessage).not.toContain('xxxxxxxx');
  });

  it('succeeds when handler result is within maxToolResultBytes', async () => {
    const dispatcher = new ToolDispatcher({ maxToolResultBytes: 1024 });
    dispatcher.registerHandler('small_result_tool', async () => ({ data: 'ok' }));

    const result = await dispatcher.dispatch(
      makeToolCall({ toolName: 'small_result_tool' }),
    );

    expect(result.success).toBe(true);
    expect(result.content).toEqual({ data: 'ok' });
  });

  it('does not emit unhandled rejection on timeout path', async () => {
    const dispatcher = new ToolDispatcher({ toolTimeoutMs: 10 });
    dispatcher.registerHandler(
      'late_reject_tool',
      async () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('late failure')), 40);
        }),
    );

    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);

    try {
      const result = await dispatcher.dispatch(
        makeToolCall({ toolName: 'late_reject_tool' }),
      );
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(TOOL_DISPATCH_ERROR_TIMEOUT);
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(unhandled).toHaveLength(0);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
