import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreditBalance } from '../../../entities/credit-balance.entity';
import { CreditDeductionRecord } from '../../../entities/credit-deduction-record.entity';
import { CreditPersistenceModule } from '../credit-persistence.module';
import { CreditBalanceRepository } from '../credit-balance.repository';
import { CreditDeductionRecordRepository } from '../credit-deduction-record.repository';

describe('CreditPersistenceModule', () => {
  it('provides CreditBalanceRepository and CreditDeductionRecordRepository', async () => {
    const module = await Test.createTestingModule({
      imports: [CreditPersistenceModule],
    })
      .overrideProvider(getRepositoryToken(CreditBalance))
      .useValue({})
      .overrideProvider(getRepositoryToken(CreditDeductionRecord))
      .useValue({})
      .compile();

    const balanceRepo = module.get(CreditBalanceRepository);
    expect(balanceRepo).toBeInstanceOf(CreditBalanceRepository);

    const deductionRepo = module.get(CreditDeductionRecordRepository);
    expect(deductionRepo).toBeInstanceOf(CreditDeductionRecordRepository);
  });

  it('does not provide CreditDeductionGateway (no gateway swap)', async () => {
    const module = await Test.createTestingModule({
      imports: [CreditPersistenceModule],
    })
      .overrideProvider(getRepositoryToken(CreditBalance))
      .useValue({})
      .overrideProvider(getRepositoryToken(CreditDeductionRecord))
      .useValue({})
      .compile();

    expect(() => {
      module.get('CreditDeductionGateway');
    }).toThrow();
  });
});
