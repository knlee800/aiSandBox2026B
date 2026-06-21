import type {
  AgentHarnessContractVersionV1,
  AgentHarnessModeV1,
  AgentHarnessToolInputSchemaV1,
} from '../contracts/agent-harness.contracts';

export type AgentHarnessToolIdV1 =
  | 'list_files'
  | 'read_file'
  | 'write_file'
  | 'delete_file'
  | 'run_validation'
  | 'start_preview'
  | 'browser_smoke'
  | 'search_workspace';

export type AgentHarnessToolCategoryV1 =
  | 'workspace'
  | 'validation'
  | 'preview'
  | 'browser'
  | 'search';

export type AgentHarnessToolRiskLevelV1 =
  | 'low'
  | 'medium'
  | 'high'
  | 'destructive';

export type AgentHarnessToolImplementationStatusV1 =
  | 'planned'
  | 'contract-only'
  | 'implemented';

export type AgentHarnessToolAllowedModeV1 = AgentHarnessModeV1;

export type AgentHarnessToolAllowedScopeV1 =
  | 'workspace'
  | 'repository'
  | 'session';

export type AgentHarnessToolAuditEventTypeV1 =
  | 'tool-called'
  | 'tool-completed'
  | 'tool-approved'
  | 'tool-denied'
  | 'tool-blocked';

export type AgentHarnessToolOutputSchemaV1 = AgentHarnessToolInputSchemaV1;

export interface AgentHarnessToolRegistryDefinitionV1 {
  readonly contractVersion: AgentHarnessContractVersionV1;
  readonly id: AgentHarnessToolIdV1;
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  readonly category: AgentHarnessToolCategoryV1;
  readonly inputSchema: AgentHarnessToolInputSchemaV1;
  readonly outputSchema?: AgentHarnessToolOutputSchemaV1;
  readonly riskLevel: AgentHarnessToolRiskLevelV1;
  readonly requiresApproval: boolean;
  readonly enabled: boolean;
  readonly timeoutMs: number;
  readonly maxInputBytes: number;
  readonly maxOutputBytes: number;
  readonly allowedModes: readonly AgentHarnessToolAllowedModeV1[];
  readonly allowedScopes: readonly AgentHarnessToolAllowedScopeV1[];
  readonly auditEventTypes: readonly AgentHarnessToolAuditEventTypeV1[];
  readonly tags: readonly string[];
  readonly implementationStatus: AgentHarnessToolImplementationStatusV1;
}

export type AgentHarnessToolDefinitionMapV1 = Readonly<
  Record<string, AgentHarnessToolRegistryDefinitionV1>
>;
