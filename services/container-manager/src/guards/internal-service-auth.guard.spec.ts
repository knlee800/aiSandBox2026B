import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { InternalServiceAuthGuard, internalKeyMatches } from './internal-service-auth.guard';
// The real module object (not an import-star copy), so jest can spy on it.
import crypto = require('crypto');

const testKey = 'cm-auth-01-test-key';
const sameLengthWrongKey = 'cm-auth-01-test-kez';
const longerKey = 'cm-auth-01-test-key-longer';

function contextFor(value: unknown, present = true): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: present ? { 'x-internal-service-key': value } : {},
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('internalKeyMatches (AI-SERVICE-AUTH-01 D5, container-manager)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is true for the equal key', () => {
    expect(internalKeyMatches(testKey, testKey)).toBe(true);
  });

  it('is false for a same-length wrong key', () => {
    expect(sameLengthWrongKey.length).toBe(testKey.length);
    expect(internalKeyMatches(sameLengthWrongKey, testKey)).toBe(false);
  });

  it('is false for a different length', () => {
    expect(internalKeyMatches(longerKey, testKey)).toBe(false);
    expect(internalKeyMatches(testKey.slice(0, -1), testKey)).toBe(false);
  });

  it('is false for empty, undefined, null, numbers and arrays', () => {
    expect(internalKeyMatches('', testKey)).toBe(false);
    expect(internalKeyMatches(testKey, '')).toBe(false);
    expect(internalKeyMatches(undefined, testKey)).toBe(false);
    expect(internalKeyMatches(null, testKey)).toBe(false);
    expect(internalKeyMatches(123, '123')).toBe(false);
    expect(internalKeyMatches([testKey], testKey)).toBe(false);
    expect(internalKeyMatches([testKey, testKey], testKey)).toBe(false);
  });

  it('calls crypto.timingSafeEqual when the lengths are equal', () => {
    const spy = jest.spyOn(crypto, 'timingSafeEqual');
    expect(internalKeyMatches(sameLengthWrongKey, testKey)).toBe(false);
    expect(internalKeyMatches(testKey, testKey)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('does not call crypto.timingSafeEqual when the lengths differ', () => {
    const spy = jest.spyOn(crypto, 'timingSafeEqual');
    expect(internalKeyMatches(longerKey, testKey)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('InternalServiceAuthGuard (container-manager, AI-SERVICE-AUTH-01)', () => {
  const originalKey = process.env.INTERNAL_SERVICE_KEY;

  beforeEach(() => {
    process.env.INTERNAL_SERVICE_KEY = testKey;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.INTERNAL_SERVICE_KEY;
    } else {
      process.env.INTERNAL_SERVICE_KEY = originalKey;
    }
    jest.restoreAllMocks();
  });

  it('still refuses to construct without INTERNAL_SERVICE_KEY', () => {
    delete process.env.INTERNAL_SERVICE_KEY;
    expect(() => new InternalServiceAuthGuard()).toThrow(/INTERNAL_SERVICE_KEY/);
  });

  it('refuses a missing or empty header with 403', () => {
    const guard = new InternalServiceAuthGuard();
    expect(() => guard.canActivate(contextFor(undefined, false))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor(''))).toThrow(ForbiddenException);
  });

  it('refuses a same-length wrong key', () => {
    const guard = new InternalServiceAuthGuard();
    expect(() => guard.canActivate(contextFor(sameLengthWrongKey))).toThrow(ForbiddenException);
  });

  it('refuses a key of the wrong length', () => {
    const guard = new InternalServiceAuthGuard();
    expect(() => guard.canActivate(contextFor(longerKey))).toThrow(ForbiddenException);
  });

  it('refuses a header sent twice, as an array or joined by Node', () => {
    const guard = new InternalServiceAuthGuard();
    expect(() => guard.canActivate(contextFor([testKey, testKey]))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor(`${testKey}, ${testKey}`))).toThrow(
      ForbiddenException,
    );
  });

  it('accepts the right key through crypto.timingSafeEqual', () => {
    const spy = jest.spyOn(crypto, 'timingSafeEqual');
    const guard = new InternalServiceAuthGuard();
    expect(guard.canActivate(contextFor(testKey))).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
