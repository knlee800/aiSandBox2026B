import { BadRequestException } from '@nestjs/common';
import { WorkspaceArchiveService } from './workspace-archive.service';

function buildZipWithSingleFile(path: string, content: string): Buffer {
  const nameBuffer = Buffer.from(path, 'utf8');
  const dataBuffer = Buffer.from(content, 'utf8');

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
      'console.log("ok");',
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
});
