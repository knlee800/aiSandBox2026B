import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import React, { act, createElement } from 'react';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { useCollaborationScreen } from '../components/collaboration/collaboration-page';
import CollaborationView, {
  type CollaborationViewLabels,
} from '../components/collaboration/collaboration-view';
import enMessages from '../messages/en.json';
import zhCnMessages from '../messages/zh-CN.json';
import zhTwMessages from '../messages/zh-TW.json';
import {
  AI_PROVIDER_USAGE_LIMIT_REACHED,
  COLLABORATION_POLL_MS,
  approveRequestBody,
  approveWithoutPassingTestsForClick,
  collaborationFailureReason,
  collaborationProviderUsageLimitCopy,
  collaborationRefusal,
  collaborationRefusalMessageKey,
  createSingleFlight,
  readTestsBlockReason,
  readTestsGate,
  readTestsNotPassed,
  collaborationMemberLabel,
  collaborationRoster,
  collaborationRunEndedByReject,
  collaborationScopeLabel,
  collaborationStartRequestBody,
  collaborationTeamFromDetail,
  formatCollaborationSource,
  readCollaborationSources,
  readCollaborationTeamId,
  readDroppedSourceCount,
  sendBackRoundNumbers,
  shouldPollCollaboration,
} from './collaboration/logic';

const labels = enMessages.collaboration as CollaborationViewLabels;

const idleCancel = {
  selectedRunActive: false,
  confirmingCancel: false,
  onBeginCancel: () => {},
  onCancelCancel: () => {},
  onConfirmCancel: () => {},
};

function openTag(markup: string, testId: string): string {
  const marker = `data-testid="${testId}"`;
  const at = markup.indexOf(marker);
  assert.ok(at >= 0, marker);
  const start = markup.lastIndexOf('<', at);
  const end = markup.indexOf('>', at);
  return markup.slice(start, end + 1);
}

function tagHasBooleanAttr(tag: string, name: string): boolean {
  return new RegExp(`\\s${name}(?:=|\\s|>)`).test(tag);
}

function renderChain(handoffs: Array<{
  referralId: string;
  statusLabel: string;
  waiting: boolean;
  answer: string | null;
  prompt: string | null;
  canChangeFiles?: boolean;
  changedPaths?: string[];
  savePoint?: string | null;
  tests?: Array<{ command: string; passed: boolean }>;
  roundLabel?: string | null;
  diff?: string | null;
  diffUnavailable?: boolean;
  testsGate?: 'passed' | 'not_required' | 'blocked';
  testsBlockReason?: 'failed' | 'none' | null;
  approveWithoutTests?: boolean;
  sources?: Array<{
    documentId: string;
    title: string;
    scopeLabel: string;
    heading: string | null;
  }>;
  showUnsourced?: boolean;
  droppedSourceCount?: number;
  failureReason?: string | null;
}>, backHref = '/en/app') {
  return renderToStaticMarkup(
    React.createElement(CollaborationView, {
      labels,
      backHref,
      sessionReady: true,
      projectReady: true,
      loading: false,
      notice: null,
      conversationCreated: false,
      task: 'Look at the login form',
      deciding: false,
      team: [
        { name: labels.lead, summary: labels.leadSummary },
        { name: labels.writer, summary: labels.writerSummary },
        { name: labels.reviewer, summary: labels.reviewerSummary },
      ],
      handoffs: handoffs.map((handoff) => ({
        referralId: handoff.referralId,
        statusLabel: handoff.statusLabel,
        asked: 'You asked Lead',
        prompt: handoff.prompt,
        answer: handoff.answer,
        handoffNote: null,
        failureReason: handoff.failureReason ?? null,
        decidedBy: null,
        rejectReason: null,
        waiting: handoff.waiting,
        canChangeFiles: handoff.canChangeFiles === true,
        changedPaths: handoff.changedPaths ?? [],
        savePoint: handoff.savePoint ?? null,
        tests: handoff.tests ?? [],
        roundLabel: handoff.roundLabel ?? null,
        diff: handoff.diff === undefined ? null : handoff.diff,
        diffUnavailable: handoff.diffUnavailable === true,
        testsGate: handoff.testsGate ?? 'not_required',
        testsBlockReason: handoff.testsBlockReason ?? null,
        approveWithoutTests: handoff.approveWithoutTests === true,
        sources: handoff.sources ?? [],
        showUnsourced: handoff.showUnsourced === true,
        droppedSourceCount: handoff.droppedSourceCount ?? 0,
      })),
      runs: [],
      runEndedByReject: false,
      rejectReferralId: null,
      rejectReason: '',
      onTaskChange: () => {},
      onStart: () => {},
      onOpenRun: () => {},
      onApprove: () => {},
      onApproveWithoutTestsChange: () => {},
      onBeginReject: () => {},
      onCancelReject: () => {},
      onConfirmReject: () => {},
      onRejectReasonChange: () => {},
      ...idleCancel,
    }),
  );
}

