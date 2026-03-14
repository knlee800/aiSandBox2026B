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
import type {
  WorkspaceFileSaveState,
  WorkspaceFileNode,
  WorkspaceFileSurfaceState,
} from './workspace-file-navigation.logic';
import type { WorkspaceCheckpointCreateState } from './workspace-checkpoint-create.logic';
import type { WorkspaceCheckpointRevertState } from './workspace-checkpoint-revert.logic';
import type {
  WorkspaceCheckpointDiffState,
  WorkspaceCheckpointDiffResponse,
} from './workspace-checkpoint-diff.logic';

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
  checkpointCreateState: WorkspaceCheckpointCreateState;
  checkpointCreateError: string | null;
  checkpointDescriptionInput: string;
  onCheckpointDescriptionChange: (value: string) => void;
  onCreateManualCheckpoint: () => Promise<void>;
  checkpointRevertState: WorkspaceCheckpointRevertState;
  checkpointRevertError: string | null;
  checkpointRevertTargetId: string | null;
  onInitiateCheckpointRevert: (checkpointId: string) => void;
  onCancelCheckpointRevert: () => void;
  onConfirmCheckpointRevert: () => Promise<void>;
  checkpointDiffState: WorkspaceCheckpointDiffState;
  checkpointDiffError: string | null;
  checkpointDiffTargetId: string | null;
  checkpointDiffResponse: WorkspaceCheckpointDiffResponse | null;
  onViewCheckpointDiff: (checkpointId: string) => Promise<void>;
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
  fileSurfaceState: WorkspaceFileSurfaceState;
  workspaceFileTree: WorkspaceFileNode[];
  selectedFilePath: string | null;
  selectedFileContent: string;
  fileSaveState: WorkspaceFileSaveState;
  fileSaveError: string | null;
  fileSurfaceError: string | null;
  onSelectWorkspaceFile: (filePath: string) => Promise<void>;
  onEditorContentChange: (content: string) => void;
  onSaveWorkspaceFile: () => Promise<void>;
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
              <WorkspaceEditorPanel
                state={props.fileSurfaceState}
                fileTree={props.workspaceFileTree}
                selectedFilePath={props.selectedFilePath}
                selectedFileContent={props.selectedFileContent}
                saveState={props.fileSaveState}
                saveErrorMessage={props.fileSaveError}
                errorMessage={props.fileSurfaceError}
                onSelectFile={props.onSelectWorkspaceFile}
                onEditorContentChange={props.onEditorContentChange}
                onSaveFile={props.onSaveWorkspaceFile}
              />
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
            <HistoryCreateCheckpointPanel
              selectedSessionId={props.selectedSessionId}
              createState={props.checkpointCreateState}
              createErrorMessage={props.checkpointCreateError}
              descriptionValue={props.checkpointDescriptionInput}
              onDescriptionChange={props.onCheckpointDescriptionChange}
              onCreateCheckpoint={props.onCreateManualCheckpoint}
            />
            {historyState === 'ready' ? (
              <HistoryCheckpointList
                checkpoints={props.checkpoints}
                hasSelectedSession={Boolean(props.selectedSessionId)}
                revertState={props.checkpointRevertState}
                revertErrorMessage={props.checkpointRevertError}
                selectedCheckpointId={props.checkpointRevertTargetId}
                onInitiateRevert={props.onInitiateCheckpointRevert}
                onCancelRevert={props.onCancelCheckpointRevert}
                onConfirmRevert={props.onConfirmCheckpointRevert}
                diffState={props.checkpointDiffState}
                diffErrorMessage={props.checkpointDiffError}
                diffTargetCheckpointId={props.checkpointDiffTargetId}
                diffResponse={props.checkpointDiffResponse}
                onViewDiff={props.onViewCheckpointDiff}
              />
            ) : null}
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

