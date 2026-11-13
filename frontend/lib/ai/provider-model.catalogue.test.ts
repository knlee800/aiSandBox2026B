import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import enMessages from '@/messages/en.json';
import zhTwMessages from '@/messages/zh-TW.json';
import zhCnMessages from '@/messages/zh-CN.json';
import {
  FRONTEND_PRIVATE_BETA_DEFAULT_SELECTION,
  FRONTEND_PROVIDER_MODEL_CATALOGUE_ENTRIES,
  getSelectableFrontendModelEntriesForProvider,
  getSelectableFrontendProviderEntries,
  getUsableFrontendProviderEntries,
  resolveFrontendProviderModelPayload,
  resolveFrontendProviderModelSelection,
  resolveFrontendProviderModelSelectionWithinUsable,
} from './provider-model.catalogue';

function catalogueModelIds(providerId: string): string[] {
  return getSelectableFrontendModelEntriesForProvider(providerId).map((entry) => entry.modelId);
}

describe('frontend provider/model catalogue hardening', () => {
  test('contains the current selectable provider and model options', () => {
    const selectableProviders = getSelectableFrontendProviderEntries().map(
      (provider) => provider.providerId,
    );
    assert.deepEqual(selectableProviders, ['xai', 'groq', 'deepseek', 'openai', 'anthropic']);
    assert.deepEqual(catalogueModelIds('xai'), ['grok-4.5', 'grok-4.7']);
    assert.deepEqual(catalogueModelIds('groq'), ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
    assert.deepEqual(catalogueModelIds('deepseek'), ['deepseek-flash', 'deepseek-v4-pro']);
    assert.deepEqual(catalogueModelIds('openai'), [
      'gpt-4o',
      'gpt-6.1-sol',
      'gpt-6-astra',
      'gpt-6.1-terra',
      'gpt-6-luna',
    ]);
    assert.deepEqual(catalogueModelIds('anthropic'), [
      'claude-opus-5-5',
      'claude-sonnet-5-5',
      'claude-fable-5-1',
      'claude-haiku-5-5',
    ]);
  });

  test('uses xai:grok-4.5 as the private-beta default selection', () => {
    assert.equal(FRONTEND_PRIVATE_BETA_DEFAULT_SELECTION.providerId, 'xai');
    assert.equal(FRONTEND_PRIVATE_BETA_DEFAULT_SELECTION.modelId, 'grok-4.5');
    assert.equal(FRONTEND_PRIVATE_BETA_DEFAULT_SELECTION.optionValue, 'xai:grok-4.5');
  });

  test('removes stale grok-3 from selectable options', () => {
    const selectableModelIds = getSelectableFrontendProviderEntries().flatMap((provider) =>
      provider.models.filter((model) => model.enabled && model.selectable).map((model) => model.modelId),
    );
    assert.equal(selectableModelIds.includes('grok-3'), false);
  });

  test('removes retired groq and deepseek model ids from selectable options', () => {
    const selectableModelIds = getSelectableFrontendProviderEntries().flatMap((provider) =>
      provider.models.filter((model) => model.enabled && model.selectable).map((model) => model.modelId),
    );
    assert.equal(selectableModelIds.includes('mixtral-8x7b-32768'), false);
    assert.equal(selectableModelIds.includes('deepseek-chat'), false);
    assert.equal(selectableModelIds.includes('deepseek-reasoner'), false);
  });

  test('selecting xAI exposes only selectable xAI models', () => {
    assert.deepEqual(catalogueModelIds('xai'), ['grok-4.5', 'grok-4.7']);
    assert.equal(catalogueModelIds('xai').includes('grok-4.20'), false);
  });

  test('selecting Groq exposes only Groq models', () => {
    assert.deepEqual(catalogueModelIds('groq'), ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
  });

  test('selecting DeepSeek exposes only selectable DeepSeek models', () => {
    assert.deepEqual(catalogueModelIds('deepseek'), ['deepseek-flash', 'deepseek-v4-pro']);
    assert.equal(catalogueModelIds('deepseek').includes('deepseek-v4-flash'), false);
  });

  test('selecting OpenAI exposes the current OpenAI models', () => {
    assert.deepEqual(catalogueModelIds('openai'), [
      'gpt-4o',
      'gpt-6.1-sol',
      'gpt-6-astra',
      'gpt-6.1-terra',
      'gpt-6-luna',
    ]);
  });

  test('provider change migrates to provider default model', () => {
    const migrated = resolveFrontendProviderModelSelection({
      providerId: 'groq',
      modelId: 'grok-4.5',
    });
    assert.equal(migrated.providerId, 'groq');
    assert.equal(migrated.modelId, 'openai/gpt-oss-120b');
  });

  test('migrates stored grok-4.20 selection to the private-beta default', () => {
    const migrated = resolveFrontendProviderModelSelection({
      providerId: 'xai',
      modelId: 'grok-4.20',
    });
    assert.equal(migrated.providerId, 'xai');
    assert.equal(migrated.modelId, 'grok-4.5');
  });

  test('preserves valid existing provider/model selections', () => {
    const preserved = resolveFrontendProviderModelSelection({
      providerId: 'xai',
      modelId: 'grok-4.5',
    });
    assert.equal(preserved.providerId, 'xai');
    assert.equal(preserved.modelId, 'grok-4.5');
  });

  test('migrates invalid model ids to the selected provider default', () => {
    const migrated = resolveFrontendProviderModelSelection({
      providerId: 'xai',
      modelId: 'grok-3',
    });
    assert.equal(migrated.providerId, 'xai');
    assert.equal(migrated.modelId, 'grok-4.5');
  });

  test('migrates cross-provider model mismatches safely', () => {
    const migrated = resolveFrontendProviderModelSelection({
      providerId: 'deepseek',
      modelId: 'openai/gpt-oss-20b',
    });
    assert.equal(migrated.providerId, 'deepseek');
    assert.equal(migrated.modelId, 'deepseek-flash');
  });

  test('migrates invalid provider ids to xai:grok-4.5', () => {
    const migrated = resolveFrontendProviderModelSelection({
      providerId: 'not-a-provider',
      modelId: 'gpt-4o',
    });
    assert.equal(migrated.providerId, 'xai');
    assert.equal(migrated.modelId, 'grok-4.5');
  });

  test('request payload resolver always returns provider and model', () => {
    const payload = resolveFrontendProviderModelPayload({
      providerId: 'groq',
      modelId: 'openai/gpt-oss-20b',
    });
    assert.deepEqual(payload, {
      provider: 'groq',
      model: 'openai/gpt-oss-20b',
    });
  });

  test('request payload resolver never submits grok-4.20', () => {
    const payload = resolveFrontendProviderModelPayload({
      providerId: 'xai',
      modelId: 'grok-4.20',
    });
    assert.deepEqual(payload, {
      provider: 'xai',
      model: 'grok-4.5',
    });
  });

  test('request payload resolver never submits stale model ids', () => {
    const payload = resolveFrontendProviderModelPayload({
      providerId: 'groq',
      modelId: 'mixtral-8x7b-32768',
    });
    assert.deepEqual(payload, {
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
    });
  });

  test('Anthropic is selectable and defaults to claude-sonnet-5-5', () => {
    const selectableProviderIds = getSelectableFrontendProviderEntries().map(
      (provider) => provider.providerId,
    );
    assert.equal(selectableProviderIds.includes('anthropic'), true);
    assert.deepEqual(catalogueModelIds('anthropic'), [
      'claude-opus-5-5',
      'claude-sonnet-5-5',
      'claude-fable-5-1',
      'claude-haiku-5-5',
    ]);

    const anthropicSelection = resolveFrontendProviderModelSelection({
      providerId: 'anthropic',
      modelId: 'any-anthropic-model',
    });
    assert.equal(anthropicSelection.providerId, 'anthropic');
    assert.equal(anthropicSelection.modelId, 'claude-sonnet-5-5');
    assert.equal(anthropicSelection.optionValue, 'anthropic:claude-sonnet-5-5');
  });

  test('hides deepseek-v4-flash and moves a saved selection to deepseek-flash', () => {
    assert.equal(catalogueModelIds('deepseek').includes('deepseek-v4-flash'), false);

    const deepseek = FRONTEND_PROVIDER_MODEL_CATALOGUE_ENTRIES.find(
      (entry) => entry.providerId === 'deepseek',
    );
    const hidden = deepseek?.models.find((model) => model.modelId === 'deepseek-v4-flash');
    assert.ok(hidden);
    assert.equal(hidden.enabled, true);
    assert.equal(hidden.selectable, false);
    assert.equal(deepseek?.defaultModelId, 'deepseek-flash');

    const migrated = resolveFrontendProviderModelSelection({
      providerId: 'deepseek',
      modelId: 'deepseek-v4-flash',
    });
    assert.equal(migrated.providerId, 'deepseek');
    assert.equal(migrated.modelId, 'deepseek-flash');
    assert.equal(migrated.optionValue, 'deepseek:deepseek-flash');

    const fromSavedOption = resolveFrontendProviderModelSelection({
      optionValue: 'deepseek:deepseek-v4-flash',
    });
    assert.equal(fromSavedOption.providerId, 'deepseek');
    assert.equal(fromSavedOption.modelId, 'deepseek-flash');
  });

  test('all three message files label every frontend model id', () => {
    const localeLabels = [enMessages.ai, zhTwMessages.ai, zhCnMessages.ai].map(
      (aiMessages) => aiMessages.modelOptionLabels as Record<string, Record<string, string>>,
    );

    function labelKeys(labels: Record<string, Record<string, string>>): string[] {
      return Object.keys(labels)
        .sort()
        .flatMap((providerId) =>
          Object.keys(labels[providerId] ?? {})
            .sort()
            .map((modelId) => `${providerId}:${modelId}`),
        );
    }

    assert.deepEqual(labelKeys(localeLabels[1]), labelKeys(localeLabels[0]));
    assert.deepEqual(labelKeys(localeLabels[2]), labelKeys(localeLabels[0]));

    for (const provider of FRONTEND_PROVIDER_MODEL_CATALOGUE_ENTRIES) {
      for (const model of provider.models) {
        assert.equal(model.labelKey, model.modelId);
        for (const labels of localeLabels) {
          assert.equal(labels[provider.providerId]?.[model.modelId], model.modelId);
        }
      }
    }
  });

  test('translation keys stay in parity across en, zh-TW, and zh-CN', () => {
    const localeAiMessages = [enMessages.ai, zhTwMessages.ai, zhCnMessages.ai];

    for (const aiMessages of localeAiMessages) {
      assert.equal(typeof aiMessages.modelProviderLabel, 'string');
      assert.equal(typeof aiMessages.modelLabel, 'string');
    }

    for (const provider of getSelectableFrontendProviderEntries()) {
      for (const aiMessages of localeAiMessages) {
        const providerOptionLabels = aiMessages.providerOptionLabels as Record<string, string>;
        const providerLabel = providerOptionLabels[provider.labelKey];
        assert.equal(typeof providerLabel, 'string');
        assert.equal(providerLabel.trim().length > 0, true);
      }

      const selectableModels = provider.models.filter((model) => model.enabled && model.selectable);
      for (const model of selectableModels) {
        for (const aiMessages of localeAiMessages) {
          const modelOptionLabels = aiMessages.modelOptionLabels as Record<
            string,
            Record<string, string>
          >;
          const modelLabel = modelOptionLabels[provider.providerId]?.[model.labelKey];
          assert.equal(typeof modelLabel, 'string');
          assert.equal(modelLabel.trim().length > 0, true);
        }
      }
    }
  });

  test('frontend catalogue keeps grok-4.20 as a non-selectable historical identifier', () => {
    const xai = FRONTEND_PROVIDER_MODEL_CATALOGUE_ENTRIES.find(
      (entry) => entry.providerId === 'xai',
    );
    const grok420 = xai?.models.find((model) => model.modelId === 'grok-4.20');
    const grok45 = xai?.models.find((model) => model.modelId === 'grok-4.5');

    assert.ok(grok420);
    assert.equal(grok420.enabled, true);
    assert.equal(grok420.selectable, false);
    assert.ok(grok45);
    assert.equal(grok45.enabled, true);
    assert.equal(grok45.selectable, true);
  });

  test('frontend catalogue keeps non-selectable backend-supported entries explicit', () => {
    const providerIds = FRONTEND_PROVIDER_MODEL_CATALOGUE_ENTRIES.map((entry) => entry.providerId);
    assert.equal(providerIds.includes('anthropic'), true);
    assert.equal(providerIds.includes('stub'), true);
  });
});

describe('PROVIDER-KEY-01 usable provider filter and selection', () => {
  function usableIds(list: readonly string[] | null): string[] {
    return getUsableFrontendProviderEntries(list).map((provider) => provider.providerId);
  }

  test('a null list means no filter: the providers and default of today', () => {
    assert.deepEqual(usableIds(null), ['xai', 'groq', 'deepseek', 'openai', 'anthropic']);
    assert.deepEqual(
      getUsableFrontendProviderEntries(null),
      getSelectableFrontendProviderEntries(),
    );
    assert.deepEqual(
      resolveFrontendProviderModelSelectionWithinUsable({}, null),
      FRONTEND_PRIVATE_BETA_DEFAULT_SELECTION,
    );
    assert.deepEqual(
      resolveFrontendProviderModelSelectionWithinUsable(
        { providerId: 'openai', modelId: 'gpt-6-luna' },
        null,
      ),
      resolveFrontendProviderModelSelection({ providerId: 'openai', modelId: 'gpt-6-luna' }),
    );
    assert.deepEqual(
      resolveFrontendProviderModelSelectionWithinUsable({ providerId: 'stub' }, null),
      resolveFrontendProviderModelSelection({ providerId: 'stub' }),
    );
  });

  test('the filter keeps catalogue order and offers only usable providers', () => {
    assert.deepEqual(usableIds(['anthropic', 'groq']), ['groq', 'anthropic']);
    assert.deepEqual(usableIds(['openai']), ['openai']);
  });

  test('an empty list offers no provider and resolves to null', () => {
    assert.deepEqual(usableIds([]), []);
    assert.equal(resolveFrontendProviderModelSelectionWithinUsable({}, []), null);
    assert.equal(
      resolveFrontendProviderModelSelectionWithinUsable({ providerId: 'xai', modelId: 'grok-4.5' }, []),
      null,
    );
  });

  test('stub is never offered, even when listed as usable', () => {
    assert.deepEqual(usableIds(['stub']), []);
    assert.deepEqual(usableIds(['stub', 'deepseek']), ['deepseek']);
    assert.equal(resolveFrontendProviderModelSelectionWithinUsable({ providerId: 'stub' }, ['stub']), null);
  });

  test('a list with xai keeps the xai default', () => {
    assert.deepEqual(
      resolveFrontendProviderModelSelectionWithinUsable(
        {
          providerId: FRONTEND_PRIVATE_BETA_DEFAULT_SELECTION.providerId,
          modelId: FRONTEND_PRIVATE_BETA_DEFAULT_SELECTION.modelId,
        },
        ['xai', 'anthropic'],
      ),
      { providerId: 'xai', modelId: 'grok-4.5', optionValue: 'xai:grok-4.5' },
    );
  });

  test('a list without xai moves the default to the first usable provider and its default model', () => {
    assert.deepEqual(
      resolveFrontendProviderModelSelectionWithinUsable(
        { providerId: 'xai', modelId: 'grok-4.5' },
        ['anthropic', 'groq'],
      ),
      {
        providerId: 'groq',
        modelId: 'openai/gpt-oss-120b',
        optionValue: 'groq:openai/gpt-oss-120b',
      },
    );
    assert.deepEqual(
      resolveFrontendProviderModelSelectionWithinUsable(
        { providerId: 'xai', modelId: 'grok-4.7' },
        ['anthropic'],
      ),
      {
        providerId: 'anthropic',
        modelId: 'claude-sonnet-5-5',
        optionValue: 'anthropic:claude-sonnet-5-5',
      },
    );
  });

  test('a chosen usable provider and model are kept', () => {
    assert.deepEqual(
      resolveFrontendProviderModelSelectionWithinUsable(
        { providerId: 'anthropic', modelId: 'claude-opus-5-5' },
        ['groq', 'anthropic'],
      ),
      {
        providerId: 'anthropic',
        modelId: 'claude-opus-5-5',
        optionValue: 'anthropic:claude-opus-5-5',
      },
    );
    assert.deepEqual(
      resolveFrontendProviderModelSelectionWithinUsable(
        { optionValue: 'openai:gpt-6-luna' },
        ['xai', 'openai'],
      ),
      { providerId: 'openai', modelId: 'gpt-6-luna', optionValue: 'openai:gpt-6-luna' },
    );
  });

  test('the existing default selection is unchanged', () => {
    assert.deepEqual(FRONTEND_PRIVATE_BETA_DEFAULT_SELECTION, {
      providerId: 'xai',
      modelId: 'grok-4.5',
      optionValue: 'xai:grok-4.5',
    });
  });
});
