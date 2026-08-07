import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AdminCreditGrantService } from './admin-credit-grant.service';
import { User } from '../entities/user.entity';
import { CreditGrantService } from '../billing/credit-grant/credit-grant.service';
import { AdminCreditGrantRequestDto } from './dto/admin-credit-grant.dto';

describe('AdminCreditGrantService (ADMIN-CONSOLE-01B)', () => {
  let service: AdminCreditGrantService;
  let userRepository: jest.Mocked<Repository<User>>;
  let creditGrantService: jest.Mocked<CreditGrantService>;

  beforeEach(() => {
    userRepository = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;

    creditGrantService = {
      processGrant: jest.fn(),
    } as unknown as jest.Mocked<CreditGrantService>;

    service = new AdminCreditGrantService(userRepository, creditGrantService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('verifies target user and calls CreditGrantService with locked admin contract', async () => {
    const dto: AdminCreditGrantRequestDto = {
      amount: 125,
      reason: 'manual correction',
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
    };

    userRepository.findOne.mockResolvedValue({ id: 'target-user-1' } as User);
    creditGrantService.processGrant.mockResolvedValue({
      grantId: 'grant-1',
      status: 'granted',
      amount: 125,
      balanceBefore: 300,
      balanceAfter: 425,
    });

    const result = await service.grantCredits('target-user-1', 'admin-user-1', dto);

    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'target-user-1' },
      select: ['id'],
    });
    expect(creditGrantService.processGrant).toHaveBeenCalledWith({
      ownerId: 'target-user-1',
      grantType: 'admin',
      amount: 125,
      reason: 'manual correction',
      grantedByUserId: 'admin-user-1',
      sourceEventId: '11111111-1111-4111-8111-111111111111',
    });
    expect(creditGrantService.processGrant).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      grantId: 'grant-1',
      status: 'granted',
      amount: 125,
      balanceBefore: 300,
      balanceAfter: 425,
    });
  });

  it('throws NotFoundException and does not call CreditGrantService when target user is missing', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(
      service.grantCredits('missing-user', 'admin-user-1', {
        amount: 50,
        reason: 'manual adjustment',
        idempotencyKey: '22222222-2222-4222-8222-222222222222',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(creditGrantService.processGrant).not.toHaveBeenCalled();
  });

  it('preserves duplicate and failed statuses from CreditGrantService', async () => {
    userRepository.findOne.mockResolvedValue({ id: 'target-user-1' } as User);

    creditGrantService.processGrant.mockResolvedValueOnce({
      grantId: 'grant-duplicate',
      status: 'duplicate',
      amount: 75,
      balanceBefore: 200,
      balanceAfter: 275,
    });

    const duplicateResult = await service.grantCredits('target-user-1', 'admin-user-1', {
      amount: 75,
      reason: 'support case',
      idempotencyKey: '33333333-3333-4333-8333-333333333333',
    });
    expect(duplicateResult.status).toBe('duplicate');

    creditGrantService.processGrant.mockResolvedValueOnce({
      grantId: 'grant-failed',
      status: 'failed',
      amount: 60,
      balanceBefore: 0,
      balanceAfter: 0,
      errorCode: 'BALANCE_NOT_FOUND',
      errorMessage: 'No credit_balance row for owner',
    });

    const failedResult = await service.grantCredits('target-user-1', 'admin-user-1', {
      amount: 60,
      reason: 'support case',
      idempotencyKey: '44444444-4444-4444-8444-444444444444',
    });
    expect(failedResult.status).toBe('failed');
  });
});
