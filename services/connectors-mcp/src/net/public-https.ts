import dns from 'node:dns';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';
import type { LookupAddress } from 'node:dns';

import { CALENDAR_TIMEOUT_MS, MAX_CALENDAR_BYTES } from '../limits';

const forbidden = new BlockList();
forbidden.addSubnet('0.0.0.0', 8, 'ipv4');
forbidden.addSubnet('10.0.0.0', 8, 'ipv4');
forbidden.addSubnet('127.0.0.0', 8, 'ipv4');
forbidden.addSubnet('169.254.0.0', 16, 'ipv4');
forbidden.addSubnet('172.16.0.0', 12, 'ipv4');
forbidden.addSubnet('192.168.0.0', 16, 'ipv4');
forbidden.addSubnet('100.64.0.0', 10, 'ipv4');
forbidden.addSubnet('192.0.0.0', 24, 'ipv4');
forbidden.addSubnet('192.0.2.0', 24, 'ipv4');
forbidden.addSubnet('198.18.0.0', 15, 'ipv4');
forbidden.addSubnet('198.51.100.0', 24, 'ipv4');
forbidden.addSubnet('203.0.113.0', 24, 'ipv4');
forbidden.addSubnet('224.0.0.0', 4, 'ipv4');
forbidden.addSubnet('240.0.0.0', 4, 'ipv4');
forbidden.addAddress('::', 'ipv6');
forbidden.addAddress('::1', 'ipv6');
forbidden.addSubnet('fe80::', 10, 'ipv6');
forbidden.addSubnet('fc00::', 7, 'ipv6');
forbidden.addSubnet('ff00::', 8, 'ipv6');
// Refused outright, including when the embedded IPv4 address is public.
forbidden.addSubnet('64:ff9b::', 96, 'ipv6');
forbidden.addSubnet('2002::', 16, 'ipv6');
forbidden.addSubnet('2001:db8::', 32, 'ipv6');

export interface PublicHttpsOptions {
  timeoutMs?: number;
  maxBytes?: number;
}

function mappedIpv4(ip: string): string | null {
  const lower = ip.toLowerCase();
  const dotted = lower.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) {
    return dotted[1];
  }
  const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) {
    return null;
  }
  const high = parseInt(hex[1], 16);
  const low = parseInt(hex[2], 16);
  return `${(high >> 8) & 255}.${high & 255}.${(low >> 8) & 255}.${low & 255}`;
}

export function isNonPublicAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) {
    return forbidden.check(ip, 'ipv4');
  }
  if (family === 6) {
    if (forbidden.check(ip, 'ipv6')) {
      return true;
    }
    const embedded = mappedIpv4(ip);
    return embedded !== null && forbidden.check(embedded, 'ipv4');
  }
  return true;
}

async function resolveAddresses(hostname: string): Promise<string[]> {
  if (isIP(hostname)) {
    return [hostname];
  }
  const records = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

function pinnedLookup(address: string) {
  const family = isIP(address);
  return (
    _hostname: string,
    options: dns.LookupOptions | ((error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void),
    callback?: (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
  ) => {
    const done = typeof options === 'function' ? options : callback;
    if (!done) {
      return;
    }
    if (typeof options === 'object' && options.all) {
      done(null, [{ address, family }]);
      return;
    }
    done(null, address, family);
  };
}

export async function fetchPublicHttps(rawUrl: string, options: PublicHttpsOptions = {}): Promise<Buffer> {
  const timeoutMs = options.timeoutMs ?? CALENDAR_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? MAX_CALENDAR_BYTES;
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cleanup = () => undefined;

  return new Promise<Buffer>((resolve, reject) => {
    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      cleanup();
      reject(error);
    };
    const succeed = (body: Buffer) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      resolve(body);
    };

    timer = setTimeout(() => {
      fail(new Error('calendar request timed out'));
    }, timeoutMs);

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      fail(new Error('calendar URL must be https'));
      return;
    }
    if (parsed.protocol !== 'https:') {
      fail(new Error('calendar URL must be https'));
      return;
    }

    const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
    resolveAddresses(hostname).then((addresses) => {
      if (settled) {
        return;
      }
      if (addresses.length === 0) {
        fail(new Error('calendar host did not resolve'));
        return;
      }
      for (const address of addresses) {
        if (isNonPublicAddress(address)) {
          fail(new Error('calendar host address is not public'));
          return;
        }
      }
      const pinned = addresses[0];
      const request = https.request(
        {
          protocol: 'https:',
          hostname,
          port: parsed.port || 443,
          path: `${parsed.pathname}${parsed.search}`,
          method: 'GET',
          servername: isIP(hostname) ? undefined : hostname,
          rejectUnauthorized: true,
          timeout: timeoutMs,
          headers: {
            Accept: 'text/calendar, text/plain, */*',
          },
          lookup: pinnedLookup(pinned),
        },
        (response) => {
          const status = response.statusCode ?? 0;
          if (status >= 300 && status < 400) {
            response.resume();
            fail(new Error('calendar redirect is not allowed'));
            return;
          }
          if (status !== 200) {
            response.resume();
            fail(new Error('calendar fetch failed'));
            return;
          }
          const chunks: Buffer[] = [];
          let received = 0;
          response.on('data', (chunk: Buffer) => {
            received += chunk.length;
            if (received > maxBytes) {
              response.destroy();
              fail(new Error('calendar response exceeds 2 MB'));
              return;
            }
            chunks.push(chunk);
          });
          response.on('end', () => {
            succeed(Buffer.concat(chunks));
          });
          response.on('error', () => {
            fail(new Error('calendar fetch failed'));
          });
        },
      );
      cleanup = () => {
        request.destroy();
      };
      request.on('error', () => {
        fail(new Error('calendar fetch failed'));
      });
      request.on('timeout', () => {
        fail(new Error('calendar request timed out'));
      });
      request.end();
    }).catch(() => {
      fail(new Error('calendar host did not resolve'));
    });
  });
}
