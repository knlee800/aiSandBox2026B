import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsageLedgerService, CreateUsageRecordDto } from '../usage-ledger.service';
import { UsageRecord } from '../../entities/usage-record.entity';

describe('UsageLedgerService', () => {
  let service: UsageLedgerService;
  let repository: jest.Mocked<Repository<UsageRecord>>;

  beforeEach(async () => {
    // Create mock repository
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageLedgerService,
        {
          provide: getRepositoryToken(UsageRecord),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsageLedgerService>(UsageLedgerService);
    repository = module.get(getRepositoryToken(UsageRecord));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('writeRecord', () => {
    const validDto: CreateUsageRecordDto = {
      apiKeyId: 'key-test',
      userId: 'user-123',
      sessionId: 'session-456',
      conversationId: 'conv-789',
      provider: 'anthropic',
      adapter: 'claude-stub',
      model: 'claude-3-5-sonnet-20241022',
      tokensUsed: 100,
      executionDurationMs: 1500,
    };

    it('should write a usage record successfully', async () => {
      const mockRecord = {
        executionId: 'exec-123',
        ...validDto,
        timestamp: new Date(),
      };

      repository.create.mockReturnValue(mockRecord as any);
      repository.save.mockResolvedValue(mockRecord as any);

      const result = await service.writeRecord(validDto);

      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockRecord);
    });

    it('should generate unique executionId', async () => {
      const mockRecord = {
        executionId: expect.any(String),
        ...validDto,
      };

      repository.create.mockReturnValue(mockRecord as any);
      repository.save.mockResolvedValue(mockRecord as any);

      await service.writeRecord(validDto);

      const createCall = repository.create.mock.calls[0][0];
      expect(createCall.executionId).toBeDefined();
      expect(typeof createCall.executionId).toBe('string');
      expect(createCall.executionId.length).toBeGreaterThan(0);
    });

    it('should include all required fields', async () => {
      repository.create.mockReturnValue({} as any);
      repository.save.mockResolvedValue({} as any);

      await service.writeRecord(validDto);

      const createCall = repository.create.mock.calls[0][0];
      expect(createCall.apiKeyId).toBe('key-test');
      expect(createCall.userId).toBe('user-123');
      expect(createCall.sessionId).toBe('session-456');
      expect(createCall.conversationId).toBe('conv-789');
      expect(createCall.provider).toBe('anthropic');
      expect(createCall.adapter).toBe('claude-stub');
      expect(createCall.model).toBe('claude-3-5-sonnet-20241022');
      expect(createCall.tokensUsed).toBe(100);
      expect(createCall.executionDurationMs).toBe(1500);
    });

    it('should include optional metadata if provided', async () => {
      const dtoWithMetadata: CreateUsageRecordDto = {
        ...validDto,
        metadata: { region: 'us-east-1', version: '1.0.0' },
      };

      repository.create.mockReturnValue({} as any);
      repository.save.mockResolvedValue({} as any);

      await service.writeRecord(dtoWithMetadata);

      const createCall = repository.create.mock.calls[0][0];
      expect(createCall.metadata).toEqual({
        region: 'us-east-1',
        version: '1.0.0',
      });
    });

    it('should throw error if save fails', async () => {
      const error = new Error('Database error');
      repository.create.mockReturnValue({} as any);
      repository.save.mockRejectedValue(error);

      await expect(service.writeRecord(validDto)).rejects.toThrow(
        'Database error',
      );
    });

    it('should propagate database constraint errors', async () => {
      const constraintError = new Error('Duplicate executionId');
      repository.create.mockReturnValue({} as any);
      repository.save.mockRejectedValue(constraintError);

      await expect(service.writeRecord(validDto)).rejects.toThrow(
        'Duplicate executionId',
      );
    });
  });

  describe('validateUsageRecord', () => {
    const validDto: CreateUsageRecordDto = {
      apiKeyId: 'key-test',
      userId: 'user-123',
      sessionId: 'session-456',
      conversationId: 'conv-789',
      provider: 'anthropic',
      adapter: 'claude-stub',
      model: 'claude-3-5-sonnet-20241022',
      tokensUsed: 100,
      executionDurationMs: 1500,
    };

    it('should validate valid usage record', () => {
      expect(() => service.validateUsageRecord(validDto)).not.toThrow();
    });

    it('should throw if apiKeyId is missing', () => {
      const invalidDto = { ...validDto, apiKeyId: '' };
      expect(() => service.validateUsageRecord(invalidDto)).toThrow(
        'apiKeyId is required',
      );
    });

    it('should throw if userId is missing', () => {
      const invalidDto = { ...validDto, userId: '' };
      expect(() => service.validateUsageRecord(invalidDto)).toThrow(
        'userId is required',
      );
    });

    it('should throw if sessionId is missing', () => {
      const invalidDto = { ...validDto, sessionId: '' };
      expect(() => service.validateUsageRecord(invalidDto)).toThrow(
        'sessionId is required',
      );
    });

    it('should throw if conversationId is missing', () => {
      const invalidDto = { ...validDto, conversationId: '' };
      expect(() => service.validateUsageRecord(invalidDto)).toThrow(
        'conversationId is required',
      );
    });

    it('should throw if provider is missing', () => {
      const invalidDto = { ...validDto, provider: '' };
      expect(() => service.validateUsageRecord(invalidDto)).toThrow(
        'provider is required',
      );
    });

    it('should throw if adapter is missing', () => {
      const invalidDto = { ...validDto, adapter: '' };
      expect(() => service.validateUsageRecord(invalidDto)).toThrow(
        'adapter is required',
      );
    });

    it('should throw if model is missing', () => {
      const invalidDto = { ...validDto, model: '' };
      expect(() => service.validateUsageRecord(invalidDto)).toThrow(
        'model is required',
      );
    });

    it('should throw if tokensUsed is zero', () => {
      const invalidDto = { ...validDto, tokensUsed: 0 };
      expect(() => service.validateUsageRecord(invalidDto)).toThrow(
        'tokensUsed must be a positive number',
      );
    });

    it('should throw if tokensUsed is negative', () => {
      const invalidDto = { ...validDto, tokensUsed: -100 };
      expect(() => service.validateUsageRecord(invalidDto)).toThrow(
        'tokensUsed must be a positive number',
      );
    });

    it('should throw if executionDurationMs is negative', () => {
      const invalidDto = { ...validDto, executionDurationMs: -1 };
      expect(() => service.validateUsageRecord(invalidDto)).toThrow(
        'executionDurationMs must be a non-negative number',
      );
    });

    it('should allow executionDurationMs to be zero', () => {
      const dtoWithZeroDuration = { ...validDto, executionDurationMs: 0 };
      expect(() =>
        service.validateUsageRecord(dtoWithZeroDuration),
      ).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should log error on write failure', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'error');
      const error = new Error('Connection timeout');

      repository.create.mockReturnValue({} as any);
      repository.save.mockRejectedValue(error);

      const dto: CreateUsageRecordDto = {
        apiKeyId: 'key-test',
        userId: 'user-123',
        sessionId: 'session-456',
        conversationId: 'conv-789',
        provider: 'anthropic',
        adapter: 'claude-stub',
        model: 'claude-3-5-sonnet-20241022',
        tokensUsed: 100,
        executionDurationMs: 1500,
      };

      await expect(service.writeRecord(dto)).rejects.toThrow();
      expect(loggerSpy).toHaveBeenCalled();
    });

    it('should log success on write success', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      const mockRecord = {
        executionId: 'exec-123',
        apiKeyId: 'key-test',
        model: 'claude-3-5-sonnet-20241022',
        tokensUsed: 100,
      };

      repository.create.mockReturnValue(mockRecord as any);
      repository.save.mockResolvedValue(mockRecord as any);

      const dto: CreateUsageRecordDto = {
        apiKeyId: 'key-test',
        userId: 'user-123',
        sessionId: 'session-456',
        conversationId: 'conv-789',
        provider: 'anthropic',
        adapter: 'claude-stub',
        model: 'claude-3-5-sonnet-20241022',
        tokensUsed: 100,
        executionDurationMs: 1500,
      };

      await service.writeRecord(dto);
      expect(loggerSpy).toHaveBeenCalled();
    });
  });
});
