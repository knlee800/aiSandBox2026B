import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrchestrationService } from './orchestration.service';
import { InternalCollaborationController } from './internal-collaboration.controller';
import { QueueModule } from '../queue/queue.module';
import { UsageLedgerModule } from '../usage-ledger/usage-ledger.module';
import { ExecutionResultService } from '../ai/execution-result.service';
import { CollaborationRunEntity } from './collaboration-run.entity';
import { CollaborationReferralEntity } from './collaboration-referral.entity';
import { SafetyModule } from '../safety/safety.module';
import { AbortModule } from '../abort/abort.module';
import { QuotaModule } from '../quota/quota.module';
import { CreditBalanceGuardModule } from '../billing/credit-balance-guard.module';

@Module({
  imports: [
    QueueModule,
    UsageLedgerModule,
    SafetyModule,
    AbortModule,
    QuotaModule,
    CreditBalanceGuardModule,
    TypeOrmModule.forFeature([
      CollaborationRunEntity,
      CollaborationReferralEntity,
    ]),
  ],
  controllers: [InternalCollaborationController],
  providers: [OrchestrationService, ExecutionResultService],
  exports: [OrchestrationService],
})
export class OrchestrationModule {}
