import { Module } from '@nestjs/common';
import { OrchestrationService } from './orchestration.service';

@Module({
  providers: [OrchestrationService],
  exports: [OrchestrationService],
})
export class OrchestrationModule {}
