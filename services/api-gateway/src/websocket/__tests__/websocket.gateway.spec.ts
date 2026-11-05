import { NotFoundException } from '@nestjs/common';
import { GATEWAY_OPTIONS } from '@nestjs/websockets/constants';
import { Socket } from 'socket.io';
import { AuthService } from '../../auth/auth.service';
import { SessionService } from '../../sessions/session.service';
import { AuthModule } from '../../auth/auth.module';
import { SessionModule } from '../../sessions/session.module';
import { EventsGateway, resolveSocketCorsOrigin } from '../websocket.gateway';
import { WebSocketModule } from '../websocket.module';

type AuthMock = { validateSessionToken: jest.Mock };
type SessionMock = { getSessionById: jest.Mock };

function createGateway(): {
  gateway: EventsGateway;
  authService: AuthMock;
  sessionService: SessionMock;
} {
  const authService: AuthMock = { validateSessionToken: jest.fn() };
  const sessionService: SessionMock = { getSessionById: jest.fn() };
  const gateway = new EventsGateway(
    authService as unknown as AuthService,
    sessionService as unknown as SessionService,
  );
  return { gateway, authService, sessionService };
}

function createClient(cookie?: string): Socket & {
  disconnect: jest.Mock;
  join: jest.Mock;
  leave: jest.Mock;
  data: { userId?: string; authenticated?: Promise<void> };
} {
  return {
    id: 'socket-1',
    data: {},
    handshake: { headers: cookie === undefined ? {} : { cookie } },
    disconnect: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
  } as unknown as Socket & {
    disconnect: jest.Mock;
    join: jest.Mock;
    leave: jest.Mock;
    data: { userId?: string; authenticated?: Promise<void> };
  };
}

function corsDecision(requestOrigin?: string): Promise<boolean | string | undefined> {
  return new Promise((resolve, reject) => {
    resolveSocketCorsOrigin(requestOrigin, (err, allow) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(allow);
    });
  });
}

describe('EventsGateway handshake authentication', () => {
  it('disconnects a client with no session cookie', async () => {
    const { gateway, authService } = createGateway();
    const client = createClient();

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(authService.validateSessionToken).not.toHaveBeenCalled();
    expect(client.data.userId).toBeUndefined();
  });

  it('disconnects a client with an invalid session cookie', async () => {
    const { gateway, authService, sessionService } = createGateway();
    const client = createClient('aisandbox_csrf=abc; aisandbox_session=expired-token');
    authService.validateSessionToken.mockResolvedValue(null);

    await gateway.handleConnection(client);

    expect(authService.validateSessionToken).toHaveBeenCalledWith('expired-token');
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.data.userId).toBeUndefined();

    await expect(gateway.handleJoinSession(client, 'session-1')).resolves.toEqual({
      success: false,
    });
    expect(sessionService.getSessionById).not.toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  it('disconnects when session validation throws', async () => {
    const { gateway, authService } = createGateway();
    const client = createClient('aisandbox_session=tok');
    authService.validateSessionToken.mockRejectedValue(new Error('store down'));

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.data.userId).toBeUndefined();
  });

  it('keeps the user id when the cookie is valid', async () => {
    const { gateway, authService } = createGateway();
    const client = createClient('other=1; aisandbox_session=owner-token');
    authService.validateSessionToken.mockResolvedValue({ id: 'user-1' });

    await gateway.handleConnection(client);

    expect(authService.validateSessionToken).toHaveBeenCalledWith('owner-token');
    expect(client.disconnect).not.toHaveBeenCalled();
    expect(client.data.userId).toBe('user-1');
  });
});

