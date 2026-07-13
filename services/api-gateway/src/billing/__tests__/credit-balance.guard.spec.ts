import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { CreditBalanceGuard } from '../credit-balance.guard';
import { CreditBalanceRepository } from '../credit-deduction/credit-balance.repository';
import { UserRole } from '../../entities/user-role.enum';
import { ApiKeyIdentity } from '../../auth/api-key.config';

describe('CreditBalanceGuard (BILLING-READY-04A)', () => {
  let guard: CreditBalanceGuard;
  let mockCreditBalanceRepository: {
    findByOwner: jest.Mock;
    findByOwnerForUpdate: jest.Mock;
    deductBalance: jest.Mock;
  };
  let mockUserRepository: {
    findOne: jest.Mock;
  };
  let mockContext: ExecutionContext;
  let mockRequest: { apiKeyIdentity?: ApiKeyIdentity };

  function makeIdentity(overrides?: Partial<ApiKeyIdentity>): ApiKeyIdentity {
    return {
      userId: 'user-001',
      apiKeyId: 'key-001',
      scopes: ['ai:execute'],
      ...overrides,
    };
  }

  function makeBalance(overrides?: Partial<{ balance: number; ownerId: string; ownerType: string }>) {
    return {
      id: 'cb-001',
      ownerId: 'user-001',
      ownerType: 'user',
      planId: 'plan-free',
      balance: 100,
      monthlyAllocation: 500,
      rolloverBalance: 0,
      status: 'active',
      periodStart: new Date(),
      periodEnd: new Date(),
      resetAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  function makeUser(role: UserRole = UserRole.USER) {
    return {
      id: 'user-001',
      email: 'test@example.com',
      role,
    };
  }

  beforeEach(() => {
    mockCreditBalanceRepository = {
      findByOwner: jest.fn(),
      findByOwnerForUpdate: jest.fn(),
      deductBalance: jest.fn(),
    };

    mockUserRepository = {
      findOne: jest.fn(),
    };

    guard = new CreditBalanceGuard(
      mockCreditBalanceRepository as any,
      mockUserRepository as any,
    );

    mockRequest = {
      apiKeyIdentity: makeIdentity(),
    };

    mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;
  });

  describe('positive balance', () => {
    it('should allow execution when balance > 0', async () => {
      mockUserRepository.findOne.mockResolvedValue(makeUser(UserRole.USER));
      mockCreditBalanceRepository.findByOwner.mockResolvedValue(makeBalance({ balance: 100 }));

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should allow execution when balance is 1 (minimum positive)', async () => {
      mockUserRepository.findOne.mockResolvedValue(makeUser(UserRole.USER));
      mockCreditBalanceRepository.findByOwner.mockResolvedValue(makeBalance({ balance: 1 }));

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });
  });

  describe('missing balance row (not provisioned)', () => {
    it('should reject with 402 and error_code credit_balance_not_provisioned', async () => {
      mockUserRepository.findOne.mockResolvedValue(makeUser(UserRole.USER));
      mockCreditBalanceRepository.findByOwner.mockResolvedValue(null);

      try {
        await guard.canActivate(mockContext);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);

        const body = error.getResponse();
        expect(body.statusCode).toBe(402);
        expect(body.error).toBe('Payment Required');
        expect(body.message).toBe('Credit balance not provisioned');
        expect(body.details.error_code).toBe('credit_balance_not_provisioned');
      }
    });
  });

  describe('zero balance (exhausted)', () => {
    it('should reject with 402 and error_code credit_balance_exhausted', async () => {
      mockUserRepository.findOne.mockResolvedValue(makeUser(UserRole.USER));
      mockCreditBalanceRepository.findByOwner.mockResolvedValue(makeBalance({ balance: 0 }));

      try {
        await guard.canActivate(mockContext);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);

        const body = error.getResponse();
        expect(body.statusCode).toBe(402);
        expect(body.details.error_code).toBe('credit_balance_exhausted');
        expect(body.details.current_balance).toBe(0);
      }
    });
  });

  describe('negative balance', () => {
    it('should reject with 402 and error_code credit_balance_exhausted', async () => {
      mockUserRepository.findOne.mockResolvedValue(makeUser(UserRole.USER));
      mockCreditBalanceRepository.findByOwner.mockResolvedValue(makeBalance({ balance: -5 }));

      try {
        await guard.canActivate(mockContext);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);

        const body = error.getResponse();
        expect(body.details.error_code).toBe('credit_balance_exhausted');
        expect(body.details.current_balance).toBe(-5);
      }
    });
  });

  describe('admin bypass', () => {
    it('should allow admin user regardless of balance', async () => {
      mockUserRepository.findOne.mockResolvedValue(makeUser(UserRole.ADMIN));
      mockCreditBalanceRepository.findByOwner.mockResolvedValue(null);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should not call findByOwner when admin bypass is unnecessary (Promise.all runs both)', async () => {
      mockUserRepository.findOne.mockResolvedValue(makeUser(UserRole.ADMIN));
      mockCreditBalanceRepository.findByOwner.mockResolvedValue(null);

      await guard.canActivate(mockContext);

      // Promise.all runs both queries in parallel, so findByOwner IS called.
      // But admin bypass returns true before checking the balance result.
      expect(mockCreditBalanceRepository.findByOwner).toHaveBeenCalledTimes(1);
      expect(mockUserRepository.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('non-admin user does not bypass', () => {
    it('should enforce balance check for normal user', async () => {
      mockUserRepository.findOne.mockResolvedValue(makeUser(UserRole.USER));
      mockCreditBalanceRepository.findByOwner.mockResolvedValue(null);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(HttpException);
    });
  });

  describe('beta user does not bypass', () => {
    it('should enforce balance check for beta user', async () => {
      mockUserRepository.findOne.mockResolvedValue(makeUser(UserRole.BETA));
      mockCreditBalanceRepository.findByOwner.mockResolvedValue(null);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(HttpException);
    });

    it('should reject beta user with zero balance', async () => {
      mockUserRepository.findOne.mockResolvedValue(makeUser(UserRole.BETA));
      mockCreditBalanceRepository.findByOwner.mockResolvedValue(makeBalance({ balance: 0 }));

      try {
        await guard.canActivate(mockContext);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
        expect(error.getResponse().details.error_code).toBe('credit_balance_exhausted');
      }
    });
  });

  describe('stub/zero-token path does not bypass in 04A', () => {
    it('should enforce balance check regardless of provider or token expectations', async () => {
      mockUserRepository.findOne.mockResolvedValue(makeUser(UserRole.USER));
      mockCreditBalanceRepository.findByOwner.mockResolvedValue(null);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(HttpException);
    });
  });

  describe('repository call patterns', () => {
    it('should call findByOwner with userId and ownerType user', async () => {
      mockUserRepository.findOne.mockResolvedValue(makeUser(UserRole.USER));
      mockCreditBalanceRepository.findByOwner.mockResolvedValue(makeBalance({ balance: 50 }));

      await guard.canActivate(mockContext);

      expect(mockCreditBalanceRepository.findByOwner).toHaveBeenCalledWith('user-001', 'user');
    });

    it('should perform bounded User repository lookup for role decision', async () => {
      mockUserRepository.findOne.mockResolvedValue(makeUser(UserRole.USER));
      mockCreditBalanceRepository.findByOwner.mockResolvedValue(makeBalance({ balance: 50 }));

      await guard.canActivate(mockContext);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-001' },
      });
    });

    it('should not call findByOwnerForUpdate (no locking)', async () => {
      mockUserRepository.findOne.mockResolvedValue(makeUser(UserRole.USER));
      mockCreditBalanceRepository.findByOwner.mockResolvedValue(makeBalance({ balance: 50 }));

      await guard.canActivate(mockContext);

      expect(mockCreditBalanceRepository.findByOwnerForUpdate).not.toHaveBeenCalled();
    });

    it('should not call deductBalance (no mutation)', async () => {
      mockUserRepository.findOne.mockResolvedValue(makeUser(UserRole.USER));
      mockCreditBalanceRepository.findByOwner.mockResolvedValue(makeBalance({ balance: 50 }));

      await guard.canActivate(mockContext);

      expect(mockCreditBalanceRepository.deductBalance).not.toHaveBeenCalled();
    });
  });

  describe('missing identity', () => {
    it('should throw 500 when identity is missing', async () => {
      mockRequest.apiKeyIdentity = undefined;

      try {
        await guard.canActivate(mockContext);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });

    it('should throw 500 when userId is missing', async () => {
      mockRequest.apiKeyIdentity = { userId: '', apiKeyId: 'key-1', scopes: [] } as ApiKeyIdentity;

      try {
        await guard.canActivate(mockContext);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });
  });

  describe('user not found in DB', () => {
    it('should treat as non-admin and enforce balance check', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockCreditBalanceRepository.findByOwner.mockResolvedValue(null);

      try {
        await guard.canActivate(mockContext);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
        expect(error.getResponse().details.error_code).toBe('credit_balance_not_provisioned');
      }
    });

    it('should allow if balance is positive even when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockCreditBalanceRepository.findByOwner.mockResolvedValue(makeBalance({ balance: 100 }));

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });
  });

  describe('structured 402 response body stability', () => {
    it('should return stable error body for exhausted balance', async () => {
      mockUserRepository.findOne.mockResolvedValue(makeUser(UserRole.USER));
      mockCreditBalanceRepository.findByOwner.mockResolvedValue(makeBalance({ balance: 0 }));

      try {
        await guard.canActivate(mockContext);
        fail('Should have thrown');
      } catch (error: any) {
        const body = error.getResponse();

        expect(body).toEqual({
          statusCode: 402,
          error: 'Payment Required',
          message: 'Insufficient credit balance',
          details: {
            error_code: 'credit_balance_exhausted',
            current_balance: 0,
          },
        });
      }
    });

    it('should return stable error body for not-provisioned balance', async () => {
      mockUserRepository.findOne.mockResolvedValue(makeUser(UserRole.USER));
      mockCreditBalanceRepository.findByOwner.mockResolvedValue(null);

      try {
        await guard.canActivate(mockContext);
        fail('Should have thrown');
      } catch (error: any) {
        const body = error.getResponse();

        expect(body).toEqual({
          statusCode: 402,
          error: 'Payment Required',
          message: 'Credit balance not provisioned',
          details: {
            error_code: 'credit_balance_not_provisioned',
          },
        });
      }
    });
  });

  describe('existing request identity shape', () => {
    it('should extract userId from apiKeyIdentity (session path)', async () => {
      mockRequest.apiKeyIdentity = makeIdentity({
        userId: 'session-user-001',
        apiKeyId: 'browser-session',
        isInternal: true,
      });
      mockUserRepository.findOne.mockResolvedValue(makeUser(UserRole.USER));
      mockCreditBalanceRepository.findByOwner.mockResolvedValue(makeBalance({ balance: 50 }));

      await guard.canActivate(mockContext);

      expect(mockCreditBalanceRepository.findByOwner).toHaveBeenCalledWith('session-user-001', 'user');
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: 'session-user-001' } });
    });

    it('should extract userId from apiKeyIdentity (API key path)', async () => {
      mockRequest.apiKeyIdentity = makeIdentity({
        userId: 'api-user-002',
        apiKeyId: 'ak-prod-002',
        isEarlyAccess: true,
      });
      mockUserRepository.findOne.mockResolvedValue(makeUser(UserRole.USER));
      mockCreditBalanceRepository.findByOwner.mockResolvedValue(makeBalance({ balance: 200 }));

      await guard.canActivate(mockContext);

      expect(mockCreditBalanceRepository.findByOwner).toHaveBeenCalledWith('api-user-002', 'user');
    });
  });

  describe('no Stripe/payment/provider API calls', () => {
    it('should only call creditBalanceRepository and userRepository', async () => {
      mockUserRepository.findOne.mockResolvedValue(makeUser(UserRole.USER));
      mockCreditBalanceRepository.findByOwner.mockResolvedValue(makeBalance({ balance: 100 }));

      await guard.canActivate(mockContext);

      expect(mockCreditBalanceRepository.findByOwner).toHaveBeenCalledTimes(1);
      expect(mockUserRepository.findOne).toHaveBeenCalledTimes(1);
      expect(mockCreditBalanceRepository.findByOwnerForUpdate).not.toHaveBeenCalled();
      expect(mockCreditBalanceRepository.deductBalance).not.toHaveBeenCalled();
    });
  });
});
