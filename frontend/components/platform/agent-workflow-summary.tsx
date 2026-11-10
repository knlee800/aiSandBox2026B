'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowPathIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import Spinner from '@/components/ui/Spinner';
import type {
  UserAgent,
  UserAgentPlatformModel,
  UserWorkflowSummaryItem,
  UserWorkflowSummaryState,
} from '@/hooks/useUserAgents';
import { fillTemplate } from './agent-workflow-model';
import type { WorkflowT } from './agent-workflow-fields';

/**
 * BIZ-USER-01D: the workflow summary on the agent detail panel (folders, model, budgets,
 * state), the switch on or off, and the Open on Team link. The pure part is exported so
 * the tests run it directly; the component only lays it out.
 *
 * On means status `active`; off means `disabled` (PATCH /api/agents/:id accepts
 * active, draft and disabled). Switching on needs a test run at the workflow's current
 * version, read from GET /api/collaboration/workflows.
 */

export type WorkflowSwitchPhase = 'idle' | 'confirmingOff' | 'saving';
export type WorkflowSwitchEvent = 'askOff' | 'cancel' | 'confirm' | 'settled';

export function nextWorkflowSwitchPhase(
  phase: WorkflowSwitchPhase,
  event: WorkflowSwitchEvent,
): WorkflowSwitchPhase {
  if (event === 'askOff') return phase === 'idle' ? 'confirmingOff' : phase;
  if (event === 'cancel') return phase === 'confirmingOff' ? 'idle' : phase;
  if (event === 'confirm') return phase === 'confirmingOff' ? 'saving' : phase;
  if (event === 'settled') return 'idle';
  return phase;
}

export interface WorkflowSwitchGate {
  isOn: boolean;
  /** Switching on is allowed only when the workflow is tested at its current version. */
  canSwitchOn: boolean;
  /** Off, and not tested (or not known yet): show "Run a test first" and Open on Team. */
  showNeedsTest: boolean;
}

/** `tested` is null while the summary has not loaded: the switch stays off-limits until it is known. */
export function workflowSwitchGate(
  status: UserAgent['status'],
  tested: boolean | null,
): WorkflowSwitchGate {
  const isOn = status === 'active';
  const canSwitchOn = !isOn && tested === true;
  return { isOn, canSwitchOn, showNeedsTest: !isOn && tested === false };
}

/** TEAM-PRESELECT-01: the Team page reads workflowId and preselects that workflow. */
export function openOnTeamHref(localePrefix: string, workflowId?: string): string {
  const base = `${localePrefix}/collaboration`;
  return workflowId ? `${base}?workflowId=${encodeURIComponent(workflowId)}` : base;
}

export function creditsText(t: WorkflowT, count: number): string {
  return fillTemplate(t(count === 1 ? 'summary.creditsOne' : 'summary.creditsMany'), { count });
}

export interface WorkflowSummaryLines {
  folders: string;
  model: string;
  perRun: string;
  perDay: string;
}

export function workflowSummaryLines(
  item: UserWorkflowSummaryItem,
  t: WorkflowT,
  scopeName: (id: string) => string,
  models: readonly UserAgentPlatformModel[] | null,
): WorkflowSummaryLines {
  const folders =
    item.knowledgeScopeIds.length > 0
      ? item.knowledgeScopeIds.map((id) => scopeName(id)).join(', ')
      : t('summary.foldersNone');
  let model = t('summary.modelServer');
  if (item.model?.choice === 'platform') {
    const platformId = item.model.id;
    const known = models?.find((entry) => entry.id === platformId);
    model = known
      ? `${platformId} (${fillTemplate(
          t(known.creditsPer1kTokens === 1 ? 'modelCostOne' : 'modelCostMany'),
          { count: known.creditsPer1kTokens },
        )})`
      : platformId;
  }
  return {
    folders,
    model,
    perRun:
      item.budgetPerRunCredits !== null ? creditsText(t, item.budgetPerRunCredits) : t('summary.noLimit'),
    perDay:
      item.budgetPerDayCredits !== null ? creditsText(t, item.budgetPerDayCredits) : t('summary.noLimit'),
  };
}

/** The tested chip text for the card and the panel; null while unknown. */
export function workflowTestedNote(
  t: WorkflowT,
  tested: boolean | null,
): { text: string; tone: 'ok' | 'warn' } | null {
  if (tested === null) return null;
  return tested
    ? { text: t('summary.testedYes'), tone: 'ok' }
    : { text: t('summary.testedNo'), tone: 'warn' };
}

