import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import enMessages from '@/messages/en.json';
import zhTwMessages from '@/messages/zh-TW.json';
import zhCnMessages from '@/messages/zh-CN.json';
import {
  buildProjectScopedSnapshotLabel,
  buildProjectScopedSnapshotLabelWithName,
  exportWorkspaceArchive,
  importWorkspaceArchive,
  loadWorkspaceSnapshots,
  parseProjectIdFromSnapshotLabel,
  parseProjectScopedSnapshotHint,
  parseProjectScopedSnapshotName,
  parseProjectScopedSnapshotSource,
  resolveProjectScopedLatestSnapshotId,
  normalizeRestoreFailedPaths,
  restoreWorkspaceSnapshot,
  saveWorkspaceSnapshot,
} from './workspace-snapshots.logic';
import type { ProjectScopedSnapshotSource } from './workspace-snapshots.logic';

// SNAPSHOT-LABEL-01: the label examples shared with the gateway tests.
type SnapshotLabelParseCase = {
  id: string;
  label: string | null;
  projectId: string | null;
  name: string | null;
  source: string | null;
  hint: string | null;
};
type SnapshotLabelWriterCase = {
  writer: string;
  projectId: string;
  source?: string;
  hint?: string | null;
  name?: string;
  label: string;
};
const snapshotLabelExamples = JSON.parse(
  readFileSync(
    new URL('../../../services/api-gateway/src/snapshots/snapshot-label-examples.json', import.meta.url),
    'utf8',
  ),
) as { parseCases: SnapshotLabelParseCase[]; writerCases: SnapshotLabelWriterCase[] };

