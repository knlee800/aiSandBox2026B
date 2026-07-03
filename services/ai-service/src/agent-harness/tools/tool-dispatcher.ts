import type { AIAdapterToolCallMetadata } from '../../ai-execution/adapters/adapter-tool-use.contracts';

/**
 * Result of dispatching a single tool call through the ToolDispatcher.
 * Compatible with AgentHarnessToolResultV1 / AgentHarnessToolErrorV1 shape
 * but narrowed for dispatcher-level use without requiring the full
 * harness contracts surface.
 */
export interface ToolDispatchResult {
  readonly callId: string;
  readonly toolName: string;
  readonly success: boolean;
  readonly content?: Readonly<Record<string, unknown>>;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

export const TOOL_DISPATCH_ERROR_NOT_FOUND = 'TOOL_NOT_FOUND' as const;
export const TOOL_DISPATCH_ERROR_HANDLER = 'HANDLER_ERROR' as const;
export const TOOL_DISPATCH_ERROR_ABORTED = 'ABORTED' as const;
export const TOOL_DISPATCH_ERROR_TIMEOUT = 'TOOL_TIMEOUT' as const;
export const TOOL_DISPATCH_ERROR_RESULT_TOO_LARGE = 'RESULT_TOO_LARGE' as const;

export interface ToolDispatcherOptions {
  readonly toolTimeoutMs?: number;
  readonly maxToolResultBytes?: number;
}

/**
 * Handler function signature for a registered tool.
 * Receives the parsed arguments and an optional AbortSignal.
 * Must return a content object on success or throw on failure.
 */
export type ToolHandler = (
  args: Readonly<Record<string, unknown>>,
  signal?: AbortSignal,
) => Promise<Readonly<Record<string, unknown>>>;

/**
 * ToolDispatcher routes tool calls to registered handlers and returns
 * typed results. It intentionally ships with no built-in handlers —
 * handlers are registered externally by the caller.
 *
 * Safety invariants:
 * - Unknown tools produce a TOOL_NOT_FOUND result, never an exception.
 * - Handler errors are wrapped into typed error results.
 * - AbortSignal is checked before dispatch and forwarded to handlers.
 * - No filesystem, shell, validation, browser, or network tools are
 *   built in.
 */
export class ToolDispatcher {
  private readonly handlers = new Map<string, ToolHandler>();
  private readonly toolTimeoutMs?: number;
  private readonly maxToolResultBytes?: number;

  constructor(options?: ToolDispatcherOptions) {
    this.toolTimeoutMs = options?.toolTimeoutMs;
    this.maxToolResultBytes = options?.maxToolResultBytes;
  }

  registerHandler(toolName: string, handler: ToolHandler): void {
    this.handlers.set(toolName, handler);
  }

  hasHandler(toolName: string): boolean {
    return this.handlers.has(toolName);
  }

  get registeredToolCount(): number {
    return this.handlers.size;
  }

  async dispatch(
    toolCall: AIAdapterToolCallMetadata,
    signal?: AbortSignal,
  ): Promise<ToolDispatchResult> {
    if (signal?.aborted) {
      return {
        callId: toolCall.callId,
        toolName: toolCall.toolName,
        success: false,
        errorCode: TOOL_DISPATCH_ERROR_ABORTED,
        errorMessage: 'Tool dispatch aborted before execution.',
      };
    }

    const handler = this.handlers.get(toolCall.toolName);

    if (!handler) {
      return {
        callId: toolCall.callId,
        toolName: toolCall.toolName,
        success: false,
        errorCode: TOOL_DISPATCH_ERROR_NOT_FOUND,
        errorMessage: `No handler registered for tool: ${toolCall.toolName}`,
      };
    }

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const dispatchAbortController = new AbortController();
    let externallyAborted = false;
    let timedOut = false;

    const onExternalAbort = () => {
      externallyAborted = true;
      if (!dispatchAbortController.signal.aborted) {
        dispatchAbortController.abort();
      }
    };

    signal?.addEventListener('abort', onExternalAbort);

    try {
      const safeHandlerPromise = handler(
        toolCall.arguments,
        dispatchAbortController.signal,
      )
        .then(
          (content) => ({ type: 'success' as const, content }),
        )
        .catch((error) => ({ type: 'error' as const, error }));

      let outcome:
        | { type: 'success'; content: Readonly<Record<string, unknown>> }
        | { type: 'error'; error: unknown }
        | { type: 'timeout' };

      if (
        typeof this.toolTimeoutMs === 'number' &&
        Number.isFinite(this.toolTimeoutMs) &&
        this.toolTimeoutMs > 0
      ) {
        const timeoutPromise = new Promise<{ type: 'timeout' }>((resolve) => {
          timeoutHandle = setTimeout(() => {
            timedOut = true;
            if (!dispatchAbortController.signal.aborted) {
              dispatchAbortController.abort();
            }
            resolve({ type: 'timeout' });
          }, this.toolTimeoutMs);
        });
        outcome = await Promise.race([safeHandlerPromise, timeoutPromise]);
      } else {
        outcome = await safeHandlerPromise;
      }

      if (signal?.aborted || externallyAborted) {
        return {
          callId: toolCall.callId,
          toolName: toolCall.toolName,
          success: false,
          errorCode: TOOL_DISPATCH_ERROR_ABORTED,
          errorMessage: 'Tool dispatch aborted before execution.',
        };
      }

      if (outcome.type === 'timeout' || timedOut) {
        return {
          callId: toolCall.callId,
          toolName: toolCall.toolName,
          success: false,
          errorCode: TOOL_DISPATCH_ERROR_TIMEOUT,
          errorMessage: `Tool execution timed out after ${this.toolTimeoutMs}ms`,
        };
      }

      if (outcome.type === 'error') {
        const message =
          outcome.error instanceof Error
            ? outcome.error.message
            : String(outcome.error);
        return {
          callId: toolCall.callId,
          toolName: toolCall.toolName,
          success: false,
          errorCode: TOOL_DISPATCH_ERROR_HANDLER,
          errorMessage: message,
        };
      }

      const content = outcome.content;
      const serializedResultBytes = Buffer.byteLength(
        JSON.stringify(content ?? {}),
        'utf8',
      );
      if (
        typeof this.maxToolResultBytes === 'number' &&
        Number.isFinite(this.maxToolResultBytes) &&
        this.maxToolResultBytes > 0 &&
        serializedResultBytes > this.maxToolResultBytes
      ) {
        return {
          callId: toolCall.callId,
          toolName: toolCall.toolName,
          success: false,
          errorCode: TOOL_DISPATCH_ERROR_RESULT_TOO_LARGE,
          errorMessage: `Tool result exceeds maximum size (${this.maxToolResultBytes} bytes).`,
        };
      }

      return {
        callId: toolCall.callId,
        toolName: toolCall.toolName,
        success: true,
        content,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        callId: toolCall.callId,
        toolName: toolCall.toolName,
        success: false,
        errorCode: TOOL_DISPATCH_ERROR_HANDLER,
        errorMessage: message,
      };
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      signal?.removeEventListener('abort', onExternalAbort);
    }
  }
}
