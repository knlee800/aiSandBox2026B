import type { Page, Response } from '@playwright/test';
import { AUTO_APPLY_TIMEOUT_MS, SESSION_CREATE_TIMEOUT_MS } from './constants';

export const PUBLIC_CONFIRM_PATH_PATTERN =
  /\/api\/ai\/executions\/([^/?#]+)\/confirm-build-apply\/?$/;

export const INTERNAL_CONFIRM_PATH_PATTERN =
  /\/api\/internal\/executions\/[^/?#]+\/confirm-build-apply\/?$/;

export interface ConfirmBuildApplyCapture {
  url: string;
  status: number;
  body: unknown;
  executionId: string | null;
}

export interface ConfirmListener {
  captures: ConfirmBuildApplyCapture[];
  first(): ConfirmBuildApplyCapture | undefined;
  waitForFirst(timeoutMs?: number): Promise<ConfirmBuildApplyCapture>;
  dispose(): Promise<void>;
}

export class ConfirmObservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfirmObservationError';
  }
}

export function isPublicConfirmBuildApplyUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'http://localhost');
    return (
      PUBLIC_CONFIRM_PATH_PATTERN.test(parsed.pathname) &&
      !INTERNAL_CONFIRM_PATH_PATTERN.test(parsed.pathname)
    );
  } catch {
    return PUBLIC_CONFIRM_PATH_PATTERN.test(url);
  }
}

export function extractExecutionIdFromConfirmUrl(url: string): string | null {
  try {
    const pathname = new URL(url, 'http://localhost').pathname;
    const match = pathname.match(PUBLIC_CONFIRM_PATH_PATTERN);
    return match?.[1] ?? null;
  } catch {
    const match = url.match(PUBLIC_CONFIRM_PATH_PATTERN);
    return match?.[1] ?? null;
  }
}

export function parseConfirmBody(raw: unknown): {
  triggered: boolean;
  reason: string;
} {
  const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    triggered: body.triggered === true,
    reason: typeof body.reason === 'string' ? body.reason : '',
  };
}

export function validateLiveConfirmResponse(
  capture: ConfirmBuildApplyCapture,
): void {
  if (!isPublicConfirmBuildApplyUrl(capture.url)) {
    throw new ConfirmObservationError(
      `Confirm request was not the public 03J route: ${capture.url}`,
    );
  }
  if (capture.status !== 200) {
    throw new ConfirmObservationError(
      `Public confirm-build-apply HTTP ${capture.status}, expected 200.`,
    );
  }
  const parsed = parseConfirmBody(capture.body);
  if (parsed.triggered !== true) {
    throw new ConfirmObservationError(
      `Public confirm-build-apply triggered=${String(parsed.triggered)}, expected true.`,
    );
  }
  if (parsed.reason !== 'completed') {
    throw new ConfirmObservationError(
      `Public confirm-build-apply reason=${JSON.stringify(parsed.reason)}, expected "completed".`,
    );
  }
}

export async function armConfirmBuildApplyListener(
  page: Page,
): Promise<ConfirmListener> {
  const captures: ConfirmBuildApplyCapture[] = [];
  const waiters: Array<(capture: ConfirmBuildApplyCapture) => void> = [];

  const onResponse = async (response: Response): Promise<void> => {
    if (response.request().method() !== 'POST') {
      return;
    }
    if (!isPublicConfirmBuildApplyUrl(response.url())) {
      return;
    }
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = await response.text().catch(() => null);
    }
    const capture: ConfirmBuildApplyCapture = {
      url: response.url(),
      status: response.status(),
      body,
      executionId: extractExecutionIdFromConfirmUrl(response.url()),
    };
    captures.push(capture);
    const waiter = waiters.shift();
    waiter?.(capture);
  };

  page.on('response', onResponse);

  return {
    captures,
    first() {
      return captures[0];
    },
    waitForFirst(timeoutMs = 60_000) {
      if (captures[0]) {
        return Promise.resolve(captures[0]);
      }
      return new Promise<ConfirmBuildApplyCapture>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(
            new ConfirmObservationError(
              'Timed out waiting for POST /api/ai/executions/:executionId/confirm-build-apply.',
            ),
          );
        }, timeoutMs);
        waiters.push((capture) => {
          clearTimeout(timer);
          resolve(capture);
        });
      });
    },
    async dispose() {
      page.off('response', onResponse);
    },
  };
}

