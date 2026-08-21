import type { Page, Response } from '@playwright/test';
import { SESSION_CREATE_TIMEOUT_MS } from './constants';

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
