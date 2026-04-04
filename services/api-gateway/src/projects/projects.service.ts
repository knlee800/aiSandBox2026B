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

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    private readonly sessionService: SessionService,
    private readonly snapshotPersistenceService: SnapshotPersistenceService,
  ) {}

  async createProject(userId: string, name: string): Promise<Project> {
    const project = this.projectRepository.create({
      userId,
      name: name.trim(),
      visibility: 'private',
    });
    return await this.projectRepository.save(project);
  }

  async listProjects(userId: string): Promise<Project[]> {
    return await this.projectRepository.find({
      where: { userId },
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

    const forkedProject = this.projectRepository.create({
      userId: args.userId,
      name: `Fork of ${sourceProject.name}`,
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
    await this.associateSessionWithProject({
      userId: args.userId,
      projectId: args.projectId,
      sessionId: args.sessionId,
    });

    if (args.snapshotId) {
      await this.snapshotPersistenceService.restoreSnapshot({
        userId: args.userId,
        sessionId: args.sessionId,
        snapshotId: args.snapshotId,
      });
    }

    return {
      projectId: args.projectId,
      sessionId: args.sessionId,
      restoredSnapshotId: args.snapshotId ?? null,
    };
  }
}
