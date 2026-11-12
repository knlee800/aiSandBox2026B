import axios from 'axios';
import { PreviewController } from '../preview.controller';
import {
  filterProxyResponseHeaders,
  PREVIEW_SANDBOX_CSP,
  withPreviewSandboxPolicy,
} from '../preview-response-headers';

jest.mock('axios');

describe('filterProxyResponseHeaders', () => {
  const hopByHop = [
    'connection',
    'keep-alive',
    'proxy-connection',
    'transfer-encoding',
    'te',
    'trailer',
    'upgrade',
    'proxy-authenticate',
    'proxy-authorization',
  ];

  it.each(hopByHop)('drops hop-by-hop header %s on both paths', (name) => {
    for (const streamed of [false, true]) {
      const out = filterProxyResponseHeaders(
        { [name]: 'x', 'content-type': 'text/html' },
        { streamed },
      );
      expect(out[name]).toBeUndefined();
      expect(out['content-type']).toBe('text/html');
    }
  });

  it('matches names case-insensitively', () => {
    const out = filterProxyResponseHeaders(
      { 'Transfer-Encoding': 'chunked', CONNECTION: 'close', 'Keep-Alive': 'timeout=5', 'Cache-Control': 'no-store' },
      { streamed: true },
    );
    expect(out).toEqual({ 'Cache-Control': 'no-store' });
  });

  it('drops headers named in the Connection header', () => {
    const out = filterProxyResponseHeaders(
      { Connection: 'X-Foo, close', 'x-foo': '1', 'x-bar': '2' },
      { streamed: true },
    );
    expect(out).toEqual({ 'x-bar': '2' });
  });

  it('drops content-length and content-encoding on the non-stream path', () => {
    const out = filterProxyResponseHeaders(
      { 'Content-Length': '10', 'content-encoding': 'gzip', etag: 'abc' },
      { streamed: false },
    );
    expect(out).toEqual({ etag: 'abc' });
  });

  it('keeps content-length and content-encoding on the stream path', () => {
    const out = filterProxyResponseHeaders(
      { 'content-length': '10', 'content-encoding': 'gzip', etag: 'abc' },
      { streamed: true },
    );
    expect(out).toEqual({ 'content-length': '10', 'content-encoding': 'gzip', etag: 'abc' });
  });

  it('handles missing headers', () => {
    expect(filterProxyResponseHeaders(undefined, { streamed: false })).toEqual({});
  });
});

