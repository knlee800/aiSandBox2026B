import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import { CreateAgentDto, MAX_USER_WORKFLOW_BUDGET_CREDITS } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { CreateAgentFromTemplateDto } from './dto/create-agent-from-template.dto';
import { UserAgentService, userWorkflowPromptSpec } from './user-agent.service';
import { UserAgent } from '../entities/user-agent.entity';
import {
  MAX_AGENT_TONE_CHARS,
  SYSTEM_AGENT_REPLY_LANGUAGES,
  neverDoFor,
  renderAgentInstructions,
  type NeverDoItem,
  type SystemAgentModel,
  type SystemAgentReplyLanguage,
  type SystemAgentScope,
} from '../system-agents/system-agent-registry';
import { PLATFORM_MODELS, type PlatformModel } from '../system-agents/platform-models';
import { MAX_AGENT_INSTRUCTIONS_CHARS } from '../orchestration/handoff-request';
import { KNOWLEDGE_SCOPES, findKnowledgeScope, type KnowledgeScope } from '../knowledge/knowledge-scopes';
import { connectorToolCatalog } from '../connectors/connector-servers';
import {
  USER_WORKFLOW_TEMPLATE_IDS,
  readApprovalSetting,
  readStoredRosterMemberIds,
  rosterSystemChoices,
  rosterSystemMemberText,
  type RosterMemberKind,
  type UserWorkflowApprovalMode,
} from './user-workflow-rules';
import {
  MAX_USER_WORKFLOW_KNOWLEDGE_SCOPES,
  USER_WORKFLOW_TOOL_PROFILES,
  allowlistedConnectorToolIds,
  userWorkflowGrants,
  type UserWorkflowGrants,
} from './user-workflow-grants';

export interface AgentResponseDto {
  id: string;
  name: string;
  role: string;
  description: string;
  status: string;
  initials: string | null;
  createdAt: string;
  updatedAt: string;
  // BIZ-USER-01A: the stored workflow fields.
  tone: string | null;
  replyLanguage: SystemAgentReplyLanguage | null;
  purpose: string;
  procedure: string;
  result: string;
  toolProfile: string;
  knowledgeScopeIds: string[];
  connectorToolIds: string[];
  model: SystemAgentModel;
  budgetPerRunCredits: number | null;
  budgetPerDayCredits: number | null;
  templateId: string | null;
  // USER-TEAMS-01 D3: the stored team, read fail-closed.
  teamMemberIds: string[];
  // APPROVAL-SET-01 D2: the stored approval setting, read fail-closed.
  approvalMode: UserWorkflowApprovalMode;
  approvalCreditLimit: number | null;
  // Derived, never stored.
  neverDo: readonly NeverDoItem[];
  grants: UserWorkflowGrants;
  instructionsChars: number;
  maxInstructionsChars: number;
}

/**
 * USER-TEAMS-01 D3: an agent the workflow form may put on a team: the active
 * system candidates (the two advisors) and the owner's own rows. Whether a
 * member can run is decided at start (D7), not here.
 */
export interface AgentTeamChoiceDto {
  id: string;
  kind: RosterMemberKind;
  name: string;
  status: string;
}

export interface AgentOptionsResponseDto {
  replyLanguages: readonly string[];
  toolProfiles: readonly string[];
  knowledgeScopes: readonly KnowledgeScope[];
  connectorTools: { id: string; kind: string }[];
  connectedKinds: string[];
  models: readonly PlatformModel[];
  templates: readonly string[];
  teamChoices: AgentTeamChoiceDto[];
  limits: {
    maxInstructionsChars: number;
    maxToneChars: number;
    maxKnowledgeScopes: number;
    maxBudgetCredits: number;
    platformDailyCreditsPerUser: number;
  };
}

