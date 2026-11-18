import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  GatewayTimeoutException,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { Repository } from 'typeorm';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ConnectorConnection } from '../entities/connector-connection.entity';
import {
  CONNECTOR_SESSION_OPENER,
  CONNECTOR_TIMERS,
  ConnectorMcpSession,
  ConnectorSessionOpener,
  ConnectorTimers,
  systemConnectorTimers,
} from './connector-child';
import {
  CONNECTOR_CREDENTIALS_UNAVAILABLE_MESSAGE,
  assertConnectorCredentialsConfigured,
  decryptConnectorSecret,
} from './connector-crypto';
import {
  CONNECTION_NOT_FOUND_MESSAGE,
  INVALID_CONNECTOR_MESSAGE,
  ImapPreset,
  isImapPreset,
} from './connector-rules';
import {
  CALENDAR_TOOL,
  CALENDAR_WINDOW_MAX_MS,
  CALENDAR_WINDOW_TOOL,
  CONNECTOR_ARGUMENTS_MESSAGE,
  CONNECTOR_BUSY_MESSAGE,
  CONNECTOR_CALL_TIMEOUT_MS,
  CONNECTOR_IDLE_MS,
  CONNECTOR_MAX_IN_FLIGHT,
  CONNECTOR_MAX_RESULT_BYTES,
  CONNECTOR_RESULT_MESSAGE,
  CONNECTOR_SERVER_ID,
  CONNECTOR_SERVER_MESSAGE,
  CONNECTOR_TIMEOUT_MESSAGE,
  CONNECTOR_TOOL_MESSAGE,
  CONNECTOR_TOOL_MISSING_MESSAGE,
  CONNECTOR_UNAVAILABLE_MESSAGE,
  ConnectorToolDefinition,
  MAIL_CHILD_SIGN_IN_REFUSED_TEXT,
  MAIL_MESSAGE_NOT_FOUND_MESSAGE,
  MAIL_READ_TOOL_ID,
  MAIL_RECENT_MAX_LOOKBACK_MS,
  MAIL_RECENT_MAX_MESSAGES,
  MAIL_RECENT_TOOL,
  MAIL_SIGN_IN_REFUSED_MESSAGE,
  MAIL_TOOL,
  findCompanionTool,
  findGrantableTool,
  isFixedConnectorFailure,
  isInternalConnectorTool,
  scrubSecrets,
} from './connector-servers';

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_TOOL_NAME = /^[A-Za-z0-9_-]{1,64}$/;

export type ConnectorAuditAction = 'connector_call' | 'connector_verify';
/**
 * TRIGGER-EVENT-01 S1: the gateway's own calendar window read is audited under its own action.
 * TRIGGER-MAIL-01 S1: the gateway's own recent-mail read uses the same action; the row names the tool.
 */
export type ConnectorAuditEvent = ConnectorAuditAction | 'connector_trigger_read';
export type ConnectorAuditOutcome = 'ok' | 'error' | 'timeout';

export interface ConnectorCallInput {
  userId: unknown;
  toolId: unknown;
  args: unknown;
  action: ConnectorAuditAction;
  serverId?: unknown;
}

export interface ConnectorAuditPayload {
  action: ConnectorAuditEvent;
  toolId: string;
  userId: string;
  itemCount: number;
  resultBytes: number;
  durationMs: number;
  outcome: ConnectorAuditOutcome;
}

/**
 * TRIGGER-EVENT-01 S1: one timed, not-cancelled occurrence from readCalendarWindow.
 * Held in memory by the caller only: never stored, logged or audited.
 */
export interface CalendarWindowEvent {
  uid: string;
  title: string;
  start: string;
  end: string;
}

/**
 * TRIGGER-MAIL-01 S1: one unread Inbox message from readRecentMail: the server's UID,
 * the sender's address, the subject and the server's arrival time. Held in memory by
 * the caller only: never stored, logged or audited.
 */
export interface RecentMailMessage {
  uid: number;
  fromAddress: string;
  subject: string;
  arrivedAt: string;
}

/** TRIGGER-MAIL-01 S1: the Inbox's UIDVALIDITY and its recent unread messages, newest first. */
export interface RecentMailRead {
  uidValidity: number;
  messages: RecentMailMessage[];
}

const AUDIT_EVENT_TYPES: Record<ConnectorAuditEvent, string> = {
  connector_call: 'connector.call',
  connector_verify: 'connector.verify',
  connector_trigger_read: 'connector.trigger_read',
};

