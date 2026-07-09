import { Module } from '@nestjs/common';
import { OrchestrationService } from './orchestration.service';
import { QueueModule } from '../queue/queue.module';
import { ExecutionResultService } from '../ai/execution-result.service';

@Module({
  imports: [QueueModule],
  providers: [OrchestrationService, ExecutionResultService],
  exports: [OrchestrationService],
})
export class OrchestrationModule {}
