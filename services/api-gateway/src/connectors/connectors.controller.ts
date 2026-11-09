import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator';
import { ApiKeyIdentity } from '../auth/api-key.config';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import { assertConnectorCredentialsConfigured } from './connector-crypto';
import { assertConnectorBodyLimit } from './connector-input';
import {
  ConnectorConnectionPublic,
  ConnectorsService,
  IcalConnectionPublic,
  ImapConnectionPublic,
} from './connectors.service';

@Controller('connectors')
@UseGuards(SessionOrApiKeyAuthGuard)
export class ConnectorsController {
  constructor(private readonly connectors: ConnectorsService) {}

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
