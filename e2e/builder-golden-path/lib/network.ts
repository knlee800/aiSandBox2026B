import type { Page, Response } from '@playwright/test';

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
