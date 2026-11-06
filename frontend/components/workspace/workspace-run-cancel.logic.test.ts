import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import enMessages from '@/messages/en.json';
import zhTwMessages from '@/messages/zh-TW.json';
import zhCnMessages from '@/messages/zh-CN.json';
import {
  chatTerminalFailureCopy,
  requestRunCancel,
  runCancelUserMessage,
  shouldReleaseStopButton,
  shouldShowChatStopButton,
} from './workspace-run-cancel.logic';

const executionId = '24de3965-ec05-454a-9dbe-62449b9bd16d';

describe('requestRunCancel', () => {
  test('posts the cancel route and returns requested for 2xx', async () => {
    for (const status of [200, 204]) {
      const calls: Array<{ url: string; init?: RequestInit }> = [];
      const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
        calls.push({ url, init });
        return new Response(status === 204 ? null : JSON.stringify({ status: 'cancel_requested' }), {
          status,
        });
      };

      const result = await requestRunCancel({
        executionId,
        fetchImpl: fetchImpl as typeof fetch,
      });

      assert.deepEqual(result, { kind: 'requested' });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, `/api/ai/executions/${executionId}/cancel`);
      assert.equal(calls[0].init?.method, 'POST');
      const headers = new Headers(calls[0].init?.headers);
      assert.equal(headers.get('Content-Type'), 'application/json');
      assert.equal(calls[0].init?.body, '{}');
    }
  });

  test('returns already_finished for 409', async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(JSON.stringify({ message: 'Execution cannot be cancelled' }), { status: 409 });

    const result = await requestRunCancel({
      executionId,
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.deepEqual(result, { kind: 'already_finished' });
  });

  test('returns failed for other statuses and for a network error without throwing', async () => {
    for (const status of [404, 500]) {
      const fetchImpl = async (): Promise<Response> => new Response(null, { status });
      const result = await requestRunCancel({
        executionId,
        fetchImpl: fetchImpl as typeof fetch,
      });
      assert.deepEqual(result, { kind: 'failed' });
    }

    const throwingFetch = async (): Promise<Response> => {
      throw new Error('network down');
    };
    const failed = await requestRunCancel({
      executionId,
      fetchImpl: throwingFetch as typeof fetch,
    });
    assert.deepEqual(failed, { kind: 'failed' });
  });
});

describe('chat stop page mapping', () => {
  test('shows Stop only for an active run with an execution id and a handler', () => {
    const active = { executionId, hasStopHandler: true };
    assert.equal(shouldShowChatStopButton({ requestState: 'queued', ...active }), true);
    assert.equal(shouldShowChatStopButton({ requestState: 'running', ...active }), true);
    assert.equal(shouldShowChatStopButton({ requestState: 'submitting', ...active }), false);
    assert.equal(shouldShowChatStopButton({ requestState: 'idle', ...active }), false);
    assert.equal(shouldShowChatStopButton({ requestState: 'completed', ...active }), false);
    assert.equal(shouldShowChatStopButton({ requestState: 'failed', ...active }), false);
    assert.equal(
      shouldShowChatStopButton({ requestState: 'running', executionId: null, hasStopHandler: true }),
      false,
    );
    assert.equal(
      shouldShowChatStopButton({ requestState: 'running', executionId: '', hasStopHandler: true }),
      false,
    );
    assert.equal(
      shouldShowChatStopButton({ requestState: 'running', executionId, hasStopHandler: false }),
      false,
    );
  });

  test('maps a cancelled run to the stopped message and leaves failed and timeout unchanged', () => {
    const stopped = chatTerminalFailureCopy({
      status: 'cancelled',
      output: 'partial model text',
      runStoppedMessage: enMessages.ai.runStopped,
    });
    assert.deepEqual(stopped, {
      rawMessage: '',
      fallbackMessage: 'Run stopped.',
    });

    const failed = chatTerminalFailureCopy({
      status: 'failed',
      output: 'provider exploded',
      runStoppedMessage: enMessages.ai.runStopped,
    });
    assert.deepEqual(failed, {
      rawMessage: 'provider exploded',
      fallbackMessage: 'Execution ended with status: failed.',
    });

    const timedOut = chatTerminalFailureCopy({
      status: 'timeout',
      output: '',
      runStoppedMessage: enMessages.ai.runStopped,
    });
    assert.deepEqual(timedOut, {
      rawMessage: '',
      fallbackMessage: 'Execution ended with status: timeout.',
    });
  });

  test('maps 409 and failure to their messages and releases the Stop button only after failure', () => {
    assert.equal(
      runCancelUserMessage({
        kind: 'requested',
        alreadyFinishedMessage: enMessages.ai.stopRunAlreadyFinished,
        failedMessage: enMessages.ai.stopRunFailed,
      }),
      null,
    );
    assert.equal(
      runCancelUserMessage({
        kind: 'already_finished',
        alreadyFinishedMessage: enMessages.ai.stopRunAlreadyFinished,
        failedMessage: enMessages.ai.stopRunFailed,
      }),
      'The run had already finished.',
    );
    assert.equal(
      runCancelUserMessage({
        kind: 'failed',
        alreadyFinishedMessage: enMessages.ai.stopRunAlreadyFinished,
        failedMessage: enMessages.ai.stopRunFailed,
      }),
      "Couldn't stop the run. Try again.",
    );
    assert.equal(shouldReleaseStopButton('requested'), false);
    assert.equal(shouldReleaseStopButton('already_finished'), false);
    assert.equal(shouldReleaseStopButton('failed'), true);
  });

  test('the workspace page uses the cancel helpers for the stopped, 409, and failure outcomes', () => {
    const pageSource = readFileSync(new URL('../../app/[locale]/app/page.tsx', import.meta.url), 'utf8');
    assert.equal(pageSource.split('chatTerminalFailureCopy(').length - 1, 2);
    assert.match(pageSource, /requestRunCancel\(\{ executionId \}\)/);
    assert.match(pageSource, /runCancelUserMessage\(/);
    assert.match(pageSource, /shouldReleaseStopButton\(result\.kind\)/);
    assert.match(pageSource, /onStopRun=\{handleStopChatRun\}/);
    assert.match(pageSource, /isStoppingRun=\{isStoppingChatRun\}/);
    assert.match(pageSource, /id: `stop-run-\$\{crypto\.randomUUID\(\)\}`/);
    assert.doesNotMatch(pageSource, /Execution ended with status:/);
  });
});

describe('stop run message keys', () => {
  test('the five keys exist in en, zh-TW, and zh-CN, and the Chinese copy is translated', () => {
    const keys = [
      'stopRun',
      'stoppingRun',
      'runStopped',
      'stopRunAlreadyFinished',
      'stopRunFailed',
    ] as const;
    const english = {
      stopRun: 'Stop',
      stoppingRun: 'Stopping…',
      runStopped: 'Run stopped.',
      stopRunAlreadyFinished: 'The run had already finished.',
      stopRunFailed: "Couldn't stop the run. Try again.",
    };

    for (const key of keys) {
      assert.equal(enMessages.ai[key], english[key]);
      assert.equal(typeof zhTwMessages.ai[key], 'string');
      assert.equal(typeof zhCnMessages.ai[key], 'string');
      assert.notEqual(zhTwMessages.ai[key], enMessages.ai[key]);
      assert.notEqual(zhCnMessages.ai[key], enMessages.ai[key]);
      assert.match(zhTwMessages.ai[key], /\p{Script=Han}/u);
      assert.match(zhCnMessages.ai[key], /\p{Script=Han}/u);
    }
  });
});
