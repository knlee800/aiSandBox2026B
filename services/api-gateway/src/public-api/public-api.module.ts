import { Module } from '@nestjs/common';
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
