import {
  Body,
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  HttpCode,
  INestApplication,
  Injectable,
  Param,
  Patch,
  Post,
  Put,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuthService } from '../auth/auth.service';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import { InternalServiceAuthGuard } from './internal-service-auth.guard';
import { SameOriginWriteGuard } from './same-origin-write.guard';

const APP_ORIGIN = 'https://staging.ainow.biz';
const PREVIEW_ORIGIN = 'https://preview.staging.ainow.biz';
const INTERNAL_KEY = 'csrf-audit-01-internal-key';
// COOKIE-PREFIX-01: APP_BASE_URL is https here, so the gateway is in secure
// mode and reads the session cookie only under its __Host- name.
const GOOD_SESSION = '__Host-aisandbox_session=good-session-token';
const OLD_NAME_SESSION = 'aisandbox_session=good-session-token';

const handlers = {
  createSession: jest.fn(),
  exec: jest.fn(),
  listSessions: jest.fn(),
  putItem: jest.fn(),
  patchItem: jest.fn(),
  deleteItem: jest.fn(),
  appleCallback: jest.fn(),
  login: jest.fn(),
  internal: jest.fn(),
  bearerExecute: jest.fn(),
  health: jest.fn(),
};

/** Stand-in for the bearer branch of SessionOrApiKeyAuthGuard. */
@Injectable()
class StubBearerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (req.headers.authorization === 'Bearer good-key') {
      return true;
    }
    throw new UnauthorizedException('Missing authentication credentials');
  }
}

@Controller('sessions')
class StubSessionController {
  @Post()
  @UseGuards(SessionCookieGuard)
  create(@Body() body: unknown) {
    handlers.createSession(body);
    return { ok: true };
  }

  @Post(':id/exec')
  @UseGuards(SessionCookieGuard)
  exec(@Param('id') id: string, @Body() body: unknown) {
    handlers.exec(id, body);
    return { ok: true };
  }

  @Get()
  @UseGuards(SessionCookieGuard)
  list() {
    handlers.listSessions();
    return [];
  }
}

@Controller('items')
class StubItemController {
  @Put(':id')
  @UseGuards(SessionCookieGuard)
  put(@Param('id') id: string) {
    handlers.putItem(id);
    return { ok: true };
  }

  @Patch(':id')
  @UseGuards(SessionCookieGuard)
  patch(@Param('id') id: string) {
    handlers.patchItem(id);
    return { ok: true };
  }

  @Delete(':id')
  @UseGuards(SessionCookieGuard)
  remove(@Param('id') id: string) {
    handlers.deleteItem(id);
    return { ok: true };
  }
}

@Controller('auth')
class StubAuthController {
  @Post('apple/callback')
  @HttpCode(200)
  appleCallback(@Body() body: unknown) {
    handlers.appleCallback(body);
    return { ok: true };
  }

  @Post('apple/callbackx')
  @HttpCode(200)
  appleCallbackNearMiss() {
    handlers.appleCallback('near-miss');
    return { ok: true };
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown) {
    handlers.login(body);
    return { ok: true };
  }
}

@Controller('internal')
class StubInternalController {
  @Post('ping')
  @HttpCode(200)
  ping() {
    handlers.internal();
    return { ok: true };
  }
}

@Controller('ai')
class StubBearerController {
  @Post('execute')
  @HttpCode(202)
  @UseGuards(StubBearerGuard)
  execute() {
    handlers.bearerExecute();
    return { ok: true };
  }
}

@Controller('health')
class StubHealthController {
  @Get()
  health() {
    handlers.health();
    return { status: 'ok' };
  }
}

