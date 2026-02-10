import { Module } from '@nestjs/common';
import { QuotaService } from './quota.service';
import { QuotaGuard } from './quota.guard';

/**
 * QuotaModule
 *
 * Phase 21B: Quota and Rate-Limiting Module
 *
 * Provides quota enforcement for API requests:
 * - QuotaService: In-memory quota state management
 * - QuotaGuard: NestJS guard for quota enforcement
 *
 * Exports:
 * - QuotaService: For manual quota checks (if needed)
 * - QuotaGuard: For use in controllers via @UseGuards
 */
@Module({
  providers: [QuotaService, QuotaGuard],
  exports: [QuotaService, QuotaGuard],
})
export class QuotaModule {}
