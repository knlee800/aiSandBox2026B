'use client';

import React from 'react';
import enMessages from '@/messages/en.json';
import zhTwMessages from '@/messages/zh-TW.json';
import zhCnMessages from '@/messages/zh-CN.json';

export const GLOBAL_AI_INSTRUCTIONS_MAX_LENGTH = 4000;
const GLOBAL_AI_INSTRUCTIONS_UPDATED_EVENT = 'workspace:global-ai-instructions-updated';

interface UserAiInstructionsResponse {
  globalInstructions: string | null;
}

interface WorkspaceAccountMenuProps {
  userEmail?: string;
  isOpen: boolean;
  onClose?: () => void;
  onLogout?: () => void;
  currentLocale?: string;
  onLanguageChange?: (locale: string) => void;
  settingsLabel?: string;
  languageLabel?: string;
  themeLabel?: string;
  helpLabel?: string;
  referralLabel?: string;
  logoutLabel?: string;
  lightLabel?: string;
  darkLabel?: string;
  userRole?: string | null;
}

const localeOptions = [
  { code: 'en', label: 'English' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'zh-CN', label: '简体中文' },
] as const;

function getAvatarInitial(userEmail?: string): string {
  const trimmedEmail = userEmail?.trim();
  if (!trimmedEmail) {
    return 'U';
  }

  return trimmedEmail.charAt(0).toUpperCase();
}

function getAccountMessages(locale?: string): typeof enMessages.account {
  if (locale === 'zh-TW') {
    return zhTwMessages.account;
  }
  if (locale === 'zh-CN') {
    return zhCnMessages.account;
  }
  return enMessages.account;
}

function getAdminMessages(locale?: string): typeof enMessages.admin {
  if (locale === 'zh-TW') {
    return zhTwMessages.admin;
  }
  if (locale === 'zh-CN') {
    return zhCnMessages.admin;
  }
  return enMessages.admin;
}

export function normalizeGlobalAiInstructionsForApi(value: string): string | null {
  return value.trim().length === 0 ? null : value;
}

export async function fetchGlobalAiInstructionsFromApi(): Promise<string> {
  const response = await fetch('/api/user/ai-instructions', {
    method: 'GET',
  });
  if (!response.ok) {
    throw new Error(`Failed to load global AI instructions (${response.status})`);
  }

  const data = (await response.json()) as UserAiInstructionsResponse;
  return typeof data.globalInstructions === 'string' ? data.globalInstructions : '';
}

