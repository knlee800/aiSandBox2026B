import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { PROVIDER_AVAILABILITY_IDS, parseProviderAvailability } from './provider-availability';

function answer(usable: Record<string, unknown>): unknown {
  return {
    providers: PROVIDER_AVAILABILITY_IDS.map((id) => ({ id, usable: usable[id] ?? false })),
  };
}

describe('PROVIDER-KEY-01 provider availability parser (C4)', () => {
  test('a valid answer gives the usable ids in the fixed order', () => {
    assert.deepEqual(
      parseProviderAvailability(answer({ anthropic: true, groq: true })),
      ['groq', 'anthropic'],
    );
    assert.deepEqual(
      parseProviderAvailability(
        answer({ xai: true, groq: true, deepseek: true, openai: true, anthropic: true }),
      ),
      ['xai', 'groq', 'deepseek', 'openai', 'anthropic'],
    );
  });

  test('keeps the fixed order even when the answer lists ids in another order', () => {
    assert.deepEqual(
      parseProviderAvailability({
        providers: [
          { id: 'anthropic', usable: true },
          { id: 'xai', usable: true },
        ],
      }),
      ['xai', 'anthropic'],
    );
  });

  test('an all-false answer gives an empty list, not null', () => {
    const parsed = parseProviderAvailability(answer({}));
    assert.notEqual(parsed, null);
    assert.deepEqual(parsed, []);
  });

  test('a wrong shape gives null (unknown)', () => {
    assert.equal(parseProviderAvailability(null), null);
    assert.equal(parseProviderAvailability(undefined), null);
    assert.equal(parseProviderAvailability('xai'), null);
    assert.equal(parseProviderAvailability([]), null);
    assert.equal(parseProviderAvailability({}), null);
    assert.equal(parseProviderAvailability({ providers: null }), null);
    assert.equal(parseProviderAvailability({ providers: { xai: true } }), null);
    assert.equal(parseProviderAvailability({ providers: 'xai' }), null);
  });

  test('unknown ids and stub are dropped', () => {
    assert.deepEqual(
      parseProviderAvailability({
        providers: [
          { id: 'stub', usable: true },
          { id: 'mistral', usable: true },
          { id: 'XAI', usable: true },
          { id: 'openai', usable: true },
        ],
      }),
      ['openai'],
    );
  });

  test('a non-boolean usable value counts as not usable', () => {
    assert.deepEqual(
      parseProviderAvailability({
        providers: [
          { id: 'xai', usable: 'true' },
          { id: 'groq', usable: 1 },
          { id: 'deepseek', usable: null },
          { id: 'openai' },
          { id: 'anthropic', usable: true },
        ],
      }),
      ['anthropic'],
    );
  });

  test('entries that are not objects are dropped', () => {
    assert.deepEqual(
      parseProviderAvailability({
        providers: ['xai', null, 7, ['groq'], { id: 'deepseek', usable: true }],
      }),
      ['deepseek'],
    );
  });
});
