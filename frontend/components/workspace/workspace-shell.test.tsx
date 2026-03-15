import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WorkspaceShell from './workspace-shell';
import type { WorkspaceCheckpoint, WorkspaceShellSession } from './workspace-shell.logic';
import type { WorkspaceExecState } from './workspace-exec.logic';
import type { WorkspacePreviewState } from './workspace-preview.logic';
import type { WorkspaceFileNode } from './workspace-file-navigation.logic';
import type { WorkspaceCheckpointDiffResponse } from './workspace-checkpoint-diff.logic';

const session: WorkspaceShellSession = {
  id: '12345678-test-session',
  status: 'active',
  terminatedAt: null,
  terminationReason: null,
};

const checkpoint: WorkspaceCheckpoint = {
  id: 'checkpoint-1',
  commitHash: 'abc123def456789012345678901234567890abcd',
  messageNumber: 10,
  description: 'Auto-commit: Message 10',
  filesChanged: 1,
  createdAt: '2026-03-10T12:00:00.000Z',
};
const checkpointTwo: WorkspaceCheckpoint = {
  id: 'checkpoint-2',
  commitHash: '7890abcedf1234567890abcedf1234567890abce',
  messageNumber: 11,
  description: null,
  filesChanged: 2,
  createdAt: '2026-03-10T12:05:00.000Z',
};

const userSummary = {
  userId: 'user-123',
  email: 'user@example.com',
  createdAt: '2026-03-10T12:00:00.000Z',
};

const usageSummary = {
  activeSessions: 1,
  sessionsCreated24h: 2,
  tokensUsed24h: 450,
  estimatedCost: 0.045,
  resetAt: '2026-03-11T12:00:00.000Z',
};

const quotaSummary = {
  maxActiveSessions: 5,
  currentActiveSessions: 1,
  maxSessions24h: 20,
  currentSessions24h: 2,
  maxTokens24h: 100000,
  currentTokens24h: 450,
  resetAt: '2026-03-11T12:00:00.000Z',
};

const idleExecState: WorkspaceExecState = {
  status: 'idle',
  result: null,
};

const unavailablePreviewState: WorkspacePreviewState = 'unavailable';
const checkpointDiffResponse: WorkspaceCheckpointDiffResponse = {
  commitHash: 'abc123def456789012345678901234567890abcd',
  parentHash: 'def456abc123789012345678901234567890abcd',
  files: [
    {
      path: 'src/new-file.ts',
      status: 'added',
      diff: '@@ -0,0 +1 @@\n+export const created = true;',
    },
    {
      path: 'src/app.ts',
      status: 'modified',
      diff: '@@ -1 +1 @@\n-console.log("old")\n+console.log("new")',
    },
    {
      path: 'src/old-file.ts',
      status: 'deleted',
      diff: '@@ -1 +0,0 @@\n-export const removed = true;',
    },
  ],
};

const structuredDiffResponse: WorkspaceCheckpointDiffResponse = {
  commitHash: '1234567890abcdef1234567890abcdef12345678',
  parentHash: 'abcdef1234567890abcdef1234567890abcdef12',
  files: [
    {
      path: 'src/structured.ts',
      status: 'modified',
      diff: '@@ -1,3 +1,3 @@\n const keep = true;\n-const oldValue = 1;\n+const newValue = 2;',
    },
  ],
};
const workspaceFileTree: WorkspaceFileNode[] = [
  {
    name: 'src',
    path: 'src',
    type: 'directory',
    children: [
      {
        name: 'app.ts',
        path: 'src/app.ts',
        type: 'file',
        children: [],
      },
    ],
  },
];

