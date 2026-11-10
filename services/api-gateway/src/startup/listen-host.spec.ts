import { readFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_LISTEN_HOST, resolveListenHost } from './listen-host';

describe('resolveListenHost (AI-SERVICE-AUTH-01 D1)', () => {
  it('defaults to 127.0.0.1 when LISTEN_HOST is unset', () => {
    expect(DEFAULT_LISTEN_HOST).toBe('127.0.0.1');
    expect(resolveListenHost({})).toBe('127.0.0.1');
  });

  it('defaults to 127.0.0.1 when LISTEN_HOST is blank', () => {
    expect(resolveListenHost({ LISTEN_HOST: '' })).toBe('127.0.0.1');
    expect(resolveListenHost({ LISTEN_HOST: '   ' })).toBe('127.0.0.1');
  });

  it('keeps an explicit 0.0.0.0', () => {
    expect(resolveListenHost({ LISTEN_HOST: '0.0.0.0' })).toBe('0.0.0.0');
  });

  it('trims the value', () => {
    expect(resolveListenHost({ LISTEN_HOST: ' 127.0.0.1  ' })).toBe('127.0.0.1');
  });

  it('ignores HOST', () => {
    expect(resolveListenHost({ HOST: 'my-machine' })).toBe('127.0.0.1');
  });

  it('main.ts listens on the resolved host', () => {
    const source = readFileSync(join(__dirname, '..', 'main.ts'), 'utf8');
    expect(source).toContain("from './startup/listen-host'");
    expect(source).toContain('const host = resolveListenHost(process.env);');
    expect(source).toContain('await app.listen(port, host);');
    expect(source).not.toMatch(/app\.listen\(port\)/);
  });
});