describe('SNAPSHOT-LABEL-01: shared snapshot label examples', () => {
  test('the shared file has parse and writer cases for every frontend writer', () => {
    assert.ok(snapshotLabelExamples.parseCases.length > 30);
    for (const writer of ['frontend-plain', 'frontend-source', 'frontend-name']) {
      assert.ok(
        snapshotLabelExamples.writerCases.some((example) => example.writer === writer),
        writer,
      );
    }
  });

  for (const example of snapshotLabelExamples.parseCases) {
    test(`frontend parser reads ${example.id}`, () => {
      assert.equal(parseProjectIdFromSnapshotLabel(example.label), example.projectId);
      assert.equal(parseProjectScopedSnapshotName(example.label), example.name);
      assert.equal(parseProjectScopedSnapshotSource(example.label), example.source);
      assert.equal(parseProjectScopedSnapshotHint(example.label), example.hint);
      if (example.projectId !== null) {
        assert.equal(
          resolveProjectScopedLatestSnapshotId({
            snapshots: [
              {
                id: example.id,
                userId: 'user-1',
                label: example.label,
                createdAt: '2026-04-06T00:00:00.000Z',
                fileCount: 1,
              },
            ],
            projectId: example.projectId,
          }),
          example.id,
        );
      }
    });
  }

  for (const [index, example] of snapshotLabelExamples.writerCases.entries()) {
    if (!example.writer.startsWith('frontend-')) {
      continue;
    }
    test(`frontend writer case ${index} (${example.writer}) builds the example label and parses back`, () => {
      const built =
        example.writer === 'frontend-name'
          ? buildProjectScopedSnapshotLabelWithName(example.projectId, example.name ?? '')
          : example.writer === 'frontend-source'
            ? buildProjectScopedSnapshotLabel(
                example.projectId,
                example.source as ProjectScopedSnapshotSource,
                example.hint ?? undefined,
              )
            : buildProjectScopedSnapshotLabel(example.projectId);
      assert.equal(built, example.label);
      assert.equal(parseProjectIdFromSnapshotLabel(built), example.projectId.trim());
      const parseCase = snapshotLabelExamples.parseCases.find(
        (candidate) => candidate.label === built,
      );
      assert.ok(parseCase, `a parse case exists for ${built}`);
      assert.equal(parseCase.projectId, example.projectId.trim());
    });
  }
});

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

    const result = await restoreWorkspaceSnapshot({
      sessionId: 'session-1',
      snapshotId: 'snapshot-1',
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/sessions/session-1/restore');
    // SNAPSHOT-NOTICE-01: an empty body (an older gateway) means no failed paths.
    assert.deepEqual(result, { kind: 'restored', failedPaths: [] });
  });

  test('restoreWorkspaceSnapshot returns the paths the restore could not write (SNAPSHOT-NOTICE-01)', async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(
        JSON.stringify({
          id: 'snapshot-1',
          userId: 'user-1',
          label: null,
          createdAt: '2026-04-03T00:00:00.000Z',
          fileCount: 3,
          failedPaths: ['img/a.png', 'fonts/b.ttf'],
        }),
        { status: 200 },
      );

    const result = await restoreWorkspaceSnapshot({
      sessionId: 'session-1',
      snapshotId: 'snapshot-1',
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.deepEqual(result, { kind: 'restored', failedPaths: ['img/a.png', 'fonts/b.ttf'] });
  });

  test('restoreWorkspaceSnapshot defaults failedPaths to [] when the field is missing or malformed (SNAPSHOT-NOTICE-01)', async () => {
    for (const body of [
      { id: 'snapshot-1', fileCount: 3 },
      { id: 'snapshot-1', failedPaths: 'img/a.png' },
      { id: 'snapshot-1', failedPaths: null },
    ]) {
      const fetchImpl = async (): Promise<Response> =>
        new Response(JSON.stringify(body), { status: 200 });
      const result = await restoreWorkspaceSnapshot({
        sessionId: 'session-1',
        snapshotId: 'snapshot-1',
        fetchImpl: fetchImpl as typeof fetch,
      });
      assert.deepEqual(result, { kind: 'restored', failedPaths: [] });
    }
  });

  test('normalizeRestoreFailedPaths keeps only non-empty strings (SNAPSHOT-NOTICE-01)', () => {
    assert.deepEqual(normalizeRestoreFailedPaths(undefined), []);
    assert.deepEqual(normalizeRestoreFailedPaths({}), []);
    assert.deepEqual(normalizeRestoreFailedPaths(['a.png', '', 3, null, 'b.ttf']), [
      'a.png',
      'b.ttf',
    ]);
  });

  test('restoreWorkspaceSnapshot maps 409 to run_active and still throws other errors', async () => {
    const conflictFetch = async (): Promise<Response> =>
      new Response(JSON.stringify({ code: 'run_active' }), { status: 409 });
    const result = await restoreWorkspaceSnapshot({
      sessionId: 'session-1',
      snapshotId: 'snapshot-1',
      fetchImpl: conflictFetch as typeof fetch,
    });
    assert.deepEqual(result, { kind: 'run_active' });

    const missingFetch = async (): Promise<Response> =>
      new Response(JSON.stringify({ message: 'Snapshot missing.' }), {
        status: 404,
      });
    await assert.rejects(
      () =>
        restoreWorkspaceSnapshot({
          sessionId: 'session-1',
          snapshotId: 'snapshot-1',
          fetchImpl: missingFetch as typeof fetch,
        }),
      /Snapshot missing\./,
    );
  });

  test('restore blocked by an active run is translated in en, zh-TW, and zh-CN', () => {
    const en = enMessages.recovery.workspace.restoreBlockedByActiveRun;
    const zhTw = zhTwMessages.recovery.workspace.restoreBlockedByActiveRun;
    const zhCn = zhCnMessages.recovery.workspace.restoreBlockedByActiveRun;
    assert.equal(
      en,
      'An Agent run is still working in this session. Restore after it finishes or is cancelled.',
    );
    assert.equal(
      zhTw,
      '這個工作階段仍有 Agent 正在工作。請等它完成或取消後再還原。',
    );
    assert.equal(
      zhCn,
      '这个会话仍有 Agent 正在工作。请等它完成或取消后再恢复。',
    );
    assert.notEqual(zhTw, en);
    assert.notEqual(zhCn, en);
    assert.notEqual(zhTw, zhCn);
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

  test('buildProjectScopedSnapshotLabel optionally encodes a stable source tag', () => {
    const label = buildProjectScopedSnapshotLabel('project-123', 'preview');
    assert.equal(label, '[project-id:project-123:source:preview]');
  });

  test('buildProjectScopedSnapshotLabel optionally encodes a sanitized deterministic hint', () => {
    const label = buildProjectScopedSnapshotLabel(
      'project-123',
      'ai',
      '  src/app.tsx :hint: ] :name: +2  ',
    );
    assert.equal(label, '[project-id:project-123:source:ai:hint:src/app.tsx +2]');
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

  test('parseProjectScopedSnapshotSource returns the source tag only for source-tagged labels', () => {
    assert.equal(
      parseProjectScopedSnapshotSource('[project-id:project-123:source:file-save]'),
      'file-save',
    );
    assert.equal(
      parseProjectScopedSnapshotSource('[project-id:project-123:source:ai:hint:index.tsx +2]'),
      'ai',
    );
    assert.equal(
      parseProjectScopedSnapshotSource('[project-id:project-123:name:Working draft]'),
      null,
    );
    assert.equal(parseProjectScopedSnapshotSource('[project-id:project-123]'), null);
    assert.equal(parseProjectScopedSnapshotSource('[project-id:project-123:source:unknown]'), null);
    assert.equal(parseProjectScopedSnapshotSource(null), null);
  });

  test('revert source round-trips through build and parse with and without a hint', () => {
    const withoutHint = buildProjectScopedSnapshotLabel('project-123', 'revert');
    assert.equal(withoutHint, '[project-id:project-123:source:revert]');
    assert.equal(parseProjectScopedSnapshotSource(withoutHint), 'revert');

    const withHint = buildProjectScopedSnapshotLabel('project-123', 'revert', 'main.tsx');
    assert.equal(withHint, '[project-id:project-123:source:revert:hint:main.tsx]');
    assert.equal(parseProjectScopedSnapshotSource(withHint), 'revert');

    assert.equal(parseProjectScopedSnapshotSource('[project-id:project-123:source:unknown]'), null);
  });

  test('parseProjectScopedSnapshotHint returns the sanitized hint only for source-plus-hint labels', () => {
    assert.equal(
      parseProjectScopedSnapshotHint('[project-id:project-123:source:preview:hint:index.html]'),
      'index.html',
    );
    assert.equal(
      parseProjectScopedSnapshotHint('[project-id:project-123:source:ai:hint:index.tsx +2]'),
      'index.tsx +2',
    );
    assert.equal(
      parseProjectScopedSnapshotHint('[project-id:project-123:source:file-save]'),
      null,
    );
    assert.equal(
      parseProjectScopedSnapshotHint('[project-id:project-123:name:Working draft]'),
      null,
    );
    assert.equal(parseProjectScopedSnapshotHint('[project-id:project-123]'), null);
    assert.equal(parseProjectScopedSnapshotHint(null), null);
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

  test('resolveProjectScopedLatestSnapshotId matches source-tagged project labels', () => {
    const snapshotId = resolveProjectScopedLatestSnapshotId({
      projectId: 'project-1',
      snapshots: [
        {
          id: 'snapshot-newer-project-1-preview',
          userId: 'user-1',
          label: '[project-id:project-1:source:preview:hint:index.html]',
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
          label: '[project-id:project-2:source:ai]',
          createdAt: '2026-04-09T10:00:00.000Z',
          fileCount: 3,
        },
      ],
    });

    assert.equal(snapshotId, 'snapshot-newer-project-1-preview');
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
