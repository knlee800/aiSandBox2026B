import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuotaService } from './quota.service';
import { QuotaGuard } from './quota.guard';
import { SessionQuotaGuard } from './session-quota.guard';
import { Session } from '../entities/session.entity';

/**
 * QuotaModule
 *
 * Phase 21B: Quota and Rate-Limiting Module
 * Phase 42A-1: Added SessionQuotaGuard for max active sessions enforcement
 *
 * Provides quota enforcement for API requests:
 * - QuotaService: In-memory quota state management + DB-backed session quota
 * - QuotaGuard: NestJS guard for AI execution quota enforcement
 * - SessionQuotaGuard: NestJS guard for session creation quota enforcement (PHASE-42A-1)
 *
 * Exports:
 * - QuotaService: For manual quota checks (if needed)
 * - QuotaGuard: For use in controllers via @UseGuards
 * - SessionQuotaGuard: For use in session controller via @UseGuards (PHASE-42A-1)
 */
@Module({
  imports: [TypeOrmModule.forFeature([Session])],
  providers: [QuotaService, QuotaGuard, SessionQuotaGuard],
  exports: [QuotaService, QuotaGuard, SessionQuotaGuard],
})
export class QuotaModule {}
