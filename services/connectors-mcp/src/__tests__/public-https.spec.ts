import dns from 'node:dns';
import https from 'node:https';
import { EventEmitter, Readable } from 'node:stream';

import { fetchPublicHttps, isNonPublicAddress } from '../net/public-https';
import { CALENDAR_TIMEOUT_MS, MAX_CALENDAR_BYTES } from '../limits';

const REFUSED = [
  ['ipv4 loopback', '127.0.0.1'],
  ['ipv4 loopback range', '127.1.2.3'],
  ['ipv4 private 10/8', '10.1.2.3'],
  ['ipv4 private 172.16/12', '172.16.0.1'],
  ['ipv4 private 172.31/12', '172.31.255.255'],
  ['ipv4 private 192.168/16', '192.168.1.1'],
  ['ipv4 link-local metadata', '169.254.169.254'],
  ['ipv4 link-local', '169.254.1.1'],
  ['ipv4 multicast', '224.0.0.1'],
  ['ipv4 multicast high', '239.255.255.255'],
  ['ipv4 unspecified', '0.0.0.0'],
  ['ipv6 loopback', '::1'],
  ['ipv6 unique-local fc', 'fc00::1'],
  ['ipv6 unique-local fd', 'fd12:3456::1'],
  ['ipv6 link-local', 'fe80::1'],
  ['ipv6 multicast', 'ff02::1'],
  ['ipv6 unspecified', '::'],
  ['ipv4-mapped loopback', '::ffff:127.0.0.1'],
  ['ipv4-mapped metadata', '::ffff:169.254.169.254'],
  ['ipv4-mapped private', '::ffff:10.0.0.1'],
  ['ipv4 shared 100.64/10', '100.64.0.1'],
  ['ipv4 shared 100.64/10 high', '100.127.255.1'],
  ['ipv4 ietf protocol 192.0.0/24', '192.0.0.1'],
  ['ipv4 test-net-1', '192.0.2.1'],
  ['ipv4 benchmarking 198.18/15', '198.18.0.1'],
  ['ipv4 benchmarking 198.19/15', '198.19.255.1'],
  ['ipv4 test-net-2', '198.51.100.1'],
  ['ipv4 test-net-3', '203.0.113.1'],
  ['ipv6 nat64 prefix', '64:ff9b::808:808'],
  ['ipv6 nat64 private embedded', '64:ff9b::a00:1'],
  ['ipv6 6to4 prefix', '2002:808:808::'],
  ['ipv6 6to4 private embedded', '2002:c0a8:101::'],
  ['ipv6 documentation', '2001:db8::1'],
];

function mockLookup(addresses: string[]): jest.SpyInstance {
  return jest.spyOn(dns.promises, 'lookup').mockImplementation(async () => {
    return addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })) as never;
  });
}

function mockResponse(status: number, chunks: Buffer[]): { calls: Array<Record<string, unknown>> } {
  const calls: Array<Record<string, unknown>> = [];
  jest.spyOn(https, 'request').mockImplementation(((options: Record<string, unknown>, callback: (response: Readable) => void) => {
    calls.push(options);
    const request = new EventEmitter() as EventEmitter & {
      destroyed: boolean;
      destroy: () => void;
      end: () => void;
    };
    request.destroyed = false;
    request.destroy = () => {
      request.destroyed = true;
    };
    request.end = () => {
      const response = new Readable({ read() { return undefined; } });
      Object.assign(response, { statusCode: status, headers: status === 302 ? { location: 'http://127.0.0.1/next' } : {} });
      callback(response);
      for (const chunk of chunks) {
        response.push(chunk);
      }
      response.push(null);
    };
    return request;
  }) as never);
  return { calls };
}

