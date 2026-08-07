import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';
import {
  buildAdminUserDetailPath,
  buildAdminUsersRequestUrl,
  resolveAdminAuthOutcome,
} from './admin-page-client';
import {
  applySessionTerminationUpdate,
  buildAdminSessionTerminateRequestUrl,
  buildAdminUserDetailRequestUrl,
  buildAdminUserSessionsRequestUrl,
  normalizeUserIdParam,
  shouldTreatAdminStatusAsUnauthorized,
  type AdminSessionVisibility,
} from './admin-user-detail-client';

type JsonObject = Record<string, unknown>;

const messagesDir = resolve(__dirname, '../../messages');
const enMessages = JSON.parse(readFileSync(resolve(messagesDir, 'en.json'), 'utf-8')) as JsonObject;
const zhTwMessages = JSON.parse(readFileSync(resolve(messagesDir, 'zh-TW.json'), 'utf-8')) as JsonObject;
const zhCnMessages = JSON.parse(readFileSync(resolve(messagesDir, 'zh-CN.json'), 'utf-8')) as JsonObject;

const adminPageSource = readFileSync(resolve(__dirname, './admin-page-client.tsx'), 'utf-8');
const adminDetailSource = readFileSync(resolve(__dirname, './admin-user-detail-client.tsx'), 'utf-8');
const adminCreditGrantSource = readFileSync(resolve(__dirname, './admin-credit-grant-panel.tsx'), 'utf-8');

function readNested(source: JsonObject, fullKey: string): unknown {
  const keyParts = fullKey.split('.');
  let current: unknown = source;

  for (const part of keyParts) {
    if (!current || typeof current !== 'object' || !(part in current)) {
      return undefined;
    }
    current = (current as JsonObject)[part];
  }

  return current;
}

describe('admin auth and route helpers', () => {
  test('resolves authorized admin payload', () => {
    const outcome = resolveAdminAuthOutcome({
      responseOk: true,
      payload: { id: 'user-1', role: 'admin' },
    });
    assert.equal(outcome, 'authorized');
  });

  test('resolves login redirect when /api/auth/me is not ok', () => {
    const outcome = resolveAdminAuthOutcome({
      responseOk: false,
      payload: null,
    });
    assert.equal(outcome, 'redirect-login');
  });

  test('resolves platform redirect for non-admin user', () => {
    const outcome = resolveAdminAuthOutcome({
      responseOk: true,
      payload: { id: 'user-1', role: 'user' },
    });
    assert.equal(outcome, 'redirect-platform');
  });
});

describe('users list query behavior', () => {
  test('builds base users URL with no query params', () => {
    const url = buildAdminUsersRequestUrl({ search: '', quotaStatus: 'ALL' });
    assert.equal(url, '/api/admin/users');
  });

  test('includes trimmed search query only when provided', () => {
    const url = buildAdminUsersRequestUrl({ search: '  alpha@example.com ', quotaStatus: 'ALL' });
    assert.equal(url, '/api/admin/users?search=alpha%40example.com');
  });

  test('includes quotaStatus only when filter is not ALL', () => {
    const url = buildAdminUsersRequestUrl({ search: '', quotaStatus: 'WARN' });
    assert.equal(url, '/api/admin/users?quotaStatus=WARN');
  });

  test('includes both search and quotaStatus together', () => {
    const url = buildAdminUsersRequestUrl({
      search: 'beta',
      quotaStatus: 'EXCEEDED',
    });
    assert.equal(url, '/api/admin/users?search=beta&quotaStatus=EXCEEDED');
  });

  test('builds encoded user-detail route path', () => {
    const url = buildAdminUserDetailPath('en', 'user/id with spaces');
    assert.equal(url, '/en/admin/users/user%2Fid%20with%20spaces');
  });
});

