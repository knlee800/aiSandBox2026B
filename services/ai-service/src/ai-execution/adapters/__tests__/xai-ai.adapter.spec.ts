import {
  InternalServerErrorException,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { XAIAdapter } from '../xai-ai.adapter';
import { AIExecutionRequest } from '../../types';
import { AGENT_HARNESS_TOOL_DEFINITIONS_V1 } from '../../../agent-harness/tools/tool-registry';
import * as modelProfiles from '../../../agent-harness/model-profiles/model-profile.registry';
import { HARNESS_ENV_FILE_INSTRUCTION } from '../../../agent-harness/prompts/harness-instructions';
import type { AIAdapterCanonicalTranscriptTurn } from '../adapter-tool-use.contracts';
import { RESPONSES_CONTINUATION_INVALID_HISTORY_MESSAGE } from '../adapter-tool-use.mapper';

describe('XAIAdapter', () => {
  describe('constructor', () => {
    it('should instantiate with valid API key', () => {
      const adapter = new XAIAdapter('xai-test-key-123');
      expect(adapter).toBeInstanceOf(XAIAdapter);
      expect(adapter.model).toBe('grok-4.5');
    });

    it('should throw error when API key is undefined', () => {
      expect(() => new XAIAdapter(undefined as any)).toThrow(
        'xAI API key is required',
      );
    });

    it('should throw error when API key is empty string', () => {
      expect(() => new XAIAdapter('')).toThrow(
        'xAI API key is required',
      );
    });

    it('should throw error when API key is whitespace only', () => {
      expect(() => new XAIAdapter('   ')).toThrow(
        'xAI API key is required',
      );
    });

    it('should use default model when not specified', () => {
      const adapter = new XAIAdapter('xai-test-key-123');
      expect(adapter.model).toBe('grok-4.5');
    });

    it('supports tool use', () => {
      const adapter = new XAIAdapter('xai-test-key-123');
      expect(adapter.supportsToolUse).toBe(true);
      expect(typeof adapter.executeWithTools).toBe('function');
    });

    it('should use custom model when specified', () => {
      const adapter = new XAIAdapter('xai-test-key-123', {
        model: 'grok-2',
      });
      expect(adapter.model).toBe('grok-2');
    });

    it('should use custom maxTokens when specified', () => {
      const adapter = new XAIAdapter('xai-test-key-123', {
        maxTokens: 2048,
      });
      expect(adapter).toBeInstanceOf(XAIAdapter);
    });

    it('should use custom temperature when specified', () => {
      const adapter = new XAIAdapter('xai-test-key-123', {
        temperature: 0.5,
      });
      expect(adapter).toBeInstanceOf(XAIAdapter);
    });

    it('should use custom baseURL when specified', () => {
      const adapter = new XAIAdapter('xai-test-key-123', {
        baseURL: 'https://custom.x.ai/v1',
      });
      expect(adapter).toBeInstanceOf(XAIAdapter);
    });
  });

  describe('execute()', () => {
    let adapter: XAIAdapter;
    let mockClient: any;

    beforeEach(() => {
      adapter = new XAIAdapter('xai-test-key-123');
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
      it('should transform AIExecutionRequest to xAI format', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: 100 },
          model: 'grok-beta',
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

        const calledRequest = mockClient.chat.completions.create.mock.calls[0][0];
        expect(calledRequest.model).toBe('grok-4.5');
        expect(calledRequest.max_tokens).toBe(4096);
        expect(calledRequest.temperature).toBe(1.0);
        expect(calledRequest.response_format).toEqual({ type: 'json_object' });
        expect(calledRequest.messages).toEqual([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining(
              'Your entire response MUST be a single valid JSON object',
            ),
          }),
          {
            role: 'user',
            content: 'Test prompt',
          },
        ]);
        expect(mockClient.chat.completions.create.mock.calls[0][1]).toEqual({});
      });

      it('should prepend a system message when systemPrompt is present', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: 100 },
          model: 'grok-beta',
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

        const calledRequest = mockClient.chat.completions.create.mock.calls[0][0];
        expect(calledRequest.response_format).toEqual({ type: 'json_object' });
        expect(calledRequest.messages[0]).toEqual(
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('Follow platform contract.'),
          }),
        );
        expect(calledRequest.messages[0].content).toContain(
          'workspaceMutationAttempted',
        );
        expect(calledRequest.messages[1]).toEqual({
          role: 'user',
          content: 'Test prompt',
        });
      });

      it('should include content field when prompt is undefined (TASK-56A)', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Empty' } }],
          usage: { total_tokens: 10 },
          model: 'grok-beta',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        const request = {
          sessionId: 'session-1',
          conversationId: 'conv-1',
          userId: 'user-1',
          prompt: undefined as unknown as string,
          provider: 'stub' as const,
        };

        await adapter.execute(request);

        const call = mockClient.chat.completions.create.mock.calls[0][0];
        expect(call.messages[1]).toHaveProperty('content');
        expect(call.messages[1].content).toBe('');
      });

      it('should describe the approved JSON response shape in system instructions', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: 100 },
          model: 'grok-beta',
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

        const call = mockClient.chat.completions.create.mock.calls[0][0];
        expect(call.messages[0].content).toContain('"assistantText"');
        expect(call.messages[0].content).toContain('"fileActions"');
        expect(call.messages[0].content).toContain('"workspaceMutationAttempted"');
      });

      it('should not introduce tool/function-calling in request payload', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: 100 },
          model: 'grok-beta',
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

        const call = mockClient.chat.completions.create.mock.calls[0][0];
        expect(call.tools).toBeUndefined();
        expect(call.function_call).toBeUndefined();
        expect(call.functions).toBeUndefined();
        expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);
        expect(mockClient.responses.create).not.toHaveBeenCalled();
      });

      it('should extract text content from response.choices[0].message.content', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output from xAI' } }],
          usage: { total_tokens: 150 },
          model: 'grok-beta',
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

        expect(result.output).toBe('Test output from xAI');
      });

      it('should extract token usage from response.usage.total_tokens', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: {
            prompt_tokens: 50,
            completion_tokens: 75,
            total_tokens: 125,
          },
          model: 'grok-beta',
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
          model: 'grok-beta-v2',
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

        expect(result.model).toBe('grok-beta-v2');
      });

      it('should handle response with custom model identifier', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: 100 },
          model: 'grok-2',
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

        expect(result.model).toBe('grok-2');
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

        expect(result.model).toBe('grok-4.5');
      });

      it('uses the model profile plain output limit instead of a fixed 4096', async () => {
        const spy = jest
          .spyOn(modelProfiles, 'resolvePlainOutputTokenLimit')
          .mockReturnValue(8192);
        try {
          mockClient.chat.completions.create.mockResolvedValue({
            choices: [{ message: { content: 'Test output' } }],
            usage: { total_tokens: 100 },
            model: 'grok-4.5',
          });
          await adapter.execute({
            sessionId: 'session-1',
            conversationId: 'conv-1',
            userId: 'user-1',
            prompt: 'Test prompt',
            provider: 'xai',
            model: 'grok-4.5',
          });
          expect(mockClient.chat.completions.create.mock.calls[0][0].max_tokens).toBe(
            8192,
          );
        } finally {
          spy.mockRestore();
        }
      });
    });

    describe('structured JSON request contract', () => {
      const mockResponse = {
        choices: [{ message: { content: 'Test output' } }],
        usage: { total_tokens: 100 },
        model: 'grok-4.5',
      };

      const baseRequest: AIExecutionRequest = {
        sessionId: 'session-1',
        conversationId: 'conv-1',
        userId: 'user-1',
        prompt: 'Create index.html',
        provider: 'xai',
      };

      async function executeWithModel(
        model: string,
        extras: Partial<AIExecutionRequest> = {},
      ) {
        mockClient.chat.completions.create.mockResolvedValue({
          ...mockResponse,
          model,
        });
        await adapter.execute({
          ...baseRequest,
          model,
          ...extras,
        });
        return {
          body: mockClient.chat.completions.create.mock.calls[0][0],
          options: mockClient.chat.completions.create.mock.calls[0][1],
        };
      }

      it('sends response_format json_object for grok-4.5', async () => {
        const { body } = await executeWithModel('grok-4.5');

        expect(body.model).toBe('grok-4.5');
        expect(body.response_format).toEqual({ type: 'json_object' });
      });

      it('does not omit response_format for any requested model id', async () => {
        const { body } = await executeWithModel('grok-4.20');

        expect(body.model).toBe('grok-4.20');
        expect(body.response_format).toEqual({ type: 'json_object' });
      });

      it('still includes the structured JSON system contract', async () => {
        const { body } = await executeWithModel('grok-4.5', {
          systemPrompt: 'Follow platform contract.',
        });

        expect(body.messages[0].role).toBe('system');
        expect(body.messages[0].content).toContain('Follow platform contract.');
        expect(body.messages[0].content).toContain(
          'Your entire response MUST be a single valid JSON object',
        );
        expect(body.messages[0].content).toContain('"assistantText"');
        expect(body.messages[0].content).toContain('"fileActions"');
        expect(body.messages[0].content).toContain(
          '"workspaceMutationAttempted"',
        );
        expect(body.messages[1]).toEqual({
          role: 'user',
          content: 'Create index.html',
        });
      });

      it('does not retry or fall back when constructing a request', async () => {
        const { body } = await executeWithModel('grok-4.5');

        expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);
        expect(body.model).toBe('grok-4.5');
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
          'Invalid xAI API key',
        );
      });

      it('should throw BadRequestException for 400 (validation error)', async () => {
        const error = { status: 400, message: 'Invalid request' };
        mockClient.chat.completions.create.mockRejectedValue(error);

        await expect(adapter.execute(request)).rejects.toThrow(
          BadRequestException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Invalid request to xAI API',
        );
      });

      it('should throw ServiceUnavailableException for 429 (rate limit)', async () => {
        const error = { status: 429, message: 'Rate limit exceeded' };
        mockClient.chat.completions.create.mockRejectedValue(error);

        await expect(adapter.execute(request)).rejects.toThrow(
          ServiceUnavailableException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'xAI API rate limit exceeded',
        );
      });

      it('should throw InternalServerErrorException for 500 (server error)', async () => {
        const error = { status: 500, message: 'Internal server error' };
        mockClient.chat.completions.create.mockRejectedValue(error);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'xAI API server error',
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
          'xAI API timeout',
        );
      });

      it('should throw ServiceUnavailableException for network error (ECONNREFUSED)', async () => {
        const error = new Error('connect ECONNREFUSED 127.0.0.1:443');
        mockClient.chat.completions.create.mockRejectedValue(error);

        await expect(adapter.execute(request)).rejects.toThrow(
          ServiceUnavailableException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'xAI API connection error',
        );
      });

      it('should throw InternalServerErrorException for malformed response (missing choices)', async () => {
        const mockResponse = {
          usage: { total_tokens: 100 },
          model: 'grok-beta',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed xAI response: missing choices',
        );
      });

      it('should throw InternalServerErrorException for malformed response (empty choices array)', async () => {
        const mockResponse = {
          choices: [],
          usage: { total_tokens: 100 },
          model: 'grok-beta',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed xAI response: missing choices',
        );
      });

      it('should throw InternalServerErrorException for malformed response (missing content)', async () => {
        const mockResponse = {
          choices: [{ message: { content: null } }],
          usage: { total_tokens: 100 },
          model: 'grok-beta',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed xAI response: missing content',
        );
      });

      it('should throw InternalServerErrorException for malformed response (empty content)', async () => {
        const mockResponse = {
          choices: [{ message: { content: '' } }],
          usage: { total_tokens: 100 },
          model: 'grok-beta',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed xAI response: missing content',
        );
      });

      it('should throw InternalServerErrorException for malformed response (missing usage)', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          model: 'grok-beta',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed xAI response: missing usage',
        );
      });

      it('should throw InternalServerErrorException for malformed response (invalid token count - null)', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: null },
          model: 'grok-beta',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed xAI response: missing usage',
        );
      });

      it('should throw InternalServerErrorException for malformed response (negative token count)', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: -10 },
          model: 'grok-beta',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed xAI response: invalid token count',
        );
      });

      it('should throw InternalServerErrorException for malformed response (string token count)', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { total_tokens: '100' as any },
          model: 'grok-beta',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed xAI response: missing usage',
        );
      });

      it('should throw InternalServerErrorException for malformed response (missing total_tokens field)', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Test output' } }],
          usage: { prompt_tokens: 50, completion_tokens: 50 },
          model: 'grok-beta',
        };
        mockClient.chat.completions.create.mockResolvedValue(mockResponse);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Malformed xAI response: missing usage',
        );
      });

      it('should throw InternalServerErrorException for unknown error', async () => {
        const error = new Error('Unknown error');
        mockClient.chat.completions.create.mockRejectedValue(error);

        await expect(adapter.execute(request)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(adapter.execute(request)).rejects.toThrow(
          'Unexpected error during xAI API call',
        );
      });
    });

    describe('executeWithTools()', () => {
      const responsesText = (text: string, totalTokens = 10) => ({
        id: 'resp_text',
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text }],
          },
        ],
        usage: { total_tokens: totalTokens },
        model: 'grok-4.5',
      });

      it('calls responses.create on the xAI client without response_format or temperature', async () => {
        const toolDefinition = AGENT_HARNESS_TOOL_DEFINITIONS_V1[1];
        mockClient.responses.create.mockResolvedValue(responsesText('ok'));

        await adapter.executeWithTools(
          {
            sessionId: 'session-1',
            conversationId: 'conv-1',
            userId: 'user-1',
            prompt: 'Read README.md',
            systemPrompt: '  Follow platform contract.  ',
            provider: 'xai',
            model: 'grok-4.5',
          },
          { tools: [toolDefinition] },
        );

        expect(mockClient.chat.completions.create).not.toHaveBeenCalled();
        expect(mockClient.responses.create).toHaveBeenCalledWith(
          {
            model: 'grok-4.5',
            max_output_tokens: 16000,
            store: false,
            include: ['reasoning.encrypted_content'],
            instructions: `Follow platform contract.\n${HARNESS_ENV_FILE_INSTRUCTION}`,
            input: [{ role: 'user', content: 'Read README.md' }],
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
        expect(recordedBody).not.toHaveProperty('response_format');
        expect(recordedBody).not.toHaveProperty('temperature');
        expect(recordedBody.instructions).not.toContain('assistantText');
        expect(recordedBody.instructions).not.toContain('fileActions');
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
        const request: AIExecutionRequest = {
          sessionId: 'session-1',
          conversationId: 'conv-1',
          userId: 'user-1',
          prompt: 'List then read two files',
          systemPrompt: 'Follow platform contract.',
          provider: 'xai',
          model: 'grok-4.5',
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

        const runThreeSteps = async () => {
          mockClient.responses.create
            .mockResolvedValueOnce({
              id: 'resp_1',
              status: 'completed',
              model: 'grok-4.5',
              output: [reasoningItem, messageItem, callA, callB],
              usage: { total_tokens: 20 },
            })
            .mockResolvedValueOnce({
              id: 'resp_2',
              status: 'completed',
              model: 'grok-4.5',
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

        it('adds no field that carries keys or environment content', async () => {
          const sentinel = 'env-sentinel-value-access-01j';
          const envName = 'XAI_API_KEY';
          const previous = process.env[envName];
          process.env[envName] = sentinel;
          try {
            await runThreeSteps();
          } finally {
            if (previous === undefined) {
              delete process.env[envName];
            } else {
              process.env[envName] = previous;
            }
          }

          for (const call of mockClient.responses.create.mock.calls) {
            const serialized = JSON.stringify(call[0]);
            expect(Object.keys(call[0]).sort()).toEqual(stepBodyKeys);
            expect(serialized).not.toContain('xai-test-key-123');
            expect(serialized).not.toContain(sentinel);
            expect(call[1]).toEqual({});
          }
        });
      });

      it('forwards the abort signal and keeps xAI error handling', async () => {
        const signal = new AbortController().signal;
        mockClient.responses.create.mockResolvedValueOnce(responsesText('ok'));

        await adapter.executeWithTools({
          sessionId: 'session-1',
          conversationId: 'conv-1',
          userId: 'user-1',
          prompt: 'Read README.md',
          provider: 'xai',
          signal,
        });

        expect(mockClient.responses.create.mock.calls[0][1]).toEqual({ signal });

        mockClient.responses.create.mockRejectedValue({
          status: 401,
          message: 'Invalid API key',
        });
        await expect(
          adapter.executeWithTools({
            sessionId: 'session-1',
            conversationId: 'conv-1',
            userId: 'user-1',
            prompt: 'Read README.md',
            provider: 'xai',
          }),
        ).rejects.toThrow('Invalid xAI API key');
      });

      it('names xAI when a tool response is malformed', async () => {
        const request = {
          sessionId: 'session-1',
          conversationId: 'conv-1',
          userId: 'user-1',
          prompt: 'Read README.md',
          provider: 'xai' as const,
        };
        const text = {
          type: 'message',
          content: [{ type: 'output_text', text: 'ok' }],
        };

        mockClient.responses.create.mockResolvedValueOnce({
          id: 'resp_bad',
          status: 'completed',
          output: [],
          usage: { total_tokens: 4 },
        });
        await expect(adapter.executeWithTools(request)).rejects.toThrow(
          'Malformed xAI response: missing content',
        );

        mockClient.responses.create.mockResolvedValueOnce({
          id: 'resp_bad',
          status: 'completed',
          output: [text],
        });
        await expect(adapter.executeWithTools(request)).rejects.toThrow(
          'Malformed xAI response: missing usage',
        );

        mockClient.responses.create.mockResolvedValueOnce({
          id: 'resp_bad',
          status: 'completed',
          output: [text],
          usage: { total_tokens: -1 },
        });
        await expect(adapter.executeWithTools(request)).rejects.toThrow(
          'Malformed xAI response: invalid token count',
        );
      });
    });
  });
});
