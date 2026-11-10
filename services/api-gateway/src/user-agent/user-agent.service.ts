import {
  BadRequestException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAgent, type UserAgentStatus } from '../entities/user-agent.entity';
import { ConnectorConnection } from '../entities/connector-connection.entity';
import {
  agentInstructionsWithinLimit,
  isSystemAgentModel,
  renderAgentInstructions,
  systemAgentById,
  systemAgentPromptSpecProblems,
  type SystemAgentModel,
  type SystemAgentPromptSpec,
  type SystemAgentReplyLanguage,
} from '../system-agents/system-agent-registry';
import { MAX_AGENT_INSTRUCTIONS_CHARS } from '../orchestration/handoff-request';
import { CreateAgentDto, MAX_USER_WORKFLOW_BUDGET_CREDITS } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { CreateAgentFromTemplateDto } from './dto/create-agent-from-template.dto';
import { USER_WORKFLOW_RULES, isUserWorkflowTemplateId } from './user-workflow-rules';
import {
  allowlistedConnectorToolIds,
  userWorkflowGrants,
  type UserWorkflowToolProfile,
} from './user-workflow-grants';
import {
  USER_WORKFLOW_SWITCH_ON_CHECK,
  type UserWorkflowSwitchOnCheck,
} from './user-workflow-switch-on.port';

/** Stable refusal codes for saves (BIZ-USER-01A D5, D7, D8, D6b). The editor translates them. */
export const USER_WORKFLOW_ERROR_CODES = {
  specInvalid: 'SPEC_INVALID',
  instructionsTooLong: 'INSTRUCTIONS_TOO_LONG',
  toolProfileNotAllowed: 'TOOL_PROFILE_NOT_ALLOWED',
  knowledgeScopeUnknown: 'KNOWLEDGE_SCOPE_UNKNOWN',
  connectorToolUnknown: 'CONNECTOR_TOOL_UNKNOWN',
  connectionMissing: 'CONNECTION_MISSING',
  modelInvalid: 'MODEL_INVALID',
  budgetInvalid: 'BUDGET_INVALID',
  templateNotAllowed: 'TEMPLATE_NOT_ALLOWED',
} as const;

export type UserWorkflowErrorCode =
  (typeof USER_WORKFLOW_ERROR_CODES)[keyof typeof USER_WORKFLOW_ERROR_CODES];

export function userWorkflowBadRequest(
  code: UserWorkflowErrorCode,
  message: string,
  details: Record<string, unknown> = {},
): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    message,
    error: 'Bad Request',
    code,
    ...details,
  });
}

const DEFAULT_MAX_DAILY_CREDITS_PER_USER = 500;

/**
 * WORKFLOW-CREATE-01: every new agent, blank or copied, is stored as a draft.
 * A draft can only test-run; the owner switches it on after a passing test
 * (BIZ-USER-01D). A status sent on create is ignored. Existing rows and the
 * column default are unchanged.
 */
export const NEW_USER_AGENT_STATUS: UserAgentStatus = 'draft';

/** The fields a workflow save writes, before validation. */
interface WorkflowFields {
  tone: unknown;
  replyLanguage: unknown;
  purpose: unknown;
  procedure: unknown;
  result: unknown;
  toolProfile: unknown;
  knowledgeScopeIds: unknown;
  connectorToolIds: unknown;
  model: unknown;
  budgetPerRunCredits: unknown;
  budgetPerDayCredits: unknown;
}

/** The validated fields, ready to store. */
interface ValidWorkflowFields {
  tone: string | null;
  replyLanguage: SystemAgentReplyLanguage | null;
  purpose: string;
  procedure: string;
  result: string;
  toolProfile: UserWorkflowToolProfile;
  knowledgeScopeIds: string[];
  connectorToolIds: string[];
  model: SystemAgentModel;
  budgetPerRunCredits: number | null;
  budgetPerDayCredits: number | null;
}

