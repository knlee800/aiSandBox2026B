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
  createWorkspaceCheckpoint,
  type WorkspaceCheckpointCreateState,
} from '@/components/workspace/workspace-checkpoint-create.logic';
import {
  revertWorkspaceCheckpoint,
  type WorkspaceCheckpointRevertState,
} from '@/components/workspace/workspace-checkpoint-revert.logic';
import {
  loadWorkspaceCheckpointDiff,
  type WorkspaceCheckpointDiffState,
  type WorkspaceCheckpointDiffResponse,
} from '@/components/workspace/workspace-checkpoint-diff.logic';
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
  type WorkspaceCheckpointCompareState =
    | 'idle'
    | 'selecting'
    | 'loading'
    | 'ready'
    | 'compare-error';
  type WorkspaceCheckpointSnapshotState =
    | 'idle'
    | 'loading'
    | 'ready'
    | 'empty'
    | 'snapshot-error';
  type WorkspaceCheckpointLiveOpenState =
    | 'idle'
    | 'opening'
    | 'opened'
    | 'missing'
    | 'open-error';

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
  const [checkpointCreateState, setCheckpointCreateState] =
    useState<WorkspaceCheckpointCreateState>('idle');
  const [checkpointCreateError, setCheckpointCreateError] = useState<string | null>(null);
  const [checkpointDescriptionInput, setCheckpointDescriptionInput] = useState('');
  const [checkpointRevertState, setCheckpointRevertState] =
    useState<WorkspaceCheckpointRevertState>('idle');
  const [checkpointRevertError, setCheckpointRevertError] = useState<string | null>(null);
  const [checkpointRevertTargetId, setCheckpointRevertTargetId] = useState<string | null>(null);
  const [checkpointDiffState, setCheckpointDiffState] = useState<WorkspaceCheckpointDiffState>('idle');
  const [checkpointDiffError, setCheckpointDiffError] = useState<string | null>(null);
  const [checkpointDiffTargetId, setCheckpointDiffTargetId] = useState<string | null>(null);
  const [checkpointDiffResponse, setCheckpointDiffResponse] =
    useState<WorkspaceCheckpointDiffResponse | null>(null);
  const [checkpointCompareState, setCheckpointCompareState] =
    useState<WorkspaceCheckpointCompareState>('idle');
  const [checkpointCompareError, setCheckpointCompareError] = useState<string | null>(null);
  const [checkpointCompareBaseId, setCheckpointCompareBaseId] = useState<string | null>(null);
  const [checkpointCompareTargetId, setCheckpointCompareTargetId] = useState<string | null>(null);
  const [checkpointCompareResponse, setCheckpointCompareResponse] =
    useState<WorkspaceCheckpointDiffResponse | null>(null);
  const [checkpointSnapshotState, setCheckpointSnapshotState] =
    useState<WorkspaceCheckpointSnapshotState>('idle');
  const [checkpointSnapshotError, setCheckpointSnapshotError] = useState<string | null>(null);
  const [checkpointSnapshotTargetId, setCheckpointSnapshotTargetId] = useState<string | null>(null);
  const [checkpointSnapshotResponse, setCheckpointSnapshotResponse] =
    useState<WorkspaceCheckpointDiffResponse | null>(null);
  const [checkpointLiveOpenState, setCheckpointLiveOpenState] =
    useState<WorkspaceCheckpointLiveOpenState>('idle');
  const [checkpointLiveOpenError, setCheckpointLiveOpenError] = useState<string | null>(null);
  const [checkpointLiveOpenTargetPath, setCheckpointLiveOpenTargetPath] = useState<string | null>(null);
  const [checkpointPinnedReferenceId, setCheckpointPinnedReferenceId] = useState<string | null>(null);
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
  const checkpointCreateRequestIdRef = useRef(0);
  const checkpointRevertRequestIdRef = useRef(0);
  const checkpointDiffRequestIdRef = useRef(0);
  const checkpointCompareRequestIdRef = useRef(0);
  const checkpointSnapshotRequestIdRef = useRef(0);
  const checkpointLiveOpenRequestIdRef = useRef(0);

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

    checkpointCreateRequestIdRef.current += 1;
    setCheckpointCreateState('idle');
    setCheckpointCreateError(null);
    setCheckpointDescriptionInput('');
    checkpointRevertRequestIdRef.current += 1;
    setCheckpointRevertState('idle');
    setCheckpointRevertError(null);
    setCheckpointRevertTargetId(null);
    checkpointDiffRequestIdRef.current += 1;
    setCheckpointDiffState('idle');
    setCheckpointDiffError(null);
    setCheckpointDiffTargetId(null);
    setCheckpointDiffResponse(null);
    checkpointCompareRequestIdRef.current += 1;
    setCheckpointCompareState('idle');
    setCheckpointCompareError(null);
    setCheckpointCompareBaseId(null);
    setCheckpointCompareTargetId(null);
    setCheckpointCompareResponse(null);
    checkpointSnapshotRequestIdRef.current += 1;
    setCheckpointSnapshotState('idle');
    setCheckpointSnapshotError(null);
    setCheckpointSnapshotTargetId(null);
    setCheckpointSnapshotResponse(null);
    checkpointLiveOpenRequestIdRef.current += 1;
    setCheckpointLiveOpenState('idle');
    setCheckpointLiveOpenError(null);
    setCheckpointLiveOpenTargetPath(null);
    setCheckpointPinnedReferenceId(null);

    if (!selectedSessionId) {
      setCheckpoints([]);
      setHistoryError(null);
      setIsLoadingHistory(false);
      return;
    }

    void loadCheckpoints(token, selectedSessionId);
  }, [selectedSessionId]);

  useEffect(() => {
    if (!checkpointPinnedReferenceId) {
      return;
    }

    const isPinnedCheckpointPresent = checkpoints.some(
      (checkpoint) => checkpoint.id === checkpointPinnedReferenceId,
    );
    if (!isPinnedCheckpointPresent) {
      setCheckpointPinnedReferenceId(null);
    }
  }, [checkpoints, checkpointPinnedReferenceId]);

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

  function handleCheckpointDescriptionChange(value: string): void {
    setCheckpointDescriptionInput(value);
    setCheckpointCreateError(null);
    setCheckpointCreateState('idle');
  }

  async function handleCreateManualCheckpoint(): Promise<void> {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push(`/${locale}/login`);
      return;
    }

    if (!selectedSessionId || !userId) {
      setCheckpointCreateState('create-error');
      setCheckpointCreateError('Cannot create a save point without an active session.');
      return;
    }

    const selectedSession = sessions.find((session) => session.id === selectedSessionId);
    if (!selectedSession || selectedSession.terminatedAt) {
      setCheckpointCreateState('create-error');
      setCheckpointCreateError('Cannot create a save point for a terminated session.');
      return;
    }

    const requestId = checkpointCreateRequestIdRef.current + 1;
    checkpointCreateRequestIdRef.current = requestId;
    setCheckpointCreateState('creating');
    setCheckpointCreateError(null);

    try {
      await createWorkspaceCheckpoint({
        token,
        sessionId: selectedSessionId,
        userId,
        description: checkpointDescriptionInput,
      });

      if (checkpointCreateRequestIdRef.current !== requestId) {
        return;
      }

      setCheckpointCreateState('created');
      await loadCheckpoints(token, selectedSessionId);
    } catch (error) {
      console.error('Failed to create manual checkpoint:', error);
      if (checkpointCreateRequestIdRef.current !== requestId) {
        return;
      }
      setCheckpointCreateState('create-error');
      setCheckpointCreateError('Failed to create save point.');
    }
  }

  function handleInitiateCheckpointRevert(checkpointId: string): void {
    const selectedSession = sessions.find((session) => session.id === selectedSessionId);
    if (!selectedSessionId || !selectedSession || selectedSession.terminatedAt) {
      setCheckpointRevertState('revert-error');
      setCheckpointRevertError('Cannot revert without an active session.');
      setCheckpointRevertTargetId(null);
      return;
    }

    if (!checkpoints.some((checkpoint) => checkpoint.id === checkpointId)) {
      setCheckpointRevertState('revert-error');
      setCheckpointRevertError('Selected checkpoint is no longer available.');
      setCheckpointRevertTargetId(null);
      return;
    }

    setCheckpointRevertTargetId(checkpointId);
    setCheckpointRevertError(null);
    setCheckpointRevertState('previewing');
  }

  function handleAdvanceCheckpointRevertPreview(): void {
    if (checkpointRevertState !== 'previewing' || !checkpointRevertTargetId) {
      return;
    }
    setCheckpointRevertError(null);
    setCheckpointRevertState('confirming');
  }

  function handleCancelCheckpointRevert(): void {
    if (checkpointRevertState === 'reverting') {
      return;
    }
    setCheckpointRevertTargetId(null);
    setCheckpointRevertError(null);
    setCheckpointRevertState('idle');
  }

  async function handleConfirmCheckpointRevert(): Promise<void> {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push(`/${locale}/login`);
      return;
    }

    if (!selectedSessionId || !userId || !checkpointRevertTargetId) {
      setCheckpointRevertState('revert-error');
      setCheckpointRevertError('Cannot revert without an active session and selected checkpoint.');
      return;
    }
    if (checkpointRevertState !== 'confirming') {
      setCheckpointRevertState('revert-error');
      setCheckpointRevertError('Revert confirmation step is required before submission.');
      return;
    }

    const selectedSession = sessions.find((session) => session.id === selectedSessionId);
    if (!selectedSession || selectedSession.terminatedAt) {
      setCheckpointRevertState('revert-error');
      setCheckpointRevertError('Cannot revert a terminated session.');
      return;
    }

    const targetCheckpoint = checkpoints.find((checkpoint) => checkpoint.id === checkpointRevertTargetId);
    if (!targetCheckpoint) {
      setCheckpointRevertState('revert-error');
      setCheckpointRevertError('Selected checkpoint is no longer available.');
      setCheckpointRevertTargetId(null);
      return;
    }

    const requestId = checkpointRevertRequestIdRef.current + 1;
    checkpointRevertRequestIdRef.current = requestId;
    const sessionId = selectedSessionId;
    setCheckpointRevertState('reverting');
    setCheckpointRevertError(null);

    try {
      await revertWorkspaceCheckpoint({
        token,
        sessionId,
        userId,
        commitHash: targetCheckpoint.commitHash,
      });

      if (checkpointRevertRequestIdRef.current !== requestId) {
        return;
      }

      await loadCheckpoints(token, sessionId);
      if (checkpointRevertRequestIdRef.current !== requestId) {
        return;
      }

      await loadWorkspaceFilesForSession(token, sessionId);
      if (checkpointRevertRequestIdRef.current !== requestId) {
        return;
      }

      await refreshPreviewForSession(token, sessionId);
      if (checkpointRevertRequestIdRef.current !== requestId) {
        return;
      }

      setCheckpointRevertState('reverted');
      setCheckpointRevertError(null);
      setCheckpointRevertTargetId(null);
    } catch (error) {
      console.error('Failed to revert checkpoint:', error);
      if (checkpointRevertRequestIdRef.current !== requestId) {
        return;
      }
      setCheckpointRevertState('revert-error');
      setCheckpointRevertError('Failed to revert workspace to selected checkpoint.');
    }
  }

  async function handleViewCheckpointDiff(checkpointId: string): Promise<void> {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push(`/${locale}/login`);
      return;
    }

    if (!selectedSessionId) {
      setCheckpointDiffState('diff-error');
      setCheckpointDiffError('Cannot load diff without an active session.');
      setCheckpointDiffTargetId(null);
      setCheckpointDiffResponse(null);
      return;
    }

    const selectedSession = sessions.find((session) => session.id === selectedSessionId);
    if (!selectedSession || selectedSession.terminatedAt) {
      setCheckpointDiffState('diff-error');
      setCheckpointDiffError('Cannot load diff for a terminated session.');
      setCheckpointDiffTargetId(null);
      setCheckpointDiffResponse(null);
      return;
    }

    const targetCheckpoint = checkpoints.find((checkpoint) => checkpoint.id === checkpointId);
    if (!targetCheckpoint) {
      setCheckpointDiffState('diff-error');
      setCheckpointDiffError('Selected checkpoint is no longer available.');
      setCheckpointDiffTargetId(null);
      setCheckpointDiffResponse(null);
      return;
    }

    const requestId = checkpointDiffRequestIdRef.current + 1;
    checkpointDiffRequestIdRef.current = requestId;
    const sessionId = selectedSessionId;
    setCheckpointDiffState('loading');
    setCheckpointDiffError(null);
    setCheckpointDiffTargetId(checkpointId);
    setCheckpointDiffResponse(null);

    try {
      const response = await loadWorkspaceCheckpointDiff({
        token,
        sessionId,
        commitHash: targetCheckpoint.commitHash,
      });

      if (checkpointDiffRequestIdRef.current !== requestId) {
        return;
      }

      if (!response.files.length) {
        setCheckpointDiffState('empty');
        setCheckpointDiffError(null);
        setCheckpointDiffResponse(response);
        return;
      }

      setCheckpointDiffState('ready');
      setCheckpointDiffError(null);
      setCheckpointDiffResponse(response);
    } catch (error) {
      console.error('Failed to load checkpoint diff:', error);
      if (checkpointDiffRequestIdRef.current !== requestId) {
        return;
      }
      setCheckpointDiffState('diff-error');
      setCheckpointDiffError('Failed to load checkpoint diff.');
      setCheckpointDiffResponse(null);
    }
  }

  async function handleViewCheckpointSnapshot(checkpointId: string): Promise<void> {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push(`/${locale}/login`);
      return;
    }

    if (!selectedSessionId) {
      setCheckpointSnapshotState('snapshot-error');
      setCheckpointSnapshotError('Cannot load snapshot without an active session.');
      setCheckpointSnapshotTargetId(null);
      setCheckpointSnapshotResponse(null);
      return;
    }

    const selectedSession = sessions.find((session) => session.id === selectedSessionId);
    if (!selectedSession || selectedSession.terminatedAt) {
      setCheckpointSnapshotState('snapshot-error');
      setCheckpointSnapshotError('Cannot load snapshot for a terminated session.');
      setCheckpointSnapshotTargetId(null);
      setCheckpointSnapshotResponse(null);
      return;
    }

    const targetCheckpoint = checkpoints.find((checkpoint) => checkpoint.id === checkpointId);
    if (!targetCheckpoint) {
      setCheckpointSnapshotState('snapshot-error');
      setCheckpointSnapshotError('Selected checkpoint is no longer available.');
      setCheckpointSnapshotTargetId(null);
      setCheckpointSnapshotResponse(null);
      return;
    }

    const requestId = checkpointSnapshotRequestIdRef.current + 1;
    checkpointSnapshotRequestIdRef.current = requestId;
    const sessionId = selectedSessionId;
    setCheckpointSnapshotState('loading');
    setCheckpointSnapshotError(null);
    setCheckpointSnapshotTargetId(checkpointId);
    setCheckpointSnapshotResponse(null);

    try {
      const response = await loadWorkspaceCheckpointDiff({
        token,
        sessionId,
        commitHash: targetCheckpoint.commitHash,
      });

      if (checkpointSnapshotRequestIdRef.current !== requestId) {
        return;
      }

      if (!response.files.length) {
        setCheckpointSnapshotState('empty');
        setCheckpointSnapshotError(null);
        setCheckpointSnapshotResponse(response);
        return;
      }

      setCheckpointSnapshotState('ready');
      setCheckpointSnapshotError(null);
      setCheckpointSnapshotResponse(response);
    } catch (error) {
      console.error('Failed to load checkpoint snapshot:', error);
      if (checkpointSnapshotRequestIdRef.current !== requestId) {
        return;
      }
      setCheckpointSnapshotState('snapshot-error');
      setCheckpointSnapshotError('Failed to load checkpoint snapshot.');
      setCheckpointSnapshotResponse(null);
    }
  }

  function workspaceTreeContainsFilePath(nodes: WorkspaceFileNode[], filePath: string): boolean {
    for (const node of nodes) {
      if (node.type === 'file' && node.path === filePath) {
        return true;
      }
      if (node.children.length && workspaceTreeContainsFilePath(node.children, filePath)) {
        return true;
      }
    }
    return false;
  }

  function canOpenCheckpointFileInLiveWorkspace(filePath: string): boolean {
    const normalizedPath = filePath.trim();
    if (!normalizedPath || !selectedSessionId || fileSurfaceState !== 'ready') {
      return false;
    }
    return workspaceTreeContainsFilePath(workspaceFileTree, normalizedPath);
  }

  async function handleOpenCheckpointFileInLiveWorkspace(filePath: string): Promise<void> {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push(`/${locale}/login`);
      return;
    }

    const normalizedPath = filePath.trim();
    if (!normalizedPath) {
      setCheckpointLiveOpenState('open-error');
      setCheckpointLiveOpenError('Cannot open an empty file path.');
      setCheckpointLiveOpenTargetPath(null);
      return;
    }

    if (!selectedSessionId) {
      setCheckpointLiveOpenState('open-error');
      setCheckpointLiveOpenError('Cannot open live workspace file without an active session.');
      setCheckpointLiveOpenTargetPath(normalizedPath);
      return;
    }

    const selectedSession = sessions.find((session) => session.id === selectedSessionId);
    if (!selectedSession || selectedSession.terminatedAt) {
      setCheckpointLiveOpenState('open-error');
      setCheckpointLiveOpenError('Cannot open live workspace file for a terminated session.');
      setCheckpointLiveOpenTargetPath(normalizedPath);
      return;
    }

    if (fileSurfaceState !== 'ready') {
      setCheckpointLiveOpenState('open-error');
      setCheckpointLiveOpenError('Live workspace file tree is not ready.');
      setCheckpointLiveOpenTargetPath(normalizedPath);
      return;
    }

    if (!workspaceTreeContainsFilePath(workspaceFileTree, normalizedPath)) {
      setCheckpointLiveOpenState('missing');
      setCheckpointLiveOpenError(null);
      setCheckpointLiveOpenTargetPath(normalizedPath);
      return;
    }

    const requestId = checkpointLiveOpenRequestIdRef.current + 1;
    checkpointLiveOpenRequestIdRef.current = requestId;
    const sessionId = selectedSessionId;
    setCheckpointLiveOpenState('opening');
    setCheckpointLiveOpenError(null);
    setCheckpointLiveOpenTargetPath(normalizedPath);

    try {
      const opened = await loadWorkspaceFileContent(token, sessionId, normalizedPath);

      if (checkpointLiveOpenRequestIdRef.current !== requestId) {
        return;
      }

      if (!opened) {
        setCheckpointLiveOpenState('open-error');
        setCheckpointLiveOpenError('Failed to open selected file in live workspace.');
        setCheckpointLiveOpenTargetPath(normalizedPath);
        return;
      }

      setCheckpointLiveOpenState('opened');
      setCheckpointLiveOpenError(null);
      setCheckpointLiveOpenTargetPath(normalizedPath);
    } catch (error) {
      console.error('Failed to open history file in live workspace:', error);
      if (checkpointLiveOpenRequestIdRef.current !== requestId) {
        return;
      }
      setCheckpointLiveOpenState('open-error');
      setCheckpointLiveOpenError('Failed to open selected file in live workspace.');
      setCheckpointLiveOpenTargetPath(normalizedPath);
    }
  }

  function handleStartCheckpointCompare(): void {
    if (!selectedSessionId) {
      setCheckpointCompareState('compare-error');
      setCheckpointCompareError('Select an active session to compare checkpoints.');
      setCheckpointCompareBaseId(null);
      setCheckpointCompareTargetId(null);
      setCheckpointCompareResponse(null);
      return;
    }

    setCheckpointCompareState('selecting');
    setCheckpointCompareError(null);
    setCheckpointCompareBaseId(null);
    setCheckpointCompareTargetId(null);
    setCheckpointCompareResponse(null);
  }

  function handleCancelCheckpointCompare(): void {
    if (checkpointCompareState === 'loading') {
      return;
    }

    setCheckpointCompareState('idle');
    setCheckpointCompareError(null);
    setCheckpointCompareBaseId(null);
    setCheckpointCompareTargetId(null);
    setCheckpointCompareResponse(null);
  }

  function handleSelectCheckpointCompareBase(checkpointId: string): void {
    if (checkpointCompareState === 'loading') {
      return;
    }
    setCheckpointCompareState('selecting');
    setCheckpointCompareError(null);
    setCheckpointCompareResponse(null);
    setCheckpointCompareBaseId(checkpointId);
  }

  function handleSelectCheckpointCompareTarget(checkpointId: string): void {
    if (checkpointCompareState === 'loading') {
      return;
    }
    setCheckpointCompareState('selecting');
    setCheckpointCompareError(null);
    setCheckpointCompareResponse(null);
    setCheckpointCompareTargetId(checkpointId);
  }

  async function handleRunCheckpointCompare(): Promise<void> {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push(`/${locale}/login`);
      return;
    }

    if (!selectedSessionId) {
      setCheckpointCompareState('compare-error');
      setCheckpointCompareError('Cannot compare checkpoints without an active session.');
      setCheckpointCompareResponse(null);
      return;
    }

    const selectedSession = sessions.find((session) => session.id === selectedSessionId);
    if (!selectedSession || selectedSession.terminatedAt) {
      setCheckpointCompareState('compare-error');
      setCheckpointCompareError('Cannot compare checkpoints for a terminated session.');
      setCheckpointCompareResponse(null);
      return;
    }

    if (!checkpointCompareBaseId || !checkpointCompareTargetId) {
      setCheckpointCompareState('compare-error');
      setCheckpointCompareError('Select both base and target checkpoints to compare.');
      setCheckpointCompareResponse(null);
      return;
    }

    if (checkpointCompareBaseId === checkpointCompareTargetId) {
      setCheckpointCompareState('compare-error');
      setCheckpointCompareError('Base and target checkpoints must be different.');
      setCheckpointCompareResponse(null);
      return;
    }

    const baseCheckpoint = checkpoints.find((checkpoint) => checkpoint.id === checkpointCompareBaseId);
    const targetCheckpoint = checkpoints.find((checkpoint) => checkpoint.id === checkpointCompareTargetId);
    if (!baseCheckpoint || !targetCheckpoint) {
      setCheckpointCompareState('compare-error');
      setCheckpointCompareError('Selected checkpoint pair is no longer available.');
      setCheckpointCompareResponse(null);
      return;
    }

    const requestId = checkpointCompareRequestIdRef.current + 1;
    checkpointCompareRequestIdRef.current = requestId;
    const sessionId = selectedSessionId;
    setCheckpointCompareState('loading');
    setCheckpointCompareError(null);
    setCheckpointCompareResponse(null);

    try {
      const response = await loadWorkspaceCheckpointDiff({
        token,
        sessionId,
        commitHash: targetCheckpoint.commitHash,
      });

      if (checkpointCompareRequestIdRef.current !== requestId) {
        return;
      }

      if (response.parentHash !== baseCheckpoint.commitHash) {
        setCheckpointCompareState('compare-error');
        setCheckpointCompareError(
          'Selected pair is not directly comparable. Choose a target checkpoint whose parent matches the selected base checkpoint.',
        );
        setCheckpointCompareResponse(null);
        return;
      }

      setCheckpointCompareState('ready');
      setCheckpointCompareError(null);
      setCheckpointCompareResponse(response);
    } catch (error) {
      console.error('Failed to compare checkpoints:', error);
      if (checkpointCompareRequestIdRef.current !== requestId) {
        return;
      }
      setCheckpointCompareState('compare-error');
      setCheckpointCompareError('Failed to compare selected checkpoints.');
      setCheckpointCompareResponse(null);
    }
  }

  function handlePinCheckpointCompareReference(checkpointId: string): void {
    if (!selectedSessionId) {
      return;
    }

    const selectedSession = sessions.find((session) => session.id === selectedSessionId);
    if (!selectedSession || selectedSession.terminatedAt) {
      return;
    }

    if (!checkpoints.some((checkpoint) => checkpoint.id === checkpointId)) {
      return;
    }

    setCheckpointPinnedReferenceId(checkpointId);
  }

  function handleClearPinnedCheckpointCompareReference(): void {
    setCheckpointPinnedReferenceId(null);
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
  ): Promise<boolean> {
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
        return false;
      }

      setSelectedFilePath(fileResponse.path);
      setSelectedFileContent(fileResponse.content);
      setSavedFileContent(fileResponse.content);
      setFileSaveState('clean');
      setFileSaveError(null);
      setFileSurfaceState('ready');
      return true;
    } catch (error) {
      console.error('Failed to load workspace file content:', error);
      if (fileContentRequestIdRef.current !== requestId) {
        return false;
      }
      setSelectedFileContent('');
      setSavedFileContent('');
      setFileSaveState('clean');
      setFileSaveError(null);
      setFileSurfaceState('error');
      setFileSurfaceError('Failed to load selected file content.');
      return false;
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
      checkpointCreateState={checkpointCreateState}
      checkpointCreateError={checkpointCreateError}
      checkpointDescriptionInput={checkpointDescriptionInput}
      onCheckpointDescriptionChange={handleCheckpointDescriptionChange}
      onCreateManualCheckpoint={handleCreateManualCheckpoint}
      checkpointRevertState={checkpointRevertState}
      checkpointRevertError={checkpointRevertError}
      checkpointRevertTargetId={checkpointRevertTargetId}
      onInitiateCheckpointRevert={handleInitiateCheckpointRevert}
      onAdvanceCheckpointRevertPreview={handleAdvanceCheckpointRevertPreview}
      onCancelCheckpointRevert={handleCancelCheckpointRevert}
      onConfirmCheckpointRevert={handleConfirmCheckpointRevert}
      checkpointDiffState={checkpointDiffState}
      checkpointDiffError={checkpointDiffError}
      checkpointDiffTargetId={checkpointDiffTargetId}
      checkpointDiffResponse={checkpointDiffResponse}
      onViewCheckpointDiff={handleViewCheckpointDiff}
      checkpointCompareState={checkpointCompareState}
      checkpointCompareError={checkpointCompareError}
      checkpointCompareBaseId={checkpointCompareBaseId}
      checkpointCompareTargetId={checkpointCompareTargetId}
      checkpointCompareResponse={checkpointCompareResponse}
      onStartCheckpointCompare={handleStartCheckpointCompare}
      onCancelCheckpointCompare={handleCancelCheckpointCompare}
      onSelectCheckpointCompareBase={handleSelectCheckpointCompareBase}
      onSelectCheckpointCompareTarget={handleSelectCheckpointCompareTarget}
      onRunCheckpointCompare={handleRunCheckpointCompare}
      pinnedCompareReferenceCheckpointId={checkpointPinnedReferenceId}
      onPinCheckpointCompareReference={handlePinCheckpointCompareReference}
      onClearPinnedCheckpointCompareReference={handleClearPinnedCheckpointCompareReference}
      checkpointSnapshotState={checkpointSnapshotState}
      checkpointSnapshotError={checkpointSnapshotError}
      checkpointSnapshotTargetId={checkpointSnapshotTargetId}
      checkpointSnapshotResponse={checkpointSnapshotResponse}
      onViewCheckpointSnapshot={handleViewCheckpointSnapshot}
      checkpointLiveOpenState={checkpointLiveOpenState}
      checkpointLiveOpenError={checkpointLiveOpenError}
      checkpointLiveOpenTargetPath={checkpointLiveOpenTargetPath}
      canOpenCheckpointFileInLiveWorkspace={canOpenCheckpointFileInLiveWorkspace}
      onOpenCheckpointFileInLiveWorkspace={handleOpenCheckpointFileInLiveWorkspace}
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
