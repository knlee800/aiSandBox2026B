import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { WorkerProcessor } from './worker.processor';

@Module({
  imports: [QueueModule],
  providers: [WorkerProcessor],
})
export class WorkerModule {}
