import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EntitlementService } from '../auth/entitlement.service';
import { ConnectorBroker, type RecentMailMessage } from '../connectors/connector-broker';
import {
  AgentMailTrigger,
  type AgentMailTriggerMailState,
} from '../entities/agent-mail-trigger.entity';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ConnectorConnection } from '../entities/connector-connection.entity';
import { User } from '../entities/user.entity';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import { MAIL_TRIGGER_LOOKBACK_MS } from './mail-trigger-match';
import { MAIL_TRIGGER_RUN_AUDIT_EVENTS, mailReadFailureOf } from './mail-trigger-reasons';
import { isMailTriggersEnabled } from './mail-trigger-switch';
import {
  MAIL_TRIGGER_AUDIT_CATEGORY,
  MAIL_TRIGGER_AUDIT_SUBJECT_TYPE,
  MAIL_TRIGGER_MAIL_CONNECTOR_KIND,
} from './mail-trigger.service';

/** TRIGGER-MAIL-01 S3 (stage-start section 3, Keith's Q10): code constants, no env knobs. */
export const MAIL_TRIGGER_MAILBOX_LIMITS = {
  /** One read per owner in this time (counted from the last attempt, good or failed). */
  readEveryMs: 10 * 60 * 1000,
  /** After failuresBeforeReadFailed failed reads in a row, one read in this time. */
  readFailedEveryMs: 60 * 60 * 1000,
  /** Failed reads in a row before the state is read_failed and reads slow to hourly. */
  failuresBeforeReadFailed: 3,
  /** Owners read per tick, one at a time (agents keep at least 3 of the broker's 4 slots). */
  ownersPerTick: 3,
  /** The read looks back at most this far (Keith's Q5). */
  lookbackMs: MAIL_TRIGGER_LOOKBACK_MS,
} as const;

/**
 * One owner's read, handed to the caller in the tick that made it and never
 * kept: no field of this class holds it.
 */
export interface MailTriggerOwnerRead {
  userId: string;
  uidValidity: number;
  messages: RecentMailMessage[];
}

/** What one refresh did (counts only; for tests). */
export interface MailTriggerMailboxSummary {
  read: number;
  failed: number;
  connectorMissing: number;
  skippedOwners: number;
  /**
   * CONN-MAIL-AUTH-STATE-01 D4: owners skipped because the mail server refused the
   * saved password (no sign-in), or whose read the broker answered with that 409.
   * Not failures.
   */
  signInRefused: number;
}

/** CONN-MAIL-AUTH-STATE-01 D4: the owner's mail connection as the timer needs it. */
type MailConnectionState = 'missing' | 'sign_in_refused' | 'ready';

