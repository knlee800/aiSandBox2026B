import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UserAgentService } from './user-agent.service';
import { UserAgent } from '../entities/user-agent.entity';

export interface AgentResponseDto {
  id: string;
  name: string;
  role: string;
  description: string;
  status: string;
  initials: string | null;
  createdAt: string;
  updatedAt: string;
}

function toAgentResponse(agent: UserAgent): AgentResponseDto {
  return {
    id: agent.id,
    name: agent.name,
    role: agent.role,
    description: agent.description,
    status: agent.status,
    initials: agent.initials,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  };
}

@Controller('agents')
@UseGuards(SessionCookieGuard)
export class UserAgentController {
  constructor(private readonly userAgentService: UserAgentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() req,
    @Body() dto: CreateAgentDto,
  ): Promise<AgentResponseDto> {
    const agent = await this.userAgentService.create(req.user.userId, dto);
    return toAgentResponse(agent);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(@Request() req): Promise<{ agents: AgentResponseDto[] }> {
    const agents = await this.userAgentService.listByUserId(req.user.userId);
    return { agents: agents.map(toAgentResponse) };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getOne(
    @Request() req,
    @Param('id') id: string,
  ): Promise<AgentResponseDto> {
    const agent = await this.userAgentService.findOneByIdAndUserId(
      id,
      req.user.userId,
    );
    if (!agent) {
      throw new NotFoundException();
    }
    return toAgentResponse(agent);
  }
}
