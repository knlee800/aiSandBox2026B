import {
  InternalServerErrorException,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OpenAIAdapter } from '../openai-ai.adapter';
import { AIExecutionRequest } from '../../types';
import { AGENT_HARNESS_TOOL_DEFINITIONS_V1 } from '../../../agent-harness/tools/tool-registry';
import type { AIAdapterCanonicalTranscriptTurn } from '../adapter-tool-use.contracts';

describe('OpenAIAdapter', () => {
  describe('constructor', () => {
    it('should instantiate with valid API key', () => {
      const adapter = new OpenAIAdapter('sk-test-key-123');
      expect(adapter).toBeInstanceOf(OpenAIAdapter);
      expect(adapter.model).toBe('gpt-4o');
    });

    it('should throw error when API key is undefined', () => {
      expect(() => new OpenAIAdapter(undefined as any)).toThrow(
        'OpenAI API key is required',
      );
    });

    it('should throw error when API key is empty string', () => {
      expect(() => new OpenAIAdapter('')).toThrow(
        'OpenAI API key is required',
      );
    });

    it('should throw error when API key is whitespace only', () => {
      expect(() => new OpenAIAdapter('   ')).toThrow(
        'OpenAI API key is required',
      );
    });

    it('should use default model when not specified', () => {
      const adapter = new OpenAIAdapter('sk-test-key-123');
      expect(adapter.model).toBe('gpt-4o');
    });

    it('should use custom model when specified', () => {
      const adapter = new OpenAIAdapter('sk-test-key-123', {
        model: 'gpt-4o-mini',
      });
      expect(adapter.model).toBe('gpt-4o-mini');
    });

    it('should use custom maxTokens when specified', () => {
      const adapter = new OpenAIAdapter('sk-test-key-123', {
        maxTokens: 2048,
      });
      expect(adapter).toBeInstanceOf(OpenAIAdapter);
    });

    it('should use custom temperature when specified', () => {
      const adapter = new OpenAIAdapter('sk-test-key-123', {
        temperature: 0.5,
      });
      expect(adapter).toBeInstanceOf(OpenAIAdapter);
    });
  });

  describe('execute()', () => {
    let adapter: OpenAIAdapter;
    let mockClient: any;

    beforeEach(() => {
      adapter = new OpenAIAdapter('sk-test-key-123');
      mockClient = {
        chat: {
          completions: {
            create: jest.fn(),
          },
        },
      };
      (adapter as any).client = mockClient;
    });

    describe('success cases', () => {
      it('should transform AIExecutionRequest to OpenAI format', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: 100 },
          model: 'gpt-4o',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        const request: AIExecutionRequest = {
          sessionId: 'session-1',
          conversationId: 'conv-1',
          userId: 'user-1',
          prompt: 'Test prompt',
          provider: 'stub',
        };

        await adapter.execute(request);

        expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
          {
            model: 'gpt-4o',
            max_tokens: 4096,
            temperature: 1.0,
            messages: [
              {
                role: 'user',
                content: 'Test prompt',
              },
            ],
          },
          {},
        );
      });

      it('should prepend a system message when systemPrompt is present', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: 100 },
          model: 'gpt-4o',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        const request: AIExecutionRequest = {
          sessionId: 'session-1',
          conversationId: 'conv-1',
          userId: 'user-1',
          prompt: 'Test prompt',
          systemPrompt: '  Follow platform contract.  ',
          provider: 'stub',
        };

        await adapter.execute(request);

        expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
          {
            model: 'gpt-4o',
            max_tokens: 4096,
            temperature: 1.0,
            messages: [
              {
                role: 'system',
                content: 'Follow platform contract.',
              },
              {
                role: 'user',
                content: 'Test prompt',
              },
            ],
          },
          {},
        );
      });

      it('should use requested model when request.model is provided', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: 100 },
          model: 'gpt-4.1',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        const request: AIExecutionRequest = {
          sessionId: 'session-1',
          conversationId: 'conv-1',
          userId: 'user-1',
          prompt: 'Test prompt',
          provider: 'stub',
          model: 'gpt-4.1',
        };

        await adapter.execute(request);

        expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
          expect.objectContaining({
            model: 'gpt-4.1',
          }),
          {},
        );
      });

      it('should extract text content from response.choices[0].message.content', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output from OpenAI' } }],
          usage: { total_tokens: 150 },
          model: 'gpt-4o',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        const request: AIExecutionRequest = {
          sessionId: 'session-1',
          conversationId: 'conv-1',
          userId: 'user-1',
          prompt: 'Test prompt',
          provider: 'stub',
        };

        const result = await adapter.execute(request);

        expect(result.output).toBe('Test output from OpenAI');
      });

      it('should extract token usage from response.usage.total_tokens', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: {
            prompt_tokens: 50,
            completion_tokens: 75,
            total_tokens: 125,
          },
          model: 'gpt-4o',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        const request: AIExecutionRequest = {
          sessionId: 'session-1',
          conversationId: 'conv-1',
          userId: 'user-1',
          prompt: 'Test prompt',
          provider: 'stub',
        };

        const result = await adapter.execute(request);

        expect(result.tokensUsed).toBe(125);
      });

      it('should extract model from response.model', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: 100 },
          model: 'gpt-4o-2024-11-20',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        const request: AIExecutionRequest = {
          sessionId: 'session-1',
          conversationId: 'conv-1',
          userId: 'user-1',
          prompt: 'Test prompt',
          provider: 'stub',
        };

        const result = await adapter.execute(request);

        expect(result.model).toBe('gpt-4o-2024-11-20');
      });

      it('should handle response with custom model identifier', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: 100 },
          model: 'gpt-4o-custom-version',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        const request: AIExecutionRequest = {
          sessionId: 'session-1',
          conversationId: 'conv-1',
          userId: 'user-1',
          prompt: 'Test prompt',
          provider: 'stub',
        };

        const result = await adapter.execute(request);

        expect(result.model).toBe('gpt-4o-custom-version');
      });

      it('should use instance model as fallback if response.model is undefined', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: 100 },
          model: undefined,
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        const request: AIExecutionRequest = {
          sessionId: 'session-1',
          conversationId: 'conv-1',
          userId: 'user-1',
          prompt: 'Test prompt',
          provider: 'stub',
        };

        const result = await adapter.execute(request);

        expect(result.model).toBe('gpt-4o');
      });

      it('should use requested model as fallback if response.model is undefined', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: 100 },
          model: undefined,
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        const request: AIExecutionRequest = {
          sessionId: 'session-1',
          conversationId: 'conv-1',
          userId: 'user-1',
          prompt: 'Test prompt',
          provider: 'stub',
          model: 'gpt-4.1-mini',
        };

        const result = await adapter.execute(request);

        expect(result.model).toBe('gpt-4.1-mini');
      });
    });

    describe('error cases', () => {
      const request: AIExecutionRequest = {
        sessionId: 'session-1',
        conversationId: 'conv-1',
        userId: 'user-1',
        prompt: 'Test prompt',
        provider: 'stub',
      };

      it('should throw UnauthorizedException for 401 (invalid API key)', async () => {
        const error = { status: 401, message: 'Invalid API key' };
        mockClient.chat.completions.create.mockRejectedValue(error);

        await expect(adapter.execute(request)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Invalid OpenAI API key',
        );
      });

      it('should throw BadRequestException for 400 (validation error)', async () => {
        const error = { status: 400, message: 'Invalid request' };
        mockClient.chat.completions.create.mockRejectedValue(error);

        await expect(adapter.execute(request)).rejects.toThrow(
          BadRequestException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Invalid request to OpenAI API',
        );
      });

      it('should throw ServiceUnavailableException for 429 (rate limit)', async () => {
        const error = { status: 429, message: 'Rate limit exceeded' };
        mockClient.chat.completions.create.mockRejectedValue(error);

        await expect(adapter.execute(request)).rejects.toThrow(
          ServiceUnavailableException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'OpenAI API rate limit exceeded',
        );
      });

      it('should throw InternalServerErrorException for 500 (server error)', async () => {
        const error = { status: 500, message: 'Internal server error' };
        mockClient.chat.completions.create.mockRejectedValue(error);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'OpenAI API server error',
        );
      });

      it('should throw ServiceUnavailableException for timeout', async () => {
        const error = new Error('Request timeout');
        error.name = 'TimeoutError';
        mockClient.chat.completions.create.mockRejectedValue(error);

        await expect(adapter.execute(request)).rejects.toThrow(
          ServiceUnavailableException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'OpenAI API timeout',
        );
      });

      it('should throw ServiceUnavailableException for network error (ECONNREFUSED)', async () => {
        const error = new Error('connect ECONNREFUSED 127.0.0.1:443');
        mockClient.chat.completions.create.mockRejectedValue(error);

        await expect(adapter.execute(request)).rejects.toThrow(
          ServiceUnavailableException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'OpenAI API connection error',
        );
      });

      it('should throw InternalServerErrorException for malformed response (missing choices)', async () => {
        const mockResponse = {
          usage: { total_tokens: 100 },
          model: 'gpt-4o',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed OpenAI response: missing choices',
        );
      });

      it('should throw InternalServerErrorException for malformed response (empty choices array)', async () => {
        const mockResponse = {
          choices: [],
          usage: { total_tokens: 100 },
          model: 'gpt-4o',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed OpenAI response: missing choices',
        );
      });

      it('should throw InternalServerErrorException for malformed response (missing content)', async () => {
        const mockResponse = {
          choices: [{ message: { content: null } }],
          usage: { total_tokens: 100 },
          model: 'gpt-4o',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed OpenAI response: missing content',
        );
      });

      it('should throw InternalServerErrorException for malformed response (empty content)', async () => {
        const mockResponse = {
          choices: [{ message: { content: '' } }],
          usage: { total_tokens: 100 },
          model: 'gpt-4o',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed OpenAI response: missing content',
        );
      });

      it('should throw InternalServerErrorException for malformed response (missing usage)', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          model: 'gpt-4o',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed OpenAI response: missing usage',
        );
      });

      it('should throw InternalServerErrorException for malformed response (invalid token count - null)', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: null },
          model: 'gpt-4o',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed OpenAI response: missing usage',
        );
      });

      it('should throw InternalServerErrorException for malformed response (negative token count)', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: -10 },
          model: 'gpt-4o',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed OpenAI response: invalid token count',
        );
      });

      it('should throw InternalServerErrorException for malformed response (string token count)', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: '100' as any },
          model: 'gpt-4o',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed OpenAI response: missing usage',
        );
      });

      it('should throw InternalServerErrorException for unknown error', async () => {
        const error = new Error('Unknown error');
        mockClient.chat.completions.create.mockRejectedValue(error);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Unexpected error during OpenAI API call',
        );
      });
    });

    describe('executeWithTools()', () => {
      it('should map Agent Harness tool definitions to OpenAI tool declarations', async () => {
        const toolDefinition = AGENT_HARNESS_TOOL_DEFINITIONS_V1[0];
        mockClient.chat.completions.create.mockResolvedValue({
          choices: [
            {
              message: { content: 'Tool metadata mapped' },
              finish_reason: 'stop',
            },
          ],
          usage: { total_tokens: 100 },
          model: 'gpt-4o',
        });

        await adapter.executeWithTools(
          {
            sessionId: 'session-1',
            conversationId: 'conv-1',
            userId: 'user-1',
            prompt: 'Test prompt',
            provider: 'stub',
          },
          {
            tools: [toolDefinition],
          },
        );

        expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
          expect.objectContaining({
            tools: [
              {
                type: 'function',
                function: {
                  name: toolDefinition.name,
                  description: toolDefinition.description,
                  parameters: toolDefinition.inputSchema.schema,
                },
              },
            ],
            tool_choice: 'auto',
          }),
          {},
        );
      });

      it('should parse tool_calls metadata without executing tools', async () => {
        mockClient.chat.completions.create.mockResolvedValue({
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'call_123',
                    type: 'function',
                    function: {
                      name: 'read_file',
                      arguments: '{"path":"README.md"}',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { total_tokens: 100 },
          model: 'gpt-4o',
        });

        const result = await adapter.executeWithTools(
          {
            sessionId: 'session-1',
            conversationId: 'conv-1',
            userId: 'user-1',
            prompt: 'Test prompt',
            provider: 'stub',
          },
          {
            tools: [AGENT_HARNESS_TOOL_DEFINITIONS_V1[1]],
          },
        );

        expect(result.finishReason).toBe('tool_calls');
        expect(result.output).toBe('');
        expect(result.toolCalls).toEqual([
          {
            callId: 'call_123',
            toolName: 'read_file',
            arguments: { path: 'README.md' },
            providerKind: 'openai-tool_calls',
          },
        ]);
      });

      it('should parse legacy function_call metadata when tool_calls are absent', async () => {
        mockClient.chat.completions.create.mockResolvedValue({
          choices: [
            {
              message: {
                content: null,
                function_call: {
                  name: 'search_workspace',
                  arguments: '{"query":"adapter"}',
                },
              },
              finish_reason: 'function_call',
            },
          ],
          usage: { total_tokens: 88 },
          model: 'gpt-4o',
        });

        const result = await adapter.executeWithTools({
          sessionId: 'session-1',
          conversationId: 'conv-1',
          userId: 'user-1',
          prompt: 'Test prompt',
          provider: 'stub',
        });

        expect(result.finishReason).toBe('tool_calls');
        expect(result.toolCalls).toEqual([]);
        expect(result.canonicalToolCalls).toEqual([
          {
            status: 'missing_id',
            toolName: 'search_workspace',
            rawArguments: '{"query":"adapter"}',
            providerKind: 'openai-function_call',
          },
        ]);
        expect(JSON.stringify(result.canonicalToolCalls)).not.toContain(
          'openai-function-call-1',
        );
      });

      it('should safely handle missing tool definitions', async () => {
        mockClient.chat.completions.create.mockResolvedValue({
          choices: [
            {
              message: { content: 'No tool metadata' },
              finish_reason: 'stop',
            },
          ],
          usage: { total_tokens: 42 },
          model: 'gpt-4o',
        });

        const result = await adapter.executeWithTools({
          sessionId: 'session-1',
          conversationId: 'conv-1',
          userId: 'user-1',
          prompt: 'Test prompt',
          provider: 'stub',
        });

        expect(result.finishReason).toBe('completed');
        expect(result.toolCalls).toEqual([]);
        expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
          expect.not.objectContaining({ tools: expect.anything() }),
          {},
        );
      });

      it('sends system, user, and advertised tools on the first recorded request body', async () => {
        mockClient.chat.completions.create.mockResolvedValue({
          choices: [
            {
              message: { content: 'First turn' },
              finish_reason: 'stop',
            },
          ],
          usage: { total_tokens: 11 },
          model: 'gpt-4o',
        });
        const listFiles = AGENT_HARNESS_TOOL_DEFINITIONS_V1[0];
        const readFile = AGENT_HARNESS_TOOL_DEFINITIONS_V1[1];
        const tools = [listFiles, readFile];

        await adapter.executeWithTools(
          {
            sessionId: 'session-1',
            conversationId: 'conv-1',
            userId: 'user-1',
            prompt: 'List then read README.md',
            systemPrompt: 'You are a read-only assistant.',
            provider: 'openai',
          },
          { tools },
        );

        expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);
        const recordedBody = mockClient.chat.completions.create.mock.calls[0][0];
        expect(recordedBody.messages).toEqual([
          { role: 'system', content: 'You are a read-only assistant.' },
          { role: 'user', content: 'List then read README.md' },
        ]);
        expect(recordedBody.tools).toEqual([
          {
            type: 'function',
            function: {
              name: listFiles.name,
              description: listFiles.description,
              parameters: listFiles.inputSchema.schema,
            },
          },
          {
            type: 'function',
            function: {
              name: readFile.name,
              description: readFile.description,
              parameters: readFile.inputSchema.schema,
            },
          },
        ]);
        expect(tools).toHaveLength(2);
      });

      it('records assistant tool_calls then matching role=tool messages on the second request body', async () => {
        mockClient.chat.completions.create.mockResolvedValue({
          choices: [
            {
              message: { content: 'Done with tools.' },
              finish_reason: 'stop',
            },
          ],
          usage: { total_tokens: 22 },
          model: 'gpt-4o',
        });
        const tools = [
          AGENT_HARNESS_TOOL_DEFINITIONS_V1[0],
          AGENT_HARNESS_TOOL_DEFINITIONS_V1[1],
        ];
        const priorToolResults = [
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
        ];
        const transcript: AIAdapterCanonicalTranscriptTurn[] = [
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
            ],
          },
          {
            kind: 'tool_result_turn',
            results: priorToolResults,
          },
        ];

        await adapter.executeWithTools(
          {
            sessionId: 'session-1',
            conversationId: 'conv-1',
            userId: 'user-1',
            prompt: 'List then read README.md',
            systemPrompt: 'You are a read-only assistant.',
            provider: 'openai',
          },
          { tools, toolResults: priorToolResults, transcript },
        );

        expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);
        const recordedBody = mockClient.chat.completions.create.mock.calls[0][0];
        expect(recordedBody.messages).toEqual([
          { role: 'system', content: 'You are a read-only assistant.' },
          { role: 'user', content: 'List then read README.md' },
          {
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
            ],
          },
          {
            role: 'tool',
            tool_call_id: 'call_aaa',
            content: JSON.stringify({ entries: ['README.md'] }),
          },
          {
            role: 'tool',
            tool_call_id: 'call_bbb',
            content: JSON.stringify({ content: '# Title' }),
          },
        ]);
        expect(
          recordedBody.messages.filter((message: { role: string }) => message.role === 'user'),
        ).toHaveLength(1);
        expect(recordedBody.tools).toHaveLength(2);
        expect(recordedBody.tools[0].function.name).toBe('list_files');
        expect(JSON.stringify(recordedBody.messages)).not.toContain(
          JSON.stringify({ entries: ['README.md'] }) +
            JSON.stringify({ entries: ['README.md'] }),
        );
      });

      it('does not leak transcript state across sequential executeWithTools calls', async () => {
        mockClient.chat.completions.create.mockResolvedValue({
          choices: [
            {
              message: { content: 'ok' },
              finish_reason: 'stop',
            },
          ],
          usage: { total_tokens: 4 },
          model: 'gpt-4o',
        });
        const tools = [AGENT_HARNESS_TOOL_DEFINITIONS_V1[1]];
        const firstTranscript: AIAdapterCanonicalTranscriptTurn[] = [
          {
            kind: 'assistant_tool_turn',
            content: '',
            toolCalls: [
              {
                status: 'valid',
                callId: 'secret_call_1',
                toolName: 'read_file',
                arguments: { path: 'secret.md' },
                rawArguments: '{"path":"secret.md"}',
                providerKind: 'openai-tool_calls',
              },
            ],
          },
          {
            kind: 'tool_result_turn',
            results: [
              {
                callId: 'secret_call_1',
                toolName: 'read_file',
                success: true,
                content: { content: 'classified' },
              },
            ],
          },
        ];

        await adapter.executeWithTools(
          {
            sessionId: 'session-a',
            conversationId: 'conv-a',
            userId: 'user-1',
            prompt: 'first execution',
            provider: 'openai',
          },
          { tools, transcript: firstTranscript },
        );
        await adapter.executeWithTools(
          {
            sessionId: 'session-b',
            conversationId: 'conv-b',
            userId: 'user-1',
            prompt: 'second execution',
            provider: 'openai',
          },
          { tools },
        );

        const secondBody = mockClient.chat.completions.create.mock.calls[1][0];
        expect(secondBody.messages).toEqual([
          { role: 'user', content: 'second execution' },
        ]);
        expect(JSON.stringify(secondBody.messages)).not.toContain('secret_call_1');
        expect(JSON.stringify(secondBody.messages)).not.toContain('classified');
      });

      it('extracts malformed arguments and missing IDs without inventing fallback IDs or {}', async () => {
        mockClient.chat.completions.create.mockResolvedValue({
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'call_good',
                    type: 'function',
                    function: {
                      name: 'read_file',
                      arguments: '{"path":"README.md"}',
                    },
                  },
                  {
                    id: 'call_bad_json',
                    type: 'function',
                    function: {
                      name: 'read_file',
                      arguments: '{not-json',
                    },
                  },
                  {
                    id: '',
                    type: 'function',
                    function: {
                      name: 'list_files',
                      arguments: '{"path":"."}',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { total_tokens: 30 },
          model: 'gpt-4o',
        });

        const result = await adapter.executeWithTools(
          {
            sessionId: 'session-1',
            conversationId: 'conv-1',
            userId: 'user-1',
            prompt: 'Read files',
            provider: 'openai',
          },
          { tools: [AGENT_HARNESS_TOOL_DEFINITIONS_V1[1]] },
        );

        expect(result.toolCalls).toEqual([
          {
            callId: 'call_good',
            toolName: 'read_file',
            arguments: { path: 'README.md' },
            providerKind: 'openai-tool_calls',
          },
        ]);
        expect(result.canonicalToolCalls).toEqual([
          {
            status: 'valid',
            callId: 'call_good',
            toolName: 'read_file',
            arguments: { path: 'README.md' },
            rawArguments: '{"path":"README.md"}',
            providerKind: 'openai-tool_calls',
          },
          {
            status: 'malformed_arguments',
            callId: 'call_bad_json',
            toolName: 'read_file',
            rawArguments: '{not-json',
            providerKind: 'openai-tool_calls',
            errorMessage: expect.stringContaining('MALFORMED_TOOL_ARGUMENTS'),
          },
          {
            status: 'missing_id',
            toolName: 'list_files',
            rawArguments: '{"path":"."}',
            providerKind: 'openai-tool_calls',
          },
        ]);
        expect(JSON.stringify(result)).not.toContain('openai-tool-call-');
        expect(result.canonicalToolCalls?.[1]).not.toEqual(
          expect.objectContaining({ arguments: {} }),
        );
      });
    });
  });
});