class ConnectorTimeout extends Error {
  constructor() {
    super(CONNECTOR_TIMEOUT_MESSAGE);
    this.name = 'ConnectorTimeout';
  }
}

@Injectable()
export class ConnectorBroker implements OnModuleDestroy {
  private readonly logger = new Logger(ConnectorBroker.name);
  private readonly timers: ConnectorTimers;
  private readonly ignored = new Set<string>();
  private session: ConnectorMcpSession | null = null;
  /** The tool names each child listed when it started (TRIGGER-EVENT-01 S1). */
  private readonly sessionTools = new WeakMap<ConnectorMcpSession, ReadonlySet<string>>();
  private sessionPromise: Promise<ConnectorMcpSession> | null = null;
  private reconciled = false;
  private inFlight = 0;
  private idle: { cancel(): void } | null = null;

  constructor(
    @InjectRepository(ConnectorConnection)
    private readonly connections: Repository<ConnectorConnection>,
    @InjectRepository(AuditEventEntity)
    private readonly auditEvents: Repository<AuditEventEntity>,
    @Inject(CONNECTOR_SESSION_OPENER)
    private readonly openSession: ConnectorSessionOpener,
    @Optional() @Inject(CONNECTOR_TIMERS) timers?: ConnectorTimers,
  ) {
    this.timers = timers ?? systemConnectorTimers();
  }

  onModuleDestroy(): void {
    this.clearIdle();
    const current = this.session;
    this.session = null;
    this.reconciled = false;
    void current?.close().catch(() => undefined);
  }

  async callConnectorTool(input: ConnectorCallInput): Promise<{ result: unknown }> {
    const started = Date.now();
    if (!isUserId(input.userId)) {
      throw new BadRequestException(INVALID_CONNECTOR_MESSAGE);
    }
    const userId = input.userId;
    const secrets: string[] = [];
    let audited = false;
    let slot = false;
    let toolId = 'unknown';
    let connectionId: string | null = null;
    try {
      if (input.serverId !== undefined && input.serverId !== CONNECTOR_SERVER_ID) {
        await this.writeAudit(input.action, userId, toolId, connectionId, started, 'error', 0, 0);
        audited = true;
        throw new BadRequestException(CONNECTOR_SERVER_MESSAGE);
      }
      // CONN-MAIL-READ-01: a companion tool too; the internal route has already
      // checked that the job's grant token lists it.
      const tool = findGrantableTool(input.toolId);
      if (!tool) {
        await this.writeAudit(input.action, userId, toolId, connectionId, started, 'error', 0, 0);
        audited = true;
        throw new BadRequestException(CONNECTOR_TOOL_MESSAGE);
      }
      toolId = tool.id;
      assertConnectorCredentialsConfigured();
      const modelArgs = readModelArguments(tool, input.args);
      const row = await this.loadConnection(userId, tool.kind);
      connectionId = row.id;
      // CONN-MAIL-AUTH-STATE-01 D3: no sign-in while the server's refusal stands. The
      // Test button (connector_verify) still signs in: it is one way to reconnect.
      if (tool.kind === 'imap' && input.action === 'connector_call' && isSignInRefusedRow(row)) {
        throw new ConflictException(MAIL_SIGN_IN_REFUSED_MESSAGE);
      }
      const secret = decryptConnectorSecret(userId, tool.kind, row.secretCiphertext);
      secrets.push(secret);
      if (typeof row.username === 'string' && row.username.length > 0) {
        secrets.push(row.username);
      }
      if (this.inFlight >= CONNECTOR_MAX_IN_FLIGHT) {
        await this.writeAudit(input.action, userId, toolId, connectionId, started, 'error', 0, 0);
        audited = true;
        throw new ServiceUnavailableException(CONNECTOR_BUSY_MESSAGE);
      }
      this.inFlight += 1;
      slot = true;
      this.clearIdle();
      const session = await this.ensureSession();
      // CONN-MAIL-READ-01: a companion tool is not required at start-up, so a child
      // without it keeps the mail and calendar tools; the call itself is refused.
      if (findCompanionTool(tool.id) && !this.sessionTools.get(session)?.has(tool.id)) {
        throw new ServiceUnavailableException(CONNECTOR_TOOL_MISSING_MESSAGE);
      }
      const raw = await this.invoke(session, tool.id, childArguments(tool, row, secret, modelArgs));
      if (tool.kind === 'imap' && isChildErrorText(raw, MAIL_CHILD_SIGN_IN_REFUSED_TEXT)) {
        await this.markSignInRefused(row);
        throw new ConflictException(MAIL_SIGN_IN_REFUSED_MESSAGE);
      }
      if (tool.id === MAIL_READ_TOOL_ID && isMailMessageNotFound(raw)) {
        throw new NotFoundException(MAIL_MESSAGE_NOT_FOUND_MESSAGE);
      }
      const read = this.readResult(raw, [secret]);
      await this.writeAudit(
        input.action,
        userId,
        toolId,
        connectionId,
        started,
        'ok',
        read.itemCount,
        read.resultBytes,
      );
      audited = true;
      return { result: read.value };
    } catch (error) {
      this.logFailure(error, secrets);
      if (isMissingKey(error)) throw error;
      if (!audited) {
        const outcome: ConnectorAuditOutcome = error instanceof ConnectorTimeout ? 'timeout' : 'error';
        await this.writeAudit(
          input.action,
          userId,
          toolId,
          connectionId,
          started,
          outcome,
          0,
          0,
        );
      }
      throw this.publicError(error);
    } finally {
      if (slot) {
        this.inFlight -= 1;
        this.armIdle();
      }
    }
  }

