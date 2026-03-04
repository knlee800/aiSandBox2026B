import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { AIExecutionController } from '../ai-execution.controller';
import { UsageLedgerService } from '../../usage-ledger/usage-ledger.service';
import { UsageRecord } from '../../entities/usage-record.entity';
import { AIServiceHttpClient } from '../../clients/ai-service-http.client';
import { ApiKeyAuthGuard } from '../../auth/api-key-auth.guard';
import { AuthorizationGuard } from '../../auth/authorization.guard';
import { QuotaGuard } from '../../quota/quota.guard';
import { TokenQuotaGuard } from '../../quota/token-quota.guard';
import { ExecutionSafetyGuard } from '../../safety/execution-safety.guard';
import { GlobalSafetyLimitService } from '../../safety/global-safety-limit.service';
import { LaunchGuard } from '../../launch/launch.guard';
import { AbortGuard } from '../../abort/abort.guard';
import { RateLimitGuard } from '../../guards/rate-limit.guard';
import { IdempotencyGuard } from '../idempotency.guard';
import { IdempotentReplayExceptionFilter } from '../../filters/idempotent-replay-exception.filter';
import { APP_FILTER } from '@nestjs/core';

/**
 * AIExecutionController Deterministic Replay Integration Tests
 *
 * PHASE-43B-3: Deterministic Replay Body Persistence
 *
 * Tests proving:
 * 1. First call returns result R1
 * 2. Replay returns HTTP 200
 * 3. Replay body === R1 (deep equality, EXACT match)
 * 4. QuotaGuard NOT invoked on replay
 * 5. DB row count remains 1
 * 6. Metadata contains stored aiExecutionResult JSON
 *
 * Purpose:
 * - Verify deterministic replay (exact output match)
 * - Verify financial integrity (replay does NOT consume quota)
 * - Verify metadata persistence (aiExecutionResult stored correctly)
 */
