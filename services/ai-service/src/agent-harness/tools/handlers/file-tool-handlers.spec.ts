import {
  createReadFileHandler,
  createListFilesHandler,
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