export async function saveGlobalAiInstructionsToApi(globalInstructions: string | null): Promise<void> {
  const response = await fetch('/api/user/ai-instructions', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      globalInstructions,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to save global AI instructions (${response.status})`);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(GLOBAL_AI_INSTRUCTIONS_UPDATED_EVENT, {
        detail: {
          isActive: typeof globalInstructions === 'string' && globalInstructions.trim().length > 0,
        },
      }),
    );
  }
}

export default function WorkspaceAccountMenu(props: WorkspaceAccountMenuProps) {
  const accountMessages = React.useMemo(
    () => getAccountMessages(props.currentLocale),
    [props.currentLocale],
  );
  const adminMessages = React.useMemo(
    () => getAdminMessages(props.currentLocale),
    [props.currentLocale],
  );
  const [globalInstructionsPanelOpen, setGlobalInstructionsPanelOpen] = React.useState(false);
  const [globalInstructionsInput, setGlobalInstructionsInput] = React.useState('');
  const [globalInstructionsLoading, setGlobalInstructionsLoading] = React.useState(false);
  const [globalInstructionsSaving, setGlobalInstructionsSaving] = React.useState(false);
  const [globalInstructionsLoadError, setGlobalInstructionsLoadError] = React.useState<string | null>(null);
  const [globalInstructionsSaveError, setGlobalInstructionsSaveError] = React.useState<string | null>(null);
  const [globalInstructionsSaved, setGlobalInstructionsSaved] = React.useState(false);
  const avatarInitial = getAvatarInitial(props.userEmail);
  const globalInstructionsCount = globalInstructionsInput.length;
  const globalInstructionsTooLong = globalInstructionsCount > GLOBAL_AI_INSTRUCTIONS_MAX_LENGTH;
  const localePrefix = props.currentLocale ? `/${props.currentLocale}` : '/en';

  React.useEffect(() => {
    if (!props.isOpen) {
      setGlobalInstructionsPanelOpen(false);
      return;
    }

    let canceled = false;
    setGlobalInstructionsLoading(true);
    setGlobalInstructionsLoadError(null);
    setGlobalInstructionsSaveError(null);
    setGlobalInstructionsSaved(false);

    void (async () => {
      try {
        const loadedInstructions = await fetchGlobalAiInstructionsFromApi();
        if (canceled) {
          return;
        }
        setGlobalInstructionsInput(loadedInstructions);
      } catch (error) {
        console.error('Failed to load global AI instructions:', error);
        if (canceled) {
          return;
        }
        setGlobalInstructionsLoadError(accountMessages.globalAiInstructionsLoadError);
      } finally {
        if (!canceled) {
          setGlobalInstructionsLoading(false);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [props.isOpen, accountMessages.globalAiInstructionsLoadError]);

  async function handleSaveGlobalInstructions(): Promise<void> {
    if (globalInstructionsLoading || globalInstructionsSaving || globalInstructionsTooLong) {
      return;
    }

    setGlobalInstructionsSaving(true);
    setGlobalInstructionsSaveError(null);
    setGlobalInstructionsSaved(false);
    try {
      const normalizedInstructions = normalizeGlobalAiInstructionsForApi(globalInstructionsInput);
      await saveGlobalAiInstructionsToApi(normalizedInstructions);
      setGlobalInstructionsInput(normalizedInstructions ?? '');
      setGlobalInstructionsSaved(true);
    } catch (error) {
      console.error('Failed to save global AI instructions:', error);
      setGlobalInstructionsSaveError(accountMessages.globalAiInstructionsSaveError);
    } finally {
      setGlobalInstructionsSaving(false);
    }
  }

  async function handleClearGlobalInstructions(): Promise<void> {
    if (globalInstructionsLoading || globalInstructionsSaving) {
      return;
    }

    setGlobalInstructionsSaving(true);
    setGlobalInstructionsSaveError(null);
    setGlobalInstructionsSaved(false);
    try {
      await saveGlobalAiInstructionsToApi(null);
      setGlobalInstructionsInput('');
      setGlobalInstructionsSaved(true);
    } catch (error) {
      console.error('Failed to clear global AI instructions:', error);
      setGlobalInstructionsSaveError(accountMessages.globalAiInstructionsSaveError);
    } finally {
      setGlobalInstructionsSaving(false);
    }
  }

  if (!props.isOpen) {
    return null;
  }

  return (
    <div
      className="absolute bottom-full left-0 z-20 mb-2 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg"
      data-testid="workspace-account-menu"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
          {avatarInitial}
        </div>
        <div className="min-w-0">
          {props.userEmail ? (
            <p className="truncate text-xs text-gray-500">{props.userEmail}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
          {props.languageLabel ?? 'Language'}
        </p>
        <div className="mt-2 flex flex-wrap gap-2" data-testid="workspace-account-menu-language">
          {localeOptions.map((localeOption) => {
            const isActive = props.currentLocale === localeOption.code;
            return (
              <button
                key={localeOption.code}
                type="button"
                onClick={() => {
                  props.onLanguageChange?.(localeOption.code);
                  props.onClose?.();
                }}
                className={`rounded px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                data-testid={`workspace-account-menu-language-${localeOption.code}`}
              >
                {localeOption.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4" data-testid="workspace-account-menu-theme">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
          {props.themeLabel ?? 'Theme'}
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white"
            data-testid="workspace-account-menu-theme-light"
          >
            {props.lightLabel ?? 'Light'}
          </button>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-400"
            data-testid="workspace-account-menu-theme-dark"
          >
            {props.darkLabel ?? 'Dark'}
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
        {props.userRole === 'admin' ? (
          <a
            href={`${localePrefix}/admin`}
            onClick={() => {
              props.onClose?.();
            }}
            className="block w-full rounded border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            data-testid="workspace-account-menu-admin-link"
          >
            {adminMessages.nav.console}
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => setGlobalInstructionsPanelOpen((current) => !current)}
          className="w-full rounded border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          data-testid="workspace-account-menu-settings"
          aria-expanded={globalInstructionsPanelOpen}
          aria-controls="workspace-global-ai-instructions-panel"
        >
          {props.settingsLabel ?? 'Settings'}
        </button>
        {globalInstructionsPanelOpen ? (
          <div
            id="workspace-global-ai-instructions-panel"
            className="rounded border border-gray-200 bg-gray-50 p-3"
            data-testid="workspace-global-ai-instructions-panel"
          >
            <h3 className="text-sm font-semibold text-gray-900" data-testid="workspace-global-ai-instructions-title">
              {accountMessages.globalAiInstructionsTitle}
            </h3>
            <p className="mt-1 text-xs text-gray-600">
              {accountMessages.globalAiInstructionsDescription}
            </p>
            {globalInstructionsLoading ? (
              <p
                className="mt-2 text-xs text-gray-500"
                data-testid="workspace-global-ai-instructions-loading"
              >
                {accountMessages.globalAiInstructionsLoading}
              </p>
            ) : null}
            {globalInstructionsLoadError ? (
              <p
                className="mt-2 text-xs text-red-600"
                data-testid="workspace-global-ai-instructions-load-error"
              >
                {globalInstructionsLoadError}
              </p>
            ) : null}
            <textarea
              value={globalInstructionsInput}
              onChange={(event) => {
                setGlobalInstructionsInput(event.target.value);
                setGlobalInstructionsSaveError(null);
                setGlobalInstructionsSaved(false);
              }}
              placeholder={accountMessages.globalAiInstructionsPlaceholder}
              className="mt-3 min-h-[120px] w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
              maxLength={GLOBAL_AI_INSTRUCTIONS_MAX_LENGTH + 1}
              data-testid="workspace-global-ai-instructions-input"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p
                className="text-xs text-gray-500"
                data-testid="workspace-global-ai-instructions-character-count"
              >
                {accountMessages.globalAiInstructionsCharacterCount}: {globalInstructionsCount} /{' '}
                {GLOBAL_AI_INSTRUCTIONS_MAX_LENGTH}
              </p>
              {globalInstructionsTooLong ? (
                <p
                  className="text-xs text-red-600"
                  data-testid="workspace-global-ai-instructions-too-long"
                >
                  {accountMessages.globalAiInstructionsTooLong}
                </p>
              ) : null}
            </div>
            {globalInstructionsSaved ? (
              <p
                className="mt-2 text-xs text-emerald-700"
                data-testid="workspace-global-ai-instructions-saved"
              >
                {accountMessages.globalAiInstructionsSaved}
              </p>
            ) : null}
            {globalInstructionsSaveError ? (
              <p
                className="mt-2 text-xs text-red-600"
                data-testid="workspace-global-ai-instructions-save-error"
              >
                {globalInstructionsSaveError}
              </p>
            ) : null}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSaveGlobalInstructions()}
                disabled={globalInstructionsLoading || globalInstructionsSaving || globalInstructionsTooLong}
                className="rounded border border-gray-900 bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="workspace-global-ai-instructions-save"
              >
                {globalInstructionsSaving
                  ? accountMessages.globalAiInstructionsSaving
                  : accountMessages.globalAiInstructionsSave}
              </button>
              <button
                type="button"
                onClick={() => void handleClearGlobalInstructions()}
                disabled={globalInstructionsLoading || globalInstructionsSaving}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="workspace-global-ai-instructions-clear"
              >
                {accountMessages.globalAiInstructionsClear}
              </button>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded border border-gray-200 px-3 py-2 text-left text-sm text-gray-500"
          data-testid="workspace-account-menu-help"
        >
          {props.helpLabel ?? 'Help'}
        </button>
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded border border-gray-200 px-3 py-2 text-left text-sm text-gray-500"
          data-testid="workspace-account-menu-referral"
        >
          {props.referralLabel ?? 'Referral'}
        </button>
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4" data-testid="workspace-account-menu-logout">
        <button
          type="button"
          onClick={() => {
            props.onLogout?.();
            props.onClose?.();
          }}
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          data-testid="workspace-header-logout-button"
        >
          {props.logoutLabel ?? 'Log out'}
        </button>
      </div>
    </div>
  );
}
