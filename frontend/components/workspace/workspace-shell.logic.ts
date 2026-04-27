export type WorkspaceShellState = 'loading' | 'error' | 'empty' | 'ready';
export type HistorySliceState = 'loading' | 'error' | 'empty' | 'ready';
export type DashboardSliceState = 'loading' | 'error' | 'empty' | 'ready';

export interface WorkspaceShellSession {
  id: string;
  projectId: string | null;
  status: string;
  expiresAt?: string;
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

export type CheckpointDescriptionFilter = 'all' | 'with-description' | 'without-description';
export const HISTORY_WORKING_SET_MAX_ITEMS = 5;

export interface WorkspaceUserSummary {
  userId: string;
  email: string;
  createdAt: string;
  planCode: string;
  planName: string;
  planStatus: 'active' | 'cancelled' | 'expired';
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
  return sessions.filter((session) => isUsableSession(session)).length;
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

  if (isExpiredSession(session)) {
    return 'expired';
  }

  return session.status || 'pending';
}

export function isUsableSession(session: WorkspaceShellSession): boolean {
  return !session.terminatedAt && !isExpiredSession(session);
}

export function isExpiredSession(session: WorkspaceShellSession): boolean {
  if (!session.expiresAt) {
    return false;
  }

  const expiresAtMs = Date.parse(session.expiresAt);
  if (Number.isNaN(expiresAtMs)) {
    return false;
  }

  return expiresAtMs <= Date.now();
}

export function areCheckpointListsEqual(
  left: WorkspaceCheckpoint[],
  right: WorkspaceCheckpoint[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftCheckpoint = left[index];
    const rightCheckpoint = right[index];
    if (
      leftCheckpoint.id !== rightCheckpoint.id ||
      leftCheckpoint.commitHash !== rightCheckpoint.commitHash ||
      leftCheckpoint.messageNumber !== rightCheckpoint.messageNumber ||
      leftCheckpoint.description !== rightCheckpoint.description ||
      leftCheckpoint.filesChanged !== rightCheckpoint.filesChanged ||
      leftCheckpoint.createdAt !== rightCheckpoint.createdAt
    ) {
      return false;
    }
  }

  return true;
}

export function filterVisibleWorkspaceCheckpoints(input: {
  checkpoints: WorkspaceCheckpoint[];
  searchQuery: string;
  descriptionFilter: CheckpointDescriptionFilter;
  maxVisible: number;
}): { visibleCheckpoints: WorkspaceCheckpoint[]; totalMatches: number } {
  const normalizedQuery = input.searchQuery.trim().toLowerCase();
  const matchingCheckpoints = input.checkpoints.filter((checkpoint) => {
    const hasDescription = Boolean(checkpoint.description?.trim());
    if (input.descriptionFilter === 'with-description' && !hasDescription) {
      return false;
    }
    if (input.descriptionFilter === 'without-description' && hasDescription) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const visibleLabel = checkpoint.description?.trim()
      ? checkpoint.description.trim()
      : `Checkpoint ${checkpoint.commitHash.slice(0, 7)}`;
    const searchableMetadata = [visibleLabel, checkpoint.commitHash].join(' ').toLowerCase();
    return searchableMetadata.includes(normalizedQuery);
  });

  return {
    visibleCheckpoints: matchingCheckpoints.slice(0, Math.max(0, input.maxVisible)),
    totalMatches: matchingCheckpoints.length,
  };
}

export function toggleWorkspaceCheckpointWorkingSetId(input: {
  currentWorkingSetIds: string[];
  checkpointId: string;
  maxItems: number;
}): string[] {
  const nextWorkingSet = Array.from(new Set(input.currentWorkingSetIds));
  const existingIndex = nextWorkingSet.indexOf(input.checkpointId);
  if (existingIndex >= 0) {
    nextWorkingSet.splice(existingIndex, 1);
    return nextWorkingSet;
  }

  if (input.maxItems <= 0 || nextWorkingSet.length >= input.maxItems) {
    return nextWorkingSet;
  }

  nextWorkingSet.push(input.checkpointId);
  return nextWorkingSet;
}

export function reconcileWorkspaceCheckpointWorkingSetIds(input: {
  currentWorkingSetIds: string[];
  checkpoints: WorkspaceCheckpoint[];
  maxItems: number;
}): string[] {
  if (input.maxItems <= 0) {
    return [];
  }

  const validCheckpointIdSet = new Set(input.checkpoints.map((checkpoint) => checkpoint.id));
  const normalizedWorkingSet = Array.from(new Set(input.currentWorkingSetIds)).filter((checkpointId) =>
    validCheckpointIdSet.has(checkpointId),
  );

  return normalizedWorkingSet.slice(0, input.maxItems);
}