describe('collaboration page', () => {
  test('a waiting hand-off shows Approve and Reject, and a finished one does not', () => {
    const markup = renderChain([
      {
        referralId: 'waiting-1',
        statusLabel: enMessages.collaboration.statusPendingApproval,
        waiting: true,
        answer: null,
        prompt: 'Please look at the form.',
      },
      {
        referralId: 'done-1',
        statusLabel: enMessages.collaboration.statusCompleted,
        waiting: false,
        answer: 'The form is fine.',
        prompt: 'Checked.',
      },
    ]);

    assert.match(markup, /data-testid="collaboration-approve-waiting-1"/);
    assert.doesNotMatch(markup, /data-testid="collaboration-tests-gate-waiting-1"/);
    assert.doesNotMatch(markup, /data-testid="collaboration-approve-without-tests-waiting-1"/);
    assert.match(markup, /data-testid="collaboration-reject-waiting-1"/);
    assert.doesNotMatch(markup, /data-testid="collaboration-approve-done-1"/);
    assert.doesNotMatch(markup, /data-testid="collaboration-reject-done-1"/);
    assert.match(markup, /<details/);
    assert.doesNotMatch(markup, /<details[^>]*\sopen/);
  });

  test('a refusal notice shows the translated message', () => {
    const markup = renderToStaticMarkup(
      React.createElement(CollaborationView, {
        labels,
        backHref: '/zh-TW/app',
        sessionReady: true,
        projectReady: true,
        loading: false,
        notice: zhTwMessages.collaboration.refusalCredits,
        conversationCreated: false,
        task: '',
        deciding: false,
        team: [],
        handoffs: [],
        runs: [],
        runEndedByReject: false,
        rejectReferralId: null,
        rejectReason: '',
        onTaskChange: () => {},
        onStart: () => {},
        onOpenRun: () => {},
        onApprove: () => {},
        onApproveWithoutTestsChange: () => {},
        onBeginReject: () => {},
        onCancelReject: () => {},
        onConfirmReject: () => {},
        onRejectReasonChange: () => {},
        ...idleCancel,
      }),
    );
    assert.equal(collaborationRefusal(402, 'Insufficient credit balance'), 'credits');
    assert.equal(collaborationRefusalMessageKey('credits'), 'refusalCredits');
    assert.equal(zhTwMessages.collaboration.refusalCredits, '點數不足。');
    assert.match(markup, /data-testid="collaboration-notice"/);
    assert.match(markup, /點數不足。/);
  });

  test('a waiting writer step warns before approve, and a finished step shows the work', () => {
    const markup = renderChain([
      {
        referralId: 'writer-wait',
        statusLabel: enMessages.collaboration.statusPendingApproval,
        waiting: true,
        answer: null,
        prompt: 'Fix the form.',
        canChangeFiles: true,
      },
      {
        referralId: 'lead-wait',
        statusLabel: enMessages.collaboration.statusPendingApproval,
        waiting: true,
        answer: null,
        prompt: 'Look first.',
        canChangeFiles: false,
      },
      {
        referralId: 'writer-done',
        statusLabel: enMessages.collaboration.statusCompleted,
        waiting: false,
        answer: 'Updated the form.',
        prompt: 'Fix the form.',
        canChangeFiles: true,
        changedPaths: ['src/form.ts'],
        savePoint: 'abc123save',
        tests: [
          { command: 'npm test', passed: true },
          { command: 'npm run build', passed: false },
        ],
      },
    ]);

    const warningAt = markup.indexOf('data-testid="collaboration-write-warning-writer-wait"');
    const approveAt = markup.indexOf('data-testid="collaboration-approve-writer-wait"');
    assert.ok(warningAt >= 0 && approveAt > warningAt);
    assert.match(markup, new RegExp(enMessages.collaboration.writerWarning));
    assert.doesNotMatch(markup, /data-testid="collaboration-write-warning-lead-wait"/);
    assert.match(markup, /data-testid="collaboration-changed-writer-done-0"/);
    assert.match(markup, /src\/form\.ts/);
    assert.match(markup, /data-testid="collaboration-save-point-writer-done"/);
    assert.match(markup, /abc123save/);
    assert.match(markup, /npm test Passed/);
    assert.match(markup, /npm run build Failed/);
    assert.match(markup, /data-testid="collaboration-workspace-writer-done"/);
    assert.match(markup, /href="\/en\/app"/);
    assert.match(markup, new RegExp(enMessages.collaboration.reviewOrRevert));
    assert.equal(
      zhTwMessages.collaboration.writerWarning,
      '核准這一步後，撰寫者可以修改檔案。',
    );
    assert.equal(
      zhCnMessages.collaboration.writerWarning,
      '批准这一步后，撰写者可以修改文件。',
    );
    assert.doesNotMatch(markup, /data-testid="collaboration-work-writer-wait"/);
  });

  test('a blocked writer-to-reviewer hand-off explains the tests and requires the checkbox', () => {
    const blocked = renderChain([
      {
        referralId: 'rev-failed',
        statusLabel: enMessages.collaboration.statusPendingApproval,
        waiting: true,
        answer: null,
        prompt: 'Look again.',
        testsGate: 'blocked',
        testsBlockReason: 'failed',
      },
      {
        referralId: 'rev-none',
        statusLabel: enMessages.collaboration.statusPendingApproval,
        waiting: true,
        answer: null,
        prompt: 'Look again.',
        testsGate: 'blocked',
        testsBlockReason: 'none',
      },
      {
        referralId: 'rev-passed',
        statusLabel: enMessages.collaboration.statusPendingApproval,
        waiting: true,
        answer: null,
        prompt: 'Look again.',
        testsGate: 'passed',
      },
    ]);

    assert.match(blocked, /data-testid="collaboration-tests-gate-rev-failed"/);
    assert.match(blocked, new RegExp(enMessages.collaboration.testsFailedGate));
    assert.match(blocked, /data-testid="collaboration-approve-without-tests-rev-failed"/);
    assert.match(blocked, new RegExp(enMessages.collaboration.approveWithoutPassingTests));
    assert.equal(tagHasBooleanAttr(openTag(blocked, 'collaboration-approve-rev-failed'), 'disabled'), true);
    assert.equal(
      tagHasBooleanAttr(openTag(blocked, 'collaboration-approve-without-tests-rev-failed'), 'checked'),
      false,
    );
    assert.match(blocked, new RegExp(enMessages.collaboration.testsMissingGate));
    assert.equal(tagHasBooleanAttr(openTag(blocked, 'collaboration-approve-rev-none'), 'disabled'), true);
    assert.doesNotMatch(blocked, /data-testid="collaboration-tests-gate-rev-passed"/);
    assert.equal(tagHasBooleanAttr(openTag(blocked, 'collaboration-approve-rev-passed'), 'disabled'), false);

    const ticked = renderChain([
      {
        referralId: 'rev-failed',
        statusLabel: enMessages.collaboration.statusPendingApproval,
        waiting: true,
        answer: null,
        prompt: 'Look again.',
        testsGate: 'blocked',
        testsBlockReason: 'failed',
        approveWithoutTests: true,
      },
    ]);
    assert.equal(
      tagHasBooleanAttr(openTag(ticked, 'collaboration-approve-without-tests-rev-failed'), 'checked'),
      true,
    );
    assert.equal(tagHasBooleanAttr(openTag(ticked, 'collaboration-approve-rev-failed'), 'disabled'), false);

    assert.equal(enMessages.collaboration.approveWithoutPassingTests, 'Approve without passing tests');
    assert.equal(enMessages.collaboration.testsFailedGate, 'The latest test did not pass.');
    assert.equal(enMessages.collaboration.testsMissingGate, 'No tests ran.');
    assert.equal(zhTwMessages.collaboration.testsFailedGate, '最近一次測試沒有通過。');
    assert.equal(zhTwMessages.collaboration.testsMissingGate, '沒有執行測試。');
    assert.equal(zhTwMessages.collaboration.approveWithoutPassingTests, '在測試未通過時仍核准');
    assert.equal(zhCnMessages.collaboration.testsFailedGate, '最近一次测试没有通过。');
    assert.equal(zhCnMessages.collaboration.testsMissingGate, '没有执行测试。');
    assert.equal(zhCnMessages.collaboration.approveWithoutPassingTests, '在测试未通过时仍批准');
    assert.equal(readTestsGate('blocked'), 'blocked');
    assert.equal(readTestsGate('unexpected'), 'not_required');
    assert.equal(readTestsBlockReason('failed'), 'failed');
    assert.equal(readTestsBlockReason('none'), 'none');
    assert.equal(readTestsBlockReason('later'), null);
    assert.equal(
      readTestsNotPassed(409, { code: 'TESTS_NOT_PASSED', testsBlockReason: 'failed' }),
      'failed',
    );
    assert.equal(readTestsNotPassed(409, { code: 'TESTS_NOT_PASSED' }), 'none');
    assert.equal(readTestsNotPassed(409, { message: 'Referral cannot be approved' }), null);
    assert.deepEqual(approveRequestBody(false), {});
    assert.deepEqual(approveRequestBody(true), { approveWithoutPassingTests: true });
    assert.equal(
      approveWithoutPassingTestsForClick({ testsGate: 'blocked', approveWithoutTests: false }),
      false,
    );
    assert.equal(
      approveWithoutPassingTestsForClick({ testsGate: 'blocked', approveWithoutTests: true }),
      true,
    );
    assert.equal(
      approveWithoutPassingTestsForClick({ testsGate: 'passed', approveWithoutTests: true }),
      false,
    );
    assert.equal(
      approveWithoutPassingTestsForClick({ testsGate: 'not_required', approveWithoutTests: true }),
      false,
    );
  });

  test('labels send-back rounds and shows the writer diff as text', () => {
    const diff = 'diff --git a/src/form.ts b/src/form.ts\n+fixed\n<script>alert(1)</script>';
    const markup = renderChain([
      {
        referralId: 'writer-diff',
        statusLabel: enMessages.collaboration.statusCompleted,
        waiting: false,
        answer: 'Updated the form.',
        prompt: 'Fix the form.',
        canChangeFiles: true,
        diff,
      },
      {
        referralId: 'round-1',
        statusLabel: enMessages.collaboration.statusPendingApproval,
        waiting: true,
        answer: null,
        prompt: 'Fix the listed items.',
        roundLabel: 'Round 1',
      },
      {
        referralId: 'round-2',
        statusLabel: enMessages.collaboration.statusPendingApproval,
        waiting: true,
        answer: null,
        prompt: 'Fix the remaining items.',
        roundLabel: 'Round 2',
        diffUnavailable: true,
      },
    ]);

    assert.match(markup, /data-testid="collaboration-round-round-1"/);
    assert.match(markup, /Round 1/);
    assert.match(markup, /data-testid="collaboration-round-round-2"/);
    assert.match(markup, /Round 2/);
    assert.match(markup, /data-testid="collaboration-diff-text-writer-diff"/);
    assert.match(markup, /diff --git a\/src\/form\.ts/);
    assert.match(markup, /font-mono/);
    assert.match(markup, /overflow-auto/);
    assert.match(markup, /max-w-full/);
    assert.match(markup, /whitespace-pre/);
    assert.doesNotMatch(markup, /<details[^>]*\sopen/);
    assert.match(markup, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(markup, /<script/);
    assert.match(markup, new RegExp(enMessages.collaboration.diffUnavailable));
    assert.deepStrictEqual(sendBackRoundNumbers([
      { source: 'lead', target: 'writer' },
      { source: 'writer', target: 'reviewer' },
      { source: 'reviewer', target: 'writer' },
      { source: 'writer', target: 'reviewer' },
      { source: 'reviewer', target: 'writer' },
    ]), [null, null, 1, null, 2]);
    assert.equal(zhTwMessages.collaboration.sendBackRound, '第 {round} 輪');
    assert.equal(zhCnMessages.collaboration.sendBackRound, '第 {round} 轮');
    assert.equal(zhTwMessages.collaboration.diff, '差異');
    assert.equal(zhCnMessages.collaboration.diff, '差异');
    assert.notEqual(zhTwMessages.collaboration.diffUnavailable, enMessages.collaboration.diffUnavailable);
    assert.notEqual(zhCnMessages.collaboration.diffEmpty, enMessages.collaboration.diffEmpty);
  });

  test('an answer containing a script tag renders as text', () => {
    const markup = renderChain([
      {
        referralId: 'answer-1',
        statusLabel: enMessages.collaboration.statusCompleted,
        waiting: false,
        answer: '<script>alert(1)</script>',
        prompt: '<script>prompt</script>',
      },
    ]);
    assert.match(markup, /data-testid="collaboration-answer-answer-1"/);
    assert.match(markup, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(markup, /<script/);
  });

  test('a finished hand-off lists sources, an unsourced label, and dropped markers', () => {
    const documentId = '33333333-3333-4333-8333-333333333333';
    const markup = renderChain([
      {
        referralId: 'cited',
        statusLabel: enMessages.collaboration.statusCompleted,
        waiting: false,
        answer: 'Revenue rose.',
        prompt: 'Look.',
        sources: [
          {
            documentId,
            title: '<script>alert(1)</script>',
            scopeLabel: enMessages.knowledge.scopes.policies,
            heading: 'Quarter',
          },
        ],
        showUnsourced: false,
        droppedSourceCount: 2,
      },
      {
        referralId: 'bare',
        statusLabel: enMessages.collaboration.statusCompleted,
        waiting: false,
        answer: 'No source marker in this answer.',
        prompt: 'Look.',
        showUnsourced: true,
        droppedSourceCount: 0,
      },
      {
        referralId: 'waiting-sources',
        statusLabel: enMessages.collaboration.statusPendingApproval,
        waiting: true,
        answer: 'Not finished.',
        prompt: 'Look.',
        sources: [
          {
            documentId,
            title: 'Handbook',
            scopeLabel: 'Policies',
            heading: 'Quarter',
          },
        ],
        showUnsourced: true,
        droppedSourceCount: 4,
      },
    ]);

    assert.equal(
      formatCollaborationSource({
        title: 'Handbook',
        scopeLabel: enMessages.knowledge.scopes.policies,
        heading: 'Quarter',
      }),
      'Handbook · Policies · Quarter',
    );
    assert.equal(
      formatCollaborationSource({
        title: 'Handbook',
        scopeLabel: 'Policies',
        heading: null,
      }),
      'Handbook · Policies',
    );
    assert.equal(
      collaborationScopeLabel('policies', enMessages.knowledge.scopes.policies),
      'Policies',
    );
    assert.equal(
      collaborationScopeLabel('policies', zhTwMessages.knowledge.scopes.policies),
      '政策',
    );
    assert.equal(
      collaborationScopeLabel('policies', zhCnMessages.knowledge.scopes.policies),
      '政策',
    );
    assert.equal(collaborationScopeLabel('policies', 'knowledge.scopes.policies'), 'policies');
    assert.deepEqual(
      readCollaborationSources([
        {
          documentId,
          title: 'Handbook',
          scopeId: 'policies',
          heading: 'Quarter',
          content: 'SECRET BODY',
        },
      ]),
      [{ documentId, title: 'Handbook', scopeId: 'policies', heading: 'Quarter' }],
    );
    assert.equal(readDroppedSourceCount(2), 2);
    assert.equal(readDroppedSourceCount(-1), 0);

    assert.match(markup, /data-testid="collaboration-sources-cited"/);
    assert.match(markup, /data-testid="collaboration-source-cited-0"/);
    assert.match(markup, new RegExp(enMessages.collaboration.sources));
    assert.match(markup, /&lt;script&gt;alert\(1\)&lt;\/script&gt; · Policies · Quarter/);
    assert.match(markup, /data-testid="collaboration-dropped-sources-cited"/);
    assert.match(markup, /2 source markers were left out\./);
    assert.doesNotMatch(markup, new RegExp(documentId));
    assert.doesNotMatch(markup, /SECRET BODY/);
    assert.doesNotMatch(markup, /data-testid="collaboration-unsourced-cited"/);

    assert.match(markup, /data-testid="collaboration-sources-bare"/);
    assert.match(markup, /data-testid="collaboration-unsourced-bare"/);
    assert.match(markup, new RegExp(enMessages.collaboration.unsourced));
    assert.doesNotMatch(markup, /data-testid="collaboration-source-bare-/);
    assert.doesNotMatch(markup, /data-testid="collaboration-dropped-sources-bare"/);
    assert.equal(markup.split(enMessages.collaboration.sources).length - 1, 1);
    assert.equal(markup.split('Handbook').length - 1, 0);

    assert.doesNotMatch(markup, /data-testid="collaboration-sources-waiting-sources"/);
    assert.doesNotMatch(markup, /data-testid="collaboration-unsourced-waiting-sources"/);
    assert.doesNotMatch(markup, /data-testid="collaboration-dropped-sources-waiting-sources"/);

    assert.equal(enMessages.collaboration.sources, 'Sources');
    assert.equal(enMessages.collaboration.unsourced, 'Unsourced');
    assert.equal(enMessages.collaboration.droppedSources, '{count} source markers were left out.');
    assert.equal(zhTwMessages.collaboration.sources, '來源');
    assert.equal(zhTwMessages.collaboration.unsourced, '沒有來源');
    assert.equal(zhTwMessages.collaboration.droppedSources, '已略過 {count} 個來源標記。');
    assert.equal(zhCnMessages.collaboration.sources, '来源');
    assert.equal(zhCnMessages.collaboration.unsourced, '没有来源');
    assert.equal(zhCnMessages.collaboration.droppedSources, '已略过 {count} 个来源标记。');
    const traditional = `${zhTwMessages.collaboration.sources}${zhTwMessages.collaboration.unsourced}${zhTwMessages.collaboration.droppedSources}`;
    const simplified = `${zhCnMessages.collaboration.sources}${zhCnMessages.collaboration.unsourced}${zhCnMessages.collaboration.droppedSources}`;
    assert.doesNotMatch(traditional, /agent/i);
    assert.doesNotMatch(simplified, /agent/i);
    assert.doesNotMatch(traditional, /代理人|智能体/);
    assert.doesNotMatch(simplified, /代理人|智能体/);
  });

  test('collaboration sources do not render HTML or markdown', () => {
    const files = [
      new URL('../components/collaboration/collaboration-view.tsx', import.meta.url),
      new URL('../components/collaboration/collaboration-page.tsx', import.meta.url),
      new URL('./collaboration/api.ts', import.meta.url),
      new URL('./collaboration/logic.ts', import.meta.url),
    ];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
      assert.doesNotMatch(source, /react-markdown|ReactMarkdown|marked\(/);
    }
  });

  test('every collaboration key exists in en, zh-TW, and zh-CN', () => {
    const catalogs = [enMessages.collaboration, zhTwMessages.collaboration, zhCnMessages.collaboration];
    const keys = Object.keys(enMessages.collaboration).sort();
    assert.ok(keys.length > 0);
    for (const catalog of catalogs) {
      assert.deepEqual(Object.keys(catalog).sort(), keys);
      for (const key of keys) {
        const value = catalog[key as keyof typeof catalog];
        assert.equal(typeof value, 'string');
        assert.equal(value.trim().length > 0, true);
      }
    }
    for (const key of keys) {
      const english = enMessages.collaboration[key as keyof typeof enMessages.collaboration];
      const traditional = zhTwMessages.collaboration[key as keyof typeof zhTwMessages.collaboration];
      const simplified = zhCnMessages.collaboration[key as keyof typeof zhCnMessages.collaboration];
      assert.notEqual(traditional, english);
      assert.notEqual(simplified, english);
      assert.match(traditional, /\p{Script=Han}/u);
      assert.match(simplified, /\p{Script=Han}/u);
    }
  });

  test('a second approval cannot start while the first is in flight', () => {
    const flight = createSingleFlight();
    assert.equal(flight.tryBegin(), true);
    assert.equal(flight.tryBegin(), false);
    flight.end();
    assert.equal(flight.tryBegin(), true);
  });

  test('polling runs only while the collaboration is active and the tab is visible', () => {
    assert.equal(shouldPollCollaboration({ runStatus: 'active', documentHidden: false }), true);
    assert.equal(shouldPollCollaboration({ runStatus: 'active', documentHidden: true }), false);
    assert.equal(shouldPollCollaboration({ runStatus: 'completed', documentHidden: false }), false);
    assert.equal(shouldPollCollaboration({ runStatus: 'failed', documentHidden: false }), false);
    assert.equal(collaborationRefusal(503, 'Execution globally disabled'), 'off');
    assert.equal(collaborationRefusal(429, 'Token quota exceeded'), 'tokens');
    assert.equal(collaborationRefusal(429, 'rate limit exceeded'), 'rate');
    assert.equal(collaborationRefusal(404, 'Collaboration run not found'), 'notFound');
    assert.equal(collaborationRefusal(409, 'Session is not usable'), 'session');
    assert.equal(collaborationRefusal(409, 'Referral is not pending approval'), 'generic');
  });

  test('a credit-cap 429 is the daily credit refusal', () => {
    const userBody = {
      statusCode: 429,
      message: 'Daily credit limit reached',
      error: 'Too Many Requests',
      cap: 'user',
    };
    const platformBody = {
      statusCode: 429,
      message: 'Daily credit limit reached',
      error: 'Too Many Requests',
      cap: 'platform',
    };
    assert.equal(collaborationRefusal(429, 'Daily credit limit reached', userBody), 'dailyCredits');
    assert.equal(
      collaborationRefusal(429, 'Daily credit limit reached', platformBody),
      'dailyCredits',
    );
    assert.equal(
      collaborationRefusal(429, 'Token quota exceeded', { ...userBody, message: 'Token quota exceeded' }),
      'dailyCredits',
    );
    assert.equal(
      collaborationRefusal(429, 'Daily credit limit reached', {
        statusCode: 429,
        message: 'Daily credit limit reached',
        error: 'Too Many Requests',
      }),
      'rate',
    );
    assert.equal(collaborationRefusal(429, 'Token quota exceeded', { cap: 'account' }), 'tokens');
    assert.equal(collaborationRefusalMessageKey('dailyCredits'), 'refusalDailyCredits');
    assert.equal(
      enMessages.collaboration.refusalDailyCredits,
      "You've used today's credit limit. Runs start again after midnight UTC.",
    );
    assert.equal(zhTwMessages.collaboration.refusalDailyCredits, '你已用完今天的點數上限。執行會在 UTC 午夜後重新開始。');
    assert.equal(zhCnMessages.collaboration.refusalDailyCredits, '你已用完今天的点数上限。运行会在 UTC 午夜后重新开始。');
  });

  test('cancel copy exists in en, zh-TW and zh-CN, and Cancelled is already labelled', () => {
    const keys = ['cancelRun', 'cancelRunPrompt', 'cancelRunConfirm', 'cancelRunKeep'] as const;
    for (const key of keys) {
      const english = enMessages.collaboration[key];
      const traditional = zhTwMessages.collaboration[key];
      const simplified = zhCnMessages.collaboration[key];
      assert.equal(typeof english, 'string');
      assert.equal(english.trim().length > 0, true);
      assert.notEqual(traditional, english);
      assert.notEqual(simplified, english);
      assert.notEqual(traditional, simplified);
      assert.match(traditional, /\p{Script=Han}/u);
      assert.match(simplified, /\p{Script=Han}/u);
    }
    assert.equal(enMessages.collaboration.statusCancelled, 'Cancelled');
    assert.equal(zhTwMessages.collaboration.statusCancelled, '已取消');
    assert.equal(zhCnMessages.collaboration.statusCancelled, '已取消');
    assert.equal(enMessages.collaboration.cancelRun, 'Cancel run');
    assert.equal(enMessages.collaboration.cancelRunPrompt, 'Cancel this run? Waiting and running steps stop.');
    assert.equal(enMessages.collaboration.cancelRunConfirm, 'Confirm cancel');
    assert.equal(enMessages.collaboration.cancelRunKeep, 'Keep run');
    assert.equal(zhTwMessages.collaboration.cancelRun, '取消這次執行');
    assert.equal(zhTwMessages.collaboration.cancelRunPrompt, '要取消這次執行嗎？等待中和進行中的步驟會停止。');
    assert.equal(zhTwMessages.collaboration.cancelRunConfirm, '確認取消');
    assert.equal(zhTwMessages.collaboration.cancelRunKeep, '保留這次執行');
    assert.equal(zhCnMessages.collaboration.cancelRun, '取消这次运行');
    assert.equal(zhCnMessages.collaboration.cancelRunPrompt, '要取消这次运行吗？等待中和进行中的步骤会停止。');
    assert.equal(zhCnMessages.collaboration.cancelRunConfirm, '确认取消');
    assert.equal(zhCnMessages.collaboration.cancelRunKeep, '保留这次运行');
  });

  test('collaborationRunEndedByReject is a failed run with a rejection and no failure or timeout', () => {
    assert.equal(collaborationRunEndedByReject('failed', ['rejected']), true);
    assert.equal(collaborationRunEndedByReject('failed', ['completed', 'rejected']), true);
    assert.equal(collaborationRunEndedByReject('failed', ['rejected', 'failed']), false);
    assert.equal(collaborationRunEndedByReject('failed', ['rejected', 'timed_out']), false);
    assert.equal(collaborationRunEndedByReject('failed', ['timed_out']), false);
    assert.equal(collaborationRunEndedByReject('active', ['rejected']), false);
    assert.equal(collaborationRunEndedByReject('completed', ['rejected']), false);
    assert.equal(collaborationRunEndedByReject('cancelled', ['rejected']), false);
    assert.equal(collaborationRunEndedByReject('failed', ['completed', 'approved']), false);
    assert.equal(collaborationRunEndedByReject('failed', []), false);
    assert.equal(collaborationRunEndedByReject(null, ['rejected']), false);
  });

  test('reject prompt, ended line, and Don\'t reject exist in en, zh-TW and zh-CN', () => {
    assert.equal(
      enMessages.collaboration.rejectPrompt,
      'Reject this step? Its work will not be used.',
    );
    assert.equal(
      zhTwMessages.collaboration.rejectPrompt,
      '要拒絕這一步嗎？這一步的結果不會被採用。',
    );
    assert.equal(
      zhCnMessages.collaboration.rejectPrompt,
      '要拒绝这一步吗？这一步的结果不会被采用。',
    );
    assert.equal(
      enMessages.collaboration.runEndedByReject,
      'This run ended after a rejection.',
    );
    assert.equal(zhTwMessages.collaboration.runEndedByReject, '這次執行在拒絕後結束了。');
    assert.equal(zhCnMessages.collaboration.runEndedByReject, '这次运行在拒绝后结束了。');
    assert.equal(enMessages.collaboration.cancelReject, "Don't reject");
    assert.equal(zhTwMessages.collaboration.cancelReject, '不要拒絕');
    assert.equal(zhCnMessages.collaboration.cancelReject, '不要拒绝');
  });
});

type ScheduledPoll = { fn: () => void; delay: number };

const fetchCalls: string[] = [];
const intervals = new Map<number, ScheduledPoll>();
let nextIntervalId = 1;
let scheduleCount = 0;
let runStatus = 'active';
let root: Root | null = null;
let latest: ReturnType<typeof useCollaborationScreen> | null = null;
let createRoot: (typeof import('react-dom/client'))['createRoot'];
let originalFetch: typeof fetch;
let originalSetInterval: typeof setInterval;
let originalClearInterval: typeof clearInterval;
let originalDocument: Document | undefined;

function createDomNode(tag = 'div') {
  const node: Record<string, unknown> = {
    nodeType: 1,
    nodeName: tag.toUpperCase(),
    tagName: tag.toUpperCase(),
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    style: {},
    attributes: {},
    childNodes: [],
    parentNode: null,
    ownerDocument: null,
    textContent: '',
    setAttribute(this: Record<string, unknown>, key: string, value: string) {
      (this.attributes as Record<string, string>)[key] = value;
    },
    setAttributeNS(this: Record<string, unknown>, _namespace: string, key: string, value: string) {
      (this.attributes as Record<string, string>)[key] = value;
    },
    focus(this: Record<string, unknown>) {
      const doc = this.ownerDocument as { activeElement?: unknown } | null;
      if (doc) {
        doc.activeElement = this;
      }
    },
    getAttribute(this: Record<string, unknown>, key: string) {
      return (this.attributes as Record<string, string>)[key] ?? null;
    },
    removeAttribute(this: Record<string, unknown>, key: string) {
      delete (this.attributes as Record<string, string>)[key];
    },
    hasAttribute(this: Record<string, unknown>, key: string) {
      return key in (this.attributes as Record<string, string>);
    },
    appendChild(this: Record<string, unknown>, child: Record<string, unknown>) {
      (this.childNodes as unknown[]).push(child);
      child.parentNode = this;
      return child;
    },
    removeChild(this: Record<string, unknown>, child: Record<string, unknown>) {
      this.childNodes = (this.childNodes as unknown[]).filter((item) => item !== child);
      return child;
    },
    insertBefore(this: Record<string, unknown>, child: Record<string, unknown>) {
      return (this.appendChild as (next: Record<string, unknown>) => unknown)(child);
    },
    addEventListener() {},
    removeEventListener() {},
  };
  return node;
}

function installScreenDom() {
  const doc: Record<string, unknown> = {
    nodeType: 9,
    visibilityState: 'visible',
    cookie: '',
    createElement(tag: string) {
      const node = createDomNode(tag);
      node.ownerDocument = doc;
      return node;
    },
    createElementNS(_ns: string, tag: string) {
      const node = createDomNode(tag);
      node.ownerDocument = doc;
      return node;
    },
    createTextNode(text: string) {
      return { nodeType: 3, nodeName: '#text', textContent: text, parentNode: null, ownerDocument: doc };
    },
    createComment(text: string) {
      return { nodeType: 8, nodeName: '#comment', textContent: text, ownerDocument: doc };
    },
    createDocumentFragment() {
      const node = createDomNode('#fragment');
      node.ownerDocument = doc;
      return node;
    },
    addEventListener() {},
    removeEventListener() {},
  };
  const body = createDomNode('body');
  body.ownerDocument = doc;
  doc.body = body;
  doc.documentElement = createDomNode('html');
  doc.head = createDomNode('head');
  doc.activeElement = body;
  doc.defaultView = globalThis;
  const globalObject = globalThis as Record<string, unknown>;
  globalObject.document = doc;
  globalObject.HTMLIFrameElement = function HTMLIFrameElement() {};
  globalObject.HTMLElement = function HTMLElement() {};
  globalObject.Element = function Element() {};
  globalObject.Node = function Node() {};
  globalObject.IS_REACT_ACT_ENVIRONMENT = true;
  globalObject.addEventListener = () => {};
  globalObject.removeEventListener = () => {};
  globalObject.dispatchEvent = () => true;
  globalObject.window = globalThis;
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: new Headers(),
    text: async () => JSON.stringify(body),
  } as Response;
}

function runPayload(status: string) {
  return {
    collaborationRunId: 'run-1',
    projectId: 'proj-1',
    status,
    createdAt: '2026-11-03T00:00:00.000Z',
    updatedAt: '2026-11-03T00:00:00.000Z',
    completedAt: null,
    failedAt: null,
  };
}

function installFetch() {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    fetchCalls.push(url);
    if (url.startsWith('/api/collaboration/runs?')) {
      return jsonResponse(200, { runs: [runPayload(runStatus)] });
    }
    if (url === '/api/collaboration/runs/run-1') {
      return jsonResponse(200, {
        run: runPayload(runStatus),
        team: ['lead', 'writer', 'reviewer'],
        handoffs: [],
      });
    }
    return jsonResponse(404, { message: 'missing' });
  }) as typeof fetch;
}

