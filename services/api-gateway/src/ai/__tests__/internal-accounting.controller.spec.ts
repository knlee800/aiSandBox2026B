import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { InternalAccountingController } from '../internal-accounting.controller';
import { UsageLedgerService } from '../../usage-ledger/usage-ledger.service';
import { InternalServiceAuthGuard } from '../../guards/internal-service-auth.guard';

describe('InternalAccountingController', () => {
  let controller: InternalAccountingController;
  let usageLedgerService: {
    triggerDeductionForExecution: jest.Mock;
    triggerBuildApplyDeduction: jest.Mock;
  };

  beforeEach(async () => {
    usageLedgerService = {
      triggerDeductionForExecution: jest.fn(),
      triggerBuildApplyDeduction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalAccountingController],
      providers: [
        { provide: UsageLedgerService, useValue: usageLedgerService },
      ],
    }).compile();

    controller = module.get<InternalAccountingController>(InternalAccountingController);
  });

  it('should call UsageLedgerService.triggerDeductionForExecution with executionId', async () => {
    usageLedgerService.triggerDeductionForExecution.mockResolvedValue({
      triggered: true,
      reason: 'completed',
    });

    const result = await controller.finalizeAccounting('exec-test-123');

    expect(usageLedgerService.triggerDeductionForExecution).toHaveBeenCalledWith('exec-test-123');
    expect(result).toEqual({
      executionId: 'exec-test-123',
      triggered: true,
      reason: 'completed',
    });
  });

  it('should return triggered=false when execution is not completed', async () => {
    usageLedgerService.triggerDeductionForExecution.mockResolvedValue({
      triggered: false,
      reason: 'status_failed',
    });

    const result = await controller.finalizeAccounting('exec-failed-456');

    expect(result).toEqual({
      executionId: 'exec-failed-456',
      triggered: false,
      reason: 'status_failed',
    });
  });

  it('should return triggered=false when record is not found', async () => {
    usageLedgerService.triggerDeductionForExecution.mockResolvedValue({
      triggered: false,
      reason: 'record_not_found',
    });

    const result = await controller.finalizeAccounting('exec-missing');

    expect(result).toEqual({
      executionId: 'exec-missing',
      triggered: false,
      reason: 'record_not_found',
    });
  });

  it('should be a NestJS controller with the correct route prefix', () => {
    const controllerSource = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'internal-accounting.controller.ts'),
      'utf-8',
    );
    expect(controllerSource).toContain("@Controller('internal/executions')");
    expect(controllerSource).toContain("@Post(':executionId/finalize-accounting')");
    expect(controllerSource).toContain("@Post(':executionId/confirm-build-apply')");
  });

  it('should be guarded by global InternalServiceAuthGuard via /api/internal/* route', () => {
    const controllerSource = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'internal-accounting.controller.ts'),
      'utf-8',
    );
    expect(controllerSource).toContain("@Controller('internal/executions')");
    expect(controllerSource).not.toContain('@Public');
    expect(controllerSource).not.toContain('Stripe');
    expect(controllerSource).not.toContain('payment');
    expect(controllerSource).not.toContain('provider');
  });

  it('should not contain any Stripe/payment/provider references', () => {
    const controllerSource = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'internal-accounting.controller.ts'),
      'utf-8',
    );
    expect(controllerSource).not.toContain('stripe');
    expect(controllerSource).not.toContain('Stripe');
    expect(controllerSource).not.toContain('payment');
    expect(controllerSource).not.toContain('subscription');
  });

  it('calls triggerBuildApplyDeduction once for a qualifying confirmation', async () => {
    usageLedgerService.triggerBuildApplyDeduction.mockResolvedValue({
      triggered: true,
      reason: 'completed',
    });

    const confirmation = {
      applyStatus: 'applied',
      totalActions: 2,
      successCount: 2,
    };

    const result = await controller.confirmBuildApply('exec-build-1', confirmation);

    expect(usageLedgerService.triggerBuildApplyDeduction).toHaveBeenCalledTimes(1);
    expect(usageLedgerService.triggerBuildApplyDeduction).toHaveBeenCalledWith(
      'exec-build-1',
      confirmation,
    );
    expect(result).toEqual({
      executionId: 'exec-build-1',
      triggered: true,
      reason: 'completed',
    });
  });

  it('returns non-trigger results for unknown, wrong-intent, and non-completed executions', async () => {
    usageLedgerService.triggerBuildApplyDeduction
      .mockResolvedValueOnce({ triggered: false, reason: 'record_not_found' })
      .mockResolvedValueOnce({ triggered: false, reason: 'intent_not_workspace_mutation' })
      .mockResolvedValueOnce({ triggered: false, reason: 'status_failed' });

    const confirmation = {
      applyStatus: 'applied',
      totalActions: 1,
      successCount: 1,
    };

    await expect(controller.confirmBuildApply('missing', confirmation)).resolves.toEqual({
      executionId: 'missing',
      triggered: false,
      reason: 'record_not_found',
    });
    await expect(controller.confirmBuildApply('ask-exec', confirmation)).resolves.toEqual({
      executionId: 'ask-exec',
      triggered: false,
      reason: 'intent_not_workspace_mutation',
    });
    await expect(controller.confirmBuildApply('failed-exec', confirmation)).resolves.toEqual({
      executionId: 'failed-exec',
      triggered: false,
      reason: 'status_failed',
    });
  });
});

