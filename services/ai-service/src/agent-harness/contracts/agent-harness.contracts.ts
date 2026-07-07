/**
 * Agent Harness v1 Contracts
 *
 * Foundational typed contracts for future agent harness slices.
 * This file intentionally defines shape only (no runtime behavior wiring).
 */

export const AGENT_HARNESS_CONTRACT_VERSION_V1 = 'v1' as const;

export type AgentHarnessContractVersionV1 =
  typeof AGENT_HARNESS_CONTRACT_VERSION_V1;

export type AgentHarnessModeV1 = 'plan' | 'execute' | 'review';

export type AgentHarnessRunStatusV1 =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentHarnessModelProfileReferenceV1 {
  readonly profileId: string;
  readonly providerHint?: string;
  readonly modelHint?: string;
}

export interface AgentHarnessToolInputSchemaV1 {
  readonly schemaType: 'json-schema';
  readonly schema: Readonly<Record<string, unknown>>;
}

export interface AgentHarnessToolDefinitionV1 {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly inputSchema: AgentHarnessToolInputSchemaV1;
  readonly requiresApproval?: boolean;
  readonly tags?: readonly string[];
}

export interface AgentHarnessToolCallV1 {
  readonly callId: string;
  readonly toolId: string;
  readonly arguments: Readonly<Record<string, unknown>>;
  readonly requestedAtIso: string;
}

export interface AgentHarnessToolResultV1 {
  readonly callId: string;
  readonly toolId: string;
  readonly success: true;
  readonly content: Readonly<Record<string, unknown>>;
  readonly completedAtIso: string;
}

export interface AgentHarnessToolErrorV1 {
  readonly callId: string;
  readonly toolId: string;
  readonly success: false;
  readonly errorCode: string;
  readonly message: string;
  readonly isRetriable: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly failedAtIso: string;
}

export interface AgentHarnessPolicyV1 {
  readonly allowArbitraryShell: boolean;
  readonly allowedValidationCommands: readonly string[];
  readonly requireApprovalForDelete: boolean;
  readonly requireApprovalForPackageInstall: boolean;
  readonly requireApprovalForEnvFileWrite: boolean;
  readonly requireApprovalForLargeWrite: boolean;
}

export interface AgentHarnessConfigV1 extends AgentHarnessPolicyV1 {
  readonly contractVersion: AgentHarnessContractVersionV1;
  readonly maxToolIterations: number;
  readonly maxFileReadBytes: number;
  readonly maxFileWriteBytes: number;
  readonly maxToolResultBytes: number;
  readonly maxValidationOutputBytes: number;
  readonly toolTimeoutMs: number;
  readonly validationTimeoutMs: number;
  readonly browserSmokeTimeoutMs: number;
  readonly enableBrowserSmoke: boolean;
  readonly enableSemanticSearch: boolean;
  readonly enableToolLoop: boolean;
  readonly enablePreApplyCheckpoint: boolean;
  readonly auditEventsEnabled: boolean;
}

export interface AgentHarnessRunRequestV1 {
  readonly contractVersion: AgentHarnessContractVersionV1;
  readonly runId: string;
  readonly sessionId: string;
  readonly conversationId: string;
  readonly userId: string;
  readonly mode: AgentHarnessModeV1;
  readonly prompt: string;
  readonly systemPrompt?: string;
  readonly modelProfile?: AgentHarnessModelProfileReferenceV1;
  readonly metadata?: Readonly<Record<string, unknown>>;

  /** Per-builder identity fields for config resolution tracing (AGENT-HARNESS-07B). */
  readonly agentRole?: string;
  readonly builderProfileId?: string;
  readonly harnessProfileId?: string;
  readonly modelProfileId?: string;
  readonly toolPermissionProfileId?: string;
}

export interface AgentHarnessRunStateV1 {
  readonly contractVersion: AgentHarnessContractVersionV1;
  readonly runId: string;
  readonly status: AgentHarnessRunStatusV1;
  readonly mode: AgentHarnessModeV1;
  readonly toolIterationsUsed: number;
  readonly startedAtIso: string;
  readonly updatedAtIso: string;
  readonly completedAtIso?: string;
  readonly lastToolCall?: AgentHarnessToolCallV1;
  readonly lastToolResult?: AgentHarnessToolResultV1 | AgentHarnessToolErrorV1;
}

export interface AgentHarnessValidationResultV1 {
  readonly command: string;
  readonly success: boolean;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly durationMs: number;
}

export interface AgentHarnessBrowserSmokeResultV1 {
  readonly success: boolean;
  readonly scenario: string;
  readonly summary: string;
  readonly durationMs: number;
  readonly timedOut: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface AgentHarnessAuditEventV1 {
  readonly contractVersion: AgentHarnessContractVersionV1;
  readonly eventId: string;
  readonly runId: string;
  readonly eventType:
    | 'run-started'
    | 'run-completed'
    | 'run-failed'
    | 'tool-called'
    | 'tool-completed'
    | 'validation-ran'
    | 'browser-smoke-ran';
  readonly occurredAtIso: string;
  readonly payload: Readonly<Record<string, unknown>>;
}
