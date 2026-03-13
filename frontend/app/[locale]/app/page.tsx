'use client';

import { useEffect, useState } from 'react';
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
      setCheckpoints(data);
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
    />
  );
}
