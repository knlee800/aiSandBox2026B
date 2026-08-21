import path from 'node:path';
import { defineConfig } from '@playwright/test';
import { LIVE_ACTION_TIMEOUT_MS, LIVE_NAVIGATION_TIMEOUT_MS } from './lib/constants';

const root = __dirname;

export default defineConfig({
  globalSetup: path.join(root, 'live-global-setup.ts'),
  testDir: root,
  testMatch: ['live.spec.ts'],
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  outputDir: path.join(root, 'test-results'),
  timeout: 10 * 60 * 1000,
  expect: { timeout: 30_000 },
  use: {
    browserName: 'chromium',
    headless: process.env.E2E_HEADED === 'true' ? false : true,
    baseURL: process.env.E2E_BASE_URL ?? 'https://staging.ainow.biz',
    actionTimeout: LIVE_ACTION_TIMEOUT_MS,
    navigationTimeout: LIVE_NAVIGATION_TIMEOUT_MS,
    screenshot: 'only-on-failure',
    trace: 'off',
    video: 'off',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'live',
      testMatch: ['live.spec.ts'],
    },
  ],
});