describe('InternalAccountingController HTTP confirm-build-apply', () => {
  let app: INestApplication;
  let usageLedgerService: {
    triggerDeductionForExecution: jest.Mock;
    triggerBuildApplyDeduction: jest.Mock;
  };
  const originalInternalServiceKey = process.env.INTERNAL_SERVICE_KEY;
  const internalKey = '03d-a-test-internal-key';

  const qualifyingBody = {
    applyStatus: 'applied',
    totalActions: 2,
    successCount: 2,
  };

  beforeEach(async () => {
    process.env.INTERNAL_SERVICE_KEY = internalKey;
    usageLedgerService = {
      triggerDeductionForExecution: jest.fn(),
      triggerBuildApplyDeduction: jest.fn().mockResolvedValue({
        triggered: true,
        reason: 'completed',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalAccountingController],
      providers: [
        { provide: UsageLedgerService, useValue: usageLedgerService },
        { provide: APP_GUARD, useClass: InternalServiceAuthGuard },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    process.env.INTERNAL_SERVICE_KEY = originalInternalServiceKey;
    await app.close();
    jest.clearAllMocks();
  });

  function confirmPath(executionId = 'exec-build-1') {
    return `/api/internal/executions/${executionId}/confirm-build-apply`;
  }

  it('rejects confirm-build-apply without the internal service key', async () => {
    await request(app.getHttpServer())
      .post(confirmPath())
      .send(qualifyingBody)
      .expect(401);

    expect(usageLedgerService.triggerBuildApplyDeduction).not.toHaveBeenCalled();
  });

  it('rejects confirm-build-apply with an invalid internal service key', async () => {
    await request(app.getHttpServer())
      .post(confirmPath())
      .set('X-Internal-Service-Key', 'wrong-key')
      .send(qualifyingBody)
      .expect(401);

    expect(usageLedgerService.triggerBuildApplyDeduction).not.toHaveBeenCalled();
  });

  it('invokes the service once for a valid full-success confirmation', async () => {
    const response = await request(app.getHttpServer())
      .post(confirmPath())
      .set('X-Internal-Service-Key', internalKey)
      .send(qualifyingBody)
      .expect(200);

    expect(response.body).toEqual({
      executionId: 'exec-build-1',
      triggered: true,
      reason: 'completed',
    });
    expect(usageLedgerService.triggerBuildApplyDeduction).toHaveBeenCalledTimes(1);
    expect(usageLedgerService.triggerBuildApplyDeduction).toHaveBeenCalledWith(
      'exec-build-1',
      expect.objectContaining(qualifyingBody),
    );
  });

  it('rejects a naked success payload as malformed', async () => {
    await request(app.getHttpServer())
      .post(confirmPath())
      .set('X-Internal-Service-Key', internalKey)
      .send({ success: true })
      .expect(400);

    expect(usageLedgerService.triggerBuildApplyDeduction).not.toHaveBeenCalled();
  });

  it('rejects missing required confirmation fields', async () => {
    await request(app.getHttpServer())
      .post(confirmPath())
      .set('X-Internal-Service-Key', internalKey)
      .send({ applyStatus: 'applied' })
      .expect(400);

    expect(usageLedgerService.triggerBuildApplyDeduction).not.toHaveBeenCalled();
  });

  it('rejects non-integer totalActions', async () => {
    await request(app.getHttpServer())
      .post(confirmPath())
      .set('X-Internal-Service-Key', internalKey)
      .send({ applyStatus: 'applied', totalActions: 1.5, successCount: 1 })
      .expect(400);

    expect(usageLedgerService.triggerBuildApplyDeduction).not.toHaveBeenCalled();
  });

  it('rejects negative successCount', async () => {
    await request(app.getHttpServer())
      .post(confirmPath())
      .set('X-Internal-Service-Key', internalKey)
      .send({ applyStatus: 'applied', totalActions: 1, successCount: -1 })
      .expect(400);

    expect(usageLedgerService.triggerBuildApplyDeduction).not.toHaveBeenCalled();
  });

  it('does not invoke deduction for skipped confirmation when the service rejects it', async () => {
    usageLedgerService.triggerBuildApplyDeduction.mockResolvedValue({
      triggered: false,
      reason: 'apply_status_not_applied',
    });

    const response = await request(app.getHttpServer())
      .post(confirmPath())
      .set('X-Internal-Service-Key', internalKey)
      .send({ applyStatus: 'skipped', totalActions: 2, successCount: 0 })
      .expect(200);

    expect(response.body.triggered).toBe(false);
    expect(response.body.reason).toBe('apply_status_not_applied');
    expect(usageLedgerService.triggerBuildApplyDeduction).toHaveBeenCalledTimes(1);
  });

  it('does not invoke deduction for zero-action, mismatch, and partial results returned by the service', async () => {
    usageLedgerService.triggerBuildApplyDeduction
      .mockResolvedValueOnce({ triggered: false, reason: 'zero_file_actions' })
      .mockResolvedValueOnce({ triggered: false, reason: 'total_actions_mismatch' })
      .mockResolvedValueOnce({ triggered: false, reason: 'partial_apply' });

    const zero = await request(app.getHttpServer())
      .post(confirmPath('exec-zero'))
      .set('X-Internal-Service-Key', internalKey)
      .send({ applyStatus: 'applied', totalActions: 1, successCount: 1 })
      .expect(200);
    const mismatch = await request(app.getHttpServer())
      .post(confirmPath('exec-mismatch'))
      .set('X-Internal-Service-Key', internalKey)
      .send({ applyStatus: 'applied', totalActions: 3, successCount: 3 })
      .expect(200);
    const partial = await request(app.getHttpServer())
      .post(confirmPath('exec-partial'))
      .set('X-Internal-Service-Key', internalKey)
      .send({ applyStatus: 'applied', totalActions: 2, successCount: 1 })
      .expect(200);

    expect(zero.body.reason).toBe('zero_file_actions');
    expect(mismatch.body.reason).toBe('total_actions_mismatch');
    expect(partial.body.reason).toBe('partial_apply');
    expect(usageLedgerService.triggerBuildApplyDeduction).toHaveBeenCalledTimes(3);
  });

  it('keeps the confirm-build-apply path inside InternalServiceAuthGuard internal-route matching', () => {
    const guard = new InternalServiceAuthGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          path: '/api/internal/executions/exec-build-1/confirm-build-apply',
          headers: {},
        }),
      }),
    };

    expect(() => guard.canActivate(context as any)).toThrow(UnauthorizedException);
  });
});
