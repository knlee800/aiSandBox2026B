import type { HarnessAuditEvent } from './harness-audit-events';

export interface HarnessAuditRecorder {
  record(event: HarnessAuditEvent): void;
  getEvents(): readonly HarnessAuditEvent[];
}

export class InMemoryHarnessAuditRecorder implements HarnessAuditRecorder {
  private readonly events: HarnessAuditEvent[] = [];

  record(event: HarnessAuditEvent): void {
    this.events.push(event);
  }

  getEvents(): readonly HarnessAuditEvent[] {
    return this.events;
  }
}
