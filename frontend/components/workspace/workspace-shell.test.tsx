import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WorkspaceShell, {
  getDefaultHistorySectionVisibilityPresetState,
  getHistorySectionVisibilityPresetState,
  moveHistoryCollapsibleSectionOrderItem,
  resetHistoryCollapsibleSectionOrderToDefault,
  runStopSessionWithConfirmation,
  WorkspaceAdvancedDrawer,
} from './workspace-shell';
import WorkspaceAccountMenu from './workspace-account-menu';
import type { WorkspaceCheckpoint, WorkspaceShellSession } from './workspace-shell.logic';
import type { WorkspaceExecState } from './workspace-exec.logic';
import type { WorkspacePreviewState } from './workspace-preview.logic';
import {
  buildPromptWithSelectedPreviewElement,
  generatePickerScriptSource,
  getPickerScriptId,
  getPickerOverlayId,
  getMaxTextContentLength,
  isVisualEditElementSelectedMessage,
  isValidVisualEditMessageOriginAndSource,
} from './workspace-preview.logic';
import type { SelectedPreviewElement } from './workspace-preview.logic';
import type { WorkspaceFileNode } from './workspace-file-navigation.logic';
import type { WorkspaceCheckpointDiffResponse } from './workspace-checkpoint-diff.logic';
import type { WorkspaceProjectSummary, WorkspacePublicProjectSummary } from './workspace-projects.logic';
import type { WorkspaceSnapshotSummary } from './workspace-snapshots.logic';
import type { Workspace } from './workspace-workspaces.logic';
import WorkspaceTabBar from './workspace-tab-bar';
import type { WorkspaceTabBarProps } from './workspace-tab-bar';
import { TAB_REGISTRY } from './workspace-tab-registry';

const session: WorkspaceShellSession = {
  id: '12345678-test-session',
  projectId: null,
  status: 'active',
  terminatedAt: null,
  terminationReason: null,
};
const terminatedSession: WorkspaceShellSession = {
  id: '87654321-term-session',
  projectId: null,
  status: 'stopped',
  terminatedAt: '2026-03-10T12:30:00.000Z',
  terminationReason: 'manual',
};
const resumeLatestProjects: WorkspaceProjectSummary[] = [
  {
    id: 'project-b',
    userId: 'user-123',
    name: 'Project B',
    visibility: 'private',
    workspaceId: null,
    createdAt: '2026-03-10T10:00:00.000Z',
    updatedAt: '2026-03-10T12:30:00.000Z',
  },
  {
    id: 'project-a',
    userId: 'user-123',
    name: 'Project A',
    visibility: 'private',
    workspaceId: null,
    createdAt: '2026-03-10T09:00:00.000Z',
    updatedAt: '2026-03-10T12:30:00.000Z',
  },
  {
    id: 'project-c',
    userId: 'user-123',
    name: 'Project C',
    visibility: 'private',
    workspaceId: null,
    createdAt: '2026-03-10T08:00:00.000Z',
    updatedAt: '2026-03-10T11:30:00.000Z',
  },
];
const projectsViewProjects: WorkspaceProjectSummary[] = [
  {
    id: 'projects-view-1',
    userId: 'user-123',
    name: 'Invoice Dashboard',
    visibility: 'private',
    workspaceId: 'workspace-1',
    createdAt: '2026-05-08T10:00:00.000Z',
    updatedAt: '2026-05-11T09:00:00.000Z',
  },
  {
    id: 'projects-view-2',
    userId: 'user-123',
    name: 'Support Portal',
    visibility: 'public',
    workspaceId: 'workspace-1',
    createdAt: '2026-05-09T10:00:00.000Z',
    updatedAt: '2026-05-11T08:00:00.000Z',
  },
];
const templatesViewProjects: WorkspacePublicProjectSummary[] = [
  {
    id: 'template-view-1',
    name: 'Starter CRM',
    visibility: 'public',
    createdAt: '2026-05-10T10:00:00.000Z',
    updatedAt: '2026-05-11T09:00:00.000Z',
  },
  {
    id: 'template-view-2',
    name: 'Marketplace Clone',
    visibility: 'public',
    createdAt: '2026-05-09T10:00:00.000Z',
    updatedAt: '2026-05-11T08:00:00.000Z',
  },
];
const projectHistorySnapshots: WorkspaceSnapshotSummary[] = [
  {
    id: 'snapshot-b',
    userId: 'user-123',
    label: '[project-id:project-1]',
    createdAt: '2026-04-03T10:00:00.000Z',
    fileCount: 2,
  },
  {
    id: 'snapshot-a',
    userId: 'user-123',
    label: '[project-id:project-1]',
    createdAt: '2026-04-03T10:00:00.000Z',
    fileCount: 3,
  },
  {
    id: 'snapshot-c',
    userId: 'user-123',
    label: '[project-id:project-1]',
    createdAt: '2026-04-02T09:00:00.000Z',
    fileCount: 1,
  },
  {
    id: 'snapshot-other',
    userId: 'user-123',
    label: '[project-id:project-2]',
    createdAt: '2026-04-04T08:00:00.000Z',
    fileCount: 4,
  },
];
const projectHistorySnapshotsWithNames: WorkspaceSnapshotSummary[] = [
  {
    id: 'snapshot-named',
    userId: 'user-123',
    label: '[project-id:project-1:name:Working draft]',
    createdAt: '2026-04-05T12:00:00.000Z',
    fileCount: 2,
  },
  {
    id: 'snapshot-unnamed',
    userId: 'user-123',
    label: '[project-id:project-1]',
    createdAt: '2026-04-04T12:00:00.000Z',
    fileCount: 3,
  },
  {
    id: 'snapshot-other-named',
    userId: 'user-123',
    label: '[project-id:project-2:name:Other project draft]',
    createdAt: '2026-04-06T12:00:00.000Z',
    fileCount: 1,
  },
];
const projectHistorySnapshotsWithSources: WorkspaceSnapshotSummary[] = [
  {
    id: 'snapshot-preview',
    userId: 'user-123',
    label: '[project-id:project-1:source:preview]',
    createdAt: '2026-04-06T12:00:00.000Z',
    fileCount: 2,
  },
  {
    id: 'snapshot-ai',
    userId: 'user-123',
    label: '[project-id:project-1:source:ai]',
    createdAt: '2026-04-05T12:00:00.000Z',
    fileCount: 3,
  },
  {
    id: 'snapshot-file-save',
    userId: 'user-123',
    label: '[project-id:project-1:source:file-save]',
    createdAt: '2026-04-04T12:00:00.000Z',
    fileCount: 4,
  },
  {
    id: 'snapshot-expiry',
    userId: 'user-123',
    label: '[project-id:project-1:source:expiry]',
    createdAt: '2026-04-03T12:00:00.000Z',
    fileCount: 5,
  },
  {
    id: 'snapshot-initial',
    userId: 'user-123',
    label: '[project-id:project-1:source:initial]',
    createdAt: '2026-04-02T12:00:00.000Z',
    fileCount: 6,
  },
  {
    id: 'snapshot-other-project-source',
    userId: 'user-123',
    label: '[project-id:project-2:source:ai]',
    createdAt: '2026-04-07T12:00:00.000Z',
    fileCount: 1,
  },
];
const projectHistorySnapshotsWithHints: WorkspaceSnapshotSummary[] = [
  {
    id: 'snapshot-ai-hint',
    userId: 'user-123',
    label: '[project-id:project-1:source:ai:hint:app.tsx +2]',
    createdAt: '2026-04-06T12:00:00.000Z',
    fileCount: 3,
  },
  {
    id: 'snapshot-file-save-hint',
    userId: 'user-123',
    label: '[project-id:project-1:source:file-save:hint:index.html]',
    createdAt: '2026-04-05T12:00:00.000Z',
    fileCount: 1,
  },
  {
    id: 'snapshot-other-project-hint',
    userId: 'user-123',
    label: '[project-id:project-2:source:preview:hint:other.tsx]',
    createdAt: '2026-04-07T12:00:00.000Z',
    fileCount: 2,
  },
];
const workspaceOptions: Workspace[] = [
  {
    id: 'workspace-1',
    userId: 'user-123',
    name: 'Personal',
    slug: 'personal',
    isDefault: true,
    createdAt: '2026-04-04T10:00:00.000Z',
    updatedAt: '2026-04-04T10:00:00.000Z',
  },
  {
    id: 'workspace-2',
    userId: 'user-123',
    name: 'Client Work',
    slug: 'client-work',
    isDefault: false,
    createdAt: '2026-04-05T10:00:00.000Z',
    updatedAt: '2026-04-05T10:00:00.000Z',
  },
];
const projectPanelRenderOverrides: Partial<React.ComponentProps<typeof WorkspaceShell>> = {
  workspaces: workspaceOptions,
  selectedWorkspaceId: 'workspace-1',
  workspaceActionState: 'idle',
  workspaceActionError: null,
  workspaceCreateNameInput: 'New Workspace',
  workspaceRenameNameInput: 'Personal',
  onSelectWorkspaceId: () => {},
  onWorkspaceCreateNameInputChange: () => {},
  onWorkspaceRenameNameInputChange: () => {},
  onCreateWorkspace: async () => {},
  onRenameWorkspace: async () => {},
  onDeleteWorkspace: async () => {},
  workspaceProjects: [
    {
      id: 'project-1',
      userId: 'user-123',
      name: 'My Workspace Project',
      workspaceId: 'workspace-1',
      createdAt: '2026-04-04T10:00:00.000Z',
      updatedAt: '2026-04-04T10:00:00.000Z',
    },
  ],
  selectedProjectId: 'project-1',
  projectMoveTargetWorkspaceId: null,
  projectNameInput: 'Draft Project',
  projectListState: 'ready',
  projectActionState: 'idle',
  selectedProjectVisibility: 'private',
  onProjectNameInputChange: () => {},
  onProjectMoveTargetWorkspaceIdChange: () => {},
  onSelectProjectId: () => {},
  onMoveWorkspaceProject: async () => {},
  onCreateWorkspaceProject: async () => {},
  onOpenWorkspaceProject: async () => {},
  onSelectedProjectVisibilityChange: () => {},
  onUpdateWorkspaceProjectVisibility: async () => {},
  publicProjectListState: 'ready',
  publicProjectActionState: 'idle',
  publicProjectActionMessage: null,
  publicProjectActionError: null,
  publicWorkspaceProjects: [
    {
      id: 'public-project-1',
      name: 'Shared Example',
      visibility: 'public',
      createdAt: '2026-04-04T10:00:00.000Z',
      updatedAt: '2026-04-04T10:00:00.000Z',
    },
  ],
  selectedPublicProjectId: 'public-project-1',
  selectedPublicProjectDetail: {
    id: 'public-project-1',
    name: 'Shared Example',
    visibility: 'public',
    createdAt: '2026-04-04T10:00:00.000Z',
    updatedAt: '2026-04-04T10:00:00.000Z',
    readOnly: true,
  },
  onSelectPublicProjectId: () => {},
  onViewPublicWorkspaceProject: async () => {},
  onForkPublicWorkspaceProject: async () => {},
  workspaceSnapshots: [],
  selectedSnapshotId: null,
  snapshotListState: 'ready',
  snapshotActionState: 'idle',
  onSelectSnapshotId: () => {},
  onSaveWorkspaceSnapshot: async () => {},
  onRestoreWorkspaceSnapshot: async () => {},
  onExportWorkspaceArchive: async () => {},
  onImportWorkspaceArchive: async () => {},
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
  planCode: 'free',
  planName: 'Free',
  planStatus: 'active' as const,
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

function buildWorkspaceShellProps(
  overrides: Partial<React.ComponentProps<typeof WorkspaceShell>> = {},
): React.ComponentProps<typeof WorkspaceShell> {
  const defaultProps: React.ComponentProps<typeof WorkspaceShell> = {
    locale: 'en',
    projectFirstUxEnabled: false,
    workspaceView: 'project',
    onWorkspaceViewChange: () => {},
    sessions: [session],
    selectedSessionId: session.id,
    isLoadingSessions: false,
    sessionError: null,
    sessionCreateError: null,
    sessionActionError: null,
    onSelectSession: () => {},
    onCreateSession: async () => {},
    onStopSession: async () => {},
    onRemoveSession: () => {},
    isCreatingSession: false,
    stoppingSessionId: null,
    userId: 'user-123',
    checkpoints: [checkpoint],
    isLoadingHistory: false,
    historyError: null,
    checkpointCreateState: 'idle',
    checkpointCreateError: null,
    checkpointDescriptionInput: '',
    onCheckpointDescriptionChange: () => {},
    onCreateManualCheckpoint: async () => {},
    workspaces: workspaceOptions,
    selectedWorkspaceId: 'workspace-1',
    workspaceActionState: 'idle',
    workspaceActionError: null,
    workspaceCreateNameInput: '',
    workspaceRenameNameInput: 'Personal',
    onSelectWorkspaceId: () => {},
    onWorkspaceCreateNameInputChange: () => {},
    onWorkspaceRenameNameInputChange: () => {},
    onCreateWorkspace: async () => {},
    onRenameWorkspace: async () => {},
    onDeleteWorkspace: async () => {},
    workspaceProjects: [],
    selectedProjectId: null,
    projectMoveTargetWorkspaceId: null,
    projectNameInput: '',
    projectListState: 'idle',
    projectActionState: 'idle',
    projectActionMessage: null,
    projectActionError: null,
    onProjectNameInputChange: () => {},
    onProjectMoveTargetWorkspaceIdChange: () => {},
    onSelectProjectId: () => {},
    onMoveWorkspaceProject: async () => {},
    onCreateWorkspaceProject: async () => {},
    onOpenWorkspaceProject: async () => {},
    selectedProjectVisibility: 'private',
    onSelectedProjectVisibilityChange: () => {},
    onUpdateWorkspaceProjectVisibility: async () => {},
    publicProjectListState: 'idle',
    publicProjectActionState: 'idle',
    publicProjectActionMessage: null,
    publicProjectActionError: null,
    publicWorkspaceProjects: [],
    selectedPublicProjectId: null,
    selectedPublicProjectDetail: null,
    onSelectPublicProjectId: () => {},
    onViewPublicWorkspaceProject: async () => {},
    onForkPublicWorkspaceProject: async () => {},
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
    selectedBuildTarget: 'mobile',
    onSelectedBuildTargetChange: () => {},
    availableBuildTargets: [
      { value: 'mobile', label: 'Mobile (generic)' },
      { value: 'mac', label: 'Mac (xcodebuild)' },
      { value: 'ios', label: 'iOS (xcodebuild)' },
    ],
    onRunBuildTarget: async () => {},
    buildRequestState: 'idle',
    buildStatusMessage: null,
    buildOutput: '',
    buildError: null,
    selectedModelOption: 'xai:grok-3',
    onSelectedModelOptionChange: () => {},
    orchestrationEnabled: false,
    onOrchestrationEnabledChange: () => {},
    onCreateProjectFromPrompt: async () => {},
    availableModelOptions: [
      { value: 'xai:grok-3', label: 'xAI - grok-3' },
      { value: 'openai:gpt-4o', label: 'OpenAI - gpt-4o' },
    ],
    execState: idleExecState,
    previewState: unavailablePreviewState,
    previewUrl: null,
    onStartPreview: async () => {},
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

  return { ...defaultProps, ...overrides };
}

function renderWorkspaceShell(
  overrides: Partial<React.ComponentProps<typeof WorkspaceShell>> = {},
): string {
  return renderToStaticMarkup(<WorkspaceShell {...buildWorkspaceShellProps(overrides)} />);
}

function buildWorkspaceAccountMenuProps(
  overrides: Partial<React.ComponentProps<typeof WorkspaceAccountMenu>> = {},
): React.ComponentProps<typeof WorkspaceAccountMenu> {
  return {
    userEmail: userSummary.email,
    isOpen: true,
    onClose: () => {},
    onLogout: () => {},
    currentLocale: 'en',
    onLanguageChange: () => {},
    settingsLabel: 'Settings',
    languageLabel: 'Language',
    themeLabel: 'Theme',
    helpLabel: 'Help',
    referralLabel: 'Referral',
    logoutLabel: 'Log out',
    lightLabel: 'Light',
    darkLabel: 'Dark',
    ...overrides,
  };
}

function renderWorkspaceAccountMenu(
  overrides: Partial<React.ComponentProps<typeof WorkspaceAccountMenu>> = {},
): string {
  return renderToStaticMarkup(
    <WorkspaceAccountMenu {...buildWorkspaceAccountMenuProps(overrides)} />,
  );
}

type TestableElementProps = {
  children?: React.ReactNode;
  onClick?: () => void;
  'data-testid'?: string;
} & Record<string, unknown>;

function withPatchedReactHooks<T>(run: () => T): T {
  const originalUseState = React.useState;
  const originalUseMemo = React.useMemo;
  const originalUseEffect = React.useEffect;
  const originalUseCallback = React.useCallback;
  const originalUseRef = React.useRef;

  (React as typeof React & {
    useState: typeof React.useState;
    useMemo: typeof React.useMemo;
    useEffect: typeof React.useEffect;
    useCallback: typeof React.useCallback;
    useRef: typeof React.useRef;
  }).useState = ((initialState: unknown) => {
    const value = typeof initialState === 'function' ? (initialState as () => unknown)() : initialState;
    return [value, () => {}];
  }) as unknown as typeof React.useState;
  (React as typeof React & { useMemo: typeof React.useMemo }).useMemo = ((factory: () => unknown) =>
    factory()) as unknown as typeof React.useMemo;
  (React as typeof React & { useEffect: typeof React.useEffect }).useEffect = (() =>
    undefined) as unknown as typeof React.useEffect;
  (React as typeof React & { useCallback: typeof React.useCallback }).useCallback = (<TCallback extends Function>(
    callback: TCallback,
  ) => callback) as unknown as typeof React.useCallback;
  (React as typeof React & { useRef: typeof React.useRef }).useRef = ((initialValue: unknown) => ({
    current: initialValue,
  })) as unknown as typeof React.useRef;

  try {
    return run();
  } finally {
    (React as typeof React & { useState: typeof React.useState }).useState = originalUseState;
    (React as typeof React & { useMemo: typeof React.useMemo }).useMemo = originalUseMemo;
    (React as typeof React & { useEffect: typeof React.useEffect }).useEffect = originalUseEffect;
    (React as typeof React & { useCallback: typeof React.useCallback }).useCallback = originalUseCallback;
    (React as typeof React & { useRef: typeof React.useRef }).useRef = originalUseRef;
  }
}

function findElementByTestId(
  node: React.ReactNode,
  testId: string,
): React.ReactElement<TestableElementProps> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findElementByTestId(child, testId);
      if (match) {
        return match;
      }
    }
    return null;
  }

  if (!React.isValidElement(node)) {
    return null;
  }

  const element = node as React.ReactElement<TestableElementProps, string | React.JSXElementConstructor<any>>;
  const props = element.props;

  if (typeof element.type === 'function') {
    return findElementByTestId((element.type as (props: TestableElementProps) => React.ReactNode)(props), testId);
  }

  if (props['data-testid'] === testId) {
    return element;
  }

  return findElementByTestId(props.children, testId);
}

function renderWorkspaceShellElementByTestId(
  testId: string,
  overrides: Partial<React.ComponentProps<typeof WorkspaceShell>> = {},
): React.ReactElement<TestableElementProps> | null {
  return withPatchedReactHooks(() =>
    findElementByTestId(WorkspaceShell(buildWorkspaceShellProps(overrides)), testId),
  );
}

function withPatchedWindowConfirm<T>(
  confirmImpl: (message?: string) => boolean,
  run: () => T,
): T {
  const globalObject = globalThis as typeof globalThis & { window?: unknown };
  const originalWindow = globalObject.window;
  (globalObject as { window?: unknown }).window = { confirm: confirmImpl };

  try {
    return run();
  } finally {
    if (originalWindow === undefined) {
      delete (globalObject as { window?: unknown }).window;
    } else {
      (globalObject as { window?: unknown }).window = originalWindow;
    }
  }
}