function startedRunResponse(): Response {
  return jsonResponse(201, {
    collaborationRunId: 'run-1',
    projectId: 'proj-1',
    status: 'active',
    referralId: 'ref-1',
    handoffStatus: 'pending_approval',
    source: 'user',
    target: 'lead',
    conversationId: 'conv-1',
    conversationCreated: false,
  });
}

function installStartFetch(onPost: (body: unknown) => Response | Promise<Response>): unknown[] {
  const posts: unknown[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    fetchCalls.push(url);
    if (method === 'POST' && url === '/api/collaboration/runs') {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      posts.push(body);
      return await onPost(body);
    }
    if (url.startsWith('/api/collaboration/runs?')) {
      return jsonResponse(200, { runs: [runPayload('active')] });
    }
    if (url === '/api/collaboration/runs/run-1') {
      return jsonResponse(200, {
        run: runPayload('active'),
        team: ['lead', 'writer', 'reviewer'],
        handoffs: [],
      });
    }
    return jsonResponse(404, { message: 'missing' });
  }) as typeof fetch;
  return posts;
}

function installIntervals() {
  globalThis.setInterval = ((fn: () => void, delay?: number) => {
    const id = nextIntervalId;
    nextIntervalId += 1;
    scheduleCount += 1;
    intervals.set(id, { fn, delay: delay ?? 0 });
    return id as unknown as ReturnType<typeof setInterval>;
  }) as typeof setInterval;
  globalThis.clearInterval = ((id?: ReturnType<typeof setInterval>) => {
    if (typeof id === 'number') {
      intervals.delete(id);
    }
  }) as typeof clearInterval;
}

