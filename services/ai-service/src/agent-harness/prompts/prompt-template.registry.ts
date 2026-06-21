import { AGENT_HARNESS_CONTRACT_VERSION_V1 } from '../contracts/agent-harness.contracts';
import { AGENT_HARNESS_MODEL_PROFILES_V1 } from '../model-profiles/model-profile.registry';
import type { AgentHarnessToolIdV1 } from '../tools/tool-registry.contracts';
import type {
  AgentHarnessPromptTemplateDefinitionV1,
  AgentHarnessPromptTemplateIdV1,
  AgentHarnessPromptTemplateMapV1,
} from './prompt-template.contracts';

const ALL_MODEL_PROFILE_IDS_V1: readonly string[] = Object.freeze(
  AGENT_HARNESS_MODEL_PROFILES_V1.map((profile) => profile.id),
);

const TOOLING_PROMPT_ALLOWED_TOOL_IDS_V1: readonly AgentHarnessToolIdV1[] = Object.freeze([
  'list_files',
  'read_file',
  'write_file',
  'delete_file',
  'run_validation',
  'start_preview',
  'browser_smoke',
  'search_workspace',
]);

/**
 * Centralized Agent Harness prompt template registry metadata (v1).
 *
 * This registry is intentionally data-only for contract/planning purposes:
 * - no prompt rendering
 * - no prompt routing
 * - no WorkerProcessor or AIExecutionService integration
 */