/** The prompt spec a stored workflow renders: its parts plus the platform rules. */
export function userWorkflowPromptSpec(row: {
  tone: string | null;
  replyLanguage: SystemAgentReplyLanguage | null;
  purpose: string;
  procedure: string;
  result: string;
}): SystemAgentPromptSpec {
  return {
    tone: row.tone ?? null,
    replyLanguage: row.replyLanguage ?? null,
    purpose: row.purpose ?? '',
    procedure: row.procedure ?? '',
    result: row.result ?? '',
    rules: USER_WORKFLOW_RULES,
  };
}

function copyModel(model: SystemAgentModel): SystemAgentModel {
  return model.choice === 'platform'
    ? { choice: 'platform', id: model.id }
    : { choice: 'server' };
}

function isBudget(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= MAX_USER_WORKFLOW_BUDGET_CREDITS)
  );
}

@Injectable()
export class UserAgentService {
  constructor(
    @InjectRepository(UserAgent)
    private readonly userAgentRepository: Repository<UserAgent>,
    @InjectRepository(ConnectorConnection)
    private readonly connectionRepository: Repository<ConnectorConnection>,
    @Inject(USER_WORKFLOW_SWITCH_ON_CHECK)
    private readonly switchOnCheck: UserWorkflowSwitchOnCheck,
  ) {}

  /**
   * Blank or filled create. A body with only name, role and description
   * yields an empty spec, tool profile read, no access, the server model and
   * no budget. The row is stored as a draft whatever status the body sends
   * (WORKFLOW-CREATE-01).
   */
  async create(userId: string, dto: CreateAgentDto): Promise<UserAgent> {
    const initials = dto.initials ?? this.computeInitials(dto.name);

    const fields = await this.validateWorkflow(
      userId,
      {
        tone: dto.tone ?? null,
        replyLanguage: dto.replyLanguage ?? null,
        purpose: dto.purpose ?? '',
        procedure: dto.procedure ?? '',
        result: dto.result ?? '',
        toolProfile: dto.toolProfile ?? 'read',
        knowledgeScopeIds: dto.knowledgeScopeIds ?? [],
        connectorToolIds: dto.connectorToolIds ?? [],
        model: dto.model ?? { choice: 'server' },
        budgetPerRunCredits: dto.budgetPerRunCredits ?? null,
        budgetPerDayCredits: dto.budgetPerDayCredits ?? null,
      },
      [],
    );

    const agent = this.userAgentRepository.create({
      userId,
      name: dto.name,
      role: dto.role,
      description: dto.description,
      status: NEW_USER_AGENT_STATUS,
      initials,
      ...fields,
      templateId: null,
    });

    return this.userAgentRepository.save(agent);
  }

  /**
   * Copy a system agent as a workflow. The spec, access and model come from
   * the registry definition, never from the body. The template's connector
   * tools are kept even when the owner has not connected them yet; grants
   * still intersect with the owner's connections. The copy is stored as a
   * draft until its owner tests it and switches it on (WORKFLOW-CREATE-01).
   */
  async createFromTemplate(
    userId: string,
    dto: CreateAgentFromTemplateDto,
  ): Promise<UserAgent> {
    const templateId = dto.templateId;
    const template = isUserWorkflowTemplateId(templateId)
      ? systemAgentById(templateId)
      : undefined;
    if (!template) {
      throw userWorkflowBadRequest(
        USER_WORKFLOW_ERROR_CODES.templateNotAllowed,
        'This template cannot be copied.',
      );
    }

    const fields = await this.validateWorkflow(
      userId,
      {
        tone: template.tone,
        replyLanguage: template.replyLanguage,
        purpose: template.purpose,
        procedure: template.procedure,
        result: template.result,
        toolProfile: template.toolProfile,
        knowledgeScopeIds: template.knowledgeScopes.map((scope) => scope.id),
        connectorToolIds: [...template.connectorToolIds],
        model: copyModel(template.model),
        budgetPerRunCredits: null,
        budgetPerDayCredits: null,
      },
      template.connectorToolIds,
    );

    const agent = this.userAgentRepository.create({
      userId,
      name: dto.name,
      role: dto.role,
      description: dto.description ?? '',
      status: NEW_USER_AGENT_STATUS,
      initials: this.computeInitials(dto.name),
      ...fields,
      templateId: template.id,
    });

    return this.userAgentRepository.save(agent);
  }

