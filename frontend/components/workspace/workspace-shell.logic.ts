export type WorkspaceShellState = 'loading' | 'error' | 'empty' | 'ready';
export type HistorySliceState = 'loading' | 'error' | 'empty' | 'ready';

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

export interface WorkspaceCheckpoint {
  id: string;
  commitHash: string;
  messageNumber: number | null;
  description: string | null;
  filesChanged: number;
  createdAt: string;
}

export interface HistorySliceStateInput {
  selectedSessionId: string | null;
  isLoadingHistory: boolean;
  historyError: string | null;
  checkpoints: WorkspaceCheckpoint[];
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

export function computeHistorySliceState(
  input: HistorySliceStateInput,
): HistorySliceState {
  if (!input.selectedSessionId) {
    return 'empty';
  }

  if (input.isLoadingHistory) {
    return 'loading';
  }

  if (input.historyError) {
    return 'error';
  }

  if (!input.checkpoints.length) {
    return 'empty';
  }

  return 'ready';
}

export function getSessionLabel(session: WorkspaceShellSession): string {
  if (session.terminatedAt) {
    return 'terminated';
  }

  return session.status || 'pending';
}
