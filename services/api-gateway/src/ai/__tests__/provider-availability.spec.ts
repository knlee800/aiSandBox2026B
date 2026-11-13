import {
  PROVIDER_AVAILABILITY_CACHE_MS,
  PROVIDER_AVAILABILITY_IDS,
  ProviderAvailabilityCache,
  parseProviderAvailability,
} from '../provider-availability';

const allTrue = {
  providers: { xai: true, groq: true, deepseek: true, openai: true, anthropic: true },
};

describe('parseProviderAvailability (PROVIDER-KEY-01 C3 to C4)', () => {
  it('builds C4 in the fixed order whatever the C3 key order', () => {
    expect(
      parseProviderAvailability({
        providers: { anthropic: true, openai: false, deepseek: false, groq: true, xai: false },
      }),
    ).toEqual({
      providers: [
        { id: 'xai', usable: false },
        { id: 'groq', usable: true },
        { id: 'deepseek', usable: false },
        { id: 'openai', usable: false },
        { id: 'anthropic', usable: true },
      ],
    });
    expect(PROVIDER_AVAILABILITY_IDS).toEqual(['xai', 'groq', 'deepseek', 'openai', 'anthropic']);
  });

  it('counts a non-boolean value as not usable', () => {
    const answer = parseProviderAvailability({
      providers: { xai: 'true', groq: 1, deepseek: null, openai: { ok: true }, anthropic: true },
    });
    expect(answer?.providers.map((entry) => entry.usable)).toEqual([false, false, false, false, true]);
    for (const entry of answer?.providers ?? []) {
      expect(typeof entry.usable).toBe('boolean');
      expect(Object.keys(entry)).toEqual(['id', 'usable']);
    }
  });

  it('ignores extra providers such as stub', () => {
    const answer = parseProviderAvailability({
      providers: { ...allTrue.providers, stub: true, 'test-harness-stub': true },
    });
    expect(answer?.providers.map((entry) => entry.id)).toEqual([...PROVIDER_AVAILABILITY_IDS]);
  });

  it('returns null for a partial or malformed answer', () => {
    const partial = { providers: { xai: true, groq: true, deepseek: true, openai: true } };
    for (const raw of [
      partial,
      { providers: [] },
      { providers: 'xai' },
      { providers: null },
      {},
      [],
      null,
      undefined,
      'ok',
    ]) {
      expect(parseProviderAvailability(raw)).toBeNull();
    }
  });
});

describe('ProviderAvailabilityCache (PROVIDER-KEY-01)', () => {
  it('keeps a good answer for 60 seconds and reads again after', async () => {
    let now = 1_000_000;
    const fetch = jest.fn().mockResolvedValue(allTrue);
    const cache = new ProviderAvailabilityCache(fetch, PROVIDER_AVAILABILITY_CACHE_MS, () => now);

    expect(PROVIDER_AVAILABILITY_CACHE_MS).toBe(60_000);
    expect(await cache.read()).not.toBeNull();
    now += 59_999;
    expect(await cache.read()).not.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    now += 1;
    expect(await cache.read()).not.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failure or a malformed answer', async () => {
    const fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockResolvedValueOnce({ providers: { xai: true } })
      .mockResolvedValueOnce(allTrue);
    const cache = new ProviderAvailabilityCache(fetch, PROVIDER_AVAILABILITY_CACHE_MS, () => 5);

    expect(await cache.read()).toBeNull();
    expect(await cache.read()).toBeNull();
    expect(await cache.read()).not.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(await cache.read()).not.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('hands out copies, so a caller cannot change the cached answer', async () => {
    const cache = new ProviderAvailabilityCache(jest.fn().mockResolvedValue(allTrue));
    const first = await cache.read();
    first!.providers[0].usable = false;
    first!.providers.pop();
    const second = await cache.read();
    expect(second?.providers).toHaveLength(5);
    expect(second?.providers[0]).toEqual({ id: 'xai', usable: true });
  });
});