function Probe(props: { generation: number; projectId: string }) {
  const catalog = enMessages.collaboration as Record<string, string>;
  const generation = props.generation;
  const t = (key: string) => `${generation}:${catalog[key] ?? key}`;
  latest = useCollaborationScreen({
    t,
    locale: 'en',
    sessionId: 'session-1',
    queryProjectId: props.projectId,
  });
  return createElement('div');
}

async function renderScreen(generation: number, projectId: string) {
  await act(async () => {
    root!.render(createElement(Probe, { generation, projectId }));
  });
}

async function firePoll() {
  assert.equal(intervals.size, 1);
  const scheduled = [...intervals.values()][0];
  assert.ok(scheduled);
  assert.equal(scheduled.delay, COLLABORATION_POLL_MS);
  await act(async () => {
    scheduled.fn();
    for (let step = 0; step < 30; step += 1) {
      await Promise.resolve();
    }
  });
}

function handoffRecord(referralId: string, status: string) {
  return {
    referralId,
    status,
    source: 'user',
    target: 'lead',
    prompt: 'Look at the form.',
    answer: status === 'pending_approval' ? null : 'Noted.',
    handoffNote: null,
    failureReason: null,
    decidedBy: status === 'pending_approval' ? null : 'user',
    rejectReason: status === 'rejected' ? 'Not this' : null,
  };
}

function visitHost(
  node: Record<string, unknown>,
  visit: (current: Record<string, unknown>) => void,
) {
  visit(node);
  const children = node.childNodes;
  if (!Array.isArray(children)) {
    return;
  }
  for (const child of children) {
    visitHost(child as Record<string, unknown>, visit);
  }
}

function hostReactProps(node: Record<string, unknown>): Record<string, unknown> | null {
  const key = Object.keys(node).find((name) => name.startsWith('__reactProps$'));
  return key ? (node[key] as Record<string, unknown>) : null;
}

function findHostByTestId(rootNode: Record<string, unknown>, testId: string) {
  let found: Record<string, unknown> | null = null;
  visitHost(rootNode, (node) => {
    if (found) {
      return;
    }
    const attributes = node.attributes as Record<string, string> | undefined;
    if (attributes && attributes['data-testid'] === testId) {
      found = node;
    }
  });
  return found;
}

function findHostByText(rootNode: Record<string, unknown>, text: string) {
  let found: Record<string, unknown> | null = null;
  visitHost(rootNode, (node) => {
    if (found) {
      return;
    }
    const props = hostReactProps(node);
    if (typeof props?.children === 'string' && props.children.includes(text)) {
      found = node;
    }
  });
  return found;
}

function enterKey(composing = false) {
  return {
    key: 'Enter',
    preventDefault() {},
    nativeEvent: { isComposing: composing, keyCode: composing ? 229 : 13 },
  };
}

async function flushCollaboration() {
  await act(async () => {
    for (let step = 0; step < 40; step += 1) {
      await Promise.resolve();
    }
  });
}

async function mountLatestView() {
  const container = (
    globalThis.document as { createElement: (tag: string) => Record<string, unknown> }
  ).createElement('div');
  const viewRoot = createRoot(container as unknown as Element);
  await act(async () => {
    viewRoot.render(createElement(CollaborationView, latest!));
  });
  return { container, viewRoot };
}

function installRejectFetch(state: {
  status: string;
  handoffs: ReturnType<typeof handoffRecord>[];
  onReject?: (body: unknown) => Response | Promise<Response>;
}) {
  const posts: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    fetchCalls.push(url);
    if (method === 'POST' && url.includes('/reject')) {
      posts.push(String(init?.body ?? ''));
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      if (state.onReject) {
        return await state.onReject(body);
      }
      return jsonResponse(200, { ok: true });
    }
    if (url.startsWith('/api/collaboration/runs?')) {
      return jsonResponse(200, { runs: [runPayload(state.status)] });
    }
    if (url === '/api/collaboration/runs/run-1') {
      return jsonResponse(200, {
        run: runPayload(state.status),
        team: ['lead', 'writer', 'reviewer'],
        handoffs: state.handoffs,
      });
    }
    return jsonResponse(404, { message: 'missing' });
  }) as typeof fetch;
  return posts;
}

async function openCollaborationRun() {
  await renderScreen(1, 'proj-1');
  await act(async () => {
    latest!.onOpenRun('run-1');
  });
  await flushCollaboration();
}