  /**
   * TRIGGER-EVENT-01 S1: the gateway's own read of the owner's calendar for event
   * triggers, with no session, request or agent. The same connection load, decrypt,
   * child, 25-second timeout, 64 KB result cap, in-flight limit and secret scrubbing
   * as callConnectorTool. One content-free audit row (`connector.trigger_read`:
   * counts, bytes, duration and outcome) per call. Returns the occurrences that
   * start in [from, to), at most 3 hours apart. No route reaches this method.
   */
  async readCalendarWindow(userId: unknown, from: Date, to: Date): Promise<CalendarWindowEvent[]> {
    const started = Date.now();
    if (!isUserId(userId)) {
      throw new BadRequestException(INVALID_CONNECTOR_MESSAGE);
    }
    const action: ConnectorAuditEvent = 'connector_trigger_read';
    const tool = CALENDAR_WINDOW_TOOL;
    const secrets: string[] = [];
    let audited = false;
    let slot = false;
    let connectionId: string | null = null;
    try {
      assertConnectorCredentialsConfigured();
      const window = readWindow(from, to);
      const row = await this.loadConnection(userId, tool.kind);
      connectionId = row.id;
      const secret = decryptConnectorSecret(userId, tool.kind, row.secretCiphertext);
      secrets.push(secret);
      if (this.inFlight >= CONNECTOR_MAX_IN_FLIGHT) {
        await this.writeAudit(action, userId, tool.id, connectionId, started, 'error', 0, 0);
        audited = true;
        throw new ServiceUnavailableException(CONNECTOR_BUSY_MESSAGE);
      }
      this.inFlight += 1;
      slot = true;
      this.clearIdle();
      const session = await this.ensureSession();
      if (!this.sessionTools.get(session)?.has(tool.id)) {
        throw new ServiceUnavailableException(CONNECTOR_TOOL_MISSING_MESSAGE);
      }
      const raw = await this.invoke(session, tool.id, {
        icalUrl: secret,
        from: window.from,
        to: window.to,
      });
      const read = this.readResult(raw, [secret]);
      const events = readWindowEvents(read.value);
      await this.writeAudit(
        action,
        userId,
        tool.id,
        connectionId,
        started,
        'ok',
        events.length,
        read.resultBytes,
      );
      audited = true;
      return events;
    } catch (error) {
      this.logFailure(error, secrets);
      if (isMissingKey(error)) throw error;
      if (!audited) {
        const outcome: ConnectorAuditOutcome = error instanceof ConnectorTimeout ? 'timeout' : 'error';
        await this.writeAudit(action, userId, tool.id, connectionId, started, outcome, 0, 0);
      }
      throw this.publicError(error);
    } finally {
      if (slot) {
        this.inFlight -= 1;
        this.armIdle();
      }
    }
  }

