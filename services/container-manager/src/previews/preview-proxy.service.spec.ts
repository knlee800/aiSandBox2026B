import 'reflect-metadata';
import { INestApplicationContext, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import axios from 'axios';
import { PreviewProxyService } from './preview-proxy.service';
import { PreviewService as PreviewPortRegistry } from './preview.service';
import { PreviewModule } from '../preview/preview.module';
import { PreviewService } from '../preview/preview.service';
import { PreviewStrategyResolver } from '../preview/preview-strategy.resolver';
import { BrowserSmokeService } from '../browser-smoke/browser-smoke.service';

/**
 * BROWSER-SMOKE-01: PreviewProxyService resolves the browser-smoke target
 * from the port registry, which preview/PreviewService fills when a preview
 * server is running. The module test compiles PreviewModule (and with it
 * SessionsModule) with the database, Docker and gateway client stubbed out.
 */

jest.mock('axios');
jest.mock('better-sqlite3', () =>
  jest.fn(() => ({ exec: jest.fn(), prepare: jest.fn(() => ({ get: jest.fn(), all: jest.fn(), run: jest.fn() })) })),
);

// One shared Docker stub behind every injected DockerRuntimeService.
const dockerStub = {
  findContainerBySessionId: jest.fn(),
  execInContainerBySessionId: jest.fn(),
};

jest.mock('../docker/docker-runtime.service', () => {
  const actual = jest.requireActual('../docker/docker-runtime.service');
  class DockerRuntimeService {
    findContainerBySessionId(...args: unknown[]) {
      return dockerStub.findContainerBySessionId(...args);
    }
    execInContainerBySessionId(...args: unknown[]) {
      return dockerStub.execInContainerBySessionId(...args);
    }
  }
  return { ...actual, DockerRuntimeService };
});

jest.mock('../sessions/sessions.service', () => {
  class SessionsService {
    assertSessionUsable() {
      return undefined;
    }
  }
  return { SessionsService };
});

jest.mock('../clients/api-gateway-http.client', () => {
  class ApiGatewayHttpClient {}
  return { ApiGatewayHttpClient };
});

function runningContainer(ipAddress = '172.18.0.10') {
  return {
    inspect: async () => ({
      State: { Running: true },
      NetworkSettings: { Networks: { bridge: { IPAddress: ipAddress } } },
    }),
  };
}

describe('PreviewProxyService getProxyTarget', () => {
  const sessionsService = { assertSessionUsable: jest.fn() };
  const dockerRuntimeService = { findContainerBySessionId: jest.fn() };
  let registry: PreviewPortRegistry;
  let proxy: PreviewProxyService;

  beforeEach(() => {
    jest.clearAllMocks();
    dockerRuntimeService.findContainerBySessionId.mockResolvedValue(runningContainer());
    registry = new PreviewPortRegistry(sessionsService as any, dockerRuntimeService as any);
    proxy = new PreviewProxyService(registry, dockerRuntimeService as any);
  });

  it('returns http://<container ip>:<port> once a port is registered', async () => {
    await registry.registerPreviewPort('session-1', 3001);

    await expect(proxy.getProxyTarget('session-1')).resolves.toBe('http://172.18.0.10:3001');
  });

  it('throws the existing NotFound message when no port is registered', async () => {
    const attempt = proxy.getProxyTarget('session-1');

    await expect(attempt).rejects.toBeInstanceOf(NotFoundException);
    await expect(proxy.getProxyTarget('session-1')).rejects.toThrow(
      'No preview port registered for session session-1',
    );
  });

  it('throws NotFound again after the port is unregistered', async () => {
    await registry.registerPreviewPort('session-1', 3001);
    registry.unregisterPreviewPort('session-1');

    await expect(proxy.getProxyTarget('session-1')).rejects.toThrow(
      'No preview port registered for session session-1',
    );
  });

  it('reports a stopped container instead of a target', async () => {
    await registry.registerPreviewPort('session-1', 3001);
    dockerRuntimeService.findContainerBySessionId.mockResolvedValue({
      inspect: async () => ({ State: { Running: false }, NetworkSettings: { Networks: {} } }),
    });

    await expect(proxy.getProxyTarget('session-1')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});

describe('BROWSER-SMOKE-01 module wiring: PreviewModule with SessionsModule', () => {
  const originalKey = process.env.INTERNAL_SERVICE_KEY;
  let ctx: INestApplicationContext;

  beforeAll(async () => {
    // The controllers' InternalServiceAuthGuard needs a key to construct.
    process.env.INTERNAL_SERVICE_KEY = 'browser-smoke-01-wiring-key';
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    ctx = await NestFactory.createApplicationContext(PreviewModule, {
      logger: false,
      abortOnError: false,
    });
  });

  afterAll(async () => {
    await ctx?.close();
    jest.restoreAllMocks();
    if (originalKey === undefined) {
      delete process.env.INTERNAL_SERVICE_KEY;
    } else {
      process.env.INTERNAL_SERVICE_KEY = originalKey;
    }
  });

  beforeEach(() => {
    dockerStub.findContainerBySessionId.mockReset();
    dockerStub.execInContainerBySessionId.mockReset();
    dockerStub.findContainerBySessionId.mockResolvedValue(runningContainer());
  });

  it('injects the one registry instance into the preview service and the browser-smoke proxy', () => {
    const registry = ctx.get(PreviewPortRegistry);
    const previewService = ctx.get(PreviewService);
    const proxy = ctx.get(PreviewProxyService);

    expect(previewService).toBeInstanceOf(PreviewService);
    expect(registry).not.toBe(previewService);
    expect((previewService as any).previewPortRegistry).toBe(registry);
    expect((proxy as any).previewService).toBe(registry);
  });

  it('lets browser smoke reach a Vite preview started through PreviewModule, and not after it stops', async () => {
    const previewService = ctx.get(PreviewService);
    const proxy = ctx.get(PreviewProxyService);
    const browserSmoke = ctx.get(BrowserSmokeService);
    jest.spyOn(ctx.get(PreviewStrategyResolver), 'resolve').mockResolvedValue({
      type: 'node-dev-server',
      framework: 'Vite',
      command: 'npm run dev',
      servingMode: 'process-proxy',
    } as any);
    (axios.get as jest.Mock).mockResolvedValue({ status: 200 });
    dockerStub.execInContainerBySessionId.mockImplementation(async (_sid: string, cmd: string[]) => {
      const script = cmd[2] ?? '';
      if (script.includes('& echo $!')) {
        return { exitCode: 0, stdout: '4242\n', stderr: '' };
      }
      if (script.includes('SMOKE_SCRIPT')) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({ success: true, url: 'x', pageTitle: 'App', durationMs: 5 }),
          stderr: '',
        };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    const started = await previewService.startPreview('session-wired');
    expect(started.status).toBe('running');

    await expect(proxy.getProxyTarget('session-wired')).resolves.toBe(
      `http://172.18.0.10:${started.port}`,
    );
    const smoke = await browserSmoke.run({ sessionId: 'session-wired', url: '/about' });
    expect(smoke.success).toBe(true);
    const smokeCall = dockerStub.execInContainerBySessionId.mock.calls.find((call) =>
      String(call[1]?.[2] ?? '').includes('SMOKE_SCRIPT'),
    );
    expect(smokeCall?.[3]?.SMOKE_URL).toBe(`http://172.18.0.10:${started.port}/about`);

    await previewService.stopPreview('session-wired');

    const afterStop = await browserSmoke.run({ sessionId: 'session-wired' });
    expect(afterStop.success).toBe(false);
    expect(afterStop.error).toBe(
      'Preview target not available: No preview port registered for session session-wired',
    );
  });
});
