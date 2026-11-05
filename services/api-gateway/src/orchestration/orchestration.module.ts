import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrchestrationService } from './orchestration.service';
import { InternalCollaborationController } from './internal-collaboration.controller';
import { CollaborationController } from './collaboration.controller';
import { CollaborationSweepWorker } from './collaboration-sweep.worker';
import { QueueModule } from '../queue/queue.module';
import { UsageLedgerModule } from '../usage-ledger/usage-ledger.module';
import { ExecutionResultService } from '../ai/execution-result.service';
import { CollaborationRunEntity } from './collaboration-run.entity';
import { CollaborationReferralEntity } from './collaboration-referral.entity';
import { SafetyModule } from '../safety/safety.module';
import { AbortModule } from '../abort/abort.module';
import { QuotaModule } from '../quota/quota.module';
import { CreditBalanceGuardModule } from '../billing/credit-balance-guard.module';
import { AuthModule } from '../auth/auth.module';
import { SessionModule } from '../sessions/session.module';
import { ConversationModule } from '../conversations/conversation.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [
    AuthModule,
    SessionModule,
    ConversationModule,
    QueueModule,
    UsageLedgerModule,
    SafetyModule,
    AbortModule,
    QuotaModule,
    CreditBalanceGuardModule,
    KnowledgeModule,
    TypeOrmModule.forFeature([
      CollaborationRunEntity,
      CollaborationReferralEntity,
    ]),
  ],
  controllers: [InternalCollaborationController, CollaborationController],
  providers: [OrchestrationService, ExecutionResultService, CollaborationSweepWorker],
  exports: [OrchestrationService],
})
export class OrchestrationModule {}
