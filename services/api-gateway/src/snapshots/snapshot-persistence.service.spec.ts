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
});
