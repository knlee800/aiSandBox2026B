'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  BookOpenIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useTranslations } from '@/hooks/useTranslations';
import {
  knowledgeDeleteErrorKey,
  knowledgeFetch,
  knowledgeServerErrorKey,
  parseKnowledgeDocuments,
  parseKnowledgeScopes,
  readKnowledgeErrorCode,
  type KnowledgeDocumentItem,
  type KnowledgeScopeItem,
} from '@/components/knowledge/knowledge-api';
import {
  KNOWLEDGE_MAX_ACCOUNT_BYTES,
  KNOWLEDGE_MAX_ACTIVE_DOCUMENTS,
  KNOWLEDGE_MAX_DOCUMENT_BYTES,
  KNOWLEDGE_MAX_TITLE_LENGTH,
  fillKnowledgeTemplate,
  formatKnowledgeKilobytes,
  isKnowledgeUploadName,
} from '@/components/knowledge/knowledge-limits';

export interface KnowledgeFormSubmission {
  title: string;
  content: string;
  file: File | null;
}

function knowledgeScopeOrNull(value: string | null): string | null {
  return value && value.length > 0 ? value : null;
}

export function knowledgeSubmitScopeId(input: {
  mode: 'add' | 'replace';
  pickedScopeId: string | null;
  chipScopeId: string | null;
  documentScopeId: string | null;
}): string | null {
  if (input.mode === 'replace') {
    return knowledgeScopeOrNull(input.documentScopeId);
  }
  return knowledgeScopeOrNull(input.pickedScopeId) ?? knowledgeScopeOrNull(input.chipScopeId);
}

export interface KnowledgeScreenViewProps {
  t: (key: string) => string;
  locale: string;
  phase: 'loading' | 'forbidden' | 'error' | 'ready';
  scopes: readonly KnowledgeScopeItem[];
  selectedScopeId: string | null;
  formScopeId: string | null;
  replaceScopeId: string | null;
  documents: readonly KnowledgeDocumentItem[];
  usage: { count: number; bytes: number };
  formMode: 'add' | 'replace' | null;
  replaceTitle: string | null;
  pendingDelete: { id: string; title: string } | null;
  actionErrorKey: string | null;
  busy: boolean;
  onSelectScope: (scopeId: string) => void;
  onFormScopeChange: (scopeId: string) => void;
  onRetry: () => void;
  onRefresh: () => void;
  onStartAdd: () => void;
  onStartReplace: (documentId: string) => void;
  onAskDelete: (documentId: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onCancelForm: () => void;
  onSubmit: (input: KnowledgeFormSubmission) => void;
}

function formatUpdated(value: string, locale: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleString(locale);
}

export function KnowledgeScreenView(props: KnowledgeScreenViewProps): React.ReactElement {
  const {
    t,
    locale,
    phase,
    scopes,
    selectedScopeId,
    formScopeId,
    replaceScopeId,
    documents,
    usage,
    formMode,
    replaceTitle,
    pendingDelete,
    actionErrorKey,
    busy,
    onSelectScope,
    onFormScopeChange,
    onRetry,
    onRefresh,
    onStartAdd,
    onStartReplace,
    onAskDelete,
    onCancelDelete,
    onConfirmDelete,
    onCancelForm,
    onSubmit,
  } = props;

  if (phase === 'loading') {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-slate-950 px-6"
        data-testid="knowledge-loading"
      >
        <p className="text-sm font-medium text-slate-200">{t('loading')}</p>
      </div>
    );
  }

