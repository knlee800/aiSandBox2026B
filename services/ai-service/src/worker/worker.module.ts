import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { QueueModule } from '../queue/queue.module';
import { QueueService } from '../queue/queue.service';
import { AIExecutionModule } from '../ai-execution/ai-execution.module';
import { WorkerProcessor } from './worker.processor';
import { ExecutionStreamPublisher } from '../streaming/execution-stream.publisher';
import { MetricsController } from '../metrics/metrics.controller';
import { QueueController } from '../internal/queue.controller';
import { QueueMetricsUpdater } from '../observability/queue-metrics-updater';
import { ApiGatewayHttpClient } from '../clients/api-gateway-http.client';

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
    HttpModule,
  ],
  providers: [
    WorkerProcessor,
    ExecutionStreamPublisher,
    QueueMetricsUpdater,
    ApiGatewayHttpClient,
    {
      provide: 'AI_EXECUTION_QUEUE',
      useFactory: (queueService: QueueService) =>
        queueService.createQueue('ai-execution'),
      inject: [QueueService],
    },
  ],
})
export class WorkerModule {}
