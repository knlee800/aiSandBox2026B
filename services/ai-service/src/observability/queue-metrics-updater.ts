import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { updateQueueDepth } from './queue-metrics';

const UPDATE_INTERVAL_MS = 10_000;

/**
 * Phase-52D: Periodically updates queue depth gauges from BullMQ.
 * Non-blocking, passive instrumentation only.
 */
@Injectable()
export class QueueMetricsUpdater implements OnModuleInit, OnModuleDestroy {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject('AI_EXECUTION_QUEUE') private readonly queue: Queue,
  ) {}

  onModuleInit(): void {
    this.intervalHandle = setInterval(() => this.tick(), UPDATE_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.intervalHandle != null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private async tick(): Promise<void> {
    try {
      const counts = await this.queue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
      );
      updateQueueDepth({
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
      });
    } catch {
      /* Metrics failures must never affect execution */
    }
  }
}
