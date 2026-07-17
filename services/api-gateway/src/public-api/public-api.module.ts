import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { SessionModule } from '../sessions/session.module';
import { ProjectsModule } from '../projects/projects.module';
import { UsageLedgerModule } from '../usage-ledger/usage-ledger.module';
import { QueueModule } from '../queue/queue.module';
import { QuotaModule } from '../quota/quota.module';
import { SafetyModule } from '../safety/safety.module';
import { LaunchModule } from '../launch/launch.module';
import { AbortModule } from '../abort/abort.module';
import { ExecutionResultService } from '../ai/execution-result.service';
import { IdempotencyGuard } from '../ai/idempotency.guard';
import { PublicApiRateLimitGuard } from './public-api-rate-limit.guard';
import { PublicSessionsController } from './public-sessions.controller';
import { PublicFilesController } from './public-files.controller';
import { PublicProjectsController } from './public-projects.controller';
import { PublicAIController } from './public-ai.controller';
import { PublicDocsController } from './public-docs.controller';
import { CreditBalanceGuardModule } from '../billing/credit-balance-guard.module';
import { CreditPersistenceModule } from '../billing/credit-deduction/credit-persistence.module';
import { User } from '../entities/user.entity';

@Module({
  imports: [
    AuthModule,
    SessionModule,
    ProjectsModule,
    UsageLedgerModule,
    QueueModule,
    QuotaModule,
    SafetyModule,
    LaunchModule,
    AbortModule,
    TypeOrmModule.forFeature([User]), // Expose UserRepository in PublicApiModule context
    CreditBalanceGuardModule, // BILLING-READY-04A: Credit balance gate
    CreditPersistenceModule, // Expose CreditBalanceRepository in PublicApiModule context
  ],
  controllers: [
    PublicSessionsController,
    PublicFilesController,
    PublicProjectsController,
    PublicAIController,
    PublicDocsController,
  ],
  providers: [ExecutionResultService, IdempotencyGuard, PublicApiRateLimitGuard],
})
export class PublicApiModule {}