describe('collaboration screen reload', () => {
  before(async () => {
    originalDocument = globalThis.document;
    installScreenDom();
    ({ createRoot } = await import('react-dom/client'));
  });

  after(() => {
    if (originalDocument === undefined) {
      delete (globalThis as { document?: Document }).document;
    } else {
      globalThis.document = originalDocument;
    }
  });

  beforeEach(() => {
    fetchCalls.length = 0;
    intervals.clear();
    nextIntervalId = 1;
    scheduleCount = 0;
    runStatus = 'active';
    latest = null;
    originalFetch = globalThis.fetch;
    originalSetInterval = globalThis.setInterval;
    originalClearInterval = globalThis.clearInterval;
    installFetch();
    installIntervals();
    const container = (globalThis.document as { createElement: (tag: string) => unknown }).createElement('div');
    root = createRoot(container as unknown as Element);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root!.unmount();
      });
      root = null;
    }
    latest = null;
    globalThis.fetch = originalFetch;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
    fetchCalls.length = 0;
    intervals.clear();
  });

  test('a new t on each render does not fetch again', async () => {
    await renderScreen(0, '');
    assert.deepEqual(fetchCalls, []);
    await renderScreen(1, '');
    assert.deepEqual(fetchCalls, []);

    await renderScreen(2, 'proj-1');
    assert.deepEqual(fetchCalls, ['/api/collaboration/runs?projectId=proj-1']);
    assert.equal(latest?.loading, false);
    assert.equal(latest?.notice, null);

    for (const generation of [3, 4, 5, 6]) {
      await renderScreen(generation, 'proj-1');
    }
    assert.deepEqual(fetchCalls, ['/api/collaboration/runs?projectId=proj-1']);

    await renderScreen(7, 'proj-2');
    assert.deepEqual(fetchCalls, [
      '/api/collaboration/runs?projectId=proj-1',
      '/api/collaboration/runs?projectId=proj-2',
    ]);
    for (const generation of [8, 9, 10]) {
      await renderScreen(generation, 'proj-2');
    }
    assert.equal(fetchCalls.length, 2);
    assert.equal(latest?.notice, null);
  });

  test('polling fires every 5 seconds while active and stops when finished', async () => {
    await renderScreen(1, 'proj-1');
    assert.deepEqual(fetchCalls, ['/api/collaboration/runs?projectId=proj-1']);
    assert.equal(scheduleCount, 0);

    await act(async () => {
      latest!.onOpenRun('run-1');
    });
    assert.deepEqual(fetchCalls, [
      '/api/collaboration/runs?projectId=proj-1',
      '/api/collaboration/runs/run-1',
    ]);
    assert.equal(scheduleCount, 1);
    assert.equal(latest?.notice, null);

    await renderScreen(2, 'proj-1');
    await renderScreen(3, 'proj-1');
    assert.equal(fetchCalls.length, 2);
    assert.equal(scheduleCount, 1);

    await firePoll();
    assert.equal(fetchCalls.length, 4);
    assert.equal(scheduleCount, 1);
    await firePoll();
    assert.equal(fetchCalls.length, 6);
    assert.equal(scheduleCount, 1);

    runStatus = 'completed';
    await firePoll();
    assert.equal(fetchCalls.length, 8);
    assert.equal(intervals.size, 0);
    assert.equal(scheduleCount, 1);
    assert.equal(latest?.notice, null);

    const stopped = fetchCalls.length;
    await renderScreen(4, 'proj-1');
    assert.equal(fetchCalls.length, stopped);
    assert.equal(intervals.size, 0);
  });

  test('a 409 TESTS_NOT_PASSED response blocks approval until the box is ticked', async () => {
    const bodies: unknown[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      fetchCalls.push(url);
      if (url.startsWith('/api/collaboration/runs?')) {
        return jsonResponse(200, { runs: [runPayload('active')] });
      }
      if (url === '/api/collaboration/runs/run-1') {
        return jsonResponse(200, {
          run: runPayload('active'),
          team: ['lead', 'writer', 'reviewer'],
          handoffs: [
            {
              referralId: 'rev-1',
              status: 'pending_approval',
              source: 'writer',
              target: 'reviewer',
              prompt: 'Look again.',
              answer: null,
              handoffNote: null,
              failureReason: null,
              decidedBy: null,
              rejectReason: null,
              testsGate: 'not_required',
              testsBlockReason: null,
            },
          ],
        });
      }
      if (url.includes('/approve')) {
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        bodies.push(body);
        if (body && body.approveWithoutPassingTests === true) {
          return jsonResponse(200, { referralId: 'rev-1', status: 'approved' });
        }
        return jsonResponse(409, {
          statusCode: 409,
          message: 'The latest validation run did not pass.',
          code: 'TESTS_NOT_PASSED',
          testsBlockReason: 'failed',
        });
      }
      return jsonResponse(404, { message: 'missing' });
    }) as typeof fetch;

    await renderScreen(1, 'proj-1');
    await act(async () => {
      latest!.onOpenRun('run-1');
    });
    await act(async () => {
      for (let step = 0; step < 40; step += 1) {
        await Promise.resolve();
      }
    });
    assert.equal(latest?.handoffs[0]?.testsGate, 'not_required');
    assert.equal(latest?.notice, null);

    await act(async () => {
      latest!.onApprove('rev-1', false);
      for (let step = 0; step < 40; step += 1) {
        await Promise.resolve();
      }
    });
    assert.deepEqual(bodies[0], {});
    assert.equal(latest?.handoffs[0]?.testsGate, 'blocked');
    assert.equal(latest?.handoffs[0]?.testsBlockReason, 'failed');
    assert.equal(latest?.handoffs[0]?.approveWithoutTests, false);
    assert.equal(latest?.notice, null);

    await act(async () => {
      latest!.onApproveWithoutTestsChange('rev-1', true);
    });
    assert.equal(latest?.handoffs[0]?.approveWithoutTests, true);
    await act(async () => {
      latest!.onApprove('rev-1', latest!.handoffs[0]!.approveWithoutTests);
      for (let step = 0; step < 40; step += 1) {
        await Promise.resolve();
      }
    });
    assert.deepEqual(bodies[1], { approveWithoutPassingTests: true });
  });

  test('start sends the selected team', async () => {
    const bodies: unknown[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      fetchCalls.push(url);
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        bodies.push(JSON.parse(String(init?.body)));
        return jsonResponse(201, {
          collaborationRunId: 'run-9',
          projectId: 'proj-1',
          status: 'active',
          referralId: 'ref-9',
          handoffStatus: 'pending_approval',
          source: 'user',
          target: 'chief-of-staff',
          conversationId: 'conv-1',
          conversationCreated: false,
        });
      }
      if (url.startsWith('/api/collaboration/runs?')) {
        return jsonResponse(200, {
          runs: [{ ...runPayload('active'), collaborationRunId: 'run-9', teamId: 'chief-of-staff' }],
        });
      }
      if (url.includes('/api/collaboration/runs/run-9')) {
        return jsonResponse(200, {
          run: { ...runPayload('active'), collaborationRunId: 'run-9' },
          teamId: 'chief-of-staff',
          team: ['chief-of-staff'],
          handoffs: [],
        });
      }
      return jsonResponse(404, { message: 'missing' });
    }) as typeof fetch;

    await renderScreen(1, 'proj-1');
    await act(async () => {
      latest!.onTeamChange('chief-of-staff');
      latest!.onTaskChange('What is our goal?');
    });
    await act(async () => {
      latest!.onStart();
      for (let step = 0; step < 40; step += 1) {
        await Promise.resolve();
      }
    });

    assert.deepEqual(bodies, [
      {
        sessionId: 'session-1',
        task: 'What is our goal?',
        team: 'chief-of-staff',
      },
    ]);
    assert.equal(latest?.selectedTeam, 'chief-of-staff');
    assert.equal(latest?.runTeam?.roles.length, 1);
    assert.match(String(latest?.runTeam?.label), /幕僚|Chief of Staff/);
  });

  test('two onStart calls in the same tick send one collaboration run', async () => {
    const posts = installStartFetch(() => startedRunResponse());
    await renderScreen(1, 'proj-1');
    await act(async () => {
      latest!.onTaskChange('Build the login form');
    });
    await act(async () => {
      latest!.onStart();
      latest!.onStart();
      for (let step = 0; step < 40; step += 1) {
        await Promise.resolve();
      }
    });
    assert.equal(posts.length, 1);
    assert.deepEqual(posts[0], {
      sessionId: 'session-1',
      task: 'Build the login form',
      team: 'coding',
    });
  });

  test('a successful start clears the task and disables Start', async () => {
    installStartFetch(() => startedRunResponse());
    await renderScreen(1, 'proj-1');
    await act(async () => {
      latest!.onTeamChange('advisors');
      latest!.onTaskChange('Ship the login form once');
    });
    assert.ok(latest);
    const before = renderToStaticMarkup(createElement(CollaborationView, latest));
    assert.equal(tagHasBooleanAttr(openTag(before, 'collaboration-start'), 'disabled'), false);

    await act(async () => {
      latest!.onStart();
      for (let step = 0; step < 40; step += 1) {
        await Promise.resolve();
      }
    });

    assert.equal(latest?.task, '');
    assert.equal(latest?.deciding, false);
    assert.equal(latest?.selectedTeam, 'advisors');
    assert.ok(latest);
    const after = renderToStaticMarkup(createElement(CollaborationView, latest));
    assert.equal(tagHasBooleanAttr(openTag(after, 'collaboration-start'), 'disabled'), true);
    assert.doesNotMatch(after, /Ship the login form once/);
    const advisorsAt = after.indexOf('data-testid="collaboration-team-option-advisors"');
    assert.ok(advisorsAt >= 0);
    assert.match(after.slice(advisorsAt, advisorsAt + 500), /checked/);
  });

  test('a refused start keeps the task and a later onStart sends again', async () => {
    const posts = installStartFetch(() =>
      jsonResponse(409, { message: 'Session is not usable' }),
    );
    await renderScreen(1, 'proj-1');
    await act(async () => {
      latest!.onTeamChange('chief-of-staff');
      latest!.onTaskChange('Keep this question');
    });
    await act(async () => {
      latest!.onStart();
      for (let step = 0; step < 40; step += 1) {
        await Promise.resolve();
      }
    });
    assert.equal(posts.length, 1);
    assert.equal(latest?.task, 'Keep this question');
    assert.equal(latest?.selectedTeam, 'chief-of-staff');
    assert.equal(latest?.deciding, false);

    await act(async () => {
      latest!.onStart();
      for (let step = 0; step < 40; step += 1) {
        await Promise.resolve();
      }
    });
    assert.equal(posts.length, 2);
    assert.deepEqual(posts[1], {
      sessionId: 'session-1',
      task: 'Keep this question',
      team: 'chief-of-staff',
    });
    assert.equal(latest?.task, 'Keep this question');
    assert.equal(latest?.selectedTeam, 'chief-of-staff');
  });

  test('a thrown start releases the guard and keeps the task', async () => {
    const posts = installStartFetch(() => {
      throw new Error('network down');
    });
    await renderScreen(1, 'proj-1');
    await act(async () => {
      latest!.onTaskChange('Retry after the network error');
    });
    await act(async () => {
      latest!.onStart();
      for (let step = 0; step < 40; step += 1) {
        await Promise.resolve();
      }
    });
    assert.equal(posts.length, 1);
    assert.equal(latest?.task, 'Retry after the network error');
    assert.equal(latest?.deciding, false);
    assert.match(String(latest?.notice), /That did not work\. Try again\./);

    await act(async () => {
      latest!.onStart();
      for (let step = 0; step < 40; step += 1) {
        await Promise.resolve();
      }
    });
    assert.equal(posts.length, 2);
    assert.equal(latest?.task, 'Retry after the network error');
    assert.equal(latest?.selectedTeam, 'coding');
  });

  test('Cancel run shows only for an active run, and Keep run sends nothing', async () => {
    await renderScreen(1, 'proj-1');
    let markup = renderToStaticMarkup(createElement(CollaborationView, latest!));
    assert.doesNotMatch(markup, /data-testid="collaboration-cancel-run"/);

    await act(async () => {
      latest!.onOpenRun('run-1');
    });
    markup = renderToStaticMarkup(createElement(CollaborationView, latest!));
    assert.match(markup, /data-testid="collaboration-cancel-run"/);
    assert.match(markup, /Cancel run/);
    assert.doesNotMatch(markup, /data-testid="collaboration-cancel-confirm"/);
    assert.doesNotMatch(markup, /data-testid="collaboration-cancel-keep"/);

    const before = fetchCalls.length;
    await act(async () => {
      latest!.onBeginCancel();
    });
    assert.equal(fetchCalls.length, before);
    markup = renderToStaticMarkup(createElement(CollaborationView, latest!));
    assert.match(markup, /data-testid="collaboration-cancel-confirm"/);
    assert.match(markup, /data-testid="collaboration-cancel-keep"/);
    assert.match(markup, /Cancel this run\? Waiting and running steps stop\./);
    assert.doesNotMatch(markup, /data-testid="collaboration-cancel-run"/);

    await act(async () => {
      latest!.onCancelCancel();
    });
    assert.equal(fetchCalls.length, before);
    assert.equal(
      fetchCalls.some((url) => url.includes('/cancel')),
      false,
    );
    markup = renderToStaticMarkup(createElement(CollaborationView, latest!));
    assert.match(markup, /data-testid="collaboration-cancel-run"/);
    assert.doesNotMatch(markup, /data-testid="collaboration-cancel-confirm"/);

    runStatus = 'completed';
    await firePoll();
    markup = renderToStaticMarkup(createElement(CollaborationView, latest!));
    assert.doesNotMatch(markup, /data-testid="collaboration-cancel-run"/);
    assert.doesNotMatch(markup, /data-testid="collaboration-cancel-confirm"/);
    assert.equal(latest?.runs[0]?.statusLabel, `1:${enMessages.collaboration.statusCompleted}`);
  });

  test('confirm cancel posts once, disables the buttons while deciding, and refreshes', async () => {
    const posts: string[] = [];
    let detailStatus = 'active';
    const gate: { resolve: (response: Response) => void } = {
      resolve: () => {
        throw new Error('cancel was not waiting');
      },
    };
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      fetchCalls.push(url);
      if (method === 'POST' && url === '/api/collaboration/runs/run-1/cancel') {
        posts.push(String(init?.body ?? ''));
        return new Promise<Response>((resolve) => {
          gate.resolve = (response) => resolve(response);
        });
      }
      if (url.startsWith('/api/collaboration/runs?')) {
        return jsonResponse(200, { runs: [{ ...runPayload(detailStatus), teamId: 'coding' }] });
      }
      if (url === '/api/collaboration/runs/run-1') {
        return jsonResponse(200, {
          run: runPayload(detailStatus),
          teamId: 'coding',
          team: ['lead', 'writer', 'reviewer'],
          handoffs: [],
        });
      }
      return jsonResponse(404, { message: 'missing' });
    }) as typeof fetch;

    await renderScreen(1, 'proj-1');
    await act(async () => {
      latest!.onOpenRun('run-1');
    });
    await act(async () => {
      latest!.onBeginCancel();
    });
    await act(async () => {
      latest!.onConfirmCancel();
      latest!.onConfirmCancel();
      await Promise.resolve();
    });
    assert.deepEqual(posts, ['{}']);
    assert.equal(latest?.deciding, true);
    let markup = renderToStaticMarkup(createElement(CollaborationView, latest!));
    assert.equal(tagHasBooleanAttr(openTag(markup, 'collaboration-cancel-confirm'), 'disabled'), true);
    assert.equal(tagHasBooleanAttr(openTag(markup, 'collaboration-cancel-keep'), 'disabled'), true);

    detailStatus = 'cancelled';
    await act(async () => {
      gate.resolve(jsonResponse(200, { collaborationRunId: 'run-1', status: 'cancelled' }));
      for (let step = 0; step < 40; step += 1) {
        await Promise.resolve();
      }
    });
    assert.deepEqual(posts, ['{}']);
    assert.equal(latest?.deciding, false);
    assert.equal(latest?.notice, null);
    assert.equal(latest?.runs[0]?.statusLabel, `1:${enMessages.collaboration.statusCancelled}`);
    assert.ok(fetchCalls.filter((url) => url.startsWith('/api/collaboration/runs?')).length >= 2);
    assert.ok(fetchCalls.filter((url) => url === '/api/collaboration/runs/run-1').length >= 2);
    markup = renderToStaticMarkup(createElement(CollaborationView, latest!));
    assert.doesNotMatch(markup, /data-testid="collaboration-cancel-run"/);
    assert.doesNotMatch(markup, /data-testid="collaboration-cancel-confirm"/);
    assert.match(markup, new RegExp(enMessages.collaboration.statusCancelled));
  });

  test('a refused cancel shows the refusal notice and does not refresh', async () => {
    const posts: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      fetchCalls.push(url);
      if (method === 'POST' && url === '/api/collaboration/runs/run-1/cancel') {
        posts.push(String(init?.body ?? ''));
        return jsonResponse(409, {
          statusCode: 409,
          message: 'Collaboration run is not active',
          error: 'Conflict',
        });
      }
      if (url.startsWith('/api/collaboration/runs?')) {
        return jsonResponse(200, { runs: [runPayload('active')] });
      }
      if (url === '/api/collaboration/runs/run-1') {
        return jsonResponse(200, {
          run: runPayload('active'),
          team: ['lead', 'writer', 'reviewer'],
          handoffs: [],
        });
      }
      return jsonResponse(404, { message: 'missing' });
    }) as typeof fetch;

    await renderScreen(1, 'proj-1');
    await act(async () => {
      latest!.onOpenRun('run-1');
    });
    const before = fetchCalls.length;
    await act(async () => {
      latest!.onBeginCancel();
    });
    await act(async () => {
      latest!.onConfirmCancel();
      for (let step = 0; step < 40; step += 1) {
        await Promise.resolve();
      }
    });
    assert.deepEqual(posts, ['{}']);
    assert.equal(fetchCalls.length, before + 1);
    assert.match(String(latest?.notice), /That did not work\. Try again\./);
    assert.equal(latest?.runs[0]?.statusLabel, `1:${enMessages.collaboration.statusActive}`);
    const markup = renderToStaticMarkup(createElement(CollaborationView, latest!));
    assert.match(markup, /data-testid="collaboration-notice"/);
    assert.match(markup, /data-testid="collaboration-cancel-confirm"/);
  });

  test('opening reject mode hides Approve, and Don\'t reject sends nothing', async () => {
    installRejectFetch({
      status: 'active',
      handoffs: [
        handoffRecord('ref-a', 'pending_approval'),
        handoffRecord('ref-b', 'pending_approval'),
      ],
    });
    await openCollaborationRun();
    assert.equal(latest?.handoffs.length, 2);
    assert.equal(latest?.runEndedByReject, false);

    await act(async () => {
      latest!.onBeginReject('ref-a');
    });
    let markup = renderToStaticMarkup(createElement(CollaborationView, latest!));
    assert.doesNotMatch(markup, /data-testid="collaboration-approve-ref-a"/);
    assert.doesNotMatch(markup, /data-testid="collaboration-reject-ref-a"/);
    assert.match(markup, /data-testid="collaboration-approve-ref-b"/);
    assert.match(markup, /data-testid="collaboration-reject-ref-b"/);
    assert.match(markup, /Reject this step\? Its work will not be used\./);
    assert.match(markup, /data-testid="collaboration-reject-reason-ref-a"/);
    assert.match(openTag(markup, 'collaboration-reject-reason-ref-a'), /autofocus/i);
    const confirm = openTag(markup, 'collaboration-reject-confirm-ref-a');
    assert.match(confirm, /bg-red-600/);
    assert.match(confirm, /text-white/);
    assert.match(confirm, /hover:bg-red-700/);
    assert.match(confirm, /disabled:opacity-50/);
    assert.match(markup, /Don(?:'|&#x27;)t reject/);
    assert.doesNotMatch(markup, /data-testid="collaboration-run-ended-by-reject"/);
    const promptAt = markup.indexOf('Reject this step? Its work will not be used.');
    const reasonAt = markup.indexOf('data-testid="collaboration-reject-reason-ref-a"');
    assert.ok(promptAt >= 0 && reasonAt > promptAt);

    const before = fetchCalls.length;
    const mounted = await mountLatestView();
    try {
      const input = findHostByTestId(mounted.container, 'collaboration-reject-reason-ref-a');
      assert.ok(input);
      assert.equal(
        (globalThis.document as { activeElement?: unknown }).activeElement,
        input,
      );
      const back = findHostByText(mounted.container, "Don't reject");
      assert.ok(back);
      const onClick = hostReactProps(back)?.onClick as (() => void) | undefined;
      assert.equal(typeof onClick, 'function');
      await act(async () => {
        onClick!();
      });
    } finally {
      await act(async () => {
        mounted.viewRoot.unmount();
      });
    }
    assert.equal(fetchCalls.length, before);
    assert.equal(
      fetchCalls.some((url) => url.includes('/reject')),
      false,
    );
    markup = renderToStaticMarkup(createElement(CollaborationView, latest!));
    assert.match(markup, /data-testid="collaboration-approve-ref-a"/);
    assert.match(markup, /data-testid="collaboration-reject-ref-a"/);
    assert.doesNotMatch(markup, /Reject this step\? Its work will not be used/);
    assert.doesNotMatch(markup, /data-testid="collaboration-reject-reason-ref-a"/);
  });

  test('Enter in the reason box sends one reject with the reason and refreshes', async () => {
    const state = {
      status: 'active',
      handoffs: [handoffRecord('ref-a', 'pending_approval')],
    };
    let release: (response: Response) => void = () => {
      throw new Error('reject was not waiting');
    };
    const posts = installRejectFetch({
      get status() {
        return state.status;
      },
      get handoffs() {
        return state.handoffs;
      },
      onReject: () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    });
    await openCollaborationRun();
    await act(async () => {
      latest!.onBeginReject('ref-a');
      latest!.onRejectReasonChange('Not this step');
    });
    const listBefore = fetchCalls.filter((url) => url.startsWith('/api/collaboration/runs?')).length;
    const detailBefore = fetchCalls.filter((url) => url === '/api/collaboration/runs/run-1').length;
    const mounted = await mountLatestView();
    try {
      const input = findHostByTestId(mounted.container, 'collaboration-reject-reason-ref-a');
      assert.ok(input);
      const onKeyDown = hostReactProps(input)?.onKeyDown as
        | ((event: ReturnType<typeof enterKey>) => void)
        | undefined;
      assert.equal(typeof onKeyDown, 'function');
      await act(async () => {
        onKeyDown!(enterKey(true));
      });
      assert.deepEqual(posts, []);
      await act(async () => {
        onKeyDown!(enterKey());
        onKeyDown!(enterKey());
        await Promise.resolve();
      });
      assert.deepEqual(
        posts.map((body) => JSON.parse(body)),
        [{ reason: 'Not this step' }],
      );
      assert.equal(latest?.deciding, true);
      await act(async () => {
        onKeyDown!(enterKey());
      });
      assert.deepEqual(posts, ['{"reason":"Not this step"}']);
    } finally {
      await act(async () => {
        mounted.viewRoot.unmount();
      });
    }

    state.status = 'failed';
    state.handoffs = [handoffRecord('ref-a', 'rejected')];
    await act(async () => {
      release(jsonResponse(200, { referralId: 'ref-a', status: 'rejected' }));
      for (let step = 0; step < 40; step += 1) {
        await Promise.resolve();
      }
    });
    assert.deepEqual(
      posts.map((body) => JSON.parse(body)),
      [{ reason: 'Not this step' }],
    );
    assert.equal(latest?.deciding, false);
    assert.equal(latest?.rejectReferralId, null);
    assert.equal(latest?.runEndedByReject, true);
    assert.ok(fetchCalls.filter((url) => url.startsWith('/api/collaboration/runs?')).length > listBefore);
    assert.ok(fetchCalls.filter((url) => url === '/api/collaboration/runs/run-1').length > detailBefore);
    const markup = renderToStaticMarkup(createElement(CollaborationView, latest!));
    assert.match(markup, /data-testid="collaboration-run-ended-by-reject"/);
    assert.match(markup, /This run ended after a rejection\./);
  });

  test('Enter with an empty reason sends one reject body of {} and refreshes', async () => {
    const posts = installRejectFetch({
      status: 'active',
      handoffs: [handoffRecord('ref-a', 'pending_approval')],
    });
    await openCollaborationRun();
    await act(async () => {
      latest!.onBeginReject('ref-a');
    });
    const listBefore = fetchCalls.filter((url) => url.startsWith('/api/collaboration/runs?')).length;
    const detailBefore = fetchCalls.filter((url) => url === '/api/collaboration/runs/run-1').length;
    const mounted = await mountLatestView();
    try {
      const input = findHostByTestId(mounted.container, 'collaboration-reject-reason-ref-a');
      assert.ok(input);
      const onKeyDown = hostReactProps(input)?.onKeyDown as
        | ((event: ReturnType<typeof enterKey>) => void)
        | undefined;
      assert.equal(typeof onKeyDown, 'function');
      await act(async () => {
        onKeyDown!(enterKey());
        for (let step = 0; step < 40; step += 1) {
          await Promise.resolve();
        }
      });
    } finally {
      await act(async () => {
        mounted.viewRoot.unmount();
      });
    }
    assert.deepEqual(posts, ['{}']);
    assert.equal(latest?.rejectReferralId, null);
    assert.equal(latest?.deciding, false);
    assert.ok(fetchCalls.filter((url) => url.startsWith('/api/collaboration/runs?')).length > listBefore);
    assert.ok(fetchCalls.filter((url) => url === '/api/collaboration/runs/run-1').length > detailBefore);
  });

  test('the ended line shows when the open run ended by rejection', async () => {
    installRejectFetch({
      status: 'failed',
      handoffs: [handoffRecord('ref-a', 'rejected'), handoffRecord('ref-b', 'completed')],
    });
    await openCollaborationRun();
    assert.equal(
      collaborationRunEndedByReject('failed', ['rejected', 'completed']),
      true,
    );
    assert.equal(latest?.runEndedByReject, true);
    const markup = renderToStaticMarkup(createElement(CollaborationView, latest!));
    assert.match(markup, /data-testid="collaboration-run-ended-by-reject"/);
    assert.match(markup, /This run ended after a rejection\./);
  });

  test('the ended line stays hidden when a rejection shares the run with a timeout', async () => {
    installRejectFetch({
      status: 'failed',
      handoffs: [handoffRecord('ref-a', 'rejected'), handoffRecord('ref-b', 'timed_out')],
    });
    await openCollaborationRun();
    assert.equal(collaborationRunEndedByReject('failed', ['rejected', 'timed_out']), false);
    assert.equal(latest?.runEndedByReject, false);
    const markup = renderToStaticMarkup(createElement(CollaborationView, latest!));
    assert.doesNotMatch(markup, /data-testid="collaboration-run-ended-by-reject"/);
    assert.doesNotMatch(markup, /This run ended after a rejection/);
  });
});