export const SESSION_CREATE_PATH_PATTERN = /\/api\/sessions\/?$/;

export interface SessionCreateCapture {
  url: string;
  status: number;
  body: unknown;
  sessionId: string | null;
}

export interface SessionCreateListener {
  captures: SessionCreateCapture[];
  hasObserved(): boolean;
  first(): SessionCreateCapture | undefined;
  waitForFirst(timeoutMs?: number): Promise<SessionCreateCapture>;
  dispose(): Promise<void>;
}

export class SessionObservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionObservationError';
  }
}

export class ProjectCreateObservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectCreateObservationError';
  }
}

export interface ProjectCreateBody {
  id?: string;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Playwright issues response-body reads with no timeout at all, so neither the
 * config `actionTimeout` nor a per-call option can bound `Response.json()`.
 * The bound therefore has to be owned by the runner.
 */
export async function readProjectCreateBody(
  response: Pick<Response, 'json'>,
  timeoutMs: number,
): Promise<ProjectCreateBody> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const read = response.json().then(
    (value: unknown) => ({ outcome: 'read' as const, value }),
    (error: unknown) => ({ outcome: 'failed' as const, error }),
  );
  const expiry = new Promise<{ outcome: 'timeout' }>((resolve) => {
    timer = setTimeout(() => resolve({ outcome: 'timeout' }), timeoutMs);
  });
  try {
    const result = await Promise.race([read, expiry]);
    if (result.outcome === 'timeout') {
      throw new ProjectCreateObservationError(
        `Timed out after ${timeoutMs}ms reading the project-create response body.`,
      );
    }
    if (result.outcome === 'failed') {
      throw new ProjectCreateObservationError(
        `Could not read the project-create response body: ${describeError(result.error)}`,
      );
    }
    return (result.value ?? {}) as ProjectCreateBody;
  } finally {
    clearTimeout(timer);
  }
}

export function projectCreateObservationTimeout(
  timeoutMs: number,
  error: unknown,
): ProjectCreateObservationError {
  return new ProjectCreateObservationError(
    `Did not observe an ok project-create response within ${timeoutMs}ms: ${describeError(error)}`,
  );
}

export function isSessionCreateUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'http://localhost');
    return SESSION_CREATE_PATH_PATTERN.test(parsed.pathname);
  } catch {
    return SESSION_CREATE_PATH_PATTERN.test(url);
  }
}

export function extractSessionIdFromCreateBody(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const id = (raw as { id?: unknown }).id;
  return typeof id === 'string' && id.trim().length > 0 ? id : null;
}

export async function armSessionCreateListener(
  page: Page,
): Promise<SessionCreateListener> {
  const captures: SessionCreateCapture[] = [];
  const waiters: Array<(capture: SessionCreateCapture) => void> = [];
  let observed = false;

  const onResponse = (response: Response): void => {
    if (response.request().method() !== 'POST') {
      return;
    }
    if (!isSessionCreateUrl(response.url())) {
      return;
    }
    if (!response.ok()) {
      return;
    }
    observed = true;
    void (async () => {
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = await response.text().catch(() => null);
      }
      const capture: SessionCreateCapture = {
        url: response.url(),
        status: response.status(),
        body,
        sessionId: extractSessionIdFromCreateBody(body),
      };
      captures.push(capture);
      const waiter = waiters.shift();
      waiter?.(capture);
    })();
  };

  page.on('response', onResponse);

  return {
    captures,
    hasObserved() {
      return observed;
    },
    first() {
      return captures[0];
    },
    waitForFirst(timeoutMs = SESSION_CREATE_TIMEOUT_MS) {
      if (captures[0]) {
        return Promise.resolve(captures[0]);
      }
      return new Promise<SessionCreateCapture>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout>;
        const onCapture = (capture: SessionCreateCapture): void => {
          clearTimeout(timer);
          resolve(capture);
        };
        timer = setTimeout(() => {
          const index = waiters.indexOf(onCapture);
          if (index >= 0) {
            waiters.splice(index, 1);
          }
          reject(
            new SessionObservationError(
              `Timed out waiting for POST /api/sessions after ${timeoutMs}ms.`,
            ),
          );
        }, timeoutMs);
        waiters.push(onCapture);
      });
    },
    async dispose() {
      page.off('response', onResponse);
    },
  };
}

