import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ConnectorConnection } from '../entities/connector-connection.entity';
import {
  assertConnectorCredentialsConfigured,
  encryptConnectorSecret,
} from './connector-crypto';
import {
  assertParsedBodyLimit,
  parseConnectorKind,
  parseIcalConnection,
  parseImapConnection,
} from './connector-input';
import {
  CONNECTION_NOT_FOUND_MESSAGE,
  CONNECTOR_KEY_VERSION,
  ConnectorKind,
  DELETE_FAILED_MESSAGE,
  ImapPreset,
  LIST_FAILED_MESSAGE,
  SAVE_FAILED_MESSAGE,
  isImapPreset,
} from './connector-rules';

export interface ImapConnectionPublic {
  kind: 'imap';
  preset: ImapPreset;
  username: string;
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt: string | null;
}

export interface IcalConnectionPublic {
  kind: 'ical';
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt: string | null;
}

export type ConnectorConnectionPublic = ImapConnectionPublic | IcalConnectionPublic;

type ConnectorAuditAction = 'connect' | 'replace' | 'delete';

@Injectable()
export class ConnectorsService {
  private readonly logger = new Logger(ConnectorsService.name);

  constructor(
    @InjectRepository(ConnectorConnection)
    private readonly connections: Repository<ConnectorConnection>,
  ) {}

  async connectImap(userId: string, body: unknown): Promise<ImapConnectionPublic> {
    assertConnectorCredentialsConfigured();
    assertParsedBodyLimit(body);
    const parsed = await parseImapConnection(body);
    const saved = await this.writeConnection({
      userId,
      kind: 'imap',
      preset: parsed.preset,
      username: parsed.username,
      secret: parsed.appPassword,
    });
    return toImapPublic(saved);
  }

  async connectIcal(userId: string, body: unknown): Promise<IcalConnectionPublic> {
    assertConnectorCredentialsConfigured();
    assertParsedBodyLimit(body);
    const parsed = await parseIcalConnection(body);
    const saved = await this.writeConnection({
      userId,
      kind: 'ical',
      preset: null,
      username: null,
      secret: parsed.url,
    });
    return toIcalPublic(saved);
  }

  async list(userId: string): Promise<{ connections: ConnectorConnectionPublic[] }> {
    assertConnectorCredentialsConfigured();
    try {
      const rows = await this.connections.find({ where: { userId } });
      const own = rows
        .filter((row) => row.userId === userId)
        .sort(
          (left, right) =>
            left.createdAt.getTime() - right.createdAt.getTime() ||
            left.kind.localeCompare(right.kind),
        );
      const connections: ConnectorConnectionPublic[] = [];
      for (const row of own) {
        const view = toPublic(row);
        if (view) connections.push(view);
      }
      return { connections };
    } catch (error) {
      this.rethrowOrHide(error, 'list');
    }
  }

  async disconnect(userId: string, kind: unknown): Promise<void> {
    assertConnectorCredentialsConfigured();
    const parsedKind = parseConnectorKind(kind);
    try {
      await this.connections.manager.transaction(async (manager) => {
        const repo = manager.getRepository(ConnectorConnection);
        const existing = await repo.findOne({ where: { userId, kind: parsedKind } });
        if (!existing || existing.userId !== userId || existing.kind !== parsedKind) {
          throw new NotFoundException(CONNECTION_NOT_FOUND_MESSAGE);
        }
        const result = await repo.delete({ id: existing.id, userId });
        if (!result || !result.affected) {
          throw new NotFoundException(CONNECTION_NOT_FOUND_MESSAGE);
        }
        await manager.getRepository(AuditEventEntity).save(
          auditRow(userId, existing.id, 'delete', parsedKind, auditPreset(parsedKind, existing.preset)),
        );
      });
    } catch (error) {
      this.rethrowOrHide(error, 'delete');
    }
  }

