import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueModule } from '../queue/queue.module';
import { AIExecutionModule } from '../ai-execution/ai-execution.module';
import { WorkerProcessor } from './worker.processor';
import { ExecutionStreamPublisher } from '../streaming/execution-stream.publisher';
import { MetricsController } from '../metrics/metrics.controller';

@Module({
  controllers: [MetricsController],
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      synchronize: false,
    }),
    QueueModule,
    AIExecutionModule,
  ],
  providers: [WorkerProcessor, ExecutionStreamPublisher],
})
export class WorkerModule {}
