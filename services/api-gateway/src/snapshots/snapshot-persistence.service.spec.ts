import { HttpException, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SnapshotPersistenceService } from './snapshot-persistence.service';

describe('SnapshotPersistenceService (PR-01-01)', () => {
  const userId = 'user-pr-01-01-spec';
  const snapshotsRoot = path.join(__dirname, '../../../..', 'snapshot-store', userId);

  const containerManagerHttpClient = {
    listSessionDirectory: jest.fn(),
    readSessionFile: jest.fn(),
    writeSessionFile: jest.fn(),
    execInSession: jest.fn(),
  };

  let service: SnapshotPersistenceService;

  beforeEach(async () => {
    jest.resetAllMocks();
    service = new SnapshotPersistenceService(
      containerManagerHttpClient as any,
    );
    await fs.rm(snapshotsRoot, { recursive: true, force: true });
  });

  afterAll(async () => {
    await fs.rm(snapshotsRoot, { recursive: true, force: true });
  });

  it('saveSnapshot persists metadata and durable payload', async () => {
    containerManagerHttpClient.listSessionDirectory
      .mockResolvedValueOnce({
        path: '/',
        entries: [{ name: 'README.md', type: 'file', size: 11, modifiedAt: new Date().toISOString() }],
      });
    containerManagerHttpClient.readSessionFile.mockResolvedValue({
      path: 'README.md',
      content: '# hello',
    });

    const metadata = await service.saveSnapshot({
      userId,
      sessionId: 'session-1',
      label: 'first',
    });

    expect(metadata.userId).toBe(userId);
    expect(metadata.fileCount).toBe(1);
    expect(metadata.label).toBe('first');

    const list = await service.listSnapshots(userId);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(metadata.id);
  });

  it('restoreSnapshot clears workspace then writes snapshot files', async () => {
    containerManagerHttpClient.listSessionDirectory.mockResolvedValue({
      path: '/',
      entries: [{ name: 'app.ts', type: 'file', size: 1, modifiedAt: new Date().toISOString() }],
    });
    containerManagerHttpClient.readSessionFile.mockResolvedValue({
      path: 'app.ts',
      content: 'a',
    });

    const metadata = await service.saveSnapshot({
      userId,
      sessionId: 'session-1',
      label: undefined,
    });

    await service.restoreSnapshot({
      userId,
      sessionId: 'session-restore',
      snapshotId: metadata.id,
    });

    expect(containerManagerHttpClient.execInSession).toHaveBeenCalledWith(
      'session-restore',
      ['sh', '-c', 'find /workspace -mindepth 1 -maxdepth 1 -exec rm -rf {} +'],
    );
    expect(containerManagerHttpClient.writeSessionFile).toHaveBeenCalledWith(
      'session-restore',
      'app.ts',
      'a',
    );
  });

  it('saveSnapshot excludes the auto-checkpoint .git directory from the snapshot payload (PROJ-02-03)', async () => {
    containerManagerHttpClient.listSessionDirectory.mockResolvedValueOnce({
      path: '/',
      entries: [
        { name: '.git', type: 'dir', size: 0, modifiedAt: new Date().toISOString() },
        { name: 'README.md', type: 'file', size: 11, modifiedAt: new Date().toISOString() },
      ],
    });
    containerManagerHttpClient.readSessionFile.mockResolvedValueOnce({
      path: 'README.md',
      content: '# hello',
    });

    const metadata = await service.saveSnapshot({
      userId,
      sessionId: 'session-1',
      label: 'post-checkpoint',
    });

    expect(containerManagerHttpClient.listSessionDirectory).toHaveBeenCalledTimes(1);
    expect(containerManagerHttpClient.listSessionDirectory).toHaveBeenNthCalledWith(
      1,
      'session-1',
      '/',
    );
    expect(containerManagerHttpClient.readSessionFile).toHaveBeenCalledTimes(1);
    // SNAPSHOT-BINARY-01: files are read as exact bytes (base64 read).
    expect(containerManagerHttpClient.readSessionFile).toHaveBeenCalledWith(
      'session-1',
      'README.md',
      { encoding: 'base64' },
    );
    expect(containerManagerHttpClient.readSessionFile).not.toHaveBeenCalledWith(
      'session-1',
      '.git/HEAD',
      expect.anything(),
    );
    expect(metadata.fileCount).toBe(1);
  });

  it('restoreSnapshot skips legacy .git/ entries already present in older snapshots (PROJ-02-03)', async () => {
    const dataPath = path.join(snapshotsRoot, 'legacy-snap.data.json');
    const metaPath = path.join(snapshotsRoot, 'legacy-snap.meta.json');
    await fs.mkdir(snapshotsRoot, { recursive: true });
    const legacyMetadata = {
      id: 'legacy-snap',
      userId,
      label: null,
      createdAt: new Date().toISOString(),
      fileCount: 3,
    };
    const legacyPayload = {
      metadata: legacyMetadata,
      files: [
        { path: 'app.ts', content: 'a' },
        { path: '.git/HEAD', content: 'ref: refs/heads/main' },
        // Simulated binary git index that would otherwise crash the write path
        { path: '.git/index', content: 'DIRC\u0000\u0000\u0000binary-bytes' },
      ],
    };
    await fs.writeFile(dataPath, JSON.stringify(legacyPayload), 'utf-8');
    await fs.writeFile(metaPath, JSON.stringify(legacyMetadata), 'utf-8');

    await service.restoreSnapshot({
      userId,
      sessionId: 'session-restore',
      snapshotId: 'legacy-snap',
    });

    expect(containerManagerHttpClient.execInSession).toHaveBeenCalledWith(
      'session-restore',
      ['sh', '-c', 'find /workspace -mindepth 1 -maxdepth 1 -exec rm -rf {} +'],
    );
    expect(containerManagerHttpClient.writeSessionFile).toHaveBeenCalledTimes(1);
    expect(containerManagerHttpClient.writeSessionFile).toHaveBeenCalledWith(
      'session-restore',
      'app.ts',
      'a',
    );
    expect(containerManagerHttpClient.writeSessionFile).not.toHaveBeenCalledWith(
      'session-restore',
      '.git/HEAD',
      expect.anything(),
    );
    expect(containerManagerHttpClient.writeSessionFile).not.toHaveBeenCalledWith(
      'session-restore',
      '.git/index',
      expect.anything(),
    );
  });

  describe('binary-safe snapshots (SNAPSHOT-BINARY-01)', () => {
    // A PNG-like file: signature, NUL bytes, high bytes.
    const PNG = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0xff, 0xfe, 0x80]),
    ]);
    // A font-like file: an OTF/TTF header and a byte table without NUL that is
    // still not valid UTF-8.
    const FONT = Buffer.concat([
      Buffer.from([0x00, 0x01, 0x00, 0x00, 0x00, 0x0a, 0x00, 0x80]),
      Buffer.from(Array.from({ length: 128 }, (_value, index) => 0x80 + index)),
    ]);
    const NO_NUL_NOT_UTF8 = Buffer.from([0x41, 0xc3, 0x28, 0x42, 0xff]);
    const TEXT = 'export const greeting = "héllo €";\n';
    const BOM_TEXT = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('a,b\n', 'utf8')]);

    function serveWorkspace(files: Record<string, Buffer>): void {
      containerManagerHttpClient.listSessionDirectory.mockResolvedValue({
        path: '/',
        entries: Object.keys(files).map((name) => ({
          name,
          type: 'file',
          size: files[name].length,
          modifiedAt: new Date().toISOString(),
        })),
      });
      containerManagerHttpClient.readSessionFile.mockImplementation(
        async (_sessionId: string, filePath: string, options?: { encoding?: string }) => {
          const bytes = files[filePath];
          return options?.encoding === 'base64'
            ? { path: filePath, content: bytes.toString('base64'), encoding: 'base64' }
            : { path: filePath, content: bytes.toString('utf8') };
        },
      );
    }

    async function readPayload(snapshotId: string): Promise<{
      files: Array<{ path: string; content: string; encoding?: string }>;
    }> {
      return JSON.parse(await fs.readFile(path.join(snapshotsRoot, `${snapshotId}.data.json`), 'utf-8'));
    }

    function writtenBytes(filePath: string): Buffer {
      const call = containerManagerHttpClient.writeSessionFile.mock.calls.find(
        (args: unknown[]) => args[1] === filePath,
      );
      expect(call).toBeDefined();
      const [, , content, encoding] = call as [string, string, string, string | undefined];
      return encoding === 'base64' ? Buffer.from(content, 'base64') : Buffer.from(content, 'utf8');
    }

    it('round-trips a PNG and a font byte for byte, stored as base64 with the marker', async () => {
      serveWorkspace({ 'red.png': PNG, 'font.ttf': FONT, 'odd.bin': NO_NUL_NOT_UTF8 });

      const metadata = await service.saveSnapshot({ userId, sessionId: 'session-1', label: 'binary' });
      const payload = await readPayload(metadata.id);

      expect(metadata.fileCount).toBe(3);
      for (const [filePath, bytes] of [
        ['red.png', PNG],
        ['font.ttf', FONT],
        ['odd.bin', NO_NUL_NOT_UTF8],
      ] as const) {
        const stored = payload.files.find((file) => file.path === filePath);
        expect(stored).toEqual({ path: filePath, content: bytes.toString('base64'), encoding: 'base64' });
      }

      containerManagerHttpClient.writeSessionFile.mockResolvedValue(undefined);
      const restored = await service.restoreSnapshot({
        userId,
        sessionId: 'session-restore',
        snapshotId: metadata.id,
      });

      expect(restored.failedPaths).toEqual([]);
      expect(restored.id).toBe(metadata.id);
      expect(containerManagerHttpClient.writeSessionFile).toHaveBeenCalledWith(
        'session-restore',
        'red.png',
        PNG.toString('base64'),
        'base64',
      );
      expect(writtenBytes('red.png').equals(PNG)).toBe(true);
      expect(writtenBytes('font.ttf').equals(FONT)).toBe(true);
      expect(writtenBytes('odd.bin').equals(NO_NUL_NOT_UTF8)).toBe(true);
    });

    it('stores a UTF-8 text file as text with no marker and restores it with the text write', async () => {
      serveWorkspace({ 'app.ts': Buffer.from(TEXT, 'utf8'), 'data.csv': BOM_TEXT });

      const metadata = await service.saveSnapshot({ userId, sessionId: 'session-1' });
      const payload = await readPayload(metadata.id);

      expect(payload.files).toContainEqual({ path: 'app.ts', content: TEXT });
      const csv = payload.files.find((file) => file.path === 'data.csv');
      expect(csv).toBeDefined();
      expect(csv?.encoding).toBeUndefined();
      expect(Object.keys(csv as object)).toEqual(['path', 'content']);

      await service.restoreSnapshot({ userId, sessionId: 'session-restore', snapshotId: metadata.id });

      expect(containerManagerHttpClient.writeSessionFile).toHaveBeenCalledWith(
        'session-restore',
        'app.ts',
        TEXT,
      );
      expect(containerManagerHttpClient.writeSessionFile.mock.calls.every((args: unknown[]) => args.length === 3)).toBe(
        true,
      );
      // The BOM survives: the text write restores the same bytes.
      expect(writtenBytes('data.csv').equals(BOM_TEXT)).toBe(true);
    });

    it('keeps text when container-manager answers a base64 read with text (no encoding field)', async () => {
      containerManagerHttpClient.listSessionDirectory.mockResolvedValue({
        path: '/',
        entries: [{ name: 'README.md', type: 'file', size: 7, modifiedAt: new Date().toISOString() }],
      });
      containerManagerHttpClient.readSessionFile.mockResolvedValue({ path: 'README.md', content: '# hello' });

      const metadata = await service.saveSnapshot({ userId, sessionId: 'session-1' });

      expect((await readPayload(metadata.id)).files).toEqual([{ path: 'README.md', content: '# hello' }]);
    });

    it('restores an old snapshot without any encoding field exactly as before (text writes only)', async () => {
      await fs.mkdir(snapshotsRoot, { recursive: true });
      const oldMetadata = {
        id: 'old-text-snap',
        userId,
        label: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        fileCount: 2,
      };
      await fs.writeFile(
        path.join(snapshotsRoot, 'old-text-snap.data.json'),
        JSON.stringify({
          metadata: oldMetadata,
          files: [
            { path: 'index.html', content: '<h1>hi</h1>\n' },
            { path: 'src/app.js', content: 'console.log("é");\n' },
          ],
        }),
        'utf-8',
      );
      await fs.writeFile(path.join(snapshotsRoot, 'old-text-snap.meta.json'), JSON.stringify(oldMetadata), 'utf-8');

      const restored = await service.restoreSnapshot({
        userId,
        sessionId: 'session-restore',
        snapshotId: 'old-text-snap',
      });

      expect(restored).toEqual({ ...oldMetadata, failedPaths: [] });
      expect(containerManagerHttpClient.writeSessionFile.mock.calls).toEqual([
        ['session-restore', 'index.html', '<h1>hi</h1>\n'],
        ['session-restore', 'src/app.js', 'console.log("é");\n'],
      ]);
    });

    it('a file that cannot be written does not stop the others; its path is returned and logged without content', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      serveWorkspace({ 'a.txt': Buffer.from('first\n'), 'red.png': PNG, 'z.txt': Buffer.from('last\n') });
      const metadata = await service.saveSnapshot({ userId, sessionId: 'session-1' });
      containerManagerHttpClient.writeSessionFile.mockImplementation(async (_sessionId: string, filePath: string) => {
        if (filePath === 'red.png') {
          throw new HttpException('Failed to write file to container for session session-restore', 500);
        }
      });

      try {
        const restored = await service.restoreSnapshot({
          userId,
          sessionId: 'session-restore',
          snapshotId: metadata.id,
        });

        expect(restored.failedPaths).toEqual(['red.png']);
        const writtenPaths = containerManagerHttpClient.writeSessionFile.mock.calls.map((args: unknown[]) => args[1]);
        expect(writtenPaths).toEqual(['a.txt', 'red.png', 'z.txt']);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('red.png'));
        const logged = warnSpy.mock.calls.map((args) => String(args[0])).join('\n');
        expect(logged).not.toContain(PNG.toString('base64'));
        expect(logged).not.toContain('first');
        expect(logged).not.toContain('last');
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('reports a file with an unknown encoding as failed and writes the rest', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      await fs.mkdir(snapshotsRoot, { recursive: true });
      const meta = { id: 'odd-enc-snap', userId, label: null, createdAt: '2026-01-01T00:00:00.000Z', fileCount: 2 };
      await fs.writeFile(
        path.join(snapshotsRoot, 'odd-enc-snap.data.json'),
        JSON.stringify({
          metadata: meta,
          files: [
            { path: 'weird.bin', content: '00ff', encoding: 'hex' },
            { path: 'ok.txt', content: 'ok', encoding: 'utf8' },
          ],
        }),
        'utf-8',
      );

      try {
        const restored = await service.restoreSnapshot({
          userId,
          sessionId: 'session-restore',
          snapshotId: 'odd-enc-snap',
        });

        expect(restored.failedPaths).toEqual(['weird.bin']);
        expect(containerManagerHttpClient.writeSessionFile.mock.calls).toEqual([['session-restore', 'ok.txt', 'ok']]);
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('still stops on 410 (the session is gone)', async () => {
      serveWorkspace({ 'a.txt': Buffer.from('a'), 'b.txt': Buffer.from('b') });
      const metadata = await service.saveSnapshot({ userId, sessionId: 'session-1' });
      containerManagerHttpClient.writeSessionFile.mockRejectedValue(
        new HttpException('Session session-restore is terminated', 410),
      );

      await expect(
        service.restoreSnapshot({ userId, sessionId: 'session-restore', snapshotId: metadata.id }),
      ).rejects.toMatchObject({ status: 410 });
      expect(containerManagerHttpClient.writeSessionFile).toHaveBeenCalledTimes(1);
    });
  });
});