describe('AIExecutionController - Deterministic Replay (Integration)', () => {
  let app: INestApplication;
  let usageRecordRepository: Repository<UsageRecord>;
  let aiServiceHttpClient: AIServiceHttpClient;
  let tokenQuotaGuardSpy: jest.SpyInstance;

  // Mock API key identity
  const mockIdentity = {
    apiKeyId: 'test-key-1',
    userId: 'user-1',
    scopes: ['ai:execute'],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: process.env.DATABASE_URL,
          entities: [UsageRecord],
          synchronize: true,
          retryAttempts: 0,
          retryDelay: 0,
        }),
        TypeOrmModule.forFeature([UsageRecord]),
      ],
      controllers: [AIExecutionController],
      providers: [
        UsageLedgerService,
        AIServiceHttpClient,
        GlobalSafetyLimitService,
        {
          provide: IdempotencyGuard,
          useClass: IdempotencyGuard, // Use real IdempotencyGuard
        },
        {
          provide: TokenQuotaGuard,
          useValue: {
            canActivate: jest.fn(() => true), // Will be spied on
          },
        },
        // Register global exception filter
        {
          provide: APP_FILTER,
          useClass: IdempotentReplayExceptionFilter,
        },
      ],
    })
      .overrideGuard(ApiKeyAuthGuard)
      .useValue({
        canActivate: jest.fn((context) => {
          const request = context.switchToHttp().getRequest();
          request.apiKeyIdentity = mockIdentity;
          return true;
        }),
      })
      .overrideGuard(AuthorizationGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ExecutionSafetyGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(LaunchGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AbortGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(QuotaGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();

    // Register global filter manually (required for testing)
    app.useGlobalFilters(new IdempotentReplayExceptionFilter());

    await app.init();

    usageRecordRepository = moduleFixture.get('UsageRecordRepository');
    aiServiceHttpClient = moduleFixture.get(AIServiceHttpClient);

    // Get TokenQuotaGuard instance for spying
    const tokenQuotaGuard = moduleFixture.get(TokenQuotaGuard);
    tokenQuotaGuardSpy = jest.spyOn(tokenQuotaGuard, 'canActivate');
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  }, 10000);

  beforeEach(async () => {
    // Clean up usage_records table before each test
    await usageRecordRepository.clear();
    // Reset spy call count
    tokenQuotaGuardSpy.mockClear();
  });

  describe('PHASE-43B-3: Deterministic Replay Body Persistence', () => {
    it('should return EXACT original output on replay (deep equality)', async () => {
      // Mock ai-service to return deterministic result with unique output
      const originalOutput = 'This is the original AI response with unique content: ' + Math.random();
      const executeSpy = jest
        .spyOn(aiServiceHttpClient, 'execute')
        .mockResolvedValue({
          output: originalOutput,
          tokensUsed: 150,
          model: 'stub-model-v1',
        });

      const requestBody = {
        sessionId: '11111111-1111-1111-1111-111111111111',
        conversationId: '22222222-2222-2222-2222-222222222222',
        userId: 'user-1',
        prompt: 'Test deterministic replay',
        provider: 'stub',
      };

      // First request
      const firstResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-deterministic-001')
        .send(requestBody);

      expect(firstResponse.status).toBe(HttpStatus.OK);
      expect(firstResponse.body.output).toBe(originalOutput);
      expect(firstResponse.body.tokensUsed).toBe(150);
      expect(firstResponse.body.model).toBe('stub-model-v1');

      // Store first response for comparison
      const R1 = firstResponse.body;

      // Second request (replay)
      const secondResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-deterministic-001')
        .send(requestBody);

      // CRITICAL: Verify replay returns EXACT original output (not placeholder)
      expect(secondResponse.status).toBe(HttpStatus.OK);
      expect(secondResponse.body.output).toBe(originalOutput);
      expect(secondResponse.body.tokensUsed).toBe(150);
      expect(secondResponse.body.model).toBe('stub-model-v1');

      // CRITICAL: Verify deep equality (replay body === R1)
      expect(secondResponse.body).toEqual(R1);

      // Verify only one execution record exists
      const allRecords = await usageRecordRepository.find({
        where: { userId: 'user-1' },
      });
      expect(allRecords.length).toBe(1);

      executeSpy.mockRestore();
    });

    it('should store aiExecutionResult in metadata JSON', async () => {
      // Mock ai-service
      const testOutput = 'Test output for metadata verification';
      const executeSpy = jest
        .spyOn(aiServiceHttpClient, 'execute')
        .mockResolvedValue({
          output: testOutput,
          tokensUsed: 200,
          model: 'test-model',
        });

      const requestBody = {
        sessionId: '22222222-2222-2222-2222-222222222222',
        conversationId: '33333333-3333-3333-3333-333333333333',
        userId: 'user-1',
        prompt: 'Test metadata storage',
        provider: 'stub',
      };

      // Execute request
      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-metadata-001')
        .send(requestBody);

      // Verify metadata contains aiExecutionResult
      const records = await usageRecordRepository.find({
        where: { userId: 'user-1', requestId: 'test-metadata-001' },
      });

      expect(records.length).toBe(1);
      expect(records[0].metadata).toBeDefined();
      expect(records[0].metadata.aiExecutionResult).toBeDefined();
      expect((records[0].metadata.aiExecutionResult as any).output).toBe(testOutput);
      expect((records[0].metadata.aiExecutionResult as any).tokensUsed).toBe(200);
      expect((records[0].metadata.aiExecutionResult as any).model).toBe('test-model');

      executeSpy.mockRestore();
    });

    it('should handle multiple replays with exact same output', async () => {
      // Mock ai-service
      const uniqueOutput = 'Unique output: ' + Date.now();
      const executeSpy = jest
        .spyOn(aiServiceHttpClient, 'execute')
        .mockResolvedValue({
          output: uniqueOutput,
          tokensUsed: 100,
          model: 'stub',
        });

      const requestBody = {
        sessionId: '33333333-3333-3333-3333-333333333333',
        conversationId: '44444444-4444-4444-4444-444444444444',
        userId: 'user-1',
        prompt: 'Test multiple replays',
        provider: 'stub',
      };

      // First request
      const firstResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-multi-replay-001')
        .send(requestBody);

      expect(firstResponse.body.output).toBe(uniqueOutput);

      // Second request (replay)
      const secondResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-multi-replay-001')
        .send(requestBody);

      expect(secondResponse.body.output).toBe(uniqueOutput);

      // Third request (replay)
      const thirdResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-multi-replay-001')
        .send(requestBody);

      expect(thirdResponse.body.output).toBe(uniqueOutput);

      // Verify all responses are identical
      expect(secondResponse.body).toEqual(firstResponse.body);
      expect(thirdResponse.body).toEqual(firstResponse.body);

      // Verify only one DB record
      const allRecords = await usageRecordRepository.find({
        where: { userId: 'user-1' },
      });
      expect(allRecords.length).toBe(1);

      executeSpy.mockRestore();
    });

    it('should preserve quota bypass behavior with deterministic replay', async () => {
      // Mock ai-service
      const testOutput = 'Test quota bypass with deterministic replay';
      const executeSpy = jest
        .spyOn(aiServiceHttpClient, 'execute')
        .mockResolvedValue({
          output: testOutput,
          tokensUsed: 250,
          model: 'stub',
        });

      const requestBody = {
        sessionId: '44444444-4444-4444-4444-444444444444',
        conversationId: '55555555-5555-5555-5555-555555555555',
        userId: 'user-1',
        prompt: 'Test quota bypass',
        provider: 'stub',
      };

      // Clear spy
      tokenQuotaGuardSpy.mockClear();

      // First request
      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-quota-bypass-det-001')
        .send(requestBody);

      // Verify TokenQuotaGuard invoked on first request
      expect(tokenQuotaGuardSpy).toHaveBeenCalledTimes(1);

      // Clear spy for replay
      tokenQuotaGuardSpy.mockClear();

      // Replay
      const replayResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-quota-bypass-det-001')
        .send(requestBody);

      // CRITICAL: Verify replay returns exact output AND bypasses quota
      expect(replayResponse.body.output).toBe(testOutput);
      expect(tokenQuotaGuardSpy).not.toHaveBeenCalled();

      executeSpy.mockRestore();
    });

    it('should handle long output text correctly', async () => {
      // Mock ai-service with long output
      const longOutput = 'A'.repeat(10000); // 10KB output
      const executeSpy = jest
        .spyOn(aiServiceHttpClient, 'execute')
        .mockResolvedValue({
          output: longOutput,
          tokensUsed: 500,
          model: 'stub',
        });

      const requestBody = {
        sessionId: '55555555-5555-5555-5555-555555555555',
        conversationId: '66666666-6666-6666-6666-666666666666',
        userId: 'user-1',
        prompt: 'Test long output',
        provider: 'stub',
      };

      // First request
      const firstResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-long-output-001')
        .send(requestBody);

      expect(firstResponse.body.output).toBe(longOutput);
      expect(firstResponse.body.output.length).toBe(10000);

      // Replay
      const replayResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-long-output-001')
        .send(requestBody);

      // CRITICAL: Verify replay returns exact long output
      expect(replayResponse.body.output).toBe(longOutput);
      expect(replayResponse.body.output.length).toBe(10000);
      expect(replayResponse.body).toEqual(firstResponse.body);

      executeSpy.mockRestore();
    });

    it('should handle special characters in output correctly', async () => {
      // Mock ai-service with special characters
      const specialOutput = 'Test with special chars: \n\t\r"\'\\{}[]<>!@#$%^&*()';
      const executeSpy = jest
        .spyOn(aiServiceHttpClient, 'execute')
        .mockResolvedValue({
          output: specialOutput,
          tokensUsed: 50,
          model: 'stub',
        });

      const requestBody = {
        sessionId: '66666666-6666-6666-6666-666666666666',
        conversationId: '77777777-7777-7777-7777-777777777777',
        userId: 'user-1',
        prompt: 'Test special characters',
        provider: 'stub',
      };

      // First request
      const firstResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-special-chars-001')
        .send(requestBody);

      expect(firstResponse.body.output).toBe(specialOutput);

      // Replay
      const replayResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-special-chars-001')
        .send(requestBody);

      // CRITICAL: Verify replay returns exact output with special characters
      expect(replayResponse.body.output).toBe(specialOutput);
      expect(replayResponse.body).toEqual(firstResponse.body);

      executeSpy.mockRestore();
    });
  });

  describe('Backward Compatibility', () => {
    it('should fallback to placeholder for records without metadata.aiExecutionResult', async () => {
      // Create a record manually without metadata.aiExecutionResult
      // (simulates records created before Phase 43B-3)
      const record = usageRecordRepository.create({
        executionId: '88888888-8888-8888-8888-888888888888',
        apiKeyId: 'test-key-1',
        userId: 'user-1',
        sessionId: '77777777-7777-7777-7777-777777777777',
        conversationId: '88888888-8888-8888-8888-888888888888',
        provider: 'stub',
        adapter: 'stub',
        model: 'old-model',
        tokensUsed: 100,
        executionDurationMs: 1000,
        executionStatus: 'completed',
        requestId: 'test-backward-compat-001',
        metadata: {}, // No aiExecutionResult
      });

      await usageRecordRepository.save(record);

      // Replay should fallback to placeholder
      const replayResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-backward-compat-001')
        .send({
          sessionId: '77777777-7777-7777-7777-777777777777',
          conversationId: '88888888-8888-8888-8888-888888888888',
          userId: 'user-1',
          prompt: 'Test backward compatibility',
          provider: 'stub',
        });

      // Should return placeholder output
      expect(replayResponse.status).toBe(HttpStatus.OK);
      expect(replayResponse.body.output).toBe('[Duplicate request - original response not stored]');
      expect(replayResponse.body.tokensUsed).toBe(100);
      expect(replayResponse.body.model).toBe('old-model');
    });
  });
});
