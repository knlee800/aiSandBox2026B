import type { NextFunction, Request, Response } from 'express';
import {
  cookieHeaderHasName,
  csrfCookieMiddleware,
  csrfCookieSetOptions,
  isSecureCookieMode,
  oauthStateSessionOptions,
  platformCookieNames,
  requestHasSessionCookie,
  SESSION_COOKIE_NAMES,
  sessionCookieClearOptions,
  sessionCookieSetOptions,
} from '../platform-cookies';

/** COOKIE-PREFIX-01: the mode rule, names and attributes (stage-start 6.3 items 1, 8, 9). */
describe('platform cookies (COOKIE-PREFIX-01)', () => {
  describe('isSecureCookieMode', () => {
    it.each([
      ['https APP_BASE_URL in development', { APP_BASE_URL: 'https://staging.ainow.biz', NODE_ENV: 'development' }, true],
      ['https APP_BASE_URL in test', { APP_BASE_URL: 'https://staging.ainow.biz', NODE_ENV: 'test' }, true],
      ['https APP_BASE_URL with NODE_ENV staging', { APP_BASE_URL: 'https://staging.ainow.biz', NODE_ENV: 'staging' }, true],
      ['https APP_BASE_URL with a path and spaces', { APP_BASE_URL: '  https://app.example.com/en/app ' }, true],
      ['production with no APP_BASE_URL', { NODE_ENV: 'production' }, true],
      ['production with an http APP_BASE_URL', { APP_BASE_URL: 'http://localhost:3000', NODE_ENV: 'production' }, true],
      ['local http in development', { APP_BASE_URL: 'http://localhost:3000', NODE_ENV: 'development' }, false],
      ['local http in test', { APP_BASE_URL: 'http://localhost:3000', NODE_ENV: 'test' }, false],
      ['nothing set', {}, false],
      ['a blank APP_BASE_URL', { APP_BASE_URL: '  ', NODE_ENV: 'development' }, false],
      ['an APP_BASE_URL that is not a URL', { APP_BASE_URL: 'not a url', NODE_ENV: 'staging' }, false],
      ['NODE_ENV staging with an http URL', { APP_BASE_URL: 'http://staging.local', NODE_ENV: 'staging' }, false],
    ])('%s: %s', (_label, env, expected) => {
      expect(isSecureCookieMode(env)).toBe(expected);
    });

    it('reads process.env by default', () => {
      const saved = { APP_BASE_URL: process.env.APP_BASE_URL, NODE_ENV: process.env.NODE_ENV };
      try {
        process.env.APP_BASE_URL = 'https://staging.ainow.biz';
        process.env.NODE_ENV = 'test';
        expect(isSecureCookieMode()).toBe(true);
        process.env.APP_BASE_URL = 'http://localhost:3000';
        expect(isSecureCookieMode()).toBe(false);
      } finally {
        for (const [name, value] of Object.entries(saved)) {
          if (value === undefined) delete process.env[name];
          else process.env[name] = value;
        }
      }
    });
  });

  const SECURE = { APP_BASE_URL: 'https://staging.ainow.biz', NODE_ENV: 'production' };
  const LOCAL = { APP_BASE_URL: 'http://localhost:3000', NODE_ENV: 'development' };

  it('names: __Host- in secure mode, today\'s names otherwise', () => {
    expect(platformCookieNames(SECURE)).toEqual({
      session: '__Host-aisandbox_session',
      csrf: '__Host-aisandbox_csrf',
      oauthState: '__Host-aisandbox_oauth_state',
    });
    expect(platformCookieNames(LOCAL)).toEqual({
      session: 'aisandbox_session',
      csrf: 'aisandbox_csrf',
      oauthState: 'aisandbox_oauth_state',
    });
    expect(SESSION_COOKIE_NAMES).toEqual(['__Host-aisandbox_session', 'aisandbox_session']);
  });

  it('session cookie options: Secure, Path=/, no Domain in secure mode; today\'s otherwise', () => {
    const common = { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 };
    expect(sessionCookieSetOptions(SECURE)).toEqual({ ...common, secure: true });
    expect(sessionCookieSetOptions(LOCAL)).toEqual({ ...common, secure: false });
    expect(sessionCookieClearOptions(SECURE)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
    expect(sessionCookieClearOptions(LOCAL)).toEqual({ path: '/' });
    for (const options of [
      sessionCookieSetOptions(SECURE),
      sessionCookieClearOptions(SECURE),
      csrfCookieSetOptions(SECURE),
    ]) {
      expect(options).not.toHaveProperty('domain');
    }
  });

  it('CSRF cookie options: readable by the page, Secure and Path=/ in secure mode', () => {
    expect(csrfCookieSetOptions(SECURE)).toEqual({ httpOnly: false, secure: true, sameSite: 'lax', path: '/' });
    expect(csrfCookieSetOptions(LOCAL)).toEqual({ httpOnly: false, secure: false, sameSite: 'lax', path: '/' });
  });

  // Stage-start 6.3 item 8.
  it('cookie-session options: __Host-aisandbox_oauth_state, secure, path /, no domain in secure mode', () => {
    const secure = oauthStateSessionOptions('secret', SECURE);
    expect(secure).toEqual({
      name: '__Host-aisandbox_oauth_state',
      keys: ['secret'],
      maxAge: 10 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
    });
    expect(secure).not.toHaveProperty('domain');
    expect(oauthStateSessionOptions('secret', LOCAL)).toEqual({
      name: 'aisandbox_oauth_state',
      keys: ['secret'],
      maxAge: 10 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    });
  });

  describe('cookieHeaderHasName and requestHasSessionCookie', () => {
    it('matches exact names only', () => {
      expect(cookieHeaderHasName('a=1; __Host-aisandbox_session=t', SESSION_COOKIE_NAMES)).toBe(true);
      expect(cookieHeaderHasName(' aisandbox_session =t', SESSION_COOKIE_NAMES)).toBe(true);
      expect(cookieHeaderHasName(['a=1', 'aisandbox_session=t'], SESSION_COOKIE_NAMES)).toBe(true);
      expect(cookieHeaderHasName('x__Host-aisandbox_session=t', SESSION_COOKIE_NAMES)).toBe(false);
      expect(cookieHeaderHasName('x_aisandbox_session=t', SESSION_COOKIE_NAMES)).toBe(false);
      expect(cookieHeaderHasName('aisandbox_session', SESSION_COOKIE_NAMES)).toBe(false);
      expect(cookieHeaderHasName('', SESSION_COOKIE_NAMES)).toBe(false);
      expect(cookieHeaderHasName(undefined, SESSION_COOKIE_NAMES)).toBe(false);
    });

    it('sees either name in parsed cookies or in the raw header', () => {
      const make = (cookies: Record<string, string> | undefined, cookie?: string) =>
        ({ cookies, headers: cookie === undefined ? {} : { cookie } }) as unknown as Request;
      expect(requestHasSessionCookie(make({ '__Host-aisandbox_session': 't' }))).toBe(true);
      expect(requestHasSessionCookie(make({ aisandbox_session: 't' }))).toBe(true);
      expect(requestHasSessionCookie(make(undefined, '__Host-aisandbox_session=t'))).toBe(true);
      expect(requestHasSessionCookie(make({ 'x__Host-aisandbox_session': 't' }, 'x__Host-aisandbox_session=t'))).toBe(
        false,
      );
      expect(requestHasSessionCookie(make({}, ''))).toBe(false);
    });
  });

  describe('csrfCookieMiddleware', () => {
    const saved: Record<string, string | undefined> = {};
    beforeEach(() => {
      saved.APP_BASE_URL = process.env.APP_BASE_URL;
      saved.NODE_ENV = process.env.NODE_ENV;
    });
    afterEach(() => {
      for (const [name, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    });

    function run(cookies: Record<string, string>) {
      const cookie = jest.fn();
      const next = jest.fn() as unknown as NextFunction;
      csrfCookieMiddleware({ cookies } as Request, { cookie } as unknown as Response, next);
      expect(next).toHaveBeenCalledTimes(1);
      return cookie;
    }

    it('in secure mode issues __Host-aisandbox_csrf unless that name is present', () => {
      process.env.APP_BASE_URL = 'https://staging.ainow.biz';
      process.env.NODE_ENV = 'test';
      const issued = run({ aisandbox_csrf: 'old' });
      expect(issued).toHaveBeenCalledTimes(1);
      expect(issued.mock.calls[0][0]).toBe('__Host-aisandbox_csrf');
      expect(issued.mock.calls[0][1]).toMatch(/^[0-9a-f]{64}$/);
      expect(issued.mock.calls[0][2]).toEqual({ httpOnly: false, secure: true, sameSite: 'lax', path: '/' });
      expect(run({ '__Host-aisandbox_csrf': 'present' })).not.toHaveBeenCalled();
    });

    it('on local http issues aisandbox_csrf exactly as before', () => {
      process.env.APP_BASE_URL = 'http://localhost:3000';
      process.env.NODE_ENV = 'development';
      const issued = run({});
      expect(issued.mock.calls[0][0]).toBe('aisandbox_csrf');
      expect(issued.mock.calls[0][2]).toEqual({ httpOnly: false, secure: false, sameSite: 'lax', path: '/' });
      expect(run({ aisandbox_csrf: 'present' })).not.toHaveBeenCalled();
    });
  });
});
