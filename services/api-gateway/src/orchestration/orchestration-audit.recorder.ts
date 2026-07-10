import { Injectable, Logger } from '@nestjs/common';
import type { OrchestrationAuditEvent } from './orchestration.contracts';

export interface OrchestrationAuditRecorder {
  record(event: OrchestrationAuditEvent): void;
  getEvents(): readonly OrchestrationAuditEvent[];
  clear(): void;
}

@Injectable()
export class InMemoryOrchestrationAuditRecorder implements OrchestrationAuditRecorder {
  private readonly logger = new Logger(InMemoryOrchestrationAuditRecorder.name);
  private readonly events: OrchestrationAuditEvent[] = [];

  record(event: OrchestrationAuditEvent): void {
    this.events.push(event);
    this.logger.log(JSON.stringify(event));
  }

  getEvents(): readonly OrchestrationAuditEvent[] {
    return this.events;
  }

  clear(): void {
    this.events.length = 0;
  }
}
