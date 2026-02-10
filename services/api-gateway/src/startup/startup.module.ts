/**
 * Startup Module
 *
 * Phase 27B: Production Hardening
 * Phase 28B-2: Abort and rollback audit logging
 *
 * Provides startup guard services for fail-fast validation.
 * Must be imported FIRST in AppModule to enforce checks before other modules initialize.
 */

import { Module, Global } from '@nestjs/common';
import { StartupGuardService } from './startup-guard.service';
import { SafetyModule } from '../safety/safety.module';

@Global()
@Module({
  imports: [SafetyModule], // Phase 28B-2: Import for AuditLogService
  providers: [StartupGuardService],
  exports: [StartupGuardService],
})
export class StartupModule {}
