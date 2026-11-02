import type { ToolHandler } from './tool-dispatcher';
import {
  createToolProgressWrapper,
  toolProgressTarget,
} from './tool-progress';

const FILE_CONTENT = 'SECRET_FILE_BODY_7f3a';

describe('toolProgressTarget', () => {
  it('returns the path, query, command, or url for each known tool', () => {
    expect(toolProgressTarget('list_files', { path: 'src' })).toBe('src');
    expect(toolProgressTarget('read_file', { path: 'src/app.ts' })).toBe(
      'src/app.ts',
    );
    expect(
      toolProgressTarget('write_file', {
        path: 'src/note.txt',
        content: FILE_CONTENT,
      }),
    ).toBe('src/note.txt');
    expect(toolProgressTarget('delete_file', { path: 'src/old.ts' })).toBe(
      'src/old.ts',
    );
    expect(toolProgressTarget('search_workspace', { query: 'token' })).toBe(
      'token',
    );
    expect(toolProgressTarget('run_validation', { command: 'npm test' })).toBe(
      'npm test',
    );
    expect(
      toolProgressTarget('browser_smoke', { url: 'http://127.0.0.1:3000' }),
    ).toBe('http://127.0.0.1:3000');
  });

  it('returns undefined for an unknown tool or a non-string value', () => {
    expect(toolProgressTarget('start_preview', { path: 'src' })).toBeUndefined();
    expect(toolProgressTarget('read_file', { path: 12 })).toBeUndefined();
    expect(toolProgressTarget('read_file', {})).toBeUndefined();
    expect(toolProgressTarget('search_workspace', { query: null })).toBeUndefined();
    expect(
      toolProgressTarget('run_validation', { command: { cmd: 'npm test' } }),
    ).toBeUndefined();
    expect(toolProgressTarget('browser_smoke', { url: undefined })).toBeUndefined();
  });

  it('cuts the target to 200 characters', () => {
    const longPath = `dir/${'a'.repeat(210)}`;
    const target = toolProgressTarget('read_file', { path: longPath });
    expect(target).toBe(longPath.slice(0, 200));
    expect(target).toHaveLength(200);
    expect(toolProgressTarget('list_files', { path: 'b'.repeat(200) })).toBe(
      'b'.repeat(200),
    );
  });
});

describe('createToolProgressWrapper', () => {
  it('publishes only the path for write_file and never the file content', async () => {
    let contentReads = 0;
    const args = {
      path: 'src/note.txt',
      get content() {
        contentReads += 1;
        return FILE_CONTENT;
      },
    };
    const publish = jest.fn();
    const wrap = createToolProgressWrapper(publish);
    const handler = jest.fn(async () => ({ ok: true }));

    await wrap('write_file', handler)(args);

    expect(handler).toHaveBeenCalledWith(args, undefined);
    expect(contentReads).toBe(0);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith({
      step: 1,
      tool: 'write_file',
      target: 'src/note.txt',
    });
    expect(JSON.stringify(publish.mock.calls)).not.toContain(FILE_CONTENT);
  });

  it('counts steps across different tools', async () => {
    const publish = jest.fn();
    const wrap = createToolProgressWrapper(publish);
    const readFile = wrap('read_file', async () => ({ kind: 'read' }));
    const listFiles = wrap('list_files', async () => ({ kind: 'list' }));

    await readFile({ path: 'a.ts' });
    await listFiles({ path: 'src' });
    await readFile({ path: 'b.ts' });

    expect(publish).toHaveBeenNthCalledWith(1, {
      step: 1,
      tool: 'read_file',
      target: 'a.ts',
    });
    expect(publish).toHaveBeenNthCalledWith(2, {
      step: 2,
      tool: 'list_files',
      target: 'src',
    });
    expect(publish).toHaveBeenNthCalledWith(3, {
      step: 3,
      tool: 'read_file',
      target: 'b.ts',
    });
  });

  it('passes the handler result and arguments through', async () => {
    const publish = jest.fn();
    const wrap = createToolProgressWrapper(publish);
    const signal = new AbortController().signal;
    const args = { path: 'src/app.ts', extra: 1 };
    const handler = jest.fn(async (receivedArgs, receivedSignal) => ({
      receivedArgs,
      sameSignal: receivedSignal === signal,
    }));

    await expect(wrap('read_file', handler)(args, signal)).resolves.toEqual({
      receivedArgs: args,
      sameSignal: true,
    });
    expect(handler).toHaveBeenCalledWith(args, signal);
  });

  it('lets handler errors reach the caller', async () => {
    const wrap = createToolProgressWrapper(jest.fn());
    const rejecting: ToolHandler = async () => {
      throw new Error('tool failed');
    };
    const throwing: ToolHandler = () => {
      throw new Error('tool threw');
    };

    await expect(wrap('read_file', rejecting)({ path: 'a.ts' })).rejects.toThrow(
      'tool failed',
    );
    expect(() => wrap('list_files', throwing)({ path: 'src' })).toThrow(
      'tool threw',
    );
  });

  it('leaves the tool result intact when publish throws or rejects', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);

    try {
      const throwing = createToolProgressWrapper(() => {
        throw new Error('publish boom');
      });
      await expect(
        throwing(
          'read_file',
          async () => ({ ok: true, from: 'throw' }),
        )({ path: 'a.ts' }),
      ).resolves.toEqual({ ok: true, from: 'throw' });

      const rejecting = createToolProgressWrapper(() =>
        Promise.reject(new Error('publish reject')),
      );
      await expect(
        rejecting(
          'list_files',
          async () => ({ ok: true, from: 'reject' }),
        )({ path: 'src' }),
      ).resolves.toEqual({ ok: true, from: 'reject' });

      let resolvePublish: (value: number) => void = () => undefined;
      const hanging = createToolProgressWrapper(
        () =>
          new Promise<number>((resolve) => {
            resolvePublish = resolve;
          }),
      );
      await expect(
        hanging(
          'search_workspace',
          async () => ({ ok: true, from: 'hang' }),
        )({ query: 'token' }),
      ).resolves.toEqual({ ok: true, from: 'hang' });
      resolvePublish(1);

      await new Promise((resolve) => setImmediate(resolve));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
