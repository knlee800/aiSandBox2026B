import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { USER_AGENT_STATUSES } from '../../entities/user-agent.entity';
import {
  MAX_AGENT_TONE_CHARS,
  SYSTEM_AGENT_REPLY_LANGUAGES,
  SYSTEM_AGENT_TOOL_PROFILES,
  type SystemAgentReplyLanguage,
} from '../../system-agents/system-agent-registry';
import { MAX_AGENT_INSTRUCTIONS_CHARS } from '../../orchestration/handoff-request';
import { CONNECTOR_SERVERS } from '../../connectors/connector-servers';
import { KNOWLEDGE_SCOPES } from '../../knowledge/knowledge-scopes';

/** BIZ-USER-01A D3: the largest per-run or per-day workflow budget, in credits. */
export const MAX_USER_WORKFLOW_BUDGET_CREDITS = 1_000_000;

export const MAX_USER_WORKFLOW_CONNECTOR_TOOLS = CONNECTOR_SERVERS.reduce(
  (count, server) => count + server.tools.length,
  0,
);

/**
 * POST /api/agents.
 *
 * name, role and description are required as before. BIZ-USER-01A adds the
 * workflow spec, access, model and budget as optional fields; a body with
 * only the first three creates a blank workflow. These are shape checks only:
 * the service validates the spec, the allowlists and the length on every
 * save. There is no `rules` field (it is a platform constant).
 */
export class CreateAgentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  role: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  @IsOptional()
  @IsIn([...USER_AGENT_STATUSES])
  status?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4)
  @Matches(/^[A-Za-z0-9]+$/)
  initials?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_AGENT_TONE_CHARS)
  tone?: string | null;

  @IsOptional()
  @IsIn([...SYSTEM_AGENT_REPLY_LANGUAGES])
  replyLanguage?: SystemAgentReplyLanguage | null;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_AGENT_INSTRUCTIONS_CHARS)
  purpose?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_AGENT_INSTRUCTIONS_CHARS)
  procedure?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_AGENT_INSTRUCTIONS_CHARS)
  result?: string;

  @IsOptional()
  @IsIn([...SYSTEM_AGENT_TOOL_PROFILES])
  toolProfile?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(KNOWLEDGE_SCOPES.length)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  knowledgeScopeIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_USER_WORKFLOW_CONNECTOR_TOOLS)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  connectorToolIds?: string[];

  @IsOptional()
  @IsObject()
  model?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_USER_WORKFLOW_BUDGET_CREDITS)
  budgetPerRunCredits?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_USER_WORKFLOW_BUDGET_CREDITS)
  budgetPerDayCredits?: number | null;
}
