import type { Browser, BrowserContext, Page } from '@playwright/test';
import { LOCALE, SELECTORS } from './constants';
import { resolveMode, type EnvMap } from './modes';

export const AUTH_EMAIL_ENV = 'E2E_LOGIN_EMAIL';
export const AUTH_PASSWORD_ENV = 'E2E_LOGIN_PASSWORD';

export class AuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthConfigError';
  }
}

export interface LiveCredentials {
  email: string;
  password: string;
}

export function readLiveCredentials(env: EnvMap = process.env): LiveCredentials | null {
  const email = String(env[AUTH_EMAIL_ENV] ?? '').trim();
  const password = String(env[AUTH_PASSWORD_ENV] ?? '').trim();
  if (!email || !password) {
    return null;
  }
  return { email, password };
}

export function assertLiveCredentials(env: EnvMap = process.env): LiveCredentials {
  const credentials = readLiveCredentials(env);
  if (!credentials) {
    throw new AuthConfigError(
      `LIVE auth requires ${AUTH_EMAIL_ENV} and ${AUTH_PASSWORD_ENV}. Credentials are never hardcoded.`,
    );
  }
  return credentials;
}

export function contractModeAllowsMissingSecrets(env: EnvMap = process.env): boolean {
  return resolveMode(env) === 'contract' && readLiveCredentials(env) === null;
}

export async function createFreshBrowserContext(
  browser: Browser,
): Promise<BrowserContext> {
  return browser.newContext({
    ignoreHTTPSErrors: false,
    viewport: { width: 1440, height: 900 },
  });
}

export async function loginThroughApplication(
  page: Page,
  credentials: LiveCredentials,
  options?: { locale?: string; loginPath?: string },
): Promise<void> {
  const locale = options?.locale ?? LOCALE;
  const loginPath = options?.loginPath ?? `/${locale}/login`;
  await page.goto(loginPath, { waitUntil: 'domcontentloaded' });
  await page.locator(SELECTORS.email).fill(credentials.email);
  await page.locator(SELECTORS.password).fill(credentials.password);
  await Promise.all([
    page.waitForURL(new RegExp(`/${locale}/app(?:/|\\?|$)`), { timeout: 30_000 }),
    page.locator(SELECTORS.loginSubmit).click(),
  ]);
}

export function loginUsesApplicationContract(): {
  method: 'POST';
  path: '/api/auth/login';
  fields: ['email', 'password'];
  cookiesEstablishedByBrowser: ['aisandbox_session', 'aisandbox_csrf'];
} {
  return {
    method: 'POST',
    path: '/api/auth/login',
    fields: ['email', 'password'],
    cookiesEstablishedByBrowser: ['aisandbox_session', 'aisandbox_csrf'],
  };
}
