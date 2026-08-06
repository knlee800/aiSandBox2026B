import {
  GatewayProviderModelValidationError,
  resolveGatewayProviderModelSelection,
} from './provider-model.catalogue';

describe('Gateway provider/model catalogue', () => {
  it('resolves omitted xAI model to grok-4.5', () => {
    const selection = resolveGatewayProviderModelSelection({
      provider: 'xai',
      model: undefined,
    });

    expect(selection.provider).toBe('xai');
    expect(selection.model).toBe('grok-4.5');
  });

  it('accepts xAI grok-4.5 and grok-4.20', () => {
    const modelA = resolveGatewayProviderModelSelection({
      provider: 'xai',
      model: 'grok-4.5',
    });
    const modelB = resolveGatewayProviderModelSelection({
      provider: 'xai',
      model: 'grok-4.20',
    });

    expect(modelA.model).toBe('grok-4.5');
    expect(modelB.model).toBe('grok-4.20');
  });

  it('rejects xAI grok-3', () => {
    expect(() =>
      resolveGatewayProviderModelSelection({
        provider: 'xai',
        model: 'grok-3',
      }),
    ).toThrow(GatewayProviderModelValidationError);
  });

  it('resolves Groq and DeepSeek defaults to approved models', () => {
    const groqSelection = resolveGatewayProviderModelSelection({
      provider: 'groq',
      model: undefined,
    });
    const deepseekSelection = resolveGatewayProviderModelSelection({
      provider: 'deepseek',
      model: undefined,
    });

    expect(groqSelection.model).toBe('openai/gpt-oss-120b');
    expect(deepseekSelection.model).toBe('deepseek-v4-flash');
  });

  it('rejects removed Groq and DeepSeek models', () => {
    expect(() =>
      resolveGatewayProviderModelSelection({
        provider: 'groq',
        model: 'mixtral-8x7b-32768',
      }),
    ).toThrow(GatewayProviderModelValidationError);
    expect(() =>
      resolveGatewayProviderModelSelection({
        provider: 'deepseek',
        model: 'deepseek-chat',
      }),
    ).toThrow(GatewayProviderModelValidationError);
    expect(() =>
      resolveGatewayProviderModelSelection({
        provider: 'deepseek',
        model: 'deepseek-reasoner',
      }),
    ).toThrow(GatewayProviderModelValidationError);
  });

  it('retains OpenAI gpt-4o as the only allowed default', () => {
    const selection = resolveGatewayProviderModelSelection({
      provider: 'openai',
      model: undefined,
    });

    expect(selection.model).toBe('gpt-4o');
  });

  it('resolves Anthropic model from trimmed ANTHROPIC_MODEL value', () => {
    const selection = resolveGatewayProviderModelSelection({
      provider: 'anthropic',
      model: undefined,
      anthropicModel: '  claude-configured  ',
    });

    expect(selection.model).toBe('claude-configured');
  });

  it('rejects Anthropic request model that differs from configured ANTHROPIC_MODEL', () => {
    expect(() =>
      resolveGatewayProviderModelSelection({
        provider: 'anthropic',
        model: 'claude-other',
        anthropicModel: 'claude-configured',
      }),
    ).toThrow(GatewayProviderModelValidationError);
  });

  it('rejects unsupported providers and unknown models', () => {
    expect(() =>
      resolveGatewayProviderModelSelection({
        provider: 'provider-does-not-exist',
        model: undefined,
      }),
    ).toThrow(GatewayProviderModelValidationError);

    expect(() =>
      resolveGatewayProviderModelSelection({
        provider: 'xai',
        model: 'unknown-model',
      }),
    ).toThrow(GatewayProviderModelValidationError);
  });

  it('rejects cross-provider model mismatches', () => {
    expect(() =>
      resolveGatewayProviderModelSelection({
        provider: 'xai',
        model: 'gpt-4o',
      }),
    ).toThrow('Model "gpt-4o" is not valid for provider "xai".');
  });

  it('resolves omitted provider from AI_PROVIDER env when valid', () => {
    const selection = resolveGatewayProviderModelSelection({
      provider: undefined,
      model: undefined,
      fallbackProviderEnv: 'xai',
    });

    expect(selection.provider).toBe('xai');
    expect(selection.model).toBe('grok-4.5');
  });
});
