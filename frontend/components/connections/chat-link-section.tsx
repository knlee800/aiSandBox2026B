'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { fillKnowledgeTemplate } from '@/components/knowledge/knowledge-limits';
import { formatConnectionDate } from '@/components/connections/connections-api';
import {
  cancelChatClaim,
  confirmChatLink,
  createChatCode,
  loadChatLinks,
  unlinkChat,
  type ChatCodeValue,
  type ChatLinkResult,
} from '@/components/connections/chat-link-api';
import {
  CHAT_LINK_POLL_MS,
  UNAVAILABLE_CHAT_STATE,
  canCreateCode,
  deriveChatView,
  isCodeLive,
  retryMinutes,
  shouldPoll,
  type ChatLinksState,
} from '@/components/connections/chat-link.logic';

export type ChatLoadPhase = 'loading' | 'error' | 'ready';
export type ChatBusy = 'idle' | 'creating' | 'confirming' | 'cancelling' | 'unlinking';

export interface ChatLinkSectionViewProps {
  t: (key: string) => string;
  locale: string;
  now: number;
  phase: ChatLoadPhase;
  state: ChatLinksState | null;
  /** The one-time code, held in memory only. */
  code: ChatCodeValue | null;
  ticked: boolean;
  busy: ChatBusy;
  errorKey: string | null;
  errorRetryAfterSeconds: number | null;
  noticeKey: string | null;
  confirmUnlink: boolean;
  onTick: (ticked: boolean) => void;
  onCreateCode: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onAskUnlink: () => void;
  onCancelUnlink: () => void;
  onConfirmUnlink: () => void;
  onRetry: () => void;
}

const QUIET_BUTTON =
  'inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-60';
const PRIMARY_BUTTON =
  'inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-60';

