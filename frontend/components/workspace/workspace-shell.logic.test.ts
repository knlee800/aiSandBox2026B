import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  areCheckpointListsEqual,
  computeDashboardSliceState,
  HISTORY_WORKING_SET_MAX_ITEMS,
  computeHistorySliceState,
  filterVisibleWorkspaceCheckpoints,
  computeWorkspaceShellState,
  countActiveSessions,
  getSessionLabel,
  reconcileWorkspaceCheckpointWorkingSetIds,
  toggleWorkspaceCheckpointWorkingSetId,
  type WorkspaceCheckpoint,
  type WorkspaceShellSession,
} from './workspace-shell.logic';

const activeSession: WorkspaceShellSession = {
  id: 'active-session-id',
  status: 'active',
  expiresAt: '3026-03-10T00:00:00.000Z',
  terminatedAt: null,
  terminationReason: null,
};

const terminatedSession: WorkspaceShellSession = {
  id: 'terminated-session-id',
  status: 'stopped',
  expiresAt: '3026-03-10T00:00:00.000Z',
  terminatedAt: '2026-03-10T00:00:00.000Z',
  terminationReason: 'manual',
};

const expiredSession: WorkspaceShellSession = {
  id: 'expired-session-id',
  status: 'pending',
  expiresAt: '2020-03-10T00:00:00.000Z',
  terminatedAt: null,
  terminationReason: null,
};

const checkpoint: WorkspaceCheckpoint = {
  id: 'checkpoint-1',
  commitHash: 'abc123def456789012345678901234567890abcd',
  messageNumber: 7,
  description: 'Auto-commit: Message 7',
  filesChanged: 2,
  createdAt: '2026-03-10T10:00:00.000Z',
};

const secondaryCheckpoint: WorkspaceCheckpoint = {
  id: 'checkpoint-2',
  commitHash: 'f0f0f0f0f0f0789012345678901234567890abcd',
  messageNumber: 8,
  description: null,
  filesChanged: 1,
  createdAt: '2026-03-10T10:10:00.000Z',
};

