import { readFileSync } from 'fs';
import { join } from 'path';
import { resolveHttpCorsOrigin } from './http-cors-origin';

function corsDecision(requestOrigin?: string): Promise<boolean | string | undefined> {
  return new Promise((resolve, reject) => {
    resolveHttpCorsOrigin(requestOrigin, (err, allow) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(allow);
    });
  });
}

describe('resolveHttpCorsOrigin', () => {
  const originalAppBaseUrl = process.env.APP_BASE_URL;

  afterEach(() => {
    if (originalAppBaseUrl === undefined) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = originalAppBaseUrl;
    }
  });

  it('echoes the allowed origin', async () => {
    process.env.APP_BASE_URL = 'https://app.example.com/sandbox';
    await expect(corsDecision('https://app.example.com')).resolves.toBe(
      'https://app.example.com',
    );
  });

  it('refuses another host', async () => {
    process.env.APP_BASE_URL = 'https://app.example.com';
    await expect(corsDecision('https://evil.example')).resolves.toBe(false);
  });

  it('refuses the same host with another port', async () => {
    process.env.APP_BASE_URL = 'https://app.example.com:8443';
    await expect(corsDecision('https://app.example.com:9443')).resolves.toBe(false);
  });

  it('refuses the same host with another scheme', async () => {
    process.env.APP_BASE_URL = 'https://app.example.com';
    await expect(corsDecision('http://app.example.com')).resolves.toBe(false);
  });

  it('refuses a missing Origin', async () => {
    process.env.APP_BASE_URL = 'https://app.example.com';
    await expect(corsDecision(undefined)).resolves.toBe(false);
  });

  it('refuses when APP_BASE_URL is unset', async () => {
    delete process.env.APP_BASE_URL;
    await expect(corsDecision('https://app.example.com')).resolves.toBe(false);
  });

  it('refuses when APP_BASE_URL is blank', async () => {
    process.env.APP_BASE_URL = '   ';
    await expect(corsDecision('https://app.example.com')).resolves.toBe(false);
  });

  it('refuses when APP_BASE_URL is not a URL', async () => {
    process.env.APP_BASE_URL = 'not a url';
    await expect(corsDecision('https://app.example.com')).resolves.toBe(false);
  });
});

describe('main.ts HTTP CORS wiring', () => {
  it('uses resolveHttpCorsOrigin with credentials and not origin true', () => {
    const source = readFileSync(join(__dirname, '..', 'main.ts'), 'utf8');
    expect(source).toContain('resolveHttpCorsOrigin');
    expect(source).toContain('credentials: true');
    expect(source).not.toContain('origin: true');
  });
});
