import {
  GatewayProviderModelValidationError,
  resolveGatewayProviderModelSelection,
} from '../ai/provider-model.catalogue';
import { CREDIT_RATES } from '../credit-ledger/config/credit-rates.config';
import { PLATFORM_MODELS, PLATFORM_MODEL_IDS, isPlatformModelId } from './platform-models';

function modelTokensRate(): number {
  const rate = CREDIT_RATES.find((entry) => entry.category === 'model_tokens');
  if (!rate) {
    throw new Error('model_tokens credit rate is missing');
  }
  expect(rate.unit).toBe('1K_tokens');
  return rate.creditsPerUnit;
}

describe('AGENT-SPEC-01 platform model list', () => {
  it('lists the four Anthropic catalogue ids', () => {
    expect(PLATFORM_MODELS.map((model) => model.id)).toEqual([
      'claude-opus-5-5',
      'claude-sonnet-5-5',
      'claude-fable-5-1',
      'claude-haiku-5-5',
    ]);
    expect(PLATFORM_MODELS.map((model) => model.id)).toEqual([...PLATFORM_MODEL_IDS]);
    expect(PLATFORM_MODELS.every((model) => model.provider === 'anthropic')).toBe(true);
    expect(Object.isFrozen(PLATFORM_MODELS)).toBe(true);
    expect(PLATFORM_MODELS.every((model) => Object.isFrozen(model))).toBe(true);
  });

  it('every id is an allowed model of its provider in the gateway catalogue', () => {
    for (const model of PLATFORM_MODELS) {
      // No ANTHROPIC_MODEL: only a catalogue-allowed model resolves.
      expect(
        resolveGatewayProviderModelSelection({
          provider: model.provider,
          model: model.id,
          anthropicModel: undefined,
        }),
      ).toEqual({ provider: model.provider, model: model.id, defaultModelSource: 'source' });
    }
    // The same check refuses a model the catalogue does not allow.
    expect(() =>
      resolveGatewayProviderModelSelection({
        provider: 'anthropic',
        model: 'claude-not-a-model',
        anthropicModel: undefined,
      }),
    ).toThrow(GatewayProviderModelValidationError);
  });

  it('every model costs the model_tokens credit rate per 1K tokens', () => {
    const rate = modelTokensRate();
    expect(rate).toBe(1);
    for (const model of PLATFORM_MODELS) {
      expect(model.creditsPer1kTokens).toBe(rate);
    }
  });

  it('isPlatformModelId accepts only the listed ids', () => {
    for (const id of PLATFORM_MODEL_IDS) {
      expect(isPlatformModelId(id)).toBe(true);
    }
    for (const value of ['gpt-4o', 'grok-4.7', 'stub', 'CLAUDE-OPUS-5-5', '', null, undefined, 5, {}]) {
      expect(isPlatformModelId(value)).toBe(false);
    }
  });
});
