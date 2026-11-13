import { Test, TestingModule } from '@nestjs/testing';
import {
  AIServiceHttpClient,
  AIExecutionRequest,
  AIExecutionResult,
  PROVIDER_AVAILABILITY_TIMEOUT_MS,
} from './ai-service-http.client';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AIServiceHttpClient (Phase 18A)', () => {
  let client: AIServiceHttpClient;
  let mockAxiosInstance: any;
  const originalInternalServiceKey = process.env.INTERNAL_SERVICE_KEY;

  afterAll(() => {
    if (originalInternalServiceKey === undefined) {
      delete process.env.INTERNAL_SERVICE_KEY;
    } else {
      process.env.INTERNAL_SERVICE_KEY = originalInternalServiceKey;
    }
  });

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    // AI-SERVICE-AUTH-01: the exact-config assertion below runs without a key.
    delete process.env.INTERNAL_SERVICE_KEY;

    // Create mock axios instance
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    const module: TestingModule = await Test.createTestingModule({
      providers: [AIServiceHttpClient],
    }).compile();

    client = module.get<AIServiceHttpClient>(AIServiceHttpClient);
    await module.init(); // Trigger onModuleInit
  });

  it('should be defined', () => {
    expect(client).toBeDefined();
  });

  it('should create axios instance with correct configuration', () => {
    expect(mockedAxios.create).toHaveBeenCalledWith({
      baseURL: 'http://localhost:4001',
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  describe('internal service key (AI-SERVICE-AUTH-01 D6)', () => {
    afterEach(() => {
      delete process.env.INTERNAL_SERVICE_KEY;
    });

    it('sends X-Internal-Service-Key when INTERNAL_SERVICE_KEY is set', () => {
      process.env.INTERNAL_SERVICE_KEY = 'ai-service-auth-01-client-key';
      mockedAxios.create.mockClear();

      new AIServiceHttpClient();

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:4001',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Service-Key': 'ai-service-auth-01-client-key',
        },
      });
    });

    it('leaves the header out when INTERNAL_SERVICE_KEY is unset or blank', () => {
      for (const value of [undefined, '']) {
        if (value === undefined) {
          delete process.env.INTERNAL_SERVICE_KEY;
        } else {
          process.env.INTERNAL_SERVICE_KEY = value;
        }
        mockedAxios.create.mockClear();

        new AIServiceHttpClient();

        const config = mockedAxios.create.mock.calls[0][0] as { headers: Record<string, string> };
        expect(config.headers).toEqual({ 'Content-Type': 'application/json' });
        expect(Object.keys(config.headers).map((k) => k.toLowerCase())).not.toContain(
          'x-internal-service-key',
        );
      }
    });

    it('posts to /api/execute with the keyed axios instance', async () => {
      process.env.INTERNAL_SERVICE_KEY = 'ai-service-auth-01-client-key';
      const keyed = { post: jest.fn().mockResolvedValue({ data: { output: 'ok' } }) };
      mockedAxios.create.mockReturnValue(keyed as any);

      const keyedClient = new AIServiceHttpClient();
      await keyedClient.execute({
        sessionId: 's',
        conversationId: 'c',
        userId: 'u',
        prompt: 'p',
      });

      expect(keyed.post).toHaveBeenCalledWith('/api/execute', expect.any(Object));
      const config = mockedAxios.create.mock.calls.at(-1)[0] as { headers: Record<string, string> };
      expect(config.headers['X-Internal-Service-Key']).toBe('ai-service-auth-01-client-key');
    });
  });

  it('should use AI_SERVICE_URL environment variable if provided', () => {
    // Set environment variable
    process.env.AI_SERVICE_URL = 'http://ai-service:5000';

    // Create new instance
    const newClient = new AIServiceHttpClient();

    expect(mockedAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'http://ai-service:5000',
      }),
    );

    // Cleanup
    delete process.env.AI_SERVICE_URL;
  });

  describe('execute', () => {
    it('should forward request to POST /api/execute and return result', async () => {
      // Arrange
      const request: AIExecutionRequest = {
        sessionId: 'session-123',
        conversationId: 'conv-456',
        userId: 'user-789',
        prompt: 'Test prompt',
        provider: 'stub',
      };

      const expectedResult: AIExecutionResult = {
        output: 'AI response',
        tokensUsed: 50,
        model: 'claude-3-5-sonnet-20241022',
      };

      mockAxiosInstance.post.mockResolvedValue({ data: expectedResult });

      // Act
      const result = await client.execute(request);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/execute', request);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should forward optional workspaceContext unchanged', async () => {
      const request: AIExecutionRequest = {
        sessionId: 'session-ctx',
        conversationId: 'conv-ctx',
        userId: 'user-ctx',
        prompt: 'List files',
        provider: 'stub',
        workspaceContext: {
          filePaths: ['README.md', 'src/app.ts'],
          selectedFilePath: 'src/app.ts',
          selectedFileContent: 'export const app = true;',
          namedFileContents: [
            {
              path: 'src/utils.ts',
              content: 'export const util = true;',
            },
          ],
          searchResults: {
            query: 'login',
            results: [{ path: 'src/app.ts', line: 12, preview: 'const login = true;' }],
            truncated: false,
          },
          projectName: 'Sandbox Project',
          workspaceName: 'Personal',
        },
      };

      const expectedResult: AIExecutionResult = {
        output: 'AI response',
        tokensUsed: 5,
        model: 'stub',
      };

      mockAxiosInstance.post.mockResolvedValue({ data: expectedResult });

      const result = await client.execute(request);

      expect(result).toEqual(expectedResult);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/execute', request);
    });

    it('should propagate HTTP errors from ai-service', async () => {
      // Arrange
      const request: AIExecutionRequest = {
        sessionId: 'session-123',
        conversationId: 'conv-456',
        userId: 'user-789',
        prompt: 'Test prompt',
        provider: 'stub',
      };

      const axiosError: any = new Error('Request failed');
      axiosError.isAxiosError = true;
      axiosError.response = {
        status: 503,
        data: {
          message: 'AI provider unavailable',
          statusCode: 503,
        },
      };

      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);
      mockAxiosInstance.post.mockRejectedValue(axiosError);

      // Act & Assert
      await expect(client.execute(request)).rejects.toThrow('AI provider unavailable');
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should propagate network errors unchanged', async () => {
      // Arrange
      const request: AIExecutionRequest = {
        sessionId: 'session-123',
        conversationId: 'conv-456',
        userId: 'user-789',
        prompt: 'Test prompt',
        provider: 'stub',
      };

      const networkError = new Error('Network timeout');
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(false);
      mockAxiosInstance.post.mockRejectedValue(networkError);

      // Act & Assert
      await expect(client.execute(request)).rejects.toThrow('Network timeout');
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should not retry on failure', async () => {
      // Arrange
      const request: AIExecutionRequest = {
        sessionId: 'session-123',
        conversationId: 'conv-456',
        userId: 'user-789',
        prompt: 'Test prompt',
        provider: 'stub',
      };

      const error = new Error('Service unavailable');
      mockAxiosInstance.post.mockRejectedValue(error);

      // Act & Assert
      await expect(client.execute(request)).rejects.toThrow('Service unavailable');

      // Verify no retry - only one call
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('getProviderAvailability (PROVIDER-KEY-01 C3)', () => {
    it('GETs the internal route with a 3-second timeout and returns the body', async () => {
      const body = {
        providers: { xai: true, groq: false, deepseek: false, openai: false, anthropic: true },
      };
      mockAxiosInstance.get.mockResolvedValue({ data: body });

      await expect(client.getProviderAvailability()).resolves.toEqual(body);

      expect(PROVIDER_AVAILABILITY_TIMEOUT_MS).toBe(3000);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/internal/provider-availability', {
        timeout: 3000,
      });
      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
    });

    it('uses the keyed axios instance', async () => {
      process.env.INTERNAL_SERVICE_KEY = 'provider-key-01-client-key';
      const keyed = { post: jest.fn(), get: jest.fn().mockResolvedValue({ data: {} }) };
      mockedAxios.create.mockReturnValue(keyed as any);

      await new AIServiceHttpClient().getProviderAvailability();

      expect(keyed.get).toHaveBeenCalledWith('/api/internal/provider-availability', {
        timeout: 3000,
      });
      const config = mockedAxios.create.mock.calls.at(-1)[0] as { headers: Record<string, string> };
      expect(config.headers['X-Internal-Service-Key']).toBe('provider-key-01-client-key');
      delete process.env.INTERNAL_SERVICE_KEY;
    });

    it('propagates a failure without retrying', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('timeout of 3000ms exceeded'));

      await expect(client.getProviderAvailability()).rejects.toThrow('timeout of 3000ms exceeded');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });
  });
});