export const AGENT_HARNESS_PROMPT_TEMPLATES_V1: readonly AgentHarnessPromptTemplateDefinitionV1[] =
  Object.freeze([
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: 'system_base',
      name: 'system_base',
      displayName: 'System Base Prompt',
      description: 'Baseline system-level behavior and guardrails for Agent Harness runs.',
      category: 'system',
      version: '1.0.0',
      enabled: false,
      implementationStatus: 'contract-only',
      inputVariables: [
        {
          name: 'task_goal',
          description: 'High-level task objective for the current run.',
          type: 'string',
        },
      ],
      optionalInputVariables: [
        {
          name: 'task_constraints',
          description: 'Additional constraints such as policy or scope limits.',
          type: 'string[]',
        },
      ],
      outputExpectation: {
        format: 'markdown',
        mustInclude: ['safety boundaries', 'task alignment'],
        mustNotInclude: ['implementation side effects'],
        notes: 'Contract-only prompt metadata; not rendered in runtime.',
      },
      allowedModes: ['plan', 'execute', 'review'],
      allowedModelProfiles: ALL_MODEL_PROFILE_IDS_V1,
      allowedToolIds: [],
      safetyScope: 'read-only-guidance',
      tags: ['planned', 'metadata-only', 'system'],
      notes: 'No runtime wiring in this slice.',
    },
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: 'planning_instruction',
      name: 'planning_instruction',
      displayName: 'Planning Instruction Prompt',
      description: 'Guidance for planning-only steps before code modification.',
      category: 'planning',
      version: '1.0.0',
      enabled: false,
      implementationStatus: 'contract-only',
      inputVariables: [
        {
          name: 'requested_change',
          description: 'What the user asked to change.',
          type: 'string',
        },
      ],
      optionalInputVariables: [
        {
          name: 'known_risks',
          description: 'Known risks to account for in a plan.',
          type: 'string[]',
        },
      ],
      outputExpectation: {
        format: 'markdown',
        mustInclude: ['small reversible steps'],
        mustNotInclude: ['implicit runtime behavior changes'],
      },
      allowedModes: ['plan', 'review'],
      allowedModelProfiles: ALL_MODEL_PROFILE_IDS_V1,
      allowedToolIds: [],
      safetyScope: 'read-only-guidance',
      tags: ['planned', 'metadata-only', 'planning'],
      notes: 'No plan-mode routing is implemented in this slice.',
    },
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: 'tool_selection',
      name: 'tool_selection',
      displayName: 'Tool Selection Prompt',
      description: 'Tool-selection planning guidance for future tool loop slices.',
      category: 'tooling',
      version: '1.0.0',
      enabled: false,
      implementationStatus: 'planned',
      inputVariables: [
        {
          name: 'current_step_goal',
          description: 'Immediate objective for a potential tool action.',
          type: 'string',
        },
      ],
      optionalInputVariables: [
        {
          name: 'candidate_tools',
          description: 'List of candidate tool IDs available for planning.',
          type: 'string[]',
        },
      ],
      outputExpectation: {
        format: 'markdown',
        mustInclude: ['selected tool id', 'why this tool'],
        mustNotInclude: ['direct tool execution'],
        notes: 'Selection-only metadata; execution remains disabled.',
      },
      allowedModes: ['execute', 'review'],
      allowedModelProfiles: ALL_MODEL_PROFILE_IDS_V1,
      allowedToolIds: TOOLING_PROMPT_ALLOWED_TOOL_IDS_V1,
      safetyScope: 'tool-planning-only',
      tags: ['planned', 'metadata-only', 'tooling'],
      notes: 'References planned tool IDs without enabling runtime tool calls.',
    },
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: 'tool_result_interpretation',
      name: 'tool_result_interpretation',
      displayName: 'Tool Result Interpretation Prompt',
      description: 'Guidance for interpreting tool outputs in future slices.',
      category: 'tooling',
      version: '1.0.0',
      enabled: false,
      implementationStatus: 'planned',
      inputVariables: [
        {
          name: 'tool_result',
          description: 'Structured tool result payload.',
          type: 'json',
        },
      ],
      optionalInputVariables: [
        {
          name: 'tool_error',
          description: 'Tool error payload when a tool call fails.',
          type: 'json',
        },
      ],
      outputExpectation: {
        format: 'markdown',
        mustInclude: ['result summary', 'next safe action'],
        mustNotInclude: ['automatic retry behavior'],
      },
      allowedModes: ['execute', 'review'],
      allowedModelProfiles: ALL_MODEL_PROFILE_IDS_V1,
      allowedToolIds: TOOLING_PROMPT_ALLOWED_TOOL_IDS_V1,
      safetyScope: 'tool-planning-only',
      tags: ['planned', 'metadata-only', 'tooling', 'result-analysis'],
      notes: 'Does not imply tool orchestration exists yet.',
    },
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: 'file_change_instruction',
      name: 'file_change_instruction',
      displayName: 'File Change Instruction Prompt',
      description: 'Conservative file-change guidance for scoped modifications.',
      category: 'file-change',
      version: '1.0.0',
      enabled: false,
      implementationStatus: 'contract-only',
      inputVariables: [
        {
          name: 'target_files',
          description: 'Files explicitly within scope for edits.',
          type: 'string[]',
        },
      ],
      optionalInputVariables: [
        {
          name: 'out_of_scope_files',
          description: 'Files that must not be changed.',
          type: 'string[]',
        },
      ],
      outputExpectation: {
        format: 'markdown',
        mustInclude: ['scope boundaries', 'minimal diffs'],
        mustNotInclude: ['broad refactors'],
      },
      allowedModes: ['execute', 'review'],
      allowedModelProfiles: ALL_MODEL_PROFILE_IDS_V1,
      allowedToolIds: ['write_file', 'delete_file'],
      safetyScope: 'change-scope-constrained',
      tags: ['planned', 'metadata-only', 'file-change', 'safety'],
      notes: 'Explicitly conservative; no runtime application logic added.',
    },
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: 'validation_instruction',
      name: 'validation_instruction',
      displayName: 'Validation Instruction Prompt',
      description: 'Guidance for focused validation command selection.',
      category: 'validation',
      version: '1.0.0',
      enabled: false,
      implementationStatus: 'contract-only',
      inputVariables: [
        {
          name: 'changed_area',
          description: 'The module/scope that changed and needs validation.',
          type: 'string',
        },
      ],
      optionalInputVariables: [
        {
          name: 'allowed_validation_commands',
          description: 'Allow-listed validation commands for the task.',
          type: 'string[]',
        },
      ],
      outputExpectation: {
        format: 'markdown',
        mustInclude: ['relevant validation commands', 'result summary'],
        mustNotInclude: ['arbitrary shell execution'],
      },
      allowedModes: ['execute', 'review'],
      allowedModelProfiles: ALL_MODEL_PROFILE_IDS_V1,
      allowedToolIds: ['run_validation'],
      safetyScope: 'validation-allow-list-only',
      tags: ['planned', 'metadata-only', 'validation', 'allow-list-only'],
      notes: 'Validation guidance only; no command execution behavior changed.',
    },
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: 'repair_instruction',
      name: 'repair_instruction',
      displayName: 'Repair Instruction Prompt',
      description: 'Guidance for incremental fixes after validation failures.',
      category: 'repair',
      version: '1.0.0',
      enabled: false,
      implementationStatus: 'planned',
      inputVariables: [
        {
          name: 'failure_summary',
          description: 'Summary of observed failures that need repair.',
          type: 'string',
        },
      ],
      optionalInputVariables: [
        {
          name: 'repair_attempt_count',
          description: 'Number of repair attempts already performed.',
          type: 'number',
        },
      ],
      outputExpectation: {
        format: 'markdown',
        mustInclude: ['focused fix proposal', 're-validation step'],
        mustNotInclude: ['automatic retry loop'],
      },
      allowedModes: ['execute', 'review'],
      allowedModelProfiles: ALL_MODEL_PROFILE_IDS_V1,
      allowedToolIds: ['write_file', 'run_validation'],
      safetyScope: 'repair-guidance-only',
      tags: ['planned', 'metadata-only', 'repair'],
      notes: 'No automatic retry or self-loop behavior is introduced in this slice.',
    },
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: 'final_response',
      name: 'final_response',
      displayName: 'Final Response Prompt',
      description: 'Final-response formatting guidance for future prompt slices.',
      category: 'response',
      version: '1.0.0',
      enabled: false,
      implementationStatus: 'contract-only',
      inputVariables: [
        {
          name: 'implementation_summary',
          description: 'Summary of completed implementation work.',
          type: 'string',
        },
      ],
      optionalInputVariables: [
        {
          name: 'validation_results',
          description: 'Validation outcomes to include in final response.',
          type: 'string[]',
        },
      ],
      outputExpectation: {
        format: 'markdown',
        mustInclude: ['files changed', 'validation results', 'constraints confirmation'],
        mustNotInclude: ['behavior claims not validated'],
      },
      allowedModes: ['plan', 'execute', 'review'],
      allowedModelProfiles: ALL_MODEL_PROFILE_IDS_V1,
      allowedToolIds: [],
      safetyScope: 'response-only',
      tags: ['planned', 'metadata-only', 'response'],
      notes: 'No change to current runtime final response behavior.',
    },
  ]);