function withPatchedWindowPrompt<T>(
  promptImpl: (message?: string, defaultValue?: string) => string | null,
  run: () => T,
): T {
  const globalObject = globalThis as typeof globalThis & { window?: unknown };
  const originalWindow = globalObject.window;
  (globalObject as { window?: unknown }).window = { prompt: promptImpl };

  try {
    return run();
  } finally {
    if (originalWindow === undefined) {
      delete (globalObject as { window?: unknown }).window;
    } else {
      (globalObject as { window?: unknown }).window = originalWindow;
    }
  }
}

function buildWorkspaceTabBarProps(
  overrides: Partial<WorkspaceTabBarProps> = {},
): WorkspaceTabBarProps {
  const defaultTabs = TAB_REGISTRY.map((tab) => ({
    id: tab.id,
    label: tab.labelKey,
  }));
  return {
    tabs: defaultTabs,
    activeTabId: 'preview',
    orientation: 'horizontal' as const,
    onTabChange: () => {},
    onOrientationToggle: () => {},
    ...overrides,
  };
}

function renderWorkspaceTabBar(
  overrides: Partial<WorkspaceTabBarProps> = {},
): string {
  return renderToStaticMarkup(<WorkspaceTabBar {...buildWorkspaceTabBarProps(overrides)} />);
}