/** The editor budget hint: last run and spend today. */
export function workflowUsageLine(t: WorkflowT, item: UserWorkflowSummaryItem): string {
  const last = item.lastRunCredits !== null ? creditsText(t, item.lastRunCredits) : t('summary.usageNoRun');
  return fillTemplate(t('summary.usageLine'), {
    last,
    spent: creditsText(t, item.spentTodayCredits),
  });
}

export interface AgentWorkflowSummaryProps {
  t: WorkflowT;
  scopeName: (id: string) => string;
  localePrefix: string;
  agentId: string;
  /** The row's status from GET /api/agents. */
  status: UserAgent['status'];
  summaryState: UserWorkflowSummaryState;
  /** The workflow's entry in the list; null when the list has none for it. */
  item: UserWorkflowSummaryItem | null;
  models: readonly UserAgentPlatformModel[] | null;
  onRetry: () => void;
  /** Sets the status through PATCH. Resolves with an error code when it failed. */
  onSwitch: (agentId: string, on: boolean) => Promise<{ error?: string }>;
  /** Test seam: render a given step of the switch flow. */
  initialPhase?: WorkflowSwitchPhase;
  initialError?: boolean;
}

const rowLabel = 'text-xs font-semibold uppercase tracking-wide text-gray-600';
const rowValue = 'mt-0.5 text-sm text-gray-800';
const linkClasses =
  'inline-flex items-center gap-1 font-medium text-brand-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';

