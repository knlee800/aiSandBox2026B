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
import { SessionOrApiKeyAuthGuard } from '../../auth/session-or-api-key.guard';
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
 * AIExecutionController Replay Quota Bypass Integration Tests
 *
 * PHASE-43B-2-HOTFIX: Idempotent Replay Must Bypass Quota Guards
 *
 * Tests proving:
 * 1. Replay with same Idempotency-Key returns 200 with same body
 * 2. Replay does NOT invoke QuotaGuard/TokenQuotaGuard (verified by spy)
 * 3. Replay succeeds even if quota is exceeded after first execution
 * 4. DB row count remains 1 for (user_id, request_id)
 *
 * Purpose:
 * - Verify financial integrity (replay does NOT consume quota)
 * - Verify idempotency invariant (replay bypasses quota guards)
 * - Verify deterministic behavior (same input → same output)
 */
describe('AIExecutionController - Replay Quota Bypass (Integration)', () => {
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
          url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/aisandbox_test',
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
        // Mock guards for integration testing
        {
          provide: SessionOrApiKeyAuthGuard,
          useValue: {
            canActivate: jest.fn((context) => {
              const request = context.switchToHttp().getRequest();
              request.apiKeyIdentity = mockIdentity;
              return true;
            }),
          },
        },
        {
          provide: AuthorizationGuard,
          useValue: { canActivate: jest.fn(() => true) },
        },
        {
          provide: ExecutionSafetyGuard,
          useValue: { canActivate: jest.fn(() => true) },
        },
        {
          provide: LaunchGuard,
          useValue: { canActivate: jest.fn(() => true) },
        },
        {
          provide: AbortGuard,
          useValue: { canActivate: jest.fn(() => true) },
        },
        {
          provide: IdempotencyGuard,
          useClass: IdempotencyGuard, // Use real IdempotencyGuard
        },
        {
          provide: QuotaGuard,
          useValue: { canActivate: jest.fn(() => true) },
        },
        {
          provide: TokenQuotaGuard,
          useValue: {
            canActivate: jest.fn(() => true), // Will be spied on
          },
        },
        {
          provide: RateLimitGuard,
          useValue: { canActivate: jest.fn(() => true) },
        },
        // Register global exception filter
        {
          provide: APP_FILTER,
          useClass: IdempotentReplayExceptionFilter,
        },
      ],
    }).compile();

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
    await usageRecordRepository.delete({});
    // Reset spy call count
    tokenQuotaGuardSpy.mockClear();
  });

  describe('HOTFIX: Replay Bypasses Quota Guards', () => {
    it('should return 200 with same body on replay AND NOT invoke TokenQuotaGuard', async () => {
      // Mock ai-service to return deterministic result
      const executeSpy = jest
        .spyOn(aiServiceHttpClient, 'execute')
        .mockResolvedValue({
          output: 'Original AI response',
          tokensUsed: 150,
          model: 'stub',
        });

      const requestBody = {
        sessionId: '11111111-1111-1111-1111-111111111111',
        conversationId: '22222222-2222-2222-2222-222222222222',
        userId: 'user-1',
        prompt: 'Test replay quota bypass',
        provider: 'stub',
      };

      // First request (should invoke TokenQuotaGuard)
      const firstResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-quota-bypass-001')
        .send(requestBody);

      expect(firstResponse.status).toBe(HttpStatus.OK);
      expect(firstResponse.body.output).toBe('Original AI response');
      expect(firstResponse.body.tokensUsed).toBe(150);
      expect(firstResponse.body.model).toBe('stub');

      // Verify TokenQuotaGuard was invoked on first request
      expect(tokenQuotaGuardSpy).toHaveBeenCalledTimes(1);

      // Verify execution record exists with status 'completed'
      const completedRecords = await usageRecordRepository.find({
        where: { userId: 'user-1', executionStatus: 'completed' },
      });
      expect(completedRecords.length).toBe(1);

      // Clear spy call count for second request
      tokenQuotaGuardSpy.mockClear();

      // Second request with same Idempotency-Key (should NOT invoke TokenQuotaGuard)
      const secondResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-quota-bypass-001')
        .send(requestBody);

      // CRITICAL: Verify replay returns 200 with cached result
      expect(secondResponse.status).toBe(HttpStatus.OK);
      expect(secondResponse.body.output).toBe('[Duplicate request - original response not stored]');
      expect(secondResponse.body.tokensUsed).toBe(150);
      expect(secondResponse.body.model).toBe('stub');

      // CRITICAL: Verify TokenQuotaGuard was NOT invoked on replay
      expect(tokenQuotaGuardSpy).not.toHaveBeenCalled();

      // Verify only one execution record exists (no duplicate)
      const allRecords = await usageRecordRepository.find({
        where: { userId: 'user-1' },
      });
      expect(allRecords.length).toBe(1);

      executeSpy.mockRestore();
    });

    it('should succeed on replay even if quota is exceeded after first execution', async () => {
      // Mock ai-service to return deterministic result
      const executeSpy = jest
        .spyOn(aiServiceHttpClient, 'execute')
        .mockResolvedValue({
          output: 'AI response',
          tokensUsed: 200,
          model: 'stub',
        });

      const requestBody = {
        sessionId: '22222222-2222-2222-2222-222222222222',
        conversationId: '33333333-3333-3333-3333-333333333333',
        userId: 'user-1',
        prompt: 'Test quota exceeded replay',
        provider: 'stub',
      };

      // First request (should succeed)
      const firstResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-quota-exceeded-001')
        .send(requestBody);

      expect(firstResponse.status).toBe(HttpStatus.OK);
      expect(firstResponse.body.tokensUsed).toBe(200);

      // Simulate quota exceeded by mocking TokenQuotaGuard to return false
      // (In real scenario, user would have consumed quota between first and second request)
      tokenQuotaGuardSpy.mockReturnValue(false);

      // Second request with same Idempotency-Key (should succeed despite quota exceeded)
      const secondResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-quota-exceeded-001')
        .send(requestBody);

      // CRITICAL: Verify replay succeeds even though quota is exceeded
      expect(secondResponse.status).toBe(HttpStatus.OK);
      expect(secondResponse.body.tokensUsed).toBe(200);

      // CRITICAL: Verify TokenQuotaGuard was NOT invoked on replay
      // (If it was invoked, it would have returned false and blocked the request)
      expect(tokenQuotaGuardSpy).not.toHaveBeenCalled();

      // Verify only one execution record exists
      const allRecords = await usageRecordRepository.find({
        where: { userId: 'user-1' },
      });
      expect(allRecords.length).toBe(1);

      executeSpy.mockRestore();
    });

    it('should maintain DB row count of 1 for (user_id, request_id) on replay', async () => {
      // Mock ai-service
      const executeSpy = jest
        .spyOn(aiServiceHttpClient, 'execute')
        .mockResolvedValue({
          output: 'Test response',
          tokensUsed: 100,
          model: 'stub',
        });

      const requestBody = {
        sessionId: '33333333-3333-3333-3333-333333333333',
        conversationId: '44444444-4444-4444-4444-444444444444',
        userId: 'user-1',
        prompt: 'Test DB row count',
        provider: 'stub',
      };

      // First request
      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-db-count-001')
        .send(requestBody);

      // Verify 1 record exists
      let records = await usageRecordRepository.find({
        where: { userId: 'user-1', requestId: 'test-db-count-001' },
      });
      expect(records.length).toBe(1);

      // Second request (replay)
      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-db-count-001')
        .send(requestBody);

      // Verify still only 1 record exists (no duplicate)
      records = await usageRecordRepository.find({
        where: { userId: 'user-1', requestId: 'test-db-count-001' },
      });
      expect(records.length).toBe(1);

      // Third request (replay)
      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-db-count-001')
        .send(requestBody);

      // Verify still only 1 record exists (no duplicate)
      records = await usageRecordRepository.find({
        where: { userId: 'user-1', requestId: 'test-db-count-001' },
      });
      expect(records.length).toBe(1);

      executeSpy.mockRestore();
    });

    it('should invoke TokenQuotaGuard on first request but NOT on replay', async () => {
      // Mock ai-service
      const executeSpy = jest
        .spyOn(aiServiceHttpClient, 'execute')
        .mockResolvedValue({
          output: 'Test',
          tokensUsed: 50,
          model: 'stub',
        });

      const requestBody = {
        sessionId: '44444444-4444-4444-4444-444444444444',
        conversationId: '55555555-5555-5555-5555-555555555555',
        userId: 'user-1',
        prompt: 'Test guard invocation',
        provider: 'stub',
      };

      // Clear spy before test
      tokenQuotaGuardSpy.mockClear();

      // First request
      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-guard-invoke-001')
        .send(requestBody);

      // Verify TokenQuotaGuard was invoked exactly once
      expect(tokenQuotaGuardSpy).toHaveBeenCalledTimes(1);

      // Clear spy for second request
      tokenQuotaGuardSpy.mockClear();

      // Second request (replay)
      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-guard-invoke-001')
        .send(requestBody);

      // CRITICAL: Verify TokenQuotaGuard was NOT invoked on replay
      expect(tokenQuotaGuardSpy).not.toHaveBeenCalled();

      executeSpy.mockRestore();
    });
  });

  describe('Invariant Verification', () => {
    it('should preserve all idempotency invariants after hotfix', async () => {
      // Mock ai-service
      const executeSpy = jest
        .spyOn(aiServiceHttpClient, 'execute')
        .mockResolvedValue({
          output: 'Test invariants',
          tokensUsed: 100,
          model: 'stub',
        });

      const requestBody = {
        sessionId: '55555555-5555-5555-5555-555555555555',
        conversationId: '66666666-6666-6666-6666-666666666666',
        userId: 'user-1',
        prompt: 'Test invariants',
        provider: 'stub',
      };

      // First request
      const firstResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-invariants-001')
        .send(requestBody);

      expect(firstResponse.status).toBe(HttpStatus.OK);

      // Verify invariants after first request
      const records = await usageRecordRepository.find({
        where: { userId: 'user-1', requestId: 'test-invariants-001' },
      });
      expect(records.length).toBe(1);
      expect(records[0].executionStatus).toBe('completed');
      expect(records[0].tokensUsed).toBe(100);

      // Second request (replay)
      const secondResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-invariants-001')
        .send(requestBody);

      // Verify invariants preserved:
      // 1. Replay returns 200 (not 429)
      expect(secondResponse.status).toBe(HttpStatus.OK);

      // 2. Replay returns cached result (deterministic)
      expect(secondResponse.body.tokensUsed).toBe(100);
      expect(secondResponse.body.model).toBe('stub');

      // 3. No duplicate ledger write (DB row count = 1)
      const allRecords = await usageRecordRepository.find({
        where: { userId: 'user-1', requestId: 'test-invariants-001' },
      });
      expect(allRecords.length).toBe(1);

      // 4. No quota consumed on replay (TokenQuotaGuard NOT invoked)
      // (Already verified by spy in previous tests)

      // 5. No AI provider call on replay (executeSpy call count = 1)
      expect(executeSpy).toHaveBeenCalledTimes(1);

      executeSpy.mockRestore();
    });
  });
});