function WorkspaceEditorPanel(props: {
  state: WorkspaceFileSurfaceState;
  fileTree: WorkspaceFileNode[];
  selectedFilePath: string | null;
  selectedFileContent: string;
  saveState: WorkspaceFileSaveState;
  saveErrorMessage: string | null;
  errorMessage: string | null;
  onSelectFile: (filePath: string) => Promise<void>;
  onEditorContentChange: (content: string) => void;
  onSaveFile: () => Promise<void>;
}) {
  const canSave = props.saveState === 'dirty' || props.saveState === 'save-error';

  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-2" data-testid="workspace-editor-panel">
      <EditorStateMessage state={props.state} errorMessage={props.errorMessage} />
      {props.state === 'ready' ? (
        <div className="mt-2 grid gap-2 md:grid-cols-[14rem_1fr]">
          <div className="rounded border border-gray-200 bg-white p-2">
            <p className="text-[11px] font-semibold text-gray-700">Files</p>
            <ul className="mt-2 space-y-1" data-testid="workspace-file-tree">
              {props.fileTree.map((node) => (
                <FileTreeNode
                  key={node.path}
                  node={node}
                  depth={0}
                  selectedFilePath={props.selectedFilePath}
                  onSelectFile={props.onSelectFile}
                />
              ))}
            </ul>
          </div>
          <div className="rounded border border-gray-200 bg-white p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-gray-700">File Content</p>
              <button
                type="button"
                data-testid="workspace-save-file"
                disabled={!canSave || props.saveState === 'saving'}
                onClick={() => void props.onSaveFile()}
                className="rounded bg-blue-600 px-3 py-1 text-xs text-white disabled:bg-blue-300"
              >
                {props.saveState === 'saving' ? 'Saving...' : 'Save'}
              </button>
            </div>
            <p
              className="mt-1 truncate font-mono text-[11px] text-gray-500"
              data-testid="workspace-selected-file-path"
            >
              {props.selectedFilePath ?? '(no file selected)'}
            </p>
            <div className="mt-2" data-testid="workspace-editor-save-state">
              <EditorSaveStateMessage state={props.saveState} errorMessage={props.saveErrorMessage} />
            </div>
            <textarea
              data-testid="workspace-selected-file-content"
              value={props.selectedFileContent}
              onChange={(event) => props.onEditorContentChange(event.target.value)}
              disabled={props.saveState === 'saving'}
              className="mt-2 h-56 w-full resize-none overflow-auto rounded border border-gray-200 bg-gray-50 p-2 font-mono text-[11px] text-gray-800 disabled:bg-gray-100 disabled:text-gray-500"
              spellCheck={false}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EditorSaveStateMessage(props: {
  state: WorkspaceFileSaveState;
  errorMessage: string | null;
}) {
  if (props.state === 'clean') {
    return (
      <StateMessage
        tone="neutral"
        heading="Editor clean"
        body="No unsaved file changes."
        action="Edit content to create pending changes."
      />
    );
  }

  if (props.state === 'dirty') {
    return (
      <StateMessage
        tone="neutral"
        heading="Editor dirty"
        body="Unsaved changes are present for this file."
        action="Choose Save to write changes."
      />
    );
  }

  if (props.state === 'saving') {
    return (
      <StateMessage
        tone="neutral"
        heading="Saving file"
        body="Save request is in flight for this file."
        action="Wait for save to complete."
      />
    );
  }

  if (props.state === 'saved') {
    return (
      <StateMessage
        tone="success"
        heading="File saved"
        body="File changes were saved successfully."
        action="Continue editing or select another file."
      />
    );
  }

  return (
    <StateMessage
      tone="error"
      heading="Save failed"
      body={props.errorMessage ?? 'File save request failed.'}
      action="Retry save for this file."
    />
  );
}

function FileTreeNode(props: {
  node: WorkspaceFileNode;
  depth: number;
  selectedFilePath: string | null;
  onSelectFile: (filePath: string) => Promise<void>;
}) {
  const leftPadding = `${props.depth * 0.75}rem`;
  const isFile = props.node.type === 'file';
  const isSelected = isFile && props.selectedFilePath === props.node.path;

  return (
    <li style={{ paddingLeft: leftPadding }}>
      {isFile ? (
        <button
          type="button"
          data-testid={`workspace-file-node-${props.node.path}`}
          onClick={() => void props.onSelectFile(props.node.path)}
          className={`w-full truncate rounded border px-2 py-1 text-left text-xs ${
            isSelected
              ? 'border-blue-400 bg-blue-50 text-blue-800'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          {props.node.name}
        </button>
      ) : (
        <p className="truncate px-2 py-1 text-xs font-semibold text-gray-600">{props.node.name}/</p>
      )}
      {props.node.children.length ? (
        <ul className="space-y-1">
          {props.node.children.map((childNode) => (
            <FileTreeNode
              key={childNode.path}
              node={childNode}
              depth={props.depth + 1}
              selectedFilePath={props.selectedFilePath}
              onSelectFile={props.onSelectFile}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function EditorStateMessage(props: {
  state: WorkspaceFileSurfaceState;
  errorMessage: string | null;
}) {
  if (props.state === 'loading') {
    return (
      <StateMessage
        tone="neutral"
        heading="Editor loading"
        body="Loading workspace files for the active session."
        action="Wait for file navigation to finish loading."
      />
    );
  }

  if (props.state === 'empty') {
    return (
      <StateMessage
        tone="neutral"
        heading="No file available"
        body="No files were found for the active session workspace."
        action="Run a command that creates files, then select the session again."
      />
    );
  }

  if (props.state === 'error') {
    return (
      <StateMessage
        tone="error"
        heading="Editor unavailable"
        body={props.errorMessage ?? 'Workspace file navigation failed to load.'}
        action="Select the session again to retry."
      />
    );
  }

  return (
    <StateMessage
      tone="success"
      heading="Editor ready"
      body="Workspace file navigation is ready for this active session."
      action="Choose a file from the list to view content."
    />
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

function HistoryCreateCheckpointPanel(props: {
  selectedSessionId: string | null;
  createState: WorkspaceCheckpointCreateState;
  createErrorMessage: string | null;
  descriptionValue: string;
  onDescriptionChange: (value: string) => void;
  onCreateCheckpoint: () => Promise<void>;
}) {
  const isCreating = props.createState === 'creating';
  const canCreate = Boolean(props.selectedSessionId) && !isCreating;

  return (
    <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-2" data-testid="history-create-checkpoint">
      <p className="text-[11px] font-semibold text-gray-700">Save Point</p>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          data-testid="history-checkpoint-description-input"
          value={props.descriptionValue}
          onChange={(event) => props.onDescriptionChange(event.target.value)}
          placeholder="Optional short description"
          maxLength={120}
          disabled={isCreating || !props.selectedSessionId}
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs disabled:bg-gray-100 disabled:text-gray-500"
        />
        <button
          type="button"
          data-testid="history-create-checkpoint-button"
          disabled={!canCreate}
          onClick={() => void props.onCreateCheckpoint()}
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white disabled:bg-blue-300"
        >
          {isCreating ? 'Creating...' : 'Save Point'}
        </button>
      </div>
      <div className="mt-2">
        <HistoryCreateStateMessage
          state={props.createState}
          errorMessage={props.createErrorMessage}
          hasSelectedSession={Boolean(props.selectedSessionId)}
        />
      </div>
    </div>
  );
}

function HistoryCreateStateMessage(props: {
  state: WorkspaceCheckpointCreateState;
  errorMessage: string | null;
  hasSelectedSession: boolean;
}) {
  if (props.state === 'idle') {
    return (
      <StateMessage
        tone="neutral"
        heading="Save point idle"
        body={
          props.hasSelectedSession
            ? 'Create a manual checkpoint for the active session.'
            : 'Select an active session to create a save point.'
        }
        action="Optionally add a short description, then choose Save Point."
      />
    );
  }

  if (props.state === 'creating') {
    return (
      <StateMessage
        tone="neutral"
        heading="Creating save point"
        body="Checkpoint creation request is in flight for the active session."
        action="Wait for completion."
      />
    );
  }

  if (props.state === 'created') {
    return (
      <StateMessage
        tone="success"
        heading="Save point created"
        body="Manual checkpoint created successfully."
        action="History list is refreshed for this session."
      />
    );
  }

  return (
    <StateMessage
      tone="error"
      heading="Save point failed"
      body={props.errorMessage ?? 'Manual checkpoint creation failed.'}
      action="Retry Save Point for the active session."
    />
  );
}

function HistoryCheckpointList(props: {
  checkpoints: WorkspaceCheckpoint[];
  hasSelectedSession: boolean;
  revertState: WorkspaceCheckpointRevertState;
  revertErrorMessage: string | null;
  selectedCheckpointId: string | null;
  onInitiateRevert: (checkpointId: string) => void;
  onCancelRevert: () => void;
  onConfirmRevert: () => Promise<void>;
  diffState: WorkspaceCheckpointDiffState;
  diffErrorMessage: string | null;
  diffTargetCheckpointId: string | null;
  diffResponse: WorkspaceCheckpointDiffResponse | null;
  onViewDiff: (checkpointId: string) => Promise<void>;
}) {
  const isReverting = props.revertState === 'reverting';
  const isConfirming = props.revertState === 'confirming';

  return (
    <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-2" data-testid="history-checkpoint-list-surface">
      <div className="mb-2" data-testid="history-revert-state">
        <HistoryRevertStateMessage
          state={props.revertState}
          errorMessage={props.revertErrorMessage}
          hasSelectedSession={props.hasSelectedSession}
        />
      </div>
      <ul className="space-y-2" data-testid="history-checkpoint-list">
        {props.checkpoints.slice(0, 5).map((checkpoint) => {
          const isSelected = props.selectedCheckpointId === checkpoint.id;
          const canInitiateRevert = props.hasSelectedSession && !isReverting;
          const canConfirm = isSelected && isConfirming && !isReverting;
          const isDiffTarget = props.diffTargetCheckpointId === checkpoint.id;
          const isDiffLoading = props.diffState === 'loading' && isDiffTarget;

          return (
            <li key={checkpoint.id} className="rounded border border-gray-200 bg-white px-2 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {checkpoint.description || `Checkpoint ${checkpoint.commitHash.slice(0, 7)}`}
                  </p>
                  <p className="text-xs text-gray-500 font-mono">{checkpoint.commitHash.slice(0, 12)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    data-testid={`history-diff-button-${checkpoint.id}`}
                    disabled={!props.hasSelectedSession}
                    onClick={() => void props.onViewDiff(checkpoint.id)}
                    className="rounded border border-blue-300 bg-white px-3 py-1 text-xs text-blue-700 disabled:border-gray-200 disabled:text-gray-400"
                  >
                    {isDiffLoading ? 'Loading diff...' : 'View Diff'}
                  </button>
                  <button
                    type="button"
                    data-testid={`history-revert-button-${checkpoint.id}`}
                    disabled={!canInitiateRevert}
                    onClick={() => props.onInitiateRevert(checkpoint.id)}
                    className="rounded bg-blue-600 px-3 py-1 text-xs text-white disabled:bg-blue-300"
                  >
                    {isReverting && isSelected ? 'Reverting...' : 'Revert'}
                  </button>
                </div>
              </div>
              {isSelected && isConfirming ? (
                <div
                  className="mt-2 rounded border border-amber-200 bg-amber-50 p-2"
                  data-testid={`history-revert-confirm-${checkpoint.id}`}
                >
                  <p className="text-xs font-semibold text-amber-800">Confirm revert?</p>
                  <p className="mt-1 text-xs text-amber-700">
                    Restore the active session workspace to this checkpoint.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      data-testid="history-revert-cancel"
                      onClick={props.onCancelRevert}
                      className="rounded border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      data-testid="history-revert-confirm"
                      disabled={!canConfirm}
                      onClick={() => void props.onConfirmRevert()}
                      className="rounded bg-red-600 px-3 py-1 text-xs text-white disabled:bg-red-300"
                    >
                      Confirm Revert
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="mt-2" data-testid="history-diff-state">
        <HistoryDiffStateMessage
          state={props.diffState}
          errorMessage={props.diffErrorMessage}
          hasSelectedSession={props.hasSelectedSession}
        />
      </div>
      <HistoryCheckpointDiffViewer state={props.diffState} diffResponse={props.diffResponse} />
    </div>
  );
}

function HistoryDiffStateMessage(props: {
  state: WorkspaceCheckpointDiffState;
  errorMessage: string | null;
  hasSelectedSession: boolean;
}) {
  if (props.state === 'idle') {
    return (
      <StateMessage
        tone="neutral"
        heading="Diff viewer idle"
        body={
          props.hasSelectedSession
            ? 'Select a checkpoint and choose View Diff.'
            : 'Select an active session to inspect checkpoint diffs.'
        }
        action="Diff fetch is request-driven and scoped to selected session checkpoint."
      />
    );
  }

  if (props.state === 'loading') {
    return (
      <StateMessage
        tone="neutral"
        heading="Loading checkpoint diff"
        body="Diff request is in flight for the selected checkpoint."
        action="Wait for diff content to load."
      />
    );
  }

  if (props.state === 'ready') {
    return (
      <StateMessage
        tone="success"
        heading="Checkpoint diff ready"
        body="Diff content loaded for the selected checkpoint."
        action="Review changed files and patch text below."
      />
    );
  }

  if (props.state === 'empty') {
    return (
      <StateMessage
        tone="neutral"
        heading="No diff changes"
        body="Selected checkpoint has no file diff entries."
        action="Choose another checkpoint to inspect."
      />
    );
  }

  return (
    <StateMessage
      tone="error"
      heading="Checkpoint diff failed"
      body={props.errorMessage ?? 'Checkpoint diff request failed.'}
      action="Retry View Diff for this checkpoint."
    />
  );
}

function HistoryCheckpointDiffViewer(props: {
  state: WorkspaceCheckpointDiffState;
  diffResponse: WorkspaceCheckpointDiffResponse | null;
}) {
  const diffFiles = props.state === 'ready' && props.diffResponse ? props.diffResponse.files : [];

  const filesByStatus = React.useMemo(
    () => ({
      added: diffFiles.filter((file) => file.status === 'added'),
      modified: diffFiles.filter((file) => file.status === 'modified'),
      deleted: diffFiles.filter((file) => file.status === 'deleted'),
    }),
    [diffFiles],
  );
  const fileIds = React.useMemo(
    () => diffFiles.map((file) => `${file.path}::${file.status}`),
    [diffFiles],
  );
  const [selectedFileId, setSelectedFileId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!fileIds.length) {
      setSelectedFileId(null);
      return;
    }
    setSelectedFileId((currentSelection) =>
      currentSelection && fileIds.includes(currentSelection) ? currentSelection : fileIds[0],
    );
  }, [fileIds]);

  const selectedFile =
    diffFiles.find(
      (file) => `${file.path}::${file.status}` === selectedFileId,
    ) ?? diffFiles[0];
  const selectedFileDiffLines = React.useMemo(
    () => parseUnifiedDiffLines(selectedFile?.diff ?? ''),
    [selectedFile?.diff],
  );

  if (props.state !== 'ready' || !props.diffResponse) {
    return null;
  }

  return (
    <div className="mt-2 rounded border border-gray-200 bg-white p-2" data-testid="history-diff-viewer">
      <p className="text-[11px] font-semibold text-gray-700">Checkpoint Diff</p>
      <p className="mt-1 text-[11px] text-gray-500 font-mono" data-testid="history-diff-commit-hash">
        commit {props.diffResponse.commitHash.slice(0, 12)}{' '}
        {props.diffResponse.parentHash ? `← parent ${props.diffResponse.parentHash.slice(0, 12)}` : '(root commit)'}
      </p>
      <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-2" data-testid="history-diff-summary">
        <p className="text-[11px] font-semibold text-gray-700">Changed Files Summary</p>
        <p className="mt-1 text-[11px] text-gray-600" data-testid="history-diff-count-added">
          Added: {filesByStatus.added.length}
        </p>
        <p className="text-[11px] text-gray-600" data-testid="history-diff-count-modified">
          Modified: {filesByStatus.modified.length}
        </p>
        <p className="text-[11px] text-gray-600" data-testid="history-diff-count-deleted">
          Deleted: {filesByStatus.deleted.length}
        </p>
        <div className="mt-2 space-y-2" data-testid="history-diff-file-list">
          {(['added', 'modified', 'deleted'] as const).map((statusGroup) => {
            const groupedFiles = filesByStatus[statusGroup];
            if (!groupedFiles.length) {
              return null;
            }
            return (
              <div key={statusGroup}>
                <p className="text-[11px] font-semibold capitalize text-gray-700">{statusGroup}</p>
                <ul className="mt-1 space-y-1">
                  {groupedFiles.map((file) => {
                    const fileId = `${file.path}::${file.status}`;
                    const isSelected = selectedFile && fileId === `${selectedFile.path}::${selectedFile.status}`;
                    return (
                      <li key={fileId}>
                        <button
                          type="button"
                          data-testid={`history-diff-file-select-${fileId}`}
                          aria-pressed={isSelected}
                          onClick={() => setSelectedFileId(fileId)}
                          className={`w-full truncate rounded border px-2 py-1 text-left font-mono text-[11px] ${
                            isSelected
                              ? 'border-blue-400 bg-blue-50 text-blue-800'
                              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {file.path}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
      {selectedFile ? (
        <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-2">
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                selectedFile.status === 'added'
                  ? 'bg-green-100 text-green-700'
                  : selectedFile.status === 'deleted'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-blue-100 text-blue-700'
              }`}
            >
              {selectedFile.status}
            </span>
            <span className="truncate font-mono text-[11px] text-gray-700">{selectedFile.path}</span>
          </div>
          <div
            className="mt-2 max-h-48 overflow-auto rounded border border-gray-200 bg-white p-2 font-mono text-[11px]"
            data-testid="history-diff-file-content"
          >
            {selectedFileDiffLines.length ? (
              <div className="space-y-0.5" data-testid="history-diff-lines">
                {selectedFileDiffLines.map((line, index) => (
                  <div
                    key={`${line.type}-${index}-${line.content}`}
                    data-testid={`history-diff-line-${line.type}`}
                    className={`whitespace-pre rounded px-1 py-0.5 ${
                      line.type === 'hunk'
                        ? 'border border-amber-200 bg-amber-50 text-amber-800'
                        : line.type === 'added'
                          ? 'border border-green-200 bg-green-50 text-green-800'
                          : line.type === 'removed'
                            ? 'border border-red-200 bg-red-50 text-red-800'
                            : 'text-gray-700'
                    }`}
                  >
                    {line.content || ' '}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">(empty diff)</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type UnifiedDiffLineType = 'hunk' | 'added' | 'removed' | 'context';

interface UnifiedDiffLine {
  type: UnifiedDiffLineType;
  content: string;
}

function parseUnifiedDiffLines(diffText: string): UnifiedDiffLine[] {
  if (!diffText) {
    return [];
  }

  return diffText.split(/\r?\n/).map((line) => ({
    type: getUnifiedDiffLineType(line),
    content: line,
  }));
}

function getUnifiedDiffLineType(line: string): UnifiedDiffLineType {
  if (line.startsWith('@@')) {
    return 'hunk';
  }
  if (line.startsWith('+') && !line.startsWith('+++')) {
    return 'added';
  }
  if (line.startsWith('-') && !line.startsWith('---')) {
    return 'removed';
  }
  return 'context';
}

function HistoryRevertStateMessage(props: {
  state: WorkspaceCheckpointRevertState;
  errorMessage: string | null;
  hasSelectedSession: boolean;
}) {
  if (props.state === 'idle') {
    return (
      <StateMessage
        tone="neutral"
        heading="Revert idle"
        body={
          props.hasSelectedSession
            ? 'Choose a checkpoint entry and use Revert.'
            : 'Select an active session to enable checkpoint revert.'
        }
        action="Revert requests require confirmation before submission."
      />
    );
  }

  if (props.state === 'confirming') {
    return (
      <StateMessage
        tone="neutral"
        heading="Revert confirming"
        body="Revert confirmation is required before request submission."
        action="Choose Confirm Revert to proceed or Cancel to keep current state."
      />
    );
  }

  if (props.state === 'reverting') {
    return (
      <StateMessage
        tone="neutral"
        heading="Reverting workspace"
        body="Revert request is in flight for the selected checkpoint."
        action="Wait for checkpoint, editor, and preview surfaces to refresh."
      />
    );
  }

  if (props.state === 'reverted') {
    return (
      <StateMessage
        tone="success"
        heading="Workspace reverted"
        body="Active session workspace was restored to the selected checkpoint."
        action="Continue from the updated checkpoint state."
      />
    );
  }

  return (
    <StateMessage
      tone="error"
      heading="Revert failed"
      body={props.errorMessage ?? 'Manual checkpoint revert failed.'}
      action="Retry revert from a checkpoint entry."
    />
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