export default function AgentWorkflowSummary(props: AgentWorkflowSummaryProps) {
  const { t, scopeName, localePrefix, agentId, status, summaryState, item, models, onRetry, onSwitch } = props;
  const [phase, setPhase] = React.useState<WorkflowSwitchPhase>(props.initialPhase ?? 'idle');
  const [switching, setSwitching] = React.useState(false);
  const [failed, setFailed] = React.useState(props.initialError === true);

  React.useEffect(() => {
    setPhase('idle');
    setSwitching(false);
    setFailed(false);
  }, [agentId]);

  const tested = summaryState === 'loaded' && item ? item.tested : null;
  const gate = workflowSwitchGate(status, tested);
  const busy = switching || phase === 'saving';

  async function run(on: boolean) {
    if (busy) return;
    setFailed(false);
    setSwitching(true);
    const result = await onSwitch(agentId, on);
    setSwitching(false);
    setPhase((current) => nextWorkflowSwitchPhase(current, 'settled'));
    if (result.error) setFailed(true);
  }

  function handleSwitchClick() {
    if (busy) return;
    if (gate.isOn) {
      setPhase((current) => nextWorkflowSwitchPhase(current, 'askOff'));
      return;
    }
    if (gate.canSwitchOn) void run(true);
  }

  function handleConfirmOff() {
    if (phase !== 'confirmingOff' || busy) return;
    setPhase((current) => nextWorkflowSwitchPhase(current, 'confirm'));
    void run(false);
  }

  const testedNote = workflowTestedNote(t, tested);
  const switchDisabled = busy || (!gate.isOn && !gate.canSwitchOn);

  return (
    <section
      className="mt-5 rounded-xl border border-gray-200 bg-white p-4"
      aria-labelledby={`agent-summary-title-${agentId}`}
      data-testid="agent-workflow-summary"
    >
      <h3 id={`agent-summary-title-${agentId}`} className="text-xs font-semibold uppercase tracking-wide text-gray-600">
        {t('summary.title')}
      </h3>

      {summaryState === 'loading' ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-gray-600" role="status" data-testid="agent-summary-loading">
          <Spinner />
          <span>{t('summary.loading')}</span>
        </p>
      ) : null}

      {summaryState === 'failed' ? (
        <div className="mt-3" data-testid="agent-summary-failed">
          <p className="flex items-center gap-2 text-sm text-red-700" role="alert">
            <ExclamationTriangleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t('summary.failed')}</span>
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-[transform,background-color] duration-150 ease-out hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 active:scale-[0.97]"
            data-testid="agent-summary-retry"
          >
            <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
            {t('summary.retry')}
          </button>
        </div>
      ) : null}

      {summaryState === 'loaded' && !item ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-gray-600" data-testid="agent-summary-empty">
          <InformationCircleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t('summary.empty')}</span>
        </p>
      ) : null}

      {summaryState === 'loaded' && item ? (
        <dl className="mt-3 grid gap-3 sm:grid-cols-2" data-testid="agent-summary-lines">
          {(() => {
            const lines = workflowSummaryLines(item, t, scopeName, models);
            return (
              <>
                <div className="sm:col-span-2">
                  <dt className={rowLabel}>{t('summary.folders')}</dt>
                  <dd className={rowValue} data-testid="agent-summary-folders">{lines.folders}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className={rowLabel}>{t('summary.model')}</dt>
                  <dd className={rowValue} data-testid="agent-summary-model">{lines.model}</dd>
                </div>
                <div>
                  <dt className={rowLabel}>{t('summary.budgetPerRun')}</dt>
                  <dd className={rowValue} data-testid="agent-summary-budget-run">{lines.perRun}</dd>
                </div>
                <div>
                  <dt className={rowLabel}>{t('summary.budgetPerDay')}</dt>
                  <dd className={rowValue} data-testid="agent-summary-budget-day">{lines.perDay}</dd>
                </div>
              </>
            );
          })()}
        </dl>
      ) : null}

      {testedNote ? (
        <p
          className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
            testedNote.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
          data-testid="agent-summary-tested"
          data-tested={testedNote.tone === 'ok' ? 'true' : 'false'}
        >
          {testedNote.tone === 'ok' ? (
            <CheckCircleIcon className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ExclamationTriangleIcon className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{testedNote.text}</span>
        </p>
      ) : null}

      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p id={`agent-switch-label-${agentId}`} className="text-sm font-medium text-gray-800">
              {t('summary.switchLabel')}
            </p>
            <p className="text-xs text-gray-600" data-testid="agent-switch-state">
              {gate.isOn ? t('summary.switchOn') : t('summary.switchOff')}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={gate.isOn}
            aria-labelledby={`agent-switch-label-${agentId}`}
            disabled={switchDisabled}
            onClick={handleSwitchClick}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              gate.isOn ? 'bg-brand' : 'bg-gray-300'
            }`}
            data-testid="agent-switch"
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-150 ease-out motion-reduce:transition-none ${
                gate.isOn ? 'translate-x-5' : 'translate-x-0.5'
              }`}
              aria-hidden="true"
            />
          </button>
        </div>

        {gate.showNeedsTest ? (
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-amber-800" data-testid="agent-switch-needs-test">
            <span>{t('summary.needsTestHint')}</span>
            <Link href={openOnTeamHref(localePrefix, agentId)} className={linkClasses} data-testid="agent-open-on-team">
              <span>{t('summary.openOnTeam')}</span>
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
          </p>
        ) : (
          <p className="mt-3 text-sm">
            <Link href={openOnTeamHref(localePrefix, agentId)} className={linkClasses} data-testid="agent-open-on-team">
              <span>{t('summary.openOnTeam')}</span>
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
          </p>
        )}

        {phase !== 'idle' ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-4" data-testid="agent-switch-confirm-panel">
            <p className="text-sm font-semibold text-amber-900">{t('summary.switchOffTitle')}</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-800">{t('summary.switchOffBody')}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                onClick={handleConfirmOff}
                disabled={busy}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white transition-[transform,background-color] duration-150 ease-out hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-amber-300"
                data-testid="agent-switch-confirm"
              >
                {busy ? <Spinner /> : null}
                <span>{busy ? t('summary.switching') : t('summary.switchOffConfirm')}</span>
              </button>
              <button
                type="button"
                onClick={() => setPhase((current) => nextWorkflowSwitchPhase(current, 'cancel'))}
                disabled={busy}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition-[transform,background-color] duration-150 ease-out hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 active:scale-[0.97] disabled:cursor-not-allowed disabled:text-gray-400"
                data-testid="agent-switch-cancel"
              >
                {t('summary.switchOffCancel')}
              </button>
            </div>
          </div>
        ) : null}

        {switching && phase === 'idle' ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-gray-600" role="status" data-testid="agent-switch-saving">
            <Spinner />
            <span>{t('summary.switching')}</span>
          </p>
        ) : null}

        {failed ? (
          <p className="mt-3 text-sm text-red-700" role="alert" data-testid="agent-switch-error">
            {t('summary.switchError')}
          </p>
        ) : null}
      </div>
    </section>
  );
}
