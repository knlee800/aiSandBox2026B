import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildProjectScopedSnapshotLabel,
  buildProjectScopedSnapshotLabelWithName,
  exportWorkspaceArchive,
  importWorkspaceArchive,
  loadWorkspaceSnapshots,
  parseProjectScopedSnapshotName,
  resolveProjectScopedLatestSnapshotId,
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

  test('buildProjectScopedSnapshotLabel encodes project id marker', () => {
    const label = buildProjectScopedSnapshotLabel('project-123');
    assert.equal(label, '[project-id:project-123]');
  });

  test('buildProjectScopedSnapshotLabelWithName encodes a deterministic named label', () => {
    const firstLabel = buildProjectScopedSnapshotLabelWithName(
      'project-123',
      '  Working draft  ',
    );
    const secondLabel = buildProjectScopedSnapshotLabelWithName(
      'project-123',
      '  Working draft  ',
    );

    assert.equal(firstLabel, '[project-id:project-123:name:Working draft]');
    assert.equal(secondLabel, firstLabel);
  });

  test('buildProjectScopedSnapshotLabelWithName falls back to the unnamed label shape for blank names', () => {
    const unnamedLabel = buildProjectScopedSnapshotLabel('project-123');
    const blankNamedLabel = buildProjectScopedSnapshotLabelWithName(
      'project-123',
      '   ',
    );

    assert.equal(blankNamedLabel, unnamedLabel);
  });

  test('parseProjectScopedSnapshotName returns the trimmed name when present', () => {
    const parsedName = parseProjectScopedSnapshotName(
      '  [project-id:project-123:name:Working draft]  ',
    );

    assert.equal(parsedName, 'Working draft');
  });

  test('parseProjectScopedSnapshotName returns null for unnamed or blank-name labels', () => {
    assert.equal(
      parseProjectScopedSnapshotName('[project-id:project-123]'),
      null,
    );
    assert.equal(
      parseProjectScopedSnapshotName('[project-id:project-123:name:   ]'),
      null,
    );
    assert.equal(parseProjectScopedSnapshotName(null), null);
  });

  test('resolveProjectScopedLatestSnapshotId selects latest matching project snapshot', () => {
    const snapshotId = resolveProjectScopedLatestSnapshotId({
      projectId: 'project-1',
      snapshots: [
        {
          id: 'snapshot-newer-other',
          userId: 'user-1',
          label: '[project-id:project-2]',
          createdAt: '2026-04-09T12:00:00.000Z',
          fileCount: 3,
        },
        {
          id: 'snapshot-newer-project-1',
          userId: 'user-1',
          label: '[project-id:project-1]',
          createdAt: '2026-04-09T11:00:00.000Z',
          fileCount: 7,
        },
        {
          id: 'snapshot-older-project-1',
          userId: 'user-1',
          label: '[project-id:project-1]',
          createdAt: '2026-04-09T10:00:00.000Z',
          fileCount: 2,
        },
      ],
    });

    assert.equal(snapshotId, 'snapshot-newer-project-1');
  });

  test('resolveProjectScopedLatestSnapshotId matches both unnamed and named project labels', () => {
    const snapshotId = resolveProjectScopedLatestSnapshotId({
      projectId: 'project-1',
      snapshots: [
        {
          id: 'snapshot-newer-project-1-named',
          userId: 'user-1',
          label: '[project-id:project-1:name:Working draft]',
          createdAt: '2026-04-09T12:00:00.000Z',
          fileCount: 5,
        },
        {
          id: 'snapshot-older-project-1-unnamed',
          userId: 'user-1',
          label: '[project-id:project-1]',
          createdAt: '2026-04-09T11:00:00.000Z',
          fileCount: 4,
        },
        {
          id: 'snapshot-other-project',
          userId: 'user-1',
          label: '[project-id:project-2:name:Other]',
          createdAt: '2026-04-09T10:00:00.000Z',
          fileCount: 3,
        },
      ],
    });

    assert.equal(snapshotId, 'snapshot-newer-project-1-named');
  });

  test('resolveProjectScopedLatestSnapshotId returns null when no project snapshot exists', () => {
    const snapshotId = resolveProjectScopedLatestSnapshotId({
      projectId: 'project-1',
      snapshots: [
        {
          id: 'snapshot-other',
          userId: 'user-1',
          label: '[project-id:project-2]',
          createdAt: '2026-04-09T12:00:00.000Z',
          fileCount: 1,
        },
      ],
    });

    assert.equal(snapshotId, null);
  });
});
