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

    try {
      const content = await handler(toolCall.arguments, signal);
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
    }
  }
}