describe('PreviewController catch-all response headers', () => {
  const mockedAxios = axios as jest.MockedFunction<typeof axios>;

  afterEach(() => jest.clearAllMocks());

  function makeRes() {
    return { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn(), json: jest.fn() };
  }

  it('does not set transfer-encoding on a JSON reply but keeps ordinary headers', async () => {
    mockedAxios.mockResolvedValue({
      status: 200,
      headers: {
        'transfer-encoding': 'chunked',
        connection: 'keep-alive',
        'content-length': '99',
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
      data: { ok: true },
    } as never);
    const res = makeRes();

    await new PreviewController().proxyToContainerManager(
      { method: 'GET', path: '/api/preview/session-123/status', body: undefined, query: {}, headers: {} } as never,
      res as never,
    );

    const names = res.setHeader.mock.calls.map((c) => String(c[0]).toLowerCase());
    expect(names).not.toContain('transfer-encoding');
    expect(names).not.toContain('connection');
    expect(names).not.toContain('content-length');
    expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
    expect(res.setHeader).toHaveBeenCalledWith('cache-control', 'no-store');
    expect(res.send).toHaveBeenCalledWith({ ok: true });
  });

  it('keeps content-length on the streamed proxy path', async () => {
    const pipe = jest.fn();
    mockedAxios.mockResolvedValue({
      status: 200,
      headers: { 'transfer-encoding': 'chunked', 'content-length': '5', 'content-type': 'text/html' },
      data: { pipe },
    } as never);
    const res = makeRes();

    await new PreviewController().proxyToContainerManager(
      { method: 'GET', path: '/api/preview/session-123/proxy/index.html', body: undefined, query: {}, headers: {} } as never,
      res as never,
    );

    const names = res.setHeader.mock.calls.map((c) => String(c[0]).toLowerCase());
    expect(names).not.toContain('transfer-encoding');
    expect(res.setHeader).toHaveBeenCalledWith('content-length', '5');
    expect(pipe).toHaveBeenCalledWith(res);
  });
});

describe('PREVIEW-ORIGIN-01 sandbox fail-safe (PREVIEW_BASE_URL unset)', () => {
  const mockedAxios = axios as jest.MockedFunction<typeof axios>;
  const savedPreviewBaseUrl = process.env.PREVIEW_BASE_URL;

  beforeEach(() => {
    delete process.env.PREVIEW_BASE_URL;
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    if (savedPreviewBaseUrl === undefined) delete process.env.PREVIEW_BASE_URL;
    else process.env.PREVIEW_BASE_URL = savedPreviewBaseUrl;
  });

  function makeRes() {
    return { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn(), json: jest.fn() };
  }

  function lastPolicy(res: ReturnType<typeof makeRes>) {
    const calls = res.setHeader.mock.calls.filter((c) => String(c[0]).toLowerCase() === 'content-security-policy');
    return calls.length ? calls[calls.length - 1][1] : undefined;
  }

  it('has the agreed token list and no allow-same-origin', () => {
    expect(PREVIEW_SANDBOX_CSP).toBe('sandbox allow-scripts allow-forms allow-modals allow-popups');
    expect(PREVIEW_SANDBOX_CSP).not.toMatch(/allow-same-origin|allow-top-navigation/);
  });

  it('withPreviewSandboxPolicy adds the policy and keeps an upstream one beside it', () => {
    expect(withPreviewSandboxPolicy({ 'content-type': 'text/html' })).toEqual({
      'content-type': 'text/html',
      'Content-Security-Policy': PREVIEW_SANDBOX_CSP,
    });
    expect(
      withPreviewSandboxPolicy({ 'content-security-policy': "default-src 'self'", etag: 'x' }),
    ).toEqual({ etag: 'x', 'Content-Security-Policy': ["default-src 'self'", PREVIEW_SANDBOX_CSP] });
    expect(
      withPreviewSandboxPolicy({ 'Content-Security-Policy': ['a', 'b'] })['Content-Security-Policy'],
    ).toEqual(['a', 'b', PREVIEW_SANDBOX_CSP]);
  });

  it('a streamed proxy response carries the policy', async () => {
    const pipe = jest.fn();
    mockedAxios.mockResolvedValue({ status: 200, headers: { 'content-type': 'text/html' }, data: { pipe } } as never);
    const res = makeRes();
    await new PreviewController().proxyToContainerManager(
      { method: 'GET', path: '/api/preview/session-123/proxy/index.html', body: undefined, query: {}, headers: {} } as never,
      res as never,
    );
    expect(lastPolicy(res)).toBe(PREVIEW_SANDBOX_CSP);
    expect(pipe).toHaveBeenCalledWith(res);
  });

  it('a non-stream proxy response carries the policy', async () => {
    mockedAxios.mockResolvedValue({ status: 200, headers: { 'content-type': 'text/html' }, data: '<p>x</p>' } as never);
    const res = makeRes();
    await new PreviewController().proxyToContainerManager(
      { method: 'GET', path: '/api/preview/session-123/proxy', body: undefined, query: {}, headers: {} } as never,
      res as never,
    );
    expect(lastPolicy(res)).toBe(PREVIEW_SANDBOX_CSP);
    expect(res.send).toHaveBeenCalledWith('<p>x</p>');
  });

  it('a 502 on the proxy path carries the policy', async () => {
    mockedAxios.mockRejectedValue(new Error('down'));
    const res = makeRes();
    await new PreviewController().proxyToContainerManager(
      { method: 'GET', path: '/api/preview/session-123/proxy', body: undefined, query: {}, headers: {} } as never,
      res as never,
    );
    expect(res.status).toHaveBeenCalledWith(502);
    expect(lastPolicy(res)).toBe(PREVIEW_SANDBOX_CSP);
  });

  it('status keeps its headers as before (no policy)', async () => {
    mockedAxios.mockResolvedValue({ status: 200, headers: { 'content-type': 'application/json' }, data: { ok: true } } as never);
    const res = makeRes();
    await new PreviewController().proxyToContainerManager(
      { method: 'GET', path: '/api/preview/session-123/status', body: undefined, query: {}, headers: {} } as never,
      res as never,
    );
    expect(lastPolicy(res)).toBeUndefined();
  });
});
