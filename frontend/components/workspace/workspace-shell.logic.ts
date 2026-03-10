export type WorkspaceShellState = 'loading' | 'error' | 'empty' | 'ready';
export type HistorySliceState = 'loading' | 'error' | 'empty' | 'ready';
export type DashboardSliceState = 'loading' | 'error' | 'empty' | 'ready';

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

export interface WorkspaceUserSummary {
  userId: string;
  email: string;
  createdAt: string;
}

export interface WorkspaceUsageSummary {
  activeSessions: number;
  sessionsCreated24h: number;
  tokensUsed24h: number;
  estimatedCost: number;
  resetAt: string;
}

export interface WorkspaceQuotaSummary {
  maxActiveSessions: number;
  currentActiveSessions: number;
  maxSessions24h: number;
  currentSessions24h: number;
  maxTokens24h: number;
  currentTokens24h: number;
  resetAt: string;
}

export interface HistorySliceStateInput {
  selectedSessionId: string | null;
  isLoadingHistory: boolean;
  historyError: string | null;
  checkpoints: WorkspaceCheckpoint[];
}

export interface DashboardSliceStateInput {
  isLoadingDashboard: boolean;
  dashboardError: string | null;
  userSummary: WorkspaceUserSummary | null;
  usageSummary: WorkspaceUsageSummary | null;
  quotaSummary: WorkspaceQuotaSummary | null;
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

export function computeDashboardSliceState(
  input: DashboardSliceStateInput,
): DashboardSliceState {
  if (input.isLoadingDashboard) {
    return 'loading';
  }

  if (input.dashboardError) {
    return 'error';
  }

  if (!input.userSummary || !input.usageSummary || !input.quotaSummary) {
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
