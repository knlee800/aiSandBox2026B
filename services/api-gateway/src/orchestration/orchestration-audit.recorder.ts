import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEventEntity } from '../entities/audit-event.entity';
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

/**
 * Keeps the in-memory list and log line, then inserts one immutable row.
 * The insert is not awaited: a slow or failed write must not block or fail
 * the collaboration action that emitted the event.
 */
@Injectable()
export class StoredOrchestrationAuditRecorder extends InMemoryOrchestrationAuditRecorder {
  private readonly persistLogger = new Logger(StoredOrchestrationAuditRecorder.name);

  constructor(
    @InjectRepository(AuditEventEntity)
    private readonly auditEvents: Repository<AuditEventEntity>,
  ) {
    super();
  }

  override record(event: OrchestrationAuditEvent): void {
    super.record(event);
    this.persist(event);
  }

  private persist(event: OrchestrationAuditEvent): void {
    let pending: Promise<unknown>;
    try {
      pending = Promise.resolve(
        this.auditEvents.insert({
          category: 'orchestration',
          eventType: event.eventType,
          subjectType: 'collaboration_run',
          subjectId: event.collaborationRunId,
          userId: null,
          payload: event,
          occurredAt: new Date(event.timestamp),
        }),
      );
    } catch {
      this.warnInsertFailed(event);
      return;
    }

    void pending.catch(() => {
      this.warnInsertFailed(event);
    });
  }

  private warnInsertFailed(event: OrchestrationAuditEvent): void {
    this.persistLogger.warn(
      `orchestration audit insert failed eventType=${event.eventType} collaborationRunId=${event.collaborationRunId}`,
    );
  }
}
