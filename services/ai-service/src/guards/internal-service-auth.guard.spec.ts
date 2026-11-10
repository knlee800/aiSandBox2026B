// The real module object (not an import-star copy), so jest can spy on it.
import crypto = require('crypto');
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InternalKeyExempt } from './internal-key-exempt.decorator';
import { InternalServiceAuthGuard, internalKeyMatches } from './internal-service-auth.guard';

const testKey = 'ai-service-auth-01-test-key';
const sameLengthWrongKey = 'ai-service-auth-01-test-kez';
const wrongLengthKey = 'ai-service-auth-01-test-key-longer';

class FakeController {
  guarded() {
    return 'guarded';
  }

  @InternalKeyExempt()
  open() {
    return 'open';
  }
}

@InternalKeyExempt()
class ClassMarkedController {
  handler() {
    return 'handler';
  }
}

function context(
  handler: (...args: unknown[]) => unknown,
  headers: Record<string, unknown>,
  type: string = 'http',
): ExecutionContext {
  return {
    getType: () => type,
    getHandler: () => handler,
    getClass: () => FakeController,
    switchToHttp: () => ({
      getRequest: () => ({ headers, method: 'GET', path: '/api/test' }),
    }),
  } as unknown as ExecutionContext;
}

describe('internalKeyMatches (AI-SERVICE-AUTH-01 D5)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is true for the equal key', () => {
    expect(internalKeyMatches(testKey, testKey)).toBe(true);
  });

  it('is false for a same-length wrong key', () => {
    expect(sameLengthWrongKey.length).toBe(testKey.length);
    expect(internalKeyMatches(sameLengthWrongKey, testKey)).toBe(false);
  });

  it('is false for a different length', () => {
    expect(internalKeyMatches(wrongLengthKey, testKey)).toBe(false);
    expect(internalKeyMatches(testKey.slice(0, -1), testKey)).toBe(false);
  });

  it('is false for empty, undefined, null, numbers and arrays', () => {
    expect(internalKeyMatches('', testKey)).toBe(false);
    expect(internalKeyMatches(testKey, '')).toBe(false);
    expect(internalKeyMatches('', '')).toBe(false);
    expect(internalKeyMatches(undefined, testKey)).toBe(false);
    expect(internalKeyMatches(testKey, undefined)).toBe(false);
    expect(internalKeyMatches(null, testKey)).toBe(false);
    expect(internalKeyMatches(123, '123')).toBe(false);
    expect(internalKeyMatches([testKey], testKey)).toBe(false);
    expect(internalKeyMatches([testKey, testKey], testKey)).toBe(false);
  });

  it('compares multi-byte keys by bytes', () => {
    expect(internalKeyMatches('kéy', 'kéy')).toBe(true);
    // Same string length, different UTF-8 byte length.
    expect(internalKeyMatches('kéy', 'key')).toBe(false);
  });

  it('calls crypto.timingSafeEqual when the lengths are equal', () => {
    const spy = jest.spyOn(crypto, 'timingSafeEqual');
    expect(internalKeyMatches(sameLengthWrongKey, testKey)).toBe(false);
    expect(internalKeyMatches(testKey, testKey)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('does not call crypto.timingSafeEqual when the lengths differ', () => {
    const spy = jest.spyOn(crypto, 'timingSafeEqual');
    expect(internalKeyMatches(wrongLengthKey, testKey)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('InternalServiceAuthGuard (AI-SERVICE-AUTH-01 D3)', () => {
  const originalKey = process.env.INTERNAL_SERVICE_KEY;
  const reflector = new Reflector();
  const controller = new FakeController();

  beforeEach(() => {
    process.env.INTERNAL_SERVICE_KEY = testKey;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.INTERNAL_SERVICE_KEY;
    } else {
      process.env.INTERNAL_SERVICE_KEY = originalKey;
    }
  });

  it('refuses a request with no header', () => {
    const guard = new InternalServiceAuthGuard(reflector);
    expect(() => guard.canActivate(context(controller.guarded, {}))).toThrow(
      UnauthorizedException,
    );
  });

  it('refuses a wrong key', () => {
    const guard = new InternalServiceAuthGuard(reflector);
    expect(() =>
      guard.canActivate(
        context(controller.guarded, { 'x-internal-service-key': sameLengthWrongKey }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('refuses a key of the wrong length', () => {
    const guard = new InternalServiceAuthGuard(reflector);
    expect(() =>
      guard.canActivate(
        context(controller.guarded, { 'x-internal-service-key': wrongLengthKey }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('refuses a header sent twice (array) even when both copies are right', () => {
    const guard = new InternalServiceAuthGuard(reflector);
    expect(() =>
      guard.canActivate(
        context(controller.guarded, { 'x-internal-service-key': [testKey, testKey] }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('refuses a header sent twice and joined by Node', () => {
    const guard = new InternalServiceAuthGuard(reflector);
    expect(() =>
      guard.canActivate(
        context(controller.guarded, { 'x-internal-service-key': `${testKey}, ${testKey}` }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('refuses everything guarded when INTERNAL_SERVICE_KEY is unset', () => {
    delete process.env.INTERNAL_SERVICE_KEY;
    const guard = new InternalServiceAuthGuard(reflector);
    expect(() =>
      guard.canActivate(context(controller.guarded, { 'x-internal-service-key': testKey })),
    ).toThrow(UnauthorizedException);
    expect(() =>
      guard.canActivate(context(controller.guarded, { 'x-internal-service-key': '' })),
    ).toThrow(UnauthorizedException);
  });

  it('accepts the right key', () => {
    const guard = new InternalServiceAuthGuard(reflector);
    expect(
      guard.canActivate(context(controller.guarded, { 'x-internal-service-key': testKey })),
    ).toBe(true);
  });

  it('opens an exempt handler with no key, even when the key is unset', () => {
    expect(new InternalServiceAuthGuard(reflector).canActivate(context(controller.open, {}))).toBe(
      true,
    );
    delete process.env.INTERNAL_SERVICE_KEY;
    expect(new InternalServiceAuthGuard(reflector).canActivate(context(controller.open, {}))).toBe(
      true,
    );
  });

  it('does not open a handler because its class carries the mark', () => {
    const guard = new InternalServiceAuthGuard(reflector);
    const marked = new ClassMarkedController();
    expect(() => guard.canActivate(context(marked.handler, {}))).toThrow(UnauthorizedException);
  });

  it('refuses a non-HTTP context for a guarded handler', () => {
    const guard = new InternalServiceAuthGuard(reflector);
    expect(() =>
      guard.canActivate(
        context(controller.guarded, { 'x-internal-service-key': testKey }, 'rpc'),
      ),
    ).toThrow(UnauthorizedException);
  });
});
