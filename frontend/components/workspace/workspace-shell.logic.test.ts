import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  computeWorkspaceShellState,
  countActiveSessions,
  getSessionLabel,
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
});
