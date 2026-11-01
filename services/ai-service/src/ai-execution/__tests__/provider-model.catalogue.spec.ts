import {
  ProviderModelValidationError,
  XAI_RECOGNIZED_MODELS,
  getStaticDefaultModel,
  resolveProviderModelSelection,
} from '../provider-model.catalogue';

describe('ProviderModelCatalogue (AI Service)', () => {
  describe('xAI', () => {
    it('resolves omitted model to grok-4.5', () => {
      const selection = resolveProviderModelSelection({
        provider: 'xai',
        model: undefined,
      });

      expect(selection.provider).toBe('xai');
      expect(selection.model).toBe('grok-4.5');
    });

    it('accepts grok-4.5 and grok-4.7 and rejects grok-4.20 for new execution', () => {
      const modelA = resolveProviderModelSelection({
        provider: 'xai',
        model: 'grok-4.5',
      });
      const modelB = resolveProviderModelSelection({
        provider: 'xai',
        model: 'grok-4.7',
      });

      expect(modelA.model).toBe('grok-4.5');
      expect(modelB.model).toBe('grok-4.7');
      expect(XAI_RECOGNIZED_MODELS).toContain('grok-4.7');
      expect(XAI_RECOGNIZED_MODELS).toContain('grok-4.20');
      expect(() =>
        resolveProviderModelSelection({
          provider: 'xai',
          model: 'grok-4.20',
        }),
      ).toThrow(ProviderModelValidationError);
    });

    it('can still represent historical grok-4.20 execution metadata', () => {
      const historicalMetadata = {
        requestedModel: 'grok-4.20',
        aiExecutionResult: { model: 'grok-4.20' },
      };

      expect(XAI_RECOGNIZED_MODELS).toContain(historicalMetadata.requestedModel);
      expect(XAI_RECOGNIZED_MODELS).toContain(
        historicalMetadata.aiExecutionResult.model,
      );
      expect(historicalMetadata.requestedModel).toBe('grok-4.20');
      expect(historicalMetadata.aiExecutionResult.model).toBe('grok-4.20');
    });

    it('rejects grok-3', () => {
      expect(() =>
        resolveProviderModelSelection({
          provider: 'xai',
          model: 'grok-3',
        }),
      ).toThrow(ProviderModelValidationError);
    });

    it('does not substitute grok-4.5 when grok-4.20 is requested', () => {
      try {
        resolveProviderModelSelection({
          provider: 'xai',
          model: 'grok-4.20',
        });
        fail('expected grok-4.20 to be rejected');
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderModelValidationError);
        expect((error as ProviderModelValidationError).code).toBe('invalid_model');
        expect((error as ProviderModelValidationError).model).toBe('grok-4.20');
        expect((error as Error).message).toContain('grok-4.20');
        expect((error as Error).message).not.toContain('grok-4.5');
      }
    });
  });

  describe('Groq', () => {
    it('uses openai/gpt-oss-120b as default', () => {
      const selection = resolveProviderModelSelection({
        provider: 'groq',
        model: undefined,
      });

      expect(selection.model).toBe('openai/gpt-oss-120b');
    });

    it('accepts openai/gpt-oss-20b', () => {
      const selection = resolveProviderModelSelection({
        provider: 'groq',
        model: 'openai/gpt-oss-20b',
      });

      expect(selection.model).toBe('openai/gpt-oss-20b');
    });

    it('rejects removed mixtral default', () => {
      expect(() =>
        resolveProviderModelSelection({
          provider: 'groq',
          model: 'mixtral-8x7b-32768',
        }),
      ).toThrow(ProviderModelValidationError);
    });
  });

  describe('DeepSeek', () => {
    it('uses deepseek-flash as default and still accepts deepseek-v4-flash and deepseek-v4-pro', () => {
      const defaultSelection = resolveProviderModelSelection({
        provider: 'deepseek',
        model: undefined,
      });
      const flashSelection = resolveProviderModelSelection({
        provider: 'deepseek',
        model: 'deepseek-flash',
      });
      const legacyFlashSelection = resolveProviderModelSelection({
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
      });
      const proSelection = resolveProviderModelSelection({
        provider: 'deepseek',
        model: 'deepseek-v4-pro',
      });

      expect(getStaticDefaultModel('deepseek')).toBe('deepseek-flash');
      expect(defaultSelection.model).toBe('deepseek-flash');
      expect(flashSelection.model).toBe('deepseek-flash');
      expect(legacyFlashSelection.model).toBe('deepseek-v4-flash');
      expect(proSelection.model).toBe('deepseek-v4-pro');
    });

    it('rejects an unknown DeepSeek model', () => {
      expect(() =>
        resolveProviderModelSelection({
          provider: 'deepseek',
          model: 'unknown-model',
        }),
      ).toThrow(ProviderModelValidationError);
    });

    it('rejects removed deepseek-chat and deepseek-reasoner', () => {
      expect(() =>
        resolveProviderModelSelection({
          provider: 'deepseek',
          model: 'deepseek-chat',
        }),
      ).toThrow(ProviderModelValidationError);
      expect(() =>
        resolveProviderModelSelection({
          provider: 'deepseek',
          model: 'deepseek-reasoner',
        }),
      ).toThrow(ProviderModelValidationError);
    });
  });

  describe('OpenAI', () => {
    it('retains gpt-4o as source default', () => {
      const selection = resolveProviderModelSelection({
        provider: 'openai',
        model: undefined,
      });

      expect(getStaticDefaultModel('openai')).toBe('gpt-4o');
      expect(selection.model).toBe('gpt-4o');
    });

    it.each(['gpt-6.1-sol', 'gpt-6-astra', 'gpt-6.1-terra', 'gpt-6-luna'])(
      'accepts %s',
      (model) => {
        const selection = resolveProviderModelSelection({
          provider: 'openai',
          model,
        });

        expect(selection.model).toBe(model);
      },
    );

    it('rejects an unknown OpenAI model', () => {
      expect(() =>
        resolveProviderModelSelection({
          provider: 'openai',
          model: 'unknown-model',
        }),
      ).toThrow(ProviderModelValidationError);
    });
  });

  describe('Anthropic (FR-04A compatibility)', () => {
    it('resolves to trimmed ANTHROPIC_MODEL when request model omitted', () => {
      const selection = resolveProviderModelSelection({
        provider: 'anthropic',
        model: undefined,
        anthropicModel: '  claude-test-model  ',
      });

      expect(selection.model).toBe('claude-test-model');
      expect(selection.defaultModelSource).toBe('environment');
    });

    it.each([
      'claude-opus-5-5',
      'claude-sonnet-5-5',
      'claude-fable-5-1',
      'claude-haiku-5-5',
    ])('accepts listed model %s without ANTHROPIC_MODEL', (model) => {
      const selection = resolveProviderModelSelection({
        provider: 'anthropic',
        model,
        anthropicModel: undefined,
      });

      expect(selection.model).toBe(model);
      expect(selection.defaultModelSource).toBe('source');
      expect(selection.supportsToolUse).toBe(true);
    });

    it('reports source when a requested listed model equals ANTHROPIC_MODEL', () => {
      const selection = resolveProviderModelSelection({
        provider: 'anthropic',
        model: 'claude-sonnet-5-5',
        anthropicModel: 'claude-sonnet-5-5',
      });

      expect(selection.model).toBe('claude-sonnet-5-5');
      expect(selection.defaultModelSource).toBe('source');
    });

    it('accepts a model equal to ANTHROPIC_MODEL when it is not on the list', () => {
      const selection = resolveProviderModelSelection({
        provider: 'anthropic',
        model: 'claude-env-only',
        anthropicModel: 'claude-env-only',
      });

      expect(selection.model).toBe('claude-env-only');
      expect(selection.defaultModelSource).toBe('environment');
    });

    it('rejects an unlisted model that does not equal ANTHROPIC_MODEL', () => {
      expect(() =>
        resolveProviderModelSelection({
          provider: 'anthropic',
          model: 'claude-other',
          anthropicModel: 'claude-configured',
        }),
      ).toThrow(ProviderModelValidationError);

      try {
        resolveProviderModelSelection({
          provider: 'anthropic',
          model: 'claude-other',
          anthropicModel: undefined,
        });
        fail('expected an unlisted Anthropic model to be rejected');
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderModelValidationError);
        expect((error as ProviderModelValidationError).code).toBe('invalid_model');
        expect((error as ProviderModelValidationError).model).toBe('claude-other');
      }
    });

    it('fails when ANTHROPIC_MODEL configuration is missing/empty', () => {
      expect(() =>
        resolveProviderModelSelection({
          provider: 'anthropic',
          model: undefined,
          anthropicModel: '   ',
        }),
      ).toThrow(
        'ANTHROPIC_MODEL environment variable is required when provider is "anthropic"',
      );
    });
  });

  describe('Validation guarantees', () => {
    it('rejects cross-provider model mismatches', () => {
      expect(() =>
        resolveProviderModelSelection({
          provider: 'xai',
          model: 'gpt-4o',
        }),
      ).toThrow('Model "gpt-4o" is not valid for provider "xai".');
    });

    it('rejects unknown model IDs', () => {
      expect(() =>
        resolveProviderModelSelection({
          provider: 'xai',
          model: 'unknown-model-id',
        }),
      ).toThrow(ProviderModelValidationError);
    });

    it('rejects unsupported providers', () => {
      expect(() =>
        resolveProviderModelSelection({
          provider: 'provider-does-not-exist',
          model: undefined,
        }),
      ).toThrow(ProviderModelValidationError);
    });
  });

  describe('supportsToolUse', () => {
    it('is true for xai, deepseek, openai and anthropic, and false for groq', () => {
      expect(
        resolveProviderModelSelection({ provider: 'xai', model: undefined })
          .supportsToolUse,
      ).toBe(true);
      expect(
        resolveProviderModelSelection({ provider: 'deepseek', model: undefined })
          .supportsToolUse,
      ).toBe(true);
      expect(
        resolveProviderModelSelection({ provider: 'openai', model: undefined })
          .supportsToolUse,
      ).toBe(true);
      expect(
        resolveProviderModelSelection({
          provider: 'anthropic',
          model: 'claude-haiku-5-5',
        }).supportsToolUse,
      ).toBe(true);
      expect(
        resolveProviderModelSelection({ provider: 'groq', model: undefined })
          .supportsToolUse,
      ).toBe(false);
    });
  });

  describe('Stub provider behavior', () => {
    it('keeps passthrough request model behavior for stub', () => {
      const selection = resolveProviderModelSelection({
        provider: 'stub',
        model: 'custom-stub-model',
      });

      expect(selection.model).toBe('custom-stub-model');
    });

    it('uses stub default model when omitted', () => {
      const selection = resolveProviderModelSelection({
        provider: 'stub',
        model: undefined,
      });

      expect(selection.model).toBe('stub');
    });
  });
});
