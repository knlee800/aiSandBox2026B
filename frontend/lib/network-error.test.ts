import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { isNetworkFailure } from './network-error';

describe('isNetworkFailure', () => {
  for (const text of [
    'Failed to fetch',
    'NetworkError when attempting to fetch resource.',
    'Load failed',
    'fetch failed',
    'Network request failed',
  ]) {
    test(`recognises the fetch failure text "${text}"`, () => {
      assert.equal(isNetworkFailure(new TypeError(text)), true);
    });
  }

  test('is case-insensitive', () => {
    assert.equal(isNetworkFailure(new TypeError('FAILED TO FETCH')), true);
  });

  test('does not match a TypeError thrown by code', () => {
    assert.equal(isNetworkFailure(new TypeError('x is not a function')), false);
  });

  test('does not match a plain Error with a fetch failure text', () => {
    assert.equal(isNetworkFailure(new Error('Failed to fetch')), false);
  });

  test('does not match an AbortError or TimeoutError', () => {
    assert.equal(isNetworkFailure(new DOMException('aborted', 'AbortError')), false);
    assert.equal(isNetworkFailure(new DOMException('slow', 'TimeoutError')), false);
  });

  test('does not match a string, null or undefined', () => {
    assert.equal(isNetworkFailure('Failed to fetch'), false);
    assert.equal(isNetworkFailure(null), false);
    assert.equal(isNetworkFailure(undefined), false);
  });
});
