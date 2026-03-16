'use client';

import React from 'react';
import {
  computeDashboardSliceState,
  computeHistorySliceState,
  filterVisibleWorkspaceCheckpoints,
  HISTORY_WORKING_SET_MAX_ITEMS,
  reconcileWorkspaceCheckpointWorkingSetIds,
  computeWorkspaceShellState,
  countActiveSessions,
  getSessionLabel,
  toggleWorkspaceCheckpointWorkingSetId,
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
  onAdvanceCheckpointRevertPreview: () => void;
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
  pinnedCompareReferenceCheckpointId: string | null;
  onPinCheckpointCompareReference: (checkpointId: string) => void;
  onClearPinnedCheckpointCompareReference: () => void;
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
                onAdvanceRevertPreview={props.onAdvanceCheckpointRevertPreview}
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
                pinnedCompareReferenceCheckpointId={props.pinnedCompareReferenceCheckpointId}
                onPinCheckpointCompareReference={props.onPinCheckpointCompareReference}
                onClearPinnedCheckpointCompareReference={props.onClearPinnedCheckpointCompareReference}
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

type HistoryCollapsibleSectionKey = 'controls' | 'summaries' | 'inspectors' | 'checkpoint-browser';
type HistorySectionOrderDirection = 'earlier' | 'later';

const HISTORY_COLLAPSIBLE_SECTION_LABELS: Record<HistoryCollapsibleSectionKey, string> = {
  controls: 'Controls',
  summaries: 'Summaries',
  inspectors: 'Inspectors',
  'checkpoint-browser': 'Checkpoint Browser',
};
const DEFAULT_HISTORY_COLLAPSIBLE_SECTION_ORDER: readonly HistoryCollapsibleSectionKey[] = [
  'controls',
  'summaries',
  'inspectors',
  'checkpoint-browser',
];

const DEFAULT_HISTORY_COLLAPSIBLE_SECTION_STATE: Record<HistoryCollapsibleSectionKey, boolean> = {
  controls: false,
  summaries: false,
  inspectors: false,
  'checkpoint-browser': false,
};

export function moveHistoryCollapsibleSectionOrderItem(args: {
  currentOrder: HistoryCollapsibleSectionKey[];
  sectionKey: HistoryCollapsibleSectionKey;
  direction: HistorySectionOrderDirection;
}): HistoryCollapsibleSectionKey[] {
  const normalizedOrder = Array.from(
    new Set(
      args.currentOrder.filter((sectionKey): sectionKey is HistoryCollapsibleSectionKey =>
        DEFAULT_HISTORY_COLLAPSIBLE_SECTION_ORDER.includes(sectionKey),
      ),
    ),
  );
  for (const sectionKey of DEFAULT_HISTORY_COLLAPSIBLE_SECTION_ORDER) {
    if (!normalizedOrder.includes(sectionKey)) {
      normalizedOrder.push(sectionKey);
    }
  }
  const currentIndex = normalizedOrder.indexOf(args.sectionKey);
  if (currentIndex < 0) {
    return normalizedOrder;
  }
  const nextIndex = args.direction === 'earlier' ? currentIndex - 1 : currentIndex + 1;
  if (nextIndex < 0 || nextIndex >= normalizedOrder.length) {
    return normalizedOrder;
  }
  const nextOrder = [...normalizedOrder];
  const [movedSection] = nextOrder.splice(currentIndex, 1);
  nextOrder.splice(nextIndex, 0, movedSection);
  return nextOrder;
}

function HistoryCheckpointList(props: {
  selectedSessionId: string | null;
  checkpoints: WorkspaceCheckpoint[];
  hasSelectedSession: boolean;
  revertState: WorkspaceCheckpointRevertState;
  revertErrorMessage: string | null;
  selectedCheckpointId: string | null;
  onInitiateRevert: (checkpointId: string) => void;
  onAdvanceRevertPreview: () => void;
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
  pinnedCompareReferenceCheckpointId: string | null;
  onPinCheckpointCompareReference: (checkpointId: string) => void;
  onClearPinnedCheckpointCompareReference: () => void;
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
  const [historyContextDensity, setHistoryContextDensity] = React.useState<'compact' | 'expanded'>('compact');
  const [historyFocusMode, setHistoryFocusMode] = React.useState<'off' | 'on'>('off');
  const [historyCollapsibleSectionOrder, setHistoryCollapsibleSectionOrder] = React.useState<
    HistoryCollapsibleSectionKey[]
  >([...DEFAULT_HISTORY_COLLAPSIBLE_SECTION_ORDER]);
  const [collapsedHistorySections, setCollapsedHistorySections] = React.useState<
    Record<HistoryCollapsibleSectionKey, boolean>
  >(DEFAULT_HISTORY_COLLAPSIBLE_SECTION_STATE);
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
  const pinnedReferenceCheckpoint = props.pinnedCompareReferenceCheckpointId
    ? props.checkpoints.find((checkpoint) => checkpoint.id === props.pinnedCompareReferenceCheckpointId) ?? null
    : null;
  const isPinnedReferenceVisible = Boolean(
    pinnedReferenceCheckpoint && visibleCheckpointIdSet.has(pinnedReferenceCheckpoint.id),
  );
  const canUsePinnedAsCompareSelection =
    Boolean(pinnedReferenceCheckpoint) &&
    isPinnedReferenceVisible &&
    props.compareState !== 'loading' &&
    props.compareState !== 'idle';

  React.useEffect(() => {
    setSearchQuery('');
    setDescriptionFilter('all');
  }, [props.selectedSessionId]);

  const isReverting = props.revertState === 'reverting';
  const isPreviewing = props.revertState === 'previewing';
  const isConfirming = props.revertState === 'confirming';
  const isCompareModeActive = props.compareState !== 'idle';
  const canRunCompare =
    hasVisibleBaseSelection &&
    hasVisibleTargetSelection &&
    props.compareBaseCheckpointId !== props.compareTargetCheckpointId &&
    props.compareState !== 'loading';
  const inspectorCheckpoint = React.useMemo(() => {
    const checkpointById = new Map(props.checkpoints.map((checkpoint) => [checkpoint.id, checkpoint]));
    const prioritizedCheckpointIds = [
      props.selectedCheckpointId,
      props.diffTargetCheckpointId,
      props.snapshotTargetCheckpointId,
      props.compareTargetCheckpointId,
      props.compareBaseCheckpointId,
      props.pinnedCompareReferenceCheckpointId,
    ];

    for (const checkpointId of prioritizedCheckpointIds) {
      if (!checkpointId) {
        continue;
      }
      const checkpoint = checkpointById.get(checkpointId);
      if (checkpoint) {
        return checkpoint;
      }
    }

    return null;
  }, [
    props.checkpoints,
    props.selectedCheckpointId,
    props.diffTargetCheckpointId,
    props.snapshotTargetCheckpointId,
    props.compareTargetCheckpointId,
    props.compareBaseCheckpointId,
    props.pinnedCompareReferenceCheckpointId,
  ]);
  const inspectorLabel = inspectorCheckpoint
    ? inspectorCheckpoint.description || `Checkpoint ${inspectorCheckpoint.commitHash.slice(0, 7)}`
    : null;
  const inspectorActedOnStates = React.useMemo(() => {
    if (!inspectorCheckpoint) {
      return [] as string[];
    }

    const actedOnStates: string[] = [];
    if (props.selectedCheckpointId === inspectorCheckpoint.id) {
      actedOnStates.push('selected for revert');
    }
    if (props.diffTargetCheckpointId === inspectorCheckpoint.id) {
      actedOnStates.push('selected for diff');
    }
    if (props.snapshotTargetCheckpointId === inspectorCheckpoint.id) {
      actedOnStates.push('selected for snapshot');
    }
    if (props.compareBaseCheckpointId === inspectorCheckpoint.id) {
      actedOnStates.push('selected as compare base');
    }
    if (props.compareTargetCheckpointId === inspectorCheckpoint.id) {
      actedOnStates.push('selected as compare target');
    }
    if (props.pinnedCompareReferenceCheckpointId === inspectorCheckpoint.id) {
      actedOnStates.push('pinned comparison reference');
    }

    return actedOnStates;
  }, [
    inspectorCheckpoint,
    props.selectedCheckpointId,
    props.diffTargetCheckpointId,
    props.snapshotTargetCheckpointId,
    props.compareBaseCheckpointId,
    props.compareTargetCheckpointId,
    props.pinnedCompareReferenceCheckpointId,
  ]);
  const inspectorChangedFiles = React.useMemo(() => {
    if (!inspectorCheckpoint) {
      return {
        source: 'none' as 'none' | 'diff' | 'snapshot',
        files: [] as Array<{ id: string; path: string; status: 'added' | 'modified' | 'deleted' | null }>,
      };
    }

    if (
      props.diffState === 'ready' &&
      props.diffResponse &&
      props.diffTargetCheckpointId === inspectorCheckpoint.id
    ) {
      const stableFiles = props.diffResponse.files
        .map((file) => ({
          id: `${file.path}::${file.status}`,
          path: file.path,
          status: file.status,
        }))
        .sort((leftFile, rightFile) => leftFile.id.localeCompare(rightFile.id));
      return { source: 'diff' as const, files: stableFiles };
    }

    if (
      props.snapshotState === 'ready' &&
      props.snapshotResponse &&
      props.snapshotTargetCheckpointId === inspectorCheckpoint.id
    ) {
      const stableFiles = props.snapshotResponse.files
        .map((file) => ({
          id: `${file.path}::${file.status}`,
          path: file.path,
          status: file.status,
        }))
        .sort((leftFile, rightFile) => leftFile.id.localeCompare(rightFile.id));
      return { source: 'snapshot' as const, files: stableFiles };
    }

    return {
      source: 'none' as const,
      files: [] as Array<{ id: string; path: string; status: 'added' | 'modified' | 'deleted' | null }>,
    };
  }, [
    inspectorCheckpoint,
    props.diffState,
    props.diffResponse,
    props.diffTargetCheckpointId,
    props.snapshotState,
    props.snapshotResponse,
    props.snapshotTargetCheckpointId,
  ]);
  const [selectedInspectorFileId, setSelectedInspectorFileId] = React.useState<string | null>(null);
  const [workingSetCheckpointIds, setWorkingSetCheckpointIds] = React.useState<string[]>([]);
  const canResetSearchFilter = searchQuery.length > 0 || descriptionFilter !== 'all';
  const canResetPinnedReference = Boolean(props.pinnedCompareReferenceCheckpointId);
  const canResetWorkingSet = workingSetCheckpointIds.length > 0;
  const canResetInspectorSelection = Boolean(selectedInspectorFileId) || inspectorChangedFiles.files.length > 0;
  const canResetAnyTemporaryHistoryState =
    canResetSearchFilter || canResetPinnedReference || canResetWorkingSet || canResetInspectorSelection;

  React.useEffect(() => {
    setSelectedInspectorFileId(null);
    setWorkingSetCheckpointIds([]);
    setHistoryContextDensity('compact');
    setHistoryFocusMode('off');
    setHistoryCollapsibleSectionOrder([...DEFAULT_HISTORY_COLLAPSIBLE_SECTION_ORDER]);
    setCollapsedHistorySections(DEFAULT_HISTORY_COLLAPSIBLE_SECTION_STATE);
  }, [props.selectedSessionId]);

  React.useEffect(() => {
    if (!inspectorChangedFiles.files.length) {
      setSelectedInspectorFileId(null);
      return;
    }
    setSelectedInspectorFileId((currentSelection) =>
      currentSelection && inspectorChangedFiles.files.some((file) => file.id === currentSelection)
        ? currentSelection
        : inspectorChangedFiles.files[0]?.id ?? null,
    );
  }, [inspectorChangedFiles]);
  React.useEffect(() => {
    setWorkingSetCheckpointIds((currentWorkingSetIds) =>
      reconcileWorkspaceCheckpointWorkingSetIds({
        currentWorkingSetIds,
        checkpoints: props.checkpoints,
        maxItems: HISTORY_WORKING_SET_MAX_ITEMS,
      }),
    );
  }, [props.checkpoints]);

  const selectedInspectorFile =
    inspectorChangedFiles.files.find((file) => file.id === selectedInspectorFileId) ??
    inspectorChangedFiles.files[0] ??
    null;
  const resetSearchFilterInputs = (): void => {
    setSearchQuery('');
    setDescriptionFilter('all');
  };
  const resetWorkingSet = (): void => {
    setWorkingSetCheckpointIds([]);
  };
  const resetInspectorSelection = (): void => {
    setSelectedInspectorFileId(inspectorChangedFiles.files[0]?.id ?? null);
  };
  const resetAllTemporaryHistoryState = (): void => {
    resetSearchFilterInputs();
    props.onClearPinnedCheckpointCompareReference();
    resetWorkingSet();
    resetInspectorSelection();
  };
  const isExpandedHistoryContextDensity = historyContextDensity === 'expanded';
  const isHistoryFocusModeActive = historyFocusMode === 'on';
  const collapsibleSectionKeys = React.useMemo(
    () => [...DEFAULT_HISTORY_COLLAPSIBLE_SECTION_ORDER],
    [],
  );
  const collapsedSectionCount = React.useMemo(
    () =>
      collapsibleSectionKeys.reduce(
        (count, sectionKey) => (collapsedHistorySections[sectionKey] ? count + 1 : count),
        0,
      ),
    [collapsedHistorySections, collapsibleSectionKeys],
  );
  const collapsedSectionSummaryItems = React.useMemo(
    () =>
      historyCollapsibleSectionOrder.map((sectionKey) => ({
        sectionKey,
        sectionLabel: HISTORY_COLLAPSIBLE_SECTION_LABELS[sectionKey],
        stateLabel: collapsedHistorySections[sectionKey] ? 'collapsed' : 'expanded',
        isCollapsed: collapsedHistorySections[sectionKey],
      })),
    [collapsedHistorySections, historyCollapsibleSectionOrder],
  );
  const historyCollapsibleSectionOrderSummary = React.useMemo(
    () =>
      historyCollapsibleSectionOrder
        .map((sectionKey) => HISTORY_COLLAPSIBLE_SECTION_LABELS[sectionKey])
        .join(' > '),
    [historyCollapsibleSectionOrder],
  );
  const isEveryHistorySectionCollapsed = collapsedSectionCount === collapsibleSectionKeys.length;
  const isEveryHistorySectionExpanded = collapsedSectionCount === 0;
  const toggleCollapsedHistorySection = React.useCallback((sectionKey: HistoryCollapsibleSectionKey): void => {
    setCollapsedHistorySections((currentState) => ({
      ...currentState,
      [sectionKey]: !currentState[sectionKey],
    }));
  }, []);
  const collapseAllHistorySections = React.useCallback((): void => {
    setCollapsedHistorySections({
      controls: true,
      summaries: true,
      inspectors: true,
      'checkpoint-browser': true,
    });
  }, []);
  const expandAllHistorySections = React.useCallback((): void => {
    setCollapsedHistorySections(DEFAULT_HISTORY_COLLAPSIBLE_SECTION_STATE);
  }, []);
  const moveHistorySectionOrderItem = React.useCallback(
    (sectionKey: HistoryCollapsibleSectionKey, direction: HistorySectionOrderDirection): void => {
      setHistoryCollapsibleSectionOrder((currentOrder) =>
        moveHistoryCollapsibleSectionOrderItem({ currentOrder, sectionKey, direction }),
      );
    },
    [],
  );
  const checkpointListSpacingClass = isHistoryFocusModeActive
    ? isExpandedHistoryContextDensity
      ? 'space-y-2'
      : 'space-y-1'
    : isExpandedHistoryContextDensity
      ? 'space-y-3'
      : 'space-y-2';
  const inspectorChangedFilesSourceLabel =
    inspectorChangedFiles.source === 'diff'
      ? 'loaded checkpoint diff metadata'
      : inspectorChangedFiles.source === 'snapshot'
        ? 'loaded checkpoint snapshot metadata'
        : 'none';
  const workingSetIdSet = React.useMemo(
    () => new Set(workingSetCheckpointIds),
    [workingSetCheckpointIds],
  );
  const checkpointById = React.useMemo(
    () => new Map(props.checkpoints.map((checkpoint) => [checkpoint.id, checkpoint])),
    [props.checkpoints],
  );
  const workingSetCheckpoints = React.useMemo(
    () =>
      workingSetCheckpointIds
        .map((checkpointId) => checkpointById.get(checkpointId))
        .filter((checkpoint): checkpoint is WorkspaceCheckpoint => Boolean(checkpoint)),
    [workingSetCheckpointIds, checkpointById],
  );
  const isCheckpointUnifiedActive = React.useCallback(
    (checkpointId: string): boolean =>
      props.selectedCheckpointId === checkpointId ||
      props.diffTargetCheckpointId === checkpointId ||
      props.snapshotTargetCheckpointId === checkpointId ||
      props.compareBaseCheckpointId === checkpointId ||
      props.compareTargetCheckpointId === checkpointId ||
      props.pinnedCompareReferenceCheckpointId === checkpointId ||
      inspectorCheckpoint?.id === checkpointId,
    [
      props.selectedCheckpointId,
      props.diffTargetCheckpointId,
      props.snapshotTargetCheckpointId,
      props.compareBaseCheckpointId,
      props.compareTargetCheckpointId,
      props.pinnedCompareReferenceCheckpointId,
      inspectorCheckpoint,
    ],
  );
  const activeVisibleCheckpointCount = React.useMemo(
    () => visibleCheckpoints.filter((checkpoint) => isCheckpointUnifiedActive(checkpoint.id)).length,
    [visibleCheckpoints, isCheckpointUnifiedActive],
  );
  const getCheckpointSummaryLabel = React.useCallback(
    (checkpointId: string | null): string => {
      if (!checkpointId) {
        return 'none';
      }
      const checkpoint = checkpointById.get(checkpointId);
      if (!checkpoint) {
        return 'none (not in loaded list)';
      }
      return `${checkpoint.description || `Checkpoint ${checkpoint.commitHash.slice(0, 7)}`} (${checkpoint.commitHash.slice(0, 12)})`;
    },
    [checkpointById],
  );
  const searchSummary = React.useMemo(() => {
    const querySummary = searchQuery.trim().length ? `"${searchQuery.trim()}"` : 'none';
    const descriptionSummary =
      descriptionFilter === 'all'
        ? 'all'
        : descriptionFilter === 'with-description'
          ? 'with description'
          : 'without description';
    return `query ${querySummary}; description ${descriptionSummary}; visible ${visibleCheckpoints.length}/${totalMatches}`;
  }, [descriptionFilter, searchQuery, totalMatches, visibleCheckpoints.length]);
  const revertSummary = React.useMemo(() => {
    if (!props.selectedCheckpointId) {
      return 'none';
    }
    const targetLabel = getCheckpointSummaryLabel(props.selectedCheckpointId);
    return `${props.revertState} -> ${targetLabel}`;
  }, [getCheckpointSummaryLabel, props.revertState, props.selectedCheckpointId]);
  const stateSummaryItems = React.useMemo(
    () => [
      {
        key: 'diff-target',
        title: 'Diff target',
        value: getCheckpointSummaryLabel(props.diffTargetCheckpointId),
      },
      {
        key: 'compare-base',
        title: 'Compare base',
        value: getCheckpointSummaryLabel(props.compareBaseCheckpointId),
      },
      {
        key: 'compare-target',
        title: 'Compare target',
        value: getCheckpointSummaryLabel(props.compareTargetCheckpointId),
      },
      {
        key: 'pinned-reference',
        title: 'Pinned reference',
        value: getCheckpointSummaryLabel(props.pinnedCompareReferenceCheckpointId),
      },
      {
        key: 'snapshot-target',
        title: 'Snapshot target',
        value: getCheckpointSummaryLabel(props.snapshotTargetCheckpointId),
      },
      {
        key: 'revert-target',
        title: 'Revert preview/target',
        value: revertSummary,
      },
      {
        key: 'details-inspector-target',
        title: 'Details inspector target',
        value: inspectorCheckpoint ? getCheckpointSummaryLabel(inspectorCheckpoint.id) : 'none',
      },
      {
        key: 'changed-files-inspector-target',
        title: 'Changed-files inspector target',
        value: inspectorCheckpoint ? getCheckpointSummaryLabel(inspectorCheckpoint.id) : 'none',
      },
      {
        key: 'working-set-count',
        title: 'Working set count',
        value: `${workingSetCheckpoints.length}/${HISTORY_WORKING_SET_MAX_ITEMS}`,
      },
      {
        key: 'search-filter-status',
        title: 'Search/filter status',
        value: searchSummary,
      },
    ],
    [
      getCheckpointSummaryLabel,
      inspectorCheckpoint,
      props.compareBaseCheckpointId,
      props.compareTargetCheckpointId,
      props.diffTargetCheckpointId,
      props.pinnedCompareReferenceCheckpointId,
      props.snapshotTargetCheckpointId,
      revertSummary,
      searchSummary,
      workingSetCheckpoints.length,
    ],
  );
  const compareMetadataSummaryItems = React.useMemo(
    () => [
      {
        key: 'base',
        title: 'Compare base',
        checkpointId: props.compareBaseCheckpointId,
        checkpoint:
          props.compareBaseCheckpointId !== null ? checkpointById.get(props.compareBaseCheckpointId) ?? null : null,
      },
      {
        key: 'target',
        title: 'Compare target',
        checkpointId: props.compareTargetCheckpointId,
        checkpoint:
          props.compareTargetCheckpointId !== null ? checkpointById.get(props.compareTargetCheckpointId) ?? null : null,
      },
    ],
    [checkpointById, props.compareBaseCheckpointId, props.compareTargetCheckpointId],
  );
  const isDiffMetadataReadyForInspector = Boolean(
    inspectorCheckpoint &&
      props.diffState === 'ready' &&
      props.diffResponse &&
      props.diffTargetCheckpointId === inspectorCheckpoint.id,
  );
  const isSnapshotMetadataReadyForInspector = Boolean(
    inspectorCheckpoint &&
      props.snapshotState === 'ready' &&
      props.snapshotResponse &&
      props.snapshotTargetCheckpointId === inspectorCheckpoint.id,
  );
  const openableInspectorFileCount = React.useMemo(
    () => inspectorChangedFiles.files.filter((file) => props.canOpenInLiveWorkspace(file.path)).length,
    [inspectorChangedFiles.files, props.canOpenInLiveWorkspace],
  );
  const selectedInspectorFileCanOpenLive = Boolean(
    selectedInspectorFile && props.canOpenInLiveWorkspace(selectedInspectorFile.path),
  );
  const compareReadinessSummary = React.useMemo(() => {
    if (props.compareState === 'idle') {
      return 'compare mode idle';
    }
    if (!hasVisibleBaseSelection || !hasVisibleTargetSelection) {
      return `base ${hasVisibleBaseSelection ? 'selected' : 'missing'}; target ${
        hasVisibleTargetSelection ? 'selected' : 'missing'
      }`;
    }
    if (props.compareBaseCheckpointId === props.compareTargetCheckpointId) {
      return 'base/target must differ';
    }
    return 'pair ready';
  }, [
    hasVisibleBaseSelection,
    hasVisibleTargetSelection,
    props.compareBaseCheckpointId,
    props.compareState,
    props.compareTargetCheckpointId,
  ]);
  const inspectionReadinessItems = React.useMemo(
    () => [
      {
        key: 'diff-metadata',
        title: 'Diff metadata',
        value: isDiffMetadataReadyForInspector ? 'available' : 'not available',
      },
      {
        key: 'snapshot-metadata',
        title: 'Snapshot metadata',
        value: isSnapshotMetadataReadyForInspector ? 'available' : 'not available',
      },
      {
        key: 'changed-files-metadata',
        title: 'Changed-files metadata',
        value: inspectorChangedFiles.files.length
          ? `available via ${inspectorChangedFiles.source}; ${inspectorChangedFiles.files.length} file entries`
          : 'not available',
      },
      {
        key: 'compare-selection-readiness',
        title: 'Compare selection readiness',
        value: compareReadinessSummary,
      },
      {
        key: 'live-file-jump',
        title: 'Live-file jump availability',
        value: inspectorChangedFiles.files.length
          ? `openable ${openableInspectorFileCount}/${inspectorChangedFiles.files.length}; selected ${
              selectedInspectorFileCanOpenLive ? 'openable' : 'not openable'
            }`
          : 'unavailable (no loaded file entries)',
      },
    ],
    [
      compareReadinessSummary,
      inspectorChangedFiles.files.length,
      inspectorChangedFiles.source,
      isDiffMetadataReadyForInspector,
      isSnapshotMetadataReadyForInspector,
      openableInspectorFileCount,
      selectedInspectorFileCanOpenLive,
    ],
  );
  const currentCheckpointSummary = React.useMemo(
    () => ({
      identity: inspectorCheckpoint ? inspectorLabel ?? `Checkpoint ${inspectorCheckpoint.commitHash.slice(0, 7)}` : 'none',
      fullHash: inspectorCheckpoint ? inspectorCheckpoint.commitHash : 'none',
      timestamp: inspectorCheckpoint ? inspectorCheckpoint.createdAt : 'none',
      description: inspectorCheckpoint
        ? inspectorCheckpoint.description && inspectorCheckpoint.description.trim().length
          ? inspectorCheckpoint.description
          : '(none)'
        : 'none',
      activeRoles: inspectorCheckpoint
        ? inspectorActedOnStates.length
          ? inspectorActedOnStates.join(', ')
          : 'checkpoint available'
        : 'none',
    }),
    [inspectorActedOnStates, inspectorCheckpoint, inspectorLabel],
  );
  const compareActionAvailabilityHint = React.useMemo(() => {
    if (!props.hasSelectedSession) {
      return 'unavailable (no active session)';
    }
    if (props.compareState === 'loading') {
      return 'selection locked while compare is running';
    }
    if (props.compareState === 'idle') {
      return 'start compare available';
    }
    if (!hasVisibleBaseSelection || !hasVisibleTargetSelection) {
      return `set base/target available; run compare unavailable (${hasVisibleBaseSelection ? 'target missing' : 'base missing'})`;
    }
    if (props.compareBaseCheckpointId === props.compareTargetCheckpointId) {
      return 'set base/target available; run compare unavailable (base and target must differ)';
    }
    if (canRunCompare) {
      return 'set base/target available; run compare available';
    }
    return 'set base/target available; run compare unavailable';
  }, [
    canRunCompare,
    hasVisibleBaseSelection,
    hasVisibleTargetSelection,
    props.compareBaseCheckpointId,
    props.compareState,
    props.compareTargetCheckpointId,
    props.hasSelectedSession,
  ]);
  const diffActionAvailabilityHint = React.useMemo(() => {
    if (!props.hasSelectedSession) {
      return 'unavailable (no active session)';
    }
    if (!inspectorCheckpoint) {
      return 'available from checkpoint list; no current context selected';
    }
    if (props.diffState === 'loading' && props.diffTargetCheckpointId === inspectorCheckpoint.id) {
      return 'available; loading for current context';
    }
    return `available; metadata ${isDiffMetadataReadyForInspector ? 'loaded' : 'not loaded yet'}`;
  }, [
    inspectorCheckpoint,
    isDiffMetadataReadyForInspector,
    props.diffState,
    props.diffTargetCheckpointId,
    props.hasSelectedSession,
  ]);
  const snapshotActionAvailabilityHint = React.useMemo(() => {
    if (!props.hasSelectedSession) {
      return 'unavailable (no active session)';
    }
    if (!inspectorCheckpoint) {
      return 'available from checkpoint list; no current context selected';
    }
    if (props.snapshotState === 'loading' && props.snapshotTargetCheckpointId === inspectorCheckpoint.id) {
      return 'available; loading for current context';
    }
    return `available; metadata ${isSnapshotMetadataReadyForInspector ? 'loaded' : 'not loaded yet'}`;
  }, [
    inspectorCheckpoint,
    isSnapshotMetadataReadyForInspector,
    props.hasSelectedSession,
    props.snapshotState,
    props.snapshotTargetCheckpointId,
  ]);
  const liveFileJumpActionAvailabilityHint = React.useMemo(() => {
    if (!props.hasSelectedSession) {
      return 'unavailable (no active session)';
    }
    if (!inspectorChangedFiles.files.length) {
      return 'unavailable (no loaded changed-file metadata)';
    }
    return `available for ${openableInspectorFileCount}/${inspectorChangedFiles.files.length} files; selected ${
      selectedInspectorFileCanOpenLive ? 'openable' : 'not openable'
    }`;
  }, [
    inspectorChangedFiles.files.length,
    openableInspectorFileCount,
    props.hasSelectedSession,
    selectedInspectorFileCanOpenLive,
  ]);
  const revertActionAvailabilityHint = React.useMemo(() => {
    if (!props.hasSelectedSession) {
      return 'unavailable (no active session)';
    }
    if (isReverting) {
      return 'unavailable while revert is running';
    }
    if (!inspectorCheckpoint) {
      return 'available from checkpoint list';
    }
    if (props.selectedCheckpointId === inspectorCheckpoint.id) {
      if (isConfirming) {
        return 'confirm/cancel available for selected checkpoint';
      }
      if (isPreviewing) {
        return 'preview continue/cancel available for selected checkpoint';
      }
      return 'start revert available for selected checkpoint';
    }
    return 'start revert available from checkpoint list';
  }, [
    inspectorCheckpoint,
    isConfirming,
    isPreviewing,
    isReverting,
    props.hasSelectedSession,
    props.selectedCheckpointId,
  ]);
  const actionAvailabilityHintItems = React.useMemo(
    () => [
      {
        key: 'compare-actions',
        title: 'Compare actions',
        value: compareActionAvailabilityHint,
      },
      {
        key: 'diff-actions',
        title: 'Diff actions',
        value: diffActionAvailabilityHint,
      },
      {
        key: 'snapshot-actions',
        title: 'Snapshot actions',
        value: snapshotActionAvailabilityHint,
      },
      {
        key: 'jump-live-file-action',
        title: 'Jump-to-live-file action',
        value: liveFileJumpActionAvailabilityHint,
      },
      {
        key: 'revert-actions',
        title: 'Revert actions',
        value: revertActionAvailabilityHint,
      },
    ],
    [
      compareActionAvailabilityHint,
      diffActionAvailabilityHint,
      liveFileJumpActionAvailabilityHint,
      revertActionAvailabilityHint,
      snapshotActionAvailabilityHint,
    ],
  );
  const checkpointRoleLegendItems = React.useMemo(
    () => [
      {
        key: 'diff-target',
        title: 'Diff target',
        value: getCheckpointSummaryLabel(props.diffTargetCheckpointId),
      },
      {
        key: 'compare-base',
        title: 'Compare base',
        value: getCheckpointSummaryLabel(props.compareBaseCheckpointId),
      },
      {
        key: 'compare-target',
        title: 'Compare target',
        value: getCheckpointSummaryLabel(props.compareTargetCheckpointId),
      },
      {
        key: 'pinned-reference',
        title: 'Pinned reference',
        value: getCheckpointSummaryLabel(props.pinnedCompareReferenceCheckpointId),
      },
      {
        key: 'revert-target',
        title: 'Revert target / preview target',
        value: revertSummary,
      },
      {
        key: 'snapshot-target',
        title: 'Snapshot target',
        value: getCheckpointSummaryLabel(props.snapshotTargetCheckpointId),
      },
      {
        key: 'details-inspector-target',
        title: 'Details inspector target',
        value: inspectorCheckpoint ? getCheckpointSummaryLabel(inspectorCheckpoint.id) : 'none',
      },
      {
        key: 'changed-files-inspector-target',
        title: 'Changed-files inspector target',
        value: inspectorCheckpoint ? getCheckpointSummaryLabel(inspectorCheckpoint.id) : 'none',
      },
    ],
    [
      getCheckpointSummaryLabel,
      inspectorCheckpoint,
      props.compareBaseCheckpointId,
      props.compareTargetCheckpointId,
      props.diffTargetCheckpointId,
      props.pinnedCompareReferenceCheckpointId,
      props.snapshotTargetCheckpointId,
      revertSummary,
    ],
  );
  const historySelectionBreadcrumbItems = React.useMemo(
    () => [
      {
        key: 'current-checkpoint-context',
        title: 'Current checkpoint context',
        value: inspectorCheckpoint ? getCheckpointSummaryLabel(inspectorCheckpoint.id) : 'none',
      },
      {
        key: 'compare-base',
        title: 'Compare base',
        value: getCheckpointSummaryLabel(props.compareBaseCheckpointId),
      },
      {
        key: 'compare-target',
        title: 'Compare target',
        value: getCheckpointSummaryLabel(props.compareTargetCheckpointId),
      },
      {
        key: 'pinned-reference',
        title: 'Pinned reference',
        value: getCheckpointSummaryLabel(props.pinnedCompareReferenceCheckpointId),
      },
      {
        key: 'snapshot-target',
        title: 'Snapshot target',
        value: getCheckpointSummaryLabel(props.snapshotTargetCheckpointId),
      },
      {
        key: 'revert-target',
        title: 'Revert target / preview target',
        value: revertSummary,
      },
      {
        key: 'details-inspector-target',
        title: 'Details inspector target',
        value: inspectorCheckpoint ? getCheckpointSummaryLabel(inspectorCheckpoint.id) : 'none',
      },
      {
        key: 'changed-files-inspector-target',
        title: 'Changed-files inspector target',
        value: inspectorCheckpoint ? getCheckpointSummaryLabel(inspectorCheckpoint.id) : 'none',
      },
    ],
    [
      getCheckpointSummaryLabel,
      inspectorCheckpoint,
      props.compareBaseCheckpointId,
      props.compareTargetCheckpointId,
      props.pinnedCompareReferenceCheckpointId,
      props.snapshotTargetCheckpointId,
      revertSummary,
    ],
  );
  const historyEmptyStateGuidanceItems = React.useMemo(() => {
    const hasSelectedCheckpoint = Boolean(props.selectedCheckpointId);
    const hasCompareBaseSelection = Boolean(props.compareBaseCheckpointId);
    const hasCompareTargetSelection = Boolean(props.compareTargetCheckpointId);
    const hasSnapshotTargetContext = Boolean(props.snapshotTargetCheckpointId);
    const hasActiveCheckpointContext = Boolean(inspectorCheckpoint);
    const hasChangedFilesMetadata = inspectorChangedFiles.files.length > 0;
    const hasWorkingSetMembers = workingSetCheckpoints.length > 0;
    const compareSelectionGuidance =
      hasCompareBaseSelection && hasCompareTargetSelection
        ? `ready (${getCheckpointSummaryLabel(props.compareBaseCheckpointId)} -> ${getCheckpointSummaryLabel(props.compareTargetCheckpointId)})`
        : hasCompareBaseSelection
          ? `target missing (base: ${getCheckpointSummaryLabel(props.compareBaseCheckpointId)})`
          : hasCompareTargetSelection
            ? `base missing (target: ${getCheckpointSummaryLabel(props.compareTargetCheckpointId)})`
            : 'no compare base/target selected';
    const changedFilesGuidance = hasChangedFilesMetadata
      ? `loaded via ${inspectorChangedFiles.source}; ${inspectorChangedFiles.files.length} entries`
      : hasActiveCheckpointContext
        ? 'no changed-files metadata loaded'
        : 'no changed-files metadata loaded (no active checkpoint context)';

    return [
      {
        key: 'selected-checkpoint',
        title: 'Selected checkpoint',
        status: hasSelectedCheckpoint ? 'available' : 'unavailable',
        detail: hasSelectedCheckpoint
          ? getCheckpointSummaryLabel(props.selectedCheckpointId)
          : 'no checkpoint selected',
      },
      {
        key: 'compare-selection',
        title: 'Compare selection',
        status: hasCompareBaseSelection && hasCompareTargetSelection ? 'available' : 'unavailable',
        detail: compareSelectionGuidance,
      },
      {
        key: 'snapshot-target',
        title: 'Snapshot target context',
        status: hasSnapshotTargetContext ? 'available' : 'unavailable',
        detail: hasSnapshotTargetContext
          ? getCheckpointSummaryLabel(props.snapshotTargetCheckpointId)
          : 'no snapshot target context',
      },
      {
        key: 'changed-files-metadata',
        title: 'Changed-files metadata',
        status: hasChangedFilesMetadata ? 'available' : 'unavailable',
        detail: changedFilesGuidance,
      },
      {
        key: 'working-set-members',
        title: 'Working-set members',
        status: hasWorkingSetMembers ? 'available' : 'unavailable',
        detail: hasWorkingSetMembers
          ? `${workingSetCheckpoints.length}/${HISTORY_WORKING_SET_MAX_ITEMS} members`
          : 'no working-set members',
      },
      {
        key: 'active-checkpoint-context',
        title: 'Active checkpoint context',
        status: hasActiveCheckpointContext ? 'available' : 'unavailable',
        detail: hasActiveCheckpointContext ? getCheckpointSummaryLabel(inspectorCheckpoint.id) : 'no active checkpoint context',
      },
    ];
  }, [
    getCheckpointSummaryLabel,
    inspectorChangedFiles.files.length,
    inspectorChangedFiles.source,
    inspectorCheckpoint,
    props.compareBaseCheckpointId,
    props.compareTargetCheckpointId,
    props.selectedCheckpointId,
    props.snapshotTargetCheckpointId,
    workingSetCheckpoints.length,
  ]);

  return (
    <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-2" data-testid="history-checkpoint-list-surface">
      <div className="mb-2" data-testid="history-revert-state">
        <HistoryRevertStateMessage
          state={props.revertState}
          errorMessage={props.revertErrorMessage}
          hasSelectedSession={props.hasSelectedSession}
        />
      </div>
      <div className="mb-2 rounded border border-gray-200 bg-white p-2" data-testid="history-section-collapse-controls">
        <p className="text-[11px] font-semibold text-gray-700">History Section Collapse</p>
        <p className="mt-1 text-[11px] text-gray-600">
          Presentation-only collapse/expand controls for major existing history sections in this active session.
        </p>
        <p className="mt-1 text-[11px] text-gray-600" data-testid="history-section-order-summary">
          Current section order: {historyCollapsibleSectionOrderSummary}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="history-section-toggle-quick-controls">
          <button
            type="button"
            data-testid="history-section-expand-all"
            disabled={isEveryHistorySectionExpanded}
            onClick={expandAllHistorySections}
            className="rounded border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 disabled:border-gray-200 disabled:text-gray-400"
          >
            Expand All
          </button>
          <button
            type="button"
            data-testid="history-section-collapse-all"
            disabled={isEveryHistorySectionCollapsed}
            onClick={collapseAllHistorySections}
            className="rounded border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 disabled:border-gray-200 disabled:text-gray-400"
          >
            Collapse All
          </button>
          <span className="text-[11px] text-gray-600" data-testid="history-section-toggle-all-state">
            Collapsed {collapsedSectionCount}/{collapsibleSectionKeys.length} sections
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="history-section-collapsed-state-summary">
          {collapsedSectionSummaryItems.map((summaryItem) => (
            <span
              key={summaryItem.sectionKey}
              data-testid={`history-section-state-${summaryItem.sectionKey}`}
              className={`rounded border px-2 py-0.5 text-[11px] ${
                summaryItem.isCollapsed
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              {summaryItem.sectionLabel}: {summaryItem.stateLabel}
            </span>
          ))}
        </div>
        <div className="mt-2 space-y-1" data-testid="history-section-order-controls">
          {historyCollapsibleSectionOrder.map((sectionKey, sectionIndex) => {
            const sectionLabel = HISTORY_COLLAPSIBLE_SECTION_LABELS[sectionKey];
            const canMoveEarlier = sectionIndex > 0;
            const canMoveLater = sectionIndex < historyCollapsibleSectionOrder.length - 1;
            return (
              <div
                key={sectionKey}
                className="flex flex-wrap items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-1"
                data-testid={`history-section-order-row-${sectionKey}`}
              >
                <span className="text-[11px] font-medium text-gray-700" data-testid={`history-section-order-label-${sectionKey}`}>
                  {sectionLabel}
                </span>
                <span className="text-[11px] text-gray-500" data-testid={`history-section-order-position-${sectionKey}`}>
                  Position {sectionIndex + 1}/{historyCollapsibleSectionOrder.length}
                </span>
                <button
                  type="button"
                  data-testid={`history-section-order-move-earlier-${sectionKey}`}
                  disabled={!canMoveEarlier}
                  onClick={() => moveHistorySectionOrderItem(sectionKey, 'earlier')}
                  className="rounded border border-gray-300 bg-white px-2 py-0.5 text-[11px] text-gray-700 disabled:border-gray-200 disabled:text-gray-400"
                >
                  Move Earlier
                </button>
                <button
                  type="button"
                  data-testid={`history-section-order-move-later-${sectionKey}`}
                  disabled={!canMoveLater}
                  onClick={() => moveHistorySectionOrderItem(sectionKey, 'later')}
                  className="rounded border border-gray-300 bg-white px-2 py-0.5 text-[11px] text-gray-700 disabled:border-gray-200 disabled:text-gray-400"
                >
                  Move Later
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {historyCollapsibleSectionOrder.map((sectionKey) => {
            const isCollapsed = collapsedHistorySections[sectionKey];
            const sectionLabel = HISTORY_COLLAPSIBLE_SECTION_LABELS[sectionKey];
            return (
              <button
                key={sectionKey}
                type="button"
                data-testid={`history-section-toggle-${sectionKey}`}
                aria-expanded={!isCollapsed}
                onClick={() => toggleCollapsedHistorySection(sectionKey)}
                className={`rounded border px-3 py-1 text-xs ${
                  isCollapsed
                    ? 'border-gray-300 bg-white text-gray-700'
                    : 'border-gray-400 bg-gray-100 text-gray-900'
                }`}
              >
                {isCollapsed ? 'Expand' : 'Collapse'} {sectionLabel}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mb-2" data-testid="history-section-controls-group" data-collapsed={collapsedHistorySections.controls}>
        {collapsedHistorySections.controls ? (
          <p
            className="rounded border border-gray-200 bg-white px-2 py-2 text-[11px] text-gray-600"
            data-testid="history-section-controls-collapsed"
          >
            Controls collapsed. Expand to access search/filter, reset, compare, density, and focus controls.
          </p>
        ) : null}
      </div>
      {!collapsedHistorySections.controls ? (
        <>
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
      <div className="mb-2 rounded border border-emerald-200 bg-emerald-50 p-2" data-testid="history-reset-controls">
        <p className="text-[11px] font-semibold text-emerald-800">History Reset Controls</p>
        <p className="mt-1 text-[11px] text-emerald-700">
          Explicitly clear temporary frontend-only history state for the active session.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="history-reset-search-filter"
            disabled={!props.hasSelectedSession || !canResetSearchFilter}
            onClick={resetSearchFilterInputs}
            className="rounded border border-emerald-300 bg-white px-3 py-1 text-xs text-emerald-700 disabled:border-gray-200 disabled:text-gray-400"
          >
            Reset Search/Filter
          </button>
          <button
            type="button"
            data-testid="history-reset-pinned-reference"
            disabled={!props.hasSelectedSession || !canResetPinnedReference}
            onClick={props.onClearPinnedCheckpointCompareReference}
            className="rounded border border-emerald-300 bg-white px-3 py-1 text-xs text-emerald-700 disabled:border-gray-200 disabled:text-gray-400"
          >
            Clear Pinned Ref
          </button>
          <button
            type="button"
            data-testid="history-reset-working-set"
            disabled={!props.hasSelectedSession || !canResetWorkingSet}
            onClick={resetWorkingSet}
            className="rounded border border-emerald-300 bg-white px-3 py-1 text-xs text-emerald-700 disabled:border-gray-200 disabled:text-gray-400"
          >
            Clear Working Set
          </button>
          <button
            type="button"
            data-testid="history-reset-inspector-selection"
            disabled={!props.hasSelectedSession || !canResetInspectorSelection}
            onClick={resetInspectorSelection}
            className="rounded border border-emerald-300 bg-white px-3 py-1 text-xs text-emerald-700 disabled:border-gray-200 disabled:text-gray-400"
          >
            Reset Inspector Selection
          </button>
          <button
            type="button"
            data-testid="history-reset-all"
            disabled={!props.hasSelectedSession || !canResetAnyTemporaryHistoryState}
            onClick={resetAllTemporaryHistoryState}
            className="rounded bg-emerald-600 px-3 py-1 text-xs text-white disabled:bg-emerald-300"
          >
            Reset All Temporary State
          </button>
        </div>
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
      <div
        className="mb-2 rounded border border-slate-200 bg-slate-50 p-2"
        data-testid="history-context-density-toggle"
      >
        <p className="text-[11px] font-semibold text-slate-800">History Context Density</p>
        <p className="mt-1 text-[11px] text-slate-700" data-testid="history-context-density-caption">
          Presentation-only toggle for context summary density in this active session.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="history-context-density-options">
          <button
            type="button"
            data-testid="history-context-density-compact"
            aria-pressed={historyContextDensity === 'compact'}
            onClick={() => setHistoryContextDensity('compact')}
            className={`rounded border px-3 py-1 text-xs ${
              historyContextDensity === 'compact'
                ? 'border-slate-400 bg-slate-200 text-slate-900'
                : 'border-slate-300 bg-white text-slate-700'
            }`}
          >
            Compact
          </button>
          <button
            type="button"
            data-testid="history-context-density-expanded"
            aria-pressed={historyContextDensity === 'expanded'}
            onClick={() => setHistoryContextDensity('expanded')}
            className={`rounded border px-3 py-1 text-xs ${
              historyContextDensity === 'expanded'
                ? 'border-slate-400 bg-slate-200 text-slate-900'
                : 'border-slate-300 bg-white text-slate-700'
            }`}
          >
            Expanded
          </button>
          <span className="text-[11px] text-slate-700" data-testid="history-context-density-active-mode">
            Active density: {historyContextDensity}
          </span>
        </div>
      </div>
      <div className="mb-2 rounded border border-gray-200 bg-white p-2" data-testid="history-focus-mode-toggle">
        <p className="text-[11px] font-semibold text-gray-800">History Focus Mode</p>
        <p className="mt-1 text-[11px] text-gray-700" data-testid="history-focus-mode-caption">
          Presentation-only toggle to reduce visual noise in this active session history context surface.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="history-focus-mode-options">
          <button
            type="button"
            data-testid="history-focus-mode-off"
            aria-pressed={historyFocusMode === 'off'}
            onClick={() => setHistoryFocusMode('off')}
            className={`rounded border px-3 py-1 text-xs ${
              historyFocusMode === 'off'
                ? 'border-gray-400 bg-gray-200 text-gray-900'
                : 'border-gray-300 bg-white text-gray-700'
            }`}
          >
            Focus Off
          </button>
          <button
            type="button"
            data-testid="history-focus-mode-on"
            aria-pressed={historyFocusMode === 'on'}
            onClick={() => setHistoryFocusMode('on')}
            className={`rounded border px-3 py-1 text-xs ${
              historyFocusMode === 'on'
                ? 'border-gray-400 bg-gray-200 text-gray-900'
                : 'border-gray-300 bg-white text-gray-700'
            }`}
          >
            Focus On
          </button>
          <span className="text-[11px] text-gray-700" data-testid="history-focus-mode-active-mode">
            Active focus mode: {historyFocusMode}
          </span>
        </div>
      </div>
        </>
      ) : null}
      <div className="mb-2" data-testid="history-section-summaries-group" data-collapsed={collapsedHistorySections.summaries}>
        {collapsedHistorySections.summaries ? (
          <p
            className="rounded border border-gray-200 bg-white px-2 py-2 text-[11px] text-gray-600"
            data-testid="history-section-summaries-collapsed"
          >
            Summaries collapsed. Expand to view metadata summaries, readiness, legends, breadcrumb, and guidance.
          </p>
        ) : null}
      </div>
      {!collapsedHistorySections.summaries ? (
        <>
      <div
        className={`mb-2 rounded border p-2 ${
          isHistoryFocusModeActive ? 'border-gray-200 bg-white' : 'border-cyan-200 bg-cyan-50'
        }`}
        data-testid="history-compare-metadata-summary"
        data-focus-mode={historyFocusMode}
      >
        <p className="text-[11px] font-semibold text-cyan-800">Compare Metadata Summary</p>
        <p
          className={`mt-1 text-[11px] text-cyan-700 ${isHistoryFocusModeActive ? 'hidden' : ''}`}
          data-testid="history-compare-metadata-caption"
        >
          Read-only compare base/target metadata from the currently loaded session checkpoint list.
        </p>
        <div
          className={`mt-2 grid sm:grid-cols-2 ${isExpandedHistoryContextDensity ? 'gap-3' : 'gap-2'}`}
          data-density={historyContextDensity}
        >
          {compareMetadataSummaryItems.map((summaryItem) => {
            const identity = summaryItem.checkpoint
              ? summaryItem.checkpoint.description || `Checkpoint ${summaryItem.checkpoint.commitHash.slice(0, 7)}`
              : summaryItem.checkpointId
                ? 'not in loaded list'
                : 'not selected';
            const fullHash = summaryItem.checkpoint
              ? summaryItem.checkpoint.commitHash
              : summaryItem.checkpointId
                ? summaryItem.checkpointId
                : 'none';
            const timestamp = summaryItem.checkpoint ? summaryItem.checkpoint.createdAt : 'none';
            const description = summaryItem.checkpoint
              ? summaryItem.checkpoint.description && summaryItem.checkpoint.description.trim().length
                ? summaryItem.checkpoint.description
                : '(none)'
              : 'none';
            return (
              <div
                key={summaryItem.key}
                className={`rounded border border-cyan-200 bg-white text-cyan-800 ${
                  isExpandedHistoryContextDensity ? 'px-3 py-3 text-xs' : 'px-2 py-2 text-[11px]'
                }`}
                data-testid={`history-compare-metadata-${summaryItem.key}`}
              >
                <p className="font-semibold" data-testid={`history-compare-metadata-${summaryItem.key}-title`}>
                  {summaryItem.title}
                </p>
                <p className="mt-1" data-testid={`history-compare-metadata-${summaryItem.key}-identity`}>
                  Identity: <span className="font-medium text-cyan-900">{identity}</span>
                </p>
                <p className="mt-1 font-mono break-all" data-testid={`history-compare-metadata-${summaryItem.key}-hash`}>
                  Full hash: <span className="text-cyan-700">{fullHash}</span>
                </p>
                <p className="mt-1" data-testid={`history-compare-metadata-${summaryItem.key}-timestamp`}>
                  Timestamp: <span className="font-mono text-cyan-700">{timestamp}</span>
                </p>
                <p className="mt-1" data-testid={`history-compare-metadata-${summaryItem.key}-description`}>
                  Description: <span className="text-cyan-800">{description}</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>
      <div
        className={`mb-2 rounded border p-2 ${
          isHistoryFocusModeActive ? 'border-gray-200 bg-white' : 'border-teal-200 bg-teal-50'
        }`}
        data-testid="history-inspection-readiness-summary"
        data-focus-mode={historyFocusMode}
      >
        <p className="text-[11px] font-semibold text-teal-800">Checkpoint Inspection Readiness</p>
        <p
          className={`mt-1 text-[11px] text-teal-700 ${isHistoryFocusModeActive ? 'hidden' : ''}`}
          data-testid="history-inspection-readiness-caption"
        >
          Read-only readiness for the current checkpoint context from already-loaded metadata and in-surface state.
        </p>
        <p className="mt-1 text-[11px] text-teal-700" data-testid="history-inspection-readiness-target">
          Current context:{' '}
          <span className="font-medium text-teal-900">{inspectorCheckpoint ? inspectorLabel : 'none selected'}</span>
        </p>
        <div
          className={`mt-2 grid sm:grid-cols-2 ${isExpandedHistoryContextDensity ? 'gap-2' : 'gap-1'}`}
          data-testid="history-inspection-readiness-items"
          data-density={historyContextDensity}
        >
          {inspectionReadinessItems.map((readinessItem) => (
            <p
              key={readinessItem.key}
              className={`rounded border border-teal-200 bg-white text-teal-800 ${
                isExpandedHistoryContextDensity ? 'px-3 py-2 text-xs' : 'px-2 py-1 text-[11px]'
              }`}
              data-testid={`history-inspection-readiness-${readinessItem.key}`}
            >
              <span className="font-semibold">{readinessItem.title}:</span>{' '}
              <span className="font-mono text-teal-700 break-all">{readinessItem.value}</span>
            </p>
          ))}
        </div>
      </div>
      <div
        className={`mb-2 rounded border p-2 ${
          isHistoryFocusModeActive ? 'border-gray-200 bg-white' : 'border-slate-200 bg-slate-50'
        }`}
        data-testid="history-current-checkpoint-summary-card"
        data-focus-mode={historyFocusMode}
      >
        <p className="text-[11px] font-semibold text-slate-800">Current Checkpoint Summary</p>
        <p
          className={`mt-1 text-[11px] text-slate-700 ${isHistoryFocusModeActive ? 'hidden' : ''}`}
          data-testid="history-current-checkpoint-summary-caption"
        >
          Read-only current checkpoint context from already-loaded session checkpoint metadata.
        </p>
        <div
          className={`mt-2 text-slate-800 ${isExpandedHistoryContextDensity ? 'space-y-2 text-xs' : 'space-y-1 text-[11px]'}`}
          data-density={historyContextDensity}
        >
          <p data-testid="history-current-checkpoint-summary-identity">
            Identity: <span className="font-medium text-slate-900">{currentCheckpointSummary.identity}</span>
          </p>
          <p className="font-mono break-all" data-testid="history-current-checkpoint-summary-hash">
            Full hash: <span className="text-slate-700">{currentCheckpointSummary.fullHash}</span>
          </p>
          <p data-testid="history-current-checkpoint-summary-timestamp">
            Timestamp: <span className="font-mono text-slate-700">{currentCheckpointSummary.timestamp}</span>
          </p>
          <p data-testid="history-current-checkpoint-summary-description">
            Description: <span className="text-slate-800">{currentCheckpointSummary.description}</span>
          </p>
          <p data-testid="history-current-checkpoint-summary-active-roles">
            Active roles: <span className="text-slate-800">{currentCheckpointSummary.activeRoles}</span>
          </p>
        </div>
      </div>
      <div
        className={`mb-2 rounded border p-2 ${
          isHistoryFocusModeActive ? 'border-gray-200 bg-white' : 'border-fuchsia-200 bg-fuchsia-50'
        }`}
        data-testid="history-action-availability-hints"
        data-focus-mode={historyFocusMode}
      >
        <p className="text-[11px] font-semibold text-fuchsia-800">History Action Availability Hints</p>
        <p
          className={`mt-1 text-[11px] text-fuchsia-700 ${isHistoryFocusModeActive ? 'hidden' : ''}`}
          data-testid="history-action-availability-hints-caption"
        >
          Read-only availability hints from already-derived history state and loaded checkpoint metadata.
        </p>
        <div
          className={`mt-2 grid sm:grid-cols-2 ${isExpandedHistoryContextDensity ? 'gap-2' : 'gap-1'}`}
          data-testid="history-action-availability-hints-items"
          data-density={historyContextDensity}
        >
          {actionAvailabilityHintItems.map((hintItem) => (
            <p
              key={hintItem.key}
              className={`rounded border border-fuchsia-200 bg-white text-fuchsia-800 ${
                isExpandedHistoryContextDensity ? 'px-3 py-2 text-xs' : 'px-2 py-1 text-[11px]'
              }`}
              data-testid={`history-action-availability-hint-${hintItem.key}`}
            >
              <span className="font-semibold">{hintItem.title}:</span>{' '}
              <span className="font-mono text-fuchsia-700 break-all">{hintItem.value}</span>
            </p>
          ))}
        </div>
      </div>
      <div
        className={`mb-2 rounded border p-2 ${
          isHistoryFocusModeActive ? 'border-gray-200 bg-white' : 'border-rose-200 bg-rose-50'
        }`}
        data-testid="history-checkpoint-role-legend"
        data-focus-mode={historyFocusMode}
      >
        <p className="text-[11px] font-semibold text-rose-800">Checkpoint Role Legend</p>
        <p
          className={`mt-1 text-[11px] text-rose-700 ${isHistoryFocusModeActive ? 'hidden' : ''}`}
          data-testid="history-checkpoint-role-legend-caption"
        >
          Read-only legend for existing role labels/highlights from already-derived state and loaded checkpoint
          metadata.
        </p>
        <div
          className={`mt-2 grid sm:grid-cols-2 ${isExpandedHistoryContextDensity ? 'gap-2' : 'gap-1'}`}
          data-testid="history-checkpoint-role-legend-items"
          data-density={historyContextDensity}
        >
          {checkpointRoleLegendItems.map((legendItem) => (
            <p
              key={legendItem.key}
              className={`rounded border border-rose-200 bg-white text-rose-800 ${
                isExpandedHistoryContextDensity ? 'px-3 py-2 text-xs' : 'px-2 py-1 text-[11px]'
              }`}
              data-testid={`history-checkpoint-role-legend-${legendItem.key}`}
            >
              <span className="font-semibold">{legendItem.title}:</span>{' '}
              <span className="font-mono text-rose-700 break-all">{legendItem.value}</span>
            </p>
          ))}
        </div>
      </div>
      <div
        className={`mb-2 rounded border p-2 ${
          isHistoryFocusModeActive ? 'border-gray-200 bg-white' : 'border-lime-200 bg-lime-50'
        }`}
        data-testid="history-selection-breadcrumb"
        data-focus-mode={historyFocusMode}
      >
        <p className="text-[11px] font-semibold text-lime-800">History Selection Breadcrumb</p>
        <p
          className={`mt-1 text-[11px] text-lime-700 ${isHistoryFocusModeActive ? 'hidden' : ''}`}
          data-testid="history-selection-breadcrumb-caption"
        >
          Compact read-only selection trail from already-derived state and loaded checkpoint metadata.
        </p>
        <ol
          className={`mt-2 flex flex-wrap items-center ${isExpandedHistoryContextDensity ? 'gap-2' : 'gap-1'}`}
          data-testid="history-selection-breadcrumb-trail"
          data-density={historyContextDensity}
        >
          {historySelectionBreadcrumbItems.map((breadcrumbItem, index) => (
            <li key={breadcrumbItem.key} className="flex items-center gap-1">
              {index > 0 ? (
                <span className="text-[11px] text-lime-600" aria-hidden="true">
                  {'>'}
                </span>
              ) : null}
              <span
                className={`rounded border border-lime-200 bg-white text-lime-800 ${
                  isExpandedHistoryContextDensity ? 'px-3 py-2 text-xs' : 'px-2 py-1 text-[11px]'
                }`}
                data-testid={`history-selection-breadcrumb-${breadcrumbItem.key}`}
              >
                <span className="font-semibold">{breadcrumbItem.title}:</span>{' '}
                <span className="font-mono text-lime-700 break-all">{breadcrumbItem.value}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div
        className={`mb-2 rounded border p-2 ${
          isHistoryFocusModeActive ? 'border-gray-200 bg-white' : 'border-cyan-200 bg-cyan-50'
        }`}
        data-testid="history-empty-state-guidance"
        data-focus-mode={historyFocusMode}
      >
        <p className="text-[11px] font-semibold text-cyan-800">History Empty-State Guidance</p>
        <p className="mt-1 text-[11px] text-cyan-700" data-testid="history-empty-state-guidance-caption">
          {isExpandedHistoryContextDensity
            ? 'Expanded read-only guidance for empty or unavailable history context from already-derived frontend state and loaded checkpoint metadata.'
            : 'Compact read-only guidance for empty or unavailable history context from already-derived frontend state and loaded checkpoint metadata.'}
        </p>
        <ul
          className={`mt-2 grid sm:grid-cols-2 ${isExpandedHistoryContextDensity ? 'gap-2' : 'gap-1'}`}
          data-testid="history-empty-state-guidance-items"
          data-density={historyContextDensity}
        >
          {historyEmptyStateGuidanceItems.map((guidanceItem) => (
            <li
              key={guidanceItem.key}
              className={`rounded border border-cyan-200 bg-white text-cyan-800 ${
                isExpandedHistoryContextDensity ? 'px-3 py-2 text-xs' : 'px-2 py-1 text-[11px]'
              }`}
              data-testid={`history-empty-state-guidance-${guidanceItem.key}`}
            >
              <span className="font-semibold">{guidanceItem.title}:</span>{' '}
              <span className="font-mono text-cyan-700">{guidanceItem.status}</span>
              <span className="text-cyan-700"> - {guidanceItem.detail}</span>
            </li>
          ))}
        </ul>
      </div>
        </>
      ) : null}
      <div className="mb-2" data-testid="history-section-inspectors-group" data-collapsed={collapsedHistorySections.inspectors}>
        {collapsedHistorySections.inspectors ? (
          <p
            className="rounded border border-gray-200 bg-white px-2 py-2 text-[11px] text-gray-600"
            data-testid="history-section-inspectors-collapsed"
          >
            Inspectors collapsed. Expand to view pinned reference, details, changed-files, and working-set surfaces.
          </p>
        ) : null}
      </div>
      {!collapsedHistorySections.inspectors ? (
        <>
      <div className="mb-2 rounded border border-amber-200 bg-amber-50 p-2" data-testid="history-pinned-reference-state">
        <p className="text-[11px] font-semibold text-amber-800">Pinned Comparison Reference</p>
        {pinnedReferenceCheckpoint ? (
          <>
            <p className="mt-1 text-[11px] text-amber-700" data-testid="history-pinned-reference-label">
              {pinnedReferenceCheckpoint.description ||
                `Checkpoint ${pinnedReferenceCheckpoint.commitHash.slice(0, 7)}`}{' '}
              ({pinnedReferenceCheckpoint.commitHash.slice(0, 12)})
            </p>
            {!isPinnedReferenceVisible ? (
              <p className="mt-1 text-[11px] text-amber-700" data-testid="history-pinned-reference-hidden">
                Pinned reference is currently hidden by the active search/filter.
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="history-pinned-reference-clear"
                onClick={props.onClearPinnedCheckpointCompareReference}
                className="rounded border border-amber-300 bg-white px-3 py-1 text-xs text-amber-700"
              >
                Clear Pinned Ref
              </button>
              <button
                type="button"
                data-testid="history-pinned-reference-view-diff"
                disabled={!props.hasSelectedSession}
                onClick={() => void props.onViewDiff(pinnedReferenceCheckpoint.id)}
                className="rounded border border-blue-300 bg-white px-3 py-1 text-xs text-blue-700 disabled:border-gray-200 disabled:text-gray-400"
              >
                View Diff for Pinned
              </button>
              {isCompareModeActive ? (
                <>
                  <button
                    type="button"
                    data-testid="history-pinned-reference-use-base"
                    disabled={!canUsePinnedAsCompareSelection}
                    onClick={() => props.onSelectCompareBase(pinnedReferenceCheckpoint.id)}
                    className="rounded border border-emerald-300 bg-white px-3 py-1 text-xs text-emerald-700 disabled:border-gray-200 disabled:text-gray-400"
                  >
                    Use Pinned as Base
                  </button>
                  <button
                    type="button"
                    data-testid="history-pinned-reference-use-target"
                    disabled={!canUsePinnedAsCompareSelection}
                    onClick={() => props.onSelectCompareTarget(pinnedReferenceCheckpoint.id)}
                    className="rounded border border-violet-300 bg-white px-3 py-1 text-xs text-violet-700 disabled:border-gray-200 disabled:text-gray-400"
                  >
                    Use Pinned as Target
                  </button>
                </>
              ) : null}
            </div>
          </>
        ) : (
          <p className="mt-1 text-[11px] text-amber-700" data-testid="history-pinned-reference-empty">
            No pinned comparison reference. Pin a checkpoint below to reuse it in diff/compare flows.
          </p>
        )}
      </div>
      <div className="mb-2 rounded border border-gray-200 bg-white p-2" data-testid="history-checkpoint-details-inspector">
        <p className="text-[11px] font-semibold text-gray-700">Checkpoint Details Inspector</p>
        {inspectorCheckpoint ? (
          <div className="mt-2 space-y-1 text-[11px] text-gray-700">
            <p data-testid="history-checkpoint-details-label">
              Label: <span className="font-medium text-gray-900">{inspectorLabel}</span>
            </p>
            <p className="font-mono text-gray-700 break-all" data-testid="history-checkpoint-details-hash">
              Full hash: {inspectorCheckpoint.commitHash}
            </p>
            <p data-testid="history-checkpoint-details-timestamp">
              Timestamp: <span className="font-mono text-gray-700">{inspectorCheckpoint.createdAt}</span>
            </p>
            <p data-testid="history-checkpoint-details-description">
              Description:{' '}
              <span className="text-gray-800">
                {inspectorCheckpoint.description && inspectorCheckpoint.description.trim().length
                  ? inspectorCheckpoint.description
                  : '(none)'}
              </span>
            </p>
            <p data-testid="history-checkpoint-details-acted-on">
              Acted-on states:{' '}
              <span className="text-gray-800">
                {inspectorActedOnStates.length ? inspectorActedOnStates.join(', ') : 'checkpoint available'}
              </span>
            </p>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-gray-500" data-testid="history-checkpoint-details-empty">
            No selected checkpoint details yet. Choose a checkpoint action (diff, snapshot, compare, revert, or pin) to
            inspect it here.
          </p>
        )}
      </div>
      <div className="mb-2 rounded border border-gray-200 bg-white p-2" data-testid="history-checkpoint-changed-files-inspector">
        <p className="text-[11px] font-semibold text-gray-700">Checkpoint Changed Files Inspector</p>
        {inspectorCheckpoint ? (
          <>
            <p className="mt-2 text-[11px] text-gray-700" data-testid="history-changed-files-target">
              Target:{' '}
              <span className="font-medium text-gray-900">
                {inspectorLabel} ({inspectorCheckpoint.commitHash.slice(0, 12)})
              </span>
            </p>
            <p className="mt-1 text-[11px] text-gray-600" data-testid="history-changed-files-source">
              Source: {inspectorChangedFilesSourceLabel}
            </p>
            {inspectorChangedFiles.files.length ? (
              <>
                <ul className="mt-2 space-y-1" data-testid="history-changed-files-list">
                  {inspectorChangedFiles.files.map((file) => {
                    const isSelected = selectedInspectorFile ? selectedInspectorFile.id === file.id : false;
                    return (
                      <li key={file.id}>
                        <button
                          type="button"
                          data-testid={`history-changed-file-select-${file.id}`}
                          aria-pressed={isSelected}
                          onClick={() => setSelectedInspectorFileId(file.id)}
                          className={`flex w-full items-center gap-2 rounded border px-2 py-1 text-left text-[11px] ${
                            isSelected
                              ? 'border-blue-400 bg-blue-50 text-blue-800'
                              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {file.status ? (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                file.status === 'added'
                                  ? 'bg-green-100 text-green-700'
                                  : file.status === 'deleted'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {file.status}
                            </span>
                          ) : null}
                          <span className="truncate font-mono">{file.path}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-[11px] text-gray-600" data-testid="history-changed-files-selected">
                  Selected file:{' '}
                  <span className="font-mono text-gray-700">
                    {selectedInspectorFile?.path ?? '(none)'}
                  </span>
                  {'; '}Status:{' '}
                  <span className="text-gray-700">{selectedInspectorFile?.status ?? '(unavailable)'}</span>
                </p>
              </>
            ) : (
              <p className="mt-2 text-[11px] text-gray-500" data-testid="history-changed-files-unavailable">
                No loaded changed-file metadata for this checkpoint yet. Use View Diff or View Snapshot on this
                checkpoint to load inspectable file entries.
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-[11px] text-gray-500" data-testid="history-changed-files-empty">
            No selected checkpoint changed files yet. Choose a checkpoint action (diff, snapshot, compare, revert, or
            pin) to inspect changed files here.
          </p>
        )}
      </div>
      <div className="mb-2 rounded border border-sky-200 bg-sky-50 p-2" data-testid="history-working-set-state">
        <p className="text-[11px] font-semibold text-sky-800">History Working Set</p>
        <p className="mt-1 text-[11px] text-sky-700" data-testid="history-working-set-count">
          Working set size: {workingSetCheckpoints.length}/{HISTORY_WORKING_SET_MAX_ITEMS}
        </p>
        <p className="mt-1 text-[11px] text-sky-700">
          Temporary session-only review list. Items clear when session context changes.
        </p>
        {workingSetCheckpoints.length ? (
          <ul className="mt-2 space-y-1" data-testid="history-working-set-list">
            {workingSetCheckpoints.map((checkpoint) => {
              const isVisible = visibleCheckpointIdSet.has(checkpoint.id);
              const label = checkpoint.description || `Checkpoint ${checkpoint.commitHash.slice(0, 7)}`;
              return (
                <li
                  key={checkpoint.id}
                  className="flex items-center justify-between gap-2 rounded border border-sky-200 bg-white px-2 py-1"
                  data-testid={`history-working-set-item-${checkpoint.id}`}
                >
                  <p className="min-w-0 truncate text-[11px] text-sky-900">
                    {label} <span className="font-mono text-sky-700">({checkpoint.commitHash.slice(0, 12)})</span>
                  </p>
                  <div className="flex items-center gap-2">
                    {!isVisible ? (
                      <span className="text-[10px] text-sky-700" data-testid={`history-working-set-hidden-${checkpoint.id}`}>
                        Hidden by search/filter
                      </span>
                    ) : null}
                    <button
                      type="button"
                      data-testid={`history-working-set-remove-${checkpoint.id}`}
                      onClick={() =>
                        setWorkingSetCheckpointIds((currentWorkingSetIds) =>
                          toggleWorkspaceCheckpointWorkingSetId({
                            currentWorkingSetIds,
                            checkpointId: checkpoint.id,
                            maxItems: HISTORY_WORKING_SET_MAX_ITEMS,
                          }),
                        )
                      }
                      className="rounded border border-sky-300 bg-white px-2 py-1 text-[11px] text-sky-700"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-[11px] text-sky-700" data-testid="history-working-set-empty">
            No checkpoints in the working set. Use Add to Set on checkpoint entries below.
          </p>
        )}
      </div>
        </>
      ) : null}
      <div className="mb-2 rounded border border-indigo-200 bg-indigo-50 p-2" data-testid="history-unified-active-highlight">
        <p className="text-[11px] font-semibold text-indigo-800">Unified Active Checkpoint Highlight</p>
        <p className="mt-1 text-[11px] text-indigo-700" data-testid="history-unified-active-summary">
          Active checkpoints in visible list: {activeVisibleCheckpointCount}/{visibleCheckpoints.length}
        </p>
        <p className="mt-1 text-[11px] text-indigo-700">
          Active roles are consistently highlighted for diff, compare, pinned reference, revert, snapshot, and
          inspector targets.
        </p>
      </div>
      <div
        className={`mb-2 rounded border p-2 ${
          isHistoryFocusModeActive ? 'border-gray-200 bg-white' : 'border-violet-200 bg-violet-50'
        }`}
        data-testid="history-state-summary-bar"
        data-focus-mode={historyFocusMode}
      >
        <p className="text-[11px] font-semibold text-violet-800">History State Summary</p>
        <p
          className={`mt-1 text-[11px] text-violet-700 ${isHistoryFocusModeActive ? 'hidden' : ''}`}
          data-testid="history-state-summary-caption"
        >
          Compact read-only state for the active session history surface.
        </p>
        <div
          className={`mt-2 grid sm:grid-cols-2 ${isExpandedHistoryContextDensity ? 'gap-2' : 'gap-1'}`}
          data-testid="history-state-summary-items"
          data-density={historyContextDensity}
        >
          {stateSummaryItems.map((summaryItem) => (
            <p
              key={summaryItem.key}
              className={`rounded border border-violet-200 bg-white text-violet-800 ${
                isExpandedHistoryContextDensity ? 'px-3 py-2 text-xs' : 'px-2 py-1 text-[11px]'
              }`}
              data-testid={`history-state-summary-${summaryItem.key}`}
            >
              <span className="font-semibold">{summaryItem.title}:</span>{' '}
              <span className="font-mono text-violet-700 break-all">{summaryItem.value}</span>
            </p>
          ))}
        </div>
      </div>
      <div
        className="mb-2"
        data-testid="history-section-checkpoint-browser-group"
        data-collapsed={collapsedHistorySections['checkpoint-browser']}
      >
        {collapsedHistorySections['checkpoint-browser'] ? (
          <p
            className="rounded border border-gray-200 bg-white px-2 py-2 text-[11px] text-gray-600"
            data-testid="history-section-checkpoint-browser-collapsed"
          >
            Checkpoint browser collapsed. Expand to view timeline, git-log entries, and checkpoint action list.
          </p>
        ) : null}
      </div>
      {!collapsedHistorySections['checkpoint-browser'] ? (
        <>
      <div className="mb-1 flex items-center justify-between" data-testid="history-checkpoint-timeline-header">
        <p className="text-[11px] font-semibold text-gray-700">Checkpoint Timeline</p>
        <p className="text-[11px] text-gray-500">Order and focus for visible checkpoints</p>
      </div>
      <div className="mb-2 rounded border border-gray-200 bg-white p-2" data-testid="history-gitlog-header">
        <p className="text-[11px] font-semibold text-gray-700">Checkpoint Git Log</p>
        <p className="text-[11px] text-gray-500">Bounded commit-style view for visible checkpoints</p>
      </div>
      <ul
        className={checkpointListSpacingClass}
        data-testid="history-checkpoint-list"
        data-focus-mode={historyFocusMode}
      >
        {visibleCheckpoints.map((checkpoint, index) => {
          const isSelected = props.selectedCheckpointId === checkpoint.id;
          const canInitiateRevert = props.hasSelectedSession && !isReverting;
          const canConfirm = isSelected && isConfirming && !isReverting;
          const isSelectedForPreview = isSelected && isPreviewing;
          const isSelectedForConfirm = isSelected && isConfirming;
          const isDiffTarget = props.diffTargetCheckpointId === checkpoint.id;
          const isDiffLoading = props.diffState === 'loading' && isDiffTarget;
          const isSnapshotTarget = props.snapshotTargetCheckpointId === checkpoint.id;
          const isSnapshotLoading = props.snapshotState === 'loading' && isSnapshotTarget;
          const isCompareBase = props.compareBaseCheckpointId === checkpoint.id;
          const isCompareTarget = props.compareTargetCheckpointId === checkpoint.id;
          const isPinnedReference = props.pinnedCompareReferenceCheckpointId === checkpoint.id;
          const isDetailsInspectorTarget = inspectorCheckpoint?.id === checkpoint.id;
          const isChangedFilesInspectorTarget = inspectorCheckpoint?.id === checkpoint.id;
          const isInWorkingSet = workingSetIdSet.has(checkpoint.id);
          const canAddToWorkingSet =
            !isInWorkingSet && workingSetCheckpointIds.length < HISTORY_WORKING_SET_MAX_ITEMS;
          const isTimelineActive = isCheckpointUnifiedActive(checkpoint.id);
          const timelineLabel = checkpoint.description || `Checkpoint ${checkpoint.commitHash.slice(0, 7)}`;
          const activeRoleLabels = [
            isSelected ? 'revert target' : null,
            isDiffTarget ? 'diff target' : null,
            isSnapshotTarget ? 'snapshot target' : null,
            isCompareBase ? 'compare base' : null,
            isCompareTarget ? 'compare target' : null,
            isPinnedReference ? 'pinned reference' : null,
            isDetailsInspectorTarget ? 'details inspector target' : null,
            isChangedFilesInspectorTarget ? 'changed-files inspector target' : null,
          ].filter((roleLabel): roleLabel is string => Boolean(roleLabel));
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
                    : isPinnedReference
                      ? 'pinned compare reference'
                    : 'checkpoint available';

          return (
            <li
              key={checkpoint.id}
              className={`relative rounded border px-2 ${
                isExpandedHistoryContextDensity ? 'py-3' : 'py-2'
              } ${
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
                    {isInWorkingSet ? (
                      <p className="text-[11px] text-sky-700" data-testid={`history-working-set-member-${checkpoint.id}`}>
                        Working set member
                      </p>
                    ) : null}
                    {activeRoleLabels.length ? (
                      <div
                        className="mt-1 flex flex-wrap gap-1"
                        data-testid={`history-active-highlight-${checkpoint.id}`}
                      >
                        {activeRoleLabels.map((roleLabel) => (
                          <span
                            key={roleLabel}
                            className="rounded border border-indigo-300 bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800"
                          >
                            {roleLabel}
                          </span>
                        ))}
                      </div>
                    ) : null}
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
                  <button
                    type="button"
                    data-testid={`history-working-set-toggle-${checkpoint.id}`}
                    disabled={!props.hasSelectedSession || (!isInWorkingSet && !canAddToWorkingSet)}
                    onClick={() =>
                      setWorkingSetCheckpointIds((currentWorkingSetIds) =>
                        toggleWorkspaceCheckpointWorkingSetId({
                          currentWorkingSetIds,
                          checkpointId: checkpoint.id,
                          maxItems: HISTORY_WORKING_SET_MAX_ITEMS,
                        }),
                      )
                    }
                    className={`rounded border px-3 py-1 text-xs ${
                      isInWorkingSet
                        ? 'border-sky-300 bg-sky-50 text-sky-700'
                        : 'border-sky-300 bg-white text-sky-700 disabled:border-gray-200 disabled:text-gray-400'
                    }`}
                  >
                    {isInWorkingSet ? 'Remove from Set' : 'Add to Set'}
                  </button>
                  <button
                    type="button"
                    data-testid={`history-pin-button-${checkpoint.id}`}
                    disabled={!props.hasSelectedSession}
                    onClick={() =>
                      isPinnedReference
                        ? props.onClearPinnedCheckpointCompareReference()
                        : props.onPinCheckpointCompareReference(checkpoint.id)
                    }
                    className={`rounded border px-3 py-1 text-xs ${
                      isPinnedReference
                        ? 'border-amber-300 bg-amber-50 text-amber-700'
                        : 'border-amber-300 bg-white text-amber-700 disabled:border-gray-200 disabled:text-gray-400'
                    }`}
                  >
                    {isPinnedReference ? 'Pinned Ref' : 'Pin Ref'}
                  </button>
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
              {isSelectedForPreview ? (
                <div
                  className="mt-2 ml-8 rounded border border-indigo-200 bg-indigo-50 p-2"
                  data-testid={`history-revert-preview-${checkpoint.id}`}
                >
                  <p className="text-xs font-semibold text-indigo-800" data-testid="history-revert-preview-target">
                    Revert preview target: {timelineLabel} ({checkpoint.commitHash.slice(0, 12)})
                  </p>
                  <p className="mt-1 text-xs text-indigo-700">
                    Confirming will restore the active session workspace to this checkpoint. Use diff/snapshot preview
                    buttons below to inspect target context first.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      data-testid="history-revert-preview-view-diff"
                      disabled={!props.hasSelectedSession}
                      onClick={() => void props.onViewDiff(checkpoint.id)}
                      className="rounded border border-blue-300 bg-white px-3 py-1 text-xs text-blue-700 disabled:border-gray-200 disabled:text-gray-400"
                    >
                      {isDiffLoading ? 'Loading diff...' : 'Preview Target Diff'}
                    </button>
                    <button
                      type="button"
                      data-testid="history-revert-preview-view-snapshot"
                      disabled={!props.hasSelectedSession}
                      onClick={() => void props.onViewSnapshot(checkpoint.id)}
                      className="rounded border border-indigo-300 bg-white px-3 py-1 text-xs text-indigo-700 disabled:border-gray-200 disabled:text-gray-400"
                    >
                      {isSnapshotLoading ? 'Loading snapshot...' : 'Preview Target Snapshot'}
                    </button>
                    <button
                      type="button"
                      data-testid="history-revert-preview-cancel"
                      onClick={props.onCancelRevert}
                      className="rounded border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      data-testid="history-revert-preview-continue"
                      disabled={!props.hasSelectedSession}
                      onClick={props.onAdvanceRevertPreview}
                      className="rounded bg-amber-600 px-3 py-1 text-xs text-white disabled:bg-amber-300"
                    >
                      Continue to Confirm
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-indigo-700" data-testid="history-revert-preview-diff-state">
                    Diff preview status for target: {isDiffTarget ? props.diffState : 'idle'}
                  </p>
                  <p className="mt-1 text-[11px] text-indigo-700" data-testid="history-revert-preview-snapshot-state">
                    Snapshot preview status for target: {isSnapshotTarget ? props.snapshotState : 'idle'}
                  </p>
                </div>
              ) : null}
              {isSelectedForConfirm ? (
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
        </>
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

  if (props.state === 'previewing') {
    return (
      <StateMessage
        tone="neutral"
        heading="Revert previewing"
        body="Review target checkpoint metadata and optional diff/snapshot previews before confirmation."
        action="Use Continue to Confirm, then Confirm Revert to execute."
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
