import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  cancelOfficeCollaborationRun,
  officeCancelOutcomeFromStatus,
  officeCancelPath,
  officeCancelPhaseIsResult,
  officeCancellableRunId,
  officeCancelResultKey,
} from '@/lib/office/office-cancel';
import type { OfficeDesk, OfficeRun } from '@/lib/office/office.logic';

function runWith(collaborationRunId: string | null): OfficeRun {
  return {
    executionId: 'exec-1',
    status: 'running',
    sessionId: 's',
    provider: null,
    model: null,
    tokensUsed: null,
    startedAt: null,
    durationMs: null,
    mode: 'agent',
    agentId: null,
    collaborationRunId,
    builderProfileId: null,
  };
}

function deskWith(phase: OfficeDesk['phase'], collaborationRunId: string | null) {
  return { phase, currentRun: runWith(collaborationRunId) };
}

describe('officeCancellableRunId', () => {
  test('returns the collaboration run id for a queued or working Team run', () => {
    assert.equal(officeCancellableRunId(deskWith('working', 'collab-1')), 'collab-1');
    assert.equal(officeCancellableRunId(deskWith('queued', 'collab-2')), 'collab-2');
  });

  test('returns null for runs that are not active, not Team runs, or missing', () => {
    for (const phase of ['stopping', 'done', 'failed', 'stopped', 'timedOut', 'idle', 'vacant'] as const) {
      assert.equal(officeCancellableRunId(deskWith(phase, 'collab-1')), null, phase);
    }
    assert.equal(officeCancellableRunId(deskWith('working', null)), null);
    assert.equal(officeCancellableRunId(deskWith('working', '  ')), null);
    assert.equal(officeCancellableRunId({ phase: 'working', currentRun: null }), null);
    assert.equal(officeCancellableRunId(null), null);
  });
});

describe('office cancel request', () => {
  test('posts to the collaboration cancel route with an encoded run id', async () => {
    const calls: Array<{ path: string; init: RequestInit | undefined }> = [];
    const outcome = await cancelOfficeCollaborationRun('run/1 a', async (path, init) => {
      calls.push({ path, init });
      return new Response('{}', { status: 200 });
    });
    assert.equal(outcome, 'cancelled');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, '/api/collaboration/runs/run%2F1%20a/cancel');
    assert.equal(calls[0].path, officeCancelPath('run/1 a'));
    assert.equal(calls[0].init?.method, 'POST');
    assert.equal(calls[0].init?.body, '{}');
  });

  test('maps 409, 404 and other failures to their own outcomes', async () => {
    const respond = (status: number) => async () => new Response('{}', { status });
    assert.equal(await cancelOfficeCollaborationRun('r', respond(409)), 'finished');
    assert.equal(await cancelOfficeCollaborationRun('r', respond(404)), 'notFound');
    assert.equal(await cancelOfficeCollaborationRun('r', respond(500)), 'failed');
    assert.equal(await cancelOfficeCollaborationRun('r', respond(403)), 'failed');
    assert.equal(await cancelOfficeCollaborationRun('r', respond(401)), 'failed');
  });

  test('a network error is a failure', async () => {
    const outcome = await cancelOfficeCollaborationRun('r', async () => {
      throw new Error('offline');
    });
    assert.equal(outcome, 'failed');
  });

  test('status mapping and result keys', () => {
    assert.equal(officeCancelOutcomeFromStatus(204), 'cancelled');
    assert.equal(officeCancelResultKey('finished'), 'cancelRunFinished');
    assert.equal(officeCancelPhaseIsResult('confirming'), false);
    assert.equal(officeCancelPhaseIsResult('cancelling'), false);
    assert.equal(officeCancelPhaseIsResult(null), false);
    assert.equal(officeCancelPhaseIsResult('failed'), true);
  });
});
