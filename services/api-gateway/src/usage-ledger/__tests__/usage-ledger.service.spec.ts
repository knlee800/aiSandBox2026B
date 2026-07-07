import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, UpdateQueryBuilder } from 'typeorm';
import { UsageLedgerService, CreateUsageRecordDto, UpdateExecutionResultDto } from '../usage-ledger.service';
import { UsageRecord } from '../../entities/usage-record.entity';
import { CreditDeductionGateway } from '../../billing/credit-deduction';

describe('UsageLedgerService', () => {
  let service: UsageLedgerService;
  let repository: jest.Mocked<Repository<UsageRecord>>;

  beforeEach(async () => {
    // Create mock repository
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
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

    // Phase 43A-2B: Idempotency tests
    describe('idempotency via requestId', () => {
      it('should include requestId when provided', async () => {
        const dtoWithRequestId: CreateUsageRecordDto = {
          ...validDto,
          requestId: 'req-abc-123',
        };

        repository.create.mockReturnValue({} as any);
        repository.save.mockResolvedValue({} as any);

        await service.writeRecord(dtoWithRequestId);

        const createCall = repository.create.mock.calls[0][0];
        expect(createCall.requestId).toBe('req-abc-123');
      });

      it('should omit requestId when not provided', async () => {
        repository.create.mockReturnValue({} as any);
        repository.save.mockResolvedValue({} as any);

        await service.writeRecord(validDto);

        const createCall = repository.create.mock.calls[0][0];
        expect(createCall.requestId).toBeUndefined();
      });

      it('should return existing record on unique violation with requestId', async () => {
        const dtoWithRequestId: CreateUsageRecordDto = {
          ...validDto,
          requestId: 'req-duplicate-123',
        };

        const existingRecord = {
          executionId: 'existing-exec-id',
          ...dtoWithRequestId,
          timestamp: new Date(),
        };

        // Simulate unique violation (Postgres error code 23505)
        const uniqueViolationError: any = new Error('duplicate key value');
        uniqueViolationError.code = '23505';

        repository.create.mockReturnValue({} as any);
        repository.save.mockRejectedValue(uniqueViolationError);
        repository.findOne.mockResolvedValue(existingRecord as any);

        const result = await service.writeRecord(dtoWithRequestId);

        expect(repository.findOne).toHaveBeenCalledWith({
          where: {
            userId: 'user-123',
            requestId: 'req-duplicate-123',
          },
        });
        expect(result).toEqual(existingRecord);
      });

      it('should return existing record on unique violation with constraint name', async () => {
        const dtoWithRequestId: CreateUsageRecordDto = {
          ...validDto,
          requestId: 'req-duplicate-456',
        };

        const existingRecord = {
          executionId: 'existing-exec-id-2',
          ...dtoWithRequestId,
          timestamp: new Date(),
        };

        // Simulate unique violation with constraint name
        const uniqueViolationError: any = new Error('duplicate key value');
        uniqueViolationError.constraint = 'idx_usage_records_user_request_id';

        repository.create.mockReturnValue({} as any);
        repository.save.mockRejectedValue(uniqueViolationError);
        repository.findOne.mockResolvedValue(existingRecord as any);

        const result = await service.writeRecord(dtoWithRequestId);

        expect(repository.findOne).toHaveBeenCalledWith({
          where: {
            userId: 'user-123',
            requestId: 'req-duplicate-456',
          },
        });
        expect(result).toEqual(existingRecord);
      });

      it('should throw error if unique violation but no existing record found', async () => {
        const dtoWithRequestId: CreateUsageRecordDto = {
          ...validDto,
          requestId: 'req-orphan-123',
        };

        const uniqueViolationError: any = new Error('duplicate key value');
        uniqueViolationError.code = '23505';

        repository.create.mockReturnValue({} as any);
        repository.save.mockRejectedValue(uniqueViolationError);
        repository.findOne.mockResolvedValue(null); // No record found

        await expect(service.writeRecord(dtoWithRequestId)).rejects.toThrow(
          'Idempotency conflict: unique violation but no existing record found',
        );
      });

      it('should throw error on unique violation without requestId', async () => {
        // Unique violation on different constraint (e.g., executionId)
        const uniqueViolationError: any = new Error('duplicate key value');
        uniqueViolationError.code = '23505';

        repository.create.mockReturnValue({} as any);
        repository.save.mockRejectedValue(uniqueViolationError);

        // Should NOT call findOne (no requestId provided)
        await expect(service.writeRecord(validDto)).rejects.toThrow(
          'duplicate key value',
        );
        expect(repository.findOne).not.toHaveBeenCalled();
      });

      it('should throw error on non-unique-violation database error with requestId', async () => {
        const dtoWithRequestId: CreateUsageRecordDto = {
          ...validDto,
          requestId: 'req-other-error',
        };

        const otherError = new Error('Connection timeout');
        repository.create.mockReturnValue({} as any);
        repository.save.mockRejectedValue(otherError);

        // Should NOT call findOne (not a unique violation)
        await expect(service.writeRecord(dtoWithRequestId)).rejects.toThrow(
          'Connection timeout',
        );
        expect(repository.findOne).not.toHaveBeenCalled();
      });
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

  describe('findOrphanedPending (Phase 43C-2)', () => {
    it('should find orphaned pending records older than threshold', async () => {
      const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000);
      const orphanRecords = [
        {
          executionId: 'orphan-1',
          userId: 'user-1',
          executionStatus: 'pending',
          timestamp: oldTimestamp,
        },
        {
          executionId: 'orphan-2',
          userId: 'user-2',
          executionStatus: 'pending',
          timestamp: oldTimestamp,
        },
      ];

      repository.find.mockResolvedValue(orphanRecords as any);

      const result = await service.findOrphanedPending(5 * 60 * 1000, 100);

      expect(repository.find).toHaveBeenCalledWith({
        where: {
          executionStatus: 'pending',
          timestamp: expect.any(Object),
        },
        order: { timestamp: 'ASC' },
        take: 100,
      });
      expect(result).toEqual(orphanRecords);
    });

    it('should return empty array when no orphans found', async () => {
      repository.find.mockResolvedValue([]);

      const result = await service.findOrphanedPending();

      expect(result).toEqual([]);
    });

    it('should use default threshold of 5 minutes', async () => {
      repository.find.mockResolvedValue([]);

      await service.findOrphanedPending();

      expect(repository.find).toHaveBeenCalledTimes(1);
      const findCall = repository.find.mock.calls[0][0] as any;
      expect(findCall.where.executionStatus).toBe('pending');
    });

    it('should respect limit parameter', async () => {
      repository.find.mockResolvedValue([]);

      await service.findOrphanedPending(5 * 60 * 1000, 25);

      const findCall = repository.find.mock.calls[0][0];
      expect(findCall.take).toBe(25);
    });
  });

  describe('batchTransitionOrphansToTimeout (Phase 43C-2)', () => {
    it('should return 0 for empty executionIds array', async () => {
      const result = await service.batchTransitionOrphansToTimeout([]);

      expect(result).toBe(0);
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should transition multiple orphans to timeout', async () => {
      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
      };

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.batchTransitionOrphansToTimeout([
        'exec-1',
        'exec-2',
        'exec-3',
      ]);

      expect(result).toBe(3);
      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({ executionStatus: 'timeout' });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'execution_id IN (:...ids)',
        { ids: ['exec-1', 'exec-2', 'exec-3'] },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'execution_status = :status',
        { status: 'pending' },
      );
    });

    it('should handle partial transitions (some already transitioned)', async () => {
      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.batchTransitionOrphansToTimeout(['exec-1', 'exec-2']);

      expect(result).toBe(1);
    });

    it('should handle undefined affected count', async () => {
      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.batchTransitionOrphansToTimeout(['exec-1']);

      expect(result).toBe(0);
    });
  });

  describe('BILLING-READY-02B: Credit Deduction Gateway Wiring', () => {
    let serviceWithGateway: UsageLedgerService;
    let gatewayRepo: jest.Mocked<Repository<UsageRecord>>;
    let mockGateway: jest.Mocked<CreditDeductionGateway>;

    beforeEach(async () => {
      mockGateway = {
        applyDeduction: jest.fn().mockReturnValue({
          source: 'usage_ledger',
          sourceEventId: 'exec-test',
          ownerId: 'user-123',
          occurredAt: new Date(),
          totalCreditsRequested: 0,
          totalCreditsApplied: 0,
          totalCreditsOverflow: 0,
          lineItems: [],
        }),
      } as any;

      const gatewayMockRepo = {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
        update: jest.fn(),
        createQueryBuilder: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UsageLedgerService,
          {
            provide: getRepositoryToken(UsageRecord),
            useValue: gatewayMockRepo,
          },
          {
            provide: CreditDeductionGateway,
            useValue: mockGateway,
          },
        ],
      }).compile();

      serviceWithGateway = module.get<UsageLedgerService>(UsageLedgerService);
      gatewayRepo = module.get(getRepositoryToken(UsageRecord));
    });

    it('should call gateway.applyDeduction after updateExecutionResult succeeds', async () => {
      const existingRecord = {
        executionId: 'exec-test',
        userId: 'user-123',
        apiKeyId: 'key-1',
        sessionId: 'sess-1',
        requestId: null,
        model: null,
        tokensUsed: null,
        executionDurationMs: null,
        executionStatus: 'pending',
        metadata: {},
      };

      gatewayRepo.findOne.mockResolvedValue(existingRecord as any);
      gatewayRepo.save.mockResolvedValue({
        ...existingRecord,
        model: 'claude-3',
        tokensUsed: 500,
        executionDurationMs: 2000,
        executionStatus: 'completed',
        metadata: { aiExecutionResult: { output: 'test', tokensUsed: 500, model: 'claude-3', fileActions: [] } },
      } as any);

      const dto: UpdateExecutionResultDto = {
        executionId: 'exec-test',
        model: 'claude-3',
        tokensUsed: 500,
        executionDurationMs: 2000,
        executionStatus: 'completed',
        output: 'test',
      };

      await serviceWithGateway.updateExecutionResult(dto);

      expect(mockGateway.applyDeduction).toHaveBeenCalledTimes(1);
      const event = mockGateway.applyDeduction.mock.calls[0][0];
      expect(event.source).toBe('usage_ledger');
      expect(event.sourceEventId).toBe('exec-test');
      expect(event.ownerId).toBe('user-123');
      expect(event.lineItems).toHaveLength(1);
      expect(event.lineItems[0].category).toBe('model_tokens');
      expect(event.lineItems[0].unitCount).toBe(500);
      expect(event.lineItems[0].creditsRequested).toBe(0);
    });

    it('should NOT break updateExecutionResult if gateway throws', async () => {
      mockGateway.applyDeduction.mockImplementation(() => {
        throw new Error('Gateway failure');
      });

      const existingRecord = {
        executionId: 'exec-err',
        userId: 'user-456',
        apiKeyId: 'key-2',
        sessionId: 'sess-2',
        requestId: null,
        model: null,
        tokensUsed: null,
        executionDurationMs: null,
        executionStatus: 'pending',
        metadata: {},
      };

      gatewayRepo.findOne.mockResolvedValue(existingRecord as any);
      gatewayRepo.save.mockResolvedValue({
        ...existingRecord,
        model: 'gpt-4',
        tokensUsed: 300,
        executionDurationMs: 1500,
        executionStatus: 'completed',
        metadata: { aiExecutionResult: { output: 'out', tokensUsed: 300, model: 'gpt-4', fileActions: [] } },
      } as any);

      const dto: UpdateExecutionResultDto = {
        executionId: 'exec-err',
        model: 'gpt-4',
        tokensUsed: 300,
        executionDurationMs: 1500,
        executionStatus: 'completed',
        output: 'out',
      };

      const result = await serviceWithGateway.updateExecutionResult(dto);
      expect(result).toBeDefined();
      expect(result.executionStatus).toBe('completed');
    });

    it('should silently skip deduction when gateway is not injected (Optional)', async () => {
      const existingRecord = {
        executionId: 'exec-noop',
        userId: 'user-789',
        apiKeyId: 'key-3',
        sessionId: 'sess-3',
        requestId: null,
        model: null,
        tokensUsed: null,
        executionDurationMs: null,
        executionStatus: 'pending',
        metadata: {},
      };

      repository.findOne.mockResolvedValue(existingRecord as any);
      repository.save.mockResolvedValue({
        ...existingRecord,
        model: 'claude-3',
        tokensUsed: 100,
        executionDurationMs: 500,
        executionStatus: 'completed',
        metadata: { aiExecutionResult: { output: 'x', tokensUsed: 100, model: 'claude-3', fileActions: [] } },
      } as any);

      const dto: UpdateExecutionResultDto = {
        executionId: 'exec-noop',
        model: 'claude-3',
        tokensUsed: 100,
        executionDurationMs: 500,
        executionStatus: 'completed',
        output: 'x',
      };

      const result = await service.updateExecutionResult(dto);
      expect(result).toBeDefined();
      expect(result.executionStatus).toBe('completed');
    });

    it('should use executionId as sourceEventId (single deduction per execution)', async () => {
      const existingRecord = {
        executionId: 'unique-exec-id-42',
        userId: 'user-bill',
        apiKeyId: 'key-bill',
        sessionId: 'sess-bill',
        requestId: null,
        model: null,
        tokensUsed: null,
        executionDurationMs: null,
        executionStatus: 'pending',
        metadata: {},
      };

      gatewayRepo.findOne.mockResolvedValue(existingRecord as any);
      gatewayRepo.save.mockResolvedValue({
        ...existingRecord,
        model: 'claude-3',
        tokensUsed: 200,
        executionDurationMs: 1000,
        executionStatus: 'completed',
        metadata: { aiExecutionResult: { output: 'y', tokensUsed: 200, model: 'claude-3', fileActions: [] } },
      } as any);

      await serviceWithGateway.updateExecutionResult({
        executionId: 'unique-exec-id-42',
        model: 'claude-3',
        tokensUsed: 200,
        executionDurationMs: 1000,
        executionStatus: 'completed',
        output: 'y',
      });

      expect(mockGateway.applyDeduction).toHaveBeenCalledTimes(1);
      expect(mockGateway.applyDeduction.mock.calls[0][0].sourceEventId).toBe('unique-exec-id-42');
    });
  });
});
