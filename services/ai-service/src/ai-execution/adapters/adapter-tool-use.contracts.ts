import type { AIExecutionResult } from '../types';
import type {
  AgentHarnessToolImplementationStatusV1,
  AgentHarnessToolRegistryDefinitionV1,
} from '../../agent-harness/tools/tool-registry.contracts';

export type AIAdapterToolCallProviderKind =
  | 'anthropic-tool_use'
  | 'openai-tool_calls'
  | 'openai-function_call'
  | 'stub';

export type AIAdapterToolUseFinishReason =
  | 'completed'
  | 'tool_calls'
  | 'max_tokens'
  | 'stop'
  | 'unknown';

export interface AIAdapterToolDeclaration {
  readonly sourceToolId: string;
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly requiresApproval: boolean;
  readonly enabled: boolean;
  readonly implementationStatus: AgentHarnessToolImplementationStatusV1;
}

export interface AIAdapterToolCallMetadata {
  readonly callId: string;
  readonly toolName: string;
  readonly arguments: Readonly<Record<string, unknown>>;
  readonly providerKind: AIAdapterToolCallProviderKind;
}

export interface AIAdapterToolResultPayload {
  readonly callId: string;
  readonly toolName: string;
  readonly success: boolean;
  readonly content?: Readonly<Record<string, unknown>>;
  readonly errorMessage?: string;
}

export interface AIAdapterToolUseRequestOptions {
  readonly tools?: readonly AgentHarnessToolRegistryDefinitionV1[];
  readonly toolResults?: readonly AIAdapterToolResultPayload[];
}

export interface AIAdapterToolUseResult extends AIExecutionResult {
  readonly finishReason: AIAdapterToolUseFinishReason;
  readonly toolCalls: readonly AIAdapterToolCallMetadata[];
}