  /**
   * TRIGGER-MAIL-01 S1: the gateway's own read of the owner's Inbox for mail
   * triggers, with no session, request or agent. Built like readCalendarWindow: the
   * same connection load (kind imap), decrypt, child, 25-second timeout, 64 KB result
   * cap, in-flight limit and secret scrubbing, and one content-free
   * `connector.trigger_read` audit row (counts, bytes, duration and outcome; never a
   * sender, subject, UID or credential) per call. `since` is at most 2 hours back and
   * not in the future. Returns the Inbox's UIDVALIDITY and, for at most 25 unread
   * messages that arrived at or after `since`, newest first, the UID, the sender's
   * address, the subject and the arrival time. No route reaches this method.
   */
  async readRecentMail(userId: unknown, since: Date): Promise<RecentMailRead> {
    const started = Date.now();
    if (!isUserId(userId)) {
      throw new BadRequestException(INVALID_CONNECTOR_MESSAGE);
    }
    const action: ConnectorAuditEvent = 'connector_trigger_read';
    const tool = MAIL_RECENT_TOOL;
    const secrets: string[] = [];
    let audited = false;
    let slot = false;
    let connectionId: string | null = null;
    try {
      assertConnectorCredentialsConfigured();
      const sinceText = readSince(since, started);
      const row = await this.loadConnection(userId, tool.kind);
      connectionId = row.id;
      // CONN-MAIL-AUTH-STATE-01 D3: no sign-in while the server's refusal stands.
      if (isSignInRefusedRow(row)) {
        throw new ConflictException(MAIL_SIGN_IN_REFUSED_MESSAGE);
      }
      const secret = decryptConnectorSecret(userId, tool.kind, row.secretCiphertext);
      secrets.push(secret);
      if (typeof row.username === 'string' && row.username.length > 0) {
        secrets.push(row.username);
      }
      if (!isImapPreset(row.preset) || typeof row.username !== 'string' || row.username.length === 0) {
        throw new ServiceUnavailableException(CONNECTOR_UNAVAILABLE_MESSAGE);
      }
      const preset: ImapPreset = row.preset;
      if (this.inFlight >= CONNECTOR_MAX_IN_FLIGHT) {
        await this.writeAudit(action, userId, tool.id, connectionId, started, 'error', 0, 0);
        audited = true;
        throw new ServiceUnavailableException(CONNECTOR_BUSY_MESSAGE);
      }
      this.inFlight += 1;
      slot = true;
      this.clearIdle();
      const session = await this.ensureSession();
      if (!this.sessionTools.get(session)?.has(tool.id)) {
        throw new ServiceUnavailableException(CONNECTOR_TOOL_MISSING_MESSAGE);
      }
      const raw = await this.invoke(session, tool.id, {
        preset,
        username: row.username,
        appPassword: secret,
        since: sinceText,
      });
      if (isChildErrorText(raw, MAIL_CHILD_SIGN_IN_REFUSED_TEXT)) {
        await this.markSignInRefused(row);
        throw new ConflictException(MAIL_SIGN_IN_REFUSED_MESSAGE);
      }
      // The username is not scrubbed from the result: it is the owner's own address,
      // which is a valid sender. It is scrubbed from every log line.
      const read = this.readResult(raw, [secret], secrets);
      const mail = readRecentMessages(read.value, Date.parse(sinceText));
      await this.writeAudit(
        action,
        userId,
        tool.id,
        connectionId,
        started,
        'ok',
        mail.messages.length,
        read.resultBytes,
      );
      audited = true;
      return mail;
    } catch (error) {
      this.logFailure(error, secrets);
      if (isMissingKey(error)) throw error;
      if (!audited) {
        const outcome: ConnectorAuditOutcome = error instanceof ConnectorTimeout ? 'timeout' : 'error';
        await this.writeAudit(action, userId, tool.id, connectionId, started, outcome, 0, 0);
      }
      throw this.publicError(error);
    } finally {
      if (slot) {
        this.inFlight -= 1;
        this.armIdle();
      }
    }
  }

  private async ensureSession(): Promise<ConnectorMcpSession> {
    if (this.session && this.reconciled) return this.session;
    if (!this.sessionPromise) {
      this.sessionPromise = this.startSession().finally(() => {
        this.sessionPromise = null;
      });
    }
    return this.sessionPromise;
  }

  private async startSession(): Promise<ConnectorMcpSession> {
    const session = await this.openSession();
    session.onExit(() => {
      if (this.session === session) {
        this.session = null;
        this.reconciled = false;
      }
    });
    let names: ReadonlySet<string>;
    try {
      names = await this.reconcile(session);
    } catch (error) {
      await session.close().catch(() => undefined);
      throw error;
    }
    this.sessionTools.set(session, names);
    this.session = session;
    this.reconciled = true;
    return session;
  }

