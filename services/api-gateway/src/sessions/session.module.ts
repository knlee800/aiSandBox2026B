import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../entities/session.entity';
import { AuthModule } from '../auth/auth.module';
import { SessionRepository } from '../repositories/session.repository';
import { SessionService } from './session.service';
import { InternalSessionController } from './internal-session.controller';
import { SessionController } from './session.controller';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import { QuotaModule } from '../quota/quota.module';
import { SnapshotsModule } from '../snapshots/snapshots.module';

/**
 * SessionModule
 * Manages sandbox session lifecycle and persistence
 * PHASE-42A-1: Added QuotaModule import for SessionQuotaGuard
 */
@Module({
  imports: [
    // Register Session entity for TypeORM
    TypeOrmModule.forFeature([Session]),
    AuthModule,
    // PHASE-42A-1: Import QuotaModule for SessionQuotaGuard
    QuotaModule,
    SnapshotsModule,
  ],
  controllers: [InternalSessionController, SessionController],
  providers: [
    SessionRepository,
    SessionService,
    ContainerManagerHttpClient,
  ],
  exports: [
    SessionService,
    SessionRepository,
    ContainerManagerHttpClient,
  ],
})
export class SessionModule {}
