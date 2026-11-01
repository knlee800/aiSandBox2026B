import {
  GatewayProviderModelValidationError,
  XAI_RECOGNIZED_MODELS,
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

  it('accepts xAI grok-4.5 and grok-4.7 and rejects grok-4.20 for new execution', () => {
    const modelA = resolveGatewayProviderModelSelection({
      provider: 'xai',
      model: 'grok-4.5',
    });
    const modelB = resolveGatewayProviderModelSelection({
      provider: 'xai',
      model: 'grok-4.7',
    });

    expect(modelA.model).toBe('grok-4.5');
    expect(modelB.model).toBe('grok-4.7');
    expect(XAI_RECOGNIZED_MODELS).toContain('grok-4.7');
    expect(XAI_RECOGNIZED_MODELS).toContain('grok-4.20');
    expect(() =>
      resolveGatewayProviderModelSelection({
        provider: 'xai',
        model: 'grok-4.20',
      }),
    ).toThrow(GatewayProviderModelValidationError);
  });

  it('can still represent historical grok-4.20 execution metadata', () => {
    const historicalMetadata = {
      requestedModel: 'grok-4.20',
      aiExecutionResult: { model: 'grok-4.20' },
    };

    expect(XAI_RECOGNIZED_MODELS).toContain(historicalMetadata.requestedModel);
    expect(historicalMetadata.requestedModel).toBe('grok-4.20');
    expect(historicalMetadata.aiExecutionResult.model).toBe('grok-4.20');
  });

  it('rejects xAI grok-3', () => {
    expect(() =>
      resolveGatewayProviderModelSelection({
        provider: 'xai',
        model: 'grok-3',
      }),
    ).toThrow(GatewayProviderModelValidationError);
  });

  it('does not substitute grok-4.5 when grok-4.20 is requested', () => {
    try {
      resolveGatewayProviderModelSelection({
        provider: 'xai',
        model: 'grok-4.20',
      });
      fail('expected grok-4.20 to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(GatewayProviderModelValidationError);
      expect((error as GatewayProviderModelValidationError).code).toBe(
        'invalid_model',
      );
      expect((error as GatewayProviderModelValidationError).model).toBe(
        'grok-4.20',
      );
      expect((error as Error).message).toContain('grok-4.20');
      expect((error as Error).message).not.toContain('grok-4.5');
    }
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
    expect(deepseekSelection.model).toBe('deepseek-flash');
  });

  it('accepts deepseek-flash, deepseek-v4-pro and deepseek-v4-flash', () => {
    expect(
      resolveGatewayProviderModelSelection({
        provider: 'deepseek',
        model: 'deepseek-flash',
      }).model,
    ).toBe('deepseek-flash');
    expect(
      resolveGatewayProviderModelSelection({
        provider: 'deepseek',
        model: 'deepseek-v4-pro',
      }).model,
    ).toBe('deepseek-v4-pro');
    expect(
      resolveGatewayProviderModelSelection({
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
      }).model,
    ).toBe('deepseek-v4-flash');
  });

  it('rejects an unknown DeepSeek model', () => {
    expect(() =>
      resolveGatewayProviderModelSelection({
        provider: 'deepseek',
        model: 'unknown-model',
      }),
    ).toThrow(GatewayProviderModelValidationError);
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

  it('retains OpenAI gpt-4o as the source default', () => {
    const selection = resolveGatewayProviderModelSelection({
      provider: 'openai',
      model: undefined,
    });

    expect(selection.model).toBe('gpt-4o');
  });

  it.each(['gpt-6.1-sol', 'gpt-6-astra', 'gpt-6.1-terra', 'gpt-6-luna'])(
    'accepts OpenAI model %s',
    (model) => {
      const selection = resolveGatewayProviderModelSelection({
        provider: 'openai',
        model,
      });

      expect(selection.model).toBe(model);
    },
  );

  it('rejects an unknown OpenAI model', () => {
    expect(() =>
      resolveGatewayProviderModelSelection({
        provider: 'openai',
        model: 'unknown-model',
      }),
    ).toThrow(GatewayProviderModelValidationError);
  });

  it('resolves Anthropic model from trimmed ANTHROPIC_MODEL value', () => {
    const selection = resolveGatewayProviderModelSelection({
      provider: 'anthropic',
      model: undefined,
      anthropicModel: '  claude-configured  ',
    });

    expect(selection.model).toBe('claude-configured');
    expect(selection.defaultModelSource).toBe('environment');
  });

  it.each([
    'claude-opus-5-5',
    'claude-sonnet-5-5',
    'claude-fable-5-1',
    'claude-haiku-5-5',
  ])('accepts listed Anthropic model %s without ANTHROPIC_MODEL', (model) => {
    const selection = resolveGatewayProviderModelSelection({
      provider: 'anthropic',
      model,
      anthropicModel: undefined,
    });

    expect(selection.model).toBe(model);
    expect(selection.defaultModelSource).toBe('source');
  });

  it('reports source when a requested listed Anthropic model equals ANTHROPIC_MODEL', () => {
    const selection = resolveGatewayProviderModelSelection({
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
      anthropicModel: 'claude-sonnet-5-5',
    });

    expect(selection.model).toBe('claude-sonnet-5-5');
    expect(selection.defaultModelSource).toBe('source');
  });

  it('accepts an Anthropic model equal to ANTHROPIC_MODEL when it is not on the list', () => {
    const selection = resolveGatewayProviderModelSelection({
      provider: 'anthropic',
      model: 'claude-env-only',
      anthropicModel: 'claude-env-only',
    });

    expect(selection.model).toBe('claude-env-only');
    expect(selection.defaultModelSource).toBe('environment');
  });

  it('rejects an unlisted Anthropic model that does not equal ANTHROPIC_MODEL', () => {
    try {
      resolveGatewayProviderModelSelection({
        provider: 'anthropic',
        model: 'claude-other',
        anthropicModel: 'claude-configured',
      });
      fail('expected an unlisted Anthropic model to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(GatewayProviderModelValidationError);
      expect((error as GatewayProviderModelValidationError).code).toBe(
        'invalid_model',
      );
      expect((error as GatewayProviderModelValidationError).model).toBe(
        'claude-other',
      );
    }

    expect(() =>
      resolveGatewayProviderModelSelection({
        provider: 'anthropic',
        model: 'claude-other',
        anthropicModel: undefined,
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
