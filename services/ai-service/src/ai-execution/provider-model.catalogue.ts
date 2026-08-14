import { AIExecutionRequest } from './types';

export type AIExecutionProvider = AIExecutionRequest['provider'];

type StaticDefaultProvider = Exclude<AIExecutionProvider, 'anthropic'>;
type DefaultModelSourceKind = 'source' | 'environment';
type ValidationErrorCode =
  | 'unsupported_provider'
  | 'invalid_model'
  | 'missing_required_configuration';

interface StaticProviderModelCatalogueEntry {
  provider: StaticDefaultProvider;
  defaultModelSource: 'source';
  defaultModel: string;
  allowedModels: readonly string[];
  supportsToolUse: boolean;
  enforceAllowedModels: boolean;
}

interface AnthropicProviderModelCatalogueEntry {
  provider: 'anthropic';
  defaultModelSource: 'environment';
  environmentVariable: 'ANTHROPIC_MODEL';
  supportsToolUse: boolean;
}

type ProviderModelCatalogueEntry =
  | StaticProviderModelCatalogueEntry
  | AnthropicProviderModelCatalogueEntry;

export interface ResolvedProviderModelSelection {
  provider: AIExecutionProvider;
  model: string;
  supportsToolUse: boolean;
  defaultModelSource: DefaultModelSourceKind;
}

export class ProviderModelValidationError extends Error {
  constructor(
    readonly code: ValidationErrorCode,
    message: string,
    readonly provider?: string,
    readonly model?: string,
  ) {
    super(message);
  }
}

export const XAI_RECOGNIZED_MODELS = ['grok-4.5', 'grok-4.20'] as const;
const XAI_ALLOWED_MODELS = ['grok-4.5'] as const;
const GROQ_ALLOWED_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'] as const;
const DEEPSEEK_ALLOWED_MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro'] as const;
const OPENAI_ALLOWED_MODELS = ['gpt-4o'] as const;
const STUB_ALLOWED_MODELS = ['stub'] as const;
const TEST_HARNESS_STUB_ALLOWED_MODELS = ['test-harness-stub'] as const;

const CATALOGUE_ENTRIES: readonly ProviderModelCatalogueEntry[] = [
  {
    provider: 'stub',
    defaultModelSource: 'source',
    defaultModel: 'stub',
    allowedModels: STUB_ALLOWED_MODELS,
    supportsToolUse: false,
    enforceAllowedModels: false,
  },
  {
    provider: 'anthropic',
    defaultModelSource: 'environment',
    environmentVariable: 'ANTHROPIC_MODEL',
    supportsToolUse: true,
  },
  {
    provider: 'openai',
    defaultModelSource: 'source',
    defaultModel: OPENAI_ALLOWED_MODELS[0],
    allowedModels: OPENAI_ALLOWED_MODELS,
    supportsToolUse: true,
    enforceAllowedModels: true,
  },
  {
    provider: 'groq',
    defaultModelSource: 'source',
    defaultModel: GROQ_ALLOWED_MODELS[0],
    allowedModels: GROQ_ALLOWED_MODELS,
    supportsToolUse: false,
    enforceAllowedModels: true,
  },
  {
    provider: 'xai',
    defaultModelSource: 'source',
    defaultModel: XAI_ALLOWED_MODELS[0],
    allowedModels: XAI_ALLOWED_MODELS,
    supportsToolUse: false,
    enforceAllowedModels: true,
  },
  {
    provider: 'deepseek',
    defaultModelSource: 'source',
    defaultModel: DEEPSEEK_ALLOWED_MODELS[0],
    allowedModels: DEEPSEEK_ALLOWED_MODELS,
    supportsToolUse: false,
    enforceAllowedModels: true,
  },
  {
    provider: 'test-harness-stub',
    defaultModelSource: 'source',
    defaultModel: 'test-harness-stub',
    allowedModels: TEST_HARNESS_STUB_ALLOWED_MODELS,
    supportsToolUse: true,
    enforceAllowedModels: false,
  },
] as const;