describe('BIZ-01 team picker', () => {
  const rosterLabels = {
    lead: enMessages.collaboration.lead,
    writer: enMessages.collaboration.writer,
    reviewer: enMessages.collaboration.reviewer,
    chiefOfStaff: enMessages.collaboration.chiefOfStaff,
    productStrategy: enMessages.collaboration.productStrategy,
    technologyAdvisor: enMessages.collaboration.technologyAdvisor,
    leadSummary: enMessages.collaboration.leadSummary,
    writerSummary: enMessages.collaboration.writerSummary,
    reviewerSummary: enMessages.collaboration.reviewerSummary,
    chiefOfStaffSummary: enMessages.collaboration.chiefOfStaffSummary,
    advisorsLeadSummary: enMessages.collaboration.advisorsLeadSummary,
    productStrategySummary: enMessages.collaboration.productStrategySummary,
    technologyAdvisorSummary: enMessages.collaboration.technologyAdvisorSummary,
  };

  test('builds the start body and reads the run team', () => {
    assert.deepEqual(
      collaborationStartRequestBody({
        sessionId: 'session-1',
        task: '  What is the goal?  ',
        team: 'coding',
      }),
      { sessionId: 'session-1', task: 'What is the goal?', team: 'coding' },
    );
    assert.deepEqual(
      collaborationStartRequestBody({
        sessionId: 'session-1',
        task: 'Ask',
        team: 'chief-of-staff',
      }),
      { sessionId: 'session-1', task: 'Ask', team: 'chief-of-staff' },
    );
    assert.equal(readCollaborationTeamId('coding'), 'coding');
    assert.equal(readCollaborationTeamId('chief-of-staff'), 'chief-of-staff');
    assert.equal(readCollaborationTeamId('advisors'), 'advisors');
    assert.equal(readCollaborationTeamId(undefined), null);
    assert.equal(readCollaborationTeamId(null), null);
    assert.equal(readCollaborationTeamId(1), null);
    assert.equal(readCollaborationTeamId('Advisors'), null);
    assert.equal(
      collaborationTeamFromDetail({ teamId: 'chief-of-staff', team: ['chief-of-staff'] }),
      'chief-of-staff',
    );
    assert.equal(
      collaborationTeamFromDetail({ team: ['chief-of-staff'] }),
      'chief-of-staff',
    );
    assert.equal(
      collaborationTeamFromDetail({ team: ['lead', 'writer', 'reviewer'] }),
      'coding',
    );
    assert.equal(
      collaborationTeamFromDetail({
        teamId: 'advisors',
        team: ['advisors-lead', 'product-strategy', 'technology-advisor'],
      }),
      'advisors',
    );
    assert.equal(
      collaborationTeamFromDetail({
        team: ['advisors-lead', 'product-strategy', 'technology-advisor'],
      }),
      'advisors',
    );
    assert.equal(collaborationTeamFromDetail(null), null);
    assert.deepEqual(
      ['advisors-lead', 'product-strategy', 'technology-advisor'].map((name) =>
        collaborationMemberLabel(name, {
          you: enMessages.collaboration.you,
          lead: enMessages.collaboration.lead,
          writer: enMessages.collaboration.writer,
          reviewer: enMessages.collaboration.reviewer,
          chiefOfStaff: enMessages.collaboration.chiefOfStaff,
          productStrategy: enMessages.collaboration.productStrategy,
          technologyAdvisor: enMessages.collaboration.technologyAdvisor,
        }),
      ),
      [
        enMessages.collaboration.chiefOfStaff,
        enMessages.collaboration.productStrategy,
        enMessages.collaboration.technologyAdvisor,
      ],
    );
    assert.deepEqual(collaborationRoster('advisors', rosterLabels), [
      {
        name: enMessages.collaboration.chiefOfStaff,
        summary: enMessages.collaboration.advisorsLeadSummary,
      },
      {
        name: enMessages.collaboration.productStrategy,
        summary: enMessages.collaboration.productStrategySummary,
      },
      {
        name: enMessages.collaboration.technologyAdvisor,
        summary: enMessages.collaboration.technologyAdvisorSummary,
      },
    ]);
    assert.deepEqual(
      collaborationRoster('coding', rosterLabels).map((member) => member.name),
      [
        enMessages.collaboration.lead,
        enMessages.collaboration.writer,
        enMessages.collaboration.reviewer,
      ],
    );
    assert.deepEqual(collaborationRoster('chief-of-staff', rosterLabels), [
      {
        name: enMessages.collaboration.chiefOfStaff,
        summary: enMessages.collaboration.chiefOfStaffSummary,
      },
    ]);
  });

  test('renders the picker and the run team from translated labels', () => {
    const markup = renderToStaticMarkup(
      React.createElement(CollaborationView, {
        labels: {
          ...labels,
          teamPickerLabel: zhTwMessages.collaboration.teamPickerLabel,
        },
        backHref: '/zh-TW/app',
        sessionReady: true,
        projectReady: true,
        loading: false,
        notice: null,
        conversationCreated: false,
        task: '問目標',
        deciding: false,
        team: collaborationRoster('chief-of-staff', {
          ...rosterLabels,
          chiefOfStaff: zhTwMessages.collaboration.chiefOfStaff,
          chiefOfStaffSummary: zhTwMessages.collaboration.chiefOfStaffSummary,
        }),
        selectedTeam: 'chief-of-staff',
        teamChoices: [
          {
            id: 'coding',
            label: zhTwMessages.collaboration.teamCoding,
            hint: zhTwMessages.collaboration.teamCodingHint,
          },
          {
            id: 'chief-of-staff',
            label: zhTwMessages.collaboration.teamChiefOfStaff,
            hint: zhTwMessages.collaboration.teamChiefOfStaffHint,
          },
          {
            id: 'advisors',
            label: zhTwMessages.collaboration.teamAdvisors,
            hint: zhTwMessages.collaboration.teamAdvisorsHint,
          },
        ],
        onTeamChange: () => {},
        accessNote: zhTwMessages.collaboration.fileAccessReadOnly,
        chainEmptyText: zhTwMessages.collaboration.chainEmptyChief,
        runTeam: {
          label: zhTwMessages.collaboration.teamChiefOfStaff,
          roles: [zhTwMessages.collaboration.chiefOfStaff],
        },
        handoffs: [],
        runs: [
          {
            id: 'run-cos',
            statusLabel: zhTwMessages.collaboration.statusActive,
            when: 'now',
            selected: true,
            teamLabel: zhTwMessages.collaboration.teamChiefOfStaff,
          },
        ],
        runEndedByReject: false,
        rejectReferralId: null,
        rejectReason: '',
        onTaskChange: () => {},
        onStart: () => {},
        onOpenRun: () => {},
        onApprove: () => {},
        onApproveWithoutTestsChange: () => {},
        onBeginReject: () => {},
        onCancelReject: () => {},
        onConfirmReject: () => {},
        onRejectReasonChange: () => {},
        ...idleCancel,
      }),
    );

    assert.match(markup, /data-testid="collaboration-team-picker"/);
    assert.match(markup, /data-testid="collaboration-team-option-coding"/);
    assert.match(markup, /data-testid="collaboration-team-option-chief-of-staff"/);
    assert.match(markup, /data-testid="collaboration-team-option-advisors"/);
    assert.match(markup, /sm:grid-cols-3/);
    assert.match(markup, /data-testid="collaboration-start"/);
    assert.match(markup, /data-testid="collaboration-run-team"/);
    assert.match(markup, new RegExp(zhTwMessages.collaboration.teamPickerLabel));
    assert.match(markup, new RegExp(zhTwMessages.collaboration.teamCoding));
    assert.match(markup, new RegExp(zhTwMessages.collaboration.teamChiefOfStaff));
    assert.match(markup, new RegExp(zhTwMessages.collaboration.fileAccessReadOnly));
    assert.match(markup, new RegExp(zhTwMessages.collaboration.chainEmptyChief));
    assert.match(openTag(markup, 'collaboration-team-option-chief-of-staff'), /border-indigo-300/);
    assert.match(openTag(markup, 'collaboration-team-option-coding'), /border-gray-200/);
    const codingAt = markup.indexOf('data-testid="collaboration-team-option-coding"');
    const chiefAt = markup.indexOf('data-testid="collaboration-team-option-chief-of-staff"');
    const advisorsAt = markup.indexOf('data-testid="collaboration-team-option-advisors"');
    assert.ok(codingAt >= 0 && chiefAt > codingAt && advisorsAt > chiefAt);
    assert.doesNotMatch(markup.slice(codingAt, chiefAt), /checked/);
    assert.match(markup.slice(chiefAt, chiefAt + 500), /checked/);
    assert.doesNotMatch(markup, /Coding team/);
    assert.doesNotMatch(markup, /Chief of Staff/);

    const newKeys = [
      'teamPickerLabel',
      'teamCoding',
      'teamCodingHint',
      'teamChiefOfStaff',
      'teamChiefOfStaffHint',
      'chiefOfStaff',
      'chiefOfStaffSummary',
      'fileAccessReadOnly',
      'chainEmptyChief',
      'teamAdvisors',
      'teamAdvisorsHint',
      'productStrategy',
      'technologyAdvisor',
      'advisorsLeadSummary',
      'productStrategySummary',
      'technologyAdvisorSummary',
      'fileAccessAdvisors',
      'chainEmptyAdvisors',
    ] as const;
    for (const key of newKeys) {
      const english = enMessages.collaboration[key];
      const traditional = zhTwMessages.collaboration[key];
      const simplified = zhCnMessages.collaboration[key];
      assert.equal(typeof english, 'string');
      assert.equal(english.trim().length > 0, true);
      assert.notEqual(traditional, english);
      assert.notEqual(simplified, english);
      assert.notEqual(traditional, simplified);
      assert.match(traditional, /\p{Script=Han}/u);
      assert.match(simplified, /\p{Script=Han}/u);
    }

    const catalogKeys = [
      'agents.productStrategy.description',
      'agents.technologyAdvisor.description',
      'platform.commandDeckIntro',
      'platform.detail.subtitle',
      'platform.detail.productStrategyIntent',
      'platform.detail.productStrategyCapabilityOne',
      'platform.detail.productStrategyCapabilityTwo',
      'platform.detail.productStrategyCapabilityThree',
      'platform.detail.technologyAdvisorIntent',
      'platform.detail.technologyAdvisorCapabilityOne',
      'platform.detail.technologyAdvisorCapabilityTwo',
      'platform.detail.technologyAdvisorCapabilityThree',
    ];
    const readCatalog = (source: object, path: string): string => {
      let current: unknown = source;
      for (const part of path.split('.')) {
        if (!current || typeof current !== 'object' || !(part in current)) {
          return '';
        }
        current = (current as Record<string, unknown>)[part];
      }
      return typeof current === 'string' ? current : '';
    };
    for (const key of catalogKeys) {
      const english = readCatalog(enMessages, key);
      const traditional = readCatalog(zhTwMessages, key);
      const simplified = readCatalog(zhCnMessages, key);
      assert.equal(english.trim().length > 0, true, key);
      assert.notEqual(traditional, english, key);
      assert.notEqual(simplified, english, key);
      assert.notEqual(traditional, simplified, key);
      assert.match(traditional, /\p{Script=Han}/u);
      assert.match(simplified, /\p{Script=Han}/u);
    }

    const runLine = renderToStaticMarkup(
      React.createElement(CollaborationView, {
        labels,
        backHref: '/en/app',
        sessionReady: true,
        projectReady: true,
        loading: false,
        notice: null,
        conversationCreated: false,
        task: 'Ask',
        deciding: false,
        team: collaborationRoster('advisors', rosterLabels),
        selectedTeam: 'advisors',
        teamChoices: [
          {
            id: 'advisors',
            label: enMessages.collaboration.teamAdvisors,
            hint: enMessages.collaboration.teamAdvisorsHint,
          },
        ],
        onTeamChange: () => {},
        accessNote: enMessages.collaboration.fileAccessAdvisors,
        chainEmptyText: enMessages.collaboration.chainEmptyAdvisors,
        runTeam: {
          label: enMessages.collaboration.teamAdvisors,
          roles: [
            enMessages.collaboration.chiefOfStaff,
            enMessages.collaboration.productStrategy,
            enMessages.collaboration.technologyAdvisor,
          ],
        },
        handoffs: [],
        runs: [],
        runEndedByReject: false,
        rejectReferralId: null,
        rejectReason: '',
        onTaskChange: () => {},
        onStart: () => {},
        onOpenRun: () => {},
        onApprove: () => {},
        onApproveWithoutTestsChange: () => {},
        onBeginReject: () => {},
        onCancelReject: () => {},
        onConfirmReject: () => {},
        onRejectReasonChange: () => {},
        ...idleCancel,
      }),
    );
    assert.match(runLine, /data-testid="collaboration-run-team"/);
    assert.ok(runLine.includes('Advisors'));
    assert.ok(runLine.includes(' · Chief of Staff · Product Strategy · Technology Advisor'));
    assert.ok(runLine.includes(enMessages.collaboration.fileAccessAdvisors));
    assert.ok(runLine.includes(enMessages.collaboration.chainEmptyAdvisors));

    for (const relativePath of [
      '../components/collaboration/collaboration-view.tsx',
      '../components/collaboration/collaboration-page.tsx',
    ]) {
      const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
      assert.doesNotMatch(source, /Coding team|Chief of Staff/);
    }
  });
});

