import {
  createReadFileHandler,
  createListFilesHandler,
  createWriteFileHandler,
  createDeleteFileHandler,
  validateAndNormalizePath,
} from './file-tool-handlers';

describe('validateAndNormalizePath', () => {
  it('rejects undefined path', () => {
    expect(() => validateAndNormalizePath(undefined)).toThrow('path is required');
  });

  it('rejects empty string path', () => {
    expect(() => validateAndNormalizePath('')).toThrow('path is required');
  });

  it('rejects whitespace-only path', () => {
    expect(() => validateAndNormalizePath('   ')).toThrow('path is required');
  });

  it('rejects path with .. traversal', () => {
    expect(() => validateAndNormalizePath('../etc/passwd')).toThrow('unsafe traversal');
  });

  it('rejects path with embedded .. traversal', () => {
    expect(() => validateAndNormalizePath('src/../../etc/passwd')).toThrow('unsafe traversal');
  });

  it('rejects path with backslash .. traversal', () => {
    expect(() => validateAndNormalizePath('src\\..\\..\\etc')).toThrow('unsafe traversal');
  });

  it('normalizes leading slash', () => {
    expect(validateAndNormalizePath('/src/app.ts')).toBe('src/app.ts');
  });

  it('returns relative path unchanged', () => {
    expect(validateAndNormalizePath('src/app.ts')).toBe('src/app.ts');
  });

  it('returns root indicator for lone slash', () => {
    expect(validateAndNormalizePath('/')).toBe('/');
  });

  it('trims whitespace', () => {
    expect(validateAndNormalizePath('  src/app.ts  ')).toBe('src/app.ts');
  });
});

describe('createReadFileHandler', () => {
  const mockClient = {
    readWorkspaceFile: jest.fn(),
    listWorkspaceDirectory: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls client.readWorkspaceFile with sessionId and normalized path', async () => {
    mockClient.readWorkspaceFile.mockResolvedValue({
      path: 'src/app.ts',
      content: 'const x = 1;',
    });

    const handler = createReadFileHandler({
      client: mockClient,
      sessionId: 'sess-1',
      maxFileReadBytes: 262144,
    });

    const result = await handler({ path: '/src/app.ts' });

    expect(mockClient.readWorkspaceFile).toHaveBeenCalledWith('sess-1', 'src/app.ts');
    expect(result).toEqual({ content: 'const x = 1;', truncated: false });
  });

  it('rejects missing path argument', async () => {
    const handler = createReadFileHandler({
      client: mockClient,
      sessionId: 'sess-1',
      maxFileReadBytes: 262144,
    });

    await expect(handler({})).rejects.toThrow('path is required');
  });

  it('rejects path traversal', async () => {
    const handler = createReadFileHandler({
      client: mockClient,
      sessionId: 'sess-1',
      maxFileReadBytes: 262144,
    });

    await expect(handler({ path: '../secret' })).rejects.toThrow('unsafe traversal');
  });

  it('truncates content exceeding maxFileReadBytes', async () => {
    const largeContent = 'x'.repeat(300);
    mockClient.readWorkspaceFile.mockResolvedValue({
      path: 'big.txt',
      content: largeContent,
    });

    const handler = createReadFileHandler({
      client: mockClient,
      sessionId: 'sess-1',
      maxFileReadBytes: 100,
    });

    const result = await handler({ path: 'big.txt' }) as { content: string; truncated: boolean };

    expect(result.truncated).toBe(true);
    expect(result.content).toContain('[...truncated at 100 bytes]');
    expect(Buffer.byteLength(result.content, 'utf-8')).toBeLessThan(
      Buffer.byteLength(largeContent, 'utf-8'),
    );
  });

  it('does not truncate content within limit', async () => {
    mockClient.readWorkspaceFile.mockResolvedValue({
      path: 'small.txt',
      content: 'hello',
    });

    const handler = createReadFileHandler({
      client: mockClient,
      sessionId: 'sess-1',
      maxFileReadBytes: 262144,
    });

    const result = await handler({ path: 'small.txt' }) as { content: string; truncated: boolean };

    expect(result.truncated).toBe(false);
    expect(result.content).toBe('hello');
  });

  it('propagates upstream errors', async () => {
    mockClient.readWorkspaceFile.mockRejectedValue(new Error('File not found'));

    const handler = createReadFileHandler({
      client: mockClient,
      sessionId: 'sess-1',
      maxFileReadBytes: 262144,
    });

    await expect(handler({ path: 'missing.ts' })).rejects.toThrow('File not found');
  });
});

