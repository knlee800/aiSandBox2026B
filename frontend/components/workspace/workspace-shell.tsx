'use client';

import React from 'react';
import {
  computeDashboardSliceState,
  computeHistorySliceState,
  computeWorkspaceShellState,
  countActiveSessions,
  getSessionLabel,
  type WorkspaceCheckpoint,
  type WorkspaceQuotaSummary,
  type WorkspaceShellSession,
  type WorkspaceUsageSummary,
  type WorkspaceUserSummary,
} from './workspace-shell.logic';
import type { WorkspaceExecState } from './workspace-exec.logic';
import type { WorkspacePreviewState } from './workspace-preview.logic';

interface WorkspaceShellProps {
  sessions: WorkspaceShellSession[];
  selectedSessionId: string | null;
  isLoadingSessions: boolean;
  sessionError: string | null;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => Promise<void>;
  isCreatingSession: boolean;
  userId: string | null;
  checkpoints: WorkspaceCheckpoint[];
  isLoadingHistory: boolean;
  historyError: string | null;
  userSummary: WorkspaceUserSummary | null;
  usageSummary: WorkspaceUsageSummary | null;
  quotaSummary: WorkspaceQuotaSummary | null;
  isLoadingDashboard: boolean;
  dashboardError: string | null;
  commandInput: string;
  onCommandInputChange: (value: string) => void;
  onExecuteCommand: () => Promise<void>;
  execState: WorkspaceExecState;
  previewState: WorkspacePreviewState;
  previewUrl: string | null;
  onRefreshPreview: () => Promise<void>;
  onPreviewLoad: () => void;
  onPreviewError: () => void;
}

