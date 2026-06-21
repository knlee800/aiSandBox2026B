import {
  Controller,
  Get,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';

/**
 * Internal Workspace Files Controller
 * AGENT-HARNESS-03A: Exposes read-only file endpoints for ai-service.
 *
 * Routes:
 * - GET /api/internal/workspace/:sessionId/read?path=...
 * - GET /api/internal/workspace/:sessionId/list?path=...
 *
 * Protected by global InternalServiceAuthGuard (X-Internal-Service-Key).
 * Delegates to ContainerManagerHttpClient which calls container-manager.
 */
@Controller('internal/workspace')
export class InternalWorkspaceFilesController {
  constructor(
    private readonly containerManagerHttpClient: ContainerManagerHttpClient,
  ) {}

  @Get(':sessionId/read')
  @HttpCode(HttpStatus.OK)
  async readFile(
    @Param('sessionId') sessionId: string,
    @Query('path') filePath?: string,
  ): Promise<{ path: string; content: string }> {
    if (!filePath || filePath.trim().length === 0) {
      throw new BadRequestException('Query parameter "path" is required');
    }

    return this.containerManagerHttpClient.readSessionFile(sessionId, filePath);
  }

  @Get(':sessionId/list')
  @HttpCode(HttpStatus.OK)
  async listDirectory(
    @Param('sessionId') sessionId: string,
    @Query('path') dirPath?: string,
  ): Promise<{
    path: string;
    entries: Array<{
      name: string;
      type: 'file' | 'dir';
      size: number;
      modifiedAt: string;
    }>;
  }> {
    const normalizedPath = dirPath && dirPath.trim().length > 0 ? dirPath : '/';
    return this.containerManagerHttpClient.listSessionDirectory(
      sessionId,
      normalizedPath,
    );
  }
}
