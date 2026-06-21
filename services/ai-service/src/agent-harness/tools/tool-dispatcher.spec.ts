import {
  ToolDispatcher,
  TOOL_DISPATCH_ERROR_NOT_FOUND,
  TOOL_DISPATCH_ERROR_HANDLER,
  TOOL_DISPATCH_ERROR_ABORTED,
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
    dispatcher.registerHandler('test_tool', async () => ({ ok: true }));

    const abortController = new AbortController();
    abortController.abort();

    const result = await dispatcher.dispatch(
      makeToolCall(),
      abortController.signal,
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(TOOL_DISPATCH_ERROR_ABORTED);
  });

  it('forwards signal to the handler', async () => {
    const dispatcher = new ToolDispatcher();
    let receivedSignal: AbortSignal | undefined;
    dispatcher.registerHandler('signal_tool', async (_args, signal) => {
      receivedSignal = signal;
      return { ok: true };
    });

    const abortController = new AbortController();
    await dispatcher.dispatch(makeToolCall({ toolName: 'signal_tool' }), abortController.signal);

    expect(receivedSignal).toBe(abortController.signal);
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
});
