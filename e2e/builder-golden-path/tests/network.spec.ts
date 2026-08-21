import { test, expect } from '@playwright/test';
import {
  extractExecutionIdFromConfirmUrl,
  isPublicConfirmBuildApplyUrl,
  parseConfirmBody,
  validateLiveConfirmResponse,
  ConfirmObservationError,
  armSessionCreateListener,
  extractSessionIdFromCreateBody,
  isSessionCreateUrl,
  SessionObservationError,
} from '../lib/network';
import { SESSION_CREATE_TIMEOUT_MS } from '../lib/constants';
import {
  createSessionRaceFixtureServer,
  SESSION_RACE_SESSION_ID,
} from '../lib/local-fixture';

test.describe('public confirm observation', () => {
  test('validates the public 03J route, HTTP 200, triggered=true, reason=completed', () => {
    const url =
      'https://staging.ainow.biz/api/ai/executions/d3b8409f-18c8-42e4-a9fc-e8fcb7574494/confirm-build-apply';
    expect(isPublicConfirmBuildApplyUrl(url)).toBe(true);
    expect(
      isPublicConfirmBuildApplyUrl(
        'https://staging.ainow.biz/api/internal/executions/d3b8409f-18c8-42e4-a9fc-e8fcb7574494/confirm-build-apply',
      ),
    ).toBe(false);
    expect(extractExecutionIdFromConfirmUrl(url)).toBe(
      'd3b8409f-18c8-42e4-a9fc-e8fcb7574494',
    );
    expect(parseConfirmBody({ triggered: true, reason: 'completed' })).toEqual({
      triggered: true,
      reason: 'completed',
    });
    expect(() =>
      validateLiveConfirmResponse({
        url,
        status: 200,
        body: { triggered: true, reason: 'completed' },
        executionId: 'd3b8409f-18c8-42e4-a9fc-e8fcb7574494',
      }),
    ).not.toThrow();
    expect(() =>
      validateLiveConfirmResponse({
        url,
        status: 500,
        body: { triggered: true, reason: 'completed' },
        executionId: 'd3b8409f-18c8-42e4-a9fc-e8fcb7574494',
      }),
    ).toThrow(ConfirmObservationError);
    expect(() =>
      validateLiveConfirmResponse({
        url,
        status: 200,
        body: { triggered: false, reason: 'completed' },
        executionId: 'd3b8409f-18c8-42e4-a9fc-e8fcb7574494',
      }),
    ).toThrow(ConfirmObservationError);
  });
});

test.describe('AUTO-01D session-create observation', () => {
  test.describe.configure({ mode: 'serial' });
  test('matches only POST /api/sessions create, not session subpaths', () => {
    expect(isSessionCreateUrl('https://staging.ainow.biz/api/sessions')).toBe(true);
    expect(isSessionCreateUrl('https://staging.ainow.biz/api/sessions/')).toBe(true);
    expect(
      isSessionCreateUrl(
        'https://staging.ainow.biz/api/sessions/d0e12d9f-8110-4cf3-b153-2e87de2bb721/stop',
      ),
    ).toBe(false);
    expect(extractSessionIdFromCreateBody({ id: SESSION_RACE_SESSION_ID })).toBe(
      SESSION_RACE_SESSION_ID,
    );
    expect(extractSessionIdFromCreateBody({})).toBeNull();
    expect(SESSION_CREATE_TIMEOUT_MS).toBeGreaterThanOrEqual(30_000);
    expect(SESSION_CREATE_TIMEOUT_MS).toBeLessThanOrEqual(60_000);
  });

  test('retains a POST /api/sessions response that arrives before waitForFirst', async ({
    page,
  }) => {
    const fixture = await createSessionRaceFixtureServer('session-before-project');
    try {
      await page.goto(`${fixture.url}/en/app`);
      const listener = await armSessionCreateListener(page);
      await page.locator('[data-testid="workspace-projects-create-confirm-button"]').click();
      await expect.poll(() => listener.hasObserved()).toBe(true);
      const capture = await listener.waitForFirst(2_000);
      expect(capture.sessionId).toBe(SESSION_RACE_SESSION_ID);
      expect(fixture.sessionPostCount()).toBe(1);
      await listener.dispose();
    } finally {
      await fixture.close();
    }
  });

  test('captures a session POST fired later by a project-card click', async ({ page }) => {
    const fixture = await createSessionRaceFixtureServer('on-card-click');
    try {
      await page.goto(`${fixture.url}/en/app`);
      const listener = await armSessionCreateListener(page);
      await page.locator('[data-testid="workspace-projects-create-confirm-button"]').click();
      await page.locator(`[data-testid="workspace-project-card-project-race-1"]`).click();
      const capture = await listener.waitForFirst(2_000);
      expect(capture.sessionId).toBe(SESSION_RACE_SESSION_ID);
      expect(fixture.sessionPostCount()).toBe(1);
      await listener.dispose();
    } finally {
      await fixture.close();
    }
  });

  test('missing session response fails inside the bounded adapter timeout', async ({ page }) => {
    const fixture = await createSessionRaceFixtureServer('never');
    try {
      await page.goto(`${fixture.url}/en/app`);
      const listener = await armSessionCreateListener(page);
      const started = Date.now();
      await expect(listener.waitForFirst(400)).rejects.toBeInstanceOf(SessionObservationError);
      expect(Date.now() - started).toBeLessThan(5_000);
      await listener.dispose();
    } finally {
      await fixture.close();
    }
  });
});
