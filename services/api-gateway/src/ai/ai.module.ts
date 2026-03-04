import { Module } from '@nestjs/common';
import { AIExecutionController } from './ai-execution.controller';
import { AIServiceHttpClient } from '../clients/ai-service-http.client';
import { AuthModule } from '../auth/auth.module';
import { QuotaModule } from '../quota/quota.module';
import { UsageLedgerModule } from '../usage-ledger/usage-ledger.module';
import { SafetyModule } from '../safety/safety.module';
import { LaunchModule } from '../launch/launch.module';
import { AbortModule } from '../abort/abort.module';
import { IdempotencyGuard } from './idempotency.guard';
import { QueueModule } from '../queue/queue.module';

/**
 * AIModule
 *
 * Phase 18A: AI execution module for api-gateway
 * Phase 20A: API key authentication integration
 * Phase 21B: Quota and rate-limiting integration
 * Phase 22B: Usage ledger integration
 * Phase 26B: Production readiness (kill switches + safety limits)
 * Phase 28B-1: Launch state enforcement
 * Phase 28B-2: Abort mode enforcement
 * Phase 43A-2C: Idempotency short-circuit BEFORE quota
 *
 * Provides:
 * - AIExecutionController (POST /api/ai/execute with auth, safety, launch state, abort mode, idempotency, quota, and ledger)
 * - AIServiceHttpClient (HTTP client for ai-service)
 * - IdempotencyGuard (Phase 43A-2C: retry-safe idempotency)
 */
@Module({
  imports: [
    AuthModule, // Phase 20A/20B: Authentication and authorization
    QueueModule,
    SafetyModule, // Phase 26B: Kill switches and global safety limits
    LaunchModule, // Phase 28B-1: Launch state enforcement
    AbortModule, // Phase 28B-2: Abort mode enforcement
    QuotaModule, // Phase 21B: Quota enforcement
    UsageLedgerModule, // Phase 22B: Usage ledger
  ],
  controllers: [AIExecutionController],
  providers: [AIServiceHttpClient, IdempotencyGuard],
  exports: [AIServiceHttpClient],
})
export class AIModule {}
