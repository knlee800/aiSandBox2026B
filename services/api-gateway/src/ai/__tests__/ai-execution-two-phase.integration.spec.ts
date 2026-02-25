import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as request from 'supertest';
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

/**
 * AIExecutionController Two-Phase Execution Integration Tests
 *
 * Phase 43B-2D: Verification tests for two-phase execution record
 *
 * Tests:
 * 1. Execution intent is written BEFORE ai-service call (status: 'pending')
 * 2. Execution result is updated AFTER ai-service success (status: 'completed')
 * 3. IdempotencyGuard handles 'pending' status (returns 409 Conflict)
 * 4. IdempotencyGuard handles 'completed' status (returns cached result)
 * 5. Failed AI execution leaves 'pending' record (for cleanup)
 *
 * Purpose:
 * - Verify financial integrity (no lost revenue)
 * - Verify idempotency behavior with two-phase writes
 * - Verify deterministic failure modes
 */
describe('AIExecutionController - Two-Phase Execution (Integration)', () => {
  let app: INestApplication;
  let usageRecordRepository: Repository<UsageRecord>;
  let aiServiceHttpClient: AIServiceHttpClient;

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
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          username: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_NAME || 'aisandbox_test',
          entities: [UsageRecord],
          synchronize: true, // Test environment only
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
          provide: ApiKeyAuthGuard,
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
          useValue: { canActivate: jest.fn(() => true) },
        },
        {
          provide: RateLimitGuard,
          useValue: { canActivate: jest.fn(() => true) },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    usageRecordRepository = moduleFixture.get('UsageRecordRepository');
    aiServiceHttpClient = moduleFixture.get(AIServiceHttpClient);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up usage_records table before each test
    await usageRecordRepository.delete({});
  });

  describe('Two-Phase Execution Record', () => {
    it('should write execution intent BEFORE ai-service call (status: pending)', async () => {
      // Mock ai-service to delay response (simulate slow AI provider)
      const executeSpy = jest
        .spyOn(aiServiceHttpClient, 'execute')
        .mockImplementation(async () => {
          // Simulate 1 second delay
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return {
            output: 'Test response',
            tokensUsed: 100,
            model: 'stub',
          };
        });

      // Start execution (don't await yet)
      const responsePromise = request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-two-phase-001')
        .send({
          sessionId: '11111111-1111-1111-1111-111111111111',
          conversationId: '22222222-2222-2222-2222-222222222222',
          userId: 'user-1',
          prompt: 'Test prompt',
          provider: 'stub',
        });

      // Wait 100ms for execution intent to be written
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify execution intent exists with status 'pending'
      const pendingRecords = await usageRecordRepository.find({
        where: { userId: 'user-1', executionStatus: 'pending' },
      });

      expect(pendingRecords.length).toBe(1);
      expect(pendingRecords[0].executionStatus).toBe('pending');
      expect(pendingRecords[0].model).toBeNull();
      expect(pendingRecords[0].tokensUsed).toBeNull();
      expect(pendingRecords[0].executionDurationMs).toBeNull();

      // Wait for execution to complete
      const response = await responsePromise;

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.output).toBe('Test response');

      // Verify execution result is updated with status 'completed'
      const completedRecords = await usageRecordRepository.find({
        where: { userId: 'user-1', executionStatus: 'completed' },
      });

      expect(completedRecords.length).toBe(1);
      expect(completedRecords[0].executionStatus).toBe('completed');
      expect(completedRecords[0].model).toBe('stub');
      expect(completedRecords[0].tokensUsed).toBe(100);
      expect(completedRecords[0].executionDurationMs).toBeGreaterThan(0);

      executeSpy.mockRestore();
    });

    it('should return 409 Conflict when retrying with same Idempotency-Key while execution is pending', async () => {
      // Mock ai-service to delay response (simulate slow AI provider)
      const executeSpy = jest
        .spyOn(aiServiceHttpClient, 'execute')
        .mockImplementation(async () => {
          // Simulate 2 second delay
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return {
            output: 'Test response',
            tokensUsed: 100,
            model: 'stub',
          };
        });

      // Start first execution (don't await yet)
      const firstRequest = request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-conflict-001')
        .send({
          sessionId: '11111111-1111-1111-1111-111111111111',
          conversationId: '22222222-2222-2222-2222-222222222222',
          userId: 'user-1',
          prompt: 'Test prompt',
          provider: 'stub',
        });

      // Wait 100ms for execution intent to be written
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send second request with same Idempotency-Key (should return 409)
      const secondResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-conflict-001')
        .send({
          sessionId: '11111111-1111-1111-1111-111111111111',
          conversationId: '22222222-2222-2222-2222-222222222222',
          userId: 'user-1',
          prompt: 'Test prompt',
          provider: 'stub',
        });

      expect(secondResponse.status).toBe(HttpStatus.CONFLICT);
      expect(secondResponse.body.message).toBe('Execution in progress');
      expect(secondResponse.body.details.status).toBe('pending');

      // Wait for first request to complete
      const firstResponse = await firstRequest;
      expect(firstResponse.status).toBe(HttpStatus.OK);

      executeSpy.mockRestore();
    });

    it('should return cached result when retrying with same Idempotency-Key after execution completes', async () => {
      // Mock ai-service
      const executeSpy = jest
        .spyOn(aiServiceHttpClient, 'execute')
        .mockResolvedValue({
          output: 'Original response',
          tokensUsed: 100,
          model: 'stub',
        });

      // First request
      const firstResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-replay-001')
        .send({
          sessionId: '11111111-1111-1111-1111-111111111111',
          conversationId: '22222222-2222-2222-2222-222222222222',
          userId: 'user-1',
          prompt: 'Test prompt',
          provider: 'stub',
        });

      expect(firstResponse.status).toBe(HttpStatus.OK);
      expect(firstResponse.body.output).toBe('Original response');

      // Verify execution is completed
      const completedRecords = await usageRecordRepository.find({
        where: { userId: 'user-1', executionStatus: 'completed' },
      });
      expect(completedRecords.length).toBe(1);

      // Second request with same Idempotency-Key (should return cached result)
      const secondResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-replay-001')
        .send({
          sessionId: '11111111-1111-1111-1111-111111111111',
          conversationId: '22222222-2222-2222-2222-222222222222',
          userId: 'user-1',
          prompt: 'Test prompt',
          provider: 'stub',
        });

      expect(secondResponse.status).toBe(HttpStatus.OK);
      expect(secondResponse.body.output).toBe('[Duplicate request - original response not stored]');
      expect(secondResponse.body.tokensUsed).toBe(100);
      expect(secondResponse.body.model).toBe('stub');

      // Verify only one execution record exists (no duplicate)
      const allRecords = await usageRecordRepository.find({
        where: { userId: 'user-1' },
      });
      expect(allRecords.length).toBe(1);

      executeSpy.mockRestore();
    });

    it('should leave pending record when AI execution fails', async () => {
      // Mock ai-service to throw error
      const executeSpy = jest
        .spyOn(aiServiceHttpClient, 'execute')
        .mockRejectedValue(new Error('AI provider error'));

      // Execute request (should fail)
      const response = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-failure-001')
        .send({
          sessionId: '11111111-1111-1111-1111-111111111111',
          conversationId: '22222222-2222-2222-2222-222222222222',
          userId: 'user-1',
          prompt: 'Test prompt',
          provider: 'stub',
        });

      expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);

      // Verify execution intent remains 'pending' (not updated to 'completed')
      const pendingRecords = await usageRecordRepository.find({
        where: { userId: 'user-1', executionStatus: 'pending' },
      });

      expect(pendingRecords.length).toBe(1);
      expect(pendingRecords[0].executionStatus).toBe('pending');
      expect(pendingRecords[0].model).toBeNull();
      expect(pendingRecords[0].tokensUsed).toBeNull();

      // Verify no completed records exist
      const completedRecords = await usageRecordRepository.find({
        where: { userId: 'user-1', executionStatus: 'completed' },
      });
      expect(completedRecords.length).toBe(0);

      executeSpy.mockRestore();
    });
  });

  describe('Financial Integrity', () => {
    it('should guarantee execution visibility even if network fails after AI success', async () => {
      // This test simulates the CRITICAL risk scenario:
      // 1. Execution intent written (status: 'pending')
      // 2. AI execution succeeds
      // 3. Network fails before updateExecutionResult() is called
      // Result: Execution intent remains 'pending' but can be detected and reconciled

      // Mock ai-service to succeed
      const executeSpy = jest
        .spyOn(aiServiceHttpClient, 'execute')
        .mockResolvedValue({
          output: 'AI response',
          tokensUsed: 200,
          model: 'stub',
        });

      // Mock updateExecutionResult to fail (simulate network failure)
      const updateSpy = jest
        .spyOn(UsageLedgerService.prototype, 'updateExecutionResult')
        .mockRejectedValue(new Error('Network failure'));

      // Execute request (should fail at updateExecutionResult)
      const response = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-network-failure-001')
        .send({
          sessionId: '11111111-1111-1111-1111-111111111111',
          conversationId: '22222222-2222-2222-2222-222222222222',
          userId: 'user-1',
          prompt: 'Test prompt',
          provider: 'stub',
        });

      expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);

      // CRITICAL: Verify execution intent exists with status 'pending'
      // This is the key improvement: we have a record of the execution attempt
      const pendingRecords = await usageRecordRepository.find({
        where: { userId: 'user-1', executionStatus: 'pending' },
      });

      expect(pendingRecords.length).toBe(1);
      expect(pendingRecords[0].executionStatus).toBe('pending');
      expect(pendingRecords[0].requestId).toBe('test-network-failure-001');

      // In production, a cleanup job would:
      // 1. Detect 'pending' records older than 2 minutes
      // 2. Mark them as 'timeout' for manual reconciliation
      // 3. Alert ops team for investigation

      executeSpy.mockRestore();
      updateSpy.mockRestore();
    });
  });
});
