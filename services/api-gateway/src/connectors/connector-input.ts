import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import {
  APP_PASSWORD_MESSAGE,
  BODY_TOO_LARGE_MESSAGE,
  ConnectorHttpRequest,
  ConnectorKind,
  ICAL_URL_MESSAGE,
  IMAP_PRESET_MESSAGE,
  INVALID_CONNECTOR_MESSAGE,
  ImapPreset,
  UNKNOWN_CONNECTOR_MESSAGE,
  USERNAME_MESSAGE,
  connectorBodyIsTooLarge,
  isConnectorKind,
  normalizeConnectorAppPassword,
  parsedBodyIsTooLarge,
} from './connector-rules';
import { ConnectIcalDto, ConnectImapDto } from './dto/connect-connector.dto';

export interface ParsedImapConnection {
  preset: ImapPreset;
  username: string;
  appPassword: string;
}

export interface ParsedIcalConnection {
  url: string;
}

const IMAP_FIELDS = ['preset', 'username', 'appPassword'] as const;
const ICAL_FIELDS = ['url'] as const;

export function assertConnectorBodyLimit(request: object): void {
  if (connectorBodyIsTooLarge(request as ConnectorHttpRequest)) {
    throw new PayloadTooLargeException(BODY_TOO_LARGE_MESSAGE);
  }
}

export function assertParsedBodyLimit(body: unknown): void {
  if (parsedBodyIsTooLarge(body)) {
    throw new PayloadTooLargeException(BODY_TOO_LARGE_MESSAGE);
  }
}

export function parseConnectorKind(kind: unknown): ConnectorKind {
  if (isConnectorKind(kind)) return kind;
  throw new BadRequestException(UNKNOWN_CONNECTOR_MESSAGE);
}

export async function parseImapConnection(body: unknown): Promise<ParsedImapConnection> {
  const dto = await parseDto(body, ConnectImapDto, IMAP_FIELDS, imapMessage);
  return {
    preset: dto.preset,
    username: dto.username,
    appPassword: normalizeConnectorAppPassword(dto.appPassword),
  };
}

export async function parseIcalConnection(body: unknown): Promise<ParsedIcalConnection> {
  const dto = await parseDto(body, ConnectIcalDto, ICAL_FIELDS, icalMessage);
  return { url: dto.url };
}

async function parseDto<T extends object>(
  body: unknown,
  cls: new () => T,
  fields: readonly string[],
  messageFor: (field: string) => string,
): Promise<T> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException(INVALID_CONNECTOR_MESSAGE);
  }
  const dto = plainToInstance(cls, body);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: false,
    forbidUnknownValues: false,
    validationError: { target: false, value: false },
  });
  if (errors.length > 0) {
    throw new BadRequestException(messageFor(firstField(errors, fields)));
  }
  return dto;
}

function firstField(errors: ValidationError[], fields: readonly string[]): string {
  const names = new Set(errors.map((error) => error.property));
  for (const field of fields) {
    if (names.has(field)) return field;
  }
  return '';
}

function imapMessage(field: string): string {
  switch (field) {
    case 'preset':
      return IMAP_PRESET_MESSAGE;
    case 'username':
      return USERNAME_MESSAGE;
    case 'appPassword':
      return APP_PASSWORD_MESSAGE;
    default:
      return INVALID_CONNECTOR_MESSAGE;
  }
}

function icalMessage(field: string): string {
  return field === 'url' ? ICAL_URL_MESSAGE : INVALID_CONNECTOR_MESSAGE;
}
