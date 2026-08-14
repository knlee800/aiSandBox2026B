import { Body, Controller, Post, Param, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { UsageLedgerService } from '../usage-ledger/usage-ledger.service';
import { ConfirmBuildApplyDto } from './dto/confirm-build-apply.dto';

/**
 * BILLING-READY-04C / PRIVATE-BETA-BLOCKER-03D-A: Internal Accounting Controller
 *
 * Endpoints for internal services to trigger credit deduction after
 * successful execution completion or after a qualifying Build apply.
 *
 * Routes:
 *   POST /api/internal/executions/:executionId/finalize-accounting
 *   POST /api/internal/executions/:executionId/confirm-build-apply
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

  @Post(':executionId/confirm-build-apply')
  @HttpCode(HttpStatus.OK)
  async confirmBuildApply(
    @Param('executionId') executionId: string,
    @Body() confirmation: ConfirmBuildApplyDto,
  ): Promise<{ executionId: string; triggered: boolean; reason: string }> {
    this.logger.log(
      JSON.stringify({
        event: 'confirm_build_apply.request_received',
        timestamp: new Date().toISOString(),
        executionId,
        applyStatus: confirmation.applyStatus,
        totalActions: confirmation.totalActions,
        successCount: confirmation.successCount,
      }),
    );

    const result = await this.usageLedgerService.triggerBuildApplyDeduction(
      executionId,
      confirmation,
    );

    return {
      executionId,
      triggered: result.triggered,
      reason: result.reason,
    };
  }
}
