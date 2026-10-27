import assert from 'node:assert/strict';
import { test } from 'node:test';

import { attemptProjectAutosave, createTrailingAutosaveScheduler } from './project-autosave';

async function withPatchedConsoleError<T>(run: () => Promise<T>): Promise<T> {
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    return await run();
  } finally {
    console.error = originalConsoleError;
  }
}

function createSnapshotResponse(): Response {
  return new Response(
    JSON.stringify({
      id: 'snapshot-1',
      userId: 'user-1',
      label: '[project-id:project-1]',
      createdAt: '2026-04-23T00:00:00.000Z',
      fileCount: 3,
    }),
    { status: 200 },
  );
}

test('returns skipped-rate-limited and does not call save when under the default interval', async () => {
  let callCount = 0;
  const fetchImpl = async (): Promise<Response> => {
    callCount += 1;
    return createSnapshotResponse();
  };

  const result = await attemptProjectAutosave({
    token: 'token-1',
    sessionId: 'session-1',
    projectId: 'project-1',
    now: 59_999,
    lastAutosaveAt: 0,
    fetchImpl: fetchImpl as typeof fetch,
  });

  assert.deepEqual(result, { status: 'skipped-rate-limited' });
  assert.equal(callCount, 0);
});

test('returns saved and calls save once with the source-plus-hint project-scoped snapshot label', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    return createSnapshotResponse();
  };

  const result = await attemptProjectAutosave({
    token: 'token-1',
    sessionId: 'session-1',
    projectId: 'project-1',
    source: 'preview',
    hint: 'index.html',
    now: 60_000,
    lastAutosaveAt: 0,
    fetchImpl: fetchImpl as typeof fetch,
  });

  assert.equal(result.status, 'saved');
  assert.deepEqual(result.savedSnapshot, {
    id: 'snapshot-1',
    userId: 'user-1',
    label: '[project-id:project-1]',
    createdAt: '2026-04-23T00:00:00.000Z',
    fileCount: 3,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/sessions/session-1/snapshot');
  assert.equal(calls[0].init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    label: '[project-id:project-1:source:preview:hint:index.html]',
  });
});

test('returns failed when save fetch rejects', async () => {
  const result = await withPatchedConsoleError(() =>
    attemptProjectAutosave({
      token: 'token-1',
      sessionId: 'session-1',
      projectId: 'project-1',
      now: 60_000,
      lastAutosaveAt: 0,
      fetchImpl: (async () => {
        throw new Error('network down');
      }) as typeof fetch,
    }),
  );

  assert.deepEqual(result, { status: 'failed' });
});

test('returns failed when save returns a non-ok response', async () => {
  const result = await withPatchedConsoleError(() =>
    attemptProjectAutosave({
      token: 'token-1',
      sessionId: 'session-1',
      projectId: 'project-1',
      now: 60_000,
      lastAutosaveAt: 0,
      fetchImpl: (async () =>
        new Response(JSON.stringify({ message: 'snapshot failed' }), {
          status: 500,
        })) as typeof fetch,
    }),
  );

  assert.deepEqual(result, { status: 'failed' });
});

test('honors a custom minIntervalMs override', async () => {
  let callCount = 0;
  const fetchImpl = async (): Promise<Response> => {
    callCount += 1;
    return createSnapshotResponse();
  };

  const skippedResult = await attemptProjectAutosave({
    token: 'token-1',
    sessionId: 'session-1',
    projectId: 'project-1',
    now: 9,
    lastAutosaveAt: 0,
    minIntervalMs: 10,
    fetchImpl: fetchImpl as typeof fetch,
  });

  const savedResult = await attemptProjectAutosave({
    token: 'token-1',
    sessionId: 'session-1',
    projectId: 'project-1',
    now: 10,
    lastAutosaveAt: 0,
    minIntervalMs: 10,
    fetchImpl: fetchImpl as typeof fetch,
  });

  assert.deepEqual(skippedResult, { status: 'skipped-rate-limited' });
  assert.equal(savedResult.status, 'saved');
  assert.equal(callCount, 1);
});

