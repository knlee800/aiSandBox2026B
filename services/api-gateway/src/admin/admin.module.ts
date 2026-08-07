import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService } from './reconciliation.service';
import { ChargeReadinessService } from './charge-readiness.service';
import { PaymentsModule } from '../payments/payments.module';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { User } from '../entities/user.entity';
import { Session } from '../entities/session.entity';
import { UsageRecord } from '../entities/usage-record.entity';
import { Plan } from '../entities/plan.entity';
import { AuthModule } from '../auth/auth.module';
import { SessionModule } from '../sessions/session.module';
import { AdminOperationalController } from './admin-operational.controller';
import { CreditGrantModule } from '../billing/credit-grant/credit-grant.module';
import { CreditPersistenceModule } from '../billing/credit-deduction/credit-persistence.module';
import { AdminCreditGrantService } from './admin-credit-grant.service';

/**
 * AdminModule (Task 11A + Task 11B + Task 12A + Task 12B1 + Task 12B2)
 * Provides internal admin visibility, invoice mutations, reconciliation, and charge readiness
 *
 * Task 11A: Read-only visibility (user ops, invoice listing)
 * Task 11B: Invoice void action (status transition)
 * Task 12A: Billing reconciliation and safety reports (read-only)
 * Task 12B1: Invoice finalization (status transition with reconciliation check)
 * Task 12B2: Charge readiness gate and financial kill-switch (safety only, no charging)
 *
 * CRITICAL CONSTRAINTS:
 * - Task 11A/12A endpoints: READ-ONLY
 * - Task 11B endpoints: Status transitions only (draft → void)
 * - Task 12B1 endpoints: Status transitions only (draft → finalized, with reconciliation check)
 * - Task 12B2: NO charging, NO payment execution, safety gate only
 * - NO background jobs
 * - Protected by InternalServiceAuthGuard (global)
 *
 * Dependencies:
 * - ContainerManagerHttpClient: For calling quota visibility and billing export APIs
 * - ReconciliationService: For drift detection (used by finalization and charge readiness)
 * - PaymentsModule: For payment provider configuration validation (used by charge readiness)
 *
 * Exports:
 * - AdminService (for potential future internal use)
 * - ReconciliationService (for potential future internal use)
 * - ChargeReadinessService (for future charging logic, MUST be called before any payment operations)
 */
@Module({
  imports: [
    AuthModule,
    PaymentsModule,
    SessionModule,
    CreditGrantModule,
    CreditPersistenceModule,
    TypeOrmModule.forFeature([User, Session, UsageRecord, Plan]),
  ],
  controllers: [
    AdminController,
    ReconciliationController,
    AdminDashboardController,
    AdminOperationalController,
  ],
  providers: [
    AdminService,
    ReconciliationService,
    ChargeReadinessService,
    AdminDashboardService,
    AdminCreditGrantService,
  ],
  exports: [
    AdminService,
    ReconciliationService,
    ChargeReadinessService,
    AdminDashboardService,
  ],
})
export class AdminModule {}
