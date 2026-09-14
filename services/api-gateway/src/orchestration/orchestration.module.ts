import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrchestrationService } from './orchestration.service';
import { QueueModule } from '../queue/queue.module';
import { ExecutionResultService } from '../ai/execution-result.service';
import { CollaborationRunEntity } from './collaboration-run.entity';
import { CollaborationReferralEntity } from './collaboration-referral.entity';

@Module({
  imports: [
    QueueModule,
    TypeOrmModule.forFeature([
      CollaborationRunEntity,
      CollaborationReferralEntity,
    ]),
  ],
  providers: [OrchestrationService, ExecutionResultService],
  exports: [OrchestrationService],
})
export class OrchestrationModule {}
