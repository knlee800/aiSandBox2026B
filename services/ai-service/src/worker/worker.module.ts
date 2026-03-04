import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueModule } from '../queue/queue.module';
import { AIExecutionModule } from '../ai-execution/ai-execution.module';
import { WorkerProcessor } from './worker.processor';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      synchronize: false,
    }),
    QueueModule,
    AIExecutionModule,
  ],
  providers: [WorkerProcessor],
})
export class WorkerModule {}
