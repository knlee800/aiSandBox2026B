import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { computePublicLandingState } from './public-landing-slice.logic';

describe('public landing slice logic', () => {
  test('returns loading while hydrating', () => {
    assert.equal(
      computePublicLandingState({
        isHydrating: true,
        initError: null,
        hasAccessToken: false,
      }),
      'loading',
    );
  });

  test('returns error when initialization fails', () => {
    assert.equal(
      computePublicLandingState({
        isHydrating: false,
        initError: 'failed',
        hasAccessToken: false,
      }),
      'error',
    );
  });

  test('returns empty for anonymous public visitors', () => {
    assert.equal(
      computePublicLandingState({
        isHydrating: false,
        initError: null,
        hasAccessToken: false,
      }),
      'empty',
    );
  });

  test('returns ready when signed-in token is present', () => {
    assert.equal(
      computePublicLandingState({
        isHydrating: false,
        initError: null,
        hasAccessToken: true,
      }),
      'ready',
    );
  });
});
