import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import OfficeDeskPanel, {
  type OfficePanelCancel,
  type OfficePanelLabels,
} from '@/components/office/office-desk-panel';
import type { OfficeCancelPhase } from '@/lib/office/office-cancel';
import enMessages from '@/messages/en.json';
import zhTwMessages from '@/messages/zh-TW.json';
import zhCnMessages from '@/messages/zh-CN.json';

type Messages = Record<string, unknown>;

const EN = enMessages as Messages;
// The disabled attribute, not the `disabled:` class variant.
const DISABLED_ATTR = /\sdisabled(=|\s|>)/;

const LOCALES: Array<{ code: string; messages: Messages; texts: Record<string, string> }> = [
  {
    code: 'en',
    messages: EN,
    texts: {
      prompt: 'Cancel this run? Waiting and running steps stop.',
      confirm: 'Confirm cancel',
      keep: 'Keep run',
      button: 'Cancel run',
      cancelling: 'Cancelling…',
      cancelled: 'Run cancelled. Waiting and running steps have stopped.',
      finished: 'This run has already finished.',
      notFound: 'This run could not be found.',
      failed: 'Could not cancel the run. Try again.',
    },
  },
  {
    code: 'zh-TW',
    messages: zhTwMessages as Messages,
    texts: {
      prompt: '要取消這次執行嗎？等待中和進行中的步驟會停止。',
      confirm: '確認取消',
      keep: '保留這次執行',
      button: '取消這次執行',
      cancelling: '取消中…',
      cancelled: '已取消這次執行。等待中和進行中的步驟已停止。',
      finished: '這次執行已經結束。',
      notFound: '找不到這次執行。',
      failed: '無法取消這次執行，請再試一次。',
    },
  },
  {
    code: 'zh-CN',
    messages: zhCnMessages as Messages,
    texts: {
      prompt: '要取消这次运行吗？等待中和进行中的步骤会停止。',
      confirm: '确认取消',
      keep: '保留这次运行',
      button: '取消这次运行',
      cancelling: '取消中…',
      cancelled: '已取消这次运行。等待中和进行中的步骤已停止。',
      finished: '这次运行已经结束。',
      notFound: '找不到这次运行。',
      failed: '无法取消这次运行，请重试。',
    },
  },
];

function read(messages: Messages, path: string): string {
  let current: unknown = messages;
  for (const part of path.split('.')) {
    current = (current as Record<string, unknown> | undefined)?.[part];
  }
  assert.equal(typeof current, 'string', path);
  return current as string;
}

function labelsFor(messages: Messages): OfficePanelLabels {
  const o = (key: string) => read(messages, `office.${key}`);
  const c = (key: string) => read(messages, `collaboration.${key}`);
  return {
    close: o('closePanel'),
    currentRun: o('currentRun'),
    recentRuns: o('recentRuns'),
    noRuns: o('noRuns'),
    started: o('started'),
    duration: o('duration'),
    tokens: o('tokens'),
    outcomeUnknown: o('outcomeUnknown'),
    openWorkspace: o('openWorkspace'),
    openTeam: 'Open',
    agentProfile: o('agentProfile'),
    comingSoonBody: o('comingSoonBody'),
    deskHint: o('deskHint'),
    openRun: o('openRun'),
    backToRuns: o('backToRuns'),
    savedOutput: o('savedOutput'),
    runDetailLoading: o('runDetailLoading'),
    runDetailEmpty: o('runDetailEmpty'),
    runDetailNotFound: o('runDetailNotFound'),
    runDetailError: o('runDetailError'),
    retry: o('retry'),
    cancelRun: c('cancelRun'),
    cancelRunPrompt: c('cancelRunPrompt'),
    cancelRunConfirm: c('cancelRunConfirm'),
    cancelRunKeep: c('cancelRunKeep'),
    cancelRunCancelling: o('cancelRunCancelling'),
    cancelResults: {
      cancelled: o('cancelRunCancelled'),
      finished: o('cancelRunFinished'),
      notFound: o('cancelRunNotFound'),
      failed: o('cancelRunFailed'),
    },
  };
}

const noop = () => undefined;

function renderPanel(
  messages: Messages,
  cancel: Partial<OfficePanelCancel> | null,
  hasCurrent = true,
): string {
  return renderToStaticMarkup(
    <OfficeDeskPanel
      desk={{
        id: 'team:lead',
        name: 'Lead',
        role: 'Coding',
        phase: 'working',
        statusText: 'Working',
        vacant: false,
        current: hasCurrent
          ? {
              id: 'r-0',
              executionId: 'exec-1',
              statusText: 'Working',
              modeText: 'Agent',
              providerModel: 'a / b',
              startedText: '06:00',
              durationText: '1m',
              tokensText: '12',
            }
          : null,
        recent: [],
        showOutcome: false,
        knowledgeBadge: null,
        handoffBadge: null,
        workspaceHref: null,
        openHref: '/en/collaboration',
        profileHref: '/en/platform',
      }}
      labels={labelsFor(messages)}
      onClose={noop}
      cancel={
        cancel
          ? {
              runId: 'collab-1',
              phase: null,
              onBegin: noop,
              onKeep: noop,
              onConfirm: noop,
              onDismiss: noop,
              ...cancel,
            }
          : null
      }
    />,
  );
}

