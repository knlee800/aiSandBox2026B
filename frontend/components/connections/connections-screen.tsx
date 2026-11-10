'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  LinkIcon,
  LinkSlashIcon,
} from '@heroicons/react/24/outline';
import { useTranslations } from '@/hooks/useTranslations';
import { fillKnowledgeTemplate } from '@/components/knowledge/knowledge-limits';
import {
  CONNECTION_PRESETS,
  connectCalendar,
  connectMail,
  disconnectConnection,
  formatConnectionDate,
  loadConnections,
  verifyConnection,
  type ConnectionKind,
  type ConnectionPreset,
  type ConnectionsResult,
  type ConnectionsState,
  type MailConnectInput,
} from '@/components/connections/connections-api';

export type ConnectionsPhase = 'loading' | 'forbidden' | 'unavailable' | 'error' | 'ready';

export interface ConnectionCardStatus {
  busy: 'idle' | 'connecting' | 'verifying' | 'disconnecting';
  errorKey: string | null;
  verifiedAt: string | null;
  confirmDisconnect: boolean;
  disconnected: boolean;
}

export const IDLE_CARD_STATUS: ConnectionCardStatus = {
  busy: 'idle',
  errorKey: null,
  verifiedAt: null,
  confirmDisconnect: false,
  disconnected: false,
};

export interface ConnectionsScreenViewProps {
  t: (key: string) => string;
  locale: string;
  phase: ConnectionsPhase;
  connections: ConnectionsState;
  mail: ConnectionCardStatus;
  calendar: ConnectionCardStatus;
  mailPreset: ConnectionPreset;
  onMailPresetChange: (preset: ConnectionPreset) => void;
  onRetry: () => void;
  onConnectMail: (input: MailConnectInput) => void;
  onConnectCalendar: (url: string) => void;
  onVerify: (kind: ConnectionKind) => void;
  onAskDisconnect: (kind: ConnectionKind) => void;
  onCancelDisconnect: (kind: ConnectionKind) => void;
  onConfirmDisconnect: (kind: ConnectionKind) => void;
}

const QUIET_BUTTON =
  'inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-60';
const PRIMARY_BUTTON =
  'inline-flex items-center gap-1.5 rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-60';
const FIELD =
  'mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-60';

function clearField(form: HTMLFormElement, name: string): void {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement) {
    field.value = '';
  }
}

function ConnectionStatusPill({ connected, t }: { connected: boolean; t: (key: string) => string }) {
  return connected ? (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 px-2 py-0.5 text-[11px] font-medium text-emerald-200"
      data-testid="connections-status-connected"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
      {t('status.connected')}
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-slate-600 px-2 py-0.5 text-[11px] font-medium text-slate-300">
      {t('status.notConnected')}
    </span>
  );
}

