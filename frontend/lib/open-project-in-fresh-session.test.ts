import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { openProjectInFreshSession } from './open-project-in-fresh-session';

function createDeferredResponse(): {
  promise: Promise<Response>;
  resolve: (response: Response) => void;
} {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

describe('open-project-in-fresh-session', () => {
  test('reuses an existing usable session for the same project and skips session creation', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init });

      if (url === '/api/users/me/snapshots') {
        return new Response(
          JSON.stringify([
            {
              id: 'snapshot-1',
              userId: 'user-1',
              label: '[project-id:project-1]',
              createdAt: '2026-04-09T12:00:00.000Z',
              fileCount: 1,
            },
          ]),
          { status: 200 },
        );
      }

      if (url === '/api/projects/project-1/open') {
        return new Response(
          JSON.stringify({
            projectId: 'project-1',
            sessionId: 'session-existing-1',
            restoredSnapshotId: 'snapshot-1',
          }),
          { status: 200 },
        );
      }

      throw new Error(`Unexpected url: ${url}`);
    };

    const result = await openProjectInFreshSession({
      projectId: 'project-1',
      existingSessions: [
        {
          id: 'session-existing-1',
          projectId: 'project-1',
          status: 'active',
          expiresAt: '2999-04-09T12:00:00.000Z',
          terminatedAt: null,
          terminationReason: null,
        },
      ],
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.deepEqual(
      calls.map((call) => call.url),
      ['/api/users/me/snapshots', '/api/projects/project-1/open'],
    );
    assert.deepEqual(JSON.parse(String(calls[1].init?.body)), {
      sessionId: 'session-existing-1',
      snapshotId: 'snapshot-1',
    });
    assert.deepEqual(result, {
      projectId: 'project-1',
      sessionId: 'session-existing-1',
      restoredSnapshotId: 'snapshot-1',
    });
  });

  test('creates one session and opens the project with the new session id', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init });

      if (url === '/api/users/me/snapshots') {
        return new Response(
          JSON.stringify([
            {
              id: 'snapshot-1',
              userId: 'user-1',
              label: '[project-id:project-1]',
              createdAt: '2026-04-09T12:00:00.000Z',
              fileCount: 1,
            },
          ]),
          { status: 200 },
        );
      }

      if (url === '/api/sessions') {
        return new Response(JSON.stringify({ id: 'session-fresh-1' }), { status: 201 });
      }

      if (url === '/api/projects/project-1/open') {
        return new Response(
          JSON.stringify({
            projectId: 'project-1',
            sessionId: 'session-fresh-1',
            restoredSnapshotId: 'snapshot-1',
          }),
          { status: 200 },
        );
      }

      throw new Error(`Unexpected url: ${url}`);
    };

    const result = await openProjectInFreshSession({
      projectId: 'project-1',
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(calls.length, 3);
    assert.equal(calls[0].url, '/api/users/me/snapshots');
    assert.equal(calls[1].url, '/api/sessions');
    assert.equal(calls[2].url, '/api/projects/project-1/open');
    assert.deepEqual(JSON.parse(String(calls[2].init?.body)), {
      sessionId: 'session-fresh-1',
      snapshotId: 'snapshot-1',
    });
    assert.deepEqual(result, {
      projectId: 'project-1',
      sessionId: 'session-fresh-1',
      restoredSnapshotId: 'snapshot-1',
    });
  });

  test('uses the associate path when no project snapshot exists', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init });

      if (url === '/api/users/me/snapshots') {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      if (url === '/api/sessions') {
        return new Response(JSON.stringify({ id: 'session-fresh-2' }), { status: 201 });
      }

      if (url === '/api/projects/project-1/sessions/session-fresh-2') {
        return new Response(
          JSON.stringify({
            id: 'project-1',
            userId: 'user-1',
            name: 'Main Project',
            visibility: 'private',
            createdAt: '2026-04-09T12:00:00.000Z',
            updatedAt: '2026-04-09T12:00:00.000Z',
          }),
          { status: 200 },
        );
      }

      throw new Error(`Unexpected url: ${url}`);
    };

    const result = await openProjectInFreshSession({
      projectId: 'project-1',
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(calls.length, 3);
    assert.equal(calls[0].url, '/api/users/me/snapshots');
    assert.equal(calls[1].url, '/api/sessions');
    assert.equal(calls[2].url, '/api/projects/project-1/sessions/session-fresh-2');
    assert.deepEqual(result, {
      projectId: 'project-1',
      sessionId: 'session-fresh-2',
      restoredSnapshotId: null,
    });
  });

  test('creates a fresh session when no usable same-project session exists', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init });

      if (url === '/api/users/me/snapshots') {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      if (url === '/api/sessions') {
        return new Response(JSON.stringify({ id: 'session-fresh-6' }), { status: 201 });
      }

      if (url === '/api/projects/project-1/sessions/session-fresh-6') {
        return new Response(
          JSON.stringify({
            id: 'project-1',
            userId: 'user-1',
            name: 'Main Project',
            visibility: 'private',
            createdAt: '2026-04-09T12:00:00.000Z',
            updatedAt: '2026-04-09T12:00:00.000Z',
          }),
          { status: 200 },
        );
      }

      throw new Error(`Unexpected url: ${url}`);
    };

    const result = await openProjectInFreshSession({
      projectId: 'project-1',
      existingSessions: [
        {
          id: 'session-other-project',
          projectId: 'project-2',
          status: 'active',
          expiresAt: '2999-04-09T12:00:00.000Z',
          terminatedAt: null,
          terminationReason: null,
        },
        {
          id: 'session-terminated',
          projectId: 'project-1',
          status: 'active',
          expiresAt: '2999-04-09T12:00:00.000Z',
          terminatedAt: '2026-04-09T12:00:00.000Z',
          terminationReason: 'manual',
        },
      ],
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.deepEqual(
      calls.map((call) => call.url),
      [
        '/api/users/me/snapshots',
        '/api/sessions',
        '/api/projects/project-1/sessions/session-fresh-6',
      ],
    );
    assert.deepEqual(result, {
      projectId: 'project-1',
      sessionId: 'session-fresh-6',
      restoredSnapshotId: null,
    });
  });

  test('awaits the full open sequence with no fire-and-forget open call', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const openDeferred = createDeferredResponse();
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init });

      if (url === '/api/users/me/snapshots') {
        return new Response(
          JSON.stringify([
            {
              id: 'snapshot-1',
              userId: 'user-1',
              label: '[project-id:project-1]',
              createdAt: '2026-04-09T12:00:00.000Z',
              fileCount: 1,
            },
          ]),
          { status: 200 },
        );
      }

      if (url === '/api/sessions') {
        return new Response(JSON.stringify({ id: 'session-fresh-3' }), { status: 201 });
      }

      if (url === '/api/projects/project-1/open') {
        return openDeferred.promise;
      }

      throw new Error(`Unexpected url: ${url}`);
    };

    let resolved = false;
    const openPromise = openProjectInFreshSession({
      projectId: 'project-1',
      fetchImpl: fetchImpl as typeof fetch,
    }).then(() => {
      resolved = true;
    });

    for (let attempt = 0; attempt < 5 && calls.length < 3; attempt += 1) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }

    assert.equal(calls.length, 3);
    assert.equal(resolved, false);

    openDeferred.resolve(
      new Response(
        JSON.stringify({
          projectId: 'project-1',
          sessionId: 'session-fresh-3',
          restoredSnapshotId: 'snapshot-1',
        }),
        { status: 200 },
      ),
    );

    await openPromise;
    assert.equal(resolved, true);
  });

  test('throws on session-create failure before calling the project-open path', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init });

      if (url === '/api/users/me/snapshots') {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      if (url === '/api/sessions') {
        return new Response(JSON.stringify({ message: 'quota blocked' }), { status: 403 });
      }

      throw new Error(`Unexpected url: ${url}`);
    };

    await assert.rejects(
      () =>
        openProjectInFreshSession({
          projectId: 'project-1',
          fetchImpl: fetchImpl as typeof fetch,
        }),
      /Session creation blocked by quota limits \(403\)\./,
    );

    assert.deepEqual(
      calls.map((call) => call.url),
      ['/api/users/me/snapshots', '/api/sessions'],
    );
  });

  test('throws an identifiable error when the project-open call fails', async () => {
    const fetchImpl = async (url: string): Promise<Response> => {
      if (url === '/api/users/me/snapshots') {
        return new Response(
          JSON.stringify([
            {
              id: 'snapshot-1',
              userId: 'user-1',
              label: '[project-id:project-1]',
              createdAt: '2026-04-09T12:00:00.000Z',
              fileCount: 1,
            },
          ]),
          { status: 200 },
        );
      }

      if (url === '/api/sessions') {
        return new Response(JSON.stringify({ id: 'session-fresh-4' }), { status: 201 });
      }

      if (url === '/api/projects/project-1/open') {
        return new Response(JSON.stringify({ message: 'open failed for test' }), { status: 500 });
      }

      throw new Error(`Unexpected url: ${url}`);
    };

    await assert.rejects(
      () =>
        openProjectInFreshSession({
          projectId: 'project-1',
          fetchImpl: fetchImpl as typeof fetch,
        }),
      /open failed for test/,
    );
  });

  test('skips snapshot lookup when an explicit snapshot id is provided', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init });

      if (url === '/api/sessions') {
        return new Response(JSON.stringify({ id: 'session-fresh-5' }), { status: 201 });
      }

      if (url === '/api/projects/project-1/open') {
        return new Response(
          JSON.stringify({
            projectId: 'project-1',
            sessionId: 'session-fresh-5',
            restoredSnapshotId: 'snapshot-explicit',
          }),
          { status: 200 },
        );
      }

      throw new Error(`Unexpected url: ${url}`);
    };

    const result = await openProjectInFreshSession({
      projectId: 'project-1',
      snapshotId: ' snapshot-explicit ',
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.deepEqual(
      calls.map((call) => call.url),
      ['/api/sessions', '/api/projects/project-1/open'],
    );
    assert.deepEqual(JSON.parse(String(calls[1].init?.body)), {
      sessionId: 'session-fresh-5',
      snapshotId: 'snapshot-explicit',
    });
    assert.equal(result.restoredSnapshotId, 'snapshot-explicit');
  });
});
