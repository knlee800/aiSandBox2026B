import { Controller, Post, Param, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { UsageLedgerService } from '../usage-ledger/usage-ledger.service';

/**
 * BILLING-READY-04C: Internal Accounting Controller
 *
 * Endpoint for ai-service worker to trigger credit deduction after
 * successful execution completion.
 *
 * Route: POST /api/internal/executions/:executionId/finalize-accounting
 *
 * Protected by global InternalServiceAuthGuard (X-Internal-Service-Key).
 * No user-facing UX text. No frontend/i18n. No external billing API calls.
 */
@Controller('internal/executions')
export class InternalAccountingController {
  private readonly logger = new Logger(InternalAccountingController.name);

  constructor(private readonly usageLedgerService: UsageLedgerService) {}

  @Post(':executionId/finalize-accounting')
  @HttpCode(HttpStatus.OK)
  async finalizeAccounting(
    @Param('executionId') executionId: string,
  ): Promise<{ executionId: string; triggered: boolean; reason: string }> {
    this.logger.log(
      JSON.stringify({
        event: 'finalize_accounting.request_received',
        timestamp: new Date().toISOString(),
        executionId,
      }),
    );

    const result = await this.usageLedgerService.triggerDeductionForExecution(executionId);

    return {
      executionId,
      triggered: result.triggered,
      reason: result.reason,
    };
  }
}