describe('SameOriginWriteGuard over HTTP (CSRF-AUDIT-01)', () => {
  let app: INestApplication;
  const originalAppBaseUrl = process.env.APP_BASE_URL;
  const originalInternalKey = process.env.INTERNAL_SERVICE_KEY;
  const authService = {
    validateSessionToken: jest.fn(async (token: string) =>
      token === 'good-session-token'
        ? { id: 'user-1', email: 'u@example.com', role: 'user', planType: 'free' }
        : null,
    ),
  };

  beforeEach(async () => {
    process.env.APP_BASE_URL = APP_ORIGIN;
    process.env.INTERNAL_SERVICE_KEY = INTERNAL_KEY;
    Object.values(handlers).forEach((fn) => fn.mockReset());
    authService.validateSessionToken.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        StubSessionController,
        StubItemController,
        StubAuthController,
        StubInternalController,
        StubBearerController,
        StubHealthController,
      ],
      providers: [
        { provide: APP_GUARD, useClass: InternalServiceAuthGuard },
        { provide: APP_GUARD, useClass: SameOriginWriteGuard },
        { provide: AuthService, useValue: authService },
        SessionCookieGuard,
        StubBearerGuard,
      ],
    }).compile();

    app = module.createNestApplication({ logger: false });
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    if (originalAppBaseUrl === undefined) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = originalAppBaseUrl;
    }
    if (originalInternalKey === undefined) {
      delete process.env.INTERNAL_SERVICE_KEY;
    } else {
      process.env.INTERNAL_SERVICE_KEY = originalInternalKey;
    }
  });

  function http() {
    return request(app.getHttpServer());
  }

  // Tests 1 and 10
  it('a same-origin POST with a valid session reaches the handler as before', async () => {
    await http()
      .post('/api/sessions')
      .set('Origin', APP_ORIGIN)
      .set('Cookie', GOOD_SESSION)
      .send({ name: 'x' })
      .expect(201);
    expect(handlers.createSession).toHaveBeenCalledTimes(1);
  });

  it('a same-origin POST without a session still gets the session check (401)', async () => {
    await http().post('/api/sessions').set('Origin', APP_ORIGIN).expect(401);
    expect(handlers.createSession).not.toHaveBeenCalled();
  });

  // COOKIE-PREFIX-01: in secure mode the old name alone authenticates nothing.
  it('a same-origin POST with only the old session cookie name gets 401 in secure mode', async () => {
    await http()
      .post('/api/sessions')
      .set('Origin', APP_ORIGIN)
      .set('Cookie', OLD_NAME_SESSION)
      .send({ name: 'x' })
      .expect(401);
    expect(authService.validateSessionToken).not.toHaveBeenCalled();
    expect(handlers.createSession).not.toHaveBeenCalled();
  });

  // COOKIE-PREFIX-01: rule 3 still refuses the old name without Origin.
  it('the old session cookie name without Origin is still refused by rule 3 (403)', async () => {
    await http().post('/api/sessions').set('Cookie', OLD_NAME_SESSION).expect(403);
    expect(handlers.createSession).not.toHaveBeenCalled();
  });

  // Tests 2 and 10
  it('a foreign-origin POST answers 403 before the session check, with and without a cookie', async () => {
    const withCookie = await http()
      .post('/api/sessions')
      .set('Origin', PREVIEW_ORIGIN)
      .set('Cookie', GOOD_SESSION)
      .send({ name: 'x' })
      .expect(403);
    expect(withCookie.body.message).toBe('Cross-origin request refused');

    const withoutCookie = await http()
      .post('/api/sessions')
      .set('Origin', PREVIEW_ORIGIN)
      .expect(403);
    expect(withoutCookie.body.message).toBe('Cross-origin request refused');

    expect(authService.validateSessionToken).not.toHaveBeenCalled();
    expect(handlers.createSession).not.toHaveBeenCalled();
  });

  // Test 10
  it('a form-encoded foreign-origin POST never reaches the handler', async () => {
    await http()
      .post('/api/sessions/s1/exec')
      .set('Origin', PREVIEW_ORIGIN)
      .set('Cookie', GOOD_SESSION)
      .type('form')
      .send('command=rm%20-rf%20%2F')
      .expect(403);
    await http()
      .post('/api/sessions/s1/exec')
      .set('Origin', PREVIEW_ORIGIN)
      .set('Cookie', GOOD_SESSION)
      .set('Content-Type', 'text/plain')
      .send('anything')
      .expect(403);
    expect(handlers.exec).not.toHaveBeenCalled();
    expect(authService.validateSessionToken).not.toHaveBeenCalled();
  });

  it('a form-encoded login POST from a foreign origin is refused (login CSRF)', async () => {
    await http()
      .post('/api/auth/login')
      .set('Origin', PREVIEW_ORIGIN)
      .type('form')
      .send('email=a%40example.com&password=x')
      .expect(403);
    expect(handlers.login).not.toHaveBeenCalled();
    await http()
      .post('/api/auth/login')
      .set('Origin', APP_ORIGIN)
      .send({ email: 'a@example.com', password: 'x' })
      .expect(200);
    expect(handlers.login).toHaveBeenCalledTimes(1);
  });

  // Test 3
  it('Origin: null is refused', async () => {
    await http()
      .post('/api/sessions')
      .set('Origin', 'null')
      .set('Cookie', GOOD_SESSION)
      .expect(403);
    await http().post('/api/sessions').set('Origin', 'null').expect(403);
    expect(handlers.createSession).not.toHaveBeenCalled();
  });

  // Test 4
  it('a session cookie without Origin is refused; no cookie and no Origin goes on to the route guard', async () => {
    await http().post('/api/sessions').set('Cookie', GOOD_SESSION).expect(403);
    expect(authService.validateSessionToken).not.toHaveBeenCalled();
    await http().post('/api/sessions').expect(401);
    expect(handlers.createSession).not.toHaveBeenCalled();
  });

  // Test 5
  it.each([
    ['put', 'putItem'],
    ['patch', 'patchItem'],
    ['delete', 'deleteItem'],
  ] as const)('%s follows the same rule as POST', async (method, handler) => {
    await http()[method]('/api/items/i1').set('Origin', PREVIEW_ORIGIN).set('Cookie', GOOD_SESSION).expect(403);
    await http()[method]('/api/items/i1').set('Origin', 'null').expect(403);
    await http()[method]('/api/items/i1').set('Cookie', GOOD_SESSION).expect(403);
    expect(handlers[handler]).not.toHaveBeenCalled();
    await http()[method]('/api/items/i1').expect(401);
    await http()[method]('/api/items/i1').set('Origin', APP_ORIGIN).set('Cookie', GOOD_SESSION).expect(200);
    expect(handlers[handler]).toHaveBeenCalledTimes(1);
  });

  // Test 6
  it('GET and HEAD with a foreign Origin are not looked at', async () => {
    await http()
      .get('/api/sessions')
      .set('Origin', PREVIEW_ORIGIN)
      .set('Cookie', GOOD_SESSION)
      .expect(200);
    expect(handlers.listSessions).toHaveBeenCalledTimes(1);
    await http().get('/api/health').set('Origin', PREVIEW_ORIGIN).expect(200);
    await http().head('/api/health').set('Origin', 'null').expect(200);
  });

  // Test 7
  it('fails closed when APP_BASE_URL is unset or not a URL', async () => {
    delete process.env.APP_BASE_URL;
    await http()
      .post('/api/sessions')
      .set('Origin', APP_ORIGIN)
      .set('Cookie', GOOD_SESSION)
      .expect(403);
    process.env.APP_BASE_URL = 'not a url';
    await http()
      .post('/api/sessions')
      .set('Origin', APP_ORIGIN)
      .set('Cookie', GOOD_SESSION)
      .expect(403);
    expect(handlers.createSession).not.toHaveBeenCalled();
  });

  // Test 8
  it('the Apple callback is exempt; near-miss paths are not', async () => {
    await http()
      .post('/api/auth/apple/callback')
      .set('Origin', 'https://appleid.apple.com')
      .type('form')
      .send('code=c&state=s')
      .expect(200);
    expect(handlers.appleCallback).toHaveBeenCalledTimes(1);

    await http()
      .post('/api/auth/apple/callbackx')
      .set('Origin', 'https://appleid.apple.com')
      .expect(403);
    await http()
      .post('/API/auth/apple/callback')
      .set('Origin', 'https://appleid.apple.com')
      .expect(403);
    await http()
      .post('/api/auth/apple/callback/')
      .set('Origin', 'https://appleid.apple.com')
      .expect(403);
    expect(handlers.appleCallback).toHaveBeenCalledTimes(1);
  });

  // Test 9
  it('internal-prefix writes keep InternalServiceAuthGuard unchanged', async () => {
    await http().post('/api/internal/ping').set('X-Internal-Service-Key', INTERNAL_KEY).expect(200);
    expect(handlers.internal).toHaveBeenCalledTimes(1);
    await http().post('/api/internal/ping').expect(401);
    await http().post('/api/internal/ping').set('X-Internal-Service-Key', 'wrong').expect(401);
    expect(handlers.internal).toHaveBeenCalledTimes(1);
  });

  it('a bearer POST without Origin or cookie reaches the bearer check', async () => {
    await http().post('/api/ai/execute').set('Authorization', 'Bearer good-key').expect(202);
    expect(handlers.bearerExecute).toHaveBeenCalledTimes(1);
    await http().post('/api/ai/execute').set('Authorization', 'Bearer bad-key').expect(401);
    expect(handlers.bearerExecute).toHaveBeenCalledTimes(1);
  });
});
