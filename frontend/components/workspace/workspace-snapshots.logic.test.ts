import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  exportWorkspaceArchive,
  importWorkspaceArchive,
  loadWorkspaceSnapshots,
  restoreWorkspaceSnapshot,
  saveWorkspaceSnapshot,
} from './workspace-snapshots.logic';

describe('workspace-snapshots.logic', () => {
  test('saveWorkspaceSnapshot posts snapshot request and returns metadata', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify({
          id: 'snapshot-1',
          userId: 'user-1',
          label: 'first',
          createdAt: '2026-04-03T00:00:00.000Z',
          fileCount: 2,
        }),
        { status: 201 },
      );
    };

    const result = await saveWorkspaceSnapshot({
      token: 'token',
      sessionId: 'session-1',
      label: ' first ',
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/sessions/session-1/snapshot');
    assert.equal(result.id, 'snapshot-1');
    assert.equal(result.fileCount, 2);
  });

  test('loadWorkspaceSnapshots fetches list for current user', async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(
        JSON.stringify([
          {
            id: 'snapshot-2',
            userId: 'user-1',
            label: null,
            createdAt: '2026-04-03T01:00:00.000Z',
            fileCount: 1,
          },
        ]),
        { status: 200 },
      );

    const result = await loadWorkspaceSnapshots({
      token: 'token',
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'snapshot-2');
  });

  test('restoreWorkspaceSnapshot posts restore request', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init });
      return new Response(null, { status: 200 });
    };

    await restoreWorkspaceSnapshot({
      token: 'token',
      sessionId: 'session-1',
      snapshotId: 'snapshot-1',
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/sessions/session-1/restore');
  });

  test('exportWorkspaceArchive fetches export endpoint and returns blob', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init });
      return new Response('zip-content', {
        status: 200,
        headers: { 'Content-Type': 'application/zip' },
      });
    };

    const blob = await exportWorkspaceArchive({
      token: 'token',
      sessionId: 'session-1',
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(calls[0].url, '/api/sessions/session-1/export');
    assert.equal(blob.size > 0, true);
  });

  test('importWorkspaceArchive posts multipart archive upload', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ importedFileCount: 1 }), {
        status: 200,
      });
    };

    const file = new File(['hello'], 'workspace.zip', { type: 'application/zip' });
    const result = await importWorkspaceArchive({
      token: 'token',
      sessionId: 'session-1',
      archiveFile: file,
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(calls[0].url, '/api/sessions/session-1/import');
    assert.equal(result.importedFileCount, 1);
  });
});
