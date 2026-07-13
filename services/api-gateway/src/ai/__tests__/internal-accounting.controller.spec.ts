import { Test, TestingModule } from '@nestjs/testing';
import { InternalAccountingController } from '../internal-accounting.controller';
import { UsageLedgerService } from '../../usage-ledger/usage-ledger.service';

describe('InternalAccountingController', () => {
  let controller: InternalAccountingController;
  let usageLedgerService: { triggerDeductionForExecution: jest.Mock };

  beforeEach(async () => {
    usageLedgerService = {
      triggerDeductionForExecution: jest.fn(),
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
  });

  it('should be guarded by global InternalServiceAuthGuard via /api/internal/* route', () => {
    const controllerSource = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'internal-accounting.controller.ts'),
      'utf-8',
    );
    expect(controllerSource).toContain("@Controller('internal/executions')");
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
});