export const SESSION_FILE_WRITE_PATH_PATTERN =
  /\/api\/sessions\/([^/?#]+)\/files\/write\/?$/;

export interface FileWriteCapture {
  url: string;
  status: number;
  sessionId: string | null;
  path: string | null;
  malformed: boolean;
  observedAt: number;
}

export interface FileWriteWaitInput {
  sessionId: string;
  path: string;
  timeoutMs?: number;
}

export interface FileWriteListener {
  captures: FileWriteCapture[];
  waitForMatchingWrite(input: FileWriteWaitInput): Promise<FileWriteCapture>;
  dispose(): Promise<void>;
}

export class AutoApplyObservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AutoApplyObservationError';
  }
}

export const AI_EXECUTE_PATH_PATTERN = /\/api\/ai\/execute\/?$/;

export class BuildExecutionObservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BuildExecutionObservationError';
  }
}

export function isAiExecuteUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'http://localhost');
    return AI_EXECUTE_PATH_PATTERN.test(parsed.pathname);
  } catch {
    return AI_EXECUTE_PATH_PATTERN.test(url);
  }
}

export function extractExecutionIdFromExecuteBody(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const value = (raw as { executionId?: unknown }).executionId;
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function parseBuildExecutionId(raw: unknown): string {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BuildExecutionObservationError(
      'POST /api/ai/execute 202 JSON was malformed.',
    );
  }
  const value = (raw as { executionId?: unknown }).executionId;
  if (value === undefined) {
    throw new BuildExecutionObservationError(
      'POST /api/ai/execute 202 JSON did not include executionId.',
    );
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BuildExecutionObservationError(
      'POST /api/ai/execute 202 JSON executionId was empty.',
    );
  }
  return value;
}

/**
 * Playwright issues response-body reads with no timeout at all, so neither the
 * config `actionTimeout` nor a per-call option can bound `Response.json()`.
 * The bound therefore has to be owned by the runner.
 */
export async function readBuildExecutionBody(
  response: Pick<Response, 'json'>,
  timeoutMs: number,
): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const read = response.json().then(
    (value: unknown) => ({ outcome: 'read' as const, value }),
    (error: unknown) => ({ outcome: 'failed' as const, error }),
  );
  const expiry = new Promise<{ outcome: 'timeout' }>((resolve) => {
    timer = setTimeout(() => resolve({ outcome: 'timeout' }), timeoutMs);
  });
  try {
    const result = await Promise.race([read, expiry]);
    if (result.outcome === 'timeout') {
      throw new BuildExecutionObservationError(
        `Timed out after ${timeoutMs}ms reading the POST /api/ai/execute response body.`,
      );
    }
    if (result.outcome === 'failed') {
      throw new BuildExecutionObservationError(
        `Could not read the POST /api/ai/execute response body: ${describeError(result.error)}`,
      );
    }
    return result.value;
  } finally {
    clearTimeout(timer);
  }
}

export function buildExecutionObservationTimeout(
  timeoutMs: number,
  error: unknown,
): BuildExecutionObservationError {
  return new BuildExecutionObservationError(
    `Did not observe POST /api/ai/execute within ${timeoutMs}ms: ${describeError(error)}`,
  );
}

export function isSessionFileWriteUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'http://localhost');
    return SESSION_FILE_WRITE_PATH_PATTERN.test(parsed.pathname);
  } catch {
    return SESSION_FILE_WRITE_PATH_PATTERN.test(url);
  }
}

export function extractSessionIdFromFileWriteUrl(url: string): string | null {
  try {
    const pathname = new URL(url, 'http://localhost').pathname;
    const match = pathname.match(SESSION_FILE_WRITE_PATH_PATTERN);
    return match?.[1] ?? null;
  } catch {
    const match = url.match(SESSION_FILE_WRITE_PATH_PATTERN);
    return match?.[1] ?? null;
  }
}

export function inspectFileWriteRequestBody(raw: string | null): {
  malformed: boolean;
  path: string | null;
} {
  if (raw == null || raw.trim().length === 0) {
    return { malformed: true, path: null };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { malformed: true, path: null };
    }
    const pathValue = (parsed as { path?: unknown }).path;
    if (pathValue === undefined) {
      return { malformed: false, path: null };
    }
    if (typeof pathValue !== 'string') {
      return { malformed: true, path: null };
    }
    return { malformed: false, path: pathValue };
  } catch {
    return { malformed: true, path: null };
  }
}

