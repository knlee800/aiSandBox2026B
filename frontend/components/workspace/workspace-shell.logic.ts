export type WorkspaceShellState = 'loading' | 'error' | 'empty' | 'ready';

export interface WorkspaceShellSession {
  id: string;
  status: string;
  terminatedAt: string | null;
  terminationReason: string | null;
}

export interface WorkspaceShellStateInput {
  isLoadingSessions: boolean;
  sessionError: string | null;
  sessions: WorkspaceShellSession[];
  selectedSessionId: string | null;
}

export function computeWorkspaceShellState(
  input: WorkspaceShellStateInput,
): WorkspaceShellState {
  if (input.isLoadingSessions) {
    return 'loading';
  }

  if (input.sessionError) {
    return 'error';
  }

  if (!input.sessions.length || !input.selectedSessionId) {
    return 'empty';
  }

  return 'ready';
}

export function countActiveSessions(sessions: WorkspaceShellSession[]): number {
  return sessions.filter((session) => !session.terminatedAt).length;
}

export function getSessionLabel(session: WorkspaceShellSession): string {
  if (session.terminatedAt) {
    return 'terminated';
  }

  return session.status || 'pending';
}
