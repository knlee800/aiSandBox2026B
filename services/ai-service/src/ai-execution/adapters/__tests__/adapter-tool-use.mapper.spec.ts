import {
  AGENT_HARNESS_TOOL_DEFINITIONS_V1,
  getAgentHarnessToolDefinition,
  listEnabledAgentHarnessToolDefinitions,
} from '../../../agent-harness/tools/tool-registry';
import {
  FIRST_READ_ONLY_HARNESS_ADVERTISED_TOOL_IDS,
  mapAgentHarnessToolDefinitionsToAdapterToolDeclarations,
  mapAgentHarnessToolDefinitionsToAnthropicTools,
  mapAgentHarnessToolDefinitionsToOpenAITools,
  selectAdvertisedAgentHarnessTools,
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
      (tool) => tool.id === 'start_preview',
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

describe('AGENT-PLATFORM-EXEC-01C2 fail-closed tool advertisement filter', () => {
  const ALL_REGISTRY_HANDLER_NAMES = AGENT_HARNESS_TOOL_DEFINITIONS_V1.map(
    (tool) => tool.name,
  );

  const advertisedNames = (
    tools: readonly { name: string }[],
  ): readonly string[] => tools.map((tool) => tool.name);

  it('advertises only list_files and read_file with canonical registry schemas', () => {
    const advertised = selectAdvertisedAgentHarnessTools({
      registeredHandlerNames: ALL_REGISTRY_HANDLER_NAMES,
      enableWriteTools: true,
      enableValidationTools: true,
      enableBrowserSmoke: true,
    });

    expect([...FIRST_READ_ONLY_HARNESS_ADVERTISED_TOOL_IDS]).toEqual([
      'list_files',
      'read_file',
    ]);
    expect(advertisedNames(advertised)).toEqual(['list_files', 'read_file']);

    const listFiles = getAgentHarnessToolDefinition('list_files');
    const readFile = getAgentHarnessToolDefinition('read_file');
    expect(listFiles).toBeDefined();
    expect(readFile).toBeDefined();
    expect(advertised[0]).toBe(listFiles);
    expect(advertised[1]).toBe(readFile);
    expect(advertised[0].description).toBe(listFiles!.description);
    expect(advertised[0].inputSchema).toBe(listFiles!.inputSchema);
    expect(advertised[1].description).toBe(readFile!.description);
    expect(advertised[1].inputSchema).toBe(readFile!.inputSchema);

    const declarations =
      mapAgentHarnessToolDefinitionsToAdapterToolDeclarations(advertised);
    expect(declarations.map((tool) => tool.name)).toEqual([
      'list_files',
      'read_file',
    ]);
    expect(declarations[0].inputSchema).toBe(listFiles!.inputSchema.schema);
    expect(declarations[1].inputSchema).toBe(readFile!.inputSchema.schema);
  });

  it('excludes disabled, planned, handlerless, search, mutation, validation, and browser tools', () => {
    const advertised = selectAdvertisedAgentHarnessTools({
      registeredHandlerNames: ALL_REGISTRY_HANDLER_NAMES,
      enableWriteTools: true,
      enableValidationTools: true,
      enableBrowserSmoke: true,
    });
    const names = advertisedNames(advertised);

    expect(names).not.toContain('search_workspace');
    expect(names).not.toContain('write_file');
    expect(names).not.toContain('delete_file');
    expect(names).not.toContain('run_validation');
    expect(names).not.toContain('browser_smoke');
    expect(names).not.toContain('start_preview');

    const enabledIds = listEnabledAgentHarnessToolDefinitions().map(
      (tool) => tool.id,
    );
    expect(enabledIds).toEqual(
      expect.arrayContaining([
        'list_files',
        'read_file',
        'write_file',
        'delete_file',
        'run_validation',
      ]),
    );
    expect(names).not.toEqual(enabledIds);
  });

  it('excludes a first-slice tool when it is disabled, planned, or missing a handler', () => {
    const listFiles = getAgentHarnessToolDefinition('list_files')!;
    const readFile = getAgentHarnessToolDefinition('read_file')!;

    expect(
      advertisedNames(
        selectAdvertisedAgentHarnessTools({
          registeredHandlerNames: ['list_files', 'read_file'],
          definitions: [{ ...listFiles, enabled: false }, readFile],
        }),
      ),
    ).toEqual(['read_file']);

    expect(
      advertisedNames(
        selectAdvertisedAgentHarnessTools({
          registeredHandlerNames: ['list_files', 'read_file'],
          definitions: [
            { ...listFiles, implementationStatus: 'planned' },
            readFile,
          ],
        }),
      ),
    ).toEqual(['read_file']);

    expect(
      advertisedNames(
        selectAdvertisedAgentHarnessTools({
          registeredHandlerNames: ['read_file'],
        }),
      ),
    ).toEqual(['read_file']);
  });

  it('never advertises search_workspace even when a handler is claimed', () => {
    const searchWorkspace = getAgentHarnessToolDefinition('search_workspace')!;
    const advertised = selectAdvertisedAgentHarnessTools({
      registeredHandlerNames: ['search_workspace', 'list_files', 'read_file'],
      definitions: [
        { ...searchWorkspace, enabled: true, implementationStatus: 'implemented' },
        getAgentHarnessToolDefinition('list_files')!,
        getAgentHarnessToolDefinition('read_file')!,
      ],
    });

    expect(advertisedNames(advertised)).toEqual(['list_files', 'read_file']);
    expect(advertisedNames(advertised)).not.toContain('search_workspace');
  });

  it('returns an empty advertised set when no eligible handler is registered', () => {
    expect(
      selectAdvertisedAgentHarnessTools({
        registeredHandlerNames: [],
      }),
    ).toEqual([]);
    expect(
      selectAdvertisedAgentHarnessTools({
        registeredHandlerNames: ['write_file', 'search_workspace'],
        enableWriteTools: true,
      }),
    ).toEqual([]);
  });
});

