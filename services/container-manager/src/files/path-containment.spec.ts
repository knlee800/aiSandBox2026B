import { describe, expect, it } from '@jest/globals';
import * as path from 'path';
import { isPathInside, isSinglePathSegment } from './path-containment';

describe('isPathInside (CM-PATH-01)', () => {
  describe('posix rules', () => {
    const ws = '/workspaces/abc';
    const inside = (candidate: string) => isPathInside(ws, candidate, path.posix);

    it('refuses a sibling workspace that shares the prefix', () => {
      expect(inside('/workspaces/abc/../abcX/file')).toBe(false);
      expect(inside('/workspaces/abcX/file')).toBe(false);
      expect(inside('/workspaces/abcX')).toBe(false);
    });

    it('refuses .. escapes', () => {
      expect(inside('/workspaces/abc/..')).toBe(false);
      expect(inside('/workspaces/abc/../..')).toBe(false);
      expect(inside('/workspaces/abc/src/../../other/file')).toBe(false);
    });

    it('allows the workspace root and nested paths', () => {
      expect(inside('/workspaces/abc')).toBe(true);
      expect(inside('/workspaces/abc/')).toBe(true);
      expect(inside('/workspaces/abc/src/index.ts')).toBe(true);
      expect(inside('/workspaces/abc/src/../README.md')).toBe(true);
      expect(inside('/workspaces/abc/..config')).toBe(true);
    });

    it('refuses an absolute path outside', () => {
      expect(inside('/etc/passwd')).toBe(false);
      expect(inside('/')).toBe(false);
      expect(inside('/workspaces')).toBe(false);
    });
  });

  describe('win32 rules', () => {
    const ws = 'C:\\workspaces\\abc';
    const inside = (candidate: string) => isPathInside(ws, candidate, path.win32);

    it('refuses a sibling workspace that shares the prefix', () => {
      expect(inside('C:\\workspaces\\abc\\..\\abcX\\file')).toBe(false);
      expect(inside('C:\\workspaces\\abcX\\file')).toBe(false);
    });

    it('refuses .. escapes', () => {
      expect(inside('C:\\workspaces\\abc\\..')).toBe(false);
      expect(inside('C:\\workspaces\\abc\\..\\..\\Windows')).toBe(false);
    });

    it('allows the workspace root and nested paths', () => {
      expect(inside('C:\\workspaces\\abc')).toBe(true);
      expect(inside('C:\\workspaces\\abc\\src\\index.ts')).toBe(true);
      expect(inside('C:/workspaces/abc/src/index.ts')).toBe(true);
    });

    it('refuses an absolute path outside, including another drive', () => {
      expect(inside('C:\\Windows\\system32')).toBe(false);
      expect(inside('D:\\workspaces\\abc\\file')).toBe(false);
    });
  });

  it('uses the host path module by default', () => {
    const ws = path.resolve('workspaces', 'abc');
    expect(isPathInside(ws, path.join(ws, 'src', 'a.ts'))).toBe(true);
    expect(isPathInside(ws, path.join(ws, '..', 'abcX', 'a.ts'))).toBe(false);
  });
});

describe('isSinglePathSegment (CM-PATH-01)', () => {
  it('accepts plain ids', () => {
    expect(isSinglePathSegment('3f2a8c1e-0b4d-4c5e-9f6a-7b8c9d0e1f2a')).toBe(true);
    expect(isSinglePathSegment('lq3k9z0abc123')).toBe(true);
    expect(isSinglePathSegment('sess-1')).toBe(true);
  });

  it('refuses empty, dot, separators and NUL', () => {
    expect(isSinglePathSegment('')).toBe(false);
    expect(isSinglePathSegment('.')).toBe(false);
    expect(isSinglePathSegment('..')).toBe(false);
    expect(isSinglePathSegment('../abc')).toBe(false);
    expect(isSinglePathSegment('abc/../abcX')).toBe(false);
    expect(isSinglePathSegment('..\\abc')).toBe(false);
    expect(isSinglePathSegment('/etc')).toBe(false);
    expect(isSinglePathSegment('abc\u0000')).toBe(false);
    expect(isSinglePathSegment(undefined)).toBe(false);
    expect(isSinglePathSegment(42)).toBe(false);
  });
});