  /**
   * Owner-scoped edit. Absent fields keep their stored value; the merged
   * workflow is validated like any save. Connector tools already stored stay
   * allowed without a connection; a newly added one needs it.
   *
   * WORKFLOW-STATUS-02: a PATCH that switches a row on (status `active` on a
   * row not stored as active) is refused with 409 WORKFLOW_NOT_TESTED unless
   * the row, as it will be saved, has a completed test run at its version.
   * Switching off, to draft, an edit that keeps the status and a PATCH to
   * active on an active row are not checked.
   */
  async update(id: string, userId: string, dto: UpdateAgentDto): Promise<UserAgent> {
    const agent = await this.findOneByIdAndUserId(id, userId);
    if (!agent) {
      throw new NotFoundException();
    }

    const pick = <K extends keyof WorkflowFields>(key: K, stored: unknown): unknown =>
      (dto as Record<string, unknown>)[key] !== undefined
        ? (dto as Record<string, unknown>)[key]
        : stored;

    const storedToolIds = allowlistedConnectorToolIds(agent.connectorToolIds);
    const fields = await this.validateWorkflow(
      userId,
      {
        tone: pick('tone', agent.tone),
        replyLanguage: pick('replyLanguage', agent.replyLanguage),
        purpose: pick('purpose', agent.purpose),
        procedure: pick('procedure', agent.procedure),
        result: pick('result', agent.result),
        toolProfile: pick('toolProfile', agent.toolProfile),
        knowledgeScopeIds: pick('knowledgeScopeIds', agent.knowledgeScopeIds),
        connectorToolIds: pick('connectorToolIds', agent.connectorToolIds),
        model: pick('model', agent.model),
        budgetPerRunCredits: pick('budgetPerRunCredits', agent.budgetPerRunCredits),
        budgetPerDayCredits: pick('budgetPerDayCredits', agent.budgetPerDayCredits),
      },
      storedToolIds,
    );

    const switchingOn = dto.status === 'active' && agent.status !== 'active';

    if (dto.name !== undefined) agent.name = dto.name;
    if (dto.role !== undefined) agent.role = dto.role;
    if (dto.description !== undefined) agent.description = dto.description;
    if (dto.status !== undefined) agent.status = dto.status;
    if (dto.initials !== undefined) agent.initials = dto.initials;
    Object.assign(agent, fields);

    if (switchingOn) {
      await this.switchOnCheck.assertCanSwitchOn(userId, agent);
    }

    return this.userAgentRepository.save(agent);
  }

  async listByUserId(userId: string): Promise<UserAgent[]> {
    return this.userAgentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOneByIdAndUserId(
    id: string,
    userId: string,
  ): Promise<UserAgent | null> {
    return this.userAgentRepository.findOne({
      where: { id, userId },
    });
  }

  async deleteByIdAndUserId(id: string, userId: string): Promise<void> {
    const result = await this.userAgentRepository.softDelete({ id, userId });
    if (!result.affected) {
      throw new NotFoundException();
    }
  }

  /** The connector kinds the owner has connected. Reads the kind column only; never a secret. */
  async ownerConnectionKinds(userId: string): Promise<Set<string>> {
    const rows = await this.connectionRepository.find({
      where: { userId },
      select: ['kind'],
    });
    return new Set(rows.map((row) => row.kind));
  }

  /**
   * Advisory: the platform's daily credit cap per user, read the same way
   * as DailyCreditCapService (env, else the default). Not enforced here.
   */
  platformDailyCreditsPerUser(): number {
    const raw = process.env.MAX_DAILY_CREDITS_PER_USER;
    if (raw === undefined || raw.trim() === '') {
      return DEFAULT_MAX_DAILY_CREDITS_PER_USER;
    }
    const parsed = Number(raw.trim());
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_MAX_DAILY_CREDITS_PER_USER;
    }
    return parsed;
  }

