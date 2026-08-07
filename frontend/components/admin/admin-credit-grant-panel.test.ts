import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';
import {
  ADMIN_CREDIT_GRANT_REASON_MAX_LENGTH,
  buildAdminCreditGrantRequestBody,
  buildAdminCreditGrantRequestUrl,
  calculateProjectedBalance,
  getOrCreateIdempotencyKey,
  resolveIdempotencyKeyAction,
  shouldShowAdminCreditGrantPanel,
  shouldUpdateBalanceFromGrantStatus,
  validateAdminCreditGrantInput,
} from './admin-credit-grant-panel';
import { applyCreditBalanceAfterGrant, type AdminUserDetail } from './admin-user-detail-client';

const creditGrantSource = readFileSync(resolve(__dirname, './admin-credit-grant-panel.tsx'), 'utf-8');
const adminDetailSource = readFileSync(resolve(__dirname, './admin-user-detail-client.tsx'), 'utf-8');

function buildSampleUserDetail(balance: number): AdminUserDetail {
  return {
    userId: 'user-1',
    email: 'target@example.com',
    role: 'user',
    planCode: 'free',
    planName: 'Free',
    planType: 'free',
    planStatus: 'active',
    isActive: true,
    activeSessions: 0,
    totalSessions: 10,
    sessionsCreated24h: 0,
    tokensUsed24h: 50,
    estimatedCost: 0,
    quotaStatus: 'OK',
    createdAt: '2026-08-01T00:00:00.000Z',
    quotas: {
      maxActiveSessions: 2,
      maxSessions24h: 10,
      maxTokens24h: 1000,
      currentActiveSessions: 0,
      currentSessions24h: 1,
      currentTokens24h: 50,
    },
    creditBalance: {
      balance,
      monthlyAllocation: 500,
      rolloverBalance: 20,
      planId: 'plan-free',
      status: 'active',
    },
  };
}

describe('admin credit grant panel visibility and validation', () => {
  test('shows Add Credits controls when credit balance exists', () => {
    const detail = buildSampleUserDetail(120);
    assert.equal(shouldShowAdminCreditGrantPanel(detail.creditBalance), true);
  });

  test('hides Add Credits controls when credit balance is null', () => {
    assert.equal(shouldShowAdminCreditGrantPanel(null), false);
  });

  test('rejects empty amount as required', () => {
    const result = validateAdminCreditGrantInput({ amount: '', reason: 'manual correction' });
    assert.equal(result.errors.amount, 'validation.amountRequired');
  });

  test('rejects zero amount', () => {
    const result = validateAdminCreditGrantInput({ amount: '0', reason: 'manual correction' });
    assert.equal(result.errors.amount, 'validation.amountMin');
  });

  test('rejects negative amount', () => {
    const result = validateAdminCreditGrantInput({ amount: '-1', reason: 'manual correction' });
    assert.equal(result.errors.amount, 'validation.amountMin');
  });

  test('rejects fractional amount', () => {
    const result = validateAdminCreditGrantInput({ amount: '1.25', reason: 'manual correction' });
    assert.equal(result.errors.amount, 'validation.amountInteger');
  });

  test('rejects empty reason as required', () => {
    const result = validateAdminCreditGrantInput({ amount: '5', reason: '' });
    assert.equal(result.errors.reason, 'validation.reasonRequired');
  });

  test('rejects whitespace-only reason', () => {
    const result = validateAdminCreditGrantInput({ amount: '5', reason: '     ' });
    assert.equal(result.errors.reason, 'validation.reasonRequired');
  });

  test('enforces 500 character reason max', () => {
    const tooLongReason = 'x'.repeat(ADMIN_CREDIT_GRANT_REASON_MAX_LENGTH + 1);
    const result = validateAdminCreditGrantInput({ amount: '5', reason: tooLongReason });
    assert.equal(result.errors.reason, 'validation.reasonMax');
  });

  test('accepts valid values and trims reason before submission', () => {
    const result = validateAdminCreditGrantInput({ amount: '10', reason: '  manual credit top-up  ' });
    assert.equal(result.amount, 10);
    assert.equal(result.reason, 'manual credit top-up');
    assert.equal(result.errors.amount, undefined);
    assert.equal(result.errors.reason, undefined);
  });
});

