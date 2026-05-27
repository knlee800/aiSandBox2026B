import {
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project, type ProjectVisibility } from '../entities/project.entity';
import { Session } from '../entities/session.entity';
import { SessionService } from '../sessions/session.service';
import { SnapshotPersistenceService } from '../snapshots/snapshot-persistence.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

@Injectable()
export class ProjectsService {
  private static readonly MAX_SLUG_LENGTH = 120;

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    private readonly workspacesService: WorkspacesService,
    private readonly sessionService: SessionService,
    private readonly snapshotPersistenceService: SnapshotPersistenceService,
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
    const snapshotIdToRestore =
      args.snapshotId ?? (await this.snapshotPersistenceService.listSnapshots(args.userId))[0]?.id;

    await this.associateSessionWithProject({
      userId: args.userId,
      projectId: args.projectId,
      sessionId: args.sessionId,
    });

    if (snapshotIdToRestore) {
      await this.snapshotPersistenceService.restoreSnapshot({
        userId: args.userId,
        sessionId: args.sessionId,
        snapshotId: snapshotIdToRestore,
      });
    }

    return {
      projectId: args.projectId,
      sessionId: args.sessionId,
      restoredSnapshotId: snapshotIdToRestore ?? null,
    };
  }
}
