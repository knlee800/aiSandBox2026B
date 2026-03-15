'use client';

import React from 'react';
import {
  computeDashboardSliceState,
  computeHistorySliceState,
  filterVisibleWorkspaceCheckpoints,
  computeWorkspaceShellState,
  countActiveSessions,
  getSessionLabel,
  type CheckpointDescriptionFilter,
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
  checkpointCompareState: 'idle' | 'selecting' | 'loading' | 'ready' | 'compare-error';
  checkpointCompareError: string | null;
  checkpointCompareBaseId: string | null;
  checkpointCompareTargetId: string | null;
  checkpointCompareResponse: WorkspaceCheckpointDiffResponse | null;
  onStartCheckpointCompare: () => void;
  onCancelCheckpointCompare: () => void;
  onSelectCheckpointCompareBase: (checkpointId: string) => void;
  onSelectCheckpointCompareTarget: (checkpointId: string) => void;
  onRunCheckpointCompare: () => Promise<void>;
  checkpointSnapshotState: 'idle' | 'loading' | 'ready' | 'empty' | 'snapshot-error';
  checkpointSnapshotError: string | null;
  checkpointSnapshotTargetId: string | null;
  checkpointSnapshotResponse: WorkspaceCheckpointDiffResponse | null;
  onViewCheckpointSnapshot: (checkpointId: string) => Promise<void>;
  checkpointLiveOpenState: 'idle' | 'opening' | 'opened' | 'missing' | 'open-error';
  checkpointLiveOpenError: string | null;
  checkpointLiveOpenTargetPath: string | null;
  canOpenCheckpointFileInLiveWorkspace: (filePath: string) => boolean;
  onOpenCheckpointFileInLiveWorkspace: (filePath: string) => Promise<void>;
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
                selectedSessionId={props.selectedSessionId}
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
                compareState={props.checkpointCompareState}
                compareErrorMessage={props.checkpointCompareError}
                compareBaseCheckpointId={props.checkpointCompareBaseId}
                compareTargetCheckpointId={props.checkpointCompareTargetId}
                compareResponse={props.checkpointCompareResponse}
                onStartCompare={props.onStartCheckpointCompare}
                onCancelCompare={props.onCancelCheckpointCompare}
                onSelectCompareBase={props.onSelectCheckpointCompareBase}
                onSelectCompareTarget={props.onSelectCheckpointCompareTarget}
                onRunCompare={props.onRunCheckpointCompare}
                snapshotState={props.checkpointSnapshotState}
                snapshotErrorMessage={props.checkpointSnapshotError}
                snapshotTargetCheckpointId={props.checkpointSnapshotTargetId}
                snapshotResponse={props.checkpointSnapshotResponse}
                onViewSnapshot={props.onViewCheckpointSnapshot}
                liveOpenState={props.checkpointLiveOpenState}
                liveOpenErrorMessage={props.checkpointLiveOpenError}
                liveOpenTargetPath={props.checkpointLiveOpenTargetPath}
                canOpenInLiveWorkspace={props.canOpenCheckpointFileInLiveWorkspace}
                onOpenInLiveWorkspace={props.onOpenCheckpointFileInLiveWorkspace}
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
  selectedSessionId: string | null;
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
  compareState: 'idle' | 'selecting' | 'loading' | 'ready' | 'compare-error';
  compareErrorMessage: string | null;
  compareBaseCheckpointId: string | null;
  compareTargetCheckpointId: string | null;
  compareResponse: WorkspaceCheckpointDiffResponse | null;
  onStartCompare: () => void;
  onCancelCompare: () => void;
  onSelectCompareBase: (checkpointId: string) => void;
  onSelectCompareTarget: (checkpointId: string) => void;
  onRunCompare: () => Promise<void>;
  snapshotState: 'idle' | 'loading' | 'ready' | 'empty' | 'snapshot-error';
  snapshotErrorMessage: string | null;
  snapshotTargetCheckpointId: string | null;
  snapshotResponse: WorkspaceCheckpointDiffResponse | null;
  onViewSnapshot: (checkpointId: string) => Promise<void>;
  liveOpenState: 'idle' | 'opening' | 'opened' | 'missing' | 'open-error';
  liveOpenErrorMessage: string | null;
  liveOpenTargetPath: string | null;
  canOpenInLiveWorkspace: (filePath: string) => boolean;
  onOpenInLiveWorkspace: (filePath: string) => Promise<void>;
}) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [descriptionFilter, setDescriptionFilter] =
    React.useState<CheckpointDescriptionFilter>('all');
  const { visibleCheckpoints, totalMatches } = React.useMemo(
    () =>
      filterVisibleWorkspaceCheckpoints({
        checkpoints: props.checkpoints,
        searchQuery,
        descriptionFilter,
        maxVisible: 5,
      }),
    [props.checkpoints, searchQuery, descriptionFilter],
  );
  const visibleCheckpointIdSet = React.useMemo(
    () => new Set(visibleCheckpoints.map((checkpoint) => checkpoint.id)),
    [visibleCheckpoints],
  );
  const hasVisibleBaseSelection =
    Boolean(props.compareBaseCheckpointId) && visibleCheckpointIdSet.has(props.compareBaseCheckpointId);
  const hasVisibleTargetSelection =
    Boolean(props.compareTargetCheckpointId) && visibleCheckpointIdSet.has(props.compareTargetCheckpointId);

  React.useEffect(() => {
    setSearchQuery('');
    setDescriptionFilter('all');
  }, [props.selectedSessionId]);

  const isReverting = props.revertState === 'reverting';
  const isConfirming = props.revertState === 'confirming';
  const isCompareModeActive = props.compareState !== 'idle';
  const canRunCompare =
    hasVisibleBaseSelection &&
    hasVisibleTargetSelection &&
    props.compareBaseCheckpointId !== props.compareTargetCheckpointId &&
    props.compareState !== 'loading';

  return (
    <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-2" data-testid="history-checkpoint-list-surface">
      <div className="mb-2" data-testid="history-revert-state">
        <HistoryRevertStateMessage
          state={props.revertState}
          errorMessage={props.revertErrorMessage}
          hasSelectedSession={props.hasSelectedSession}
        />
      </div>
      <div className="mb-2 rounded border border-gray-200 bg-white p-2" data-testid="history-search-filter-controls">
        <p className="text-[11px] font-semibold text-gray-700">Checkpoint Search and Filter</p>
        <div className="mt-2 flex flex-col gap-2 md:flex-row">
          <input
            type="text"
            data-testid="history-search-input"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by description or commit hash"
            maxLength={120}
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
          />
          <select
            data-testid="history-description-filter"
            value={descriptionFilter}
            onChange={(event) => setDescriptionFilter(event.target.value as CheckpointDescriptionFilter)}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700"
          >
            <option value="all">All checkpoints</option>
            <option value="with-description">With description</option>
            <option value="without-description">Without description</option>
          </select>
        </div>
        <p className="mt-2 text-[11px] text-gray-600" data-testid="history-search-results-count">
          Showing {visibleCheckpoints.length} of {totalMatches} matching checkpoints
        </p>
      </div>
      <div className="mb-2 rounded border border-gray-200 bg-white p-2" data-testid="history-compare-controls">
        <div className="flex flex-wrap items-center gap-2">
          {isCompareModeActive ? (
            <button
              type="button"
              data-testid="history-compare-cancel"
              disabled={props.compareState === 'loading'}
              onClick={props.onCancelCompare}
              className="rounded border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 disabled:border-gray-200 disabled:text-gray-400"
            >
              Exit Compare
            </button>
          ) : (
            <button
              type="button"
              data-testid="history-compare-start"
              disabled={!props.hasSelectedSession}
              onClick={props.onStartCompare}
              className="rounded border border-blue-300 bg-white px-3 py-1 text-xs text-blue-700 disabled:border-gray-200 disabled:text-gray-400"
            >
              Compare Checkpoints
            </button>
          )}
          {isCompareModeActive ? (
            <button
              type="button"
              data-testid="history-compare-run"
              disabled={!canRunCompare}
              onClick={() => void props.onRunCompare()}
              className="rounded bg-blue-600 px-3 py-1 text-xs text-white disabled:bg-blue-300"
            >
              {props.compareState === 'loading' ? 'Comparing...' : 'Run Compare'}
            </button>
          ) : null}
        </div>
        <div className="mt-2" data-testid="history-compare-state">
          <HistoryCompareStateMessage
            state={props.compareState}
            errorMessage={props.compareErrorMessage}
            hasSelectedSession={props.hasSelectedSession}
            hasBaseSelection={hasVisibleBaseSelection}
            hasTargetSelection={hasVisibleTargetSelection}
          />
        </div>
      </div>
      <div className="mb-1 flex items-center justify-between" data-testid="history-checkpoint-timeline-header">
        <p className="text-[11px] font-semibold text-gray-700">Checkpoint Timeline</p>
        <p className="text-[11px] text-gray-500">Order and focus for visible checkpoints</p>
      </div>
      <div className="mb-2 rounded border border-gray-200 bg-white p-2" data-testid="history-gitlog-header">
        <p className="text-[11px] font-semibold text-gray-700">Checkpoint Git Log</p>
        <p className="text-[11px] text-gray-500">Bounded commit-style view for visible checkpoints</p>
      </div>
      <ul className="space-y-2" data-testid="history-checkpoint-list">
        {visibleCheckpoints.map((checkpoint, index) => {
          const isSelected = props.selectedCheckpointId === checkpoint.id;
          const canInitiateRevert = props.hasSelectedSession && !isReverting;
          const canConfirm = isSelected && isConfirming && !isReverting;
          const isDiffTarget = props.diffTargetCheckpointId === checkpoint.id;
          const isDiffLoading = props.diffState === 'loading' && isDiffTarget;
          const isSnapshotTarget = props.snapshotTargetCheckpointId === checkpoint.id;
          const isSnapshotLoading = props.snapshotState === 'loading' && isSnapshotTarget;
          const isCompareBase = props.compareBaseCheckpointId === checkpoint.id;
          const isCompareTarget = props.compareTargetCheckpointId === checkpoint.id;
          const isTimelineActive = isSelected || isDiffTarget || isCompareBase || isCompareTarget;
          const timelineLabel = checkpoint.description || `Checkpoint ${checkpoint.commitHash.slice(0, 7)}`;
          const focusLabel = isDiffTarget
            ? 'selected for diff'
            : isSelected
              ? 'selected for revert'
              : isCompareBase && isCompareTarget
                ? 'compare base and target'
                : isCompareBase
                  ? 'compare base'
                  : isCompareTarget
                    ? 'compare target'
                    : 'checkpoint available';

          return (
            <li
              key={checkpoint.id}
              className={`relative rounded border px-2 py-2 ${
                isTimelineActive ? 'border-blue-300 bg-blue-50/40' : 'border-gray-200 bg-white'
              }`}
              data-testid={`history-timeline-item-${checkpoint.id}`}
            >
              {index < visibleCheckpoints.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute left-[17px] top-8 h-[calc(100%-1.75rem)] w-px bg-gray-200"
                />
              ) : null}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className={`mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border text-[10px] font-semibold ${
                        isTimelineActive
                          ? 'border-blue-300 bg-blue-100 text-blue-700'
                          : 'border-gray-300 bg-gray-100 text-gray-600'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span
                      aria-hidden
                      className={`mt-1 h-2.5 w-2.5 rounded-full ${
                        isTimelineActive ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{timelineLabel}</p>
                      <p className="text-xs text-gray-500 font-mono">{checkpoint.commitHash.slice(0, 12)}</p>
                      <p className="text-[11px] text-gray-500" data-testid={`history-timeline-time-${checkpoint.id}`}>
                        {checkpoint.createdAt}
                      </p>
                    </div>
                  </div>
                  <div className="mt-1 pl-8" data-testid={`history-timeline-emphasis-${checkpoint.id}`}>
                    <p className="text-[11px] text-gray-600">
                      Timeline focus: {focusLabel}
                    </p>
                  </div>
                  <div
                    className="mt-2 rounded border border-gray-200 bg-gray-50 px-2 py-2 font-mono text-[11px]"
                    data-testid={`history-gitlog-entry-${checkpoint.id}`}
                  >
                    <p className="text-gray-800" data-testid={`history-gitlog-order-${checkpoint.id}`}>
                      * [{index + 1}] {timelineLabel}
                    </p>
                    <p className="mt-1 text-gray-700" data-testid={`history-gitlog-hash-${checkpoint.id}`}>
                      commit {checkpoint.commitHash}
                    </p>
                    <p className="mt-1 text-gray-600" data-testid={`history-gitlog-date-${checkpoint.id}`}>
                      Date: {checkpoint.createdAt}
                    </p>
                    <p className="mt-1 text-gray-600" data-testid={`history-gitlog-focus-${checkpoint.id}`}>
                      Focus: {focusLabel}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {isCompareModeActive ? (
                    <>
                      <button
                        type="button"
                        data-testid={`history-compare-base-button-${checkpoint.id}`}
                        disabled={props.compareState === 'loading'}
                        onClick={() => props.onSelectCompareBase(checkpoint.id)}
                        className={`rounded border px-3 py-1 text-xs ${
                          isCompareBase
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : 'border-gray-300 bg-white text-gray-700 disabled:border-gray-200 disabled:text-gray-400'
                        }`}
                      >
                        {isCompareBase ? 'Base Selected' : 'Set Base'}
                      </button>
                      <button
                        type="button"
                        data-testid={`history-compare-target-button-${checkpoint.id}`}
                        disabled={props.compareState === 'loading'}
                        onClick={() => props.onSelectCompareTarget(checkpoint.id)}
                        className={`rounded border px-3 py-1 text-xs ${
                          isCompareTarget
                            ? 'border-violet-300 bg-violet-50 text-violet-700'
                            : 'border-gray-300 bg-white text-gray-700 disabled:border-gray-200 disabled:text-gray-400'
                        }`}
                      >
                        {isCompareTarget ? 'Target Selected' : 'Set Target'}
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    data-testid={`history-snapshot-button-${checkpoint.id}`}
                    disabled={!props.hasSelectedSession}
                    onClick={() => void props.onViewSnapshot(checkpoint.id)}
                    className="rounded border border-indigo-300 bg-white px-3 py-1 text-xs text-indigo-700 disabled:border-gray-200 disabled:text-gray-400"
                  >
                    {isSnapshotLoading ? 'Loading snapshot...' : 'View Snapshot'}
                  </button>
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
                  className="mt-2 ml-8 rounded border border-amber-200 bg-amber-50 p-2"
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
      {!visibleCheckpoints.length ? (
        <p className="mt-2 text-xs text-gray-500" data-testid="history-search-empty">
          No checkpoints match the current search/filter.
        </p>
      ) : null}
      <div className="mt-2" data-testid="history-diff-state">
        <HistoryDiffStateMessage
          state={props.diffState}
          errorMessage={props.diffErrorMessage}
          hasSelectedSession={props.hasSelectedSession}
        />
      </div>
      <div className="mt-2" data-testid="history-snapshot-state">
        <HistorySnapshotStateMessage
          state={props.snapshotState}
          errorMessage={props.snapshotErrorMessage}
          hasSelectedSession={props.hasSelectedSession}
        />
      </div>
      <div className="mt-2" data-testid="history-open-live-state">
        <HistoryOpenLiveStateMessage
          state={props.liveOpenState}
          errorMessage={props.liveOpenErrorMessage}
          targetPath={props.liveOpenTargetPath}
          hasSelectedSession={props.hasSelectedSession}
        />
      </div>
      <HistoryCheckpointDiffViewer
        state={props.diffState}
        diffResponse={props.diffResponse}
        openLiveState={props.liveOpenState}
        openLiveTargetPath={props.liveOpenTargetPath}
        canOpenInLiveWorkspace={props.canOpenInLiveWorkspace}
        onOpenInLiveWorkspace={props.onOpenInLiveWorkspace}
      />
      <HistoryCheckpointDiffViewer
        state={props.compareState === 'ready' ? 'ready' : 'idle'}
        diffResponse={props.compareState === 'ready' ? props.compareResponse : null}
        openLiveState={props.liveOpenState}
        openLiveTargetPath={props.liveOpenTargetPath}
        canOpenInLiveWorkspace={props.canOpenInLiveWorkspace}
        onOpenInLiveWorkspace={props.onOpenInLiveWorkspace}
      />
      <HistoryCheckpointSnapshotViewer
        state={props.snapshotState}
        snapshotResponse={props.snapshotResponse}
        openLiveState={props.liveOpenState}
        openLiveTargetPath={props.liveOpenTargetPath}
        canOpenInLiveWorkspace={props.canOpenInLiveWorkspace}
        onOpenInLiveWorkspace={props.onOpenInLiveWorkspace}
      />
    </div>
  );
}

function HistoryCompareStateMessage(props: {
  state: 'idle' | 'selecting' | 'loading' | 'ready' | 'compare-error';
  errorMessage: string | null;
  hasSelectedSession: boolean;
  hasBaseSelection: boolean;
  hasTargetSelection: boolean;
}) {
  if (props.state === 'idle') {
    return (
      <StateMessage
        tone="neutral"
        heading="Compare mode idle"
        body={
          props.hasSelectedSession
            ? 'Enter compare mode to select base and target checkpoints.'
            : 'Select an active session before entering compare mode.'
        }
        action="Compare mode runs only inside this history surface."
      />
    );
  }

  if (props.state === 'selecting') {
    return (
      <StateMessage
        tone="neutral"
        heading="Compare mode selecting"
        body={`Base: ${props.hasBaseSelection ? 'selected' : 'not selected'}; Target: ${
          props.hasTargetSelection ? 'selected' : 'not selected'
        }.`}
        action="Choose both checkpoints, then run compare."
      />
    );
  }

  if (props.state === 'loading') {
    return (
      <StateMessage
        tone="neutral"
        heading="Compare mode loading"
        body="Compare request is in flight for selected checkpoint pair."
        action="Wait for compared diff result."
      />
    );
  }

  if (props.state === 'ready') {
    return (
      <StateMessage
        tone="success"
        heading="Compare mode ready"
        body="Compared checkpoint diff is loaded."
        action="Use changed-file summary and diff navigation below."
      />
    );
  }

  return (
    <StateMessage
      tone="error"
      heading="Compare mode failed"
      body={props.errorMessage ?? 'Checkpoint compare request failed.'}
      action="Update base/target selections and retry."
    />
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

function HistorySnapshotStateMessage(props: {
  state: 'idle' | 'loading' | 'ready' | 'empty' | 'snapshot-error';
  errorMessage: string | null;
  hasSelectedSession: boolean;
}) {
  if (props.state === 'idle') {
    return (
      <StateMessage
        tone="neutral"
        heading="Snapshot viewer idle"
        body={
          props.hasSelectedSession
            ? 'Select a checkpoint and choose View Snapshot.'
            : 'Select an active session to inspect checkpoint snapshots.'
        }
        action="Snapshot view is read-only and never edits workspace files."
      />
    );
  }

  if (props.state === 'loading') {
    return (
      <StateMessage
        tone="neutral"
        heading="Loading checkpoint snapshot"
        body="Snapshot request is in flight for the selected checkpoint."
        action="Wait for read-only snapshot content."
      />
    );
  }

  if (props.state === 'ready') {
    return (
      <StateMessage
        tone="success"
        heading="Checkpoint snapshot ready"
        body="Read-only snapshot content loaded for changed files in selected checkpoint."
        action="Review snapshot excerpt below without restoring workspace."
      />
    );
  }

  if (props.state === 'empty') {
    return (
      <StateMessage
        tone="neutral"
        heading="No snapshot content"
        body="Selected checkpoint has no changed files available for snapshot inspection."
        action="Choose another checkpoint to inspect."
      />
    );
  }

  return (
    <StateMessage
      tone="error"
      heading="Checkpoint snapshot failed"
      body={props.errorMessage ?? 'Checkpoint snapshot request failed.'}
      action="Retry View Snapshot for this checkpoint."
    />
  );
}

function HistoryOpenLiveStateMessage(props: {
  state: 'idle' | 'opening' | 'opened' | 'missing' | 'open-error';
  errorMessage: string | null;
  targetPath: string | null;
  hasSelectedSession: boolean;
}) {
  if (props.state === 'idle') {
    return (
      <StateMessage
        tone="neutral"
        heading="Open in live workspace idle"
        body={
          props.hasSelectedSession
            ? 'Choose a history file item and use Open in Live Workspace when available.'
            : 'Select an active session to jump from history file items to live workspace files.'
        }
        action="This action only switches focus to an existing live file and never restores checkpoint content."
      />
    );
  }

  if (props.state === 'opening') {
    return (
      <StateMessage
        tone="neutral"
        heading="Opening live workspace file"
        body={props.targetPath ? `Switching editor focus to ${props.targetPath}.` : 'Switching editor focus.'}
        action="Wait for live file content to load in the existing editor surface."
      />
    );
  }

  if (props.state === 'opened') {
    return (
      <StateMessage
        tone="success"
        heading="Live workspace file opened"
        body={
          props.targetPath
            ? `Editor focus switched to ${props.targetPath} using live workspace navigation.`
            : 'Editor focus switched to the selected live workspace file.'
        }
        action="Continue editing in the live workspace editor."
      />
    );
  }

  if (props.state === 'missing') {
    return (
      <StateMessage
        tone="neutral"
        heading="Live file unavailable"
        body={
          props.targetPath
            ? `The file ${props.targetPath} does not exist in the active live workspace.`
            : 'Selected history file does not exist in the active live workspace.'
        }
        action="No restore, revert, or file write was performed."
      />
    );
  }

  return (
    <StateMessage
      tone="error"
      heading="Open in live workspace failed"
      body={props.errorMessage ?? 'Failed to open selected history file in the live workspace.'}
      action="Select an active session and retry with a file that exists in the live workspace tree."
    />
  );
}

function HistoryCheckpointDiffViewer(props: {
  state: WorkspaceCheckpointDiffState;
  diffResponse: WorkspaceCheckpointDiffResponse | null;
  openLiveState: 'idle' | 'opening' | 'opened' | 'missing' | 'open-error';
  openLiveTargetPath: string | null;
  canOpenInLiveWorkspace: (filePath: string) => boolean;
  onOpenInLiveWorkspace: (filePath: string) => Promise<void>;
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
                    const canOpenInLiveWorkspace = props.canOpenInLiveWorkspace(file.path);
                    const isOpeningThisFile =
                      props.openLiveState === 'opening' && props.openLiveTargetPath === file.path;
                    return (
                      <li key={fileId}>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            data-testid={`history-diff-file-select-${fileId}`}
                            aria-pressed={isSelected}
                            onClick={() => setSelectedFileId(fileId)}
                            className={`min-w-0 flex-1 truncate rounded border px-2 py-1 text-left font-mono text-[11px] ${
                              isSelected
                                ? 'border-blue-400 bg-blue-50 text-blue-800'
                                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {file.path}
                          </button>
                          <button
                            type="button"
                            data-testid={`history-diff-open-live-${fileId}`}
                            disabled={!canOpenInLiveWorkspace || props.openLiveState === 'opening'}
                            onClick={() => void props.onOpenInLiveWorkspace(file.path)}
                            className="shrink-0 rounded border border-blue-300 bg-white px-2 py-1 text-[10px] text-blue-700 disabled:border-gray-200 disabled:text-gray-400"
                          >
                            {isOpeningThisFile
                              ? 'Opening...'
                              : canOpenInLiveWorkspace
                                ? 'Open in Live'
                                : 'Live Missing'}
                          </button>
                        </div>
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

function HistoryCheckpointSnapshotViewer(props: {
  state: 'idle' | 'loading' | 'ready' | 'empty' | 'snapshot-error';
  snapshotResponse: WorkspaceCheckpointDiffResponse | null;
  openLiveState: 'idle' | 'opening' | 'opened' | 'missing' | 'open-error';
  openLiveTargetPath: string | null;
  canOpenInLiveWorkspace: (filePath: string) => boolean;
  onOpenInLiveWorkspace: (filePath: string) => Promise<void>;
}) {
  const snapshotFiles = props.state === 'ready' && props.snapshotResponse ? props.snapshotResponse.files : [];
  const fileIds = React.useMemo(
    () => snapshotFiles.map((file) => `${file.path}::${file.status}`),
    [snapshotFiles],
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
    snapshotFiles.find(
      (file) => `${file.path}::${file.status}` === selectedFileId,
    ) ?? snapshotFiles[0];
  const snapshotLines = React.useMemo(
    () => extractCheckpointSnapshotLines(selectedFile?.diff ?? ''),
    [selectedFile?.diff],
  );

  if (props.state !== 'ready' || !props.snapshotResponse) {
    return null;
  }

  return (
    <div className="mt-2 rounded border border-indigo-200 bg-white p-2" data-testid="history-snapshot-viewer">
      <p className="text-[11px] font-semibold text-indigo-700">Checkpoint File Snapshot (Read-only)</p>
      <p className="mt-1 text-[11px] text-gray-500" data-testid="history-snapshot-readonly-note">
        This is not the live workspace editor file and cannot be edited or saved.
      </p>
      <p className="mt-1 text-[11px] text-gray-500 font-mono" data-testid="history-snapshot-commit-hash">
        commit {props.snapshotResponse.commitHash.slice(0, 12)}{' '}
        {props.snapshotResponse.parentHash
          ? `← parent ${props.snapshotResponse.parentHash.slice(0, 12)}`
          : '(root commit)'}
      </p>
      <div className="mt-2 rounded border border-indigo-100 bg-indigo-50 p-2">
        <p className="text-[11px] font-semibold text-indigo-700">Changed Files</p>
        <ul className="mt-1 space-y-1" data-testid="history-snapshot-file-list">
          {snapshotFiles.map((file) => {
            const fileId = `${file.path}::${file.status}`;
            const isSelected = selectedFile && fileId === `${selectedFile.path}::${selectedFile.status}`;
            const canOpenInLiveWorkspace = props.canOpenInLiveWorkspace(file.path);
            const isOpeningThisFile =
              props.openLiveState === 'opening' && props.openLiveTargetPath === file.path;
            return (
              <li key={fileId}>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    data-testid={`history-snapshot-file-select-${fileId}`}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedFileId(fileId)}
                    className={`min-w-0 flex-1 truncate rounded border px-2 py-1 text-left font-mono text-[11px] ${
                      isSelected
                        ? 'border-indigo-400 bg-indigo-100 text-indigo-800'
                        : 'border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50'
                    }`}
                  >
                    {file.path} ({file.status})
                  </button>
                  <button
                    type="button"
                    data-testid={`history-snapshot-open-live-${fileId}`}
                    disabled={!canOpenInLiveWorkspace || props.openLiveState === 'opening'}
                    onClick={() => void props.onOpenInLiveWorkspace(file.path)}
                    className="shrink-0 rounded border border-indigo-300 bg-white px-2 py-1 text-[10px] text-indigo-700 disabled:border-gray-200 disabled:text-gray-400"
                  >
                    {isOpeningThisFile
                      ? 'Opening...'
                      : canOpenInLiveWorkspace
                        ? 'Open in Live'
                        : 'Live Missing'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      {selectedFile ? (
        <div className="mt-2 rounded border border-indigo-100 bg-indigo-50 p-2">
          <p className="truncate font-mono text-[11px] text-indigo-700" data-testid="history-snapshot-selected-file">
            {selectedFile.path}
          </p>
          <div
            className="mt-2 max-h-48 overflow-auto rounded border border-indigo-200 bg-white p-2 font-mono text-[11px]"
            data-testid="history-snapshot-file-content"
          >
            {selectedFile.status === 'deleted' ? (
              <p className="text-gray-600" data-testid="history-snapshot-file-deleted">
                (file deleted at selected checkpoint)
              </p>
            ) : snapshotLines.length ? (
              <div className="space-y-0.5" data-testid="history-snapshot-lines">
                {snapshotLines.map((line, index) => (
                  <div
                    key={`snapshot-${index}-${line}`}
                    className="whitespace-pre text-gray-800"
                    data-testid="history-snapshot-line"
                  >
                    {line || ' '}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">(no snapshot lines available)</p>
            )}
          </div>
          <p className="mt-1 text-[11px] text-gray-500" data-testid="history-snapshot-excerpt-note">
            Snapshot content is a bounded read-only excerpt derived from checkpoint diff hunks.
          </p>
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

function extractCheckpointSnapshotLines(diffText: string): string[] {
  if (!diffText) {
    return [];
  }

  const lines = diffText.split(/\r?\n/);
  const snapshotLines: string[] = [];

  for (const line of lines) {
    if (
      line.startsWith('diff --git') ||
      line.startsWith('index ') ||
      line.startsWith('@@') ||
      line.startsWith('---') ||
      line.startsWith('+++')
    ) {
      continue;
    }

    if (line.startsWith('+')) {
      snapshotLines.push(line.slice(1));
      continue;
    }

    if (line.startsWith(' ')) {
      snapshotLines.push(line.slice(1));
    }
  }

  return snapshotLines;
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
