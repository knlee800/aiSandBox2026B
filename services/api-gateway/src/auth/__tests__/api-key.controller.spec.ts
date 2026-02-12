import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ApiKeyController } from '../api-key.controller';
import { ApiKeyService } from '../api-key.service';

describe('ApiKeyController', () => {
  let controller: ApiKeyController;
  let service: ApiKeyService;

  const mockApiKeyService = {
    createApiKey: jest.fn(),
    listApiKeys: jest.fn(),
    revokeApiKey: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiKeyController],
      providers: [
        {
          provide: ApiKeyService,
          useValue: mockApiKeyService,
        },
      ],
    }).compile();

    controller = module.get<ApiKeyController>(ApiKeyController);
    service = module.get<ApiKeyService>(ApiKeyService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('listApiKeys', () => {
    it('should return list of API keys for authenticated user', async () => {
      const userId = 'user-123';
      const mockRequest = { user: { userId } };

      const mockKeys = [
        {
          id: 'key-1',
          keyPrefix: 'sk_abc123',
          scopes: ['ai:execute'],
          createdAt: new Date('2024-01-01'),
          revokedAt: null,
          isActive: true,
        },
        {
          id: 'key-2',
          keyPrefix: 'sk_def456',
          scopes: ['ai:execute', 'sessions:read'],
          createdAt: new Date('2024-01-02'),
          revokedAt: new Date('2024-01-03'),
          isActive: false,
        },
      ];

      mockApiKeyService.listApiKeys.mockResolvedValue(mockKeys);

      const result = await controller.listApiKeys(mockRequest);

      expect(result).toEqual(mockKeys);
      expect(mockApiKeyService.listApiKeys).toHaveBeenCalledWith(userId);
    });

    it('should return empty array when user has no keys', async () => {
      const userId = 'user-123';
      const mockRequest = { user: { userId } };

      mockApiKeyService.listApiKeys.mockResolvedValue([]);

      const result = await controller.listApiKeys(mockRequest);

      expect(result).toEqual([]);
    });
  });

  describe('createApiKey', () => {
    it('should create a new API key for authenticated user', async () => {
      const userId = 'user-123';
      const mockRequest = { user: { userId } };
      const createDto = { scopes: ['ai:execute'] };

      const mockResponse = {
        apiKey: 'sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
        id: 'key-id-123',
        keyPrefix: 'sk_a1b2c3d4e5f6',
        createdAt: new Date('2024-01-01'),
      };

      mockApiKeyService.createApiKey.mockResolvedValue(mockResponse);

      const result = await controller.createApiKey(mockRequest, createDto);

      expect(result).toEqual(mockResponse);
      expect(mockApiKeyService.createApiKey).toHaveBeenCalledWith(userId, createDto.scopes);
    });

    it('should create API key with multiple scopes', async () => {
      const userId = 'user-123';
      const mockRequest = { user: { userId } };
      const createDto = { scopes: ['ai:execute', 'sessions:read', 'sessions:write'] };

      const mockResponse = {
        apiKey: 'sk_test_key',
        id: 'key-id-123',
        keyPrefix: 'sk_test_key',
        createdAt: new Date(),
      };

      mockApiKeyService.createApiKey.mockResolvedValue(mockResponse);

      const result = await controller.createApiKey(mockRequest, createDto);

      expect(mockApiKeyService.createApiKey).toHaveBeenCalledWith(userId, createDto.scopes);
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke an API key owned by the user', async () => {
      const userId = 'user-123';
      const keyId = 'key-id-123';
      const mockRequest = { user: { userId } };

      mockApiKeyService.revokeApiKey.mockResolvedValue(undefined);

      const result = await controller.revokeApiKey(mockRequest, keyId);

      expect(result).toEqual({
        message: 'API key revoked successfully',
        keyId,
      });
      expect(mockApiKeyService.revokeApiKey).toHaveBeenCalledWith(keyId, userId);
    });

    it('should throw NotFoundException when key does not exist', async () => {
      const userId = 'user-123';
      const keyId = 'nonexistent-key';
      const mockRequest = { user: { userId } };

      mockApiKeyService.revokeApiKey.mockRejectedValue(new NotFoundException('API key not found'));

      await expect(controller.revokeApiKey(mockRequest, keyId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own the key', async () => {
      const userId = 'user-123';
      const keyId = 'key-id-456';
      const mockRequest = { user: { userId } };

      mockApiKeyService.revokeApiKey.mockRejectedValue(
        new ForbiddenException('You do not have permission to revoke this API key'),
      );

      await expect(controller.revokeApiKey(mockRequest, keyId)).rejects.toThrow(ForbiddenException);
    });
  });
});