/** Per owner, in this process only: when it was last tried and how many reads failed in a row. No mail. */
interface OwnerPace {
  attemptAt: number;
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
 * TRIGGER-MAIL-01 S3 (stage-start section 3): the owner's Inbox, read for
 * mail triggers.
 *
 * refresh() runs once a tick from the run service. For each owner with at
 * least one enabled trigger whose last attempt is old enough (10 minutes; an
 * hour once three reads in a row failed), at most 3 owners a tick and one at
 * a time, it reads the unread Inbox mail that arrived since the later of
 * (now minus 60 minutes) and the owner's earliest armed_at, through
 * ConnectorBroker.readRecentMail (which writes the content-free
 * connector.trigger_read audit row; Keith's Q12). Each read is one sign-in.
 *
 * The read goes straight to the caller's handler and is matched, claimed and
 * started in that tick (stage-start section 3, P2): there is no memory copy
 * and no confirm read. This class keeps only the pace per owner (the time of
 * the last attempt and the failures in a row), never a sender, subject, UID
 * or arrival time.
 *
 * Nothing is read when: MAIL_TRIGGERS_ENABLED is off; runs are off (Keith's
 * Q14); the owner is missing, inactive or has no harness access; the owner
 * has no imap connector_connections row (looked up first, so no failing broker
 * call; the owner's triggers then show connector_missing); CONN-MAIL-AUTH-STATE-01
 * D4: the row is marked sign_in_refused (the server refused the saved password;
 * no sign-in, not a failure, until the owner saves a new one or a Test succeeds).
 *
 * Mailbox state: a good read sets ok; 3 failed reads in a row set
 * read_failed and the hourly pace; no connection (or a broker 404) sets
 * connector_missing. The state and its time are written to all of the
 * owner's triggers together (the routes show the newest), with one
 * mail_state_changed audit row when the owner's state changes. An owner whose
 * triggers already show read_failed when first seen (after a restart) starts
 * at the hourly pace's failure count, so a revoked password does not get
 * three quick sign-ins after every restart.
 */
@Injectable()
export class MailTriggerMailbox {
  private readonly logger = new Logger('MailTriggerMailbox');
  private readonly pace = new Map<string, OwnerPace>();

  constructor(
    @InjectRepository(AgentMailTrigger)
    private readonly triggers: Repository<AgentMailTrigger>,
    @InjectRepository(ConnectorConnection)
    private readonly connections: Repository<ConnectorConnection>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(AuditEventEntity)
    private readonly audit: Repository<AuditEventEntity>,
    private readonly broker: ConnectorBroker,
    private readonly entitlements: EntitlementService,
  ) {}

  /** The reads due for the owners of these enabled triggers; each good read goes to `handle` at once. */
  async refresh(
    enabled: AgentMailTrigger[],
    now: Date,
    handle: (read: MailTriggerOwnerRead) => Promise<void>,
  ): Promise<MailTriggerMailboxSummary> {
    const summary: MailTriggerMailboxSummary = {
      read: 0,
      failed: 0,
      connectorMissing: 0,
      skippedOwners: 0,
      signInRefused: 0,
    };
    const owners = new Map<string, AgentMailTrigger[]>();
    for (const trigger of enabled) {
      if (trigger.enabled !== true) continue;
      const list = owners.get(trigger.userId) ?? [];
      list.push(trigger);
      owners.set(trigger.userId, list);
    }
    this.forgetOthers(new Set(owners.keys()));
    if (!this.allowed()) {
      return summary;
    }

    const due = [...owners.keys()]
      .filter((userId) => {
        const entry = this.pace.get(userId);
        return !entry || now.getTime() - entry.attemptAt >= paceOf(entry);
      })
      .sort((a, b) => (this.pace.get(a)?.attemptAt ?? -1) - (this.pace.get(b)?.attemptAt ?? -1));

    let tried = 0;
    for (const userId of due) {
      if (tried >= MAIL_TRIGGER_MAILBOX_LIMITS.ownersPerTick) {
        break;
      }
      // Checked again before each owner: a switch can go off while a read runs.
      if (!this.allowed()) {
        break;
      }
      tried += 1;
      const rows = owners.get(userId) ?? [];
      const entry = this.entryFor(userId, rows, now);
      entry.attemptAt = now.getTime();
      if (!(await this.ownerAllowed(userId))) {
        summary.skippedOwners += 1;
        continue;
      }
      const connection = await this.connectionState(userId);
      if (connection === 'missing') {
        entry.failures = 0;
        summary.connectorMissing += 1;
        await this.setState(userId, 'connector_missing', now);
        continue;
      }
      if (connection === 'sign_in_refused') {
        // CONN-MAIL-AUTH-STATE-01 D4: the server refused the saved password; no
        // sign-in until the owner saves a new one or a Test succeeds. Not a failure,
        // so the read after a reconnect comes at the normal pace.
        entry.failures = 0;
        summary.signInRefused += 1;
        continue;
      }
      let read: MailTriggerOwnerRead;
      try {
        const mail = await this.broker.readRecentMail(userId, sinceFor(rows, now));
        read = { userId, uidValidity: mail.uidValidity, messages: mail.messages };
      } catch (error) {
        const failure = mailReadFailureOf(error);
        if (failure === 'connector_missing') {
          // The connection went between the lookup and the read.
          entry.failures = 0;
          summary.connectorMissing += 1;
          await this.setState(userId, 'connector_missing', now);
          continue;
        }
        if (failure === 'sign_in_refused') {
          // CONN-MAIL-AUTH-STATE-01 D4: the broker has marked the connection refused.
          entry.failures = 0;
          summary.signInRefused += 1;
          continue;
        }
        entry.failures += 1;
        summary.failed += 1;
        this.logger.warn(`mail trigger mailbox read failed userId=${userId} reason=${errorName(error)}`);
        if (entry.failures >= MAIL_TRIGGER_MAILBOX_LIMITS.failuresBeforeReadFailed) {
          await this.setState(userId, 'read_failed', now);
        }
        continue;
      }
      entry.failures = 0;
      summary.read += 1;
      await this.setState(userId, 'ok', now);
      try {
        await handle(read);
      } catch (error) {
        this.logger.warn(`mail trigger read handling failed userId=${userId} reason=${errorName(error)}`);
      }
    }
    return summary;
  }

  /** The flag and the runs switch, read live. */
  private allowed(): boolean {
    return isMailTriggersEnabled() && KillSwitchConfig.GLOBAL_EXECUTION_ENABLED;
  }

  private async ownerAllowed(userId: string): Promise<boolean> {
    try {
      const owner = await this.users.findOne({ where: { id: userId }, select: ['id', 'isActive'] });
      if (!owner || owner.isActive !== true) {
        return false;
      }
      return (await this.entitlements.resolveHarnessEntitled(userId)) === true;
    } catch (error) {
      this.logger.warn(`mail trigger owner check failed userId=${userId} reason=${errorName(error)}`);
      return false;
    }
  }

  /**
   * Whether the owner has a mail connection row and whether the server refused its
   * saved password (CONN-MAIL-AUTH-STATE-01 D4). Reads only `id` and
   * `sign_in_refused_at`; the secret column is never read.
   */
  private async connectionState(userId: string): Promise<MailConnectionState> {
    const row = await this.connections.findOne({
      where: { userId, kind: MAIL_TRIGGER_MAIL_CONNECTOR_KIND },
      select: ['id', 'signInRefusedAt'],
    });
    if (!row) {
      return 'missing';
    }
    return row.signInRefusedAt !== null && row.signInRefusedAt !== undefined ? 'sign_in_refused' : 'ready';
  }

  private entryFor(userId: string, rows: AgentMailTrigger[], now: Date): OwnerPace {
    let entry = this.pace.get(userId);
    if (!entry) {
      const failing = rows.some((row) => row.mailState === 'read_failed');
      entry = {
        attemptAt: now.getTime(),
        failures: failing ? MAIL_TRIGGER_MAILBOX_LIMITS.failuresBeforeReadFailed : 0,
      };
      this.pace.set(userId, entry);
    }
    return entry;
  }

  /** Owners with no enabled trigger are forgotten. */
  private forgetOthers(owners: ReadonlySet<string>): void {
    for (const userId of [...this.pace.keys()]) {
      if (!owners.has(userId)) {
        this.pace.delete(userId);
      }
    }
  }

  /**
   * Writes the state and its time to all of the owner's triggers when any of
   * them differs; one mail_state_changed audit row when the owner's state
   * (the newest one, as the routes show it) changes. Ids and the state only.
   */
  private async setState(userId: string, state: AgentMailTriggerMailState, now: Date): Promise<void> {
    try {
      const rows = await this.triggers.find({
        where: { userId },
        order: { createdAt: 'ASC' },
        select: ['id', 'userId', 'mailState', 'mailStateAt', 'createdAt'],
      });
      if (rows.length === 0) {
        return;
      }
      if (rows.every((row) => row.mailState === state)) {
        return;
      }
      const shown = shownState(rows);
      await this.triggers.update({ userId }, { mailState: state, mailStateAt: now });
      if (shown === state) {
        return;
      }
      await this.audit.insert({
        category: MAIL_TRIGGER_AUDIT_CATEGORY,
        eventType: MAIL_TRIGGER_RUN_AUDIT_EVENTS.mailStateChanged,
        subjectType: MAIL_TRIGGER_AUDIT_SUBJECT_TYPE,
        subjectId: rows[0].id,
        userId,
        payload: { triggerId: rows[0].id, state },
        occurredAt: now,
      });
      this.logger.log(`mail trigger mailbox state userId=${userId} state=${state}`);
    } catch (error) {
      this.logger.warn(`mail trigger mailbox state write failed userId=${userId} reason=${errorName(error)}`);
    }
  }
}

/** 10 minutes; an hour once three reads in a row failed (Keith's Q10). */
function paceOf(entry: OwnerPace): number {
  return entry.failures >= MAIL_TRIGGER_MAILBOX_LIMITS.failuresBeforeReadFailed
    ? MAIL_TRIGGER_MAILBOX_LIMITS.readFailedEveryMs
    : MAIL_TRIGGER_MAILBOX_LIMITS.readEveryMs;
}

/**
 * Stage-start section 3: the later of (now minus 60 minutes) and the owner's
 * earliest armed_at among the enabled triggers, never after now.
 */
export function sinceFor(rows: Pick<AgentMailTrigger, 'armedAt'>[], now: Date): Date {
  let since = now.getTime() - MAIL_TRIGGER_MAILBOX_LIMITS.lookbackMs;
  let earliest = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    const armed = timeOf(row.armedAt);
    if (Number.isFinite(armed)) {
      earliest = Math.min(earliest, armed);
    }
  }
  if (Number.isFinite(earliest)) {
    since = Math.max(since, earliest);
  }
  return new Date(Math.min(since, now.getTime()));
}

/** The owner's state as the routes show it: the newest recorded one, or ok when none was recorded. */
function shownState(rows: AgentMailTrigger[]): AgentMailTriggerMailState {
  let newest: AgentMailTrigger | null = null;
  for (const row of rows) {
    if (row.mailStateAt === null || row.mailStateAt === undefined) continue;
    if (newest === null || timeOf(row.mailStateAt) > timeOf(newest.mailStateAt)) {
      newest = row;
    }
  }
  return newest ? newest.mailState : 'ok';
}
