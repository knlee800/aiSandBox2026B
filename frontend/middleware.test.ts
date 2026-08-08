import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { NextRequest } from 'next/server';
import { middleware } from './middleware';

type RequestOptions = {
  origin?: string;
  forwardedHost?: string;
  forwardedProto?: string;
};

function createRequest(pathnameWithSearch: string, options: RequestOptions = {}): NextRequest {
  const origin = options.origin ?? 'http://localhost:3002';
  const headers = new Headers();

  if (options.forwardedHost) {
    headers.set('x-forwarded-host', options.forwardedHost);
  }
  if (options.forwardedProto) {
    headers.set('x-forwarded-proto', options.forwardedProto);
  }

  return {
    nextUrl: new URL(pathnameWithSearch, origin),
    headers,
  } as unknown as NextRequest;
}

function runMiddleware(pathnameWithSearch: string, options: RequestOptions = {}) {
  return middleware(createRequest(pathnameWithSearch, options));
}

function expectPassThrough(pathnameWithSearch: string) {
  const response = runMiddleware(pathnameWithSearch);
  assert.equal(response.headers.get('location'), null);
}

function expectRedirect(
  pathnameWithSearch: string,
  expectedLocation: string,
  options: RequestOptions = {},
) {
  const response = runMiddleware(pathnameWithSearch, options);
  assert.equal(response.headers.get('location'), expectedLocation);
}

describe('middleware locale and redirect behavior', () => {
  test('/en/login passes through', () => {
    expectPassThrough('/en/login');
  });

  test('/zh-TW/login passes through', () => {
    expectPassThrough('/zh-TW/login');
  });

  test('/zh-CN/login passes through', () => {
    expectPassThrough('/zh-CN/login');
  });

  test('/zh-tw/login normalizes to canonical locale and keeps public proxy origin', () => {
    expectRedirect('/zh-tw/login', 'https://staging.ainow.biz/zh-TW/login', {
      forwardedHost: 'staging.ainow.biz',
      forwardedProto: 'https',
    });
  });

  test('/ZH-tw/login normalizes to canonical /zh-TW/login', () => {
    expectRedirect('/ZH-tw/login', 'http://localhost:3002/zh-TW/login');
  });

  test('/zh-cn/login normalizes to canonical /zh-CN/login', () => {
    expectRedirect('/zh-cn/login', 'http://localhost:3002/zh-CN/login');
  });

  test('query string is preserved when locale is normalized', () => {
    expectRedirect('/zh-tw/login?next=%2Fapp', 'http://localhost:3002/zh-TW/login?next=%2Fapp');
  });

  test('/login adds default locale with public proxy origin', () => {
    expectRedirect('/login', 'https://staging.ainow.biz/en/login', {
      forwardedHost: 'staging.ainow.biz',
      forwardedProto: 'https',
    });
  });

  test('/fr/login keeps existing fallback semantics', () => {
    expectRedirect('/fr/login', 'https://staging.ainow.biz/en/fr/login', {
      forwardedHost: 'staging.ainow.biz',
      forwardedProto: 'https',
    });
  });

  test('redirect does not include localhost when valid public proxy headers exist', () => {
    const response = runMiddleware('/zh-tw/login', {
      forwardedHost: 'staging.ainow.biz',
      forwardedProto: 'https',
    });
    const location = response.headers.get('location');
    assert.ok(location);
    assert.equal(location.includes('localhost:3002'), false);
  });

  test('local development without forwarded headers keeps localhost redirect behavior', () => {
    expectRedirect('/login', 'http://localhost:3002/en/login');
  });
});

describe('middleware skip rules', () => {
  test('/api/health passes through', () => {
    expectPassThrough('/api/health');
  });

  test('/_next/static chunk passes through', () => {
    expectPassThrough('/_next/static/chunks/app.js');
  });

  test('favicon and file-extension static paths pass through', () => {
    expectPassThrough('/favicon.ico');
    expectPassThrough('/robots.txt');
  });
});

describe('middleware forwarded header safety', () => {
  test('rejects malformed forwarded host values containing paths', () => {
    expectRedirect('/login', 'http://localhost:3002/en/login', {
      forwardedHost: 'evil.example/path',
      forwardedProto: 'https',
    });
  });

  test('rejects comma-separated forwarded host values', () => {
    expectRedirect('/login', 'http://localhost:3002/en/login', {
      forwardedHost: 'evil.example, attacker.example',
      forwardedProto: 'https',
    });
  });

  test('rejects unsupported forwarded proto values', () => {
    expectRedirect('/login', 'http://staging.ainow.biz/en/login', {
      forwardedHost: 'staging.ainow.biz',
      forwardedProto: 'javascript',
    });
  });
});