describe('admin credit grant request contract helpers', () => {
  test('builds credit-grant POST path with encoded userId', () => {
    const url = buildAdminCreditGrantRequestUrl('user/id with spaces');
    assert.equal(url, '/api/admin/users/user%2Fid%20with%20spaces/credits');
  });

  test('builds credit-grant body with only amount/reason/idempotencyKey', () => {
    const body = buildAdminCreditGrantRequestBody({
      amount: 42,
      reason: '  manual top-up for support ticket  ',
      idempotencyKey: 'idem-123',
    }) as Record<string, unknown>;
    assert.deepEqual(Object.keys(body).sort(), ['amount', 'idempotencyKey', 'reason']);
    assert.equal(body.amount, 42);
    assert.equal(body.reason, 'manual top-up for support ticket');
    assert.equal(body.idempotencyKey, 'idem-123');
  });

  test('calculates projected balance from current balance and amount', () => {
    assert.equal(calculateProjectedBalance(150, 25), 175);
  });
});

describe('admin credit grant idempotency lifecycle helpers', () => {
  test('generates key once for a new confirmed logical attempt', () => {
    let callCount = 0;
    const key = getOrCreateIdempotencyKey({
      existingKey: null,
      createKey: () => {
        callCount += 1;
        return 'generated-key-1';
      },
    });
    assert.equal(key, 'generated-key-1');
    assert.equal(callCount, 1);
  });

  test('reuses retained key for retry without regenerating', () => {
    let callCount = 0;
    const key = getOrCreateIdempotencyKey({
      existingKey: 'retained-key-1',
      createKey: () => {
        callCount += 1;
        return 'should-not-be-used';
      },
    });
    assert.equal(key, 'retained-key-1');
    assert.equal(callCount, 0);
  });

  test('retains key for network and 5xx uncertainty', () => {
    assert.equal(resolveIdempotencyKeyAction({ transportError: true }), 'retain');
    assert.equal(resolveIdempotencyKeyAction({ httpStatus: 500 }), 'retain');
  });

  test('reuses the same key for explicit retry after uncertain outcome', () => {
    const uncertaintyAction = resolveIdempotencyKeyAction({ transportError: true });
    assert.equal(uncertaintyAction, 'retain');

    let createCallCount = 0;
    const firstAttemptKey = getOrCreateIdempotencyKey({
      existingKey: null,
      createKey: () => {
        createCallCount += 1;
        return 'generated-key-uncertain-1';
      },
    });

    const retryAttemptKey = getOrCreateIdempotencyKey({
      existingKey: uncertaintyAction === 'retain' ? firstAttemptKey : null,
      createKey: () => {
        createCallCount += 1;
        return 'should-not-be-used-for-retry';
      },
    });

    assert.equal(firstAttemptKey, 'generated-key-uncertain-1');
    assert.equal(retryAttemptKey, 'generated-key-uncertain-1');
    assert.equal(createCallCount, 1);
  });

  test('abandoned uncertain grant uses a new key for a new logical grant', () => {
    const uncertaintyAction = resolveIdempotencyKeyAction({ transportError: true });
    assert.equal(uncertaintyAction, 'retain');

    let createCallCount = 0;
    const initialKey = getOrCreateIdempotencyKey({
      existingKey: null,
      createKey: () => {
        createCallCount += 1;
        return `generated-key-${createCallCount}`;
      },
    });

    const retainedForRetry = uncertaintyAction === 'retain' ? initialKey : null;
    assert.equal(retainedForRetry, initialKey);

    // Closing/opening the panel clears stale retained keys for a new logical grant.
    const clearedForNewFlow: string | null = null;
    const newLogicalGrantKey = getOrCreateIdempotencyKey({
      existingKey: clearedForNewFlow,
      createKey: () => {
        createCallCount += 1;
        return `generated-key-${createCallCount}`;
      },
    });

    assert.equal(initialKey, 'generated-key-1');
    assert.equal(newLogicalGrantKey, 'generated-key-2');
    assert.notEqual(newLogicalGrantKey, retainedForRetry);
    assert.equal(createCallCount, 2);
  });

  test('clears key for definitive 400/404 outcomes', () => {
    assert.equal(resolveIdempotencyKeyAction({ httpStatus: 400 }), 'clear');
    assert.equal(resolveIdempotencyKeyAction({ httpStatus: 404 }), 'clear');
  });

  test('clears key for definitive granted/duplicate/failed API responses', () => {
    assert.equal(resolveIdempotencyKeyAction({ grantStatus: 'granted' }), 'clear');
    assert.equal(resolveIdempotencyKeyAction({ grantStatus: 'duplicate' }), 'clear');
    assert.equal(resolveIdempotencyKeyAction({ grantStatus: 'failed' }), 'clear');
  });
});