const templatesById: Partial<
  Record<AgentHarnessPromptTemplateIdV1, AgentHarnessPromptTemplateDefinitionV1>
> = {};
for (const template of AGENT_HARNESS_PROMPT_TEMPLATES_V1) {
  templatesById[template.id] = template;
}

export const AGENT_HARNESS_PROMPT_TEMPLATE_MAP_V1: AgentHarnessPromptTemplateMapV1 =
  Object.freeze(templatesById as AgentHarnessPromptTemplateMapV1);

export function listAgentHarnessPromptTemplates(): readonly AgentHarnessPromptTemplateDefinitionV1[] {
  return AGENT_HARNESS_PROMPT_TEMPLATES_V1;
}

export function listEnabledAgentHarnessPromptTemplates(): readonly AgentHarnessPromptTemplateDefinitionV1[] {
  return AGENT_HARNESS_PROMPT_TEMPLATES_V1.filter((template) => template.enabled);
}

export function getAgentHarnessPromptTemplate(
  templateId: string,
): AgentHarnessPromptTemplateDefinitionV1 | undefined {
  return AGENT_HARNESS_PROMPT_TEMPLATE_MAP_V1[templateId as AgentHarnessPromptTemplateIdV1];
}

export function isAgentHarnessPromptTemplateEnabled(templateId: string): boolean {
  const template = getAgentHarnessPromptTemplate(templateId);
  return template?.enabled === true;
}