describe('EventsGateway join-session', () => {
  it('lets a valid user join their own session', async () => {
    const { gateway, authService, sessionService } = createGateway();
    const client = createClient('aisandbox_session=owner-token');
    authService.validateSessionToken.mockResolvedValue({ id: 'user-1' });
    sessionService.getSessionById.mockResolvedValue({ userId: 'user-1' });

    await gateway.handleConnection(client);
    await expect(gateway.handleJoinSession(client, 'session-1')).resolves.toEqual({
      success: true,
    });

    expect(sessionService.getSessionById).toHaveBeenCalledWith('session-1');
    expect(client.join).toHaveBeenCalledWith('session:session-1');
  });

  it('waits for in-flight handshake auth before joining', async () => {
    const { gateway, authService, sessionService } = createGateway();
    const client = createClient('aisandbox_session=owner-token');
    let resolveUser: (user: { id: string }) => void = () => undefined;
    authService.validateSessionToken.mockReturnValue(
      new Promise((resolve) => {
        resolveUser = resolve;
      }),
    );
    sessionService.getSessionById.mockResolvedValue({ userId: 'user-1' });

    const connection = gateway.handleConnection(client);
    const join = gateway.handleJoinSession(client, 'session-1');
    expect(sessionService.getSessionById).not.toHaveBeenCalled();

    resolveUser({ id: 'user-1' });
    await connection;
    await expect(join).resolves.toEqual({ success: true });
    expect(client.join).toHaveBeenCalledWith('session:session-1');
  });

  it('refuses another user session without joining', async () => {
    const { gateway, authService, sessionService } = createGateway();
    const client = createClient('aisandbox_session=owner-token');
    authService.validateSessionToken.mockResolvedValue({ id: 'user-1' });
    sessionService.getSessionById.mockResolvedValue({ userId: 'user-2' });

    await gateway.handleConnection(client);
    await expect(gateway.handleJoinSession(client, 'session-2')).resolves.toEqual({
      success: false,
    });

    expect(client.join).not.toHaveBeenCalled();
  });

  it('refuses an unknown session without joining', async () => {
    const { gateway, authService, sessionService } = createGateway();
    const client = createClient('aisandbox_session=owner-token');
    authService.validateSessionToken.mockResolvedValue({ id: 'user-1' });
    sessionService.getSessionById.mockRejectedValue(
      new NotFoundException('Session with ID missing not found'),
    );

    await gateway.handleConnection(client);
    await expect(gateway.handleJoinSession(client, 'missing')).resolves.toEqual({
      success: false,
    });

    expect(client.join).not.toHaveBeenCalled();
  });

  it('refuses a join when no user is attached', async () => {
    const { gateway, sessionService } = createGateway();
    const client = createClient();

    await expect(gateway.handleJoinSession(client, 'session-1')).resolves.toEqual({
      success: false,
    });
    expect(sessionService.getSessionById).not.toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  it('does not join when session lookup fails unexpectedly', async () => {
    const { gateway, authService, sessionService } = createGateway();
    const client = createClient('aisandbox_session=owner-token');
    authService.validateSessionToken.mockResolvedValue({ id: 'user-1' });
    sessionService.getSessionById.mockRejectedValue(new Error('db down'));

    await gateway.handleConnection(client);
    await expect(gateway.handleJoinSession(client, 'session-1')).rejects.toThrow('db down');
    expect(client.join).not.toHaveBeenCalled();
  });

  it('leaves a room without an ownership check', async () => {
    const { gateway, sessionService } = createGateway();
    const client = createClient();

    expect(gateway.handleLeaveSession(client, 'session-9')).toEqual({
      success: true,
    });
    expect(client.leave).toHaveBeenCalledWith('session:session-9');
    expect(sessionService.getSessionById).not.toHaveBeenCalled();
  });
});

describe('EventsGateway CORS', () => {
  const originalAppBaseUrl = process.env.APP_BASE_URL;

  afterEach(() => {
    if (originalAppBaseUrl === undefined) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = originalAppBaseUrl;
    }
  });

  it('uses the APP_BASE_URL origin and never origin true', async () => {
    const options = Reflect.getMetadata(GATEWAY_OPTIONS, EventsGateway);
    expect(options.cors.origin).toBe(resolveSocketCorsOrigin);
    expect(options.cors.origin).not.toBe(true);
    expect(options.cors.credentials).toBe(true);

    process.env.APP_BASE_URL = 'https://app.example.com/sandbox';
    await expect(corsDecision('https://app.example.com')).resolves.toBe(
      'https://app.example.com',
    );
    await expect(corsDecision('https://evil.example')).resolves.toBe(false);
    await expect(corsDecision('http://app.example.com')).resolves.toBe(false);
    await expect(corsDecision(undefined)).resolves.toBe(false);

    delete process.env.APP_BASE_URL;
    await expect(corsDecision('https://app.example.com')).resolves.toBe(false);
    await expect(corsDecision('http://localhost:3000')).resolves.toBe(false);
  });

  it('treats an unparseable APP_BASE_URL as same-origin only', async () => {
    process.env.APP_BASE_URL = 'not a url';
    await expect(corsDecision('https://app.example.com')).resolves.toBe(false);
  });
});

describe('WebSocketModule imports', () => {
  it('imports AuthModule and SessionModule', () => {
    const imports = Reflect.getMetadata('imports', WebSocketModule);
    expect(imports).toEqual(expect.arrayContaining([AuthModule, SessionModule]));
  });
});
