import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { IdempotencyGuard } from './idempotency.guard';
import { UsageLedgerService } from '../usage-ledger/usage-ledger.service';
import { UsageRecord } from '../entities/usage-record.entity';
import { ApiKeyIdentity } from '../auth/api-key.config';

describe('IdempotencyGuard (Phase 43A-2C)', () => {
  let guard: IdempotencyGuard;
  let usageLedgerService: jest.Mocked<UsageLedgerService>;

  beforeEach(() => {
    usageLedgerService = {
      findByRequestId: jest.fn(),
    } as any;

    guard = new IdempotencyGuard(usageLedgerService);
  });

  const createMockContext = (
    headers: Record<string, string>,
    identity?: ApiKeyIdentity,
  ): ExecutionContext => {
    const request = {
      headers,
      apiKeyIdentity: identity,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should allow normal flow when no Idempotency-Key header is present', async () => {
      const context = createMockContext({}, {
        userId: 'user-123',
        apiKeyId: 'key-123',
        scopes: ['ai:execute'],
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(usageLedgerService.findByRequestId).not.toHaveBeenCalled();
    });

    it('should allow normal flow when Idempotency-Key is empty string', async () => {
      const context = createMockContext(
        { 'idempotency-key': '' },
        {
          userId: 'user-123',
          apiKeyId: 'key-123',
          scopes: ['ai:execute'],
        },
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(usageLedgerService.findByRequestId).not.toHaveBeenCalled();
    });

    it('should allow normal flow when Idempotency-Key is whitespace-only', async () => {
      const context = createMockContext(
        { 'idempotency-key': '   ' },
        {
          userId: 'user-123',
          apiKeyId: 'key-123',
          scopes: ['ai:execute'],
        },
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(usageLedgerService.findByRequestId).not.toHaveBeenCalled();
    });

    it('should allow normal flow when Idempotency-Key exceeds 100 characters', async () => {
      const longKey = 'x'.repeat(101);
      const context = createMockContext(
        { 'idempotency-key': longKey },
        {
          userId: 'user-123',
          apiKeyId: 'key-123',
          scopes: ['ai:execute'],
        },
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(usageLedgerService.findByRequestId).not.toHaveBeenCalled();
    });

    it('should throw 500 when identity is missing', async () => {
      const context = createMockContext({ 'idempotency-key': 'req-123' });

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Idempotency check failed: missing identity',
      );

      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    });

    it('should allow normal flow when no existing record found', async () => {
      const context = createMockContext(
        { 'idempotency-key': 'req-new-123' },
        {
          userId: 'user-123',
          apiKeyId: 'key-123',
          scopes: ['ai:execute'],
        },
      );

      usageLedgerService.findByRequestId.mockResolvedValue(null);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(usageLedgerService.findByRequestId).toHaveBeenCalledWith(
        'user-123',
        'req-new-123',
      );

      const request = context.switchToHttp().getRequest();
      expect((request as any).idempotentResult).toBeUndefined();
    });

    it('should short-circuit and attach reconstructed result when existing record found', async () => {
      const existingRecord: UsageRecord = {
        executionId: 'exec-existing-123',
        requestId: 'req-duplicate-123',
        apiKeyId: 'key-123',
        userId: 'user-123',
        sessionId: 'session-123',
        conversationId: 'conv-123',
        provider: 'stub',
        adapter: 'stub',
        model: 'claude-3-5-sonnet-20241022',
        tokensUsed: 500,
        executionDurationMs: 1000,
        timestamp: new Date(),
      };

      const context = createMockContext(
        { 'idempotency-key': 'req-duplicate-123' },
        {
          userId: 'user-123',
          apiKeyId: 'key-123',
          scopes: ['ai:execute'],
        },
      );

      usageLedgerService.findByRequestId.mockResolvedValue(existingRecord);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(usageLedgerService.findByRequestId).toHaveBeenCalledWith(
        'user-123',
        'req-duplicate-123',
      );

      const request = context.switchToHttp().getRequest();
      expect((request as any).idempotentResult).toEqual({
        output: '[Duplicate request - original response not stored]',
        tokensUsed: 500,
        model: 'claude-3-5-sonnet-20241022',
      });
    });

    it('should trim whitespace from Idempotency-Key before lookup', async () => {
      const context = createMockContext(
        { 'idempotency-key': '  req-trimmed-123  ' },
        {
          userId: 'user-123',
          apiKeyId: 'key-123',
          scopes: ['ai:execute'],
        },
      );

      usageLedgerService.findByRequestId.mockResolvedValue(null);

      await guard.canActivate(context);

      expect(usageLedgerService.findByRequestId).toHaveBeenCalledWith(
        'user-123',
        'req-trimmed-123',
      );
    });

    it('should use verified userId from identity, not request body', async () => {
      const context = createMockContext(
        { 'idempotency-key': 'req-123' },
        {
          userId: 'verified-user-456',
          apiKeyId: 'key-123',
          scopes: ['ai:execute'],
        },
      );

      usageLedgerService.findByRequestId.mockResolvedValue(null);

      await guard.canActivate(context);

      expect(usageLedgerService.findByRequestId).toHaveBeenCalledWith(
        'verified-user-456',
        'req-123',
      );
    });

    it('should handle database errors gracefully', async () => {
      const context = createMockContext(
        { 'idempotency-key': 'req-error-123' },
        {
          userId: 'user-123',
          apiKeyId: 'key-123',
          scopes: ['ai:execute'],
        },
      );

      const dbError = new Error('Database connection failed');
      usageLedgerService.findByRequestId.mockRejectedValue(dbError);

      await expect(guard.canActivate(context)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });
});
