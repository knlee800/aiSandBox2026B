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
    expect(containerManagerHttpClient.readSessionFile).toHaveBeenCalledWith(
      'session-1',
      'README.md',
    );
    expect(containerManagerHttpClient.readSessionFile).not.toHaveBeenCalledWith(
      'session-1',
      '.git/HEAD',
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
});
