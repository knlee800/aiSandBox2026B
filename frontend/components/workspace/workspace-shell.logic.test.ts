import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  computeHistorySliceState,
  computeWorkspaceShellState,
  countActiveSessions,
  getSessionLabel,
  type WorkspaceCheckpoint,
  type WorkspaceShellSession,
} from './workspace-shell.logic';

const activeSession: WorkspaceShellSession = {
  id: 'active-session-id',
  status: 'active',
  terminatedAt: null,
  terminationReason: null,
};

const terminatedSession: WorkspaceShellSession = {
  id: 'terminated-session-id',
  status: 'stopped',
  terminatedAt: '2026-03-10T00:00:00.000Z',
  terminationReason: 'manual',
};

const checkpoint: WorkspaceCheckpoint = {
  id: 'checkpoint-1',
  commitHash: 'abc123def456789012345678901234567890abcd',
  messageNumber: 7,
  description: 'Auto-commit: Message 7',
  filesChanged: 2,
  createdAt: '2026-03-10T10:00:00.000Z',
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

  test('counts only non-terminated sessions as active', () => {
    assert.equal(countActiveSessions([activeSession, terminatedSession]), 1);
  });

  test('returns deterministic session labels', () => {
    assert.equal(getSessionLabel(activeSession), 'active');
    assert.equal(getSessionLabel(terminatedSession), 'terminated');
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
});
