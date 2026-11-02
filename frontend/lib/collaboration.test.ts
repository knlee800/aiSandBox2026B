import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CollaborationView, {
  type CollaborationViewLabels,
} from '../components/collaboration/collaboration-view';
import enMessages from '../messages/en.json';
import zhCnMessages from '../messages/zh-CN.json';
import zhTwMessages from '../messages/zh-TW.json';
import {
  collaborationRefusal,
  collaborationRefusalMessageKey,
  createSingleFlight,
  shouldPollCollaboration,
} from './collaboration/logic';

const labels = enMessages.collaboration as CollaborationViewLabels;

function renderChain(handoffs: Array<{
  referralId: string;
  statusLabel: string;
  waiting: boolean;
  answer: string | null;
  prompt: string | null;
}>) {
  return renderToStaticMarkup(
    React.createElement(CollaborationView, {
      labels,
      backHref: '/en/app',
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
        failureReason: null,
        decidedBy: null,
        rejectReason: null,
        waiting: handoff.waiting,
      })),
      runs: [],
      rejectReferralId: null,
      rejectReason: '',
      onTaskChange: () => {},
      onStart: () => {},
      onOpenRun: () => {},
      onApprove: () => {},
      onBeginReject: () => {},
      onCancelReject: () => {},
      onConfirmReject: () => {},
      onRejectReasonChange: () => {},
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
        rejectReferralId: null,
        rejectReason: '',
        onTaskChange: () => {},
        onStart: () => {},
        onOpenRun: () => {},
        onApprove: () => {},
        onBeginReject: () => {},
        onCancelReject: () => {},
        onConfirmReject: () => {},
        onRejectReasonChange: () => {},
      }),
    );
    assert.equal(collaborationRefusal(402, 'Insufficient credit balance'), 'credits');
    assert.equal(collaborationRefusalMessageKey('credits'), 'refusalCredits');
    assert.equal(zhTwMessages.collaboration.refusalCredits, '點數不足。');
    assert.match(markup, /data-testid="collaboration-notice"/);
    assert.match(markup, /點數不足。/);
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
});
