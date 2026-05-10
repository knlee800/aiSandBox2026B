import { sanitizeProxyHeaders } from '../preview.controller';

describe('sanitizeProxyHeaders', () => {
  const sensitiveHeaders = [
    'host',
    'cookie',
    'authorization',
    'proxy-authorization',
    'x-internal-service-key',
    'x-csrf-token',
    'x-forwarded-user',
    'x-user-id',
    'x-session-id',
  ];

  const usefulHeaders = [
    'accept',
    'accept-language',
    'user-agent',
    'content-type',
    'range',
    'if-none-match',
    'if-modified-since',
    'cache-control',
  ];

  it.each(sensitiveHeaders)('strips sensitive header: %s', (headerName) => {
    const sanitized = sanitizeProxyHeaders({
      [headerName]: 'sensitive-value',
      accept: 'text/html',
    });

    expect(sanitized[headerName]).toBeUndefined();
    expect(sanitized.accept).toBe('text/html');
  });

  it.each(usefulHeaders)('preserves useful header: %s', (headerName) => {
    const sanitized = sanitizeProxyHeaders({
      [headerName]: 'safe-value',
    });

    expect(sanitized[headerName]).toBe('safe-value');
  });

  it('strips sensitive headers and preserves safe headers for mixed input', () => {
    const sanitized = sanitizeProxyHeaders({
      cookie: 'session=abc',
      authorization: 'Bearer token',
      accept: 'text/html',
      'content-type': 'application/json',
      range: 'bytes=0-100',
      'x-forwarded-for': '203.0.113.10',
    });

    expect(sanitized.cookie).toBeUndefined();
    expect(sanitized.authorization).toBeUndefined();
    expect(sanitized.accept).toBe('text/html');
    expect(sanitized['content-type']).toBe('application/json');
    expect(sanitized.range).toBe('bytes=0-100');
    expect(sanitized['x-forwarded-for']).toBe('203.0.113.10');
  });

  it('returns empty object when all headers are denied', () => {
    const allDenied = sanitizeProxyHeaders({
      host: 'api.local',
      cookie: 'session=abc',
      authorization: 'Bearer token',
      'proxy-authorization': 'Basic abc123',
      'x-internal-service-key': 'secret',
      'x-csrf-token': 'csrf-token',
      'x-forwarded-user': 'user@example.com',
      'x-user-id': 'user-1',
      'x-session-id': 'session-1',
    });

    expect(allDenied).toEqual({});
  });

  it('returns same headers when all input headers are safe', () => {
    const safeHeaders = {
      accept: 'text/html',
      'accept-language': 'en-US',
      'cache-control': 'no-cache',
      'if-none-match': '"etag"',
      range: 'bytes=0-200',
    };

    const sanitized = sanitizeProxyHeaders(safeHeaders);
    expect(sanitized).toEqual(safeHeaders);
  });

  it('strips mixed-case Cookie and Authorization headers', () => {
    const sanitized = sanitizeProxyHeaders({
      Cookie: 'session=abc',
      Authorization: 'Bearer token',
      Accept: 'text/html',
    });

    expect(sanitized.Cookie).toBeUndefined();
    expect(sanitized.Authorization).toBeUndefined();
    expect(sanitized.Accept).toBe('text/html');
  });

  it('preserves multi-value string array headers unchanged', () => {
    const acceptValues = ['text/html', 'application/json'];
    const sanitized = sanitizeProxyHeaders({
      accept: acceptValues,
    });

    expect(sanitized.accept).toEqual(acceptValues);
  });

  it('preserves undefined value for a safe header', () => {
    const sanitized = sanitizeProxyHeaders({
      'if-none-match': undefined,
    });

    expect(Object.prototype.hasOwnProperty.call(sanitized, 'if-none-match')).toBe(true);
    expect(sanitized['if-none-match']).toBeUndefined();
  });
});
