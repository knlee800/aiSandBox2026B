import { test, expect } from '@playwright/test';
import { assertLiveAuthorized } from './lib/modes';
import { createLiveAdapters } from './lib/live-adapters';
import { runGoldenPath } from './lib/runner';
import { ProviderCallGuard } from './lib/safety-gates';

test('LIVE Builder golden path @live-only', async ({ browser }) => {
  assertLiveAuthorized(process.env);
  const { adapters, gateTracker } = await createLiveAdapters({ browser });
  const result = await runGoldenPath({
    mode: 'live',
    adapters,
    gateTracker,
    providerGuard: new ProviderCallGuard(1),
  });
  console.log(result.formatted);
  expect(result.summary.verdict).toBe('PASS');
});
