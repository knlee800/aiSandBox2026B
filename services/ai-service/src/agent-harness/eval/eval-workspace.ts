import type { ApiGatewayHttpClient } from '../../clients/api-gateway-http.client';
import {
  contentChecksHold,
  type EvalContentCheck,
  type EvalDeleteAttempt,
  type EvalMutationAttempt,
  type EvalValidationRun,
  type EvalWriteAttempt,
  normalizeEvalPath,
} from './eval-types';

const SEARCH_RESULT_CAP = 50;

export interface WorkspaceDirectoryEntry {
  name: string;
  type: 'file' | 'dir';
  size: number;
  modifiedAt: string;
}

/**
 * The six workspace methods the file and validation handlers call.
 * A later live run can pass ApiGatewayHttpClient here; it already has these methods.
 */
export interface EvalWorkspaceClient {
  readWorkspaceFile(
    sessionId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<{ path: string; content: string }>;
  listWorkspaceDirectory(
    sessionId: string,
    path?: string,
    signal?: AbortSignal,
  ): Promise<{ path: string; entries: WorkspaceDirectoryEntry[] }>;
  searchWorkspace(
    sessionId: string,
    query: string,
    signal?: AbortSignal,
  ): Promise<{
    query: string;
    results: Array<{ path: string; line: number; preview: string }>;
    truncated: boolean;
  }>;
  writeWorkspaceFile(
    sessionId: string,
    path: string,
    content: string,
    signal?: AbortSignal,
  ): Promise<void>;
  deleteWorkspaceFile(
    sessionId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<void>;
  runWorkspaceValidation(
    sessionId: string,
    command: string,
    timeoutMs?: number,
    signal?: AbortSignal,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

export interface EvalObservation {
  readonly attempts: EvalMutationAttempt[];
  readonly validationRuns: EvalValidationRun[];
}

/**
 * In-memory stand-in for ApiGatewayHttpClient.
 *
 * ApiGatewayHttpClient is a class, so this object is not assignable to the
 * handlers' deps.client parameter. asApiGatewayClient narrows that with a cast.
 * The handlers only call the six methods above.
 *
 * This object applies every write and delete that reaches it, including .env
 * and paths outside the workspace, and records each attempt. It does not
 * enforce safety policy. The scorer reads the attempt log. It does not run
 * npm: runWorkspaceValidation returns exit 0 when every content check holds.
 */
export class EvalWorkspace implements EvalWorkspaceClient {
  private readonly files = new Map<string, string>();
  private readonly attempts: EvalMutationAttempt[] = [];
  private readonly validationRunLog: EvalValidationRun[] = [];

  constructor(
    initialFiles: Readonly<Record<string, string>>,
    private readonly contentChecks: readonly EvalContentCheck[] = [],
  ) {
    for (const [filePath, content] of Object.entries(initialFiles)) {
      this.files.set(normalizeEvalPath(filePath), content);
    }
  }

  get mutationAttempts(): readonly EvalMutationAttempt[] {
    return this.attempts;
  }

  get validationRuns(): readonly EvalValidationRun[] {
    return this.validationRunLog;
  }

  snapshot(): Readonly<Record<string, string>> {
    return Object.fromEntries(this.files.entries());
  }

  async readWorkspaceFile(
    _sessionId: string,
    filePath: string,
    signal?: AbortSignal,
  ): Promise<{ path: string; content: string }> {
    this.throwIfAborted(signal);
    const key = normalizeEvalPath(filePath);
    const content = this.files.get(key);
    if (content === undefined) {
      throw new Error(`file not found: ${key}`);
    }
    return { path: key, content };
  }

  async listWorkspaceDirectory(
    _sessionId: string,
    filePath: string = '/',
    signal?: AbortSignal,
  ): Promise<{ path: string; entries: WorkspaceDirectoryEntry[] }> {
    this.throwIfAborted(signal);
    const key = normalizeDirectoryPath(filePath);
    if (key !== '' && this.files.has(key)) {
      throw new Error(`not a directory: ${key}`);
    }
    const prefix = key === '' ? '' : `${key}/`;
    if (key !== '' && !this.hasDirectory(prefix)) {
      throw new Error(`directory not found: ${key}`);
    }

    const names = new Map<string, 'file' | 'dir'>();
    for (const fileKey of this.files.keys()) {
      if (prefix !== '' && !fileKey.startsWith(prefix)) {
        continue;
      }
      const rest = prefix === '' ? fileKey : fileKey.slice(prefix.length);
      if (rest.length === 0) {
        continue;
      }
      const slash = rest.indexOf('/');
      if (slash === -1) {
        names.set(rest, 'file');
      } else {
        names.set(rest.slice(0, slash), 'dir');
      }
    }

    const entries = [...names.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([name, type]) => ({
        name,
        type,
        size:
          type === 'file'
            ? Buffer.byteLength(this.files.get(`${prefix}${name}`) ?? '', 'utf8')
            : 0,
        modifiedAt: '1970-01-01T00:00:00.000Z',
      }));

    return { path: key === '' ? '/' : key, entries };
  }

  async searchWorkspace(
    _sessionId: string,
    query: string,
    signal?: AbortSignal,
  ): Promise<{
    query: string;
    results: Array<{ path: string; line: number; preview: string }>;
    truncated: boolean;
  }> {
    this.throwIfAborted(signal);
    const results: Array<{ path: string; line: number; preview: string }> = [];
    let truncated = false;
    const paths = [...this.files.keys()].sort();
    for (const filePath of paths) {
      const lines = (this.files.get(filePath) ?? '').split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        if (!lines[index].includes(query)) {
          continue;
        }
        if (results.length >= SEARCH_RESULT_CAP) {
          truncated = true;
          return { query, results, truncated };
        }
        results.push({
          path: filePath,
          line: index + 1,
          preview: lines[index].slice(0, 240),
        });
      }
    }
    return { query, results, truncated };
  }

  async writeWorkspaceFile(
    _sessionId: string,
    filePath: string,
    content: string,
    signal?: AbortSignal,
  ): Promise<void> {
    this.throwIfAborted(signal);
    const attempt: EvalWriteAttempt = {
      op: 'write',
      path: filePath,
      content,
      succeeded: false,
    };
    this.attempts.push(attempt);
    this.files.set(normalizeEvalPath(filePath), content);
    attempt.succeeded = true;
  }

  async deleteWorkspaceFile(
    _sessionId: string,
    filePath: string,
    signal?: AbortSignal,
  ): Promise<void> {
    this.throwIfAborted(signal);
    const attempt: EvalDeleteAttempt = {
      op: 'delete',
      path: filePath,
      succeeded: false,
    };
    this.attempts.push(attempt);
    const key = normalizeEvalPath(filePath);
    if (!this.files.has(key)) {
      throw new Error(`file not found: ${key}`);
    }
    this.files.delete(key);
    attempt.succeeded = true;
  }

  async runWorkspaceValidation(
    _sessionId: string,
    command: string,
    _timeoutMs: number = 120_000,
    signal?: AbortSignal,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    this.throwIfAborted(signal);
    const holds = contentChecksHold(this.files, this.contentChecks);
    const result = holds
      ? { exitCode: 0, stdout: 'validation passed', stderr: '' }
      : {
          exitCode: 1,
          stdout: '',
          stderr: 'validation failed: content checks do not hold',
        };
    this.validationRunLog.push({ command, exitCode: result.exitCode });
    return result;
  }

  private hasDirectory(prefix: string): boolean {
    for (const fileKey of this.files.keys()) {
      if (fileKey.startsWith(prefix)) {
        return true;
      }
    }
    return false;
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      throw error;
    }
  }
}

/**
 * Records writes, deletes, and validation results for any client, including
 * one supplied later for a live run. Scoring reads this log plus the task's
 * initial files, so it does not depend on listing a remote workspace.
 */
export function observeWorkspaceClient(inner: EvalWorkspaceClient): {
  client: EvalWorkspaceClient;
  observation: EvalObservation;
} {
  const observation: EvalObservation = { attempts: [], validationRuns: [] };
  const client: EvalWorkspaceClient = {
    readWorkspaceFile: (sessionId, filePath, signal) =>
      inner.readWorkspaceFile(sessionId, filePath, signal),
    listWorkspaceDirectory: (sessionId, filePath, signal) =>
      inner.listWorkspaceDirectory(sessionId, filePath, signal),
    searchWorkspace: (sessionId, query, signal) =>
      inner.searchWorkspace(sessionId, query, signal),
    writeWorkspaceFile: async (sessionId, filePath, content, signal) => {
      const attempt: EvalWriteAttempt = {
        op: 'write',
        path: filePath,
        content,
        succeeded: false,
      };
      observation.attempts.push(attempt);
      await inner.writeWorkspaceFile(sessionId, filePath, content, signal);
      attempt.succeeded = true;
    },
    deleteWorkspaceFile: async (sessionId, filePath, signal) => {
      const attempt: EvalDeleteAttempt = {
        op: 'delete',
        path: filePath,
        succeeded: false,
      };
      observation.attempts.push(attempt);
      await inner.deleteWorkspaceFile(sessionId, filePath, signal);
      attempt.succeeded = true;
    },
    runWorkspaceValidation: async (sessionId, command, timeoutMs, signal) => {
      const result = await inner.runWorkspaceValidation(
        sessionId,
        command,
        timeoutMs,
        signal,
      );
      observation.validationRuns.push({
        command,
        exitCode: result.exitCode,
      });
      return result;
    },
  };
  return { client, observation };
}

export function asApiGatewayClient(
  client: EvalWorkspaceClient,
): ApiGatewayHttpClient {
  return client as unknown as ApiGatewayHttpClient;
}

function normalizeDirectoryPath(filePath: string): string {
  const key = normalizeEvalPath(filePath);
  if (key === '/' || key === '.') {
    return '';
  }
  return key;
}
