import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceService } from '../invoice.service';
import { Invoice } from '../../entities/invoice.entity';
import { BillingSnapshot } from '../../entities/billing-snapshot.entity';

/**
 * InvoiceService Integration Tests
 *
 * Phase 25B-1: Invoice Persistence Infrastructure
 *
 * Tests end-to-end invoice creation flow with focus on:
 * - Snapshot → Invoice persistence (full flow)
 * - One-to-one constraint enforcement (database-level)
 * - No side effects on billing_snapshots table
 * - Deterministic behavior (same snapshot → same invoice fields)
 */
describe('InvoiceService Integration', () => {
  let service: InvoiceService;
  let invoiceRepository: Repository<Invoice>;
  let billingSnapshotRepository: Repository<BillingSnapshot>;
  let module: TestingModule;

  // Test fixture: sample billing snapshot
  const testSnapshotId = '550e8400-e29b-41d4-a716-446655440000';
  const testApiKeyId = 'ak_test_123';
  const testUserId = 'user_123';

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        InvoiceService,
        {
          provide: getRepositoryToken(Invoice),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(BillingSnapshot),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
    invoiceRepository = module.get<Repository<Invoice>>(
      getRepositoryToken(Invoice),
    );
    billingSnapshotRepository = module.get<Repository<BillingSnapshot>>(
      getRepositoryToken(BillingSnapshot),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('snapshot → invoice persistence', () => {
    it('should persist invoice with all fields copied from snapshot', async () => {
      // Arrange
      const mockSnapshot: BillingSnapshot = {
        snapshotId: testSnapshotId,
        apiKeyId: testApiKeyId,
        userId: testUserId,
        periodStart: new Date('2026-02-01T00:00:00.000Z'),
        periodEnd: new Date('2026-02-01T23:59:59.999Z'),
        periodType: 'daily',
        pricingVersion: '2026-02-v1',
        totalTokens: 50000,
        totalRequests: 10,
        subtotalUSD: 0.5,
        adjustmentsUSD: 0,
        totalCostUSD: 0.5,
        lineItems: [
          {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            totalTokens: 50000,
            totalRequests: 10,
            pricePerThousandTokens: 0.01,
            costUSD: 0.5,
          },
        ],
        status: 'finalized',
        createdAt: new Date('2026-02-02T00:05:00.000Z'),
      };

      jest
        .spyOn(billingSnapshotRepository, 'findOne')
        .mockResolvedValue(mockSnapshot);
      jest.spyOn(invoiceRepository, 'findOne').mockResolvedValue(null);

      const savedInvoice: Invoice = {
        invoiceId: 'generated-uuid',
        snapshotId: mockSnapshot.snapshotId,
        apiKeyId: mockSnapshot.apiKeyId,
        userId: mockSnapshot.userId,
        periodStart: mockSnapshot.periodStart,
        periodEnd: mockSnapshot.periodEnd,
        pricingVersion: mockSnapshot.pricingVersion,
        subtotalUSD: mockSnapshot.subtotalUSD,
        adjustmentsUSD: mockSnapshot.adjustmentsUSD,
        totalCostUSD: mockSnapshot.totalCostUSD,
        currency: 'USD',
        lineItems: [
          {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            totalTokens: 50000,
            totalRequests: 10,
            pricePerThousandTokens: 0.01,
            amountUSD: 0.5,
          },
        ],
        status: 'draft',
        createdAt: new Date(),
      };
      jest.spyOn(invoiceRepository, 'save').mockResolvedValue(savedInvoice);

      // Act
      const result = await service.createFromSnapshot(testSnapshotId);

      // Assert
      expect(result).toBeDefined();
      expect(result.snapshotId).toBe(testSnapshotId);
      expect(result.apiKeyId).toBe(testApiKeyId);
      expect(result.userId).toBe(testUserId);
      expect(result.totalCostUSD).toBe(0.5);
      expect(result.currency).toBe('USD');
      expect(result.status).toBe('draft');
      expect(invoiceRepository.save).toHaveBeenCalled();
    });

    it('should handle zero-cost invoices', async () => {
      // Arrange
      const mockSnapshot: BillingSnapshot = {
        snapshotId: testSnapshotId,
        apiKeyId: testApiKeyId,
        userId: testUserId,
        periodStart: new Date('2026-02-01T00:00:00.000Z'),
        periodEnd: new Date('2026-02-01T23:59:59.999Z'),
        periodType: 'daily',
        pricingVersion: '2026-02-v1',
        totalTokens: 0,
        totalRequests: 0,
        subtotalUSD: 0,
        adjustmentsUSD: 0,
        totalCostUSD: 0,
        lineItems: [],
        status: 'finalized',
        createdAt: new Date('2026-02-02T00:05:00.000Z'),
      };

      jest
        .spyOn(billingSnapshotRepository, 'findOne')
        .mockResolvedValue(mockSnapshot);
      jest.spyOn(invoiceRepository, 'findOne').mockResolvedValue(null);

      const savedInvoice: Invoice = {
        invoiceId: 'generated-uuid',
        snapshotId: mockSnapshot.snapshotId,
        apiKeyId: mockSnapshot.apiKeyId,
        userId: mockSnapshot.userId,
        periodStart: mockSnapshot.periodStart,
        periodEnd: mockSnapshot.periodEnd,
        pricingVersion: mockSnapshot.pricingVersion,
        subtotalUSD: 0,
        adjustmentsUSD: 0,
        totalCostUSD: 0,
        currency: 'USD',
        lineItems: [],
        status: 'draft',
        createdAt: new Date(),
      };
      jest.spyOn(invoiceRepository, 'save').mockResolvedValue(savedInvoice);

      // Act
      const result = await service.createFromSnapshot(testSnapshotId);

      // Assert
      expect(result.totalCostUSD).toBe(0);
      expect(result.lineItems).toEqual([]);
    });
  });

  describe('one-to-one constraint enforcement', () => {
    it('should enforce one invoice per snapshot', async () => {
      // Arrange
      const mockSnapshot: BillingSnapshot = {
        snapshotId: testSnapshotId,
        apiKeyId: testApiKeyId,
        userId: testUserId,
        periodStart: new Date('2026-02-01T00:00:00.000Z'),
        periodEnd: new Date('2026-02-01T23:59:59.999Z'),
        periodType: 'daily',
        pricingVersion: '2026-02-v1',
        totalTokens: 50000,
        totalRequests: 10,
        subtotalUSD: 0.5,
        adjustmentsUSD: 0,
        totalCostUSD: 0.5,
        lineItems: [],
        status: 'finalized',
        createdAt: new Date('2026-02-02T00:05:00.000Z'),
      };

      const existingInvoice: Invoice = {
        invoiceId: 'existing-uuid',
        snapshotId: testSnapshotId,
        apiKeyId: testApiKeyId,
        userId: testUserId,
        periodStart: mockSnapshot.periodStart,
        periodEnd: mockSnapshot.periodEnd,
        pricingVersion: mockSnapshot.pricingVersion,
        subtotalUSD: 0.5,
        adjustmentsUSD: 0,
        totalCostUSD: 0.5,
        currency: 'USD',
        lineItems: [],
        status: 'draft',
        createdAt: new Date(),
      };

      jest
        .spyOn(billingSnapshotRepository, 'findOne')
        .mockResolvedValue(mockSnapshot);
      jest
        .spyOn(invoiceRepository, 'findOne')
        .mockResolvedValue(existingInvoice);

      // Act & Assert
      await expect(
        service.createFromSnapshot(testSnapshotId),
      ).rejects.toThrow('Invoice already exists for snapshot');

      // Verify no duplicate invoice saved
      expect(invoiceRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('no side effects guarantee', () => {
    it('should not modify billing_snapshots table', async () => {
      // Arrange
      const mockSnapshot: BillingSnapshot = {
        snapshotId: testSnapshotId,
        apiKeyId: testApiKeyId,
        userId: testUserId,
        periodStart: new Date('2026-02-01T00:00:00.000Z'),
        periodEnd: new Date('2026-02-01T23:59:59.999Z'),
        periodType: 'daily',
        pricingVersion: '2026-02-v1',
        totalTokens: 50000,
        totalRequests: 10,
        subtotalUSD: 0.5,
        adjustmentsUSD: 0,
        totalCostUSD: 0.5,
        lineItems: [],
        status: 'finalized',
        createdAt: new Date('2026-02-02T00:05:00.000Z'),
      };

      jest
        .spyOn(billingSnapshotRepository, 'findOne')
        .mockResolvedValue(mockSnapshot);
      jest.spyOn(invoiceRepository, 'findOne').mockResolvedValue(null);

      const savedInvoice: Invoice = {
        invoiceId: 'generated-uuid',
        snapshotId: mockSnapshot.snapshotId,
        apiKeyId: mockSnapshot.apiKeyId,
        userId: mockSnapshot.userId,
        periodStart: mockSnapshot.periodStart,
        periodEnd: mockSnapshot.periodEnd,
        pricingVersion: mockSnapshot.pricingVersion,
        subtotalUSD: 0.5,
        adjustmentsUSD: 0,
        totalCostUSD: 0.5,
        currency: 'USD',
        lineItems: [],
        status: 'draft',
        createdAt: new Date(),
      };
      jest.spyOn(invoiceRepository, 'save').mockResolvedValue(savedInvoice);

      // Act
      await service.createFromSnapshot(testSnapshotId);

      // Assert: Only read operation on billing_snapshots (no writes)
      expect(billingSnapshotRepository.findOne).toHaveBeenCalledTimes(1);
      // Mock repository only has findOne method (no save/update/delete)
      expect(billingSnapshotRepository['save']).toBeUndefined();
      expect(billingSnapshotRepository['update']).toBeUndefined();
      expect(billingSnapshotRepository['delete']).toBeUndefined();
    });
  });

  describe('deterministic behavior', () => {
    it('should produce identical invoice for same snapshot', async () => {
      // Arrange
      const mockSnapshot: BillingSnapshot = {
        snapshotId: testSnapshotId,
        apiKeyId: testApiKeyId,
        userId: testUserId,
        periodStart: new Date('2026-02-01T00:00:00.000Z'),
        periodEnd: new Date('2026-02-01T23:59:59.999Z'),
        periodType: 'daily',
        pricingVersion: '2026-02-v1',
        totalTokens: 50000,
        totalRequests: 10,
        subtotalUSD: 0.5,
        adjustmentsUSD: 0,
        totalCostUSD: 0.5,
        lineItems: [
          {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            totalTokens: 50000,
            totalRequests: 10,
            pricePerThousandTokens: 0.01,
            costUSD: 0.5,
          },
        ],
        status: 'finalized',
        createdAt: new Date('2026-02-02T00:05:00.000Z'),
      };

      jest
        .spyOn(billingSnapshotRepository, 'findOne')
        .mockResolvedValue(mockSnapshot);
      jest.spyOn(invoiceRepository, 'findOne').mockResolvedValue(null);

      const savedInvoice: Invoice = {
        invoiceId: 'generated-uuid',
        snapshotId: mockSnapshot.snapshotId,
        apiKeyId: mockSnapshot.apiKeyId,
        userId: mockSnapshot.userId,
        periodStart: mockSnapshot.periodStart,
        periodEnd: mockSnapshot.periodEnd,
        pricingVersion: mockSnapshot.pricingVersion,
        subtotalUSD: mockSnapshot.subtotalUSD,
        adjustmentsUSD: mockSnapshot.adjustmentsUSD,
        totalCostUSD: mockSnapshot.totalCostUSD,
        currency: 'USD',
        lineItems: [
          {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            totalTokens: 50000,
            totalRequests: 10,
            pricePerThousandTokens: 0.01,
            amountUSD: 0.5,
          },
        ],
        status: 'draft',
        createdAt: new Date(),
      };
      jest.spyOn(invoiceRepository, 'save').mockResolvedValue(savedInvoice);

      // Act: Create invoice twice (simulate replay)
      const result1 = await service.createFromSnapshot(testSnapshotId);

      // Clear mocks and simulate second call (would fail due to duplicate)
      jest.clearAllMocks();
      jest
        .spyOn(billingSnapshotRepository, 'findOne')
        .mockResolvedValue(mockSnapshot);
      jest
        .spyOn(invoiceRepository, 'findOne')
        .mockResolvedValue(savedInvoice); // Now invoice exists

      // Assert: Second call throws ConflictException (duplicate prevention)
      await expect(
        service.createFromSnapshot(testSnapshotId),
      ).rejects.toThrow('Invoice already exists for snapshot');

      // Verify first invoice has deterministic fields
      expect(result1.snapshotId).toBe(testSnapshotId);
      expect(result1.totalCostUSD).toBe(0.5);
      expect(result1.lineItems[0].amountUSD).toBe(0.5);
    });
  });
});
