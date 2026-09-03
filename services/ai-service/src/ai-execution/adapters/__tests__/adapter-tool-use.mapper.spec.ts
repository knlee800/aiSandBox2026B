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
  mapCanonicalTranscriptToAnthropicMessages,
  mapCanonicalTranscriptToOpenAIMessages,
  parseToolArgumentsToObject,
  selectAdvertisedAgentHarnessTools,
  tryParseToolArgumentsToObject,
} from '../adapter-tool-use.mapper';
import type { AIAdapterCanonicalTranscriptTurn } from '../adapter-tool-use.contracts';

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
    expect(tryParseToolArgumentsToObject('not-json')).toBeUndefined();
    expect(tryParseToolArgumentsToObject('')).toBeUndefined();
    expect(tryParseToolArgumentsToObject(42)).toBeUndefined();
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

describe('AGENT-PLATFORM-EXEC-01C3 canonical transcript contracts and mapper', () => {
  const multiCallTranscript: readonly AIAdapterCanonicalTranscriptTurn[] = [
    {
      kind: 'assistant_tool_turn',
      content: 'I will look those up.',
      toolCalls: [
        {
          status: 'valid',
          callId: 'call_aaa',
          toolName: 'list_files',
          arguments: { path: '.' },
          rawArguments: '{"path":"."}',
          providerKind: 'openai-tool_calls',
        },
        {
          status: 'valid',
          callId: 'call_bbb',
          toolName: 'read_file',
          arguments: { path: 'README.md' },
          rawArguments: '{"path":"README.md"}',
          providerKind: 'openai-tool_calls',
        },
        {
          status: 'malformed_arguments',
          callId: 'call_ccc',
          toolName: 'read_file',
          rawArguments: '{not-json',
          providerKind: 'openai-tool_calls',
          errorMessage: 'MALFORMED_TOOL_ARGUMENTS: arguments are not valid JSON object',
        },
        {
          status: 'missing_id',
          toolName: 'list_files',
          rawArguments: '{"path":"."}',
          providerKind: 'openai-tool_calls',
        },
      ],
    },
    {
      kind: 'tool_result_turn',
      results: [
        {
          callId: 'call_aaa',
          toolName: 'list_files',
          success: true,
          content: { entries: ['README.md'] },
        },
        {
          callId: 'call_bbb',
          toolName: 'read_file',
          success: true,
          content: { content: '# Title' },
        },
        {
          callId: 'call_ccc',
          toolName: 'read_file',
          success: false,
          errorMessage: 'MALFORMED_TOOL_ARGUMENTS: arguments are not valid JSON object',
        },
      ],
    },
  ];

  it('does not coerce unparseable tool arguments into an empty object', () => {
    const invalidJson = parseToolArgumentsToObject('not-json');
    const emptyString = parseToolArgumentsToObject('');
    const numeric = parseToolArgumentsToObject(42);
    const arrayValue = parseToolArgumentsToObject('[]');

    expect(invalidJson.ok).toBe(false);
    expect(emptyString.ok).toBe(false);
    expect(numeric.ok).toBe(false);
    expect(arrayValue.ok).toBe(false);
    expect(invalidJson).not.toEqual(expect.objectContaining({ value: {} }));
    expect(emptyString).not.toEqual(expect.objectContaining({ value: {} }));
  });

  it('parses object and JSON-object tool arguments without inventing values', () => {
    expect(parseToolArgumentsToObject({ path: 'README.md' })).toEqual({
      ok: true,
      value: { path: 'README.md' },
    });
    expect(
      parseToolArgumentsToObject('{"path":"README.md","offset":1}'),
    ).toEqual({
      ok: true,
      value: { path: 'README.md', offset: 1 },
    });
    expect(parseToolArgumentsToObject('{}')).toEqual({
      ok: true,
      value: {},
    });
  });

  it('maps canonical transcript to OpenAI native messages with exact IDs and order', () => {
    const messages = mapCanonicalTranscriptToOpenAIMessages(multiCallTranscript);

    expect(messages.map((message) => message.role)).toEqual([
      'assistant',
      'tool',
      'tool',
      'tool',
    ]);
    expect(messages[0]).toEqual({
      role: 'assistant',
      content: 'I will look those up.',
      tool_calls: [
        {
          id: 'call_aaa',
          type: 'function',
          function: { name: 'list_files', arguments: '{"path":"."}' },
        },
        {
          id: 'call_bbb',
          type: 'function',
          function: { name: 'read_file', arguments: '{"path":"README.md"}' },
        },
        {
          id: 'call_ccc',
          type: 'function',
          function: { name: 'read_file', arguments: '{not-json' },
        },
      ],
    });
    expect(messages[1]).toEqual({
      role: 'tool',
      tool_call_id: 'call_aaa',
      content: JSON.stringify({ entries: ['README.md'] }),
    });
    expect(messages[2]).toEqual({
      role: 'tool',
      tool_call_id: 'call_bbb',
      content: JSON.stringify({ content: '# Title' }),
    });
    expect(messages[3]).toEqual({
      role: 'tool',
      tool_call_id: 'call_ccc',
      content: 'MALFORMED_TOOL_ARGUMENTS: arguments are not valid JSON object',
    });
    expect(JSON.stringify(messages)).not.toContain('openai-tool-call-');
    expect(JSON.stringify(messages)).not.toContain('missing_id');
  });

  it('maps canonical transcript to Anthropic native messages with exact tool_use_id correlation', () => {
    const anthropicTranscript: readonly AIAdapterCanonicalTranscriptTurn[] = [
      {
        kind: 'assistant_tool_turn',
        content: 'Checking files.',
        toolCalls: [
          {
            status: 'valid',
            callId: 'toolu_1',
            toolName: 'list_files',
            arguments: { path: '.' },
            rawArguments: { path: '.' },
            providerKind: 'anthropic-tool_use',
          },
          {
            status: 'valid',
            callId: 'toolu_2',
            toolName: 'read_file',
            arguments: { path: 'README.md' },
            rawArguments: { path: 'README.md' },
            providerKind: 'anthropic-tool_use',
          },
          {
            status: 'malformed_arguments',
            callId: 'toolu_3',
            toolName: 'read_file',
            rawArguments: 'not-an-object',
            providerKind: 'anthropic-tool_use',
            errorMessage: 'MALFORMED_TOOL_ARGUMENTS: arguments are not a JSON object',
          },
          {
            status: 'missing_id',
            toolName: 'list_files',
            rawArguments: { path: '.' },
            providerKind: 'anthropic-tool_use',
          },
        ],
      },
      {
        kind: 'tool_result_turn',
        results: [
          {
            callId: 'toolu_1',
            toolName: 'list_files',
            success: true,
            content: { entries: ['README.md'] },
          },
          {
            callId: 'toolu_2',
            toolName: 'read_file',
            success: true,
            content: { content: '# Title' },
          },
          {
            callId: 'toolu_3',
            toolName: 'read_file',
            success: false,
            errorMessage: 'MALFORMED_TOOL_ARGUMENTS: arguments are not a JSON object',
          },
        ],
      },
    ];

    const messages = mapCanonicalTranscriptToAnthropicMessages(anthropicTranscript);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({
      role: 'assistant',
      content: [
        { type: 'text', text: 'Checking files.' },
        {
          type: 'tool_use',
          id: 'toolu_1',
          name: 'list_files',
          input: { path: '.' },
        },
        {
          type: 'tool_use',
          id: 'toolu_2',
          name: 'read_file',
          input: { path: 'README.md' },
        },
        {
          type: 'tool_use',
          id: 'toolu_3',
          name: 'read_file',
          input: 'not-an-object',
        },
      ],
    });
    expect(messages[1]).toEqual({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_1',
          content: JSON.stringify({ entries: ['README.md'] }),
        },
        {
          type: 'tool_result',
          tool_use_id: 'toolu_2',
          content: JSON.stringify({ content: '# Title' }),
        },
        {
          type: 'tool_result',
          tool_use_id: 'toolu_3',
          content: 'MALFORMED_TOOL_ARGUMENTS: arguments are not a JSON object',
          is_error: true,
        },
      ],
    });
    expect(JSON.stringify(messages)).not.toContain('anthropic-tool-use-');
  });

  it('does not mutate caller-owned transcript arrays while mapping', () => {
    const original = multiCallTranscript.map((turn) => ({ ...turn }));
    const snapshot = JSON.stringify(original);

    mapCanonicalTranscriptToOpenAIMessages(original);
    mapCanonicalTranscriptToAnthropicMessages(original);

    expect(JSON.stringify(original)).toBe(snapshot);
    expect(original).toHaveLength(2);
  });
});