  private async reconcile(session: ConnectorMcpSession): Promise<ReadonlySet<string>> {
    const listed = await session.listTools();
    const names = new Set<string>();
    for (const tool of listed.tools || []) {
      if (!tool || typeof tool.name !== 'string' || tool.name.length === 0) continue;
      names.add(tool.name);
      if (findGrantableTool(tool.name) || isInternalConnectorTool(tool.name)) continue;
      if (this.ignored.has(tool.name)) continue;
      this.ignored.add(tool.name);
      if (SAFE_TOOL_NAME.test(tool.name)) {
        this.logger.warn(`ignored connector tool ${tool.name}`);
      } else {
        this.logger.warn('ignored connector tool');
      }
    }
    for (const required of [MAIL_TOOL.id, CALENDAR_TOOL.id]) {
      if (!names.has(required)) {
        throw new ServiceUnavailableException(CONNECTOR_TOOL_MISSING_MESSAGE);
      }
    }
    return names;
  }

  private invoke(
    session: ConnectorMcpSession,
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = this.timers.delay(CONNECTOR_CALL_TIMEOUT_MS, () => {
        if (settled) return;
        settled = true;
        session.kill();
        reject(new ConnectorTimeout());
      });
      session.callTool(name, args).then(
        (value) => {
          if (settled) return;
          settled = true;
          timer.cancel();
          resolve(value);
        },
        (error: unknown) => {
          if (settled) return;
          settled = true;
          timer.cancel();
          if (isMcpTimeout(error)) reject(new ConnectorTimeout());
          else reject(error);
        },
      );
    });
  }

  /**
   * `secrets` are scrubbed from the result and from log lines; `logSecrets` (default
   * `secrets`) from log lines only (TRIGGER-MAIL-01 S1: the mailbox username).
   */
  private readResult(
    raw: unknown,
    secrets: string[],
    logSecrets: string[] = secrets,
  ): { value: unknown; itemCount: number; resultBytes: number } {
    const body = toolText(raw);
    const resultBytes = Buffer.byteLength(body.text, 'utf8');
    if (body.isError) {
      this.logScrubbed(body.text, logSecrets);
      throw new BadGatewayException(CONNECTOR_RESULT_MESSAGE);
    }
    if (resultBytes > CONNECTOR_MAX_RESULT_BYTES) {
      throw new BadGatewayException(CONNECTOR_RESULT_MESSAGE);
    }
    const scrubbed = scrubSecrets(body.text, secrets);
    try {
      const value: unknown = JSON.parse(scrubbed);
      return { value, itemCount: countItems(value), resultBytes };
    } catch {
      this.logScrubbed(body.text, logSecrets);
      throw new BadGatewayException(CONNECTOR_RESULT_MESSAGE);
    }
  }

  private async loadConnection(userId: string, kind: ConnectorToolDefinition['kind']): Promise<ConnectorConnection> {
    let row: ConnectorConnection | null = null;
    try {
      row = await this.connections.findOne({ where: { userId, kind } });
    } catch {
      this.logger.error('connector lookup failed');
      throw new ServiceUnavailableException(CONNECTOR_UNAVAILABLE_MESSAGE);
    }
    if (!row || row.userId !== userId || row.kind !== kind) {
      throw new NotFoundException(CONNECTION_NOT_FOUND_MESSAGE);
    }
    return row;
  }

  /**
   * CONN-MAIL-AUTH-STATE-01 D2: marks the connection refused with one guarded
   * update: only this row, and only while its updated_at is still the value this
   * call loaded, so a password saved while the read was in flight is never marked.
   * updated_at is compared at millisecond precision (the loaded Date carries no
   * microseconds) and is left unchanged. The secret column is not read. A failed
   * update is logged and does not change the caller's answer.
   */
  private async markSignInRefused(row: ConnectorConnection): Promise<void> {
    try {
      await this.connections
        .createQueryBuilder()
        .update(ConnectorConnection)
        .set({ signInRefusedAt: () => 'now()', updatedAt: () => '"updated_at"' })
        .where('"id" = :id', { id: row.id })
        .andWhere(`date_trunc('milliseconds', "updated_at") = :updatedAt`, { updatedAt: row.updatedAt })
        .execute();
    } catch {
      this.logger.warn('connector sign-in refusal could not be recorded');
    }
  }

  private async writeAudit(
    action: ConnectorAuditEvent,
    userId: string,
    toolId: string,
    connectionId: string | null,
    started: number,
    outcome: ConnectorAuditOutcome,
    itemCount: number,
    resultBytes: number,
  ): Promise<void> {
    const payload: ConnectorAuditPayload = {
      action,
      toolId,
      userId,
      itemCount,
      resultBytes,
      durationMs: Math.max(0, Date.now() - started),
      outcome,
    };
    try {
      await this.auditEvents.save({
        category: 'connector',
        eventType: AUDIT_EVENT_TYPES[action],
        subjectType: 'connector_connection',
        subjectId: (connectionId ?? toolId).slice(0, 64),
        userId,
        payload,
        occurredAt: new Date(),
      });
    } catch {
      this.logger.error('connector audit failed');
      throw new InternalServerErrorException(CONNECTOR_RESULT_MESSAGE);
    }
  }

  private logFailure(error: unknown, secrets: string[]): void {
    if (error instanceof ConnectorTimeout) {
      this.logger.warn('connector call timed out');
      return;
    }
    if (error instanceof HttpException && quietFailure(error)) return;
    this.logScrubbed(errorText(error), secrets);
  }

  private logScrubbed(text: string, secrets: string[]): void {
    this.logger.warn(`connector call failed: ${scrubSecrets(text, secrets).slice(0, 200)}`);
  }

  private publicError(error: unknown): HttpException {
    if (error instanceof ConnectorTimeout) {
      return new GatewayTimeoutException(CONNECTOR_TIMEOUT_MESSAGE);
    }
    if (error instanceof NotFoundException || error instanceof BadRequestException) {
      return error;
    }
    if (isMissingKey(error)) return error;
    if (error instanceof HttpException && isFixedConnectorFailure(error.message)) {
      return error;
    }
    return new ServiceUnavailableException(CONNECTOR_UNAVAILABLE_MESSAGE);
  }

  private armIdle(): void {
    this.clearIdle();
    if (this.inFlight > 0 || !this.session) return;
    this.idle = this.timers.delay(CONNECTOR_IDLE_MS, () => {
      this.idle = null;
      if (this.inFlight > 0) return;
      const current = this.session;
      this.session = null;
      this.reconciled = false;
      void current?.close().catch(() => undefined);
    });
  }

  private clearIdle(): void {
    this.idle?.cancel();
    this.idle = null;
  }
}