  const limitsText = fillKnowledgeTemplate(t('limits'), {
    count: String(usage.count),
    maxDocuments: String(KNOWLEDGE_MAX_ACTIVE_DOCUMENTS),
    usedKilobytes: formatKnowledgeKilobytes(usage.bytes),
    maxKilobytes: formatKnowledgeKilobytes(KNOWLEDGE_MAX_ACCOUNT_BYTES),
  });
  const perDocumentText = fillKnowledgeTemplate(t('perDocumentLimit'), {
    maxDocumentKilobytes: formatKnowledgeKilobytes(KNOWLEDGE_MAX_DOCUMENT_BYTES),
  });
  const selectedScope = scopes.find((scope) => scope.id === selectedScopeId) ?? null;
  const shownScopeId = formMode
    ? knowledgeSubmitScopeId({
        mode: formMode,
        pickedScopeId: formScopeId,
        chipScopeId: selectedScopeId,
        documentScopeId: replaceScopeId,
      })
    : null;
  const scopeLine = formMode
    ? fillKnowledgeTemplate(formMode === 'replace' ? t('replacingIn') : t('addingTo'), {
        scope: shownScopeId ? t(`scopes.${shownScopeId}`) : '',
      })
    : '';
  const submitIdle = formMode === 'replace' ? t('replaceSubmit') : t('submitAdd');
  const submitLabel = busy && formMode ? t('submitting') : submitIdle;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const rawFile = formData.get('file');
    const file = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;
    onSubmit({
      title: String(formData.get('title') ?? ''),
      content: String(formData.get('content') ?? ''),
      file,
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950" data-testid="knowledge-screen">
      <header className="border-b border-slate-800 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/90 text-white">
              <BookOpenIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">{t('title')}</h1>
              <p className="text-sm text-slate-300">{t('subtitle')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {phase === 'ready' ? (
              <button
                type="button"
                onClick={onRefresh}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
                data-testid="knowledge-refresh"
              >
                <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
                {t('refresh')}
              </button>
            ) : null}
            <Link
              href={`/${locale}/platform`}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              data-testid="knowledge-back"
            >
              <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
              {t('backToPlatform')}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          {phase === 'error' ? (
            <div
              className="rounded-xl border border-rose-900/80 bg-rose-950/40 px-4 py-4"
              data-testid="knowledge-error"
              role="alert"
            >
              <div className="flex items-start gap-2">
                <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 text-rose-300" aria-hidden="true" />
                <p className="text-sm text-rose-100">{t('loadError')}</p>
              </div>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-950"
                data-testid="knowledge-retry"
              >
                {t('retry')}
              </button>
            </div>
          ) : null}

          {phase === 'forbidden' ? (
            <div
              className="rounded-xl border border-amber-900/80 bg-amber-950/40 px-4 py-4"
              data-testid="knowledge-forbidden"
              role="alert"
            >
              <p className="text-sm text-amber-100">{t('forbidden')}</p>
            </div>
          ) : null}

          {phase === 'ready' ? (
            <>
              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4 sm:px-5">
                <p className="text-sm text-slate-200" data-testid="knowledge-limits">
                  {limitsText}
                </p>
                <p className="mt-1 text-sm text-slate-400" data-testid="knowledge-per-document-limit">
                  {perDocumentText}
                </p>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-white">{t('scopesLabel')}</h2>
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t('scopesLabel')}>
                  {scopes.map((scope) => {
                    const selected = scope.id === selectedScopeId;
                    return (
                      <button
                        key={scope.id}
                        type="button"
                        aria-pressed={selected}
                        disabled={busy}
                        onClick={() => onSelectScope(scope.id)}
                        data-testid={`knowledge-scope-${scope.id}`}
                        data-selected={selected ? 'true' : 'false'}
                        className={`rounded-full border px-3 py-1.5 text-left text-sm ${
                          selected
                            ? 'border-indigo-400 bg-indigo-500/20 text-white'
                            : 'border-slate-700 text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <span className="font-medium">{t(`scopes.${scope.id}`)}</span>
                        <span className="ml-2 text-xs text-slate-300">{t(`scopeType.${scope.type}`)}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {actionErrorKey ? (
                <p className="text-sm text-rose-200" role="alert" data-testid="knowledge-action-error">
                  {t(actionErrorKey)}
                </p>
              ) : null}

              {pendingDelete ? (
                <div
                  className="rounded-xl border border-rose-900/80 bg-rose-950/30 px-4 py-4"
                  data-testid="knowledge-delete-confirm"
                  role="alertdialog"
                  aria-labelledby="knowledge-delete-title"
                >
                  <p id="knowledge-delete-title" className="text-sm font-semibold text-white">
                    {t('deleteConfirmTitle')}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {fillKnowledgeTemplate(t('deleteConfirmBody'), { title: pendingDelete.title })}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={onConfirmDelete}
                      disabled={busy}
                      className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                      data-testid="knowledge-delete-confirm-action"
                    >
                      {busy ? t('deleting') : t('deleteConfirmAction')}
                    </button>
                    <button
                      type="button"
                      onClick={onCancelDelete}
                      disabled={busy}
                      className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-white">
                  {selectedScope ? t(`scopes.${selectedScope.id}`) : t('documentsTitle')}
                </h2>
                <button
                  type="button"
                  onClick={onStartAdd}
                  disabled={busy || !selectedScopeId}
                  className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
                  data-testid="knowledge-add"
                >
                  <PlusIcon className="h-4 w-4" aria-hidden="true" />
                  {t('addButton')}
                </button>
              </div>

              {formMode ? (
                <form
                  key={formMode === 'replace' ? `replace-${replaceTitle ?? ''}` : 'add'}
                  onSubmit={handleSubmit}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4"
                  data-testid="knowledge-form"
                >
                  <h3 className="text-sm font-semibold text-white">
                    {formMode === 'replace' ? t('replaceTitle') : t('addTitle')}
                  </h3>
                  <p
                    id="knowledge-form-scope"
                    className="mt-2 text-sm font-medium text-white"
                    data-testid="knowledge-form-scope"
                  >
                    {scopeLine}
                  </p>
                  {formMode === 'add' ? (
                    <>
                      <label
                        className="mt-3 block text-sm text-slate-200"
                        htmlFor="knowledge-form-scope-picker"
                      >
                        {t('formScopeLabel')}
                      </label>
                      <select
                        id="knowledge-form-scope-picker"
                        data-testid="knowledge-form-scope-picker"
                        value={shownScopeId ?? ''}
                        disabled={busy}
                        onChange={(event) => onFormScopeChange(event.target.value)}
                        aria-describedby="knowledge-form-scope"
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white disabled:opacity-60"
                      >
                        {scopes.map((scope) => (
                          <option key={scope.id} value={scope.id}>
                            {t(`scopes.${scope.id}`)}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : null}
                  <label className="mt-3 block text-sm text-slate-200" htmlFor="knowledge-title">
                    {t('titleLabel')}
                  </label>
                  <input
                    id="knowledge-title"
                    name="title"
                    data-testid="knowledge-title"
                    defaultValue={formMode === 'replace' ? replaceTitle ?? '' : ''}
                    readOnly={formMode === 'replace'}
                    maxLength={KNOWLEDGE_MAX_TITLE_LENGTH}
                    placeholder={t('titlePlaceholder')}
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                  <label className="mt-3 block text-sm text-slate-200" htmlFor="knowledge-content">
                    {t('contentLabel')}
                  </label>
                  <textarea
                    id="knowledge-content"
                    name="content"
                    data-testid="knowledge-content"
                    rows={8}
                    placeholder={t('contentPlaceholder')}
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                  <label className="mt-3 block text-sm text-slate-200" htmlFor="knowledge-file">
                    {t('fileLabel')}
                  </label>
                  <input
                    id="knowledge-file"
                    name="file"
                    type="file"
                    accept=".md,.txt"
                    data-testid="knowledge-file"
                    className="mt-1 block w-full text-sm text-slate-200"
                  />
                  <p className="mt-2 text-sm text-slate-400">{t('fileHint')}</p>
                  <p className="mt-1 text-sm text-slate-400">{t('replaceHint')}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                      data-testid="knowledge-submit"
                    >
                      {submitLabel}
                    </button>
                    <button
                      type="button"
                      onClick={onCancelForm}
                      disabled={busy}
                      className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </form>
              ) : null}

              {documents.length === 0 ? (
                <div
                  className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 px-4 py-4"
                  data-testid="knowledge-empty"
                >
                  <p className="text-sm font-medium text-white">{t('emptyTitle')}</p>
                  <p className="mt-1 text-sm text-slate-300">{t('emptyBody')}</p>
                </div>
              ) : (
                <ul className="flex flex-col gap-3" data-testid="knowledge-document-list">
                  {documents.map((document) => (
                    <li
                      key={document.id}
                      className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3"
                      data-testid={`knowledge-document-${document.id}`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">{document.title}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {fillKnowledgeTemplate(t('documentMeta'), {
                              size: fillKnowledgeTemplate(t('byteSize'), {
                                kilobytes: formatKnowledgeKilobytes(document.byteSize),
                              }),
                              updated: fillKnowledgeTemplate(t('updated'), {
                                when: formatUpdated(document.updatedAt, locale),
                              }),
                            })}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onStartReplace(document.id)}
                            disabled={busy}
                            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-100"
                            data-testid={`knowledge-replace-${document.id}`}
                          >
                            {t('replaceButton')}
                          </button>
                          <button
                            type="button"
                            onClick={() => onAskDelete(document.id)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-md border border-rose-900 px-3 py-1.5 text-sm text-rose-100"
                            data-testid={`knowledge-delete-${document.id}`}
                          >
                            <TrashIcon className="h-4 w-4" aria-hidden="true" />
                            {t('deleteButton')}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}

export interface KnowledgeScreenProps {
  locale: string;
}

export default function KnowledgeScreen({ locale }: KnowledgeScreenProps): React.ReactElement {
  const t = useTranslations('knowledge');
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'forbidden' | 'error' | 'ready'>('loading');
  const [scopes, setScopes] = useState<KnowledgeScopeItem[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocumentItem[]>([]);
  const [selectedScopeId, setSelectedScopeId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<'add' | 'replace' | null>(null);
  const [formScopeId, setFormScopeId] = useState<string | null>(null);
  const [replaceDocumentId, setReplaceDocumentId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [actionErrorKey, setActionErrorKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setPhase('loading');
    setActionErrorKey(null);
    setBusy(false);
    try {
      const [scopesResponse, documentsResponse] = await Promise.all([
        knowledgeFetch('/api/knowledge/scopes'),
        knowledgeFetch('/api/knowledge/documents'),
      ]);
      if (scopesResponse.status === 401 || documentsResponse.status === 401) {
        router.replace(`/${locale}/login`);
        return;
      }
      if (scopesResponse.status === 403 || documentsResponse.status === 403) {
        setPhase('forbidden');
        return;
      }
      if (!scopesResponse.ok || !documentsResponse.ok) {
        setPhase('error');
        return;
      }
      const nextScopes = parseKnowledgeScopes(await scopesResponse.json());
      const nextDocuments = parseKnowledgeDocuments(await documentsResponse.json());
      if (!nextScopes || !nextDocuments) {
        setPhase('error');
        return;
      }
      setScopes(nextScopes);
      setDocuments(nextDocuments);
      setSelectedScopeId((current) => {
        if (current && nextScopes.some((scope) => scope.id === current)) {
          return current;
        }
        return nextScopes[0]?.id ?? null;
      });
      setPhase('ready');
    } catch {
      setPhase('error');
    }
  }, [locale, router]);

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

  const visibleDocuments = documents.filter((document) => document.scopeId === selectedScopeId);
  const replaceDocument = documents.find((document) => document.id === replaceDocumentId) ?? null;
  const replaceTitle = replaceDocument?.title ?? null;
  const replaceScopeId = replaceDocument?.scopeId ?? null;
  const usage = {
    count: documents.length,
    bytes: documents.reduce((sum, document) => sum + document.byteSize, 0),
  };

  async function persist(input: KnowledgeFormSubmission): Promise<void> {
    const mode = formMode === 'replace' ? 'replace' : 'add';
    const scopeId = knowledgeSubmitScopeId({
      mode,
      pickedScopeId: formScopeId,
      chipScopeId: selectedScopeId,
      documentScopeId: replaceScopeId,
    });
    if (!scopeId) {
      return;
    }
    const title = formMode === 'replace' && replaceTitle ? replaceTitle : input.title.trim();
    if (title.length === 0) {
      setActionErrorKey('validationTitle');
      return;
    }
    if (title.length > KNOWLEDGE_MAX_TITLE_LENGTH) {
      setActionErrorKey('errorTitleTooLong');
      return;
    }
    let file: File;
    if (input.file) {
      if (!isKnowledgeUploadName(input.file.name)) {
        setActionErrorKey('validationFileType');
        return;
      }
      if (input.file.size > KNOWLEDGE_MAX_DOCUMENT_BYTES) {
        setActionErrorKey('validationTooLarge');
        return;
      }
      file = input.file;
    } else {
      if (input.content.trim().length === 0) {
        setActionErrorKey('validationContent');
        return;
      }
      if (new TextEncoder().encode(input.content).byteLength > KNOWLEDGE_MAX_DOCUMENT_BYTES) {
        setActionErrorKey('validationTooLarge');
        return;
      }
      file = new File([input.content], 'paste.txt', { type: 'text/plain' });
    }

    setBusy(true);
    setActionErrorKey(null);
    try {
      const body = new FormData();
      body.set('scopeId', scopeId);
      body.set('title', title);
      body.set('file', file, file.name);
      const response = await knowledgeFetch('/api/knowledge/documents', { method: 'POST', body });
      if (response.status === 401) {
        router.replace(`/${locale}/login`);
        return;
      }
      if (response.status === 403) {
        setPhase('forbidden');
        return;
      }
      if (!response.ok) {
        setActionErrorKey(knowledgeServerErrorKey(await readKnowledgeErrorCode(response)));
        return;
      }
      setFormMode(null);
      setFormScopeId(null);
      setReplaceDocumentId(null);
      setPendingDelete(null);
      if (mode === 'add') {
        setSelectedScopeId(scopeId);
      }
      await reload();
    } catch {
      setActionErrorKey('saveError');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!pendingDelete) {
      return;
    }
    const deletingId = pendingDelete.id;
    setBusy(true);
    setActionErrorKey(null);
    try {
      const response = await knowledgeFetch(
        `/api/knowledge/documents/${encodeURIComponent(deletingId)}`,
        { method: 'DELETE' },
      );
      if (response.status === 401) {
        router.replace(`/${locale}/login`);
        return;
      }
      if (response.status === 403) {
        setPhase('forbidden');
        return;
      }
      if (!response.ok) {
        setActionErrorKey(knowledgeDeleteErrorKey(await readKnowledgeErrorCode(response)));
        return;
      }
      setPendingDelete(null);
      if (replaceDocumentId === deletingId) {
        setFormMode(null);
        setReplaceDocumentId(null);
      }
      await reload();
    } catch {
      setActionErrorKey('deleteError');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KnowledgeScreenView
      t={t}
      locale={locale}
      phase={authReady ? phase : 'loading'}
      scopes={scopes}
      selectedScopeId={selectedScopeId}
      documents={visibleDocuments}
      usage={usage}
      formMode={formMode}
      formScopeId={formScopeId}
      replaceScopeId={formMode === 'replace' ? replaceScopeId : null}
      replaceTitle={replaceTitle}
      pendingDelete={pendingDelete}
      actionErrorKey={actionErrorKey}
      busy={busy}
      onSelectScope={(scopeId) => {
        setSelectedScopeId(scopeId);
        setFormMode(null);
        setFormScopeId(null);
        setReplaceDocumentId(null);
        setPendingDelete(null);
        setActionErrorKey(null);
      }}
      onFormScopeChange={(scopeId) => {
        setFormScopeId(scopeId);
      }}
      onRetry={() => {
        void reload();
      }}
      onRefresh={() => {
        void reload();
      }}
      onStartAdd={() => {
        setFormMode('add');
        setFormScopeId(selectedScopeId);
        setReplaceDocumentId(null);
        setPendingDelete(null);
        setActionErrorKey(null);
      }}
      onStartReplace={(documentId) => {
        const document = documents.find((item) => item.id === documentId);
        if (!document) {
          return;
        }
        setFormMode('replace');
        setFormScopeId(null);
        setReplaceDocumentId(documentId);
        setPendingDelete(null);
        setActionErrorKey(null);
      }}
      onAskDelete={(documentId) => {
        const document = visibleDocuments.find((item) => item.id === documentId);
        if (!document) {
          return;
        }
        setPendingDelete({ id: document.id, title: document.title });
        setActionErrorKey(null);
      }}
      onCancelDelete={() => setPendingDelete(null)}
      onConfirmDelete={() => {
        void confirmDelete();
      }}
      onCancelForm={() => {
        setFormMode(null);
        setFormScopeId(null);
        setReplaceDocumentId(null);
      }}
      onSubmit={(input) => {
        void persist(input);
      }}
    />
  );
}
