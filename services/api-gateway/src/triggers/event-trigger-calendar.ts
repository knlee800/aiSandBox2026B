import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EntitlementService } from '../auth/entitlement.service';
import { CALENDAR_WINDOW_MAX_MS } from '../connectors/connector-servers';
import { ConnectorBroker, type CalendarWindowEvent } from '../connectors/connector-broker';
import {
  AgentEventTrigger,
  type AgentEventTriggerCalendarState,
} from '../entities/agent-event-trigger.entity';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ConnectorConnection } from '../entities/connector-connection.entity';
import { User } from '../entities/user.entity';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import {
  EVENT_TRIGGER_AUDIT_CATEGORY,
  EVENT_TRIGGER_AUDIT_SUBJECT_TYPE,
  EVENT_TRIGGER_CALENDAR_CONNECTOR_KIND,
} from './event-trigger.service';
import { EVENT_TRIGGER_RUN_AUDIT_EVENTS, confirmReadReasonOf } from './event-trigger-reasons';
import { isEventTriggersEnabled } from './event-trigger-switch';

/** TRIGGER-EVENT-01 S3 (stage-start section 3, Keith's Q9): code constants, no env knobs. */
export const EVENT_TRIGGER_CALENDAR_LIMITS = {
  /** One read per owner in this time (counted from the last attempt, good or failed). */
  refreshEveryMs: 10 * 60 * 1000,
  /** The window reaches the owner's longest lead plus this. */
  windowSlackMs: 15 * 60 * 1000,
  /** A window never exceeds the broker's 3 hours. */
  windowMaxMs: CALENDAR_WINDOW_MAX_MS,
  /** The memory copy is dropped after this. */
  memoryTtlMs: 20 * 60 * 1000,
  /** Owners refreshed per tick, one at a time. */
  ownersPerTick: 3,
  /** Failed reads in a row before the state is read_failed. */
  failuresBeforeReadFailed: 3,
  /** The confirm read covers the occurrence's start plus this. */
  confirmSlackMs: 60 * 1000,
} as const;

/** The result of the confirm read before a start. */
export type EventTriggerConfirmRead =
  | { kind: 'ok'; events: CalendarWindowEvent[] }
  | { kind: 'runs_off' }
  | { kind: 'connector_missing' }
  | { kind: 'failed' };

/** What one refresh did (counts only; for tests). */
export interface EventTriggerCalendarRefreshSummary {
  read: number;
  failed: number;
  connectorMissing: number;
  skippedOwners: number;
}

interface OwnerMemory {
  /** The last good read's events; held in this process only. */
  events: CalendarWindowEvent[] | null;
  /** When `events` was read (ms). */
  readAt: number | null;
  /** The last attempt (good, failed, missing or not allowed), for the 10-minute pace. */
  attemptAt: number;
  /** Failed reads in a row. */
  failures: number;
}

function errorName(error: unknown): string {
  const name = error instanceof Error ? error.name : 'Error';
  return /^[A-Za-z0-9_]{1,64}$/.test(name) ? name : 'Error';
}