  /**
   * D5, D7, D8 on every save. `keptToolIds` are connector tools that may be
   * stored without the owner's connection (the template's, or those already
   * stored on the row); any other tool needs a connection of its kind.
   */
  private async validateWorkflow(
    userId: string,
    fields: WorkflowFields,
    keptToolIds: readonly string[],
  ): Promise<ValidWorkflowFields> {
    const spec = {
      tone: fields.tone,
      replyLanguage: fields.replyLanguage,
      purpose: fields.purpose,
      procedure: fields.procedure,
      result: fields.result,
      rules: USER_WORKFLOW_RULES,
    } as SystemAgentPromptSpec;

    const problems = systemAgentPromptSpecProblems(spec);
    if (!Array.isArray(fields.knowledgeScopeIds)) problems.push('knowledgeScopeIds');
    if (!Array.isArray(fields.connectorToolIds)) problems.push('connectorToolIds');
    if (problems.length > 0) {
      throw userWorkflowBadRequest(
        USER_WORKFLOW_ERROR_CODES.specInvalid,
        'The workflow has invalid fields.',
        { fields: problems },
      );
    }

    if (!agentInstructionsWithinLimit(spec)) {
      throw userWorkflowBadRequest(
        USER_WORKFLOW_ERROR_CODES.instructionsTooLong,
        'The workflow instructions are too long.',
        { chars: renderAgentInstructions(spec).length, max: MAX_AGENT_INSTRUCTIONS_CHARS },
      );
    }

    if (!isSystemAgentModel(fields.model)) {
      throw userWorkflowBadRequest(
        USER_WORKFLOW_ERROR_CODES.modelInvalid,
        'The workflow model is not available.',
      );
    }

    const perRun = fields.budgetPerRunCredits;
    const perDay = fields.budgetPerDayCredits;
    if (
      !isBudget(perRun) ||
      !isBudget(perDay) ||
      (perRun !== null && perDay !== null && perDay < perRun)
    ) {
      throw userWorkflowBadRequest(
        USER_WORKFLOW_ERROR_CODES.budgetInvalid,
        'The workflow budget is invalid.',
      );
    }

    const kinds = await this.ownerConnectionKinds(userId);
    const grants = userWorkflowGrants(
      {
        toolProfile: fields.toolProfile,
        knowledgeScopeIds: fields.knowledgeScopeIds,
        connectorToolIds: fields.connectorToolIds,
      },
      kinds,
    );

    if (grants.dropped.toolProfile !== null) {
      throw userWorkflowBadRequest(
        USER_WORKFLOW_ERROR_CODES.toolProfileNotAllowed,
        'A workflow is read-only.',
        { allowed: ['read'] },
      );
    }
    if (grants.dropped.knowledgeScopeIds.length > 0) {
      throw userWorkflowBadRequest(
        USER_WORKFLOW_ERROR_CODES.knowledgeScopeUnknown,
        'A knowledge folder is unknown.',
        { ids: grants.dropped.knowledgeScopeIds },
      );
    }
    if (grants.dropped.connectorToolIds.length > 0) {
      throw userWorkflowBadRequest(
        USER_WORKFLOW_ERROR_CODES.connectorToolUnknown,
        'A connector tool is unknown.',
        { ids: grants.dropped.connectorToolIds },
      );
    }
    const missing = grants.dropped.missingConnections.filter(
      (item) => !keptToolIds.includes(item.toolId),
    );
    if (missing.length > 0) {
      const missingKinds = [...new Set(missing.map((item) => item.kind))];
      throw userWorkflowBadRequest(
        USER_WORKFLOW_ERROR_CODES.connectionMissing,
        'Connect this account before you add its tool.',
        { kind: missingKinds[0], kinds: missingKinds },
      );
    }

    return {
      tone: spec.tone,
      replyLanguage: spec.replyLanguage,
      purpose: spec.purpose,
      procedure: spec.procedure,
      result: spec.result,
      toolProfile: grants.toolProfile,
      knowledgeScopeIds: grants.knowledgeScopeIds,
      connectorToolIds: allowlistedConnectorToolIds(fields.connectorToolIds),
      model: copyModel(fields.model),
      budgetPerRunCredits: perRun,
      budgetPerDayCredits: perDay,
    };
  }

  private computeInitials(name: string): string {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return words[0].substring(0, 2).toUpperCase();
  }
}