describe('createListFilesHandler', () => {
  const mockClient = {
    readWorkspaceFile: jest.fn(),
    listWorkspaceDirectory: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls client.listWorkspaceDirectory with sessionId and path', async () => {
    mockClient.listWorkspaceDirectory.mockResolvedValue({
      path: 'src',
      entries: [
        { name: 'app.ts', type: 'file', size: 100, modifiedAt: '2026-01-01T00:00:00Z' },
        { name: 'components', type: 'dir', size: 0, modifiedAt: '2026-01-01T00:00:00Z' },
      ],
    });

    const handler = createListFilesHandler({
      client: mockClient,
      sessionId: 'sess-1',
    });

    const result = await handler({ path: 'src' }) as { files: string[] };

    expect(mockClient.listWorkspaceDirectory).toHaveBeenCalledWith('sess-1', 'src');
    expect(result.files).toEqual(['app.ts', 'components/']);
  });

  it('defaults to root when path is not provided', async () => {
    mockClient.listWorkspaceDirectory.mockResolvedValue({
      path: '/',
      entries: [],
    });

    const handler = createListFilesHandler({
      client: mockClient,
      sessionId: 'sess-1',
    });

    await handler({});

    expect(mockClient.listWorkspaceDirectory).toHaveBeenCalledWith('sess-1', '/');
  });

  it('rejects path traversal', async () => {
    const handler = createListFilesHandler({
      client: mockClient,
      sessionId: 'sess-1',
    });

    await expect(handler({ path: '../' })).rejects.toThrow('unsafe traversal');
  });

  it('appends / suffix for directory entries', async () => {
    mockClient.listWorkspaceDirectory.mockResolvedValue({
      path: '/',
      entries: [
        { name: 'docs', type: 'dir', size: 0, modifiedAt: '2026-01-01T00:00:00Z' },
        { name: 'README.md', type: 'file', size: 50, modifiedAt: '2026-01-01T00:00:00Z' },
      ],
    });

    const handler = createListFilesHandler({
      client: mockClient,
      sessionId: 'sess-1',
    });

    const result = await handler({}) as { files: string[] };

    expect(result.files).toEqual(['docs/', 'README.md']);
  });

  it('propagates upstream errors', async () => {
    mockClient.listWorkspaceDirectory.mockRejectedValue(
      new Error('Directory not found'),
    );

    const handler = createListFilesHandler({
      client: mockClient,
      sessionId: 'sess-1',
    });

    await expect(handler({ path: 'nonexistent' })).rejects.toThrow(
      'Directory not found',
    );
  });
});

describe('createWriteFileHandler', () => {
  const mockClient = {
    readWorkspaceFile: jest.fn(),
    listWorkspaceDirectory: jest.fn(),
    writeWorkspaceFile: jest.fn(),
    deleteWorkspaceFile: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls client.writeWorkspaceFile with sessionId, normalized path, and content', async () => {
    mockClient.writeWorkspaceFile.mockResolvedValue(undefined);

    const handler = createWriteFileHandler({
      client: mockClient,
      sessionId: 'sess-1',
      maxFileWriteBytes: 131072,
    });

    const result = await handler({ path: '/src/app.ts', content: 'const x = 1;' });

    expect(mockClient.writeWorkspaceFile).toHaveBeenCalledWith('sess-1', 'src/app.ts', 'const x = 1;');
    expect(result).toEqual({
      ok: true,
      path: 'src/app.ts',
      bytesWritten: Buffer.byteLength('const x = 1;', 'utf-8'),
    });
  });

  it('rejects missing path argument', async () => {
    const handler = createWriteFileHandler({
      client: mockClient,
      sessionId: 'sess-1',
      maxFileWriteBytes: 131072,
    });

    await expect(handler({ content: 'data' })).rejects.toThrow('path is required');
  });

  it('rejects path traversal', async () => {
    const handler = createWriteFileHandler({
      client: mockClient,
      sessionId: 'sess-1',
      maxFileWriteBytes: 131072,
    });

    await expect(handler({ path: '../etc/passwd', content: 'bad' })).rejects.toThrow('unsafe traversal');
  });

  it('rejects missing content argument', async () => {
    const handler = createWriteFileHandler({
      client: mockClient,
      sessionId: 'sess-1',
      maxFileWriteBytes: 131072,
    });

    await expect(handler({ path: 'file.ts' })).rejects.toThrow('content is required');
  });

  it('rejects non-string content argument', async () => {
    const handler = createWriteFileHandler({
      client: mockClient,
      sessionId: 'sess-1',
      maxFileWriteBytes: 131072,
    });

    await expect(handler({ path: 'file.ts', content: 42 })).rejects.toThrow('content is required');
  });

  it('rejects content exceeding maxFileWriteBytes', async () => {
    const handler = createWriteFileHandler({
      client: mockClient,
      sessionId: 'sess-1',
      maxFileWriteBytes: 10,
    });

    await expect(
      handler({ path: 'file.ts', content: 'x'.repeat(20) }),
    ).rejects.toThrow('exceeds maximum write size');
  });

  it('accepts content at exactly maxFileWriteBytes', async () => {
    mockClient.writeWorkspaceFile.mockResolvedValue(undefined);
    const content = 'x'.repeat(10);

    const handler = createWriteFileHandler({
      client: mockClient,
      sessionId: 'sess-1',
      maxFileWriteBytes: 10,
    });

    const result = await handler({ path: 'file.ts', content });

    expect(result).toEqual({ ok: true, path: 'file.ts', bytesWritten: 10 });
  });

  it('propagates upstream errors as typed tool errors', async () => {
    mockClient.writeWorkspaceFile.mockRejectedValue(new Error('Container write failed'));

    const handler = createWriteFileHandler({
      client: mockClient,
      sessionId: 'sess-1',
      maxFileWriteBytes: 131072,
    });

    await expect(handler({ path: 'file.ts', content: 'data' })).rejects.toThrow(
      'Container write failed',
    );
  });
});