function DetailRow({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="shrink-0 text-xs font-medium text-slate-400 sm:w-32">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-slate-100" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function ActionError({ message, testId }: { message: string; testId: string }) {
  return (
    <div
      className="flex items-start gap-2 rounded-lg border border-red-700/40 bg-red-950/30 px-3 py-2"
      role="alert"
      data-testid={testId}
    >
      <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden="true" />
      <p className="break-words text-sm text-red-200">{message}</p>
    </div>
  );
}

function ConnectedActions(props: {
  t: (key: string) => string;
  locale: string;
  kind: ConnectionKind;
  status: ConnectionCardStatus;
  onVerify: (kind: ConnectionKind) => void;
  onAskDisconnect: (kind: ConnectionKind) => void;
  onCancelDisconnect: (kind: ConnectionKind) => void;
  onConfirmDisconnect: (kind: ConnectionKind) => void;
}) {
  const { t, locale, kind, status, onVerify, onAskDisconnect, onCancelDisconnect, onConfirmDisconnect } =
    props;
  const prefix = kind === 'imap' ? 'mail' : 'calendar';
  const busy = status.busy !== 'idle';
  return (
    <div className="mt-4 flex flex-col gap-3">
      {status.verifiedAt && !status.errorKey ? (
        <p
          className="flex items-start gap-2 text-sm text-emerald-200"
          role="status"
          data-testid={`connections-${prefix}-verify-ok`}
        >
          <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
          <span className="break-words">
            {fillKnowledgeTemplate(t('actions.verifyOk'), {
              when: formatConnectionDate(status.verifiedAt, locale),
            })}
          </span>
        </p>
      ) : null}
      {status.errorKey ? (
        <ActionError message={t(status.errorKey)} testId={`connections-${prefix}-error`} />
      ) : null}
      {status.confirmDisconnect ? (
        <div
          className="rounded-xl border border-red-700/40 bg-red-950/30 px-4 py-3"
          role="alertdialog"
          aria-labelledby={`connections-${prefix}-disconnect-title`}
          aria-describedby={`connections-${prefix}-disconnect-body`}
          data-testid={`connections-${prefix}-disconnect-confirm`}
        >
          <p id={`connections-${prefix}-disconnect-title`} className="text-sm font-semibold text-white">
            {t(`${prefix}.disconnectTitle`)}
          </p>
          <p id={`connections-${prefix}-disconnect-body`} className="mt-1 text-sm text-slate-300">
            {t(`${prefix}.disconnectBody`)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onConfirmDisconnect(kind)}
              disabled={busy}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-60"
              data-testid={`connections-${prefix}-disconnect-confirm-action`}
            >
              {status.busy === 'disconnecting' ? t('actions.disconnecting') : t('actions.confirmDisconnect')}
            </button>
            <button
              type="button"
              onClick={() => onCancelDisconnect(kind)}
              disabled={busy}
              className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-60"
              data-testid={`connections-${prefix}-disconnect-cancel`}
            >
              {t('actions.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onVerify(kind)}
            disabled={busy}
            className={QUIET_BUTTON}
            data-testid={`connections-${prefix}-verify`}
          >
            <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
            {status.busy === 'verifying' ? t('actions.verifying') : t('actions.verify')}
          </button>
          <button
            type="button"
            onClick={() => onAskDisconnect(kind)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-700/60 px-3 py-1.5 text-sm font-medium text-red-200 transition-colors hover:bg-red-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-60"
            data-testid={`connections-${prefix}-disconnect`}
          >
            <LinkSlashIcon className="h-4 w-4" aria-hidden="true" />
            {t('actions.disconnect')}
          </button>
        </div>
      )}
    </div>
  );
}

function SetupNotes({ notes, testId }: { notes: string[]; testId: string }) {
  return (
    <ul className="mt-3 flex flex-col gap-1.5" data-testid={testId}>
      {notes.map((note) => (
        <li key={note} className="flex items-start gap-2 text-sm text-slate-400">
          <InformationCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          <span className="break-words">{note}</span>
        </li>
      ))}
    </ul>
  );
}

function SetupSteps({ steps, title, testId }: { steps: string[]; title: string; testId: string }) {
  return (
    <div className="mt-4">
      <h3 className="text-xs font-medium text-slate-300">{title}</h3>
      <ol className="mt-2 flex flex-col gap-2" data-testid={testId}>
        {steps.map((step, index) => (
          <li key={step} className="flex items-start gap-3 text-sm text-slate-200">
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-600 text-[11px] font-medium text-slate-300"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <span className="min-w-0 break-words">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ConnectionsScreenView(props: ConnectionsScreenViewProps): React.ReactElement {
  const {
    t,
    locale,
    phase,
    connections,
    mail,
    calendar,
    mailPreset,
    onMailPresetChange,
    onRetry,
    onConnectMail,
    onConnectCalendar,
    onVerify,
    onAskDisconnect,
    onCancelDisconnect,
    onConfirmDisconnect,
  } = props;

  if (phase === 'loading') {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-slate-950 px-6"
        data-testid="connections-loading"
      >
        <p className="text-sm font-medium text-slate-200" role="status">
          {t('loading')}
        </p>
      </div>
    );
  }

  function handleMailSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const input: MailConnectInput = {
      preset: mailPreset,
      username: String(data.get('username') ?? ''),
      appPassword: String(data.get('appPassword') ?? ''),
    };
    clearField(form, 'appPassword');
    onConnectMail(input);
  }

  function handleCalendarSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = event.currentTarget;
    const url = String(new FormData(form).get('url') ?? '');
    clearField(form, 'url');
    onConnectCalendar(url);
  }

  const mailConnection = connections.imap;
  const calendarConnection = connections.ical;
  const mailBusy = mail.busy !== 'idle';
  const calendarBusy = calendar.busy !== 'idle';
  const mailSteps = [
    t(`steps.${mailPreset}.one`),
    t(`steps.${mailPreset}.two`),
    t(`steps.${mailPreset}.three`),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-950" data-testid="connections-screen">
      <header className="border-b border-slate-800 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/90 text-white">
              <LinkIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-white">{t('title')}</h1>
              <p className="text-sm text-slate-300">{t('subtitle')}</p>
            </div>
          </div>
          <Link
            href={`/${locale}/platform`}
            className="inline-flex items-center gap-1.5 self-start rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 sm:self-auto"
            data-testid="connections-back"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            {t('backToPlatform')}
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          {phase === 'error' ? (
            <div
              className="rounded-xl border border-red-700/40 bg-red-950/30 px-4 py-4"
              role="alert"
              data-testid="connections-error"
            >
              <div className="flex items-start gap-2">
                <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-300" aria-hidden="true" />
                <p className="text-sm text-red-100">{t('loadError')}</p>
              </div>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                data-testid="connections-retry"
              >
                {t('retry')}
              </button>
            </div>
          ) : null}

          {phase === 'forbidden' || phase === 'unavailable' ? (
            <div
              className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-4"
              role="status"
              data-testid={phase === 'forbidden' ? 'connections-forbidden' : 'connections-unavailable'}
            >
              <div className="flex items-start gap-2">
                <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-white">
                    {phase === 'forbidden' ? t('forbiddenTitle') : t('unavailableTitle')}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {phase === 'forbidden' ? t('forbiddenBody') : t('unavailableBody')}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {phase === 'ready' ? (
            <>
              <section
                className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4 sm:px-5"
                aria-labelledby="connections-data-title"
                data-testid="connections-data-statement"
              >
                <h2 id="connections-data-title" className="text-sm font-semibold text-white">
                  {t('dataStatement.title')}
                </h2>
                <ul className="mt-2 flex max-w-3xl list-disc flex-col gap-1 pl-5 text-sm text-slate-300">
                  <li>{t('dataStatement.sentToProvider')}</li>
                  <li>{t('dataStatement.mailAndCalendarRead')}</li>
                  <li>{t('dataStatement.noChanges')}</li>
                  <li>{t('dataStatement.stored')}</li>
                </ul>
              </section>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <section
                  className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5"
                  aria-labelledby="connections-mail-title"
                  data-testid="connections-mail-card"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <EnvelopeIcon className="h-5 w-5 shrink-0 text-indigo-300" aria-hidden="true" />
                      <h2 id="connections-mail-title" className="text-sm font-semibold text-white">
                        {t('mail.title')}
                      </h2>
                    </div>
                    <ConnectionStatusPill connected={mailConnection !== null} t={t} />
                  </div>

                  {mailConnection ? (
                    <>
                      <dl className="mt-4 flex flex-col gap-2" data-testid="connections-mail-details">
                        <DetailRow
                          label={t('fields.provider')}
                          value={t(`presets.${mailConnection.preset}`)}
                          testId="connections-mail-provider"
                        />
                        <DetailRow
                          label={t('fields.address')}
                          value={mailConnection.username}
                          testId="connections-mail-address"
                        />
                        <DetailRow
                          label={t('fields.connectedAt')}
                          value={formatConnectionDate(mailConnection.createdAt, locale)}
                          testId="connections-mail-connected-at"
                        />
                        <DetailRow
                          label={t('fields.lastChecked')}
                          value={
                            mailConnection.lastVerifiedAt
                              ? formatConnectionDate(mailConnection.lastVerifiedAt, locale)
                              : t('fields.notCheckedYet')
                          }
                          testId="connections-mail-last-checked"
                        />
                      </dl>
                      <ConnectedActions
                        t={t}
                        locale={locale}
                        kind="imap"
                        status={mail}
                        onVerify={onVerify}
                        onAskDisconnect={onAskDisconnect}
                        onCancelDisconnect={onCancelDisconnect}
                        onConfirmDisconnect={onConfirmDisconnect}
                      />
                    </>
                  ) : (
                    <>
                      {mail.disconnected ? (
                        <p
                          className="mt-4 flex items-start gap-2 text-sm text-emerald-200"
                          role="status"
                          data-testid="connections-mail-disconnected"
                        >
                          <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                          <span className="break-words">{t('mail.disconnected')}</span>
                        </p>
                      ) : null}
                      <p className="mt-3 text-sm text-slate-300">{t('mail.intro')}</p>
                      <form onSubmit={handleMailSubmit} className="mt-4" data-testid="connections-mail-form">
                        <fieldset disabled={mailBusy}>
                          <legend className="text-xs font-medium text-slate-300">{t('mail.providerLabel')}</legend>
                          <div className="mt-2 flex flex-wrap gap-2" data-testid="connections-mail-presets">
                            {CONNECTION_PRESETS.map((preset) => {
                              const selected = preset === mailPreset;
                              return (
                                <label
                                  key={preset}
                                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-indigo-400 ${
                                    selected
                                      ? 'border-indigo-400 bg-indigo-500/20 text-white'
                                      : 'border-slate-700 text-slate-200 hover:bg-slate-800'
                                  }`}
                                  data-testid={`connections-mail-preset-${preset}`}
                                  data-selected={selected ? 'true' : 'false'}
                                >
                                  <input
                                    type="radio"
                                    name="preset"
                                    value={preset}
                                    checked={selected}
                                    onChange={() => onMailPresetChange(preset)}
                                    className="sr-only"
                                  />
                                  {t(`presets.${preset}`)}
                                </label>
                              );
                            })}
                          </div>
                        </fieldset>

                        <SetupSteps
                          steps={mailSteps}
                          title={t('mail.stepsTitle')}
                          testId="connections-mail-steps"
                        />
                        <SetupNotes
                          notes={[t('mail.noteAppPassword'), t('mail.noteAdvancedProtection'), t('mail.noteOutlook')]}
                          testId="connections-mail-notes"
                        />

                        <fieldset disabled={mailBusy} className="mt-4 flex flex-col gap-3">
                          <div>
                            <label className="block text-sm text-slate-200" htmlFor="connections-mail-username">
                              {t('mail.emailLabel')}
                            </label>
                            <input
                              id="connections-mail-username"
                              name="username"
                              type="email"
                              required
                              autoComplete="email"
                              spellCheck={false}
                              placeholder={t('mail.emailPlaceholder')}
                              className={FIELD}
                              data-testid="connections-mail-username"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-200" htmlFor="connections-mail-app-password">
                              {t('mail.appPasswordLabel')}
                            </label>
                            <input
                              id="connections-mail-app-password"
                              name="appPassword"
                              type="password"
                              required
                              autoComplete="off"
                              spellCheck={false}
                              aria-describedby="connections-mail-app-password-hint"
                              className={FIELD}
                              data-testid="connections-mail-app-password"
                            />
                            <p id="connections-mail-app-password-hint" className="mt-1 text-xs text-slate-400">
                              {t('mail.appPasswordHint')}
                            </p>
                          </div>
                          {mail.errorKey ? (
                            <ActionError message={t(mail.errorKey)} testId="connections-mail-error" />
                          ) : null}
                          <div>
                            <button type="submit" className={PRIMARY_BUTTON} data-testid="connections-mail-connect">
                              <EnvelopeIcon className="h-4 w-4" aria-hidden="true" />
                              {mail.busy === 'connecting' ? t('mail.connecting') : t('mail.connect')}
                            </button>
                          </div>
                        </fieldset>
                      </form>
                    </>
                  )}
                </section>

                <section
                  className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5"
                  aria-labelledby="connections-calendar-title"
                  data-testid="connections-calendar-card"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <CalendarDaysIcon className="h-5 w-5 shrink-0 text-indigo-300" aria-hidden="true" />
                      <h2 id="connections-calendar-title" className="text-sm font-semibold text-white">
                        {t('calendar.title')}
                      </h2>
                    </div>
                    <ConnectionStatusPill connected={calendarConnection !== null} t={t} />
                  </div>

                  {calendarConnection ? (
                    <>
                      <dl className="mt-4 flex flex-col gap-2" data-testid="connections-calendar-details">
                        <DetailRow
                          label={t('fields.source')}
                          value={t('calendar.source')}
                          testId="connections-calendar-source"
                        />
                        <DetailRow
                          label={t('fields.connectedAt')}
                          value={formatConnectionDate(calendarConnection.createdAt, locale)}
                          testId="connections-calendar-connected-at"
                        />
                        <DetailRow
                          label={t('fields.lastChecked')}
                          value={
                            calendarConnection.lastVerifiedAt
                              ? formatConnectionDate(calendarConnection.lastVerifiedAt, locale)
                              : t('fields.notCheckedYet')
                          }
                          testId="connections-calendar-last-checked"
                        />
                      </dl>
                      <ConnectedActions
                        t={t}
                        locale={locale}
                        kind="ical"
                        status={calendar}
                        onVerify={onVerify}
                        onAskDisconnect={onAskDisconnect}
                        onCancelDisconnect={onCancelDisconnect}
                        onConfirmDisconnect={onConfirmDisconnect}
                      />
                    </>
                  ) : (
                    <>
                      {calendar.disconnected ? (
                        <p
                          className="mt-4 flex items-start gap-2 text-sm text-emerald-200"
                          role="status"
                          data-testid="connections-calendar-disconnected"
                        >
                          <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                          <span className="break-words">{t('calendar.disconnected')}</span>
                        </p>
                      ) : null}
                      <p className="mt-3 text-sm text-slate-300">{t('calendar.intro')}</p>
                      <SetupSteps
                        steps={[t('calendar.stepOne'), t('calendar.stepTwo'), t('calendar.stepThree')]}
                        title={t('calendar.stepsTitle')}
                        testId="connections-calendar-steps"
                      />
                      <SetupNotes
                        notes={[t('calendar.noteSecret'), t('calendar.noteAdmin'), t('calendar.noteOther')]}
                        testId="connections-calendar-notes"
                      />
                      <form onSubmit={handleCalendarSubmit} className="mt-4" data-testid="connections-calendar-form">
                        <fieldset disabled={calendarBusy} className="flex flex-col gap-3">
                          <div>
                            <label className="block text-sm text-slate-200" htmlFor="connections-calendar-url">
                              {t('calendar.linkLabel')}
                            </label>
                            <input
                              id="connections-calendar-url"
                              name="url"
                              type="url"
                              required
                              autoComplete="off"
                              spellCheck={false}
                              placeholder={t('calendar.linkPlaceholder')}
                              aria-describedby="connections-calendar-url-hint"
                              className={FIELD}
                              data-testid="connections-calendar-url"
                            />
                            <p id="connections-calendar-url-hint" className="mt-1 text-xs text-slate-400">
                              {t('calendar.linkHint')}
                            </p>
                          </div>
                          {calendar.errorKey ? (
                            <ActionError message={t(calendar.errorKey)} testId="connections-calendar-error" />
                          ) : null}
                          <div>
                            <button
                              type="submit"
                              className={PRIMARY_BUTTON}
                              data-testid="connections-calendar-connect"
                            >
                              <CalendarDaysIcon className="h-4 w-4" aria-hidden="true" />
                              {calendar.busy === 'connecting' ? t('calendar.connecting') : t('calendar.connect')}
                            </button>
                          </div>
                        </fieldset>
                      </form>
                    </>
                  )}
                </section>
              </div>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}

export interface ConnectionsScreenProps {
  locale: string;
}

export default function ConnectionsScreen({ locale }: ConnectionsScreenProps): React.ReactElement {
  const t = useTranslations('connections');
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [phase, setPhase] = useState<ConnectionsPhase>('loading');
  const [connections, setConnections] = useState<ConnectionsState>({ imap: null, ical: null });
  const [mail, setMail] = useState<ConnectionCardStatus>(IDLE_CARD_STATUS);
  const [calendar, setCalendar] = useState<ConnectionCardStatus>(IDLE_CARD_STATUS);
  const [mailPreset, setMailPreset] = useState<ConnectionPreset>('gmail');

  const setCard = useCallback(
    (kind: ConnectionKind, update: (current: ConnectionCardStatus) => ConnectionCardStatus) => {
      if (kind === 'imap') {
        setMail(update);
      } else {
        setCalendar(update);
      }
    },
    [],
  );

  /** Handles 401, 403 and 503 the same way on every route; returns true when it did. */
  const handledPageResult = useCallback(
    (result: ConnectionsResult<unknown>): boolean => {
      if (result.type === 'unauthorized') {
        router.replace(`/${locale}/login`);
        return true;
      }
      if (result.type === 'forbidden') {
        setPhase('forbidden');
        return true;
      }
      if (result.type === 'unavailable') {
        setPhase('unavailable');
        return true;
      }
      return false;
    },
    [locale, router],
  );

  const reload = useCallback(async () => {
    setPhase('loading');
    setMail(IDLE_CARD_STATUS);
    setCalendar(IDLE_CARD_STATUS);
    const result = await loadConnections();
    if (handledPageResult(result)) {
      return;
    }
    if (result.type === 'ok') {
      setConnections(result.value);
      setPhase('ready');
      return;
    }
    setPhase('error');
  }, [handledPageResult]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (!mounted) {
          return;
        }
        if (!response.ok) {
          router.replace(`/${locale}/login`);
          return;
        }
        const payload = (await response.json()) as { id?: unknown };
        if (!mounted) {
          return;
        }
        if (typeof payload.id !== 'string' || payload.id.trim().length === 0) {
          router.replace(`/${locale}/login`);
          return;
        }
        setAuthReady(true);
      } catch {
        if (mounted) {
          router.replace(`/${locale}/login`);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [locale, router]);

  useEffect(() => {
    if (!authReady) {
      return;
    }
    void reload();
  }, [authReady, reload]);

  async function runConnect(kind: ConnectionKind, request: () => Promise<ConnectionsResult<unknown>>) {
    setCard(kind, () => ({ ...IDLE_CARD_STATUS, busy: 'connecting' }));
    const result = await request();
    if (handledPageResult(result)) {
      return;
    }
    if (result.type === 'ok') {
      const value = result.value;
      setConnections((current) => ({ ...current, [kind]: value }) as ConnectionsState);
      setCard(kind, () => IDLE_CARD_STATUS);
      return;
    }
    const errorKey = result.type === 'failed' ? result.errorKey : 'errors.connectFailed';
    setCard(kind, () => ({ ...IDLE_CARD_STATUS, errorKey }));
  }

  async function runVerify(kind: ConnectionKind) {
    setCard(kind, (current) => ({ ...current, busy: 'verifying', errorKey: null, verifiedAt: null }));
    const result = await verifyConnection(kind);
    if (handledPageResult(result)) {
      return;
    }
    if (result.type === 'ok') {
      const lastVerifiedAt = result.value.lastVerifiedAt;
      setConnections((current) => {
        const existing = current[kind];
        return existing ? ({ ...current, [kind]: { ...existing, lastVerifiedAt } } as ConnectionsState) : current;
      });
      setCard(kind, (current) => ({ ...current, busy: 'idle', verifiedAt: lastVerifiedAt }));
      return;
    }
    const errorKey = result.type === 'failed' ? result.errorKey : 'errors.connectFailed';
    setCard(kind, (current) => ({ ...current, busy: 'idle', errorKey }));
  }

  async function runDisconnect(kind: ConnectionKind) {
    setCard(kind, (current) => ({ ...current, busy: 'disconnecting', errorKey: null }));
    const result = await disconnectConnection(kind);
    if (handledPageResult(result)) {
      return;
    }
    if (result.type === 'ok') {
      setConnections((current) => ({ ...current, [kind]: null }));
      setCard(kind, () => ({ ...IDLE_CARD_STATUS, disconnected: true }));
      return;
    }
    const errorKey = result.type === 'failed' ? result.errorKey : 'errors.disconnectFailed';
    setCard(kind, (current) => ({ ...current, busy: 'idle', confirmDisconnect: false, errorKey }));
  }

  return (
    <ConnectionsScreenView
      t={t}
      locale={locale}
      phase={authReady ? phase : 'loading'}
      connections={connections}
      mail={mail}
      calendar={calendar}
      mailPreset={mailPreset}
      onMailPresetChange={setMailPreset}
      onRetry={() => {
        void reload();
      }}
      onConnectMail={(input) => {
        void runConnect('imap', () => connectMail(input));
      }}
      onConnectCalendar={(url) => {
        void runConnect('ical', () => connectCalendar(url));
      }}
      onVerify={(kind) => {
        void runVerify(kind);
      }}
      onAskDisconnect={(kind) => {
        setCard(kind, (current) => ({ ...current, confirmDisconnect: true, errorKey: null, verifiedAt: null }));
      }}
      onCancelDisconnect={(kind) => {
        setCard(kind, (current) => ({ ...current, confirmDisconnect: false }));
      }}
      onConfirmDisconnect={(kind) => {
        void runDisconnect(kind);
      }}
    />
  );
}
