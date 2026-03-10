'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import WorkspaceShell from '@/components/workspace/workspace-shell';
import type { WorkspaceShellSession } from '@/components/workspace/workspace-shell.logic';

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
  }, [locale, router]);

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
    />
  );
}
