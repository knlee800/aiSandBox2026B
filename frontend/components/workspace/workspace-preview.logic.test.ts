import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildPreviewProxyUrl, isPreviewRunning } from './workspace-preview.logic';

describe('workspace preview logic', () => {
  test('identifies running preview status deterministically', () => {
    assert.equal(isPreviewRunning({ running: true }), true);
    assert.equal(isPreviewRunning({ running: false }), false);
    assert.equal(isPreviewRunning({}), false);
  });

  test('builds session-scoped preview proxy URL with refresh token', () => {
    const url = buildPreviewProxyUrl('session-123', 42);
    assert.equal(url, '/api/preview/session-123/proxy?refresh=42');
  });

  test('encodes special characters in session id', () => {
    const url = buildPreviewProxyUrl('session/with spaces', 99);
    assert.equal(url, '/api/preview/session%2Fwith%20spaces/proxy?refresh=99');
  });
});
