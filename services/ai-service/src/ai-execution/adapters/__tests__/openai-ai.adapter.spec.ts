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
        responses: {
          create: jest.fn(),
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

      it('keeps a plain gpt-4o request on chat completions with the current body', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: 100 },
          model: 'gpt-4o',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await adapter.execute({
          sessionId: 'session-1',
          conversationId: 'conv-1',
          userId: 'user-1',
          prompt: 'Test prompt',
          provider: 'stub',
          model: 'gpt-4o',
        });

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
        expect(mockClient.responses.create).not.toHaveBeenCalled();
      });

      it('sends max_completion_tokens and omits temperature for gpt-6.1-sol', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: 100 },
          model: 'gpt-6.1-sol',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await adapter.execute({
          sessionId: 'session-1',
          conversationId: 'conv-1',
          userId: 'user-1',
          prompt: 'Test prompt',
          systemPrompt: '  Follow platform contract.  ',
          provider: 'stub',
          model: 'gpt-6.1-sol',
        });

        expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
          {
            model: 'gpt-6.1-sol',
            max_completion_tokens: 4096,
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
        const body = mockClient.chat.completions.create.mock.calls[0][0];
        expect(body).not.toHaveProperty('temperature');
        expect(body).not.toHaveProperty('max_tokens');
        expect(mockClient.responses.create).not.toHaveBeenCalled();
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
      const responsesText = (text: string, totalTokens = 100) => ({
        id: 'resp_text',
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text }],
          },
        ],
        usage: { total_tokens: totalTokens },
        model: 'gpt-4o',
      });

      it('should map Agent Harness tool definitions to Responses function tools', async () => {
        const toolDefinition = AGENT_HARNESS_TOOL_DEFINITIONS_V1[0];
        mockClient.responses.create.mockResolvedValue(
          responsesText('Tool metadata mapped'),
        );

        await adapter.executeWithTools(
          {
            sessionId: 'session-1',
            conversationId: 'conv-1',
            userId: 'user-1',
            prompt: 'Test prompt',
            provider: 'stub',
            model: 'gpt-4o',
          },
          {
            tools: [toolDefinition],
          },
        );

        expect(mockClient.chat.completions.create).not.toHaveBeenCalled();
        expect(mockClient.responses.create).toHaveBeenCalledWith(
          {
            model: 'gpt-4o',
            max_output_tokens: 16000,
            store: true,
            input: [{ role: 'user', content: 'Test prompt' }],
            tools: [
              {
                type: 'function',
                name: toolDefinition.name,
                description: toolDefinition.description,
                parameters: toolDefinition.inputSchema.schema,
                strict: false,
              },
            ],
          },
          {},
        );
        const recordedBody = mockClient.responses.create.mock.calls[0][0];
        expect(recordedBody).not.toHaveProperty('temperature');
        expect(recordedBody).not.toHaveProperty('tool_choice');
      });

      it('should parse function_call metadata without executing tools', async () => {
        mockClient.responses.create.mockResolvedValue({
          id: 'resp_call',
          status: 'completed',
          output: [
            {
              type: 'function_call',
              call_id: 'call_123',
              name: 'read_file',
              arguments: '{"path":"README.md"}',
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
            providerKind: 'openai-function_call',
          },
        ]);
        expect(result.providerState).toEqual({
          kind: 'responses',
          responseId: 'resp_call',
        });
        expect(mockClient.chat.completions.create).not.toHaveBeenCalled();
      });

      it('should report a function_call with no call id as missing_id', async () => {
        mockClient.responses.create.mockResolvedValue({
          id: 'resp_missing',
          status: 'completed',
          output: [
            {
              type: 'function_call',
              name: 'search_workspace',
              arguments: '{"query":"adapter"}',
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
        mockClient.responses.create.mockResolvedValue(
          responsesText('No tool metadata', 42),
        );

        const result = await adapter.executeWithTools({
          sessionId: 'session-1',
          conversationId: 'conv-1',
          userId: 'user-1',
          prompt: 'Test prompt',
          provider: 'stub',
        });

        expect(result.finishReason).toBe('completed');
        expect(result.toolCalls).toEqual([]);
        expect(result).not.toHaveProperty('providerState');
        expect(mockClient.responses.create).toHaveBeenCalledWith(
          expect.not.objectContaining({ tools: expect.anything() }),
          {},
        );
        expect(mockClient.chat.completions.create).not.toHaveBeenCalled();
      });

      it('sends instructions, the user prompt, and advertised tools on the first recorded request body', async () => {
        mockClient.responses.create.mockResolvedValue(responsesText('First turn', 11));
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

        expect(mockClient.responses.create).toHaveBeenCalledTimes(1);
        expect(mockClient.chat.completions.create).not.toHaveBeenCalled();
        const recordedBody = mockClient.responses.create.mock.calls[0][0];
        expect(recordedBody.instructions).toBe('You are a read-only assistant.');
        expect(recordedBody.input).toEqual([
          { role: 'user', content: 'List then read README.md' },
        ]);
        expect(recordedBody.previous_response_id).toBeUndefined();
        expect(recordedBody.tools).toEqual([
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
        expect(recordedBody).not.toHaveProperty('temperature');
        expect(recordedBody.max_output_tokens).toBe(16000);
        expect(recordedBody.store).toBe(true);
        expect(tools).toHaveLength(2);
      });

      it('sends previous_response_id and only the latest function outputs on the second request body', async () => {
        mockClient.responses.create.mockResolvedValue(responsesText('Done with tools.', 22));
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
            content: 'Earlier.',
            toolCalls: [],
            providerState: { kind: 'responses', responseId: 'resp_old' },
          },
          {
            kind: 'tool_result_turn',
            results: [
              {
                callId: 'call_old',
                toolName: 'list_files',
                success: true,
                content: { entries: ['stale.txt'] },
              },
            ],
          },
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
                providerKind: 'openai-function_call',
              },
              {
                status: 'valid',
                callId: 'call_bbb',
                toolName: 'read_file',
                arguments: { path: 'README.md' },
                rawArguments: '{"path":"README.md"}',
                providerKind: 'openai-function_call',
              },
            ],
            providerState: { kind: 'responses', responseId: 'resp_step_1' },
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

        expect(mockClient.responses.create).toHaveBeenCalledTimes(1);
        expect(mockClient.chat.completions.create).not.toHaveBeenCalled();
        const recordedBody = mockClient.responses.create.mock.calls[0][0];
        expect(recordedBody.previous_response_id).toBe('resp_step_1');
        expect(recordedBody.instructions).toBe('You are a read-only assistant.');
        expect(recordedBody.input).toEqual([
          {
            type: 'function_call_output',
            call_id: 'call_aaa',
            output: JSON.stringify({ entries: ['README.md'] }),
          },
          {
            type: 'function_call_output',
            call_id: 'call_bbb',
            output: JSON.stringify({ content: '# Title' }),
          },
        ]);
        expect(recordedBody.input.some((item: { role?: string }) => item.role === 'user')).toBe(
          false,
        );
        expect(recordedBody.tools).toHaveLength(2);
        expect(recordedBody.tools[0].name).toBe('list_files');
        expect(recordedBody.tools[0].strict).toBe(false);
        expect(recordedBody).not.toHaveProperty('temperature');
        expect(JSON.stringify(recordedBody.input)).not.toContain('call_old');
        expect(JSON.stringify(recordedBody.input)).not.toContain('stale.txt');
        expect(JSON.stringify(recordedBody.input)).not.toContain(
          JSON.stringify({ entries: ['README.md'] }) +
            JSON.stringify({ entries: ['README.md'] }),
        );
      });

      it('passes the first response id into the second step', async () => {
        mockClient.responses.create
          .mockResolvedValueOnce({
            id: 'resp_first',
            status: 'completed',
            output: [
              {
                type: 'function_call',
                call_id: 'call_1',
                name: 'read_file',
                arguments: '{"path":"README.md"}',
              },
            ],
            usage: { total_tokens: 10 },
            model: 'gpt-4o',
          })
          .mockResolvedValueOnce(responsesText('done', 12));
        const tools = [AGENT_HARNESS_TOOL_DEFINITIONS_V1[1]];
        const request = {
          sessionId: 'session-1',
          conversationId: 'conv-1',
          userId: 'user-1',
          prompt: 'Read README.md',
          provider: 'openai' as const,
          model: 'gpt-4o',
        };

        const first = await adapter.executeWithTools(request, { tools });
        await adapter.executeWithTools(request, {
          tools,
          transcript: [
            {
              kind: 'assistant_tool_turn',
              content: first.output,
              toolCalls: first.canonicalToolCalls ?? [],
              providerState: first.providerState,
            },
            {
              kind: 'tool_result_turn',
              results: [
                {
                  callId: 'call_1',
                  toolName: 'read_file',
                  success: true,
                  content: { content: 'hi' },
                },
              ],
            },
          ],
        });

        expect(first.providerState).toEqual({
          kind: 'responses',
          responseId: 'resp_first',
        });
        const secondBody = mockClient.responses.create.mock.calls[1][0];
        expect(secondBody.previous_response_id).toBe('resp_first');
        expect(secondBody.input).toEqual([
          {
            type: 'function_call_output',
            call_id: 'call_1',
            output: JSON.stringify({ content: 'hi' }),
          },
        ]);
        expect(secondBody).not.toHaveProperty('temperature');
        expect(mockClient.chat.completions.create).not.toHaveBeenCalled();
      });

      it('does not leak transcript state across sequential executeWithTools calls', async () => {
        mockClient.responses.create.mockResolvedValue(responsesText('ok', 4));
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
                providerKind: 'openai-function_call',
              },
            ],
            providerState: { kind: 'responses', responseId: 'resp_secret' },
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

        const secondBody = mockClient.responses.create.mock.calls[1][0];
        expect(secondBody.input).toEqual([
          { role: 'user', content: 'second execution' },
        ]);
        expect(secondBody.previous_response_id).toBeUndefined();
        expect(JSON.stringify(secondBody)).not.toContain('secret_call_1');
        expect(JSON.stringify(secondBody)).not.toContain('classified');
        expect(JSON.stringify(secondBody)).not.toContain('resp_secret');
      });

      it('extracts malformed arguments and missing IDs without inventing fallback IDs or {}', async () => {
        mockClient.responses.create.mockResolvedValue({
          id: 'resp_mixed',
          status: 'completed',
          output: [
            {
              type: 'function_call',
              call_id: 'call_good',
              name: 'read_file',
              arguments: '{"path":"README.md"}',
            },
            {
              type: 'function_call',
              call_id: 'call_bad_json',
              name: 'read_file',
              arguments: '{not-json',
            },
            {
              type: 'function_call',
              call_id: '',
              name: 'list_files',
              arguments: '{"path":"."}',
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
            providerKind: 'openai-function_call',
          },
        ]);
        expect(result.canonicalToolCalls).toEqual([
          {
            status: 'valid',
            callId: 'call_good',
            toolName: 'read_file',
            arguments: { path: 'README.md' },
            rawArguments: '{"path":"README.md"}',
            providerKind: 'openai-function_call',
          },
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
        expect(JSON.stringify(result)).not.toContain('openai-tool-call-');
        expect(JSON.stringify(result)).not.toContain('openai-function-call-');
        expect(result.canonicalToolCalls?.[1]).not.toEqual(
          expect.objectContaining({ arguments: {} }),
        );
      });

      it('uses responses.create for gpt-6.1-sol tool calls and forwards the abort signal', async () => {
        const signal = new AbortController().signal;
        mockClient.responses.create.mockResolvedValue(responsesText('ok', 3));

        await adapter.executeWithTools(
          {
            sessionId: 'session-1',
            conversationId: 'conv-1',
            userId: 'user-1',
            prompt: 'Read README.md',
            provider: 'openai',
            model: 'gpt-6.1-sol',
            signal,
          },
          { tools: [AGENT_HARNESS_TOOL_DEFINITIONS_V1[1]] },
        );

        const recordedBody = mockClient.responses.create.mock.calls[0][0];
        expect(recordedBody.model).toBe('gpt-6.1-sol');
        expect(recordedBody.max_output_tokens).toBe(16000);
        expect(recordedBody.store).toBe(true);
        expect(recordedBody).not.toHaveProperty('temperature');
        expect(recordedBody).not.toHaveProperty('max_completion_tokens');
        expect(mockClient.responses.create.mock.calls[0][1]).toEqual({ signal });
        expect(mockClient.chat.completions.create).not.toHaveBeenCalled();
      });

      it('keeps provider error handling on the responses path', async () => {
        mockClient.responses.create.mockRejectedValue({
          status: 401,
          message: 'Invalid API key',
        });

        const request = {
          sessionId: 'session-1',
          conversationId: 'conv-1',
          userId: 'user-1',
          prompt: 'Test prompt',
          provider: 'openai' as const,
        };

        await expect(adapter.executeWithTools(request)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(adapter.executeWithTools(request)).rejects.toThrow(
          'Invalid OpenAI API key',
        );
      });
    });
  });
});
