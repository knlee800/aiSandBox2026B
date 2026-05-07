import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  deleteWorkspaceFile,
  findFirstFilePath,
  listWorkspaceDirectory,
  loadWorkspaceFileTree,
  readWorkspaceFile,
  searchWorkspaceFiles,
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
      sessionId: 'session-123',
      directoryPath: '/src',
      fetchImpl: fakeFetch as typeof fetch,
    });

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, '/api/sessions/session-123/files/list?path=%2Fsrc');
    assert.equal(fetchCalls[0].init?.method, 'GET');
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
        status: 204,
      } as Response;
    };

    await deleteWorkspaceFile({
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

  test('surfaces backend delete error messages when available', async () => {
    const fakeFetch = async () =>
      ({
        ok: false,
        status: 404,
        json: async () => ({ message: 'File not found: index2.html' }),
      }) as unknown as Response;

    await assert.rejects(
      deleteWorkspaceFile({
        sessionId: 'session-del',
        filePath: 'index2.html',
        fetchImpl: fakeFetch as typeof fetch,
      }),
      /File not found: index2\.html/,
    );
  });

  test('falls back to generic delete error when backend body is not json', async () => {
    const fakeFetch = async () =>
      ({
        ok: false,
        status: 404,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON');
        },
      }) as unknown as Response;

    await assert.rejects(
      deleteWorkspaceFile({
        sessionId: 'session-del',
        filePath: 'index2.html',
        fetchImpl: fakeFetch as typeof fetch,
      }),
      /File delete failed \(404\)/,
    );
  });

  test('searches workspace files using existing session-scoped search endpoint', async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    const fakeFetch = async (url: string | URL, init?: RequestInit) => {
      fetchCalls.push({ url: String(url), init });
      return {
        ok: true,
        json: async () => ({
          query: 'login',
          results: [{ path: 'src/app.ts', line: 12, preview: 'const login = true;' }],
          truncated: false,
        }),
      } as Response;
    };

    const result = await searchWorkspaceFiles({
      sessionId: 'session-search',
      query: 'login',
      fetchImpl: fakeFetch as typeof fetch,
    });

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, '/api/sessions/session-search/files/search');
    assert.equal(fetchCalls[0].init?.method, 'POST');
    assert.equal(
      (fetchCalls[0].init?.headers as Record<string, string>)['Content-Type'],
      'application/json',
    );
    assert.equal(fetchCalls[0].init?.body, JSON.stringify({ query: 'login' }));
    assert.equal(result.results[0]?.path, 'src/app.ts');
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

  test('filters internal .git entries from the user-facing file tree across refresh loads', async () => {
    const fetchCalls: string[] = [];
    const fakeFetch = async (url: string | URL) => {
      const urlString = String(url);
      fetchCalls.push(urlString);

      if (urlString.includes('/list?path=%2F')) {
        return {
          ok: true,
          json: async () =>
            [
              { name: '.git', path: '.git', type: 'directory', size: 0, modified: '2026-05-05' },
              {
                name: '.git/index',
                path: '.git/index',
                type: 'file',
                size: 64,
                modified: '2026-05-05',
              },
              {
                name: 'components',
                path: 'components',
                type: 'directory',
                size: 0,
                modified: '2026-05-05',
              },
              {
                name: 'hello-ai-test.txt',
                path: 'hello-ai-test.txt',
                type: 'file',
                size: 20,
                modified: '2026-05-05',
              },
              {
                name: 'index.html',
                path: 'index.html',
                type: 'file',
                size: 100,
                modified: '2026-05-05',
              },
              {
                name: 'page2.html',
                path: 'page2.html',
                type: 'file',
                size: 100,
                modified: '2026-05-05',
              },
              {
                name: 'style.css',
                path: 'style.css',
                type: 'file',
                size: 100,
                modified: '2026-05-05',
              },
            ] satisfies WorkspaceFileEntry[],
        } as Response;
      }

      if (urlString.includes('/list?path=components%2Fnested')) {
        return {
          ok: true,
          json: async () =>
            [
              {
                name: 'keep-me.ts',
                path: 'components/nested/keep-me.ts',
                type: 'file',
                size: 50,
                modified: '2026-05-05',
              },
            ] satisfies WorkspaceFileEntry[],
        } as Response;
      }

      if (urlString.includes('/list?path=components')) {
        return {
          ok: true,
          json: async () =>
            [
              {
                name: 'nested',
                path: 'components/nested',
                type: 'directory',
                size: 0,
                modified: '2026-05-05',
              },
            ] satisfies WorkspaceFileEntry[],
        } as Response;
      }

      if (urlString.includes('/list?path=.git')) {
        return {
          ok: true,
          json: async () =>
            [
              {
                name: 'hooks',
                path: '.git/hooks',
                type: 'directory',
                size: 0,
                modified: '2026-05-05',
              },
              {
                name: 'objects',
                path: '.git/objects',
                type: 'directory',
                size: 0,
                modified: '2026-05-05',
              },
            ] satisfies WorkspaceFileEntry[],
        } as Response;
      }

      throw new Error(`Unhandled URL: ${urlString}`);
    };

    const tree = await loadWorkspaceFileTree({
      sessionId: 'session-tree',
      fetchImpl: fakeFetch as typeof fetch,
    });

    assert.deepEqual(
      tree.map((node) => node.path),
      ['components', 'hello-ai-test.txt', 'index.html', 'page2.html', 'style.css'],
    );
    assert.equal(tree[0]?.children[0]?.path, 'components/nested');
    assert.equal(tree[0]?.children[0]?.children[0]?.path, 'components/nested/keep-me.ts');
    assert.equal(tree.some((node) => node.path === '.git' || node.path.startsWith('.git/')), false);
    assert.equal(fetchCalls.some((url) => url.includes('/list?path=.git')), false);
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
