import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { RenameProjectDto } from './dto/rename-project.dto';
import { OpenProjectDto } from './dto/open-project.dto';
import { Project } from '../entities/project.entity';
import { UpdateProjectVisibilityDto } from './dto/update-project-visibility.dto';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createProject(
    @Body() body: CreateProjectDto,
    @Request() req,
  ): Promise<Project> {
    return await this.projectsService.createProject(req.user.userId, body.name);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async listProjects(@Request() req): Promise<Project[]> {
    return await this.projectsService.listProjects(req.user.userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getProject(@Param('id') id: string, @Request() req): Promise<Project> {
    return await this.projectsService.getProjectByIdForUser(req.user.userId, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async renameProject(
    @Param('id') id: string,
    @Body() body: RenameProjectDto,
    @Request() req,
  ): Promise<Project> {
    return await this.projectsService.renameProject(req.user.userId, id, body.name);
  }

  @Patch(':id/visibility')
  @HttpCode(HttpStatus.OK)
  async updateProjectVisibility(
    @Param('id') id: string,
    @Body() body: UpdateProjectVisibilityDto,
    @Request() req,
  ): Promise<Project> {
    return await this.projectsService.updateProjectVisibility(
      req.user.userId,
      id,
      body.visibility,
    );
  }

  @Post(':id/sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  async associateSessionWithProject(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @Request() req,
  ): Promise<{ projectId: string; sessionId: string }> {
    return await this.projectsService.associateSessionWithProject({
      userId: req.user.userId,
      projectId: id,
      sessionId,
    });
  }

  @Post(':id/open')
  @HttpCode(HttpStatus.OK)
  async openProjectIntoSession(
    @Param('id') id: string,
    @Body() body: OpenProjectDto,
    @Request() req,
  ): Promise<{
    projectId: string;
    sessionId: string;
    restoredSnapshotId: string | null;
  }> {
    return await this.projectsService.openProjectIntoSession({
      userId: req.user.userId,
      projectId: id,
      sessionId: body.sessionId,
      snapshotId: body.snapshotId,
    });
  }
}
