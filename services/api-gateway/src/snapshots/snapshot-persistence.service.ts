import { Injectable, NotFoundException } from '@nestjs/common';
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

interface WorkspaceSnapshotFile {
  path: string;
  content: string;
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

  async restoreSnapshot(args: {
    userId: string;
    sessionId: string;
    snapshotId: string;
  }): Promise<WorkspaceSnapshotMetadata> {
    const payload = await this.loadSnapshotPayload(args.userId, args.snapshotId);
    await this.clearWorkspace(args.sessionId);
    for (const file of payload.files) {
      // PROJ-02-03: Defensively skip `.git/` entries that exist in older
      // snapshots created before exclusion was added. Restoring them would
      // fail on the first binary file (e.g. `.git/index`) and abort the
      // whole project open with HTTP 500.
      if (isPathExcludedFromSnapshot(file.path)) {
        continue;
      }
      await this.containerManagerHttpClient.writeSessionFile(
        args.sessionId,
        file.path,
        file.content,
      );
    }
    return payload.metadata;
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
      const response = await this.containerManagerHttpClient.readSessionFile(
        sessionId,
        filePath,
      );
      files.push({
        path: filePath,
        content: response.content,
      });
    }
    return files;
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
