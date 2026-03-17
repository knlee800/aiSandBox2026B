import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WorkspaceShell, {
  getDefaultHistorySectionVisibilityPresetState,
  getHistorySectionVisibilityPresetState,
  moveHistoryCollapsibleSectionOrderItem,
  resetHistoryCollapsibleSectionOrderToDefault,
} from './workspace-shell';
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
    onAdvanceCheckpointRevertPreview: () => {},
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
    pinnedCompareReferenceCheckpointId: null,
    onPinCheckpointCompareReference: () => {},
    onClearPinnedCheckpointCompareReference: () => {},
    checkpointSnapshotState: 'idle',
    checkpointSnapshotError: null,
    checkpointSnapshotTargetId: null,
    checkpointSnapshotResponse: null,
    onViewCheckpointSnapshot: async () => {},
    checkpointLiveOpenState: 'idle',
    checkpointLiveOpenError: null,
    checkpointLiveOpenTargetPath: null,
    canOpenCheckpointFileInLiveWorkspace: (filePath) => filePath === 'src/app.ts',
    onOpenCheckpointFileInLiveWorkspace: async () => {},
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

  test('renders pinned comparison reference controls and explicit reuse actions', () => {
    const pinnedReadyHtml = renderWorkspaceShell({
      checkpoints: [checkpoint, checkpointTwo],
      selectedSessionId: session.id,
      checkpointCompareState: 'selecting',
      pinnedCompareReferenceCheckpointId: checkpoint.id,
    });
    const emptyHtml = renderWorkspaceShell({
      checkpoints: [checkpoint],
      selectedSessionId: session.id,
      pinnedCompareReferenceCheckpointId: null,
    });

    assert.match(pinnedReadyHtml, /data-testid="history-pinned-reference-state"/);
    assert.match(pinnedReadyHtml, /Pinned Comparison Reference/);
    assert.match(pinnedReadyHtml, /data-testid="history-pinned-reference-label"/);
    assert.match(pinnedReadyHtml, /Auto-commit: Message 10/);
    assert.match(pinnedReadyHtml, /data-testid="history-pinned-reference-view-diff"/);
    assert.match(pinnedReadyHtml, /data-testid="history-pinned-reference-use-base"/);
    assert.match(pinnedReadyHtml, /data-testid="history-pinned-reference-use-target"/);
    assert.match(pinnedReadyHtml, /data-testid="history-pin-button-checkpoint-1"/);
    assert.match(pinnedReadyHtml, /Pinned Ref/);
    assert.match(emptyHtml, /No pinned comparison reference\./);
  });

  test('renders checkpoint details inspector for current acted-on checkpoint', () => {
    const html = renderWorkspaceShell({
      checkpoints: [checkpoint, checkpointTwo],
      selectedSessionId: session.id,
      checkpointDiffTargetId: checkpoint.id,
      checkpointSnapshotTargetId: checkpoint.id,
      checkpointCompareState: 'selecting',
      checkpointCompareBaseId: checkpoint.id,
      checkpointCompareTargetId: checkpoint.id,
      pinnedCompareReferenceCheckpointId: checkpoint.id,
    });

    assert.match(html, /data-testid="history-checkpoint-details-inspector"/);
    assert.match(html, /Checkpoint Details Inspector/);
    assert.match(html, /data-testid="history-checkpoint-details-label"/);
    assert.match(html, /Label: <span class="font-medium text-gray-900">Auto-commit: Message 10<\/span>/);
    assert.match(html, /data-testid="history-checkpoint-details-hash"/);
    assert.match(html, /Full hash: abc123def456789012345678901234567890abcd/);
    assert.match(html, /data-testid="history-checkpoint-details-timestamp"/);
    assert.match(html, /Timestamp: <span class="font-mono text-gray-700">2026-03-10T12:00:00.000Z<\/span>/);
    assert.match(html, /data-testid="history-checkpoint-details-description"/);
    assert.match(html, /Description: <span class="text-gray-800">Auto-commit: Message 10<\/span>/);
    assert.match(html, /data-testid="history-checkpoint-details-acted-on"/);
    assert.match(
      html,
      /Acted-on states: <span class="text-gray-800">selected for diff, selected for snapshot, selected as compare base, selected as compare target, pinned comparison reference<\/span>/,
    );
  });

  test('renders empty checkpoint details inspector when no checkpoint is currently selected', () => {
    const html = renderWorkspaceShell({
      checkpoints: [checkpoint, checkpointTwo],
      selectedSessionId: session.id,
      checkpointRevertTargetId: null,
      checkpointDiffTargetId: null,
      checkpointSnapshotTargetId: null,
      checkpointCompareState: 'idle',
      checkpointCompareBaseId: null,
      checkpointCompareTargetId: null,
      pinnedCompareReferenceCheckpointId: null,
    });

    assert.match(html, /data-testid="history-checkpoint-details-empty"/);
    assert.match(html, /No selected checkpoint details yet\./);
  });

  test('renders changed-files inspector from loaded diff metadata for selected checkpoint', () => {
    const html = renderWorkspaceShell({
      checkpoints: [checkpoint, checkpointTwo],
      selectedSessionId: session.id,
      checkpointDiffState: 'ready',
      checkpointDiffTargetId: checkpoint.id,
      checkpointDiffResponse,
    });

    assert.match(html, /data-testid="history-checkpoint-changed-files-inspector"/);
    assert.match(html, /Checkpoint Changed Files Inspector/);
    assert.match(html, /data-testid="history-changed-files-target"/);
    assert.match(html, /Auto-commit: Message 10 \(abc123def456\)/);
    assert.match(html, /data-testid="history-changed-files-source"/);
    assert.match(html, /Source: loaded checkpoint diff metadata/);
    assert.match(html, /data-testid="history-changed-files-list"/);
    assert.match(html, /data-testid="history-changed-file-select-src\/app\.ts::modified"/);
    assert.match(html, /data-testid="history-changed-file-select-src\/new-file\.ts::added"/);
    assert.match(html, /data-testid="history-changed-file-select-src\/old-file\.ts::deleted"/);
    assert.match(
      html,
      /Selected file: <span class="font-mono text-gray-700">src\/app\.ts<\/span>; Status: <span class="text-gray-700">modified<\/span>/,
    );
  });

  test('renders changed-files inspector from loaded snapshot metadata fallback', () => {
    const html = renderWorkspaceShell({
      checkpoints: [checkpoint, checkpointTwo],
      selectedSessionId: session.id,
      checkpointDiffState: 'idle',
      checkpointDiffTargetId: null,
      checkpointDiffResponse: null,
      checkpointSnapshotState: 'ready',
      checkpointSnapshotTargetId: checkpoint.id,
      checkpointSnapshotResponse: checkpointDiffResponse,
    });

    assert.match(html, /data-testid="history-changed-files-source"/);
    assert.match(html, /Source: loaded checkpoint snapshot metadata/);
    assert.match(html, /data-testid="history-changed-file-select-src\/app\.ts::modified"/);
  });

  test('renders changed-files inspector unavailable state without loaded file metadata', () => {
    const html = renderWorkspaceShell({
      checkpoints: [checkpoint, checkpointTwo],
      selectedSessionId: session.id,
      checkpointDiffState: 'loading',
      checkpointDiffTargetId: checkpoint.id,
      checkpointSnapshotState: 'idle',
      checkpointSnapshotTargetId: null,
      checkpointSnapshotResponse: null,
    });

    assert.match(html, /data-testid="history-changed-files-unavailable"/);
    assert.match(html, /No loaded changed-file metadata for this checkpoint yet\./);
  });

  test('renders bounded history working-set controls and empty state', () => {
    const html = renderWorkspaceShell({
      checkpoints: [checkpoint, checkpointTwo],
      selectedSessionId: session.id,
    });

    assert.match(html, /data-testid="history-working-set-state"/);
    assert.match(html, /History Working Set/);
    assert.match(html, /data-testid="history-working-set-count"/);
    assert.match(html, /Working set size: 0\/5/);
    assert.match(html, /data-testid="history-working-set-empty"/);
    assert.match(html, /No checkpoints in the working set\./);
    assert.match(html, /data-testid="history-working-set-toggle-checkpoint-1"/);
    assert.match(html, /data-testid="history-working-set-toggle-checkpoint-2"/);
    assert.match(html, /Add to Set/);
  });

  test('renders unified active checkpoint highlight roles across existing history interactions', () => {
    const html = renderWorkspaceShell({
      checkpoints: [checkpoint, checkpointTwo],
      selectedSessionId: session.id,
      checkpointRevertTargetId: checkpoint.id,
      checkpointDiffTargetId: checkpoint.id,
      checkpointSnapshotTargetId: checkpoint.id,
      checkpointCompareState: 'selecting',
      checkpointCompareBaseId: checkpoint.id,
      checkpointCompareTargetId: checkpointTwo.id,
      pinnedCompareReferenceCheckpointId: checkpoint.id,
      checkpointDiffState: 'ready',
      checkpointDiffResponse,
    });

    assert.match(html, /data-testid="history-unified-active-highlight"/);
    assert.match(html, /Unified Active Checkpoint Highlight/);
    assert.match(html, /data-testid="history-unified-active-summary"/);
    assert.match(html, /Active checkpoints in visible list: 2\/2/);
    assert.match(html, /data-testid="history-active-highlight-checkpoint-1"/);
    assert.match(html, /revert target/);
    assert.match(html, /diff target/);
    assert.match(html, /snapshot target/);
    assert.match(html, /compare base/);
    assert.match(html, /pinned reference/);
    assert.match(html, /details inspector target/);
    assert.match(html, /changed-files inspector target/);
    assert.match(html, /data-testid="history-active-highlight-checkpoint-2"/);
    assert.match(html, /compare target/);
  });

  test('renders compact history state summary bar using existing in-surface state', () => {
    const html = renderWorkspaceShell({
      checkpoints: [checkpoint, checkpointTwo],
      selectedSessionId: session.id,
      checkpointRevertState: 'previewing',
      checkpointRevertTargetId: checkpoint.id,
      checkpointDiffTargetId: checkpoint.id,
      checkpointCompareState: 'selecting',
      checkpointCompareBaseId: checkpoint.id,
      checkpointCompareTargetId: checkpointTwo.id,
      pinnedCompareReferenceCheckpointId: checkpoint.id,
      checkpointSnapshotTargetId: checkpointTwo.id,
      checkpointDiffState: 'ready',
      checkpointDiffResponse,
    });

    assert.match(html, /data-testid="history-state-summary-bar"/);
    assert.match(html, /History State Summary/);
    assert.match(html, /Compact read-only state for the active session history surface\./);
    assert.match(html, /data-testid="history-state-summary-diff-target"/);
    assert.match(html, /Diff target:.*Auto-commit: Message 10 \(abc123def456\)/);
    assert.match(html, /data-testid="history-state-summary-compare-base"/);
    assert.match(html, /Compare base:.*Auto-commit: Message 10 \(abc123def456\)/);
    assert.match(html, /data-testid="history-state-summary-compare-target"/);
    assert.match(html, /Compare target:.*Checkpoint 7890abc \(7890abcedf12\)/);
    assert.match(html, /data-testid="history-state-summary-pinned-reference"/);
    assert.match(html, /Pinned reference:.*Auto-commit: Message 10 \(abc123def456\)/);
    assert.match(html, /data-testid="history-state-summary-snapshot-target"/);
    assert.match(html, /Snapshot target:.*Checkpoint 7890abc \(7890abcedf12\)/);
    assert.match(html, /data-testid="history-state-summary-revert-target"/);
    assert.match(html, /Revert preview\/target:.*previewing -&gt; Auto-commit: Message 10 \(abc123def456\)/);
    assert.match(html, /data-testid="history-state-summary-details-inspector-target"/);
    assert.match(html, /Details inspector target:.*Auto-commit: Message 10 \(abc123def456\)/);
    assert.match(html, /data-testid="history-state-summary-changed-files-inspector-target"/);
    assert.match(html, /Changed-files inspector target:.*Auto-commit: Message 10 \(abc123def456\)/);
    assert.match(html, /data-testid="history-state-summary-working-set-count"/);
    assert.match(html, /Working set count:.*0\/5/);
    assert.match(html, /data-testid="history-state-summary-search-filter-status"/);
    assert.match(html, /Search\/filter status:.*query none; description all; visible 2\/2/);
  });

  test('renders compact compare metadata summary using loaded base and target checkpoint metadata', () => {
    const html = renderWorkspaceShell({
      checkpoints: [checkpoint, checkpointTwo],
      selectedSessionId: session.id,
      checkpointCompareState: 'selecting',
      checkpointCompareBaseId: checkpoint.id,
      checkpointCompareTargetId: checkpointTwo.id,
    });

    assert.match(html, /data-testid="history-compare-metadata-summary"/);
    assert.match(html, /Compare Metadata Summary/);
    assert.match(
      html,
      /Read-only compare base\/target metadata from the currently loaded session checkpoint list\./,
    );
    assert.match(html, /data-testid="history-compare-metadata-base"/);
    assert.match(html, /data-testid="history-compare-metadata-target"/);
    assert.match(html, /data-testid="history-compare-metadata-base-identity"/);
    assert.match(html, /Identity: <span class="font-medium text-cyan-900">Auto-commit: Message 10<\/span>/);
    assert.match(html, /data-testid="history-compare-metadata-base-hash"/);
    assert.match(html, /Full hash: <span class="text-cyan-700">abc123def456789012345678901234567890abcd<\/span>/);
    assert.match(html, /data-testid="history-compare-metadata-base-timestamp"/);
    assert.match(
      html,
      /Timestamp: <span class="font-mono text-cyan-700">2026-03-10T12:00:00.000Z<\/span>/,
    );
    assert.match(html, /data-testid="history-compare-metadata-base-description"/);
    assert.match(html, /Description: <span class="text-cyan-800">Auto-commit: Message 10<\/span>/);
    assert.match(html, /data-testid="history-compare-metadata-target-identity"/);
    assert.match(html, /Identity: <span class="font-medium text-cyan-900">Checkpoint 7890abc<\/span>/);
    assert.match(html, /data-testid="history-compare-metadata-target-hash"/);
    assert.match(html, /Full hash: <span class="text-cyan-700">7890abcedf1234567890abcedf1234567890abce<\/span>/);
    assert.match(html, /data-testid="history-compare-metadata-target-timestamp"/);
    assert.match(
      html,
      /Timestamp: <span class="font-mono text-cyan-700">2026-03-10T12:05:00.000Z<\/span>/,
    );
    assert.match(html, /data-testid="history-compare-metadata-target-description"/);
    assert.match(html, /Description: <span class="text-cyan-800">\(none\)<\/span>/);
  });

  test('renders checkpoint inspection readiness summary from loaded checkpoint context', () => {
    const html = renderWorkspaceShell({
      checkpoints: [checkpoint, checkpointTwo],
      selectedSessionId: session.id,
      checkpointDiffState: 'ready',
      checkpointDiffTargetId: checkpoint.id,
      checkpointDiffResponse,
      checkpointSnapshotState: 'ready',
      checkpointSnapshotTargetId: checkpoint.id,
      checkpointSnapshotResponse: checkpointDiffResponse,
      checkpointCompareState: 'selecting',
      checkpointCompareBaseId: checkpoint.id,
      checkpointCompareTargetId: checkpointTwo.id,
    });

    assert.match(html, /data-testid="history-inspection-readiness-summary"/);
    assert.match(html, /Checkpoint Inspection Readiness/);
    assert.match(
      html,
      /Read-only readiness for the current checkpoint context from already-loaded metadata and in-surface state\./,
    );
    assert.match(html, /data-testid="history-inspection-readiness-target"/);
    assert.match(html, /Current context: <span class="font-medium text-teal-900">Auto-commit: Message 10<\/span>/);
    assert.match(html, /data-testid="history-inspection-readiness-diff-metadata"/);
    assert.match(html, /Diff metadata:.*available/);
    assert.match(html, /data-testid="history-inspection-readiness-snapshot-metadata"/);
    assert.match(html, /Snapshot metadata:.*available/);
    assert.match(html, /data-testid="history-inspection-readiness-changed-files-metadata"/);
    assert.match(
      html,
      /Changed-files metadata:.*available via diff; 3 file entries/,
    );
    assert.match(html, /data-testid="history-inspection-readiness-compare-selection-readiness"/);
    assert.match(html, /Compare selection readiness:.*pair ready/);
    assert.match(html, /data-testid="history-inspection-readiness-live-file-jump"/);
    assert.match(
      html,
      /Live-file jump availability:.*openable 1\/3; selected openable/,
    );
  });

  test('renders compact current checkpoint summary card from current checkpoint context', () => {
    const html = renderWorkspaceShell({
      checkpoints: [checkpoint, checkpointTwo],
      selectedSessionId: session.id,
      checkpointRevertTargetId: checkpoint.id,
      checkpointDiffTargetId: checkpoint.id,
      checkpointSnapshotTargetId: checkpoint.id,
      checkpointCompareState: 'selecting',
      checkpointCompareBaseId: checkpoint.id,
      pinnedCompareReferenceCheckpointId: checkpoint.id,
    });

    assert.match(html, /data-testid="history-current-checkpoint-summary-card"/);
    assert.match(html, /Current Checkpoint Summary/);
    assert.match(
      html,
      /Read-only current checkpoint context from already-loaded session checkpoint metadata\./,
    );
    assert.match(html, /data-testid="history-current-checkpoint-summary-identity"/);
    assert.match(html, /Identity: <span class="font-medium text-slate-900">Auto-commit: Message 10<\/span>/);
    assert.match(html, /data-testid="history-current-checkpoint-summary-hash"/);
    assert.match(html, /Full hash:.*abc123def456789012345678901234567890abcd/);
    assert.match(html, /data-testid="history-current-checkpoint-summary-timestamp"/);
    assert.match(html, /Timestamp:.*2026-03-10T12:00:00.000Z/);
    assert.match(html, /data-testid="history-current-checkpoint-summary-description"/);
    assert.match(html, /Description: <span class="text-slate-800">Auto-commit: Message 10<\/span>/);
    assert.match(html, /data-testid="history-current-checkpoint-summary-active-roles"/);
    assert.match(html, /Active roles:.*selected for revert, selected for diff, selected for snapshot, selected as compare base, pinned comparison reference/);
  });

  test('renders bounded history action availability hints from existing derived state', () => {
    const html = renderWorkspaceShell({
      checkpoints: [checkpoint, checkpointTwo],
      selectedSessionId: session.id,
      checkpointRevertState: 'previewing',
      checkpointRevertTargetId: checkpoint.id,
      checkpointDiffState: 'ready',
      checkpointDiffTargetId: checkpoint.id,
      checkpointDiffResponse,
      checkpointSnapshotState: 'ready',
      checkpointSnapshotTargetId: checkpoint.id,
      checkpointSnapshotResponse: checkpointDiffResponse,
      checkpointCompareState: 'selecting',
      checkpointCompareBaseId: checkpoint.id,
      checkpointCompareTargetId: checkpointTwo.id,
    });

    assert.match(html, /data-testid="history-action-availability-hints"/);
    assert.match(html, /History Action Availability Hints/);
    assert.match(
      html,
      /Read-only availability hints from already-derived history state and loaded checkpoint metadata\./,
    );
    assert.match(html, /data-testid="history-action-availability-hint-compare-actions"/);
    assert.match(html, /Compare actions:.*run compare available/);
    assert.match(html, /data-testid="history-action-availability-hint-diff-actions"/);
    assert.match(html, /Diff actions:.*metadata loaded/);
    assert.match(html, /data-testid="history-action-availability-hint-snapshot-actions"/);
    assert.match(html, /Snapshot actions:.*metadata loaded/);
    assert.match(html, /data-testid="history-action-availability-hint-jump-live-file-action"/);
    assert.match(html, /Jump-to-live-file action:.*available for 1\/3 files; selected openable/);
    assert.match(html, /data-testid="history-action-availability-hint-revert-actions"/);
    assert.match(html, /Revert actions:.*preview continue\/cancel available for selected checkpoint/);
  });
  test('renders compact checkpoint role legend for existing role labels and highlights', () => {
    const html = renderWorkspaceShell({
      checkpoints: [checkpoint, checkpointTwo],
      selectedSessionId: session.id,
      checkpointRevertState: 'previewing',
      checkpointRevertTargetId: checkpoint.id,
      checkpointDiffState: 'ready',
      checkpointDiffTargetId: checkpoint.id,
      checkpointDiffResponse,
      checkpointSnapshotState: 'ready',
      checkpointSnapshotTargetId: checkpoint.id,
      checkpointSnapshotResponse: checkpointDiffResponse,
      checkpointCompareState: 'selecting',
      checkpointCompareBaseId: checkpoint.id,
      checkpointCompareTargetId: checkpointTwo.id,
      pinnedCompareReferenceCheckpointId: checkpoint.id,
    });

    assert.match(html, /data-testid="history-checkpoint-role-legend"/);
    assert.match(html, /Checkpoint Role Legend/);
    assert.match(
      html,
      /Read-only legend for existing role labels\/highlights from already-derived state and loaded checkpoint metadata\./,
    );
    assert.match(html, /data-testid="history-checkpoint-role-legend-diff-target"/);
    assert.match(html, /Diff target:.*Auto-commit: Message 10/);
    assert.match(html, /data-testid="history-checkpoint-role-legend-compare-base"/);
    assert.match(html, /Compare base:.*Auto-commit: Message 10/);
    assert.match(html, /data-testid="history-checkpoint-role-legend-compare-target"/);
    assert.match(html, /Compare target:.*Checkpoint 7890abc/);
    assert.match(html, /data-testid="history-checkpoint-role-legend-pinned-reference"/);
    assert.match(html, /Pinned reference:.*Auto-commit: Message 10/);
    assert.match(html, /data-testid="history-checkpoint-role-legend-revert-target"/);
    assert.match(html, /Revert target \/ preview target:/);
    assert.match(html, /data-testid="history-checkpoint-role-legend-snapshot-target"/);
    assert.match(html, /Snapshot target:.*Auto-commit: Message 10/);
    assert.match(html, /data-testid="history-checkpoint-role-legend-details-inspector-target"/);
    assert.match(html, /Details inspector target:.*Auto-commit: Message 10/);
    assert.match(html, /data-testid="history-checkpoint-role-legend-changed-files-inspector-target"/);
    assert.match(html, /Changed-files inspector target:.*Auto-commit: Message 10/);
  });
  test('renders compact history selection breadcrumb trail from existing selection context', () => {
    const html = renderWorkspaceShell({
      checkpoints: [checkpoint, checkpointTwo],
      selectedSessionId: session.id,
      checkpointRevertState: 'previewing',
      checkpointRevertTargetId: checkpoint.id,
      checkpointDiffState: 'ready',
      checkpointDiffTargetId: checkpoint.id,
      checkpointDiffResponse,
      checkpointSnapshotState: 'ready',
      checkpointSnapshotTargetId: checkpoint.id,
      checkpointSnapshotResponse: checkpointDiffResponse,
      checkpointCompareState: 'selecting',
      checkpointCompareBaseId: checkpoint.id,
      checkpointCompareTargetId: checkpointTwo.id,
      pinnedCompareReferenceCheckpointId: checkpoint.id,
    });

    assert.match(html, /data-testid="history-selection-breadcrumb"/);
    assert.match(html, /History Selection Breadcrumb/);
    assert.match(
      html,
      /Compact read-only selection trail from already-derived state and loaded checkpoint metadata\./,
    );
    assert.match(html, /data-testid="history-selection-breadcrumb-current-checkpoint-context"/);
    assert.match(html, /Current checkpoint context:.*Auto-commit: Message 10/);
    assert.match(html, /data-testid="history-selection-breadcrumb-compare-base"/);
    assert.match(html, /Compare base:.*Auto-commit: Message 10/);
    assert.match(html, /data-testid="history-selection-breadcrumb-compare-target"/);
    assert.match(html, /Compare target:.*Checkpoint 7890abc/);
    assert.match(html, /data-testid="history-selection-breadcrumb-pinned-reference"/);
    assert.match(html, /Pinned reference:.*Auto-commit: Message 10/);
    assert.match(html, /data-testid="history-selection-breadcrumb-snapshot-target"/);
    assert.match(html, /Snapshot target:.*Auto-commit: Message 10/);
    assert.match(html, /data-testid="history-selection-breadcrumb-revert-target"/);
    assert.match(html, /Revert target \/ preview target:/);
    assert.match(html, /data-testid="history-selection-breadcrumb-details-inspector-target"/);
    assert.match(html, /Details inspector target:.*Auto-commit: Message 10/);
    assert.match(html, /data-testid="history-selection-breadcrumb-changed-files-inspector-target"/);
    assert.match(html, /Changed-files inspector target:.*Auto-commit: Message 10/);
  });
  test('renders compact history empty-state guidance for unavailable history contexts', () => {
    const html = renderWorkspaceShell({
      checkpoints: [checkpoint, checkpointTwo],
      selectedSessionId: session.id,
    });

    assert.match(html, /data-testid="history-empty-state-guidance"/);
    assert.match(html, /History Empty-State Guidance/);
    assert.match(
      html,
      /Compact read-only guidance for empty or unavailable history context from already-derived frontend state and loaded checkpoint metadata\./,
    );
    assert.match(html, /data-testid="history-empty-state-guidance-selected-checkpoint"/);
    assert.match(html, /Selected checkpoint:/);
    assert.match(html, /no checkpoint selected/);
    assert.match(html, /data-testid="history-empty-state-guidance-compare-selection"/);
    assert.match(html, /Compare selection:/);
    assert.match(html, /no compare base\/target selected/);
    assert.match(html, /data-testid="history-empty-state-guidance-snapshot-target"/);
    assert.match(html, /Snapshot target context:/);
    assert.match(html, /no snapshot target context/);
    assert.match(html, /data-testid="history-empty-state-guidance-changed-files-metadata"/);
    assert.match(html, /Changed-files metadata:/);
    assert.match(html, /no changed-files metadata loaded \(no active checkpoint context\)/);
    assert.match(html, /data-testid="history-empty-state-guidance-working-set-members"/);
    assert.match(html, /Working-set members:/);
    assert.match(html, /no working-set members/);
    assert.match(html, /data-testid="history-empty-state-guidance-active-checkpoint-context"/);
    assert.match(html, /Active checkpoint context:/);
    assert.match(html, /no active checkpoint context/);
  });
  test('renders history context density toggle with compact active by default', () => {
    const html = renderWorkspaceShell({
      checkpoints: [checkpoint, checkpointTwo],
      selectedSessionId: session.id,
    });

    assert.match(html, /data-testid="history-context-density-toggle"/);
    assert.match(html, /History Context Density/);
    assert.match(html, /data-testid="history-context-density-caption"/);
    assert.match(html, /Presentation-only toggle for context summary density in this active session\./);
    assert.match(html, /data-testid="history-context-density-compact"/);
    assert.match(html, /data-testid="history-context-density-expanded"/);
    assert.match(html, /data-testid="history-context-density-active-mode"/);
    assert.match(html, /Active density: compact/);
    assert.match(html, /data-testid="history-context-density-compact" aria-pressed="true"/);
    assert.match(html, /data-testid="history-context-density-expanded" aria-pressed="false"/);
    assert.match(html, /data-testid="history-empty-state-guidance-items" data-density="compact"/);
    assert.match(html, /data-testid="history-state-summary-items" data-density="compact"/);
  });

  test('renders history focus mode toggle with focus off by default', () => {
    const html = renderWorkspaceShell({
      checkpoints: [checkpoint, checkpointTwo],
      selectedSessionId: session.id,
    });

    assert.match(html, /data-testid="history-focus-mode-toggle"/);
    assert.match(html, /History Focus Mode/);
    assert.match(html, /data-testid="history-focus-mode-caption"/);
    assert.match(
      html,
      /Presentation-only toggle to reduce visual noise in this active session history context surface\./,
    );
    assert.match(html, /data-testid="history-focus-mode-off"/);
    assert.match(html, /data-testid="history-focus-mode-on"/);
    assert.match(html, /data-testid="history-focus-mode-active-mode"/);
    assert.match(html, /Active focus mode: off/);
    assert.match(html, /data-testid="history-focus-mode-off" aria-pressed="true"/);
    assert.match(html, /data-testid="history-focus-mode-on" aria-pressed="false"/);
    assert.match(html, /data-testid="history-compare-metadata-summary" data-focus-mode="off"/);
    assert.match(html, /data-testid="history-state-summary-bar" data-focus-mode="off"/);
    assert.match(html, /data-testid="history-checkpoint-list" data-focus-mode="off"/);
  });

  test('renders bounded history section collapse controls for major existing sections', () => {
    const html = renderWorkspaceShell({
      checkpoints: [checkpoint, checkpointTwo],
      selectedSessionId: session.id,
    });

    assert.match(html, /data-testid="history-section-collapse-controls"/);
    assert.match(html, /History Section Collapse/);
    assert.match(
      html,
      /Presentation-only collapse\/expand controls for major existing history sections in this active session\./,
    );
    assert.match(html, /data-testid="history-section-order-summary"/);
    assert.match(html, /Current section order: Controls &gt; Summaries &gt; Inspectors &gt; Checkpoint Browser/);
    assert.match(html, /data-testid="history-section-order-reset-controls"/);
    assert.match(html, /data-testid="history-section-order-reset-default" disabled/);
    assert.match(html, /data-testid="history-section-order-reset-state"/);
    assert.match(html, /Default: Controls &gt; Summaries &gt; Inspectors &gt; Checkpoint Browser/);
    assert.match(html, /data-testid="history-section-visibility-preset-controls"/);
    assert.match(html, /data-testid="history-section-visibility-preset-reset-default" disabled/);
    assert.match(html, /data-testid="history-section-visibility-preset-overview-oriented"/);
    assert.match(html, /data-testid="history-section-visibility-preset-inspection-oriented"/);
    assert.match(html, /data-testid="history-section-visibility-preset-active-state"/);
    assert.match(html, /Active preset: Default/);
    assert.match(html, /data-testid="history-section-toggle-quick-controls"/);
    assert.match(html, /data-testid="history-section-expand-all" disabled/);
    assert.match(html, /data-testid="history-section-collapse-all"/);
    assert.match(html, /data-testid="history-section-toggle-all-state"/);
    assert.match(html, /Collapsed 0\/4 sections/);
    assert.match(html, /data-testid="history-section-collapsed-state-summary"/);
    assert.match(html, /data-testid="history-section-state-controls"/);
    assert.match(html, /data-testid="history-section-state-summaries"/);
    assert.match(html, /data-testid="history-section-state-inspectors"/);
    assert.match(html, /data-testid="history-section-state-checkpoint-browser"/);
    assert.match(html, /data-testid="history-section-order-controls"/);
    assert.match(html, /data-testid="history-section-order-row-controls"/);
    assert.match(html, /data-testid="history-section-order-row-summaries"/);
    assert.match(html, /data-testid="history-section-order-row-inspectors"/);
    assert.match(html, /data-testid="history-section-order-row-checkpoint-browser"/);
    assert.match(html, /data-testid="history-section-order-move-earlier-controls" disabled/);
    assert.match(html, /data-testid="history-section-order-move-later-controls"/);
    assert.match(html, /data-testid="history-section-order-move-earlier-summaries"/);
    assert.match(html, /data-testid="history-section-order-move-later-summaries"/);
    assert.match(html, /data-testid="history-section-order-move-earlier-inspectors"/);
    assert.match(html, /data-testid="history-section-order-move-later-inspectors"/);
    assert.match(html, /data-testid="history-section-order-move-earlier-checkpoint-browser"/);
    assert.match(html, /data-testid="history-section-order-move-later-checkpoint-browser" disabled/);
    assert.match(html, /Controls: expanded/);
    assert.match(html, /Summaries: expanded/);
    assert.match(html, /Inspectors: expanded/);
    assert.match(html, /Checkpoint Browser: expanded/);
    assert.match(html, /data-testid="history-section-toggle-controls" aria-expanded="true"/);
    assert.match(html, /data-testid="history-section-toggle-summaries" aria-expanded="true"/);
    assert.match(html, /data-testid="history-section-toggle-inspectors" aria-expanded="true"/);
    assert.match(html, /data-testid="history-section-toggle-checkpoint-browser" aria-expanded="true"/);
  });

  test('keeps major history section groups expanded by default in active session scope', () => {
    const html = renderWorkspaceShell({
      checkpoints: [checkpoint, checkpointTwo],
      selectedSessionId: session.id,
    });

    assert.match(html, /data-testid="history-section-controls-group" data-collapsed="false"/);
    assert.match(html, /data-testid="history-section-summaries-group" data-collapsed="false"/);
    assert.match(html, /data-testid="history-section-inspectors-group" data-collapsed="false"/);
    assert.match(html, /data-testid="history-section-checkpoint-browser-group" data-collapsed="false"/);
    assert.match(html, /data-testid="history-search-filter-controls"/);
    assert.match(html, /data-testid="history-state-summary-bar"/);
    assert.match(html, /data-testid="history-checkpoint-details-inspector"/);
    assert.match(html, /data-testid="history-checkpoint-list"/);
  });

  test('reorders history section presentation order within bounded earlier/later moves', () => {
    const defaultOrder = ['controls', 'summaries', 'inspectors', 'checkpoint-browser'] as const;
    const summariesMovedEarlier = moveHistoryCollapsibleSectionOrderItem({
      currentOrder: [...defaultOrder],
      sectionKey: 'summaries',
      direction: 'earlier',
    });
    const summariesMovedLater = moveHistoryCollapsibleSectionOrderItem({
      currentOrder: [...defaultOrder],
      sectionKey: 'summaries',
      direction: 'later',
    });
    const controlsAtStartStays = moveHistoryCollapsibleSectionOrderItem({
      currentOrder: [...defaultOrder],
      sectionKey: 'controls',
      direction: 'earlier',
    });
    const browserAtEndStays = moveHistoryCollapsibleSectionOrderItem({
      currentOrder: [...defaultOrder],
      sectionKey: 'checkpoint-browser',
      direction: 'later',
    });

    assert.deepEqual(summariesMovedEarlier, ['summaries', 'controls', 'inspectors', 'checkpoint-browser']);
    assert.deepEqual(summariesMovedLater, ['controls', 'inspectors', 'summaries', 'checkpoint-browser']);
    assert.deepEqual(controlsAtStartStays, [...defaultOrder]);
    assert.deepEqual(browserAtEndStays, [...defaultOrder]);
  });

  test('normalizes bounded section order to keep all major history sections present', () => {
    const normalizedOrder = moveHistoryCollapsibleSectionOrderItem({
      currentOrder: ['summaries', 'summaries'],
      sectionKey: 'summaries',
      direction: 'later',
    });

    assert.deepEqual(normalizedOrder, ['controls', 'summaries', 'inspectors', 'checkpoint-browser']);
  });

  test('resets history section order to bounded default presentation order', () => {
    const resetOrder = resetHistoryCollapsibleSectionOrderToDefault();

    assert.deepEqual(resetOrder, ['controls', 'summaries', 'inspectors', 'checkpoint-browser']);
  });

  test('returns bounded history section visibility preset state for overview and inspection modes', () => {
    const overviewPreset = getHistorySectionVisibilityPresetState('overview-oriented');
    const inspectionPreset = getHistorySectionVisibilityPresetState('inspection-oriented');

    assert.deepEqual(overviewPreset, {
      controls: false,
      summaries: false,
      inspectors: true,
      'checkpoint-browser': false,
    });
    assert.deepEqual(inspectionPreset, {
      controls: true,
      summaries: true,
      inspectors: false,
      'checkpoint-browser': false,
    });
  });

  test('returns bounded default visibility preset state for reset control', () => {
    const defaultPreset = getDefaultHistorySectionVisibilityPresetState();

    assert.deepEqual(defaultPreset, {
      controls: false,
      summaries: false,
      inspectors: false,
      'checkpoint-browser': false,
    });
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

  test('renders open-in-live workspace state and per-file availability from history viewers', () => {
    const openedHtml = renderWorkspaceShell({
      checkpointDiffState: 'ready',
      checkpointDiffTargetId: checkpoint.id,
      checkpointDiffResponse,
      checkpointSnapshotState: 'ready',
      checkpointSnapshotTargetId: checkpoint.id,
      checkpointSnapshotResponse: checkpointDiffResponse,
      checkpointLiveOpenState: 'opened',
      checkpointLiveOpenTargetPath: 'src/app.ts',
      selectedSessionId: session.id,
    });
    const missingHtml = renderWorkspaceShell({
      checkpointLiveOpenState: 'missing',
      checkpointLiveOpenTargetPath: 'src/missing.ts',
      selectedSessionId: session.id,
    });

    assert.match(openedHtml, /data-testid="history-open-live-state"/);
    assert.match(openedHtml, /Live workspace file opened/);
    assert.match(openedHtml, /Editor focus switched to src\/app\.ts using live workspace navigation\./);
    assert.match(openedHtml, /data-testid="history-diff-open-live-src\/app\.ts::modified"/);
    assert.match(openedHtml, /data-testid="history-snapshot-open-live-src\/app\.ts::modified"/);
    assert.match(openedHtml, /data-testid="history-diff-open-live-src\/new-file\.ts::added"[^>]*disabled/);
    assert.match(openedHtml, /data-testid="history-snapshot-open-live-src\/new-file\.ts::added"[^>]*disabled/);
    assert.match(missingHtml, /Live file unavailable/);
    assert.match(missingHtml, /does not exist in the active live workspace/);
    assert.match(missingHtml, /No restore, revert, or file write was performed\./);
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

  test('renders explicit history reset controls for temporary frontend-only state', () => {
    const html = renderWorkspaceShell({
      checkpoints: [checkpoint, checkpointTwo],
      selectedSessionId: session.id,
      pinnedCompareReferenceCheckpointId: checkpoint.id,
    });

    assert.match(html, /data-testid="history-reset-controls"/);
    assert.match(html, /History Reset Controls/);
    assert.match(html, /data-testid="history-reset-search-filter"/);
    assert.match(html, /data-testid="history-reset-pinned-reference"/);
    assert.match(html, /data-testid="history-reset-working-set"/);
    assert.match(html, /data-testid="history-reset-inspector-selection"/);
    assert.match(html, /data-testid="history-reset-all"/);
    assert.match(html, /Reset Search\/Filter/);
    assert.match(html, /Clear Pinned Ref/);
    assert.match(html, /Clear Working Set/);
    assert.match(html, /Reset Inspector Selection/);
    assert.match(html, /Reset All Temporary State/);
  });

  test('disables history reset controls when no resettable temporary state is active', () => {
    const html = renderWorkspaceShell({
      selectedSessionId: session.id,
      pinnedCompareReferenceCheckpointId: null,
    });

    assert.match(html, /data-testid="history-reset-search-filter"[^>]*disabled/);
    assert.match(html, /data-testid="history-reset-pinned-reference"[^>]*disabled/);
    assert.match(html, /data-testid="history-reset-working-set"[^>]*disabled/);
    assert.match(html, /data-testid="history-reset-inspector-selection"[^>]*disabled/);
    assert.match(html, /data-testid="history-reset-all"[^>]*disabled/);
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
    const previewingHtml = renderWorkspaceShell({
      checkpointRevertState: 'previewing',
      checkpointRevertTargetId: checkpoint.id,
      checkpointDiffState: 'ready',
      checkpointDiffTargetId: checkpoint.id,
      checkpointDiffResponse,
      checkpointSnapshotState: 'ready',
      checkpointSnapshotTargetId: checkpoint.id,
      checkpointSnapshotResponse: checkpointDiffResponse,
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
    assert.match(previewingHtml, /Revert previewing/);
    assert.match(previewingHtml, /data-testid="history-revert-preview-checkpoint-1"/);
    assert.match(previewingHtml, /data-testid="history-revert-preview-target"/);
    assert.match(previewingHtml, /Preview Target Diff/);
    assert.match(previewingHtml, /Preview Target Snapshot/);
    assert.match(previewingHtml, /data-testid="history-revert-preview-continue"/);
    assert.match(previewingHtml, /Diff preview status for target: ready/);
    assert.match(previewingHtml, /Snapshot preview status for target: ready/);
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