describe('workspace shell component', () => {
  test('renders authenticated workspace shell layout', () => {
    const html = renderWorkspaceShell();

    assert.match(html, /AI Sandbox Workspace/);
    assert.match(html, /Chat Panel/);
    assert.match(html, /Model Provider/);
    assert.match(html, /Enable bounded orchestration \(up to 3 sequential steps\)/);
    assert.match(html, /Command Input/);
    assert.match(html, /Build Targets/);
    assert.match(html, /Build Target/);
    assert.match(html, /Run Build/);
    assert.match(html, /Editor Panel/);
    assert.match(html, /Editor ready/);
    assert.match(html, /Editor clean/);
    assert.match(html, /src\/app\.ts/);
    assert.match(html, /console\.log\(&quot;hello&quot;\);/);
    assert.match(html, /Preview Panel/);
    assert.match(html, /Preview unavailable/);
    assert.match(html, /History &amp; Controls/);
    assert.match(html, /Dashboard/);
    assert.match(html, /Session 12345678/);
    assert.match(html, /Auto-commit: Message 10/);
    assert.match(html, /View Snapshot/);
    assert.match(html, /View Diff/);
    assert.match(html, /Current User/);
    assert.match(html, /user@example\.com/);
    assert.match(html, /workspace-header-api-keys-link/);
    assert.match(html, /href="keys"/);
    assert.match(html, />API Keys</);
    assert.match(html, /Plan: Free \(active\)/);
    assert.match(html, /Active Sessions/);
    assert.match(html, /Quota Status/);
    assert.match(html, /tokens remaining in the current 24h window/);
    assert.match(html, /Usage window resets at:/);
    assert.match(html, /dashboard-quota-reset-at-formatted/);
    assert.doesNotMatch(html, /2026-03-11T12:00:00.000Z/);
    assert.doesNotMatch(html, /workspace-header-logout-button/);
  });

  test('renders logout button in the session-scoped header when onLogout is provided', () => {
    const html = renderWorkspaceShell({
      onLogout: () => {},
    });

    assert.match(html, /workspace-header-logout-button/);
    assert.match(html, />Log out</);
  });

  test('renders project-first sidebar nav behind feature flag', () => {
    const html = renderWorkspaceShell({
      locale: 'zh-TW',
      projectFirstUxEnabled: true,
      workspaceView: 'home',
    });

    assert.match(html, /AI 沙盒/);
    assert.match(html, /workspace-sidebar/);
    assert.match(html, /workspace-sidebar-nav-home/);
    assert.match(html, /workspace-sidebar-nav-projects/);
    assert.match(html, /workspace-sidebar-nav-templates/);
    assert.match(html, /workspace-sidebar-workspace-select/);
    assert.match(html, />專案</);
    assert.match(html, />首頁</);
    assert.match(html, />模板與社群</);
    assert.doesNotMatch(html, /Session-scoped workspace/);
    assert.doesNotMatch(html, /workspace-header-api-keys-link/);
  });

  test('renders account avatar trigger in the project-first sidebar footer', () => {
    const html = renderWorkspaceShell({
      locale: 'en',
      projectFirstUxEnabled: true,
      onLogout: () => {},
    });

    assert.match(html, /workspace-sidebar-account-avatar/);
    assert.doesNotMatch(html, /workspace-account-menu/);
    assert.doesNotMatch(html, /workspace-header-logout-button/);
  });

  test('account menu is closed by default in the project-first sidebar', () => {
    const html = renderWorkspaceShell({
      locale: 'en',
      projectFirstUxEnabled: true,
      onLogout: () => {},
    });

    assert.doesNotMatch(html, /workspace-account-menu/);
  });

  test('renders upgrade CTA button in the project-first sidebar footer', () => {
    const html = renderWorkspaceShell({
      locale: 'en',
      projectFirstUxEnabled: true,
    });

    assert.match(html, /workspace-sidebar-upgrade-button/);
  });

  test('renders compact usage block in project-first sidebar when summary data is available', () => {
    const html = renderWorkspaceShell({
      locale: 'en',
      projectFirstUxEnabled: true,
      userSummary,
      usageSummary,
      quotaSummary,
    });

    assert.match(html, /workspace-sidebar-compact-usage/);
  });

  test('compact usage block is hidden in project-first sidebar when usage summary is unavailable', () => {
    const html = renderWorkspaceShell({
      locale: 'en',
      projectFirstUxEnabled: true,
      usageSummary: null,
    });

    assert.doesNotMatch(html, /workspace-sidebar-compact-usage/);
  });

  test('renders sidebar mobile toggle button in project-first shell', () => {
    const html = renderWorkspaceShell({
      locale: 'en',
      projectFirstUxEnabled: true,
    });

    assert.match(html, /workspace-sidebar-mobile-toggle/);
  });

  test('sidebar mobile toggle is absent when projectFirstUxEnabled is false', () => {
    const html = renderWorkspaceShell({
      locale: 'en',
      projectFirstUxEnabled: false,
    });

    assert.doesNotMatch(html, /workspace-sidebar-mobile-toggle/);
  });

  test('workspace-account-menu testid still resolves after sidebar markup change', () => {
    const html = renderWorkspaceShell({
      locale: 'en',
      projectFirstUxEnabled: true,
      userSummary,
    });

    assert.match(html, /workspace-sidebar-account-avatar/);
  });

  test('account menu renders user email when open', () => {
    const html = renderWorkspaceAccountMenu();

    assert.match(html, /workspace-account-menu/);
    assert.match(html, /user@example\.com/);
  });

  test('account menu renders language options', () => {
    const html = renderWorkspaceAccountMenu({
      currentLocale: 'zh-TW',
    });

    assert.match(html, /workspace-account-menu-language/);
    assert.match(html, />English</);
    assert.match(html, />繁體中文</);
    assert.match(html, />简体中文</);
  });

  test('account menu renders logout option', () => {
    const html = renderWorkspaceAccountMenu();

    assert.match(html, /workspace-account-menu-logout/);
    assert.match(html, /workspace-header-logout-button/);
    assert.match(html, />Log out</);
  });

  test('account menu renders settings placeholder', () => {
    const html = renderWorkspaceAccountMenu();

    assert.match(html, /workspace-account-menu-settings/);
    assert.match(html, />Settings</);
  });

  test('account menu renders theme placeholder', () => {
    const html = renderWorkspaceAccountMenu();

    assert.match(html, /workspace-account-menu-theme/);
    assert.match(html, />Light</);
    assert.match(html, />Dark</);
  });

  test('renders home chatbox when project-first home view is selected', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'home',
    });

    assert.match(html, /workspace-home-view/);
    assert.match(html, />Build anything</);
    assert.match(html, /workspace-home-input/);
    assert.match(html, /workspace-home-submit/);
    assert.doesNotMatch(html, /Chat Panel/);
  });

  test('wires home prompt input and submit in project-first home view', () => {
    let changedPrompt = '';
    const input = renderWorkspaceShellElementByTestId('workspace-home-input', {
      projectFirstUxEnabled: true,
      workspaceView: 'home',
      chatPromptInput: '',
      onChatPromptInputChange: (value) => {
        changedPrompt = value;
      },
    });

    assert.ok(input);
    const onChange = input.props.onChange as
      | ((event: { target: { value: string } }) => void)
      | undefined;
    onChange?.({ target: { value: 'Build a kanban board' } });
    assert.equal(changedPrompt, 'Build a kanban board');

    let submittedPrompt = '';
    const button = renderWorkspaceShellElementByTestId('workspace-home-submit', {
      projectFirstUxEnabled: true,
      workspaceView: 'home',
      chatPromptInput: changedPrompt,
      onCreateProjectFromPrompt: async (prompt) => {
        submittedPrompt = prompt;
      },
    });

    assert.ok(button);
    assert.equal(button.props.disabled, false);
    const onClick = button.props.onClick as (() => void) | undefined;
    onClick?.();
    assert.equal(submittedPrompt, 'Build a kanban board');
  });

  test('does not submit an empty home prompt', () => {
    let submittedPrompt = '';
    const button = renderWorkspaceShellElementByTestId('workspace-home-submit', {
      projectFirstUxEnabled: true,
      workspaceView: 'home',
      chatPromptInput: '   ',
      onCreateProjectFromPrompt: async (prompt) => {
        submittedPrompt = prompt;
      },
    });

    assert.ok(button);
    assert.equal(button.props.disabled, true);
    const onClick = button.props.onClick as (() => void) | undefined;
    onClick?.();
    assert.equal(submittedPrompt, '');
  });

  test('renders existing workspace content when project view is selected', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'project',
    });

    assert.match(html, /workspace-project-view/);
    assert.match(html, /Chat Panel/);
    assert.match(html, /workspace-preview-panel/);
    assert.match(html, /workspace-ai-panel-toggle/);
    assert.match(html, /workspace-ai-panel-view-chat/);
    assert.match(html, /workspace-ai-panel-view-history/);
    assert.match(html, /workspace-tab-bar/);
  });

  test('renders project mode header in project view', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'project',
      workspaceProjects: projectsViewProjects,
      selectedProjectId: 'projects-view-1',
    });

    assert.match(html, /workspace-project-mode-header/);
    assert.match(html, /Invoice Dashboard/);
  });

  test('renders back button in project mode header', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'project',
    });

    assert.match(html, /workspace-project-back-button/);
    assert.match(html, /Back/);
  });

  test('clicking back button calls onWorkspaceViewChange with projects', () => {
    let changedView: string | null = null;
    const backButton = renderWorkspaceShellElementByTestId(
      'workspace-project-back-button',
      {
        projectFirstUxEnabled: true,
        workspaceView: 'project',
        onWorkspaceViewChange: (view) => {
          changedView = view;
        },
      },
    );

    assert.ok(backButton, 'back button element should exist');
    backButton.props.onClick?.();
    assert.equal(changedView, 'projects');
  });

  test('renders AI panel zone in project view', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'project',
    });

    assert.match(html, /workspace-project-ai-panel/);
  });

  test('renders chat and history toggle buttons in project mode', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'project',
    });

    assert.match(html, /workspace-ai-panel-toggle/);
    assert.match(html, /workspace-ai-panel-view-chat/);
    assert.match(html, /workspace-ai-panel-view-history/);
    assert.match(html, />Chat</);
    assert.match(html, />History</);
  });

  test('renders chat panel by default in project mode', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'project',
    });

    assert.match(html, /chat-panel-shell/);
    assert.match(html, /workspace-ai-panel-view-chat/);
  });

  test('does not render restore confirm bar without pending restore', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'project',
      selectedProjectId: 'project-1',
      workspaceSnapshots: projectHistorySnapshots,
    });

    assert.doesNotMatch(html, /workspace-restore-confirm-bar/);
  });

  test('project history panel still renders in non-project views', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'projects',
      selectedProjectId: 'project-1',
      workspaceSnapshots: projectHistorySnapshots,
    });

    assert.match(html, /history-project-history-surface/);
    assert.match(html, /History &amp; Controls/);
  });

  test('restore-related buttons and handlers remain wired where statically testable', () => {
    let restoreProjectId = '';
    let restoreSnapshotId = '';
    const restoreButton = renderWorkspaceShellElementByTestId(
      'history-project-history-restore-snapshot-a',
      {
        projectFirstUxEnabled: true,
        workspaceView: 'projects',
        selectedProjectId: 'project-1',
        workspaceSnapshots: projectHistorySnapshots,
        onRestoreWorkspaceProjectFromSnapshotById: async (projectId, snapshotId) => {
          restoreProjectId = projectId;
          restoreSnapshotId = snapshotId;
        },
      },
    );

    assert.ok(restoreButton);
    assert.equal(typeof restoreButton.props.onClick, 'function');
    const onClick = restoreButton.props.onClick as (() => void) | undefined;
    onClick?.();
    assert.equal(restoreProjectId, 'project-1');
    assert.equal(restoreSnapshotId, 'snapshot-a');
  });

  test('renders content panel zone in project view', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'project',
    });

    assert.match(html, /workspace-project-content-panel/);
  });

  test('renders tab bar in project mode right content zone', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'project',
    });

    assert.match(html, /workspace-tab-bar/);
  });

  test('renders Preview tab in tab bar', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'project',
    });

    assert.match(html, /workspace-tab-preview/);
    assert.match(html, />Preview</);
  });

  test('renders Code & Files tab in tab bar', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'project',
    });

    assert.match(html, /workspace-tab-codeFiles/);
    assert.match(html, />Code &amp; Files</);
  });

  test('renders placeholder tabs with Coming soon text', () => {
    const tabBarHtml = renderWorkspaceTabBar();
    assert.match(tabBarHtml, /workspace-tab-database/);
    assert.match(tabBarHtml, /workspace-tab-auth/);
    assert.match(tabBarHtml, /workspace-tab-security/);
    assert.match(tabBarHtml, /workspace-tab-analytics/);
    assert.match(tabBarHtml, /workspace-tab-envVars/);
    assert.match(tabBarHtml, /workspace-tab-publishing/);
    assert.match(tabBarHtml, /workspace-tab-deploy/);
    assert.match(tabBarHtml, /workspace-tab-payment/);
    assert.match(tabBarHtml, /workspace-tab-domain/);
    assert.match(tabBarHtml, /workspace-tab-appStorage/);
    assert.match(tabBarHtml, /workspace-tab-agentSkills/);

    const shellHtml = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'project',
    });
    assert.match(shellHtml, /workspace-tab-database/);
    assert.match(shellHtml, /workspace-tab-auth/);
    assert.match(shellHtml, /workspace-tab-publishing/);
    assert.match(shellHtml, /workspace-tab-deploy/);
    assert.match(shellHtml, /workspace-tab-payment/);
    assert.match(shellHtml, /workspace-tab-domain/);
    assert.match(shellHtml, /workspace-tab-appStorage/);
    assert.match(shellHtml, /workspace-tab-agentSkills/);
  });

  test('active tab is Preview by default', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'project',
    });

    assert.match(html, /aria-selected="true"[^>]*>Preview</);
  });

  test('active tab content shows preview panel when Preview tab is active', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'project',
    });

    assert.match(html, /workspace-tab-content/);
    assert.match(html, /preview-panel-shell/);
    assert.match(html, /workspace-preview-panel/);
    assert.doesNotMatch(html, />Preview Panel</);
  });

  test('tab content wrapper renders with full-height overflow-hidden layout', () => {
    const tabContent = renderWorkspaceShellElementByTestId('workspace-tab-content', {
      projectFirstUxEnabled: true,
      workspaceView: 'project',
    });
    assert.ok(tabContent);

    const className = String(tabContent.props.className ?? '');
    assert.match(className, /overflow-hidden/);
    assert.doesNotMatch(className, /overflow-y-auto/);
  });

  test('preview panel shell renders full-height tab content and contains workspace preview panel', () => {
    const panelShell = renderWorkspaceShellElementByTestId('preview-panel-shell', {
      projectFirstUxEnabled: true,
      workspaceView: 'project',
    });
    const previewPanel = renderWorkspaceShellElementByTestId('workspace-preview-panel', {
      projectFirstUxEnabled: true,
      workspaceView: 'project',
    });
    assert.ok(panelShell);
    assert.ok(previewPanel);

    const className = String(panelShell.props.className ?? '');
    assert.match(className, /flex/);
    assert.match(className, /flex-col/);
    assert.match(className, /flex-1/);
    assert.match(className, /min-h-0/);
    assert.match(className, /overflow-hidden/);
  });

  test('editor panel shell can render in Code & Files tab path where statically testable', () => {
    const codeTabButton = renderWorkspaceShellElementByTestId('workspace-tab-codeFiles', {
      projectFirstUxEnabled: true,
      workspaceView: 'project',
    });
    assert.ok(codeTabButton);
    assert.equal(typeof codeTabButton.props.onClick, 'function');
  });

  test('default preview tab does not render workspace tab placeholder', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'project',
    });

    assert.doesNotMatch(html, /workspace-tab-placeholder/);
  });

  test('legacy non-project-first path still renders preview-panel-shell and editor-panel-shell', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: false,
      workspaceView: 'project',
    });

    assert.match(html, /preview-panel-shell/);
    assert.match(html, /editor-panel-shell/);
  });

  test('tab orientation toggle renders', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'project',
    });

    assert.match(html, /workspace-tab-orientation-toggle/);
  });

  test('AI panel collapse toggle renders', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'project',
    });

    assert.match(html, /workspace-ai-panel-collapse-toggle/);
    assert.match(html, /Collapse AI panel/);
  });

  test('renders recent projects in project-first sidebar when workspaceProjects are provided', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'home',
      workspaceProjects: [
        {
          id: 'proj-recent-1',
          userId: 'user-123',
          name: 'My Kanban App',
          visibility: 'private',
          workspaceId: 'workspace-1',
          createdAt: '2026-05-10T10:00:00.000Z',
          updatedAt: '2026-05-11T09:00:00.000Z',
        },
        {
          id: 'proj-recent-2',
          userId: 'user-123',
          name: 'Landing Page',
          visibility: 'private',
          workspaceId: 'workspace-1',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-11T08:00:00.000Z',
        },
      ],
    });

    assert.match(html, /workspace-sidebar-recent-project-proj-recent-1/);
    assert.match(html, /workspace-sidebar-recent-project-proj-recent-2/);
    assert.match(html, /My Kanban App/);
    assert.match(html, /Landing Page/);
  });

  test('renders project cards in projects view when workspaceProjects exist', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'projects',
      workspaceProjects: projectsViewProjects,
    });

    assert.match(html, /workspace-projects-grid/);
    assert.match(html, /workspace-project-card-projects-view-1/);
    assert.match(html, /workspace-project-card-projects-view-2/);
  });

  test('renders project names in project cards', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'projects',
      workspaceProjects: projectsViewProjects,
    });

    assert.match(html, /Invoice Dashboard/);
    assert.match(html, /Support Portal/);
  });

  test('renders empty state in projects view when no projects exist', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'projects',
      workspaceProjects: [],
    });

    assert.match(html, /workspace-projects-empty-state/);
    assert.match(html, />No projects yet\.</);
  });

  test('clicking project card calls onResumeWorkspaceProjectById with project id', () => {
    let resumeCalls = 0;
    let resumedProjectId: string | null = null;
    const projectCard = renderWorkspaceShellElementByTestId(
      'workspace-project-card-projects-view-2',
      {
        projectFirstUxEnabled: true,
        workspaceView: 'projects',
        workspaceProjects: projectsViewProjects,
        onResumeWorkspaceProjectById: async (projectId: string) => {
          resumeCalls += 1;
          resumedProjectId = projectId;
        },
      },
    );

    assert.ok(projectCard);
    projectCard.props.onClick?.();
    assert.equal(resumeCalls, 1);
    assert.equal(resumedProjectId, 'projects-view-2');
  });

  test('renders grid and list toggle buttons in projects view', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'projects',
      workspaceProjects: projectsViewProjects,
    });

    assert.match(html, /workspace-projects-grid-toggle/);
    assert.match(html, /workspace-projects-list-toggle/);
    assert.match(html, />Grid view</);
    assert.match(html, />List view</);
  });

  test('clicking sidebar recent project calls onResumeWorkspaceProjectById with project id', () => {
    let resumeCalls = 0;
    let resumedProjectId: string | null = null;
    const recentProjectButton = renderWorkspaceShellElementByTestId(
      'workspace-sidebar-recent-project-projects-view-1',
      {
        projectFirstUxEnabled: true,
        workspaceView: 'home',
        workspaceProjects: projectsViewProjects,
        onResumeWorkspaceProjectById: async (projectId: string) => {
          resumeCalls += 1;
          resumedProjectId = projectId;
        },
      },
    );

    assert.ok(recentProjectButton);
    recentProjectButton.props.onClick?.();
    assert.equal(resumeCalls, 1);
    assert.equal(resumedProjectId, 'projects-view-1');
  });

  test('renders template cards in templates view when public projects exist', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'templates',
      publicWorkspaceProjects: templatesViewProjects,
    });

    assert.match(html, /workspace-templates-view/);
    assert.match(html, /workspace-templates-grid/);
    assert.match(html, /workspace-template-card-template-view-1/);
    assert.match(html, /workspace-template-card-template-view-2/);
  });

  test('renders template project names in template cards', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'templates',
      publicWorkspaceProjects: templatesViewProjects,
    });

    assert.match(html, /Starter CRM/);
    assert.match(html, /Marketplace Clone/);
  });

  test('renders empty state in templates view when no public projects exist', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'templates',
      publicWorkspaceProjects: [],
    });

    assert.match(html, /workspace-templates-empty-state/);
    assert.match(html, />No templates available\.</);
  });

  test('renders search input in templates view', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      workspaceView: 'templates',
      publicWorkspaceProjects: templatesViewProjects,
    });

    assert.match(html, /workspace-templates-search/);
    assert.match(html, /placeholder="Search"/);
  });

  test('clicking fork on a template card calls onForkPublicWorkspaceProjectById with project id', () => {
    let forkCalls = 0;
    let forkedProjectId: string | null = null;
    const forkButton = renderWorkspaceShellElementByTestId(
      'workspace-template-card-fork-template-view-2',
      {
        projectFirstUxEnabled: true,
        workspaceView: 'templates',
        publicWorkspaceProjects: templatesViewProjects,
        onForkPublicWorkspaceProjectById: async (projectId: string) => {
          forkCalls += 1;
          forkedProjectId = projectId;
        },
      },
    );

    assert.ok(forkButton);
    forkButton.props.onClick?.();
    assert.equal(forkCalls, 1);
    assert.equal(forkedProjectId, 'template-view-2');
  });

  test('clicking logout in account menu calls onLogout', () => {
    let callCount = 0;
    const logoutButton = findElementByTestId(
      <WorkspaceAccountMenu
        {...buildWorkspaceAccountMenuProps({
          onLogout: () => {
            callCount += 1;
          },
        })}
      />,
      'workspace-header-logout-button',
    );

    assert.ok(logoutButton);
    logoutButton.props.onClick?.();
    assert.equal(callCount, 1);
  });

  test('clicking language option calls onLanguageChange with locale code', () => {
    let changedLocale = '';
    const languageButton = findElementByTestId(
      <WorkspaceAccountMenu
        {...buildWorkspaceAccountMenuProps({
          onLanguageChange: (locale) => {
            changedLocale = locale;
          },
        })}
      />,
      'workspace-account-menu-language-zh-TW',
    );

    assert.ok(languageButton);
    languageButton.props.onClick?.();
    assert.equal(changedLocale, 'zh-TW');
  });

  test('search filter hides non-matching template cards if testable', () => {
    const originalUseState = React.useState;
    let useStateCalls = 0;

    (React as typeof React & { useState: typeof React.useState }).useState = ((initialState: unknown) => {
      useStateCalls += 1;
      if (useStateCalls === 3) {
        return ['market', () => {}];
      }
      const value = typeof initialState === 'function' ? (initialState as () => unknown)() : initialState;
      return [value, () => {}];
    }) as unknown as typeof React.useState;

    try {
      const html = renderToStaticMarkup(
        <WorkspaceShell
          {...buildWorkspaceShellProps({
            projectFirstUxEnabled: true,
            workspaceView: 'templates',
            publicWorkspaceProjects: templatesViewProjects,
          })}
        />,
      );

      assert.match(html, /workspace-template-card-template-view-2/);
      assert.doesNotMatch(html, /workspace-template-card-template-view-1/);
    } finally {
      (React as typeof React & { useState: typeof React.useState }).useState = originalUseState;
    }
  });

  test('clicking logout calls onLogout when provided', () => {
    let callCount = 0;
    const logoutButton = renderWorkspaceShellElementByTestId('workspace-header-logout-button', {
      onLogout: () => {
        callCount += 1;
      },
    });

    assert.ok(logoutButton);
    logoutButton.props.onClick?.();
    assert.equal(callCount, 1);
  });

  test('renders project-first recovery wording in main helper surfaces', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      selectedSessionId: null,
      previewState: 'unavailable',
    });

    assert.match(
      html,
      /Your project stays recoverable\. If the workspace disconnects, reopen the project to continue\./,
    );
    assert.match(html, /Open a project to send prompts\./);
    assert.match(html, /Open a project to run a build target\./);
    assert.match(html, /No project open/);
    assert.match(html, /Open a project to start using workspace tools\./);
    assert.match(html, /Use Start a new project or Open existing project in the history panel\./);
    assert.match(html, /No preview is running for this workspace yet\./);
    assert.match(html, /Open a project to create a save point\./);
    assert.match(html, /Workspaces: 1/);
    assert.doesNotMatch(html, /Workspace data is session-scoped\./);
    assert.doesNotMatch(html, /Select an active session to send prompts\./);
    assert.doesNotMatch(html, /Select an active session to run a build target\./);
    assert.doesNotMatch(html, /No session selected/);
  });

  test('does not render advanced drawer when feature flag is off', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: false,
    });

    assert.doesNotMatch(html, /workspace-advanced-drawer/);
    assert.doesNotMatch(html, /workspace-advanced-toggle/);
    assert.doesNotMatch(html, /workspace-advanced-drawer-content/);
  });

  test('renders advanced drawer collapsed by default behind feature flag', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
    });

    assert.match(html, /workspace-advanced-drawer/);
    assert.match(html, /workspace-advanced-toggle/);
    assert.match(html, /aria-expanded="false"/);
    assert.doesNotMatch(html, /data-testid="workspace-advanced-drawer-content"/);
  });

  test('renders expanded advanced drawer content with selected session metadata', () => {
    const html = renderToStaticMarkup(
      <WorkspaceAdvancedDrawer
        isOpen
        onToggle={() => {}}
        sessionId={session.id}
        sessionStatus="active"
        workspaceMessages={{ noSessionSelected: 'No session selected' }}
        onCopySessionId={async () => {}}
      />,
    );

    assert.match(html, /workspace-advanced-drawer/);
    assert.match(html, /workspace-advanced-toggle/);
    assert.match(html, /aria-expanded="true"/);
    assert.match(html, /workspace-advanced-drawer-content/);
    assert.match(html, /workspace-advanced-session-id/);
    assert.match(html, /12345678-test-session/);
    assert.match(html, /workspace-advanced-session-status/);
    assert.match(html, />active</);
    assert.match(html, />Copy</);
  });

  test('hides primary sessions list behind feature flag', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      sessions: [session, terminatedSession],
      selectedSessionId: session.id,
    });

    assert.doesNotMatch(html, /Session 12345678/);
    assert.doesNotMatch(html, /terminated/);
    assert.doesNotMatch(html, /data-testid="session-stop-12345678-test-session"/);
    assert.doesNotMatch(html, /data-testid="session-remove-87654321-term-session"/);
    assert.match(html, /workspace-advanced-drawer/);
  });

  test('does not render the New Session block behind feature flag', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      selectedSessionId: null,
    });

    assert.doesNotMatch(html, />New Session</);
    assert.doesNotMatch(html, /Active sessions:/);
  });

  test('renders advanced drawer stop-session control for selected usable session', () => {
    const html = renderToStaticMarkup(
      <WorkspaceAdvancedDrawer
        isOpen
        onToggle={() => {}}
        sessionId={session.id}
        sessionStatus="active"
        workspaceMessages={{ noSessionSelected: 'No session selected' }}
        onCopySessionId={async () => {}}
        canStopSession
        isStoppingSession={false}
        onStopSession={() => {}}
      />,
    );

    assert.match(html, /workspace-advanced-stop-session/);
    assert.match(html, />Session controls</);
    assert.match(html, />Stop</);
  });

  test('does not render advanced drawer stop-session control without stoppable selected session', () => {
    const html = renderToStaticMarkup(
      <WorkspaceAdvancedDrawer
        isOpen
        onToggle={() => {}}
        sessionId={null}
        sessionStatus="not available"
        workspaceMessages={{ noSessionSelected: 'No session selected' }}
      />,
    );

    assert.doesNotMatch(html, /workspace-advanced-stop-session/);
    assert.doesNotMatch(html, />Session controls</);
  });

  test('renders reopen project action for disconnected exec state behind feature flag', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      selectedProjectId: 'project-1',
      onOpenWorkspaceProject: async () => {},
      execState: {
        status: 'http-410',
        result: null,
      },
    });

    assert.match(html, /Workspace disconnected/);
    assert.match(html, /Your workspace expired, but your project can be reopened\./);
    assert.match(html, /Reconnect by reopening your project\./);
    assert.match(html, /workspace-exec-reopen-project/);
    assert.match(html, />Reopen project</);
    assert.doesNotMatch(html, /Session terminated \(410\)/);
    assert.doesNotMatch(html, /This session is terminated and cannot execute commands\./);
  });

  test('renders and wires reopen project action for exec 404 with null selectedSessionId behind feature flag', () => {
    let openCalls = 0;
    const onOpenWorkspaceProject = async () => {
      openCalls += 1;
    };
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      selectedProjectId: 'project-1',
      selectedSessionId: null,
      onOpenWorkspaceProject,
      execState: {
        status: 'http-404',
        result: null,
      },
    });
    const button = renderWorkspaceShellElementByTestId('workspace-exec-reopen-project', {
      projectFirstUxEnabled: true,
      selectedProjectId: 'project-1',
      selectedSessionId: null,
      onOpenWorkspaceProject,
      execState: {
        status: 'http-404',
        result: null,
      },
    });

    assert.match(html, /workspace-exec-reopen-project/);
    assert.match(html, />Reopen project</);
    assert.ok(button);
    const exec404OnClick = button.props.onClick;
    assert.equal(typeof exec404OnClick, 'function');
    if (!exec404OnClick) {
      throw new Error('Expected exec 404 reopen button to expose onClick.');
    }
    exec404OnClick();
    assert.equal(openCalls, 1);
  });

  test('renders and wires reopen project action for exec 410 with null selectedSessionId behind feature flag', () => {
    let openCalls = 0;
    const onOpenWorkspaceProject = async () => {
      openCalls += 1;
    };
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      selectedProjectId: 'project-1',
      selectedSessionId: null,
      onOpenWorkspaceProject,
      execState: {
        status: 'http-410',
        result: null,
      },
    });
    const button = renderWorkspaceShellElementByTestId('workspace-exec-reopen-project', {
      projectFirstUxEnabled: true,
      selectedProjectId: 'project-1',
      selectedSessionId: null,
      onOpenWorkspaceProject,
      execState: {
        status: 'http-410',
        result: null,
      },
    });

    assert.match(html, /workspace-exec-reopen-project/);
    assert.match(html, />Reopen project</);
    assert.ok(button);
    const exec410OnClick = button.props.onClick;
    assert.equal(typeof exec410OnClick, 'function');
    if (!exec410OnClick) {
      throw new Error('Expected exec 410 reopen button to expose onClick.');
    }
    exec410OnClick();
    assert.equal(openCalls, 1);
  });

  test('renders and wires reopen project action for shell error with null selectedSessionId behind feature flag', () => {
    let openCalls = 0;
    const onOpenWorkspaceProject = async () => {
      openCalls += 1;
    };
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      selectedProjectId: 'project-1',
      selectedSessionId: null,
      onOpenWorkspaceProject,
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
    const button = renderWorkspaceShellElementByTestId('workspace-shell-reopen-project', {
      projectFirstUxEnabled: true,
      selectedProjectId: 'project-1',
      selectedSessionId: null,
      onOpenWorkspaceProject,
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

    assert.match(html, /workspace-shell-reopen-project/);
    assert.match(html, />Reopen project</);
    assert.ok(button);
    const shellErrorOnClick = button.props.onClick;
    assert.equal(typeof shellErrorOnClick, 'function');
    if (!shellErrorOnClick) {
      throw new Error('Expected shell error reopen button to expose onClick.');
    }
    shellErrorOnClick();
    assert.equal(openCalls, 1);
  });

  test('does not render resume latest project action in shell empty state when feature flag is off', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: false,
      selectedSessionId: null,
      workspaceProjects: resumeLatestProjects,
      onResumeWorkspaceProjectById: async () => {},
    });

    assert.doesNotMatch(html, /workspace-shell-resume-latest-project/);
    assert.doesNotMatch(html, />Resume latest project</);
  });

  test('renders and wires resume latest project action in shell empty state behind feature flag', () => {
    let resumeCalls = 0;
    let resumedProjectId: string | null = null;
    const onResumeWorkspaceProjectById = async (projectId: string) => {
      resumeCalls += 1;
      resumedProjectId = projectId;
    };
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      selectedSessionId: null,
      workspaceProjects: resumeLatestProjects,
      onResumeWorkspaceProjectById,
    });
    const button = renderWorkspaceShellElementByTestId('workspace-shell-resume-latest-project', {
      projectFirstUxEnabled: true,
      selectedSessionId: null,
      workspaceProjects: resumeLatestProjects,
      onResumeWorkspaceProjectById,
    });

    assert.match(html, /workspace-shell-resume-latest-project/);
    assert.match(html, />Resume latest project</);
    assert.ok(button);
    const resumeLatestOnClick = button.props.onClick;
    assert.equal(typeof resumeLatestOnClick, 'function');
    if (!resumeLatestOnClick) {
      throw new Error('Expected resume latest project button to expose onClick.');
    }
    resumeLatestOnClick();
    assert.equal(resumeCalls, 1);
    assert.equal(resumedProjectId, 'project-a');
  });

  test('does not render resume latest project action in shell empty state with no workspace projects', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      selectedSessionId: null,
      workspaceProjects: [],
      onResumeWorkspaceProjectById: async () => {},
    });

    assert.doesNotMatch(html, /workspace-shell-resume-latest-project/);
    assert.doesNotMatch(html, />Resume latest project</);
  });

  test('does not render resume latest project action in shell empty state without handler', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      selectedSessionId: null,
      workspaceProjects: resumeLatestProjects,
    });

    assert.doesNotMatch(html, /workspace-shell-resume-latest-project/);
    assert.doesNotMatch(html, />Resume latest project</);
  });

  test('does not render project history panel when feature flag is off', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: false,
      selectedProjectId: 'project-1',
      workspaceSnapshots: projectHistorySnapshots,
    });

    assert.doesNotMatch(html, /history-project-history-surface/);
  });

  test('renders project history rows in deterministic newest-first order behind feature flag', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      selectedProjectId: 'project-1',
      workspaceSnapshots: projectHistorySnapshots,
    });

    assert.match(html, /history-project-history-surface/);
    assert.match(html, />Project History</);
    assert.match(html, />Saved version</);
    assert.doesNotMatch(html, /history-project-history-row-snapshot-other/);
    const snapshotAIndex = html.indexOf('history-project-history-row-snapshot-a');
    const snapshotBIndex = html.indexOf('history-project-history-row-snapshot-b');
    const snapshotCIndex = html.indexOf('history-project-history-row-snapshot-c');
    assert.notEqual(snapshotAIndex, -1);
    assert.notEqual(snapshotBIndex, -1);
    assert.notEqual(snapshotCIndex, -1);
    assert.ok(snapshotAIndex < snapshotBIndex);
    assert.ok(snapshotBIndex < snapshotCIndex);
  });

  test('renders versions entry point in project history surface behind feature flag', () => {
    const entryPoint = renderWorkspaceShellElementByTestId(
      'history-project-history-entrypoint',
      {
        projectFirstUxEnabled: true,
        selectedProjectId: 'project-1',
        workspaceSnapshots: projectHistorySnapshots,
      },
    );

    assert.ok(entryPoint);
    assert.equal(entryPoint.props.children, 'Versions');
  });

  test('renders last protected indicator from latest project history row', () => {
    const indicator = renderWorkspaceShellElementByTestId(
      'history-project-history-last-protected',
      {
        projectFirstUxEnabled: true,
        selectedProjectId: 'project-1',
        workspaceSnapshots: projectHistorySnapshots,
      },
    );

    assert.ok(indicator);
    assert.ok(Array.isArray(indicator.props.children));
    assert.equal(indicator.props.children[0], 'Last protected');
    assert.match(renderToStaticMarkup(indicator), /2026/);
  });

  test('does not render versions entry point or last protected indicator when feature flag is off', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: false,
      selectedProjectId: 'project-1',
      workspaceSnapshots: projectHistorySnapshots,
    });

    assert.doesNotMatch(html, /history-project-history-entrypoint/);
    assert.doesNotMatch(html, /history-project-history-last-protected/);
    assert.doesNotMatch(html, />Versions</);
    assert.doesNotMatch(html, />Last protected</);
  });

  test('renders project history empty state when selected project has no matching snapshots', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      selectedProjectId: 'project-1',
      workspaceSnapshots: [
        {
          id: 'snapshot-other',
          userId: 'user-123',
          label: '[project-id:project-2]',
          createdAt: '2026-04-04T08:00:00.000Z',
          fileCount: 4,
        },
      ],
    });

    assert.match(html, /history-project-history-surface/);
    assert.match(html, /history-project-history-empty/);
    assert.match(html, />No history yet for this project\.</);
  });

  test('does not render project history panel without a selected project', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      selectedProjectId: null,
      workspaceSnapshots: projectHistorySnapshots,
    });

    assert.doesNotMatch(html, /history-project-history-surface/);
  });

  test('allows creating a project without selectedSessionId behind feature flag', () => {
    const button = renderWorkspaceShellElementByTestId('history-project-create-button', {
      ...projectPanelRenderOverrides,
      projectFirstUxEnabled: true,
      selectedSessionId: null,
    });

    assert.ok(button);
    assert.equal(button.props.disabled, false);
  });

  test('renders workspace selector and forwards workspace changes in project surface', () => {
    const selectedWorkspaceIds: string[] = [];
    const select = renderWorkspaceShellElementByTestId('history-workspace-select', {
      ...projectPanelRenderOverrides,
      projectFirstUxEnabled: true,
      selectedSessionId: null,
      selectedWorkspaceId: 'workspace-2',
      onSelectWorkspaceId: (workspaceId: string) => {
        selectedWorkspaceIds.push(workspaceId);
      },
    });

    assert.ok(select);
    assert.equal(select.props.value, 'workspace-2');
    assert.match(
      renderWorkspaceShell({
        ...projectPanelRenderOverrides,
        projectFirstUxEnabled: true,
        selectedSessionId: null,
        selectedWorkspaceId: 'workspace-2',
      }),
      />Client Work</,
    );

    const onChange = select.props.onChange as
      | ((event: { target: { value: string } }) => void)
      | undefined;
    onChange?.({ target: { value: 'workspace-1' } });
    assert.deepEqual(selectedWorkspaceIds, ['workspace-1']);
  });

  test('renders workspace create controls and forwards create requests', () => {
    let createCalls = 0;
    const inputValues: string[] = [];
    const input = renderWorkspaceShellElementByTestId('history-workspace-create-input', {
      ...projectPanelRenderOverrides,
      projectFirstUxEnabled: true,
      selectedSessionId: null,
      workspaceCreateNameInput: 'Client Ops',
      onWorkspaceCreateNameInputChange: (value: string) => {
        inputValues.push(value);
      },
    });
    const button = renderWorkspaceShellElementByTestId('history-workspace-create-button', {
      ...projectPanelRenderOverrides,
      projectFirstUxEnabled: true,
      selectedSessionId: null,
      workspaceCreateNameInput: 'Client Ops',
      onCreateWorkspace: async () => {
        createCalls += 1;
      },
    });

    assert.ok(input);
    assert.equal(input.props.value, 'Client Ops');
    const onChange = input.props.onChange as
      | ((event: { target: { value: string } }) => void)
      | undefined;
    onChange?.({ target: { value: 'Studio' } });
    assert.deepEqual(inputValues, ['Studio']);

    assert.ok(button);
    assert.equal(button.props.disabled, false);
    const onClick = button.props.onClick as (() => void) | undefined;
    onClick?.();
    assert.equal(createCalls, 1);
  });

  test('renders workspace rename controls and forwards rename requests', () => {
    let renameCalls = 0;
    const inputValues: string[] = [];
    const input = renderWorkspaceShellElementByTestId('history-workspace-rename-input', {
      ...projectPanelRenderOverrides,
      projectFirstUxEnabled: true,
      selectedSessionId: null,
      selectedWorkspaceId: 'workspace-2',
      workspaceRenameNameInput: 'Client Work',
      onWorkspaceRenameNameInputChange: (value: string) => {
        inputValues.push(value);
      },
    });
    const button = renderWorkspaceShellElementByTestId('history-workspace-rename-button', {
      ...projectPanelRenderOverrides,
      projectFirstUxEnabled: true,
      selectedSessionId: null,
      selectedWorkspaceId: 'workspace-2',
      workspaceRenameNameInput: 'Client Work',
      onRenameWorkspace: async () => {
        renameCalls += 1;
      },
    });

    assert.ok(input);
    assert.equal(input.props.value, 'Client Work');
    const onChange = input.props.onChange as
      | ((event: { target: { value: string } }) => void)
      | undefined;
    onChange?.({ target: { value: 'Client Delivery' } });
    assert.deepEqual(inputValues, ['Client Delivery']);

    assert.ok(button);
    assert.equal(button.props.disabled, false);
    const onClick = button.props.onClick as (() => void) | undefined;
    onClick?.();
    assert.equal(renameCalls, 1);
  });

  test('keeps workspace delete disabled for the default workspace', () => {
    const button = renderWorkspaceShellElementByTestId('history-workspace-delete-button', {
      ...projectPanelRenderOverrides,
      projectFirstUxEnabled: true,
      selectedSessionId: null,
      selectedWorkspaceId: 'workspace-1',
    });

    assert.ok(button);
    assert.equal(button.props.disabled, true);
  });

  test('enables workspace delete and forwards requests for non-default workspace', () => {
    let deleteCalls = 0;
    const button = renderWorkspaceShellElementByTestId('history-workspace-delete-button', {
      ...projectPanelRenderOverrides,
      projectFirstUxEnabled: true,
      selectedSessionId: null,
      selectedWorkspaceId: 'workspace-2',
      onDeleteWorkspace: async () => {
        deleteCalls += 1;
      },
    });

    assert.ok(button);
    assert.equal(button.props.disabled, false);
    const onClick = button.props.onClick as (() => void) | undefined;
    onClick?.();
    assert.equal(deleteCalls, 1);
  });

  test('renders project move workspace selector for selected project', () => {
    const select = renderWorkspaceShellElementByTestId('history-project-move-workspace-select', {
      ...projectPanelRenderOverrides,
      projectFirstUxEnabled: true,
      selectedSessionId: null,
      selectedWorkspaceId: 'workspace-1',
      projectMoveTargetWorkspaceId: 'workspace-2',
      workspaceProjects: [
        {
          id: 'project-1',
          userId: 'user-123',
          name: 'My Workspace Project',
          workspaceId: 'workspace-1',
          createdAt: '2026-04-04T10:00:00.000Z',
          updatedAt: '2026-04-04T10:00:00.000Z',
        },
      ],
    });

    assert.ok(select);
    assert.equal(select.props.value, 'workspace-2');
  });

  test('forwards project move target changes and move requests', () => {
    const selectedWorkspaceIds: string[] = [];
    let moveCalls = 0;
    const select = renderWorkspaceShellElementByTestId('history-project-move-workspace-select', {
      ...projectPanelRenderOverrides,
      projectFirstUxEnabled: true,
      selectedSessionId: null,
      selectedWorkspaceId: 'workspace-1',
      projectMoveTargetWorkspaceId: null,
      onProjectMoveTargetWorkspaceIdChange: (workspaceId: string) => {
        selectedWorkspaceIds.push(workspaceId);
      },
      onMoveWorkspaceProject: async () => {
        moveCalls += 1;
      },
    });
    const button = renderWorkspaceShellElementByTestId('history-project-move-button', {
      ...projectPanelRenderOverrides,
      projectFirstUxEnabled: true,
      selectedSessionId: null,
      selectedWorkspaceId: 'workspace-1',
      projectMoveTargetWorkspaceId: 'workspace-2',
      onMoveWorkspaceProject: async () => {
        moveCalls += 1;
      },
    });

    assert.ok(select);
    const onChange = select.props.onChange as
      | ((event: { target: { value: string } }) => void)
      | undefined;
    onChange?.({ target: { value: 'workspace-2' } });
    assert.deepEqual(selectedWorkspaceIds, ['workspace-2']);

    assert.ok(button);
    assert.equal(button.props.disabled, false);
    const onClick = button.props.onClick as (() => void) | undefined;
    onClick?.();
    assert.equal(moveCalls, 1);
  });

  test('allows opening a project without selectedSessionId behind feature flag', () => {
    const button = renderWorkspaceShellElementByTestId('history-project-open-button', {
      ...projectPanelRenderOverrides,
      projectFirstUxEnabled: true,
      selectedSessionId: null,
      selectedProjectId: 'project-1',
    });

    assert.ok(button);
    assert.equal(button.props.disabled, false);
  });

  test('keeps create and open project buttons disabled without selectedSessionId when feature flag is off', () => {
    const createButton = renderWorkspaceShellElementByTestId('history-project-create-button', {
      ...projectPanelRenderOverrides,
      projectFirstUxEnabled: false,
      selectedSessionId: null,
      selectedProjectId: 'project-1',
    });
    const openButton = renderWorkspaceShellElementByTestId('history-project-open-button', {
      ...projectPanelRenderOverrides,
      projectFirstUxEnabled: false,
      selectedSessionId: null,
      selectedProjectId: 'project-1',
    });

    assert.ok(createButton);
    assert.equal(createButton.props.disabled, true);
    assert.ok(openButton);
    assert.equal(openButton.props.disabled, true);
  });

  test('renders parsed snapshot name for named project history rows behind feature flag', () => {
    const label = renderWorkspaceShellElementByTestId(
      'history-project-history-label-snapshot-named',
      {
        projectFirstUxEnabled: true,
        selectedProjectId: 'project-1',
        workspaceSnapshots: projectHistorySnapshotsWithNames,
      },
    );

    assert.ok(label);
    assert.equal(label.props.children, 'Working draft');
  });

  test('keeps the existing default label for unnamed project history rows', () => {
    const label = renderWorkspaceShellElementByTestId(
      'history-project-history-label-snapshot-unnamed',
      {
        projectFirstUxEnabled: true,
        selectedProjectId: 'project-1',
        workspaceSnapshots: projectHistorySnapshotsWithNames,
      },
    );

    assert.ok(label);
    assert.equal(label.props.children, 'Saved version');
  });

  test('renders source-based fallback labels for automatic project history rows', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      selectedProjectId: 'project-1',
      workspaceSnapshots: projectHistorySnapshotsWithSources,
    });

    assert.match(html, /history-project-history-label-snapshot-preview/);
    assert.match(html, />Preview built</);
    assert.match(html, /history-project-history-label-snapshot-ai/);
    assert.match(html, />AI changes saved</);
    assert.match(html, /history-project-history-label-snapshot-file-save/);
    assert.match(html, />File saved</);
    assert.match(html, /history-project-history-label-snapshot-expiry/);
    assert.match(html, />Session ending</);
    assert.match(html, /history-project-history-label-snapshot-initial/);
    assert.match(html, />Project created</);
    assert.doesNotMatch(html, /history-project-history-row-snapshot-other-project-source/);
  });

  test('appends deterministic hints to automatic source-based fallback labels when present', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      selectedProjectId: 'project-1',
      workspaceSnapshots: projectHistorySnapshotsWithHints,
    });

    assert.match(html, /history-project-history-label-snapshot-ai-hint/);
    assert.match(html, />AI changes saved · app\.tsx \+2</);
    assert.match(html, /history-project-history-label-snapshot-file-save-hint/);
    assert.match(html, />File saved · index\.html</);
    assert.doesNotMatch(html, /history-project-history-row-snapshot-other-project-hint/);
  });

  test('renders mixed named and unnamed project history rows without changing project filtering', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      selectedProjectId: 'project-1',
      workspaceSnapshots: projectHistorySnapshotsWithNames,
    });

    assert.match(html, /history-project-history-label-snapshot-named/);
    assert.match(html, />Working draft</);
    assert.match(html, /history-project-history-label-snapshot-unnamed/);
    assert.match(html, />Saved version</);
    assert.doesNotMatch(html, /history-project-history-row-snapshot-other-named/);
    assert.doesNotMatch(html, />Other project draft</);
  });

  test('does not render project history restore buttons when feature flag is off', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: false,
      selectedProjectId: 'project-1',
      workspaceSnapshots: projectHistorySnapshots,
      onRestoreWorkspaceProjectFromSnapshotById: async () => {},
    });

    assert.doesNotMatch(html, /history-project-history-restore-snapshot-a/);
    assert.doesNotMatch(html, />Restore</);
  });

  test('does not render project history save button when feature flag is off', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: false,
      selectedProjectId: 'project-1',
      workspaceSnapshots: projectHistorySnapshots,
      onSaveNamedProjectSnapshot: async () => {},
    });

    assert.doesNotMatch(html, /history-project-history-save/);
  });

  test('renders project history save button behind feature flag', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      selectedProjectId: 'project-1',
      workspaceSnapshots: projectHistorySnapshots,
      onSaveNamedProjectSnapshot: async () => {},
    });

    assert.match(html, /history-project-history-save/);
  });

  test('does not render project history save button without save handler', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      selectedProjectId: 'project-1',
      workspaceSnapshots: projectHistorySnapshots,
    });

    assert.doesNotMatch(html, /history-project-history-save/);
  });

  test('renders project history restore buttons per row behind feature flag', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      selectedProjectId: 'project-1',
      workspaceSnapshots: projectHistorySnapshots,
      onRestoreWorkspaceProjectFromSnapshotById: async () => {},
    });

    assert.match(html, /history-project-history-restore-snapshot-a/);
    assert.match(html, /history-project-history-restore-snapshot-b/);
    assert.match(html, /history-project-history-restore-snapshot-c/);
    assert.doesNotMatch(html, /history-project-history-restore-snapshot-other/);
  });

  test('does not render project history restore buttons without restore handler', () => {
    const html = renderWorkspaceShell({
      projectFirstUxEnabled: true,
      selectedProjectId: 'project-1',
      workspaceSnapshots: projectHistorySnapshots,
    });

    assert.doesNotMatch(html, /history-project-history-restore-snapshot-a/);
    assert.doesNotMatch(html, />Restore</);
  });

  test('confirms before restoring a project history row and calls handler once on accept', () => {
    let restoreCalls = 0;
    let restoredProjectId: string | null = null;
    let restoredSnapshotId: string | null = null;
    let confirmCalls = 0;
    let confirmMessage: string | undefined;
    const onRestoreWorkspaceProjectFromSnapshotById = async (
      projectId: string,
      snapshotId: string,
    ) => {
      restoreCalls += 1;
      restoredProjectId = projectId;
      restoredSnapshotId = snapshotId;
    };
    const button = renderWorkspaceShellElementByTestId('history-project-history-restore-snapshot-a', {
      projectFirstUxEnabled: true,
      workspaceView: 'projects',
      selectedProjectId: 'project-1',
      workspaceSnapshots: projectHistorySnapshots,
      onRestoreWorkspaceProjectFromSnapshotById,
    });

    assert.ok(button);
    const onClick = button.props.onClick;
    assert.equal(typeof onClick, 'function');
    if (!onClick) {
      throw new Error('Expected restore button to expose onClick.');
    }

    withPatchedWindowConfirm((message) => {
      confirmCalls += 1;
      confirmMessage = message;
      return true;
    }, () => {
      onClick();
    });

    assert.equal(confirmCalls, 1);
    assert.equal(
      confirmMessage,
      'Restore this version? Your current workspace will be replaced.',
    );
    assert.equal(restoreCalls, 1);
    assert.equal(restoredProjectId, 'project-1');
    assert.equal(restoredSnapshotId, 'snapshot-a');
  });

  test('does not call restore handler when project history restore confirmation is declined', () => {
    let restoreCalls = 0;
    let confirmCalls = 0;
    const onRestoreWorkspaceProjectFromSnapshotById = async () => {
      restoreCalls += 1;
    };
    const button = renderWorkspaceShellElementByTestId('history-project-history-restore-snapshot-a', {
      projectFirstUxEnabled: true,
      workspaceView: 'projects',
      selectedProjectId: 'project-1',
      workspaceSnapshots: projectHistorySnapshots,
      onRestoreWorkspaceProjectFromSnapshotById,
    });

    assert.ok(button);
    const onClick = button.props.onClick;
    assert.equal(typeof onClick, 'function');
    if (!onClick) {
      throw new Error('Expected restore button to expose onClick.');
    }

    withPatchedWindowConfirm(() => {
      confirmCalls += 1;
      return false;
    }, () => {
      onClick();
    });

    assert.equal(confirmCalls, 1);
    assert.equal(restoreCalls, 0);
  });

  test('does not call named save handler when project history save prompt is cancelled', () => {
    let promptCalls = 0;
    let promptMessage: string | undefined;
    let saveCalls = 0;
    const onSaveNamedProjectSnapshot = async () => {
      saveCalls += 1;
    };
    const button = renderWorkspaceShellElementByTestId('history-project-history-save', {
      projectFirstUxEnabled: true,
      selectedProjectId: 'project-1',
      workspaceSnapshots: projectHistorySnapshots,
      onSaveNamedProjectSnapshot,
    });

    assert.ok(button);
    const onClick = button.props.onClick;
    assert.equal(typeof onClick, 'function');
    if (!onClick) {
      throw new Error('Expected save button to expose onClick.');
    }

    withPatchedWindowPrompt((message) => {
      promptCalls += 1;
      promptMessage = message;
      return null;
    }, () => {
      onClick();
    });

    assert.equal(promptCalls, 1);
    assert.equal(promptMessage, 'Name this saved version:');
    assert.equal(saveCalls, 0);
  });

  test('does not call named save handler when project history save prompt is blank', () => {
    let saveCalls = 0;
    const onSaveNamedProjectSnapshot = async () => {
      saveCalls += 1;
    };
    const button = renderWorkspaceShellElementByTestId('history-project-history-save', {
      projectFirstUxEnabled: true,
      selectedProjectId: 'project-1',
      workspaceSnapshots: projectHistorySnapshots,
      onSaveNamedProjectSnapshot,
    });

    assert.ok(button);
    const onClick = button.props.onClick;
    assert.equal(typeof onClick, 'function');
    if (!onClick) {
      throw new Error('Expected save button to expose onClick.');
    }

    withPatchedWindowPrompt(() => '   ', () => {
      onClick();
    });

    assert.equal(saveCalls, 0);
  });

  test('calls named save handler with trimmed prompt text from project history save button', () => {
    let promptCalls = 0;
    let saveCalls = 0;
    let savedName: string | null = null;
    const onSaveNamedProjectSnapshot = async (name: string) => {
      saveCalls += 1;
      savedName = name;
    };
    const button = renderWorkspaceShellElementByTestId('history-project-history-save', {
      projectFirstUxEnabled: true,
      selectedProjectId: 'project-1',
      workspaceSnapshots: projectHistorySnapshots,
      onSaveNamedProjectSnapshot,
    });

    assert.ok(button);
    const onClick = button.props.onClick;
    assert.equal(typeof onClick, 'function');
    if (!onClick) {
      throw new Error('Expected save button to expose onClick.');
    }

    withPatchedWindowPrompt(() => {
      promptCalls += 1;
      return '  Working draft  ';
    }, () => {
      onClick();
    });

    assert.equal(promptCalls, 1);
    assert.equal(saveCalls, 1);
    assert.equal(savedName, 'Working draft');
  });

  test('renders Stop for usable sessions and Remove for unusable sessions', () => {
    const html = renderWorkspaceShell({
      sessions: [session, terminatedSession],
      selectedSessionId: session.id,
    });

    assert.match(html, /data-testid="session-stop-12345678-test-session"/);
    assert.match(html, /data-testid="session-remove-87654321-term-session"/);
  });

  test('requires confirmation before stop session executes', () => {
    let stopCalls = 0;
    const cancelled = runStopSessionWithConfirmation({
      sessionId: session.id,
      confirmStop: () => false,
      onStopSession: async () => {
        stopCalls += 1;
      },
    });
    const confirmed = runStopSessionWithConfirmation({
      sessionId: session.id,
      confirmStop: () => true,
      onStopSession: async () => {
        stopCalls += 1;
      },
    });

    assert.equal(cancelled, false);
    assert.equal(confirmed, true);
    assert.equal(stopCalls, 1);
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

  test('renders assistant file-action success entries in chat thread', () => {
    const html = renderWorkspaceShell({
      chatThreadMessages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Updated your workspace files.',
          executionId: 'exec-1',
          fileActionState: {
            executionId: 'exec-1',
            source: 'status',
            fileActions: [{ action: 'write', path: 'src/app.ts', content: 'next' }],
            applyStatus: 'applied',
            confirmationRequired: false,
            skipReason: null,
            results: [{ action: 'write', path: 'src/app.ts', status: 'success', error: null }],
          },
        },
      ],
    });

    assert.match(html, /workspace-chat-file-actions/);
    assert.match(html, /File Action Results/);
    assert.match(html, /write src\/app\.ts/);
    assert.match(html, />success</);
  });

  test('renders assistant file-action failure entries with error text', () => {
    const html = renderWorkspaceShell({
      chatThreadMessages: [
        {
          id: 'assistant-2',
          role: 'assistant',
          content: 'I tried to update files.',
          executionId: 'exec-2',
          fileActionState: {
            executionId: 'exec-2',
            source: 'stream',
            fileActions: [{ action: 'update', path: 'src/missing.ts', content: 'x' }],
            applyStatus: 'applied',
            confirmationRequired: false,
            skipReason: null,
            results: [
              {
                action: 'update',
                path: 'src/missing.ts',
                status: 'failed',
                error: 'Failed to save file changes.',
              },
            ],
          },
        },
      ],
    });

    assert.match(html, /update src\/missing\.ts/);
    assert.match(html, />failed</);
    assert.match(html, /Failed to save file changes\./);
  });

  test('renders assistant skipped file-action state in chat thread', () => {
    const html = renderWorkspaceShell({
      chatThreadMessages: [
        {
          id: 'assistant-3',
          role: 'assistant',
          content: 'Skipped applying changes.',
          executionId: 'exec-3',
          fileActionState: {
            executionId: 'exec-3',
            source: 'status',
            fileActions: [{ action: 'create', path: 'src/new.ts', content: 'ok' }],
            applyStatus: 'skipped',
            confirmationRequired: false,
            skipReason: 'stale-session',
            results: [{ action: 'create', path: 'src/new.ts', status: 'skipped', error: 'stale-session' }],
          },
        },
      ],
    });

    assert.match(html, /workspace-chat-file-actions-skipped/);
    assert.match(html, /File action application skipped \(stale-session\)\./);
    assert.match(html, />skipped</);
  });

  test('keeps text-only assistant messages unchanged when no file actions exist', () => {
    const html = renderWorkspaceShell({
      chatThreadMessages: [
        {
          id: 'assistant-4',
          role: 'assistant',
          content: 'Here is a text-only response.',
        },
      ],
    });

    assert.match(html, /Here is a text-only response\./);
    assert.match(html, /workspace-chat-message-content-prose-assistant-4/);
    assert.doesNotMatch(html, /workspace-chat-message-content-pre-assistant-4/);
    assert.doesNotMatch(html, /workspace-chat-file-actions/);
  });

  test('renders confirmation notice for risky assistant file-action batches', () => {
    const html = renderWorkspaceShell({
      chatThreadMessages: [
        {
          id: 'assistant-confirm-1',
          role: 'assistant',
          content: 'This needs confirmation before applying.',
          executionId: 'exec-confirm-1',
          fileActionState: {
            executionId: 'exec-confirm-1',
            source: 'status',
            fileActions: [
              { action: 'write', path: 'package.json', content: '{}' },
              { action: 'write', path: 'src/app.ts', content: 'next' },
            ],
            applyStatus: 'awaiting-confirmation',
            confirmationRequired: true,
            skipReason: null,
            results: [],
          },
        },
      ],
    });

    assert.match(html, /workspace-chat-file-actions-awaiting-confirmation/);
    assert.match(html, /Approval required before applying risky file actions\./);
    assert.doesNotMatch(html, /workspace-chat-file-actions-visual-edit-attribution/);
    assert.doesNotMatch(html, /workspace-chat-file-actions-diff-loading/);
    assert.doesNotMatch(html, /workspace-chat-file-actions-diff-error/);
    assert.doesNotMatch(html, /workspace-chat-file-actions-diff-update/);
    assert.doesNotMatch(html, /workspace-chat-file-actions-diff-create/);
    assert.doesNotMatch(html, /workspace-chat-file-actions-diff-delete/);
    assert.match(html, /package\.json/);
    assert.match(html, /workspace-chat-file-actions-confirm-button/);
    assert.match(html, /workspace-chat-file-actions-cancel-button/);
  });

  test('renders visual-edit attribution for visual-edit-sourced execution file actions', () => {
    const html = renderWorkspaceShell({
      visualEditExecutionIds: ['exec-visual-1'],
      chatThreadMessages: [
        {
          id: 'assistant-visual-confirm-1',
          role: 'assistant',
          content: 'Awaiting confirmation for visual edit.',
          executionId: 'exec-visual-1',
          fileActionState: {
            executionId: 'exec-visual-1',
            source: 'status',
            fileActions: [{ action: 'write', path: 'src/app.tsx', content: 'updated' }],
            applyStatus: 'awaiting-confirmation',
            confirmationRequired: true,
            skipReason: null,
            results: [],
          },
        },
      ],
    });

    assert.match(html, /workspace-chat-file-actions-visual-edit-attribution/);
    assert.match(html, /Source: Visual Edit mode selection\./);
    assert.match(html, /Approval required before applying risky file actions\./);
  });

  test('renders diff loading state for visual-edit awaiting-confirmation execution', () => {
    const html = renderWorkspaceShell({
      visualEditExecutionIds: ['exec-visual-loading-1'],
      chatThreadMessages: [
        {
          id: 'assistant-visual-loading-1',
          role: 'assistant',
          content: 'Waiting for visual diff preview.',
          executionId: 'exec-visual-loading-1',
          fileActionState: {
            executionId: 'exec-visual-loading-1',
            source: 'status',
            fileActions: [{ action: 'write', path: 'src/app.tsx', content: 'updated' }],
            applyStatus: 'awaiting-confirmation',
            confirmationRequired: true,
            skipReason: null,
            results: [],
          },
        },
      ],
    });

    assert.match(html, /workspace-chat-file-actions-diff-loading/);
    assert.doesNotMatch(html, /workspace-chat-file-actions-diff-update/);
    assert.doesNotMatch(html, /workspace-chat-file-actions-diff-create/);
    assert.doesNotMatch(html, /workspace-chat-file-actions-diff-delete/);
  });

  test('does not render diff for non-visual-edit awaiting-confirmation execution', () => {
    const html = renderWorkspaceShell({
      chatThreadMessages: [
        {
          id: 'assistant-non-visual-confirm-1',
          role: 'assistant',
          content: 'Non-visual confirmation path.',
          executionId: 'exec-non-visual-1',
          fileActionState: {
            executionId: 'exec-non-visual-1',
            source: 'status',
            fileActions: [{ action: 'write', path: 'src/non-visual.ts', content: 'update' }],
            applyStatus: 'awaiting-confirmation',
            confirmationRequired: true,
            skipReason: null,
            results: [],
          },
        },
      ],
    });

    assert.match(html, /workspace-chat-file-actions-awaiting-confirmation/);
    assert.doesNotMatch(html, /workspace-chat-file-actions-diff-loading/);
    assert.doesNotMatch(html, /workspace-chat-file-actions-diff-error/);
    assert.doesNotMatch(html, /workspace-chat-file-actions-diff-update/);
    assert.doesNotMatch(html, /workspace-chat-file-actions-diff-create/);
    assert.doesNotMatch(html, /workspace-chat-file-actions-diff-delete/);
  });

  test('forwards risky file-action confirmation actions from the chat summary', () => {
    let confirmedExecutionId: string | null = null;
    let cancelledExecutionId: string | null = null;

    const confirmButton = renderWorkspaceShellElementByTestId(
      'workspace-chat-file-actions-confirm-button',
      {
        onConfirmExecutionFileActions: (executionId) => {
          confirmedExecutionId = executionId;
        },
        onCancelExecutionFileActions: (executionId) => {
          cancelledExecutionId = executionId;
        },
        chatThreadMessages: [
          {
            id: 'assistant-confirm-2',
            role: 'assistant',
            content: 'Waiting for confirmation.',
            executionId: 'exec-confirm-2',
            fileActionState: {
              executionId: 'exec-confirm-2',
              source: 'status',
              fileActions: [{ action: 'write', path: 'package.json', content: '{}' }],
              applyStatus: 'awaiting-confirmation',
              confirmationRequired: true,
              skipReason: null,
              results: [],
            },
          },
        ],
      },
    );
    confirmButton?.props.onClick?.();

    const cancelButton = renderWorkspaceShellElementByTestId(
      'workspace-chat-file-actions-cancel-button',
      {
        onConfirmExecutionFileActions: (executionId) => {
          confirmedExecutionId = executionId;
        },
        onCancelExecutionFileActions: (executionId) => {
          cancelledExecutionId = executionId;
        },
        chatThreadMessages: [
          {
            id: 'assistant-confirm-3',
            role: 'assistant',
            content: 'Waiting for confirmation.',
            executionId: 'exec-confirm-3',
            fileActionState: {
              executionId: 'exec-confirm-3',
              source: 'status',
              fileActions: [{ action: 'write', path: 'package.json', content: '{}' }],
              applyStatus: 'awaiting-confirmation',
              confirmationRequired: true,
              skipReason: null,
              results: [],
            },
          },
        ],
      },
    );
    cancelButton?.props.onClick?.();

    assert.equal(confirmedExecutionId, 'exec-confirm-2');
    assert.equal(cancelledExecutionId, 'exec-confirm-3');
  });

  test('renders code-fenced assistant messages in preformatted style', () => {
    const html = renderWorkspaceShell({
      chatThreadMessages: [
        {
          id: 'assistant-code-1',
          role: 'assistant',
          content: '```ts\\nconst value = 1;\\n```',
        },
      ],
    });

    assert.match(html, /workspace-chat-message-content-pre-assistant-code-1/);
    assert.doesNotMatch(html, /workspace-chat-message-content-prose-assistant-code-1/);
  });

  test('renders assistant model attribution when available', () => {
    const html = renderWorkspaceShell({
      chatThreadMessages: [
        {
          id: 'assistant-model-1',
          role: 'assistant',
          content: 'Generated by selected model.',
          provider: 'openai',
          model: 'gpt-4o',
        },
      ],
    });

    assert.match(html, /Model: gpt-4o \(openai\)/);
    assert.match(html, /workspace-chat-message-attribution-assistant-model-1/);
  });

  test('renders assistant response prose in normal text and code-fenced response as preformatted', () => {
    const proseHtml = renderWorkspaceShell({
      chatResponseText: 'This is a normal assistant prose response.',
    });
    const codeHtml = renderWorkspaceShell({
      chatResponseText: '```bash\\necho hello\\n```',
    });

    assert.match(proseHtml, /workspace-chat-response-content-prose/);
    assert.doesNotMatch(proseHtml, /workspace-chat-response-content-pre/);

    assert.match(codeHtml, /workspace-chat-response-content-pre/);
    assert.doesNotMatch(codeHtml, /workspace-chat-response-content-prose/);
  });

  test('renders build output and status in bounded build panel', () => {
    const html = renderWorkspaceShell({
      buildRequestState: 'completed',
      buildStatusMessage: 'ios build completed successfully.',
      buildOutput: 'Build logs\\nArtifact: app.ipa',
    });

    assert.match(html, /workspace-build-panel/);
    assert.match(html, /ios build completed successfully\./);
    assert.match(html, /Build logs/);
    assert.match(html, /Artifact: app\.ipa/);
  });

  test('renders bounded build failure message', () => {
    const html = renderWorkspaceShell({
      buildRequestState: 'failed',
      buildError: 'ios build toolchain is unavailable in this runtime.',
    });

    assert.match(html, /workspace-build-error/);
    assert.match(html, /toolchain is unavailable in this runtime/);
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

  test('renders preview picker toggle in Preview tab toolbar', () => {
    const html = renderWorkspaceShell({
      selectedSessionId: session.id,
      previewState: 'ready',
      previewUrl: `/api/preview/${session.id}/proxy?refresh=11`,
    });

    assert.match(html, /data-testid="workspace-preview-picker-toggle"/);
  });

  test('disables preview picker toggle when preview URL is missing', () => {
    const html = renderWorkspaceShell({
      selectedSessionId: session.id,
      previewState: 'ready',
      previewUrl: null,
    });

    assert.match(html, /data-testid="workspace-preview-picker-toggle"[^>]*disabled/);
  });

  test('sets preview picker toggle aria-pressed false by default', () => {
    const html = renderWorkspaceShell({
      selectedSessionId: session.id,
      previewState: 'ready',
      previewUrl: `/api/preview/${session.id}/proxy?refresh=12`,
    });

    assert.match(html, /data-testid="workspace-preview-picker-toggle"[^>]*aria-pressed="false"/);
  });

  test('keeps preview Start and Refresh controls visible with picker infrastructure', () => {
    const html = renderWorkspaceShell({
      selectedSessionId: session.id,
      previewState: 'ready',
      previewUrl: `/api/preview/${session.id}/proxy?refresh=13`,
    });

    assert.match(html, /data-testid="workspace-preview-start"/);
    assert.match(html, /data-testid="workspace-preview-refresh"/);
  });

  test('keeps preview iframe rendering when preview URL exists', () => {
    const html = renderWorkspaceShell({
      selectedSessionId: session.id,
      previewState: 'ready',
      previewUrl: `/api/preview/${session.id}/proxy?refresh=14`,
    });

    assert.match(html, /data-testid="workspace-preview-iframe"/);
  });

  test('selected element indicator is absent by default', () => {
    const html = renderWorkspaceShell({
      selectedSessionId: session.id,
      previewState: 'ready',
      previewUrl: `/api/preview/${session.id}/proxy?refresh=15`,
    });

    assert.doesNotMatch(html, /data-testid="workspace-preview-selected-element"/);
  });

  test('picker toggle still renders after 15B implementation', () => {
    const html = renderWorkspaceShell({
      selectedSessionId: session.id,
      previewState: 'ready',
      previewUrl: `/api/preview/${session.id}/proxy?refresh=16`,
    });

    assert.match(html, /data-testid="workspace-preview-picker-toggle"/);
    assert.match(html, /data-testid="workspace-preview-start"/);
    assert.match(html, /data-testid="workspace-preview-refresh"/);
  });

  test('preview iframe still renders after 15B wiring', () => {
    const html = renderWorkspaceShell({
      selectedSessionId: session.id,
      previewState: 'ready',
      previewUrl: `/api/preview/${session.id}/proxy?refresh=17`,
    });

    assert.match(html, /data-testid="workspace-preview-iframe"/);
  });

  test('picker-active banner is absent by default after 15B', () => {
    const html = renderWorkspaceShell({
      selectedSessionId: session.id,
      previewState: 'ready',
      previewUrl: `/api/preview/${session.id}/proxy?refresh=18`,
    });

    assert.doesNotMatch(html, /data-testid="workspace-preview-picker-active"/);
  });

  test('accepts onPreviewElementSelected callback without breaking preview render', () => {
    const html = renderWorkspaceShell({
      selectedSessionId: session.id,
      previewState: 'ready',
      previewUrl: `/api/preview/${session.id}/proxy?refresh=19`,
      onPreviewElementSelected: () => {},
    });

    assert.match(html, /data-testid="workspace-preview-picker-toggle"/);
    assert.match(html, /data-testid="workspace-preview-iframe"/);
  });

  test('renders unavailable preview state with start preview action', () => {
    const html = renderWorkspaceShell({
      selectedSessionId: session.id,
      previewState: 'unavailable',
      previewUrl: null,
    });

    assert.match(html, /Preview unavailable/);
    assert.match(html, /data-testid="workspace-preview-start"/);
    assert.match(html, />Start Preview</);
  });

  test('renders ready preview state with iframe', () => {
    const html = renderWorkspaceShell({
      selectedSessionId: session.id,
      previewState: 'ready',
      previewUrl: `/api/preview/${session.id}/proxy?refresh=2`,
    });

    assert.match(html, /Preview ready/);
    assert.match(html, /workspace-preview-iframe/);
    assert.doesNotMatch(html, /Use Refresh to reload only this preview\./);
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
    assert.match(html, /data-testid="history-section-visibility-summary-group-label"/);
    assert.match(
      html,
      /Visibility summary group \(read-only\): Current visibility and preset interpretation summaries \(status, match, explanation, baseline, delta, guide, hidden\/visible, and consistency\) for this active session\./,
    );
    assert.match(html, /data-testid="history-section-visibility-summary-order-label"/);
    assert.match(
      html,
      /Visibility summary order \(read-only\): Read in order - status, match, explanation, baseline, delta, guide, hidden\/visible, then consistency\./,
    );
    assert.match(html, /data-testid="history-section-visibility-summary-scope-label"/);
    assert.match(
      html,
      /Visibility summary scope \(read-only\): Applies only to this active session&#x27;s major history-section visibility and preset-interpretation summaries; no backend or cross-session state\./,
    );
    assert.match(html, /data-testid="history-section-visibility-summary-audience-label"/);
    assert.match(
      html,
      /Visibility summary audience \(read-only\): For the current active-session user reviewing this session&#x27;s major history-section visibility and preset-interpretation summaries\./,
    );
    assert.match(html, /data-testid="history-section-visibility-summary-brevity-label"/);
    assert.match(
      html,
      /Visibility summary brevity \(read-only\): These labels are concise, at-a-glance summaries of this active session&#x27;s existing history-section visibility and preset-interpretation state\./,
    );
    assert.match(html, /data-testid="history-section-visibility-summary-placement-label"/);
    assert.match(
      html,
      /Visibility summary placement \(read-only\): Presented in this controls area before the detailed visibility summaries so active-session visibility and preset interpretation state stays easy to scan\./,
    );
    assert.match(html, /data-testid="history-section-visibility-summary-context-label"/);
    assert.match(
      html,
      /Visibility summary context \(read-only\): These existing summaries provide quick context for how current in-session section visibility and preset interpretation should be read before using history controls\./,
    );
    assert.match(html, /data-testid="history-section-visibility-summary-intent-label"/);
    assert.match(
      html,
      /Visibility summary intent \(read-only\): Use these existing summaries as an at-a-glance intent guide for how current in-session section visibility and preset interpretation should inform history-control use\./,
    );
    assert.match(html, /data-testid="history-section-visibility-status-summary"/);
    assert.match(html, /Visibility status: Preset Default \| Visible 4\/4 \| Collapsed: None/);
    assert.match(html, /data-testid="history-section-visibility-preset-match-status"/);
    assert.match(html, /Preset match status \(read-only\): Matches Default preset/);
    assert.match(html, /data-testid="history-section-visibility-preset-match-explanation"/);
    assert.match(html, /Preset match explanation \(read-only\): Current section visibility exactly matches the Default preset state\./);
    assert.match(html, /data-testid="history-section-visibility-comparison-baseline-label"/);
    assert.match(html, /Comparison baseline \(read-only\): Default preset/);
    assert.match(html, /data-testid="history-section-visibility-delta-summary"/);
    assert.match(html, /Visibility delta \(read-only\): Matches Default preset \(no visibility deltas\)/);
    assert.match(html, /data-testid="history-section-visibility-preset-description"/);
    assert.match(html, /Preset guide \(read-only\): Active Default \| Overview Preset focuses on broad history flow/);
    assert.match(html, /data-testid="history-section-hidden-sections-summary"/);
    assert.match(html, /Hidden sections \(read-only\): None \(all major history sections currently visible\)/);
    assert.match(html, /data-testid="history-section-visible-sections-summary"/);
    assert.match(html, /Visible sections \(read-only\): Controls, Summaries, Inspectors, Checkpoint Browser/);
    assert.match(html, /data-testid="history-section-visibility-state-consistency-note"/);
    assert.match(
      html,
      /Visibility consistency note \(read-only\): Visibility status, hidden\/visible summaries, preset interpretation, preset-match explanation, comparison baseline, and visibility delta all derive from the same active in-session section-visibility state\./,
    );
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
    assert.doesNotMatch(openedHtml, /Editor focus switched to src\/app\.ts using live workspace navigation\./);
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

describe('workspace shell snapshot surface', () => {
  test('renders project create/list/open surface', () => {
    const html = renderWorkspaceShell({
      workspaces: workspaceOptions,
      selectedWorkspaceId: 'workspace-1',
      onSelectWorkspaceId: () => {},
      workspaceProjects: [
        {
          id: 'project-1',
          userId: 'user-123',
          name: 'My Workspace Project',
          workspaceId: null,
          createdAt: '2026-04-04T10:00:00.000Z',
          updatedAt: '2026-04-04T10:00:00.000Z',
        },
      ],
      selectedProjectId: 'project-1',
      projectNameInput: 'Draft Project',
      projectListState: 'ready',
      projectActionState: 'idle',
      selectedProjectVisibility: 'private',
      onProjectNameInputChange: () => {},
      onSelectProjectId: () => {},
      onCreateWorkspaceProject: async () => {},
      onOpenWorkspaceProject: async () => {},
      onSelectedProjectVisibilityChange: () => {},
      onUpdateWorkspaceProjectVisibility: async () => {},
      publicProjectListState: 'ready',
      publicProjectActionState: 'idle',
      publicProjectActionMessage: null,
      publicProjectActionError: null,
      publicWorkspaceProjects: [
        {
          id: 'public-project-1',
          name: 'Shared Example',
          visibility: 'public',
          createdAt: '2026-04-04T10:00:00.000Z',
          updatedAt: '2026-04-04T10:00:00.000Z',
        },
      ],
      selectedPublicProjectId: 'public-project-1',
      selectedPublicProjectDetail: {
        id: 'public-project-1',
        name: 'Shared Example',
        visibility: 'public',
        createdAt: '2026-04-04T10:00:00.000Z',
        updatedAt: '2026-04-04T10:00:00.000Z',
        readOnly: true,
      },
      onSelectPublicProjectId: () => {},
      onViewPublicWorkspaceProject: async () => {},
      onForkPublicWorkspaceProject: async () => {},
      workspaceSnapshots: [],
      selectedSnapshotId: null,
      snapshotListState: 'ready',
      snapshotActionState: 'idle',
      onSelectSnapshotId: () => {},
      onSaveWorkspaceSnapshot: async () => {},
      onRestoreWorkspaceSnapshot: async () => {},
      onExportWorkspaceArchive: async () => {},
      onImportWorkspaceArchive: async () => {},
    });

    assert.match(html, /history-project-surface/);
    assert.match(html, /My Projects/);
    assert.match(html, /private by default/);
    assert.match(html, /Sharing \/ Visibility \(optional\)/);
    assert.match(html, /My Workspace Project/);
    assert.match(html, /Create Project/);
    assert.match(html, /Open Project/);
    assert.match(html, /Update Visibility/);
    assert.match(html, /Public Projects/);
    assert.match(html, /Read-only public view/);
    assert.match(html, /Fork/);
  });

  test('renders snapshot list options in history surface', () => {
    const html = renderWorkspaceShell({
      workspaceSnapshots: [
        {
          id: 'snapshot-1',
          userId: 'user-123',
          label: 'before changes',
          createdAt: '2026-04-03T10:00:00.000Z',
          fileCount: 2,
        },
      ],
      selectedSnapshotId: 'snapshot-1',
      snapshotListState: 'ready',
      snapshotActionState: 'idle',
      onSelectSnapshotId: () => {},
      onSaveWorkspaceSnapshot: async () => {},
      onRestoreWorkspaceSnapshot: async () => {},
      onExportWorkspaceArchive: async () => {},
      onImportWorkspaceArchive: async () => {},
    });

    assert.match(html, /history-snapshot-surface/);
    assert.match(html, /before changes/);
    assert.match(html, /Download Project/);
    assert.match(html, /Import Project/);
  });

  test('renders snapshot save\/restore loading states', () => {
    const html = renderWorkspaceShell({
      workspaceSnapshots: [],
      selectedSnapshotId: null,
      snapshotListState: 'loading',
      snapshotActionState: 'restoring',
      onSelectSnapshotId: () => {},
      onSaveWorkspaceSnapshot: async () => {},
      onRestoreWorkspaceSnapshot: async () => {},
      onExportWorkspaceArchive: async () => {},
      onImportWorkspaceArchive: async () => {},
    });

    assert.match(html, /Loading snapshots\.\.\./);
    assert.match(html, /Restoring\.\.\./);
  });
});

describe('workspace preview logic — UX-IA-15B helpers', () => {
  test('generatePickerScriptSource returns a non-empty string', () => {
    const source = generatePickerScriptSource();
    assert.ok(typeof source === 'string');
    assert.ok(source.length > 100);
  });

  test('generatePickerScriptSource contains picker script ID', () => {
    const source = generatePickerScriptSource();
    assert.ok(source.includes(getPickerScriptId()));
  });

  test('generatePickerScriptSource contains overlay ID', () => {
    const source = generatePickerScriptSource();
    assert.ok(source.includes(getPickerOverlayId()));
  });

  test('generatePickerScriptSource contains element-selected message type', () => {
    const source = generatePickerScriptSource();
    assert.ok(source.includes('visual-edit:element-selected'));
  });

  test('generatePickerScriptSource contains deactivate-picker listener', () => {
    const source = generatePickerScriptSource();
    assert.ok(source.includes('visual-edit:deactivate-picker'));
  });

  test('generatePickerScriptSource contains max text content length', () => {
    const source = generatePickerScriptSource();
    assert.ok(source.includes(String(getMaxTextContentLength())));
  });

  test('getPickerScriptId returns a stable value', () => {
    assert.strictEqual(getPickerScriptId(), getPickerScriptId());
    assert.ok(getPickerScriptId().length > 0);
  });

  test('getPickerOverlayId returns a stable value', () => {
    assert.strictEqual(getPickerOverlayId(), getPickerOverlayId());
    assert.ok(getPickerOverlayId().length > 0);
  });

  test('isVisualEditElementSelectedMessage accepts valid message', () => {
    const valid = {
      type: 'visual-edit:element-selected',
      payload: {
        tagName: 'div',
        selector: 'div.foo',
        textContent: 'hello',
        classList: ['foo'],
        boundingBox: { x: 0, y: 0, width: 100, height: 50 },
        id: null,
      },
    };
    assert.strictEqual(isVisualEditElementSelectedMessage(valid), true);
  });

  test('isVisualEditElementSelectedMessage rejects wrong type', () => {
    assert.strictEqual(isVisualEditElementSelectedMessage({ type: 'other' }), false);
  });

  test('isVisualEditElementSelectedMessage rejects null', () => {
    assert.strictEqual(isVisualEditElementSelectedMessage(null), false);
  });

  test('isVisualEditElementSelectedMessage rejects missing payload', () => {
    assert.strictEqual(
      isVisualEditElementSelectedMessage({ type: 'visual-edit:element-selected' }),
      false,
    );
  });

  test('isVisualEditElementSelectedMessage rejects incomplete payload', () => {
    assert.strictEqual(
      isVisualEditElementSelectedMessage({
        type: 'visual-edit:element-selected',
        payload: { tagName: 'div' },
      }),
      false,
    );
  });

  test('isValidVisualEditMessageOriginAndSource rejects mismatched origin', () => {
    assert.strictEqual(
      isValidVisualEditMessageOriginAndSource({
        expectedOrigin: 'http://localhost:3000',
        messageOrigin: 'http://evil.com',
        expectedSource: {} as MessageEventSource,
        messageSource: {} as MessageEventSource,
      }),
      false,
    );
  });

  test('isValidVisualEditMessageOriginAndSource rejects null expected origin', () => {
    assert.strictEqual(
      isValidVisualEditMessageOriginAndSource({
        expectedOrigin: null,
        messageOrigin: 'http://localhost:3000',
        expectedSource: {} as MessageEventSource,
        messageSource: {} as MessageEventSource,
      }),
      false,
    );
  });

  test('isValidVisualEditMessageOriginAndSource rejects null message source', () => {
    const source = {} as MessageEventSource;
    assert.strictEqual(
      isValidVisualEditMessageOriginAndSource({
        expectedOrigin: 'http://localhost:3000',
        messageOrigin: 'http://localhost:3000',
        expectedSource: source,
        messageSource: null,
      }),
      false,
    );
  });

  test('isValidVisualEditMessageOriginAndSource accepts matching origin and source', () => {
    const source = {} as MessageEventSource;
    assert.strictEqual(
      isValidVisualEditMessageOriginAndSource({
        expectedOrigin: 'http://localhost:3000',
        messageOrigin: 'http://localhost:3000',
        expectedSource: source,
        messageSource: source,
      }),
      true,
    );
  });
});

describe('workspace prompt context — UX-IA-15C helpers', () => {
  const selectedPreviewElement: SelectedPreviewElement = {
    tagName: 'button',
    selector: '#submit-button',
    textContent: 'Submit',
    classList: ['btn', 'primary'],
    boundingBox: { x: 10, y: 20, width: 120, height: 40 },
    id: 'submit-button',
  };

  test('buildWorkspacePromptContext wiring includes selectedPreviewElement', () => {
    const pageSource = readFileSync(
      new URL('../../app/[locale]/app/page.tsx', import.meta.url),
      'utf8',
    );

    assert.match(pageSource, /selectedPreviewElement\?: SelectedPreviewElement \| null;/);
    assert.match(
      pageSource,
      /\.\.\.\(args\.selectedPreviewElement \? \{ selectedPreviewElement: args\.selectedPreviewElement \} : \{\}\),/,
    );
  });

  test('tracks visual-edit execution ids in both submit paths and clears them on reset', () => {
    const pageSource = readFileSync(
      new URL('../../app/[locale]/app/page.tsx', import.meta.url),
      'utf8',
    );

    assert.match(pageSource, /const visualEditExecutionIdsRef = useRef<Set<string>>\(new Set\(\)\);/);
    assert.match(pageSource, /if \(input\.isVisualEditPrompt\) \{\s+visualEditExecutionIdsRef\.current\.add\(executionId\);/);
    assert.match(pageSource, /if \(isVisualEditPrompt && nextExecutionId\) \{\s+visualEditExecutionIdsRef\.current\.add\(nextExecutionId\);/);
    assert.match(pageSource, /visualEditExecutionIdsRef\.current = new Set<string>\(\);/);
  });

  test('forces awaiting confirmation for visual-edit execution file actions', () => {
    const pageSource = readFileSync(
      new URL('../../app/[locale]/app/page.tsx', import.meta.url),
      'utf8',
    );

    assert.match(pageSource, /if \(visualEditExecutionIdsRef\.current\.has\(executionId\)\) \{/);
    assert.match(pageSource, /pendingConfirmationExecutionIdsRef\.current\.add\(executionId\);/);
    assert.match(pageSource, /applyStatus: 'awaiting-confirmation'/);
    assert.match(pageSource, /confirmationRequired: true/);
  });

  test('buildPromptWithSelectedPreviewElement prefixes prompt metadata when element exists', () => {
    const prompt = buildPromptWithSelectedPreviewElement(
      'Make the button more rounded',
      selectedPreviewElement,
    );

    assert.match(prompt, /\[Selected preview element\]/);
    assert.match(prompt, /Tag: button/);
    assert.match(prompt, /Selector: #submit-button/);
    assert.match(prompt, /Text: Submit/);
    assert.match(prompt, /Classes: btn primary/);
    assert.match(prompt, /Bounds: x=10, y=20, width=120, height=40/);
    assert.match(prompt, /\[Visual Edit Mode Contract\]/);
    assert.match(prompt, /User is in Visual Edit Mode\./);
    assert.match(prompt, /Treat the selected preview element as the target of the requested change\./);
    assert.match(
      prompt,
      /Identify the source file responsible for rendering or styling the selected element before proposing edits\./,
    );
    assert.match(prompt, /Propose focused file-actions only for files directly required to satisfy this request\./);
    assert.match(prompt, /Follow the existing file-action output contract exactly\./);
    assert.match(prompt, /User request:\nMake the button more rounded/);
  });

  test('buildPromptWithSelectedPreviewElement keeps prompt unchanged when no element exists', () => {
    const originalPrompt = 'Refactor this form layout.';
    const prompt = buildPromptWithSelectedPreviewElement(originalPrompt, null);
    assert.strictEqual(prompt, originalPrompt);
  });
});

describe('workspace visual edit diff preview wiring — UX-IA-16B', () => {
  test('renders diff preview for visual-edit update action', () => {
    const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
    assert.match(shellSource, /workspace-chat-file-actions-diff-update/);
    assert.match(shellSource, /const updateDiff = computeLineDiff\(currentFile\.content, action\.content\);/);
  });

  test('renders create diff marker', () => {
    const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
    assert.match(shellSource, /workspace-chat-file-actions-diff-create/);
    assert.match(shellSource, /const createDiff = computeLineDiff\('', action\.content\);/);
  });

  test('renders delete diff marker', () => {
    const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
    assert.match(shellSource, /workspace-chat-file-actions-diff-delete/);
    assert.match(shellSource, /\[file will be deleted\]/);
  });

  test('renders diff error state gracefully when file read fails', () => {
    const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
    assert.match(shellSource, /Promise\.allSettled/);
    assert.match(shellSource, /setDiffState\(hasRejectedResult \? 'error' : 'ready'\);/);
    assert.match(shellSource, /workspace-chat-file-actions-diff-error/);
  });
});

describe('workspace history revert button styling — UX-IA-19', () => {
  test('workspace shell source applies distinct danger classes to revert action button', () => {
    const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
    assert.match(
      shellSource,
      /data-testid=\{`history-revert-button-\$\{checkpoint\.id\}`\}[\s\S]*?className="rounded border border-red-300 bg-red-50 px-3 py-1 text-xs text-red-700 hover:bg-red-100 disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"/,
    );
  });
});

describe('workspace state-message/loading polish — UX-IA-20', () => {
  test('workspace shell source renders compact success state message with inline indicator', () => {
    const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
    assert.match(shellSource, /const isSuccessTone = props\.tone === 'success';/);
    assert.match(shellSource, /const containerClassName = isSuccessTone[\s\S]*?px-2 py-1\.5 text-xs/);
    assert.match(shellSource, /<span aria-hidden="true" className="h-1\.5 w-1\.5 rounded-full bg-green-500" \/>/);
    assert.match(shellSource, /\{!isSuccessTone \? <p className="mt-1 text-xs opacity-90">Action: \{props\.action\}<\/p> : null\}/);
  });

  test('non-success state messages keep action copy visible', () => {
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

    assert.match(html, /Action: Refresh this page to retry\./);
  });

  test('loading list rows keep existing test ids and add pulse affordance', () => {
    const html = renderWorkspaceShell({
      ...projectPanelRenderOverrides,
      projectListState: 'loading',
      publicProjectListState: 'loading',
      snapshotListState: 'loading',
    });

    assert.match(html, /history-project-list-loading/);
    assert.match(html, /history-public-project-list-loading/);
    assert.match(html, /history-snapshot-list-loading/);
    assert.match(html, /Loading projects\.\.\./);
    assert.match(html, /Loading public projects\.\.\./);
    assert.match(html, /Loading snapshots\.\.\./);
    assert.match(html, /animate-pulse/);
  });

  test('workspace shell source applies pulse indicator in targeted loading rows', () => {
    const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
    assert.match(shellSource, /data-testid="history-project-list-loading"[\s\S]*?animate-pulse/);
    assert.match(shellSource, /data-testid="history-public-project-list-loading"[\s\S]*?animate-pulse/);
    assert.match(shellSource, /data-testid="history-snapshot-list-loading"[\s\S]*?animate-pulse/);
  });
});

describe('workspace visual edit i18n wiring — I18N-SHELL-01', () => {
  test('workspace shell source defines getAiMessages helper following locale-switch pattern', () => {
    const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
    assert.match(shellSource, /function getAiMessages\(locale: string\): typeof enMessages\.ai \{/);
    assert.match(shellSource, /if \(locale === 'zh-TW'\) return zhTwMessages\.ai;/);
    assert.match(shellSource, /if \(locale === 'zh-CN'\) return zhCnMessages\.ai;/);
    assert.match(shellSource, /return enMessages\.ai;/);
  });

  test('locale files define required ai keys for visual-edit file-action copy', () => {
    const en = JSON.parse(readFileSync(new URL('../../messages/en.json', import.meta.url), 'utf8'));
    const zhTw = JSON.parse(readFileSync(new URL('../../messages/zh-TW.json', import.meta.url), 'utf8'));
    const zhCn = JSON.parse(readFileSync(new URL('../../messages/zh-CN.json', import.meta.url), 'utf8'));
    const requiredAiKeys = [
      'fileActionResults',
      'visualEditAttribution',
      'diffPreviewLoading',
      'diffPreviewUnavailable',
      'undoRevert',
      'apply',
    ] as const;

    for (const key of requiredAiKeys) {
      assert.ok(typeof en.ai?.[key] === 'string' && en.ai[key].length > 0);
      assert.ok(typeof zhTw.ai?.[key] === 'string' && zhTw.ai[key].length > 0);
      assert.ok(typeof zhCn.ai?.[key] === 'string' && zhCn.ai[key].length > 0);
    }

    assert.ok(typeof en.common?.cancel === 'string' && en.common.cancel.length > 0);
    assert.ok(typeof zhTw.common?.cancel === 'string' && zhTw.common.cancel.length > 0);
    assert.ok(typeof zhCn.common?.cancel === 'string' && zhCn.common.cancel.length > 0);
  });

  test('workspace shell source removes targeted hardcoded English visual-edit strings', () => {
    const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(shellSource, /File Action Results/);
    assert.doesNotMatch(shellSource, /Source: Visual Edit mode selection\./);
    assert.doesNotMatch(shellSource, /Loading diff preview\.\.\./);
    assert.doesNotMatch(
      shellSource,
      /Diff preview unavailable for one or more files\. You can still apply or cancel\./,
    );
    assert.doesNotMatch(shellSource, /Undo \/ Revert/);
  });

  test('workspace shell file-action UI uses ai/common message values for target labels', () => {
    const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
    assert.match(shellSource, /\{props\.aiMessages\.fileActionResults\}/);
    assert.match(shellSource, /\{props\.aiMessages\.visualEditAttribution\}/);
    assert.match(shellSource, /\{props\.aiMessages\.diffPreviewLoading\}/);
    assert.match(shellSource, /\{props\.aiMessages\.diffPreviewUnavailable\}/);
    assert.match(shellSource, /\{props\.aiMessages\.undoRevert\}/);
    assert.match(shellSource, /\{props\.aiMessages\.apply\}/);
    assert.match(shellSource, /\{props\.commonMessages\.cancel\}/);
  });
});

describe('workspace core chat panel i18n wiring — I18N-SHELL-02', () => {
  test('locale files define required ai/common keys for core chat panel copy', () => {
    const en = JSON.parse(readFileSync(new URL('../../messages/en.json', import.meta.url), 'utf8'));
    const zhTw = JSON.parse(readFileSync(new URL('../../messages/zh-TW.json', import.meta.url), 'utf8'));
    const zhCn = JSON.parse(readFileSync(new URL('../../messages/zh-CN.json', import.meta.url), 'utf8'));
    const requiredAiKeys = [
      'promptLabel',
      'modelProviderLabel',
      'orchestrationLabel',
      'messageThread',
      'emptyNoSession',
      'emptyWithSession',
      'emptyAuthSuggestion',
      'roleUser',
      'roleAssistant',
      'roleSystem',
      'waitingForResponse',
      'sending',
    ] as const;

    for (const key of requiredAiKeys) {
      assert.ok(typeof en.ai?.[key] === 'string' && en.ai[key].length > 0);
      assert.ok(typeof zhTw.ai?.[key] === 'string' && zhTw.ai[key].length > 0);
      assert.ok(typeof zhCn.ai?.[key] === 'string' && zhCn.ai[key].length > 0);
    }

    assert.ok(typeof en.common?.send === 'string' && en.common.send.length > 0);
    assert.ok(typeof zhTw.common?.send === 'string' && zhTw.common.send.length > 0);
    assert.ok(typeof zhCn.common?.send === 'string' && zhCn.common.send.length > 0);
  });

  test('workspace shell source removes targeted hardcoded English core chat-panel strings', () => {
    const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(shellSource, /AI Prompt/);
    assert.doesNotMatch(shellSource, /Model Provider/);
    assert.doesNotMatch(shellSource, /Enable bounded orchestration \(up to 3 sequential steps\)/);
    assert.doesNotMatch(shellSource, /Message Thread/);
    assert.doesNotMatch(shellSource, /No messages yet\./);
    assert.doesNotMatch(shellSource, /Open a project to start chatting\./);
    assert.doesNotMatch(shellSource, /Describe what you want to build, or ask for help with your project\./);
    assert.doesNotMatch(shellSource, /Try: add authentication to my app/);
    assert.doesNotMatch(shellSource, /\(waiting for response\.\.\.\)/);
    assert.doesNotMatch(shellSource, /\? 'User' : 'Assistant'/);
    assert.doesNotMatch(shellSource, /\{isSending \? 'Sending\.\.\.' : 'Send'\}/);
  });

  test('workspace chat panel uses ai/common message values for targeted labels and states', () => {
    const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
    assert.match(shellSource, /aiMessages=\{aiMessages\}/);
    assert.match(shellSource, /commonMessages=\{commonMessages\}/);
    assert.match(shellSource, /\{props\.aiMessages\.promptLabel\}/);
    assert.match(shellSource, /\{props\.aiMessages\.modelProviderLabel\}/);
    assert.match(shellSource, /\{props\.aiMessages\.orchestrationLabel\}/);
    assert.match(shellSource, /\{isSending \? props\.aiMessages\.sending : props\.commonMessages\.send\}/);
    assert.match(shellSource, /\{props\.aiMessages\.messageThread\}/);
    assert.match(
      shellSource,
      /\{\s*props\.selectedSessionId\s*\?\s*props\.aiMessages\.emptyWithSession\s*:\s*props\.aiMessages\.emptyNoSession\s*\}/,
    );
    assert.match(shellSource, /\{props\.aiMessages\.emptyAuthSuggestion\}/);
    assert.match(shellSource, /\? props\.aiMessages\.waitingForResponse/);
    assert.match(shellSource, /message\.messageKind === 'system'/);
    assert.match(shellSource, /props\.aiMessages\.roleSystem/);
    assert.match(shellSource, /messageKind\?: 'ai' \| 'system';/);
  });

  test('renders no-session empty-state guidance and hides auth suggestion', () => {
    const html = renderWorkspaceShell({
      selectedSessionId: null,
      chatThreadMessages: [],
    });

    assert.match(html, /workspace-chat-empty-state/);
    assert.match(html, /workspace-chat-empty-no-session/);
    assert.match(html, /Open a project to start chatting\./);
    assert.doesNotMatch(html, /workspace-chat-empty-auth-suggestion/);
  });

  test('renders active-session empty-state guidance with auth suggestion', () => {
    const html = renderWorkspaceShell({
      selectedSessionId: session.id,
      chatThreadMessages: [],
    });

    assert.match(html, /workspace-chat-empty-state/);
    assert.match(html, /workspace-chat-empty-active-session/);
    assert.match(html, /Describe what you want to build, or ask for help with your project\./);
    assert.match(html, /workspace-chat-empty-auth-suggestion/);
    assert.match(html, /Try: add authentication to my app/);
  });

  test('renders assistant system-kind messages with system label and subtle marker', () => {
    const html = renderWorkspaceShell({
      chatThreadMessages: [
        {
          id: 'system-msg-1',
          role: 'assistant',
          content: 'Installing auth module — preparing your workspace...',
          messageKind: 'system',
        },
      ],
    });

    assert.match(html, /workspace-chat-message-assistant-system-msg-1/);
    assert.match(html, /data-message-kind="system"/);
    assert.match(html, />System</);
  });
});

describe('workspace session and preview controls i18n wiring — I18N-SHELL-03', () => {
  test('locale files define required workspace/preview/common keys for session and preview controls', () => {
    const en = JSON.parse(readFileSync(new URL('../../messages/en.json', import.meta.url), 'utf8'));
    const zhTw = JSON.parse(readFileSync(new URL('../../messages/zh-TW.json', import.meta.url), 'utf8'));
    const zhCn = JSON.parse(readFileSync(new URL('../../messages/zh-CN.json', import.meta.url), 'utf8'));
    const requiredWorkspaceKeys = [
      'noSessionSelected',
      'newSession',
      'creatingSession',
      'stopSessionConfirm',
    ] as const;
    const requiredPreviewKeys = ['livePreview', 'startPreview'] as const;
    const requiredCommonKeys = ['refresh', 'refreshing'] as const;

    for (const key of requiredWorkspaceKeys) {
      assert.ok(typeof en.workspace?.[key] === 'string' && en.workspace[key].length > 0);
      assert.ok(typeof zhTw.workspace?.[key] === 'string' && zhTw.workspace[key].length > 0);
      assert.ok(typeof zhCn.workspace?.[key] === 'string' && zhCn.workspace[key].length > 0);
    }

    for (const key of requiredPreviewKeys) {
      assert.ok(typeof en.preview?.[key] === 'string' && en.preview[key].length > 0);
      assert.ok(typeof zhTw.preview?.[key] === 'string' && zhTw.preview[key].length > 0);
      assert.ok(typeof zhCn.preview?.[key] === 'string' && zhCn.preview[key].length > 0);
    }

    for (const key of requiredCommonKeys) {
      assert.ok(typeof en.common?.[key] === 'string' && en.common[key].length > 0);
      assert.ok(typeof zhTw.common?.[key] === 'string' && zhTw.common[key].length > 0);
      assert.ok(typeof zhCn.common?.[key] === 'string' && zhCn.common[key].length > 0);
    }
  });

  test('workspace shell source removes targeted hardcoded English in session/preview control areas', () => {
    const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(shellSource, /\{props\.sessionId \?\? 'No session selected'\}/);
    assert.doesNotMatch(shellSource, /\{props\.isCreatingSession \? 'Creating\.\.\.' : 'New Session'\}/);
    assert.doesNotMatch(
      shellSource,
      /window\.confirm\(\s*'Stop this session\? Unsaved running work in this session may be interrupted\.'/,
    );
    assert.doesNotMatch(shellSource, /<p className="text-xs font-semibold text-gray-700">Live Preview<\/p>/);
    assert.doesNotMatch(shellSource, />\s*Start Preview\s*<\/button>/);
    assert.doesNotMatch(shellSource, /\{props\.previewState === 'loading' \? 'Refreshing\.\.\.' : 'Refresh'\}/);
  });

  test('session and preview controls use locale message values', () => {
    const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
    assert.match(shellSource, /function getWorkspaceMessages\(locale: string\): typeof enMessages\.workspace \{/);
    assert.match(shellSource, /function getPreviewMessages\(locale: string\): typeof enMessages\.preview \{/);
    assert.match(
      shellSource,
      /const workspaceMessages = React\.useMemo\(\(\) => getWorkspaceMessages\(locale\), \[locale\]\);/,
    );
    assert.match(
      shellSource,
      /const previewMessages = React\.useMemo\(\(\) => getPreviewMessages\(locale\), \[locale\]\);/,
    );
    assert.match(shellSource, /workspaceMessages=\{workspaceMessages\}/);
    assert.match(shellSource, /previewMessages=\{previewMessages\}/);
    assert.match(shellSource, /\{props\.sessionId \?\? props\.workspaceMessages\.noSessionSelected\}/);
    assert.match(
      shellSource,
      /\{props\.isCreatingSession\s*\?\s*workspaceMessages\.creatingSession\s*:\s*workspaceMessages\.newSession\}/,
    );
    assert.match(shellSource, /window\.confirm\(workspaceMessages\.stopSessionConfirm\)/);
    assert.match(shellSource, /\{props\.previewMessages\.livePreview\}/);
    assert.match(shellSource, /\{props\.previewMessages\.startPreview\}/);
    assert.match(
      shellSource,
      /\{props\.previewState === 'loading'\s*\?\s*props\.commonMessages\.refreshing\s*:\s*props\.commonMessages\.refresh\}/,
    );
  });
});

describe('workspace/project modal action button labels i18n wiring — I18N-SHELL-04', () => {
  test('locale files define required workspace/project/common keys for workspace project panel actions', () => {
    const en = JSON.parse(readFileSync(new URL('../../messages/en.json', import.meta.url), 'utf8'));
    const zhTw = JSON.parse(readFileSync(new URL('../../messages/zh-TW.json', import.meta.url), 'utf8'));
    const zhCn = JSON.parse(readFileSync(new URL('../../messages/zh-CN.json', import.meta.url), 'utf8'));
    const requiredWorkspaceKeys = [
      'selectWorkspace',
      'newWorkspaceName',
      'createWorkspace',
      'renameSelectedWorkspace',
      'renameWorkspace',
      'deleteWorkspace',
      'selectTargetWorkspace',
      'noOtherWorkspaces',
      'moveToWorkspace',
    ] as const;
    const requiredProjectKeys = [
      'newProjectName',
      'createProject',
      'selectProject',
      'openProject',
      'sharingVisibilityOptional',
      'view',
      'fork',
      'saveSnapshot',
      'restoreSnapshot',
      'downloadProject',
      'importProject',
    ] as const;
    const requiredCommonKeys = [
      'creating',
      'renaming',
      'deleting',
      'opening',
      'moving',
      'loading',
      'forking',
      'saving',
      'restoring',
      'exporting',
      'importing',
    ] as const;

    for (const key of requiredWorkspaceKeys) {
      assert.ok(typeof en.workspace?.[key] === 'string' && en.workspace[key].length > 0);
      assert.ok(typeof zhTw.workspace?.[key] === 'string' && zhTw.workspace[key].length > 0);
      assert.ok(typeof zhCn.workspace?.[key] === 'string' && zhCn.workspace[key].length > 0);
    }

    for (const key of requiredProjectKeys) {
      assert.ok(typeof en.project?.[key] === 'string' && en.project[key].length > 0);
      assert.ok(typeof zhTw.project?.[key] === 'string' && zhTw.project[key].length > 0);
      assert.ok(typeof zhCn.project?.[key] === 'string' && zhCn.project[key].length > 0);
    }

    for (const key of requiredCommonKeys) {
      assert.ok(typeof en.common?.[key] === 'string' && en.common[key].length > 0);
      assert.ok(typeof zhTw.common?.[key] === 'string' && zhTw.common[key].length > 0);
      assert.ok(typeof zhCn.common?.[key] === 'string' && zhCn.common[key].length > 0);
    }
  });

  test('workspace shell source removes targeted hardcoded English in workspace project panel action areas', () => {
    const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(
      shellSource,
      /\{props\.workspaceActionState === 'creating' \? 'Creating\.\.\.' : 'Create Workspace'\}/,
    );
    assert.doesNotMatch(
      shellSource,
      /\{props\.workspaceActionState === 'renaming' \? 'Renaming\.\.\.' : 'Rename Workspace'\}/,
    );
    assert.doesNotMatch(
      shellSource,
      /\{props\.workspaceActionState === 'deleting' \? 'Deleting\.\.\.' : 'Delete Workspace'\}/,
    );
    assert.doesNotMatch(
      shellSource,
      /\{props\.actionState === 'creating' \? 'Creating\.\.\.' : 'Create Project'\}/,
    );
    assert.doesNotMatch(shellSource, /<option value="">Select a project<\/option>/);
    assert.doesNotMatch(shellSource, /\{props\.actionState === 'opening' \? 'Opening\.\.\.' : 'Open Project'\}/);
    assert.doesNotMatch(shellSource, /\? 'Select target workspace' : 'No other workspaces available'/);
    assert.doesNotMatch(shellSource, /\{props\.actionState === 'moving' \? 'Moving\.\.\.' : 'Move to Workspace'\}/);
    assert.doesNotMatch(shellSource, /<p className="text-xs font-semibold text-gray-700">Sharing \/ Visibility \(optional\)<\/p>/);
    assert.doesNotMatch(
      shellSource,
      /\{props\.publicProjectActionState === 'viewing' \? 'Loading\.\.\.' : 'View'\}/,
    );
    assert.doesNotMatch(
      shellSource,
      /\{props\.publicProjectActionState === 'forking' \? 'Forking\.\.\.' : 'Fork'\}/,
    );
    assert.doesNotMatch(shellSource, /\{props\.actionState === 'saving' \? 'Saving\.\.\.' : 'Save Snapshot'\}/);
    assert.doesNotMatch(
      shellSource,
      /\{props\.actionState === 'restoring' \? 'Restoring\.\.\.' : 'Restore Snapshot'\}/,
    );
    assert.doesNotMatch(
      shellSource,
      /\{props\.actionState === 'exporting' \? 'Exporting\.\.\.' : 'Download Project'\}/,
    );
    assert.doesNotMatch(
      shellSource,
      /\{props\.actionState === 'importing' \? 'Importing\.\.\.' : 'Import Project'\}/,
    );
  });

  test('workspace project panel and snapshot actions use locale-backed message values', () => {
    const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
    assert.match(shellSource, /workspaceMessages=\{workspaceMessages\}/);
    assert.match(shellSource, /projectMessages=\{projectPanelMessages\}/);
    assert.match(shellSource, /commonMessages=\{commonMessages\}/);
    assert.match(shellSource, /\{props\.workspaceMessages\.selectWorkspace\}/);
    assert.match(shellSource, /placeholder=\{props\.workspaceMessages\.newWorkspaceName\}/);
    assert.match(shellSource, /placeholder=\{props\.workspaceMessages\.renameSelectedWorkspace\}/);
    assert.match(shellSource, /placeholder=\{props\.projectMessages\.newProjectName\}/);
    assert.match(shellSource, /<option value="">\{props\.projectMessages\.selectProject\}<\/option>/);
    assert.match(shellSource, /\?\s*props\.workspaceMessages\.selectTargetWorkspace/);
    assert.match(shellSource, /:\s*props\.workspaceMessages\.noOtherWorkspaces/);
    assert.match(shellSource, /\{props\.projectMessages\.sharingVisibilityOptional\}/);
    assert.match(
      shellSource,
      /\{props\.workspaceActionState === 'creating'\s*\?\s*props\.commonMessages\.creating\s*:\s*props\.workspaceMessages\.createWorkspace\}/,
    );
    assert.match(
      shellSource,
      /\{props\.workspaceActionState === 'renaming'\s*\?\s*props\.commonMessages\.renaming\s*:\s*props\.workspaceMessages\.renameWorkspace\}/,
    );
    assert.match(
      shellSource,
      /\{props\.workspaceActionState === 'deleting'\s*\?\s*props\.commonMessages\.deleting\s*:\s*props\.workspaceMessages\.deleteWorkspace\}/,
    );
    assert.match(
      shellSource,
      /\{props\.actionState === 'creating'\s*\?\s*props\.commonMessages\.creating\s*:\s*props\.projectMessages\.createProject\}/,
    );
    assert.match(
      shellSource,
      /\{props\.actionState === 'opening'\s*\?\s*props\.commonMessages\.opening\s*:\s*props\.projectMessages\.openProject\}/,
    );
    assert.match(
      shellSource,
      /\{props\.actionState === 'moving'\s*\?\s*props\.commonMessages\.moving\s*:\s*props\.workspaceMessages\.moveToWorkspace\}/,
    );
    assert.match(
      shellSource,
      /\{props\.publicProjectActionState === 'viewing'\s*\?\s*props\.commonMessages\.loading\s*:\s*props\.projectMessages\.view\}/,
    );
    assert.match(
      shellSource,
      /\{props\.publicProjectActionState === 'forking'\s*\?\s*props\.commonMessages\.forking\s*:\s*props\.projectMessages\.fork\}/,
    );
    assert.match(
      shellSource,
      /\{props\.actionState === 'saving'\s*\?\s*props\.commonMessages\.saving\s*:\s*props\.projectMessages\.saveSnapshot\}/,
    );
    assert.match(
      shellSource,
      /\{props\.actionState === 'restoring'\s*\?\s*props\.commonMessages\.restoring\s*:\s*props\.projectMessages\.restoreSnapshot\}/,
    );
    assert.match(
      shellSource,
      /\{props\.actionState === 'exporting'\s*\?\s*props\.commonMessages\.exporting\s*:\s*props\.projectMessages\.downloadProject\}/,
    );
    assert.match(
      shellSource,
      /\{props\.actionState === 'importing'\s*\?\s*props\.commonMessages\.importing\s*:\s*props\.projectMessages\.importProject\}/,
    );
  });

  test('workspace project panel keeps existing target data-testid values', () => {
    const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
    const expectedTestIds = [
      'history-workspace-select',
      'history-workspace-create-input',
      'history-workspace-create-button',
      'history-workspace-rename-input',
      'history-workspace-rename-button',
      'history-workspace-delete-button',
      'history-project-name-input',
      'history-project-create-button',
      'history-project-select',
      'history-project-open-button',
      'history-project-move-workspace-select',
      'history-project-move-button',
      'history-project-sharing-surface',
      'history-public-project-view-button',
      'history-public-project-fork-button',
      'history-snapshot-save-button',
      'history-snapshot-restore-button',
      'history-archive-export-button',
      'history-archive-import-label',
      'history-archive-import-input',
    ] as const;

    for (const testId of expectedTestIds) {
      assert.match(shellSource, new RegExp(`data-testid="${testId}"`));
    }
  });
});

describe('recovery copy locale migration wiring — I18N-SHELL-05', () => {
  test('locale files define required recovery keys', () => {
    const en = JSON.parse(readFileSync(new URL('../../messages/en.json', import.meta.url), 'utf8'));
    const zhTw = JSON.parse(readFileSync(new URL('../../messages/zh-TW.json', import.meta.url), 'utf8'));
    const zhCn = JSON.parse(readFileSync(new URL('../../messages/zh-CN.json', import.meta.url), 'utf8'));
    const requiredActionKeys = [
      'saveNamedSnapshot',
      'startNewProject',
      'openExistingProject',
      'reopenProject',
      'resumeLatestProject',
      'restoreSnapshot',
      'tryAgain',
      'openOlderVersion',
    ] as const;
    const requiredStatusKeys = [
      'workspaceDisconnected',
      'workspaceStoppedDueToInactivity',
      'workspaceFailedToStart',
      'workspaceWasRestarted',
      'saving',
      'allChangesSaved',
      'yourWorkIsSaved',
      'saveFailedRetry',
    ] as const;
    const requiredDetailKeys = [
      'workspaceExpired',
      'reconnectByReopening',
      'inactivityRecovery',
      'failedToStartRecovery',
    ] as const;
    const requiredWorkspaceKeys = [
      'trustNote',
      'loading',
      'unavailable',
      'versionsEntryPoint',
      'lastProtected',
      'noProjectHistoryYet',
      'restoreSnapshotConfirm',
      'saveNamedSnapshotPrompt',
      'openProjectToStart',
      'ready',
      'help',
      'chatReady',
      'openProjectToSendPrompts',
      'buildReady',
      'openProjectToRunBuild',
      'filesLoading',
      'noFilesAvailable',
      'filesReady',
      'previewLoading',
      'previewReady',
      'previewUnavailable',
      'previewError',
      'openProjectToCreateSavePoint',
      'openProjectToCompareHistory',
      'openProjectToInspectDiffs',
      'openProjectToInspectSnapshots',
      'openProjectToOpenLiveFile',
      'openProjectToEnableRevert',
      'openOrReopenProject',
    ] as const;
    const requiredAutomaticVersionLabels = ['ai', 'file-save', 'preview', 'expiry', 'initial'] as const;

    for (const key of requiredActionKeys) {
      assert.ok(typeof en.recovery?.actions?.[key] === 'string' && en.recovery.actions[key].length > 0);
      assert.ok(typeof zhTw.recovery?.actions?.[key] === 'string' && zhTw.recovery.actions[key].length > 0);
      assert.ok(typeof zhCn.recovery?.actions?.[key] === 'string' && zhCn.recovery.actions[key].length > 0);
    }

    for (const key of requiredStatusKeys) {
      assert.ok(typeof en.recovery?.status?.[key] === 'string' && en.recovery.status[key].length > 0);
      assert.ok(typeof zhTw.recovery?.status?.[key] === 'string' && zhTw.recovery.status[key].length > 0);
      assert.ok(typeof zhCn.recovery?.status?.[key] === 'string' && zhCn.recovery.status[key].length > 0);
    }

    for (const key of requiredDetailKeys) {
      assert.ok(typeof en.recovery?.detail?.[key] === 'string' && en.recovery.detail[key].length > 0);
      assert.ok(typeof zhTw.recovery?.detail?.[key] === 'string' && zhTw.recovery.detail[key].length > 0);
      assert.ok(typeof zhCn.recovery?.detail?.[key] === 'string' && zhCn.recovery.detail[key].length > 0);
    }

    for (const key of requiredWorkspaceKeys) {
      assert.ok(typeof en.recovery?.workspace?.[key] === 'string' && en.recovery.workspace[key].length > 0);
      assert.ok(typeof zhTw.recovery?.workspace?.[key] === 'string' && zhTw.recovery.workspace[key].length > 0);
      assert.ok(typeof zhCn.recovery?.workspace?.[key] === 'string' && zhCn.recovery.workspace[key].length > 0);
    }

    for (const key of requiredAutomaticVersionLabels) {
      assert.ok(
        typeof en.recovery?.workspace?.automaticVersionLabels?.[key] === 'string' &&
          en.recovery.workspace.automaticVersionLabels[key].length > 0,
      );
      assert.ok(
        typeof zhTw.recovery?.workspace?.automaticVersionLabels?.[key] === 'string' &&
          zhTw.recovery.workspace.automaticVersionLabels[key].length > 0,
      );
      assert.ok(
        typeof zhCn.recovery?.workspace?.automaticVersionLabels?.[key] === 'string' &&
          zhCn.recovery.workspace.automaticVersionLabels[key].length > 0,
      );
    }
  });

  test('recovery-copy source imports all locale files and exports getRecoveryCopy(locale)', () => {
    const recoveryCopySource = readFileSync(new URL('../../lib/recovery-copy.ts', import.meta.url), 'utf8');
    assert.match(recoveryCopySource, /import enMessages from '@\/messages\/en\.json';/);
    assert.match(recoveryCopySource, /import zhTwMessages from '@\/messages\/zh-TW\.json';/);
    assert.match(recoveryCopySource, /import zhCnMessages from '@\/messages\/zh-CN\.json';/);
    assert.match(
      recoveryCopySource,
      /export function getRecoveryCopy\(locale: string\): typeof enMessages\.recovery \{/,
    );
    assert.match(recoveryCopySource, /if \(locale === 'zh-TW'\) return zhTwMessages\.recovery;/);
    assert.match(recoveryCopySource, /if \(locale === 'zh-CN'\) return zhCnMessages\.recovery;/);
    assert.match(recoveryCopySource, /return enMessages\.recovery;/);
  });

  test('workspace shell source wires locale-backed recovery copy and removes direct english import path', () => {
    const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
    assert.match(shellSource, /import \{ getRecoveryCopy \} from '@\/lib\/recovery-copy';/);
    assert.doesNotMatch(shellSource, /import \{ recoveryCopy \} from '@\/lib\/recovery-copy';/);
    assert.match(
      shellSource,
      /const recoveryMessages = React\.useMemo\(\(\) => getRecoveryCopy\(locale\), \[locale\]\);/,
    );
    assert.match(shellSource, /recoveryCopy = recoveryMessages;/);
    assert.match(
      shellSource,
      /computeProjectHistoryRows\(\s*props\.workspaceSnapshots \?\? \[\],\s*props\.selectedProjectId,\s*recoveryMessages,\s*\)/,
    );
  });

  test('workspace shell confirm/prompt and render paths use locale-backed recovery copy', () => {
    const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
    assert.match(shellSource, /window\.confirm\(recoveryCopy\.workspace\.restoreSnapshotConfirm\)/);
    assert.match(shellSource, /window\.prompt\(\s*recoveryCopy\.workspace\.saveNamedSnapshotPrompt,/);
    assert.match(shellSource, /\{recoveryCopy\.workspace\.versionsEntryPoint\}/);
    assert.match(shellSource, /\{recoveryCopy\.actions\.saveNamedSnapshot\}/);
    assert.match(shellSource, /recoveryCopy\.workspace\.openProjectToCompareHistory/);
  });
});

describe('auth module i18n wiring — I18N-PAGE-01', () => {
  test('locale files define required authModule keys', () => {
    const en = JSON.parse(readFileSync(new URL('../../messages/en.json', import.meta.url), 'utf8'));
    const zhTw = JSON.parse(readFileSync(new URL('../../messages/zh-TW.json', import.meta.url), 'utf8'));
    const zhCn = JSON.parse(readFileSync(new URL('../../messages/zh-CN.json', import.meta.url), 'utf8'));
    const requiredAuthModuleKeys = ['installing', 'notNextJsProject'] as const;

    for (const key of requiredAuthModuleKeys) {
      assert.ok(typeof en.authModule?.[key] === 'string' && en.authModule[key].length > 0);
      assert.ok(typeof zhTw.authModule?.[key] === 'string' && zhTw.authModule[key].length > 0);
      assert.ok(typeof zhCn.authModule?.[key] === 'string' && zhCn.authModule[key].length > 0);
    }
  });

  test('page source imports locale files and defines getAuthModuleMessages helper', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(pageSource, /import enMessages from '@\/messages\/en\.json';/);
    assert.match(pageSource, /import zhTwMessages from '@\/messages\/zh-TW\.json';/);
    assert.match(pageSource, /import zhCnMessages from '@\/messages\/zh-CN\.json';/);
    assert.match(
      pageSource,
      /function getAuthModuleMessages\(locale: string\): typeof enMessages\.authModule \{/,
    );
    assert.match(pageSource, /if \(locale === 'zh-TW'\) return zhTwMessages\.authModule;/);
    assert.match(pageSource, /if \(locale === 'zh-CN'\) return zhCnMessages\.authModule;/);
    assert.match(pageSource, /return enMessages\.authModule;/);
  });

  test('page source removes targeted hardcoded English auth-module strings', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(pageSource, /Installing auth module — preparing your workspace\.\.\./);
    assert.doesNotMatch(
      pageSource,
      /This workspace doesn't look like a Next\.js project yet\. Create or open a Next\.js project first, then try adding authentication again\./,
    );
  });

  test('handleInstallAuthModule uses authModuleMessages for installing and not-nextjs branch', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(pageSource, /appendAssistantMessage\(authModuleMessages\.installing\);/);
    assert.match(
      pageSource,
      /eligibility\.code === 'MISSING_PACKAGE_JSON' \|\| eligibility\.code === 'MALFORMED_PACKAGE_JSON'\s*\?\s*authModuleMessages\.notNextJsProject/,
    );
  });

  test('handleInstallAuthModule marks status messages as system-kind chat messages', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(pageSource, /const appendAssistantMessage = \(content: string\): void => \{/);
    assert.match(pageSource, /role: 'assistant',\s*content,\s*messageKind: 'system',/);
    assert.match(pageSource, /content: assistantSummary,\s*messageKind: 'system',\s*executionId,/);
  });
});

describe('workspace visual edit checkpoint labeling — UX-IA-17A', () => {
  test('page source defines VISUAL_EDIT_CHECKPOINT_DESCRIPTION', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(
      pageSource,
      /const VISUAL_EDIT_CHECKPOINT_DESCRIPTION = 'Visual Edit: applied file changes';/,
    );
  });

  test('page source keeps AI_AUTO_CHECKPOINT_DESCRIPTION for non-visual-edit executions', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(
      pageSource,
      /const AI_AUTO_CHECKPOINT_DESCRIPTION = 'AI: applied workspace file actions';/,
    );
  });

  test('page source selects checkpointDescription using visualEditExecutionIdsRef.current.has(executionId)', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(
      pageSource,
      /const checkpointDescription = visualEditExecutionIdsRef\.current\.has\(executionId\)\s*\?\s*VISUAL_EDIT_CHECKPOINT_DESCRIPTION/,
    );
    assert.match(
      pageSource,
      /authModuleExecutionIdsRef\.current\.has\(executionId\)\s*\?\s*AUTH_MODULE_INSTALL_CHECKPOINT_DESCRIPTION/,
    );
    assert.match(
      pageSource,
      /:\s*AI_AUTO_CHECKPOINT_DESCRIPTION;/,
    );
  });

  test('page source passes conditional checkpointDescription into runAiActionCoherence', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(pageSource, /const coherenceResult = await runAiActionCoherence\(\{/);
    assert.match(pageSource, /checkpointDescription,/);
  });
});

describe('auth module install flow integration — AUTH-MODULE-01D', () => {
  test('page source defines AUTH_MODULE_PREINSTALL_CHECKPOINT_DESCRIPTION', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(
      pageSource,
      /const AUTH_MODULE_PREINSTALL_CHECKPOINT_DESCRIPTION = 'Auth Module: pre-install snapshot';/,
    );
  });

  test('page source defines AUTH_MODULE_INSTALL_CHECKPOINT_DESCRIPTION', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(
      pageSource,
      /const AUTH_MODULE_INSTALL_CHECKPOINT_DESCRIPTION =\s*'Auth Module: installed authentication starter';/,
    );
  });

  test('page source defines and resets authModuleExecutionIdsRef', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(pageSource, /const authModuleExecutionIdsRef = useRef\(new Set<string>\(\)\);/);
    assert.match(pageSource, /authModuleExecutionIdsRef\.current = new Set<string>\(\);/);
  });

  test('page source selects auth-module checkpoint description in maybeRunExecutionCoherence', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(pageSource, /authModuleExecutionIdsRef\.current\.has\(executionId\)/);
    assert.match(pageSource, /AUTH_MODULE_INSTALL_CHECKPOINT_DESCRIPTION/);
  });

  test('handleInstallAuthModule reads package.json and checks eligibility', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(pageSource, /async function handleInstallAuthModule\(\): Promise<void> \{/);
    assert.match(pageSource, /filePath: 'package\.json'/);
    assert.match(pageSource, /const eligibility: AuthModuleEligibilityResult = detectAuthModuleEligibility\(\{/);
  });

  test('handleInstallAuthModule does not surface raw package.json read failure text', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(pageSource, /unable to read package\.json/);
  });

  test('handleInstallAuthModule uses locale-backed unsupported-project message for missing package.json', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(pageSource, /authModuleMessages\.notNextJsProject/);
  });

  test('handleInstallAuthModule checks MISSING_PACKAGE_JSON eligibility code', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(pageSource, /eligibility\.code === 'MISSING_PACKAGE_JSON'/);
  });

  test('handleInstallAuthModule checks MALFORMED_PACKAGE_JSON eligibility code', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(pageSource, /eligibility\.code === 'MALFORMED_PACKAGE_JSON'/);
  });

  test('handleInstallAuthModule generates auth module file actions', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(pageSource, /actions = generateAuthModuleFileActions\(\{/);
    assert.match(pageSource, /packageJsonContent: packageJsonContent!/);
  });

  test('handleInstallAuthModule creates pre-install checkpoint before apply', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    const checkpointIndex = pageSource.indexOf(
      "description: AUTH_MODULE_PREINSTALL_CHECKPOINT_DESCRIPTION",
    );
    const applyIndex = pageSource.indexOf(
      "await maybeApplyExecutionFileActions(executionId, 'status');",
    );
    assert.ok(checkpointIndex >= 0);
    assert.ok(applyIndex >= 0);
    assert.ok(checkpointIndex < applyIndex);
  });

  test('handleInstallAuthModule passes allowEmpty: true for pre-install checkpoint', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(
      pageSource,
      /const preinstallResult: WorkspaceCheckpointCreateResult = await createWorkspaceCheckpoint\(\{/,
    );
    assert.match(pageSource, /allowEmpty: true,/);
  });

  test('handleInstallAuthModule checks preinstallResult.commitHash before loading checkpoints', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    const guardIndex = pageSource.indexOf('if (!preinstallResult.commitHash) {');
    const loadIndex = pageSource.indexOf('await loadCheckpoints(selectedSessionId);', guardIndex);

    assert.ok(guardIndex >= 0);
    assert.ok(loadIndex >= 0);
    assert.ok(guardIndex < loadIndex);
    assert.match(
      pageSource,
      /appendAssistantMessage\('Auth module installation failed: unable to create pre-install checkpoint\.'\);/,
    );
  });

  test('handleInstallAuthModule routes generated actions through maybeApplyExecutionFileActions', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(pageSource, /await maybeApplyExecutionFileActions\(executionId, 'status'\);/);
  });

  test('workspace shell source defines onInstallAuthModule prop', () => {
    const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
    assert.match(shellSource, /onInstallAuthModule\?: \(\) => void \| Promise<void>;/);
  });

  test('WorkspaceShell accepts onInstallAuthModule prop without render failure', () => {
    assert.doesNotThrow(() => {
      renderWorkspaceShell({
        onInstallAuthModule: async () => {},
      });
    });
  });
});

describe('auth module intent recognition — AUTH-MODULE-01E', () => {
  test('page source imports detectAuthModuleIntent', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(
      pageSource,
      /import \{ detectAuthModuleIntent \} from '@\/lib\/auth-module\/auth-module-intent';/,
    );
  });

  test('handleSubmitChatPrompt calls detectAuthModuleIntent(trimmedPrompt)', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(pageSource, /if \(detectAuthModuleIntent\(trimmedPrompt\)\) \{/);
  });

  test('auth intent branch appends user message before calling handleInstallAuthModule', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    const branchStart = pageSource.indexOf('if (detectAuthModuleIntent(trimmedPrompt)) {');
    const userRoleIndex = pageSource.indexOf("role: 'user'", branchStart);
    const installCallIndex = pageSource.indexOf('await handleInstallAuthModule();', branchStart);

    assert.ok(branchStart >= 0);
    assert.ok(userRoleIndex >= 0);
    assert.ok(installCallIndex >= 0);
    assert.ok(userRoleIndex < installCallIndex);
  });

  test('auth intent branch returns before normal AI execution paths', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    const branchStart = pageSource.indexOf('if (detectAuthModuleIntent(trimmedPrompt)) {');
    const branchEnd = pageSource.indexOf(
      'const promptWithSelectedPreviewElement = buildPromptWithSelectedPreviewElement(',
      branchStart,
    );
    const branchSource = pageSource.slice(branchStart, branchEnd);
    const submitStateIndex = pageSource.indexOf("setChatRequestState('submitting');");

    assert.ok(branchStart >= 0);
    assert.ok(branchEnd > branchStart);
    assert.ok(submitStateIndex > branchEnd);
    assert.match(branchSource, /await handleInstallAuthModule\(\);/);
    assert.match(branchSource, /return;/);
  });

  test('handleInstallAuthModule posts locale-backed installing status message', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(pageSource, /appendAssistantMessage\(authModuleMessages\.installing\);/);
  });

  test('completion summary mentions setup steps and SETUP-AUTH.md', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(pageSource, /Auth module files are ready — \$\{actions\.length\} files prepared\./);
    assert.match(pageSource, /Next steps:/);
    assert.match(pageSource, /Run: npm install/);
    assert.match(pageSource, /SETUP-AUTH\.md/);
  });
});

