import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyAuthGuard } from '../auth/api-key-auth.guard';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator';
import { type ApiKeyIdentity } from '../auth/api-key.config';
import { ProjectsService } from '../projects/projects.service';
import { Project } from '../entities/project.entity';
import {
  PublicApiRateLimit,
  PublicApiRateLimitGuard,
} from './public-api-rate-limit.guard';

@Controller('v1/projects')
@UseGuards(ApiKeyAuthGuard, PublicApiRateLimitGuard)
export class PublicProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @PublicApiRateLimit({ maxRequests: 60, windowMs: 60000 })
  async listProjects(@AuthenticatedUser() identity: ApiKeyIdentity): Promise<Project[]> {
    return await this.projectsService.listProjects(identity.userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @PublicApiRateLimit({ maxRequests: 30, windowMs: 60000 })
  async createProject(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Body('name') name: string,
  ): Promise<Project> {
    return await this.projectsService.createProject(identity.userId, name);
  }
}