describe('detail and session endpoint helpers', () => {
  test('builds encoded user-detail request URL', () => {
    const url = buildAdminUserDetailRequestUrl('user/id with spaces');
    assert.equal(url, '/api/admin/users/user%2Fid%20with%20spaces');
  });

  test('builds encoded sessions request URL with userId filter', () => {
    const url = buildAdminUserSessionsRequestUrl('user/id with spaces');
    assert.equal(url, '/api/admin/sessions?userId=user%2Fid%20with%20spaces');
  });

  test('builds encoded session terminate request URL', () => {
    const url = buildAdminSessionTerminateRequestUrl('session/id with spaces');
    assert.equal(url, '/api/admin/sessions/session%2Fid%20with%20spaces');
  });

  test('normalizes userId route param from string', () => {
    assert.equal(normalizeUserIdParam(' user-123 '), 'user-123');
  });

  test('normalizes userId route param from first array item', () => {
    assert.equal(normalizeUserIdParam([' user-1 ', 'user-2']), 'user-1');
  });

  test('returns null for invalid userId route param', () => {
    assert.equal(normalizeUserIdParam(undefined), null);
    assert.equal(normalizeUserIdParam('   '), null);
  });
});

describe('session termination helpers', () => {
  const sampleSessions: AdminSessionVisibility[] = [
    {
      sessionId: 'session-active',
      userId: 'user-1',
      userEmail: 'user@example.com',
      status: 'active',
      isTerminated: false,
      terminationReason: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      lastActivityAt: '2026-08-01T01:00:00.000Z',
      expiresAt: '2026-08-02T00:00:00.000Z',
    },
    {
      sessionId: 'session-other',
      userId: 'user-1',
      userEmail: 'user@example.com',
      status: 'active',
      isTerminated: false,
      terminationReason: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      lastActivityAt: '2026-08-01T01:00:00.000Z',
      expiresAt: '2026-08-02T00:00:00.000Z',
    },
  ];

  test('treats 401 and 403 as unauthorized statuses', () => {
    assert.equal(shouldTreatAdminStatusAsUnauthorized(401), true);
    assert.equal(shouldTreatAdminStatusAsUnauthorized(403), true);
    assert.equal(shouldTreatAdminStatusAsUnauthorized(500), false);
  });

  test('marks targeted session terminated on successful update', () => {
    const updated = applySessionTerminationUpdate(sampleSessions, 'session-active');
    const target = updated.find((item) => item.sessionId === 'session-active');
    assert.ok(target);
    assert.equal(target.isTerminated, true);
    assert.equal(target.status, 'terminated');
  });

  test('fills fallback termination reason when reason is missing', () => {
    const updated = applySessionTerminationUpdate(sampleSessions, 'session-active', 'manual');
    const target = updated.find((item) => item.sessionId === 'session-active');
    assert.equal(target?.terminationReason, 'manual');
  });

  test('keeps non-target sessions unchanged', () => {
    const updated = applySessionTerminationUpdate(sampleSessions, 'session-active');
    const other = updated.find((item) => item.sessionId === 'session-other');
    assert.ok(other);
    assert.equal(other.isTerminated, false);
    assert.equal(other.status, 'active');
  });
});

