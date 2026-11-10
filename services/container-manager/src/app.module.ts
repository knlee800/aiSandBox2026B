import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SessionsModule } from './sessions/sessions.module';
import { FilesModule } from './files/files.module';
import { GitModule } from './git/git.module';
import { ExecutorModule } from './executor/executor.module';
import { PreviewModule } from './preview/preview.module';
import { UsageModule } from './usage/usage.module';
import { BillingModule } from './billing/billing.module';
import { StatsModule } from './stats/stats.module';
import { HealthController } from './health/health.controller';
import { InternalServiceAuthGuard } from './guards/internal-service-auth.guard';

/**
 * CM-AUTH-01 (D1): InternalServiceAuthGuard is the global guard. Every route
 * needs X-Internal-Service-Key except handlers marked @InternalKeyExempt()
 * (only GET /api/health).
 */
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
  providers: [
    {
      provide: APP_GUARD,
      useClass: InternalServiceAuthGuard,
    },
  ],
})
export class AppModule {}
