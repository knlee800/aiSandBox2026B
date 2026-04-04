import {
  BadRequestException,
  Body,
  Controller,
  GoneException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator';
import { type ApiKeyIdentity } from '../auth/api-key.config';
import { ApiKeyAuthGuard } from '../auth/api-key-auth.guard';
import { SessionService } from '../sessions/session.service';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import {
  PublicApiRateLimit,
  PublicApiRateLimitGuard,
} from './public-api-rate-limit.guard';

interface PublicFileSessionInput {
  sessionId: string;
  path?: string;
  content?: string;
}

@Controller('v1/files')
@UseGuards(ApiKeyAuthGuard, PublicApiRateLimitGuard)
export class PublicFilesController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly containerManagerHttpClient: ContainerManagerHttpClient,
  ) {}

  @Post('list')
  @HttpCode(HttpStatus.OK)
  @PublicApiRateLimit({ maxRequests: 120, windowMs: 60000 })
  async listFiles(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Body() body: PublicFileSessionInput,
  ): Promise<Array<{ name: string; path: string; type: 'file' | 'directory'; size: number; modified: string }>> {
    if (!body.sessionId || body.sessionId.trim().length === 0) {
      throw new BadRequestException('sessionId is required');
    }
    const session = await this.sessionService.getSessionById(body.sessionId);
    if (session.userId !== identity.userId) {
      throw new NotFoundException(`Session with ID ${body.sessionId} not found`);
    }
    if (session.terminatedAt !== null) {
      throw new GoneException(`Session ${body.sessionId} is terminated`);
    }

    const path = body.path && body.path.trim().length > 0 ? body.path : '/';
    const result = await this.containerManagerHttpClient.listSessionDirectory(
      body.sessionId,
      path,
    );
    return result.entries.map((entry) => ({
      name: entry.name,
      path: path === '/' || !path ? entry.name : `${path.replace(/\/$/, '')}/${entry.name}`,
      type: entry.type === 'dir' ? 'directory' : 'file',
      size: entry.size,
      modified: entry.modifiedAt,
    }));
  }

  @Post('read')
  @HttpCode(HttpStatus.OK)
  @PublicApiRateLimit({ maxRequests: 120, windowMs: 60000 })
  async readFile(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Body() body: PublicFileSessionInput,
  ): Promise<{ path: string; content: string }> {
    if (!body.sessionId || body.sessionId.trim().length === 0) {
      throw new BadRequestException('sessionId is required');
    }
    if (!body.path || body.path.trim().length === 0) {
      throw new BadRequestException('path is required');
    }
    const session = await this.sessionService.getSessionById(body.sessionId);
    if (session.userId !== identity.userId) {
      throw new NotFoundException(`Session with ID ${body.sessionId} not found`);
    }
    if (session.terminatedAt !== null) {
      throw new GoneException(`Session ${body.sessionId} is terminated`);
    }
    return await this.containerManagerHttpClient.readSessionFile(body.sessionId, body.path);
  }

  @Post('write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @PublicApiRateLimit({ maxRequests: 120, windowMs: 60000 })
  async writeFile(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Body() body: PublicFileSessionInput,
  ): Promise<void> {
    if (!body.sessionId || body.sessionId.trim().length === 0) {
      throw new BadRequestException('sessionId is required');
    }
    if (!body.path || body.path.trim().length === 0) {
      throw new BadRequestException('path is required');
    }
    if (body.content === undefined || body.content === null) {
      throw new BadRequestException('content is required');
    }
    const session = await this.sessionService.getSessionById(body.sessionId);
    if (session.userId !== identity.userId) {
      throw new NotFoundException(`Session with ID ${body.sessionId} not found`);
    }
    if (session.terminatedAt !== null) {
      throw new GoneException(`Session ${body.sessionId} is terminated`);
    }
    await this.containerManagerHttpClient.writeSessionFile(
      body.sessionId,
      body.path,
      body.content,
    );
  }
}
