'use client';

import React from 'react';

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

export default function WorkspaceAccountMenu(props: WorkspaceAccountMenuProps) {
  if (!props.isOpen) {
    return null;
  }

  const avatarInitial = getAvatarInitial(props.userEmail);

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
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded border border-gray-200 px-3 py-2 text-left text-sm text-gray-500"
          data-testid="workspace-account-menu-settings"
        >
          {props.settingsLabel ?? 'Settings'}
        </button>
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
