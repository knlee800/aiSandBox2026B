import axios from 'axios';
import { PreviewController } from '../preview.controller';
import {
  filterProxyResponseHeaders,
  isAllowedPreviewSetCookie,
  limitPreviewCookieHeaders,
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

// COOKIE-PREFIX-01 section 5.
describe('limitPreviewCookieHeaders', () => {
  const appCookie = 'app_session=a1; Path=/; HttpOnly; SameSite=Lax';

  it('drops every Set-Cookie on the platform host, as an array or a single string, in any case', () => {
    expect(limitPreviewCookieHeaders({ 'set-cookie': [appCookie, 'b=2'], 'x-a': '1' }, 'platform')).toEqual({
      'x-a': '1',
    });
    expect(limitPreviewCookieHeaders({ 'Set-Cookie': appCookie }, 'platform')).toEqual({});
    expect(limitPreviewCookieHeaders({ 'SET-COOKIE': [appCookie] }, 'platform')).toEqual({});
  });

  it('keeps host-only app cookies on the preview host', () => {
    expect(limitPreviewCookieHeaders({ 'set-cookie': [appCookie, 'theme=dark'] }, 'preview')).toEqual({
      'set-cookie': [appCookie, 'theme=dark'],
    });
    expect(limitPreviewCookieHeaders({ 'Set-Cookie': appCookie }, 'preview')).toEqual({
      'Set-Cookie': [appCookie],
    });
  });

  it.each([
    ['Domain', 'a=1; Domain=staging.ainow.biz; Path=/'],
    ['domain in lower case', 'a=1; path=/; domain=ainow.biz'],
    ['DOMAIN with spaces', 'a=1;  DOMAIN = .ainow.biz'],
    ['an empty Domain', 'a=1; Domain='],
    ['the old session name', 'aisandbox_session=x; Path=/api'],
    ['the prefixed session name', '__Host-aisandbox_session=x; Path=/; Secure'],
    ['the CSRF name in upper case', 'AISANDBOX_CSRF=x'],
    ['the OAuth state signature', 'aisandbox_oauth_state.sig=x'],
    ['the preview cookie name', 'aisandbox_preview=x; Path=/api/preview/s/'],
    ['a platform name with no value separator', 'aisandbox_session'],
  ])('drops a preview-host line with %s', (_label, line) => {
    expect(isAllowedPreviewSetCookie(line)).toBe(false);
    expect(limitPreviewCookieHeaders({ 'set-cookie': [appCookie, line] }, 'preview')).toEqual({
      'set-cookie': [appCookie],
    });
  });

  it('keeps a line whose value or path only mentions a reserved word', () => {
    expect(isAllowedPreviewSetCookie('a=aisandbox_session; Path=/domain')).toBe(true);
  });

  it('removes the header when no preview-host line is left', () => {
    expect(
      limitPreviewCookieHeaders({ 'set-cookie': ['aisandbox_csrf=x'], 'content-type': 'text/html' }, 'preview'),
    ).toEqual({ 'content-type': 'text/html' });
  });

  it('drops Clear-Site-Data on both hosts, in any case', () => {
    for (const host of ['platform', 'preview'] as const) {
      expect(
        limitPreviewCookieHeaders({ 'Clear-Site-Data': '"cookies"', 'clear-site-data': '"*"', 'x-a': '1' }, host),
      ).toEqual({ 'x-a': '1' });
    }
  });

  it('does not change its input', () => {
    const input = { 'set-cookie': [appCookie, 'aisandbox_csrf=x'], 'clear-site-data': '"cookies"' };
    limitPreviewCookieHeaders(input, 'preview');
    expect(input).toEqual({ 'set-cookie': [appCookie, 'aisandbox_csrf=x'], 'clear-site-data': '"cookies"' });
  });
});
