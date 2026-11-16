import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  createMailTrigger,
  deleteMailTrigger,
  loadMailTriggerRuns,
  loadMailTriggers,
  updateMailTrigger,
  type MailTriggersFetcher,
} from '@/components/schedules/mail-triggers-api';
import { draftToBody, emptyMailDraft } from '@/components/schedules/mail-triggers.logic';

interface Call {
  path: string;
  method: string;
  body: unknown;
}

function stub(status: number, payload: unknown): { fetcher: MailTriggersFetcher; calls: Call[] } {
  const calls: Call[] = [];
  const fetcher: MailTriggersFetcher = async (path, init = {}) => {
    calls.push({
      path,
      method: (init.method ?? 'GET').toUpperCase(),
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    return new Response(JSON.stringify(payload), { status });
  };
  return { fetcher, calls };
}

const TRIGGER = {
  id: 'e1',
  target: { kind: 'chief-of-staff' },
  task: 'Prepare me',
  senderFilter: 'boss@example.com',
  subjectFilter: null,
  timeZone: 'UTC',
  enabled: true,
  createdAt: 'x',
  updatedAt: 'x',
  lastRun: null,
};

const failing: MailTriggersFetcher = async () => {
  throw new Error('offline');
};

describe('mail triggers api', () => {
  test('loadMailTriggers reads the list, the switches and the mailbox state', async () => {
    const { fetcher, calls } = stub(200, {
      enabled: true,
      runsEnabled: false,
      limit: 3,
      mail: { connected: true, state: 'read_failed', stateAt: '2026-11-15T10:00:00.000Z' },
      triggers: [TRIGGER],
    });
    const result = await loadMailTriggers(fetcher);
    assert.equal(result.type, 'ok');
    assert.equal(result.type === 'ok' && result.value.runsEnabled, false);
    assert.equal(result.type === 'ok' && result.value.mail.state, 'read_failed');
    assert.equal(result.type === 'ok' && result.value.triggers.length, 1);
    assert.deepEqual(calls, [{ path: '/api/mail-triggers', method: 'GET', body: undefined }]);
  });

  test('401 and 403 are their own results; every other failure becomes a translated key', async () => {
    assert.deepEqual(await loadMailTriggers(stub(401, {}).fetcher), { type: 'unauthorized' });
    assert.deepEqual(await loadMailTriggers(stub(403, {}).fetcher), { type: 'forbidden' });
    assert.deepEqual(await loadMailTriggers(stub(500, {}).fetcher), { type: 'failed', errorKey: 'errors.generic' });
    assert.deepEqual(await loadMailTriggers(failing), { type: 'failed', errorKey: 'errors.network' });
    assert.deepEqual(await loadMailTriggers(stub(200, { nope: true }).fetcher), {
      type: 'failed',
      errorKey: 'errors.generic',
    });
  });

  test('createMailTrigger posts the body and maps an mail_trigger_* code', async () => {
    const draft = draftToBody({ ...emptyMailDraft('UTC'), task: 'Prepare me', senderFilter: 'Boss@Example.com' });
    assert.ok(draft.ok);
    const ok = stub(201, TRIGGER);
    const created = await createMailTrigger(draft.body, ok.fetcher);
    assert.equal(created.type, 'ok');
    assert.equal(ok.calls[0].method, 'POST');
    assert.equal(ok.calls[0].path, '/api/mail-triggers');
    assert.deepEqual(ok.calls[0].body, draft.body);
    assert.equal((ok.calls[0].body as { senderFilter: string }).senderFilter, 'boss@example.com');
    const full = stub(409, { statusCode: 409, code: 'mail_trigger_limit_reached' });
    assert.deepEqual(await createMailTrigger(draft.body, full.fetcher), {
      type: 'failed',
      errorKey: 'errors.mail_trigger_limit_reached',
    });
    assert.deepEqual(await createMailTrigger(draft.body, failing), { type: 'failed', errorKey: 'errors.network' });
  });

  test('updateMailTrigger patches only what is sent and keeps an unknown code generic', async () => {
    const { fetcher, calls } = stub(200, { ...TRIGGER, enabled: false });
    const result = await updateMailTrigger('e 1', { enabled: false }, fetcher);
    assert.equal(result.type === 'ok' && result.value.enabled, false);
    assert.deepEqual(calls, [{ path: '/api/mail-triggers/e%201', method: 'PATCH', body: { enabled: false } }]);
    const missing = stub(404, { code: 'mail_trigger_not_found' });
    assert.deepEqual(await updateMailTrigger('x', { enabled: true }, missing.fetcher), {
      type: 'failed',
      errorKey: 'errors.mail_trigger_not_found',
    });
    const odd = stub(400, { code: 'event_trigger_invalid_task' });
    assert.deepEqual(await updateMailTrigger('x', { enabled: true }, odd.fetcher), {
      type: 'failed',
      errorKey: 'errors.generic',
    });
  });

  test('deleteMailTrigger uses DELETE', async () => {
    const { fetcher, calls } = stub(200, { id: 'e1', deleted: true });
    assert.deepEqual(await deleteMailTrigger('e1', fetcher), { type: 'ok', value: null });
    assert.deepEqual(calls, [{ path: '/api/mail-triggers/e1', method: 'DELETE', body: undefined }]);
    assert.deepEqual(await deleteMailTrigger('e1', failing), { type: 'failed', errorKey: 'errors.network' });
  });

  test('loadMailTriggerRuns reads the history', async () => {
    const { fetcher, calls } = stub(200, {
      runs: [
        {
          id: 'r1',
          arrivedAt: '2026-11-15T10:00:00.000Z',
          localDate: '2026-11-15',
          outcome: 'skipped',
          reason: 'day_limit',
          collaborationRunId: null,
          at: 'x',
        },
      ],
    });
    const result = await loadMailTriggerRuns('e1', fetcher);
    assert.equal(result.type === 'ok' && result.value[0].reason, 'day_limit');
    assert.equal(calls[0].path, '/api/mail-triggers/e1/runs');
    assert.deepEqual(await loadMailTriggerRuns('e1', stub(404, { code: 'mail_trigger_not_found' }).fetcher), {
      type: 'failed',
      errorKey: 'errors.mail_trigger_not_found',
    });
  });
});
