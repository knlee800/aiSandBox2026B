/**
 * PROVIDER-KEY-01: which AI providers can run, as the AI service reports it.
 *
 * C3 (AI service, internal key):
 *   { "providers": { "xai": bool, "groq": bool, "deepseek": bool, "openai": bool, "anthropic": bool } }
 * C4 (gateway, signed in):
 *   { "providers": [ { "id": "xai", "usable": bool }, ...groq, deepseek, openai, anthropic ] }
 *
 * Booleans only. No key value, length, prefix or variable name is read or
 * passed on. Stub is never listed.
 */

export const PROVIDER_AVAILABILITY_IDS = [
  'xai',
  'groq',
  'deepseek',
  'openai',
  'anthropic',
] as const;
export type ProviderAvailabilityId = (typeof PROVIDER_AVAILABILITY_IDS)[number];

export interface ProviderAvailabilityAnswer {
  providers: Array<{ id: ProviderAvailabilityId; usable: boolean }>;
}

export const PROVIDER_AVAILABILITY_CACHE_MS = 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Parses a C3 answer into C4. Returns null when the answer is malformed or
 * names fewer than the five providers. A present but non-boolean value counts
 * as not usable. Extra providers are ignored.
 */
export function parseProviderAvailability(raw: unknown): ProviderAvailabilityAnswer | null {
  if (!isRecord(raw)) {
    return null;
  }
  const providers = raw.providers;
  if (!isRecord(providers)) {
    return null;
  }
  const list: ProviderAvailabilityAnswer['providers'] = [];
  for (const id of PROVIDER_AVAILABILITY_IDS) {
    if (!Object.prototype.hasOwnProperty.call(providers, id)) {
      return null;
    }
    list.push({ id, usable: providers[id] === true });
  }
  return { providers: list };
}

function copyAnswer(answer: ProviderAvailabilityAnswer): ProviderAvailabilityAnswer {
  return { providers: answer.providers.map((entry) => ({ ...entry })) };
}

/**
 * Keeps a good answer for 60 seconds (keys change only when the AI service
 * restarts). A failed or malformed answer is not cached and gives null.
 */
export class ProviderAvailabilityCache {
  private cached: { answer: ProviderAvailabilityAnswer; at: number } | null = null;

  constructor(
    private readonly fetchAvailability: () => Promise<unknown>,
    private readonly ttlMs: number = PROVIDER_AVAILABILITY_CACHE_MS,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async read(): Promise<ProviderAvailabilityAnswer | null> {
    const current = this.now();
    if (this.cached && current - this.cached.at < this.ttlMs) {
      return copyAnswer(this.cached.answer);
    }
    let raw: unknown;
    try {
      raw = await this.fetchAvailability();
    } catch {
      return null;
    }
    const answer = parseProviderAvailability(raw);
    if (!answer) {
      return null;
    }
    this.cached = { answer, at: current };
    return copyAnswer(answer);
  }
}
