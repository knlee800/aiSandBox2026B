import { HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';

export interface WorkspaceSnapshotMetadata {
  id: string;
  userId: string;
  label: string | null;
  createdAt: string;
  fileCount: number;
}

/**
 * SNAPSHOT-BINARY-01: one file in a snapshot payload. A text file is stored as
 * before: `content` is its UTF-8 text and there is no `encoding` (snapshots
 * written before this task never have one; `'utf8'` is read the same way). A
 * file whose bytes are not plain UTF-8 text (an image, a font, anything with a
 * NUL) is stored as `content: <base64>` with `encoding: 'base64'`.
 */
interface WorkspaceSnapshotFile {
  path: string;
  content: string;
  encoding?: 'base64' | 'utf8';
}

/**
 * SNAPSHOT-BINARY-01: what restoreSnapshot returns: the snapshot's metadata
 * plus the paths of files that could not be written (empty when all were).
 * restoreSnapshot always sets it; it is optional in the type so callers and
 * typed test doubles that return plain metadata stay valid.
 */
export interface WorkspaceSnapshotRestoreResult extends WorkspaceSnapshotMetadata {
  failedPaths?: string[];
}

interface WorkspaceSnapshotPayload {
  metadata: WorkspaceSnapshotMetadata;
  files: WorkspaceSnapshotFile[];
}

// PROJ-02-03: Auto-checkpoint git internals must never enter or leave a
// workspace snapshot. They contain binary objects (e.g. .git/index has NUL
// bytes) that the env-var + `printf "%s"` write path used by container-manager
// cannot transport, which previously caused project-open restore to fail with
// HTTP 500. The git-checkpoint subsystem owns `.git/` itself, so excluding it
// here is also semantically correct.
const SNAPSHOT_EXCLUDED_PATH_PREFIXES: readonly string[] = ['.git'];

/**
 * SNAPSHOT-BINARY-01: bytes are stored as text only when they are exactly the
 * UTF-8 encoding of their own decoding (so the text write restores the same
 * bytes, a BOM included) and contain no NUL byte.
 */
function isStorableAsText(bytes: Buffer): boolean {
  if (bytes.includes(0)) {
    return false;
  }
  return Buffer.from(bytes.toString('utf8'), 'utf8').equals(bytes);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isPathExcludedFromSnapshot(workspaceRelativePath: string): boolean {
  if (!workspaceRelativePath) {
    return false;
  }
  for (const prefix of SNAPSHOT_EXCLUDED_PATH_PREFIXES) {
    if (workspaceRelativePath === prefix) {
      return true;
    }
    if (workspaceRelativePath.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  return false;
}

@Injectable()
export class SnapshotPersistenceService {
  private readonly logger = new Logger(SnapshotPersistenceService.name);
  private readonly snapshotsRootPath = path.join(
    __dirname,
    '../../../..',
    'snapshot-store',
  );

  constructor(
    private readonly containerManagerHttpClient: ContainerManagerHttpClient,
  ) {}

  async saveSnapshot(args: {
    userId: string;
    sessionId: string;
    label?: string;
  }): Promise<WorkspaceSnapshotMetadata> {
    const files = await this.collectWorkspaceFiles(args.sessionId);
    const metadata: WorkspaceSnapshotMetadata = {
      id: randomUUID(),
      userId: args.userId,
      label: args.label?.trim() ? args.label.trim() : null,
      createdAt: new Date().toISOString(),
      fileCount: files.length,
    };
    const payload: WorkspaceSnapshotPayload = {
      metadata,
      files,
    };

    await this.ensureUserSnapshotDirectory(args.userId);
    await fs.writeFile(
      this.getSnapshotDataPath(args.userId, metadata.id),
      JSON.stringify(payload),
      'utf-8',
    );
    await fs.writeFile(
      this.getSnapshotMetadataPath(args.userId, metadata.id),
      JSON.stringify(metadata),
      'utf-8',
    );

    return metadata;
  }

  async listSnapshots(userId: string): Promise<WorkspaceSnapshotMetadata[]> {
    const userDirectoryPath = this.getUserSnapshotDirectoryPath(userId);
    try {
      await fs.access(userDirectoryPath);
    } catch {
      return [];
    }

    const files = await fs.readdir(userDirectoryPath);
    const metadataFiles = files.filter((file) => file.endsWith('.meta.json'));
    const snapshots = await Promise.all(
      metadataFiles.map(async (metadataFileName) => {
        const metadataPath = path.join(userDirectoryPath, metadataFileName);
        const content = await fs.readFile(metadataPath, 'utf-8');
        return JSON.parse(content) as WorkspaceSnapshotMetadata;
      }),
    );

    return snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Clear the session workspace and write every file of the snapshot back.
   *
   * SNAPSHOT-BINARY-01: a file stored with `encoding: 'base64'` is written as
   * its exact bytes; a text file (no encoding, as in every older snapshot) is
   * written with the same text write as before. A file that cannot be written
   * no longer stops the restore: the other files are still written, and the
   * failed paths are logged (never their content) and returned in
   * `failedPaths`. A 410 (the session is gone) still stops the restore, since
   * no further write can succeed.
   */
  async restoreSnapshot(args: {
    userId: string;
    sessionId: string;
    snapshotId: string;
  }): Promise<WorkspaceSnapshotRestoreResult> {
    const payload = await this.loadSnapshotPayload(args.userId, args.snapshotId);
    await this.clearWorkspace(args.sessionId);
    const failedPaths: string[] = [];
    for (const file of payload.files) {
      // PROJ-02-03: Defensively skip `.git/` entries that exist in older
      // snapshots created before exclusion was added. Restoring them would
      // fail on the first binary file (e.g. `.git/index`) and abort the
      // whole project open with HTTP 500.
      if (isPathExcludedFromSnapshot(file.path)) {
        continue;
      }
      try {
        await this.writeSnapshotFile(args.sessionId, file);
      } catch (error: unknown) {
        if (error instanceof HttpException && error.getStatus() === 410) {
          throw error;
        }
        failedPaths.push(file.path);
        this.logger.warn(
          `Snapshot ${args.snapshotId}: could not write ${file.path} into session ${args.sessionId}: ${describeError(error)}`,
        );
      }
    }
    if (failedPaths.length > 0) {
      this.logger.warn(
        `Snapshot ${args.snapshotId} restored into session ${args.sessionId} with ${failedPaths.length} file(s) not written`,
      );
    }
    return { ...payload.metadata, failedPaths };
  }

  private async writeSnapshotFile(
    sessionId: string,
    file: WorkspaceSnapshotFile,
  ): Promise<void> {
    if (file.encoding === 'base64') {
      await this.containerManagerHttpClient.writeSessionFile(
        sessionId,
        file.path,
        file.content,
        'base64',
      );
      return;
    }
    if (file.encoding !== undefined && file.encoding !== 'utf8') {
      throw new Error(`Unsupported snapshot file encoding for ${file.path}`);
    }
    await this.containerManagerHttpClient.writeSessionFile(
      sessionId,
      file.path,
      file.content,
    );
  }

  private async clearWorkspace(sessionId: string): Promise<void> {
    await this.containerManagerHttpClient.execInSession(sessionId, [
      'sh',
      '-c',
      'find /workspace -mindepth 1 -maxdepth 1 -exec rm -rf {} +',
    ]);
  }

  private async collectWorkspaceFiles(
    sessionId: string,
  ): Promise<WorkspaceSnapshotFile[]> {
    const collectedFilePaths = await this.collectFilePathsRecursively(
      sessionId,
      '',
    );
    const files: WorkspaceSnapshotFile[] = [];
    for (const filePath of collectedFilePaths) {
      // SNAPSHOT-BINARY-01: read the exact bytes (CM-BINARY-01 base64 read)
      // and keep text files as text, binary files as base64.
      const response = await this.containerManagerHttpClient.readSessionFile(
        sessionId,
        filePath,
        { encoding: 'base64' },
      );
      files.push(this.toSnapshotFile(filePath, response));
    }
    return files;
  }

  private toSnapshotFile(
    filePath: string,
    response: { content: string; encoding?: string },
  ): WorkspaceSnapshotFile {
    if (response.encoding !== 'base64') {
      // A container-manager without the base64 read answers with text.
      return { path: filePath, content: response.content };
    }
    const bytes = Buffer.from(response.content, 'base64');
    if (isStorableAsText(bytes)) {
      return { path: filePath, content: bytes.toString('utf8') };
    }
    return { path: filePath, content: bytes.toString('base64'), encoding: 'base64' };
  }

  private async collectFilePathsRecursively(
    sessionId: string,
    directoryPath: string,
  ): Promise<string[]> {
    const listPath = directoryPath.length === 0 ? '/' : directoryPath;
    const response = await this.containerManagerHttpClient.listSessionDirectory(
      sessionId,
      listPath,
    );
    const filePaths: string[] = [];
    for (const entry of response.entries) {
      const nextPath =
        directoryPath.length === 0
          ? entry.name
          : `${directoryPath.replace(/\/$/, '')}/${entry.name}`;
      // PROJ-02-03: Skip auto-checkpoint git internals so `.git/` (which
      // contains binary objects) never enters new snapshot payloads.
      if (isPathExcludedFromSnapshot(nextPath)) {
        continue;
      }
      if (entry.type === 'dir') {
        filePaths.push(
          ...(await this.collectFilePathsRecursively(sessionId, nextPath)),
        );
      } else {
        filePaths.push(nextPath);
      }
    }
    return filePaths;
  }

  private async loadSnapshotPayload(
    userId: string,
    snapshotId: string,
  ): Promise<WorkspaceSnapshotPayload> {
    const dataPath = this.getSnapshotDataPath(userId, snapshotId);
    try {
      const content = await fs.readFile(dataPath, 'utf-8');
      return JSON.parse(content) as WorkspaceSnapshotPayload;
    } catch {
      throw new NotFoundException(`Snapshot ${snapshotId} not found`);
    }
  }

  private async ensureUserSnapshotDirectory(userId: string): Promise<void> {
    await fs.mkdir(this.getUserSnapshotDirectoryPath(userId), { recursive: true });
  }

  private getUserSnapshotDirectoryPath(userId: string): string {
    return path.join(this.snapshotsRootPath, userId);
  }

  private getSnapshotDataPath(userId: string, snapshotId: string): string {
    return path.join(
      this.getUserSnapshotDirectoryPath(userId),
      `${snapshotId}.data.json`,
    );
  }

  private getSnapshotMetadataPath(userId: string, snapshotId: string): string {
    return path.join(
      this.getUserSnapshotDirectoryPath(userId),
      `${snapshotId}.meta.json`,
    );
  }
}