const CATALOGUE_BY_PROVIDER = CATALOGUE_ENTRIES.reduce(
  (acc, entry) => {
    acc[entry.provider] = entry;
    return acc;
  },
  {} as Record<AIExecutionProvider, ProviderModelCatalogueEntry>,
);

export const SUPPORTED_AI_PROVIDERS = CATALOGUE_ENTRIES.map(
  (entry) => entry.provider,
) as readonly AIExecutionProvider[];

export function normalizeProviderInput(provider: unknown): string | undefined {
  if (typeof provider !== 'string') {
    return undefined;
  }
  const trimmedProvider = provider.trim();
  return trimmedProvider.length > 0 ? trimmedProvider : undefined;
}

export function normalizeModelInput(model: unknown): string | undefined {
  if (typeof model !== 'string') {
    return undefined;
  }
  const trimmedModel = model.trim();
  return trimmedModel.length > 0 ? trimmedModel : undefined;
}

export function getStaticDefaultModel(provider: StaticDefaultProvider): string {
  const entry = CATALOGUE_BY_PROVIDER[provider];
  if (entry.defaultModelSource !== 'source') {
    throw new Error(`Provider "${provider}" does not use a source default model`);
  }
  return entry.defaultModel;
}

export function resolveProviderModelSelection(input: {
  provider: unknown;
  model: unknown;
  fallbackProvider?: AIExecutionProvider;
  anthropicModel?: string | null | undefined;
}): ResolvedProviderModelSelection {
  const normalizedProviderInput = normalizeProviderInput(input.provider);
  const providerToUse = (normalizedProviderInput ??
    input.fallbackProvider) as AIExecutionProvider | undefined;

  if (!providerToUse || !SUPPORTED_AI_PROVIDERS.includes(providerToUse)) {
    const rejectedProvider = normalizedProviderInput ?? 'undefined';
    throw new ProviderModelValidationError(
      'unsupported_provider',
      `Unsupported provider "${rejectedProvider}". Supported providers: ${SUPPORTED_AI_PROVIDERS.join(', ')}`,
      rejectedProvider,
    );
  }

  const entry = CATALOGUE_BY_PROVIDER[providerToUse];
  const normalizedModelInput = normalizeModelInput(input.model);

  if (entry.defaultModelSource === 'environment') {
    const configuredAnthropicModel = normalizeModelInput(input.anthropicModel);
    if (!configuredAnthropicModel) {
      throw new ProviderModelValidationError(
        'missing_required_configuration',
        'ANTHROPIC_MODEL environment variable is required when provider is "anthropic"',
        providerToUse,
      );
    }

    if (
      normalizedModelInput &&
      normalizedModelInput !== configuredAnthropicModel
    ) {
      throw new ProviderModelValidationError(
        'invalid_model',
        `Model "${normalizedModelInput}" is not valid for provider "${providerToUse}".`,
        providerToUse,
        normalizedModelInput,
      );
    }

    return {
      provider: providerToUse,
      model: configuredAnthropicModel,
      supportsToolUse: entry.supportsToolUse,
      defaultModelSource: 'environment',
    };
  }

  if (normalizedModelInput) {
    if (
      entry.enforceAllowedModels &&
      !entry.allowedModels.includes(normalizedModelInput)
    ) {
      throw new ProviderModelValidationError(
        'invalid_model',
        `Model "${normalizedModelInput}" is not valid for provider "${providerToUse}".`,
        providerToUse,
        normalizedModelInput,
      );
    }

    return {
      provider: providerToUse,
      model: normalizedModelInput,
      supportsToolUse: entry.supportsToolUse,
      defaultModelSource: 'source',
    };
  }

  return {
    provider: providerToUse,
    model: entry.defaultModel,
    supportsToolUse: entry.supportsToolUse,
    defaultModelSource: 'source',
  };
}