describe('provider usage limit message', () => {
  const english =
    "The AI provider's usage limit has been reached, so runs can't start. They start again once an admin raises the limit.";

  test('maps only the exact stored sentence', () => {
    assert.equal(
      collaborationFailureReason(
        AI_PROVIDER_USAGE_LIMIT_REACHED,
        enMessages.collaboration.providerUsageLimit,
      ),
      english,
    );
    assert.equal(
      collaborationFailureReason('The writer stopped', enMessages.collaboration.providerUsageLimit),
      'The writer stopped',
    );
    assert.equal(
      collaborationFailureReason(
        'AI provider usage limit reached.',
        enMessages.collaboration.providerUsageLimit,
      ),
      'AI provider usage limit reached.',
    );
    assert.equal(collaborationProviderUsageLimitCopy('/en/app'), english);
    assert.equal(collaborationProviderUsageLimitCopy('en'), english);
    assert.equal(
      collaborationProviderUsageLimitCopy('/zh-TW/app'),
      zhTwMessages.collaboration.providerUsageLimit,
    );
    assert.equal(
      collaborationProviderUsageLimitCopy('/zh-CN/app'),
      zhCnMessages.collaboration.providerUsageLimit,
    );
  });

  test('ai and collaboration keys exist in en, zh-TW, and zh-CN', () => {
    assert.equal(enMessages.ai.providerUsageLimit, english);
    assert.equal(enMessages.collaboration.providerUsageLimit, english);
    const catalogs = [
      { ai: zhTwMessages.ai.providerUsageLimit, collaboration: zhTwMessages.collaboration.providerUsageLimit },
      { ai: zhCnMessages.ai.providerUsageLimit, collaboration: zhCnMessages.collaboration.providerUsageLimit },
    ];
    for (const catalog of catalogs) {
      assert.notEqual(catalog.ai, english);
      assert.notEqual(catalog.collaboration, english);
      assert.match(catalog.ai, /\p{Script=Han}/u);
      assert.match(catalog.collaboration, /\p{Script=Han}/u);
      assert.equal(catalog.ai, catalog.collaboration);
    }
    assert.notEqual(zhTwMessages.ai.providerUsageLimit, zhCnMessages.ai.providerUsageLimit);
    assert.notEqual(
      zhTwMessages.collaboration.providerUsageLimit,
      zhCnMessages.collaboration.providerUsageLimit,
    );
  });

  test('the team failure line shows the translation and leaves other reasons unchanged', () => {
    const handoff = {
      referralId: 'failed-limit',
      statusLabel: 'Failed',
      waiting: false,
      answer: null,
      prompt: 'Do the task',
      failureReason: AI_PROVIDER_USAGE_LIMIT_REACHED,
    };
    const escapedEnglish = english.replace(/'/g, '&#x27;');
    const limited = renderChain([handoff]);
    assert.ok(limited.includes(escapedEnglish));
    assert.equal(limited.includes(AI_PROVIDER_USAGE_LIMIT_REACHED), false);
    assert.match(limited, /data-testid="collaboration-back"/);

    const traditional = renderChain([handoff], '/zh-TW/app');
    assert.ok(traditional.includes(zhTwMessages.collaboration.providerUsageLimit));
    assert.equal(traditional.includes(escapedEnglish), false);

    const other = renderChain([
      { ...handoff, referralId: 'failed-other', failureReason: 'The writer stopped' },
    ]);
    assert.ok(other.includes('The writer stopped'));
    assert.ok(other.includes(enMessages.collaboration.failure));
  });
});