function isUserId(value: unknown): value is string {
  return typeof value === 'string' && USER_ID.test(value);
}

function isMissingKey(error: unknown): error is ServiceUnavailableException {
  return (
    error instanceof ServiceUnavailableException &&
    error.message === CONNECTOR_CREDENTIALS_UNAVAILABLE_MESSAGE
  );
}

function quietFailure(error: HttpException): boolean {
  const message = error.message;
  if (message === CONNECTOR_CREDENTIALS_UNAVAILABLE_MESSAGE) return true;
  if (message === CONNECTION_NOT_FOUND_MESSAGE) return true;
  if (message === INVALID_CONNECTOR_MESSAGE) return true;
  return isFixedConnectorFailure(message);
}

function isMcpTimeout(error: unknown): boolean {
  return error instanceof McpError && error.code === ErrorCode.RequestTimeout;
}

function readModelArguments(
  tool: ConnectorToolDefinition,
  args: unknown,
): Record<string, unknown> {
  const record = args === undefined ? {} : args;
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new BadRequestException(CONNECTOR_ARGUMENTS_MESSAGE);
  }
  const fields = record as Record<string, unknown>;
  if (tool.id === MAIL_READ_TOOL_ID) {
    // CONN-MAIL-READ-01: exactly one valid messageId; the model never adds a field.
    const keys = Object.keys(fields);
    if (keys.length !== 1 || keys[0] !== 'messageId' || !isMailMessageId(fields.messageId)) {
      throw new BadRequestException(CONNECTOR_ARGUMENTS_MESSAGE);
    }
    return { messageId: fields.messageId };
  }
  if (tool.kind === 'imap') {
    if (fields.limit === undefined) return {};
    if (!isMailLimit(fields.limit)) {
      throw new BadRequestException(CONNECTOR_ARGUMENTS_MESSAGE);
    }
    return { limit: fields.limit };
  }
  if (!isTimeZone(fields.timeZone)) {
    throw new BadRequestException(CONNECTOR_ARGUMENTS_MESSAGE);
  }
  return { timeZone: fields.timeZone };
}

