import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { Workspace } from '../entities/workspace.entity';

@Injectable()
export class WorkspacesService {
  private static readonly MAX_SLUG_LENGTH = 120;

  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  private buildBaseSlug(name: string): string {
    const collapsed = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (collapsed.length === 0) {
      return 'workspace';
    }

    return collapsed.slice(0, WorkspacesService.MAX_SLUG_LENGTH);
  }

  private async generateUniqueSlug(
    userId: string,
    name: string,
    excludeWorkspaceId?: string,
  ): Promise<string> {
    const baseSlug = this.buildBaseSlug(name);
    let candidate = baseSlug;
    let sequence = 1;

    while (true) {
      const existingWorkspace = await this.workspaceRepository.findOne({
        where: { userId, slug: candidate },
      });

      if (!existingWorkspace || existingWorkspace.id === excludeWorkspaceId) {
        return candidate;
      }

      sequence += 1;
      const suffix = `-${sequence}`;
      const maxBaseLength = WorkspacesService.MAX_SLUG_LENGTH - suffix.length;
      candidate = `${baseSlug.slice(0, Math.max(maxBaseLength, 1))}${suffix}`;
    }
  }

  async createWorkspace(userId: string, name: string): Promise<Workspace> {
    const normalizedName = name.trim();
    const slug = await this.generateUniqueSlug(userId, normalizedName);
    const workspace = this.workspaceRepository.create({
      userId,
      name: normalizedName,
      slug,
      isDefault: false,
    });
    return await this.workspaceRepository.save(workspace);
  }

  async ensureDefaultWorkspaceForUser(userId: string): Promise<Workspace> {
    const existingDefaultWorkspace = await this.workspaceRepository.findOne({
      where: { userId, isDefault: true },
    });

    if (existingDefaultWorkspace) {
      return existingDefaultWorkspace;
    }

    const slug = await this.generateUniqueSlug(userId, 'Personal');
    const defaultWorkspace = this.workspaceRepository.create({
      userId,
      name: 'Personal',
      slug,
      isDefault: true,
    });

    return await this.workspaceRepository.save(defaultWorkspace);
  }

  async listWorkspaces(userId: string): Promise<Workspace[]> {
    await this.ensureDefaultWorkspaceForUser(userId);

    return await this.workspaceRepository.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  async getWorkspaceByIdForUser(userId: string, workspaceId: string): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId, userId },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found`);
    }

    return workspace;
  }

  async updateWorkspace(
    userId: string,
    workspaceId: string,
    name: string | undefined,
  ): Promise<Workspace> {
    if (typeof name !== 'string') {
      throw new BadRequestException('Workspace name is required');
    }

    const workspace = await this.getWorkspaceByIdForUser(userId, workspaceId);
    const normalizedName = name.trim();
    workspace.name = normalizedName;
    workspace.slug = await this.generateUniqueSlug(userId, normalizedName, workspace.id);
    return await this.workspaceRepository.save(workspace);
  }

  async deleteWorkspace(userId: string, workspaceId: string): Promise<{ deleted: true }> {
    const workspace = await this.getWorkspaceByIdForUser(userId, workspaceId);

    if (workspace.isDefault) {
      throw new BadRequestException('Default workspace cannot be deleted');
    }

    const defaultWorkspace = await this.workspaceRepository.findOne({
      where: { userId, isDefault: true },
    });

    if (!defaultWorkspace) {
      throw new NotFoundException(`Default workspace for user ${userId} not found`);
    }

    await this.projectRepository.update(
      { workspaceId: workspace.id },
      { workspaceId: defaultWorkspace.id },
    );
    await this.workspaceRepository.delete({ id: workspace.id, userId });

    return { deleted: true };
  }
}
