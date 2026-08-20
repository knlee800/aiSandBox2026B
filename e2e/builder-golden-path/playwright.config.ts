import path from 'node:path';
import { defineConfig } from '@playwright/test';

const root = __dirname;

export default defineConfig({
  testDir: root,
  testMatch: ['golden-path.spec.ts', 'tests/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: false,
  retries: 0,
  workers: undefined,
  reporter: [['list']],
  outputDir: path.join(root, 'test-results'),
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    browserName: 'chromium',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'off',
    video: 'off',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'contract',
      testMatch: ['golden-path.spec.ts', 'tests/**/*.spec.ts'],
    },
  ],
});
