import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import { ProjectsService } from './projects.service';

@Controller('projects/public')
export class PublicProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async listPublicProjects(): Promise<
    Array<{
      id: string;
      name: string;
      visibility: 'public';
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    const projects = await this.projectsService.listPublicProjects();
    return projects.map((project) => ({
      id: project.id,
      name: project.name,
      visibility: 'public',
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }));
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getPublicProject(@Param('id') id: string): Promise<{
    id: string;
    name: string;
    visibility: 'public';
    createdAt: Date;
    updatedAt: Date;
    readOnly: true;
  }> {
    const project = await this.projectsService.getPublicProjectById(id);
    return {
      id: project.id,
      name: project.name,
      visibility: 'public',
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      readOnly: true,
    };
  }

  @Post(':id/fork')
  @UseGuards(SessionCookieGuard)
  @HttpCode(HttpStatus.CREATED)
  async forkPublicProject(
    @Param('id') id: string,
    @Request() req,
  ): Promise<{
    id: string;
    name: string;
    visibility: 'private';
    createdAt: Date;
    updatedAt: Date;
  }> {
    const project = await this.projectsService.forkPublicProject({
      userId: req.user.userId,
      projectId: id,
    });
    return {
      id: project.id,
      name: project.name,
      visibility: 'private',
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }
}
