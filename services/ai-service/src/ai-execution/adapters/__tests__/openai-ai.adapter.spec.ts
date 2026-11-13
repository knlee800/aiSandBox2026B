import {
  InternalServerErrorException,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OpenAIAdapter } from '../openai-ai.adapter';
import { AIExecutionRequest } from '../../types';
import { AGENT_HARNESS_TOOL_DEFINITIONS_V1 } from '../../../agent-harness/tools/tool-registry';
import * as modelProfiles from '../../../agent-harness/model-profiles/model-profile.registry';
import { HARNESS_ENV_FILE_INSTRUCTION } from '../../../agent-harness/prompts/harness-instructions';
import type { AIAdapterCanonicalTranscriptTurn } from '../adapter-tool-use.contracts';
import { RESPONSES_CONTINUATION_INVALID_HISTORY_MESSAGE } from '../adapter-tool-use.mapper';

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

      it('uses the model profile plain output limit instead of a fixed 4096', async () => {
        const spy = jest
          .spyOn(modelProfiles, 'resolvePlainOutputTokenLimit')
          .mockReturnValue(8192);
        try {
          mockClient.chat.completions.create.mockResolvedValue({
            choices: [{ message: { content: 'Test output' } }],
            usage: { total_tokens: 100 },
            model: 'gpt-4o',
          });
          await adapter.execute({
            sessionId: 'session-1',
            conversationId: 'conv-1',
            userId: 'user-1',
            prompt: 'Test prompt',
            provider: 'openai',
            model: 'gpt-4o',
          });
          expect(mockClient.chat.completions.create.mock.calls[0][0].max_tokens).toBe(
            8192,
          );

          mockClient.chat.completions.create.mockClear();
          await adapter.execute({
            sessionId: 'session-1',
            conversationId: 'conv-1',
            userId: 'user-1',
            prompt: 'Test prompt',
            provider: 'openai',
            model: 'gpt-6.1-sol',
          });
          const gpt6Body = mockClient.chat.completions.create.mock.calls[0][0];
          expect(gpt6Body.max_completion_tokens).toBe(8192);
          expect(gpt6Body).not.toHaveProperty('max_tokens');
        } finally {
          spy.mockRestore();
        }
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
            store: false,
            instructions: HARNESS_ENV_FILE_INSTRUCTION,
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
        expect(recordedBody).not.toHaveProperty('include');
        expect(recordedBody).not.toHaveProperty('previous_response_id');
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
          outputItems: [
            {
              type: 'function_call',
              call_id: 'call_123',
              name: 'read_file',
              arguments: '{"path":"README.md"}',
            },
          ],
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
        expect(recordedBody.instructions).toBe(
          `You are a read-only assistant.\n${HARNESS_ENV_FILE_INSTRUCTION}`,
        );
        expect(recordedBody.input).toEqual([
          { role: 'user', content: 'List then read README.md' },
        ]);
        expect(recordedBody).not.toHaveProperty('previous_response_id');
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
        expect(recordedBody.store).toBe(false);
        expect(recordedBody.model).toBe('gpt-4o');
        expect(recordedBody).not.toHaveProperty('include');
        expect(tools).toHaveLength(2);
      });

      describe('ACCESS-01J stateless multi-step continuation', () => {
        const reasoningItem = {
          id: 'rs_1',
          type: 'reasoning',
          summary: [],
          encrypted_content: 'enc-reasoning-step-1',
        };
        const messageItem = {
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: 'Checking two files.', annotations: [] }],
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
        const tools = [
          AGENT_HARNESS_TOOL_DEFINITIONS_V1[0],
          AGENT_HARNESS_TOOL_DEFINITIONS_V1[1],
        ];
        const baseRequest: AIExecutionRequest = {
          sessionId: 'session-1',
          conversationId: 'conv-1',
          userId: 'user-1',
          prompt: 'List then read two files',
          systemPrompt: 'Follow platform contract.',
          provider: 'openai',
          model: 'gpt-6.1-sol',
        };
        const request = baseRequest;
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
            success: true,
            content: { content: '# Title' },
          },
        ];
        const resultsStep2 = [
          {
            callId: 'call_c',
            toolName: 'read_file',
            success: false,
            errorMessage: 'read failed',
          },
        ];
        const stepBodyKeys = [
          'include',
          'input',
          'instructions',
          'max_output_tokens',
          'model',
          'store',
          'tools',
        ];

        const stepBodyKeysWithoutInclude = stepBodyKeys.filter(
          (key) => key !== 'include',
        );

        const runThreeSteps = async (model = 'gpt-6.1-sol') => {
          const request = { ...baseRequest, model };
          mockClient.responses.create
            .mockResolvedValueOnce({
              id: 'resp_1',
              status: 'completed',
              model: 'gpt-6.1-sol',
              output: [reasoningItem, messageItem, callA, callB],
              usage: { total_tokens: 20 },
            })
            .mockResolvedValueOnce({
              id: 'resp_2',
              status: 'completed',
              model: 'gpt-6.1-sol',
              output: [callC],
              usage: { total_tokens: 15 },
            })
            .mockResolvedValueOnce(responsesText('All done.', 9));

          const transcript: AIAdapterCanonicalTranscriptTurn[] = [];
          const first = await adapter.executeWithTools(request, { tools });
          transcript.push(
            {
              kind: 'assistant_tool_turn',
              content: first.output,
              toolCalls: first.canonicalToolCalls ?? [],
              providerState: first.providerState,
            },
            { kind: 'tool_result_turn', results: resultsStep1 },
          );
          const second = await adapter.executeWithTools(request, {
            tools,
            toolResults: resultsStep1,
            transcript: transcript.slice(),
          });
          transcript.push(
            {
              kind: 'assistant_tool_turn',
              content: second.output,
              toolCalls: second.canonicalToolCalls ?? [],
              providerState: second.providerState,
            },
            { kind: 'tool_result_turn', results: resultsStep2 },
          );
          const third = await adapter.executeWithTools(request, {
            tools,
            toolResults: resultsStep2,
            transcript: transcript.slice(),
          });
          return { first, second, third, transcript };
        };

        it('sends store: false, include and the prompt only on step 1', async () => {
          await runThreeSteps();

          const firstBody = mockClient.responses.create.mock.calls[0][0];
          expect(firstBody.store).toBe(false);
          expect(firstBody.include).toEqual(['reasoning.encrypted_content']);
          expect(firstBody).not.toHaveProperty('previous_response_id');
          expect(firstBody.input).toEqual([
            { role: 'user', content: 'List then read two files' },
          ]);
          expect(Object.keys(firstBody).sort()).toEqual(stepBodyKeys);
        });

        it('replays the full ordered history on step 3, two calls in one turn, every call_id paired', async () => {
          const { first, third } = await runThreeSteps();

          expect(first.providerState).toEqual({
            kind: 'responses',
            outputItems: [reasoningItem, messageItem, callA, callB],
          });
          expect(third.output).toBe('All done.');
          expect(mockClient.responses.create).toHaveBeenCalledTimes(3);
          for (const call of mockClient.responses.create.mock.calls) {
            expect(call[0].store).toBe(false);
            expect(call[0]).not.toHaveProperty('previous_response_id');
            expect(call[0].include).toEqual(['reasoning.encrypted_content']);
            expect(Object.keys(call[0]).sort()).toEqual(stepBodyKeys);
          }

          const secondBody = mockClient.responses.create.mock.calls[1][0];
          expect(secondBody.input).toEqual([
            { role: 'user', content: 'List then read two files' },
            reasoningItem,
            messageItem,
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
              output: JSON.stringify({ content: '# Title' }),
            },
          ]);

          const thirdBody = mockClient.responses.create.mock.calls[2][0];
          expect(thirdBody.instructions).toBe(
            `Follow platform contract.\n${HARNESS_ENV_FILE_INSTRUCTION}`,
          );
          expect(thirdBody.input).toEqual([
            { role: 'user', content: 'List then read two files' },
            reasoningItem,
            messageItem,
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
              output: JSON.stringify({ content: '# Title' }),
            },
            callC,
            {
              type: 'function_call_output',
              call_id: 'call_c',
              output: 'read failed',
            },
          ]);
          const callIds = thirdBody.input
            .filter((item: { type?: string }) => item.type === 'function_call')
            .map((item: { call_id: string }) => item.call_id);
          const outputIds = thirdBody.input
            .filter((item: { type?: string }) => item.type === 'function_call_output')
            .map((item: { call_id: string }) => item.call_id);
          expect(callIds).toEqual(['call_a', 'call_b', 'call_c']);
          expect(outputIds).toEqual(callIds);
          expect(JSON.stringify(thirdBody)).not.toContain('resp_1');
          expect(JSON.stringify(thirdBody)).not.toContain('resp_2');
        });

        it('replays the earlier reasoning item unchanged', async () => {
          await runThreeSteps();

          const thirdBody = mockClient.responses.create.mock.calls[2][0];
          const reasoning = thirdBody.input.filter(
            (item: { type?: string }) => item.type === 'reasoning',
          );
          expect(reasoning).toEqual([reasoningItem]);
          expect(reasoning[0].encrypted_content).toBe('enc-reasoning-step-1');
        });

        it('fails closed on a malformed providerState and sends nothing', async () => {
          const malformedStates: unknown[] = [
            undefined,
            { kind: 'responses', responseId: 'resp_1' },
            { kind: 'responses', outputItems: [callA, { ...callB, call_id: undefined }] },
            { kind: 'responses', outputItems: [{ type: 'mystery' }, callA, callB] },
          ];

          for (const providerState of malformedStates) {
            mockClient.responses.create.mockClear();
            const transcript: AIAdapterCanonicalTranscriptTurn[] = [
              {
                kind: 'assistant_tool_turn',
                content: '',
                toolCalls: [
                  {
                    status: 'valid',
                    callId: 'call_a',
                    toolName: 'list_files',
                    arguments: { path: '.' },
                    rawArguments: '{"path":"."}',
                    providerKind: 'openai-function_call',
                  },
                  {
                    status: 'valid',
                    callId: 'call_b',
                    toolName: 'read_file',
                    arguments: { path: 'README.md' },
                    rawArguments: '{"path":"README.md"}',
                    providerKind: 'openai-function_call',
                  },
                ],
                providerState,
              },
              { kind: 'tool_result_turn', results: resultsStep1 },
            ];

            await expect(
              adapter.executeWithTools(request, { tools, transcript }),
            ).rejects.toThrow(InternalServerErrorException);
            await expect(
              adapter.executeWithTools(request, { tools, transcript }),
            ).rejects.toThrow(RESPONSES_CONTINUATION_INVALID_HISTORY_MESSAGE);
            expect(mockClient.responses.create).not.toHaveBeenCalled();
          }
        });

        it.each([
          ['gpt-6.1-sol', true],
          ['gpt-4o', false],
        ])('adds no field that carries keys or environment content (%s)', async (model, withInclude) => {
          const sentinel = 'env-sentinel-value-access-01j';
          const envName = 'OPENAI_API_KEY';
          const previous = process.env[envName];
          process.env[envName] = sentinel;
          try {
            await runThreeSteps(model);
          } finally {
            if (previous === undefined) {
              delete process.env[envName];
            } else {
              process.env[envName] = previous;
            }
          }

          expect(mockClient.responses.create).toHaveBeenCalledTimes(3);
          for (const call of mockClient.responses.create.mock.calls) {
            const serialized = JSON.stringify(call[0]);
            expect(Object.keys(call[0]).sort()).toEqual(
              withInclude ? stepBodyKeys : stepBodyKeysWithoutInclude,
            );
            expect(serialized).not.toContain('sk-test-key-123');
            expect(serialized).not.toContain(sentinel);
            expect(call[1]).toEqual({});
          }
        });

        it('omits include for gpt-4o but keeps store: false and the full replay', async () => {
          await runThreeSteps('gpt-4o');

          expect(mockClient.responses.create).toHaveBeenCalledTimes(3);
          for (const call of mockClient.responses.create.mock.calls) {
            expect(call[0].model).toBe('gpt-4o');
            expect(call[0].store).toBe(false);
            expect(call[0]).not.toHaveProperty('include');
            expect(call[0]).not.toHaveProperty('previous_response_id');
          }
          const thirdBody = mockClient.responses.create.mock.calls[2][0];
          expect(
            thirdBody.input.map(
              (item: { type?: string; role?: string }) => item.type ?? item.role,
            ),
          ).toEqual([
            'user',
            'reasoning',
            'message',
            'function_call',
            'function_call',
            'function_call_output',
            'function_call_output',
            'function_call',
            'function_call_output',
          ]);
        });
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
            providerState: {
              kind: 'responses',
              outputItems: [
                {
                  type: 'function_call',
                  call_id: 'secret_call_1',
                  name: 'read_file',
                  arguments: '{"path":"secret.md"}',
                },
              ],
            },
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
        expect(secondBody).not.toHaveProperty('previous_response_id');
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
        expect(recordedBody.store).toBe(false);
        expect(recordedBody.include).toEqual(['reasoning.encrypted_content']);
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
