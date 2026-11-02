import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { COLLABORATION_SWEEP_INTERVAL_MS } from './collaboration-sweep.constants';
import { OrchestrationService } from './orchestration.service';

@Injectable()
export class CollaborationSweepWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CollaborationSweepWorker.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private sweeping = false;

  constructor(private readonly orchestrationService: OrchestrationService) {}

  onModuleInit(): void {
    if (process.env.JEST_WORKER_ID) {
      return;
    }

    this.timer = setInterval(() => {
      void this.sweepOnce();
    }, COLLABORATION_SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async sweepOnce(): Promise<void> {
    if (this.sweeping) {
      return;
    }
    this.sweeping = true;
    try {
      await this.orchestrationService.sweepCollaborations(new Date());
    } catch (error) {
      const errorName = error instanceof Error ? error.name : 'Error';
      this.logger.error(
        JSON.stringify({
          event: 'collaboration.sweep_failed',
          errorName,
        }),
      );
    } finally {
      this.sweeping = false;
    }
  }
}
