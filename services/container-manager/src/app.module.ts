import { Module } from '@nestjs/common';
import { SessionsModule } from './sessions/sessions.module';
import { FilesModule } from './files/files.module';
import { GitModule } from './git/git.module';
import { ExecutorModule } from './executor/executor.module';
import { PreviewModule } from './preview/preview.module';
import { UsageModule } from './usage/usage.module';
import { BillingModule } from './billing/billing.module';
import { StatsModule } from './stats/stats.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    SessionsModule,
    FilesModule,
    GitModule,
    ExecutorModule,
    PreviewModule,
    UsageModule,
    BillingModule,
    StatsModule, // Phase 41A: Runtime statistics
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
