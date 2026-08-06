export type GatewayAIProvider =
  | 'stub'
  | 'anthropic'
  | 'openai'
  | 'groq'
  | 'xai'
  | 'deepseek';

type DefaultModelSourceKind = 'source' | 'environment';
type ValidationErrorCode =
  | 'unsupported_provider'
  | 'invalid_model'
  | 'missing_required_configuration';

interface StaticProviderModelCatalogueEntry {
  provider: Exclude<GatewayAIProvider, 'anthropic'>;
  defaultModelSource: 'source';
  defaultModel: string;
  allowedModels: readonly string[];
  enforceAllowedModels: boolean;
}

interface AnthropicProviderModelCatalogueEntry {
  provider: 'anthropic';
  defaultModelSource: 'environment';
  environmentVariable: 'ANTHROPIC_MODEL';
}

type ProviderModelCatalogueEntry =
  | StaticProviderModelCatalogueEntry
  | AnthropicProviderModelCatalogueEntry;

export interface ResolvedGatewayProviderModelSelection {
  provider: GatewayAIProvider;
  model: string;
  defaultModelSource: DefaultModelSourceKind;
}

export class GatewayProviderModelValidationError extends Error {
  constructor(
    readonly code: ValidationErrorCode,
    message: string,
    readonly provider?: string,
    readonly model?: string,
  ) {
    super(message);
  }
}

const XAI_ALLOWED_MODELS = ['grok-4.5', 'grok-4.20'] as const;
const GROQ_ALLOWED_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'] as const;
const DEEPSEEK_ALLOWED_MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro'] as const;
const OPENAI_ALLOWED_MODELS = ['gpt-4o'] as const;
const STUB_ALLOWED_MODELS = ['stub'] as const;

const CATALOGUE_ENTRIES: readonly ProviderModelCatalogueEntry[] = [
  {
    provider: 'stub',
    defaultModelSource: 'source',
    defaultModel: 'stub',
    allowedModels: STUB_ALLOWED_MODELS,
    enforceAllowedModels: false,
  },
  {
    provider: 'anthropic',
    defaultModelSource: 'environment',
    environmentVariable: 'ANTHROPIC_MODEL',
  },
  {
    provider: 'openai',
    defaultModelSource: 'source',
    defaultModel: OPENAI_ALLOWED_MODELS[0],
    allowedModels: OPENAI_ALLOWED_MODELS,
    enforceAllowedModels: true,
  },
  {
    provider: 'groq',
    defaultModelSource: 'source',
    defaultModel: GROQ_ALLOWED_MODELS[0],
    allowedModels: GROQ_ALLOWED_MODELS,
    enforceAllowedModels: true,
  },
  {
    provider: 'xai',
    defaultModelSource: 'source',
    defaultModel: XAI_ALLOWED_MODELS[0],
    allowedModels: XAI_ALLOWED_MODELS,
    enforceAllowedModels: true,
  },
  {
    provider: 'deepseek',
    defaultModelSource: 'source',
    defaultModel: DEEPSEEK_ALLOWED_MODELS[0],
    allowedModels: DEEPSEEK_ALLOWED_MODELS,
    enforceAllowedModels: true,
  },
] as const;

const CATALOGUE_BY_PROVIDER = CATALOGUE_ENTRIES.reduce(
  (acc, entry) => {
    acc[entry.provider] = entry;
    return acc;
  },
  {} as Record<GatewayAIProvider, ProviderModelCatalogueEntry>,
);

export const SUPPORTED_GATEWAY_AI_PROVIDERS = CATALOGUE_ENTRIES.map(
  (entry) => entry.provider,
) as readonly GatewayAIProvider[];

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

export function resolveGatewayProviderModelSelection(input: {
  provider: unknown;
  model: unknown;
  fallbackProviderEnv?: string | null | undefined;
  anthropicModel?: string | null | undefined;
}): ResolvedGatewayProviderModelSelection {
  const normalizedProviderInput = normalizeProviderInput(input.provider);
  const normalizedFallbackProvider = normalizeProviderInput(
    input.fallbackProviderEnv,
  );
  const providerToUse = (normalizedProviderInput ??
    (normalizedFallbackProvider &&
    SUPPORTED_GATEWAY_AI_PROVIDERS.includes(
      normalizedFallbackProvider as GatewayAIProvider,
    )
      ? normalizedFallbackProvider
      : 'stub')) as GatewayAIProvider;

  if (!SUPPORTED_GATEWAY_AI_PROVIDERS.includes(providerToUse)) {
    const rejectedProvider = normalizedProviderInput ?? 'undefined';
    throw new GatewayProviderModelValidationError(
      'unsupported_provider',
      `Unsupported provider "${rejectedProvider}". Supported providers: ${SUPPORTED_GATEWAY_AI_PROVIDERS.join(', ')}`,
      rejectedProvider,
    );
  }

  const entry = CATALOGUE_BY_PROVIDER[providerToUse];
  const normalizedModelInput = normalizeModelInput(input.model);

  if (entry.defaultModelSource === 'environment') {
    const configuredAnthropicModel = normalizeModelInput(input.anthropicModel);
    if (!configuredAnthropicModel) {
      throw new GatewayProviderModelValidationError(
        'missing_required_configuration',
        'ANTHROPIC_MODEL environment variable is required when provider is "anthropic"',
        providerToUse,
      );
    }

    if (
      normalizedModelInput &&
      normalizedModelInput !== configuredAnthropicModel
    ) {
      throw new GatewayProviderModelValidationError(
        'invalid_model',
        `Model "${normalizedModelInput}" is not valid for provider "${providerToUse}".`,
        providerToUse,
        normalizedModelInput,
      );
    }

    return {
      provider: providerToUse,
      model: configuredAnthropicModel,
      defaultModelSource: 'environment',
    };
  }

  if (normalizedModelInput) {
    if (
      entry.enforceAllowedModels &&
      !entry.allowedModels.includes(normalizedModelInput)
    ) {
      throw new GatewayProviderModelValidationError(
        'invalid_model',
        `Model "${normalizedModelInput}" is not valid for provider "${providerToUse}".`,
        providerToUse,
        normalizedModelInput,
      );
    }

    return {
      provider: providerToUse,
      model: normalizedModelInput,
      defaultModelSource: 'source',
    };
  }

  return {
    provider: providerToUse,
    model: entry.defaultModel,
    defaultModelSource: 'source',
  };
}