describe('createDeleteFileHandler', () => {
  const mockClient = {
    readWorkspaceFile: jest.fn(),
    listWorkspaceDirectory: jest.fn(),
    writeWorkspaceFile: jest.fn(),
    deleteWorkspaceFile: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls client.deleteWorkspaceFile with sessionId and normalized path', async () => {
    mockClient.deleteWorkspaceFile.mockResolvedValue(undefined);

    const handler = createDeleteFileHandler({
      client: mockClient,
      sessionId: 'sess-1',
    });

    const result = await handler({ path: '/src/old.ts' });

    expect(mockClient.deleteWorkspaceFile).toHaveBeenCalledWith('sess-1', 'src/old.ts');
    expect(result).toEqual({ ok: true, path: 'src/old.ts' });
  });

  it('rejects path traversal', async () => {
    const handler = createDeleteFileHandler({
      client: mockClient,
      sessionId: 'sess-1',
    });

    await expect(handler({ path: '../etc/passwd' })).rejects.toThrow('unsafe traversal');
  });

  it('rejects root path "."', async () => {
    const handler = createDeleteFileHandler({
      client: mockClient,
      sessionId: 'sess-1',
    });

    await expect(handler({ path: '.' })).rejects.toThrow('unsafe: root');
  });

  it('rejects workspace-root path "/"', async () => {
    const handler = createDeleteFileHandler({
      client: mockClient,
      sessionId: 'sess-1',
    });

    await expect(handler({ path: '/' })).rejects.toThrow('unsafe: root');
  });

  it('rejects glob-like path with wildcard', async () => {
    const handler = createDeleteFileHandler({
      client: mockClient,
      sessionId: 'sess-1',
    });

    await expect(handler({ path: '*.ts' })).rejects.toThrow('glob patterns');
  });

  it('rejects glob-like path with question mark', async () => {
    const handler = createDeleteFileHandler({
      client: mockClient,
      sessionId: 'sess-1',
    });

    await expect(handler({ path: 'file?.ts' })).rejects.toThrow('glob patterns');
  });

  it('rejects directory-looking target ending in /', async () => {
    const handler = createDeleteFileHandler({
      client: mockClient,
      sessionId: 'sess-1',
    });

    await expect(handler({ path: 'src/' })).rejects.toThrow('must be a file, not a directory');
  });

  it('propagates upstream file-not-found errors', async () => {
    mockClient.deleteWorkspaceFile.mockRejectedValue(new Error('File not found'));

    const handler = createDeleteFileHandler({
      client: mockClient,
      sessionId: 'sess-1',
    });

    await expect(handler({ path: 'missing.ts' })).rejects.toThrow('File not found');
  });

  it('propagates upstream directory-delete errors', async () => {
    mockClient.deleteWorkspaceFile.mockRejectedValue(
      new Error('Directory delete is not supported'),
    );

    const handler = createDeleteFileHandler({
      client: mockClient,
      sessionId: 'sess-1',
    });

    await expect(handler({ path: 'some-dir' })).rejects.toThrow(
      'Directory delete is not supported',
    );
  });
});
