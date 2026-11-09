import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator';
import { ApiKeyIdentity } from '../auth/api-key.config';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import { ConnectorBroker } from './connector-broker';
import {
  CONNECTOR_CREDENTIALS_UNAVAILABLE_MESSAGE,
  assertConnectorCredentialsConfigured,
} from './connector-crypto';
import { assertConnectorBodyLimit, parseConnectorKind } from './connector-input';
import {
  CALENDAR_VERIFY_FAILED_MESSAGE,
  MAIL_VERIFY_FAILED_MESSAGE,
  toolForKind,
  verifyArguments,
} from './connector-servers';
import {
  ConnectorConnectionPublic,
  ConnectorsService,
  IcalConnectionPublic,
  ImapConnectionPublic,
} from './connectors.service';

@Controller('connectors')
@UseGuards(SessionOrApiKeyAuthGuard)
export class ConnectorsController {
  constructor(
    private readonly connectors: ConnectorsService,
    private readonly broker: ConnectorBroker,
  ) {}

  @Post('imap')
  @HttpCode(HttpStatus.OK)
  connectImap(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Req() request: Request,
    @Body() body: unknown,
  ): Promise<ImapConnectionPublic> {
    const caller = this.assertReady(identity, request);
    return this.connectors.connectImap(caller.userId, body);
  }

  @Post('ical')
  @HttpCode(HttpStatus.OK)
  connectIcal(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Req() request: Request,
    @Body() body: unknown,
  ): Promise<IcalConnectionPublic> {
    const caller = this.assertReady(identity, request);
    return this.connectors.connectIcal(caller.userId, body);
  }

  @Get()
  async list(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Req() request: Request,
  ): Promise<{ connections: ConnectorConnectionPublic[] }> {
    const caller = this.assertReady(identity, request);
    return this.connectors.list(caller.userId);
  }

  @Post(':kind/verify')
  @HttpCode(HttpStatus.OK)
  async verify(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Req() request: Request,
    @Param('kind') kind: string,
  ): Promise<{ ok: true; lastVerifiedAt: string }> {
    const caller = this.assertReady(identity, request);
    const parsedKind = parseConnectorKind(kind);
    try {
      await this.broker.callConnectorTool({
        userId: caller.userId,
        toolId: toolForKind(parsedKind).id,
        args: verifyArguments(parsedKind),
        action: 'connector_verify',
      });
    } catch (error) {
      if (
        error instanceof ServiceUnavailableException &&
        error.message === CONNECTOR_CREDENTIALS_UNAVAILABLE_MESSAGE
      ) {
        throw error;
      }
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadGatewayException(
        parsedKind === 'imap' ? MAIL_VERIFY_FAILED_MESSAGE : CALENDAR_VERIFY_FAILED_MESSAGE,
      );
    }
    const lastVerifiedAt = await this.connectors.markVerified(caller.userId, parsedKind);
    return { ok: true, lastVerifiedAt };
  }

  @Delete(':kind')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Req() request: Request,
    @Param('kind') kind: string,
  ): Promise<void> {
    const caller = this.assertReady(identity, request);
    await this.connectors.disconnect(caller.userId, kind);
  }

  private assertReady(identity: ApiKeyIdentity | undefined, request: Request): ApiKeyIdentity {
    const caller = this.assertEntitled(identity);
    assertConnectorCredentialsConfigured();
    assertConnectorBodyLimit(request);
    return caller;
  }

  private assertEntitled(identity: ApiKeyIdentity | undefined): ApiKeyIdentity {
    if (!identity?.userId || typeof identity.apiKeyId !== 'string' || identity.apiKeyId.length === 0) {
      throw new UnauthorizedException('Missing authentication credentials');
    }
    if (identity.harnessEntitled !== true) {
      throw new ForbiddenException('Forbidden');
    }
    return identity;
  }
}
