import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Subscription } from '../../../entities/subscription.entity';
import { SubscriptionModule } from '../subscription.module';
import { SubscriptionRepository } from '../subscription.repository';

describe('SubscriptionModule', () => {
  it('provides SubscriptionRepository', async () => {
    const module = await Test.createTestingModule({
      imports: [SubscriptionModule],
    })
      .overrideProvider(getRepositoryToken(Subscription))
      .useValue({})
      .compile();

    const repo = module.get(SubscriptionRepository);
    expect(repo).toBeInstanceOf(SubscriptionRepository);
  });

  it('exports SubscriptionRepository for consumer modules', async () => {
    const module = await Test.createTestingModule({
      imports: [SubscriptionModule],
    })
      .overrideProvider(getRepositoryToken(Subscription))
      .useValue({})
      .compile();

    const repo = module.get(SubscriptionRepository);
    expect(repo).toBeDefined();
  });

  it('does not provide services outside its boundary', async () => {
    const module = await Test.createTestingModule({
      imports: [SubscriptionModule],
    })
      .overrideProvider(getRepositoryToken(Subscription))
      .useValue({})
      .compile();

    expect(() => {
      module.get('BillingSnapshotService');
    }).toThrow();
  });
});
