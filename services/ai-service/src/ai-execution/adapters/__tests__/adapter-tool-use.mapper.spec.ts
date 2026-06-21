import { AGENT_HARNESS_TOOL_DEFINITIONS_V1 } from '../../../agent-harness/tools/tool-registry';
import {
  mapAgentHarnessToolDefinitionsToAdapterToolDeclarations,
  mapAgentHarnessToolDefinitionsToAnthropicTools,
  mapAgentHarnessToolDefinitionsToOpenAITools,
  tryParseToolArgumentsToObject,
} from '../adapter-tool-use.mapper';

describe('adapter-tool-use.mapper', () => {
  it('should convert Agent Harness tool definitions to adapter tool declarations', () => {
    const [listFiles] = AGENT_HARNESS_TOOL_DEFINITIONS_V1;

    const declarations = mapAgentHarnessToolDefinitionsToAdapterToolDeclarations(
      [listFiles],
    );

    expect(declarations).toEqual([
      {
        sourceToolId: listFiles.id,
        name: listFiles.name,
        description: listFiles.description,
        inputSchema: listFiles.inputSchema.schema,
        requiresApproval: listFiles.requiresApproval,
        enabled: listFiles.enabled,
        implementationStatus: listFiles.implementationStatus,
      },
    ]);
  });

  it('should map converted declarations to Anthropic and OpenAI provider shapes', () => {
    const [readFile] = AGENT_HARNESS_TOOL_DEFINITIONS_V1.slice(1, 2);

    const anthropicTools = mapAgentHarnessToolDefinitionsToAnthropicTools([
      readFile,
    ]);
    const openaiTools = mapAgentHarnessToolDefinitionsToOpenAITools([readFile]);

    expect(anthropicTools).toEqual([
      {
        name: readFile.name,
        description: readFile.description,
        input_schema: readFile.inputSchema.schema,
      },
    ]);
    expect(openaiTools).toEqual([
      {
        type: 'function',
        function: {
          name: readFile.name,
          description: readFile.description,
          parameters: readFile.inputSchema.schema,
        },
      },
    ]);
  });

  it('should preserve disabled/planned metadata without implying execution enablement', () => {
    const plannedTool = AGENT_HARNESS_TOOL_DEFINITIONS_V1.find(
      (tool) => tool.id === 'browser_smoke',
    );
    expect(plannedTool).toBeDefined();

    const declarations = mapAgentHarnessToolDefinitionsToAdapterToolDeclarations(
      plannedTool ? [plannedTool] : [],
    );

    expect(declarations).toHaveLength(1);
    expect(declarations[0].enabled).toBe(false);
    expect(['planned', 'contract-only']).toContain(
      declarations[0].implementationStatus,
    );
  });

  it('should safely handle missing or empty tool definitions', () => {
    expect(mapAgentHarnessToolDefinitionsToAdapterToolDeclarations()).toEqual([]);
    expect(
      mapAgentHarnessToolDefinitionsToAdapterToolDeclarations([]),
    ).toEqual([]);
    expect(mapAgentHarnessToolDefinitionsToAnthropicTools()).toEqual([]);
    expect(mapAgentHarnessToolDefinitionsToOpenAITools()).toEqual([]);
  });

  it('should parse tool arguments into object payloads safely', () => {
    expect(tryParseToolArgumentsToObject({ path: 'README.md' })).toEqual({
      path: 'README.md',
    });
    expect(
      tryParseToolArgumentsToObject('{"path":"README.md","offset":1}'),
    ).toEqual({
      path: 'README.md',
      offset: 1,
    });
    expect(tryParseToolArgumentsToObject('not-json')).toEqual({});
    expect(tryParseToolArgumentsToObject('')).toEqual({});
    expect(tryParseToolArgumentsToObject(42)).toEqual({});
  });
});

