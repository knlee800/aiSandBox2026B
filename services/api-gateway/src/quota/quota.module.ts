import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuotaService } from './quota.service';
import { QuotaGuard } from './quota.guard';
import { SessionQuotaGuard } from './session-quota.guard';
import { TokenQuotaGuard } from './token-quota.guard';
import { Session } from '../entities/session.entity';
import { UsageRecord } from '../entities/usage-record.entity';

/**
 * QuotaModule
 *
 * Phase 21B: Quota and Rate-Limiting Module
 * Phase 42A-1: Added SessionQuotaGuard for max active sessions enforcement
 * Phase 42A-2: Added rolling 24h session quota enforcement
 * Phase 42A-3: Added TokenQuotaGuard for max tokens per 24h enforcement
 *
 * Provides quota enforcement for API requests:
 * - QuotaService: In-memory quota state management + DB-backed session/token quota
 * - QuotaGuard: NestJS guard for AI execution quota enforcement (legacy Phase 21B)
 * - SessionQuotaGuard: NestJS guard for session creation quota enforcement (PHASE-42A-1/42A-2)
 * - TokenQuotaGuard: NestJS guard for token usage quota enforcement (PHASE-42A-3)
 *
 * Exports:
 * - QuotaService: For manual quota checks (if needed)
 * - QuotaGuard: For use in controllers via @UseGuards
 * - SessionQuotaGuard: For use in session controller via @UseGuards (PHASE-42A-1/42A-2)
 * - TokenQuotaGuard: For use in AI execution controller via @UseGuards (PHASE-42A-3)
 */
@Module({
  imports: [TypeOrmModule.forFeature([Session, UsageRecord])],
  providers: [QuotaService, QuotaGuard, SessionQuotaGuard, TokenQuotaGuard],
  exports: [QuotaService, QuotaGuard, SessionQuotaGuard, TokenQuotaGuard],
})
export class QuotaModule {}
