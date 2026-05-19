import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { detectAuthModuleIntent } from './auth-module-intent';

describe('auth module intent detection', () => {
  test('returns true for "add authentication"', () => {
    assert.equal(detectAuthModuleIntent('add authentication'), true);
  });

  test('returns true for "add login"', () => {
    assert.equal(detectAuthModuleIntent('add login'), true);
  });

  test('returns true for "add signup"', () => {
    assert.equal(detectAuthModuleIntent('add signup'), true);
  });

  test('returns true for "add Auth.js"', () => {
    assert.equal(detectAuthModuleIntent('add Auth.js'), true);
  });

  test('returns true for "add NextAuth"', () => {
    assert.equal(detectAuthModuleIntent('add NextAuth'), true);
  });

  test('returns true for "add user accounts"', () => {
    assert.equal(detectAuthModuleIntent('add user accounts'), true);
  });

  test('returns true for "set up authentication for my app"', () => {
    assert.equal(detectAuthModuleIntent('set up authentication for my app'), true);
  });

  test('returns false for "explain authentication"', () => {
    assert.equal(detectAuthModuleIntent('explain authentication'), false);
  });

  test('returns false for "how does auth work"', () => {
    assert.equal(detectAuthModuleIntent('how does auth work'), false);
  });

  test('returns false for "what is Auth.js"', () => {
    assert.equal(detectAuthModuleIntent('what is Auth.js'), false);
  });

  test('returns false for "authentication"', () => {
    assert.equal(detectAuthModuleIntent('authentication'), false);
  });

  test('returns false for "add a comment"', () => {
    assert.equal(detectAuthModuleIntent('add a comment'), false);
  });

  test('returns false for empty string', () => {
    assert.equal(detectAuthModuleIntent(''), false);
  });
});
