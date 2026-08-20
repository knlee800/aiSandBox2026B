import { test, expect } from '@playwright/test';
import { createFreshBrowserContext, loginThroughApplication } from './lib/auth';
import { createLocalFixtureServer } from './lib/local-fixture';
import {
  armConfirmBuildApplyListener,
  validateLiveConfirmResponse,
} from './lib/network';
import { startAndAssertPreview } from './lib/preview';
import { resolveMode } from './lib/modes';
import { GOLDEN_PATH_PHASES } from './lib/phases';
import { createRecordingAdapters, runGoldenPath } from './lib/runner';
import { PREVIEW_HEADING, PREVIEW_PARAGRAPH, SELECTORS } from './lib/constants';

test.describe('CONTRACT Playwright golden-path runner', () => {
  test('default invocation is CONTRACT/DRY', () => {
    expect(resolveMode({})).toBe('contract');
    expect(GOLDEN_PATH_PHASES[GOLDEN_PATH_PHASES.indexOf('WAIT_FOR_AUTO_APPLY') + 1]).toBe(
      'PREVIEW',
    );
  });

  test('dry-run recording adapters produce a concise PASS summary', async () => {
    const { adapters, gateTracker } = createRecordingAdapters();
    const result = await runGoldenPath({
      mode: 'contract',
      adapters,
      gateTracker,
    });
    expect(result.summary.verdict).toBe('PASS');
    expect(result.formatted).toContain('verdict=PASS');
    expect(result.formatted.split('\n').length).toBeLessThanOrEqual(20);
  });

  test('Chromium launches a fresh context, navigates, observes confirm, and asserts preview', async ({
    browser,
  }) => {
    const fixture = await createLocalFixtureServer();
    const context = await createFreshBrowserContext(browser);
    const page = await context.newPage();
    try {
      await page.goto(`${fixture.url}/en/login`);
      await loginThroughApplication(page, {
        email: 'fixture@example.test',
        password: 'fixture-password',
      }, { loginPath: `${fixture.url}/en/login` });

      expect(page.url()).toContain('/en/app');

      const listener = await armConfirmBuildApplyListener(page);
      await page.locator('#fire-confirm').click();
      const capture = await listener.waitForFirst(5_000);
      validateLiveConfirmResponse(capture);
      expect(capture.status).toBe(200);
      expect(capture.executionId).toBe('exec-fixture');

      const preview = await startAndAssertPreview(page, {
        heading: PREVIEW_HEADING,
        paragraph: PREVIEW_PARAGRAPH,
        timeoutMs: 5_000,
      });
      expect(preview.preview).toBe('PASS');
      await expect(page.locator(SELECTORS.previewIframe)).toBeVisible();
      await listener.dispose();
    } finally {
      await context.close();
      await fixture.close();
    }
  });
});