function renderWorkspaceShell(
  overrides: Partial<React.ComponentProps<typeof WorkspaceShell>> = {},
): string {
  const defaultProps: React.ComponentProps<typeof WorkspaceShell> = {
    sessions: [session],
    selectedSessionId: session.id,
    isLoadingSessions: false,
    sessionError: null,
    onSelectSession: () => {},
    onCreateSession: async () => {},
    isCreatingSession: false,
    userId: 'user-123',
    checkpoints: [checkpoint],
    isLoadingHistory: false,
    historyError: null,
    checkpointCreateState: 'idle',
    checkpointCreateError: null,
    checkpointDescriptionInput: '',
    onCheckpointDescriptionChange: () => {},
    onCreateManualCheckpoint: async () => {},
    checkpointRevertState: 'idle',
    checkpointRevertError: null,
    checkpointRevertTargetId: null,
    onInitiateCheckpointRevert: () => {},
    onCancelCheckpointRevert: () => {},
    onConfirmCheckpointRevert: async () => {},
    checkpointDiffState: 'idle',
    checkpointDiffError: null,
    checkpointDiffTargetId: null,
    checkpointDiffResponse: null,
    onViewCheckpointDiff: async () => {},
    checkpointCompareState: 'idle',
    checkpointCompareError: null,
    checkpointCompareBaseId: null,
    checkpointCompareTargetId: null,
    checkpointCompareResponse: null,
    onStartCheckpointCompare: () => {},
    onCancelCheckpointCompare: () => {},
    onSelectCheckpointCompareBase: () => {},
    onSelectCheckpointCompareTarget: () => {},
    onRunCheckpointCompare: async () => {},
    checkpointSnapshotState: 'idle',
    checkpointSnapshotError: null,
    checkpointSnapshotTargetId: null,
    checkpointSnapshotResponse: null,
    onViewCheckpointSnapshot: async () => {},
    userSummary,
    usageSummary,
    quotaSummary,
    isLoadingDashboard: false,
    dashboardError: null,
    commandInput: '',
    onCommandInputChange: () => {},
    onExecuteCommand: async () => {},
    execState: idleExecState,
    previewState: unavailablePreviewState,
    previewUrl: null,
    onRefreshPreview: async () => {},
    onPreviewLoad: () => {},
    onPreviewError: () => {},
    fileSurfaceState: 'ready',
    workspaceFileTree,
    selectedFilePath: 'src/app.ts',
    selectedFileContent: 'console.log("hello");',
    fileSaveState: 'clean',
    fileSaveError: null,
    fileSurfaceError: null,
    onSelectWorkspaceFile: async () => {},
    onEditorContentChange: () => {},
    onSaveWorkspaceFile: async () => {},
  };

  return renderToStaticMarkup(<WorkspaceShell {...defaultProps} {...overrides} />);
}