describe('workspace shell logic', () => {
  test('returns loading when sessions are loading', () => {
    const state = computeWorkspaceShellState({
      isLoadingSessions: true,
      sessionError: null,
      sessions: [],
      selectedSessionId: null,
    });

    assert.equal(state, 'loading');
  });

  test('returns error when session error is present', () => {
    const state = computeWorkspaceShellState({
      isLoadingSessions: false,
      sessionError: 'failed',
      sessions: [activeSession],
      selectedSessionId: activeSession.id,
    });

    assert.equal(state, 'error');
  });

  test('returns empty when no selected session exists', () => {
    const state = computeWorkspaceShellState({
      isLoadingSessions: false,
      sessionError: null,
      sessions: [activeSession],
      selectedSessionId: null,
    });

    assert.equal(state, 'empty');
  });

  test('returns ready when selected session exists', () => {
    const state = computeWorkspaceShellState({
      isLoadingSessions: false,
      sessionError: null,
      sessions: [activeSession],
      selectedSessionId: activeSession.id,
    });

    assert.equal(state, 'ready');
  });

  test('counts only usable sessions as active', () => {
    assert.equal(countActiveSessions([activeSession, terminatedSession, expiredSession]), 1);
  });

  test('returns deterministic session labels', () => {
    assert.equal(getSessionLabel(activeSession), 'active');
    assert.equal(getSessionLabel(terminatedSession), 'terminated');
    assert.equal(getSessionLabel(expiredSession), 'expired');
  });

  test('history slice returns empty without selected session', () => {
    const state = computeHistorySliceState({
      selectedSessionId: null,
      isLoadingHistory: false,
      historyError: null,
      checkpoints: [checkpoint],
    });

    assert.equal(state, 'empty');
  });

  test('history slice returns loading while checkpoint fetch is pending', () => {
    const state = computeHistorySliceState({
      selectedSessionId: activeSession.id,
      isLoadingHistory: true,
      historyError: null,
      checkpoints: [],
    });

    assert.equal(state, 'loading');
  });

  test('history slice returns error when checkpoint fetch fails', () => {
    const state = computeHistorySliceState({
      selectedSessionId: activeSession.id,
      isLoadingHistory: false,
      historyError: 'failed',
      checkpoints: [],
    });

    assert.equal(state, 'error');
  });

  test('history slice returns ready when checkpoints exist', () => {
    const state = computeHistorySliceState({
      selectedSessionId: activeSession.id,
      isLoadingHistory: false,
      historyError: null,
      checkpoints: [checkpoint],
    });

    assert.equal(state, 'ready');
  });

  test('dashboard slice returns loading while dashboard fetch is pending', () => {
    const state = computeDashboardSliceState({
      isLoadingDashboard: true,
      dashboardError: null,
      userSummary: null,
      usageSummary: null,
      quotaSummary: null,
    });

    assert.equal(state, 'loading');
  });

  test('dashboard slice returns error when dashboard fetch fails', () => {
    const state = computeDashboardSliceState({
      isLoadingDashboard: false,
      dashboardError: 'failed',
      userSummary: null,
      usageSummary: null,
      quotaSummary: null,
    });

    assert.equal(state, 'error');
  });

  test('dashboard slice returns empty with partial dashboard payload', () => {
    const state = computeDashboardSliceState({
      isLoadingDashboard: false,
      dashboardError: null,
      userSummary: {
        userId: 'user-1',
        email: 'user@example.com',
        createdAt: '2026-03-10T00:00:00.000Z',
        planCode: 'free',
        planName: 'Free',
        planStatus: 'active',
      },
      usageSummary: null,
      quotaSummary: null,
    });

    assert.equal(state, 'empty');
  });

  test('dashboard slice returns ready with full dashboard payload', () => {
    const state = computeDashboardSliceState({
      isLoadingDashboard: false,
      dashboardError: null,
      userSummary: {
        userId: 'user-1',
        email: 'user@example.com',
        createdAt: '2026-03-10T00:00:00.000Z',
        planCode: 'free',
        planName: 'Free',
        planStatus: 'active',
      },
      usageSummary: {
        activeSessions: 1,
        sessionsCreated24h: 2,
        tokensUsed24h: 300,
        estimatedCost: 0.03,
        resetAt: '2026-03-11T00:00:00.000Z',
      },
      quotaSummary: {
        maxActiveSessions: 5,
        currentActiveSessions: 1,
        maxSessions24h: 20,
        currentSessions24h: 2,
        maxTokens24h: 100000,
        currentTokens24h: 300,
        resetAt: '2026-03-11T00:00:00.000Z',
      },
    });

    assert.equal(state, 'ready');
  });

  test('checkpoint list equality returns true when lists are identical', () => {
    const left: WorkspaceCheckpoint[] = [checkpoint];
    const right: WorkspaceCheckpoint[] = [
      {
        ...checkpoint,
      },
    ];

    assert.equal(areCheckpointListsEqual(left, right), true);
  });

  test('checkpoint list equality returns false when lists differ', () => {
    const left: WorkspaceCheckpoint[] = [checkpoint];
    const right: WorkspaceCheckpoint[] = [
      {
        ...checkpoint,
        commitHash: 'ffffffffffff789012345678901234567890abcd',
      },
    ];

    assert.equal(areCheckpointListsEqual(left, right), false);
  });

  test('filters visible checkpoints by bounded text search over label and hash', () => {
    const { visibleCheckpoints, totalMatches } = filterVisibleWorkspaceCheckpoints({
      checkpoints: [checkpoint, secondaryCheckpoint],
      searchQuery: 'f0f0f0f',
      descriptionFilter: 'all',
      maxVisible: 5,
    });

    assert.equal(totalMatches, 1);
    assert.deepEqual(
      visibleCheckpoints.map((item) => item.id),
      ['checkpoint-2'],
    );
  });

  test('filters visible checkpoints by description presence metadata', () => {
    const withDescription = filterVisibleWorkspaceCheckpoints({
      checkpoints: [checkpoint, secondaryCheckpoint],
      searchQuery: '',
      descriptionFilter: 'with-description',
      maxVisible: 5,
    });
    const withoutDescription = filterVisibleWorkspaceCheckpoints({
      checkpoints: [checkpoint, secondaryCheckpoint],
      searchQuery: '',
      descriptionFilter: 'without-description',
      maxVisible: 5,
    });

    assert.deepEqual(
      withDescription.visibleCheckpoints.map((item) => item.id),
      ['checkpoint-1'],
    );
    assert.equal(withDescription.totalMatches, 1);
    assert.deepEqual(
      withoutDescription.visibleCheckpoints.map((item) => item.id),
      ['checkpoint-2'],
    );
    assert.equal(withoutDescription.totalMatches, 1);
  });

  test('applies maxVisible bound after matching checkpoints', () => {
    const { visibleCheckpoints, totalMatches } = filterVisibleWorkspaceCheckpoints({
      checkpoints: [checkpoint, secondaryCheckpoint, { ...checkpoint, id: 'checkpoint-3' }],
      searchQuery: '',
      descriptionFilter: 'all',
      maxVisible: 2,
    });

    assert.equal(totalMatches, 3);
    assert.equal(visibleCheckpoints.length, 2);
    assert.deepEqual(
      visibleCheckpoints.map((item) => item.id),
      ['checkpoint-1', 'checkpoint-2'],
    );
  });

  test('toggles checkpoint ids in bounded working set', () => {
    const afterAddFirst = toggleWorkspaceCheckpointWorkingSetId({
      currentWorkingSetIds: [],
      checkpointId: 'checkpoint-1',
      maxItems: HISTORY_WORKING_SET_MAX_ITEMS,
    });
    const afterAddSecond = toggleWorkspaceCheckpointWorkingSetId({
      currentWorkingSetIds: afterAddFirst,
      checkpointId: 'checkpoint-2',
      maxItems: HISTORY_WORKING_SET_MAX_ITEMS,
    });
    const afterRemoveFirst = toggleWorkspaceCheckpointWorkingSetId({
      currentWorkingSetIds: afterAddSecond,
      checkpointId: 'checkpoint-1',
      maxItems: HISTORY_WORKING_SET_MAX_ITEMS,
    });

    assert.deepEqual(afterAddFirst, ['checkpoint-1']);
    assert.deepEqual(afterAddSecond, ['checkpoint-1', 'checkpoint-2']);
    assert.deepEqual(afterRemoveFirst, ['checkpoint-2']);
  });

  test('enforces max bound and reconciles stale working-set ids', () => {
    const cappedWorkingSet = toggleWorkspaceCheckpointWorkingSetId({
      currentWorkingSetIds: ['checkpoint-1', 'checkpoint-2'],
      checkpointId: 'checkpoint-3',
      maxItems: 2,
    });
    const reconciledWorkingSet = reconcileWorkspaceCheckpointWorkingSetIds({
      currentWorkingSetIds: ['checkpoint-1', 'checkpoint-2', 'checkpoint-2', 'missing-checkpoint'],
      checkpoints: [checkpoint],
      maxItems: HISTORY_WORKING_SET_MAX_ITEMS,
    });

    assert.deepEqual(cappedWorkingSet, ['checkpoint-1', 'checkpoint-2']);
    assert.deepEqual(reconciledWorkingSet, ['checkpoint-1']);
  });
});
