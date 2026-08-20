import { test, expect } from '@playwright/test';
import {
  LiveAuthorizationError,
  ProviderBudgetError,
  assertContractDoesNotRequireSecrets,
  assertLiveAuthorized,
  inspectLiveGuards,
  resolveMode,
} from '../lib/modes';
import { contractModeAllowsMissingSecrets, readLiveCredentials } from '../lib/auth';

const completeLiveEnv = {
  E2E_MODE: 'live',
  E2E_LIVE_AUTHORIZED: 'true',
  E2E_ALLOW_STAGING_MUTATION: 'true',
  E2E_ALLOW_CREDIT_MUTATION: 'true',
  PROVIDER_CALL_BUDGET: '1',
};

test.describe('runner modes', () => {
  test('default mode is CONTRACT/DRY', () => {
    expect(resolveMode({})).toBe('contract');
    expect(resolveMode({ E2E_MODE: 'dry' })).toBe('contract');
    expect(resolveMode({ E2E_MODE: 'live' })).toBe('contract');
    expect(resolveMode({ NODE_ENV: 'test' })).toBe('contract');
  });

  test('LIVE fails closed without all authorization flags', () => {
    const inspection = inspectLiveGuards({ E2E_MODE: 'live' });
    expect(inspection.authorized).toBe(false);
    expect(inspection.missing).toEqual(
      expect.arrayContaining([
        'E2E_LIVE_AUTHORIZED=true',
        'E2E_ALLOW_STAGING_MUTATION=true',
        'E2E_ALLOW_CREDIT_MUTATION=true',
        'PROVIDER_CALL_BUDGET=1',
      ]),
    );
    expect(() => assertLiveAuthorized({ E2E_MODE: 'live' })).toThrow(LiveAuthorizationError);
    expect(resolveMode({ ...completeLiveEnv, E2E_LIVE_AUTHORIZED: 'false' })).toBe('contract');
  });

  test('provider-call budget must equal exactly 1', () => {
    expect(() =>
      assertLiveAuthorized({ ...completeLiveEnv, PROVIDER_CALL_BUDGET: '2' }),
    ).toThrow(ProviderBudgetError);
    expect(() =>
      assertLiveAuthorized({ ...completeLiveEnv, PROVIDER_CALL_BUDGET: '0' }),
    ).toThrow(ProviderBudgetError);
    expect(() =>
      assertLiveAuthorized({ ...completeLiveEnv, PROVIDER_CALL_BUDGET: '1.0' }),
    ).toThrow(ProviderBudgetError);
    expect(() => assertLiveAuthorized(completeLiveEnv)).not.toThrow();
    expect(resolveMode(completeLiveEnv)).toBe('live');
  });

  test('secrets are not required in CONTRACT mode', () => {
    const env = { E2E_MODE: 'contract' };
    expect(resolveMode(env)).toBe('contract');
    expect(readLiveCredentials(env)).toBeNull();
    expect(contractModeAllowsMissingSecrets(env)).toBe(true);
    expect(() => assertContractDoesNotRequireSecrets(env)).not.toThrow();
  });
});
