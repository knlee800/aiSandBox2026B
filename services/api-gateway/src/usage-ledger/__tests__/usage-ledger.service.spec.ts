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

  describe('AGENT-PLATFORM-06: writeExecutionIntent identity field propagation', () => {
    it('should merge identity fields into metadata JSONB when provided', async () => {
      repository.create.mockReturnValue({} as any);
      repository.save.mockResolvedValue({} as any);

      await service.writeExecutionIntent({
        executionId: 'exec-id-06',
        apiKeyId: 'key-06',
        userId: 'user-06',
        sessionId: 'sess-06',
        conversationId: 'conv-06',
        provider: 'stub',
        adapter: 'stub',
        metadata: { apiKeyId: 'key-06', requestedProvider: 'stub', requestedModel: null },
        agentRole: 'builder',
        builderProfileId: 'builder-default',
        collaborationRunId: 'collab-run-001',
        referralTraceId: 'ref-trace-001',
      });

      expect(repository.create).toHaveBeenCalledTimes(1);
      const createCall = repository.create.mock.calls[0][0];
      expect(createCall.metadata).toEqual(expect.objectContaining({
        agentRole: 'builder',
        builderProfileId: 'builder-default',
        collaborationRunId: 'collab-run-001',
        referralTraceId: 'ref-trace-001',
        apiKeyId: 'key-06',
        requestedProvider: 'stub',
        requestedModel: null,
      }));
    });

    it('should not add identity keys to metadata when identity fields are absent', async () => {
      repository.create.mockReturnValue({} as any);
      repository.save.mockResolvedValue({} as any);

      await service.writeExecutionIntent({
        executionId: 'exec-id-06b',
        apiKeyId: 'key-06b',
        userId: 'user-06b',
        sessionId: 'sess-06b',
        conversationId: 'conv-06b',
        provider: 'stub',
        adapter: 'stub',
        metadata: { apiKeyId: 'key-06b' },
      });

      const createCall = repository.create.mock.calls[0][0];
      expect(createCall.metadata).toEqual({ apiKeyId: 'key-06b' });
      expect(createCall.metadata).not.toHaveProperty('agentRole');
      expect(createCall.metadata).not.toHaveProperty('builderProfileId');
      expect(createCall.metadata).not.toHaveProperty('collaborationRunId');
      expect(createCall.metadata).not.toHaveProperty('referralTraceId');
    });

    it('should merge partial identity fields (only agentRole set)', async () => {
      repository.create.mockReturnValue({} as any);
      repository.save.mockResolvedValue({} as any);

      await service.writeExecutionIntent({
        executionId: 'exec-id-06c',
        apiKeyId: 'key-06c',
        userId: 'user-06c',
        sessionId: 'sess-06c',
        conversationId: 'conv-06c',
        provider: 'stub',
        adapter: 'stub',
        metadata: { source: 'test' },
        agentRole: 'reviewer',
      });

      const createCall = repository.create.mock.calls[0][0];
      expect(createCall.metadata).toEqual(expect.objectContaining({
        source: 'test',
        agentRole: 'reviewer',
      }));
      expect(createCall.metadata).not.toHaveProperty('builderProfileId');
      expect(createCall.metadata).not.toHaveProperty('collaborationRunId');
      expect(createCall.metadata).not.toHaveProperty('referralTraceId');
    });
  });

  describe('BILLING-READY-03C2: Async Credit Deduction Gateway Wiring', () => {
    let serviceWithGateway: UsageLedgerService;
    let gatewayRepo: jest.Mocked<Repository<UsageRecord>>;
    let mockGateway: { applyDeduction: jest.Mock };

    beforeEach(async () => {
      mockGateway = {
        applyDeduction: jest.fn().mockResolvedValue({
          source: 'usage_ledger',
          sourceEventId: 'exec-test',
          ownerId: 'user-123',
          occurredAt: new Date(),
          totalCreditsRequested: 0,
          totalCreditsApplied: 0,
          totalCreditsOverflow: 0,
          lineItems: [],
        }),
      };

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

    it('should NOT break updateExecutionResult if gateway rejects (async failure suppressed)', async () => {
      mockGateway.applyDeduction.mockRejectedValue(
        new Error('Async gateway failure'),
      );

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

    it('should NOT break updateExecutionResult if gateway throws synchronously', async () => {
      mockGateway.applyDeduction.mockImplementation(() => {
        throw new Error('Sync gateway failure');
      });

      const existingRecord = {
        executionId: 'exec-sync-err',
        userId: 'user-sync',
        apiKeyId: 'key-sync',
        sessionId: 'sess-sync',
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
        tokensUsed: 200,
        executionDurationMs: 1000,
        executionStatus: 'completed',
        metadata: { aiExecutionResult: { output: 'sync', tokensUsed: 200, model: 'gpt-4', fileActions: [] } },
      } as any);

      const dto: UpdateExecutionResultDto = {
        executionId: 'exec-sync-err',
        model: 'gpt-4',
        tokensUsed: 200,
        executionDurationMs: 1000,
        executionStatus: 'completed',
        output: 'sync',
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

    it('should await async gateway resolution before returning (BILLING-READY-03C2)', async () => {
      const callOrder: string[] = [];

      mockGateway.applyDeduction.mockImplementation(async () => {
        callOrder.push('gateway_start');
        await new Promise((r) => setTimeout(r, 10));
        callOrder.push('gateway_end');
        return {
          source: 'usage_ledger',
          sourceEventId: 'exec-order',
          ownerId: 'user-order',
          occurredAt: new Date(),
          totalCreditsRequested: 0,
          totalCreditsApplied: 0,
          totalCreditsOverflow: 0,
          lineItems: [],
        };
      });

      const existingRecord = {
        executionId: 'exec-order',
        userId: 'user-order',
        apiKeyId: 'key-order',
        sessionId: 'sess-order',
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
        tokensUsed: 100,
        executionDurationMs: 500,
        executionStatus: 'completed',
        metadata: { aiExecutionResult: { output: 'ord', tokensUsed: 100, model: 'claude-3', fileActions: [] } },
      } as any);

      await serviceWithGateway.updateExecutionResult({
        executionId: 'exec-order',
        model: 'claude-3',
        tokensUsed: 100,
        executionDurationMs: 500,
        executionStatus: 'completed',
        output: 'ord',
      });

      expect(callOrder).toEqual(['gateway_start', 'gateway_end']);
      expect(mockGateway.applyDeduction).toHaveBeenCalledTimes(1);
    });

    it('should use zero tokensUsed when record.tokensUsed is null', async () => {
      const existingRecord = {
        executionId: 'exec-null-tokens',
        userId: 'user-null',
        apiKeyId: 'key-null',
        sessionId: 'sess-null',
        requestId: null,
        model: 'claude-3',
        tokensUsed: null,
        executionDurationMs: 1000,
        executionStatus: 'pending',
        metadata: {},
      };

      gatewayRepo.findOne.mockResolvedValue(existingRecord as any);
      gatewayRepo.save.mockResolvedValue({
        ...existingRecord,
        model: 'claude-3',
        tokensUsed: 0,
        executionDurationMs: 1000,
        executionStatus: 'completed',
        metadata: { aiExecutionResult: { output: 'test', tokensUsed: 0, model: 'claude-3', fileActions: [] } },
      } as any);

      await serviceWithGateway.updateExecutionResult({
        executionId: 'exec-null-tokens',
        model: 'claude-3',
        tokensUsed: 0,
        executionDurationMs: 1000,
        executionStatus: 'completed',
        output: 'test',
      });

      expect(mockGateway.applyDeduction).toHaveBeenCalledTimes(1);
      const event = mockGateway.applyDeduction.mock.calls[0][0];
      expect(event.lineItems[0].unitCount).toBe(0);
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

  describe('BILLING-READY-04C: triggerDeductionForExecution', () => {
    let serviceWithGateway: UsageLedgerService;
    let gatewayRepo: jest.Mocked<Repository<UsageRecord>>;
    let mockGateway: { applyDeduction: jest.Mock };

    beforeEach(async () => {
      mockGateway = {
        applyDeduction: jest.fn().mockResolvedValue({
          source: 'usage_ledger',
          sourceEventId: 'exec-trigger',
          ownerId: 'user-trigger',
          occurredAt: new Date(),
          totalCreditsRequested: 0,
          totalCreditsApplied: 0,
          totalCreditsOverflow: 0,
          lineItems: [],
        }),
      };

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

    it('should call existing deduction path for completed execution', async () => {
      const completedRecord = {
        executionId: 'exec-trigger-1',
        userId: 'user-trigger-1',
        apiKeyId: 'key-1',
        sessionId: 'sess-1',
        model: 'claude-3',
        tokensUsed: 500,
        executionDurationMs: 2000,
        executionStatus: 'completed',
        metadata: {},
      };

      gatewayRepo.findOne.mockResolvedValue(completedRecord as any);

      const result = await serviceWithGateway.triggerDeductionForExecution('exec-trigger-1');

      expect(result.triggered).toBe(true);
      expect(result.reason).toBe('completed');
      expect(mockGateway.applyDeduction).toHaveBeenCalledTimes(1);
      const event = mockGateway.applyDeduction.mock.calls[0][0];
      expect(event.sourceEventId).toBe('exec-trigger-1');
      expect(event.ownerId).toBe('user-trigger-1');
      expect(event.lineItems[0].unitCount).toBe(500);
    });

    it('should trigger deduction for completed zero-token execution', async () => {
      const zeroTokenRecord = {
        executionId: 'exec-zero-tok',
        userId: 'user-zero',
        apiKeyId: 'key-zero',
        sessionId: 'sess-zero',
        model: 'stub',
        tokensUsed: 0,
        executionDurationMs: 100,
        executionStatus: 'completed',
        metadata: {},
      };

      gatewayRepo.findOne.mockResolvedValue(zeroTokenRecord as any);

      const result = await serviceWithGateway.triggerDeductionForExecution('exec-zero-tok');

      expect(result.triggered).toBe(true);
      expect(result.reason).toBe('completed');
      expect(mockGateway.applyDeduction).toHaveBeenCalledTimes(1);
      const event = mockGateway.applyDeduction.mock.calls[0][0];
      expect(event.lineItems[0].unitCount).toBe(0);
    });

    it('should NOT deduct for failed execution', async () => {
      const failedRecord = {
        executionId: 'exec-failed',
        userId: 'user-failed',
        executionStatus: 'failed',
        metadata: {},
      };

      gatewayRepo.findOne.mockResolvedValue(failedRecord as any);

      const result = await serviceWithGateway.triggerDeductionForExecution('exec-failed');

      expect(result.triggered).toBe(false);
      expect(result.reason).toBe('status_failed');
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('should NOT deduct for cancelled execution', async () => {
      const cancelledRecord = {
        executionId: 'exec-cancelled',
        userId: 'user-cancelled',
        executionStatus: 'cancelled',
        metadata: {},
      };

      gatewayRepo.findOne.mockResolvedValue(cancelledRecord as any);

      const result = await serviceWithGateway.triggerDeductionForExecution('exec-cancelled');

      expect(result.triggered).toBe(false);
      expect(result.reason).toBe('status_cancelled');
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('should NOT deduct for cancel_requested execution', async () => {
      const cancelRequestedRecord = {
        executionId: 'exec-cancel-req',
        userId: 'user-cancel-req',
        executionStatus: 'cancel_requested',
        metadata: {},
      };

      gatewayRepo.findOne.mockResolvedValue(cancelRequestedRecord as any);

      const result = await serviceWithGateway.triggerDeductionForExecution('exec-cancel-req');

      expect(result.triggered).toBe(false);
      expect(result.reason).toBe('status_cancel_requested');
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('should safely skip when no usage record exists', async () => {
      gatewayRepo.findOne.mockResolvedValue(null);

      const result = await serviceWithGateway.triggerDeductionForExecution('exec-missing');

      expect(result.triggered).toBe(false);
      expect(result.reason).toBe('record_not_found');
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('should use executionId as sourceEventId (idempotency key)', async () => {
      const record = {
        executionId: 'exec-idemp-04c',
        userId: 'user-idemp',
        apiKeyId: 'key-idemp',
        sessionId: 'sess-idemp',
        model: 'claude-3',
        tokensUsed: 100,
        executionDurationMs: 500,
        executionStatus: 'completed',
        metadata: {},
      };

      gatewayRepo.findOne.mockResolvedValue(record as any);

      await serviceWithGateway.triggerDeductionForExecution('exec-idemp-04c');

      expect(mockGateway.applyDeduction).toHaveBeenCalledTimes(1);
      expect(mockGateway.applyDeduction.mock.calls[0][0].sourceEventId).toBe('exec-idemp-04c');
    });

    it('should NOT deduct for timeout execution', async () => {
      const timeoutRecord = {
        executionId: 'exec-timeout',
        userId: 'user-timeout',
        executionStatus: 'timeout',
        metadata: {},
      };

      gatewayRepo.findOne.mockResolvedValue(timeoutRecord as any);

      const result = await serviceWithGateway.triggerDeductionForExecution('exec-timeout');

      expect(result.triggered).toBe(false);
      expect(result.reason).toBe('status_timeout');
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('should NOT deduct for pending execution', async () => {
      const pendingRecord = {
        executionId: 'exec-pending',
        userId: 'user-pending',
        executionStatus: 'pending',
        metadata: {},
      };

      gatewayRepo.findOne.mockResolvedValue(pendingRecord as any);

      const result = await serviceWithGateway.triggerDeductionForExecution('exec-pending');

      expect(result.triggered).toBe(false);
      expect(result.reason).toBe('status_pending');
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('should NOT deduct for running execution', async () => {
      const runningRecord = {
        executionId: 'exec-running',
        userId: 'user-running',
        executionStatus: 'running',
        metadata: {},
      };

      gatewayRepo.findOne.mockResolvedValue(runningRecord as any);

      const result = await serviceWithGateway.triggerDeductionForExecution('exec-running');

      expect(result.triggered).toBe(false);
      expect(result.reason).toBe('status_running');
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('should handle null tokensUsed as 0 for completed execution', async () => {
      const nullTokensRecord = {
        executionId: 'exec-null-tokens-04c',
        userId: 'user-null-tok',
        apiKeyId: 'key-null-tok',
        sessionId: 'sess-null-tok',
        model: 'claude-3',
        tokensUsed: null,
        executionDurationMs: 500,
        executionStatus: 'completed',
        metadata: {},
      };

      gatewayRepo.findOne.mockResolvedValue(nullTokensRecord as any);

      const result = await serviceWithGateway.triggerDeductionForExecution('exec-null-tokens-04c');

      expect(result.triggered).toBe(true);
      expect(mockGateway.applyDeduction).toHaveBeenCalledTimes(1);
      const event = mockGateway.applyDeduction.mock.calls[0][0];
      expect(event.lineItems[0].unitCount).toBe(0);
    });
  });

  describe('PRIVATE-BETA-BLOCKER-03D-A: intent gate + confirm-build-apply', () => {
    let serviceWithGateway: UsageLedgerService;
    let gatewayRepo: jest.Mocked<Repository<UsageRecord>>;
    let mockGateway: { applyDeduction: jest.Mock };

    const qualifyingConfirmation = {
      applyStatus: 'applied',
      totalActions: 2,
      successCount: 2,
    };

    const buildFileActions = [
      { action: 'write', path: 'src/a.ts', content: 'a' },
      { action: 'write', path: 'src/b.ts', content: 'b' },
    ];

    function completedRecord(overrides: Record<string, unknown> = {}) {
      return {
        executionId: 'exec-03d-a',
        userId: 'user-03d-a',
        apiKeyId: 'key-03d-a',
        sessionId: 'sess-03d-a',
        model: 'grok-4-5',
        tokensUsed: 500,
        executionDurationMs: 2000,
        executionStatus: 'completed',
        metadata: {
          aiExecutionResult: {
            output: 'ok',
            tokensUsed: 500,
            model: 'grok-4-5',
            fileActions: buildFileActions,
            executionIntent: 'workspace_mutation',
          },
        },
        ...overrides,
      };
    }

    beforeEach(async () => {
      mockGateway = {
        applyDeduction: jest.fn().mockResolvedValue({
          source: 'usage_ledger',
          sourceEventId: 'exec-03d-a',
          ownerId: 'user-03d-a',
          occurredAt: new Date(),
          totalCreditsRequested: 0,
          totalCreditsApplied: 0,
          totalCreditsOverflow: 0,
          lineItems: [],
        }),
      };

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

    it('charges a completed conversation execution immediately', async () => {
      gatewayRepo.findOne.mockResolvedValue(
        completedRecord({
          metadata: {
            aiExecutionResult: {
              output: 'hello',
              tokensUsed: 500,
              model: 'grok-4-5',
              fileActions: [],
              executionIntent: 'conversation',
            },
          },
        }) as any,
      );

      const result = await serviceWithGateway.triggerDeductionForExecution('exec-03d-a');

      expect(result).toEqual({ triggered: true, reason: 'completed' });
      expect(mockGateway.applyDeduction).toHaveBeenCalledTimes(1);
      expect(mockGateway.applyDeduction.mock.calls[0][0].sourceEventId).toBe('exec-03d-a');
    });

    it('keeps duplicate Ask deduction idempotent via existing sourceEventId gateway contract', async () => {
      gatewayRepo.findOne.mockResolvedValue(
        completedRecord({
          metadata: {
            aiExecutionResult: {
              output: 'hello',
              tokensUsed: 500,
              model: 'grok-4-5',
              fileActions: [],
              executionIntent: 'conversation',
            },
          },
        }) as any,
      );

      await serviceWithGateway.triggerDeductionForExecution('exec-03d-a');
      await serviceWithGateway.triggerDeductionForExecution('exec-03d-a');

      expect(mockGateway.applyDeduction).toHaveBeenCalledTimes(2);
      expect(mockGateway.applyDeduction.mock.calls[0][0].sourceEventId).toBe('exec-03d-a');
      expect(mockGateway.applyDeduction.mock.calls[1][0].sourceEventId).toBe('exec-03d-a');
    });

    it('does not charge a completed workspace_mutation execution at ordinary completion', async () => {
      gatewayRepo.findOne.mockResolvedValue(completedRecord() as any);

      const result = await serviceWithGateway.triggerDeductionForExecution('exec-03d-a');

      expect(result).toEqual({ triggered: false, reason: 'build_awaiting_apply' });
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('does not charge failed executions even when intent is workspace_mutation', async () => {
      gatewayRepo.findOne.mockResolvedValue(
        completedRecord({ executionStatus: 'failed' }) as any,
      );

      const result = await serviceWithGateway.triggerDeductionForExecution('exec-03d-a');

      expect(result).toEqual({ triggered: false, reason: 'status_failed' });
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('does not charge timeout executions', async () => {
      gatewayRepo.findOne.mockResolvedValue(
        completedRecord({ executionStatus: 'timeout' }) as any,
      );

      const result = await serviceWithGateway.triggerDeductionForExecution('exec-03d-a');

      expect(result).toEqual({ triggered: false, reason: 'status_timeout' });
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('does not charge cancelled executions', async () => {
      gatewayRepo.findOne.mockResolvedValue(
        completedRecord({ executionStatus: 'cancelled' }) as any,
      );

      const result = await serviceWithGateway.triggerDeductionForExecution('exec-03d-a');

      expect(result).toEqual({ triggered: false, reason: 'status_cancelled' });
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('charges legacy completed records that lack executionIntent (back-compat immediate path)', async () => {
      // Historical completed rows predate BUILDER-INTENT-01 and have no
      // aiExecutionResult.executionIntent. They were charged at completion.
      // Missing intent must NOT be reinterpreted as workspace_mutation.
      gatewayRepo.findOne.mockResolvedValue(
        completedRecord({
          metadata: {
            aiExecutionResult: {
              output: 'legacy',
              tokensUsed: 500,
              model: 'claude-3',
              fileActions: [],
            },
          },
        }) as any,
      );

      const result = await serviceWithGateway.triggerDeductionForExecution('exec-03d-a');

      expect(result).toEqual({ triggered: true, reason: 'completed' });
      expect(mockGateway.applyDeduction).toHaveBeenCalledTimes(1);
    });

    it('charges completed records with unknown executionIntent (safe default)', async () => {
      gatewayRepo.findOne.mockResolvedValue(
        completedRecord({
          metadata: {
            aiExecutionResult: {
              output: 'ok',
              tokensUsed: 500,
              model: 'grok-4-5',
              fileActions: [],
              executionIntent: 'unexpected_future_intent',
            },
          },
        }) as any,
      );

      const result = await serviceWithGateway.triggerDeductionForExecution('exec-03d-a');

      expect(result).toEqual({ triggered: true, reason: 'completed' });
      expect(mockGateway.applyDeduction).toHaveBeenCalledTimes(1);
    });

    it('charges completed records whose metadata is missing entirely (legacy)', async () => {
      gatewayRepo.findOne.mockResolvedValue(
        completedRecord({ metadata: {} }) as any,
      );

      const result = await serviceWithGateway.triggerDeductionForExecution('exec-03d-a');

      expect(result).toEqual({ triggered: true, reason: 'completed' });
      expect(mockGateway.applyDeduction).toHaveBeenCalledTimes(1);
    });

    it('charges a qualifying full-success Build apply confirmation', async () => {
      gatewayRepo.findOne.mockResolvedValue(completedRecord() as any);

      const result = await serviceWithGateway.triggerBuildApplyDeduction(
        'exec-03d-a',
        qualifyingConfirmation,
      );

      expect(result).toEqual({ triggered: true, reason: 'completed' });
      expect(mockGateway.applyDeduction).toHaveBeenCalledTimes(1);
      expect(mockGateway.applyDeduction.mock.calls[0][0].sourceEventId).toBe('exec-03d-a');
      expect(mockGateway.applyDeduction.mock.calls[0][0].ownerId).toBe('user-03d-a');
    });

    it('does not treat advisory workspaceMutationAttempted as accounting authority', async () => {
      gatewayRepo.findOne.mockResolvedValue(
        completedRecord({
          metadata: {
            aiExecutionResult: {
              output: 'ok',
              tokensUsed: 500,
              model: 'grok-4-5',
              fileActions: buildFileActions,
              executionIntent: 'workspace_mutation',
              workspaceMutationAttempted: false,
            },
          },
        }) as any,
      );

      const result = await serviceWithGateway.triggerBuildApplyDeduction(
        'exec-03d-a',
        qualifyingConfirmation,
      );

      expect(result.triggered).toBe(true);
      expect(mockGateway.applyDeduction).toHaveBeenCalledTimes(1);
    });

    it('does not charge confirm-apply for conversation intent', async () => {
      gatewayRepo.findOne.mockResolvedValue(
        completedRecord({
          metadata: {
            aiExecutionResult: {
              output: 'hello',
              tokensUsed: 500,
              model: 'grok-4-5',
              fileActions: buildFileActions,
              executionIntent: 'conversation',
            },
          },
        }) as any,
      );

      const result = await serviceWithGateway.triggerBuildApplyDeduction(
        'exec-03d-a',
        qualifyingConfirmation,
      );

      expect(result).toEqual({
        triggered: false,
        reason: 'intent_not_workspace_mutation',
      });
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('does not charge when persisted fileActions is empty', async () => {
      gatewayRepo.findOne.mockResolvedValue(
        completedRecord({
          metadata: {
            aiExecutionResult: {
              output: 'ok',
              tokensUsed: 500,
              model: 'grok-4-5',
              fileActions: [],
              executionIntent: 'workspace_mutation',
            },
          },
        }) as any,
      );

      const result = await serviceWithGateway.triggerBuildApplyDeduction(
        'exec-03d-a',
        { applyStatus: 'applied', totalActions: 1, successCount: 1 },
      );

      expect(result).toEqual({ triggered: false, reason: 'zero_file_actions' });
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('does not charge when aiExecutionResult is missing', async () => {
      gatewayRepo.findOne.mockResolvedValue(
        completedRecord({ metadata: {} }) as any,
      );

      const result = await serviceWithGateway.triggerBuildApplyDeduction(
        'exec-03d-a',
        qualifyingConfirmation,
      );

      expect(result).toEqual({
        triggered: false,
        reason: 'missing_ai_execution_result',
      });
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('does not charge when persisted fileActions is not an array', async () => {
      gatewayRepo.findOne.mockResolvedValue(
        completedRecord({
          metadata: {
            aiExecutionResult: {
              output: 'ok',
              fileActions: 'not-an-array',
              executionIntent: 'workspace_mutation',
            },
          },
        }) as any,
      );

      const result = await serviceWithGateway.triggerBuildApplyDeduction(
        'exec-03d-a',
        qualifyingConfirmation,
      );

      expect(result).toEqual({ triggered: false, reason: 'missing_file_actions' });
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('does not charge when reported totalActions mismatches persisted fileActions.length', async () => {
      gatewayRepo.findOne.mockResolvedValue(completedRecord() as any);

      const result = await serviceWithGateway.triggerBuildApplyDeduction(
        'exec-03d-a',
        { applyStatus: 'applied', totalActions: 1, successCount: 1 },
      );

      expect(result).toEqual({ triggered: false, reason: 'total_actions_mismatch' });
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('does not charge when successCount is less than totalActions', async () => {
      gatewayRepo.findOne.mockResolvedValue(completedRecord() as any);

      const result = await serviceWithGateway.triggerBuildApplyDeduction(
        'exec-03d-a',
        { applyStatus: 'applied', totalActions: 2, successCount: 1 },
      );

      expect(result).toEqual({ triggered: false, reason: 'partial_apply' });
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('does not charge skipped applyStatus', async () => {
      gatewayRepo.findOne.mockResolvedValue(completedRecord() as any);

      const result = await serviceWithGateway.triggerBuildApplyDeduction(
        'exec-03d-a',
        { applyStatus: 'skipped', totalActions: 2, successCount: 2 },
      );

      expect(result).toEqual({
        triggered: false,
        reason: 'apply_status_not_applied',
      });
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('does not charge failed applyStatus', async () => {
      gatewayRepo.findOne.mockResolvedValue(completedRecord() as any);

      const result = await serviceWithGateway.triggerBuildApplyDeduction(
        'exec-03d-a',
        { applyStatus: 'failed', totalActions: 2, successCount: 2 },
      );

      expect(result).toEqual({
        triggered: false,
        reason: 'apply_status_not_applied',
      });
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('does not charge confirm-apply for a non-completed execution', async () => {
      gatewayRepo.findOne.mockResolvedValue(
        completedRecord({ executionStatus: 'failed' }) as any,
      );

      const result = await serviceWithGateway.triggerBuildApplyDeduction(
        'exec-03d-a',
        qualifyingConfirmation,
      );

      expect(result).toEqual({ triggered: false, reason: 'status_failed' });
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('does not charge a structurally invalid confirmation object', async () => {
      gatewayRepo.findOne.mockResolvedValue(completedRecord() as any);

      const result = await serviceWithGateway.triggerBuildApplyDeduction(
        'exec-03d-a',
        { applyStatus: 'applied', totalActions: 1.5, successCount: 1 } as any,
      );

      expect(result).toEqual({ triggered: false, reason: 'confirmation_invalid' });
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('does not charge confirm-apply when the execution is missing', async () => {
      gatewayRepo.findOne.mockResolvedValue(null);

      const result = await serviceWithGateway.triggerBuildApplyDeduction(
        'exec-missing',
        qualifyingConfirmation,
      );

      expect(result).toEqual({ triggered: false, reason: 'record_not_found' });
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('does not mutate execution status when triggering a qualifying Build confirmation', async () => {
      const record = completedRecord();
      gatewayRepo.findOne.mockResolvedValue(record as any);

      await serviceWithGateway.triggerBuildApplyDeduction(
        'exec-03d-a',
        qualifyingConfirmation,
      );

      expect(record.executionStatus).toBe('completed');
      expect(gatewayRepo.save).not.toHaveBeenCalled();
      expect(gatewayRepo.update).not.toHaveBeenCalled();
    });

    it('sends duplicate qualifying confirmations through the same sourceEventId gateway path', async () => {
      gatewayRepo.findOne.mockResolvedValue(completedRecord() as any);

      const first = await serviceWithGateway.triggerBuildApplyDeduction(
        'exec-03d-a',
        qualifyingConfirmation,
      );
      const second = await serviceWithGateway.triggerBuildApplyDeduction(
        'exec-03d-a',
        qualifyingConfirmation,
      );

      expect(first.triggered).toBe(true);
      expect(second.triggered).toBe(true);
      expect(mockGateway.applyDeduction).toHaveBeenCalledTimes(2);
      expect(mockGateway.applyDeduction.mock.calls[0][0].sourceEventId).toBe('exec-03d-a');
      expect(mockGateway.applyDeduction.mock.calls[1][0].sourceEventId).toBe('exec-03d-a');
    });

    it('protects concurrent duplicate confirmations by reusing the existing gateway sourceEventId', async () => {
      gatewayRepo.findOne.mockResolvedValue(completedRecord() as any);

      const [first, second] = await Promise.all([
        serviceWithGateway.triggerBuildApplyDeduction('exec-03d-a', qualifyingConfirmation),
        serviceWithGateway.triggerBuildApplyDeduction('exec-03d-a', qualifyingConfirmation),
      ]);

      expect(first.triggered).toBe(true);
      expect(second.triggered).toBe(true);
      expect(mockGateway.applyDeduction).toHaveBeenCalledTimes(2);
      expect(mockGateway.applyDeduction.mock.calls[0][0].sourceEventId).toBe('exec-03d-a');
      expect(mockGateway.applyDeduction.mock.calls[1][0].sourceEventId).toBe('exec-03d-a');
    });

    it('does not add timeout, scheduled, or silence-based Build auto-charge', () => {
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(
        path.join(__dirname, '..', 'usage-ledger.service.ts'),
        'utf-8',
      );

      const buildMethodStart = source.indexOf('async triggerBuildApplyDeduction(');
      const helpersStart = source.indexOf('private readAiExecutionResult(');
      expect(buildMethodStart).toBeGreaterThan(-1);
      expect(helpersStart).toBeGreaterThan(buildMethodStart);
      const buildMethod = source.slice(buildMethodStart, helpersStart);

      expect(buildMethod).not.toMatch(/setTimeout/);
      expect(buildMethod).not.toMatch(/setInterval/);
      expect(buildMethod).not.toMatch(/reconcil/i);
      expect(buildMethod).not.toMatch(/refund/i);
      expect(source).not.toMatch(/charge after N minutes/i);
      expect(source).not.toMatch(/silence-based/i);
    });
  });

  describe('AGENT-PLATFORM-EXEC-01C5 conversation Harness accounting', () => {
    let serviceWithGateway: UsageLedgerService;
    let gatewayRepo: jest.Mocked<Repository<UsageRecord>>;
    let mockGateway: { applyDeduction: jest.Mock };

    const HARNESS_EXECUTION_ID = 'exec-01c5-harness';
    const CUMULATIVE_TOKENS_USED = 1250;
    const qualifyingConfirmation = {
      applyStatus: 'applied',
      totalActions: 2,
      successCount: 2,
    };
    const buildFileActions = [
      { action: 'write', path: 'src/a.ts', content: 'a' },
      { action: 'write', path: 'src/b.ts', content: 'b' },
    ];

    function conversationHarnessRecord(overrides: Record<string, unknown> = {}): UsageRecord {
      return {
        executionId: HARNESS_EXECUTION_ID,
        userId: 'user-01c5',
        apiKeyId: 'browser-session',
        sessionId: 'sess-01c5',
        model: 'claude-3',
        tokensUsed: CUMULATIVE_TOKENS_USED,
        executionDurationMs: 4000,
        executionStatus: 'completed',
        metadata: {
          aiExecutionResult: {
            output: 'harness answer',
            tokensUsed: CUMULATIVE_TOKENS_USED,
            model: 'claude-3',
            fileActions: [],
            executionIntent: 'conversation',
            harnessVersion: 'v1',
            toolCalls: [{ name: 'read_file' }, { name: 'search_workspace' }],
          },
        },
        ...overrides,
      } as unknown as UsageRecord;
    }

    function buildRecord(overrides: Record<string, unknown> = {}): UsageRecord {
      return {
        executionId: 'exec-01c5-build',
        userId: 'user-01c5-build',
        apiKeyId: 'key-01c5-build',
        sessionId: 'sess-01c5-build',
        model: 'grok-4-5',
        tokensUsed: 500,
        executionDurationMs: 2000,
        executionStatus: 'completed',
        metadata: {
          aiExecutionResult: {
            output: 'ok',
            tokensUsed: 500,
            model: 'grok-4-5',
            fileActions: buildFileActions,
            executionIntent: 'workspace_mutation',
          },
        },
        ...overrides,
      } as unknown as UsageRecord;
    }

    beforeEach(async () => {
      mockGateway = {
        applyDeduction: jest.fn().mockResolvedValue({
          source: 'usage_ledger',
          sourceEventId: HARNESS_EXECUTION_ID,
          ownerId: 'user-01c5',
          occurredAt: new Date(),
          totalCreditsRequested: 0,
          totalCreditsApplied: 0,
          totalCreditsOverflow: 0,
          lineItems: [],
        }),
      };

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

    it('charges a completed conversation Harness execution once with sourceEventId=executionId and cumulative tokensUsed', async () => {
      gatewayRepo.findOne.mockResolvedValue(conversationHarnessRecord());

      const result = await serviceWithGateway.triggerDeductionForExecution(
        HARNESS_EXECUTION_ID,
      );

      expect(result).toEqual({ triggered: true, reason: 'completed' });
      expect(mockGateway.applyDeduction).toHaveBeenCalledTimes(1);
      const event = mockGateway.applyDeduction.mock.calls[0][0];
      expect(event.sourceEventId).toBe(HARNESS_EXECUTION_ID);
      expect(event.lineItems).toHaveLength(1);
      expect(event.lineItems[0].unitCount).toBe(CUMULATIVE_TOKENS_USED);
      expect(event.lineItems[0].category).toBe('model_tokens');
    });

    it('does not create an extra charge per Harness tool call', async () => {
      gatewayRepo.findOne.mockResolvedValue(conversationHarnessRecord());

      await serviceWithGateway.triggerDeductionForExecution(HARNESS_EXECUTION_ID);

      expect(mockGateway.applyDeduction).toHaveBeenCalledTimes(1);
      expect(mockGateway.applyDeduction.mock.calls[0][0].lineItems).toHaveLength(1);
    });

    it('does not deduct for a failed conversation Harness execution', async () => {
      gatewayRepo.findOne.mockResolvedValue(
        conversationHarnessRecord({ executionStatus: 'failed' }),
      );

      const result = await serviceWithGateway.triggerDeductionForExecution(
        HARNESS_EXECUTION_ID,
      );

      expect(result).toEqual({ triggered: false, reason: 'status_failed' });
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('does not deduct for an unsupported-provider Harness failure', async () => {
      gatewayRepo.findOne.mockResolvedValue(
        conversationHarnessRecord({
          executionStatus: 'failed',
          metadata: {
            aiExecutionResult: {
              output: 'unsupported provider',
              tokensUsed: CUMULATIVE_TOKENS_USED,
              model: 'grok-4',
              fileActions: [],
              executionIntent: 'conversation',
              harnessVersion: 'v1',
              errorCode: 'unsupported_provider',
            },
          },
        }),
      );

      const result = await serviceWithGateway.triggerDeductionForExecution(
        HARNESS_EXECUTION_ID,
      );

      expect(result).toEqual({ triggered: false, reason: 'status_failed' });
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('does not deduct for a disabled-gate Harness failure', async () => {
      gatewayRepo.findOne.mockResolvedValue(
        conversationHarnessRecord({
          executionStatus: 'failed',
          metadata: {
            aiExecutionResult: {
              output: 'tool loop disabled',
              tokensUsed: 0,
              model: 'claude-3',
              fileActions: [],
              executionIntent: 'conversation',
              harnessVersion: 'v1',
              errorCode: 'disabled_gate',
            },
          },
        }),
      );

      const result = await serviceWithGateway.triggerDeductionForExecution(
        HARNESS_EXECUTION_ID,
      );

      expect(result).toEqual({ triggered: false, reason: 'status_failed' });
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('does not deduct for a max-iteration Harness failure', async () => {
      gatewayRepo.findOne.mockResolvedValue(
        conversationHarnessRecord({
          executionStatus: 'failed',
          metadata: {
            aiExecutionResult: {
              output: 'max iterations',
              tokensUsed: CUMULATIVE_TOKENS_USED,
              model: 'claude-3',
              fileActions: [],
              executionIntent: 'conversation',
              harnessVersion: 'v1',
              errorCode: 'max_iterations',
            },
          },
        }),
      );

      const result = await serviceWithGateway.triggerDeductionForExecution(
        HARNESS_EXECUTION_ID,
      );

      expect(result).toEqual({ triggered: false, reason: 'status_failed' });
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('does not deduct for a cancelled conversation Harness execution', async () => {
      gatewayRepo.findOne.mockResolvedValue(
        conversationHarnessRecord({ executionStatus: 'cancelled' }),
      );

      const result = await serviceWithGateway.triggerDeductionForExecution(
        HARNESS_EXECUTION_ID,
      );

      expect(result).toEqual({ triggered: false, reason: 'status_cancelled' });
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('does not deduct for a timed-out conversation Harness execution', async () => {
      gatewayRepo.findOne.mockResolvedValue(
        conversationHarnessRecord({ executionStatus: 'timeout' }),
      );

      const result = await serviceWithGateway.triggerDeductionForExecution(
        HARNESS_EXECUTION_ID,
      );

      expect(result).toEqual({ triggered: false, reason: 'status_timeout' });
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();
    });

    it('keeps retry/idempotent reuse under the same execution identity from double-charging at the deduction boundary', async () => {
      gatewayRepo.findOne.mockResolvedValue(conversationHarnessRecord());

      await serviceWithGateway.triggerDeductionForExecution(HARNESS_EXECUTION_ID);
      await serviceWithGateway.triggerDeductionForExecution(HARNESS_EXECUTION_ID);

      expect(mockGateway.applyDeduction).toHaveBeenCalledTimes(2);
      expect(mockGateway.applyDeduction.mock.calls[0][0].sourceEventId).toBe(
        HARNESS_EXECUTION_ID,
      );
      expect(mockGateway.applyDeduction.mock.calls[1][0].sourceEventId).toBe(
        HARNESS_EXECUTION_ID,
      );
    });

    it('leaves Build/workspace-mutation apply accounting unchanged', async () => {
      gatewayRepo.findOne.mockResolvedValue(buildRecord());

      const completion = await serviceWithGateway.triggerDeductionForExecution(
        'exec-01c5-build',
      );
      expect(completion).toEqual({
        triggered: false,
        reason: 'build_awaiting_apply',
      });
      expect(mockGateway.applyDeduction).not.toHaveBeenCalled();

      const apply = await serviceWithGateway.triggerBuildApplyDeduction(
        'exec-01c5-build',
        qualifyingConfirmation,
      );
      expect(apply).toEqual({ triggered: true, reason: 'completed' });
      expect(mockGateway.applyDeduction).toHaveBeenCalledTimes(1);
      expect(mockGateway.applyDeduction.mock.calls[0][0].sourceEventId).toBe(
        'exec-01c5-build',
      );
    });
  });
});