test('allows autosave when lastAutosaveAt is null', async () => {
  let callCount = 0;
  const fetchImpl = async (): Promise<Response> => {
    callCount += 1;
    return createSnapshotResponse();
  };

  const result = await attemptProjectAutosave({
    token: 'token-1',
    sessionId: 'session-1',
    projectId: 'project-1',
    now: 0,
    lastAutosaveAt: null,
    fetchImpl: fetchImpl as typeof fetch,
  });

  assert.equal(result.status, 'saved');
  assert.equal(callCount, 1);
});

test('saves when minIntervalMs is 0 even if the last autosave was one second ago', async () => {
  let callCount = 0;
  const fetchImpl = async (): Promise<Response> => {
    callCount += 1;
    return createSnapshotResponse();
  };

  const now = 1_000;
  const result = await attemptProjectAutosave({
    token: 'token-1',
    sessionId: 'session-1',
    projectId: 'project-1',
    source: 'revert',
    now,
    lastAutosaveAt: now - 1_000,
    minIntervalMs: 0,
    fetchImpl: fetchImpl as typeof fetch,
  });

  assert.equal(result.status, 'saved');
  assert.equal(callCount, 1);
  assert.equal(result.status === 'saved' && result.savedSnapshot.id, 'snapshot-1');
});

type FakeTimerEntry = {
  id: number;
  at: number;
  callback: () => void;
  cleared: boolean;
};

function createFakeTimers() {
  let now = 0;
  let nextId = 1;
  const entries: FakeTimerEntry[] = [];

  return {
    setTimeoutImpl(callback: () => void, delayMs: number) {
      const entry: FakeTimerEntry = {
        id: nextId,
        at: now + delayMs,
        callback,
        cleared: false,
      };
      nextId += 1;
      entries.push(entry);
      return entry.id;
    },
    clearTimeoutImpl(handle: unknown) {
      const entry = entries.find((candidate) => candidate.id === handle);
      if (entry) {
        entry.cleared = true;
      }
    },
    advance(ms: number) {
      now += ms;
      const due = entries
        .filter((entry) => !entry.cleared && entry.at <= now)
        .sort((left, right) => left.at - right.at || left.id - right.id);
      for (const entry of due) {
        if (entry.cleared) {
          continue;
        }
        entry.cleared = true;
        entry.callback();
      }
    },
  };
}

test('trailing scheduler runs the callback once after its delay', () => {
  const timers = createFakeTimers();
  const scheduler = createTrailingAutosaveScheduler({
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl,
  });
  const runs: string[] = [];

  scheduler.schedule(1_000, () => {
    runs.push('run');
  });

  assert.equal(scheduler.isPending(), true);
  timers.advance(999);
  assert.deepEqual(runs, []);
  timers.advance(1);
  assert.deepEqual(runs, ['run']);
  assert.equal(scheduler.isPending(), false);
  timers.advance(5_000);
  assert.deepEqual(runs, ['run']);
});

test('trailing scheduler replaces a pending run so only the latest runs', () => {
  const timers = createFakeTimers();
  const scheduler = createTrailingAutosaveScheduler({
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl,
  });
  const runs: string[] = [];

  scheduler.schedule(1_000, () => {
    runs.push('first');
  });
  scheduler.schedule(1_000, () => {
    runs.push('second');
  });

  assert.equal(scheduler.isPending(), true);
  timers.advance(1_000);
  assert.deepEqual(runs, ['second']);
  timers.advance(1_000);
  assert.deepEqual(runs, ['second']);
  assert.equal(scheduler.isPending(), false);
});

test('trailing scheduler cancel prevents the pending run', () => {
  const timers = createFakeTimers();
  const scheduler = createTrailingAutosaveScheduler({
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl,
  });
  let runs = 0;

  scheduler.schedule(1_000, () => {
    runs += 1;
  });
  scheduler.cancel();

  assert.equal(scheduler.isPending(), false);
  timers.advance(1_000);
  assert.equal(runs, 0);
});
