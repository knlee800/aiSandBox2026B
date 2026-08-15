import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, describe, test } from 'node:test';

const require = createRequire(import.meta.url);
const originalApiGatewayUrl = process.env.API_GATEWAY_URL;

afterEach(() => {
  if (originalApiGatewayUrl === undefined) {
    delete process.env.API_GATEWAY_URL;
  } else {
    process.env.API_GATEWAY_URL = originalApiGatewayUrl;
  }
});

type GatewayRewrite = {
  source: string;
  destination: string;
};

type FallbackRewrites = {
  fallback: GatewayRewrite[];
};

function isFallbackRewrites(value: unknown): value is FallbackRewrites {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Array.isArray((value as FallbackRewrites).fallback)
  );
}

async function loadRewrites() {
  const nextConfig = require('../next.config.js') as {
    rewrites: () => Promise<unknown>;
  };
  return nextConfig.rewrites();
}

describe('PRIVATE-BETA-BLOCKER-03G next.config rewrites fallback phase', () => {
  test('rewrites() returns a fallback object, not a flat array', async () => {
    const result = await loadRewrites();

    assert.equal(Array.isArray(result), false, 'must not return the previous flat-array form');
    assert.equal(isFallbackRewrites(result), true);
  });

  test('fallback contains the existing /api/:path* Gateway proxy rule', async () => {
    delete process.env.API_GATEWAY_URL;
    const result = await loadRewrites();

    assert.equal(isFallbackRewrites(result), true);
    if (!isFallbackRewrites(result)) {
      return;
    }

    assert.equal(result.fallback.length, 1);
    assert.equal(result.fallback[0].source, '/api/:path*');
    assert.equal(
      result.fallback[0].destination,
      'http://localhost:4000/api/:path*',
    );
  });

  test('Gateway destination uses API_GATEWAY_URL when set', async () => {
    process.env.API_GATEWAY_URL = 'http://gateway.test:4000';
    const result = await loadRewrites();

    assert.equal(isFallbackRewrites(result), true);
    if (!isFallbackRewrites(result)) {
      return;
    }

    assert.equal(result.fallback[0].source, '/api/:path*');
    assert.equal(
      result.fallback[0].destination,
      'http://gateway.test:4000/api/:path*',
    );
  });
});
