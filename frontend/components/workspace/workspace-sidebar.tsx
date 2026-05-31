'use client';

import React from 'react';
import type { ReactNode } from 'react';
import {
  ArrowsRightLeftIcon,
  ArrowUpIcon,
  BriefcaseIcon,
  FolderIcon,
  HomeIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';
import type {
  WorkspaceQuotaSummary,
  WorkspaceUsageSummary,
  WorkspaceUserSummary,
} from './workspace-shell.logic';
import type { WorkspaceProjectSummary } from './workspace-projects.logic';
import type { Workspace } from './workspace-workspaces.logic';
import enMessages from '@/messages/en.json';
import zhCnMessages from '@/messages/zh-CN.json';
import zhTwMessages from '@/messages/zh-TW.json';
import WorkspaceAccountMenu from './workspace-account-menu';

export type WorkspaceView = 'home' | 'projects' | 'templates' | 'project';

export interface WorkspaceSidebarRecentProject
  extends Pick<WorkspaceProjectSummary, 'id' | 'name' | 'updatedAt'> {}

interface WorkspaceSidebarProps {
  locale?: string;
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  onSelectWorkspaceId?: (workspaceId: string) => void;
  onOpenCreateWorkspaceFlow?: () => void;
  workspaceView: WorkspaceView;
  onWorkspaceViewChange?: (view: WorkspaceView) => void;
  recentProjects: WorkspaceSidebarRecentProject[];
  onOpenRecentProject?: (projectId: string) => void;
  userSummary?: WorkspaceUserSummary | null;
  usageSummary?: WorkspaceUsageSummary | null;
  quotaSummary?: WorkspaceQuotaSummary | null;
  activeSessions?: number;
  onLogout?: () => void;
  onLanguageChange?: (locale: string) => void;
  footerContent?: ReactNode;
}

function resolveNestedMessage(
  source: Record<string, unknown>,
  fullKey: string,
): string | null {
  const keys = fullKey.split('.');
  let value: unknown = source;

  for (const keyPart of keys) {
    if (value && typeof value === 'object' && keyPart in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[keyPart];
    } else {
      return null;
    }
  }

  return typeof value === 'string' ? value : null;
}

function getLocaleMessages(locale?: string): Record<string, unknown> {
  if (locale === 'zh-TW') {
    return zhTwMessages as Record<string, unknown>;
  }
  if (locale === 'zh-CN') {
    return zhCnMessages as Record<string, unknown>;
  }
  return enMessages as Record<string, unknown>;
}

export function getWorkspaceScaffoldMessages(locale?: string) {
  const activeMessages = getLocaleMessages(locale);
  const fallbackMessages = enMessages as Record<string, unknown>;
  const read = (fullKey: string): string =>
    resolveNestedMessage(activeMessages, fullKey) ??
    resolveNestedMessage(fallbackMessages, fullKey) ??
    fullKey;

  return {
    appName: read('common.appName'),
    search: read('common.search'),
    home: read('workspace.home'),
    projects: read('workspace.projects'),
    workspaceLabel: read('workspace.workspaceLabel'),
    createNewWorkspace: read('workspace.createNewWorkspace'),
    gridView: read('workspace.gridView'),
    listView: read('workspace.listView'),
    fork: read('workspace.fork'),
    forking: read('workspace.forking'),
    templates: read('workspace.templates'),
    recentProjects: read('workspace.recentProjects'),
    upgrade: read('workspace.upgrade'),
    newProject: read('workspace.newProject'),
    noProjects: read('workspace.noProjects'),
    noTemplates: read('workspace.noTemplates'),
    buildAnything: read('workspace.buildAnything'),
    describeBuild: read('workspace.describeBuild'),
    start: read('workspace.start'),
    starting: read('workspace.starting'),
    logout: read('account.logout'),
    settings: read('account.settings'),
    language: read('account.language'),
    theme: read('account.theme'),
    help: read('account.help'),
    referral: read('account.referral'),
    light: read('account.light'),
    dark: read('account.dark'),
    comingSoon: read('tabs.comingSoon'),
    activeSessions: read('workspace.activeSessions'),
    tokens: read('workspace.tokens'),
    expandSidebar: read('workspace.expandSidebar'),
    collapseSidebar: read('workspace.collapseSidebar'),
  };
}

function formatRecentProjectUpdatedAt(value: string): string {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString();
}

function getUserAvatarInitial(userEmail?: string | null): string {
  const trimmedEmail = userEmail?.trim();
  if (!trimmedEmail) {
    return 'U';
  }

  return trimmedEmail.charAt(0).toUpperCase();
}

export default function WorkspaceSidebar(props: WorkspaceSidebarProps) {
  const CREATE_NEW_WORKSPACE_OPTION_VALUE = '__create-new-workspace__';
  const messages = getWorkspaceScaffoldMessages(props.locale);
  const [isCompact, setIsCompact] = React.useState(false);
  const [isCompactWorkspaceMenuOpen, setIsCompactWorkspaceMenuOpen] = React.useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = React.useState(false);
  const accountMenuRef = React.useRef<HTMLDivElement | null>(null);
  const compactWorkspaceMenuRef = React.useRef<HTMLDivElement | null>(null);
  const selectedWorkspace =
    props.workspaces.find((workspace) => workspace.id === props.selectedWorkspaceId) ?? null;
  const canShowCompactUsage = Boolean(
    props.userSummary && props.usageSummary && props.quotaSummary,
  );
  const accountAvatarInitial = getUserAvatarInitial(props.userSummary?.email);
  const compactToggleLabel = isCompact ? messages.expandSidebar : messages.collapseSidebar;
  const compactWorkspaceMark = selectedWorkspace?.name?.trim().charAt(0).toUpperCase() || 'W';

  React.useEffect(() => {
    if (!accountMenuOpen && !isCompactWorkspaceMenuOpen) {
      return undefined;
    }

    function handleDocumentMouseDown(event: MouseEvent): void {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (accountMenuOpen && !accountMenuRef.current?.contains(target)) {
        setAccountMenuOpen(false);
      }
      if (isCompactWorkspaceMenuOpen && !compactWorkspaceMenuRef.current?.contains(target)) {
        setIsCompactWorkspaceMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
    };
  }, [accountMenuOpen, isCompactWorkspaceMenuOpen]);

  React.useEffect(() => {
    if (!isCompact) {
      setIsCompactWorkspaceMenuOpen(false);
    }
  }, [isCompact]);

  const handleWorkspaceSelectorChange = (workspaceId: string): void => {
    if (workspaceId === CREATE_NEW_WORKSPACE_OPTION_VALUE) {
      props.onOpenCreateWorkspaceFlow?.();
      return;
    }

    props.onSelectWorkspaceId?.(workspaceId);
  };

  const handleCompactAreaClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget) {
      return;
    }
    setIsCompact(false);
  };

  const handleCompactAreaKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    setIsCompact(false);
  };

  const sidebarNavigationItems = [
    { view: 'home' as const, label: messages.home, icon: HomeIcon },
    { view: 'projects' as const, label: messages.projects, icon: FolderIcon },
    { view: 'templates' as const, label: messages.templates, icon: Squares2X2Icon },
  ];

  return (
    <aside
      className={`h-full w-full shrink-0 border-b border-gray-200 bg-white md:border-b-0 md:border-r ${
        isCompact ? 'md:w-20' : 'md:w-72'
      }`}
      data-testid="workspace-sidebar"
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-gray-100 px-4 py-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2" data-testid="workspace-sidebar-logo">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-900 text-xs font-semibold tracking-wide text-white"
                  data-testid="workspace-sidebar-logo-mark"
                  aria-hidden="true"
                >
                  AS
                </span>
                <span className="sr-only">{messages.appName}</span>
              </div>
            </div>
            {!isCompact ? (
              <button
                type="button"
                onClick={() => setIsCompact((current) => !current)}
                className="rounded border border-gray-300 bg-white p-1.5 text-gray-600 hover:bg-gray-50"
                aria-label={compactToggleLabel}
                title={compactToggleLabel}
                data-testid="workspace-sidebar-compact-toggle"
              >
                <ArrowsRightLeftIcon
                  className="h-5 w-5 text-gray-600"
                  data-testid="workspace-sidebar-compact-toggle-icon"
                  aria-hidden="true"
                />
              </button>
            ) : null}
          </div>
        </div>

        {!isCompact ? (
          <div className="border-b border-gray-100 px-4 py-3">
            <label
              htmlFor="workspace-sidebar-workspace-select"
              className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-gray-500"
            >
              {messages.workspaceLabel}
            </label>
            <select
              id="workspace-sidebar-workspace-select"
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              value={props.selectedWorkspaceId ?? ''}
              onChange={(event) => handleWorkspaceSelectorChange(event.target.value)}
              data-testid="workspace-sidebar-workspace-select"
            >
              <option value="" disabled>
                {selectedWorkspace?.name ?? messages.workspaceLabel}
              </option>
              {props.workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
              <option value={CREATE_NEW_WORKSPACE_OPTION_VALUE}>{messages.createNewWorkspace}</option>
            </select>
          </div>
        ) : (
          <div className="border-b border-gray-100 px-3 py-3">
            <div className="relative flex justify-center" ref={compactWorkspaceMenuRef}>
              <button
                type="button"
                onClick={() => setIsCompactWorkspaceMenuOpen((current) => !current)}
                className="flex h-10 w-10 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                aria-label={messages.workspaceLabel}
                title={messages.workspaceLabel}
                data-testid="workspace-sidebar-compact-workspace-toggle"
              >
                <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                  {compactWorkspaceMark}
                </span>
                <BriefcaseIcon
                  className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-white p-0.5 text-gray-600"
                  data-testid="workspace-sidebar-compact-workspace-icon"
                  aria-hidden="true"
                />
              </button>
              {isCompactWorkspaceMenuOpen ? (
                <div
                  className="absolute left-full top-0 z-20 ml-2 w-60 rounded border border-gray-200 bg-white p-3 shadow-sm"
                  data-testid="workspace-sidebar-compact-workspace-menu"
                >
                  <label
                    htmlFor="workspace-sidebar-workspace-select"
                    className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-gray-500"
                  >
                    {messages.workspaceLabel}
                  </label>
                  <select
                    id="workspace-sidebar-workspace-select"
                    className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    value={props.selectedWorkspaceId ?? ''}
                    onChange={(event) => {
                      handleWorkspaceSelectorChange(event.target.value);
                      setIsCompactWorkspaceMenuOpen(false);
                    }}
                    data-testid="workspace-sidebar-workspace-select"
                  >
                    <option value="" disabled>
                      {selectedWorkspace?.name ?? messages.workspaceLabel}
                    </option>
                    {props.workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.name}
                      </option>
                    ))}
                    <option value={CREATE_NEW_WORKSPACE_OPTION_VALUE}>
                      {messages.createNewWorkspace}
                    </option>
                  </select>
                </div>
              ) : null}
            </div>
          </div>
        )}

        <div className="border-b border-gray-100 px-3 py-3">
          <div className="space-y-1">
            {sidebarNavigationItems.map(({ view, label, icon: Icon }) => {
              const isActive = props.workspaceView === view;
              return (
                <button
                  key={view}
                  type="button"
                  onClick={() => props.onWorkspaceViewChange?.(view)}
                  className={`group flex w-full items-center rounded px-3 py-2 text-left text-sm ${
                    isActive
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  } ${isCompact ? 'justify-center' : 'justify-between'}`}
                  data-testid={`workspace-sidebar-nav-${view}`}
                  aria-current={isActive ? 'page' : undefined}
                  title={isCompact ? label : undefined}
                >
                  <span className="flex items-center gap-2">
                    <Icon
                      className={`h-5 w-5 ${
                        isActive ? 'text-white' : 'text-gray-600 group-hover:text-gray-700'
                      }`}
                      data-testid={`workspace-sidebar-nav-icon-${view}`}
                      aria-hidden="true"
                    />
                    <span className={isCompact ? 'sr-only' : 'truncate'}>{label}</span>
                  </span>
                  {!isCompact && isActive ? <span className="text-xs text-gray-300">Current</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="flex-1 overflow-y-auto px-4 py-4"
          onClick={isCompact ? handleCompactAreaClick : undefined}
          onKeyDown={isCompact ? handleCompactAreaKeyDown : undefined}
          role={isCompact ? 'button' : undefined}
          tabIndex={isCompact ? 0 : undefined}
          aria-label={isCompact ? messages.expandSidebar : undefined}
          data-testid={isCompact ? 'workspace-sidebar-compact-expand-area' : undefined}
        >
          {!isCompact ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                {messages.recentProjects}
              </p>
              <div className="mt-3 space-y-2">
                {props.recentProjects.length > 0 ? (
                  props.recentProjects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => props.onOpenRecentProject?.(project.id)}
                      className="w-full rounded border border-gray-200 bg-white px-3 py-2 text-left hover:bg-gray-50"
                      data-testid={`workspace-sidebar-recent-project-${project.id}`}
                    >
                      <p className="truncate text-sm font-medium text-gray-900">{project.name}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatRecentProjectUpdatedAt(project.updatedAt)}
                      </p>
                    </button>
                  ))
                ) : (
                  <p
                    className="rounded border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-500"
                    data-testid="workspace-sidebar-no-recent-projects"
                  >
                    {messages.noProjects}
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {!isCompact && canShowCompactUsage ? (
            <div
              className="mt-6 rounded border border-gray-200 bg-gray-50 p-3"
              data-testid="workspace-sidebar-compact-usage"
            >
              <p className="text-xs font-medium text-gray-700">
                {props.userSummary?.planName}
              </p>
              <p className="text-[11px] text-gray-500">{props.userSummary?.planStatus}</p>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{messages.activeSessions}</span>
                  <span className="text-xs font-medium text-gray-700">
                    {props.activeSessions ?? 0} / {props.quotaSummary?.maxActiveSessions ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{messages.tokens}</span>
                  <span className="text-xs font-medium text-gray-700">
                    {props.usageSummary?.tokensUsed24h ?? 0} /{' '}
                    {props.quotaSummary?.maxTokens24h ?? 0}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div
          className="mt-auto border-t border-gray-100 px-4 py-4"
          data-testid="workspace-sidebar-bottom-controls"
        >
          <button
            type="button"
            disabled
            className={`rounded border border-gray-300 bg-white font-medium text-gray-700 ${
              isCompact
                ? 'flex h-10 w-10 items-center justify-center p-0'
                : 'flex w-full items-center justify-between px-3 py-2 text-sm'
            }`}
            data-testid="workspace-sidebar-upgrade-button"
            aria-label={messages.upgrade}
            title={messages.upgrade}
          >
            {isCompact ? (
              <ArrowUpIcon
                className="h-5 w-5 text-gray-600"
                data-testid="workspace-sidebar-upgrade-icon"
                aria-hidden="true"
              />
            ) : (
              <>
                <span>{messages.upgrade}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                  {messages.comingSoon}
                </span>
              </>
            )}
          </button>
          <div className="relative mt-2" ref={accountMenuRef}>
            <button
              type="button"
              onClick={() => setAccountMenuOpen((current) => !current)}
              className={`rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 ${
                isCompact
                  ? 'flex h-10 w-10 items-center justify-center p-0'
                  : 'flex w-full items-center gap-3 px-3 py-2 text-left'
              }`}
              data-testid="workspace-sidebar-account-avatar"
              aria-expanded={accountMenuOpen}
              aria-label={props.userSummary?.email ?? messages.settings}
              title={props.userSummary?.email ?? messages.settings}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
                {accountAvatarInitial}
              </span>
              {!isCompact ? (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900">
                    {props.userSummary?.email ?? messages.settings}
                  </span>
                  <span className="block truncate text-xs text-gray-500">{messages.language}</span>
                </span>
              ) : null}
            </button>
            <WorkspaceAccountMenu
              userEmail={props.userSummary?.email}
              isOpen={accountMenuOpen}
              onClose={() => setAccountMenuOpen(false)}
              onLogout={props.onLogout}
              currentLocale={props.locale}
              onLanguageChange={props.onLanguageChange}
              settingsLabel={messages.settings}
              languageLabel={messages.language}
              themeLabel={messages.theme}
              helpLabel={messages.help}
              referralLabel={messages.referral}
              logoutLabel={messages.logout}
              lightLabel={messages.light}
              darkLabel={messages.dark}
            />
          </div>
        </div>

        {!isCompact && props.footerContent ? props.footerContent : null}
      </div>
    </aside>
  );
}
