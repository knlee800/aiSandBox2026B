import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WorkspaceShell from './workspace-shell';
import type { WorkspaceCheckpoint, WorkspaceShellSession } from './workspace-shell.logic';

const session: WorkspaceShellSession = {
  id: '12345678-test-session',
  status: 'active',
  terminatedAt: null,
  terminationReason: null,
};

const checkpoint: WorkspaceCheckpoint = {
  id: 'checkpoint-1',
  commitHash: 'abc123def456789012345678901234567890abcd',
  messageNumber: 10,
  description: 'Auto-commit: Message 10',
  filesChanged: 1,
  createdAt: '2026-03-10T12:00:00.000Z',
};

const userSummary = {
  userId: 'user-123',
  email: 'user@example.com',
  createdAt: '2026-03-10T12:00:00.000Z',
};

const usageSummary = {
  activeSessions: 1,
  sessionsCreated24h: 2,
  tokensUsed24h: 450,
  estimatedCost: 0.045,
  resetAt: '2026-03-11T12:00:00.000Z',
};

const quotaSummary = {
  maxActiveSessions: 5,
  currentActiveSessions: 1,
  maxSessions24h: 20,
  currentSessions24h: 2,
  maxTokens24h: 100000,
  currentTokens24h: 450,
  resetAt: '2026-03-11T12:00:00.000Z',
};

describe('workspace shell component', () => {
  test('renders authenticated workspace shell layout', () => {
    const html = renderToStaticMarkup(
      <WorkspaceShell
        sessions={[session]}
        selectedSessionId={session.id}
        isLoadingSessions={false}
        sessionError={null}
        onSelectSession={() => {}}
        onCreateSession={async () => {}}
        isCreatingSession={false}
        userId="user-123"
        checkpoints={[checkpoint]}
        isLoadingHistory={false}
        historyError={null}
        userSummary={userSummary}
        usageSummary={usageSummary}
        quotaSummary={quotaSummary}
        isLoadingDashboard={false}
        dashboardError={null}
      />,
    );

    assert.match(html, /AI Sandbox Workspace/);
    assert.match(html, /Chat Panel/);
    assert.match(html, /Editor Panel/);
    assert.match(html, /Preview Panel/);
    assert.match(html, /History \/ Control \(Slice 1\)/);
    assert.match(html, /Dashboard \(Slice 1\)/);
    assert.match(html, /Session 12345678/);
    assert.match(html, /Auto-commit: Message 10/);
    assert.match(html, /Current User/);
    assert.match(html, /user@example\.com/);
    assert.match(html, /Active Sessions/);
  });

  test('renders loading shell state', () => {
    const html = renderToStaticMarkup(
      <WorkspaceShell
        sessions={[session]}
        selectedSessionId={session.id}
        isLoadingSessions={true}
        sessionError={null}
        onSelectSession={() => {}}
        onCreateSession={async () => {}}
        isCreatingSession={false}
        userId={null}
        checkpoints={[]}
        isLoadingHistory={true}
        historyError={null}
        userSummary={null}
        usageSummary={null}
        quotaSummary={null}
        isLoadingDashboard={true}
        dashboardError={null}
      />,
    );

    assert.match(html, /Loading workspace shell\.\.\./);
    assert.match(html, /Loading checkpoint history\.\.\./);
    assert.match(html, /Loading dashboard summary\.\.\./);
  });

  test('renders error shell state', () => {
    const html = renderToStaticMarkup(
      <WorkspaceShell
        sessions={[session]}
        selectedSessionId={session.id}
        isLoadingSessions={false}
        sessionError="Failed to load sessions."
        onSelectSession={() => {}}
        onCreateSession={async () => {}}
        isCreatingSession={false}
        userId={null}
        checkpoints={[]}
        isLoadingHistory={false}
        historyError="Failed to load checkpoints."
        userSummary={null}
        usageSummary={null}
        quotaSummary={null}
        isLoadingDashboard={false}
        dashboardError="Failed to load dashboard summary."
      />,
    );

    assert.match(html, /Unable to load sessions for workspace shell\./);
    assert.match(html, /Unable to load checkpoint history\./);
    assert.match(html, /Unable to load dashboard summary\./);
  });

  test('renders empty history state for selected session without checkpoints', () => {
    const html = renderToStaticMarkup(
      <WorkspaceShell
        sessions={[session]}
        selectedSessionId={session.id}
        isLoadingSessions={false}
        sessionError={null}
        onSelectSession={() => {}}
        onCreateSession={async () => {}}
        isCreatingSession={false}
        userId={null}
        checkpoints={[]}
        isLoadingHistory={false}
        historyError={null}
        userSummary={null}
        usageSummary={null}
        quotaSummary={null}
        isLoadingDashboard={false}
        dashboardError={null}
      />,
    );

    assert.match(html, /No checkpoint history available for the selected session\./);
    assert.match(html, /No dashboard data available for this user\./);
  });

  test('does not render out-of-scope history or dashboard UI', () => {
    const html = renderToStaticMarkup(
      <WorkspaceShell
        sessions={[session]}
        selectedSessionId={session.id}
        isLoadingSessions={false}
        sessionError={null}
        onSelectSession={() => {}}
        onCreateSession={async () => {}}
        isCreatingSession={false}
        userId={null}
        checkpoints={[checkpoint]}
        isLoadingHistory={false}
        historyError={null}
        userSummary={userSummary}
        usageSummary={usageSummary}
        quotaSummary={quotaSummary}
        isLoadingDashboard={false}
        dashboardError={null}
      />,
    );

    assert.ok(!html.includes('Timeline'));
    assert.ok(!html.includes('Admin Dashboard'));
    assert.ok(!html.includes('Diff'));
    assert.ok(!html.includes('Revert'));
    assert.ok(!html.includes('Export Data'));
  });
});
