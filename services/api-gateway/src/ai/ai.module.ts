import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AIExecutionController } from './ai-execution.controller';
import { InternalAccountingController } from './internal-accounting.controller';
import { AIServiceHttpClient } from '../clients/ai-service-http.client';
import { AuthModule } from '../auth/auth.module';
import { QuotaModule } from '../quota/quota.module';
import { UsageLedgerModule } from '../usage-ledger/usage-ledger.module';
import { SafetyModule } from '../safety/safety.module';
import { LaunchModule } from '../launch/launch.module';
import { AbortModule } from '../abort/abort.module';
import { IdempotencyGuard } from './idempotency.guard';
import { QueueModule } from '../queue/queue.module';
import { ExecutionResultService } from './execution-result.service';
import { ExecutionStreamService } from '../streaming/execution-stream.service';
import { UserAiInstructionsModule } from '../user-ai-instructions/user-ai-instructions.module';
import { ProjectAiContextModule } from '../project-ai-context/project-ai-context.module';
import { SessionModule } from '../sessions/session.module';
import { ProjectRepoDocsModule } from '../project-repo-docs/project-repo-docs.module';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import { CreditBalanceGuardModule } from '../billing/credit-balance-guard.module';
import { CreditPersistenceModule } from '../billing/credit-deduction/credit-persistence.module';
import { User } from '../entities/user.entity';

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
    UserAiInstructionsModule, // AI-CONTEXT-01B: User global instruction enrichment
    ProjectAiContextModule, // AI-CONTEXT-02C: Project instruction enrichment
    SessionModule, // AI-CONTEXT-02C: Resolve project via session association
    ProjectRepoDocsModule, // AI-CONTEXT-04C: Resolve registered project repo docs
    TypeOrmModule.forFeature([User]), // Expose UserRepository in AIModule context
    CreditPersistenceModule, // Expose CreditBalanceRepository in AIModule context
    CreditBalanceGuardModule, // BILLING-READY-04A: Credit balance gate
  ],
  controllers: [AIExecutionController, InternalAccountingController],
  providers: [
    AIServiceHttpClient,
    ContainerManagerHttpClient,
    IdempotencyGuard,
    ExecutionResultService,
    ExecutionStreamService,
  ],
  exports: [AIServiceHttpClient],
})
export class AIModule {}
