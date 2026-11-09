import {
  BadGatewayException,
  BadRequestException,
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
  MAIL_TOOL,
  findAllowlistedTool,
  isFixedConnectorFailure,
  scrubSecrets,
} from './connector-servers';

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_TOOL_NAME = /^[A-Za-z0-9_-]{1,64}$/;

export type ConnectorAuditAction = 'connector_call' | 'connector_verify';
export type ConnectorAuditOutcome = 'ok' | 'error' | 'timeout';

export interface ConnectorCallInput {
  userId: unknown;
  toolId: unknown;
  args: unknown;
  action: ConnectorAuditAction;
  serverId?: unknown;
}

export interface ConnectorAuditPayload {
  action: ConnectorAuditAction;
  toolId: string;
  userId: string;
  itemCount: number;
  resultBytes: number;
  durationMs: number;
  outcome: ConnectorAuditOutcome;
}

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
      const tool = findAllowlistedTool(input.toolId);
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
      const raw = await this.invoke(session, tool.id, childArguments(tool, row, secret, modelArgs));
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
    try {
      await this.reconcile(session);
    } catch (error) {
      await session.close().catch(() => undefined);
      throw error;
    }
    this.session = session;
    this.reconciled = true;
    return session;
  }

  private async reconcile(session: ConnectorMcpSession): Promise<void> {
    const listed = await session.listTools();
    const names = new Set<string>();
    for (const tool of listed.tools || []) {
      if (!tool || typeof tool.name !== 'string' || tool.name.length === 0) continue;
      names.add(tool.name);
      if (findAllowlistedTool(tool.name) || this.ignored.has(tool.name)) continue;
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

  private readResult(
    raw: unknown,
    secrets: string[],
  ): { value: unknown; itemCount: number; resultBytes: number } {
    const body = toolText(raw);
    const resultBytes = Buffer.byteLength(body.text, 'utf8');
    if (body.isError) {
      this.logScrubbed(body.text, secrets);
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
      this.logScrubbed(body.text, secrets);
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

  private async writeAudit(
    action: ConnectorAuditAction,
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
        eventType: action === 'connector_call' ? 'connector.call' : 'connector.verify',
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
    if (typeof modelArgs.limit === 'number') args.limit = modelArgs.limit;
    return args;
  }
  if (typeof modelArgs.timeZone !== 'string') {
    throw new BadRequestException(CONNECTOR_ARGUMENTS_MESSAGE);
  }
  return { timeZone: modelArgs.timeZone, icalUrl: secret };
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
  const record = value as { messages?: unknown; events?: unknown };
  if (Array.isArray(record.messages)) return record.messages.length;
  if (Array.isArray(record.events)) return record.events.length;
  return 0;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'connector call failed';
}