  private async writeConnection(input: {
    userId: string;
    kind: ConnectorKind;
    preset: ImapPreset | null;
    username: string | null;
    secret: string;
  }): Promise<ConnectorConnection> {
    try {
      return await this.connections.manager.transaction(async (manager) => {
        const repo = manager.getRepository(ConnectorConnection);
        const existing = await repo.findOne({
          where: { userId: input.userId, kind: input.kind },
        });
        const secretCiphertext = encryptConnectorSecret(input.userId, input.kind, input.secret);
        if (existing && existing.userId === input.userId && existing.kind === input.kind) {
          const updatedAt = laterThan(existing.updatedAt);
          const saved = await repo.save(
            repo.create({
              id: existing.id,
              userId: existing.userId,
              kind: existing.kind,
              preset: input.preset,
              username: input.username,
              secretCiphertext,
              keyVersion: CONNECTOR_KEY_VERSION,
              createdAt: existing.createdAt,
              updatedAt,
              lastVerifiedAt: null,
            }),
          );
          await saveAudit(manager, input.userId, saved.id, 'replace', input.kind, input.preset);
          return saved;
        }
        const now = new Date();
        const saved = await repo.save(
          repo.create({
            userId: input.userId,
            kind: input.kind,
            preset: input.preset,
            username: input.username,
            secretCiphertext,
            keyVersion: CONNECTOR_KEY_VERSION,
            createdAt: now,
            updatedAt: now,
            lastVerifiedAt: null,
          }),
        );
        await saveAudit(manager, input.userId, saved.id, 'connect', input.kind, input.preset);
        return saved;
      });
    } catch (error) {
      this.rethrowOrHide(error, 'write');
    }
  }

  private rethrowOrHide(error: unknown, action: 'write' | 'delete' | 'list'): never {
    if (error instanceof HttpException) {
      throw error;
    }
    const message =
      action === 'delete'
        ? DELETE_FAILED_MESSAGE
        : action === 'list'
          ? LIST_FAILED_MESSAGE
          : SAVE_FAILED_MESSAGE;
    this.logger.error(`connector ${action} failed`);
    throw new InternalServerErrorException(message);
  }
}

function laterThan(previous: Date): Date {
  const now = new Date();
  if (now.getTime() <= previous.getTime()) {
    return new Date(previous.getTime() + 1);
  }
  return now;
}

function auditPreset(kind: ConnectorKind, preset: string | null): ImapPreset | null {
  if (kind !== 'imap') return null;
  return isImapPreset(preset) ? preset : null;
}

function saveAudit(
  manager: EntityManager,
  userId: string,
  connectionId: string,
  action: ConnectorAuditAction,
  kind: ConnectorKind,
  preset: ImapPreset | null,
): Promise<AuditEventEntity> {
  return manager.getRepository(AuditEventEntity).save(
    auditRow(userId, connectionId, action, kind, preset),
  );
}

function auditRow(
  userId: string,
  connectionId: string,
  action: ConnectorAuditAction,
  kind: ConnectorKind,
  preset: ImapPreset | null,
): Partial<AuditEventEntity> {
  return {
    category: 'connector',
    eventType: `connector.${action}`,
    subjectType: 'connector_connection',
    subjectId: connectionId,
    userId,
    payload: { action, kind, preset },
    occurredAt: new Date(),
  };
}

function toPublic(row: ConnectorConnection): ConnectorConnectionPublic | null {
  if (row.kind === 'ical') return toIcalPublic(row);
  if (row.kind === 'imap' && isImapPreset(row.preset) && typeof row.username === 'string') {
    return toImapPublic(row);
  }
  return null;
}

function toImapPublic(row: ConnectorConnection): ImapConnectionPublic {
  if (!isImapPreset(row.preset) || typeof row.username !== 'string') {
    throw new InternalServerErrorException(SAVE_FAILED_MESSAGE);
  }
  return {
    kind: 'imap',
    preset: row.preset,
    username: row.username,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastVerifiedAt: isoOrNull(row.lastVerifiedAt),
  };
}

function toIcalPublic(row: ConnectorConnection): IcalConnectionPublic {
  return {
    kind: 'ical',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastVerifiedAt: isoOrNull(row.lastVerifiedAt),
  };
}

function isoOrNull(value: Date | null): string | null {
  return value instanceof Date ? value.toISOString() : null;
}
