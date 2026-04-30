import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  deleteWorkspaceFile,
  findFirstFilePath,
  listWorkspaceDirectory,
  loadWorkspaceFileTree,
  readWorkspaceFile,
  writeWorkspaceFile,
  type WorkspaceFileEntry,
  type WorkspaceFileNode,
} from './workspace-file-navigation.logic';

describe('workspace file navigation logic', () => {
  test('lists directory entries using existing session-scoped file endpoint', async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    const fakeFetch = async (url: string | URL, init?: RequestInit) => {
      fetchCalls.push({ url: String(url), init });
      return {
        ok: true,
        json: async () =>
          [
            { name: 'src', path: 'src', type: 'directory', size: 0, modified: '2026-01-01' },
          ] satisfies WorkspaceFileEntry[],
      } as Response;
    };

    const result = await listWorkspaceDirectory({
      token: 'token-123',
      sessionId: 'session-123',
      directoryPath: '/src',
      fetchImpl: fakeFetch as typeof fetch,
    });

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, '/api/sessions/session-123/files/list?path=%2Fsrc');
    assert.equal(fetchCalls[0].init?.method, 'GET');
    assert.equal(
      (fetchCalls[0].init?.headers as Record<string, string>).Authorization,
      'Bearer token-123',
    );
    assert.equal(result[0].path, 'src');
  });

  test('reads selected file content using existing session-scoped file endpoint', async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    const fakeFetch = async (url: string | URL, init?: RequestInit) => {
      fetchCalls.push({ url: String(url), init });
      return {
        ok: true,
        json: async () => ({ path: 'src/app.ts', content: 'console.log("ok");' }),
      } as Response;
    };

    const result = await readWorkspaceFile({
      token: 'token-456',
      sessionId: 'session-456',
      filePath: 'src/app.ts',
      fetchImpl: fakeFetch as typeof fetch,
    });

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, '/api/sessions/session-456/files/read');
    assert.equal(fetchCalls[0].init?.method, 'POST');
    assert.equal(
      (fetchCalls[0].init?.headers as Record<string, string>)['Content-Type'],
      'application/json',
    );
    assert.equal(fetchCalls[0].init?.body, JSON.stringify({ path: 'src/app.ts' }));
    assert.equal(result.path, 'src/app.ts');
    assert.equal(result.content, 'console.log("ok");');
  });

  test('writes selected file content using existing session-scoped file endpoint', async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    const fakeFetch = async (url: string | URL, init?: RequestInit) => {
      fetchCalls.push({ url: String(url), init });
      return {
        ok: true,
      } as Response;
    };

    await writeWorkspaceFile({
      token: 'token-789',
      sessionId: 'session-789',
      filePath: 'src/app.ts',
      content: 'console.log("saved");',
      fetchImpl: fakeFetch as typeof fetch,
    });

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, '/api/sessions/session-789/files/write');
    assert.equal(fetchCalls[0].init?.method, 'POST');
    assert.equal(
      (fetchCalls[0].init?.headers as Record<string, string>)['Content-Type'],
      'application/json',
    );
    assert.equal(
      fetchCalls[0].init?.body,
      JSON.stringify({ path: 'src/app.ts', content: 'console.log("saved");' }),
    );
  });

  test('deletes selected file using existing session-scoped delete endpoint', async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    const fakeFetch = async (url: string | URL, init?: RequestInit) => {
      fetchCalls.push({ url: String(url), init });
      return {
        ok: true,
      } as Response;
    };

    await deleteWorkspaceFile({
      token: 'token-del',
      sessionId: 'session-del',
      filePath: 'src/old.ts',
      fetchImpl: fakeFetch as typeof fetch,
    });

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, '/api/sessions/session-del/files/delete');
    assert.equal(fetchCalls[0].init?.method, 'DELETE');
    assert.equal(
      (fetchCalls[0].init?.headers as Record<string, string>)['Content-Type'],
      'application/json',
    );
    assert.equal(fetchCalls[0].init?.body, JSON.stringify({ path: 'src/old.ts' }));
  });

  test('builds recursive file tree and returns first file path deterministically', async () => {
    const fakeFetch = async (url: string | URL) => {
      const urlString = String(url);
      if (urlString.includes('/list?path=%2F')) {
        return {
          ok: true,
          json: async () =>
            [
              { name: 'src', path: 'src', type: 'directory', size: 0, modified: '2026-01-01' },
              {
                name: 'README.md',
                path: 'README.md',
                type: 'file',
                size: 100,
                modified: '2026-01-01',
              },
            ] satisfies WorkspaceFileEntry[],
        } as Response;
      }

      if (urlString.includes('/list?path=src')) {
        return {
          ok: true,
          json: async () =>
            [
              {
                name: 'index.ts',
                path: 'src/index.ts',
                type: 'file',
                size: 50,
                modified: '2026-01-01',
              },
            ] satisfies WorkspaceFileEntry[],
        } as Response;
      }

      throw new Error(`Unhandled URL: ${urlString}`);
    };

    const tree = await loadWorkspaceFileTree({
      token: 'token-789',
      sessionId: 'session-789',
      fetchImpl: fakeFetch as typeof fetch,
    });

    assert.equal(tree.length, 2);
    assert.equal(tree[0].type, 'directory');
    assert.equal(tree[0].path, 'src');
    assert.equal(tree[0].children[0].path, 'src/index.ts');
    assert.equal(tree[1].path, 'README.md');
    assert.equal(findFirstFilePath(tree), 'src/index.ts');
  });

  test('returns null when no file exists in tree', () => {
    const directoryOnlyTree: WorkspaceFileNode[] = [
      {
        name: 'src',
        path: 'src',
        type: 'directory',
        children: [
          {
            name: 'nested',
            path: 'src/nested',
            type: 'directory',
            children: [],
          },
        ],
      },
    ];

    assert.equal(findFirstFilePath(directoryOnlyTree), null);
  });
});
