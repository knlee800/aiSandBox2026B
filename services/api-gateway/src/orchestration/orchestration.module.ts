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
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ConnectorConnection } from '../entities/connector-connection.entity';
import {
  InMemoryOrchestrationAuditRecorder,
  StoredOrchestrationAuditRecorder,
} from './orchestration-audit.recorder';
import { SafetyModule } from '../safety/safety.module';
import { AbortModule } from '../abort/abort.module';
import { QuotaModule } from '../quota/quota.module';
import { CreditBalanceGuardModule } from '../billing/credit-balance-guard.module';
import { AuthModule } from '../auth/auth.module';
import { SessionModule } from '../sessions/session.module';
import { ConversationModule } from '../conversations/conversation.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { UserAgentModule } from '../user-agent/user-agent.module';
import { TestedWorkflowSwitchOnCheck } from '../user-agent/user-workflow-switch-on';
import { CreditDeductionRecord } from '../entities/credit-deduction-record.entity';
import { CollaborationWorkflowService } from './collaboration-workflow';
import { CollaborationResultsService } from './collaboration-results';
import { CollaborationResultsController } from './collaboration-results.controller';
import { CollaborationBusinessSessionService } from './collaboration-business-session';
import { Project } from '../entities/project.entity';
import { Session } from '../entities/session.entity';

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
    UserAgentModule,
    TypeOrmModule.forFeature([
      CollaborationRunEntity,
      CollaborationReferralEntity,
      AuditEventEntity,
      ConnectorConnection,
      // BIZ-USER-01C D8: read only, for a workflow's own credit sums.
      CreditDeductionRecord,
      // TEAM-NO-SESSION-02 D4: the per-owner business project and session.
      Project,
      Session,
    ]),
  ],
  controllers: [
    InternalCollaborationController,
    CollaborationController,
    // RESULTS-01 D7: owner-scoped results list, unread count and seen mark.
    CollaborationResultsController,
  ],
  providers: [
    OrchestrationService,
    CollaborationWorkflowService,
    // WORKFLOW-STATUS-03: the switch-on check, injected with CollaborationWorkflowService;
    // it binds itself to UserAgentModule's exported slot for USER_WORKFLOW_SWITCH_ON_CHECK.
    TestedWorkflowSwitchOnCheck,
    CollaborationResultsService,
    CollaborationBusinessSessionService,
    ExecutionResultService,
    CollaborationSweepWorker,
    {
      provide: InMemoryOrchestrationAuditRecorder,
      useClass: StoredOrchestrationAuditRecorder,
    },
  ],
  exports: [OrchestrationService],
})
export class OrchestrationModule {}