describe('public HTTPS calendar fetch', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(REFUSED)('refuses %s %s', async (_label, address) => {
    expect(isNonPublicAddress(address)).toBe(true);
    const lookup = mockLookup([address]);
    const request = jest.spyOn(https, 'request');
    const error = await fetchPublicHttps('https://calendar.example/feed.ics', { timeoutMs: 1_000 }).then(() => null, (caught) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('calendar host address is not public');
    expect(error.message).not.toContain('calendar.example');
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(request).not.toHaveBeenCalled();
  });

  it('refuses a literal loopback URL without a second lookup', async () => {
    const lookup = jest.spyOn(dns.promises, 'lookup');
    const request = jest.spyOn(https, 'request');
    await expect(fetchPublicHttps('https://127.0.0.1/feed.ics')).rejects.toThrow(/not public/);
    await expect(fetchPublicHttps('https://[::1]/feed.ics')).rejects.toThrow(/not public/);
    await expect(fetchPublicHttps('https://169.254.169.254/latest/meta-data')).rejects.toThrow(/not public/);
    expect(lookup).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it('refuses when any resolved address is non-public', async () => {
    mockLookup(['8.8.8.8', '10.0.0.1']);
    const request = jest.spyOn(https, 'request');
    await expect(fetchPublicHttps('https://calendar.example/feed.ics')).rejects.toThrow(/not public/);
    expect(request).not.toHaveBeenCalled();
  });

  it('connects to the checked address with the hostname for TLS and does not follow redirects', async () => {
    const lookup = mockLookup(['8.8.8.8']);
    const { calls } = mockResponse(200, [Buffer.from('BEGIN:VCALENDAR')]);
    const body = await fetchPublicHttps('https://calendar.example/feed.ics?token=abc', { timeoutMs: 1_000 });
    expect(body.toString('utf8')).toBe('BEGIN:VCALENDAR');
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].hostname).toBe('calendar.example');
    expect(calls[0].servername).toBe('calendar.example');
    expect(calls[0].rejectUnauthorized).toBe(true);
    expect(calls[0].timeout).toBe(1_000);
    const seen: string[] = [];
    const pinned = calls[0].lookup as (hostname: string, options: object, callback: (error: null, address: string, family: number) => void) => void;
    pinned('calendar.example', {}, (_error, address) => {
      seen.push(address);
    });
    expect(seen).toEqual(['8.8.8.8']);
    expect(lookup).toHaveBeenCalledTimes(1);

    jest.restoreAllMocks();
    mockLookup(['1.1.1.1']);
    const redirected = mockResponse(302, [Buffer.from('go')]);
    await expect(fetchPublicHttps('https://calendar.example/feed.ics')).rejects.toThrow(/redirect/);
    expect(redirected.calls).toHaveLength(1);
  });

  it('uses the 10 second timeout and 2 MB cap by default and stops an oversize body', async () => {
    mockLookup(['2001:4860:4860::8888']);
    const { calls } = mockResponse(200, [Buffer.from('ok')]);
    await fetchPublicHttps('https://calendar.example/feed.ics');
    expect(calls[0].timeout).toBe(CALENDAR_TIMEOUT_MS);
    expect(CALENDAR_TIMEOUT_MS).toBe(10_000);
    expect(MAX_CALENDAR_BYTES).toBe(2 * 1024 * 1024);

    jest.restoreAllMocks();
    mockLookup(['8.8.8.8']);
    mockResponse(200, [Buffer.alloc(1024 * 1024), Buffer.alloc(1024 * 1024), Buffer.alloc(1)]);
    const error = await fetchPublicHttps('https://calendar.example/feed.ics', { timeoutMs: 1_000 }).then(() => null, (caught) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('calendar response exceeds 2 MB');
    expect(error.message).not.toContain('calendar.example');
  });

  it('rejects plain HTTP and times out a response that never arrives', async () => {
    const lookup = jest.spyOn(dns.promises, 'lookup');
    await expect(fetchPublicHttps('http://calendar.example/feed.ics')).rejects.toThrow(/https/);
    expect(lookup).not.toHaveBeenCalled();

    mockLookup(['8.8.8.8']);
    jest.spyOn(https, 'request').mockImplementation(((options: Record<string, unknown>) => {
      const request = new EventEmitter() as EventEmitter & { destroy: () => void; end: () => void };
      request.destroy = () => undefined;
      request.end = () => undefined;
      expect(options.timeout).toBe(30);
      return request;
    }) as never);
    await expect(fetchPublicHttps('https://calendar.example/feed.ics', { timeoutMs: 30 })).rejects.toThrow(/timed out/);
  });
});
