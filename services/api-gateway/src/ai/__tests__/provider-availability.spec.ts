import {
  PROVIDER_AVAILABILITY_CACHE_MS,
  PROVIDER_AVAILABILITY_IDS,
  ProviderAvailabilityCache,
  applyProviderSwitches,
  parseProviderAvailability,
} from '../provider-availability';
import { KillSwitchConfig } from '../../safety/kill-switch.config';

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

describe('applyProviderSwitches (PROVIDER-SWITCH-01: usable needs key and switch)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const keys = parseProviderAvailability({
    providers: { xai: true, groq: true, deepseek: false, openai: false, anthropic: true },
  })!;

  it('is usable only with a key and the switch on; shape and order unchanged', () => {
    const switchOn = (id: string) => id !== 'groq' && id !== 'openai';
    expect(applyProviderSwitches(keys, switchOn)).toEqual({
      providers: [
        { id: 'xai', usable: true }, // key, switch on
        { id: 'groq', usable: false }, // key, switch off
        { id: 'deepseek', usable: false }, // no key, switch on
        { id: 'openai', usable: false }, // no key, switch off
        { id: 'anthropic', usable: true },
      ],
    });
    for (const entry of applyProviderSwitches(keys, switchOn).providers) {
      expect(Object.keys(entry)).toEqual(['id', 'usable']);
      expect(typeof entry.usable).toBe('boolean');
    }
  });

  it('reads KillSwitchConfig.isProviderEnabled by default, for each provider with a key', () => {
    const spy = jest
      .spyOn(KillSwitchConfig, 'isProviderEnabled')
      .mockImplementation((id: string) => id === 'anthropic');
    expect(applyProviderSwitches(keys).providers.map((entry) => entry.usable)).toEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(spy.mock.calls.map(([id]) => id)).toEqual(['xai', 'groq', 'anthropic']);
  });

  it('counts a non-true switch answer as off', () => {
    const odd = jest.fn((id: string) => (id === 'xai' ? (1 as unknown as boolean) : true));
    expect(applyProviderSwitches(keys, odd).providers[0]).toEqual({ id: 'xai', usable: false });
  });

  it('does not change the answer passed in', () => {
    const before = JSON.parse(JSON.stringify(keys));
    applyProviderSwitches(keys, () => false);
    expect(keys).toEqual(before);
  });
});