describe('admin credit grant result and balance update behavior', () => {
  test('updates visible balance on granted and duplicate only', () => {
    assert.equal(shouldUpdateBalanceFromGrantStatus('granted'), true);
    assert.equal(shouldUpdateBalanceFromGrantStatus('duplicate'), true);
    assert.equal(shouldUpdateBalanceFromGrantStatus('failed'), false);
  });

  test('applies balanceAfter while preserving other credit-balance fields', () => {
    const detail = buildSampleUserDetail(220);
    const updated = applyCreditBalanceAfterGrant(detail, 345);
    assert.ok(updated?.creditBalance);
    assert.equal(updated?.creditBalance?.balance, 345);
    assert.equal(updated?.creditBalance?.monthlyAllocation, 500);
    assert.equal(updated?.creditBalance?.rolloverBalance, 20);
    assert.equal(updated?.creditBalance?.planId, 'plan-free');
    assert.equal(updated?.creditBalance?.status, 'active');
  });

  test('leaves user detail unchanged when creditBalance is null', () => {
    const detail = buildSampleUserDetail(220);
    const withoutBalance: AdminUserDetail = { ...detail, creditBalance: null };
    const updated = applyCreditBalanceAfterGrant(withoutBalance, 999);
    assert.equal(updated?.creditBalance, null);
  });
});

describe('admin credit grant source behavior wiring checks', () => {
  test('confirmation renders target user, amount, reason, current and projected balance', () => {
    assert.match(creditGrantSource, /creditGrant\.targetUser/);
    assert.match(creditGrantSource, /creditGrant\.amount/);
    assert.match(creditGrantSource, /creditGrant\.reason/);
    assert.match(creditGrantSource, /creditGrant\.balanceBefore/);
    assert.match(creditGrantSource, /creditGrant\.projectedBalance/);
    assert.match(creditGrantSource, /calculateProjectedBalance\(creditBalance\.balance,\s*draft\.amount\)/);
  });

  test('confirmation cancel returns to editable form without window.confirm', () => {
    assert.match(creditGrantSource, /onClick=\{\(\) => setPhase\('form'\)\}/);
    assert.equal(/window\.confirm/.test(creditGrantSource), false);
  });

  test('uses in-flight duplicate-submit guard and explicit retry action', () => {
    assert.match(creditGrantSource, /if \(!draft \|\| activeSubmitRef\.current\)\s*\{\s*return;/);
    assert.match(creditGrantSource, /data-testid="admin-credit-grant-retry"/);
  });

  test('clears retained idempotency key when opening or closing the form flow', () => {
    assert.match(creditGrantSource, /const openForm = React\.useCallback\(\(\) => \{[\s\S]*?clearRetainedIdempotencyKey\(\);/);
    assert.match(creditGrantSource, /const closePanel = React\.useCallback\(\(\) => \{[\s\S]*?clearRetainedIdempotencyKey\(\);/);
  });

  test('uses crypto.randomUUID and retained idempotency key ref', () => {
    assert.match(creditGrantSource, /crypto\.randomUUID\(\)/);
    assert.match(creditGrantSource, /retainedIdempotencyKeyRef/);
  });

  test('reuses existing unauthorized handling callback for 401/403', () => {
    assert.match(creditGrantSource, /onUnauthorizedStatus\(response\.status\)/);
    assert.match(adminDetailSource, /onUnauthorizedStatus=\{redirectForUnauthorizedStatus\}/);
  });

  test('renders current-period note in credit-grant flow', () => {
    assert.match(creditGrantSource, /creditGrant\.currentPeriodNote/);
  });
});
