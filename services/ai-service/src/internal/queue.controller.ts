import { Controller, Get, Inject } from '@nestjs/common';
import { Queue } from 'bullmq';
import * as os from 'os';

/**
 * Phase-51.4: Queue monitoring endpoint.
 * Read-only observability — does not modify queue semantics or execution behavior.
 */
@Controller('internal/queue')
export class QueueController {
  constructor(
    @Inject('AI_EXECUTION_QUEUE') private readonly queue: Queue,
  ) {}

  @Get('stats')
  async getStats() {
    const counts = await this.queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
    );

    const workers =
      process.env.EXECUTION_WORKER_CONCURRENCY != null &&
      process.env.EXECUTION_WORKER_CONCURRENCY !== ''
        ? Math.max(1, parseInt(process.env.EXECUTION_WORKER_CONCURRENCY, 10) || os.cpus().length)
        : os.cpus().length;

    return {
      queue: 'ai-execution',
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      workers,
    };
  }
}
