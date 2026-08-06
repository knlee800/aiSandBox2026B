import {
  ProviderModelValidationError,
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

    it('accepts grok-4.5 and grok-4.20', () => {
      const modelA = resolveProviderModelSelection({
        provider: 'xai',
        model: 'grok-4.5',
      });
      const modelB = resolveProviderModelSelection({
        provider: 'xai',
        model: 'grok-4.20',
      });

      expect(modelA.model).toBe('grok-4.5');
      expect(modelB.model).toBe('grok-4.20');
    });

    it('rejects grok-3', () => {
      expect(() =>
        resolveProviderModelSelection({
          provider: 'xai',
          model: 'grok-3',
        }),
      ).toThrow(ProviderModelValidationError);
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
    it('uses deepseek-v4-flash as default and accepts deepseek-v4-pro', () => {
      const defaultSelection = resolveProviderModelSelection({
        provider: 'deepseek',
        model: undefined,
      });
      const proSelection = resolveProviderModelSelection({
        provider: 'deepseek',
        model: 'deepseek-v4-pro',
      });

      expect(defaultSelection.model).toBe('deepseek-v4-flash');
      expect(proSelection.model).toBe('deepseek-v4-pro');
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
  });

  describe('Anthropic (FR-04A compatibility)', () => {
    it('resolves to trimmed ANTHROPIC_MODEL when request model omitted', () => {
      const selection = resolveProviderModelSelection({
        provider: 'anthropic',
        model: undefined,
        anthropicModel: '  claude-test-model  ',
      });

      expect(selection.model).toBe('claude-test-model');
    });

    it('rejects request model that differs from configured ANTHROPIC_MODEL', () => {
      expect(() =>
        resolveProviderModelSelection({
          provider: 'anthropic',
          model: 'claude-other',
          anthropicModel: 'claude-configured',
        }),
      ).toThrow(ProviderModelValidationError);
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
