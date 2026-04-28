import {
  Body,
  Controller,
  Delete,
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
import { Workspace } from '../entities/workspace.entity';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createWorkspace(
    @Body() body: CreateWorkspaceDto,
    @Request() req,
  ): Promise<Workspace> {
    return await this.workspacesService.createWorkspace(req.user.userId, body.name);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async listWorkspaces(@Request() req): Promise<Workspace[]> {
    return await this.workspacesService.listWorkspaces(req.user.userId);
  }

  @Get(':id([0-9a-fA-F-]{36})')
  @HttpCode(HttpStatus.OK)
  async getWorkspace(
    @Param('id') id: string,
    @Request() req,
  ): Promise<Workspace> {
    return await this.workspacesService.getWorkspaceByIdForUser(req.user.userId, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateWorkspace(
    @Param('id') id: string,
    @Body() body: UpdateWorkspaceDto,
    @Request() req,
  ): Promise<Workspace> {
    return await this.workspacesService.updateWorkspace(req.user.userId, id, body.name);
  }

  @Delete(':id([0-9a-fA-F-]{36})')
  @HttpCode(HttpStatus.OK)
  async deleteWorkspace(
    @Param('id') id: string,
    @Request() req,
  ): Promise<{ deleted: true }> {
    return await this.workspacesService.deleteWorkspace(req.user.userId, id);
  }
}
