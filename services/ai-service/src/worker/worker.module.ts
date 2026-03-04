import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueModule } from '../queue/queue.module';
import { QueueService } from '../queue/queue.service';
import { AIExecutionModule } from '../ai-execution/ai-execution.module';
import { WorkerProcessor } from './worker.processor';
import { ExecutionStreamPublisher } from '../streaming/execution-stream.publisher';
import { MetricsController } from '../metrics/metrics.controller';
import { QueueController } from '../internal/queue.controller';

@Module({
  controllers: [MetricsController, QueueController],
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      synchronize: false,
    }),
    QueueModule,
    AIExecutionModule,
  ],
  providers: [
    WorkerProcessor,
    ExecutionStreamPublisher,
    {
      provide: 'AI_EXECUTION_QUEUE',
      useFactory: (queueService: QueueService) =>
        queueService.createQueue('ai-execution'),
      inject: [QueueService],
    },
  ],
})
export class WorkerModule {}
