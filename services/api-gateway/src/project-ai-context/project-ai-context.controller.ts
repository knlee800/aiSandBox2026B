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
import { UpsertProjectAiContextDto } from './dto/upsert-project-ai-context.dto';
import { ProjectAiContextService } from './project-ai-context.service';

@Controller('projects/:projectId/ai-context')
@UseGuards(SessionCookieGuard)
export class ProjectAiContextController {
  constructor(
    private readonly projectAiContextService: ProjectAiContextService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getProjectAiContext(
    @Param('projectId') projectId: string,
    @Request() req,
  ): Promise<{ projectInstructions: string | null }> {
    await this.projectsService.getProjectByIdForUser(req.user.userId, projectId);

    const projectInstructions = await this.projectAiContextService.getByProjectId(projectId);
    return { projectInstructions };
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  async upsertProjectAiContext(
    @Param('projectId') projectId: string,
    @Request() req,
    @Body() body: UpsertProjectAiContextDto,
  ): Promise<{ projectInstructions: string | null }> {
    await this.projectsService.getProjectByIdForUser(req.user.userId, projectId);

    const projectInstructions = body.projectInstructions ?? null;
    const savedProjectInstructions = await this.projectAiContextService.upsert(
      projectId,
      projectInstructions,
    );
    return { projectInstructions: savedProjectInstructions };
  }
}
