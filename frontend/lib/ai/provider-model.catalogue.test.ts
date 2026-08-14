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
  resolveFrontendProviderModelPayload,
  resolveFrontendProviderModelSelection,
} from './provider-model.catalogue';

function catalogueModelIds(providerId: string): string[] {
  return getSelectableFrontendModelEntriesForProvider(providerId).map((entry) => entry.modelId);
}

describe('frontend provider/model catalogue hardening', () => {
  test('contains the approved Step 2a provider/model options', () => {
    const selectableProviders = getSelectableFrontendProviderEntries().map(
      (provider) => provider.providerId,
    );
    assert.deepEqual(selectableProviders, ['xai', 'groq', 'deepseek', 'openai']);
    assert.deepEqual(catalogueModelIds('xai'), ['grok-4.5']);
    assert.deepEqual(catalogueModelIds('groq'), ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
    assert.deepEqual(catalogueModelIds('deepseek'), ['deepseek-v4-flash', 'deepseek-v4-pro']);
    assert.deepEqual(catalogueModelIds('openai'), ['gpt-4o']);
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
    assert.deepEqual(catalogueModelIds('xai'), ['grok-4.5']);
    assert.equal(catalogueModelIds('xai').includes('grok-4.20'), false);
  });

  test('selecting Groq exposes only Groq models', () => {
    assert.deepEqual(catalogueModelIds('groq'), ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
  });

  test('selecting DeepSeek exposes only DeepSeek models', () => {
    assert.deepEqual(catalogueModelIds('deepseek'), ['deepseek-v4-flash', 'deepseek-v4-pro']);
  });

  test('selecting OpenAI exposes gpt-4o', () => {
    assert.deepEqual(catalogueModelIds('openai'), ['gpt-4o']);
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
    assert.equal(migrated.modelId, 'deepseek-v4-flash');
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

  test('anthropic stays backend-supported but hidden from frontend selection', () => {
    const selectableProviderIds = getSelectableFrontendProviderEntries().map(
      (provider) => provider.providerId,
    );
    assert.equal(selectableProviderIds.includes('anthropic'), false);

    const anthropicSelection = resolveFrontendProviderModelSelection({
      providerId: 'anthropic',
      modelId: 'any-anthropic-model',
    });
    assert.equal(anthropicSelection.providerId, 'xai');
    assert.equal(anthropicSelection.modelId, 'grok-4.5');
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
