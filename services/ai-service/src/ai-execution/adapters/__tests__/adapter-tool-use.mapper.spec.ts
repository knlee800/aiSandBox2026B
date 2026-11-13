import { InternalServerErrorException } from '@nestjs/common';
import {
  AGENT_HARNESS_TOOL_DEFINITIONS_V1,
  getAgentHarnessToolDefinition,
  listEnabledAgentHarnessToolDefinitions,
} from '../../../agent-harness/tools/tool-registry';
import {
  HARNESS_ADVERTISABLE_TOOL_IDS,
  RESPONSES_CONTINUATION_INVALID_HISTORY_MESSAGE,
  RESPONSES_STATELESS_INCLUDE,
  buildResponsesToolRequest,
  mapAgentHarnessToolDefinitionsToAdapterToolDeclarations,
  mapAgentHarnessToolDefinitionsToAnthropicTools,
  mapAgentHarnessToolDefinitionsToOpenAITools,
  mapAgentHarnessToolDefinitionsToResponsesTools,
  mapCanonicalTranscriptToAnthropicMessages,
  mapCanonicalTranscriptToOpenAIMessages,
  parseResponsesToolUseResponse,
  parseToolArgumentsToObject,
  selectAdvertisedAgentHarnessTools,
  toResponsesSdkInput,
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

  it('advertises list_files, read_file, write_file, delete_file, and run_validation when both flags are on', () => {
    const advertised = selectAdvertisedAgentHarnessTools({
      registeredHandlerNames: ALL_REGISTRY_HANDLER_NAMES,
      enableWriteTools: true,
      enableValidationTools: true,
      enableBrowserSmoke: true,
    });

    expect([...HARNESS_ADVERTISABLE_TOOL_IDS]).toEqual([
      'list_files',
      'read_file',
      'write_file',
      'delete_file',
      'run_validation',
      'search_workspace',
      'search_knowledge',
      'read_knowledge',
    ]);
    expect(advertisedNames(advertised)).toEqual([
      'list_files',
      'read_file',
      'write_file',
      'delete_file',
      'run_validation',
      'search_workspace',
      'search_knowledge',
      'read_knowledge',
    ]);

    const listFiles = getAgentHarnessToolDefinition('list_files');
    const readFile = getAgentHarnessToolDefinition('read_file');
    const writeFile = getAgentHarnessToolDefinition('write_file');
    const deleteFile = getAgentHarnessToolDefinition('delete_file');
    const runValidation = getAgentHarnessToolDefinition('run_validation');
    const searchWorkspace = getAgentHarnessToolDefinition('search_workspace');
    expect(listFiles).toBeDefined();
    expect(readFile).toBeDefined();
    expect(writeFile).toBeDefined();
    expect(deleteFile).toBeDefined();
    expect(runValidation).toBeDefined();
    expect(searchWorkspace).toBeDefined();
    expect(advertised[0]).toBe(listFiles);
    expect(advertised[1]).toBe(readFile);
    expect(advertised[2]).toBe(writeFile);
    expect(advertised[3]).toBe(deleteFile);
    expect(advertised[4]).toBe(runValidation);
    expect(advertised[5]).toBe(searchWorkspace);
    expect(advertised[0].description).toBe(listFiles!.description);
    expect(advertised[0].inputSchema).toBe(listFiles!.inputSchema);
    expect(advertised[1].description).toBe(readFile!.description);
    expect(advertised[1].inputSchema).toBe(readFile!.inputSchema);
    expect(advertised[2].description).toBe(writeFile!.description);
    expect(advertised[2].inputSchema).toBe(writeFile!.inputSchema);
    expect(advertised[3].description).toBe(deleteFile!.description);
    expect(advertised[3].inputSchema).toBe(deleteFile!.inputSchema);
    expect(advertised[4].description).toBe(runValidation!.description);
    expect(advertised[4].inputSchema).toBe(runValidation!.inputSchema);
    expect(advertised[5].description).toBe(searchWorkspace!.description);
    expect(advertised[5].inputSchema).toBe(searchWorkspace!.inputSchema);

    const declarations =
      mapAgentHarnessToolDefinitionsToAdapterToolDeclarations(advertised);
    expect(declarations.map((tool) => tool.name)).toEqual([
      'list_files',
      'read_file',
      'write_file',
      'delete_file',
      'run_validation',
      'search_workspace',
      'search_knowledge',
      'read_knowledge',
    ]);
    expect(declarations[0].inputSchema).toBe(listFiles!.inputSchema.schema);
    expect(declarations[1].inputSchema).toBe(readFile!.inputSchema.schema);
    expect(declarations[2].inputSchema).toBe(writeFile!.inputSchema.schema);
    expect(declarations[3].inputSchema).toBe(deleteFile!.inputSchema.schema);
    expect(declarations[4].inputSchema).toBe(runValidation!.inputSchema.schema);
    expect(declarations[5].inputSchema).toBe(searchWorkspace!.inputSchema.schema);
  });

  it('offers list_files, read_file, and search_workspace when write and validation flags are off', () => {
    const advertised = selectAdvertisedAgentHarnessTools({
      registeredHandlerNames: ALL_REGISTRY_HANDLER_NAMES,
      enableWriteTools: false,
      enableValidationTools: false,
      enableBrowserSmoke: true,
    });

    expect(advertisedNames(advertised)).toEqual([
      'list_files',
      'read_file',
      'search_workspace',
      'search_knowledge',
      'read_knowledge',
    ]);
    expect(advertisedNames(advertised)).not.toContain('delete_file');
  });

  it('lets enableWriteTools control write_file and delete_file', () => {
    const advertised = selectAdvertisedAgentHarnessTools({
      registeredHandlerNames: ALL_REGISTRY_HANDLER_NAMES,
      enableWriteTools: true,
      enableValidationTools: false,
      enableBrowserSmoke: true,
    });

    expect(advertisedNames(advertised)).toEqual([
      'list_files',
      'read_file',
      'write_file',
      'delete_file',
      'search_workspace',
      'search_knowledge',
      'read_knowledge',
    ]);
  });

  it('advertises delete_file only when the write flag is on and the delete handler is registered', () => {
    const withDeleteHandler = selectAdvertisedAgentHarnessTools({
      registeredHandlerNames: [
        'list_files',
        'read_file',
        'write_file',
        'delete_file',
      ],
      enableWriteTools: true,
    });
    expect(advertisedNames(withDeleteHandler)).toEqual([
      'list_files',
      'read_file',
      'write_file',
      'delete_file',
    ]);

    const writeFlagOff = selectAdvertisedAgentHarnessTools({
      registeredHandlerNames: [
        'list_files',
        'read_file',
        'write_file',
        'delete_file',
      ],
      enableWriteTools: false,
    });
    expect(advertisedNames(writeFlagOff)).toEqual([
      'list_files',
      'read_file',
    ]);
    expect(advertisedNames(writeFlagOff)).not.toContain('delete_file');

    const collaborationWriteProfile = selectAdvertisedAgentHarnessTools({
      registeredHandlerNames: [
        'list_files',
        'read_file',
        'write_file',
        'run_validation',
        'search_workspace',
      ],
      enableWriteTools: true,
      enableValidationTools: true,
    });
    expect(advertisedNames(collaborationWriteProfile)).toEqual([
      'list_files',
      'read_file',
      'write_file',
      'run_validation',
      'search_workspace',
    ]);
    expect(advertisedNames(collaborationWriteProfile)).not.toContain(
      'delete_file',
    );
  });

  it('lets enableValidationTools control only run_validation', () => {
    const advertised = selectAdvertisedAgentHarnessTools({
      registeredHandlerNames: ALL_REGISTRY_HANDLER_NAMES,
      enableWriteTools: false,
      enableValidationTools: true,
      enableBrowserSmoke: true,
    });

    expect(advertisedNames(advertised)).toEqual([
      'list_files',
      'read_file',
      'run_validation',
      'search_workspace',
      'search_knowledge',
      'read_knowledge',
    ]);
  });

  it('excludes disabled, planned, handlerless, browser, and preview tools when write and validation flags are on', () => {
    const advertised = selectAdvertisedAgentHarnessTools({
      registeredHandlerNames: ALL_REGISTRY_HANDLER_NAMES,
      enableWriteTools: true,
      enableValidationTools: true,
      enableBrowserSmoke: true,
    });
    const names = advertisedNames(advertised);

    expect(names).toEqual([
      'list_files',
      'read_file',
      'write_file',
      'delete_file',
      'run_validation',
      'search_workspace',
      'search_knowledge',
      'read_knowledge',
    ]);
    expect(names).toContain('delete_file');
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
        'search_workspace',
      ]),
    );
    expect(names).toEqual(enabledIds);
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

  it('offers search_workspace with write and validation flags off when a handler is claimed', () => {
    const searchWorkspace = getAgentHarnessToolDefinition('search_workspace')!;
    const advertised = selectAdvertisedAgentHarnessTools({
      registeredHandlerNames: ['search_workspace', 'list_files', 'read_file'],
      enableWriteTools: false,
      enableValidationTools: false,
      definitions: [
        searchWorkspace,
        getAgentHarnessToolDefinition('list_files')!,
        getAgentHarnessToolDefinition('read_file')!,
      ],
    });

    expect(advertisedNames(advertised)).toEqual([
      'search_workspace',
      'list_files',
      'read_file',
    ]);
  });

  it('offers delete_file when its handler and the write flag are on, and still never offers browser_smoke or start_preview', () => {
    const forceOffered = (toolId: string) => {
      const definition = getAgentHarnessToolDefinition(toolId)!;
      return {
        ...definition,
        enabled: true,
        implementationStatus: 'implemented' as const,
      };
    };
    const advertised = selectAdvertisedAgentHarnessTools({
      registeredHandlerNames: [
        'list_files',
        'read_file',
        'write_file',
        'delete_file',
        'run_validation',
        'browser_smoke',
        'search_workspace',
        'start_preview',
      ],
      enableWriteTools: true,
      enableValidationTools: true,
      enableBrowserSmoke: true,
      definitions: [
        getAgentHarnessToolDefinition('list_files')!,
        getAgentHarnessToolDefinition('read_file')!,
        getAgentHarnessToolDefinition('write_file')!,
        forceOffered('delete_file'),
        getAgentHarnessToolDefinition('run_validation')!,
        forceOffered('browser_smoke'),
        getAgentHarnessToolDefinition('search_workspace')!,
        forceOffered('start_preview'),
      ],
    });

    expect(advertisedNames(advertised)).toEqual([
      'list_files',
      'read_file',
      'write_file',
      'delete_file',
      'run_validation',
      'search_workspace',
    ]);
    expect(advertisedNames(advertised)).toContain('delete_file');
    expect(advertisedNames(advertised)).not.toContain('browser_smoke');
    expect(advertisedNames(advertised)).not.toContain('start_preview');
  });

  it('returns an empty advertised set when no eligible handler is registered', () => {
    expect(
      selectAdvertisedAgentHarnessTools({
        registeredHandlerNames: [],
      }),
    ).toEqual([]);
  });

  it('advertises write_file and search_workspace when the write flag is on and still excludes start_preview', () => {
    const advertised = selectAdvertisedAgentHarnessTools({
      registeredHandlerNames: ['write_file', 'search_workspace', 'start_preview'],
      enableWriteTools: true,
    });

    expect(advertisedNames(advertised)).toEqual([
      'write_file',
      'search_workspace',
    ]);
    expect(advertisedNames(advertised)).not.toContain('start_preview');
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

  it('replays anthropic providerState content byte-identical and in the original order', () => {
    const thinkingBlock = {
      type: 'thinking',
      thinking: 'Check the workspace before answering.',
      signature: 'sig_original_order',
    };
    const redactedThinkingBlock = {
      type: 'redacted_thinking',
      data: 'redacted-bytes-original',
    };
    const toolUseBlock = {
      type: 'tool_use',
      id: 'toolu_1',
      name: 'list_files',
      input: { path: '.' },
    };
    const content = [thinkingBlock, redactedThinkingBlock, toolUseBlock];
    const transcript: readonly AIAdapterCanonicalTranscriptTurn[] = [
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
        ],
        providerState: {
          kind: 'anthropic-content',
          content,
        },
      },
    ];

    const messages = mapCanonicalTranscriptToAnthropicMessages(transcript);
    const assistantMessage = messages[0];

    expect(messages).toHaveLength(1);
    expect(assistantMessage).toEqual({
      role: 'assistant',
      content,
    });
    if (assistantMessage.role !== 'assistant') {
      throw new Error('expected an assistant message');
    }
    expect(assistantMessage.content).toBe(content);
    expect(JSON.stringify(assistantMessage.content)).toBe(JSON.stringify(content));
    expect(assistantMessage.content.map((block) => (block as { type: string }).type)).toEqual([
      'thinking',
      'redacted_thinking',
      'tool_use',
    ]);
  });

  it('rebuilds Anthropic assistant content when the turn has no providerState', () => {
    const transcript: readonly AIAdapterCanonicalTranscriptTurn[] = [
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
        ],
      },
    ];

    expect(mapCanonicalTranscriptToAnthropicMessages(transcript)).toEqual([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Checking files.' },
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'list_files',
            input: { path: '.' },
          },
        ],
      },
    ]);
  });

  it('ignores providerState when mapping a transcript to OpenAI messages', () => {
    const withoutState: readonly AIAdapterCanonicalTranscriptTurn[] = [
      {
        kind: 'assistant_tool_turn',
        content: 'Checking files.',
        toolCalls: [
          {
            status: 'valid',
            callId: 'call_aaa',
            toolName: 'list_files',
            arguments: { path: '.' },
            rawArguments: '{"path":"."}',
            providerKind: 'openai-tool_calls',
          },
        ],
      },
    ];
    const withState: readonly AIAdapterCanonicalTranscriptTurn[] = [
      {
        kind: 'assistant_tool_turn',
        content: 'Checking files.',
        toolCalls: [
          {
            status: 'valid',
            callId: 'call_aaa',
            toolName: 'list_files',
            arguments: { path: '.' },
            rawArguments: '{"path":"."}',
            providerKind: 'openai-tool_calls',
          },
        ],
        providerState: {
          kind: 'anthropic-content',
          content: [
            {
              type: 'thinking',
              thinking: 'secret-thinking-not-for-openai',
              signature: 'sig_ignored',
            },
          ],
        },
      },
    ];

    const messages = mapCanonicalTranscriptToOpenAIMessages(withState);

    expect(messages).toEqual(mapCanonicalTranscriptToOpenAIMessages(withoutState));
    expect(JSON.stringify(messages)).not.toContain('secret-thinking-not-for-openai');
    expect(JSON.stringify(messages)).not.toContain('anthropic-content');
  });

  it('adds deepseek reasoning_content unchanged on the matching assistant message', () => {
    const firstReasoning = '  think before list_files\nwith "quotes"  ';
    const laterReasoning = 'second-step reasoning\tunchanged';
    const listCall: AIAdapterCanonicalTranscriptTurn = {
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
      ],
    };
    const readCall: AIAdapterCanonicalTranscriptTurn = {
      kind: 'assistant_tool_turn',
      content: 'Reading the file.',
      toolCalls: [
        {
          status: 'valid',
          callId: 'call_bbb',
          toolName: 'read_file',
          arguments: { path: 'README.md' },
          rawArguments: '{"path":"README.md"}',
          providerKind: 'openai-tool_calls',
        },
      ],
    };
    const closingCall: AIAdapterCanonicalTranscriptTurn = {
      kind: 'assistant_tool_turn',
      content: 'Done looking.',
      toolCalls: [],
    };
    const listResult: AIAdapterCanonicalTranscriptTurn = {
      kind: 'tool_result_turn',
      results: [
        {
          callId: 'call_aaa',
          toolName: 'list_files',
          success: true,
          content: { entries: ['README.md'] },
        },
      ],
    };
    const readResult: AIAdapterCanonicalTranscriptTurn = {
      kind: 'tool_result_turn',
      results: [
        {
          callId: 'call_bbb',
          toolName: 'read_file',
          success: true,
          content: { content: '# Title' },
        },
      ],
    };
    const withoutState: readonly AIAdapterCanonicalTranscriptTurn[] = [
      listCall,
      listResult,
      readCall,
      readResult,
      closingCall,
    ];
    const withReasoning: readonly AIAdapterCanonicalTranscriptTurn[] = [
      {
        ...listCall,
        providerState: {
          kind: 'deepseek-reasoning',
          reasoningContent: firstReasoning,
        },
      },
      listResult,
      readCall,
      readResult,
      {
        ...closingCall,
        providerState: {
          kind: 'deepseek-reasoning',
          reasoningContent: laterReasoning,
        },
      },
    ];

    const today = mapCanonicalTranscriptToOpenAIMessages(withoutState);
    const messages = mapCanonicalTranscriptToOpenAIMessages(withReasoning);

    expect(today).toEqual([
      {
        role: 'assistant',
        content: 'I will look those up.',
        tool_calls: [
          {
            id: 'call_aaa',
            type: 'function',
            function: { name: 'list_files', arguments: '{"path":"."}' },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: 'call_aaa',
        content: JSON.stringify({ entries: ['README.md'] }),
      },
      {
        role: 'assistant',
        content: 'Reading the file.',
        tool_calls: [
          {
            id: 'call_bbb',
            type: 'function',
            function: { name: 'read_file', arguments: '{"path":"README.md"}' },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: 'call_bbb',
        content: JSON.stringify({ content: '# Title' }),
      },
      {
        role: 'assistant',
        content: 'Done looking.',
      },
    ]);
    expect(messages[0]).toEqual({
      ...today[0],
      reasoning_content: firstReasoning,
    });
    expect(messages[1]).toEqual(today[1]);
    expect(messages[2]).toEqual(today[2]);
    expect(messages[2]).not.toHaveProperty('reasoning_content');
    expect(messages[3]).toEqual(today[3]);
    expect(messages[4]).toEqual({
      ...today[4],
      reasoning_content: laterReasoning,
    });
    expect(JSON.stringify(messages[1])).not.toContain(firstReasoning);
    expect(JSON.stringify(messages[2])).not.toContain(firstReasoning);
    expect(JSON.stringify(messages[3])).not.toContain(laterReasoning);
  });

  it('leaves OpenAI messages unchanged when deepseek reasoning text is absent', () => {
    const base: AIAdapterCanonicalTranscriptTurn = {
      kind: 'assistant_tool_turn',
      content: 'Checking files.',
      toolCalls: [
        {
          status: 'valid',
          callId: 'call_aaa',
          toolName: 'list_files',
          arguments: { path: '.' },
          rawArguments: '{"path":"."}',
          providerKind: 'openai-tool_calls',
        },
      ],
    };
    const today = mapCanonicalTranscriptToOpenAIMessages([base]);

    expect(
      mapCanonicalTranscriptToOpenAIMessages([
        {
          ...base,
          providerState: { kind: 'deepseek-reasoning', reasoningContent: 12 },
        },
      ]),
    ).toEqual(today);
    expect(
      mapCanonicalTranscriptToOpenAIMessages([
        {
          ...base,
          providerState: { kind: 'deepseek-reasoning' },
        },
      ]),
    ).toEqual(today);
    expect(
      mapCanonicalTranscriptToOpenAIMessages([
        {
          ...base,
          providerState: {
            kind: 'responses',
            responseId: 'resp_1',
            reasoningContent: 'not-deepseek',
          },
        },
      ]),
    ).toEqual(today);
    expect(today[0]).not.toHaveProperty('reasoning_content');
    expect(
      mapCanonicalTranscriptToOpenAIMessages([
        {
          ...base,
          providerState: { kind: 'deepseek-reasoning', reasoningContent: '' },
        },
      ]),
    ).toEqual([{ ...today[0], reasoning_content: '' }]);
  });
});

describe('Responses API tool helpers', () => {
  const readFile = AGENT_HARNESS_TOOL_DEFINITIONS_V1[1];
  const listFiles = AGENT_HARNESS_TOOL_DEFINITIONS_V1[0];

  it('maps harness tools to Responses function tools with strict false', () => {
    expect(
      mapAgentHarnessToolDefinitionsToResponsesTools([listFiles, readFile]),
    ).toEqual([
      {
        type: 'function',
        name: listFiles.name,
        description: listFiles.description,
        parameters: listFiles.inputSchema.schema,
        strict: false,
      },
      {
        type: 'function',
        name: readFile.name,
        description: readFile.description,
        parameters: readFile.inputSchema.schema,
        strict: false,
      },
    ]);
    expect(mapAgentHarnessToolDefinitionsToResponsesTools()).toEqual([]);
    expect(mapAgentHarnessToolDefinitionsToResponsesTools([])).toEqual([]);
  });

  it('builds a first-step user message and puts the system prompt in instructions', () => {
    expect(
      buildResponsesToolRequest({
        prompt: 'List then read README.md',
        systemPrompt: '  Follow platform contract.  ',
        transcript: [],
      }),
    ).toEqual({
      input: [{ role: 'user', content: 'List then read README.md' }],
      instructions: 'Follow platform contract.',
    });
  });

  it('builds a first-step user message without instructions when no system prompt is present', () => {
    expect(
      buildResponsesToolRequest({
        prompt: 'List then read README.md',
      }),
    ).toEqual({
      input: [{ role: 'user', content: 'List then read README.md' }],
    });
    expect(
      buildResponsesToolRequest({
        prompt: 'List then read README.md',
        systemPrompt: '   ',
        transcript: [],
      }),
    ).toEqual({
      input: [{ role: 'user', content: 'List then read README.md' }],
    });
  });

  describe('ACCESS-01J stateless continuation (store: false)', () => {
    const reasoningStep1 = {
      id: 'rs_step1',
      type: 'reasoning',
      summary: [{ type: 'summary_text', text: 'Plan: list, then read.' }],
      encrypted_content: 'gAAAA-encrypted-reasoning-step-1',
    };
    const messageStep1 = {
      id: 'msg_step1',
      type: 'message',
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text: 'Looking around.', annotations: [] }],
    };
    const callA = {
      id: 'fc_a',
      type: 'function_call',
      status: 'completed',
      call_id: 'call_a',
      name: 'list_files',
      arguments: '{"path":"."}',
    };
    const callB = {
      id: 'fc_b',
      type: 'function_call',
      status: 'completed',
      call_id: 'call_b',
      name: 'read_file',
      arguments: '{"path":"README.md"}',
    };
    const callC = {
      id: 'fc_c',
      type: 'function_call',
      status: 'completed',
      call_id: 'call_c',
      name: 'read_file',
      arguments: '{"path":"docs/a.md"}',
    };
    const messageStep2 = {
      id: 'msg_step2',
      type: 'message',
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text: 'One more file.', annotations: [] }],
    };
    const step1Response = {
      id: 'resp_step1',
      status: 'completed',
      model: 'gpt-6.1-sol',
      output: [reasoningStep1, messageStep1, callA, callB],
      usage: { total_tokens: 40 },
    };
    const step2Response = {
      id: 'resp_step2',
      status: 'completed',
      model: 'gpt-6.1-sol',
      output: [messageStep2, callC],
      usage: { total_tokens: 30 },
    };
    const resultsStep1 = [
      {
        callId: 'call_a',
        toolName: 'list_files',
        success: true,
        content: { entries: ['README.md', 'docs'] },
      },
      {
        callId: 'call_b',
        toolName: 'read_file',
        success: false,
        errorMessage: 'read failed',
      },
    ];
    const resultsStep2 = [
      {
        callId: 'call_c',
        toolName: 'read_file',
        success: true,
        content: { content: '# A' },
      },
    ];

    const transcriptFromParsedSteps = (): AIAdapterCanonicalTranscriptTurn[] => {
      const first = parseResponsesToolUseResponse(step1Response, 'gpt-6.1-sol');
      const second = parseResponsesToolUseResponse(step2Response, 'gpt-6.1-sol');
      return [
        {
          kind: 'assistant_tool_turn',
          content: first.output,
          toolCalls: first.canonicalToolCalls ?? [],
          providerState: first.providerState,
        },
        { kind: 'tool_result_turn', results: resultsStep1 },
        {
          kind: 'assistant_tool_turn',
          content: second.output,
          toolCalls: second.canonicalToolCalls ?? [],
          providerState: second.providerState,
        },
        { kind: 'tool_result_turn', results: resultsStep2 },
      ];
    };

    it('requests reasoning.encrypted_content through include', () => {
      expect([...RESPONSES_STATELESS_INCLUDE]).toEqual(['reasoning.encrypted_content']);
    });

    it('keeps every output item verbatim in providerState and no response id', () => {
      const result = parseResponsesToolUseResponse(step1Response, 'gpt-6.1-sol');

      expect(result.providerState).toEqual({
        kind: 'responses',
        outputItems: [reasoningStep1, messageStep1, callA, callB],
      });
      expect(JSON.stringify(result.providerState)).not.toContain('resp_step1');
      const state = result.providerState as { outputItems: unknown[] };
      expect(state.outputItems[0]).not.toBe(reasoningStep1);
      expect(state.outputItems[0]).toEqual(reasoningStep1);
    });

    it('keeps an unsupported output item so the next step fails closed instead of dropping it', () => {
      const parsed = parseResponsesToolUseResponse(
        {
          ...step1Response,
          output: [{ type: 'web_search_call', id: 'ws_1' }, 'junk', callA, callB],
        },
        'gpt-6.1-sol',
      );
      expect(parsed.providerState).toEqual({
        kind: 'responses',
        outputItems: [{ type: 'web_search_call', id: 'ws_1' }, 'junk', callA, callB],
      });

      expect(() =>
        buildResponsesToolRequest({
          prompt: 'continue',
          transcript: [
            {
              kind: 'assistant_tool_turn',
              content: parsed.output,
              toolCalls: parsed.canonicalToolCalls ?? [],
              providerState: parsed.providerState,
            },
            { kind: 'tool_result_turn', results: resultsStep1 },
          ],
        }),
      ).toThrow(RESPONSES_CONTINUATION_INVALID_HISTORY_MESSAGE);
    });

    it('sends the prompt only on the first step', () => {
      const request = buildResponsesToolRequest({
        prompt: 'List then read README.md',
        systemPrompt: 'Follow platform contract.',
      });

      expect(request).toEqual({
        input: [{ role: 'user', content: 'List then read README.md' }],
        instructions: 'Follow platform contract.',
      });
      expect(request).not.toHaveProperty('previous_response_id');
    });

    it('replays the full ordered history on step 3 with every call_id paired to its output', () => {
      const transcript = transcriptFromParsedSteps();
      const transcriptSnapshot = JSON.stringify(transcript);

      const request = buildResponsesToolRequest({
        prompt: 'List then read README.md',
        systemPrompt: 'Follow platform contract.',
        transcript,
      });

      expect(request).toEqual({
        instructions: 'Follow platform contract.',
        input: [
          { role: 'user', content: 'List then read README.md' },
          reasoningStep1,
          messageStep1,
          callA,
          callB,
          {
            type: 'function_call_output',
            call_id: 'call_a',
            output: JSON.stringify({ entries: ['README.md', 'docs'] }),
          },
          {
            type: 'function_call_output',
            call_id: 'call_b',
            output: 'read failed',
          },
          messageStep2,
          callC,
          {
            type: 'function_call_output',
            call_id: 'call_c',
            output: JSON.stringify({ content: '# A' }),
          },
        ],
      });
      expect(request).not.toHaveProperty('previous_response_id');
      expect(JSON.stringify(request)).not.toContain('resp_step');

      const callIds = request.input.flatMap((item) =>
        'type' in item && item.type === 'function_call' ? [item.call_id] : [],
      );
      const outputIds = request.input.flatMap((item) =>
        'type' in item && item.type === 'function_call_output' ? [item.call_id] : [],
      );
      expect(callIds).toEqual(['call_a', 'call_b', 'call_c']);
      expect(outputIds).toEqual(['call_a', 'call_b', 'call_c']);
      for (const callId of callIds) {
        const callIndex = request.input.findIndex(
          (item) => 'type' in item && item.type === 'function_call' && item.call_id === callId,
        );
        const outputIndex = request.input.findIndex(
          (item) =>
            'type' in item && item.type === 'function_call_output' && item.call_id === callId,
        );
        expect(outputIndex).toBeGreaterThan(callIndex);
      }
      expect(JSON.stringify(transcript)).toBe(transcriptSnapshot);
    });

    it('replays an earlier reasoning item unchanged, including encrypted_content', () => {
      const request = buildResponsesToolRequest({
        prompt: 'continue',
        transcript: transcriptFromParsedSteps(),
      });

      const reasoning = request.input.filter(
        (item) => 'type' in item && item.type === 'reasoning',
      );
      expect(reasoning).toEqual([reasoningStep1]);
      expect(reasoning[0]).toHaveProperty(
        'encrypted_content',
        'gAAAA-encrypted-reasoning-step-1',
      );
    });

    it('passes replayed items to the SDK input unchanged', () => {
      const built = buildResponsesToolRequest({
        prompt: 'continue',
        transcript: transcriptFromParsedSteps(),
      });

      expect(toResponsesSdkInput(built.input)).toEqual(built.input);
    });

    describe('fails closed, never a partial history', () => {
      const goodAssistant = (): AIAdapterCanonicalTranscriptTurn =>
        transcriptFromParsedSteps()[0];
      const goodResults: AIAdapterCanonicalTranscriptTurn = {
        kind: 'tool_result_turn',
        results: resultsStep1,
      };
      const withProviderState = (providerState: unknown): AIAdapterCanonicalTranscriptTurn => {
        const turn = goodAssistant();
        if (turn.kind !== 'assistant_tool_turn') {
          throw new Error('fixture');
        }
        return { ...turn, providerState };
      };
      const withItems = (outputItems: unknown[]): AIAdapterCanonicalTranscriptTurn =>
        withProviderState({ kind: 'responses', outputItems });

      const cases: Array<[string, AIAdapterCanonicalTranscriptTurn[]]> = [
        ['missing providerState', [withProviderState(undefined), goodResults]],
        [
          'another provider kind',
          [withProviderState({ kind: 'anthropic-content', content: [] }), goodResults],
        ],
        [
          'the old response-id state',
          [withProviderState({ kind: 'responses', responseId: 'resp_old' }), goodResults],
        ],
        [
          'outputItems not an array',
          [withProviderState({ kind: 'responses', outputItems: 'x' }), goodResults],
        ],
        ['empty outputItems', [withItems([]), goodResults]],
        ['a non-object item', [withItems([callA, callB, 'oops']), goodResults]],
        [
          'a function_call without call_id',
          [withItems([callA, { ...callB, call_id: ' ' }]), goodResults],
        ],
        [
          'a function_call with object arguments',
          [withItems([callA, { ...callB, arguments: { path: 'README.md' } }]), goodResults],
        ],
        [
          'a message without the assistant role',
          [withItems([{ ...messageStep1, role: 'user' }, callA, callB]), goodResults],
        ],
        [
          'a reasoning item with a bad encrypted_content',
          [withItems([{ ...reasoningStep1, encrypted_content: 42 }, callA, callB]), goodResults],
        ],
        [
          'an unsupported item type',
          [withItems([{ type: 'web_search_call', id: 'ws_1' }, callA, callB]), goodResults],
        ],
        ['providerState calls that differ from the turn', [withItems([callA]), goodResults]],
        [
          'a missing tool result',
          [goodAssistant(), { kind: 'tool_result_turn', results: [resultsStep1[0]] }],
        ],
        [
          'an extra tool result',
          [
            goodAssistant(),
            { kind: 'tool_result_turn', results: [...resultsStep1, resultsStep2[0]] },
          ],
        ],
        [
          'a duplicated tool result',
          [
            goodAssistant(),
            { kind: 'tool_result_turn', results: [resultsStep1[0], resultsStep1[0]] },
          ],
        ],
        ['a transcript ending with an assistant turn', [goodAssistant()]],
        ['a transcript starting with tool results', [goodResults, goodAssistant()]],
        [
          'a malformed earlier turn before a good later turn',
          [withProviderState(undefined), goodResults, ...transcriptFromParsedSteps().slice(2)],
        ],
      ];

      it.each(cases)('throws for %s', (_label, transcript) => {
        expect(() =>
          buildResponsesToolRequest({ prompt: 'continue', transcript }),
        ).toThrow(InternalServerErrorException);
        expect(() =>
          buildResponsesToolRequest({ prompt: 'continue', transcript }),
        ).toThrow(RESPONSES_CONTINUATION_INVALID_HISTORY_MESSAGE);
      });

      it('keeps prompt and tool content out of the error message', () => {
        let message = '';
        try {
          buildResponsesToolRequest({
            prompt: 'secret prompt text',
            transcript: [
              withItems([callA, { ...callB, call_id: '' }]),
              {
                kind: 'tool_result_turn',
                results: [{ ...resultsStep1[0], content: { secret: 'classified' } }],
              },
            ],
          });
        } catch (error) {
          message = (error as Error).message;
        }
        expect(message).toContain(RESPONSES_CONTINUATION_INVALID_HISTORY_MESSAGE);
        expect(message).not.toContain('classified');
        expect(message).not.toContain('secret prompt text');
        expect(message).not.toContain('README.md');
      });
    });
  });

  it('parses text-only Responses output and joins output_text parts', () => {
    const result = parseResponsesToolUseResponse(
      {
        id: 'resp_text',
        status: 'completed',
        model: 'gpt-4o-2024-11-20',
        output: [
          {
            type: 'message',
            content: [
              { type: 'output_text', text: 'Hello' },
              { type: 'output_text', text: ' world' },
            ],
          },
        ],
        usage: { total_tokens: 11 },
      },
      'gpt-4o',
    );

    expect(result).toEqual({
      output: 'Hello world',
      tokensUsed: 11,
      model: 'gpt-4o-2024-11-20',
      finishReason: 'completed',
      toolCalls: [],
      canonicalToolCalls: [],
    });
    expect(result).not.toHaveProperty('providerState');
  });

  it('falls back to the requested model when the response model is empty', () => {
    const result = parseResponsesToolUseResponse(
      {
        id: 'resp_text',
        status: 'completed',
        model: '',
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'ok' }],
          },
        ],
        usage: { total_tokens: 2 },
      },
      'gpt-4o',
    );

    expect(result.model).toBe('gpt-4o');
  });

  it('parses function calls into canonical tool calls and providerState', () => {
    const result = parseResponsesToolUseResponse(
      {
        id: 'resp_calls',
        status: 'completed',
        model: 'gpt-4o',
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'Reading.' }],
          },
          {
            type: 'function_call',
            call_id: 'call_123',
            name: 'read_file',
            arguments: '{"path":"README.md"}',
          },
        ],
        usage: { total_tokens: 20 },
      },
      'gpt-4o',
    );

    expect(result.finishReason).toBe('tool_calls');
    expect(result.output).toBe('Reading.');
    expect(result.toolCalls).toEqual([
      {
        callId: 'call_123',
        toolName: 'read_file',
        arguments: { path: 'README.md' },
        providerKind: 'openai-function_call',
      },
    ]);
    expect(result.canonicalToolCalls).toEqual([
      {
        status: 'valid',
        callId: 'call_123',
        toolName: 'read_file',
        arguments: { path: 'README.md' },
        rawArguments: '{"path":"README.md"}',
        providerKind: 'openai-function_call',
      },
    ]);
    expect(result.providerState).toEqual({
      kind: 'responses',
      outputItems: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: 'Reading.' }],
        },
        {
          type: 'function_call',
          call_id: 'call_123',
          name: 'read_file',
          arguments: '{"path":"README.md"}',
        },
      ],
    });
  });

  it('reports malformed arguments and a missing call id without inventing ids', () => {
    const result = parseResponsesToolUseResponse(
      {
        id: 'resp_bad',
        status: 'completed',
        output: [
          {
            type: 'function_call',
            call_id: 'call_bad_json',
            name: 'read_file',
            arguments: '{not-json',
          },
          {
            type: 'function_call',
            call_id: '   ',
            name: 'list_files',
            arguments: '{"path":"."}',
          },
        ],
        usage: { total_tokens: 8 },
      },
      'gpt-4o',
    );

    expect(result.toolCalls).toEqual([]);
    expect(result.canonicalToolCalls).toEqual([
      {
        status: 'malformed_arguments',
        callId: 'call_bad_json',
        toolName: 'read_file',
        rawArguments: '{not-json',
        providerKind: 'openai-function_call',
        errorMessage: expect.stringContaining('MALFORMED_TOOL_ARGUMENTS'),
      },
      {
        status: 'missing_id',
        toolName: 'list_files',
        rawArguments: '{"path":"."}',
        providerKind: 'openai-function_call',
      },
    ]);
    expect(result.finishReason).toBe('tool_calls');
    expect(JSON.stringify(result)).not.toContain('openai-function-call-');
    expect(result.canonicalToolCalls?.[0]).not.toEqual(
      expect.objectContaining({ arguments: {} }),
    );
    expect(result.providerState).toEqual({
      kind: 'responses',
      outputItems: [
        {
          type: 'function_call',
          call_id: 'call_bad_json',
          name: 'read_file',
          arguments: '{not-json',
        },
        {
          type: 'function_call',
          call_id: '   ',
          name: 'list_files',
          arguments: '{"path":"."}',
        },
      ],
    });
  });

  it('maps incomplete max_output_tokens to max_tokens when there are no tool calls', () => {
    const result = parseResponsesToolUseResponse(
      {
        id: 'resp_incomplete',
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' },
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'partial' }],
          },
        ],
        usage: { total_tokens: 16000 },
      },
      'gpt-4o',
    );

    expect(result.finishReason).toBe('max_tokens');
    expect(result.output).toBe('partial');
    expect(result.toolCalls).toEqual([]);
    expect(result).not.toHaveProperty('providerState');
  });

  it('prefers tool_calls when a function call is also truncated', () => {
    const result = parseResponsesToolUseResponse(
      {
        id: 'resp_both',
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' },
        output: [
          {
            type: 'function_call',
            call_id: 'call_1',
            name: 'read_file',
            arguments: '{"path":"README.md"}',
          },
        ],
        usage: { total_tokens: 9 },
      },
      'gpt-4o',
    );

    expect(result.finishReason).toBe('tool_calls');
  });

  it('rejects malformed usage the same way as the chat path', () => {
    const textOutput = [
      {
        type: 'message',
        content: [{ type: 'output_text', text: 'ok' }],
      },
    ];

    expect(() =>
      parseResponsesToolUseResponse(
        { id: 'resp', status: 'completed', output: textOutput },
        'gpt-4o',
      ),
    ).toThrow('Malformed OpenAI response: missing usage');
    expect(() =>
      parseResponsesToolUseResponse(
        {
          id: 'resp',
          status: 'completed',
          output: textOutput,
          usage: { total_tokens: null },
        },
        'gpt-4o',
      ),
    ).toThrow('Malformed OpenAI response: missing usage');
    expect(() =>
      parseResponsesToolUseResponse(
        {
          id: 'resp',
          status: 'completed',
          output: textOutput,
          usage: { total_tokens: '100' },
        },
        'gpt-4o',
      ),
    ).toThrow('Malformed OpenAI response: missing usage');
    expect(() =>
      parseResponsesToolUseResponse(
        {
          id: 'resp',
          status: 'completed',
          output: textOutput,
          usage: { total_tokens: -10 },
        },
        'gpt-4o',
      ),
    ).toThrow('Malformed OpenAI response: invalid token count');
    expect(() =>
      parseResponsesToolUseResponse(
        {
          id: 'resp',
          status: 'completed',
          output: [],
          usage: { total_tokens: 4 },
        },
        'gpt-4o',
      ),
    ).toThrow('Malformed OpenAI response: missing content');
  });
});