describe('office cancel control', () => {
  test('shows Cancel run only for an active Team run', () => {
    const html = renderPanel(EN, {});
    assert.match(html, /data-testid="office-cancel-run"/);
    assert.match(html, /Cancel run/);
    assert.doesNotMatch(html, /data-testid="office-cancel-confirm"/);

    assert.doesNotMatch(renderPanel(EN, { runId: null }), /data-testid="office-cancel-run"/);
    assert.doesNotMatch(renderPanel(EN, null), /office-cancel/);
    assert.doesNotMatch(renderPanel(EN, {}, false), /data-testid="office-cancel-run"/);
  });

  test('has no approve, reject or edit control', () => {
    for (const phase of [null, 'confirming', 'cancelling', 'cancelled'] as const) {
      assert.doesNotMatch(renderPanel(EN, { phase }), /approve|reject|edit/i);
    }
  });

  test('the first click only opens the confirm step', () => {
    assert.doesNotMatch(renderPanel(EN, { phase: null }), /data-testid="office-cancel-confirm"/);
    const screen = readFileSync(new URL('./office-screen.tsx', import.meta.url), 'utf8');
    const begin = screen.match(/onBeginCancel=\{[\s\S]*?\n {6}\}\n/);
    assert.ok(begin);
    assert.match(begin[0], /phase: 'confirming'/);
    assert.doesNotMatch(begin[0], /cancelOfficeCollaborationRun|fetch/);
    // The request only runs from a confirming state, and only from one place.
    assert.match(screen, /cancel\.phase !== 'confirming'/);
    assert.equal(screen.match(/cancelOfficeCollaborationRun\(/g)?.length, 1);
  });

  test('every state has translated copy in en, zh-TW and zh-CN', () => {
    const states: Array<[OfficeCancelPhase | null, string[]]> = [
      [null, ['button']],
      ['confirming', ['prompt', 'confirm', 'keep']],
      ['cancelling', ['prompt', 'cancelling', 'keep']],
      ['cancelled', ['cancelled']],
      ['finished', ['finished']],
      ['notFound', ['notFound']],
      ['failed', ['failed']],
    ];
    for (const { code, messages, texts } of LOCALES) {
      for (const [phase, wanted] of states) {
        const html = renderPanel(messages, { phase });
        for (const key of wanted) {
          assert.ok(html.includes(texts[key]), `${code} ${String(phase)} ${key}`);
        }
      }
    }
  });

  test('cancelling shows the Spinner and disables both buttons', () => {
    const html = renderPanel(EN, { phase: 'cancelling' });
    assert.match(html, /data-testid="ui-spinner"/);
    const confirm = html.match(/<button[^>]*data-testid="office-cancel-confirm"[^>]*>/);
    const keep = html.match(/<button[^>]*data-testid="office-cancel-keep"[^>]*>/);
    assert.ok(confirm && keep);
    assert.match(confirm[0], DISABLED_ATTR);
    assert.match(keep[0], DISABLED_ATTR);

    const confirming = renderPanel(EN, { phase: 'confirming' });
    assert.doesNotMatch(confirming, /data-testid="ui-spinner"/);
    const enabled = confirming.match(/<button[^>]*data-testid="office-cancel-confirm"[^>]*>/);
    assert.ok(enabled);
    assert.doesNotMatch(enabled[0], DISABLED_ATTR);
  });

  test('results are announced and a failure is an alert', () => {
    const failed = renderPanel(EN, { phase: 'failed' });
    assert.match(failed, /role="alert"[^>]*data-testid="office-cancel-result"[^>]*data-phase="failed"/);
    for (const phase of ['cancelled', 'finished', 'notFound'] as const) {
      const html = renderPanel(EN, { phase });
      assert.match(
        html,
        new RegExp(`role="status"[^>]*data-testid="office-cancel-result"[^>]*data-phase="${phase}"`),
      );
    }
  });

  test('the result stays visible after the run leaves the desk', () => {
    const html = renderPanel(EN, { phase: 'cancelled' }, false);
    assert.match(html, /data-testid="office-cancel-result"/);
    assert.doesNotMatch(html, /data-testid="office-cancel-run"/);
  });

  test('the request goes through the shared collaboration helper', () => {
    const screen = readFileSync(new URL('./office-screen.tsx', import.meta.url), 'utf8');
    assert.match(screen, /cancelOfficeCollaborationRun/);
    const helper = readFileSync(new URL('../../lib/office/office-cancel.ts', import.meta.url), 'utf8');
    assert.match(helper, /collaborationFetch/);
    assert.match(helper, /\/api\/collaboration\/runs\/\$\{encodeURIComponent\(collaborationRunId\)\}\/cancel/);
  });
});
