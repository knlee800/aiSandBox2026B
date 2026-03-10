import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WorkspaceShell from './workspace-shell';
import type { WorkspaceShellSession } from './workspace-shell.logic';

const session: WorkspaceShellSession = {
  id: '12345678-test-session',
  status: 'active',
  terminatedAt: null,
  terminationReason: null,
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
      />,
    );

    assert.match(html, /AI Sandbox Workspace/);
    assert.match(html, /Chat Panel/);
    assert.match(html, /Editor Panel/);
    assert.match(html, /Preview Panel/);
    assert.match(html, /Session 12345678/);
  });

  test('renders loading shell state', () => {
    const html = renderToStaticMarkup(
      <WorkspaceShell
        sessions={[]}
        selectedSessionId={null}
        isLoadingSessions={true}
        sessionError={null}
        onSelectSession={() => {}}
        onCreateSession={async () => {}}
        isCreatingSession={false}
        userId={null}
      />,
    );

    assert.match(html, /Loading workspace shell\.\.\./);
  });

  test('renders error shell state', () => {
    const html = renderToStaticMarkup(
      <WorkspaceShell
        sessions={[]}
        selectedSessionId={null}
        isLoadingSessions={false}
        sessionError="Failed to load sessions."
        onSelectSession={() => {}}
        onCreateSession={async () => {}}
        isCreatingSession={false}
        userId={null}
      />,
    );

    assert.match(html, /Unable to load sessions for workspace shell\./);
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
      />,
    );

    assert.ok(!html.includes('Timeline'));
    assert.ok(!html.includes('Dashboard'));
    assert.ok(!html.includes('Diff'));
    assert.ok(!html.includes('Revert'));
  });
});