function isMailLimit(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 25;
}

const MAIL_MESSAGE_ID_TEXT = /^[1-9][0-9]{0,9}$/;
const MAX_MAIL_MESSAGE_UID = 0xffffffff;

/**
 * CONN-MAIL-READ-01: the id text the unread-mail tool returns: an IMAP UID from 1
 * to 4294967295 in decimal, without a leading zero.
 */
function isMailMessageId(value: unknown): value is string {
  return typeof value === 'string' && MAIL_MESSAGE_ID_TEXT.test(value) && Number(value) <= MAX_MAIL_MESSAGE_UID;
}

/**
 * CONN-MAIL-READ-01: true only for the child's fixed answer for an id that is not
 * in the Inbox (an error result whose whole text is MAIL_MESSAGE_NOT_FOUND_MESSAGE).
 * Any other result goes through readResult as before.
 */
function isMailMessageNotFound(raw: unknown): boolean {
  return isChildErrorText(raw, MAIL_MESSAGE_NOT_FOUND_MESSAGE);
}

/**
 * True only for a child error result whose whole text is `text` (one text block).
 * CONN-MAIL-AUTH-STATE-01: also how the broker spots the child's refused sign-in.
 */
function isChildErrorText(raw: unknown, text: string): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const record = raw as { content?: unknown; isError?: unknown };
  if (record.isError !== true || !Array.isArray(record.content) || record.content.length !== 1) return false;
  const block = record.content[0] as { type?: unknown; text?: unknown } | null;
  return !!block && block.type === 'text' && block.text === text;
}

/** CONN-MAIL-AUTH-STATE-01 D3: the connection carries a refusal that no save or Test has cleared. */
function isSignInRefusedRow(row: ConnectorConnection): boolean {
  return row.signInRefusedAt !== null && row.signInRefusedAt !== undefined;
}

function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 64) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function childArguments(
  tool: ConnectorToolDefinition,
  row: ConnectorConnection,
  secret: string,
  modelArgs: Record<string, unknown>,
): Record<string, unknown> {
  if (tool.kind === 'imap') {
    if (!isImapPreset(row.preset) || typeof row.username !== 'string' || row.username.length === 0) {
      throw new ServiceUnavailableException(CONNECTOR_UNAVAILABLE_MESSAGE);
    }
    const preset: ImapPreset = row.preset;
    const args: Record<string, unknown> = {
      preset,
      username: row.username,
      appPassword: secret,
    };
    if (tool.id === MAIL_READ_TOOL_ID) {
      if (typeof modelArgs.messageId !== 'string') {
        throw new BadRequestException(CONNECTOR_ARGUMENTS_MESSAGE);
      }
      args.messageId = modelArgs.messageId;
      return args;
    }
    if (typeof modelArgs.limit === 'number') args.limit = modelArgs.limit;
    return args;
  }
  if (typeof modelArgs.timeZone !== 'string') {
    throw new BadRequestException(CONNECTOR_ARGUMENTS_MESSAGE);
  }
  return { timeZone: modelArgs.timeZone, icalUrl: secret };
}

/** TRIGGER-EVENT-01 S1: two valid instants, `to` after `from` and at most 3 hours later. */
function readWindow(from: unknown, to: unknown): { from: string; to: string } {
  if (!(from instanceof Date) || !(to instanceof Date)) {
    throw new BadRequestException(CONNECTOR_ARGUMENTS_MESSAGE);
  }
  const fromMs = from.getTime();
  const toMs = to.getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    throw new BadRequestException(CONNECTOR_ARGUMENTS_MESSAGE);
  }
  const span = toMs - fromMs;
  if (span <= 0 || span > CALENDAR_WINDOW_MAX_MS) {
    throw new BadRequestException(CONNECTOR_ARGUMENTS_MESSAGE);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Keeps exactly uid, title, start and end of each event; a result of any other shape is a failure. */
function readWindowEvents(value: unknown): CalendarWindowEvent[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadGatewayException(CONNECTOR_RESULT_MESSAGE);
  }
  const list = (value as { events?: unknown }).events;
  if (!Array.isArray(list)) {
    throw new BadGatewayException(CONNECTOR_RESULT_MESSAGE);
  }
  const events: CalendarWindowEvent[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new BadGatewayException(CONNECTOR_RESULT_MESSAGE);
    }
    const { uid, title, start, end } = item as Record<string, unknown>;
    if (
      typeof uid !== 'string' ||
      uid.length === 0 ||
      typeof title !== 'string' ||
      !isInstantText(start) ||
      !isInstantText(end)
    ) {
      throw new BadGatewayException(CONNECTOR_RESULT_MESSAGE);
    }
    events.push({ uid, title, start, end });
  }
  return events;
}

