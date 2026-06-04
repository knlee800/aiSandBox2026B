'use client';

import React from 'react';
import { PROJECT_FIRST_UX } from '@/lib/feature-flags';
import { getRecoveryCopy } from '@/lib/recovery-copy';
import WorkspaceSidebar, {
  getWorkspaceScaffoldMessages,
  type WorkspaceSidebarRecentProject,
  type WorkspaceView,
} from './workspace-sidebar';
import WorkspaceProjectCard from './workspace-project-card';
import WorkspaceTemplateCard from './workspace-template-card';
import {
  computeDashboardSliceState,
  computeHistorySliceState,
  filterVisibleWorkspaceCheckpoints,
  HISTORY_WORKING_SET_MAX_ITEMS,
  reconcileWorkspaceCheckpointWorkingSetIds,
  computeWorkspaceShellState,
  countActiveSessions,
  getSessionLabel,
  isUsableSession,
  toggleWorkspaceCheckpointWorkingSetId,
  type CheckpointDescriptionFilter,
  type WorkspaceCheckpoint,
  type WorkspaceQuotaSummary,
  type WorkspaceShellSession,
  type WorkspaceUsageSummary,
  type WorkspaceUserSummary,
} from './workspace-shell.logic';
import type { WorkspaceExecState } from './workspace-exec.logic';
import type { WorkspacePreviewState, SelectedPreviewElement } from './workspace-preview.logic';
import {
  generatePickerScriptSource,
  getPickerScriptId,
  getPickerOverlayId,
  isVisualEditElementSelectedMessage,
  isValidVisualEditMessageOriginAndSource,
} from './workspace-preview.logic';
import {
  readWorkspaceFile,
  type WorkspaceFileSaveState,
  type WorkspaceFileNode,
  type WorkspaceFileSurfaceState,
} from './workspace-file-navigation.logic';
import type { WorkspaceCheckpointCreateState } from './workspace-checkpoint-create.logic';
import type { WorkspaceCheckpointRevertState } from './workspace-checkpoint-revert.logic';
import type {
  WorkspaceCheckpointDiffState,
  WorkspaceCheckpointDiffResponse,
} from './workspace-checkpoint-diff.logic';
import type { WorkspaceExecutionFileActionState } from './workspace-ai-file-actions.logic';
import { DIFF_MAX_LINES, computeLineDiff, type FileDiffResult } from './workspace-diff.logic';
import {
  parseProjectScopedSnapshotHint,
  parseProjectScopedSnapshotName,
  parseProjectScopedSnapshotSource,
  type WorkspaceSnapshotSummary,
} from './workspace-snapshots.logic';
import type {
  WorkspaceProjectSummary,
  WorkspacePublicProjectDetail,
  WorkspacePublicProjectSummary,
} from './workspace-projects.logic';
import type { Workspace } from './workspace-workspaces.logic';
import enMessages from '@/messages/en.json';
import zhTwMessages from '@/messages/zh-TW.json';
import zhCnMessages from '@/messages/zh-CN.json';
import WorkspaceTabBar from './workspace-tab-bar';
import type { WorkspaceTabBarTab } from './workspace-tab-bar';
import {
  TAB_REGISTRY,
  DEFAULT_ACTIVE_TAB_ID,
  DEFAULT_TAB_ORIENTATION,
  TAB_ORIENTATION_STORAGE_KEY,
  AI_PANEL_COLLAPSED_STORAGE_KEY,
  type TabOrientation,
} from './workspace-tab-registry';
import { ChatBubbleLeftIcon, ClockIcon } from '@heroicons/react/24/outline';

let recoveryCopy = getRecoveryCopy('en');

const projectFirstUxAnchors = {
  enabled: PROJECT_FIRST_UX,
  copy: recoveryCopy,
};
void projectFirstUxAnchors;

function getProjectModeBackLabel(locale: string): string {
  if (locale === 'zh-TW') return zhTwMessages.common.back;
  if (locale === 'zh-CN') return zhCnMessages.common.back;
  return enMessages.common.back;
}

function getTabMessages(locale: string): typeof enMessages.tabs {
  if (locale === 'zh-TW') return zhTwMessages.tabs;
  if (locale === 'zh-CN') return zhCnMessages.tabs;
  return enMessages.tabs;
}

function getProjectPanelMessages(locale: string): typeof enMessages.project {
  if (locale === 'zh-TW') return zhTwMessages.project;
  if (locale === 'zh-CN') return zhCnMessages.project;
  return enMessages.project;
}

function getCommonMessages(locale: string): typeof enMessages.common {
  if (locale === 'zh-TW') return zhTwMessages.common;
  if (locale === 'zh-CN') return zhCnMessages.common;
  return enMessages.common;
}

function getWorkspaceMessages(locale: string): typeof enMessages.workspace {
  if (locale === 'zh-TW') return zhTwMessages.workspace;
  if (locale === 'zh-CN') return zhCnMessages.workspace;
  return enMessages.workspace;
}

function getPreviewMessages(locale: string): typeof enMessages.preview {
  if (locale === 'zh-TW') return zhTwMessages.preview;
  if (locale === 'zh-CN') return zhCnMessages.preview;
  return enMessages.preview;
}

function getAiMessages(locale: string): typeof enMessages.ai {
  if (locale === 'zh-TW') return zhTwMessages.ai;
  if (locale === 'zh-CN') return zhCnMessages.ai;
  return enMessages.ai;
}

function resolveTabBarTabs(locale: string): WorkspaceTabBarTab[] {
  const tabMessages = getTabMessages(locale);
  return TAB_REGISTRY.map((tab) => ({
    id: tab.id,
    label: tabMessages[tab.labelKey as keyof typeof tabMessages] ?? tab.labelKey,
  }));
}

function readStoredTabOrientation(): TabOrientation {
  if (typeof window === 'undefined') return DEFAULT_TAB_ORIENTATION;
  const stored = window.localStorage.getItem(TAB_ORIENTATION_STORAGE_KEY);
  if (stored === 'horizontal' || stored === 'vertical') return stored;
  return DEFAULT_TAB_ORIENTATION;
}

function readStoredAiPanelCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(AI_PANEL_COLLAPSED_STORAGE_KEY) === 'true';
}

interface WorkspaceShellProps {
  locale?: string;
  projectFirstUxEnabled?: boolean;
  advancedDrawerInitialOpen?: boolean;
  workspaceView?: WorkspaceView;
  onWorkspaceViewChange?: (view: WorkspaceView) => void;
  onLogout?: () => void;
  onLanguageChange?: (locale: string) => void;
  sessions: WorkspaceShellSession[];
  selectedSessionId: string | null;
  isLoadingSessions: boolean;
  sessionError: string | null;
  sessionCreateError: string | null;
  sessionActionError: string | null;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => Promise<void>;
  onStopSession: (sessionId: string) => Promise<void>;
  onRemoveSession: (sessionId: string) => void;
  isCreatingSession: boolean;
  stoppingSessionId: string | null;
  userId: string | null;
  checkpoints: WorkspaceCheckpoint[];
  isLoadingHistory: boolean;
  historyError: string | null;
  checkpointCreateState: WorkspaceCheckpointCreateState;
  checkpointCreateError: string | null;
  checkpointDescriptionInput: string;
  onCheckpointDescriptionChange: (value: string) => void;
  onCreateManualCheckpoint: () => Promise<void>;
  projectListState?: 'idle' | 'loading' | 'ready' | 'error';
  projectActionState?: 'idle' | 'creating' | 'opening' | 'moving' | 'success' | 'error';
  projectActionMessage?: string | null;
  projectActionError?: string | null;
  workspaces?: Workspace[];
  selectedWorkspaceId?: string | null;
  workspaceActionState?: 'idle' | 'creating' | 'renaming' | 'deleting';
  workspaceActionError?: string | null;
  workspaceCreateNameInput?: string;
  workspaceRenameNameInput?: string;
  onSelectWorkspaceId?: (workspaceId: string) => void;
  onWorkspaceCreateNameInputChange?: (value: string) => void;
  onWorkspaceRenameNameInputChange?: (value: string) => void;
  onCreateWorkspace?: () => Promise<void>;
  onRenameWorkspace?: () => Promise<void>;
  onDeleteWorkspace?: () => Promise<void>;
  workspaceProjects?: WorkspaceProjectSummary[];
  selectedProjectId?: string | null;
  projectMoveTargetWorkspaceId?: string | null;
  projectNameInput?: string;
  onProjectNameInputChange?: (value: string) => void;
  onProjectMoveTargetWorkspaceIdChange?: (workspaceId: string) => void;
  onSelectProjectId?: (projectId: string) => void;
  onMoveWorkspaceProject?: () => Promise<void>;
  onCreateWorkspaceProject?: () => Promise<void>;
  onOpenWorkspaceProject?: () => Promise<void>;
  onResumeWorkspaceProjectById?: (projectId: string) => Promise<void>;
  onRestoreWorkspaceProjectFromSnapshotById?: (
    projectId: string,
    snapshotId: string,
  ) => Promise<void>;
  onSaveNamedProjectSnapshot?: (name: string) => Promise<void>;
  selectedProjectVisibility?: 'private' | 'public';
  onSelectedProjectVisibilityChange?: (visibility: 'private' | 'public') => void;
  onUpdateWorkspaceProjectVisibility?: () => Promise<void>;
  publicProjectListState?: 'idle' | 'loading' | 'ready' | 'error';
  publicProjectActionState?: 'idle' | 'viewing' | 'forking' | 'success' | 'error';
  publicProjectActionMessage?: string | null;
  publicProjectActionError?: string | null;
  publicWorkspaceProjects?: WorkspacePublicProjectSummary[];
  selectedPublicProjectId?: string | null;
  selectedPublicProjectDetail?: WorkspacePublicProjectDetail | null;
  onSelectPublicProjectId?: (projectId: string) => void;
  onViewPublicWorkspaceProject?: () => Promise<void>;
  onForkPublicWorkspaceProject?: () => Promise<void>;
  onForkPublicWorkspaceProjectById?: (projectId: string) => Promise<void>;
  snapshotListState?: 'idle' | 'loading' | 'ready' | 'error';
  snapshotActionState?:
    | 'idle'
    | 'saving'
    | 'restoring'
    | 'exporting'
    | 'importing'
    | 'success'
    | 'error';
  snapshotActionMessage?: string | null;
  snapshotActionError?: string | null;
  workspaceSnapshots?: WorkspaceSnapshotSummary[];
  selectedSnapshotId?: string | null;
  onSelectSnapshotId?: (snapshotId: string) => void;
  onSaveWorkspaceSnapshot?: () => Promise<void>;
  onRestoreWorkspaceSnapshot?: () => Promise<void>;
  onExportWorkspaceArchive?: () => Promise<void>;
  onImportWorkspaceArchive?: (file: File) => Promise<void>;
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
  chatPromptInput?: string;
  onChatPromptInputChange?: (value: string) => void;
  onCreateProjectFromPrompt?: (prompt: string) => Promise<void>;
  selectedModelOption?: string;
  onSelectedModelOptionChange?: (value: string) => void;
  availableModelOptions?: Array<{
    value: string;
    label: string;
  }>;
  orchestrationEnabled?: boolean;
  onOrchestrationEnabledChange?: (enabled: boolean) => void;
  onSubmitChatPrompt?: () => Promise<void>;
  onInstallAuthModule?: () => void | Promise<void>;
  onConfirmExecutionFileActions?: (executionId: string) => void | Promise<void>;
  onCancelExecutionFileActions?: (executionId: string) => void;
  chatRequestState?: 'idle' | 'submitting' | 'queued' | 'running' | 'completed' | 'failed';
  chatExecutionId?: string | null;
  chatStatusMessage?: string | null;
  chatResponseText?: string;
  chatError?: string | null;
  visualEditExecutionIds?: string[];
  visualEditCheckpointByExecutionId?: Record<string, string>;
  chatThreadMessages?: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    messageKind?: 'ai' | 'system';
    executionId?: string;
    provider?: string;
    model?: string;
    fileActionState?: WorkspaceExecutionFileActionState;
  }>;
  commandInput: string;
  onCommandInputChange: (value: string) => void;
  onExecuteCommand: () => Promise<void>;
  execState: WorkspaceExecState;
  selectedBuildTarget?: string;
  onSelectedBuildTargetChange?: (value: string) => void;
  availableBuildTargets?: Array<{
    value: string;
    label: string;
  }>;
  onRunBuildTarget?: () => Promise<void>;
  buildRequestState?: 'idle' | 'submitting' | 'completed' | 'failed';
  buildStatusMessage?: string | null;
  buildOutput?: string;
  buildError?: string | null;
  previewState: WorkspacePreviewState;
  previewUrl: string | null;
  onStartPreview: () => Promise<void>;
  onRefreshPreview: () => Promise<void>;
  onPreviewLoad: () => void;
  onPreviewError: () => void;
  onPreviewElementSelected?: (element: SelectedPreviewElement | null) => void;
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

type ProjectActionState = NonNullable<WorkspaceShellProps['projectActionState']>;

export function shouldCloseFocusedProjectActionOnProjectSuccessTransition(args: {
  previousProjectActionState: ProjectActionState;
  nextProjectActionState: ProjectActionState;
  hasFocusedProjectAction: boolean;
}): boolean {
  return (
    args.hasFocusedProjectAction &&
    args.previousProjectActionState !== 'success' &&
    args.nextProjectActionState === 'success'
  );
}

export function runStopSessionWithConfirmation(args: {
  sessionId: string;
  confirmStop: () => boolean;
  onStopSession: (sessionId: string) => Promise<void>;
}): boolean {
  if (!args.confirmStop()) {
    return false;
  }
  void args.onStopSession(args.sessionId);
  return true;
}

