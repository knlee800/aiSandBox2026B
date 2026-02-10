import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { InvoiceService } from '../invoice.service';
import { Invoice } from '../../entities/invoice.entity';
import { BillingSnapshot } from '../../entities/billing-snapshot.entity';

/**
 * InvoiceService Unit Tests
 *
 * Phase 25B-1: Invoice Persistence Infrastructure
 *
 * Tests invoice creation from billing snapshots with focus on:
 * - Snapshot → Invoice field mapping (deterministic)
 * - Duplicate prevention (ConflictException)
 * - Snapshot not found (NotFoundException)
 * - Immutability (no update/delete methods)
 * - No side effects on billing_snapshots table
 * - No billing calculations (values copied verbatim)
 */
describe('InvoiceService', () => {
  let service: InvoiceService;
  let invoiceRepository: Repository<Invoice>;
  let billingSnapshotRepository: Repository<BillingSnapshot>;

  // Test fixture: sample billing snapshot
  const mockSnapshot: BillingSnapshot = {
    snapshotId: '550e8400-e29b-41d4-a716-446655440000',
    apiKeyId: 'ak_test_123',
    userId: 'user_123',
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        {
          provide: getRepositoryToken(Invoice),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
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

  describe('createFromSnapshot', () => {
    it('should create invoice from billing snapshot with deterministic field mapping', async () => {
      // Arrange
      jest
        .spyOn(billingSnapshotRepository, 'findOne')
        .mockResolvedValue(mockSnapshot);
      jest.spyOn(invoiceRepository, 'findOne').mockResolvedValue(null); // No existing invoice

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
      const result = await service.createFromSnapshot(mockSnapshot.snapshotId);

      // Assert
      expect(result).toBeDefined();
      expect(result.snapshotId).toBe(mockSnapshot.snapshotId);
      expect(result.apiKeyId).toBe(mockSnapshot.apiKeyId);
      expect(result.userId).toBe(mockSnapshot.userId);
      expect(result.periodStart).toEqual(mockSnapshot.periodStart);
      expect(result.periodEnd).toEqual(mockSnapshot.periodEnd);
      expect(result.pricingVersion).toBe(mockSnapshot.pricingVersion);
      expect(result.subtotalUSD).toBe(mockSnapshot.subtotalUSD);
      expect(result.adjustmentsUSD).toBe(mockSnapshot.adjustmentsUSD);
      expect(result.totalCostUSD).toBe(mockSnapshot.totalCostUSD);
      expect(result.currency).toBe('USD');
      expect(result.status).toBe('draft');
      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0].provider).toBe('anthropic');
      expect(result.lineItems[0].amountUSD).toBe(0.5);

      // Verify repositories called correctly
      expect(billingSnapshotRepository.findOne).toHaveBeenCalledWith({
        where: { snapshotId: mockSnapshot.snapshotId },
      });
      expect(invoiceRepository.findOne).toHaveBeenCalledWith({
        where: { snapshotId: mockSnapshot.snapshotId },
      });
      expect(invoiceRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if billing snapshot not found', async () => {
      // Arrange
      jest.spyOn(billingSnapshotRepository, 'findOne').mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.createFromSnapshot('nonexistent-snapshot-id'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.createFromSnapshot('nonexistent-snapshot-id'),
      ).rejects.toThrow('Billing snapshot not found: nonexistent-snapshot-id');

      // Verify no invoice was saved
      expect(invoiceRepository.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if invoice already exists for snapshot', async () => {
      // Arrange
      jest
        .spyOn(billingSnapshotRepository, 'findOne')
        .mockResolvedValue(mockSnapshot);

      const existingInvoice: Invoice = {
        invoiceId: 'existing-uuid',
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
        lineItems: [],
        status: 'draft',
        createdAt: new Date(),
      };
      jest
        .spyOn(invoiceRepository, 'findOne')
        .mockResolvedValue(existingInvoice);

      // Act & Assert
      await expect(
        service.createFromSnapshot(mockSnapshot.snapshotId),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.createFromSnapshot(mockSnapshot.snapshotId),
      ).rejects.toThrow(
        `Invoice already exists for snapshot: ${mockSnapshot.snapshotId}`,
      );

      // Verify no new invoice was saved
      expect(invoiceRepository.save).not.toHaveBeenCalled();
    });

    it('should copy line items correctly (map costUSD → amountUSD)', async () => {
      // Arrange
      const snapshotWithMultipleLineItems: BillingSnapshot = {
        ...mockSnapshot,
        lineItems: [
          {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            totalTokens: 30000,
            totalRequests: 6,
            pricePerThousandTokens: 0.01,
            costUSD: 0.3,
          },
          {
            provider: 'openai',
            model: 'gpt-4',
            totalTokens: 20000,
            totalRequests: 4,
            pricePerThousandTokens: 0.02,
            costUSD: 0.4,
          },
        ],
        totalCostUSD: 0.7,
      };

      jest
        .spyOn(billingSnapshotRepository, 'findOne')
        .mockResolvedValue(snapshotWithMultipleLineItems);
      jest.spyOn(invoiceRepository, 'findOne').mockResolvedValue(null);

      const savedInvoice: Invoice = {
        invoiceId: 'generated-uuid',
        snapshotId: snapshotWithMultipleLineItems.snapshotId,
        apiKeyId: snapshotWithMultipleLineItems.apiKeyId,
        userId: snapshotWithMultipleLineItems.userId,
        periodStart: snapshotWithMultipleLineItems.periodStart,
        periodEnd: snapshotWithMultipleLineItems.periodEnd,
        pricingVersion: snapshotWithMultipleLineItems.pricingVersion,
        subtotalUSD: snapshotWithMultipleLineItems.subtotalUSD,
        adjustmentsUSD: snapshotWithMultipleLineItems.adjustmentsUSD,
        totalCostUSD: snapshotWithMultipleLineItems.totalCostUSD,
        currency: 'USD',
        lineItems: [
          {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            totalTokens: 30000,
            totalRequests: 6,
            pricePerThousandTokens: 0.01,
            amountUSD: 0.3,
          },
          {
            provider: 'openai',
            model: 'gpt-4',
            totalTokens: 20000,
            totalRequests: 4,
            pricePerThousandTokens: 0.02,
            amountUSD: 0.4,
          },
        ],
        status: 'draft',
        createdAt: new Date(),
      };
      jest.spyOn(invoiceRepository, 'save').mockResolvedValue(savedInvoice);

      // Act
      const result = await service.createFromSnapshot(
        snapshotWithMultipleLineItems.snapshotId,
      );

      // Assert
      expect(result.lineItems).toHaveLength(2);
      expect(result.lineItems[0].provider).toBe('anthropic');
      expect(result.lineItems[0].amountUSD).toBe(0.3);
      expect(result.lineItems[1].provider).toBe('openai');
      expect(result.lineItems[1].amountUSD).toBe(0.4);
      expect(result.totalCostUSD).toBe(0.7);
    });

    it('should set status to draft in Phase 25B-1', async () => {
      // Arrange
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
        lineItems: [],
        status: 'draft',
        createdAt: new Date(),
      };
      jest.spyOn(invoiceRepository, 'save').mockResolvedValue(savedInvoice);

      // Act
      const result = await service.createFromSnapshot(mockSnapshot.snapshotId);

      // Assert
      expect(result.status).toBe('draft');
    });

    it('should set currency to USD in Phase 25B-1', async () => {
      // Arrange
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
        lineItems: [],
        status: 'draft',
        createdAt: new Date(),
      };
      jest.spyOn(invoiceRepository, 'save').mockResolvedValue(savedInvoice);

      // Act
      const result = await service.createFromSnapshot(mockSnapshot.snapshotId);

      // Assert
      expect(result.currency).toBe('USD');
    });
  });

  describe('immutability guarantee', () => {
    it('should not have update method', () => {
      // Assert
      expect(service['update']).toBeUndefined();
    });

    it('should not have delete method', () => {
      // Assert
      expect(service['delete']).toBeUndefined();
    });

    it('should not call invoiceRepository.update', async () => {
      // Arrange
      jest
        .spyOn(billingSnapshotRepository, 'findOne')
        .mockResolvedValue(mockSnapshot);
      jest.spyOn(invoiceRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(invoiceRepository, 'update');

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
        lineItems: [],
        status: 'draft',
        createdAt: new Date(),
      };
      jest.spyOn(invoiceRepository, 'save').mockResolvedValue(savedInvoice);

      // Act
      await service.createFromSnapshot(mockSnapshot.snapshotId);

      // Assert
      expect(invoiceRepository.update).not.toHaveBeenCalled();
    });

    it('should not call invoiceRepository.delete', async () => {
      // Arrange
      jest
        .spyOn(billingSnapshotRepository, 'findOne')
        .mockResolvedValue(mockSnapshot);
      jest.spyOn(invoiceRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(invoiceRepository, 'delete');

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
        lineItems: [],
        status: 'draft',
        createdAt: new Date(),
      };
      jest.spyOn(invoiceRepository, 'save').mockResolvedValue(savedInvoice);

      // Act
      await service.createFromSnapshot(mockSnapshot.snapshotId);

      // Assert
      expect(invoiceRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('no side effects guarantee', () => {
    it('should not modify billing snapshot', async () => {
      // Arrange
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
        lineItems: [],
        status: 'draft',
        createdAt: new Date(),
      };
      jest.spyOn(invoiceRepository, 'save').mockResolvedValue(savedInvoice);

      // Act
      await service.createFromSnapshot(mockSnapshot.snapshotId);

      // Assert: billingSnapshotRepository.findOne called once (read-only)
      expect(billingSnapshotRepository.findOne).toHaveBeenCalledTimes(1);
      // Assert: No save/update/delete on billingSnapshotRepository
      expect(billingSnapshotRepository['save']).toBeUndefined();
      expect(billingSnapshotRepository['update']).toBeUndefined();
      expect(billingSnapshotRepository['delete']).toBeUndefined();
    });
  });
});
