import type { ToolHandler } from './tool-dispatcher';

const MAX_TOOL_PROGRESS_TARGET_LENGTH = 200;

const TARGET_FIELDS: Readonly<Record<string, string>> = {
  list_files: 'path',
  read_file: 'path',
  write_file: 'path',
  delete_file: 'path',
  search_workspace: 'query',
  run_validation: 'command',
  browser_smoke: 'url',
};

export interface HarnessToolProgress {
  readonly step: number;
  readonly tool: string;
  readonly target?: string;
}

export function toolProgressTarget(
  toolName: string,
  args: Readonly<Record<string, unknown>>,
): string | undefined {
  const field = TARGET_FIELDS[toolName];
  if (field === undefined) {
    return undefined;
  }

  const value = args[field];
  if (typeof value !== 'string') {
    return undefined;
  }

  return value.length <= MAX_TOOL_PROGRESS_TARGET_LENGTH
    ? value
    : value.slice(0, MAX_TOOL_PROGRESS_TARGET_LENGTH);
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

export function createToolProgressWrapper(
  publish: (progress: HarnessToolProgress) => unknown,
): (toolName: string, handler: ToolHandler) => ToolHandler {
  let step = 0;

  return (toolName, handler) => {
    const wrapped: ToolHandler = (args, signal) => {
      step += 1;
      const target = toolProgressTarget(toolName, args);
      try {
        const pending = publish({ step, tool: toolName, target });
        if (isPromiseLike(pending)) {
          pending.then(
            () => undefined,
            () => undefined,
          );
        }
      } catch {
        // A failed publish must not affect the tool.
      }
      return handler(args, signal);
    };
    return wrapped;
  };
}
