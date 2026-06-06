import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import { ProjectsService } from '../projects/projects.service';
import { UpsertProjectRepoDocsDto } from './dto/upsert-project-repo-docs.dto';
import { ProjectRepoDocsService } from './project-repo-docs.service';

@Controller('projects/:projectId/repo-docs')
@UseGuards(SessionCookieGuard)
export class ProjectRepoDocsController {
  constructor(
    private readonly projectRepoDocsService: ProjectRepoDocsService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getProjectRepoDocs(
    @Param('projectId') projectId: string,
    @Request() req,
  ): Promise<{ docs: Array<{ path: string; mode: 'always' }> }> {
    await this.projectsService.getProjectByIdForUser(req.user.userId, projectId);

    const docs = await this.projectRepoDocsService.listByProjectId(projectId);
    return { docs };
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  async replaceProjectRepoDocs(
    @Param('projectId') projectId: string,
    @Request() req,
    @Body() body: UpsertProjectRepoDocsDto,
  ): Promise<{ docs: Array<{ path: string; mode: 'always' }> }> {
    await this.projectsService.getProjectByIdForUser(req.user.userId, projectId);

    const docs = await this.projectRepoDocsService.replaceForProject(projectId, body.docs);
    return { docs };
  }
}