/**
 * TRIGGER-MAIL-01 S1: a valid instant, not after `nowMs` and at most 2 hours before
 * it, as ISO text for the child.
 */
function readSince(since: unknown, nowMs: number): string {
  if (!(since instanceof Date)) {
    throw new BadRequestException(CONNECTOR_ARGUMENTS_MESSAGE);
  }
  const sinceMs = since.getTime();
  if (!Number.isFinite(sinceMs) || sinceMs > nowMs || nowMs - sinceMs > MAIL_RECENT_MAX_LOOKBACK_MS) {
    throw new BadRequestException(CONNECTOR_ARGUMENTS_MESSAGE);
  }
  return since.toISOString();
}

const MAX_UID_VALIDITY = 0xffffffff;

function isPositiveInteger(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= max;
}

/**
 * TRIGGER-MAIL-01 S1: keeps exactly uidValidity and, per message, uid, fromAddress,
 * subject and arrivedAt; a result of any other shape, or with more than 25 messages,
 * is a failure. A message that arrived before `sinceMs` is left out.
 */
function readRecentMessages(value: unknown, sinceMs: number): RecentMailRead {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadGatewayException(CONNECTOR_RESULT_MESSAGE);
  }
  const record = value as { uidValidity?: unknown; messages?: unknown };
  if (!isPositiveInteger(record.uidValidity, MAX_UID_VALIDITY)) {
    throw new BadGatewayException(CONNECTOR_RESULT_MESSAGE);
  }
  const list = record.messages;
  if (!Array.isArray(list) || list.length > MAIL_RECENT_MAX_MESSAGES) {
    throw new BadGatewayException(CONNECTOR_RESULT_MESSAGE);
  }
  const messages: RecentMailMessage[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new BadGatewayException(CONNECTOR_RESULT_MESSAGE);
    }
    const { uid, fromAddress, subject, arrivedAt } = item as Record<string, unknown>;
    if (
      !isPositiveInteger(uid, Number.MAX_SAFE_INTEGER) ||
      typeof fromAddress !== 'string' ||
      typeof subject !== 'string' ||
      !isInstantText(arrivedAt)
    ) {
      throw new BadGatewayException(CONNECTOR_RESULT_MESSAGE);
    }
    if (Date.parse(arrivedAt) < sinceMs) continue;
    messages.push({ uid, fromAddress, subject, arrivedAt });
  }
  return { uidValidity: record.uidValidity, messages };
}

function isInstantText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

function toolText(raw: unknown): { text: string; isError: boolean } {
  if (!raw || typeof raw !== 'object') {
    throw new BadGatewayException(CONNECTOR_RESULT_MESSAGE);
  }
  const record = raw as { content?: unknown; isError?: unknown };
  if (!Array.isArray(record.content) || record.content.length === 0) {
    throw new BadGatewayException(CONNECTOR_RESULT_MESSAGE);
  }
  const parts: string[] = [];
  for (const part of record.content) {
    if (!part || typeof part !== 'object') {
      throw new BadGatewayException(CONNECTOR_RESULT_MESSAGE);
    }
    const block = part as { type?: unknown; text?: unknown };
    if (block.type !== 'text' || typeof block.text !== 'string') {
      throw new BadGatewayException(CONNECTOR_RESULT_MESSAGE);
    }
    parts.push(block.text);
  }
  return { text: parts.join(''), isError: record.isError === true };
}

function countItems(value: unknown): number {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
  const record = value as { messages?: unknown; events?: unknown; message?: unknown };
  if (Array.isArray(record.messages)) return record.messages.length;
  if (Array.isArray(record.events)) return record.events.length;
  // CONN-MAIL-READ-01: mail_read_message answers { message }.
  if (record.message && typeof record.message === 'object' && !Array.isArray(record.message)) return 1;
  return 0;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'connector call failed';
}