export default function WorkspaceShell(props: WorkspaceShellProps) {
  const shellState = computeWorkspaceShellState({
    isLoadingSessions: props.isLoadingSessions,
    sessionError: props.sessionError,
    sessions: props.sessions,
    selectedSessionId: props.selectedSessionId,
  });
  const activeSessions = countActiveSessions(props.sessions);
  const historyState = computeHistorySliceState({
    selectedSessionId: props.selectedSessionId,
    isLoadingHistory: props.isLoadingHistory,
    historyError: props.historyError,
    checkpoints: props.checkpoints,
  });
  const dashboardState = computeDashboardSliceState({
    isLoadingDashboard: props.isLoadingDashboard,
    dashboardError: props.dashboardError,
    userSummary: props.userSummary,
    usageSummary: props.usageSummary,
    quotaSummary: props.quotaSummary,
  });

  return (
    <div className="h-screen bg-gray-100 flex flex-col" data-testid="workspace-shell">
      <header className="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-gray-900">AI Sandbox Workspace</h1>
          <p className="text-xs text-gray-500">Core shell baseline (Slice 1)</p>
        </div>
        <div className="text-xs text-gray-600 text-right">
          <p>{props.userId ? `User ${props.userId}` : 'Authenticated user'}</p>
          <p className="text-[11px] text-gray-500">Launch polish slice 1: responsive + state clarity</p>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-gray-200 flex flex-col" data-testid="session-sidebar-shell">
          <div className="p-3 border-b border-gray-100">
            <button
              type="button"
              onClick={() => void props.onCreateSession()}
              disabled={props.isCreatingSession}
              className="w-full rounded bg-blue-600 text-white text-sm py-2 disabled:bg-blue-300"
            >
              {props.isCreatingSession ? 'Creating...' : 'New Session'}
            </button>
            <p className="mt-2 text-xs text-gray-500">Active sessions: {activeSessions}/5</p>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {props.sessions.map((session) => {
              const selected = session.id === props.selectedSessionId;
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => props.onSelectSession(session.id)}
                  className={`w-full text-left rounded border p-2 mb-2 ${
                    selected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <p className="text-xs font-medium text-gray-900 truncate">Session {session.id.slice(0, 8)}</p>
                  <p className="text-xs text-gray-500">{getSessionLabel(session)}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="flex-1 min-w-0 flex flex-col">
          <div className="px-2 pt-2">
            <p className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800" data-testid="workspace-trust-note">
              Workspace data is session-scoped. If a state fails, use the suggested retry action below.
            </p>
          </div>
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-2">
            <section className="bg-white border border-gray-200 rounded p-3" data-testid="chat-panel-shell">
              <p className="text-xs font-semibold text-gray-700 mb-2">Chat Panel</p>
              <p className="text-xs font-semibold text-gray-700 mb-2">Command Input (Exec Slice)</p>
              <WorkspaceExecPanel
                selectedSessionId={props.selectedSessionId}
                commandInput={props.commandInput}
                onCommandInputChange={props.onCommandInputChange}
                onExecuteCommand={props.onExecuteCommand}
                execState={props.execState}
              />
              <div className="mt-3">
                <ShellStateMessage state={shellState} />
              </div>
            </section>
            <section className="bg-white border border-gray-200 rounded p-3" data-testid="editor-panel-shell">
              <p className="text-xs font-semibold text-gray-700 mb-2">Editor Panel</p>
              <ShellStateMessage state={shellState} />
            </section>
            <section className="bg-white border border-gray-200 rounded p-3" data-testid="preview-panel-shell">
              <p className="text-xs font-semibold text-gray-700 mb-2">Preview Panel</p>
              <WorkspacePreviewPanel
                selectedSessionId={props.selectedSessionId}
                previewState={props.previewState}
                previewUrl={props.previewUrl}
                onRefreshPreview={props.onRefreshPreview}
                onPreviewLoad={props.onPreviewLoad}
                onPreviewError={props.onPreviewError}
              />
            </section>
          </div>
          <section className="mx-2 mb-2 bg-white border border-gray-200 rounded p-3" data-testid="history-control-slice">
            <p className="text-xs font-semibold text-gray-700 mb-2">History / Control (Slice 1)</p>
            <HistorySliceMessage state={historyState} />
            {historyState === 'ready' ? <HistoryCheckpointList checkpoints={props.checkpoints} /> : null}
          </section>
          <section className="mx-2 mb-2 bg-white border border-gray-200 rounded p-3" data-testid="dashboard-slice">
            <p className="text-xs font-semibold text-gray-700 mb-2">Dashboard (Slice 1)</p>
            <DashboardSliceMessage state={dashboardState} />
            {dashboardState === 'ready' && props.userSummary && props.usageSummary && props.quotaSummary ? (
              <DashboardSummary
                userSummary={props.userSummary}
                usageSummary={props.usageSummary}
                quotaSummary={props.quotaSummary}
              />
            ) : null}
          </section>
        </main>
      </div>

      <footer className="h-10 bg-white border-t border-gray-200 px-4 flex items-center justify-between text-xs text-gray-600">
        <span>Workspace shell state: {shellState}</span>
        <span>Sessions: {props.sessions.length}</span>
      </footer>
    </div>
  );
}

function WorkspaceExecPanel(props: {
  selectedSessionId: string | null;
  commandInput: string;
  onCommandInputChange: (value: string) => void;
  onExecuteCommand: () => Promise<void>;
  execState: WorkspaceExecState;
}) {
  const isLocked = props.execState.status === 'http-410';
  const isSending = props.execState.status === 'sending';
  const isInputDisabled = isSending || isLocked || !props.selectedSessionId;
  const canSubmit = !isInputDisabled && props.commandInput.trim().length > 0;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    void props.onExecuteCommand();
  };

  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-2" data-testid="workspace-exec-panel">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          data-testid="workspace-exec-input"
          type="text"
          value={props.commandInput}
          onChange={(event) => props.onCommandInputChange(event.target.value)}
          disabled={isInputDisabled}
          placeholder="Enter shell command (e.g. ls -la)"
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs disabled:bg-gray-100 disabled:text-gray-500"
        />
        <button
          data-testid="workspace-exec-submit"
          type="submit"
          disabled={!canSubmit}
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white disabled:bg-blue-300"
        >
          {isSending ? 'Running...' : 'Run'}
        </button>
      </form>

      <div className="mt-2">
        <ExecStateMessage execState={props.execState} />
      </div>

      {props.execState.status === 'result' && props.execState.result ? (
        <ExecResultOutput result={props.execState.result} />
      ) : null}
    </div>
  );
}

function WorkspacePreviewPanel(props: {
  selectedSessionId: string | null;
  previewState: WorkspacePreviewState;
  previewUrl: string | null;
  onRefreshPreview: () => Promise<void>;
  onPreviewLoad: () => void;
  onPreviewError: () => void;
}) {
  const canRefresh = Boolean(props.selectedSessionId) && props.previewState !== 'loading';

  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-2" data-testid="workspace-preview-panel">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gray-700">Live Preview</p>
        <button
          type="button"
          data-testid="workspace-preview-refresh"
          disabled={!canRefresh}
          onClick={() => void props.onRefreshPreview()}
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white disabled:bg-blue-300"
        >
          {props.previewState === 'loading' ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <PreviewStateMessage state={props.previewState} />

      {props.previewUrl ? (
        <iframe
          title="Session Preview"
          data-testid="workspace-preview-iframe"
          src={props.previewUrl}
          onLoad={props.onPreviewLoad}
          onError={props.onPreviewError}
          className="mt-2 h-56 w-full rounded border border-gray-200 bg-white"
        />
      ) : null}
    </div>
  );
}

function ExecStateMessage({ execState }: { execState: WorkspaceExecState }) {
  if (execState.status === 'idle') {
    return (
      <StateMessage
        tone="neutral"
        heading="Exec idle"
        body="Submit a command for the selected active session."
        action="Enter a command and choose Run."
      />
    );
  }

  if (execState.status === 'sending') {
    return (
      <StateMessage
        tone="neutral"
        heading="Command running"
        body="Sending command to session exec endpoint."
        action="Wait for exec result."
      />
    );
  }

  if (execState.status === 'http-400') {
    return (
      <StateMessage
        tone="error"
        heading="Invalid command (400)"
        body="The command was rejected as empty or invalid."
        action="Update the command and retry."
      />
    );
  }

  if (execState.status === 'http-404') {
    return (
      <StateMessage
        tone="error"
        heading="Session not found (404)"
        body="The selected session is no longer available."
        action="Select or create a session, then retry."
      />
    );
  }

  if (execState.status === 'http-410') {
    return (
      <StateMessage
        tone="error"
        heading="Session terminated (410)"
        body="This session is terminated and cannot execute commands."
        action="Create or select an active session to continue."
      />
    );
  }

  if (execState.status === 'network-error') {
    return (
      <StateMessage
        tone="error"
        heading="Exec request failed"
        body="Network or unexpected error prevented command execution."
        action="Retry this command."
      />
    );
  }

  if (!execState.result) {
    return (
      <StateMessage
        tone="error"
        heading="Exec result unavailable"
        body="Command response could not be read."
        action="Retry this command."
      />
    );
  }

  if (execState.result.exitCode === 0) {
    return (
      <StateMessage
        tone="success"
        heading="Command succeeded"
        body={`exitCode: ${execState.result.exitCode}`}
        action="Review stdout and stderr below."
      />
    );
  }

  return (
    <StateMessage
      tone="error"
      heading="Command failed"
      body={`exitCode: ${execState.result.exitCode}`}
      action="Review stderr and retry if needed."
    />
  );
}

function ExecResultOutput(props: { result: NonNullable<WorkspaceExecState['result']> }) {
  const isSuccess = props.result.exitCode === 0;
  const borderTone = isSuccess ? 'border-green-200' : 'border-red-200';
  const badgeTone = isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';

  return (
    <div className={`mt-2 rounded border p-2 ${borderTone}`} data-testid="workspace-exec-output">
      <p className="text-xs font-semibold text-gray-700">
        Exec Result{' '}
        <span className={`ml-1 rounded px-1 py-0.5 text-[10px] ${badgeTone}`}>
          {isSuccess ? 'SUCCESS' : 'FAILURE'}
        </span>
      </p>
      <p className="mt-1 text-xs text-gray-600">
        exitCode: <span className="font-mono">{props.result.exitCode}</span>
      </p>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold text-gray-600">stdout</p>
          <pre className="mt-1 max-h-28 overflow-auto rounded border border-gray-200 bg-white p-2 text-[11px] text-gray-800">
            {props.result.stdout || '(empty)'}
          </pre>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-gray-600">stderr</p>
          <pre className="mt-1 max-h-28 overflow-auto rounded border border-gray-200 bg-white p-2 text-[11px] text-gray-800">
            {props.result.stderr || '(empty)'}
          </pre>
        </div>
      </div>
    </div>
  );
}

function PreviewStateMessage({ state }: { state: WorkspacePreviewState }) {
  if (state === 'loading') {
    return (
      <StateMessage
        tone="neutral"
        heading="Preview loading"
        body="Checking and loading the active session preview."
        action="Wait for preview to finish loading."
      />
    );
  }

  if (state === 'ready') {
    return (
      <StateMessage
        tone="success"
        heading="Preview ready"
        body="The active session preview is rendering."
        action="Use Refresh to reload only this preview."
      />
    );
  }

  if (state === 'unavailable') {
    return (
      <StateMessage
        tone="neutral"
        heading="Preview unavailable"
        body="No running preview is available for this active session yet."
        action="Start a dev server in the session, then choose Refresh."
      />
    );
  }

  return (
    <StateMessage
      tone="error"
      heading="Preview error"
      body="The preview failed to load for this active session."
      action="Choose Refresh to retry the preview surface."
    />
  );
}

function HistorySliceMessage({ state }: { state: 'loading' | 'error' | 'empty' | 'ready' }) {
  if (state === 'loading') {
    return (
      <StateMessage
        tone="neutral"
        heading="History is loading"
        body="Fetching checkpoint history for the selected session."
        action="Please wait a moment."
      />
    );
  }

  if (state === 'error') {
    return (
      <StateMessage
        tone="error"
        heading="History unavailable"
        body="Unable to load checkpoint history."
        action="Try selecting the session again."
      />
    );
  }

  if (state === 'empty') {
    return (
      <StateMessage
        tone="neutral"
        heading="No checkpoints yet"
        body="No checkpoint history is available for this session."
        action="Run a workspace action to create the first checkpoint."
      />
    );
  }

  return (
    <StateMessage
      tone="success"
      heading="History ready"
      body="Checkpoint history loaded."
      action="Choose a checkpoint to inspect details."
    />
  );
}

function HistoryCheckpointList({ checkpoints }: { checkpoints: WorkspaceCheckpoint[] }) {
  return (
    <ul className="mt-2 space-y-2" data-testid="history-checkpoint-list">
      {checkpoints.slice(0, 5).map((checkpoint) => (
        <li key={checkpoint.id} className="rounded border border-gray-200 px-2 py-2">
          <p className="text-xs font-medium text-gray-900 truncate">
            {checkpoint.description || `Checkpoint ${checkpoint.commitHash.slice(0, 7)}`}
          </p>
          <p className="text-xs text-gray-500 font-mono">{checkpoint.commitHash.slice(0, 12)}</p>
        </li>
      ))}
    </ul>
  );
}

function DashboardSliceMessage({ state }: { state: 'loading' | 'error' | 'empty' | 'ready' }) {
  if (state === 'loading') {
    return (
      <StateMessage
        tone="neutral"
        heading="Dashboard is loading"
        body="Retrieving user, usage, and quota summary data."
        action="Please wait a moment."
      />
    );
  }

  if (state === 'error') {
    return (
      <StateMessage
        tone="error"
        heading="Dashboard unavailable"
        body="Unable to load dashboard summary."
        action="Refresh this page to retry."
      />
    );
  }

  if (state === 'empty') {
    return (
      <StateMessage
        tone="neutral"
        heading="No dashboard data yet"
        body="Dashboard data is not available for this user."
        action="Create or select a session, then retry."
      />
    );
  }

  return (
    <StateMessage
      tone="success"
      heading="Dashboard ready"
      body="Dashboard summary loaded."
      action="Review active sessions and quota usage."
    />
  );
}

function DashboardSummary(props: {
  userSummary: WorkspaceUserSummary;
  usageSummary: WorkspaceUsageSummary;
  quotaSummary: WorkspaceQuotaSummary;
}) {
  return (
    <div className="mt-2 space-y-2" data-testid="dashboard-summary-cards">
      <div className="rounded border border-gray-200 px-2 py-2">
        <p className="text-xs font-medium text-gray-900">Current User</p>
        <p className="text-xs text-gray-600 truncate">{props.userSummary.email}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded border border-gray-200 px-2 py-2">
          <p className="text-xs text-gray-500">Active Sessions</p>
          <p className="text-sm font-semibold text-gray-900">
            {props.usageSummary.activeSessions}/{props.quotaSummary.maxActiveSessions}
          </p>
        </div>
        <div className="rounded border border-gray-200 px-2 py-2">
          <p className="text-xs text-gray-500">Sessions (24h)</p>
          <p className="text-sm font-semibold text-gray-900">
            {props.usageSummary.sessionsCreated24h}/{props.quotaSummary.maxSessions24h}
          </p>
        </div>
        <div className="rounded border border-gray-200 px-2 py-2">
          <p className="text-xs text-gray-500">Tokens (24h)</p>
          <p className="text-sm font-semibold text-gray-900">
            {props.usageSummary.tokensUsed24h}/{props.quotaSummary.maxTokens24h}
          </p>
        </div>
      </div>
    </div>
  );
}

function ShellStateMessage({ state }: { state: 'loading' | 'error' | 'empty' | 'ready' }) {
  if (state === 'loading') {
    return (
      <StateMessage
        tone="neutral"
        heading="Workspace is loading"
        body="Loading sessions and preparing baseline workspace panels."
        action="Please wait a moment."
      />
    );
  }

  if (state === 'error') {
    return (
      <StateMessage
        tone="error"
        heading="Workspace unavailable"
        body="Unable to load sessions for the workspace shell."
        action="Refresh this page or sign in again."
      />
    );
  }

  if (state === 'empty') {
    return (
      <StateMessage
        tone="neutral"
        heading="No session selected"
        body="Create or select a session to start using workspace panels."
        action="Use New Session in the sidebar."
      />
    );
  }

  return (
    <StateMessage
      tone="success"
      heading="Workspace ready"
      body="Shell ready. Full panel behavior remains deferred to later slices."
      action="Continue with session selection and checkpoint review."
    />
  );
}

function StateMessage(props: {
  tone: 'neutral' | 'error' | 'success';
  heading: string;
  body: string;
  action: string;
}) {
  const paletteByTone = {
    neutral: 'border-gray-200 bg-gray-50 text-gray-700',
    error: 'border-red-200 bg-red-50 text-red-700',
    success: 'border-green-200 bg-green-50 text-green-700',
  } as const;

  const palette = paletteByTone[props.tone];

  return (
    <div className={`rounded border px-3 py-2 text-sm ${palette}`}>
      <p className="font-semibold">{props.heading}</p>
      <p className="mt-1">{props.body}</p>
      <p className="mt-1 text-xs opacity-90">Action: {props.action}</p>
    </div>
  );
}
