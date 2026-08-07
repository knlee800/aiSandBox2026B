import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WorkspaceAccountMenu from './workspace-account-menu';

function renderAccountMenu(userRole: string | null | undefined): string {
  return renderToStaticMarkup(
    <WorkspaceAccountMenu
      userEmail="admin@example.com"
      isOpen={true}
      currentLocale="en"
      onClose={() => {}}
      onLogout={() => {}}
      onLanguageChange={() => {}}
      settingsLabel="Settings"
      languageLabel="Language"
      themeLabel="Theme"
      helpLabel="Help"
      referralLabel="Referral"
      logoutLabel="Log out"
      lightLabel="Light"
      darkLabel="Dark"
      userRole={userRole}
    />,
  );
}

describe('workspace account menu admin link visibility', () => {
  test('shows Admin Console link for admin role', () => {
    const html = renderAccountMenu('admin');
    assert.match(html, /workspace-account-menu-admin-link/);
    assert.match(html, /href="\/en\/admin"/);
  });

  test('hides Admin Console link for non-admin role', () => {
    const html = renderAccountMenu('user');
    assert.doesNotMatch(html, /workspace-account-menu-admin-link/);
    assert.doesNotMatch(html, /href="\/en\/admin"/);
  });

  test('hides Admin Console link when role is missing', () => {
    const html = renderAccountMenu(null);
    assert.doesNotMatch(html, /workspace-account-menu-admin-link/);
  });
});
