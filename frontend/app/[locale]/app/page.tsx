'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import WorkspaceShell from '@/components/workspace/workspace-shell';
import type {
  WorkspaceCheckpoint,
  WorkspaceQuotaSummary,
  WorkspaceShellSession,
  WorkspaceUsageSummary,
  WorkspaceUserSummary,
} from '@/components/workspace/workspace-shell.logic';
import {
  executeSessionCommand,
  type WorkspaceExecState,
} from '@/components/workspace/workspace-exec.logic';
import { refreshPostExecSurfaces } from '@/components/workspace/workspace-post-exec.logic';
import { areCheckpointListsEqual } from '@/components/workspace/workspace-shell.logic';
import {
  buildPreviewProxyUrl,
  isPreviewRunning,
  type WorkspacePreviewStatusResponse,
  type WorkspacePreviewState,
} from '@/components/workspace/workspace-preview.logic';
import {
  findFirstFilePath,
  loadWorkspaceFileTree,
  readWorkspaceFile,
  writeWorkspaceFile,
  type WorkspaceFileNode,
  type WorkspaceFileSaveState,
  type WorkspaceFileSurfaceState,
} from '@/components/workspace/workspace-file-navigation.logic';

export default function AppPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<WorkspaceShellSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [checkpoints, setCheckpoints] = useState<WorkspaceCheckpoint[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [userSummary, setUserSummary] = useState<WorkspaceUserSummary | null>(null);
  const [usageSummary, setUsageSummary] = useState<WorkspaceUsageSummary | null>(null);
  const [quotaSummary, setQuotaSummary] = useState<WorkspaceQuotaSummary | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [commandInput, setCommandInput] = useState('');
  const [execState, setExecState] = useState<WorkspaceExecState>({
    status: 'idle',
    result: null,
  });
  const [previewState, setPreviewState] = useState<WorkspacePreviewState>('unavailable');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewRequestIdRef = useRef(0);
  const [fileSurfaceState, setFileSurfaceState] = useState<WorkspaceFileSurfaceState>('empty');
  const [workspaceFileTree, setWorkspaceFileTree] = useState<WorkspaceFileNode[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState('');
  const [savedFileContent, setSavedFileContent] = useState('');
  const [fileSaveState, setFileSaveState] = useState<WorkspaceFileSaveState>('clean');
  const [fileSaveError, setFileSaveError] = useState<string | null>(null);
  const [fileSurfaceError, setFileSurfaceError] = useState<string | null>(null);
  const fileNavigationRequestIdRef = useRef(0);
  const fileContentRequestIdRef = useRef(0);
  const fileSaveRequestIdRef = useRef(0);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedUserId = localStorage.getItem('userId');

    if (!token) {
      router.push(`/${locale}/login`);
      return;
    }

    setUserId(storedUserId);
    setAuthLoading(false);
    void loadSessions(token);
    void loadDashboardSlice(token);
  }, [locale, router]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      return;
    }

    if (!selectedSessionId) {
      setCheckpoints([]);
      setHistoryError(null);
      setIsLoadingHistory(false);
      return;
    }

    void loadCheckpoints(token, selectedSessionId);
  }, [selectedSessionId]);

  useEffect(() => {
    setCommandInput('');
    setExecState({
      status: 'idle',
      result: null,
    });
  }, [selectedSessionId]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      return;
    }

    if (!selectedSessionId) {
      setPreviewState('unavailable');
      setPreviewUrl(null);
      return;
    }

    void refreshPreviewForSession(token, selectedSessionId);
  }, [selectedSessionId]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      return;
    }

    if (!selectedSessionId) {
      resetWorkspaceFileSurface();
      return;
    }

    void loadWorkspaceFilesForSession(token, selectedSessionId);
  }, [selectedSessionId]);

  async function loadSessions(token: string): Promise<void> {
    setIsLoadingSessions(true);
    setSessionError(null);

    try {
      const response = await fetch('/api/sessions?includeTerminated=true', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Session load failed (${response.status})`);
      }

      const data = (await response.json()) as WorkspaceShellSession[];
      setSessions(data);
      setSelectedSessionId((currentSelection) => {
        if (currentSelection && data.some((session) => session.id === currentSelection)) {
          return currentSelection;
        }
        return data.length ? data[0].id : null;
      });
    } catch (error) {
      console.error('Failed to load sessions:', error);
      setSessionError('Failed to load sessions.');
      setSessions([]);
      setSelectedSessionId(null);
    } finally {
      setIsLoadingSessions(false);
    }
  }

  async function handleCreateSession(): Promise<void> {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push(`/${locale}/login`);
      return;
    }

    setIsCreatingSession(true);
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Session create failed (${response.status})`);
      }

      const createdSession = (await response.json()) as WorkspaceShellSession;
      await loadSessions(token);
      setSelectedSessionId(createdSession.id);
    } catch (error) {
      console.error('Failed to create session:', error);
      setSessionError('Failed to create session.');
    } finally {
      setIsCreatingSession(false);
    }
  }

  async function loadCheckpoints(token: string, sessionId: string): Promise<void> {
    setIsLoadingHistory(true);
    setHistoryError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/checkpoints`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Checkpoint load failed (${response.status})`);
      }

      const data = (await response.json()) as WorkspaceCheckpoint[];
      setCheckpoints((currentCheckpoints) =>
        areCheckpointListsEqual(currentCheckpoints, data) ? currentCheckpoints : data,
      );
    } catch (error) {
      console.error('Failed to load checkpoints:', error);
      setHistoryError('Failed to load checkpoints.');
      setCheckpoints([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function loadDashboardSlice(token: string): Promise<void> {
    setIsLoadingDashboard(true);
    setDashboardError(null);

    try {
      const [userResponse, usageResponse, quotasResponse] = await Promise.all([
        fetch('/api/users/me', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch('/api/users/me/usage', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch('/api/users/me/quotas', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      if (!userResponse.ok || !usageResponse.ok || !quotasResponse.ok) {
        throw new Error(
          `Dashboard load failed (${userResponse.status}/${usageResponse.status}/${quotasResponse.status})`,
        );
      }

      const [userData, usageData, quotaData] = (await Promise.all([
        userResponse.json(),
        usageResponse.json(),
        quotasResponse.json(),
      ])) as [WorkspaceUserSummary, WorkspaceUsageSummary, WorkspaceQuotaSummary];

      setUserSummary(userData);
      setUsageSummary(usageData);
      setQuotaSummary(quotaData);
    } catch (error) {
      console.error('Failed to load dashboard slice data:', error);
      setDashboardError('Failed to load dashboard summary.');
      setUserSummary(null);
      setUsageSummary(null);
      setQuotaSummary(null);
    } finally {
      setIsLoadingDashboard(false);
    }
  }

  async function handleExecuteCommand(): Promise<void> {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push(`/${locale}/login`);
      return;
    }

    const trimmedCommand = commandInput.trim();
    if (!trimmedCommand) {
      setExecState({
        status: 'http-400',
        result: null,
      });
      return;
    }

    if (!selectedSessionId) {
      setExecState({
        status: 'http-404',
        result: null,
      });
      return;
    }

    const selectedSession = sessions.find((session) => session.id === selectedSessionId);
    if (!selectedSession) {
      setExecState({
        status: 'http-404',
        result: null,
      });
      return;
    }

    if (selectedSession.terminatedAt) {
      setExecState({
        status: 'http-410',
        result: null,
      });
      return;
    }

    setExecState({
      status: 'sending',
      result: null,
    });

    const nextState = await executeSessionCommand({
      token,
      sessionId: selectedSessionId,
      command: trimmedCommand,
    });

    setExecState(nextState);

    await refreshPostExecSurfaces({
      execState: nextState,
      refreshCheckpoints: async () => {
        await loadCheckpoints(token, selectedSessionId);
      },
      refreshSessions: async () => {
        await loadSessions(token);
      },
      refreshDashboard: async () => {
        await loadDashboardSlice(token);
      },
    });
  }

  function resetWorkspaceFileSurface(): void {
    fileNavigationRequestIdRef.current += 1;
    fileContentRequestIdRef.current += 1;
    fileSaveRequestIdRef.current += 1;
    setFileSurfaceState('empty');
    setWorkspaceFileTree([]);
    setSelectedFilePath(null);
    setSelectedFileContent('');
    setSavedFileContent('');
    setFileSaveState('clean');
    setFileSaveError(null);
    setFileSurfaceError(null);
  }

  async function loadWorkspaceFilesForSession(token: string, sessionId: string): Promise<void> {
    const requestId = fileNavigationRequestIdRef.current + 1;
    fileNavigationRequestIdRef.current = requestId;
    fileContentRequestIdRef.current += 1;
    fileSaveRequestIdRef.current += 1;

    setFileSurfaceState('loading');
    setWorkspaceFileTree([]);
    setSelectedFilePath(null);
    setSelectedFileContent('');
    setSavedFileContent('');
    setFileSaveState('clean');
    setFileSaveError(null);
    setFileSurfaceError(null);

    try {
      const tree = await loadWorkspaceFileTree({
        token,
        sessionId,
      });

      if (fileNavigationRequestIdRef.current !== requestId) {
        return;
      }

      const firstFilePath = findFirstFilePath(tree);
      if (!firstFilePath) {
        setWorkspaceFileTree(tree);
        setSelectedFilePath(null);
        setSelectedFileContent('');
        setSavedFileContent('');
        setFileSaveState('clean');
        setFileSaveError(null);
        setFileSurfaceState('empty');
        return;
      }

      setWorkspaceFileTree(tree);
      await loadWorkspaceFileContent(token, sessionId, firstFilePath);
    } catch (error) {
      console.error('Failed to load workspace files:', error);
      if (fileNavigationRequestIdRef.current !== requestId) {
        return;
      }
      setWorkspaceFileTree([]);
      setSelectedFilePath(null);
      setSelectedFileContent('');
      setSavedFileContent('');
      setFileSaveState('clean');
      setFileSaveError(null);
      setFileSurfaceState('error');
      setFileSurfaceError('Failed to load workspace files.');
    }
  }

  async function loadWorkspaceFileContent(
    token: string,
    sessionId: string,
    filePath: string,
  ): Promise<void> {
    const requestId = fileContentRequestIdRef.current + 1;
    fileContentRequestIdRef.current = requestId;
    fileSaveRequestIdRef.current += 1;

    setFileSurfaceState('loading');
    setFileSurfaceError(null);
    setSelectedFilePath(filePath);
    setFileSaveState('clean');
    setFileSaveError(null);

    try {
      const fileResponse = await readWorkspaceFile({
        token,
        sessionId,
        filePath,
      });

      if (fileContentRequestIdRef.current !== requestId) {
        return;
      }

      setSelectedFilePath(fileResponse.path);
      setSelectedFileContent(fileResponse.content);
      setSavedFileContent(fileResponse.content);
      setFileSaveState('clean');
      setFileSaveError(null);
      setFileSurfaceState('ready');
    } catch (error) {
      console.error('Failed to load workspace file content:', error);
      if (fileContentRequestIdRef.current !== requestId) {
        return;
      }
      setSelectedFileContent('');
      setSavedFileContent('');
      setFileSaveState('clean');
      setFileSaveError(null);
      setFileSurfaceState('error');
      setFileSurfaceError('Failed to load selected file content.');
    }
  }

  function handleWorkspaceEditorContentChange(nextContent: string): void {
    setSelectedFileContent(nextContent);
    setFileSaveError(null);
    setFileSaveState(nextContent === savedFileContent ? 'clean' : 'dirty');
  }

  async function handleSaveWorkspaceFile(): Promise<void> {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push(`/${locale}/login`);
      return;
    }

    if (!selectedSessionId || !selectedFilePath || fileSurfaceState !== 'ready') {
      setFileSaveState('save-error');
      setFileSaveError('Cannot save without an active session and selected file.');
      return;
    }

    const requestId = fileSaveRequestIdRef.current + 1;
    fileSaveRequestIdRef.current = requestId;
    setFileSaveState('saving');
    setFileSaveError(null);

    try {
      await writeWorkspaceFile({
        token,
        sessionId: selectedSessionId,
        filePath: selectedFilePath,
        content: selectedFileContent,
      });

      if (fileSaveRequestIdRef.current !== requestId) {
        return;
      }

      setSavedFileContent(selectedFileContent);
      setFileSaveState('saved');
      setFileSaveError(null);
    } catch (error) {
      console.error('Failed to save workspace file:', error);
      if (fileSaveRequestIdRef.current !== requestId) {
        return;
      }
      setFileSaveState('save-error');
      setFileSaveError('Failed to save file changes.');
    }
  }

  async function handleSelectWorkspaceFile(filePath: string): Promise<void> {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push(`/${locale}/login`);
      return;
    }

    if (!selectedSessionId) {
      setFileSurfaceState('empty');
      setSelectedFilePath(null);
      setSelectedFileContent('');
      setSavedFileContent('');
      setFileSaveState('clean');
      setFileSaveError(null);
      setFileSurfaceError(null);
      return;
    }

    await loadWorkspaceFileContent(token, selectedSessionId, filePath);
  }

  async function refreshPreviewForSession(token: string, sessionId: string): Promise<void> {
    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;
    setPreviewState('loading');
    setPreviewUrl(null);

    try {
      const statusResponse = await fetch(`/api/preview/${sessionId}/status`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!statusResponse.ok) {
        throw new Error(`Preview status failed (${statusResponse.status})`);
      }

      const statusData = (await statusResponse.json()) as WorkspacePreviewStatusResponse;

      if (previewRequestIdRef.current !== requestId) {
        return;
      }

      if (!isPreviewRunning(statusData)) {
        setPreviewState('unavailable');
        setPreviewUrl(null);
        return;
      }

      setPreviewUrl(buildPreviewProxyUrl(sessionId, Date.now()));
    } catch (error) {
      console.error('Failed to load preview state:', error);
      if (previewRequestIdRef.current !== requestId) {
        return;
      }
      setPreviewState('error');
      setPreviewUrl(null);
    }
  }

  async function handleRefreshPreview(): Promise<void> {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push(`/${locale}/login`);
      return;
    }

    if (!selectedSessionId) {
      setPreviewState('unavailable');
      setPreviewUrl(null);
      return;
    }

    await refreshPreviewForSession(token, selectedSessionId);
  }

  function handlePreviewLoad(): void {
    setPreviewState((currentState) => {
      if (currentState !== 'loading') {
        return currentState;
      }
      return 'ready';
    });
  }

  function handlePreviewError(): void {
    setPreviewState('error');
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-600">Loading workspace...</p>
      </div>
    );
  }

  return (
    <WorkspaceShell
      sessions={sessions}
      selectedSessionId={selectedSessionId}
      isLoadingSessions={isLoadingSessions}
      sessionError={sessionError}
      onSelectSession={setSelectedSessionId}
      onCreateSession={handleCreateSession}
      isCreatingSession={isCreatingSession}
      userId={userId}
      checkpoints={checkpoints}
      isLoadingHistory={isLoadingHistory}
      historyError={historyError}
      userSummary={userSummary}
      usageSummary={usageSummary}
      quotaSummary={quotaSummary}
      isLoadingDashboard={isLoadingDashboard}
      dashboardError={dashboardError}
      commandInput={commandInput}
      onCommandInputChange={setCommandInput}
      onExecuteCommand={handleExecuteCommand}
      execState={execState}
      previewState={previewState}
      previewUrl={previewUrl}
      onRefreshPreview={handleRefreshPreview}
      onPreviewLoad={handlePreviewLoad}
      onPreviewError={handlePreviewError}
      fileSurfaceState={fileSurfaceState}
      workspaceFileTree={workspaceFileTree}
      selectedFilePath={selectedFilePath}
      selectedFileContent={selectedFileContent}
      fileSaveState={fileSaveState}
      fileSaveError={fileSaveError}
      fileSurfaceError={fileSurfaceError}
      onSelectWorkspaceFile={handleSelectWorkspaceFile}
      onEditorContentChange={handleWorkspaceEditorContentChange}
      onSaveWorkspaceFile={handleSaveWorkspaceFile}
    />
  );
}
