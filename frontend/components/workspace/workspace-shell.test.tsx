import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WorkspaceShell from './workspace-shell';
import type { WorkspaceCheckpoint, WorkspaceShellSession } from './workspace-shell.logic';
import type { WorkspaceExecState } from './workspace-exec.logic';
import type { WorkspacePreviewState } from './workspace-preview.logic';
import type { WorkspaceFileNode } from './workspace-file-navigation.logic';

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

    assert.ok(!html.includes('Timeline'));
    assert.ok(!html.includes('Admin Dashboard'));
    assert.ok(!html.includes('Diff'));
    assert.ok(!html.includes('Revert'));
    assert.ok(!html.includes('Export Data'));
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
