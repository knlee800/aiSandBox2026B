import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SessionsModule } from './sessions/sessions.module';
import { GitModule } from './git/git.module';
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
 *
 * CM-SYMLINK-01: FilesModule (the host-side /api/files/:sessionId/* routes)
 * is removed. Nothing called it, and it read and wrote the bind-mounted
 * workspace on the host, following symlinks the sandbox could create. File
 * access goes through /api/internal/sessions/:id/files inside the container.
 */
@Module({
  imports: [
    SessionsModule,
    GitModule,
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
