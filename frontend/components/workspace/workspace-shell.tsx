'use client';

import React from 'react';
import {
  computeWorkspaceShellState,
  countActiveSessions,
  getSessionLabel,
  type WorkspaceShellSession,
} from './workspace-shell.logic';

interface WorkspaceShellProps {
  sessions: WorkspaceShellSession[];
  selectedSessionId: string | null;
  isLoadingSessions: boolean;
  sessionError: string | null;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => Promise<void>;
  isCreatingSession: boolean;
  userId: string | null;
}

export default function WorkspaceShell(props: WorkspaceShellProps) {
  const shellState = computeWorkspaceShellState({
    isLoadingSessions: props.isLoadingSessions,
    sessionError: props.sessionError,
    sessions: props.sessions,
    selectedSessionId: props.selectedSessionId,
  });
  const activeSessions = countActiveSessions(props.sessions);

  return (
    <div className="h-screen bg-gray-100 flex flex-col" data-testid="workspace-shell">
      <header className="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-gray-900">AI Sandbox Workspace</h1>
          <p className="text-xs text-gray-500">Core shell baseline (Slice 1)</p>
        </div>
        <div className="text-xs text-gray-600">
          {props.userId ? `User ${props.userId}` : 'Authenticated user'}
        </div>
      </header>

      <div className="flex-1 min-h-0 flex">
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col" data-testid="session-sidebar-shell">
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
          <div className="flex-1 min-h-0 grid grid-cols-3 gap-2 p-2">
            <section className="bg-white border border-gray-200 rounded p-3" data-testid="chat-panel-shell">
              <p className="text-xs font-semibold text-gray-700 mb-2">Chat Panel</p>
              <ShellStateMessage state={shellState} />
            </section>
            <section className="bg-white border border-gray-200 rounded p-3" data-testid="editor-panel-shell">
              <p className="text-xs font-semibold text-gray-700 mb-2">Editor Panel</p>
              <ShellStateMessage state={shellState} />
            </section>
            <section className="bg-white border border-gray-200 rounded p-3" data-testid="preview-panel-shell">
              <p className="text-xs font-semibold text-gray-700 mb-2">Preview Panel</p>
              <ShellStateMessage state={shellState} />
            </section>
          </div>
        </main>
      </div>

      <footer className="h-10 bg-white border-t border-gray-200 px-4 flex items-center justify-between text-xs text-gray-600">
        <span>Workspace shell state: {shellState}</span>
        <span>Sessions: {props.sessions.length}</span>
      </footer>
    </div>
  );
}

function ShellStateMessage({ state }: { state: 'loading' | 'error' | 'empty' | 'ready' }) {
  if (state === 'loading') {
    return <p className="text-sm text-gray-500">Loading workspace shell...</p>;
  }

  if (state === 'error') {
    return <p className="text-sm text-red-600">Unable to load sessions for workspace shell.</p>;
  }

  if (state === 'empty') {
    return <p className="text-sm text-gray-500">No session selected. Create or select a session.</p>;
  }

  return <p className="text-sm text-gray-700">Shell ready. Full panel behavior is deferred to later slices.</p>;
}
