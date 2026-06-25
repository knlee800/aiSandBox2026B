import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ContainerManagerHttpClient, BrowserSmokeResult } from '../clients/container-manager-http.client';

/**
 * Internal Workspace Files Controller
 * AGENT-HARNESS-03A: Read-only file endpoints for ai-service.
 * AGENT-HARNESS-03B: Mutating write/delete file endpoints for ai-service.
 * AGENT-HARNESS-03C: Pre-apply checkpoint endpoint for ai-service.
 *
 * Routes:
 * - GET  /api/internal/workspace/:sessionId/read?path=...
 * - GET  /api/internal/workspace/:sessionId/list?path=...
 * - POST /api/internal/workspace/:sessionId/write  { path, content }
 * - DELETE /api/internal/workspace/:sessionId/delete  { path }
 * - POST /api/internal/workspace/:sessionId/checkpoint  { description? }
 * - POST /api/internal/workspace/:sessionId/validate  { command, timeoutMs? }
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

  @Post(':sessionId/write')
  @HttpCode(HttpStatus.OK)
  async writeFile(
    @Param('sessionId') sessionId: string,
    @Body('path') filePath?: string,
    @Body('content') content?: string,
  ): Promise<{ ok: true }> {
    if (!filePath || filePath.trim().length === 0) {
      throw new BadRequestException('Body field "path" is required');
    }

    if (content === undefined || content === null) {
      throw new BadRequestException('Body field "content" is required');
    }

    await this.containerManagerHttpClient.writeSessionFile(
      sessionId,
      filePath,
      content,
    );
    return { ok: true };
  }

  @Delete(':sessionId/delete')
  @HttpCode(HttpStatus.OK)
  async deleteFile(
    @Param('sessionId') sessionId: string,
    @Body('path') filePath?: string,
  ): Promise<{ ok: true }> {
    if (!filePath || filePath.trim().length === 0) {
      throw new BadRequestException('Body field "path" is required');
    }

    await this.containerManagerHttpClient.deleteSessionFile(sessionId, filePath);
    return { ok: true };
  }

  @Post(':sessionId/validate')
  @HttpCode(HttpStatus.OK)
  async runValidation(
    @Param('sessionId') sessionId: string,
    @Body('command') command?: string,
    @Body('timeoutMs') timeoutMs?: number,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    if (!command || command.trim().length === 0) {
      throw new BadRequestException('Body field "command" is required');
    }

    const effectiveTimeout =
      typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 120_000;

    return this.containerManagerHttpClient.execInSession(
      sessionId,
      ['sh', '-lc', command],
      '/workspace',
      undefined,
      effectiveTimeout,
    );
  }

  @Post(':sessionId/checkpoint')
  @HttpCode(HttpStatus.OK)
  async createCheckpoint(
    @Param('sessionId') sessionId: string,
    @Body('description') description?: string,
  ): Promise<{ commitHash: string; filesChanged: number }> {
    const normalizedDescription =
      description && description.trim().length > 0
        ? description.trim()
        : 'Pre-apply checkpoint (Agent Harness)';

    const result = await this.containerManagerHttpClient.createManualCheckpoint(
      sessionId,
      'agent-harness',
      0,
      normalizedDescription,
      true,
    );

    return {
      commitHash: result.commitHash,
      filesChanged: result.filesChanged,
    };
  }

  /**
   * POST /api/internal/workspace/:sessionId/browser-smoke
   * AGENT-HARNESS-05B2: Run browser smoke check via container-manager
   */
  @Post(':sessionId/browser-smoke')
  @HttpCode(HttpStatus.OK)
  async runBrowserSmoke(
    @Param('sessionId') sessionId: string,
    @Body('url') url?: string,
    @Body('timeoutMs') timeoutMs?: number,
  ): Promise<BrowserSmokeResult> {
    const effectiveTimeout =
      typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : undefined;

    return this.containerManagerHttpClient.runBrowserSmoke(
      sessionId,
      url,
      effectiveTimeout,
    );
  }
}
