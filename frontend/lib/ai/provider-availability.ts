/**
 * PROVIDER-KEY-01 (contract C4): which AI providers can run.
 *
 * GET /api/ai/providers answers
 *   { "providers": [ { "id": "xai", "usable": bool }, ...groq, deepseek, openai, anthropic ] }
 *
 * The parser returns the usable provider ids, or null when the answer is not
 * in that shape (null means unknown: the page behaves as before). An answer
 * where nothing is usable gives an empty list, not null.
 */

export const PROVIDER_AVAILABILITY_IDS = [
  'xai',
  'groq',
  'deepseek',
  'openai',
  'anthropic',
] as const;

export type ProviderAvailabilityId = (typeof PROVIDER_AVAILABILITY_IDS)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isKnownProviderId(value: unknown): value is ProviderAvailabilityId {
  return (
    typeof value === 'string' &&
    (PROVIDER_AVAILABILITY_IDS as readonly string[]).includes(value)
  );
}

/**
 * Strict C4 parse.
 *
 * - Not an object, or `providers` not an array: null.
 * - An entry that is not an object or has an unknown id: dropped.
 * - `usable` other than exactly true: not usable.
 * - The result keeps the C4 order and holds each id at most once.
 */
export function parseProviderAvailability(raw: unknown): ProviderAvailabilityId[] | null {
  if (!isRecord(raw)) {
    return null;
  }
  const providers = raw.providers;
  if (!Array.isArray(providers)) {
    return null;
  }
  const usable = new Set<ProviderAvailabilityId>();
  for (const entry of providers) {
    if (!isRecord(entry) || !isKnownProviderId(entry.id)) {
      continue;
    }
    if (entry.usable === true) {
      usable.add(entry.id);
    }
  }
  return PROVIDER_AVAILABILITY_IDS.filter((id) => usable.has(id));
}
