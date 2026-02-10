import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Invoice, InvoiceLineItem } from '../entities/invoice.entity';
import { BillingSnapshot } from '../entities/billing-snapshot.entity';
import { KillSwitchConfig } from '../safety/kill-switch.config';

/**
 * InvoiceService
 *
 * Phase 25B-1: Invoice Persistence Infrastructure
 *
 * Provides invoice creation from billing snapshots (write-once, derived data only).
 *
 * LOCKED INVARIANTS:
 * - Read-only access to BillingSnapshot (NO modifications)
 * - One-to-one mapping: BillingSnapshot → Invoice (duplicate throws)
 * - No billing calculations (values copied verbatim from snapshot)
 * - No payment logic (Phase 25B-2+)
 * - No retries, no async jobs, no scheduling
 * - Throw-only error semantics (no partial success)
 * - Immutable invoices (no update/delete methods)
 * - Status is 'draft' ONLY in Phase 25B-1
 *
 * IMPORTANT:
 * - This service does NOT calculate costs (Phase 23 responsibility)
 * - This service does NOT modify snapshots (snapshots remain immutable)
 * - This service does NOT initiate payments (Phase 25B-2+ responsibility)
 * - This service creates invoices only (pure persistence layer)
 */
@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(BillingSnapshot)
    private readonly billingSnapshotRepository: Repository<BillingSnapshot>,
  ) {}

  /**
   * Create invoice from billing snapshot
   *
   * Phase 25B-1: ONLY public method
   * Phase 26B: Kill switch enforcement
   *
   * @param snapshotId - UUID of billing snapshot
   * @returns Created Invoice
   * @throws NotFoundException if snapshot not found
   * @throws ConflictException if invoice already exists for this snapshot
   * @throws Error if invoice generation disabled
   *
   * Behavior:
   * 1. Check kill switch (Phase 26B)
   * 2. Load BillingSnapshot by snapshotId
   * 3. Validate snapshot exists (throw NotFoundException if not)
   * 4. Check if invoice already exists for this snapshot (throw ConflictException if yes)
   * 5. Copy values verbatim from snapshot to invoice
   * 6. Persist invoice (status = 'draft')
   * 7. Return persisted Invoice
   *
   * NO pricing logic, NO recalculation, NO payment behavior
   */
  async createFromSnapshot(snapshotId: string): Promise<Invoice> {
    // Phase 26B: Check invoice generation kill switch
    if (!KillSwitchConfig.INVOICE_GENERATION_ENABLED) {
      this.logger.warn(
        'Invoice generation disabled by kill switch',
        { snapshotId },
      );
      // Return early without creating invoice (no-op)
      // Billing snapshots continue to be created (source-of-truth preserved)
      // Invoices can be created later when kill switch is re-enabled
      throw new Error('Invoice generation temporarily disabled');
    }

    // 1. Load BillingSnapshot
    const snapshot = await this.billingSnapshotRepository.findOne({
      where: { snapshotId },
    });

    // 2. Validate snapshot exists
    if (!snapshot) {
      throw new NotFoundException(
        `Billing snapshot not found: ${snapshotId}`,
      );
    }

    // 3. Check if invoice already exists (duplicate prevention)
    const existingInvoice = await this.invoiceRepository.findOne({
      where: { snapshotId },
    });

    if (existingInvoice) {
      throw new ConflictException(
        `Invoice already exists for snapshot: ${snapshotId}`,
      );
    }

    // 4. Copy values verbatim from snapshot (no calculations)
    const invoice = new Invoice();
    invoice.invoiceId = uuidv4();
    invoice.snapshotId = snapshot.snapshotId;
    invoice.apiKeyId = snapshot.apiKeyId;
    invoice.userId = snapshot.userId;
    invoice.periodStart = snapshot.periodStart;
    invoice.periodEnd = snapshot.periodEnd;
    invoice.pricingVersion = snapshot.pricingVersion;
    invoice.subtotalUSD = snapshot.subtotalUSD;
    invoice.adjustmentsUSD = snapshot.adjustmentsUSD;
    invoice.totalCostUSD = snapshot.totalCostUSD;
    invoice.currency = 'USD'; // Phase 25B-1: USD only
    invoice.status = 'draft'; // Phase 25B-1: draft only

    // Copy line items (map BillingLineItem → InvoiceLineItem)
    invoice.lineItems = snapshot.lineItems.map((lineItem) => ({
      provider: lineItem.provider,
      model: lineItem.model,
      totalTokens: lineItem.totalTokens,
      totalRequests: lineItem.totalRequests,
      pricePerThousandTokens: lineItem.pricePerThousandTokens,
      amountUSD: lineItem.costUSD, // Rename costUSD → amountUSD for invoice
    }));

    // 5. Persist invoice
    const savedInvoice = await this.invoiceRepository.save(invoice);

    // 6. Return persisted Invoice
    return savedInvoice;
  }
}
