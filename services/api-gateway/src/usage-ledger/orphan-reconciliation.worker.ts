import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { UsageLedgerService } from './usage-ledger.service';

/**
 * OrphanReconciliationWorker
 *
 * Phase 43C-2: Automated Orphan Cleanup & Reconciliation
 *
 * Background worker that periodically scans for orphaned 'pending' executions
 * and transitions them to 'timeout' status to unblock retries.
 *
 * Configuration (via environment variables):
 * - ORPHAN_RECONCILIATION_ENABLED: Enable/disable worker (default: true)
 * - ORPHAN_RECONCILIATION_INTERVAL_MS: Scan interval (default: 60000 = 1 minute)
 * - ORPHAN_THRESHOLD_MS: Age threshold for orphan detection (default: 300000 = 5 minutes)
 * - ORPHAN_BATCH_SIZE: Max records per scan (default: 50)
 *
 * Semantics:
 * - Runs on a fixed interval (not cron)
 * - Conservative batch size to prevent memory issues
 * - Idempotent transitions (safe to run multiple times)
 * - Structured JSON logging for observability
 * - Graceful shutdown on module destroy
 *
 * Purpose:
 * - Automatically clean up abandoned executions (crashed/timed out)
 * - Unblock clients waiting to retry with same Idempotency-Key
 * - Complement lazy reconciliation in IdempotencyGuard
 */
@Injectable()
export class OrphanReconciliationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrphanReconciliationWorker.name);
  private intervalHandle: NodeJS.Timeout | null = null;
  private isRunning = false;

  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private readonly thresholdMs: number;
  private readonly batchSize: number;

  constructor(private readonly usageLedgerService: UsageLedgerService) {
    this.enabled = process.env.ORPHAN_RECONCILIATION_ENABLED !== 'false';
    this.intervalMs = parseInt(process.env.ORPHAN_RECONCILIATION_INTERVAL_MS || '60000', 10);
    this.thresholdMs = parseInt(process.env.ORPHAN_THRESHOLD_MS || '300000', 10);
    this.batchSize = parseInt(process.env.ORPHAN_BATCH_SIZE || '50', 10);
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log(JSON.stringify({
        event: 'reconciliation.worker_disabled',
        timestamp: new Date().toISOString(),
      }));
      return;
    }

    this.logger.log(JSON.stringify({
      event: 'reconciliation.worker_started',
      timestamp: new Date().toISOString(),
      intervalMs: this.intervalMs,
      thresholdMs: this.thresholdMs,
      batchSize: this.batchSize,
    }));

    this.intervalHandle = setInterval(() => {
      this.runReconciliation().catch((error) => {
        this.logger.error(JSON.stringify({
          event: 'reconciliation.scan_error',
          timestamp: new Date().toISOString(),
          errorClass: error?.constructor?.name ?? 'Error',
          errorMessage: error?.message ?? String(error),
        }));
      });
    }, this.intervalMs);
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;

      this.logger.log(JSON.stringify({
        event: 'reconciliation.worker_stopped',
        timestamp: new Date().toISOString(),
      }));
    }
  }

  /**
   * Run a single reconciliation scan
   *
   * Finds orphaned pending records and transitions them to timeout.
   * Safe to call manually for testing.
   */
  async runReconciliation(): Promise<{ found: number; transitioned: number }> {
    if (this.isRunning) {
      this.logger.warn(JSON.stringify({
        event: 'reconciliation.scan_skipped',
        timestamp: new Date().toISOString(),
        reason: 'previous_scan_in_progress',
      }));
      return { found: 0, transitioned: 0 };
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      const orphans = await this.usageLedgerService.findOrphanedPending(
        this.thresholdMs,
        this.batchSize,
      );

      if (orphans.length === 0) {
        return { found: 0, transitioned: 0 };
      }

      const executionIds = orphans.map((r) => r.executionId);
      const transitioned = await this.usageLedgerService.batchTransitionOrphansToTimeout(executionIds);

      const durationMs = Date.now() - startTime;

      this.logger.log(JSON.stringify({
        event: 'reconciliation.scan_completed',
        timestamp: new Date().toISOString(),
        found: orphans.length,
        transitioned,
        durationMs,
        executionIds: executionIds.slice(0, 10),
        truncated: executionIds.length > 10,
      }));

      return { found: orphans.length, transitioned };
    } finally {
      this.isRunning = false;
    }
  }
}
