import { Controller, Get } from '@nestjs/common';
import { WorkerProcessor } from '../worker/worker.processor';

@Controller('internal')
export class MetricsController {
  constructor(private readonly worker: WorkerProcessor) {}

  @Get('metrics')
  getMetrics() {
    return this.worker.getMetrics();
  }
}
