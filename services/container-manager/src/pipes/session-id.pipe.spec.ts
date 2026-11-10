import { BadRequestException } from '@nestjs/common';
import { SessionIdPipe } from './session-id.pipe';

describe('SessionIdPipe (CM-SYMLINK-01)', () => {
  const pipe = new SessionIdPipe();

  it('passes UUID and base36 session ids through unchanged', () => {
    for (const id of ['3f2a8c1e-0b4d-4c5e-9f6a-7b8c9d0e1f2a', 'lq3k9z0abc123', 'sess-1']) {
      expect(pipe.transform(id)).toBe(id);
    }
  });

  it.each([
    ['empty', ''],
    ['dot', '.'],
    ['dot-dot', '..'],
    ['a slash', 'a/b'],
    ['a parent escape', '../abc'],
    ['a backslash', 'a\\b'],
    ['an absolute path', '/etc'],
    ['a NUL', 'a\u0000b'],
    ['not a string', undefined],
    ['a number', 42],
  ])('refuses %s with 400 "Invalid session id"', (_name, value) => {
    expect(() => pipe.transform(value)).toThrow(BadRequestException);
    expect(() => pipe.transform(value)).toThrow('Invalid session id');
  });
});
