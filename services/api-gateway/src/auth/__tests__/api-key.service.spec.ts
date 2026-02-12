import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ApiKeyService } from '../api-key.service';
import { ApiKey } from '../../entities/api-key.entity';
import * as bcrypt from 'bcrypt';

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let repository: Repository<ApiKey>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyService,
        {
          provide: getRepositoryToken(ApiKey),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ApiKeyService>(ApiKeyService);
    repository = module.get<Repository<ApiKey>>(getRepositoryToken(ApiKey));

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('createApiKey', () => {
    it('should generate and save a new API key', async () => {
      const userId = 'user-123';
      const scopes = ['ai:execute'];

      // Mock implementation that captures the created entity
      let capturedEntity: any;
      mockRepository.create.mockImplementation((entity) => {
        capturedEntity = entity;
        return {
          ...entity,
          id: 'key-id-123',
          createdAt: new Date(),
        };
      });
      mockRepository.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.createApiKey(userId, scopes);

      // Verify plaintext key format (sk_ + 64 hex chars)
      expect(result.apiKey).toMatch(/^sk_[a-f0-9]{64}$/);
      expect(result.id).toBe('key-id-123');
      // Key prefix is first 16 chars of the full key (sk_ + 13 hex chars)
      expect(result.keyPrefix).toMatch(/^sk_[a-f0-9]{13}$/);
      expect(result.keyPrefix).toBe(result.apiKey.substring(0, 16));
      expect(result.createdAt).toBeDefined();

      // Verify repository calls
      expect(mockRepository.create).toHaveBeenCalledWith({
        hashedKey: expect.any(String),
        keyPrefix: expect.any(String),
        userId,
        scopes,
        revokedAt: null,
      });
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should hash the API key before storage', async () => {
      const userId = 'user-123';
      const scopes = ['ai:execute'];

      const mockApiKey = {
        id: 'key-id-123',
        hashedKey: 'hashed-value',
        keyPrefix: 'sk_a1b2c3d4e5f6',
        userId,
        scopes,
        createdAt: new Date(),
        revokedAt: null,
      };

      mockRepository.create.mockReturnValue(mockApiKey);
      mockRepository.save.mockResolvedValue(mockApiKey);

      const result = await service.createApiKey(userId, scopes);

      // Get the hashedKey argument passed to create
      const createCall = mockRepository.create.mock.calls[0][0];
      const hashedKey = createCall.hashedKey;

      // Verify the hash is different from plaintext
      expect(hashedKey).not.toBe(result.apiKey);

      // Verify the hash can be verified with bcrypt
      const isMatch = await bcrypt.compare(result.apiKey, hashedKey);
      expect(isMatch).toBe(true);
    });

    it('should generate unique keys on multiple calls', async () => {
      const userId = 'user-123';
      const scopes = ['ai:execute'];

      mockRepository.create.mockImplementation((data) => data);
      mockRepository.save.mockImplementation((data) => ({
        ...data,
        id: 'key-id',
        createdAt: new Date(),
      }));

      const result1 = await service.createApiKey(userId, scopes);
      const result2 = await service.createApiKey(userId, scopes);

      // Keys should be different
      expect(result1.apiKey).not.toBe(result2.apiKey);
    });
  });

  describe('listApiKeys', () => {
    it('should return masked list of user API keys', async () => {
      const userId = 'user-123';

      const mockKeys = [
        {
          id: 'key-1',
          hashedKey: 'hash-1',
          keyPrefix: 'sk_abc123',
          userId,
          scopes: ['ai:execute'],
          createdAt: new Date('2024-01-01'),
          revokedAt: null,
          isActive: () => true,
        },
        {
          id: 'key-2',
          hashedKey: 'hash-2',
          keyPrefix: 'sk_def456',
          userId,
          scopes: ['ai:execute', 'sessions:read'],
          createdAt: new Date('2024-01-02'),
          revokedAt: new Date('2024-01-03'),
          isActive: () => false,
        },
      ];

      mockRepository.find.mockResolvedValue(mockKeys);

      const result = await service.listApiKeys(userId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'key-1',
        keyPrefix: 'sk_abc123',
        scopes: ['ai:execute'],
        createdAt: mockKeys[0].createdAt,
        revokedAt: null,
        isActive: true,
      });
      expect(result[1]).toEqual({
        id: 'key-2',
        keyPrefix: 'sk_def456',
        scopes: ['ai:execute', 'sessions:read'],
        createdAt: mockKeys[1].createdAt,
        revokedAt: mockKeys[1].revokedAt,
        isActive: false,
      });

      // Verify repository call
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
    });

    it('should return empty array when user has no keys', async () => {
      const userId = 'user-123';

      mockRepository.find.mockResolvedValue([]);

      const result = await service.listApiKeys(userId);

      expect(result).toEqual([]);
    });

    it('should never expose hashed keys', async () => {
      const userId = 'user-123';

      const mockKeys = [
        {
          id: 'key-1',
          hashedKey: 'super-secret-hash',
          keyPrefix: 'sk_abc123',
          userId,
          scopes: ['ai:execute'],
          createdAt: new Date(),
          revokedAt: null,
          isActive: () => true,
        },
      ];

      mockRepository.find.mockResolvedValue(mockKeys);

      const result = await service.listApiKeys(userId);

      // Verify hashedKey is not in result
      expect(JSON.stringify(result)).not.toContain('super-secret-hash');
      expect(result[0]).not.toHaveProperty('hashedKey');
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke an API key owned by the user', async () => {
      const keyId = 'key-123';
      const userId = 'user-123';

      const mockApiKey = {
        id: keyId,
        userId,
        revokedAt: null,
      };

      mockRepository.findOne.mockResolvedValue(mockApiKey);
      mockRepository.save.mockResolvedValue({ ...mockApiKey, revokedAt: new Date() });

      await service.revokeApiKey(keyId, userId);

      // Verify revocation timestamp was set
      expect(mockRepository.save).toHaveBeenCalledWith({
        id: keyId,
        userId,
        revokedAt: expect.any(Date),
      });
    });

    it('should throw NotFoundException when key does not exist', async () => {
      const keyId = 'nonexistent-key';
      const userId = 'user-123';

      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.revokeApiKey(keyId, userId)).rejects.toThrow(NotFoundException);
      await expect(service.revokeApiKey(keyId, userId)).rejects.toThrow('API key not found');
    });

    it('should throw ForbiddenException when user does not own the key', async () => {
      const keyId = 'key-123';
      const userId = 'user-123';
      const otherUserId = 'user-456';

      const mockApiKey = {
        id: keyId,
        userId: otherUserId, // Different user
        revokedAt: null,
      };

      mockRepository.findOne.mockResolvedValue(mockApiKey);

      await expect(service.revokeApiKey(keyId, userId)).rejects.toThrow(ForbiddenException);
      await expect(service.revokeApiKey(keyId, userId)).rejects.toThrow(
        'You do not have permission to revoke this API key',
      );
    });

    it('should allow revoking an already revoked key', async () => {
      const keyId = 'key-123';
      const userId = 'user-123';

      const mockApiKey = {
        id: keyId,
        userId,
        revokedAt: new Date('2024-01-01'), // Already revoked
      };

      mockRepository.findOne.mockResolvedValue(mockApiKey);
      mockRepository.save.mockResolvedValue({ ...mockApiKey, revokedAt: new Date() });

      // Should not throw
      await service.revokeApiKey(keyId, userId);

      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('validateApiKey', () => {
    it('should return identity for valid API key', async () => {
      const plaintextKey = 'sk_valid_key_12345';
      const hashedKey = await bcrypt.hash(plaintextKey, 10);

      const mockApiKey = {
        id: 'key-123',
        hashedKey,
        userId: 'user-123',
        scopes: ['ai:execute'],
        revokedAt: null,
      };

      mockRepository.find.mockResolvedValue([mockApiKey]);

      const result = await service.validateApiKey(plaintextKey);

      expect(result).toEqual({
        userId: 'user-123',
        apiKeyId: 'key-123',
        scopes: ['ai:execute'],
      });
    });

    it('should return null for invalid API key', async () => {
      const plaintextKey = 'sk_invalid_key';
      const hashedKey = await bcrypt.hash('sk_different_key', 10);

      const mockApiKey = {
        id: 'key-123',
        hashedKey,
        userId: 'user-123',
        scopes: ['ai:execute'],
        revokedAt: null,
      };

      mockRepository.find.mockResolvedValue([mockApiKey]);

      const result = await service.validateApiKey(plaintextKey);

      expect(result).toBeNull();
    });

    it('should return null for revoked API key', async () => {
      const plaintextKey = 'sk_revoked_key';
      const hashedKey = await bcrypt.hash(plaintextKey, 10);

      const mockApiKey = {
        id: 'key-123',
        hashedKey,
        userId: 'user-123',
        scopes: ['ai:execute'],
        revokedAt: new Date(), // Revoked
      };

      // find() filters out revoked keys
      mockRepository.find.mockResolvedValue([]);

      const result = await service.validateApiKey(plaintextKey);

      expect(result).toBeNull();
    });

    it('should handle multiple keys and find the correct one', async () => {
      const plaintextKey = 'sk_correct_key';
      const correctHashedKey = await bcrypt.hash(plaintextKey, 10);
      const wrongHashedKey = await bcrypt.hash('sk_wrong_key', 10);

      const mockKeys = [
        {
          id: 'key-1',
          hashedKey: wrongHashedKey,
          userId: 'user-1',
          scopes: ['ai:execute'],
          revokedAt: null,
        },
        {
          id: 'key-2',
          hashedKey: correctHashedKey,
          userId: 'user-2',
          scopes: ['ai:execute', 'sessions:read'],
          revokedAt: null,
        },
      ];

      mockRepository.find.mockResolvedValue(mockKeys);

      const result = await service.validateApiKey(plaintextKey);

      expect(result).toEqual({
        userId: 'user-2',
        apiKeyId: 'key-2',
        scopes: ['ai:execute', 'sessions:read'],
      });
    });

    it('should return null when no keys exist', async () => {
      const plaintextKey = 'sk_any_key';

      mockRepository.find.mockResolvedValue([]);

      const result = await service.validateApiKey(plaintextKey);

      expect(result).toBeNull();
    });
  });
});
