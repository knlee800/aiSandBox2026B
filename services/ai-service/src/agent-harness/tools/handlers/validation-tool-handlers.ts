import type { ToolHandler } from '../tool-dispatcher';
import type { ApiGatewayHttpClient } from '../../../clients/api-gateway-http.client';

export interface ValidationToolHandlerDeps {
  readonly client: ApiGatewayHttpClient;
  readonly sessionId: string;
  readonly allowedValidationCommands: readonly string[];
  readonly validationTimeoutMs: number;
  readonly maxValidationOutputBytes: number;
}

function truncateOutput(
  output: string,
  maxBytes: number,
): { text: string; wasTruncated: boolean } {
  const byteLength = Buffer.byteLength(output, 'utf-8');
  if (byteLength <= maxBytes) {
    return { text: output, wasTruncated: false };
  }
  const buf = Buffer.from(output, 'utf-8');
  const text =
    buf.slice(0, maxBytes).toString('utf-8') +
    `\n[...truncated at ${maxBytes} bytes]`;
  return { text, wasTruncated: true };
}

/**
 * Creates a run_validation tool handler.
 * Runs an allow-listed validation command through API Gateway boundary.
 * Rejects arbitrary commands before any HTTP call.
 * Truncates output to maxValidationOutputBytes before returning to model.
 */
export function createRunValidationHandler(
  deps: ValidationToolHandlerDeps,
): ToolHandler {
  return async (args: Readonly<Record<string, unknown>>) => {
    if (typeof args.command !== 'string' || args.command.trim().length === 0) {
      throw new Error('command is required and must be a non-empty string');
    }

    const requestedCommand = args.command.trim();

    const matchedCommand = deps.allowedValidationCommands.find(
      (allowed) => allowed === requestedCommand,
    );

    if (!matchedCommand) {
      throw new Error(
        `COMMAND_NOT_ALLOWED: "${requestedCommand}" is not in the allow-list. ` +
          `Allowed commands: ${deps.allowedValidationCommands.join(', ')}`,
      );
    }

    const startMs = Date.now();
    let exitCode: number;
    let stdout: string;
    let stderr: string;
    let timedOut = false;

    try {
      const result = await deps.client.runWorkspaceValidation(
        deps.sessionId,
        matchedCommand,
        deps.validationTimeoutMs,
      );
      exitCode = result.exitCode;
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/timeout/i.test(message)) {
        timedOut = true;
        exitCode = 1;
        stdout = '';
        stderr = `Validation timed out after ${deps.validationTimeoutMs}ms`;
      } else {
        throw err;
      }
    }

    const durationMs = Date.now() - startMs;

    const stdoutResult = truncateOutput(stdout, deps.maxValidationOutputBytes);
    const stderrResult = truncateOutput(stderr, deps.maxValidationOutputBytes);
    const truncated = stdoutResult.wasTruncated || stderrResult.wasTruncated;

    return {
      command: matchedCommand,
      success: exitCode === 0,
      exitCode,
      stdout: stdoutResult.text,
      stderr: stderrResult.text,
      timedOut,
      truncated,
      durationMs,
    };
  };
}
