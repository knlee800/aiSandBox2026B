import {
  ForbiddenException,
  GoneException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import { Project, type ProjectVisibility } from '../entities/project.entity';
import { Session } from '../entities/session.entity';
import { UsageRecord } from '../entities/usage-record.entity';
import { SessionService } from '../sessions/session.service';
import { SnapshotPersistenceService } from '../snapshots/snapshot-persistence.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

@Injectable()
export class ProjectsService {
  private static readonly MAX_SLUG_LENGTH = 120;
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(UsageRecord)
    private readonly usageRecordRepository: Repository<UsageRecord>,
    private readonly workspacesService: WorkspacesService,
    private readonly sessionService: SessionService,
    private readonly snapshotPersistenceService: SnapshotPersistenceService,
    private readonly containerManagerHttpClient: ContainerManagerHttpClient,
  ) {}

  private buildBaseSlug(name: string): string {
    const collapsed = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (collapsed.length === 0) {
      return 'project';
    }

    return collapsed.slice(0, ProjectsService.MAX_SLUG_LENGTH);
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = this.buildBaseSlug(name);
    let candidate = baseSlug;
    let sequence = 1;

    while (await this.projectRepository.findOne({ where: { slug: candidate } })) {
      sequence += 1;
      const suffix = `-${sequence}`;
      const maxBaseLength = ProjectsService.MAX_SLUG_LENGTH - suffix.length;
      candidate = `${baseSlug.slice(0, Math.max(maxBaseLength, 1))}${suffix}`;
    }

    return candidate;
  }

  async createProject(userId: string, name: string, workspaceId?: string): Promise<Project> {
    const normalizedName = name.trim();
    const slug = await this.generateUniqueSlug(normalizedName);
    let resolvedWorkspaceId: string;

    if (workspaceId) {
      await this.workspacesService.getWorkspaceByIdForUser(userId, workspaceId);
      resolvedWorkspaceId = workspaceId;
    } else {
      const defaultWorkspace = await this.workspacesService.ensureDefaultWorkspaceForUser(userId);
      resolvedWorkspaceId = defaultWorkspace.id;
    }

    const project = this.projectRepository.create({
      userId,
      name: normalizedName,
      slug,
      visibility: 'private',
      workspaceId: resolvedWorkspaceId,
    });
    return await this.projectRepository.save(project);
  }

  async listProjects(userId: string, workspaceId?: string): Promise<Project[]> {
    return await this.projectRepository.find({
      where: { userId, ...(workspaceId ? { workspaceId } : {}) },
      order: { updatedAt: 'DESC' },
    });
  }

  async getProjectByIdForUser(userId: string, projectId: string): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, userId },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
    return project;
  }

  async renameProject(userId: string, projectId: string, name: string): Promise<Project> {
    const project = await this.getProjectByIdForUser(userId, projectId);
    project.name = name.trim();
    return await this.projectRepository.save(project);
  }

  async moveProjectToWorkspace(
    userId: string,
    projectId: string,
    targetWorkspaceId: string,
  ): Promise<Project> {
    const project = await this.getProjectByIdForUser(userId, projectId);
    await this.workspacesService.getWorkspaceByIdForUser(userId, targetWorkspaceId);

    if (project.workspaceId === targetWorkspaceId) {
      return project;
    }

    project.workspaceId = targetWorkspaceId;
    return await this.projectRepository.save(project);
  }

  async updateProjectVisibility(
    userId: string,
    projectId: string,
    visibility: ProjectVisibility,
  ): Promise<Project> {
    const project = await this.getProjectByIdForUser(userId, projectId);
    project.visibility = visibility;
    return await this.projectRepository.save(project);
  }

  async listPublicProjects(): Promise<Project[]> {
    return await this.projectRepository.find({
      where: { visibility: 'public' },
      order: { updatedAt: 'DESC' },
    });
  }

  async getPublicProjectById(projectId: string): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, visibility: 'public' },
    });
    if (!project) {
      throw new NotFoundException(`Public project with ID ${projectId} not found`);
    }
    return project;
  }

  async forkPublicProject(args: {
    userId: string;
    projectId: string;
  }): Promise<Project> {
    const sourceProject = await this.projectRepository.findOne({
      where: { id: args.projectId },
    });
    if (!sourceProject) {
      throw new NotFoundException(`Project with ID ${args.projectId} not found`);
    }
    if (sourceProject.visibility !== 'public') {
      throw new ForbiddenException('Project is not publicly shareable');
    }

    const forkName = `Fork of ${sourceProject.name}`;
    const slug = await this.generateUniqueSlug(forkName);
    const forkedProject = this.projectRepository.create({
      userId: args.userId,
      name: forkName,
      slug,
      visibility: 'private',
    });
    return await this.projectRepository.save(forkedProject);
  }

  async associateSessionWithProject(args: {
    userId: string;
    projectId: string;
    sessionId: string;
  }): Promise<{ projectId: string; sessionId: string }> {
    await this.getProjectByIdForUser(args.userId, args.projectId);
    const session = await this.sessionService.getSessionById(args.sessionId);
    if (session.userId !== args.userId) {
      throw new NotFoundException(`Session with ID ${args.sessionId} not found`);
    }
    if (session.terminatedAt !== null) {
      throw new GoneException(`Session ${args.sessionId} is terminated`);
    }

    await this.sessionRepository.update(
      { id: args.sessionId },
      { projectId: args.projectId },
    );

    return { projectId: args.projectId, sessionId: args.sessionId };
  }

  /**
   * Project id of a project-scoped snapshot label, or null. Mirrors
   * parseProjectScopedSnapshotLabelParts in
   * frontend/components/workspace/workspace-snapshots.logic.ts: the label is
   * trimmed, must be `[project-id:<id>...]`, and the id runs up to the first
   * `:name:` or `:source:` separator and is trimmed; an empty id is null.
   */
  private static parseProjectIdFromSnapshotLabel(label: string | null | undefined): string | null {
    if (!label) {
      return null;
    }
    const trimmed = label.trim();
    const prefix = '[project-id:';
    if (!trimmed.startsWith(prefix) || !trimmed.endsWith(']')) {
      return null;
    }
    const body = trimmed.slice(prefix.length, trimmed.length - 1);
    const nameIndex = body.indexOf(':name:');
    const sourceIndex = body.indexOf(':source:');
    const firstSeparatorIndex = nameIndex >= 0 ? nameIndex : sourceIndex;
    const projectId = (firstSeparatorIndex >= 0 ? body.slice(0, firstSeparatorIndex) : body).trim();
    return projectId || null;
  }

  async openProjectIntoSession(args: {
    userId: string;
    projectId: string;
    sessionId: string;
    snapshotId?: string;
  }): Promise<{
    projectId: string;
    sessionId: string;
    restoredSnapshotId: string | null;
  }> {
    // SNAPSHOT-PICK-01: without an explicit snapshot id, restore only the
    // newest snapshot labelled for this project (listSnapshots is newest
    // first); never another project's files.
    const snapshotIdToRestore =
      args.snapshotId ??
      (await this.snapshotPersistenceService.listSnapshots(args.userId)).find(
        (snapshot) =>
          ProjectsService.parseProjectIdFromSnapshotLabel(snapshot.label) === args.projectId.trim(),
      )?.id;

    await this.associateSessionWithProject({
      userId: args.userId,
      projectId: args.projectId,
      sessionId: args.sessionId,
    });

    const activeRun = await this.usageRecordRepository.findOne({
      where: {
        userId: args.userId,
        sessionId: args.sessionId,
        executionStatus: In(['pending', 'running', 'cancel_requested']),
      },
    });
    if (activeRun) {
      this.logger.log(
        `Active run in session ${args.sessionId}; skipping snapshot and checkpoint restore`,
      );
      return {
        projectId: args.projectId,
        sessionId: args.sessionId,
        restoredSnapshotId: null,
      };
    }

    // SNAPSHOT-BINARY-01: a snapshot restore problem never skips the history
    // restore below. Files that could not be written are reported by
    // restoreSnapshot (failedPaths) and the open still succeeds. If the
    // restore throws, the history is still restored; a client error (4xx,
    // such as an unknown snapshot or a terminated session) is then thrown as
    // before, any other failure is logged and the open resolves with no
    // restored snapshot.
    let restoredSnapshotId: string | null = snapshotIdToRestore ?? null;
    let snapshotRestoreError: unknown;
    if (snapshotIdToRestore) {
      try {
        const restoreResult = await this.snapshotPersistenceService.restoreSnapshot({
          userId: args.userId,
          sessionId: args.sessionId,
          snapshotId: snapshotIdToRestore,
        });
        const failedCount = restoreResult?.failedPaths?.length ?? 0;
        if (failedCount > 0) {
          this.logger.warn(
            `Snapshot ${snapshotIdToRestore} restored into session ${args.sessionId} with ${failedCount} file(s) not written`,
          );
        }
      } catch (error: unknown) {
        snapshotRestoreError = error;
        restoredSnapshotId = null;
        const detail = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to restore snapshot ${snapshotIdToRestore} into session ${args.sessionId}: ${detail}`,
        );
      }
    }

    try {
      await this.containerManagerHttpClient.restoreCheckpointHistory(
        args.sessionId,
        args.projectId,
      );
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to restore checkpoint history for session ${args.sessionId}: ${detail}`,
      );
    }

    if (
      snapshotRestoreError instanceof HttpException &&
      snapshotRestoreError.getStatus() < 500
    ) {
      throw snapshotRestoreError;
    }

    return {
      projectId: args.projectId,
      sessionId: args.sessionId,
      restoredSnapshotId,
    };
  }
}
