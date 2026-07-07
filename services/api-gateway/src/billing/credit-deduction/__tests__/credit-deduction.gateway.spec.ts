import { CreditDeductionGateway } from '../credit-deduction.gateway';
import { NoOpCreditDeductionGateway } from '../noop-credit-deduction.gateway';
import { CreditDeductionModule } from '../credit-deduction.module';
import { Test } from '@nestjs/testing';

describe('CreditDeductionGateway architectural guardrails', () => {
  it('NoOpCreditDeductionGateway extends CreditDeductionGateway', () => {
    const gateway = new NoOpCreditDeductionGateway();
    expect(gateway).toBeInstanceOf(CreditDeductionGateway);
  });

  it('NoOpCreditDeductionGateway implements applyDeduction', () => {
    const gateway = new NoOpCreditDeductionGateway();
    expect(typeof gateway.applyDeduction).toBe('function');
  });

  it('CreditDeductionModule provides CreditDeductionGateway token', async () => {
    const module = await Test.createTestingModule({
      imports: [CreditDeductionModule],
    }).compile();

    const gateway = module.get(CreditDeductionGateway);
    expect(gateway).toBeInstanceOf(NoOpCreditDeductionGateway);
    expect(gateway).toBeInstanceOf(CreditDeductionGateway);
  });

  it('swapping implementation binds a different class to the same token', async () => {
    class StubGateway extends CreditDeductionGateway {
      applyDeduction() {
        return {
          source: 'usage_ledger' as const,
          sourceEventId: 'stub',
          ownerId: 'stub',
          occurredAt: new Date(),
          totalCreditsRequested: 0,
          totalCreditsApplied: 0,
          totalCreditsOverflow: 0,
          lineItems: [],
        };
      }
    }

    const module = await Test.createTestingModule({
      providers: [
        { provide: CreditDeductionGateway, useClass: StubGateway },
      ],
    }).compile();

    const gateway = module.get(CreditDeductionGateway);
    expect(gateway).toBeInstanceOf(StubGateway);
    expect(gateway).toBeInstanceOf(CreditDeductionGateway);
    expect(gateway).not.toBeInstanceOf(NoOpCreditDeductionGateway);
  });
});
