import {
  InternalServerErrorException,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AGENT_HARNESS_TOOL_DEFINITIONS_V1 } from '../../../agent-harness/tools/tool-registry';
import { DeepSeekAdapter } from '../deepseek-ai.adapter';
import type { AIAdapterCanonicalTranscriptTurn } from '../adapter-tool-use.contracts';
import { AIExecutionRequest } from '../../types';

describe('DeepSeekAdapter', () => {
  describe('constructor', () => {
    it('should instantiate with valid API key', () => {
      const adapter = new DeepSeekAdapter('sk-test-key-123');
      expect(adapter).toBeInstanceOf(DeepSeekAdapter);
      expect(adapter.model).toBe('deepseek-v4-flash');
    });

    it('should throw error when API key is undefined', () => {
      expect(() => new DeepSeekAdapter(undefined as any)).toThrow(
        'DeepSeek API key is required',
      );
    });

    it('should throw error when API key is empty string', () => {
      expect(() => new DeepSeekAdapter('')).toThrow(
        'DeepSeek API key is required',
      );
    });

    it('should throw error when API key is whitespace only', () => {
      expect(() => new DeepSeekAdapter('   ')).toThrow(
        'DeepSeek API key is required',
      );
    });

    it('should use default model when not specified', () => {
      const adapter = new DeepSeekAdapter('sk-test-key-123');
      expect(adapter.model).toBe('deepseek-v4-flash');
    });

    it('should use custom model when specified', () => {
      const adapter = new DeepSeekAdapter('sk-test-key-123', {
        model: 'deepseek-coder',
      });
      expect(adapter.model).toBe('deepseek-coder');
    });

    it('should use custom maxTokens when specified', () => {
      const adapter = new DeepSeekAdapter('sk-test-key-123', {
        maxTokens: 2048,
      });
      expect(adapter).toBeInstanceOf(DeepSeekAdapter);
    });

    it('should use custom temperature when specified', () => {
      const adapter = new DeepSeekAdapter('sk-test-key-123', {
        temperature: 0.5,
      });
      expect(adapter).toBeInstanceOf(DeepSeekAdapter);
    });

    it('should use custom baseURL when specified', () => {
      const adapter = new DeepSeekAdapter('sk-test-key-123', {
        baseURL: 'https://custom.deepseek.com',
      });
      expect(adapter).toBeInstanceOf(DeepSeekAdapter);
    });
  });

  describe('execute()', () => {
    let adapter: DeepSeekAdapter;
    let mockClient: any;

    beforeEach(() => {
      adapter = new DeepSeekAdapter('sk-test-key-123');
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
      it('should transform AIExecutionRequest to DeepSeek format', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: 100 },
          model: 'deepseek-chat',
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
            model: 'deepseek-v4-flash',
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
          model: 'deepseek-chat',
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
            model: 'deepseek-v4-flash',
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

      it('should extract text content from response.choices[0].message.content', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output from DeepSeek' } }],
          usage: { total_tokens: 150 },
          model: 'deepseek-chat',
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

        expect(result.output).toBe('Test output from DeepSeek');
      });

      it('should extract token usage from response.usage.total_tokens', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: {
            prompt_tokens: 50,
            completion_tokens: 75,
            total_tokens: 125,
          },
          model: 'deepseek-chat',
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
          model: 'deepseek-chat-v2',
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

        expect(result.model).toBe('deepseek-chat-v2');
      });

      it('should handle response with custom model identifier', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: 100 },
          model: 'deepseek-coder',
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

        expect(result.model).toBe('deepseek-coder');
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

        expect(result.model).toBe('deepseek-v4-flash');
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
          'Invalid DeepSeek API key',
        );
      });

      it('should throw BadRequestException for 400 (validation error)', async () => {
        const error = { status: 400, message: 'Invalid request' };
        mockClient.chat.completions.create.mockRejectedValue(error);

        await expect(adapter.execute(request)).rejects.toThrow(
          BadRequestException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Invalid request to DeepSeek API',
        );
      });

      it('should throw ServiceUnavailableException for 429 (rate limit)', async () => {
        const error = { status: 429, message: 'Rate limit exceeded' };
        mockClient.chat.completions.create.mockRejectedValue(error);

        await expect(adapter.execute(request)).rejects.toThrow(
          ServiceUnavailableException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'DeepSeek API rate limit exceeded',
        );
      });

      it('should throw InternalServerErrorException for 500 (server error)', async () => {
        const error = { status: 500, message: 'Internal server error' };
        mockClient.chat.completions.create.mockRejectedValue(error);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'DeepSeek API server error',
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
          'DeepSeek API timeout',
        );
      });

      it('should throw ServiceUnavailableException for network error (ECONNREFUSED)', async () => {
        const error = new Error('connect ECONNREFUSED 127.0.0.1:443');
        mockClient.chat.completions.create.mockRejectedValue(error);

        await expect(adapter.execute(request)).rejects.toThrow(
          ServiceUnavailableException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'DeepSeek API connection error',
        );
      });

      it('should throw InternalServerErrorException for malformed response (missing choices)', async () => {
        const mockResponse = {
          usage: { total_tokens: 100 },
          model: 'deepseek-chat',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed DeepSeek response: missing choices',
        );
      });

      it('should throw InternalServerErrorException for malformed response (empty choices array)', async () => {
        const mockResponse = {
          choices: [],
          usage: { total_tokens: 100 },
          model: 'deepseek-chat',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed DeepSeek response: missing choices',
        );
      });

      it('should throw InternalServerErrorException for malformed response (missing content)', async () => {
        const mockResponse = {
          choices: [{ message: { content: null } }],
          usage: { total_tokens: 100 },
          model: 'deepseek-chat',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed DeepSeek response: missing content',
        );
      });

      it('should throw InternalServerErrorException for malformed response (empty content)', async () => {
        const mockResponse = {
          choices: [{ message: { content: '' } }],
          usage: { total_tokens: 100 },
          model: 'deepseek-chat',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed DeepSeek response: missing content',
        );
      });

      it('should throw InternalServerErrorException for malformed response (missing usage)', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          model: 'deepseek-chat',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed DeepSeek response: missing usage',
        );
      });

      it('should throw InternalServerErrorException for malformed response (invalid token count - null)', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: null },
          model: 'deepseek-chat',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed DeepSeek response: missing usage',
        );
      });

      it('should throw InternalServerErrorException for malformed response (negative token count)', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: -10 },
          model: 'deepseek-chat',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed DeepSeek response: invalid token count',
        );
      });

      it('should throw InternalServerErrorException for malformed response (string token count)', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: '100' as any },
          model: 'deepseek-chat',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed DeepSeek response: missing usage',
        );
      });

      it('should throw InternalServerErrorException for malformed response (missing total_tokens field)', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { prompt_tokens: 50, completion_tokens: 50 },
          model: 'deepseek-chat',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed DeepSeek response: missing usage',
        );
      });

      it('should throw InternalServerErrorException for unknown error', async () => {
        const error = new Error('Unknown error');
        mockClient.chat.completions.create.mockRejectedValue(error);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Unexpected error during DeepSeek API call',
        );
      });
    });

    describe('executeWithTools()', () => {
      const listFiles = AGENT_HARNESS_TOOL_DEFINITIONS_V1[0];
      const readFile = AGENT_HARNESS_TOOL_DEFINITIONS_V1[1];
      const tools = [listFiles, readFile];
      const request: AIExecutionRequest = {
        sessionId: 'session-1',
        conversationId: 'conv-1',
        userId: 'user-1',
        prompt: 'List the workspace.',
        provider: 'deepseek',
      };
      const openAITools = [
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
      ];

      it('sends tools, tool_choice, and max_tokens 16000 without temperature or thinking', async () => {
        const signal = new AbortController().signal;
        mockClient.chat.completions.create.mockResolvedValue({
          choices: [
            {
              finish_reason: 'stop',
              message: { content: 'No tools needed.' },
            },
          ],
          usage: { total_tokens: 6 },
          model: 'deepseek-v4-pro',
        });

        expect(adapter.supportsToolUse).toBe(true);
        await adapter.executeWithTools(
          {
            ...request,
            model: '  deepseek-v4-pro  ',
            systemPrompt: '  Follow platform contract.  ',
            signal,
          },
          { tools },
        );

        expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
          {
            model: 'deepseek-v4-pro',
            max_tokens: 16000,
            messages: [
              { role: 'system', content: 'Follow platform contract.' },
              { role: 'user', content: 'List the workspace.' },
            ],
            tools: openAITools,
            tool_choice: 'auto',
          },
          { signal },
        );
        const recordedBody = mockClient.chat.completions.create.mock.calls[0][0];
        expect(recordedBody).not.toHaveProperty('temperature');
        expect(recordedBody).not.toHaveProperty('thinking');
      });

      it('returns deepseek reasoning providerState when tool calls include reasoning_content', async () => {
        const reasoningContent = '  The user wants a listing.\nKeep this exact.  ';
        mockClient.chat.completions.create.mockResolvedValue({
          choices: [
            {
              finish_reason: 'tool_calls',
              message: {
                content: 'Listing files.',
                reasoning_content: reasoningContent,
                tool_calls: [
                  {
                    id: 'call_aaa',
                    type: 'function',
                    function: { name: 'list_files', arguments: '{"path":"."}' },
                  },
                ],
              },
            },
          ],
          usage: { total_tokens: 42 },
          model: 'deepseek-v4-flash',
        });

        const result = await adapter.executeWithTools(request, { tools });

        expect(result.output).toBe('Listing files.');
        expect(result.tokensUsed).toBe(42);
        expect(result.model).toBe('deepseek-v4-flash');
        expect(result.finishReason).toBe('tool_calls');
        expect(result.toolCalls).toEqual([
          {
            callId: 'call_aaa',
            toolName: 'list_files',
            arguments: { path: '.' },
            providerKind: 'openai-tool_calls',
          },
        ]);
        expect(result.canonicalToolCalls).toEqual([
          {
            status: 'valid',
            callId: 'call_aaa',
            toolName: 'list_files',
            arguments: { path: '.' },
            rawArguments: '{"path":"."}',
            providerKind: 'openai-tool_calls',
          },
        ]);
        expect(result.providerState).toEqual({
          kind: 'deepseek-reasoning',
          reasoningContent,
        });
        const providerState = result.providerState as { reasoningContent: string };
        expect(providerState.reasoningContent).toBe(reasoningContent);
      });

      it('sends reasoning_content back with the tool result and matching tool_call_id', async () => {
        const reasoningContent = '  The user wants a listing.\nKeep this exact.  ';
        mockClient.chat.completions.create
          .mockResolvedValueOnce({
            choices: [
              {
                finish_reason: 'tool_calls',
                message: {
                  content: 'Listing files.',
                  reasoning_content: reasoningContent,
                  tool_calls: [
                    {
                      id: 'call_aaa',
                      type: 'function',
                      function: { name: 'list_files', arguments: '{"path":"."}' },
                    },
                  ],
                },
              },
            ],
            usage: { total_tokens: 42 },
            model: 'deepseek-v4-flash',
          })
          .mockResolvedValueOnce({
            choices: [
              {
                finish_reason: 'stop',
                message: { content: 'README.md is the only file.' },
              },
            ],
            usage: { total_tokens: 18 },
            model: 'deepseek-v4-flash',
          });

        const first = await adapter.executeWithTools(request, { tools });
        const transcript: AIAdapterCanonicalTranscriptTurn[] = [
          {
            kind: 'assistant_tool_turn',
            content: 'Earlier step.',
            toolCalls: [
              {
                status: 'valid',
                callId: 'call_old',
                toolName: 'list_files',
                arguments: { path: 'old' },
                rawArguments: '{"path":"old"}',
                providerKind: 'openai-tool_calls',
              },
            ],
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
            content: first.output,
            toolCalls: first.canonicalToolCalls ?? [],
            providerState: first.providerState,
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
            ],
          },
        ];
        const second = await adapter.executeWithTools(request, { tools, transcript });

        expect(second.output).toBe('README.md is the only file.');
        expect(second).not.toHaveProperty('providerState');
        const secondBody = mockClient.chat.completions.create.mock.calls[1][0];
        expect(secondBody).toEqual({
          model: 'deepseek-v4-flash',
          max_tokens: 16000,
          tool_choice: 'auto',
          tools: openAITools,
          messages: [
            { role: 'user', content: 'List the workspace.' },
            {
              role: 'assistant',
              content: 'Earlier step.',
              tool_calls: [
                {
                  id: 'call_old',
                  type: 'function',
                  function: { name: 'list_files', arguments: '{"path":"old"}' },
                },
              ],
            },
            {
              role: 'tool',
              tool_call_id: 'call_old',
              content: JSON.stringify({ entries: ['stale.txt'] }),
            },
            {
              role: 'assistant',
              content: 'Listing files.',
              tool_calls: [
                {
                  id: 'call_aaa',
                  type: 'function',
                  function: { name: 'list_files', arguments: '{"path":"."}' },
                },
              ],
              reasoning_content: reasoningContent,
            },
            {
              role: 'tool',
              tool_call_id: 'call_aaa',
              content: JSON.stringify({ entries: ['README.md'] }),
            },
          ],
        });
        expect(secondBody).not.toHaveProperty('temperature');
        expect(secondBody).not.toHaveProperty('thinking');
        expect(secondBody.messages[1]).not.toHaveProperty('reasoning_content');
        expect(secondBody.messages[4].tool_call_id).toBe('call_aaa');
      });

      it('omits providerState when reasoning_content is not a string or tool calls are absent', async () => {
        mockClient.chat.completions.create
          .mockResolvedValueOnce({
            choices: [
              {
                finish_reason: 'tool_calls',
                message: {
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_aaa',
                      type: 'function',
                      function: { name: 'list_files', arguments: '{"path":"."}' },
                    },
                  ],
                },
              },
            ],
            usage: { total_tokens: 9 },
            model: 'deepseek-v4-flash',
          })
          .mockResolvedValueOnce({
            choices: [
              {
                finish_reason: 'tool_calls',
                message: {
                  content: 'Listing files.',
                  reasoning_content: null,
                  tool_calls: [
                    {
                      id: 'call_aaa',
                      type: 'function',
                      function: { name: 'list_files', arguments: '{"path":"."}' },
                    },
                  ],
                },
              },
            ],
            usage: { total_tokens: 9 },
            model: 'deepseek-v4-flash',
          })
          .mockResolvedValueOnce({
            choices: [
              {
                finish_reason: 'stop',
                message: {
                  content: 'Just text.',
                  reasoning_content: 'thoughts that are not sent back',
                },
              },
            ],
            usage: { total_tokens: 4 },
            model: 'deepseek-v4-flash',
          });

        const withoutReasoning = await adapter.executeWithTools(request, { tools });
        const nullReasoning = await adapter.executeWithTools(request, { tools });
        const textOnly = await adapter.executeWithTools(request);

        expect(withoutReasoning.output).toBe('');
        expect(withoutReasoning.toolCalls).toHaveLength(1);
        expect(withoutReasoning).not.toHaveProperty('providerState');
        expect(nullReasoning).not.toHaveProperty('providerState');
        expect(textOnly.output).toBe('Just text.');
        expect(textOnly.finishReason).toBe('stop');
        expect(textOnly).not.toHaveProperty('providerState');
        const textBody = mockClient.chat.completions.create.mock.calls[2][0];
        expect(textBody.max_tokens).toBe(16000);
        expect(textBody).not.toHaveProperty('tools');
        expect(textBody).not.toHaveProperty('tool_choice');
        expect(textBody).not.toHaveProperty('temperature');
        expect(textBody).not.toHaveProperty('thinking');
      });

      it('maps finish_reason onto the existing finish reasons, preferring tool calls', async () => {
        mockClient.chat.completions.create
          .mockResolvedValueOnce({
            choices: [
              { finish_reason: 'length', message: { content: 'cut off' } },
            ],
            usage: { total_tokens: 3 },
            model: 'deepseek-v4-flash',
          })
          .mockResolvedValueOnce({
            choices: [
              { finish_reason: 'content_filter', message: { content: 'blocked' } },
            ],
            usage: { total_tokens: 3 },
            model: 'deepseek-v4-flash',
          })
          .mockResolvedValueOnce({
            choices: [
              {
                finish_reason: 'stop',
                message: {
                  content: '',
                  tool_calls: [
                    {
                      id: 'call_aaa',
                      type: 'function',
                      function: { name: 'list_files', arguments: '{"path":"."}' },
                    },
                  ],
                },
              },
            ],
            usage: { total_tokens: 5 },
            model: 'deepseek-v4-flash',
          });

        expect((await adapter.executeWithTools(request)).finishReason).toBe('max_tokens');
        expect((await adapter.executeWithTools(request)).finishReason).toBe('unknown');
        expect((await adapter.executeWithTools(request)).finishReason).toBe('tool_calls');
      });

      it('reports malformed arguments and a missing call id without inventing metadata', async () => {
        mockClient.chat.completions.create.mockResolvedValue({
          choices: [
            {
              finish_reason: 'tool_calls',
              message: {
                content: 'Trying tools.',
                tool_calls: [
                  {
                    id: 'call_ok',
                    type: 'function',
                    function: { name: 'list_files', arguments: '{"path":"."}' },
                  },
                  {
                    id: 'call_bad',
                    type: 'function',
                    function: { name: 'read_file', arguments: '{not-json' },
                  },
                  {
                    id: '   ',
                    type: 'function',
                    function: { name: 'list_files', arguments: '{"path":"src"}' },
                  },
                  {
                    type: 'function',
                    function: { name: 'read_file', arguments: '{"path":"README.md"}' },
                  },
                ],
              },
            },
          ],
          usage: { total_tokens: 11 },
          model: 'deepseek-v4-flash',
        });

        const result = await adapter.executeWithTools(request, { tools });

        expect(result.finishReason).toBe('tool_calls');
        expect(result.toolCalls).toEqual([
          {
            callId: 'call_ok',
            toolName: 'list_files',
            arguments: { path: '.' },
            providerKind: 'openai-tool_calls',
          },
        ]);
        expect(result.canonicalToolCalls).toEqual([
          {
            status: 'valid',
            callId: 'call_ok',
            toolName: 'list_files',
            arguments: { path: '.' },
            rawArguments: '{"path":"."}',
            providerKind: 'openai-tool_calls',
          },
          {
            status: 'malformed_arguments',
            callId: 'call_bad',
            toolName: 'read_file',
            rawArguments: '{not-json',
            providerKind: 'openai-tool_calls',
            errorMessage:
              'MALFORMED_TOOL_ARGUMENTS: arguments are not valid JSON object',
          },
          {
            status: 'missing_id',
            toolName: 'list_files',
            rawArguments: '{"path":"src"}',
            providerKind: 'openai-tool_calls',
          },
          {
            status: 'missing_id',
            toolName: 'read_file',
            rawArguments: '{"path":"README.md"}',
            providerKind: 'openai-tool_calls',
          },
        ]);
        expect(result).not.toHaveProperty('providerState');
      });

      it('rejects malformed usage with the DeepSeek malformed-response errors', async () => {
        mockClient.chat.completions.create.mockResolvedValueOnce({
          choices: [
            { finish_reason: 'stop', message: { content: 'ok' } },
          ],
          model: 'deepseek-v4-flash',
        });
        await expect(adapter.executeWithTools(request)).rejects.toThrow(
          'Malformed DeepSeek response: missing usage',
        );

        mockClient.chat.completions.create.mockResolvedValueOnce({
          choices: [
            { finish_reason: 'stop', message: { content: 'ok' } },
          ],
          usage: { total_tokens: '12' },
          model: 'deepseek-v4-flash',
        });
        await expect(adapter.executeWithTools(request)).rejects.toThrow(
          'Malformed DeepSeek response: missing usage',
        );

        mockClient.chat.completions.create.mockResolvedValueOnce({
          choices: [
            { finish_reason: 'stop', message: { content: 'ok' } },
          ],
          usage: { total_tokens: -1 },
          model: 'deepseek-v4-flash',
        });
        await expect(adapter.executeWithTools(request)).rejects.toThrow(
          'Malformed DeepSeek response: invalid token count',
        );
      });

      it('rejects empty output when the response has no tool calls', async () => {
        mockClient.chat.completions.create.mockResolvedValue({
          choices: [
            { finish_reason: 'stop', message: { content: '   ' } },
          ],
          usage: { total_tokens: 1 },
          model: 'deepseek-v4-flash',
        });

        await expect(adapter.executeWithTools(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.executeWithTools(request)).rejects.toThrow(
          'Malformed DeepSeek response: missing content',
        );
      });

      it('keeps the plain execute request shape unchanged', async () => {
        mockClient.chat.completions.create.mockResolvedValue({
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: 100 },
          model: 'deepseek-chat',
        });

        await adapter.execute({
          sessionId: 'session-1',
          conversationId: 'conv-1',
          userId: 'user-1',
          prompt: 'Test prompt',
          provider: 'deepseek',
        });

        expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
          {
            model: 'deepseek-v4-flash',
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
    });
  });
});
