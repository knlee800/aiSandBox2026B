import type {
  AgentHarnessContractVersionV1,
} from '../contracts/agent-harness.contracts';
import type { AgentHarnessModelProfileV1 } from '../model-profiles/model-profile.contracts';
import type {
  AgentHarnessToolAllowedModeV1,
  AgentHarnessToolIdV1,
  AgentHarnessToolImplementationStatusV1,
} from '../tools/tool-registry.contracts';

export type AgentHarnessPromptTemplateIdV1 =
  | 'system_base'
  | 'planning_instruction'
  | 'tool_selection'
  | 'tool_result_interpretation'
  | 'file_change_instruction'
  | 'validation_instruction'
  | 'repair_instruction'
  | 'final_response';

export type AgentHarnessPromptTemplateCategoryV1 =
  | 'system'
  | 'planning'
  | 'tooling'
  | 'file-change'
  | 'validation'
  | 'repair'
  | 'response';

export type AgentHarnessPromptTemplateImplementationStatusV1 =
  AgentHarnessToolImplementationStatusV1;

export type AgentHarnessPromptTemplateAllowedModeV1 = AgentHarnessToolAllowedModeV1;

export type AgentHarnessPromptTemplateSafetyScopeV1 =
  | 'read-only-guidance'
  | 'tool-planning-only'
  | 'change-scope-constrained'
  | 'validation-allow-list-only'
  | 'repair-guidance-only'
  | 'response-only';

export type AgentHarnessPromptTemplateVariableTypeV1 =
  | 'string'
  | 'string[]'
  | 'number'
  | 'boolean'
  | 'json';

export interface AgentHarnessPromptTemplateVariableV1 {
  readonly name: string;
  readonly description: string;
  readonly type: AgentHarnessPromptTemplateVariableTypeV1;
  readonly example?: string;
  readonly allowedValues?: readonly string[];
}

export interface AgentHarnessPromptTemplateOutputExpectationV1 {
  readonly format: 'markdown' | 'text' | 'json';
  readonly mustInclude: readonly string[];
  readonly mustNotInclude?: readonly string[];
  readonly notes?: string;
}

export interface AgentHarnessPromptTemplateDefinitionV1 {
  readonly contractVersion: AgentHarnessContractVersionV1;
  readonly id: AgentHarnessPromptTemplateIdV1;
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  readonly category: AgentHarnessPromptTemplateCategoryV1;
  readonly version: string;
  readonly enabled: boolean;
  readonly implementationStatus: AgentHarnessPromptTemplateImplementationStatusV1;
  readonly inputVariables: readonly AgentHarnessPromptTemplateVariableV1[];
  readonly optionalInputVariables: readonly AgentHarnessPromptTemplateVariableV1[];
  readonly outputExpectation: AgentHarnessPromptTemplateOutputExpectationV1;
  readonly allowedModes: readonly AgentHarnessPromptTemplateAllowedModeV1[];
  readonly allowedModelProfiles: readonly AgentHarnessModelProfileV1['id'][];
  readonly allowedToolIds: readonly AgentHarnessToolIdV1[];
  readonly safetyScope: AgentHarnessPromptTemplateSafetyScopeV1;
  readonly tags: readonly string[];
  readonly notes: string;
}

export type AgentHarnessPromptTemplateMapV1 = Readonly<
  Record<AgentHarnessPromptTemplateIdV1, AgentHarnessPromptTemplateDefinitionV1>
>;
