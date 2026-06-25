import * as fs from 'fs';
import * as path from 'path';
import {
  AGENT_HARNESS_TOOL_DEFINITION_MAP_V1,
  AGENT_HARNESS_TOOL_DEFINITIONS_V1,
  doesAgentHarnessToolRequireApproval,
  getAgentHarnessToolDefinition,
  isAgentHarnessToolEnabled,
  listAgentHarnessToolDefinitions,
  listEnabledAgentHarnessToolDefinitions,
} from '../index';

describe('Agent Harness tool registry (v1)', () => {
  it('exports the intended planned tool definitions', () => {
    const toolIds = AGENT_HARNESS_TOOL_DEFINITIONS_V1.map((tool) => tool.id);

    expect(toolIds).toEqual(
      expect.arrayContaining([
        'list_files',
        'read_file',
        'write_file',
        'delete_file',
        'run_validation',
        'start_preview',
        'browser_smoke',
        'search_workspace',
      ]),
    );
    expect(toolIds).toHaveLength(8);
  });

  it('ensures each tool has required contract fields', () => {
    for (const tool of AGENT_HARNESS_TOOL_DEFINITIONS_V1) {
      expect(tool.contractVersion).toBe('v1');
      expect(typeof tool.id).toBe('string');
      expect(tool.id.trim().length).toBeGreaterThan(0);
      expect(typeof tool.name).toBe('string');
      expect(tool.name.trim().length).toBeGreaterThan(0);
      expect(typeof tool.displayName).toBe('string');
      expect(tool.displayName.trim().length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe('string');
      expect(tool.description.trim().length).toBeGreaterThan(0);
      expect(typeof tool.category).toBe('string');
      expect(tool.inputSchema.schemaType).toBe('json-schema');
      expect(typeof tool.requiresApproval).toBe('boolean');
      expect(typeof tool.enabled).toBe('boolean');
      expect(typeof tool.timeoutMs).toBe('number');
      expect(tool.timeoutMs).toBeGreaterThan(0);
      expect(typeof tool.maxInputBytes).toBe('number');
      expect(tool.maxInputBytes).toBeGreaterThan(0);
      expect(typeof tool.maxOutputBytes).toBe('number');
      expect(tool.maxOutputBytes).toBeGreaterThan(0);
      expect(Array.isArray(tool.allowedModes)).toBe(true);
      expect(Array.isArray(tool.allowedScopes)).toBe(true);
      expect(Array.isArray(tool.auditEventTypes)).toBe(true);
      expect(Array.isArray(tool.tags)).toBe(true);
      expect(typeof tool.implementationStatus).toBe('string');
    }
  });

  it('enforces unique tool ids and a matching map size', () => {
    const uniqueIds = new Set(AGENT_HARNESS_TOOL_DEFINITIONS_V1.map((tool) => tool.id));

    expect(uniqueIds.size).toBe(AGENT_HARNESS_TOOL_DEFINITIONS_V1.length);
    expect(Object.keys(AGENT_HARNESS_TOOL_DEFINITION_MAP_V1)).toHaveLength(
      uniqueIds.size,
    );
  });

  it('ensures risk levels are present and valid', () => {
    const validRiskLevels = new Set(['low', 'medium', 'high', 'destructive']);

    for (const tool of AGENT_HARNESS_TOOL_DEFINITIONS_V1) {
      expect(validRiskLevels.has(tool.riskLevel)).toBe(true);
    }
  });

  it('keeps approval metadata conservative for risky write/delete classes', () => {
    const writeTool = getAgentHarnessToolDefinition('write_file');
    const deleteTool = getAgentHarnessToolDefinition('delete_file');
    const browserSmokeTool = getAgentHarnessToolDefinition('browser_smoke');

    expect(writeTool).toBeDefined();
    expect(writeTool?.requiresApproval).toBe(true);
    expect(writeTool?.riskLevel === 'high' || writeTool?.riskLevel === 'destructive').toBe(
      true,
    );

    expect(deleteTool).toBeDefined();
    expect(deleteTool?.requiresApproval).toBe(true);
    expect(deleteTool?.riskLevel).toBe('destructive');

    expect(browserSmokeTool).toBeDefined();
    expect(browserSmokeTool?.riskLevel).toBe('high');

    const packageOrEnvRiskTools = AGENT_HARNESS_TOOL_DEFINITIONS_V1.filter((tool) =>
      tool.tags.some((tag) => tag.includes('package') || tag.includes('env')),
    );

    for (const riskyTool of packageOrEnvRiskTools) {
      expect(riskyTool.requiresApproval).toBe(true);
    }
  });

  it('returns expected tool definition for lookup helper', () => {
    const tool = getAgentHarnessToolDefinition('read_file');

    expect(tool).toBeDefined();
    expect(tool?.name).toBe('read_file');
    expect(tool?.category).toBe('workspace');
  });

  it('handles missing tool lookup safely', () => {
    const missingTool = getAgentHarnessToolDefinition('missing_tool_id');

    expect(missingTool).toBeUndefined();
    expect(isAgentHarnessToolEnabled('missing_tool_id')).toBe(false);
    expect(doesAgentHarnessToolRequireApproval('missing_tool_id')).toBe(false);
  });

  it('returns stable list data and correct enabled-list helper behavior', () => {
    const allTools = listAgentHarnessToolDefinitions();
    const enabledTools = listEnabledAgentHarnessToolDefinitions();
    const expectedEnabledTools = allTools.filter((tool) => tool.enabled);

    expect(allTools).toBe(AGENT_HARNESS_TOOL_DEFINITIONS_V1);
    expect(enabledTools).toEqual(expectedEnabledTools);
    expect(enabledTools).toHaveLength(6);

    const enabledIds = enabledTools.map((t) => t.id);
    expect(enabledIds).toContain('read_file');
    expect(enabledIds).toContain('list_files');
    expect(enabledIds).toContain('write_file');
    expect(enabledIds).toContain('delete_file');
    expect(enabledIds).toContain('run_validation');
    expect(enabledIds).toContain('browser_smoke');

    for (const tool of enabledTools) {
      expect(isAgentHarnessToolEnabled(tool.id)).toBe(true);
    }
  });

  it('marks read_file, list_files, write_file, and delete_file as implemented and enabled', () => {
    const readFile = getAgentHarnessToolDefinition('read_file');
    const listFiles = getAgentHarnessToolDefinition('list_files');
    const writeFile = getAgentHarnessToolDefinition('write_file');
    const deleteFile = getAgentHarnessToolDefinition('delete_file');

    expect(readFile?.enabled).toBe(true);
    expect(readFile?.implementationStatus).toBe('implemented');
    expect(listFiles?.enabled).toBe(true);
    expect(listFiles?.implementationStatus).toBe('implemented');
    expect(writeFile?.enabled).toBe(true);
    expect(writeFile?.implementationStatus).toBe('implemented');
    expect(deleteFile?.enabled).toBe(true);
    expect(deleteFile?.implementationStatus).toBe('implemented');
  });

  it('keeps requiresApproval true for write_file and delete_file', () => {
    expect(doesAgentHarnessToolRequireApproval('write_file')).toBe(true);
    expect(doesAgentHarnessToolRequireApproval('delete_file')).toBe(true);
  });

  it('marks run_validation as enabled and implemented', () => {
    const tool = getAgentHarnessToolDefinition('run_validation');
    expect(tool).toBeDefined();
    expect(tool?.enabled).toBe(true);
    expect(tool?.implementationStatus).toBe('implemented');
    expect(tool?.category).toBe('validation');
    expect(tool?.requiresApproval).toBe(false);
  });

  it('keeps preview/search tools disabled and not implemented', () => {
    const disabledToolIds = [
      'start_preview',
      'search_workspace',
    ];

    for (const toolId of disabledToolIds) {
      const tool = getAgentHarnessToolDefinition(toolId);
      expect(tool).toBeDefined();
      expect(tool?.enabled).toBe(false);
      expect(tool?.implementationStatus).not.toBe('implemented');
    }
  });

  it('marks browser_smoke as enabled, implemented, high-risk, and read-only', () => {
    const tool = getAgentHarnessToolDefinition('browser_smoke');
    expect(tool).toBeDefined();
    expect(tool?.enabled).toBe(true);
    expect(tool?.implementationStatus).toBe('implemented');
    expect(tool?.riskLevel).toBe('high');
    expect(tool?.requiresApproval).toBe(false);
    expect(tool?.tags).toContain('read-only');
    expect(tool?.tags).not.toContain('planned');
    expect(tool?.tags).not.toContain('metadata-only');
    expect(tool?.inputSchema.schema).toHaveProperty('properties');
    expect((tool?.inputSchema.schema as any).properties).toHaveProperty('url');
    expect((tool?.inputSchema.schema as any).properties).not.toHaveProperty('scenario');
  });

  it('makes tool registry exports available from stable agent-harness index', () => {
    expect(AGENT_HARNESS_TOOL_DEFINITIONS_V1.length).toBeGreaterThan(0);
    expect(Object.keys(AGENT_HARNESS_TOOL_DEFINITION_MAP_V1).length).toBeGreaterThan(0);
  });

  it('does not import tool-registry into ai-execution.service.ts', () => {
    const aiExecutionServicePath = path.resolve(
      __dirname,
      '../../ai-execution/ai-execution.service.ts',
    );

    const aiExecutionServiceContent = fs.readFileSync(aiExecutionServicePath, 'utf8');

    expect(aiExecutionServiceContent).not.toContain('tool-registry');
  });
});