function toAgentResponse(agent: UserAgent, connectionKinds: Set<string>): AgentResponseDto {
  const grants = userWorkflowGrants(
    {
      toolProfile: agent.toolProfile,
      knowledgeScopeIds: agent.knowledgeScopeIds,
      connectorToolIds: agent.connectorToolIds,
    },
    connectionKinds,
  );
  // The never-do list describes the stored access, limited to the allowlist
  // (stored connector tools count even before the owner connects them).
  const allowedScopes: SystemAgentScope[] = grants.knowledgeScopeIds.map(
    (id) => findKnowledgeScope(id)!,
  );
  const neverDo = neverDoFor({
    toolProfile: grants.toolProfile,
    knowledgeScopes: allowedScopes,
    connectorToolIds: allowlistedConnectorToolIds(agent.connectorToolIds),
  });
  const instructionsChars = renderAgentInstructions(userWorkflowPromptSpec(agent)).length;
  const approval = readApprovalSetting(agent);

  return {
    id: agent.id,
    name: agent.name,
    role: agent.role,
    description: agent.description,
    status: agent.status,
    initials: agent.initials,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
    tone: agent.tone ?? null,
    replyLanguage: agent.replyLanguage ?? null,
    purpose: agent.purpose ?? '',
    procedure: agent.procedure ?? '',
    result: agent.result ?? '',
    toolProfile: agent.toolProfile,
    knowledgeScopeIds: Array.isArray(agent.knowledgeScopeIds) ? [...agent.knowledgeScopeIds] : [],
    connectorToolIds: Array.isArray(agent.connectorToolIds) ? [...agent.connectorToolIds] : [],
    model: agent.model ?? { choice: 'server' },
    budgetPerRunCredits: agent.budgetPerRunCredits ?? null,
    budgetPerDayCredits: agent.budgetPerDayCredits ?? null,
    templateId: agent.templateId ?? null,
    teamMemberIds: readStoredRosterMemberIds(agent.teamMemberIds),
    approvalMode: approval.mode,
    approvalCreditLimit: approval.creditLimit,
    neverDo,
    grants,
    instructionsChars,
    maxInstructionsChars: MAX_AGENT_INSTRUCTIONS_CHARS,
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
    const kinds = await this.userAgentService.ownerConnectionKinds(req.user.userId);
    return toAgentResponse(agent, kinds);
  }

  // Static paths are declared before ':id' so they are never read as an id.

  @Post('from-template')
  @HttpCode(HttpStatus.CREATED)
  async createFromTemplate(
    @Request() req,
    @Body() dto: CreateAgentFromTemplateDto,
  ): Promise<AgentResponseDto> {
    const agent = await this.userAgentService.createFromTemplate(req.user.userId, dto);
    const kinds = await this.userAgentService.ownerConnectionKinds(req.user.userId);
    return toAgentResponse(agent, kinds);
  }

  @Get('options')
  @HttpCode(HttpStatus.OK)
  async options(@Request() req): Promise<AgentOptionsResponseDto> {
    const kinds = await this.userAgentService.ownerConnectionKinds(req.user.userId);
    const rows = (await this.userAgentService.listByUserId(req.user.userId)).filter(
      (row) => row.userId === req.user.userId,
    );
    const teamChoices: AgentTeamChoiceDto[] = [
      ...rosterSystemChoices().map((definition) => ({
        id: definition.id,
        kind: 'system' as const,
        name: rosterSystemMemberText(definition).label,
        status: definition.status,
      })),
      ...rows.map((row) => ({
        id: row.id.toLowerCase(),
        kind: 'workflow' as const,
        name: row.name,
        status: row.status,
      })),
    ];
    return {
      replyLanguages: [...SYSTEM_AGENT_REPLY_LANGUAGES],
      toolProfiles: [...USER_WORKFLOW_TOOL_PROFILES],
      knowledgeScopes: KNOWLEDGE_SCOPES.map((scope) => ({ id: scope.id, type: scope.type })),
      connectorTools: connectorToolCatalog().map((tool) => ({ id: tool.id, kind: tool.kind })),
      connectedKinds: [...kinds].sort(),
      models: PLATFORM_MODELS.map((model) => ({ ...model })),
      templates: [...USER_WORKFLOW_TEMPLATE_IDS],
      teamChoices,
      limits: {
        maxInstructionsChars: MAX_AGENT_INSTRUCTIONS_CHARS,
        maxToneChars: MAX_AGENT_TONE_CHARS,
        maxKnowledgeScopes: MAX_USER_WORKFLOW_KNOWLEDGE_SCOPES,
        maxBudgetCredits: MAX_USER_WORKFLOW_BUDGET_CREDITS,
        platformDailyCreditsPerUser: this.userAgentService.platformDailyCreditsPerUser(),
      },
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(@Request() req): Promise<{ agents: AgentResponseDto[] }> {
    const agents = await this.userAgentService.listByUserId(req.user.userId);
    const kinds = await this.userAgentService.ownerConnectionKinds(req.user.userId);
    return { agents: agents.map((agent) => toAgentResponse(agent, kinds)) };
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
    const kinds = await this.userAgentService.ownerConnectionKinds(req.user.userId);
    return toAgentResponse(agent, kinds);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateAgentDto,
  ): Promise<AgentResponseDto> {
    const agent = await this.userAgentService.update(id, req.user.userId, dto);
    const kinds = await this.userAgentService.ownerConnectionKinds(req.user.userId);
    return toAgentResponse(agent, kinds);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Request() req,
    @Param('id') id: string,
  ): Promise<void> {
    await this.userAgentService.deleteByIdAndUserId(id, req.user.userId);
  }
}
