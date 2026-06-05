import { Test, TestingModule } from '@nestjs/testing';
import { AIExecutionController } from './ai-execution.controller';
import { AIServiceHttpClient, AIExecutionRequest, AIExecutionResult } from '../clients/ai-service-http.client';
import { ApiKeyIdentity } from '../auth/api-key.config';
import { ApiKeyAuthGuard } from '../auth/api-key-auth.guard';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import { AuthorizationGuard } from '../auth/authorization.guard';
import { QuotaGuard } from '../quota/quota.guard';
import { TokenQuotaGuard } from '../quota/token-quota.guard';
import { UsageLedgerService } from '../usage-ledger/usage-ledger.service';
import { GlobalSafetyLimitService } from '../safety/global-safety-limit.service';

describe('AIExecutionController (Phase 18A + Phase 20A + Phase 20B + Phase 21B + Phase 22B)', () => {
  let controller: AIExecutionController;
  let httpClient: jest.Mocked<AIServiceHttpClient>;
  let usageLedgerService: jest.Mocked<UsageLedgerService>;

  beforeEach(async () => {
    // Create mock HTTP client
    const mockHttpClient = {
      execute: jest.fn(),
    };

    // Create mock usage ledger service
    const mockUsageLedgerService = {
      findByRequestId: jest.fn().mockResolvedValue(null),
      reuseExecutionIntent: jest.fn().mockResolvedValue('execution-id'),
      writeExecutionIntent: jest.fn().mockResolvedValue(undefined),
      updateExecutionResult: jest.fn().mockResolvedValue(undefined),
    };

    // Create mock global safety limit service
    const mockGlobalSafetyLimitService = {
      checkAndRecord: jest.fn().mockResolvedValue(undefined),
      recordExecutionCost: jest.fn().mockResolvedValue(undefined),
    };

    // Mock guards (not testing guard logic here)
    const mockGuard = {
      canActivate: jest.fn(() => true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AIExecutionController],
      providers: [
        {
          provide: AIServiceHttpClient,
          useValue: mockHttpClient,
        },
        {
          provide: UsageLedgerService,
          useValue: mockUsageLedgerService,
        },
        {
          provide: GlobalSafetyLimitService,
          useValue: mockGlobalSafetyLimitService,
        },
      ],
    })
      .overrideGuard(SessionOrApiKeyAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(AuthorizationGuard)
      .useValue(mockGuard)
      .overrideGuard(QuotaGuard)
      .useValue(mockGuard)
      .overrideGuard(TokenQuotaGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<AIExecutionController>(AIExecutionController);
    httpClient = module.get(AIServiceHttpClient);
    usageLedgerService = module.get(UsageLedgerService);
  });

  describe('POST /api/ai/execute', () => {
    it('should forward request to ai-service with verified userId and return result on success', async () => {
      // Arrange
      const request: AIExecutionRequest = {
        sessionId: 'session-123',
        conversationId: 'conv-456',
        userId: 'untrusted-user', // Will be replaced
        prompt: 'Hello AI',
        provider: 'stub',
        metadata: { source: 'test' },
      };

      const identity: ApiKeyIdentity = {
        userId: 'verified-user',
        apiKeyId: 'key-123',
        scopes: ['ai:execute'], // Phase 20B
      };

      const expectedResult: AIExecutionResult = {
        output: 'Hello human',
        tokensUsed: 42,
        model: 'claude-3-5-sonnet-20241022',
      };

      httpClient.execute.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.execute(request, identity);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(httpClient.execute).toHaveBeenCalledTimes(1);

      // Verify userId was replaced
      const calledRequest = httpClient.execute.mock.calls[0][0];
      expect(calledRequest.userId).toBe('verified-user'); // NOT 'untrusted-user'
      expect(calledRequest.metadata?.apiKeyId).toBe('key-123');
      expect(calledRequest.metadata?.source).toBe('test');
    });

    it('should propagate exceptions from ai-service unchanged', async () => {
      // Arrange
      const request: AIExecutionRequest = {
        sessionId: 'session-123',
        conversationId: 'conv-456',
        userId: 'untrusted-user',
        prompt: 'Hello AI',
        provider: 'stub',
      };

      const identity: ApiKeyIdentity = {
        userId: 'verified-user',
        apiKeyId: 'key-123',
        scopes: ['ai:execute'], // Phase 20B
      };

      const aiServiceError = new Error('AI provider unavailable');
      (aiServiceError as any).status = 503;

      httpClient.execute.mockRejectedValue(aiServiceError);

      // Act & Assert
      await expect(controller.execute(request, identity)).rejects.toThrow('AI provider unavailable');
      expect(httpClient.execute).toHaveBeenCalledTimes(1);
    });

    it('should not retry on failure', async () => {
      // Arrange
      const request: AIExecutionRequest = {
        sessionId: 'session-123',
        conversationId: 'conv-456',
        userId: 'untrusted-user',
        prompt: 'Hello AI',
        provider: 'stub',
      };

      const identity: ApiKeyIdentity = {
        userId: 'verified-user',
        apiKeyId: 'key-123',
        scopes: ['ai:execute'], // Phase 20B
      };

      const error = new Error('Network timeout');
      httpClient.execute.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.execute(request, identity)).rejects.toThrow('Network timeout');

      // Verify no retry logic - only called once
      expect(httpClient.execute).toHaveBeenCalledTimes(1);
    });

    it('should replace userId and inject apiKeyId into metadata', async () => {
      // Arrange
      const request: AIExecutionRequest = {
        sessionId: 'session-999',
        conversationId: 'conv-888',
        userId: 'untrusted-user-777',
        prompt: 'Complex prompt with special chars: !@#$%',
        provider: 'stub',
        metadata: {
          nested: { data: 'value' },
          array: [1, 2, 3],
        },
      };

      const identity: ApiKeyIdentity = {
        userId: 'verified-user-999',
        apiKeyId: 'key-999',
        scopes: ['ai:execute'], // Phase 20B
      };

      const result: AIExecutionResult = {
        output: 'Response',
        tokensUsed: 100,
        model: 'gpt-4',
      };

      httpClient.execute.mockResolvedValue(result);

      // Act
      await controller.execute(request, identity);

      // Assert - userId replaced, metadata preserved and extended
      const calledRequest = httpClient.execute.mock.calls[0][0];
      expect(calledRequest.userId).toBe('verified-user-999'); // REPLACED
      expect(calledRequest.prompt).toBe('Complex prompt with special chars: !@#$%');
      expect(calledRequest.metadata?.nested).toEqual({ data: 'value' });
      expect(calledRequest.metadata?.array).toEqual([1, 2, 3]);
      expect(calledRequest.metadata?.apiKeyId).toBe('key-999'); // INJECTED
    });
  });
});
