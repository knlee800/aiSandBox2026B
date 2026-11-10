import { Controller, Post, Get, Delete, Param, Body, HttpCode, Res, Req } from '@nestjs/common';
import { Response, Request } from 'express';
import type { IncomingMessage } from 'http';
import { PreviewService } from './preview.service';
import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';
import { stripInternalServiceKey } from '../guards/strip-internal-key';

/** Per-request proxy context: which session, and where its preview runs. */
type ProxyContext = { sessionId: string; target: string };

@Controller('preview')
export class PreviewController {
  /**
   * CM-CLEANUP-01: the request's session and target, set by proxyRequest just
   * before it hands the request to the shared proxy.
   */
  private readonly proxyContexts = new WeakMap<IncomingMessage, ProxyContext>();

  /**
   * CM-CLEANUP-01: one proxy for the controller's lifetime. It used to be
   * created per request, and each new one added a 'close' listener to the
   * HTTP server that was never removed. The target is chosen per request by
   * `router`, from the context proxyRequest stores.
   */
  private readonly proxy: RequestHandler<Request, Response> = createProxyMiddleware<Request, Response>({
    router: (req) => this.proxyContexts.get(req)?.target,
    changeOrigin: true,
    // CM-AUTH-01 (D7): no `ws: true`. An upgrade listener on the server
    // would proxy any upgrade on any path without passing a guard.
    pathRewrite: (path, req) => {
      const sessionId = this.proxyContexts.get(req)?.sessionId;
      if (sessionId === undefined) {
        return '/';
      }
      // Remove /api/preview/:sessionId/proxy from the path
      return path.replace(`/api/preview/${sessionId}/proxy`, '') || '/';
    },
    on: {
      // CM-AUTH-01 (D6): the internal key never reaches the container.
      proxyReq: stripInternalServiceKey,
      error: (err, req, res) => {
        const sessionId = this.proxyContexts.get(req)?.sessionId;
        console.error(`Proxy error for session ${sessionId}:`, err.message);
        // Check if res is ServerResponse (not Socket)
        if (res && 'writeHead' in res && 'headersSent' in res) {
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: 'Proxy error',
              message: 'Failed to connect to preview server',
            }));
          }
        }
      },
    },
  });

  constructor(private previewService: PreviewService) {}

  @Post(':sessionId/start')
  @HttpCode(200)
  async startPreview(
    @Param('sessionId') sessionId: string,
    @Body('command') command?: string,
  ) {
    const result = await this.previewService.startPreview(sessionId, command);
    return {
      success: true,
      ...result,
      previewUrl: `/api/preview/${sessionId}/proxy`,
    };
  }

  @Post(':sessionId/stop')
  @HttpCode(200)
  async stopPreview(@Param('sessionId') sessionId: string) {
    const result = await this.previewService.stopPreview(sessionId);
    return {
      success: true,
      ...result,
    };
  }

  @Delete(':sessionId/stop')
  @HttpCode(200)
  async stopPreviewByDelete(@Param('sessionId') sessionId: string) {
    return this.stopPreview(sessionId);
  }

  @Get(':sessionId/status')
  async getPreviewStatus(@Param('sessionId') sessionId: string) {
    const status = this.previewService.getPreviewStatus(sessionId);

    if (!status) {
      return {
        running: false,
        message: 'No active preview for this session',
      };
    }

    return {
      running: true,
      ...status,
      previewUrl: `/api/preview/${sessionId}/proxy`,
    };
  }

  @Get(':sessionId/proxy*')
  async proxyRequest(
    @Param('sessionId') sessionId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const status = this.previewService.getPreviewStatus(sessionId);

    if (!status || (status.status !== 'running' && status.status !== 'starting')) {
      return res.status(503).json({
        error: 'Preview server not running',
        message: 'The preview server is not running. Please start it first.',
      });
    }

    if (status.framework === 'Static HTML') {
      const proxyPrefix = `/api/preview/${sessionId}/proxy`;
      const requestPath = req.path.startsWith(proxyPrefix)
        ? req.path.slice(proxyPrefix.length) || '/'
        : '/';
      const staticPreview = await this.previewService.readStaticPreviewContent(
        sessionId,
        requestPath,
      );
      return res
        .status(200)
        .setHeader('Content-Type', staticPreview.contentType)
        .send(staticPreview.content);
    }

    const target = await this.previewService.getProxyTargetUrl(sessionId);

    this.proxyContexts.set(req, { sessionId, target });
    return this.proxy(req, res);
  }
}