type FileWriteWaiter = {
  sessionId: string;
  path: string;
  resolve: (capture: FileWriteCapture) => void;
  reject: (error: AutoApplyObservationError) => void;
};

type FileWriteClassification =
  | { kind: 'success'; capture: FileWriteCapture }
  | { kind: 'failed-write'; capture: FileWriteCapture }
  | { kind: 'malformed'; capture: FileWriteCapture }
  | { kind: 'pending' };

function classifyFileWriteCaptures(
  captures: readonly FileWriteCapture[],
  sessionId: string,
  path: string,
): FileWriteClassification {
  const relevant = captures.filter((capture) => capture.sessionId === sessionId);
  const success = relevant.find(
    (capture) => !capture.malformed && capture.path === path && capture.status === 204,
  );
  if (success) {
    return { kind: 'success', capture: success };
  }
  const failed = relevant.find(
    (capture) => !capture.malformed && capture.path === path && capture.status !== 204,
  );
  if (failed) {
    return { kind: 'failed-write', capture: failed };
  }
  const malformed = relevant.find((capture) => capture.malformed);
  if (malformed) {
    return { kind: 'malformed', capture: malformed };
  }
  return { kind: 'pending' };
}

function fileWriteClassificationError(
  classification: Exclude<FileWriteClassification, { kind: 'pending' } | { kind: 'success' }>,
): AutoApplyObservationError {
  if (classification.kind === 'failed-write') {
    return new AutoApplyObservationError(
      `File write HTTP ${classification.capture.status}, expected 204.`,
    );
  }
  return new AutoApplyObservationError('File write request JSON was malformed.');
}

export async function armFileWriteListener(page: Page): Promise<FileWriteListener> {
  const captures: FileWriteCapture[] = [];
  const waiters: FileWriteWaiter[] = [];
  let disposed = false;

  const settleWaiters = (): void => {
    for (const waiter of [...waiters]) {
      const classification = classifyFileWriteCaptures(
        captures,
        waiter.sessionId,
        waiter.path,
      );
      if (classification.kind === 'pending') {
        continue;
      }
      const index = waiters.indexOf(waiter);
      if (index >= 0) {
        waiters.splice(index, 1);
      }
      if (classification.kind === 'success') {
        waiter.resolve(classification.capture);
      } else {
        waiter.reject(fileWriteClassificationError(classification));
      }
    }
  };

  const onResponse = (response: Response): void => {
    if (disposed) {
      return;
    }
    if (response.request().method() !== 'POST') {
      return;
    }
    if (!isSessionFileWriteUrl(response.url())) {
      return;
    }
    const inspected = inspectFileWriteRequestBody(response.request().postData());
    captures.push({
      url: response.url(),
      status: response.status(),
      sessionId: extractSessionIdFromFileWriteUrl(response.url()),
      path: inspected.path,
      malformed: inspected.malformed,
      observedAt: Date.now(),
    });
    settleWaiters();
  };

  page.on('response', onResponse);

  return {
    captures,
    waitForMatchingWrite(input) {
      if (disposed) {
        return Promise.reject(
          new AutoApplyObservationError('File-write listener was disposed.'),
        );
      }
      const timeoutMs = input.timeoutMs ?? AUTO_APPLY_TIMEOUT_MS;
      const classification = classifyFileWriteCaptures(
        captures,
        input.sessionId,
        input.path,
      );
      if (classification.kind === 'success') {
        return Promise.resolve(classification.capture);
      }
      if (classification.kind !== 'pending') {
        return Promise.reject(fileWriteClassificationError(classification));
      }
      return new Promise<FileWriteCapture>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout>;
        const waiter: FileWriteWaiter = {
          sessionId: input.sessionId,
          path: input.path,
          resolve: (capture) => {
            clearTimeout(timer);
            resolve(capture);
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          },
        };
        timer = setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index >= 0) {
            waiters.splice(index, 1);
          }
          reject(
            new AutoApplyObservationError(
              `Timed out waiting for POST /api/sessions/:sessionId/files/write of ${input.path} after ${timeoutMs}ms.`,
            ),
          );
        }, timeoutMs);
        waiters.push(waiter);
      });
    },
    async dispose() {
      disposed = true;
      page.off('response', onResponse);
      const pending = waiters.splice(0, waiters.length);
      for (const waiter of pending) {
        waiter.reject(
          new AutoApplyObservationError('File-write listener was disposed.'),
        );
      }
    },
  };
}
