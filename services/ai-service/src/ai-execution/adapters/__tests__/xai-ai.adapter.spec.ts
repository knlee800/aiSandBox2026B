import {
  InternalServerErrorException,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { XAIAdapter } from '../xai-ai.adapter';
import { AIExecutionRequest } from '../../types';

describe('XAIAdapter', () => {
  describe('constructor', () => {
    it('should instantiate with valid API key', () => {
      const adapter = new XAIAdapter('xai-test-key-123');
      expect(adapter).toBeInstanceOf(XAIAdapter);
      expect(adapter.model).toBe('grok-3');
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
      expect(adapter.model).toBe('grok-3');
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

        expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
          {
            model: 'grok-3',
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

        expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
          {
            model: 'grok-3',
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
        expect(call.messages[0]).toHaveProperty('content');
        expect(call.messages[0].content).toBe('');
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

        expect(result.model).toBe('grok-3');
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
  });
});
