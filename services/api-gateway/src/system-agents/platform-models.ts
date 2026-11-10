import type { GatewayAIProvider } from '../ai/provider-model.catalogue';

/**
 * AGENT-SPEC-01: the models an agent may name with `model: { choice: 'platform' }`.
 *
 * v1 is the four Anthropic ids of the gateway catalogue
 * (provider-model.catalogue.ts). Every model costs the same today: the
 * `model_tokens` credit rate (credit-rates.config.ts), 1 credit per 1K tokens.
 * platform-models.spec.ts checks both against those files.
 *
 * Nothing applies a platform model to a run yet; runs take provider and model
 * from the server env.
 */
export const PLATFORM_MODEL_IDS = [
  'claude-opus-5-5',
  'claude-sonnet-5-5',
  'claude-fable-5-1',
  'claude-haiku-5-5',
] as const;
export type PlatformModelId = (typeof PLATFORM_MODEL_IDS)[number];

export interface PlatformModel {
  readonly id: PlatformModelId;
  readonly provider: GatewayAIProvider;
  readonly creditsPer1kTokens: number;
}

export const PLATFORM_MODELS: readonly PlatformModel[] = Object.freeze(
  PLATFORM_MODEL_IDS.map((id) =>
    Object.freeze({ id, provider: 'anthropic' as const, creditsPer1kTokens: 1 }),
  ),
);

export function isPlatformModelId(value: unknown): value is PlatformModelId {
  return typeof value === 'string' && (PLATFORM_MODEL_IDS as readonly string[]).includes(value);
}
