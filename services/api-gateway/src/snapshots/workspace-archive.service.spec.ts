import { BadRequestException } from '@nestjs/common';
import { WorkspaceArchiveService } from './workspace-archive.service';

function buildZipWithSingleFile(path: string, content: string): Buffer {
  return buildZipWithBytes(path, Buffer.from(content, 'utf8'));
}

function buildZipWithBytes(path: string, dataBuffer: Buffer): Buffer {
  const nameBuffer = Buffer.from(path, 'utf8');

  const localHeader = Buffer.alloc(30 + nameBuffer.length);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  localHeader.writeUInt32LE(0, 14);
  localHeader.writeUInt32LE(dataBuffer.length, 18);
  localHeader.writeUInt32LE(dataBuffer.length, 22);
  localHeader.writeUInt16LE(nameBuffer.length, 26);
  localHeader.writeUInt16LE(0, 28);
  nameBuffer.copy(localHeader, 30);

  const central = Buffer.alloc(46 + nameBuffer.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt16LE(0, 12);
  central.writeUInt16LE(0, 14);
  central.writeUInt32LE(0, 16);
  central.writeUInt32LE(dataBuffer.length, 20);
  central.writeUInt32LE(dataBuffer.length, 24);
  central.writeUInt16LE(nameBuffer.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(0, 42);
  nameBuffer.copy(central, 46);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(localHeader.length + dataBuffer.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localHeader, dataBuffer, central, eocd]);
}

describe('WorkspaceArchiveService (PR-02-01)', () => {
  const containerManagerHttpClient = {
    listSessionDirectory: jest.fn(),
    readSessionFile: jest.fn(),
    writeSessionFile: jest.fn(),
    execInSession: jest.fn(),
  };

  let service: WorkspaceArchiveService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new WorkspaceArchiveService(containerManagerHttpClient as any);
  });

  it('exports workspace files as a zip buffer', async () => {
    containerManagerHttpClient.listSessionDirectory
      .mockResolvedValueOnce({
        path: '/',
        entries: [{ name: 'README.md', type: 'file', size: 10, modifiedAt: 'x' }],
      });
    containerManagerHttpClient.readSessionFile.mockResolvedValue({
      path: 'README.md',
      content: '# hello',
    });

    const archive = await service.exportWorkspaceArchive('session-1');
    expect(Buffer.isBuffer(archive)).toBe(true);
    expect(archive.byteLength).toBeGreaterThan(0);
  });

  it('exports nested directories using workspace-relative recursion paths', async () => {
    containerManagerHttpClient.listSessionDirectory
      .mockResolvedValueOnce({
        path: '/',
        entries: [{ name: 'src', type: 'dir', size: 0, modifiedAt: 'x' }],
      })
      .mockResolvedValueOnce({
        path: 'src',
        entries: [{ name: 'app.ts', type: 'file', size: 14, modifiedAt: 'x' }],
      });
    containerManagerHttpClient.readSessionFile.mockResolvedValue({
      path: 'src/app.ts',
      content: 'console.log(1)',
    });

    const archive = await service.exportWorkspaceArchive('session-1');

    expect(Buffer.isBuffer(archive)).toBe(true);
    expect(containerManagerHttpClient.listSessionDirectory).toHaveBeenNthCalledWith(
      1,
      'session-1',
      '/',
    );
    expect(containerManagerHttpClient.listSessionDirectory).toHaveBeenNthCalledWith(
      2,
      'session-1',
      'src',
    );
    expect(containerManagerHttpClient.readSessionFile).toHaveBeenCalledWith(
      'session-1',
      'src/app.ts',
      { encoding: 'base64' },
    );
  });

  it('imports a valid zip archive into workspace', async () => {
    const archive = buildZipWithSingleFile('src/app.ts', 'console.log("ok");');

    const result = await service.importWorkspaceArchive('session-1', archive);

    expect(containerManagerHttpClient.execInSession).toHaveBeenCalledWith(
      'session-1',
      ['sh', '-c', 'find /workspace -mindepth 1 -maxdepth 1 -exec rm -rf {} +'],
    );
    expect(containerManagerHttpClient.writeSessionFile).toHaveBeenCalledWith(
      'session-1',
      'src/app.ts',
      Buffer.from('console.log("ok");', 'utf8').toString('base64'),
      'base64',
    );
    expect(result.importedFileCount).toBe(1);
  });

  it('rejects malformed archive input', async () => {
    await expect(
      service.importWorkspaceArchive('session-1', Buffer.from('not-a-zip')),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects unsafe archive paths', async () => {
    const archive = buildZipWithSingleFile('../escape.txt', 'bad');

    await expect(
      service.importWorkspaceArchive('session-1', archive),
    ).rejects.toThrow(BadRequestException);
  });

  describe('binary-safe round trip (ARCHIVE-BINARY-01)', () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0xff, 0xfe, 0x00, 0xff, 0x80, 0x81,
    ]);

    function mockWorkspace(files: Record<string, Buffer>) {
      containerManagerHttpClient.listSessionDirectory.mockResolvedValueOnce({
        path: '/',
        entries: Object.keys(files).map((name) => ({
          name,
          type: 'file',
          size: files[name].length,
          modifiedAt: 'x',
        })),
      });
      containerManagerHttpClient.readSessionFile.mockImplementation(
        async (_sid: string, path: string) => ({
          path,
          content: files[path].toString('base64'),
          encoding: 'base64',
        }),
      );
    }

    it('round-trips a PNG and a text file byte for byte', async () => {
      const text = Buffer.from('# hello\n', 'utf8');
      mockWorkspace({ 'logo.png': png, 'README.md': text });

      const archive = await service.exportWorkspaceArchive('session-1');
      await service.importWorkspaceArchive('session-2', archive);

      const written = new Map<string, Buffer>();
      for (const call of containerManagerHttpClient.writeSessionFile.mock.calls) {
        const [, path, content, encoding] = call;
        expect(encoding).toBe('base64');
        written.set(path, Buffer.from(content, 'base64'));
      }
      expect(written.get('logo.png')?.equals(png)).toBe(true);
      expect(written.get('README.md')?.equals(text)).toBe(true);
    });

    it('falls back to text when the container manager answers without base64', async () => {
      containerManagerHttpClient.listSessionDirectory.mockResolvedValueOnce({
        path: '/',
        entries: [{ name: 'a.txt', type: 'file', size: 2, modifiedAt: 'x' }],
      });
      containerManagerHttpClient.readSessionFile.mockResolvedValue({
        path: 'a.txt',
        content: 'hé',
      });
      const archive = await service.exportWorkspaceArchive('session-1');
      await service.importWorkspaceArchive('session-2', archive);
      const [, , content] = containerManagerHttpClient.writeSessionFile.mock.calls[0];
      expect(Buffer.from(content, 'base64').toString('utf8')).toBe('hé');
    });

    it('imports a non-UTF-8 zip entry byte for byte without rejecting it', async () => {
      const raw = Buffer.from([0xff, 0xfe, 0x00, 0x80, 0xc3, 0x28]);

      await service.importWorkspaceArchive(
        'session-1',
        buildZipWithBytes('blob.bin', raw),
      );

      const [, path, content, encoding] =
        containerManagerHttpClient.writeSessionFile.mock.calls[0];
      expect(path).toBe('blob.bin');
      expect(encoding).toBe('base64');
      expect(Buffer.from(content, 'base64').equals(raw)).toBe(true);
    });
  });
});
