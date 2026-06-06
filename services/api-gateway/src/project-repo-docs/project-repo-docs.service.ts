import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectRepoDoc } from '../entities/project-repo-doc.entity';

export type ProjectRepoDocMode = 'always';

export interface ProjectRepoDocRecord {
  path: string;
  mode: ProjectRepoDocMode;
}

@Injectable()
export class ProjectRepoDocsService {
  private static readonly MAX_PATH_LENGTH = 500;

  constructor(
    @InjectRepository(ProjectRepoDoc)
    private readonly projectRepoDocRepository: Repository<ProjectRepoDoc>,
  ) {}

  async listByProjectId(projectId: string): Promise<ProjectRepoDocRecord[]> {
    const records = await this.projectRepoDocRepository.find({
      where: { projectId },
      order: { path: 'ASC' },
    });

    return records.map((record) => ({
      path: record.path,
      mode: 'always',
    }));
  }

  async replaceForProject(
    projectId: string,
    docs: Array<{ path: string; mode?: ProjectRepoDocMode }>,
  ): Promise<ProjectRepoDocRecord[]> {
    const normalizedDocs = this.normalizeDocs(docs);

    await this.projectRepoDocRepository.manager.transaction(async (manager) => {
      await manager.delete(ProjectRepoDoc, { projectId });

      if (normalizedDocs.length === 0) {
        return;
      }

      await manager.insert(
        ProjectRepoDoc,
        normalizedDocs.map((doc) => ({
          projectId,
          path: doc.path,
          mode: doc.mode,
        })),
      );
    });

    return normalizedDocs;
  }

  private normalizeDocs(
    docs: Array<{ path: string; mode?: ProjectRepoDocMode }>,
  ): ProjectRepoDocRecord[] {
    const dedupedDocs = new Map<string, ProjectRepoDocRecord>();

    for (const doc of docs) {
      const normalizedPath = this.normalizePath(doc.path);
      const normalizedMode = doc.mode ?? 'always';

      if (normalizedMode !== 'always') {
        throw new BadRequestException('mode must be "always"');
      }

      if (!dedupedDocs.has(normalizedPath)) {
        dedupedDocs.set(normalizedPath, {
          path: normalizedPath,
          mode: 'always',
        });
      }
    }

    return Array.from(dedupedDocs.values()).sort((a, b) => a.path.localeCompare(b.path));
  }

  private normalizePath(path: string): string {
    const normalizedPath = path.trim();

    if (normalizedPath.length === 0) {
      throw new BadRequestException('path must not be empty');
    }
    if (normalizedPath.length > ProjectRepoDocsService.MAX_PATH_LENGTH) {
      throw new BadRequestException(
        `path must be at most ${ProjectRepoDocsService.MAX_PATH_LENGTH} characters`,
      );
    }
    if (normalizedPath.startsWith('/')) {
      throw new BadRequestException('absolute paths are not allowed');
    }
    if (normalizedPath.includes('\\')) {
      throw new BadRequestException('backslashes are not allowed in repo doc paths');
    }
    if (/^[A-Za-z]:/.test(normalizedPath)) {
      throw new BadRequestException('absolute paths are not allowed');
    }

    const segments = normalizedPath.split('/');
    if (segments.some((segment) => segment === '..')) {
      throw new BadRequestException('path traversal segments are not allowed');
    }

    return normalizedPath;
  }
}
