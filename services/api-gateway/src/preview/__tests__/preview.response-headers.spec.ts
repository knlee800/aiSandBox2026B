import axios from 'axios';
import { PreviewController } from '../preview.controller';
import { filterProxyResponseHeaders } from '../preview-response-headers';

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
