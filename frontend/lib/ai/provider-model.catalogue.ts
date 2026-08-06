export type FrontendProviderId =
  | 'xai'
  | 'groq'
  | 'deepseek'
  | 'openai'
  | 'anthropic'
  | 'stub';

export interface FrontendProviderModelCatalogueModelEntry {
  providerId: FrontendProviderId;
  modelId: string;
  labelKey: string;
  enabled: boolean;
  selectable: boolean;
}

export interface FrontendProviderModelCatalogueProviderEntry {
  providerId: FrontendProviderId;
  labelKey: string;
  defaultModelId: string | null;
  enabled: boolean;
  selectable: boolean;
  models: readonly FrontendProviderModelCatalogueModelEntry[];
}

export interface ResolvedFrontendProviderModelSelection {
  providerId: FrontendProviderId;
  modelId: string;
  optionValue: string;
}

const FRONTEND_PRIVATE_BETA_DEFAULT_PROVIDER_ID: FrontendProviderId = 'xai';
const FRONTEND_PRIVATE_BETA_DEFAULT_MODEL_ID = 'grok-4.5';

const FRONTEND_PROVIDER_MODEL_CATALOGUE: readonly FrontendProviderModelCatalogueProviderEntry[] = [
  {
    providerId: 'xai',
    labelKey: 'xai',
    defaultModelId: 'grok-4.5',
    enabled: true,
    selectable: true,
    models: [
      {
        providerId: 'xai',
        modelId: 'grok-4.5',
        labelKey: 'grok-4.5',
        enabled: true,
        selectable: true,
      },
      {
        providerId: 'xai',
        modelId: 'grok-4.20',
        labelKey: 'grok-4.20',
        enabled: true,
        selectable: true,
      },
    ],
  },
  {
    providerId: 'groq',
    labelKey: 'groq',
    defaultModelId: 'openai/gpt-oss-120b',
    enabled: true,
    selectable: true,
    models: [
      {
        providerId: 'groq',
        modelId: 'openai/gpt-oss-120b',
        labelKey: 'openai/gpt-oss-120b',
        enabled: true,
        selectable: true,
      },
      {
        providerId: 'groq',
        modelId: 'openai/gpt-oss-20b',
        labelKey: 'openai/gpt-oss-20b',
        enabled: true,
        selectable: true,
      },
    ],
  },
  {
    providerId: 'deepseek',
    labelKey: 'deepseek',
    defaultModelId: 'deepseek-v4-flash',
    enabled: true,
    selectable: true,
    models: [
      {
        providerId: 'deepseek',
        modelId: 'deepseek-v4-flash',
        labelKey: 'deepseek-v4-flash',
        enabled: true,
        selectable: true,
      },
      {
        providerId: 'deepseek',
        modelId: 'deepseek-v4-pro',
        labelKey: 'deepseek-v4-pro',
        enabled: true,
        selectable: true,
      },
    ],
  },
  {
    providerId: 'openai',
    labelKey: 'openai',
    defaultModelId: 'gpt-4o',
    enabled: true,
    selectable: true,
    models: [
      {
        providerId: 'openai',
        modelId: 'gpt-4o',
        labelKey: 'gpt-4o',
        enabled: true,
        selectable: true,
      },
    ],
  },
  {
    // Anthropic remains backend-supported but is hidden in the selector until a safe configured model id is exposed.
    providerId: 'anthropic',
    labelKey: 'anthropic',
    defaultModelId: null,
    enabled: true,
    selectable: false,
    models: [],
  },
  {
    // Preserve internal stub behavior without showing it as a normal private-beta user choice.
    providerId: 'stub',
    labelKey: 'stub',
    defaultModelId: 'stub',
    enabled: true,
    selectable: false,
    models: [
      {
        providerId: 'stub',
        modelId: 'stub',
        labelKey: 'stub',
        enabled: true,
        selectable: false,
      },
    ],
  },
] as const;

const SELECTABLE_FRONTEND_PROVIDERS = FRONTEND_PROVIDER_MODEL_CATALOGUE.filter(
  (provider) => provider.enabled && provider.selectable,
);

const FRONTEND_PROVIDER_BY_ID = FRONTEND_PROVIDER_MODEL_CATALOGUE.reduce(
  (acc, provider) => {
    acc[provider.providerId] = provider;
    return acc;
  },
  {} as Record<FrontendProviderId, FrontendProviderModelCatalogueProviderEntry>,
);

function normalizeCatalogueIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseProviderModelOptionValue(value: unknown): {
  providerId?: string;
  modelId?: string;
} {
  const normalizedValue = normalizeCatalogueIdentifier(value);
  if (!normalizedValue) {
    return {};
  }

  const separatorIndex = normalizedValue.indexOf(':');
  if (separatorIndex <= 0 || separatorIndex >= normalizedValue.length - 1) {
    return {};
  }

  return {
    providerId: normalizedValue.slice(0, separatorIndex),
    modelId: normalizedValue.slice(separatorIndex + 1),
  };
}

function isSelectableProviderId(providerId: string | undefined): providerId is FrontendProviderId {
  if (!providerId) {
    return false;
  }
  const provider = FRONTEND_PROVIDER_BY_ID[providerId as FrontendProviderId];
  return Boolean(provider && provider.enabled && provider.selectable);
}

function resolveSelectableProviderEntry(
  providerId: string | undefined,
): FrontendProviderModelCatalogueProviderEntry {
  if (isSelectableProviderId(providerId)) {
    return FRONTEND_PROVIDER_BY_ID[providerId];
  }
  return FRONTEND_PROVIDER_BY_ID[FRONTEND_PRIVATE_BETA_DEFAULT_PROVIDER_ID];
}

function resolveProviderDefaultModelId(
  provider: FrontendProviderModelCatalogueProviderEntry,
): string {
  const selectableModels = provider.models.filter((model) => model.enabled && model.selectable);

  if (
    provider.defaultModelId &&
    selectableModels.some((model) => model.modelId === provider.defaultModelId)
  ) {
    return provider.defaultModelId;
  }

  const firstSelectableModel = selectableModels[0];
  if (firstSelectableModel) {
    return firstSelectableModel.modelId;
  }

  return FRONTEND_PRIVATE_BETA_DEFAULT_MODEL_ID;
}

export function buildProviderModelOptionValue(providerId: string, modelId: string): string {
  return `${providerId}:${modelId}`;
}

export function resolveFrontendProviderModelSelection(input: {
  providerId?: unknown;
  modelId?: unknown;
  optionValue?: unknown;
}): ResolvedFrontendProviderModelSelection {
  const parsedOption = parseProviderModelOptionValue(input.optionValue);
  const normalizedProviderId =
    normalizeCatalogueIdentifier(input.providerId) ?? parsedOption.providerId;
  const normalizedModelId = normalizeCatalogueIdentifier(input.modelId) ?? parsedOption.modelId;

  const providerEntry = resolveSelectableProviderEntry(normalizedProviderId);
  const selectableModels = providerEntry.models.filter((model) => model.enabled && model.selectable);
  const defaultModelId = resolveProviderDefaultModelId(providerEntry);
  const modelBelongsToProvider =
    normalizedModelId !== undefined &&
    selectableModels.some((model) => model.modelId === normalizedModelId);
  const modelIdToUse = modelBelongsToProvider ? normalizedModelId : defaultModelId;

  return {
    providerId: providerEntry.providerId,
    modelId: modelIdToUse,
    optionValue: buildProviderModelOptionValue(providerEntry.providerId, modelIdToUse),
  };
}

export function resolveFrontendProviderModelPayload(input: {
  providerId?: unknown;
  modelId?: unknown;
  optionValue?: unknown;
}): { provider: FrontendProviderId; model: string } {
  const selection = resolveFrontendProviderModelSelection(input);
  return {
    provider: selection.providerId,
    model: selection.modelId,
  };
}

export function getSelectableFrontendProviderEntries(): readonly FrontendProviderModelCatalogueProviderEntry[] {
  return SELECTABLE_FRONTEND_PROVIDERS;
}

export function getSelectableFrontendModelEntriesForProvider(
  providerId: unknown,
): readonly FrontendProviderModelCatalogueModelEntry[] {
  const normalizedProviderId = normalizeCatalogueIdentifier(providerId);
  const providerEntry = resolveSelectableProviderEntry(normalizedProviderId);
  return providerEntry.models.filter((model) => model.enabled && model.selectable);
}

export const FRONTEND_PROVIDER_MODEL_CATALOGUE_ENTRIES = FRONTEND_PROVIDER_MODEL_CATALOGUE;

export const FRONTEND_PRIVATE_BETA_DEFAULT_SELECTION = resolveFrontendProviderModelSelection({
  providerId: FRONTEND_PRIVATE_BETA_DEFAULT_PROVIDER_ID,
  modelId: FRONTEND_PRIVATE_BETA_DEFAULT_MODEL_ID,
});
