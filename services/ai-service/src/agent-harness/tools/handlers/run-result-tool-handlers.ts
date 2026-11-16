import type { ApiGatewayHttpClient } from '../../../clients/api-gateway-http.client';
import type { ToolHandler } from '../tool-dispatcher';

export const READ_RUN_RESULT_TOOL_ID = 'read_run_result' as const;

/** RESULT-TOOL-01: the one text for every miss and every failure. */
export const RUN_RESULT_NOT_FOUND_MESSAGE = 'Run result not found.';

/** The gateway's run id rule (1 to 128 letters, digits, `_` or `-`). */
const RUN_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export interface RunResultToolHandlerDeps {
  readonly client: Pick<ApiGatewayHttpClient, 'readRunResult'>;
  /** The signed job's owner. Never taken from the tool arguments. */
  readonly userId: string;
  readonly maxToolResultBytes: number;
}

export interface RunResultFields {
  readonly runId: string;
  readonly status: 'completed';
  readonly finishedAt: string | null;
  readonly workflow: { readonly name: string; readonly testRun: boolean } | null;
  readonly answer: string;
  readonly truncated: boolean;
}

/**
 * Wraps a run result for the model as data. <, > and & inside the JSON are
 * written as JSON unicode escapes, so text an earlier run wrote cannot close
 * the tag or open a new one.
 */
export function wrapRunResult(result: RunResultFields): string {
  let json: string | undefined;
  try {
    json = JSON.stringify(result ?? null);
  } catch {
    json = undefined;
  }
  const safe = (json ?? 'null')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return `<run_result>${safe}</run_result>`;
}

/** Only the response fields of the stage-start (section 2); anything else is dropped. */
function pickRunResult(data: unknown, runId: string): RunResultFields | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }
  const record = data as Record<string, unknown>;
  if (record.runId !== runId || record.status !== 'completed') {
    return null;
  }
  if (typeof record.answer !== 'string' || typeof record.truncated !== 'boolean') {
    return null;
  }
  let finishedAt: string | null = null;
  if (typeof record.finishedAt === 'string') {
    finishedAt = record.finishedAt;
  } else if (record.finishedAt !== null) {
    return null;
  }
  let workflow: RunResultFields['workflow'] = null;
  if (record.workflow !== null) {
    const raw = record.workflow;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }
    const name = (raw as Record<string, unknown>).name;
    const testRun = (raw as Record<string, unknown>).testRun;
    if (typeof name !== 'string' || typeof testRun !== 'boolean') {
      return null;
    }
    workflow = { name, testRun };
  }
  return {
    runId,
    status: 'completed',
    finishedAt,
    workflow,
    answer: record.answer,
    truncated: record.truncated,
  };
}

function toolOutput(fields: RunResultFields): { tool: string; runResult: string } {
  return { tool: READ_RUN_RESULT_TOOL_ID, runResult: wrapRunResult(fields) };
}

function outputBytes(fields: RunResultFields): number {
  return Buffer.byteLength(JSON.stringify(toolOutput(fields)), 'utf8');
}

/**
 * Cuts the answer, by whole code points, until the whole tool output fits in
 * maxBytes as the dispatcher measures it. Sets truncated when anything is cut.
 * Null when not even an empty answer fits.
 */
function fitRunResult(fields: RunResultFields, maxBytes: number): RunResultFields | null {
  if (outputBytes(fields) <= maxBytes) {
    return fields;
  }
  const codePoints = Array.from(fields.answer);
  const withLength = (count: number): RunResultFields => ({
    ...fields,
    answer: codePoints.slice(0, count).join(''),
    truncated: true,
  });
  if (outputBytes(withLength(0)) > maxBytes) {
    return null;
  }
  let low = 0;
  let high = codePoints.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (outputBytes(withLength(mid)) <= maxBytes) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return withLength(low);
}

/**
 * RESULT-TOOL-01: read one of the owner's completed run results. userId comes
 * from the signed job, never from the tool arguments; only runId is passed on.
 * A bad id, a 404, a 400, a 401, a timeout, a network error and an unexpected
 * body all give the same fixed text, with no gateway text echoed. Nothing is
 * logged here.
 */
export function createReadRunResultHandler(deps: RunResultToolHandlerDeps): ToolHandler {
  return async (args: Readonly<Record<string, unknown>>, signal?: AbortSignal) => {
    const runId = args?.runId;
    if (typeof runId !== 'string' || !RUN_ID_PATTERN.test(runId)) {
      throw new Error(RUN_RESULT_NOT_FOUND_MESSAGE);
    }
    let data: unknown;
    try {
      data = await deps.client.readRunResult({ userId: deps.userId, runId }, signal);
    } catch {
      throw new Error(RUN_RESULT_NOT_FOUND_MESSAGE);
    }
    const picked = pickRunResult(data, runId);
    if (picked === null) {
      throw new Error(RUN_RESULT_NOT_FOUND_MESSAGE);
    }
    const fitted = fitRunResult(picked, deps.maxToolResultBytes);
    if (fitted === null) {
      throw new Error(RUN_RESULT_NOT_FOUND_MESSAGE);
    }
    return toolOutput(fitted);
  };
}
