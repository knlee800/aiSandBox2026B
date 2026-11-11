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
  ValidateIf,
} from 'class-validator';
import { USER_AGENT_STATUSES } from '../../entities/user-agent.entity';
import {
  MAX_AGENT_TONE_CHARS,
  SYSTEM_AGENT_REPLY_LANGUAGES,
  SYSTEM_AGENT_TOOL_PROFILES,
  type SystemAgentReplyLanguage,
} from '../../system-agents/system-agent-registry';
import { MAX_AGENT_INSTRUCTIONS_CHARS } from '../../orchestration/handoff-request';
import { KNOWLEDGE_SCOPES } from '../../knowledge/knowledge-scopes';
import {
  MAX_USER_WORKFLOW_BUDGET_CREDITS,
  MAX_USER_WORKFLOW_CONNECTOR_TOOLS,
} from './create-agent.dto';
import {
  MAX_ROSTER_MEMBERS,
  ROSTER_MEMBER_ID_MAX_CHARS,
  USER_WORKFLOW_APPROVAL_MODES,
  type UserWorkflowApprovalMode,
} from '../user-workflow-rules';

const provided = (_object: object, value: unknown): boolean => value !== undefined;

/**
 * PATCH /api/agents/:id (BIZ-USER-01A D3).
 *
 * Every field is optional; an absent field keeps the stored value. tone,
 * replyLanguage and the two budgets accept null to clear them. Every other
 * field, when present, must hold a value (null is refused). There is no
 * `rules` field and no `templateId` field.
 */
export class UpdateAgentDto {
  @ValidateIf(provided)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ValidateIf(provided)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  role?: string;

  @ValidateIf(provided)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description?: string;

  @ValidateIf(provided)
  @IsIn([...USER_AGENT_STATUSES])
  status?: string;

  @ValidateIf(provided)
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

  @ValidateIf(provided)
  @IsString()
  @MaxLength(MAX_AGENT_INSTRUCTIONS_CHARS)
  purpose?: string;

  @ValidateIf(provided)
  @IsString()
  @MaxLength(MAX_AGENT_INSTRUCTIONS_CHARS)
  procedure?: string;

  @ValidateIf(provided)
  @IsString()
  @MaxLength(MAX_AGENT_INSTRUCTIONS_CHARS)
  result?: string;

  @ValidateIf(provided)
  @IsIn([...SYSTEM_AGENT_TOOL_PROFILES])
  toolProfile?: string;

  @ValidateIf(provided)
  @IsArray()
  @ArrayMaxSize(KNOWLEDGE_SCOPES.length)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  knowledgeScopeIds?: string[];

  @ValidateIf(provided)
  @IsArray()
  @ArrayMaxSize(MAX_USER_WORKFLOW_CONNECTOR_TOOLS)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  connectorToolIds?: string[];

  @ValidateIf(provided)
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

  /**
   * USER-TEAMS-01 D2: the workflow's team, replaced whole when present; [] empties
   * it. Absent keeps the stored team. Shape only here; the service checks each id.
   */
  @ValidateIf(provided)
  @IsArray()
  @ArrayMaxSize(MAX_ROSTER_MEMBERS)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(ROSTER_MEMBER_ID_MAX_CHARS, { each: true })
  teamMemberIds?: string[];

  /**
   * APPROVAL-SET-01 D2: the approval setting. Absent keeps the stored value;
   * present replaces it (null is refused for the mode). The limit accepts null
   * to clear it. The service merges both with the stored row, requires a
   * limit for 'credits' and stores the limit as null for any other mode. Not
   * part of the workflow version (D3): a setting-only edit needs no new test.
   */
  @ValidateIf(provided)
  @IsIn([...USER_WORKFLOW_APPROVAL_MODES])
  approvalMode?: UserWorkflowApprovalMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_USER_WORKFLOW_BUDGET_CREDITS)
  approvalCreditLimit?: number | null;
}