describe('workspace visual edit undo affordance — UX-IA-17B', () => {
  test('page source defines visualEditCheckpointByExecutionIdRef', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(
      pageSource,
      /const visualEditCheckpointByExecutionIdRef = useRef<Record<string, string>>\(\{\}\);/,
    );
  });

  test('page source stores visual-edit checkpoint hash by execution id', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(
      pageSource,
      /visualEditCheckpointByExecutionIdRef\.current\[executionId\] = capturedVisualEditCommitHash;/,
    );
  });

  test('page source resets visualEditCheckpointByExecutionIdRef on chat reset path', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.match(pageSource, /visualEditCheckpointByExecutionIdRef\.current = \{\};/);
  });

  test('workspace shell source defines onUndoVisualEdit prop on WorkspaceAssistantFileActionSummary', () => {
    const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
    assert.match(shellSource, /onUndoVisualEdit\?: \(\) => void;/);
  });

  test('workspace shell source includes visual-edit undo button test id', () => {
    const shellSource = readFileSync(new URL('./workspace-shell.tsx', import.meta.url), 'utf8');
    assert.match(shellSource, /workspace-chat-file-actions-undo-visual-edit/);
  });

  test("renders undo button for visual-edit execution with applyStatus='applied' and undo callback", () => {
    const html = renderWorkspaceShell({
      visualEditExecutionIds: ['exec-visual-applied-1'],
      visualEditCheckpointByExecutionId: {
        'exec-visual-applied-1': 'commit-visual-1',
      },
      onInitiateCheckpointRevert: () => {},
      chatThreadMessages: [
        {
          id: 'assistant-visual-applied-1',
          role: 'assistant',
          content: 'Applied visual edit changes.',
          executionId: 'exec-visual-applied-1',
          fileActionState: {
            executionId: 'exec-visual-applied-1',
            source: 'status',
            fileActions: [{ action: 'write', path: 'src/app.tsx', content: 'updated' }],
            applyStatus: 'applied',
            confirmationRequired: false,
            skipReason: null,
            results: [{ action: 'write', path: 'src/app.tsx', status: 'success', error: null }],
          },
        },
      ],
    });

    assert.match(html, /workspace-chat-file-actions-undo-visual-edit/);
    assert.match(html, /Undo \/ Revert/);
  });

  test('does not render undo button for non-visual-edit execution', () => {
    const html = renderWorkspaceShell({
      visualEditExecutionIds: [],
      visualEditCheckpointByExecutionId: {
        'exec-non-visual-applied-1': 'commit-non-visual-1',
      },
      onInitiateCheckpointRevert: () => {},
      chatThreadMessages: [
        {
          id: 'assistant-non-visual-applied-1',
          role: 'assistant',
          content: 'Applied non-visual changes.',
          executionId: 'exec-non-visual-applied-1',
          fileActionState: {
            executionId: 'exec-non-visual-applied-1',
            source: 'status',
            fileActions: [{ action: 'write', path: 'src/non-visual.ts', content: 'updated' }],
            applyStatus: 'applied',
            confirmationRequired: false,
            skipReason: null,
            results: [{ action: 'write', path: 'src/non-visual.ts', status: 'success', error: null }],
          },
        },
      ],
    });

    assert.doesNotMatch(html, /workspace-chat-file-actions-undo-visual-edit/);
  });

  test("does not render undo button when applyStatus is 'awaiting-confirmation'", () => {
    const html = renderWorkspaceShell({
      visualEditExecutionIds: ['exec-visual-awaiting-1'],
      visualEditCheckpointByExecutionId: {
        'exec-visual-awaiting-1': 'commit-visual-awaiting-1',
      },
      onInitiateCheckpointRevert: () => {},
      chatThreadMessages: [
        {
          id: 'assistant-visual-awaiting-1',
          role: 'assistant',
          content: 'Waiting for confirmation.',
          executionId: 'exec-visual-awaiting-1',
          fileActionState: {
            executionId: 'exec-visual-awaiting-1',
            source: 'status',
            fileActions: [{ action: 'write', path: 'src/app.tsx', content: 'updated' }],
            applyStatus: 'awaiting-confirmation',
            confirmationRequired: true,
            skipReason: null,
            results: [],
          },
        },
      ],
    });

    assert.doesNotMatch(html, /workspace-chat-file-actions-undo-visual-edit/);
  });

  test('does not render undo button when onUndoVisualEdit is undefined', () => {
    const html = renderWorkspaceShell({
      visualEditExecutionIds: ['exec-visual-no-undo-1'],
      onInitiateCheckpointRevert: () => {},
      chatThreadMessages: [
        {
          id: 'assistant-visual-no-undo-1',
          role: 'assistant',
          content: 'Visual edit applied but checkpoint id missing.',
          executionId: 'exec-visual-no-undo-1',
          fileActionState: {
            executionId: 'exec-visual-no-undo-1',
            source: 'status',
            fileActions: [{ action: 'write', path: 'src/app.tsx', content: 'updated' }],
            applyStatus: 'applied',
            confirmationRequired: false,
            skipReason: null,
            results: [{ action: 'write', path: 'src/app.tsx', status: 'success', error: null }],
          },
        },
      ],
    });

    assert.doesNotMatch(html, /workspace-chat-file-actions-undo-visual-edit/);
  });
});

