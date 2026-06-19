import type {
  AgentHarnessContractVersionV1,
} from '../contracts/agent-harness.contracts';

export type AgentHarnessModelProviderV1 =
  | 'anthropic'
  | 'openai'
  | 'groq'
  | 'xai'
  | 'deepseek'
  | 'stub';

export type AgentHarnessModelCostTierV1 = 'low' | 'medium' | 'high' | 'premium';

export type AgentHarnessModelToolCallFormatV1 =
  | 'none'
  | 'anthropic-messages'
  | 'openai-chat-completions';

export interface AgentHarnessModelProfileV1 {
  readonly contractVersion: AgentHarnessContractVersionV1;
  readonly id: string;
  readonly provider: AgentHarnessModelProviderV1;
  readonly model: string;
  readonly displayName: string;
  readonly family: string;
  readonly purpose: string;
  readonly supportsTools: boolean;
  readonly supportsStreaming: boolean;
  readonly supportsJsonMode: boolean;
  readonly supportsVision: boolean;
  readonly contextWindowTokens: number;
  readonly maxOutputTokens: number;
  readonly defaultTemperature: number;
  readonly costTier: AgentHarnessModelCostTierV1;
  readonly enabled: boolean;
  readonly providerOptions?: Readonly<Record<string, unknown>>;
  readonly promptStyleNotes?: string;
  readonly toolCallFormat?: AgentHarnessModelToolCallFormatV1;
  readonly fallbackProfileId?: string;
  readonly tags: readonly string[];
}

export type AgentHarnessModelProfileMapV1 = Readonly<
  Record<string, AgentHarnessModelProfileV1>
>;
