import * as fs from 'fs';
import * as path from 'path';
import {
  AGENT_HARNESS_PROMPT_TEMPLATE_MAP_V1,
  AGENT_HARNESS_PROMPT_TEMPLATES_V1,
  getAgentHarnessPromptTemplate,
  isAgentHarnessPromptTemplateEnabled,
  listAgentHarnessPromptTemplates,
  listEnabledAgentHarnessPromptTemplates,
} from '../index';

describe('Agent Harness prompt template registry (v1)', () => {
  it('exports the intended planned prompt templates', () => {
    const templateIds = AGENT_HARNESS_PROMPT_TEMPLATES_V1.map((template) => template.id);

    expect(templateIds).toEqual(
      expect.arrayContaining([
        'system_base',
        'planning_instruction',
        'tool_selection',
        'tool_result_interpretation',
        'file_change_instruction',
        'validation_instruction',
        'repair_instruction',
        'final_response',
      ]),
    );
    expect(templateIds).toHaveLength(8);
  });

  it('ensures each prompt template has required contract fields', () => {
    for (const template of AGENT_HARNESS_PROMPT_TEMPLATES_V1) {
      expect(template.contractVersion).toBe('v1');
      expect(typeof template.id).toBe('string');
      expect(template.id.trim().length).toBeGreaterThan(0);
      expect(typeof template.name).toBe('string');
      expect(template.name.trim().length).toBeGreaterThan(0);
      expect(typeof template.displayName).toBe('string');
      expect(template.displayName.trim().length).toBeGreaterThan(0);
      expect(typeof template.description).toBe('string');
      expect(template.description.trim().length).toBeGreaterThan(0);
      expect(typeof template.category).toBe('string');
      expect(typeof template.version).toBe('string');
      expect(template.version.trim().length).toBeGreaterThan(0);
      expect(typeof template.enabled).toBe('boolean');
      expect(typeof template.implementationStatus).toBe('string');
      expect(Array.isArray(template.inputVariables)).toBe(true);
      expect(Array.isArray(template.optionalInputVariables)).toBe(true);
      expect(typeof template.outputExpectation.format).toBe('string');
      expect(Array.isArray(template.outputExpectation.mustInclude)).toBe(true);
      expect(Array.isArray(template.allowedModes)).toBe(true);
      expect(Array.isArray(template.allowedModelProfiles)).toBe(true);
      expect(Array.isArray(template.allowedToolIds)).toBe(true);
      expect(typeof template.safetyScope).toBe('string');
      expect(Array.isArray(template.tags)).toBe(true);
      expect(typeof template.notes).toBe('string');
    }
  });

  it('enforces unique prompt template ids and a matching map size', () => {
    const uniqueIds = new Set(AGENT_HARNESS_PROMPT_TEMPLATES_V1.map((template) => template.id));

    expect(uniqueIds.size).toBe(AGENT_HARNESS_PROMPT_TEMPLATES_V1.length);
    expect(Object.keys(AGENT_HARNESS_PROMPT_TEMPLATE_MAP_V1)).toHaveLength(uniqueIds.size);
  });

  it('ensures versions are present for all templates', () => {
    for (const template of AGENT_HARNESS_PROMPT_TEMPLATES_V1) {
      expect(template.version).toBeTruthy();
      expect(template.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('keeps implementation status metadata conservative', () => {
    const validImplementationStatuses = new Set(['planned', 'contract-only']);

    for (const template of AGENT_HARNESS_PROMPT_TEMPLATES_V1) {
      expect(validImplementationStatuses.has(template.implementationStatus)).toBe(true);
      expect(template.enabled).toBe(false);
    }
  });

  it('returns expected prompt template for lookup helper', () => {
    const template = getAgentHarnessPromptTemplate('tool_selection');

    expect(template).toBeDefined();
    expect(template?.name).toBe('tool_selection');
    expect(template?.category).toBe('tooling');
    expect(template?.allowedToolIds.length).toBeGreaterThan(0);
  });

  it('handles missing prompt template lookup safely', () => {
    const missingTemplate = getAgentHarnessPromptTemplate('missing_template_id');

    expect(missingTemplate).toBeUndefined();
    expect(isAgentHarnessPromptTemplateEnabled('missing_template_id')).toBe(false);
  });

  it('returns stable list data and correct enabled-list helper behavior', () => {
    const allTemplates = listAgentHarnessPromptTemplates();
    const enabledTemplates = listEnabledAgentHarnessPromptTemplates();
    const expectedEnabledTemplates = allTemplates.filter((template) => template.enabled);

    expect(allTemplates).toBe(AGENT_HARNESS_PROMPT_TEMPLATES_V1);
    expect(enabledTemplates).toEqual(expectedEnabledTemplates);
    expect(enabledTemplates).toHaveLength(0);

    for (const template of enabledTemplates) {
      expect(isAgentHarnessPromptTemplateEnabled(template.id)).toBe(true);
    }
  });

  it('makes prompt template exports available from stable agent-harness index', () => {
    expect(AGENT_HARNESS_PROMPT_TEMPLATES_V1.length).toBeGreaterThan(0);
    expect(Object.keys(AGENT_HARNESS_PROMPT_TEMPLATE_MAP_V1).length).toBeGreaterThan(0);
  });

  it('does not require runtime wiring imports yet', () => {
    const workerProcessorPath = path.resolve(
      __dirname,
      '../../worker/worker.processor.ts',
    );
    const aiExecutionServicePath = path.resolve(
      __dirname,
      '../../ai-execution/ai-execution.service.ts',
    );

    const workerProcessorContent = fs.readFileSync(workerProcessorPath, 'utf8');
    const aiExecutionServiceContent = fs.readFileSync(aiExecutionServicePath, 'utf8');

    expect(workerProcessorContent).not.toContain('agent-harness/prompts');
    expect(aiExecutionServiceContent).not.toContain('agent-harness/prompts');
  });
});