export function WorkspaceAdvancedDrawer(props: {
  isOpen: boolean;
  onToggle: () => void;
  sessionId: string | null;
  sessionStatus: string;
  workspaceMessages: Pick<typeof enMessages.workspace, 'noSessionSelected' | 'commandInput'>;
  execPanelContent?: React.ReactNode;
  onCopySessionId?: () => Promise<void> | void;
  canStopSession?: boolean;
  isStoppingSession?: boolean;
  onStopSession?: () => void;
}) {
  const hasSessionId = Boolean(props.sessionId);
  const showStopSession = Boolean(props.canStopSession && props.onStopSession);

  return (
    <div
      className="border-t border-gray-100 p-2"
      data-testid="workspace-advanced-drawer"
    >
      <button
        type="button"
        onClick={props.onToggle}
        aria-expanded={props.isOpen}
        aria-controls="workspace-advanced-drawer-content"
        data-testid="workspace-advanced-toggle"
        className="flex w-full items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-100"
      >
        <span>Advanced</span>
        <span className="text-[11px] text-gray-500">
          {props.isOpen ? 'Hide' : 'Show'}
        </span>
      </button>
      {props.isOpen ? (
        <div
          id="workspace-advanced-drawer-content"
          className="mt-2 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700"
          data-testid="workspace-advanced-drawer-content"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-gray-900">Session ID</p>
              <p
                className="mt-1 break-all font-mono text-[11px] text-gray-600"
                data-testid="workspace-advanced-session-id"
              >
                {props.sessionId ?? props.workspaceMessages.noSessionSelected}
              </p>
            </div>
            {hasSessionId && props.onCopySessionId ? (
              <button
                type="button"
                onClick={() => void props.onCopySessionId?.()}
                className="shrink-0 rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100"
              >
                Copy
              </button>
            ) : null}
          </div>
          <div className="mt-3">
            <p className="font-medium text-gray-900">Runtime status</p>
            <span
              className="mt-1 inline-flex rounded-full border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700"
              data-testid="workspace-advanced-session-status"
            >
              {props.sessionStatus}
            </span>
          </div>
          {showStopSession ? (
            <div className="mt-3">
              <p className="font-medium text-gray-900">Session controls</p>
              <button
                type="button"
                onClick={props.onStopSession}
                disabled={props.isStoppingSession}
                data-testid="workspace-advanced-stop-session"
                className="mt-1 w-full rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 disabled:opacity-60"
              >
                {props.isStoppingSession ? 'Stopping...' : 'Stop'}
              </button>
            </div>
          ) : null}
          {props.execPanelContent ? (
            <div className="mt-3">
              <p className="font-medium text-gray-900">{props.workspaceMessages.commandInput}</p>
              <div className="mt-1">{props.execPanelContent}</div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function WorkspaceShell(props: WorkspaceShellProps) {
  const locale = props.locale ?? 'en';
  const projectFirstUxEnabled = props.projectFirstUxEnabled ?? PROJECT_FIRST_UX;
  const resolvedWorkspaceView = props.workspaceView ?? 'project';
  const scaffoldMessages = getWorkspaceScaffoldMessages(locale);
  const [advancedDrawerOpen, setAdvancedDrawerOpen] = React.useState(
    props.advancedDrawerInitialOpen ?? false,
  );
  const [projectsViewMode, setProjectsViewMode] = React.useState<'grid' | 'list'>('grid');
  const [showNewProjectRow, setShowNewProjectRow] = React.useState(false);
  const [isCreateWorkspacePanelOpen, setIsCreateWorkspacePanelOpen] = React.useState(false);
  const [focusedProjectAction, setFocusedProjectAction] = React.useState<{
    type: 'move' | 'visibility';
    projectId: string;
  } | null>(null);
  const [templateSearch, setTemplateSearch] = React.useState('');
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [activeTabId, setActiveTabId] = React.useState(DEFAULT_ACTIVE_TAB_ID);
  const [tabOrientation, setTabOrientation] = React.useState<TabOrientation>(readStoredTabOrientation);
  const [aiPanelCollapsed, setAiPanelCollapsed] = React.useState(readStoredAiPanelCollapsed);
  const [historyPanelOpen, setHistoryPanelOpen] = React.useState(false);
  const [pickerActive, setPickerActive] = React.useState(false);
  const previewIframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const [selectedPreviewElement, setSelectedPreviewElement] = React.useState<SelectedPreviewElement | null>(null);
  const [pendingRestoreSnapshotId, setPendingRestoreSnapshotId] = React.useState<string | null>(
    null,
  );
  const tabBarTabs = React.useMemo(() => resolveTabBarTabs(locale), [locale]);
  const projectPanelMessages = React.useMemo(() => getProjectPanelMessages(locale), [locale]);
  const commonMessages = React.useMemo(() => getCommonMessages(locale), [locale]);
  const workspaceMessages = React.useMemo(() => getWorkspaceMessages(locale), [locale]);
  const previewMessages = React.useMemo(() => getPreviewMessages(locale), [locale]);
  const aiMessages = React.useMemo(() => getAiMessages(locale), [locale]);
  const recoveryMessages = React.useMemo(() => getRecoveryCopy(locale), [locale]);
  recoveryCopy = recoveryMessages;
  const comingSoonLabel = React.useMemo(() => getTabMessages(locale).comingSoon, [locale]);
  const activeTabLabel = React.useMemo(
    () => tabBarTabs.find((tab) => tab.id === activeTabId)?.label ?? activeTabId,
    [tabBarTabs, activeTabId],
  );
  const homePromptInput = props.chatPromptInput ?? '';
  const trimmedHomePrompt = homePromptInput.trim();
  const normalizedTemplateSearch = templateSearch.trim().toLowerCase();
  const projectActionState: ProjectActionState = props.projectActionState ?? 'idle';
  const isCreatingProjectFromPrompt = projectActionState === 'creating';
  const hasProjectActionInFlight =
    projectActionState === 'creating' ||
    projectActionState === 'opening' ||
    projectActionState === 'moving';
  const workspaceActionState = props.workspaceActionState ?? 'idle';
  const isWorkspaceCreationInFlight = workspaceActionState === 'creating';
  const trimmedWorkspaceCreateNameInput = (props.workspaceCreateNameInput ?? '').trim();
  const trimmedProjectNameInput = (props.projectNameInput ?? '').trim();
  const workspaceProjects = props.workspaceProjects ?? [];
  const focusedProject = focusedProjectAction
    ? workspaceProjects.find((project) => project.id === focusedProjectAction.projectId) ?? null
    : null;
  const focusedProjectVisibility =
    props.selectedProjectVisibility ?? (focusedProject?.visibility === 'public' ? 'public' : 'private');
  const focusedMoveTargetWorkspaceId = props.projectMoveTargetWorkspaceId ?? '';
  const availableFocusedMoveWorkspaces = focusedProject
    ? (props.workspaces ?? []).filter((workspace) => workspace.id !== focusedProject.workspaceId)
    : [];
  const isFocusedMoveTargetWorkspaceValid = availableFocusedMoveWorkspaces.some(
    (workspace) => workspace.id === focusedMoveTargetWorkspaceId,
  );
  const shouldShowFocusedProjectActionPanel =
    resolvedWorkspaceView === 'projects' && focusedProjectAction !== null && focusedProject !== null;
  const canSubmitFocusedMoveAction =
    focusedProjectAction?.type === 'move' &&
    !hasProjectActionInFlight &&
    Boolean(props.onMoveWorkspaceProject) &&
    isFocusedMoveTargetWorkspaceValid;
  const focusedProjectDefaultVisibility = focusedProject?.visibility === 'public' ? 'public' : 'private';
  const canSubmitFocusedVisibilityAction =
    focusedProjectAction?.type === 'visibility' &&
    !hasProjectActionInFlight &&
    Boolean(props.onUpdateWorkspaceProjectVisibility) &&
    focusedProjectVisibility !== focusedProjectDefaultVisibility;
  const activeProject = props.selectedProjectId
    ? workspaceProjects.find((p) => p.id === props.selectedProjectId) ?? null
    : null;
  const activeProjectName = activeProject?.name ?? '';
  const backLabel = getProjectModeBackLabel(locale);
  const filteredTemplateProjects = (props.publicWorkspaceProjects ?? []).filter((project) =>
    project.name.toLowerCase().includes(normalizedTemplateSearch),
  );
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
  const headerIdentityLabel =
    props.userSummary?.email?.trim() || 'Authenticated user';
  const selectedSession =
    props.selectedSessionId
      ? props.sessions.find((session) => session.id === props.selectedSessionId) ?? null
      : null;
  const selectedSessionStatus = selectedSession
    ? getSessionLabel(selectedSession)
    : 'not available';
  const canStopSelectedSession = Boolean(selectedSession && isUsableSession(selectedSession));
  const isStoppingSelectedSession =
    Boolean(props.selectedSessionId) && props.stoppingSessionId === props.selectedSessionId;
  const canReopenProject =
    projectFirstUxEnabled &&
    Boolean(props.selectedProjectId) &&
    Boolean(props.onOpenWorkspaceProject);
  const projectHistoryRows =
    projectFirstUxEnabled && props.selectedProjectId
      ? computeProjectHistoryRows(
          props.workspaceSnapshots ?? [],
          props.selectedProjectId,
          recoveryMessages,
        )
      : [];
  const latestProject = projectFirstUxEnabled ? computeLatestProject(workspaceProjects) : null;
  const recentProjects = projectFirstUxEnabled
    ? computeRecentProjects(workspaceProjects)
    : [];
  const previousProjectActionStateRef = React.useRef<ProjectActionState>(projectActionState);
  const previousWorkspaceActionStateRef = React.useRef(workspaceActionState);

  React.useEffect(() => {
    const previousProjectActionState = previousProjectActionStateRef.current;
    const shouldCloseFocusedProjectAction =
      shouldCloseFocusedProjectActionOnProjectSuccessTransition({
        previousProjectActionState,
        nextProjectActionState: projectActionState,
        hasFocusedProjectAction: focusedProjectAction !== null,
      });
    if (shouldCloseFocusedProjectAction) {
      setShowNewProjectRow(false);
      setFocusedProjectAction(null);
      props.onWorkspaceViewChange?.('projects');
    }
    previousProjectActionStateRef.current = projectActionState;
  }, [focusedProjectAction, props.onWorkspaceViewChange, projectActionState]);

  React.useEffect(() => {
    const previousWorkspaceActionState = previousWorkspaceActionStateRef.current;
    if (
      isCreateWorkspacePanelOpen &&
      previousWorkspaceActionState === 'creating' &&
      workspaceActionState === 'idle' &&
      !props.workspaceActionError
    ) {
      setIsCreateWorkspacePanelOpen(false);
      props.onWorkspaceCreateNameInputChange?.('');
    }
    previousWorkspaceActionStateRef.current = workspaceActionState;
  }, [
    isCreateWorkspacePanelOpen,
    workspaceActionState,
    props.workspaceActionError,
    props.onWorkspaceCreateNameInputChange,
  ]);

  React.useEffect(() => {
    if (!focusedProjectAction) {
      return;
    }
    const projectStillExists = workspaceProjects.some(
      (project) => project.id === focusedProjectAction.projectId,
    );
    if (!projectStillExists) {
      setFocusedProjectAction(null);
    }
  }, [focusedProjectAction, workspaceProjects]);

  const handleOpenCreateWorkspacePanel = React.useCallback(() => {
    setIsCreateWorkspacePanelOpen(true);
    setFocusedProjectAction(null);
    setIsSidebarOpen(false);
  }, []);

  const handleCloseCreateWorkspacePanel = React.useCallback(() => {
    setIsCreateWorkspacePanelOpen(false);
    props.onWorkspaceCreateNameInputChange?.('');
  }, [props.onWorkspaceCreateNameInputChange]);

  const handleCreateWorkspaceFromFocusedPanel = React.useCallback(() => {
    if (isWorkspaceCreationInFlight || trimmedWorkspaceCreateNameInput.length === 0) {
      return;
    }
    void props.onCreateWorkspace?.();
  }, [isWorkspaceCreationInFlight, trimmedWorkspaceCreateNameInput, props.onCreateWorkspace]);

  const handleWorkspaceViewChange = React.useCallback(
    (view: WorkspaceView) => {
      setIsCreateWorkspacePanelOpen(false);
      setFocusedProjectAction(null);
      props.onWorkspaceViewChange?.(view);
    },
    [props.onWorkspaceViewChange],
  );

  const handleSelectWorkspaceId = React.useCallback(
    (workspaceId: string) => {
      setIsCreateWorkspacePanelOpen(false);
      setFocusedProjectAction(null);
      props.onSelectWorkspaceId?.(workspaceId);
    },
    [props.onSelectWorkspaceId],
  );
  const handleRestoreProjectHistoryRow =
    projectFirstUxEnabled &&
    props.selectedProjectId &&
    props.onRestoreWorkspaceProjectFromSnapshotById
      ? (() => {
          const selectedProjectId = props.selectedProjectId;
          const onRestoreWorkspaceProjectFromSnapshotById =
            props.onRestoreWorkspaceProjectFromSnapshotById;
          return (snapshotId: string) => {
            if (resolvedWorkspaceView === 'project') {
              setPendingRestoreSnapshotId(snapshotId);
              return;
            }
            const confirmed =
              typeof window === 'undefined'
                ? true
                : window.confirm(recoveryCopy.workspace.restoreSnapshotConfirm);
            if (!confirmed) {
              return;
            }
            void onRestoreWorkspaceProjectFromSnapshotById(
              selectedProjectId,
              snapshotId,
            );
          };
        })()
      : undefined;
  const handleConfirmRestore = () => {
    if (
      !pendingRestoreSnapshotId ||
      !props.selectedProjectId ||
      !props.onRestoreWorkspaceProjectFromSnapshotById
    ) {
      setPendingRestoreSnapshotId(null);
      return;
    }
    const projectId = props.selectedProjectId;
    const onRestoreWorkspaceProjectFromSnapshotById =
      props.onRestoreWorkspaceProjectFromSnapshotById;
    const snapshotId = pendingRestoreSnapshotId;
    setPendingRestoreSnapshotId(null);
    void onRestoreWorkspaceProjectFromSnapshotById(projectId, snapshotId);
  };
  const handleCancelRestore = () => {
    setPendingRestoreSnapshotId(null);
  };
  const toggleHistoryPanel = React.useCallback(() => {
    setHistoryPanelOpen((previous) => {
      const next = !previous;
      if (!next) {
        setPendingRestoreSnapshotId(null);
      }
      return next;
    });
  }, []);

  const injectPickerScript = React.useCallback(() => {
    try {
      const iframe = previewIframeRef.current;
      if (!iframe) return;
      const doc = iframe.contentDocument;
      const win = iframe.contentWindow;
      if (!doc || !win) return;
      const scriptId = getPickerScriptId();
      if (doc.getElementById(scriptId + '-active')) return;
      const existing = doc.getElementById(scriptId);
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
      const script = doc.createElement('script');
      script.id = scriptId;
      script.textContent = generatePickerScriptSource();
      doc.body.appendChild(script);
    } catch {
      // iframe not same-origin or not yet loaded
    }
  }, []);

  const removePickerScript = React.useCallback(() => {
    try {
      const iframe = previewIframeRef.current;
      if (!iframe) return;
      const win = iframe.contentWindow;
      if (win) {
        win.postMessage({ type: 'visual-edit:deactivate-picker' }, '*');
      }
      const doc = iframe.contentDocument;
      if (!doc) return;
      const scriptId = getPickerScriptId();
      const overlayId = getPickerOverlayId();
      const marker = doc.getElementById(scriptId + '-active');
      if (marker && marker.parentNode) marker.parentNode.removeChild(marker);
      const overlay = doc.getElementById(overlayId);
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      const scriptEl = doc.getElementById(scriptId);
      if (scriptEl && scriptEl.parentNode) scriptEl.parentNode.removeChild(scriptEl);
    } catch {
      // iframe not same-origin or already cleaned
    }
  }, []);

  const handlePickerToggle = React.useCallback(() => {
    setPickerActive((current) => {
      const next = !current;
      if (next) {
        setSelectedPreviewElement(null);
        props.onPreviewElementSelected?.(null);
        setTimeout(() => injectPickerScript(), 0);
      } else {
        removePickerScript();
      }
      return next;
    });
  }, [injectPickerScript, removePickerScript, props.onPreviewElementSelected]);

  React.useEffect(() => {
    if (!props.previewUrl || props.previewState !== 'ready') {
      setPickerActive(false);
      removePickerScript();
      setSelectedPreviewElement(null);
      props.onPreviewElementSelected?.(null);
    }
  }, [props.previewUrl, props.previewState, removePickerScript, props.onPreviewElementSelected]);

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!isVisualEditElementSelectedMessage(event.data)) {
        return;
      }
      const iframe = previewIframeRef.current;
      const expectedSource = iframe?.contentWindow ?? null;
      const expectedOrigin = typeof window !== 'undefined' ? window.location.origin : null;
      if (
        !isValidVisualEditMessageOriginAndSource({
          expectedOrigin,
          messageOrigin: event.origin,
          expectedSource,
          messageSource: event.source,
        })
      ) {
        return;
      }
      setSelectedPreviewElement(event.data.payload);
      props.onPreviewElementSelected?.(event.data.payload);
      setPickerActive(false);
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [props.onPreviewElementSelected]);
  const handlePreviewLoadWithPicker = React.useCallback(() => {
    props.onPreviewLoad();
    if (pickerActive) {
      setTimeout(() => injectPickerScript(), 0);
    }
  }, [props.onPreviewLoad, pickerActive, injectPickerScript]);
  const handleSaveProjectHistorySnapshot =
    projectFirstUxEnabled &&
    props.selectedProjectId &&
    props.onSaveNamedProjectSnapshot
      ? (() => {
          const onSaveNamedProjectSnapshot = props.onSaveNamedProjectSnapshot;
          return () => {
            if (typeof window === 'undefined') {
              return;
            }
            const rawName = window.prompt(
              recoveryCopy.workspace.saveNamedSnapshotPrompt,
            );
            if (rawName === null) {
              return;
            }
            const trimmedName = rawName.trim();
            if (!trimmedName) {
              return;
            }
            void onSaveNamedProjectSnapshot(trimmedName);
          };
        })()
      : undefined;
  const handleReopenProject = () => {
    if (!props.onOpenWorkspaceProject) {
      return;
    }
    void props.onOpenWorkspaceProject();
  };
  const handleResumeLatestProject =
    latestProject && props.onResumeWorkspaceProjectById
      ? (() => {
          const onResumeWorkspaceProjectById = props.onResumeWorkspaceProjectById;
          return () => {
            void onResumeWorkspaceProjectById(latestProject.id);
          };
        })()
      : undefined;
  const handleOpenRecentProject =
    props.onResumeWorkspaceProjectById && projectFirstUxEnabled
      ? ((projectId: string) => {
          void props.onResumeWorkspaceProjectById?.(projectId);
        })
      : undefined;
  const handleOpenProjectCard = (projectId: string) => {
    handleOpenRecentProject?.(projectId);
  };
  const handleProjectCardMoveAction = React.useCallback(
    (project: WorkspaceProjectSummary) => {
      setShowNewProjectRow(false);
      setIsCreateWorkspacePanelOpen(false);
      props.onSelectProjectId?.(project.id);
      setFocusedProjectAction({ type: 'move', projectId: project.id });
      props.onWorkspaceViewChange?.('projects');
    },
    [props.onSelectProjectId, props.onWorkspaceViewChange],
  );
  const handleProjectCardSharingVisibilityAction = React.useCallback(
    (project: WorkspaceProjectSummary) => {
      setShowNewProjectRow(false);
      setIsCreateWorkspacePanelOpen(false);
      props.onSelectProjectId?.(project.id);
      props.onSelectedProjectVisibilityChange?.(project.visibility === 'public' ? 'public' : 'private');
      setFocusedProjectAction({ type: 'visibility', projectId: project.id });
      props.onWorkspaceViewChange?.('projects');
    },
    [props.onSelectProjectId, props.onSelectedProjectVisibilityChange, props.onWorkspaceViewChange],
  );
  const handleCloseFocusedProjectAction = React.useCallback(() => {
    setFocusedProjectAction(null);
    props.onWorkspaceViewChange?.('projects');
  }, [props.onWorkspaceViewChange]);
  const handleSubmitFocusedMoveAction = React.useCallback(() => {
    if (!canSubmitFocusedMoveAction) {
      return;
    }
    void props.onMoveWorkspaceProject?.();
  }, [canSubmitFocusedMoveAction, props.onMoveWorkspaceProject]);
  const handleSubmitFocusedVisibilityAction = React.useCallback(() => {
    if (!canSubmitFocusedVisibilityAction) {
      return;
    }
    void props.onUpdateWorkspaceProjectVisibility?.();
  }, [canSubmitFocusedVisibilityAction, props.onUpdateWorkspaceProjectVisibility]);
  const handleTabOrientationToggle = () => {
    setTabOrientation((prev) => {
      const next = prev === 'horizontal' ? 'vertical' : 'horizontal';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(TAB_ORIENTATION_STORAGE_KEY, next);
      }
      return next;
    });
  };
  const handleAiPanelCollapseToggle = () => {
    setAiPanelCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(AI_PANEL_COLLAPSED_STORAGE_KEY, String(next));
      }
      return next;
    });
  };
  const handleCopySelectedSessionId = async () => {
    if (!props.selectedSessionId) {
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(props.selectedSessionId);
    } catch {
      // Keep this affordance best-effort only; no new error UI in A2a.
    }
  };
  const handleStopSelectedSession = () => {
    if (!props.selectedSessionId) {
      return;
    }

    runStopSessionWithConfirmation({
      sessionId: props.selectedSessionId,
      confirmStop: () =>
        typeof window === 'undefined'
          ? true
          : window.confirm(workspaceMessages.stopSessionConfirm),
      onStopSession: props.onStopSession,
    });
  };

  const makeHistoryAndDashboardContent = (opts?: { hideWorkspaceAdminControls?: boolean }) => (
    <>
      <section
        className="mx-2 mb-2 bg-white border border-gray-200 rounded p-3"
        data-testid="history-control-slice"
      >
        <p className="text-xs font-semibold text-gray-700 mb-2">History & Controls</p>
        <HistorySliceMessage state={historyState} />
        <HistoryCreateCheckpointPanel
          projectFirstUxEnabled={projectFirstUxEnabled}
          selectedSessionId={props.selectedSessionId}
          createState={props.checkpointCreateState}
          createErrorMessage={props.checkpointCreateError}
          descriptionValue={props.checkpointDescriptionInput}
          onDescriptionChange={props.onCheckpointDescriptionChange}
          onCreateCheckpoint={props.onCreateManualCheckpoint}
        />
        <HistoryProjectPanel
          projectFirstUxEnabled={projectFirstUxEnabled}
          selectedSessionId={props.selectedSessionId}
          listState={props.projectListState ?? 'idle'}
          actionState={props.projectActionState ?? 'idle'}
          actionMessage={props.projectActionMessage ?? null}
          actionError={props.projectActionError ?? null}
          workspaces={props.workspaces ?? []}
          selectedWorkspaceId={props.selectedWorkspaceId ?? null}
          workspaceActionState={props.workspaceActionState ?? 'idle'}
          workspaceActionError={props.workspaceActionError ?? null}
          workspaceCreateNameInput={props.workspaceCreateNameInput ?? ''}
          workspaceRenameNameInput={props.workspaceRenameNameInput ?? ''}
          onSelectWorkspaceId={props.onSelectWorkspaceId}
          onWorkspaceCreateNameInputChange={props.onWorkspaceCreateNameInputChange}
          onWorkspaceRenameNameInputChange={props.onWorkspaceRenameNameInputChange}
          onCreateWorkspace={props.onCreateWorkspace}
          onRenameWorkspace={props.onRenameWorkspace}
          onDeleteWorkspace={props.onDeleteWorkspace}
          projects={props.workspaceProjects ?? []}
          selectedProjectId={props.selectedProjectId ?? null}
          projectMoveTargetWorkspaceId={props.projectMoveTargetWorkspaceId ?? null}
          projectNameInput={props.projectNameInput ?? ''}
          onProjectNameInputChange={props.onProjectNameInputChange}
          onProjectMoveTargetWorkspaceIdChange={props.onProjectMoveTargetWorkspaceIdChange}
          onSelectProjectId={props.onSelectProjectId}
          onMoveWorkspaceProject={props.onMoveWorkspaceProject}
          onCreateProject={props.onCreateWorkspaceProject}
          onOpenProject={props.onOpenWorkspaceProject}
          selectedProjectVisibility={props.selectedProjectVisibility ?? 'private'}
          onSelectedProjectVisibilityChange={props.onSelectedProjectVisibilityChange}
          onUpdateProjectVisibility={props.onUpdateWorkspaceProjectVisibility}
          publicProjectListState={props.publicProjectListState ?? 'idle'}
          publicProjectActionState={props.publicProjectActionState ?? 'idle'}
          publicProjectActionMessage={props.publicProjectActionMessage ?? null}
          publicProjectActionError={props.publicProjectActionError ?? null}
          publicProjects={props.publicWorkspaceProjects ?? []}
          selectedPublicProjectId={props.selectedPublicProjectId ?? null}
          selectedPublicProjectDetail={props.selectedPublicProjectDetail ?? null}
          onSelectPublicProjectId={props.onSelectPublicProjectId}
          onViewPublicProject={props.onViewPublicWorkspaceProject}
          onForkPublicProject={props.onForkPublicWorkspaceProject}
          workspaceMessages={workspaceMessages}
          projectMessages={projectPanelMessages}
          commonMessages={commonMessages}
          hideWorkspaceAdminControls={opts?.hideWorkspaceAdminControls ?? false}
        />
        <HistorySnapshotPanel
          projectMessages={projectPanelMessages}
          commonMessages={commonMessages}
          selectedSessionId={props.selectedSessionId}
          listState={props.snapshotListState ?? 'idle'}
          actionState={props.snapshotActionState ?? 'idle'}
          actionMessage={props.snapshotActionMessage ?? null}
          actionError={props.snapshotActionError ?? null}
          snapshots={props.workspaceSnapshots ?? []}
          selectedSnapshotId={props.selectedSnapshotId ?? null}
          onSelectSnapshotId={props.onSelectSnapshotId}
          onSaveSnapshot={props.onSaveWorkspaceSnapshot}
          onRestoreSnapshot={props.onRestoreWorkspaceSnapshot}
          onExportArchive={props.onExportWorkspaceArchive}
          onImportArchive={props.onImportWorkspaceArchive}
        />
        <ProjectHistoryPanel
          projectFirstUxEnabled={projectFirstUxEnabled}
          selectedProjectId={props.selectedProjectId ?? null}
          rows={projectHistoryRows}
          onRestore={handleRestoreProjectHistoryRow}
          onSave={handleSaveProjectHistorySnapshot}
        />
        {historyState === 'ready' ? (
          <HistoryCheckpointList
            projectFirstUxEnabled={projectFirstUxEnabled}
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
        <p className="text-xs font-semibold text-gray-700 mb-2">Dashboard</p>
        <DashboardSliceMessage state={dashboardState} />
        {dashboardState === 'ready' && props.userSummary && props.usageSummary && props.quotaSummary ? (
          <DashboardSummary
            userSummary={props.userSummary}
            usageSummary={props.usageSummary}
            quotaSummary={props.quotaSummary}
            activeSessions={activeSessions}
          />
        ) : null}
      </section>
    </>
  );

  const projectBuildToolbar = (
    <div className="border-b border-gray-200 bg-white px-2 py-2">
      <WorkspaceBuildPanel
        projectFirstUxEnabled={projectFirstUxEnabled}
        selectedSessionId={props.selectedSessionId}
        selectedBuildTarget={props.selectedBuildTarget ?? ''}
        onSelectedBuildTargetChange={props.onSelectedBuildTargetChange}
        availableBuildTargets={props.availableBuildTargets ?? []}
        onRunBuildTarget={props.onRunBuildTarget}
        buildRequestState={props.buildRequestState ?? 'idle'}
        buildStatusMessage={props.buildStatusMessage ?? null}
        buildOutput={props.buildOutput ?? ''}
        buildError={props.buildError ?? null}
        workspaceMessages={workspaceMessages}
      />
    </div>
  );

  const historyToggleLabel = historyPanelOpen
    ? projectPanelMessages.backToChat
    : projectPanelMessages.openHistory;

  const projectChatSection = (
    <section
      className="flex flex-col flex-1 min-h-0 bg-white border border-gray-200 rounded-lg overflow-hidden"
      data-testid="chat-panel-shell"
    >
      <div className="flex flex-col flex-1 min-h-0" data-testid="workspace-chat-ai-panel">
        <div className="flex items-center justify-end px-3 pt-2">
          <button
            type="button"
            onClick={toggleHistoryPanel}
            className="rounded p-1.5 text-gray-600 hover:bg-gray-100"
            data-testid="workspace-history-drawer-toggle"
            aria-label={historyToggleLabel}
            title={historyToggleLabel}
          >
            {historyPanelOpen ? <ChatBubbleLeftIcon className="h-4 w-4" /> : <ClockIcon className="h-4 w-4" />}
          </button>
        </div>
        <div
          className={historyPanelOpen ? 'hidden flex-1 min-h-0 flex flex-col' : 'flex-1 min-h-0 flex flex-col'}
          data-testid="workspace-ai-panel-chat-content"
        >
          <WorkspaceChatPanel
            projectFirstUxEnabled={projectFirstUxEnabled}
            aiMessages={aiMessages}
            commonMessages={commonMessages}
            selectedSessionId={props.selectedSessionId}
            promptInput={props.chatPromptInput ?? ''}
            onPromptInputChange={props.onChatPromptInputChange}
            selectedModelOption={props.selectedModelOption ?? ''}
            onSelectedModelOptionChange={props.onSelectedModelOptionChange}
            availableModelOptions={props.availableModelOptions ?? []}
            orchestrationEnabled={props.orchestrationEnabled ?? false}
            onOrchestrationEnabledChange={props.onOrchestrationEnabledChange}
            onSubmitPrompt={props.onSubmitChatPrompt}
            requestState={props.chatRequestState ?? 'idle'}
            executionId={props.chatExecutionId ?? null}
            statusMessage={props.chatStatusMessage ?? null}
            responseText={props.chatResponseText ?? ''}
            errorMessage={props.chatError ?? null}
            visualEditExecutionIds={props.visualEditExecutionIds ?? []}
            visualEditCheckpointByExecutionId={props.visualEditCheckpointByExecutionId}
            threadMessages={props.chatThreadMessages ?? []}
            onConfirmExecutionFileActions={props.onConfirmExecutionFileActions}
            onCancelExecutionFileActions={props.onCancelExecutionFileActions}
            onInitiateCheckpointRevert={props.onInitiateCheckpointRevert}
          />
          <div className="mt-3">
            <ShellStateMessage
              state={shellState}
              sessionError={props.sessionError}
              projectFirstUxEnabled={projectFirstUxEnabled}
              workspaceMessages={workspaceMessages}
              canReopenProject={canReopenProject}
              onReopenProject={canReopenProject ? handleReopenProject : undefined}
              onResumeLatestProject={handleResumeLatestProject}
            />
          </div>
        </div>
        <div
          className={historyPanelOpen ? 'flex-1 min-h-0 overflow-y-auto' : 'hidden flex-1 min-h-0 overflow-y-auto'}
          data-testid="workspace-ai-panel-history-content"
        >
          {pendingRestoreSnapshotId ? (
            <section
              className="mx-2 mt-2 rounded border border-amber-200 bg-amber-50 p-3"
              data-testid="workspace-restore-confirm-bar"
            >
              <p className="text-xs text-amber-900">{projectPanelMessages.restoreConfirm}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="rounded bg-amber-700 px-2 py-1 text-xs font-medium text-white"
                  data-testid="workspace-restore-confirm-button"
                  onClick={handleConfirmRestore}
                >
                  {projectPanelMessages.restore}
                </button>
                <button
                  type="button"
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
                  data-testid="workspace-restore-cancel-button"
                  onClick={handleCancelRestore}
                >
                  {commonMessages.cancel}
                </button>
              </div>
            </section>
          ) : null}
          {makeHistoryAndDashboardContent()}
        </div>
      </div>
    </section>
  );

  const projectEditorSection = (
    <section className="bg-white border border-gray-200 rounded p-3" data-testid="editor-panel-shell">
      <p className="text-xs font-semibold text-gray-700 mb-2">Editor Panel</p>
      <WorkspaceEditorPanel
        projectFirstUxEnabled={projectFirstUxEnabled}
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
  );

  const projectPreviewSection = (
    <section className="bg-white border border-gray-200 rounded p-3" data-testid="preview-panel-shell">
      <p className="text-xs font-semibold text-gray-700 mb-2">Preview Panel</p>
      <WorkspacePreviewPanel
        projectFirstUxEnabled={projectFirstUxEnabled}
        projectMessages={projectPanelMessages}
        previewMessages={previewMessages}
        commonMessages={commonMessages}
        selectedSessionId={props.selectedSessionId}
        previewState={props.previewState}
        previewUrl={props.previewUrl}
        onStartPreview={props.onStartPreview}
        onRefreshPreview={props.onRefreshPreview}
        onPreviewLoad={handlePreviewLoadWithPicker}
        onPreviewError={props.onPreviewError}
        iframeRef={previewIframeRef}
        pickerActive={pickerActive}
        onPickerToggle={handlePickerToggle}
        selectedPreviewElement={selectedPreviewElement}
      />
    </section>
  );

  const projectWorkspaceContent = (
    <>
      {projectBuildToolbar}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-2">
        {projectChatSection}
        {projectEditorSection}
        {projectPreviewSection}
      </div>
      {makeHistoryAndDashboardContent()}
    </>
  );

  const focusedCreateWorkspaceContent = (
    <div className="flex flex-1 min-h-0 flex-col p-4" data-testid="workspace-create-workspace-view">
      <div className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center">
        <section
          className="w-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          data-testid="workspace-create-workspace-panel"
        >
          <h2
            className="text-2xl font-semibold text-gray-900"
            data-testid="workspace-create-workspace-title"
          >
            {workspaceMessages.createWorkspaceTitle}
          </h2>
          <p
            className="mt-2 text-sm leading-6 text-gray-600"
            data-testid="workspace-create-workspace-description"
          >
            {workspaceMessages.createWorkspaceDescription}
          </p>
          <div className="mt-6">
            <label
              htmlFor="workspace-create-workspace-name-input"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              {workspaceMessages.workspaceNameLabel}
            </label>
            <input
              id="workspace-create-workspace-name-input"
              type="text"
              value={props.workspaceCreateNameInput ?? ''}
              onChange={(event) => props.onWorkspaceCreateNameInputChange?.(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              data-testid="workspace-create-workspace-name-input"
            />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseCreateWorkspacePanel}
              disabled={isWorkspaceCreationInFlight}
              className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
              data-testid="workspace-create-workspace-cancel-button"
            >
              {commonMessages.cancel}
            </button>
            <button
              type="button"
              onClick={handleCreateWorkspaceFromFocusedPanel}
              disabled={
                isWorkspaceCreationInFlight ||
                trimmedWorkspaceCreateNameInput.length === 0 ||
                !props.onCreateWorkspace
              }
              className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
              data-testid="workspace-create-workspace-create-button"
            >
              {workspaceActionState === 'creating'
                ? commonMessages.creating
                : workspaceMessages.createWorkspace}
            </button>
          </div>
          {props.workspaceActionError ? (
            <p
              className="mt-3 text-sm text-red-700"
              data-testid="workspace-create-workspace-action-error"
            >
              {props.workspaceActionError}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );

  const projectsWorkspaceContent = (
    <div className="flex flex-1 min-h-0 flex-col" data-testid="workspace-projects-view">
      <section
        className="mx-2 mb-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        data-testid="workspace-projects-surface"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              {scaffoldMessages.projects}
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-gray-900">{scaffoldMessages.projects}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
              <button
                type="button"
                onClick={() => setProjectsViewMode('grid')}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  projectsViewMode === 'grid'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-white'
                }`}
                data-testid="workspace-projects-grid-toggle"
              >
                {scaffoldMessages.gridView}
              </button>
              <button
                type="button"
                onClick={() => setProjectsViewMode('list')}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  projectsViewMode === 'list'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-white'
                }`}
                data-testid="workspace-projects-list-toggle"
              >
                {scaffoldMessages.listView}
              </button>
            </div>
            {props.onCreateWorkspaceProject ? (
              showNewProjectRow ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={props.projectNameInput ?? ''}
                    onChange={(event) => props.onProjectNameInputChange?.(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        setShowNewProjectRow(false);
                        props.onProjectNameInputChange?.('');
                        return;
                      }
                      if (event.key === 'Enter') {
                        if (hasProjectActionInFlight || trimmedProjectNameInput.length === 0) {
                          return;
                        }
                        void props.onCreateWorkspaceProject?.();
                      }
                    }}
                    placeholder={projectPanelMessages.newProjectName}
                    className="min-w-0 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    data-testid="workspace-projects-new-project-input"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (hasProjectActionInFlight || trimmedProjectNameInput.length === 0) {
                        return;
                      }
                      void props.onCreateWorkspaceProject?.();
                    }}
                    disabled={hasProjectActionInFlight || trimmedProjectNameInput.length === 0}
                    className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                    data-testid="workspace-projects-create-confirm-button"
                  >
                    {props.projectActionState === 'creating'
                      ? commonMessages.creating
                      : projectPanelMessages.createProject}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewProjectRow(false);
                      props.onProjectNameInputChange?.('');
                    }}
                    disabled={hasProjectActionInFlight}
                    className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                    data-testid="workspace-projects-create-cancel-button"
                  >
                    {commonMessages.cancel}
                  </button>
                  {props.projectActionError ? (
                    <p
                      className="w-full text-sm text-red-700"
                      data-testid="workspace-projects-create-error"
                    >
                      {props.projectActionError}
                    </p>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNewProjectRow(true)}
                  disabled={hasProjectActionInFlight}
                  className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                  data-testid="workspace-projects-new-project-button"
                >
                  {scaffoldMessages.newProject}
                </button>
              )
            ) : null}
          </div>
        </div>
        {shouldShowFocusedProjectActionPanel && focusedProjectAction?.type === 'move' ? (
          <section
            className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
            data-testid="workspace-projects-focused-move-panel"
          >
            <h3
              className="text-base font-semibold text-gray-900"
              data-testid="workspace-projects-focused-move-title"
            >
              {projectPanelMessages.movePanelTitle}
            </h3>
            <p
              className="mt-1 text-sm text-gray-600"
              data-testid="workspace-projects-focused-move-description"
            >
              {projectPanelMessages.movePanelDescription}
            </p>
            <div className="mt-4">
              <label
                htmlFor="workspace-projects-focused-move-workspace-select"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                {workspaceMessages.selectTargetWorkspace}
              </label>
              <select
                id="workspace-projects-focused-move-workspace-select"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                value={focusedMoveTargetWorkspaceId}
                onChange={(event) => props.onProjectMoveTargetWorkspaceIdChange?.(event.target.value)}
                disabled={hasProjectActionInFlight || availableFocusedMoveWorkspaces.length === 0}
                data-testid="workspace-projects-focused-move-workspace-select"
              >
                <option value="">
                  {availableFocusedMoveWorkspaces.length > 0
                    ? workspaceMessages.selectTargetWorkspace
                    : workspaceMessages.noOtherWorkspaces}
                </option>
                {availableFocusedMoveWorkspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseFocusedProjectAction}
                disabled={hasProjectActionInFlight}
                className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                data-testid="workspace-projects-focused-move-cancel-button"
              >
                {commonMessages.cancel}
              </button>
              <button
                type="button"
                onClick={handleSubmitFocusedMoveAction}
                disabled={!canSubmitFocusedMoveAction}
                className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                data-testid="workspace-projects-focused-move-submit-button"
              >
                {props.projectActionState === 'moving'
                  ? commonMessages.moving
                  : projectPanelMessages.moveToWorkspace}
              </button>
            </div>
            {props.projectActionError ? (
              <p
                className="mt-3 text-sm text-red-700"
                data-testid="workspace-projects-focused-move-error"
              >
                {props.projectActionError}
              </p>
            ) : null}
          </section>
        ) : null}
        {shouldShowFocusedProjectActionPanel && focusedProjectAction?.type === 'visibility' ? (
          <section
            className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
            data-testid="workspace-projects-focused-visibility-panel"
          >
            <h3
              className="text-base font-semibold text-gray-900"
              data-testid="workspace-projects-focused-visibility-title"
            >
              {projectPanelMessages.visibilityPanelTitle}
            </h3>
            <p
              className="mt-1 text-sm text-gray-600"
              data-testid="workspace-projects-focused-visibility-description"
            >
              {projectPanelMessages.visibilityPanelDescription}
            </p>
            <div className="mt-4">
              <label
                htmlFor="workspace-projects-focused-visibility-select"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                {projectPanelMessages.sharingVisibility}
              </label>
              <select
                id="workspace-projects-focused-visibility-select"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                value={focusedProjectVisibility}
                onChange={(event) =>
                  props.onSelectedProjectVisibilityChange?.(
                    event.target.value === 'public' ? 'public' : 'private',
                  )
                }
                disabled={hasProjectActionInFlight}
                data-testid="workspace-projects-focused-visibility-select"
              >
                <option value="private">{projectPanelMessages.privateVisibility}</option>
                <option value="public">{projectPanelMessages.publicVisibility}</option>
              </select>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseFocusedProjectAction}
                disabled={hasProjectActionInFlight}
                className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                data-testid="workspace-projects-focused-visibility-cancel-button"
              >
                {commonMessages.cancel}
              </button>
              <button
                type="button"
                onClick={handleSubmitFocusedVisibilityAction}
                disabled={!canSubmitFocusedVisibilityAction}
                className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                data-testid="workspace-projects-focused-visibility-submit-button"
              >
                {hasProjectActionInFlight ? commonMessages.saving : commonMessages.save}
              </button>
            </div>
            {props.projectActionError ? (
              <p
                className="mt-3 text-sm text-red-700"
                data-testid="workspace-projects-focused-visibility-error"
              >
                {props.projectActionError}
              </p>
            ) : null}
          </section>
        ) : null}
        {!shouldShowFocusedProjectActionPanel
          ? workspaceProjects.length > 0
            ? projectsViewMode === 'grid'
              ? (
                  <div
                    className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
                    data-testid="workspace-projects-grid"
                  >
                    {workspaceProjects.map((project) => (
                      <WorkspaceProjectCard
                        key={project.id}
                        project={project}
                        viewMode="grid"
                        onOpen={handleOpenProjectCard}
                        onMoveToWorkspaceAction={handleProjectCardMoveAction}
                        onSharingVisibilityAction={handleProjectCardSharingVisibilityAction}
                        actionsMenuLabel={projectPanelMessages.actionsMenuLabel}
                        moveToWorkspaceLabel={projectPanelMessages.moveToWorkspace}
                        sharingVisibilityLabel={projectPanelMessages.sharingVisibility}
                        visibilityLabel={projectPanelMessages.visibility}
                        privateVisibilityLabel={projectPanelMessages.privateVisibility}
                        publicVisibilityLabel={projectPanelMessages.publicVisibility}
                      />
                    ))}
                  </div>
                )
              : (
                  <div className="mt-4 flex flex-col gap-3" data-testid="workspace-projects-list">
                    {workspaceProjects.map((project) => (
                      <WorkspaceProjectCard
                        key={project.id}
                        project={project}
                        viewMode="list"
                        onOpen={handleOpenProjectCard}
                        onMoveToWorkspaceAction={handleProjectCardMoveAction}
                        onSharingVisibilityAction={handleProjectCardSharingVisibilityAction}
                        actionsMenuLabel={projectPanelMessages.actionsMenuLabel}
                        moveToWorkspaceLabel={projectPanelMessages.moveToWorkspace}
                        sharingVisibilityLabel={projectPanelMessages.sharingVisibility}
                        visibilityLabel={projectPanelMessages.visibility}
                        privateVisibilityLabel={projectPanelMessages.privateVisibility}
                        publicVisibilityLabel={projectPanelMessages.publicVisibility}
                      />
                    ))}
                  </div>
                )
            : (
                <p
                  className="mt-4 rounded-lg border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500"
                  data-testid="workspace-projects-empty-state"
                >
                  {scaffoldMessages.noProjects}
                </p>
              )
          : null}
      </section>
    </div>
  );

  const homeWorkspaceContent = (
    <div className="flex flex-1 min-h-0 flex-col p-4" data-testid="workspace-home-view">
      <div className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center">
        <div className="w-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {scaffoldMessages.home}
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-gray-900">
            {scaffoldMessages.buildAnything}
          </h2>
          <p className="mt-2 text-sm text-gray-600">{scaffoldMessages.describeBuild}</p>
          <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <textarea
              value={homePromptInput}
              placeholder={scaffoldMessages.describeBuild}
              rows={6}
              disabled={isCreatingProjectFromPrompt || !props.onChatPromptInputChange}
              onChange={(event) => {
                props.onChatPromptInputChange?.(event.target.value);
              }}
              className="min-h-32 w-full resize-none rounded border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900"
              data-testid="workspace-home-input"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={
                  isCreatingProjectFromPrompt ||
                  !props.onCreateProjectFromPrompt ||
                  trimmedHomePrompt.length === 0
                }
                onClick={() => {
                  if (
                    isCreatingProjectFromPrompt ||
                    !props.onCreateProjectFromPrompt ||
                    trimmedHomePrompt.length === 0
                  ) {
                    return;
                  }
                  void props.onCreateProjectFromPrompt(trimmedHomePrompt);
                }}
                className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                data-testid="workspace-home-submit"
              >
                {isCreatingProjectFromPrompt ? scaffoldMessages.starting : scaffoldMessages.start}
              </button>
            </div>
            {!isCreatingProjectFromPrompt && props.projectActionError ? (
              <p className="mt-3 text-sm text-red-700" data-testid="workspace-home-error">
                {props.projectActionError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  const templatesWorkspaceContent = (
    <div className="flex flex-1 min-h-0 flex-col p-4" data-testid="workspace-templates-view">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              {scaffoldMessages.templates}
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-gray-900">{scaffoldMessages.templates}</h2>
          </div>
          <input
            type="search"
            value={templateSearch}
            onChange={(event) => setTemplateSearch(event.target.value)}
            placeholder={scaffoldMessages.search}
            aria-label={scaffoldMessages.search}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 md:max-w-xs"
            data-testid="workspace-templates-search"
          />
        </div>
        {filteredTemplateProjects.length > 0 ? (
          <div
            className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
            data-testid="workspace-templates-grid"
          >
            {filteredTemplateProjects.map((project) => (
              <WorkspaceTemplateCard
                key={project.id}
                project={project}
                onFork={(projectId) => {
                  void props.onForkPublicWorkspaceProjectById?.(projectId);
                }}
                isForking={props.publicProjectActionState === 'forking'}
                forkLabel={scaffoldMessages.fork}
                forkingLabel={scaffoldMessages.forking}
              />
            ))}
          </div>
        ) : (
          <p
            className="mt-6 rounded-lg border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500"
            data-testid="workspace-templates-empty-state"
          >
            {scaffoldMessages.noTemplates}
          </p>
        )}
      </div>
    </div>
  );

  if (!projectFirstUxEnabled) {
    return (
      <div className="h-screen bg-gray-100 flex flex-col" data-testid="workspace-shell">
        <header className="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-gray-900">AI Sandbox Workspace</h1>
            <p className="text-xs text-gray-500">Workspace</p>
          </div>
          <div className="text-xs text-gray-600 text-right">
            <p>{headerIdentityLabel}</p>
            <p className="text-[11px] text-gray-500">Session-scoped workspace</p>
            <p className="mt-1">
              <a
                href="keys"
                className="text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline"
                data-testid="workspace-header-api-keys-link"
              >
                API Keys
              </a>
            </p>
            {props.onLogout ? (
              <p className="mt-1">
                <button
                  type="button"
                  onClick={props.onLogout}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  data-testid="workspace-header-logout-button"
                >
                  Log out
                </button>
              </p>
            ) : null}
          </div>
        </header>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          <aside
            className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-gray-200 flex flex-col"
            data-testid="session-sidebar-shell"
          >
            <div className="p-3 border-b border-gray-100">
              <button
                type="button"
                onClick={() => void props.onCreateSession()}
                disabled={props.isCreatingSession}
                className="w-full rounded bg-blue-600 text-white text-sm py-2 disabled:bg-blue-300"
              >
                {props.isCreatingSession
                  ? workspaceMessages.creatingSession
                  : workspaceMessages.newSession}
              </button>
              <p className="mt-2 text-xs text-gray-500">
                Active sessions: {activeSessions}/{props.quotaSummary?.maxActiveSessions ?? 5}
              </p>
              {props.sessionCreateError ? (
                <p className="mt-1 text-xs text-amber-700">{props.sessionCreateError}</p>
              ) : null}
              {props.sessionActionError ? (
                <p className="mt-1 text-xs text-amber-700">{props.sessionActionError}</p>
              ) : null}
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {props.sessions.map((session) => {
                const selected = session.id === props.selectedSessionId;
                const isUsable = isUsableSession(session);
                const isStopping = props.stoppingSessionId === session.id;
                return (
                  <div
                    key={session.id}
                    className={`w-full rounded border p-2 mb-2 ${
                      selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => props.onSelectSession(session.id)}
                      className={`w-full text-left rounded ${selected ? '' : 'hover:bg-gray-50'}`}
                    >
                      <p className="text-xs font-medium text-gray-900 truncate">
                        Session {session.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-gray-500">{getSessionLabel(session)}</p>
                    </button>
                    <div className="mt-2">
                      {isUsable ? (
                        <button
                          type="button"
                          onClick={() => {
                            runStopSessionWithConfirmation({
                              sessionId: session.id,
                              confirmStop: () =>
                                typeof window === 'undefined'
                                  ? true
                                  : window.confirm(workspaceMessages.stopSessionConfirm),
                              onStopSession: props.onStopSession,
                            });
                          }}
                          disabled={isStopping}
                          className="w-full rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 disabled:opacity-60"
                          data-testid={`session-stop-${session.id}`}
                        >
                          {isStopping ? 'Stopping...' : 'Stop'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => props.onRemoveSession(session.id)}
                          className="w-full rounded border border-gray-300 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-700"
                          data-testid={`session-remove-${session.id}`}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">{projectWorkspaceContent}</main>
        </div>

        <footer className="h-10 bg-white border-t border-gray-200 px-4 flex items-center justify-between text-xs text-gray-600">
          <span>Workspace</span>
          <span>Sessions: {props.sessions.length}</span>
        </footer>
      </div>
    );
  }

  const shouldShowFocusedCreateWorkspacePanel =
    projectFirstUxEnabled && isCreateWorkspacePanelOpen;

  return (
    <div className="h-screen bg-gray-100 flex flex-col" data-testid="workspace-shell">
      <div className="border-b border-gray-200 bg-white px-4 py-2 md:hidden">
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="rounded p-1.5 text-gray-600 active:scale-[0.97] transition-transform duration-100"
          data-testid="workspace-sidebar-mobile-toggle"
          aria-label="Open sidebar"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path d="M3 5H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M3 10H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M3 15H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-10 bg-black/20 transition-opacity duration-200 ease-out md:hidden"
            aria-hidden="true"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        <div
          className={[
            'fixed inset-y-0 left-0 z-20 w-72',
            'transition-transform duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)]',
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
            'md:static md:z-auto md:w-auto md:translate-x-0',
          ].join(' ')}
        >
          <WorkspaceSidebar
            locale={locale}
            workspaces={props.workspaces ?? []}
            selectedWorkspaceId={props.selectedWorkspaceId ?? null}
            onSelectWorkspaceId={handleSelectWorkspaceId}
            onOpenCreateWorkspaceFlow={handleOpenCreateWorkspacePanel}
            workspaceView={resolvedWorkspaceView}
            initialCompact={resolvedWorkspaceView === 'project'}
            onWorkspaceViewChange={handleWorkspaceViewChange}
            recentProjects={recentProjects}
            onOpenRecentProject={handleOpenRecentProject}
            userSummary={props.userSummary}
            usageSummary={props.usageSummary}
            quotaSummary={props.quotaSummary}
            activeSessions={activeSessions}
            onLogout={props.onLogout}
            onLanguageChange={props.onLanguageChange}
            footerContent={
              <WorkspaceAdvancedDrawer
                isOpen={advancedDrawerOpen}
                onToggle={() => setAdvancedDrawerOpen((current) => !current)}
                sessionId={props.selectedSessionId}
                sessionStatus={selectedSessionStatus}
                workspaceMessages={workspaceMessages}
                execPanelContent={
                  <WorkspaceExecPanel
                    projectFirstUxEnabled={projectFirstUxEnabled}
                    canReopenProject={canReopenProject}
                    onReopenProject={canReopenProject ? handleReopenProject : undefined}
                    selectedSessionId={props.selectedSessionId}
                    commandInput={props.commandInput}
                    onCommandInputChange={props.onCommandInputChange}
                    onExecuteCommand={props.onExecuteCommand}
                    execState={props.execState}
                    messages={workspaceMessages}
                  />
                }
                onCopySessionId={handleCopySelectedSessionId}
                canStopSession={canStopSelectedSession}
                isStoppingSession={isStoppingSelectedSession}
                onStopSession={canStopSelectedSession ? handleStopSelectedSession : undefined}
              />
            }
          />
        </div>

        <main className="flex-1 min-w-0 flex flex-col overflow-y-auto" data-testid="workspace-content-shell">
          {shouldShowFocusedCreateWorkspacePanel ? focusedCreateWorkspaceContent : null}
          {!shouldShowFocusedCreateWorkspacePanel && resolvedWorkspaceView === 'home'
            ? homeWorkspaceContent
            : null}
          {!shouldShowFocusedCreateWorkspacePanel && resolvedWorkspaceView === 'projects'
            ? projectsWorkspaceContent
            : null}
          {!shouldShowFocusedCreateWorkspacePanel && resolvedWorkspaceView === 'templates'
            ? templatesWorkspaceContent
            : null}
          {!shouldShowFocusedCreateWorkspacePanel && resolvedWorkspaceView === 'project' ? (
            <div data-testid="workspace-project-view" className="flex flex-1 min-h-0 flex-col overflow-hidden">
              <header
                className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2"
                data-testid="workspace-project-mode-header"
              >
                <button
                  type="button"
                  onClick={() => props.onWorkspaceViewChange?.('projects')}
                  className="rounded px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  data-testid="workspace-project-back-button"
                >
                  &larr; {backLabel}
                </button>
                <h2 className="flex-1 text-sm font-semibold text-gray-900 truncate">
                  {activeProjectName}
                </h2>
                <button
                  type="button"
                  onClick={handleAiPanelCollapseToggle}
                  className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                  data-testid="workspace-ai-panel-collapse-toggle"
                >
                  {aiPanelCollapsed ? projectPanelMessages.expandPanel : projectPanelMessages.collapsePanel}
                </button>
              </header>
              {projectBuildToolbar}
              <div className="flex flex-1 min-h-0 flex-col md:flex-row">
                {!aiPanelCollapsed ? (
                  <aside
                    className="w-full max-h-[50vh] md:w-96 md:max-h-none border-r border-gray-200 bg-white overflow-hidden flex flex-col gap-2 p-2"
                    data-testid="workspace-project-ai-panel"
                  >
                    {projectChatSection}
                  </aside>
                ) : null}
                <main
                  className="flex-1 min-w-0 flex flex-col"
                  data-testid="workspace-project-content-panel"
                >
                  <WorkspaceTabBar
                    tabs={tabBarTabs}
                    activeTabId={activeTabId}
                    orientation={tabOrientation}
                    onTabChange={setActiveTabId}
                    onOrientationToggle={handleTabOrientationToggle}
                  />
                  <div className="flex-1 min-h-0 overflow-hidden flex flex-col" data-testid="workspace-tab-content">
                    {activeTabId === 'preview' ? (
                      <div
                        className="flex flex-col flex-1 min-h-0 overflow-hidden"
                        data-testid="preview-panel-shell"
                      >
                        <WorkspacePreviewPanel
                          projectFirstUxEnabled={projectFirstUxEnabled}
                          projectMessages={projectPanelMessages}
                          previewMessages={previewMessages}
                          commonMessages={commonMessages}
                          selectedSessionId={props.selectedSessionId}
                          previewState={props.previewState}
                          previewUrl={props.previewUrl}
                          onStartPreview={props.onStartPreview}
                          onRefreshPreview={props.onRefreshPreview}
                          onPreviewLoad={handlePreviewLoadWithPicker}
                          onPreviewError={props.onPreviewError}
                          iframeRef={previewIframeRef}
                          pickerActive={pickerActive}
                          onPickerToggle={handlePickerToggle}
                          selectedPreviewElement={selectedPreviewElement}
                          fillHeight
                        />
                      </div>
                    ) : null}
                    {activeTabId === 'codeFiles' ? (
                      <div
                        className="flex flex-col flex-1 min-h-0 overflow-hidden"
                        data-testid="editor-panel-shell"
                      >
                        <WorkspaceEditorPanel
                          projectFirstUxEnabled={projectFirstUxEnabled}
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
                          fillHeight
                        />
                      </div>
                    ) : null}
                    {activeTabId !== 'preview' && activeTabId !== 'codeFiles' ? (
                      <div
                        className="flex flex-col items-center justify-center flex-1 gap-3 p-8"
                        data-testid="workspace-tab-placeholder"
                      >
                        <p className="text-sm font-medium text-gray-700">{activeTabLabel}</p>
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
                          {comingSoonLabel}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </main>
              </div>
            </div>
          ) : null}
        </main>
      </div>

      <footer className="h-10 bg-white border-t border-gray-200 px-4 flex items-center justify-between text-xs text-gray-600">
        <span>Workspace</span>
        <span>Workspaces: {props.sessions.length}</span>
      </footer>
    </div>
  );
}

function HistoryProjectPanel(props: {
  projectFirstUxEnabled?: boolean;
  selectedSessionId: string | null;
  listState: 'idle' | 'loading' | 'ready' | 'error';
  actionState: 'idle' | 'creating' | 'opening' | 'moving' | 'success' | 'error';
  actionMessage: string | null;
  actionError: string | null;
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  workspaceActionState: 'idle' | 'creating' | 'renaming' | 'deleting';
  workspaceActionError: string | null;
  workspaceCreateNameInput: string;
  workspaceRenameNameInput: string;
  onSelectWorkspaceId?: (workspaceId: string) => void;
  onWorkspaceCreateNameInputChange?: (value: string) => void;
  onWorkspaceRenameNameInputChange?: (value: string) => void;
  onCreateWorkspace?: () => Promise<void>;
  onRenameWorkspace?: () => Promise<void>;
  onDeleteWorkspace?: () => Promise<void>;
  projects: WorkspaceProjectSummary[];
  selectedProjectId: string | null;
  projectMoveTargetWorkspaceId: string | null;
  projectNameInput: string;
  onProjectNameInputChange?: (value: string) => void;
  onProjectMoveTargetWorkspaceIdChange?: (workspaceId: string) => void;
  onSelectProjectId?: (projectId: string) => void;
  onMoveWorkspaceProject?: () => Promise<void>;
  onCreateProject?: () => Promise<void>;
  onOpenProject?: () => Promise<void>;
  selectedProjectVisibility: 'private' | 'public';
  onSelectedProjectVisibilityChange?: (visibility: 'private' | 'public') => void;
  onUpdateProjectVisibility?: () => Promise<void>;
  publicProjectListState: 'idle' | 'loading' | 'ready' | 'error';
  publicProjectActionState: 'idle' | 'viewing' | 'forking' | 'success' | 'error';
  publicProjectActionMessage: string | null;
  publicProjectActionError: string | null;
  publicProjects: WorkspacePublicProjectSummary[];
  selectedPublicProjectId: string | null;
  selectedPublicProjectDetail: WorkspacePublicProjectDetail | null;
  onSelectPublicProjectId?: (projectId: string) => void;
  onViewPublicProject?: () => Promise<void>;
  onForkPublicProject?: () => Promise<void>;
  workspaceMessages: Pick<
    typeof enMessages.workspace,
    | 'selectWorkspace'
    | 'newWorkspaceName'
    | 'createWorkspace'
    | 'renameSelectedWorkspace'
    | 'renameWorkspace'
    | 'deleteWorkspace'
    | 'selectTargetWorkspace'
    | 'noOtherWorkspaces'
    | 'moveToWorkspace'
  >;
  projectMessages: Pick<
    typeof enMessages.project,
    | 'newProjectName'
    | 'createProject'
    | 'selectProject'
    | 'openProject'
    | 'sharingVisibilityOptional'
    | 'view'
    | 'fork'
  >;
  commonMessages: Pick<
    typeof enMessages.common,
    'creating' | 'renaming' | 'deleting' | 'opening' | 'moving' | 'loading' | 'forking'
  >;
  hideWorkspaceAdminControls?: boolean;
}) {
  if (
    !props.onProjectNameInputChange ||
    !props.onSelectWorkspaceId ||
    !props.onWorkspaceCreateNameInputChange ||
    !props.onWorkspaceRenameNameInputChange ||
    !props.onCreateWorkspace ||
    !props.onRenameWorkspace ||
    !props.onDeleteWorkspace ||
    !props.onSelectProjectId ||
    !props.onProjectMoveTargetWorkspaceIdChange ||
    !props.onMoveWorkspaceProject ||
    !props.onCreateProject ||
    !props.onOpenProject ||
    !props.onSelectedProjectVisibilityChange ||
    !props.onUpdateProjectVisibility ||
    !props.onSelectPublicProjectId ||
    !props.onViewPublicProject ||
    !props.onForkPublicProject
  ) {
    return null;
  }

  const canMutate = Boolean(props.projectFirstUxEnabled || props.selectedSessionId);
  const selectedWorkspace =
    props.workspaces.find((workspace) => workspace.id === props.selectedWorkspaceId) ?? null;
  const selectedProject =
    props.projects.find((project) => project.id === props.selectedProjectId) ?? null;
  const availableMoveWorkspaces = selectedProject
    ? props.workspaces.filter((workspace) => workspace.id !== selectedProject.workspaceId)
    : [];
  const isWorkspaceActionBusy = props.workspaceActionState !== 'idle';
  const hasProjectActionInFlight =
    props.actionState === 'creating' ||
    props.actionState === 'opening' ||
    props.actionState === 'moving';
  const workspaceControlsDisabled = isWorkspaceActionBusy || hasProjectActionInFlight;
  const canDeleteSelectedWorkspace = Boolean(selectedWorkspace && !selectedWorkspace.isDefault);
  const shouldShowWorkspaceAdminControls = !props.hideWorkspaceAdminControls;

  return (
    <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-2" data-testid="history-project-surface">
      <div className="rounded border border-violet-200 bg-white p-2" data-testid="history-my-projects-surface">
        <p className="text-xs font-semibold text-gray-700">My Projects</p>
        <p className="mt-1 text-[11px] text-gray-500">
          Create and open your projects here. New projects are private by default.
        </p>

        {shouldShowWorkspaceAdminControls ? (
          <div className="mt-2">
            <select
              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
              value={props.selectedWorkspaceId ?? ''}
              onChange={(event) => props.onSelectWorkspaceId?.(event.target.value)}
              disabled={workspaceControlsDisabled}
              data-testid="history-workspace-select"
            >
              <option value="" disabled>
                {props.workspaceMessages.selectWorkspace}
              </option>
              {props.workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {shouldShowWorkspaceAdminControls ? (
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={props.workspaceCreateNameInput}
              onChange={(event) => props.onWorkspaceCreateNameInputChange?.(event.target.value)}
              placeholder={props.workspaceMessages.newWorkspaceName}
              className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs"
              data-testid="history-workspace-create-input"
            />
            <button
              type="button"
              className="rounded bg-violet-600 px-2 py-1 text-xs text-white disabled:bg-violet-300"
              disabled={!canMutate || workspaceControlsDisabled}
              onClick={() => void props.onCreateWorkspace?.()}
              data-testid="history-workspace-create-button"
            >
              {props.workspaceActionState === 'creating'
                ? props.commonMessages.creating
                : props.workspaceMessages.createWorkspace}
            </button>
          </div>
        ) : null}

        {shouldShowWorkspaceAdminControls ? (
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={props.workspaceRenameNameInput}
              onChange={(event) => props.onWorkspaceRenameNameInputChange?.(event.target.value)}
              placeholder={props.workspaceMessages.renameSelectedWorkspace}
              className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs"
              disabled={!props.selectedWorkspaceId || workspaceControlsDisabled}
              data-testid="history-workspace-rename-input"
            />
            <button
              type="button"
              className="rounded bg-indigo-600 px-2 py-1 text-xs text-white disabled:bg-indigo-300"
              disabled={!canMutate || !props.selectedWorkspaceId || workspaceControlsDisabled}
              onClick={() => void props.onRenameWorkspace?.()}
              data-testid="history-workspace-rename-button"
            >
              {props.workspaceActionState === 'renaming'
                ? props.commonMessages.renaming
                : props.workspaceMessages.renameWorkspace}
            </button>
            <button
              type="button"
              className="rounded bg-rose-600 px-2 py-1 text-xs text-white disabled:bg-rose-300"
              disabled={!canMutate || !canDeleteSelectedWorkspace || workspaceControlsDisabled}
              onClick={() => void props.onDeleteWorkspace?.()}
              data-testid="history-workspace-delete-button"
            >
              {props.workspaceActionState === 'deleting'
                ? props.commonMessages.deleting
                : props.workspaceMessages.deleteWorkspace}
            </button>
          </div>
        ) : null}
        {shouldShowWorkspaceAdminControls && props.workspaceActionError ? (
          <p className="mt-2 text-[11px] text-red-700" data-testid="history-workspace-action-error">
            {props.workspaceActionError}
          </p>
        ) : null}

        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={props.projectNameInput}
            onChange={(event) => props.onProjectNameInputChange?.(event.target.value)}
            placeholder={props.projectMessages.newProjectName}
            className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs"
            data-testid="history-project-name-input"
          />
          <button
            type="button"
            className="rounded bg-violet-600 px-2 py-1 text-xs text-white disabled:bg-violet-300"
            disabled={!canMutate || hasProjectActionInFlight}
            onClick={() => void props.onCreateProject?.()}
            data-testid="history-project-create-button"
          >
            {props.actionState === 'creating'
              ? props.commonMessages.creating
              : props.projectMessages.createProject}
          </button>
        </div>

        <div className="mt-2 flex gap-2">
          <select
            className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs"
            value={props.selectedProjectId ?? ''}
            onChange={(event) => props.onSelectProjectId?.(event.target.value)}
            disabled={props.listState === 'loading' || hasProjectActionInFlight}
            data-testid="history-project-select"
          >
            <option value="">{props.projectMessages.selectProject}</option>
            {props.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded bg-teal-600 px-2 py-1 text-xs text-white disabled:bg-teal-300"
            disabled={!canMutate || !props.selectedProjectId || hasProjectActionInFlight}
            onClick={() => void props.onOpenProject?.()}
            data-testid="history-project-open-button"
          >
            {props.actionState === 'opening'
              ? props.commonMessages.opening
              : props.projectMessages.openProject}
          </button>
        </div>
        {props.selectedProjectId ? (
          <div className="mt-2 flex gap-2">
            <select
              className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs"
              value={props.projectMoveTargetWorkspaceId ?? ''}
              onChange={(event) =>
                props.onProjectMoveTargetWorkspaceIdChange?.(event.target.value)
              }
              disabled={!canMutate || workspaceControlsDisabled || availableMoveWorkspaces.length === 0}
              data-testid="history-project-move-workspace-select"
            >
              <option value="">
                {availableMoveWorkspaces.length > 0
                  ? props.workspaceMessages.selectTargetWorkspace
                  : props.workspaceMessages.noOtherWorkspaces}
              </option>
              {availableMoveWorkspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded bg-amber-600 px-2 py-1 text-xs text-white disabled:bg-amber-300"
              disabled={
                !canMutate ||
                workspaceControlsDisabled ||
                !props.projectMoveTargetWorkspaceId ||
                availableMoveWorkspaces.length === 0
              }
              onClick={() => void props.onMoveWorkspaceProject?.()}
              data-testid="history-project-move-button"
            >
              {props.actionState === 'moving'
                ? props.commonMessages.moving
                : props.workspaceMessages.moveToWorkspace}
            </button>
          </div>
        ) : null}
      </div>

      <div
        className="mt-2 rounded border border-gray-200 bg-white p-2"
        data-testid="history-project-sharing-surface"
      >
        <p className="text-xs font-semibold text-gray-700">{props.projectMessages.sharingVisibilityOptional}</p>
        <p className="mt-1 text-[11px] text-gray-500">
          Use this only when you want to change how a selected project is shared.
        </p>
        <div className="mt-2 flex gap-2">
          <select
            className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs"
            value={props.selectedProjectVisibility}
            onChange={(event) =>
              props.onSelectedProjectVisibilityChange?.(
                event.target.value === 'public' ? 'public' : 'private',
              )
            }
            disabled={!props.selectedProjectId || hasProjectActionInFlight}
            data-testid="history-project-visibility-select"
          >
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
          <button
            type="button"
            className="rounded bg-indigo-600 px-2 py-1 text-xs text-white disabled:bg-indigo-300"
            disabled={!props.selectedProjectId || hasProjectActionInFlight}
            onClick={() => void props.onUpdateProjectVisibility?.()}
            data-testid="history-project-visibility-update-button"
          >
            Update Visibility
          </button>
        </div>
      </div>

      <div className="mt-2 rounded border border-gray-200 bg-white p-2" data-testid="history-public-project-surface">
        <p className="text-xs font-semibold text-gray-700">Public Projects</p>
        <p className="mt-1 text-[11px] text-gray-500">
          Browse shared projects separately, view read-only details, and fork.
        </p>
        <div className="mt-2 flex gap-2">
          <select
            className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs"
            value={props.selectedPublicProjectId ?? ''}
            onChange={(event) => props.onSelectPublicProjectId?.(event.target.value)}
            disabled={props.publicProjectListState === 'loading' || props.publicProjectActionState === 'viewing'}
            data-testid="history-public-project-select"
          >
            <option value="">Select a public project</option>
            {props.publicProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded bg-sky-600 px-2 py-1 text-xs text-white disabled:bg-sky-300"
            disabled={!props.selectedPublicProjectId || props.publicProjectActionState === 'viewing'}
            onClick={() => void props.onViewPublicProject?.()}
            data-testid="history-public-project-view-button"
          >
            {props.publicProjectActionState === 'viewing'
              ? props.commonMessages.loading
              : props.projectMessages.view}
          </button>
          <button
            type="button"
            className="rounded bg-emerald-600 px-2 py-1 text-xs text-white disabled:bg-emerald-300"
            disabled={!props.selectedPublicProjectId || props.publicProjectActionState === 'forking'}
            onClick={() => void props.onForkPublicProject?.()}
            data-testid="history-public-project-fork-button"
          >
            {props.publicProjectActionState === 'forking'
              ? props.commonMessages.forking
              : props.projectMessages.fork}
          </button>
        </div>
        {props.selectedPublicProjectDetail ? (
          <div className="mt-2 rounded border border-gray-100 bg-gray-50 p-2 text-[11px] text-gray-700" data-testid="history-public-project-readonly-detail">
            <p>Read-only public view</p>
            <p>ID: {props.selectedPublicProjectDetail.id}</p>
            <p>Name: {props.selectedPublicProjectDetail.name}</p>
            <p>Visibility: {props.selectedPublicProjectDetail.visibility}</p>
          </div>
        ) : null}
      </div>

      {props.listState === 'loading' ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-gray-500" data-testid="history-project-list-loading">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-pulse" />
          <span>Loading projects...</span>
        </p>
      ) : null}
      {props.listState === 'error' ? (
        <p className="mt-2 text-[11px] text-red-700" data-testid="history-project-list-error">
          Failed to load projects.
        </p>
      ) : null}
      {props.actionMessage ? (
        <p className="mt-2 text-[11px] text-emerald-700" data-testid="history-project-action-message">
          {props.actionMessage}
        </p>
      ) : null}
      {props.actionError ? (
        <p className="mt-2 text-[11px] text-red-700" data-testid="history-project-action-error">
          {props.actionError}
        </p>
      ) : null}
      {props.publicProjectListState === 'loading' ? (
        <p
          className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-gray-500"
          data-testid="history-public-project-list-loading"
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-pulse" />
          <span>Loading public projects...</span>
        </p>
      ) : null}
      {props.publicProjectListState === 'error' ? (
        <p className="mt-2 text-[11px] text-red-700" data-testid="history-public-project-list-error">
          Failed to load public projects.
        </p>
      ) : null}
      {props.publicProjectActionMessage ? (
        <p className="mt-2 text-[11px] text-emerald-700" data-testid="history-public-project-action-message">
          {props.publicProjectActionMessage}
        </p>
      ) : null}
      {props.publicProjectActionError ? (
        <p className="mt-2 text-[11px] text-red-700" data-testid="history-public-project-action-error">
          {props.publicProjectActionError}
        </p>
      ) : null}
    </div>
  );
}

function HistorySnapshotPanel(props: {
  projectMessages: Pick<
    typeof enMessages.project,
    'saveSnapshot' | 'restoreSnapshot' | 'downloadProject' | 'importProject'
  >;
  commonMessages: Pick<typeof enMessages.common, 'saving' | 'restoring' | 'exporting' | 'importing'>;
  selectedSessionId: string | null;
  listState: 'idle' | 'loading' | 'ready' | 'error';
  actionState:
    | 'idle'
    | 'saving'
    | 'restoring'
    | 'exporting'
    | 'importing'
    | 'success'
    | 'error';
  actionMessage: string | null;
  actionError: string | null;
  snapshots: WorkspaceSnapshotSummary[];
  selectedSnapshotId: string | null;
  onSelectSnapshotId?: (snapshotId: string) => void;
  onSaveSnapshot?: () => Promise<void>;
  onRestoreSnapshot?: () => Promise<void>;
  onExportArchive?: () => Promise<void>;
  onImportArchive?: (file: File) => Promise<void>;
}) {
  if (
    !props.onSaveSnapshot ||
    !props.onRestoreSnapshot ||
    !props.onSelectSnapshotId ||
    !props.onExportArchive ||
    !props.onImportArchive
  ) {
    return null;
  }

  const canMutate = Boolean(props.selectedSessionId);

  return (
    <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-2" data-testid="history-snapshot-surface">
      <p className="text-xs font-semibold text-gray-700">Project Snapshots</p>
      <p className="mt-1 text-[11px] text-gray-500">
        Save/restore snapshots and import/export workspace archives for the active session.
      </p>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="rounded bg-indigo-600 px-2 py-1 text-xs text-white disabled:bg-indigo-300"
          disabled={!canMutate || props.actionState === 'saving' || props.actionState === 'restoring'}
          onClick={() => void props.onSaveSnapshot?.()}
          data-testid="history-snapshot-save-button"
        >
          {props.actionState === 'saving'
            ? props.commonMessages.saving
            : props.projectMessages.saveSnapshot}
        </button>
        <button
          type="button"
          className="rounded bg-emerald-600 px-2 py-1 text-xs text-white disabled:bg-emerald-300"
          disabled={
            !canMutate ||
            !props.selectedSnapshotId ||
            props.actionState === 'saving' ||
            props.actionState === 'restoring'
          }
          onClick={() => void props.onRestoreSnapshot?.()}
          data-testid="history-snapshot-restore-button"
        >
          {props.actionState === 'restoring'
            ? props.commonMessages.restoring
            : props.projectMessages.restoreSnapshot}
        </button>
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="rounded bg-sky-600 px-2 py-1 text-xs text-white disabled:bg-sky-300"
          disabled={!canMutate || props.actionState === 'exporting' || props.actionState === 'importing'}
          onClick={() => void props.onExportArchive?.()}
          data-testid="history-archive-export-button"
        >
          {props.actionState === 'exporting'
            ? props.commonMessages.exporting
            : props.projectMessages.downloadProject}
        </button>
        <label
          className={`rounded px-2 py-1 text-xs text-white ${
            canMutate && props.actionState !== 'exporting' && props.actionState !== 'importing'
              ? 'bg-amber-600 cursor-pointer'
              : 'bg-amber-300 cursor-not-allowed'
          }`}
          data-testid="history-archive-import-label"
        >
          {props.actionState === 'importing'
            ? props.commonMessages.importing
            : props.projectMessages.importProject}
          <input
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            disabled={!canMutate || props.actionState === 'exporting' || props.actionState === 'importing'}
            data-testid="history-archive-import-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }
              void props.onImportArchive?.(file);
              event.currentTarget.value = '';
            }}
          />
        </label>
      </div>

      <div className="mt-2">
        <label className="mb-1 block text-[11px] text-gray-600" htmlFor="history-snapshot-select">
          Available snapshots
        </label>
        <select
          id="history-snapshot-select"
          className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
          value={props.selectedSnapshotId ?? ''}
          onChange={(event) => props.onSelectSnapshotId?.(event.target.value)}
          disabled={props.listState === 'loading' || props.actionState === 'restoring'}
          data-testid="history-snapshot-select"
        >
          <option value="">Select a snapshot</option>
          {props.snapshots.map((snapshot) => (
            <option key={snapshot.id} value={snapshot.id}>
              {snapshot.label ?? 'Snapshot'} ({new Date(snapshot.createdAt).toLocaleString()}) - {snapshot.fileCount} files
            </option>
          ))}
        </select>
      </div>

      {props.listState === 'loading' ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-gray-500" data-testid="history-snapshot-list-loading">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-pulse" />
          <span>Loading snapshots...</span>
        </p>
      ) : null}
      {props.listState === 'error' ? (
        <p className="mt-2 text-[11px] text-red-700" data-testid="history-snapshot-list-error">
          Failed to load snapshots.
        </p>
      ) : null}
      {props.actionMessage ? (
        <p className="mt-2 text-[11px] text-emerald-700" data-testid="history-snapshot-action-message">
          {props.actionMessage}
        </p>
      ) : null}
      {props.actionError ? (
        <p className="mt-2 text-[11px] text-red-700" data-testid="history-snapshot-action-error">
          {props.actionError}
        </p>
      ) : null}
    </div>
  );
}

interface ProjectHistoryRow {
  id: string;
  label: string;
  createdAt: string;
}

function ProjectHistoryPanel(props: {
  projectFirstUxEnabled: boolean;
  selectedProjectId: string | null;
  rows: ProjectHistoryRow[];
  onRestore?: (snapshotId: string) => void;
  onSave?: () => void;
}) {
  if (!props.projectFirstUxEnabled || !props.selectedProjectId) {
    return null;
  }

  const latestHistoryRow = props.rows[0] ?? null;

  return (
    <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-2" data-testid="history-project-history-surface">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-gray-700">Project History</p>
          <span
            className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700"
            data-testid="history-project-history-entrypoint"
          >
            {recoveryCopy.workspace.versionsEntryPoint}
          </span>
        </div>
        {props.onSave ? (
          <button
            type="button"
            className="rounded border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700"
            onClick={() => props.onSave?.()}
            data-testid="history-project-history-save"
          >
            {recoveryCopy.actions.saveNamedSnapshot}
          </button>
        ) : null}
      </div>
      {latestHistoryRow ? (
        <p
          className="mt-2 text-[11px] text-gray-500"
          data-testid="history-project-history-last-protected"
        >
          {recoveryCopy.workspace.lastProtected}:{' '}
          <time dateTime={latestHistoryRow.createdAt}>
            {formatProjectHistoryTimestamp(latestHistoryRow.createdAt)}
          </time>
        </p>
      ) : null}
      {props.rows.length === 0 ? (
        <p className="mt-2 text-[11px] text-gray-500" data-testid="history-project-history-empty">
          {recoveryCopy.workspace.noProjectHistoryYet}
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {props.rows.map((row) => (
            <li
              key={row.id}
              className="rounded border border-gray-200 bg-white px-2 py-2"
              data-testid={`history-project-history-row-${row.id}`}
            >
              <p
                className="text-xs font-medium text-gray-700"
                data-testid={`history-project-history-label-${row.id}`}
              >
                {row.label}
              </p>
              <time
                className="mt-1 block text-[11px] text-gray-500"
                dateTime={row.createdAt}
                data-testid={`history-project-history-timestamp-${row.id}`}
              >
                {formatProjectHistoryTimestamp(row.createdAt)}
              </time>
              {props.onRestore ? (
                <button
                  type="button"
                  className="mt-2 rounded border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700"
                  onClick={() => props.onRestore?.(row.id)}
                  data-testid={`history-project-history-restore-${row.id}`}
                >
                  {recoveryCopy.actions.restoreSnapshot}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WorkspaceChatPanel(props: {
  projectFirstUxEnabled: boolean;
  aiMessages: typeof enMessages.ai;
  commonMessages: typeof enMessages.common;
  selectedSessionId: string | null;
  promptInput: string;
  onPromptInputChange?: (value: string) => void;
  selectedModelOption: string;
  onSelectedModelOptionChange?: (value: string) => void;
  availableModelOptions: Array<{
    value: string;
    label: string;
  }>;
  orchestrationEnabled: boolean;
  onOrchestrationEnabledChange?: (enabled: boolean) => void;
  onSubmitPrompt?: () => Promise<void>;
  requestState: 'idle' | 'submitting' | 'queued' | 'running' | 'completed' | 'failed';
  executionId: string | null;
  statusMessage: string | null;
  responseText: string;
  errorMessage: string | null;
  visualEditExecutionIds: string[];
  visualEditCheckpointByExecutionId?: Record<string, string>;
  onConfirmExecutionFileActions?: (executionId: string) => void | Promise<void>;
  onCancelExecutionFileActions?: (executionId: string) => void;
  onInitiateCheckpointRevert?: (checkpointId: string) => void;
  threadMessages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    messageKind?: 'ai' | 'system';
    executionId?: string;
    provider?: string;
    model?: string;
    fileActionState?: WorkspaceExecutionFileActionState;
  }>;
}) {
  const shouldRenderPreformattedChatContent = (content: string): boolean => {
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      return false;
    }

    // Keep explicit fenced code and common shell/diff outputs preformatted.
    if (
      trimmedContent.includes('```') ||
      trimmedContent.startsWith('diff --git') ||
      trimmedContent.startsWith('$ ') ||
      trimmedContent.startsWith('PS ')
    ) {
      return true;
    }

    return false;
  };

  const isSending =
    props.requestState === 'submitting' ||
    props.requestState === 'queued' ||
    props.requestState === 'running';
  const promptInputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const prevIsSendingRef = React.useRef(false);

  React.useEffect(() => {
    if (prevIsSendingRef.current && !isSending) {
      promptInputRef.current?.focus();
    }
    prevIsSendingRef.current = isSending;
  }, [isSending]);

  const visualEditExecutionIdSet = new Set(props.visualEditExecutionIds);
  const canSubmit =
    Boolean(props.selectedSessionId) &&
    Boolean(props.onSubmitPrompt) &&
    Boolean(props.onPromptInputChange) &&
    props.promptInput.trim().length > 0 &&
    !isSending;

  const submitPromptAndRefocus = () => {
    if (!canSubmit || !props.onSubmitPrompt) {
      return;
    }
    void props.onSubmitPrompt();
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitPromptAndRefocus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitPromptAndRefocus();
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto p-3" data-testid="workspace-chat-thread">
        <p className="sr-only">{props.aiMessages.messageThread}</p>
        {props.threadMessages.length === 0 ? (
          <div className="mt-1 space-y-2 text-sm text-gray-500" data-testid="workspace-chat-empty-state">
            <p
              data-testid={
                props.selectedSessionId
                  ? 'workspace-chat-empty-active-session'
                  : 'workspace-chat-empty-no-session'
              }
            >
              {props.selectedSessionId ? props.aiMessages.emptyWithSession : props.aiMessages.emptyNoSession}
            </p>
            {props.selectedSessionId ? (
              <p
                className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600"
                data-testid="workspace-chat-empty-auth-suggestion"
              >
                {props.aiMessages.emptyAuthSuggestion}
              </p>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-3" data-testid="workspace-chat-thread-list">
            {props.threadMessages.map((message) => (
              (() => {
                const displayContent =
                  message.content.trim().length > 0
                    ? message.content
                    : message.role === 'assistant'
                      ? props.aiMessages.waitingForResponse
                      : '';
                const usePreformattedAssistantContent =
                  message.role === 'assistant' &&
                  shouldRenderPreformattedChatContent(displayContent);
                const undoCheckpointId = message.executionId
                  ? (props.visualEditCheckpointByExecutionId?.[message.executionId] ?? null)
                  : null;
                const isSystemMessage = message.role === 'assistant' && message.messageKind === 'system';
                const messageRoleLabel =
                  message.role === 'user'
                    ? props.aiMessages.roleUser
                    : isSystemMessage
                      ? props.aiMessages.roleSystem
                      : props.aiMessages.roleAssistant;
                return (
              <li
                key={message.id}
                className={`rounded-lg px-3 py-2 text-sm ${
                  message.role === 'user'
                    ? 'ml-8 border border-blue-200 bg-blue-50 text-blue-900'
                    : isSystemMessage
                      ? 'mr-8 border border-gray-300 bg-gray-100 text-gray-700'
                    : 'mr-8 border border-gray-200 bg-white text-gray-800'
                }`}
                data-testid={`workspace-chat-message-${message.role}-${message.id}`}
                data-message-kind={
                  message.role === 'assistant' ? (isSystemMessage ? 'system' : 'ai') : 'user'
                }
              >
                <p className="text-xs text-gray-500">
                  {messageRoleLabel}
                </p>
                {message.role === 'assistant' && (message.model || message.provider) ? (
                  <p
                    className="mt-0.5 text-[10px] text-gray-400"
                    data-testid={`workspace-chat-message-attribution-${message.id}`}
                  >
                    Model: {message.model ?? 'unknown'} ({message.provider ?? 'unknown'})
                  </p>
                ) : null}
                {message.role === 'assistant' ? (
                  usePreformattedAssistantContent ? (
                    <pre
                      className="mt-1.5 whitespace-pre-wrap rounded border border-gray-100 bg-gray-50 p-2 font-mono text-xs text-gray-800"
                      data-testid={`workspace-chat-message-content-pre-${message.id}`}
                    >
                      {displayContent}
                    </pre>
                  ) : (
                    <p
                      className="mt-1 whitespace-pre-wrap text-sm text-gray-800"
                      data-testid={`workspace-chat-message-content-prose-${message.id}`}
                    >
                      {displayContent}
                    </p>
                  )
                ) : (
                  <p className="mt-1 whitespace-pre-wrap text-sm">{displayContent}</p>
                )}
                {message.role === 'assistant' && message.fileActionState ? (
                  <WorkspaceAssistantFileActionSummary
                    fileActionState={message.fileActionState}
                    aiMessages={props.aiMessages}
                    commonMessages={props.commonMessages}
                    selectedSessionId={props.selectedSessionId}
                    isVisualEditExecution={Boolean(
                      message.executionId && visualEditExecutionIdSet.has(message.executionId),
                    )}
                    onConfirm={
                      message.executionId && props.onConfirmExecutionFileActions
                        ? () => void props.onConfirmExecutionFileActions?.(message.executionId!)
                        : undefined
                    }
                    onCancel={
                      message.executionId && props.onCancelExecutionFileActions
                        ? () => props.onCancelExecutionFileActions?.(message.executionId!)
                        : undefined
                    }
                    onUndoVisualEdit={
                      undoCheckpointId && props.onInitiateCheckpointRevert
                        ? () => props.onInitiateCheckpointRevert?.(undoCheckpointId)
                        : undefined
                    }
                  />
                ) : null}
              </li>
                );
              })()
            ))}
          </ul>
        )}

        {isSending && props.responseText.trim().length > 0 ? (
          <div className="mt-3 mr-8 rounded-lg border border-gray-200 bg-white px-3 py-2" data-testid="workspace-chat-response">
            {shouldRenderPreformattedChatContent(props.responseText) ? (
              <pre
                className="whitespace-pre-wrap rounded border border-gray-100 bg-gray-50 p-2 font-mono text-xs text-gray-800"
                data-testid="workspace-chat-response-content-pre"
              >
                {props.responseText}
              </pre>
            ) : (
              <p
                className="whitespace-pre-wrap text-sm text-gray-800"
                data-testid="workspace-chat-response-content-prose"
              >
                {props.responseText}
              </p>
            )}
          </div>
        ) : null}

        {isSending && props.executionId ? (
          <p className="mt-2 text-xs text-gray-400" data-testid="workspace-chat-execution-id">
            Execution: {props.executionId}
          </p>
        ) : null}
        {isSending && props.statusMessage ? (
          <p className="mt-2 text-xs text-blue-600" data-testid="workspace-chat-status">
            {props.statusMessage}
          </p>
        ) : null}
        {props.errorMessage ? (
          <p className="mt-2 text-xs text-red-600" data-testid="workspace-chat-error">
            {props.errorMessage}
          </p>
        ) : null}
      </div>

      <div className="flex-shrink-0 border-t border-gray-200 bg-white px-3 py-2">
        <form onSubmit={handleSubmit} className="min-w-0 max-w-full">
          <div className="flex min-w-0 max-w-full items-end gap-2" data-testid="workspace-chat-composer-row">
            <div className="min-w-0 flex-1">
              <label htmlFor="workspace-chat-prompt" className="sr-only">
                {props.aiMessages.promptLabel}
              </label>
              <textarea
                id="workspace-chat-prompt"
                data-testid="workspace-chat-prompt-input"
                ref={promptInputRef}
                value={props.promptInput}
                onChange={(event) => props.onPromptInputChange?.(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!props.selectedSessionId || !props.onPromptInputChange || isSending}
                placeholder={props.aiMessages.chatInputPlaceholder}
                className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:outline-none disabled:bg-gray-100 disabled:text-gray-500"
                rows={3}
              />
            </div>
            <button
              type="submit"
              data-testid="workspace-chat-submit"
              disabled={!canSubmit}
              className="shrink-0 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {isSending ? props.aiMessages.sending : props.commonMessages.send}
            </button>
          </div>
          <div
            className="mt-2 flex min-w-0 max-w-full flex-wrap items-start gap-3"
            data-testid="workspace-chat-secondary-controls"
          >
            <label htmlFor="workspace-chat-model-selector" className="sr-only">
              {props.aiMessages.modelProviderLabel}
            </label>
            <select
              id="workspace-chat-model-selector"
              data-testid="workspace-chat-model-selector"
              value={props.selectedModelOption}
              onChange={(event) =>
                props.onSelectedModelOptionChange?.(event.target.value)
              }
              disabled={
                !props.selectedSessionId ||
                !props.onSelectedModelOptionChange ||
                props.availableModelOptions.length === 0 ||
                isSending
              }
              className="max-w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 disabled:bg-gray-100 disabled:text-gray-400"
            >
              {props.availableModelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label className="flex min-w-0 max-w-full items-start gap-1.5 text-xs text-gray-500">
              <input
                type="checkbox"
                data-testid="workspace-chat-orchestration-toggle"
                checked={props.orchestrationEnabled}
                onChange={(event) => props.onOrchestrationEnabledChange?.(event.target.checked)}
                disabled={!props.selectedSessionId || !props.onOrchestrationEnabledChange || isSending}
                className="mt-0.5 shrink-0"
              />
              <span className="min-w-0 break-words">{props.aiMessages.orchestrationLabel}</span>
            </label>
          </div>
          <p className="mt-1.5 text-xs text-gray-400" data-testid="workspace-chat-session-hint">
            {props.selectedSessionId
              ? props.projectFirstUxEnabled
                ? recoveryCopy.workspace.chatReady
                : 'Prompt runs through the existing AI execution flow.'
              : props.projectFirstUxEnabled
                ? recoveryCopy.workspace.openProjectToSendPrompts
                : 'Select an active session to send prompts.'}
          </p>
        </form>
      </div>
    </div>
  );
}

function WorkspaceAssistantFileActionSummary(props: {
  fileActionState: WorkspaceExecutionFileActionState;
  aiMessages: typeof enMessages.ai;
  commonMessages: typeof enMessages.common;
  selectedSessionId: string | null;
  isVisualEditExecution?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  onUndoVisualEdit?: () => void;
}) {
  const isVisualEditAwaitingConfirmation =
    Boolean(props.isVisualEditExecution) && props.fileActionState.applyStatus === 'awaiting-confirmation';
  const [diffState, setDiffState] = React.useState<'idle' | 'loading' | 'ready' | 'error'>(() =>
    isVisualEditAwaitingConfirmation ? 'loading' : 'idle',
  );
  const [fileDiffResults, setFileDiffResults] = React.useState<FileDiffResult[]>([]);

  React.useEffect(() => {
    if (!isVisualEditAwaitingConfirmation || !props.selectedSessionId) {
      setDiffState('idle');
      setFileDiffResults([]);
      return;
    }

    let cancelled = false;
    const sessionId = props.selectedSessionId;
    setDiffState('loading');
    setFileDiffResults([]);

    void (async () => {
      const settledResults = await Promise.allSettled(
        props.fileActionState.fileActions.map(async (action): Promise<FileDiffResult> => {
          if (action.action === 'create') {
            const createDiff = computeLineDiff('', action.content);
            return {
              path: action.path,
              action: action.action,
              lines: createDiff.lines,
              truncated: createDiff.truncated,
            };
          }

          if (action.action === 'delete') {
            let currentContent = '';
            try {
              const currentFile = await readWorkspaceFile({
                sessionId,
                filePath: action.path,
              });
              currentContent = currentFile.content;
            } catch {
              currentContent = '';
            }
            const deleteDiff = computeLineDiff(currentContent, '');
            return {
              path: action.path,
              action: action.action,
              lines: deleteDiff.lines,
              truncated: deleteDiff.truncated,
            };
          }

          const currentFile = await readWorkspaceFile({
            sessionId,
            filePath: action.path,
          });
          const updateDiff = computeLineDiff(currentFile.content, action.content);
          return {
            path: action.path,
            action: action.action,
            lines: updateDiff.lines,
            truncated: updateDiff.truncated,
          };
        }),
      );

      if (cancelled) {
        return;
      }

      const nextDiffResults: FileDiffResult[] = [];
      let hasRejectedResult = false;
      for (const settled of settledResults) {
        if (settled.status === 'fulfilled') {
          nextDiffResults.push(settled.value);
          continue;
        }
        hasRejectedResult = true;
      }

      setFileDiffResults(nextDiffResults);
      setDiffState(hasRejectedResult ? 'error' : 'ready');
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isVisualEditAwaitingConfirmation,
    props.fileActionState.fileActions,
    props.fileActionState.executionId,
    props.selectedSessionId,
  ]);

  const renderDiffLinePrefix = (type: 'added' | 'removed' | 'context'): string => {
    if (type === 'added') {
      return '+';
    }
    if (type === 'removed') {
      return '-';
    }
    return ' ';
  };

  const renderDiffLineClassName = (type: 'added' | 'removed' | 'context'): string => {
    if (type === 'added') {
      return 'text-emerald-700';
    }
    if (type === 'removed') {
      return 'text-red-700';
    }
    return 'text-gray-700';
  };

  const renderVisualEditDiffPreview = (result: FileDiffResult) => {
    if (result.action === 'delete') {
      return (
        <div
          key={`${result.path}-${result.action}`}
          className="mt-1 rounded border border-red-200 bg-red-50 p-2"
          data-testid="workspace-chat-file-actions-diff-delete"
        >
          <p className="font-mono text-red-800">delete {result.path}</p>
          <p className="mt-1 text-red-700">[file will be deleted]</p>
        </div>
      );
    }

    const testId =
      result.action === 'create'
        ? 'workspace-chat-file-actions-diff-create'
        : 'workspace-chat-file-actions-diff-update';
    const heading = `${result.action} ${result.path}`;

    return (
      <div key={`${result.path}-${result.action}`} className="mt-1 rounded border border-gray-200 bg-white p-2" data-testid={testId}>
        <p className="font-mono text-gray-800">{heading}</p>
        <pre className="mt-1 overflow-x-auto rounded border border-gray-200 bg-gray-50 p-2 text-[10px] leading-4 text-gray-800">
          {result.lines.map((line, index) => (
            <span
              key={`${line.type}-${line.lineNumber}-${index}`}
              className={`block font-mono ${renderDiffLineClassName(line.type)}`}
            >
              {renderDiffLinePrefix(line.type)} {line.lineNumber} {line.content}
            </span>
          ))}
        </pre>
        {result.truncated ? (
          <p className="mt-1 text-[10px] text-amber-700">
            Diff truncated to the first {DIFF_MAX_LINES} lines.
          </p>
        ) : null}
      </div>
    );
  };

  const hasRenderableResults =
    props.fileActionState.results.length > 0 ||
    ((props.fileActionState.applyStatus === 'skipped' ||
      props.fileActionState.applyStatus === 'awaiting-confirmation') &&
      props.fileActionState.fileActions.length > 0);
  if (!hasRenderableResults) {
    return null;
  }
  return (
    <div className="mt-2 rounded border border-gray-200 bg-white p-2" data-testid="workspace-chat-file-actions">
      <p className="text-[11px] font-semibold text-gray-700">{props.aiMessages.fileActionResults}</p>
      {props.isVisualEditExecution ? (
        <p
          className="mt-1 text-[11px] text-violet-700"
          data-testid="workspace-chat-file-actions-visual-edit-attribution"
        >
          {props.aiMessages.visualEditAttribution}
        </p>
      ) : null}
      {props.fileActionState.applyStatus === 'awaiting-confirmation' ? (
        <div
          className="mt-1 rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900"
          data-testid="workspace-chat-file-actions-awaiting-confirmation"
        >
          <p className="font-semibold">Approval required before applying risky file actions.</p>
          {isVisualEditAwaitingConfirmation ? (
            <>
              {diffState === 'loading' ? (
                <p className="mt-1 text-[11px] text-amber-800" data-testid="workspace-chat-file-actions-diff-loading">
                  {props.aiMessages.diffPreviewLoading}
                </p>
              ) : null}
              {diffState === 'error' ? (
                <p className="mt-1 text-[11px] text-red-700" data-testid="workspace-chat-file-actions-diff-error">
                  {props.aiMessages.diffPreviewUnavailable}
                </p>
              ) : null}
              {diffState === 'ready' ? (
                <div className="mt-1 space-y-1">{fileDiffResults.map((result) => renderVisualEditDiffPreview(result))}</div>
              ) : null}
            </>
          ) : null}
          <ul className="mt-1 space-y-1 font-mono" data-testid="workspace-chat-file-actions-awaiting-list">
            {props.fileActionState.fileActions.map((action, index) => (
              <li key={`${action.path}-${action.action}-${index}`}>{action.path}</li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="rounded border border-amber-300 bg-white px-2 py-1 text-[11px] text-amber-900"
              data-testid="workspace-chat-file-actions-confirm-button"
              onClick={props.onConfirm}
              disabled={!props.onConfirm}
            >
              {props.aiMessages.apply}
            </button>
            <button
              type="button"
              className="rounded border border-gray-300 bg-white px-2 py-1 text-[11px] text-gray-700"
              data-testid="workspace-chat-file-actions-cancel-button"
              onClick={props.onCancel}
              disabled={!props.onCancel}
            >
              {props.commonMessages.cancel}
            </button>
          </div>
        </div>
      ) : null}
      {props.fileActionState.applyStatus === 'skipped' ? (
        <p className="mt-1 text-[11px] text-amber-700" data-testid="workspace-chat-file-actions-skipped">
          File action application skipped ({props.fileActionState.skipReason ?? 'unknown reason'}).
        </p>
      ) : null}
      {props.fileActionState.results.length > 0 ? (
        <ul className="mt-1 space-y-1" data-testid="workspace-chat-file-actions-list">
          {props.fileActionState.results.map((result, index) => (
            <li
              key={`${result.path}-${result.action}-${index}`}
              className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[11px]"
            >
              <p className="font-mono text-gray-800">
                {result.action} {result.path}
              </p>
              <p
                className={
                  result.status === 'success'
                    ? 'text-emerald-700'
                    : result.status === 'failed'
                      ? 'text-red-700'
                      : 'text-amber-700'
                }
              >
                {result.status}
              </p>
              {result.error ? <p className="text-red-700">{result.error}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {props.isVisualEditExecution === true &&
      props.fileActionState.applyStatus === 'applied' &&
      props.onUndoVisualEdit ? (
        <div className="mt-2">
          <button
            type="button"
            className="rounded border border-violet-300 bg-white px-2 py-1 text-[11px] text-violet-800 transition-transform duration-150 ease-out active:scale-[0.98]"
            data-testid="workspace-chat-file-actions-undo-visual-edit"
            onClick={props.onUndoVisualEdit}
          >
            {props.aiMessages.undoRevert}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceBuildPanel(props: {
  projectFirstUxEnabled: boolean;
  selectedSessionId: string | null;
  selectedBuildTarget: string;
  onSelectedBuildTargetChange?: (value: string) => void;
  availableBuildTargets: Array<{
    value: string;
    label: string;
  }>;
  onRunBuildTarget?: () => Promise<void>;
  buildRequestState: 'idle' | 'submitting' | 'completed' | 'failed';
  buildStatusMessage: string | null;
  buildOutput: string;
  buildError: string | null;
  workspaceMessages: Pick<
    typeof enMessages.workspace,
    'buildTargets' | 'buildTargetLabel' | 'runBuild' | 'building'
  >;
}) {
  const isRunning = props.buildRequestState === 'submitting';
  const canRun =
    Boolean(props.selectedSessionId) &&
    Boolean(props.onRunBuildTarget) &&
    Boolean(props.onSelectedBuildTargetChange) &&
    props.availableBuildTargets.length > 0 &&
    !isRunning;

  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-2" data-testid="workspace-build-panel">
      <p className="text-[11px] font-semibold text-gray-700">{props.workspaceMessages.buildTargets}</p>
      <label htmlFor="workspace-build-target-selector" className="mt-1 block text-[11px] text-gray-700">
        {props.workspaceMessages.buildTargetLabel}
      </label>
      <select
        id="workspace-build-target-selector"
        data-testid="workspace-build-target-selector"
        value={props.selectedBuildTarget}
        onChange={(event) => props.onSelectedBuildTargetChange?.(event.target.value)}
        disabled={!canRun}
        className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs disabled:bg-gray-100 disabled:text-gray-500"
      >
        {props.availableBuildTargets.map((target) => (
          <option key={target.value} value={target.value}>
            {target.label}
          </option>
        ))}
      </select>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-gray-500">
          {props.selectedSessionId
            ? props.projectFirstUxEnabled
              ? recoveryCopy.workspace.buildReady
              : 'Build runs through the existing session exec path.'
            : props.projectFirstUxEnabled
              ? recoveryCopy.workspace.openProjectToRunBuild
              : 'Select an active session to run a build target.'}
        </p>
        <button
          type="button"
          data-testid="workspace-build-trigger"
          onClick={() => {
            if (!canRun || !props.onRunBuildTarget) {
              return;
            }
            void props.onRunBuildTarget();
          }}
          disabled={!canRun}
          className="rounded bg-violet-600 px-3 py-1 text-xs text-white disabled:bg-violet-300"
        >
          {isRunning ? props.workspaceMessages.building : props.workspaceMessages.runBuild}
        </button>
      </div>
      {props.buildStatusMessage ? (
        <p className="mt-2 text-[11px] text-blue-700" data-testid="workspace-build-status">
          {props.buildStatusMessage}
        </p>
      ) : null}
      {props.buildError ? (
        <p className="mt-2 text-[11px] text-red-700" data-testid="workspace-build-error">
          {props.buildError}
        </p>
      ) : null}
      {props.buildOutput.trim().length > 0 ? (
        <pre
          className="mt-2 max-h-32 overflow-auto rounded border border-gray-200 bg-white p-2 text-[11px]"
          data-testid="workspace-build-output"
        >
          {props.buildOutput}
        </pre>
      ) : null}
    </div>
  );
}

function WorkspaceExecPanel(props: {
  projectFirstUxEnabled: boolean;
  canReopenProject: boolean;
  onReopenProject?: () => void;
  selectedSessionId: string | null;
  commandInput: string;
  onCommandInputChange: (value: string) => void;
  onExecuteCommand: () => Promise<void>;
  execState: WorkspaceExecState;
  messages: Pick<
    typeof enMessages.workspace,
    'commandInputPlaceholder' | 'commandRun' | 'commandRunning'
  >;
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
          placeholder={props.messages.commandInputPlaceholder}
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs disabled:bg-gray-100 disabled:text-gray-500"
        />
        <button
          data-testid="workspace-exec-submit"
          type="submit"
          disabled={!canSubmit}
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white disabled:bg-blue-300"
        >
          {isSending ? props.messages.commandRunning : props.messages.commandRun}
        </button>
      </form>

      <div className="mt-2">
        <ExecStateMessage
          execState={props.execState}
          projectFirstUxEnabled={props.projectFirstUxEnabled}
          canReopenProject={props.canReopenProject}
          onReopenProject={props.onReopenProject}
        />
      </div>

      {props.execState.status === 'result' && props.execState.result ? (
        <ExecResultOutput result={props.execState.result} />
      ) : null}
    </div>
  );
}

function WorkspacePreviewPanel(props: {
  projectFirstUxEnabled: boolean;
  projectMessages: Pick<
    typeof enMessages.project,
    'selectElement' | 'pickerActive' | 'deselectElement' | 'elementSelected'
  >;
  previewMessages: Pick<typeof enMessages.preview, 'livePreview' | 'startPreview'>;
  commonMessages: Pick<typeof enMessages.common, 'refresh' | 'refreshing'>;
  selectedSessionId: string | null;
  previewState: WorkspacePreviewState;
  previewUrl: string | null;
  onStartPreview: () => Promise<void>;
  onRefreshPreview: () => Promise<void>;
  onPreviewLoad: () => void;
  onPreviewError: () => void;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
  pickerActive?: boolean;
  onPickerToggle?: () => void;
  selectedPreviewElement?: SelectedPreviewElement | null;
  fillHeight?: boolean;
}) {
  const canStartPreview =
    Boolean(props.selectedSessionId) && props.previewState === 'unavailable';
  const canRefresh = Boolean(props.selectedSessionId) && props.previewState !== 'loading';
  const canTogglePicker =
    Boolean(props.selectedSessionId) && Boolean(props.previewUrl) && props.previewState === 'ready';
  const pickerActive = props.pickerActive ?? false;
  const pickerToggleLabel = pickerActive
    ? props.projectMessages.deselectElement
    : props.projectMessages.selectElement;
  const panelClassName = props.fillHeight
    ? 'flex flex-col flex-1 min-h-0 overflow-hidden rounded border border-gray-200 bg-gray-50 p-2'
    : 'rounded border border-gray-200 bg-gray-50 p-2';
  const iframeClassName = props.fillHeight
    ? 'mt-2 w-full flex-1 min-h-0 rounded border border-gray-200 bg-white'
    : 'mt-2 h-56 w-full rounded border border-gray-200 bg-white';

  return (
    <div className={panelClassName} data-testid="workspace-preview-panel">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gray-700">{props.previewMessages.livePreview}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="workspace-preview-start"
            disabled={!canStartPreview}
            onClick={() => void props.onStartPreview()}
            className="rounded border border-blue-300 bg-white px-3 py-1 text-xs text-blue-700 disabled:border-gray-200 disabled:text-gray-400"
          >
            {props.previewMessages.startPreview}
          </button>
          <button
            type="button"
            data-testid="workspace-preview-refresh"
            disabled={!canRefresh}
            onClick={() => void props.onRefreshPreview()}
            className="rounded bg-blue-600 px-3 py-1 text-xs text-white disabled:bg-blue-300"
          >
            {props.previewState === 'loading'
              ? props.commonMessages.refreshing
              : props.commonMessages.refresh}
          </button>
          <button
            type="button"
            data-testid="workspace-preview-picker-toggle"
            aria-pressed={pickerActive}
            disabled={!canTogglePicker}
            onClick={() => props.onPickerToggle?.()}
            className="rounded border border-violet-300 bg-white px-3 py-1 text-xs text-violet-700 disabled:border-gray-200 disabled:text-gray-400"
          >
            {pickerToggleLabel}
          </button>
        </div>
      </div>

      <PreviewStateMessage
        state={props.previewState}
        projectFirstUxEnabled={props.projectFirstUxEnabled}
      />
      {pickerActive ? (
        <p
          className="mt-2 rounded border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] text-violet-800"
          data-testid="workspace-preview-picker-active"
        >
          {props.projectMessages.pickerActive}
        </p>
      ) : null}

      {!pickerActive && props.selectedPreviewElement ? (
        <p
          className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800 truncate"
          data-testid="workspace-preview-selected-element"
        >
          {props.projectMessages.elementSelected}: &lt;{props.selectedPreviewElement.tagName}&gt;{' '}
          <span className="font-mono text-[10px] text-emerald-600">{props.selectedPreviewElement.selector}</span>
        </p>
      ) : null}

      {props.previewUrl ? (
        <iframe
          ref={props.iframeRef}
          title="Session Preview"
          data-testid="workspace-preview-iframe"
          src={props.previewUrl}
          onLoad={props.onPreviewLoad}
          onError={props.onPreviewError}
          className={iframeClassName}
        />
      ) : null}
    </div>
  );
}

function WorkspaceEditorPanel(props: {
  projectFirstUxEnabled: boolean;
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
  fillHeight?: boolean;
}) {
  const canSave = props.saveState === 'dirty' || props.saveState === 'save-error';
  const panelClassName = props.fillHeight
    ? 'flex flex-col flex-1 min-h-0 overflow-hidden rounded border border-gray-200 bg-gray-50 p-2'
    : 'rounded border border-gray-200 bg-gray-50 p-2';
  const layoutClassName = props.fillHeight
    ? 'mt-2 flex flex-1 min-h-0 gap-2'
    : 'mt-2 grid gap-2 md:grid-cols-[14rem_1fr]';
  const treePaneClassName = props.fillHeight
    ? 'flex flex-col min-h-0 w-56 shrink-0 overflow-y-auto rounded border border-gray-200 bg-white p-2'
    : 'rounded border border-gray-200 bg-white p-2';
  const editorPaneClassName = props.fillHeight
    ? 'flex flex-col flex-1 min-h-0 overflow-hidden rounded border border-gray-200 bg-white p-2'
    : 'rounded border border-gray-200 bg-white p-2';
  const textareaClassName = props.fillHeight
    ? 'mt-2 flex-1 min-h-0 w-full resize-none overflow-auto rounded border border-gray-200 bg-gray-50 p-2 font-mono text-[11px] text-gray-800 disabled:bg-gray-100 disabled:text-gray-500'
    : 'mt-2 h-56 w-full resize-none overflow-auto rounded border border-gray-200 bg-gray-50 p-2 font-mono text-[11px] text-gray-800 disabled:bg-gray-100 disabled:text-gray-500';

  return (
    <div className={panelClassName} data-testid="workspace-editor-panel">
      <EditorStateMessage
        state={props.state}
        errorMessage={props.errorMessage}
        projectFirstUxEnabled={props.projectFirstUxEnabled}
      />
      {props.state === 'ready' ? (
        <div className={layoutClassName}>
          <div className={treePaneClassName}>
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
          <div className={editorPaneClassName}>
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
              className={textareaClassName}
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
  projectFirstUxEnabled: boolean;
}) {
  if (props.state === 'loading') {
    return (
      <StateMessage
        tone="neutral"
        heading="Editor loading"
        body={
          props.projectFirstUxEnabled
            ? recoveryCopy.workspace.filesLoading
            : 'Loading workspace files for the active session.'
        }
        action="Wait for file navigation to finish loading."
      />
    );
  }

  if (props.state === 'empty') {
    return (
      <StateMessage
        tone="neutral"
        heading="No file available"
        body={
          props.projectFirstUxEnabled
            ? recoveryCopy.workspace.noFilesAvailable
            : 'No files were found for the active session workspace.'
        }
        action={
          props.projectFirstUxEnabled
            ? recoveryCopy.workspace.openOrReopenProject
            : 'Run a command that creates files, then select the session again.'
        }
      />
    );
  }

  if (props.state === 'error') {
    return (
      <StateMessage
        tone="error"
        heading="Editor unavailable"
        body={props.errorMessage ?? 'Workspace file navigation failed to load.'}
        action={
          props.projectFirstUxEnabled
            ? recoveryCopy.workspace.openOrReopenProject
            : 'Select the session again to retry.'
        }
      />
    );
  }

  return (
    <StateMessage
      tone="success"
      heading="Editor ready"
      body={
        props.projectFirstUxEnabled
          ? recoveryCopy.workspace.filesReady
          : 'Workspace file navigation is ready for this active session.'
      }
      action="Choose a file from the list to view content."
    />
  );
}

function ExecStateMessage(props: {
  execState: WorkspaceExecState;
  projectFirstUxEnabled: boolean;
  canReopenProject: boolean;
  onReopenProject?: () => void;
}) {
  const { execState, projectFirstUxEnabled, canReopenProject, onReopenProject } = props;
  if (execState.status === 'idle') {
    return (
      <StateMessage
        tone="neutral"
        heading="Exec idle"
        body={
          projectFirstUxEnabled
            ? 'Run commands inside the current workspace.'
            : 'Submit a command for the selected active session.'
        }
        action="Enter a command and choose Run."
      />
    );
  }

  if (execState.status === 'sending') {
    return (
      <StateMessage
        tone="neutral"
        heading="Command running"
        body={
          projectFirstUxEnabled
            ? 'Sending command to the current workspace.'
            : 'Sending command to session exec endpoint.'
        }
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
        heading={
          projectFirstUxEnabled ? recoveryCopy.status.workspaceDisconnected : 'Session not found (404)'
        }
        body={
          projectFirstUxEnabled
            ? recoveryCopy.detail.workspaceExpired
            : 'The selected session is no longer available.'
        }
        action={
          projectFirstUxEnabled
            ? recoveryCopy.detail.reconnectByReopening
            : 'Select or create a session, then retry.'
        }
        primaryActionLabel={
          projectFirstUxEnabled && canReopenProject ? recoveryCopy.actions.reopenProject : undefined
        }
        onPrimaryAction={
          projectFirstUxEnabled && canReopenProject ? onReopenProject : undefined
        }
        primaryActionTestId={
          projectFirstUxEnabled && canReopenProject ? 'workspace-exec-reopen-project' : undefined
        }
      />
    );
  }

  if (execState.status === 'http-410') {
    return (
      <StateMessage
        tone="error"
        heading={
          projectFirstUxEnabled ? recoveryCopy.status.workspaceDisconnected : 'Session terminated (410)'
        }
        body={
          projectFirstUxEnabled
            ? recoveryCopy.detail.workspaceExpired
            : 'This session is terminated and cannot execute commands.'
        }
        action={
          projectFirstUxEnabled
            ? recoveryCopy.detail.reconnectByReopening
            : 'Create or select an active session to continue.'
        }
        primaryActionLabel={
          projectFirstUxEnabled && canReopenProject ? recoveryCopy.actions.reopenProject : undefined
        }
        onPrimaryAction={
          projectFirstUxEnabled && canReopenProject ? onReopenProject : undefined
        }
        primaryActionTestId={
          projectFirstUxEnabled && canReopenProject ? 'workspace-exec-reopen-project' : undefined
        }
      />
    );
  }

  if (execState.status === 'network-error') {
    return (
      <StateMessage
        tone="error"
        heading="Exec request failed"
        body={execState.errorMessage ?? 'Network or unexpected error prevented command execution.'}
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

function PreviewStateMessage({
  state,
  projectFirstUxEnabled,
}: {
  state: WorkspacePreviewState;
  projectFirstUxEnabled: boolean;
}) {
  if (state === 'loading') {
    return (
      <StateMessage
        tone="neutral"
        heading="Preview loading"
        body={
          projectFirstUxEnabled
            ? recoveryCopy.workspace.previewLoading
            : 'Checking and loading the active session preview.'
        }
        action="Wait for preview to finish loading."
      />
    );
  }

  if (state === 'ready') {
    return (
      <StateMessage
        tone="success"
        heading="Preview ready"
        body={
          projectFirstUxEnabled
            ? recoveryCopy.workspace.previewReady
            : 'The active session preview is rendering.'
        }
        action="Use Refresh to reload only this preview."
      />
    );
  }

  if (state === 'unavailable') {
    return (
      <StateMessage
        tone="neutral"
        heading="Preview unavailable"
        body={
          projectFirstUxEnabled
            ? recoveryCopy.workspace.previewUnavailable
            : 'No running preview is available for this active session yet.'
        }
        action="Choose Start Preview, then use Refresh if needed."
      />
    );
  }

  return (
    <StateMessage
      tone="error"
      heading="Preview error"
      body={
        projectFirstUxEnabled
          ? recoveryCopy.workspace.previewError
          : 'The preview failed to load for this active session.'
      }
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
  projectFirstUxEnabled: boolean;
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
          projectFirstUxEnabled={props.projectFirstUxEnabled}
        />
      </div>
    </div>
  );
}

function HistoryCreateStateMessage(props: {
  state: WorkspaceCheckpointCreateState;
  errorMessage: string | null;
  hasSelectedSession: boolean;
  projectFirstUxEnabled: boolean;
}) {
  if (props.state === 'idle') {
    return (
      <StateMessage
        tone="neutral"
        heading="Save point idle"
        body={
          props.hasSelectedSession
            ? props.projectFirstUxEnabled
              ? 'Create a manual save point for the current workspace.'
              : 'Create a manual checkpoint for the active session.'
            : props.projectFirstUxEnabled
              ? recoveryCopy.workspace.openProjectToCreateSavePoint
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
        body={
          props.projectFirstUxEnabled
            ? 'Save point request is in flight for the current workspace.'
            : 'Checkpoint creation request is in flight for the active session.'
        }
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
        action={
          props.projectFirstUxEnabled
            ? 'History list is refreshed for this workspace.'
            : 'History list is refreshed for this session.'
        }
      />
    );
  }

  return (
    <StateMessage
      tone="error"
      heading="Save point failed"
      body={props.errorMessage ?? 'Manual checkpoint creation failed.'}
      action={
        props.projectFirstUxEnabled
          ? 'Retry Save Point for the current workspace.'
          : 'Retry Save Point for the active session.'
      }
    />
  );
}

type HistoryCollapsibleSectionKey = 'controls' | 'summaries' | 'inspectors' | 'checkpoint-browser';
type HistorySectionOrderDirection = 'earlier' | 'later';
type HistorySectionVisibilityPresetKey = 'overview-oriented' | 'inspection-oriented';

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
const HISTORY_SECTION_VISIBILITY_PRESET_LABELS: Record<HistorySectionVisibilityPresetKey, string> = {
  'overview-oriented': 'Overview-Oriented',
  'inspection-oriented': 'Inspection-Oriented',
};

function getVisibleHistorySectionLabelsForPreset(presetKey: HistorySectionVisibilityPresetKey): string {
  const presetState = getHistorySectionVisibilityPresetState(presetKey);
  return DEFAULT_HISTORY_COLLAPSIBLE_SECTION_ORDER.filter((sectionKey) => !presetState[sectionKey])
    .map((sectionKey) => HISTORY_COLLAPSIBLE_SECTION_LABELS[sectionKey])
    .join(', ');
}

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

export function resetHistoryCollapsibleSectionOrderToDefault(): HistoryCollapsibleSectionKey[] {
  return [...DEFAULT_HISTORY_COLLAPSIBLE_SECTION_ORDER];
}

export function getHistorySectionVisibilityPresetState(
  presetKey: HistorySectionVisibilityPresetKey,
): Record<HistoryCollapsibleSectionKey, boolean> {
  if (presetKey === 'overview-oriented') {
    return {
      controls: false,
      summaries: false,
      inspectors: true,
      'checkpoint-browser': false,
    };
  }
  return {
    controls: true,
    summaries: true,
    inspectors: false,
    'checkpoint-browser': false,
  };
}

export function getDefaultHistorySectionVisibilityPresetState(): Record<HistoryCollapsibleSectionKey, boolean> {
  return {
    ...DEFAULT_HISTORY_COLLAPSIBLE_SECTION_STATE,
  };
}

function HistoryCheckpointList(props: {
  projectFirstUxEnabled: boolean;
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
  const hasVisibleBaseSelection = props.compareBaseCheckpointId
    ? visibleCheckpointIdSet.has(props.compareBaseCheckpointId)
    : false;
  const hasVisibleTargetSelection = props.compareTargetCheckpointId
    ? visibleCheckpointIdSet.has(props.compareTargetCheckpointId)
    : false;
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
  const canResetHistorySectionOrder = React.useMemo(
    () =>
      historyCollapsibleSectionOrder.length !== DEFAULT_HISTORY_COLLAPSIBLE_SECTION_ORDER.length ||
      historyCollapsibleSectionOrder.some(
        (sectionKey, sectionIndex) => sectionKey !== DEFAULT_HISTORY_COLLAPSIBLE_SECTION_ORDER[sectionIndex],
      ),
    [historyCollapsibleSectionOrder],
  );
  const isEveryHistorySectionCollapsed = collapsedSectionCount === collapsibleSectionKeys.length;
  const isEveryHistorySectionExpanded = collapsedSectionCount === 0;
  const isVisibilityPresetActive = React.useCallback(
    (presetKey: HistorySectionVisibilityPresetKey): boolean => {
      const presetState = getHistorySectionVisibilityPresetState(presetKey);
      return collapsibleSectionKeys.every((sectionKey) => collapsedHistorySections[sectionKey] === presetState[sectionKey]);
    },
    [collapsedHistorySections, collapsibleSectionKeys],
  );
  const isDefaultVisibilityPresetActive = React.useMemo(
    () =>
      collapsibleSectionKeys.every(
        (sectionKey) => collapsedHistorySections[sectionKey] === DEFAULT_HISTORY_COLLAPSIBLE_SECTION_STATE[sectionKey],
      ),
    [collapsedHistorySections, collapsibleSectionKeys],
  );
  const activeVisibilityPresetLabel = React.useMemo(() => {
    if (isDefaultVisibilityPresetActive) {
      return 'Default';
    }
    if (isVisibilityPresetActive('overview-oriented')) {
      return HISTORY_SECTION_VISIBILITY_PRESET_LABELS['overview-oriented'];
    }
    if (isVisibilityPresetActive('inspection-oriented')) {
      return HISTORY_SECTION_VISIBILITY_PRESET_LABELS['inspection-oriented'];
    }
    return 'Custom';
  }, [isDefaultVisibilityPresetActive, isVisibilityPresetActive]);
  const visibilityPresetMatchStatusSummary = React.useMemo(
    () =>
      activeVisibilityPresetLabel === 'Custom'
        ? 'Custom/Diverged from existing presets'
        : `Matches ${activeVisibilityPresetLabel} preset`,
    [activeVisibilityPresetLabel],
  );
  const visibilityComparisonBaselineLabel = React.useMemo(() => {
    const presetCandidates: ReadonlyArray<{
      label: string;
      state: Record<HistoryCollapsibleSectionKey, boolean>;
    }> = [
      { label: 'Default', state: DEFAULT_HISTORY_COLLAPSIBLE_SECTION_STATE },
      {
        label: HISTORY_SECTION_VISIBILITY_PRESET_LABELS['overview-oriented'],
        state: getHistorySectionVisibilityPresetState('overview-oriented'),
      },
      {
        label: HISTORY_SECTION_VISIBILITY_PRESET_LABELS['inspection-oriented'],
        state: getHistorySectionVisibilityPresetState('inspection-oriented'),
      },
    ];
    const defaultCandidate = presetCandidates[0];
    const defaultDifferenceCount = collapsibleSectionKeys.reduce(
      (count, sectionKey) => (collapsedHistorySections[sectionKey] === defaultCandidate.state[sectionKey] ? count : count + 1),
      0,
    );
    const nearestPreset = presetCandidates.slice(1).reduce<{
      label: string;
      state: Record<HistoryCollapsibleSectionKey, boolean>;
      differenceCount: number;
    }>(
      (bestCandidate, candidate) => {
        const differenceCount = collapsibleSectionKeys.reduce(
          (count, sectionKey) => (collapsedHistorySections[sectionKey] === candidate.state[sectionKey] ? count : count + 1),
          0,
        );
        if (!bestCandidate || differenceCount < bestCandidate.differenceCount) {
          return {
            ...candidate,
            differenceCount,
          };
        }
        return bestCandidate;
      },
      {
        ...defaultCandidate,
        differenceCount: defaultDifferenceCount,
      },
    );
    return nearestPreset.label;
  }, [collapsedHistorySections, collapsibleSectionKeys]);
  const visibilityPresetMatchExplanationSummary = React.useMemo(
    () =>
      activeVisibilityPresetLabel === 'Custom'
        ? `Current section visibility differs from the nearest ${visibilityComparisonBaselineLabel} preset state, so this is treated as custom/diverged.`
        : `Current section visibility exactly matches the ${activeVisibilityPresetLabel} preset state.`,
    [activeVisibilityPresetLabel, visibilityComparisonBaselineLabel],
  );
  const visibilityDeltaSummary = React.useMemo(() => {
    const presetCandidates: ReadonlyArray<{
      label: string;
      state: Record<HistoryCollapsibleSectionKey, boolean>;
    }> = [
      { label: 'Default', state: DEFAULT_HISTORY_COLLAPSIBLE_SECTION_STATE },
      {
        label: HISTORY_SECTION_VISIBILITY_PRESET_LABELS['overview-oriented'],
        state: getHistorySectionVisibilityPresetState('overview-oriented'),
      },
      {
        label: HISTORY_SECTION_VISIBILITY_PRESET_LABELS['inspection-oriented'],
        state: getHistorySectionVisibilityPresetState('inspection-oriented'),
      },
    ];
    const defaultCandidate = presetCandidates[0];
    const defaultDifferenceCount = collapsibleSectionKeys.reduce(
      (count, sectionKey) => (collapsedHistorySections[sectionKey] === defaultCandidate.state[sectionKey] ? count : count + 1),
      0,
    );
    const nearestPreset = presetCandidates.slice(1).reduce<{
      label: string;
      state: Record<HistoryCollapsibleSectionKey, boolean>;
      differenceCount: number;
    }>(
      (bestCandidate, candidate) => {
      const differenceCount = collapsibleSectionKeys.reduce(
        (count, sectionKey) => (collapsedHistorySections[sectionKey] === candidate.state[sectionKey] ? count : count + 1),
        0,
      );
      if (!bestCandidate || differenceCount < bestCandidate.differenceCount) {
        return {
          ...candidate,
          differenceCount,
        };
      }
      return bestCandidate;
      },
      {
        ...defaultCandidate,
        differenceCount: defaultDifferenceCount,
      },
    );
    if (nearestPreset.differenceCount === 0) {
      return `Matches ${nearestPreset.label} preset (no visibility deltas)`;
    }
    const hiddenComparedWithPreset = collapsibleSectionKeys
      .filter((sectionKey) => collapsedHistorySections[sectionKey] && !nearestPreset.state[sectionKey])
      .map((sectionKey) => HISTORY_COLLAPSIBLE_SECTION_LABELS[sectionKey]);
    const visibleComparedWithPreset = collapsibleSectionKeys
      .filter((sectionKey) => !collapsedHistorySections[sectionKey] && nearestPreset.state[sectionKey])
      .map((sectionKey) => HISTORY_COLLAPSIBLE_SECTION_LABELS[sectionKey]);
    return `Nearest ${nearestPreset.label} preset | Hidden vs preset: ${
      hiddenComparedWithPreset.length ? hiddenComparedWithPreset.join(', ') : 'None'
    } | Visible vs preset: ${visibleComparedWithPreset.length ? visibleComparedWithPreset.join(', ') : 'None'}`;
  }, [collapsedHistorySections, collapsibleSectionKeys]);
  const visibleHistorySectionCount = collapsibleSectionKeys.length - collapsedSectionCount;
  const collapsedHistorySectionLabelsSummary = React.useMemo(
    () =>
      historyCollapsibleSectionOrder
        .filter((sectionKey) => collapsedHistorySections[sectionKey])
        .map((sectionKey) => HISTORY_COLLAPSIBLE_SECTION_LABELS[sectionKey])
        .join(', '),
    [collapsedHistorySections, historyCollapsibleSectionOrder],
  );
  const hiddenHistorySectionSummary = React.useMemo(
    () =>
      collapsedHistorySectionLabelsSummary.length > 0
        ? collapsedHistorySectionLabelsSummary
        : 'None (all major history sections currently visible)',
    [collapsedHistorySectionLabelsSummary],
  );
  const visibleHistorySectionSummary = React.useMemo(
    () =>
      historyCollapsibleSectionOrder
        .filter((sectionKey) => !collapsedHistorySections[sectionKey])
        .map((sectionKey) => HISTORY_COLLAPSIBLE_SECTION_LABELS[sectionKey])
        .join(', ') || 'None (all major history sections currently hidden)',
    [collapsedHistorySections, historyCollapsibleSectionOrder],
  );
  const overviewVisibilityPresetVisibleSections = React.useMemo(
    () => getVisibleHistorySectionLabelsForPreset('overview-oriented'),
    [],
  );
  const inspectionVisibilityPresetVisibleSections = React.useMemo(
    () => getVisibleHistorySectionLabelsForPreset('inspection-oriented'),
    [],
  );
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
  const resetHistorySectionOrder = React.useCallback((): void => {
    setHistoryCollapsibleSectionOrder(resetHistoryCollapsibleSectionOrderToDefault());
  }, []);
  const applyHistorySectionVisibilityPreset = React.useCallback((presetKey: HistorySectionVisibilityPresetKey): void => {
    setCollapsedHistorySections(getHistorySectionVisibilityPresetState(presetKey));
  }, []);
  const resetHistorySectionVisibilityPresetToDefault = React.useCallback((): void => {
    setCollapsedHistorySections(getDefaultHistorySectionVisibilityPresetState());
  }, []);
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
        detail: hasActiveCheckpointContext ? getCheckpointSummaryLabel(inspectorCheckpoint!.id) : 'no active checkpoint context',
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
          projectFirstUxEnabled={props.projectFirstUxEnabled}
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
        <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="history-section-order-reset-controls">
          <button
            type="button"
            data-testid="history-section-order-reset-default"
            disabled={!canResetHistorySectionOrder}
            onClick={resetHistorySectionOrder}
            className="rounded border border-gray-300 bg-white px-2 py-0.5 text-[11px] text-gray-700 disabled:border-gray-200 disabled:text-gray-400"
          >
            Reset Order
          </button>
          <span className="text-[11px] text-gray-600" data-testid="history-section-order-reset-state">
            Default: Controls &gt; Summaries &gt; Inspectors &gt; Checkpoint Browser
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="history-section-visibility-preset-controls">
          <button
            type="button"
            data-testid="history-section-visibility-preset-reset-default"
            disabled={isDefaultVisibilityPresetActive}
            onClick={resetHistorySectionVisibilityPresetToDefault}
            className="rounded border border-gray-300 bg-white px-2 py-0.5 text-[11px] text-gray-700 disabled:border-gray-200 disabled:text-gray-400"
          >
            Reset Visibility Preset
          </button>
          <button
            type="button"
            data-testid="history-section-visibility-preset-overview-oriented"
            disabled={isVisibilityPresetActive('overview-oriented')}
            onClick={() => applyHistorySectionVisibilityPreset('overview-oriented')}
            className="rounded border border-gray-300 bg-white px-2 py-0.5 text-[11px] text-gray-700 disabled:border-gray-200 disabled:text-gray-400"
          >
            Overview Preset
          </button>
          <button
            type="button"
            data-testid="history-section-visibility-preset-inspection-oriented"
            disabled={isVisibilityPresetActive('inspection-oriented')}
            onClick={() => applyHistorySectionVisibilityPreset('inspection-oriented')}
            className="rounded border border-gray-300 bg-white px-2 py-0.5 text-[11px] text-gray-700 disabled:border-gray-200 disabled:text-gray-400"
          >
            Inspection Preset
          </button>
          <span className="text-[11px] text-gray-600" data-testid="history-section-visibility-preset-active-state">
            Active preset: {activeVisibilityPresetLabel}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-gray-600" data-testid="history-section-visibility-summary-group-label">
          Visibility summary group (read-only): Current visibility and preset interpretation summaries (status, match,
          explanation, baseline, delta, guide, hidden/visible, and consistency) for this active session.
        </p>
        <p className="mt-1 text-[11px] text-gray-600" data-testid="history-section-visibility-summary-order-label">
          Visibility summary order (read-only): Read in order - status, match, explanation, baseline, delta, guide,
          hidden/visible, then consistency.
        </p>
        <p className="mt-1 text-[11px] text-gray-600" data-testid="history-section-visibility-summary-scope-label">
          Visibility summary scope (read-only): Applies only to this active session's major history-section visibility
          and preset-interpretation summaries; no backend or cross-session state.
        </p>
        <p className="mt-1 text-[11px] text-gray-600" data-testid="history-section-visibility-summary-audience-label">
          Visibility summary audience (read-only): For the current active-session user reviewing this session's major
          history-section visibility and preset-interpretation summaries.
        </p>
        <p className="mt-1 text-[11px] text-gray-600" data-testid="history-section-visibility-summary-brevity-label">
          Visibility summary brevity (read-only): These labels are concise, at-a-glance summaries of this active
          session's existing history-section visibility and preset-interpretation state.
        </p>
        <p className="mt-1 text-[11px] text-gray-600" data-testid="history-section-visibility-summary-placement-label">
          Visibility summary placement (read-only): Presented in this controls area before the detailed visibility
          summaries so active-session visibility and preset interpretation state stays easy to scan.
        </p>
        <p className="mt-1 text-[11px] text-gray-600" data-testid="history-section-visibility-summary-context-label">
          Visibility summary context (read-only): These existing summaries provide quick context for how current
          in-session section visibility and preset interpretation should be read before using history controls.
        </p>
        <p className="mt-1 text-[11px] text-gray-600" data-testid="history-section-visibility-summary-intent-label">
          Visibility summary intent (read-only): Use these existing summaries as an at-a-glance intent guide for how
          current in-session section visibility and preset interpretation should inform history-control use.
        </p>
        <p className="mt-1 text-[11px] text-gray-600" data-testid="history-section-visibility-status-summary">
          Visibility status: Preset {activeVisibilityPresetLabel} | Visible {visibleHistorySectionCount}/
          {collapsibleSectionKeys.length} | Collapsed:{' '}
          {collapsedHistorySectionLabelsSummary.length > 0 ? collapsedHistorySectionLabelsSummary : 'None'}
        </p>
        <p className="mt-1 text-[11px] text-gray-600" data-testid="history-section-visibility-preset-match-status">
          Preset match status (read-only): {visibilityPresetMatchStatusSummary}
        </p>
        <p className="mt-1 text-[11px] text-gray-600" data-testid="history-section-visibility-preset-match-explanation">
          Preset match explanation (read-only): {visibilityPresetMatchExplanationSummary}
        </p>
        <p className="mt-1 text-[11px] text-gray-600" data-testid="history-section-visibility-comparison-baseline-label">
          Comparison baseline (read-only): {visibilityComparisonBaselineLabel} preset
        </p>
        <p className="mt-1 text-[11px] text-gray-600" data-testid="history-section-visibility-delta-summary">
          Visibility delta (read-only): {visibilityDeltaSummary}
        </p>
        <p className="mt-1 text-[11px] text-gray-600" data-testid="history-section-visibility-preset-description">
          Preset guide (read-only): Active {activeVisibilityPresetLabel} | Overview Preset focuses on broad history
          flow ({overviewVisibilityPresetVisibleSections} visible) | Inspection Preset focuses on detailed review (
          {inspectionVisibilityPresetVisibleSections} visible)
        </p>
        <p className="mt-1 text-[11px] text-gray-600" data-testid="history-section-hidden-sections-summary">
          Hidden sections (read-only): {hiddenHistorySectionSummary}
        </p>
        <p className="mt-1 text-[11px] text-gray-600" data-testid="history-section-visible-sections-summary">
          Visible sections (read-only): {visibleHistorySectionSummary}
        </p>
        <p className="mt-1 text-[11px] text-gray-600" data-testid="history-section-visibility-state-consistency-note">
          Visibility consistency note (read-only): Visibility status, hidden/visible summaries, preset interpretation,
          preset-match explanation, comparison baseline, and visibility delta all derive from the same active in-session
          section-visibility state.
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
            projectFirstUxEnabled={props.projectFirstUxEnabled}
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
                    className="rounded border border-red-300 bg-red-50 px-3 py-1 text-xs text-red-700 hover:bg-red-100 disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
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
          projectFirstUxEnabled={props.projectFirstUxEnabled}
        />
      </div>
      <div className="mt-2" data-testid="history-snapshot-state">
        <HistorySnapshotStateMessage
          state={props.snapshotState}
          errorMessage={props.snapshotErrorMessage}
          hasSelectedSession={props.hasSelectedSession}
          projectFirstUxEnabled={props.projectFirstUxEnabled}
        />
      </div>
      <div className="mt-2" data-testid="history-open-live-state">
        <HistoryOpenLiveStateMessage
          state={props.liveOpenState}
          errorMessage={props.liveOpenErrorMessage}
          targetPath={props.liveOpenTargetPath}
          hasSelectedSession={props.hasSelectedSession}
          projectFirstUxEnabled={props.projectFirstUxEnabled}
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
  projectFirstUxEnabled: boolean;
}) {
  if (props.state === 'idle') {
    return (
      <StateMessage
        tone="neutral"
        heading="Compare mode idle"
        body={
          props.hasSelectedSession
            ? 'Enter compare mode to select base and target checkpoints.'
            : props.projectFirstUxEnabled
              ? recoveryCopy.workspace.openProjectToCompareHistory
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
  projectFirstUxEnabled: boolean;
}) {
  if (props.state === 'idle') {
    return (
      <StateMessage
        tone="neutral"
        heading="Diff viewer idle"
        body={
          props.hasSelectedSession
            ? 'Select a checkpoint and choose View Diff.'
            : props.projectFirstUxEnabled
              ? recoveryCopy.workspace.openProjectToInspectDiffs
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
  projectFirstUxEnabled: boolean;
}) {
  if (props.state === 'idle') {
    return (
      <StateMessage
        tone="neutral"
        heading="Snapshot viewer idle"
        body={
          props.hasSelectedSession
            ? 'Select a checkpoint and choose View Snapshot.'
            : props.projectFirstUxEnabled
              ? recoveryCopy.workspace.openProjectToInspectSnapshots
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
  projectFirstUxEnabled: boolean;
}) {
  if (props.state === 'idle') {
    return (
      <StateMessage
        tone="neutral"
        heading="Open in live workspace idle"
        body={
          props.hasSelectedSession
            ? 'Choose a history file item and use Open in Live Workspace when available.'
            : props.projectFirstUxEnabled
              ? recoveryCopy.workspace.openProjectToOpenLiveFile
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
  projectFirstUxEnabled: boolean;
}) {
  if (props.state === 'idle') {
    return (
      <StateMessage
        tone="neutral"
        heading="Revert idle"
        body={
          props.hasSelectedSession
            ? 'Choose a checkpoint entry and use Revert.'
            : props.projectFirstUxEnabled
              ? recoveryCopy.workspace.openProjectToEnableRevert
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
  activeSessions: number;
}) {
  const remainingTokens24h = Math.max(
    0,
    props.quotaSummary.maxTokens24h - props.usageSummary.tokensUsed24h,
  );
  const quotaResetsAt = props.quotaSummary.resetAt || props.usageSummary.resetAt;
  const formattedQuotaResetTimestamp = formatQuotaResetTimestamp(quotaResetsAt);

  return (
    <div className="mt-2 space-y-2" data-testid="dashboard-summary-cards">
      <div className="rounded border border-gray-200 px-2 py-2">
        <p className="text-xs font-medium text-gray-900">Current User</p>
        <p className="text-xs text-gray-600 truncate">{props.userSummary.email}</p>
        <p className="mt-1 text-xs text-gray-500">
          Plan: {props.userSummary.planName} ({props.userSummary.planStatus})
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded border border-gray-200 px-2 py-2">
          <p className="text-xs text-gray-500">Active Sessions</p>
          <p className="text-sm font-semibold text-gray-900">
            {props.activeSessions}/{props.quotaSummary.maxActiveSessions}
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
      <div
        className="rounded border border-blue-200 bg-blue-50 px-2 py-2"
        data-testid="dashboard-quota-usage-indicator"
      >
        <p className="text-xs font-medium text-blue-900">Quota Status</p>
        <p className="text-xs text-blue-800">
          {remainingTokens24h} tokens remaining in the current 24h window.
        </p>
        <p className="text-[11px] text-blue-700">
          Usage window resets at:{' '}
          <span className="font-medium" data-testid="dashboard-quota-reset-at-formatted">
            {formattedQuotaResetTimestamp}
          </span>
        </p>
      </div>
    </div>
  );
}

function formatQuotaResetTimestamp(value: string | null | undefined): string {
  if (!value) {
    return 'Unavailable';
  }
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Unavailable';
  }
  return parsedDate.toLocaleString();
}

const PROJECT_SCOPED_SNAPSHOT_LABEL_PREFIX = '[project-id:';
const PROJECT_SCOPED_SNAPSHOT_NAME_SEPARATOR = ':name:';
const PROJECT_SCOPED_SNAPSHOT_SOURCE_SEPARATOR = ':source:';
const PROJECT_SCOPED_SNAPSHOT_HINT_SEPARATOR = ':hint:';
const PROJECT_SCOPED_SNAPSHOT_LABEL_SUFFIX = ']';

function parseProjectIdFromProjectScopedSnapshotLabel(label: string | null): string | null {
  if (!label) {
    return null;
  }
  const trimmed = label.trim();
  if (
    !trimmed.startsWith(PROJECT_SCOPED_SNAPSHOT_LABEL_PREFIX) ||
    !trimmed.endsWith(PROJECT_SCOPED_SNAPSHOT_LABEL_SUFFIX)
  ) {
    return null;
  }
  const rawProjectId = trimmed.slice(
    PROJECT_SCOPED_SNAPSHOT_LABEL_PREFIX.length,
    trimmed.length - PROJECT_SCOPED_SNAPSHOT_LABEL_SUFFIX.length,
  );
  const separatorIndexCandidates = [
    rawProjectId.indexOf(PROJECT_SCOPED_SNAPSHOT_NAME_SEPARATOR),
    rawProjectId.indexOf(PROJECT_SCOPED_SNAPSHOT_SOURCE_SEPARATOR),
    rawProjectId.indexOf(PROJECT_SCOPED_SNAPSHOT_HINT_SEPARATOR),
  ].filter((index) => index >= 0);
  const separatorIndex =
    separatorIndexCandidates.length > 0 ? Math.min(...separatorIndexCandidates) : -1;
  const normalizedProjectId =
    separatorIndex >= 0 ? rawProjectId.slice(0, separatorIndex).trim() : rawProjectId.trim();
  return normalizedProjectId ? normalizedProjectId : null;
}

function formatProjectHistoryFallbackLabel(
  label: string | null,
  recoveryCopy: typeof enMessages.recovery,
): string {
  const source = parseProjectScopedSnapshotSource(label);
  if (!source) {
    return 'Saved version';
  }

  const baseLabel = recoveryCopy.workspace.automaticVersionLabels[source];
  const hint = parseProjectScopedSnapshotHint(label);
  if (!hint) {
    return baseLabel;
  }

  return `${baseLabel} · ${hint}`;
}

function formatProjectHistoryTimestamp(value: string): string {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }
  return parsedDate.toLocaleString();
}

function computeProjectHistoryRows(
  snapshots: WorkspaceSnapshotSummary[],
  projectId: string,
  recoveryCopy: typeof enMessages.recovery,
): ProjectHistoryRow[] {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    return [];
  }

  return snapshots
    .filter(
      (snapshot) => {
        if (
          parseProjectIdFromProjectScopedSnapshotLabel(snapshot.label) ===
          normalizedProjectId
        ) {
          return true;
        }

        const trimmedLabel = snapshot.label?.trim();
        return (
          typeof trimmedLabel === 'string' &&
          trimmedLabel.startsWith(
            `${PROJECT_SCOPED_SNAPSHOT_LABEL_PREFIX}${normalizedProjectId}${PROJECT_SCOPED_SNAPSHOT_NAME_SEPARATOR}`,
          ) &&
          trimmedLabel.endsWith(PROJECT_SCOPED_SNAPSHOT_LABEL_SUFFIX)
        );
      },
    )
    .sort((left, right) => {
      const createdAtComparison = right.createdAt.localeCompare(left.createdAt);
      if (createdAtComparison !== 0) {
        return createdAtComparison;
      }
      return left.id.localeCompare(right.id);
    })
    .map((snapshot) => ({
      id: snapshot.id,
      label:
        parseProjectScopedSnapshotName(snapshot.label) ??
        formatProjectHistoryFallbackLabel(snapshot.label, recoveryCopy),
      createdAt: snapshot.createdAt,
    }));
}

function computeLatestProject(projects: WorkspaceProjectSummary[]): WorkspaceProjectSummary | null {
  if (projects.length === 0) {
    return null;
  }

  const [latestProject] = [...projects].sort((left, right) => {
    const updatedAtComparison = right.updatedAt.localeCompare(left.updatedAt);
    if (updatedAtComparison !== 0) {
      return updatedAtComparison;
    }
    return left.id.localeCompare(right.id);
  });

  return latestProject ?? null;
}

function computeRecentProjects(
  projects: WorkspaceProjectSummary[],
): WorkspaceSidebarRecentProject[] {
  if (projects.length === 0) {
    return [];
  }

  return [...projects]
    .sort((left, right) => {
      const updatedAtComparison = right.updatedAt.localeCompare(left.updatedAt);
      if (updatedAtComparison !== 0) {
        return updatedAtComparison;
      }
      return left.id.localeCompare(right.id);
    })
    .slice(0, 5)
    .map((project) => ({
      id: project.id,
      name: project.name,
      updatedAt: project.updatedAt,
    }));
}

function ShellStateMessage(props: {
  state: 'loading' | 'error' | 'empty' | 'ready';
  sessionError?: string | null;
  projectFirstUxEnabled: boolean;
  workspaceMessages: Pick<typeof enMessages.workspace, 'noSessionSelected'>;
  canReopenProject: boolean;
  onReopenProject?: () => void;
  onResumeLatestProject?: () => void;
}) {
  const {
    state,
    sessionError,
    projectFirstUxEnabled,
    workspaceMessages,
    canReopenProject,
    onReopenProject,
    onResumeLatestProject,
  } = props;
  if (state === 'loading') {
    return (
      <StateMessage
        tone="neutral"
        heading="Workspace is loading"
        body={
          projectFirstUxEnabled
            ? recoveryCopy.workspace.loading
            : 'Loading sessions and preparing baseline workspace panels.'
        }
        action="Please wait a moment."
      />
    );
  }

  if (state === 'error') {
    return (
      <StateMessage
        tone="error"
        heading="Workspace unavailable"
        body={
          sessionError
            ? projectFirstUxEnabled
              ? `Workspace load error: ${sessionError}`
              : `Session load error: ${sessionError}`
            : projectFirstUxEnabled
              ? recoveryCopy.workspace.unavailable
              : 'Unable to load sessions for the workspace shell.'
        }
        action={
          projectFirstUxEnabled
            ? recoveryCopy.workspace.openOrReopenProject
            : 'Refresh this page or sign in again.'
        }
        primaryActionLabel={
          projectFirstUxEnabled && canReopenProject ? recoveryCopy.actions.reopenProject : undefined
        }
        onPrimaryAction={
          projectFirstUxEnabled && canReopenProject ? onReopenProject : undefined
        }
        primaryActionTestId={
          projectFirstUxEnabled && canReopenProject ? 'workspace-shell-reopen-project' : undefined
        }
      />
    );
  }

  if (state === 'empty') {
    return (
      <StateMessage
        tone="neutral"
        heading={projectFirstUxEnabled ? 'No project open' : workspaceMessages.noSessionSelected}
        body={
          projectFirstUxEnabled
            ? recoveryCopy.workspace.openProjectToStart
            : 'Create or select a session to start using workspace panels.'
        }
        action={
          projectFirstUxEnabled
            ? recoveryCopy.workspace.help
            : 'Use New Session in the sidebar.'
        }
        primaryActionLabel={
          projectFirstUxEnabled && onResumeLatestProject
            ? recoveryCopy.actions.resumeLatestProject
            : undefined
        }
        onPrimaryAction={projectFirstUxEnabled ? onResumeLatestProject : undefined}
        primaryActionTestId={
          projectFirstUxEnabled && onResumeLatestProject
            ? 'workspace-shell-resume-latest-project'
            : undefined
        }
      />
    );
  }

  if (state === 'ready') return null;

  return (
    <StateMessage
      tone="success"
      heading="Workspace ready"
      body={
        projectFirstUxEnabled
          ? recoveryCopy.workspace.ready
          : 'Shell ready. Full panel behavior remains deferred to later slices.'
      }
      action={
        projectFirstUxEnabled
          ? 'Continue with project work and history review.'
          : 'Continue with session selection and checkpoint review.'
      }
    />
  );
}

function StateMessage(props: {
  tone: 'neutral' | 'error' | 'success';
  heading: string;
  body: string;
  action: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  primaryActionTestId?: string;
}) {
  const isSuccessTone = props.tone === 'success';
  const paletteByTone = {
    neutral: 'border-gray-200 bg-gray-50 text-gray-700',
    error: 'border-red-200 bg-red-50 text-red-700',
    success: 'border-green-100 bg-green-50 text-green-700',
  } as const;

  const palette = paletteByTone[props.tone];
  const containerClassName = isSuccessTone
    ? `rounded border px-2 py-1.5 text-xs ${palette}`
    : `rounded border px-3 py-2 text-sm ${palette}`;

  return (
    <div className={containerClassName}>
      {isSuccessTone ? (
        <div className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-green-500" />
          <p className="font-medium opacity-90">{props.heading}</p>
        </div>
      ) : (
        <>
          <p className="font-semibold">{props.heading}</p>
          <p className="mt-1">{props.body}</p>
        </>
      )}
      {props.primaryActionLabel && props.onPrimaryAction ? (
        <button
          type="button"
          onClick={props.onPrimaryAction}
          data-testid={props.primaryActionTestId}
          className={`${isSuccessTone ? 'mt-1.5' : 'mt-2'} rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white`}
        >
          {props.primaryActionLabel}
        </button>
      ) : null}
      {!isSuccessTone ? <p className="mt-1 text-xs opacity-90">Action: {props.action}</p> : null}
    </div>
  );
}
