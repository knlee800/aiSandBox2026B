import { All, Controller, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import axios from 'axios';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import { PreviewOwnershipGuard } from './preview-ownership.guard';

const PROXY_HEADER_DENYLIST = new Set([
  'host',
  'cookie',
  'authorization',
  'proxy-authorization',
  'x-internal-service-key',
  'x-csrf-token',
  'x-forwarded-user',
  'x-user-id',
  'x-session-id',
]);

export function sanitizeProxyHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string | string[] | undefined> {
  return Object.fromEntries(
    Object.entries(headers).filter(
      ([key]) => !PROXY_HEADER_DENYLIST.has(key.toLowerCase()),
    ),
  );
}

@UseGuards(SessionCookieGuard, PreviewOwnershipGuard)
@Controller('preview')
export class PreviewController {
  private readonly containerManagerUrl = process.env.CONTAINER_MANAGER_URL || 'http://localhost:4001';

  @All('*')
  async proxyToContainerManager(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      // req.path already includes the full path: /api/preview/...
      // Forward it directly to container-manager
      const url = `${this.containerManagerUrl}${req.path}`;

      console.log(`[Preview Proxy] ${req.method} ${req.path} -> ${url}`);

      const response = await axios({
        method: req.method,
        url,
        data: req.body,
        params: req.query,
        headers: sanitizeProxyHeaders(req.headers),
        responseType: req.path.includes('/proxy') ? 'stream' : 'json',
        validateStatus: () => true, // Don't throw on any status
      });

      // Copy response headers
      Object.keys(response.headers).forEach(key => {
        res.setHeader(key, response.headers[key]);
      });

      // Set status code
      res.status(response.status);

      // Handle streaming response for proxy
      if (req.path.includes('/proxy') && response.data.pipe) {
        response.data.pipe(res);
      } else {
        res.send(response.data);
      }
    } catch (error) {
      console.error('[Preview Proxy] Error:', error.message);
      res.status(502).json({
        error: 'Proxy error',
        message: 'Failed to connect to container manager',
      });
    }
  }
}
