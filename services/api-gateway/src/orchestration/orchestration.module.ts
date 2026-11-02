import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrchestrationService } from './orchestration.service';
import { InternalCollaborationController } from './internal-collaboration.controller';
import { QueueModule } from '../queue/queue.module';
import { UsageLedgerModule } from '../usage-ledger/usage-ledger.module';
import { ExecutionResultService } from '../ai/execution-result.service';
import { CollaborationRunEntity } from './collaboration-run.entity';
import { CollaborationReferralEntity } from './collaboration-referral.entity';

@Module({
  imports: [
    QueueModule,
    UsageLedgerModule,
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