describe('workspace sidebar workspace-label wiring — UX-IA-22', () => {
  test('locale files define workspace.workspaceLabel in all supported locales', () => {
    const en = JSON.parse(readFileSync(new URL('../../messages/en.json', import.meta.url), 'utf8'));
    const zhTw = JSON.parse(readFileSync(new URL('../../messages/zh-TW.json', import.meta.url), 'utf8'));
    const zhCn = JSON.parse(readFileSync(new URL('../../messages/zh-CN.json', import.meta.url), 'utf8'));

    assert.equal(en.workspace?.workspaceLabel, 'Workspace');
    assert.equal(zhTw.workspace?.workspaceLabel, '工作區');
    assert.equal(zhCn.workspace?.workspaceLabel, '工作区');
  });

  test('workspace sidebar source uses workspaceLabel for workspace selector and fallbacks', () => {
    const sidebarSource = readFileSync(new URL('./workspace-sidebar.tsx', import.meta.url), 'utf8');

    assert.match(sidebarSource, /workspaceLabel: read\('workspace\.workspaceLabel'\),/);
    assert.match(sidebarSource, /<label[\s\S]*\{messages\.workspaceLabel\}[\s\S]*<\/label>/);

    const workspaceFallbackMatches =
      sidebarSource.match(/selectedWorkspace\?\.name \?\? messages\.workspaceLabel/g) ?? [];
    assert.equal(workspaceFallbackMatches.length, 2);
  });

  test('workspace sidebar projects nav tab remains wired to messages.projects', () => {
    const sidebarSource = readFileSync(new URL('./workspace-sidebar.tsx', import.meta.url), 'utf8');
    assert.match(sidebarSource, /\['projects', messages\.projects\]/);
  });
});
