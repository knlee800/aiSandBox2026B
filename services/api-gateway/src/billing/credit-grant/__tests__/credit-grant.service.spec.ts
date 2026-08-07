import {
  CreditGrantService,
  CreditGrantAmountError,
} from '../credit-grant.service';
import type { CreditGrantRepository } from '../credit-grant.repository';
import type { CreditBalanceRepository } from '../../credit-deduction/credit-balance.repository';
import type { CreditGrant } from '../../../entities/credit-grant.entity';
import type { CreditBalance } from '../../../entities/credit-balance.entity';
import type { DataSource } from 'typeorm';

describe('CreditGrantService (05E)', () => {
  let service: CreditGrantService;
  let mockGrantRepo: jest.Mocked<Partial<CreditGrantRepository>>;
  let mockBalanceRepo: jest.Mocked<Partial<CreditBalanceRepository>>;
  let mockDataSource: jest.Mocked<Partial<DataSource>>;

  const stubBalance: CreditBalance = {
    id: 'bal-uuid-1',
    ownerId: 'user-uuid-1',
    ownerType: 'user',
    planId: 'starter',
    balance: 5000,
    monthlyAllocation: 5000,
    rolloverBalance: 0,
    status: 'active',
    periodStart: new Date('2026-07-01'),
    periodEnd: new Date('2026-08-01'),
    resetAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const stubGrantRecord: CreditGrant = {
    id: 'grant-uuid-1',
    ownerId: 'user-uuid-1',
    ownerType: 'user',
    grantType: 'topup',
    sourceType: 'webhook',
    sourceEventId: 'evt_test_001',
    provider: 'stripe',
    providerEventId: 'evt_test_001',
    webhookEventId: 'webhook-evt-uuid-1',
    planType: null,
    topUpPackId: 'topup_1000',
    grantedByUserId: null,
    reason: null,
    amount: 1000,
    balanceBefore: 5000,
    balanceAfter: 6000,
    status: 'pending',
    errorCode: null,
    errorMessage: null,
    grantedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockGrantRepo = {
      findBySourceEventId: jest.fn().mockResolvedValue(null),
      createGrant: jest.fn().mockResolvedValue(stubGrantRecord),
      markGranted: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
      markIgnored: jest.fn().mockResolvedValue(undefined),
    };

    mockBalanceRepo = {
      findByOwnerForUpdate: jest.fn().mockResolvedValue(stubBalance),
      addBalance: jest.fn().mockResolvedValue({
        ...stubBalance,
        balance: 6000,
      }),
      resetForNewPeriod: jest.fn(),
    };

    // transaction() executes the callback directly (simulates single-connection transaction)
    mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb: any) => {
        return await cb({} as any);
      }),
    };

    service = new CreditGrantService(
      mockGrantRepo as any,
      mockBalanceRepo as any,
      mockDataSource as any,
    );
  });

  // -------------------------------------------------------------------------
  // Top-up grant — amount resolution
  // -------------------------------------------------------------------------

  describe('top-up grant amount resolution', () => {
    it('should resolve topup_1000 to 1000 credits', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'topup',
        sourceEventId: 'evt_topup_1000',
        topUpPackId: 'topup_1000',
      });
      expect(result.status).toBe('granted');
      expect(result.amount).toBe(1000);
    });

    it('should resolve topup_5000 to 5000 credits', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'topup',
        sourceEventId: 'evt_topup_5000',
        topUpPackId: 'topup_5000',
      });
      expect(result.status).toBe('granted');
      expect(result.amount).toBe(5000);
    });

    it('should resolve topup_20000 to 20000 credits', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'topup',
        sourceEventId: 'evt_topup_20000',
        topUpPackId: 'topup_20000',
      });
      expect(result.status).toBe('granted');
      expect(result.amount).toBe(20000);
    });

    it('should resolve from metadata.aisandbox_topup_pack_id if topUpPackId not in request', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'topup',
        sourceEventId: 'evt_meta_pack',
        metadata: { aisandbox_topup_pack_id: 'topup_5000' },
      });
      expect(result.status).toBe('granted');
      expect(result.amount).toBe(5000);
    });

    it('should fail with UNKNOWN_PACK for unrecognized pack ID', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'topup',
        sourceEventId: 'evt_unknown_pack',
        topUpPackId: 'topup_99999',
      });
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('UNKNOWN_PACK');
    });

    it('should fail with AMOUNT_RESOLUTION_FAILED when no topUpPackId and no metadata', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'topup',
        sourceEventId: 'evt_no_pack',
      });
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('AMOUNT_RESOLUTION_FAILED');
    });
  });

  // -------------------------------------------------------------------------
  // Subscription grant — amount resolution
  // -------------------------------------------------------------------------

  describe('subscription grant amount resolution', () => {
    it('should resolve free plan to 500 credits', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'subscription_monthly',
        sourceEventId: 'evt_sub_free',
        planType: 'free',
      });
      expect(result.status).toBe('granted');
      expect(result.amount).toBe(500);
    });

    it('should resolve starter plan to 5000 credits', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'subscription_monthly',
        sourceEventId: 'evt_sub_starter',
        planType: 'starter',
      });
      expect(result.status).toBe('granted');
      expect(result.amount).toBe(5000);
    });

    it('should resolve pro plan to 25000 credits', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'subscription_monthly',
        sourceEventId: 'evt_sub_pro',
        planType: 'pro',
      });
      expect(result.status).toBe('granted');
      expect(result.amount).toBe(25000);
    });

    it('should resolve team plan to 100000 credits', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'subscription_monthly',
        sourceEventId: 'evt_sub_team',
        planType: 'team',
      });
      expect(result.status).toBe('granted');
      expect(result.amount).toBe(100000);
    });

    it('should work for subscription_initial grant type', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'subscription_initial',
        sourceEventId: 'evt_sub_initial',
        planType: 'pro',
      });
      expect(result.status).toBe('granted');
      expect(result.amount).toBe(25000);
    });

    it('should fail when planType is missing', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'subscription_monthly',
        sourceEventId: 'evt_no_plan',
      });
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('AMOUNT_RESOLUTION_FAILED');
    });

    it('should fail for unknown plan type', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'subscription_monthly',
        sourceEventId: 'evt_bad_plan',
        planType: 'enterprise_unknown',
      });
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('AMOUNT_RESOLUTION_FAILED');
    });
  });

  // -------------------------------------------------------------------------
  // Admin grant
  // -------------------------------------------------------------------------

  describe('admin grant', () => {
    it('should grant admin credits with exact balance increment', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'admin',
        sourceEventId: 'evt_admin_happy_1',
        amount: 250,
        grantedByUserId: 'admin-user-uuid-1',
        reason: '  manual adjustment for support case  ',
      });

      expect(result.status).toBe('granted');
      expect(result.amount).toBe(250);
      expect(result.balanceBefore).toBe(5000);
      expect(result.balanceAfter).toBe(5250);

      expect(mockGrantRepo.createGrant).toHaveBeenCalledWith(
        expect.objectContaining({
          grantType: 'admin',
          sourceType: 'admin',
          provider: 'admin',
          amount: 250,
          balanceBefore: 5000,
          balanceAfter: 5250,
          grantedByUserId: 'admin-user-uuid-1',
          reason: 'manual adjustment for support case',
        }),
        expect.anything(),
      );

      expect(mockBalanceRepo.addBalance).toHaveBeenCalledWith(
        'bal-uuid-1',
        5250,
        expect.anything(),
      );
      expect(mockBalanceRepo.resetForNewPeriod).not.toHaveBeenCalled();
    });

    it('should reject amount=0', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'admin',
        sourceEventId: 'evt_admin_bad_amt_0',
        amount: 0,
        grantedByUserId: 'admin-user-uuid-1',
        reason: 'reason',
      });
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('INVALID_AMOUNT');
      expect(result.errorMessage).toBe(
        'Admin grant amount must be a positive integer',
      );
    });

    it('should reject negative amount', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'admin',
        sourceEventId: 'evt_admin_bad_amt_neg',
        amount: -10,
        grantedByUserId: 'admin-user-uuid-1',
        reason: 'reason',
      });
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('INVALID_AMOUNT');
      expect(result.errorMessage).toBe(
        'Admin grant amount must be a positive integer',
      );
    });

    it('should reject fractional amount', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'admin',
        sourceEventId: 'evt_admin_bad_amt_fraction',
        amount: 1.5,
        grantedByUserId: 'admin-user-uuid-1',
        reason: 'reason',
      });
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('INVALID_AMOUNT');
      expect(result.errorMessage).toBe(
        'Admin grant amount must be a positive integer',
      );
    });

    it('should reject missing amount', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'admin',
        sourceEventId: 'evt_admin_bad_amt_missing',
        grantedByUserId: 'admin-user-uuid-1',
        reason: 'reason',
      });
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('INVALID_AMOUNT');
      expect(result.errorMessage).toBe(
        'Admin grant amount must be a positive integer',
      );
    });

    it('should reject missing reason', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'admin',
        sourceEventId: 'evt_admin_bad_reason_missing',
        amount: 100,
        grantedByUserId: 'admin-user-uuid-1',
      });
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('INVALID_REASON');
      expect(result.errorMessage).toBe('Admin grant reason is required');
    });

    it('should reject blank reason', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'admin',
        sourceEventId: 'evt_admin_bad_reason_blank',
        amount: 100,
        grantedByUserId: 'admin-user-uuid-1',
        reason: '',
      });
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('INVALID_REASON');
      expect(result.errorMessage).toBe('Admin grant reason is required');
    });

    it('should reject whitespace-only reason', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'admin',
        sourceEventId: 'evt_admin_bad_reason_ws',
        amount: 100,
        grantedByUserId: 'admin-user-uuid-1',
        reason: '   ',
      });
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('INVALID_REASON');
      expect(result.errorMessage).toBe('Admin grant reason is required');
    });

    it('should reject missing grantedByUserId', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'admin',
        sourceEventId: 'evt_admin_bad_granted_by_missing',
        amount: 100,
        reason: 'manual correction',
      });
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('MISSING_GRANTED_BY_USER_ID');
      expect(result.errorMessage).toBe(
        'Admin grant grantedByUserId is required',
      );
    });

    it('should return duplicate and not double-credit for duplicate sourceEventId', async () => {
      mockGrantRepo.findBySourceEventId!.mockResolvedValue({
        ...stubGrantRecord,
        id: 'grant-admin-original',
        grantType: 'admin',
        sourceType: 'admin',
        provider: 'admin',
        sourceEventId: 'evt_admin_dupe',
        amount: 333,
        balanceBefore: 5000,
        balanceAfter: 5333,
        status: 'granted',
        grantedByUserId: 'admin-user-uuid-1',
        reason: 'manual correction',
      });

      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'admin',
        sourceEventId: 'evt_admin_dupe',
        amount: 333,
        grantedByUserId: 'admin-user-uuid-1',
        reason: 'manual correction',
      });

      expect(result.status).toBe('duplicate');
      expect(result.grantId).toBe('grant-admin-original');
      expect(result.amount).toBe(333);
      expect(result.balanceBefore).toBe(5000);
      expect(result.balanceAfter).toBe(5333);
      expect(mockBalanceRepo.addBalance).not.toHaveBeenCalled();
      expect(mockGrantRepo.createGrant).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Idempotency
  // -------------------------------------------------------------------------

  describe('idempotency — duplicate sourceEventId', () => {
    it('should return duplicate when existing grant is granted', async () => {
      mockGrantRepo.findBySourceEventId!.mockResolvedValue({
        ...stubGrantRecord,
        status: 'granted',
      });
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'topup',
        sourceEventId: 'evt_test_001',
        topUpPackId: 'topup_1000',
      });
      expect(result.status).toBe('duplicate');
      expect(result.grantId).toBe('grant-uuid-1');
      // No balance mutation
      expect(mockBalanceRepo.addBalance).not.toHaveBeenCalled();
    });

    it('should not auto-retry previously failed grant', async () => {
      mockGrantRepo.findBySourceEventId!.mockResolvedValue({
        ...stubGrantRecord,
        status: 'failed',
        errorCode: 'BALANCE_NOT_FOUND',
        errorMessage: 'No credit_balance row for owner',
      });
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'topup',
        sourceEventId: 'evt_test_001',
        topUpPackId: 'topup_1000',
      });
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('BALANCE_NOT_FOUND');
      expect(mockBalanceRepo.addBalance).not.toHaveBeenCalled();
    });

    it('should handle 23505 unique constraint race fallback', async () => {
      // First call: no existing grant
      mockGrantRepo.findBySourceEventId!.mockResolvedValueOnce(null);

      // Transaction throws 23505
      const uniqueError = new Error('duplicate key value violates unique constraint');
      (uniqueError as any).code = '23505';
      mockDataSource.transaction!.mockRejectedValueOnce(uniqueError);

      // After race, findBySourceEventId finds the existing grant
      mockGrantRepo.findBySourceEventId!.mockResolvedValueOnce({
        ...stubGrantRecord,
        status: 'granted',
      });

      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'topup',
        sourceEventId: 'evt_test_001',
        topUpPackId: 'topup_1000',
      });
      expect(result.status).toBe('duplicate');
      expect(result.grantId).toBe('grant-uuid-1');
    });
  });

  // -------------------------------------------------------------------------
  // Transaction boundary
  // -------------------------------------------------------------------------

  describe('transaction boundary', () => {
    it('should use DataSource.transaction for atomic grant + balance update', async () => {
      await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'topup',
        sourceEventId: 'evt_txn_test',
        topUpPackId: 'topup_1000',
      });
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('should lock balance row with findByOwnerForUpdate', async () => {
      await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'topup',
        sourceEventId: 'evt_lock_test',
        topUpPackId: 'topup_1000',
      });
      expect(mockBalanceRepo.findByOwnerForUpdate).toHaveBeenCalledWith(
        'user-uuid-1',
        'user',
        expect.anything(),
      );
    });

    it('should correctly compute balanceBefore and balanceAfter', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'topup',
        sourceEventId: 'evt_balance_test',
        topUpPackId: 'topup_1000',
      });
      expect(result.balanceBefore).toBe(5000);
      expect(result.balanceAfter).toBe(6000);
    });

    it('should call addBalance with correct new balance', async () => {
      await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'topup',
        sourceEventId: 'evt_add_test',
        topUpPackId: 'topup_1000',
      });
      expect(mockBalanceRepo.addBalance).toHaveBeenCalledWith(
        'bal-uuid-1',
        6000,
        expect.anything(),
      );
    });

    it('should call markGranted with correct balance snapshots', async () => {
      await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'topup',
        sourceEventId: 'evt_mark_test',
        topUpPackId: 'topup_1000',
      });
      expect(mockGrantRepo.markGranted).toHaveBeenCalledWith(
        'grant-uuid-1',
        5000,
        6000,
        expect.anything(),
      );
    });

    it('should rollback on transaction error — no balance change', async () => {
      mockDataSource.transaction!.mockRejectedValueOnce(
        new Error('DB connection lost'),
      );
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'topup',
        sourceEventId: 'evt_rollback_test',
        topUpPackId: 'topup_1000',
      });
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('TRANSACTION_ERROR');
    });
  });

  // -------------------------------------------------------------------------
  // Missing balance row
  // -------------------------------------------------------------------------

  describe('missing credit balance row', () => {
    it('should fail with BALANCE_NOT_FOUND when no balance row exists', async () => {
      mockBalanceRepo.findByOwnerForUpdate!.mockResolvedValue(null);
      const result = await service.processGrant({
        ownerId: 'user-no-balance',
        grantType: 'topup',
        sourceEventId: 'evt_no_balance',
        topUpPackId: 'topup_1000',
      });
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('BALANCE_NOT_FOUND');
      expect(result.errorMessage).toContain('No credit_balance row');
    });

    it('should persist grant record even on BALANCE_NOT_FOUND', async () => {
      mockBalanceRepo.findByOwnerForUpdate!.mockResolvedValue(null);
      await service.processGrant({
        ownerId: 'user-no-balance',
        grantType: 'topup',
        sourceEventId: 'evt_no_balance_2',
        topUpPackId: 'topup_1000',
      });
      expect(mockGrantRepo.createGrant).toHaveBeenCalled();
      expect(mockGrantRepo.markFailed).toHaveBeenCalledWith(
        expect.any(String),
        'BALANCE_NOT_FOUND',
        expect.any(String),
        expect.anything(),
      );
    });
  });

  // -------------------------------------------------------------------------
  // No provider calls
  // -------------------------------------------------------------------------

  describe('no provider/env dependency', () => {
    it('should not import stripe', () => {
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(
        path.resolve(__dirname, '../credit-grant.service.ts'),
        'utf8',
      );
      expect(source).not.toContain("from 'stripe'");
      expect(source).not.toContain('process.env');
    });
  });

  // -------------------------------------------------------------------------
  // Unknown/ignored events — no mutation
  // -------------------------------------------------------------------------

  describe('no mutation on failed grants', () => {
    it('should not call addBalance when grant fails', async () => {
      const result = await service.processGrant({
        ownerId: 'user-uuid-1',
        grantType: 'topup',
        sourceEventId: 'evt_fail_no_mut',
        topUpPackId: 'topup_unknown',
      });
      expect(result.status).toBe('failed');
      expect(mockBalanceRepo.addBalance).not.toHaveBeenCalled();
    });
  });
});