describe('admin component source wiring checks', () => {
  test('admin page checks auth via /api/auth/me with credentials include', () => {
    assert.match(adminPageSource, /fetch\('\/api\/auth\/me',\s*\{[\s\S]*credentials: 'include'/);
  });

  test('admin page redirects unauthorized users to login or platform', () => {
    assert.match(adminPageSource, /router\.replace\(`\/\$\{locale\}\/login`\)/);
    assert.match(adminPageSource, /router\.replace\(`\/\$\{locale\}\/platform`\)/);
  });

  test('users page defines loading, error, and empty test IDs', () => {
    assert.match(adminPageSource, /admin-page-users-loading/);
    assert.match(adminPageSource, /admin-page-users-error/);
    assert.match(adminPageSource, /admin-page-users-empty/);
  });

  test('users page includes search and quota filter controls', () => {
    assert.match(adminPageSource, /admin-users-search-input/);
    assert.match(adminPageSource, /admin-users-quota-filter/);
  });

  test('users page navigates to selected user detail route', () => {
    assert.match(adminPageSource, /buildAdminUserDetailPath\(locale,\s*user\.userId\)/);
  });

  test('detail page checks auth via /api/auth/me with credentials include', () => {
    assert.match(adminDetailSource, /fetch\('\/api\/auth\/me',\s*\{[\s\S]*credentials: 'include'/);
  });

  test('detail page fetches sessions using selected userId', () => {
    assert.match(adminDetailSource, /buildAdminUserSessionsRequestUrl\(userId\)/);
  });

  test('detail page includes sessions loading, error, and empty states', () => {
    assert.match(adminDetailSource, /admin-user-detail-sessions-loading/);
    assert.match(adminDetailSource, /admin-user-detail-sessions-error/);
    assert.match(adminDetailSource, /admin-user-detail-sessions-empty/);
  });

  test('detail page includes credit balance null-state test ID', () => {
    assert.match(adminDetailSource, /admin-user-detail-credit-balance-empty/);
  });

  test('detail page composes credit grant panel near credit balance', () => {
    assert.match(adminDetailSource, /AdminCreditGrantPanel/);
    assert.match(adminDetailSource, /admin-user-detail-credit-balance/);
    assert.match(adminDetailSource, /shouldShowAdminCreditGrantPanel\(userDetail\.creditBalance\)/);
  });

  test('detail page uses window.confirm before session termination', () => {
    assert.match(adminDetailSource, /window\.confirm\(t\('confirm\.terminateSession'\)\)/);
  });

  test('detail page calls DELETE terminate endpoint with credentials include', () => {
    assert.match(adminDetailSource, /method: 'DELETE'/);
    assert.match(adminDetailSource, /credentials: 'include'/);
  });

  test('detail page has terminate success and error feedback states', () => {
    assert.match(adminDetailSource, /admin-user-detail-terminate-success/);
    assert.match(adminDetailSource, /admin-user-detail-terminate-error/);
  });

  test('credit grant source includes required panel phases', () => {
    assert.match(adminCreditGrantSource, /'closed' \| 'form' \| 'confirm' \| 'submitting' \| 'result'/);
  });

  test('credit grant source shows current-period note and projected-balance note', () => {
    assert.match(adminCreditGrantSource, /creditGrant\.currentPeriodNote/);
    assert.match(adminCreditGrantSource, /creditGrant\.projectedBalanceNote/);
  });

  test('credit grant source uses POST with credentials include and JSON content type', () => {
    assert.match(adminCreditGrantSource, /method: 'POST'/);
    assert.match(adminCreditGrantSource, /credentials: 'include'/);
    assert.match(adminCreditGrantSource, /'Content-Type': 'application\/json'/);
  });

  test('credit grant source uses crypto.randomUUID for idempotency key', () => {
    assert.match(adminCreditGrantSource, /crypto\.randomUUID\(\)/);
  });
});

describe('i18n admin namespace checks', () => {
  const requiredGroupKeys = [
    'admin.nav.console',
    'admin.users.title',
    'admin.userDetail.title',
    'admin.creditBalance.title',
    'admin.sessions.title',
    'admin.terminate.action',
    'admin.confirm.terminateSession',
    'admin.loading.authCheck',
    'admin.empty.users',
    'admin.success.sessionTerminated',
    'admin.error.usersLoad',
    'admin.unauthorized.loginRedirect',
  ];
  const requiredCreditGrantKeys = [
    'admin.creditGrant.title',
    'admin.creditGrant.addCredits',
    'admin.creditGrant.amount',
    'admin.creditGrant.reason',
    'admin.creditGrant.reasonPlaceholder',
    'admin.creditGrant.reasonCount',
    'admin.creditGrant.confirm',
    'admin.creditGrant.cancel',
    'admin.creditGrant.confirmTitle',
    'admin.creditGrant.targetUser',
    'admin.creditGrant.projectedBalance',
    'admin.creditGrant.projectedBalanceNote',
    'admin.creditGrant.currentPeriodNote',
    'admin.creditGrant.submitting',
    'admin.creditGrant.granted',
    'admin.creditGrant.duplicate',
    'admin.creditGrant.failed',
    'admin.creditGrant.retry',
    'admin.creditGrant.balanceBefore',
    'admin.creditGrant.balanceAfter',
    'admin.creditGrant.validation.amountRequired',
    'admin.creditGrant.validation.amountInteger',
    'admin.creditGrant.validation.amountMin',
    'admin.creditGrant.validation.reasonRequired',
    'admin.creditGrant.validation.reasonMax',
    'admin.creditGrant.error.http400',
    'admin.creditGrant.error.http404',
    'admin.creditGrant.error.network',
    'admin.creditGrant.error.generic',
  ];

  test('en.json contains required admin namespace keys', () => {
    for (const key of requiredGroupKeys) {
      const value = readNested(enMessages, key);
      assert.equal(typeof value, 'string', `Missing en key: ${key}`);
    }
  });

  test('zh-TW.json contains required admin namespace keys', () => {
    for (const key of requiredGroupKeys) {
      const value = readNested(zhTwMessages, key);
      assert.equal(typeof value, 'string', `Missing zh-TW key: ${key}`);
    }
  });

  test('zh-CN.json contains required admin namespace keys', () => {
    for (const key of requiredGroupKeys) {
      const value = readNested(zhCnMessages, key);
      assert.equal(typeof value, 'string', `Missing zh-CN key: ${key}`);
    }
  });

  test('en.json contains required admin credit grant keys', () => {
    for (const key of requiredCreditGrantKeys) {
      const value = readNested(enMessages, key);
      assert.equal(typeof value, 'string', `Missing en key: ${key}`);
    }
  });

  test('zh-TW.json contains required admin credit grant keys', () => {
    for (const key of requiredCreditGrantKeys) {
      const value = readNested(zhTwMessages, key);
      assert.equal(typeof value, 'string', `Missing zh-TW key: ${key}`);
    }
  });

  test('zh-CN.json contains required admin credit grant keys', () => {
    for (const key of requiredCreditGrantKeys) {
      const value = readNested(zhCnMessages, key);
      assert.equal(typeof value, 'string', `Missing zh-CN key: ${key}`);
    }
  });
});

describe('no hardcoded English admin UI copy', () => {
  test('admin component sources avoid new hardcoded English UI labels', () => {
    const hardcodedPatterns = [
      /['"]Admin Console['"]/,
      /['"]Users['"]/,
      /['"]User Detail['"]/,
      /['"]Credit Balance['"]/,
      /['"]Terminate['"]/,
      /['"]Loading users\.\.\.['"]/,
    ];

    for (const pattern of hardcodedPatterns) {
      assert.equal(pattern.test(adminPageSource), false, `Hardcoded copy found in admin page: ${pattern}`);
      assert.equal(pattern.test(adminDetailSource), false, `Hardcoded copy found in admin detail: ${pattern}`);
      assert.equal(pattern.test(adminCreditGrantSource), false, `Hardcoded copy found in admin credit grant: ${pattern}`);
    }
  });

  test('credit-grant component avoids hardcoded English grant labels', () => {
    const hardcodedGrantPatterns = [
      /['"]Add Credits['"]/,
      /['"]Credit Grant['"]/,
      /['"]Confirm credit grant['"]/,
      /['"]Projected Balance['"]/,
      /['"]Balance Before['"]/,
      /['"]Balance After['"]/,
      /['"]Retry['"]/,
    ];

    for (const pattern of hardcodedGrantPatterns) {
      assert.equal(
        pattern.test(adminCreditGrantSource),
        false,
        `Hardcoded grant copy found in admin credit grant: ${pattern}`,
      );
    }
  });
});