function Row({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="shrink-0 text-xs font-medium text-slate-400 sm:w-32">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-slate-100" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function StatusPill({ linked, t }: { linked: boolean; t: (key: string) => string }) {
  return linked ? (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 px-2 py-0.5 text-[11px] font-medium text-emerald-200"
      data-testid="chat-link-status-linked"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
      {t('chat.status.linked')}
    </span>
  ) : (
    <span
      className="inline-flex items-center rounded-full border border-slate-600 px-2 py-0.5 text-[11px] font-medium text-slate-300"
      data-testid="chat-link-status-not-linked"
    >
      {t('chat.status.notLinked')}
    </span>
  );
}

export function ChatLinkSectionView(props: ChatLinkSectionViewProps): React.ReactElement {
  const {
    t,
    locale,
    now,
    phase,
    state,
    code,
    ticked,
    busy,
    errorKey,
    errorRetryAfterSeconds,
    noticeKey,
    confirmUnlink,
    onTick,
    onCreateCode,
    onConfirm,
    onCancel,
    onAskUnlink,
    onCancelUnlink,
    onConfirmUnlink,
    onRetry,
  } = props;
  const view = phase === 'ready' ? deriveChatView(state, isCodeLive(code, now), now) : 'unavailable';
  const paused = state?.paused === true;
  const working = busy !== 'idle';
  const errorText = errorKey
    ? fillKnowledgeTemplate(t(errorKey), { minutes: String(retryMinutes(errorRetryAfterSeconds)) })
    : null;

  return (
    <section
      className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5"
      aria-labelledby="chat-link-title"
      data-testid="chat-link-section"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="chat-link-title" className="text-sm font-semibold text-white">
          {t('chat.title')}
        </h2>
        {phase === 'ready' && view !== 'unavailable' ? <StatusPill linked={view === 'linked'} t={t} /> : null}
      </div>

      {phase === 'loading' ? (
        <p className="mt-3 text-sm text-slate-300" role="status" data-testid="chat-link-loading">
          {t('chat.loading')}
        </p>
      ) : null}

      {phase === 'error' ? (
        <div className="mt-3 flex flex-col items-start gap-3" data-testid="chat-link-load-error">
          <p className="text-sm text-red-200" role="alert">
            {t(errorKey ?? 'chat.errors.generic')}
          </p>
          <button type="button" className={QUIET_BUTTON} onClick={onRetry} data-testid="chat-link-retry">
            {t('chat.retry')}
          </button>
        </div>
      ) : null}

      {phase === 'ready' && view === 'unavailable' ? (
        <p className="mt-3 text-sm text-slate-300" data-testid="chat-link-unavailable">
          {t('chat.unavailable')}
        </p>
      ) : null}

      {phase === 'ready' && view !== 'unavailable' ? (
        <>
          {view !== 'linked' ? <p className="mt-3 text-sm text-slate-300">{t('chat.intro')}</p> : null}

          {noticeKey ? (
            <p
              className="mt-3 flex items-start gap-2 text-sm text-emerald-200"
              role="status"
              data-testid="chat-link-notice"
            >
              <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
              <span className="break-words">{t(noticeKey)}</span>
            </p>
          ) : null}

          {paused && view !== 'linked' ? (
            <p className="mt-3 text-sm text-amber-200" role="status" data-testid="chat-link-paused">
              {t('chat.paused')}
            </p>
          ) : null}

          {view === 'unlinked' ? (
            <div className="mt-4 flex flex-col gap-3" data-testid="chat-link-unlinked">
              <div
                className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3"
                data-testid="chat-link-consent"
              >
                <h3 className="text-xs font-semibold text-slate-200">{t('chat.consent.title')}</h3>
                <ul className="mt-2 flex max-w-3xl list-disc flex-col gap-1 pl-5 text-sm text-slate-300">
                  <li>{t('chat.consent.sent')}</li>
                  <li>{t('chat.consent.kept')}</li>
                  <li>{t('chat.consent.unlink')}</li>
                </ul>
                <label className="mt-3 flex items-start gap-2 text-sm text-slate-200" htmlFor="chat-link-consent-box">
                  <input
                    id="chat-link-consent-box"
                    type="checkbox"
                    checked={ticked}
                    onChange={(event) => onTick(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-950 text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    data-testid="chat-link-consent-box"
                  />
                  <span>{t('chat.consent.checkbox')}</span>
                </label>
              </div>
              {errorText ? (
                <div
                  className="flex items-start gap-2 rounded-lg border border-red-700/40 bg-red-950/30 px-3 py-2"
                  role="alert"
                  data-testid="chat-link-error"
                >
                  <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden="true" />
                  <p className="break-words text-sm text-red-200">{errorText}</p>
                </div>
              ) : null}
              <div>
                <button
                  type="button"
                  className={PRIMARY_BUTTON}
                  disabled={!canCreateCode(ticked, working, paused)}
                  onClick={onCreateCode}
                  data-testid="chat-link-create"
                >
                  {busy === 'creating' ? t('chat.creating') : t('chat.createCode')}
                </button>
              </div>
            </div>
          ) : null}

          {view === 'codeLive' && code ? (
            <div className="mt-4 flex flex-col gap-3" data-testid="chat-link-code-panel">
              <h3 className="text-xs font-semibold text-slate-200">{t('chat.code.title')}</h3>
              <p
                className="w-fit select-all rounded-md border border-slate-700 bg-slate-950 px-4 py-2 font-mono text-xl tracking-widest text-white"
                data-testid="chat-link-code"
              >
                {code.code}
              </p>
              <p className="text-sm text-slate-300">{t('chat.code.instruction')}</p>
              <p className="text-xs text-slate-400" data-testid="chat-link-code-expiry">
                {fillKnowledgeTemplate(t('chat.code.expires'), {
                  time: formatConnectionDate(code.expiresAt, locale),
                })}
              </p>
              <p className="text-xs text-slate-400" role="status" data-testid="chat-link-waiting">
                {t('chat.code.waiting')}
              </p>
              <div>
                <button
                  type="button"
                  className={QUIET_BUTTON}
                  disabled={working}
                  onClick={onCancel}
                  data-testid="chat-link-cancel-code"
                >
                  {busy === 'cancelling' ? t('chat.cancelling') : t('chat.cancel')}
                </button>
              </div>
            </div>
          ) : null}

          {view === 'codeHidden' ? (
            <div className="mt-4 flex flex-col gap-3" data-testid="chat-link-code-hidden">
              <p className="text-sm text-slate-300">{t('chat.code.hidden')}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={QUIET_BUTTON}
                  disabled={working}
                  onClick={onCancel}
                  data-testid="chat-link-cancel-code"
                >
                  {busy === 'cancelling' ? t('chat.cancelling') : t('chat.cancel')}
                </button>
              </div>
            </div>
          ) : null}

          {view === 'claimed' && state?.pending ? (
            <div className="mt-4 flex flex-col gap-3" data-testid="chat-link-claim">
              <h3 className="text-xs font-semibold text-slate-200">{t('chat.claim.title')}</h3>
              <p className="break-words text-sm text-slate-100" data-testid="chat-link-claim-text">
                {state.pending.displayName
                  ? fillKnowledgeTemplate(t('chat.claim.named'), {
                      name: state.pending.displayName,
                      last4: state.pending.externalIdLast4 ?? '',
                    })
                  : fillKnowledgeTemplate(t('chat.claim.unnamed'), {
                      last4: state.pending.externalIdLast4 ?? '',
                    })}
              </p>
              <p className="text-xs text-amber-200">{t('chat.claim.warning')}</p>
              {errorText ? (
                <div
                  className="flex items-start gap-2 rounded-lg border border-red-700/40 bg-red-950/30 px-3 py-2"
                  role="alert"
                  data-testid="chat-link-error"
                >
                  <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden="true" />
                  <p className="break-words text-sm text-red-200">{errorText}</p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={PRIMARY_BUTTON}
                  disabled={working || paused}
                  onClick={onConfirm}
                  data-testid="chat-link-confirm"
                >
                  {busy === 'confirming' ? t('chat.confirming') : t('chat.confirm')}
                </button>
                <button
                  type="button"
                  className={QUIET_BUTTON}
                  disabled={working}
                  onClick={onCancel}
                  data-testid="chat-link-cancel-claim"
                >
                  {busy === 'cancelling' ? t('chat.cancelling') : t('chat.cancel')}
                </button>
              </div>
            </div>
          ) : null}

          {view === 'linked' && state?.link ? (
            <div className="mt-4 flex flex-col gap-3" data-testid="chat-link-linked">
              <dl className="flex flex-col gap-2">
                <Row
                  label={t('chat.linked.since')}
                  value={formatConnectionDate(state.link.linkedAt, locale)}
                  testId="chat-link-linked-at"
                />
                <Row
                  label={t('chat.linked.idEnding')}
                  value={state.link.externalIdLast4}
                  testId="chat-link-id-ending"
                />
                <Row
                  label={t('chat.linked.lastUsed')}
                  value={
                    state.link.lastUsedAt
                      ? formatConnectionDate(state.link.lastUsedAt, locale)
                      : t('chat.linked.neverUsed')
                  }
                  testId="chat-link-last-used"
                />
              </dl>
              {errorText ? (
                <div
                  className="flex items-start gap-2 rounded-lg border border-red-700/40 bg-red-950/30 px-3 py-2"
                  role="alert"
                  data-testid="chat-link-error"
                >
                  <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden="true" />
                  <p className="break-words text-sm text-red-200">{errorText}</p>
                </div>
              ) : null}
              {confirmUnlink ? (
                <div className="flex flex-col gap-2" data-testid="chat-link-unlink-confirm">
                  <p className="text-sm text-slate-200">{t('chat.unlinkConfirm')}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={PRIMARY_BUTTON}
                      disabled={working}
                      onClick={onConfirmUnlink}
                      data-testid="chat-link-unlink-yes"
                    >
                      {busy === 'unlinking' ? t('chat.unlinking') : t('chat.unlinkYes')}
                    </button>
                    <button
                      type="button"
                      className={QUIET_BUTTON}
                      disabled={working}
                      onClick={onCancelUnlink}
                      data-testid="chat-link-unlink-no"
                    >
                      {t('chat.unlinkNo')}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    className={QUIET_BUTTON}
                    disabled={working}
                    onClick={onAskUnlink}
                    data-testid="chat-link-unlink"
                  >
                    {t('chat.unlink')}
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export interface ChatLinkSectionProps {
  t: (key: string) => string;
  locale: string;
}

/**
 * Owns the section's state. The one-time code lives only in React state: it is never written to
 * browser storage or a cookie, and it is dropped on confirm, cancel, expiry or leaving.
 */
export default function ChatLinkSection({ t, locale }: ChatLinkSectionProps): React.ReactElement {
  const router = useRouter();
  const [phase, setPhase] = useState<ChatLoadPhase>('loading');
  const [state, setState] = useState<ChatLinksState | null>(null);
  const [code, setCode] = useState<ChatCodeValue | null>(null);
  const [ticked, setTicked] = useState(false);
  const [busy, setBusy] = useState<ChatBusy>('idle');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [noticeKey, setNoticeKey] = useState<string | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const mounted = useRef(true);
  const codeRef = useRef<ChatCodeValue | null>(null);
  codeRef.current = code;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** 401 goes to login; 403 and a switched-off feature show the not-available line. */
  const handledResult = useCallback(
    (result: ChatLinkResult<unknown>): boolean => {
      if (!mounted.current) {
        return true;
      }
      if (result.type === 'unauthorized') {
        router.replace(`/${locale}/login`);
        return true;
      }
      if (result.type === 'forbidden' || result.type === 'unavailable') {
        setState(UNAVAILABLE_CHAT_STATE);
        setCode(null);
        setPhase('ready');
        return true;
      }
      return false;
    },
    [locale, router],
  );

  const refresh = useCallback(
    async (initial: boolean) => {
      if (initial) {
        setPhase('loading');
      }
      const result = await loadChatLinks();
      if (handledResult(result)) {
        return;
      }
      if (result.type === 'ok') {
        const next = result.value;
        setState(next);
        // The code is not needed once linked, claimed, cancelled or expired; drop it here too.
        if (next.link || !next.pending || next.pending.claimed) {
          setCode(null);
        }
        setNow(Date.now());
        setPhase('ready');
        return;
      }
      if (initial) {
        setErrorKey(result.type === 'failed' ? result.errorKey : 'chat.errors.generic');
        setPhase('error');
      }
    },
    [handledResult],
  );

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  useEffect(() => {
    const onVisibility = () => {
      const isHidden = document.visibilityState === 'hidden';
      setHidden(isHidden);
      if (!isHidden) {
        void refresh(false);
      }
    };
    setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  const polling = shouldPoll(state, hidden, now);
  useEffect(() => {
    if (!polling) {
      return undefined;
    }
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      const held = codeRef.current;
      if (held && !isCodeLive(held, current)) {
        setCode(null);
        setNoticeKey('chat.notice.expired');
      }
      void refresh(false);
    }, CHAT_LINK_POLL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [polling, refresh]);

  function beginAction(next: ChatBusy) {
    setBusy(next);
    setErrorKey(null);
    setRetryAfter(null);
    setNoticeKey(null);
  }

  function failWith(result: ChatLinkResult<unknown>) {
    setBusy('idle');
    if (result.type === 'failed') {
      setErrorKey(result.errorKey);
      setRetryAfter(result.retryAfterSeconds);
      if (result.errorKey === 'chat.errors.noPending' || result.errorKey === 'chat.errors.exists') {
        void refresh(false);
      }
    }
  }

  async function runCreate() {
    beginAction('creating');
    const result = await createChatCode(locale);
    if (handledResult(result)) {
      setBusy('idle');
      return;
    }
    if (result.type === 'ok') {
      setCode(result.value);
      setState((current) => ({
        enabled: true,
        paused: current?.paused ?? false,
        link: null,
        pending: {
          channel: 'discord',
          claimed: false,
          expiresAt: result.value.expiresAt,
          claimedAt: null,
          displayName: null,
          externalIdLast4: null,
        },
      }));
      setNow(Date.now());
      setTicked(false);
      setBusy('idle');
      return;
    }
    failWith(result);
  }

  async function runConfirm() {
    beginAction('confirming');
    const result = await confirmChatLink();
    if (handledResult(result)) {
      setBusy('idle');
      return;
    }
    if (result.type === 'ok') {
      setCode(null);
      setState((current) => ({
        enabled: true,
        paused: current?.paused ?? false,
        link: result.value,
        pending: null,
      }));
      setNoticeKey('chat.linked.notice');
      setBusy('idle');
      return;
    }
    failWith(result);
  }

  async function runCancel() {
    beginAction('cancelling');
    const result = await cancelChatClaim();
    if (handledResult(result)) {
      setBusy('idle');
      return;
    }
    if (result.type === 'ok') {
      setCode(null);
      setState((current) => (current ? { ...current, pending: null } : current));
      setNoticeKey('chat.notice.cancelled');
      setBusy('idle');
      return;
    }
    failWith(result);
  }

  async function runUnlink() {
    beginAction('unlinking');
    const result = await unlinkChat();
    if (handledResult(result)) {
      setBusy('idle');
      return;
    }
    if (result.type === 'ok') {
      setCode(null);
      setConfirmUnlink(false);
      setState((current) => (current ? { ...current, link: null, pending: null } : current));
      setNoticeKey('chat.notice.unlinked');
      setBusy('idle');
      return;
    }
    setConfirmUnlink(false);
    failWith(result);
  }

  return (
    <ChatLinkSectionView
      t={t}
      locale={locale}
      now={now}
      phase={phase}
      state={state}
      code={code}
      ticked={ticked}
      busy={busy}
      errorKey={errorKey}
      errorRetryAfterSeconds={retryAfter}
      noticeKey={noticeKey}
      confirmUnlink={confirmUnlink}
      onTick={setTicked}
      onCreateCode={() => {
        void runCreate();
      }}
      onConfirm={() => {
        void runConfirm();
      }}
      onCancel={() => {
        void runCancel();
      }}
      onAskUnlink={() => {
        setConfirmUnlink(true);
        setErrorKey(null);
        setNoticeKey(null);
      }}
      onCancelUnlink={() => {
        setConfirmUnlink(false);
      }}
      onConfirmUnlink={() => {
        void runUnlink();
      }}
      onRetry={() => {
        void refresh(true);
      }}
    />
  );
}
