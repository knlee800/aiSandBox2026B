import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WorkspaceSidebar from './workspace-sidebar';
import type { Workspace } from './workspace-workspaces.logic';
import enMessages from '@/messages/en.json';
import zhTwMessages from '@/messages/zh-TW.json';
import zhCnMessages from '@/messages/zh-CN.json';

const workspaces: Workspace[] = [
  {
    id: 'workspace-1',
    userId: 'user-123',
    name: 'Workspace 1',
    slug: 'workspace-1',
    isDefault: true,
    createdAt: '2026-03-10T12:00:00.000Z',
    updatedAt: '2026-03-10T12:00:00.000Z',
  },
];

const userSummary = {
  userId: 'user-123',
  email: 'user@example.com',
  createdAt: '2026-03-10T12:00:00.000Z',
  planCode: 'free',
  planName: 'Free',
  planStatus: 'active' as const,
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

function renderSidebar(
  overrides: Partial<ComponentProps<typeof WorkspaceSidebar>> = {},
): string {
  return renderToStaticMarkup(
    createElement(WorkspaceSidebar, {
      locale: 'en',
      workspaces,
      selectedWorkspaceId: 'workspace-1',
      workspaceView: 'home',
      recentProjects: [],
      userSummary,
      usageSummary,
      quotaSummary,
      activeSessions: 1,
      ...overrides,
    }),
  );
}

describe('workspace sidebar credit balance row', () => {
  test('expanded sidebar renders credit row under sessions and tokens', () => {
    const html = renderSidebar({ creditBalance: 12 });

    assert.match(html, /workspace-sidebar-compact-usage/);
    assert.match(html, /workspace-sidebar-credit-balance/);
    assert.match(html, /workspace-sidebar-credit-balance-value/);
    assert.match(html, /workspace-sidebar-credit-balance-hint/);
    assert.match(html, />12</);
    assert.match(html, /Credit balance/);
    assert.match(html, /Separate from token and session quota/);
    assert.match(html, /Active sessions/);
    assert.match(html, />Tokens</);
    assert.match(html, /Credit balance[\s\S]*Separate from token and session quota/);
    assert.doesNotMatch(html, />Quota</);
  });

  test('zh-TW and zh-CN render frozen credit labels without leftover English', () => {
    const zhTwHtml = renderSidebar({ locale: 'zh-TW', creditBalance: 12 });
    const zhCnHtml = renderSidebar({ locale: 'zh-CN', creditBalance: 12 });

    assert.match(zhTwHtml, /信用餘額/);
    assert.match(zhTwHtml, /與 token 及工作階段配額不同/);
    assert.doesNotMatch(zhTwHtml, /Credit balance/);
    assert.match(zhTwHtml, /活躍工作階段/);
    assert.match(zhTwHtml, /代幣/);

    assert.match(zhCnHtml, /信用余额/);
    assert.match(zhCnHtml, /与 token 及会话配额不同/);
    assert.doesNotMatch(zhCnHtml, /Credit balance/);
    assert.match(zhCnHtml, /活跃会话/);
    assert.match(zhCnHtml, /令牌/);

    assert.equal(enMessages.workspace.creditBalance, 'Credit balance');
    assert.equal(zhTwMessages.workspace.creditBalance, '信用餘額');
    assert.equal(zhCnMessages.workspace.creditBalance, '信用余额');
  });

  test('loading state is row-local and does not hide tokens or sessions', () => {
    const html = renderSidebar({ creditBalanceLoading: true });

    assert.match(html, /workspace-sidebar-credit-balance-loading/);
    assert.match(html, /Loading credit balance\.\.\./);
    assert.match(html, /Active sessions/);
    assert.match(html, />Tokens</);
    assert.doesNotMatch(html, /workspace-sidebar-credit-balance-value/);
  });

  test('error state is row-local', () => {
    const html = renderSidebar({ creditBalanceError: true });

    assert.match(html, /workspace-sidebar-credit-balance-error/);
    assert.match(html, /Credit balance unavailable/);
    assert.match(html, /Active sessions/);
    assert.match(html, />Tokens</);
  });

  test('omitted credit props keep compact usage markup without a credit row', () => {
    const html = renderSidebar();

    assert.match(html, /workspace-sidebar-compact-usage/);
    assert.match(html, /Active sessions/);
    assert.match(html, />Tokens</);
    assert.doesNotMatch(html, /workspace-sidebar-credit-balance/);
    assert.doesNotMatch(html, /workspace-sidebar-credit-balance-value/);
    assert.doesNotMatch(html, /workspace-sidebar-credit-balance-hint/);
    assert.doesNotMatch(html, /workspace-sidebar-credit-balance-loading/);
    assert.doesNotMatch(html, /workspace-sidebar-credit-balance-error/);
  });

  test('collapsed sidebar still hides compact usage and the credit row', () => {
    const html = renderSidebar({
      initialCompact: true,
      creditBalance: 12,
    });

    assert.doesNotMatch(html, /workspace-sidebar-compact-usage/);
    assert.doesNotMatch(html, /workspace-sidebar-credit-balance/);
  });

  test('unprovisioned balance 0 displays 0', () => {
    const html = renderSidebar({ creditBalance: 0 });

    assert.match(html, /workspace-sidebar-credit-balance-value/);
    assert.match(html, />0</);
    assert.match(html, /Credit balance/);
    assert.match(html, /Separate from token and session quota/);
  });
});
