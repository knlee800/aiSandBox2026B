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
 * - End-to-end execution (real provider)
 * - Billing visibility (read-only)
 *
 * INVARIANTS:
 * - No production logic changes
 * - No schema changes
 * - No new endpoints
 * - No env mutation inside tests
 * - No secrets committed
 *
 * PREREQUISITES:
 * - PostgreSQL running on localhost:5432
 * - Database 'aisandbox' created and migrated
 * - Valid API key in database
 * - AI_PROVIDER environment variable set
 * - Provider API key configured (e.g., XAI_API_KEY)
 *
 * USAGE:
 * npm test -- smoke.integration.spec.ts
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../app.module';
import * as request from 'supertest';
import { DataSource } from 'typeorm';

describe('Release Candidate Smoke Pack (Phase 33A)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Test configuration
  const API_KEY = 'valid-api-key'; // Must exist in database
  const BASE_URL = 'http://localhost:4000';

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
  });

  afterAll(async () => {
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
        AND table_name IN ('api_keys', 'usage_ledger', 'billing_snapshots', 'quota_state')
        ORDER BY table_name
      `);

      const tableNames = tables.map((t: any) => t.table_name);
      expect(tableNames).toContain('api_keys');
      expect(tableNames).toContain('usage_ledger');
      expect(tableNames).toContain('billing_snapshots');
      expect(tableNames).toContain('quota_state');
    });
  });

  describe('Health & Readiness Layer', () => {
    it('GET /health should return ok', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'ok',
        service: 'api-gateway',
        version: '0.1.0',
      });
      expect(response.body.timestamp).toBeDefined();
    });

    it('GET /health/db should return connected', async () => {
      const response = await request(app.getHttpServer()).get('/health/db');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'ok',
        database: 'connected',
      });
      expect(response.body.timestamp).toBeDefined();
    });

    it('GET /health/ready should validate startup guards', async () => {
      const response = await request(app.getHttpServer()).get('/health/ready');

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
      expect(response.body.environment.launchState).toBeDefined();
      expect(response.body.environment.abortMode).toBeDefined();

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
          sessionId: 'test-session-123',
          conversationId: 'test-conv-456',
          userId: 'test-user-789',
          prompt: 'What is 2+2?',
        });

      expect(response.status).toBe(401);
    });

    it('POST /api/ai/execute should reject invalid API key (401)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/ai/execute')
        .set('Authorization', 'Bearer invalid-key')
        .send({
          sessionId: 'test-session-123',
          conversationId: 'test-conv-456',
          userId: 'test-user-789',
          prompt: 'What is 2+2?',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('End-to-End Execution Layer', () => {
    it('POST /api/ai/execute should execute with real provider', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/ai/execute')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({
          sessionId: 'smoke-test-session',
          conversationId: 'smoke-test-conv',
          userId: 'smoke-test-user',
          prompt: 'What is 2+2? Answer in one sentence.',
        });

      // Success criteria from Phase 30A
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('output');
      expect(response.body).toHaveProperty('tokensUsed');
      expect(response.body).toHaveProperty('model');

      // Validate NOT stub response
      expect(response.body.output).not.toContain('[STUB]');
      expect(response.body.output).not.toBe(
        '[STUB] AI execution not implemented yet',
      );

      // Validate real provider execution
      expect(response.body.tokensUsed).toBeGreaterThan(0);
      expect(response.body.model).toBeDefined();
      expect(response.body.model).not.toBe('stub-model');

      // Validate output is natural language
      expect(response.body.output.length).toBeGreaterThan(0);
      expect(typeof response.body.output).toBe('string');
    }, 10000); // 10 second timeout for provider API call
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
        expect(snapshot).toHaveProperty('totalCost');
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
      expect(response.body).toHaveProperty('totalCost');
      expect(response.body).toHaveProperty('totalTokens');
      expect(response.body).toHaveProperty('snapshotCount');
      expect(response.body).toHaveProperty('providers');

      // Validate types
      expect(typeof response.body.totalCost).toBe('number');
      expect(typeof response.body.totalTokens).toBe('number');
      expect(typeof response.body.snapshotCount).toBe('number');
      expect(typeof response.body.providers).toBe('object');

      // Zero values are valid if no usage in time window
      expect(response.body.totalCost).toBeGreaterThanOrEqual(0);
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
      await request(app.getHttpServer()).get('/health');
      await request(app.getHttpServer()).get('/health/ready');
      await request(app.getHttpServer())
        .post('/api/ai/execute')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({
          sessionId: 'smoke-final',
          conversationId: 'smoke-final',
          userId: 'smoke-final',
          prompt: 'Say hello in one word.',
        });
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