describe('workspace shell component', () => {
  test('renders authenticated workspace shell layout', () => {
    const html = renderWorkspaceShell();

    assert.match(html, /AI Sandbox Workspace/);
    assert.match(html, /Chat Panel/);
    assert.match(html, /Command Input \(Exec Slice\)/);
    assert.match(html, /Editor Panel/);
    assert.match(html, /Editor ready/);
    assert.match(html, /Editor clean/);
    assert.match(html, /src\/app\.ts/);
    assert.match(html, /console\.log\(&quot;hello&quot;\);/);
    assert.match(html, /Preview Panel/);
    assert.match(html, /Preview unavailable/);
    assert.match(html, /History \/ Control \(Slice 1\)/);
    assert.match(html, /Dashboard \(Slice 1\)/);
    assert.match(html, /Session 12345678/);
    assert.match(html, /Auto-commit: Message 10/);
    assert.match(html, /View Snapshot/);
    assert.match(html, /View Diff/);
    assert.match(html, /Current User/);
    assert.match(html, /user@example\.com/);
    assert.match(html, /Active Sessions/);
  });

  test('renders loading shell state', () => {
    const html = renderWorkspaceShell({
      isLoadingSessions: true,
      userId: null,
      checkpoints: [],
      isLoadingHistory: true,
      userSummary: null,
      usageSummary: null,
      quotaSummary: null,
      isLoadingDashboard: true,
      fileSurfaceState: 'loading',
      workspaceFileTree: [],
      selectedFilePath: null,
      selectedFileContent: '',
    });

    assert.match(html, /Workspace is loading/);
    assert.match(html, /History is loading/);
    assert.match(html, /Dashboard is loading/);
    assert.match(html, /Editor loading/);
    assert.match(html, /Action: Please wait a moment\./);
  });

  test('renders distinct editor save states', () => {
    const dirtyHtml = renderWorkspaceShell({
      fileSaveState: 'dirty',
    });
    const savingHtml = renderWorkspaceShell({
      fileSaveState: 'saving',
    });
    const savedHtml = renderWorkspaceShell({
      fileSaveState: 'saved',
    });
    const saveErrorHtml = renderWorkspaceShell({
      fileSaveState: 'save-error',
      fileSaveError: 'Failed to save file changes.',
    });

    assert.match(dirtyHtml, /Editor dirty/);
    assert.match(savingHtml, /Saving file/);
    assert.match(savingHtml, /data-testid="workspace-selected-file-content"[^>]*disabled/);
    assert.match(savedHtml, /File saved/);
    assert.match(saveErrorHtml, /Save failed/);
    assert.match(saveErrorHtml, /Failed to save file changes\./);
  });

  test('renders error shell state', () => {
    const html = renderWorkspaceShell({
      sessionError: 'Failed to load sessions.',
      userId: null,
      checkpoints: [],
      historyError: 'Failed to load checkpoints.',
      userSummary: null,
      usageSummary: null,
      quotaSummary: null,
      dashboardError: 'Failed to load dashboard summary.',
      fileSurfaceState: 'error',
      workspaceFileTree: [],
      selectedFilePath: null,
      selectedFileContent: '',
      fileSurfaceError: 'Failed to load workspace files.',
    });

    assert.match(html, /Workspace unavailable/);
    assert.match(html, /History unavailable/);
    assert.match(html, /Dashboard unavailable/);
    assert.match(html, /Editor unavailable/);
    assert.match(html, /Action: Refresh this page to retry\./);
  });

  test('renders empty history state for selected session without checkpoints', () => {
    const html = renderWorkspaceShell({
      userId: null,
      checkpoints: [],
      userSummary: null,
      usageSummary: null,
      quotaSummary: null,
      fileSurfaceState: 'empty',
      workspaceFileTree: [],
      selectedFilePath: null,
      selectedFileContent: '',
    });

    assert.match(html, /No checkpoints yet/);
    assert.match(html, /Save point idle/);
    assert.match(html, /No dashboard data yet/);
    assert.match(html, /No file available/);
    assert.match(html, /Action: Create or select a session, then retry\./);
  });

  test('renders trust note and responsive layout classes', () => {
    const html = renderWorkspaceShell({
      userId: null,
    });

    assert.match(html, /Workspace data is session-scoped\./);
    assert.ok(html.includes('grid-cols-1'));
    assert.ok(html.includes('md:grid-cols-2'));
    assert.ok(html.includes('xl:grid-cols-3'));
  });

  test('renders loading preview state and refresh button', () => {
    const html = renderWorkspaceShell({
      selectedSessionId: session.id,
      previewState: 'loading',
      previewUrl: `/api/preview/${session.id}/proxy?refresh=1`,
    });

    assert.match(html, /Preview loading/);
    assert.match(html, /Refreshing\.\.\./);
    assert.match(html, /data-testid="workspace-preview-iframe"/);
  });

  test('renders ready preview state with iframe', () => {
    const html = renderWorkspaceShell({
      selectedSessionId: session.id,
      previewState: 'ready',
      previewUrl: `/api/preview/${session.id}/proxy?refresh=2`,
    });

    assert.match(html, /Preview ready/);
    assert.match(html, /workspace-preview-iframe/);
    assert.match(html, /Use Refresh to reload only this preview\./);
  });

  test('renders preview error state', () => {
    const html = renderWorkspaceShell({
      selectedSessionId: session.id,
      previewState: 'error',
      previewUrl: null,
    });

    assert.match(html, /Preview error/);
    assert.match(html, /Choose Refresh to retry the preview surface\./);
  });

  test('does not render out-of-scope history or dashboard UI', () => {
    const html = renderWorkspaceShell({
      userId: null,
    });

    assert.ok(!html.includes('Admin Dashboard'));
    assert.ok(!html.includes('Export Data'));
  });

  test('renders distinct checkpoint diff states and diff content', () => {
    const idleHtml = renderWorkspaceShell({
      checkpointDiffState: 'idle',
      selectedSessionId: session.id,
    });
    const loadingHtml = renderWorkspaceShell({
      checkpointDiffState: 'loading',
      checkpointDiffTargetId: checkpoint.id,
      selectedSessionId: session.id,
    });
    const readyHtml = renderWorkspaceShell({
      checkpointDiffState: 'ready',
      checkpointDiffTargetId: checkpoint.id,
      checkpointDiffResponse,
      selectedSessionId: session.id,
    });
    const emptyHtml = renderWorkspaceShell({
      checkpointDiffState: 'empty',
      checkpointDiffTargetId: checkpoint.id,
      checkpointDiffResponse: {
        ...checkpointDiffResponse,
        files: [],
      },
      selectedSessionId: session.id,
    });
    const errorHtml = renderWorkspaceShell({
      checkpointDiffState: 'diff-error',
      checkpointDiffError: 'Failed to load checkpoint diff.',
      selectedSessionId: session.id,
    });

    assert.match(idleHtml, /Diff viewer idle/);
    assert.match(loadingHtml, /Loading checkpoint diff/);
    assert.match(loadingHtml, /Loading diff\.\.\./);
    assert.match(readyHtml, /Checkpoint diff ready/);
    assert.match(readyHtml, /Checkpoint Diff/);
    assert.match(readyHtml, /Changed Files Summary/);
    assert.match(readyHtml, /Added: 1/);
    assert.match(readyHtml, /Modified: 1/);
    assert.match(readyHtml, /Deleted: 1/);
    assert.match(readyHtml, /src\/new-file\.ts/);
    assert.match(readyHtml, /src\/app\.ts/);
    assert.match(readyHtml, /src\/old-file\.ts/);
    assert.match(readyHtml, /modified/);
    assert.match(readyHtml, /added/);
    assert.match(readyHtml, /export const created = true/);
    assert.match(readyHtml, /data-testid="history-diff-lines"/);
    assert.match(readyHtml, /data-testid="history-diff-line-hunk"/);
    assert.match(readyHtml, /data-testid="history-diff-line-added"/);
    assert.ok(!readyHtml.includes('console.log(&quot;new&quot;)'));
    assert.match(emptyHtml, /No diff changes/);
    assert.match(errorHtml, /Checkpoint diff failed/);
    assert.match(errorHtml, /Failed to load checkpoint diff\./);
  });

  test('renders unified diff line types for selected file', () => {
    const html = renderWorkspaceShell({
      checkpointDiffState: 'ready',
      checkpointDiffTargetId: checkpoint.id,
      checkpointDiffResponse: structuredDiffResponse,
      selectedSessionId: session.id,
    });

    assert.match(html, /Checkpoint diff ready/);
    assert.match(html, /data-testid="history-diff-line-hunk"/);
    assert.match(html, /data-testid="history-diff-line-context"/);
    assert.match(html, /data-testid="history-diff-line-removed"/);
    assert.match(html, /data-testid="history-diff-line-added"/);
    assert.match(html, /@@ -1,3 \+1,3 @@/);
    assert.match(html, /const keep = true/);
    assert.match(html, /const oldValue = 1/);
    assert.match(html, /const newValue = 2/);
  });

  test('renders distinct compare mode states and controls', () => {
    const idleHtml = renderWorkspaceShell({
      checkpointCompareState: 'idle',
      selectedSessionId: session.id,
    });
    const selectingHtml = renderWorkspaceShell({
      checkpointCompareState: 'selecting',
      checkpointCompareBaseId: checkpoint.id,
      selectedSessionId: session.id,
    });
    const loadingHtml = renderWorkspaceShell({
      checkpointCompareState: 'loading',
      checkpointCompareBaseId: checkpoint.id,
      checkpointCompareTargetId: 'checkpoint-2',
      selectedSessionId: session.id,
    });
    const readyHtml = renderWorkspaceShell({
      checkpointCompareState: 'ready',
      checkpointCompareBaseId: checkpoint.id,
      checkpointCompareTargetId: 'checkpoint-2',
      checkpointCompareResponse: structuredDiffResponse,
      selectedSessionId: session.id,
    });
    const errorHtml = renderWorkspaceShell({
      checkpointCompareState: 'compare-error',
      checkpointCompareError: 'Failed to compare selected checkpoints.',
      checkpointCompareBaseId: checkpoint.id,
      checkpointCompareTargetId: 'checkpoint-2',
      selectedSessionId: session.id,
    });

    assert.match(idleHtml, /Compare mode idle/);
    assert.match(idleHtml, /Compare Checkpoints/);
    assert.match(selectingHtml, /Compare mode selecting/);
    assert.match(selectingHtml, /Exit Compare/);
    assert.match(selectingHtml, /Base: selected; Target: not selected\./);
    assert.match(selectingHtml, /Set Target/);
    assert.match(loadingHtml, /Compare mode loading/);
    assert.match(loadingHtml, /Comparing\.\.\./);
    assert.match(readyHtml, /Compare mode ready/);
    assert.match(readyHtml, /Checkpoint Diff/);
    assert.match(readyHtml, /const keep = true/);
    assert.match(errorHtml, /Compare mode failed/);
    assert.match(errorHtml, /Failed to compare selected checkpoints\./);
  });

  test('renders distinct checkpoint snapshot states and read-only snapshot viewer', () => {
    const idleHtml = renderWorkspaceShell({
      checkpointSnapshotState: 'idle',
      selectedSessionId: session.id,
    });
    const loadingHtml = renderWorkspaceShell({
      checkpointSnapshotState: 'loading',
      checkpointSnapshotTargetId: checkpoint.id,
      selectedSessionId: session.id,
    });
    const readyHtml = renderWorkspaceShell({
      checkpointSnapshotState: 'ready',
      checkpointSnapshotTargetId: checkpoint.id,
      checkpointSnapshotResponse: checkpointDiffResponse,
      selectedSessionId: session.id,
    });
    const emptyHtml = renderWorkspaceShell({
      checkpointSnapshotState: 'empty',
      checkpointSnapshotTargetId: checkpoint.id,
      checkpointSnapshotResponse: {
        ...checkpointDiffResponse,
        files: [],
      },
      selectedSessionId: session.id,
    });
    const errorHtml = renderWorkspaceShell({
      checkpointSnapshotState: 'snapshot-error',
      checkpointSnapshotError: 'Failed to load checkpoint snapshot.',
      selectedSessionId: session.id,
    });
    const deletedFileHtml = renderWorkspaceShell({
      checkpointSnapshotState: 'ready',
      checkpointSnapshotTargetId: checkpoint.id,
      checkpointSnapshotResponse: {
        ...checkpointDiffResponse,
        files: [
          {
            path: 'src/old-file.ts',
            status: 'deleted',
            diff: '@@ -1 +0,0 @@\n-export const removed = true;',
          },
        ],
      },
      selectedSessionId: session.id,
    });

    assert.match(idleHtml, /Snapshot viewer idle/);
    assert.match(loadingHtml, /Loading checkpoint snapshot/);
    assert.match(loadingHtml, /Loading snapshot\.\.\./);
    assert.match(readyHtml, /Checkpoint snapshot ready/);
    assert.match(readyHtml, /Checkpoint File Snapshot \(Read-only\)/);
    assert.match(
      readyHtml,
      /This is not the live workspace editor file and cannot be edited or saved\./,
    );
    assert.match(readyHtml, /Snapshot content is a bounded read-only excerpt derived from checkpoint diff hunks\./);
    assert.match(readyHtml, /export const created = true;/);
    assert.match(readyHtml, /data-testid="history-snapshot-lines"/);
    assert.match(readyHtml, /data-testid="history-snapshot-line"/);
    assert.match(emptyHtml, /No snapshot content/);
    assert.match(errorHtml, /Checkpoint snapshot failed/);
    assert.match(errorHtml, /Failed to load checkpoint snapshot\./);
    assert.match(deletedFileHtml, /\(file deleted at selected checkpoint\)/);
  });

  test('renders checkpoint history search and filter controls', () => {
    const html = renderWorkspaceShell({
      checkpoints: [checkpoint],
      selectedSessionId: session.id,
    });

    assert.match(html, /data-testid="history-search-filter-controls"/);
    assert.match(html, /Checkpoint Search and Filter/);
    assert.match(html, /data-testid="history-search-input"/);
    assert.match(html, /Search by description or commit hash/);
    assert.match(html, /data-testid="history-description-filter"/);
    assert.match(html, />All checkpoints</);
    assert.match(html, />With description</);
    assert.match(html, />Without description</);
    assert.match(html, /Showing 1 of 1 matching checkpoints/);
  });

  test('renders visual checkpoint timeline metadata and emphasis states', () => {
    const html = renderWorkspaceShell({
      checkpoints: [checkpoint, checkpointTwo],
      selectedSessionId: session.id,
      checkpointRevertTargetId: checkpoint.id,
      checkpointCompareState: 'selecting',
      checkpointCompareTargetId: checkpointTwo.id,
      checkpointDiffTargetId: checkpoint.id,
    });

    assert.match(html, /data-testid="history-timeline-item-checkpoint-1"/);
    assert.match(html, /data-testid="history-timeline-item-checkpoint-2"/);
    assert.match(html, /Checkpoint Timeline/);
    assert.match(html, /data-testid="history-timeline-time-checkpoint-1"/);
    assert.match(html, /data-testid="history-timeline-time-checkpoint-2"/);
    assert.match(html, /2026-03-10T12:00:00.000Z/);
    assert.match(html, /2026-03-10T12:05:00.000Z/);
    assert.match(html, /Checkpoint 7890abc/);
    assert.match(html, /Timeline focus: selected for diff/);
    assert.match(html, /Timeline focus: compare target/);
  });

  test('renders bounded git-log style checkpoint browser entries', () => {
    const html = renderWorkspaceShell({
      checkpoints: [checkpoint, checkpointTwo],
      selectedSessionId: session.id,
      checkpointRevertTargetId: checkpoint.id,
      checkpointCompareState: 'selecting',
      checkpointCompareBaseId: checkpoint.id,
      checkpointCompareTargetId: checkpointTwo.id,
      checkpointDiffTargetId: checkpoint.id,
    });

    assert.match(html, /data-testid="history-gitlog-header"/);
    assert.match(html, /Checkpoint Git Log/);
    assert.match(html, /Bounded commit-style view for visible checkpoints/);
    assert.match(html, /data-testid="history-gitlog-entry-checkpoint-1"/);
    assert.match(html, /data-testid="history-gitlog-entry-checkpoint-2"/);
    assert.match(html, /\* \[1\] Auto-commit: Message 10/);
    assert.match(html, /\* \[2\] Checkpoint 7890abc/);
    assert.match(html, /commit abc123def456789012345678901234567890abcd/);
    assert.match(html, /commit 7890abcedf1234567890abcedf1234567890abce/);
    assert.match(html, /Date: 2026-03-10T12:00:00\.000Z/);
    assert.match(html, /Date: 2026-03-10T12:05:00\.000Z/);
    assert.match(html, /Focus: selected for diff/);
    assert.match(html, /Focus: compare target/);
  });

  test('renders distinct manual checkpoint create states', () => {
    const idleHtml = renderWorkspaceShell({
      checkpointCreateState: 'idle',
      selectedSessionId: session.id,
    });
    const creatingHtml = renderWorkspaceShell({
      checkpointCreateState: 'creating',
      selectedSessionId: session.id,
    });
    const createdHtml = renderWorkspaceShell({
      checkpointCreateState: 'created',
      selectedSessionId: session.id,
    });
    const createErrorHtml = renderWorkspaceShell({
      checkpointCreateState: 'create-error',
      checkpointCreateError: 'Failed to create save point.',
      selectedSessionId: session.id,
    });

    assert.match(idleHtml, /Save point idle/);
    assert.match(creatingHtml, /Creating save point/);
    assert.match(creatingHtml, /Creating\.\.\./);
    assert.match(createdHtml, /Save point created/);
    assert.match(createErrorHtml, /Save point failed/);
    assert.match(createErrorHtml, /Failed to create save point\./);
  });

  test('renders distinct manual checkpoint revert states', () => {
    const idleHtml = renderWorkspaceShell({
      checkpointRevertState: 'idle',
      selectedSessionId: session.id,
    });
    const confirmingHtml = renderWorkspaceShell({
      checkpointRevertState: 'confirming',
      checkpointRevertTargetId: checkpoint.id,
      selectedSessionId: session.id,
    });
    const revertingHtml = renderWorkspaceShell({
      checkpointRevertState: 'reverting',
      checkpointRevertTargetId: checkpoint.id,
      selectedSessionId: session.id,
    });
    const revertedHtml = renderWorkspaceShell({
      checkpointRevertState: 'reverted',
      selectedSessionId: session.id,
    });
    const revertErrorHtml = renderWorkspaceShell({
      checkpointRevertState: 'revert-error',
      checkpointRevertError: 'Failed to revert workspace to selected checkpoint.',
      selectedSessionId: session.id,
    });

    assert.match(idleHtml, /Revert idle/);
    assert.match(confirmingHtml, /Revert confirming/);
    assert.match(confirmingHtml, /Confirm revert\?/);
    assert.match(confirmingHtml, /Confirm Revert/);
    assert.match(revertingHtml, /Reverting workspace/);
    assert.match(revertingHtml, /Reverting\.\.\./);
    assert.match(revertedHtml, /Workspace reverted/);
    assert.match(revertErrorHtml, /Revert failed/);
    assert.match(revertErrorHtml, /Failed to revert workspace to selected checkpoint\./);
  });

  test('renders successful exec result with stdout, stderr, and success status', () => {
    const html = renderWorkspaceShell({
      commandInput: 'echo hello',
      execState: {
        status: 'result',
        result: {
          exitCode: 0,
          stdout: 'hello',
          stderr: '',
        },
      },
    });

    assert.match(html, /Command succeeded/);
    assert.match(html, /Exec Result/);
    assert.match(html, /SUCCESS/);
    assert.match(html, /exitCode: <span class="font-mono">0<\/span>/);
    assert.match(html, /hello/);
    assert.match(html, /\(empty\)/);
  });

  test('renders failed exec result with failure status', () => {
    const html = renderWorkspaceShell({
      commandInput: 'badcmd',
      execState: {
        status: 'result',
        result: {
          exitCode: 127,
          stdout: '',
          stderr: 'command not found',
        },
      },
    });

    assert.match(html, /Command failed/);
    assert.match(html, /FAILURE/);
    assert.match(html, /127/);
    assert.match(html, /command not found/);
  });

  test('renders distinct HTTP and network exec error states', () => {
    const http400Html = renderWorkspaceShell({
      execState: {
        status: 'http-400',
        result: null,
      },
    });
    const http404Html = renderWorkspaceShell({
      execState: {
        status: 'http-404',
        result: null,
      },
    });
    const http410Html = renderWorkspaceShell({
      execState: {
        status: 'http-410',
        result: null,
      },
    });
    const networkHtml = renderWorkspaceShell({
      execState: {
        status: 'network-error',
        result: null,
      },
    });

    assert.match(http400Html, /Invalid command \(400\)/);
    assert.match(http404Html, /Session not found \(404\)/);
    assert.match(http410Html, /Session terminated \(410\)/);
    assert.match(networkHtml, /Exec request failed/);
  });

  test('disables exec input while sending and after 410 state', () => {
    const sendingHtml = renderWorkspaceShell({
      commandInput: 'echo hello',
      execState: {
        status: 'sending',
        result: null,
      },
    });
    const terminatedHtml = renderWorkspaceShell({
      commandInput: 'echo hello',
      execState: {
        status: 'http-410',
        result: null,
      },
    });

    assert.match(sendingHtml, /data-testid="workspace-exec-input"[^>]*disabled/);
    assert.match(sendingHtml, /Running\.\.\./);
    assert.match(terminatedHtml, /data-testid="workspace-exec-input"[^>]*disabled/);
    assert.match(terminatedHtml, /Session terminated \(410\)/);
  });
});
