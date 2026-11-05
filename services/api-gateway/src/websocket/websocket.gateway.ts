import { Logger, NotFoundException } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { SessionService } from '../sessions/session.service';

const SESSION_COOKIE_NAME = 'aisandbox_session';

type CorsOriginCallback = (
  err: Error | null,
  allow?: boolean | string,
) => void;

/**
 * Socket.IO CORS origin.
 * APP_BASE_URL set: allow only that URL's origin (scheme, host, port).
 * APP_BASE_URL unset, blank, or not a URL: do not allow any cross-origin
 * (callback false). Never reflects the request origin and never returns true.
 */
export function resolveSocketCorsOrigin(
  requestOrigin: string | undefined,
  callback: CorsOriginCallback,
): void {
  const configured = process.env.APP_BASE_URL?.trim();
  if (!configured) {
    callback(null, false);
    return;
  }

  let allowedOrigin: string;
  try {
    allowedOrigin = new URL(configured).origin;
  } catch {
    callback(null, false);
    return;
  }

  if (!requestOrigin) {
    callback(null, false);
    return;
  }

  let normalizedRequestOrigin: string;
  try {
    normalizedRequestOrigin = new URL(requestOrigin).origin;
  } catch {
    callback(null, false);
    return;
  }

  callback(null, normalizedRequestOrigin === allowedOrigin ? allowedOrigin : false);
}

function readHandshakeCookie(
  cookieHeader: string | string[] | undefined,
  name: string,
): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  const header = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader;
  const parts = header.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    if (key !== name) {
      continue;
    }

    let value = trimmed.slice(separator + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    if (value.length === 0) {
      return undefined;
    }

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return undefined;
}

@WebSocketGateway({
  cors: {
    origin: resolveSocketCorsOrigin,
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('EventsGateway');

  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) {}

  handleConnection(client: Socket): Promise<void> {
    const pending = this.authenticate(client);
    client.data.authenticated = pending;
    return pending;
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-session')
  async handleJoinSession(client: Socket, sessionId: string) {
    const authenticated = client.data.authenticated;
    if (authenticated && typeof authenticated.then === 'function') {
      await authenticated;
    }

    const userId = client.data.userId;
    if (typeof userId !== 'string' || userId.length === 0) {
      return { success: false };
    }
    if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      return { success: false };
    }

    let session: { userId: string };
    try {
      session = await this.sessionService.getSessionById(sessionId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return { success: false };
      }
      throw error;
    }

    if (session.userId !== userId) {
      return { success: false };
    }

    client.join(`session:${sessionId}`);
    this.logger.log(`Client ${client.id} joined session ${sessionId}`);
    return { success: true };
  }

  @SubscribeMessage('leave-session')
  handleLeaveSession(client: Socket, sessionId: string) {
    client.leave(`session:${sessionId}`);
    this.logger.log(`Client ${client.id} left session ${sessionId}`);
    return { success: true };
  }

  // Methods to emit events from services

  emitFileChange(sessionId: string, data: any) {
    this.server.to(`session:${sessionId}`).emit('file-changed', data);
    this.logger.debug(`Emitted file-changed to session ${sessionId}`);
  }

  emitCheckpointCreated(sessionId: string, data: any) {
    this.server.to(`session:${sessionId}`).emit('checkpoint-created', data);
    this.logger.debug(`Emitted checkpoint-created to session ${sessionId}`);
  }

  emitTokenUpdate(sessionId: string, data: any) {
    this.server.to(`session:${sessionId}`).emit('token-updated', data);
    this.logger.debug(`Emitted token-updated to session ${sessionId}`);
  }

  private async authenticate(client: Socket): Promise<void> {
    try {
      const token = readHandshakeCookie(
        client.handshake?.headers?.cookie,
        SESSION_COOKIE_NAME,
      );
      if (!token || token.trim().length === 0) {
        client.disconnect(true);
        this.logger.warn(`Client ${client.id} disconnected: missing session cookie`);
        return;
      }

      const user = await this.authService.validateSessionToken(token);
      if (!user || typeof user.id !== 'string' || user.id.length === 0) {
        client.disconnect(true);
        this.logger.warn(`Client ${client.id} disconnected: invalid session`);
        return;
      }

      client.data.userId = user.id;
      this.logger.log(`Client connected: ${client.id}`);
    } catch {
      client.disconnect(true);
      this.logger.warn(`Client ${client.id} disconnected: session validation failed`);
    }
  }
}