function timeOf(value: Date | string | null | undefined): number {
  if (value === null || value === undefined) return Number.NEGATIVE_INFINITY;
  const time = (value instanceof Date ? value : new Date(value)).getTime();
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

/**
 * TRIGGER-EVENT-01 S3 (stage-start section 3): the owner's calendar, read for
 * event triggers.
 *
 * refresh() runs once a tick from the run service. For each owner with at
 * least one enabled trigger whose last attempt is 10 minutes old or more, at
 * most 3 owners a tick and one at a time, it reads the window now .. now +
 * (that owner's longest lead + 15 minutes), capped at 3 hours, through
 * ConnectorBroker.readCalendarWindow (which writes the content-free
 * connector.trigger_read audit row; Keith's Q10).
 *
 * Nothing is read when: EVENT_TRIGGERS_ENABLED is off; runs are off (Keith's
 * Q12); the owner is missing, inactive or has no harness access; the owner has
 * no ical connector_connections row (counted first, so no failing broker
 * call; the owner's triggers then show connector_missing).
 *
 * The result is kept in this process's memory only: per owner, the events and
 * the time of the read. It is dropped after 20 minutes, when the owner has no
 * enabled trigger, and on restart. It is never written to a table, an audit
 * row or a log; titles and uids are read here and in the due rule only.
 *
 * Calendar state: the first good read sets ok; 3 failed reads in a row set
 * read_failed; no connection sets connector_missing. The state and its time
 * are written to all of the owner's triggers together (the routes show the
 * newest), with one calendar_state_changed audit row when the owner's state
 * changes. The confirm read (confirm()) does not change the state.
 */
@Injectable()
export class EventTriggerCalendar {
  private readonly logger = new Logger('EventTriggerCalendar');
  private readonly memory = new Map<string, OwnerMemory>();

  constructor(
    @InjectRepository(AgentEventTrigger)
    private readonly triggers: Repository<AgentEventTrigger>,
    @InjectRepository(ConnectorConnection)
    private readonly connections: Repository<ConnectorConnection>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(AuditEventEntity)
    private readonly audit: Repository<AuditEventEntity>,
    private readonly broker: ConnectorBroker,
    private readonly entitlements: EntitlementService,
  ) {}

  /** The owner's events from the memory copy; empty when there is none or it is older than 20 minutes. */
  eventsFor(userId: string, now: Date): CalendarWindowEvent[] {
    const entry = this.memory.get(userId);
    if (!entry || entry.events === null || entry.readAt === null) {
      return [];
    }
    if (now.getTime() - entry.readAt >= EVENT_TRIGGER_CALENDAR_LIMITS.memoryTtlMs) {
      entry.events = null;
      entry.readAt = null;
      return [];
    }
    return entry.events;
  }

  /** The 10-minute reads for the owners of these enabled triggers. */
  async refresh(enabled: AgentEventTrigger[], now: Date): Promise<EventTriggerCalendarRefreshSummary> {
    const summary: EventTriggerCalendarRefreshSummary = { read: 0, failed: 0, connectorMissing: 0, skippedOwners: 0 };
    const leads = new Map<string, number>();
    for (const trigger of enabled) {
      if (trigger.enabled !== true) continue;
      const lead = Number(trigger.leadMinutes);
      leads.set(trigger.userId, Math.max(leads.get(trigger.userId) ?? 0, Number.isFinite(lead) ? lead : 0));
    }
    this.forgetOthers(new Set(leads.keys()), now);
    if (!this.allowed()) {
      return summary;
    }

    const due = [...leads.keys()]
      .filter((userId) => {
        const entry = this.memory.get(userId);
        return !entry || now.getTime() - entry.attemptAt >= EVENT_TRIGGER_CALENDAR_LIMITS.refreshEveryMs;
      })
      .sort((a, b) => (this.memory.get(a)?.attemptAt ?? -1) - (this.memory.get(b)?.attemptAt ?? -1));

    let refreshed = 0;
    for (const userId of due) {
      if (refreshed >= EVENT_TRIGGER_CALENDAR_LIMITS.ownersPerTick) {
        break;
      }
      // Checked again before each owner: a switch can go off while a read runs.
      if (!this.allowed()) {
        break;
      }
      refreshed += 1;
      const entry = this.entryFor(userId, now);
      entry.attemptAt = now.getTime();
      if (!(await this.ownerAllowed(userId))) {
        this.drop(entry);
        summary.skippedOwners += 1;
        continue;
      }
      if (!(await this.hasConnection(userId))) {
        this.drop(entry);
        entry.failures = 0;
        summary.connectorMissing += 1;
        await this.setState(userId, 'connector_missing', now);
        continue;
      }
      const span = Math.min(
        (leads.get(userId) ?? 0) * 60 * 1000 + EVENT_TRIGGER_CALENDAR_LIMITS.windowSlackMs,
        EVENT_TRIGGER_CALENDAR_LIMITS.windowMaxMs,
      );
      try {
        const events = await this.broker.readCalendarWindow(userId, now, new Date(now.getTime() + span));
        entry.events = events;
        entry.readAt = now.getTime();
        entry.failures = 0;
        summary.read += 1;
        await this.setState(userId, 'ok', now);
      } catch (error) {
        if (confirmReadReasonOf(error) === 'connector_missing') {
          // The connection went between the count and the read.
          this.drop(entry);
          entry.failures = 0;
          summary.connectorMissing += 1;
          await this.setState(userId, 'connector_missing', now);
          continue;
        }
        entry.failures += 1;
        summary.failed += 1;
        this.logger.warn(`event trigger calendar read failed userId=${userId} reason=${errorName(error)}`);
        if (entry.failures >= EVENT_TRIGGER_CALENDAR_LIMITS.failuresBeforeReadFailed) {
          await this.setState(userId, 'read_failed', now);
        }
      }
    }
    return summary;
  }

  /**
   * Stage-start section 3: one fresh read just before a start, the authority
   * for whether the occurrence is still there. The window is now .. the
   * occurrence's start plus a minute (at least a minute, at most 3 hours).
   * Runs switched off since the tick began: no read (Keith's Q12); the run
   * service records the claimed occurrence as runs_off. The flag is the
   * timer's (checked once a tick), so a tick under way finishes its claims.
   */
  async confirm(userId: string, eventStart: Date, now: Date): Promise<EventTriggerConfirmRead> {
    if (!KillSwitchConfig.GLOBAL_EXECUTION_ENABLED) {
      return { kind: 'runs_off' };
    }
    if (!(await this.hasConnection(userId))) {
      return { kind: 'connector_missing' };
    }
    const span = Math.min(
      Math.max(
        eventStart.getTime() - now.getTime() + EVENT_TRIGGER_CALENDAR_LIMITS.confirmSlackMs,
        EVENT_TRIGGER_CALENDAR_LIMITS.confirmSlackMs,
      ),
      EVENT_TRIGGER_CALENDAR_LIMITS.windowMaxMs,
    );
    try {
      const events = await this.broker.readCalendarWindow(userId, now, new Date(now.getTime() + span));
      return { kind: 'ok', events };
    } catch (error) {
      if (confirmReadReasonOf(error) === 'connector_missing') {
        return { kind: 'connector_missing' };
      }
      this.logger.warn(`event trigger confirm read failed userId=${userId} reason=${errorName(error)}`);
      return { kind: 'failed' };
    }
  }

  /** The flag and the runs switch, read live. */
  private allowed(): boolean {
    return isEventTriggersEnabled() && KillSwitchConfig.GLOBAL_EXECUTION_ENABLED;
  }

  private async ownerAllowed(userId: string): Promise<boolean> {
    try {
      const owner = await this.users.findOne({ where: { id: userId }, select: ['id', 'isActive'] });
      if (!owner || owner.isActive !== true) {
        return false;
      }
      return (await this.entitlements.resolveHarnessEntitled(userId)) === true;
    } catch (error) {
      this.logger.warn(`event trigger owner check failed userId=${userId} reason=${errorName(error)}`);
      return false;
    }
  }

  /** Whether the owner has a calendar connection row: a count only, the secret column is never read. */
  private async hasConnection(userId: string): Promise<boolean> {
    return (
      (await this.connections.count({ where: { userId, kind: EVENT_TRIGGER_CALENDAR_CONNECTOR_KIND } })) > 0
    );
  }

  private entryFor(userId: string, now: Date): OwnerMemory {
    let entry = this.memory.get(userId);
    if (!entry) {
      entry = { events: null, readAt: null, attemptAt: now.getTime(), failures: 0 };
      this.memory.set(userId, entry);
    }
    return entry;
  }

  private drop(entry: OwnerMemory): void {
    entry.events = null;
    entry.readAt = null;
  }

  /** Owners with no enabled trigger are forgotten; expired copies are dropped. */
  private forgetOthers(owners: ReadonlySet<string>, now: Date): void {
    for (const [userId, entry] of this.memory) {
      if (!owners.has(userId)) {
        this.memory.delete(userId);
        continue;
      }
      if (entry.readAt !== null && now.getTime() - entry.readAt >= EVENT_TRIGGER_CALENDAR_LIMITS.memoryTtlMs) {
        this.drop(entry);
      }
    }
  }

  /**
   * Writes the state and its time to all of the owner's triggers when any of
   * them differs; one calendar_state_changed audit row when the owner's state
   * (the newest one, as the routes show it) changes. Ids and the state only.
   */
  private async setState(userId: string, state: AgentEventTriggerCalendarState, now: Date): Promise<void> {
    try {
      const rows = await this.triggers.find({
        where: { userId },
        order: { createdAt: 'ASC' },
        select: ['id', 'userId', 'calendarState', 'calendarStateAt', 'createdAt'],
      });
      if (rows.length === 0) {
        return;
      }
      if (rows.every((row) => row.calendarState === state)) {
        return;
      }
      const shown = shownState(rows);
      await this.triggers.update({ userId }, { calendarState: state, calendarStateAt: now });
      if (shown === state) {
        return;
      }
      await this.audit.insert({
        category: EVENT_TRIGGER_AUDIT_CATEGORY,
        eventType: EVENT_TRIGGER_RUN_AUDIT_EVENTS.calendarStateChanged,
        subjectType: EVENT_TRIGGER_AUDIT_SUBJECT_TYPE,
        subjectId: rows[0].id,
        userId,
        payload: { triggerId: rows[0].id, state },
        occurredAt: now,
      });
      this.logger.log(`event trigger calendar state userId=${userId} state=${state}`);
    } catch (error) {
      this.logger.warn(`event trigger calendar state write failed userId=${userId} reason=${errorName(error)}`);
    }
  }
}

/** The owner's state as the routes show it: the newest recorded one, or ok when none was recorded. */
function shownState(rows: AgentEventTrigger[]): AgentEventTriggerCalendarState {
  let newest: AgentEventTrigger | null = null;
  for (const row of rows) {
    if (row.calendarStateAt === null || row.calendarStateAt === undefined) continue;
    if (newest === null || timeOf(row.calendarStateAt) > timeOf(newest.calendarStateAt)) {
      newest = row;
    }
  }
  return newest ? newest.calendarState : 'ok';
}
