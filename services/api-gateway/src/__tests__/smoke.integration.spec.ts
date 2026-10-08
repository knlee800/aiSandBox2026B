/**
 * Release Candidate Smoke Tests
 *
 * Phase 33A: Automated smoke pack for release validation
 *
 * PURPOSE:
 * - Validate deployable system end-to-end in < 2 minutes
 * - Deterministic, fast, fail-fast validation
 * - No flaky tests, no race conditions
 *
 * SCOPE:
 * - PostgreSQL connectivity
 * - api-gateway startup validation
 * - Authentication & authorization
 * - Current local execute contract: 503 while execution is disabled, otherwise 202 queued
 * - Billing visibility (read-only)
 *
 * INVARIANTS:
 * - No production logic changes
 * - No schema changes
 * - No new endpoints
 * - Execution enablement is changed only inside the queued-execute test and restored afterward
 * - No secrets committed
 *
 * PREREQUISITES:
 * - PostgreSQL running on localhost:5432
 * - Database 'aisandbox' created and migrated
 * - Redis for the gateway queue
 * - Static internal test key test-api-key-user-1 and a test credit balance
 * - AI_PROVIDER=stub. This file does not call a live provider.
 * - Live provider-journey evidence remains a later DEPLOY acceptance requirement.
 *
 * USAGE:
 * npm test -- smoke.integration.spec.ts
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../app.module';
import request from 'supertest';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { QueueService } from '../queue/queue.service';

describe('Release Candidate Smoke Pack (Phase 33A)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let enqueueSpy: jest.SpyInstance;
  let savedGlobalExecutionEnabled: string | undefined;

  // Billing checks use the public static test key. Execute checks use the internal static test key.
  const API_KEY = 'valid-api-key';
  const INTERNAL_EXECUTE_KEY = 'test-api-key-user-1';
  const SEEDED_EXECUTE_KEY = 'runtime01-smoke-execute-key';
  const SEEDED_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const BASE_URL = 'http://localhost:4000';
  const EXECUTION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  beforeAll(async () => {
    // Create NestJS test application
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply global validation pipe (matches main.ts)
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // Set global prefix (matches main.ts)
    app.setGlobalPrefix('api');

    await app.init();

    // Get DataSource for direct database queries
    dataSource = moduleFixture.get<DataSource>(DataSource);
    savedGlobalExecutionEnabled = process.env.GLOBAL_EXECUTION_ENABLED;
    // jest.spyOn alone records the call and still runs BullMQ queue.add.
    // This replacement records the payload and resolves without submitting work.
    enqueueSpy = jest
      .spyOn(app.get(QueueService), 'enqueueExecution')
      .mockImplementation(async () => undefined);
    await dataSource.query(
      `INSERT INTO users (id, email)
       VALUES ($1, 'runtime01-smoke@example.test')
       ON CONFLICT (id) DO NOTHING`,
      [SEEDED_USER_ID],
    );
    const hashedKey = await bcrypt.hash(SEEDED_EXECUTE_KEY, 10);
    await dataSource.query(
      `INSERT INTO api_keys (hashed_key, key_prefix, user_id, scopes, is_internal)
       VALUES ($1, $2, $3, $4::jsonb, true)`,
      [hashedKey, SEEDED_EXECUTE_KEY.slice(0, 16), SEEDED_USER_ID, JSON.stringify(['ai:execute'])],
    );
    await dataSource.query(
      `INSERT INTO credit_balances (owner_id, owner_type, plan_id, balance, monthly_allocation, period_start, period_end)
       VALUES ($1, 'user', 'free', 100, 100, NOW(), NOW() + INTERVAL '30 days')
       ON CONFLICT (owner_id, owner_type) DO UPDATE SET balance = EXCLUDED.balance`,
      [SEEDED_USER_ID],
    );
    await dataSource.query(
      `INSERT INTO sessions (id, user_id, status, expires_at, last_activity_at)
       VALUES ($1, $2, 'pending', NOW() + INTERVAL '1 day', NOW())
       ON CONFLICT (id) DO NOTHING`,
      ['11111111-1111-4111-8111-111111111111', SEEDED_USER_ID],
    );
  });

  afterEach(() => {
    enqueueSpy.mockClear();
    if (savedGlobalExecutionEnabled === undefined) {
      delete process.env.GLOBAL_EXECUTION_ENABLED;
    } else {
      process.env.GLOBAL_EXECUTION_ENABLED = savedGlobalExecutionEnabled;
    }
  });

  afterAll(async () => {
    enqueueSpy.mockRestore();
    if (savedGlobalExecutionEnabled === undefined) {
      delete process.env.GLOBAL_EXECUTION_ENABLED;
    } else {
      process.env.GLOBAL_EXECUTION_ENABLED = savedGlobalExecutionEnabled;
    }
    await app.close();
  });

  describe('Infrastructure Layer', () => {
    it('should connect to PostgreSQL', async () => {
      const result = await dataSource.query('SELECT 1 AS status');
      expect(result).toEqual([{ status: 1 }]);
    });

    it('should have database schema initialized', async () => {
      // Check that key tables exist
      const tables = await dataSource.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('api_keys', 'usage_records', 'billing_snapshots')
        ORDER BY table_name
      `);

      const tableNames = tables.map((t: any) => t.table_name);
      expect(tableNames).toContain('api_keys');
      expect(tableNames).toContain('usage_records');
      expect(tableNames).toContain('billing_snapshots');
    });
  });

  describe('Health & Readiness Layer', () => {
    it('GET /api/health should return ok', async () => {
      const response = await request(app.getHttpServer()).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'ok',
        service: 'api-gateway',
        version: '0.1.0',
      });
      expect(response.body.timestamp).toBeDefined();
    });

    it('GET /api/health/db should return connected', async () => {
      const response = await request(app.getHttpServer()).get('/api/health/db');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'ok',
        database: 'connected',
      });
      expect(response.body.timestamp).toBeDefined();
    });

    it('GET /api/health/ready should validate startup guards', async () => {
      const response = await request(app.getHttpServer()).get('/api/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'ready',
        checks: {
          environment: 'validated',
          database: 'connected',
          killSwitches: 'loaded',
          safetyLimits: 'loaded',
        },
      });

      // Validate environment config is present
      expect(response.body.environment).toBeDefined();

      // Validate kill switches loaded
      expect(response.body.killSwitches).toBeDefined();
      expect(response.body.killSwitches.total).toBeGreaterThan(0);

      // Validate safety limits loaded
      expect(response.body.safetyLimits).toBeDefined();
      expect(response.body.safetyLimits.total).toBeGreaterThan(0);
    });
  });

  describe('Authentication & Authorization Layer', () => {
    it('POST /api/ai/execute should reject missing API key (401)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/ai/execute')
        .send({
          sessionId: '00000000-0000-0000-0000-000000000001',
          conversationId: '00000000-0000-0000-0000-000000000002',
          userId: 'test-user-789',
          prompt: 'What is 2+2?',
        });

      expect(response.status).toBe(401);
    });

    it('POST /api/ai/execute should reject invalid API key (403)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/ai/execute')
        .set('Authorization', 'Bearer invalid-key')
        .send({
          sessionId: '00000000-0000-0000-0000-000000000003',
          conversationId: '00000000-0000-0000-0000-000000000004',
          userId: 'test-user-789',
          prompt: 'What is 2+2?',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('Local execute contract', () => {
    const executeBody = {
      sessionId: '11111111-1111-4111-8111-111111111111',
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'ignored-by-auth',
      prompt: 'What is 2+2? Answer in one sentence.',
    };

    it('POST /api/ai/execute returns maintenance 503 and does not enqueue when execution is disabled', async () => {
      delete process.env.GLOBAL_EXECUTION_ENABLED;

      const response = await request(app.getHttpServer())
        .post('/api/ai/execute')
        .set('Authorization', `Bearer ${INTERNAL_EXECUTE_KEY}`)
        .send(executeBody);

      expect(response.status).toBe(503);
      expect(response.body.message).toBe(
        'AI execution temporarily disabled for maintenance',
      );
      expect(enqueueSpy).not.toHaveBeenCalled();
    });

    it('POST /api/ai/execute returns 202 queued and enqueues when execution is enabled for this test', async () => {
      process.env.GLOBAL_EXECUTION_ENABLED = 'true';

      const response = await request(app.getHttpServer())
        .post('/api/ai/execute')
        .set('Authorization', `Bearer ${SEEDED_EXECUTE_KEY}`)
        .send(executeBody);

      expect(response.status).toBe(202);
      expect(response.body.status).toBe('queued');
      expect(response.body.executionId).toEqual(expect.stringMatching(EXECUTION_UUID));
      expect(enqueueSpy).toHaveBeenCalledTimes(1);
      expect(enqueueSpy.mock.calls[0][0].executionId).toBe(response.body.executionId);
      expect(enqueueSpy.mock.calls[0][0].prompt).toBe(executeBody.prompt);
    });
  });

  describe('Billing Visibility Layer', () => {
    it('GET /api/billing/snapshots should return snapshots (auth required)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/billing/snapshots')
        .set('Authorization', `Bearer ${API_KEY}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('snapshots');
      expect(Array.isArray(response.body.snapshots)).toBe(true);

      // Empty array is valid if no snapshots exist
      // If snapshots exist, validate structure
      if (response.body.snapshots.length > 0) {
        const snapshot = response.body.snapshots[0];
        expect(snapshot).toHaveProperty('id');
        expect(snapshot).toHaveProperty('apiKeyId');
        expect(snapshot).toHaveProperty('periodStart');
        expect(snapshot).toHaveProperty('periodEnd');
        expect(snapshot).toHaveProperty('totalCostUSD');
        expect(snapshot).toHaveProperty('totalTokens');
      }
    });

    it('GET /api/billing/snapshots should reject missing API key (401)', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/billing/snapshots',
      );

      expect(response.status).toBe(401);
    });

    it('GET /api/billing/summary should return time window summary', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/billing/summary')
        .query({
          periodStart: '2026-02-01',
          periodEnd: '2026-02-28',
        })
        .set('Authorization', `Bearer ${API_KEY}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('periodStart');
      expect(response.body).toHaveProperty('periodEnd');
      expect(response.body).toHaveProperty('totalCostUSD');
      expect(response.body).toHaveProperty('totalTokens');
      expect(response.body).toHaveProperty('snapshotCount');
      expect(response.body).toHaveProperty('byProvider');

      // Validate types
      expect(typeof response.body.totalCostUSD).toBe('number');
      expect(typeof response.body.totalTokens).toBe('number');
      expect(typeof response.body.snapshotCount).toBe('number');
      expect(typeof response.body.byProvider).toBe('object');

      // Zero values are valid if no usage in time window
      expect(response.body.totalCostUSD).toBeGreaterThanOrEqual(0);
      expect(response.body.totalTokens).toBeGreaterThanOrEqual(0);
      expect(response.body.snapshotCount).toBeGreaterThanOrEqual(0);
    });

    it('GET /api/billing/summary should reject invalid date format (400)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/billing/summary')
        .query({
          periodStart: 'invalid-date',
          periodEnd: '2026-02-28',
        })
        .set('Authorization', `Bearer ${API_KEY}`);

      expect(response.status).toBe(400);
    });
  });

  describe('Smoke Pack Validation Summary', () => {
    it('should validate entire stack in < 2 minutes', async () => {
      const startTime = Date.now();

      // Run minimal validation sequence
      await request(app.getHttpServer()).get('/api/health');
      await request(app.getHttpServer()).get('/api/health/ready');
      delete process.env.GLOBAL_EXECUTION_ENABLED;
      const disabledExecute = await request(app.getHttpServer())
        .post('/api/ai/execute')
        .set('Authorization', `Bearer ${INTERNAL_EXECUTE_KEY}`)
        .send({
          sessionId: '33333333-3333-4333-8333-333333333333',
          conversationId: '44444444-4444-4444-8444-444444444444',
          userId: 'smoke-final',
          prompt: 'Say hello in one word.',
        });
      expect(disabledExecute.status).toBe(503);
      expect(enqueueSpy).not.toHaveBeenCalled();
      await request(app.getHttpServer())
        .get('/api/billing/snapshots')
        .set('Authorization', `Bearer ${API_KEY}`);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Validate execution time < 2 minutes (120,000 ms)
      expect(duration).toBeLessThan(120000);

      console.log(`\n✅ Smoke pack completed in ${duration}ms (< 2 minutes)`);
    }, 120000); // 2 minute timeout
  });
});
