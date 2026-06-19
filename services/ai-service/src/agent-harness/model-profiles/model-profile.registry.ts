import { AGENT_HARNESS_CONTRACT_VERSION_V1 } from '../contracts/agent-harness.contracts';
import type {
  AgentHarnessModelProfileMapV1,
  AgentHarnessModelProfileV1,
} from './model-profile.contracts';

/**
 * Centralized Agent Harness model profile registry (v1).
 *
 * This module is intentionally data-only and pure:
 * - no runtime provider resolution
 * - no adapter wiring
 * - no external availability checks
 */
export const AGENT_HARNESS_MODEL_PROFILES_V1: readonly AgentHarnessModelProfileV1[] =
  Object.freeze([
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: 'anthropic.claude-3-5-sonnet',
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      displayName: 'Anthropic Claude 3.5 Sonnet',
      family: 'claude',
      purpose: 'general reasoning and coding',
      supportsTools: false,
      supportsStreaming: false,
      supportsJsonMode: false,
      supportsVision: false,
      contextWindowTokens: 8192,
      maxOutputTokens: 4096,
      defaultTemperature: 1.0,
      costTier: 'high',
      enabled: true,
      providerOptions: {},
      promptStyleNotes: 'Use concise structured instructions.',
      toolCallFormat: 'anthropic-messages',
      tags: ['default', 'stable', 'reasoning'],
    },
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: 'openai.gpt-4o',
      provider: 'openai',
      model: 'gpt-4o',
      displayName: 'OpenAI GPT-4o',
      family: 'gpt',
      purpose: 'general reasoning and coding',
      supportsTools: false,
      supportsStreaming: false,
      supportsJsonMode: false,
      supportsVision: false,
      contextWindowTokens: 8192,
      maxOutputTokens: 4096,
      defaultTemperature: 1.0,
      costTier: 'high',
      enabled: true,
      providerOptions: {},
      promptStyleNotes: 'Prefer explicit task boundaries and output format.',
      toolCallFormat: 'openai-chat-completions',
      tags: ['default', 'general'],
    },
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: 'groq.mixtral-8x7b-32768',
      provider: 'groq',
      model: 'mixtral-8x7b-32768',
      displayName: 'Groq Mixtral 8x7B',
      family: 'mixtral',
      purpose: 'fast general completion',
      supportsTools: false,
      supportsStreaming: false,
      supportsJsonMode: false,
      supportsVision: false,
      contextWindowTokens: 32768,
      maxOutputTokens: 4096,
      defaultTemperature: 1.0,
      costTier: 'medium',
      enabled: true,
      providerOptions: {},
      promptStyleNotes: 'Keep instructions compact for low-latency completions.',
      toolCallFormat: 'openai-chat-completions',
      tags: ['latency-optimized', 'general'],
    },
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: 'xai.grok-3',
      provider: 'xai',
      model: 'grok-3',
      displayName: 'xAI Grok 3',
      family: 'grok',
      purpose: 'general reasoning and coding',
      supportsTools: false,
      supportsStreaming: false,
      supportsJsonMode: false,
      supportsVision: false,
      contextWindowTokens: 8192,
      maxOutputTokens: 4096,
      defaultTemperature: 1.0,
      costTier: 'high',
      enabled: true,
      providerOptions: {
        baseURL: 'https://api.x.ai/v1',
      },
      promptStyleNotes: 'Use direct prompts with explicit required format.',
      toolCallFormat: 'openai-chat-completions',
      tags: ['general'],
    },
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: 'deepseek.deepseek-chat',
      provider: 'deepseek',
      model: 'deepseek-chat',
      displayName: 'DeepSeek Chat',
      family: 'deepseek',
      purpose: 'general coding and assistant tasks',
      supportsTools: false,
      supportsStreaming: false,
      supportsJsonMode: false,
      supportsVision: false,
      contextWindowTokens: 8192,
      maxOutputTokens: 4096,
      defaultTemperature: 1.0,
      costTier: 'low',
      enabled: true,
      providerOptions: {
        baseURL: 'https://api.deepseek.com',
      },
      promptStyleNotes: 'Use concise, deterministic instructions when possible.',
      toolCallFormat: 'openai-chat-completions',
      tags: ['cost-aware', 'general'],
    },
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: 'stub.default',
      provider: 'stub',
      model: 'stub',
      displayName: 'Stub Adapter',
      family: 'stub',
      purpose: 'deterministic test and wiring checks',
      supportsTools: false,
      supportsStreaming: false,
      supportsJsonMode: false,
      supportsVision: false,
      contextWindowTokens: 4096,
      maxOutputTokens: 4096,
      defaultTemperature: 0,
      costTier: 'low',
      enabled: true,
      providerOptions: {},
      promptStyleNotes: 'No model inference; deterministic placeholder output only.',
      toolCallFormat: 'none',
      tags: ['test', 'deterministic'],
    },
  ]);

const profilesById: Record<string, AgentHarnessModelProfileV1> = {};
for (const profile of AGENT_HARNESS_MODEL_PROFILES_V1) {
  profilesById[profile.id] = profile;
}

export const AGENT_HARNESS_MODEL_PROFILE_MAP_V1: AgentHarnessModelProfileMapV1 =
  Object.freeze(profilesById);

export function listAgentHarnessModelProfiles(): readonly AgentHarnessModelProfileV1[] {
  return AGENT_HARNESS_MODEL_PROFILES_V1;
}

export function listEnabledAgentHarnessModelProfiles(): readonly AgentHarnessModelProfileV1[] {
  return AGENT_HARNESS_MODEL_PROFILES_V1.filter((profile) => profile.enabled);
}

export function getAgentHarnessModelProfile(
  profileId: string,
): AgentHarnessModelProfileV1 | undefined {
  return AGENT_HARNESS_MODEL_PROFILE_MAP_V1[profileId];
}

export function isAgentHarnessModelProfileEnabled(profileId: string): boolean {
  const profile = getAgentHarnessModelProfile(profileId);
  return profile?.enabled === true;
}
