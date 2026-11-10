import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { validate as uuidValidate } from 'uuid';
import type { UserAgent } from '../entities/user-agent.entity';
import {
  SYSTEM_AGENT_DEFINITIONS,
  systemAgentById,
  type SystemAgentDefinition,
} from '../system-agents/system-agent-registry';
import { UserAgentService } from '../user-agent/user-agent.service';
import { CollaborationRosterEntity } from './collaboration-roster.entity';
import {
  CollaborationWorkflowService,
  renderWorkflow,
  workflowNormalRunAllowed,
  workflowStatus,
} from './collaboration-workflow';
import type { CollaborationListedAgent, ReferralPendingWorkflow } from './orchestration.contracts';

/**
 * COS-FRONTDOOR-01 slice 01A: the owner's Chief of Staff roster.
 *
 * D6: a member is a system agent (active, read profile, a team role outside
 * coding, and not the Chief of Staff or the advisors lead) or one of the
 * owner's own workflows (`user_agents` rows, any status at save time).
 * D7: at most 3 members; the run's stored agent list holds at most 4 entries
 * and the Chief of Staff is one of them.
 * D9: the owner reads and saves only their own roster; a bad save is a 400
 * with a stable code and nothing is written.
 * D10: membersForStart re-checks every stored member and turns the usable
 * ones into agent-list entries (and workflow snapshots); the others are
 * left out and reported (DECISION F). Nothing calls it until slice 01B.
 */

export const MAX_ROSTER_MEMBERS = 3;
/** Longer than any system id (40) or UUID (36). */
export const ROSTER_MEMBER_ID_MAX_CHARS = 64;

/** Stable refusal codes for PUT /api/collaboration/roster. Every one is a 400. */
export const ROSTER_REFUSAL_CODES = {
  invalidBody: 'ROSTER_INVALID_BODY',
  tooMany: 'ROSTER_TOO_MANY',
  duplicate: 'ROSTER_DUPLICATE',
  unknown: 'ROSTER_MEMBER_UNKNOWN',
  notAllowed: 'ROSTER_MEMBER_NOT_ALLOWED',
  notFound: 'ROSTER_MEMBER_NOT_FOUND',
} as const;

export type RosterRefusalCode = (typeof ROSTER_REFUSAL_CODES)[keyof typeof ROSTER_REFUSAL_CODES];

export type RosterMemberKind = 'system' | 'workflow';

/**
 * Why a member cannot run now. `invalid` is a workflow that cannot run as
 * saved (renderWorkflow refuses it); D9 lists the other five.
 */
export type RosterMemberReason =
  | 'draft'
  | 'not_tested'
  | 'off'
  | 'missing'
  | 'coming_soon'
  | 'invalid';

export interface RosterMemberView {
  readonly id: string;
  readonly kind: RosterMemberKind;
  /** The workflow's name or the system agent's label; null when the member is gone. */
  readonly name: string | null;
  readonly usable: boolean;
  readonly reason: RosterMemberReason | null;
}

/** The body of GET and PUT /api/collaboration/roster. */
export interface RosterView {
  readonly members: RosterMemberView[];
  readonly choices: RosterMemberView[];
}

/** D10/D13: an agent-list entry with what the Chief of Staff reads about the member. */
export interface RosterListedAgent extends CollaborationListedAgent {
  readonly label: string;
  readonly summary: string;
}

/** D10: what slice 01B's start reads. Roster order is kept in every list. */
export interface RosterStartMembers {
  /** One entry per usable member; the Chief of Staff is not included. */
  readonly agents: RosterListedAgent[];
  /** One snapshot per usable workflow member, as prepareStart builds it, testRun false. */
  readonly rosterWorkflows: ReferralPendingWorkflow[];
  /** The usable member ids. */
  readonly used: string[];
  /** The members left out, with the reason. */
  readonly skipped: Array<{ id: string; reason: RosterMemberReason }>;
}

/** Leads that are never members: the Chief of Staff itself and the advisors lead. */
const ROSTER_EXCLUDED_SYSTEM_IDS: ReadonlySet<string> = new Set(['chief-of-staff', 'advisors-lead']);

/**
 * What the Chief of Staff reads about a system member (D13) and the name the
 * page shows. Every system candidate has an entry (the spec pins it).
 */
export const ROSTER_SYSTEM_MEMBER_TEXT: Readonly<Record<string, { label: string; summary: string }>> = {
  'product-strategy': {
    label: 'Product Strategy',
    summary: "Answers product and market questions from the owner's market documents.",
  },
  'technology-advisor': {
    label: 'Technology Advisor',
    summary:
      "Answers technology questions from the owner's technology landscape documents and the project files.",
  },
};

/** D6, the structural part: read profile, a team role outside coding, not a lead. */
export function isRosterSystemCandidate(definition: SystemAgentDefinition): boolean {
  return (
    definition.teamRole !== null &&
    definition.teamRole.teamId !== 'coding' &&
    !ROSTER_EXCLUDED_SYSTEM_IDS.has(definition.id) &&
    definition.toolProfile === 'read'
  );
}

/** The system agents a roster may hold today: candidates whose status is active. */
export function rosterSystemChoices(): SystemAgentDefinition[] {
  return SYSTEM_AGENT_DEFINITIONS.filter(
    (definition) => isRosterSystemCandidate(definition) && definition.status === 'active',
  );
}

function systemMemberText(definition: SystemAgentDefinition): { label: string; summary: string } {
  return ROSTER_SYSTEM_MEMBER_TEXT[definition.id] ?? { label: definition.id, summary: definition.purpose };
}

function isUuid(value: string): boolean {
  return uuidValidate(value);
}

/** UUIDs are compared lower-case; system ids are matched exactly. */
function normalizeMemberId(value: string): string {
  return isUuid(value) ? value.toLowerCase() : value;
}

function memberKind(id: string): RosterMemberKind {
  return isUuid(id) ? 'workflow' : 'system';
}

export function rosterRefusal(
  code: RosterRefusalCode,
  message: string,
  memberId?: string,
): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    message,
    error: 'Bad Request',
    code,
    ...(memberId !== undefined ? { memberId } : {}),
  });
}

/**
 * A stored member_ids value read fail-closed: strings only, normalised,
 * without repeats, at most MAX_ROSTER_MEMBERS. Anything else reads as empty.
 */
export function readStoredRosterMemberIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.length === 0 || entry.length > ROSTER_MEMBER_ID_MAX_CHARS) {
      continue;
    }
    const id = normalizeMemberId(entry);
    if (!ids.includes(id)) {
      ids.push(id);
    }
    if (ids.length === MAX_ROSTER_MEMBERS) {
      break;
    }
  }
  return ids;
}

/**
 * D9 shape check of a PUT memberIds value: a list of at most 3 non-empty
 * strings, without repeats. Returns the normalised ids in the given order.
 */
export function readRosterMemberIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw rosterRefusal(ROSTER_REFUSAL_CODES.invalidBody, 'memberIds must be a list of member ids');
  }
  if (value.length > MAX_ROSTER_MEMBERS) {
    throw rosterRefusal(
      ROSTER_REFUSAL_CODES.tooMany,
      `A roster holds at most ${MAX_ROSTER_MEMBERS} members`,
    );
  }
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.length === 0 || entry.length > ROSTER_MEMBER_ID_MAX_CHARS) {
      throw rosterRefusal(
        ROSTER_REFUSAL_CODES.invalidBody,
        `Each member id must be text of 1 to ${ROSTER_MEMBER_ID_MAX_CHARS} characters`,
      );
    }
    const id = normalizeMemberId(entry);
    if (ids.includes(id)) {
      throw rosterRefusal(ROSTER_REFUSAL_CODES.duplicate, 'A member is listed twice', entry);
    }
    ids.push(id);
  }
  return ids;
}

/** A body for PUT /api/collaboration/roster: exactly `{ memberIds }`. */
export function readRosterPutBody(body: unknown): unknown {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw rosterRefusal(ROSTER_REFUSAL_CODES.invalidBody, 'The body must be { memberIds }');
  }
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== 'memberIds') {
    throw rosterRefusal(ROSTER_REFUSAL_CODES.invalidBody, 'The body must be { memberIds }');
  }
  return (body as { memberIds: unknown }).memberIds;
}

function budgetOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null;
}

interface EvaluatedMember {
  readonly view: RosterMemberView;
  readonly agent: RosterListedAgent | null;
  readonly workflow: ReferralPendingWorkflow | null;
}

function unusable(
  id: string,
  kind: RosterMemberKind,
  name: string | null,
  reason: RosterMemberReason,
): EvaluatedMember {
  return { view: { id, kind, name, usable: false, reason }, agent: null, workflow: null };
}

@Injectable()
export class CollaborationRosterService {
  constructor(
    @InjectRepository(CollaborationRosterEntity)
    private readonly rosters: Repository<CollaborationRosterEntity>,
    private readonly userAgents: UserAgentService,
    private readonly workflows: CollaborationWorkflowService,
  ) {}

  /** The owner's stored member ids, or an empty list when there is no row. */
  async get(userId: string): Promise<string[]> {
    const row = await this.rosters.findOne({ where: { userId } });
    if (!row || row.userId !== userId) {
      return [];
    }
    return readStoredRosterMemberIds(row.memberIds);
  }

  /** GET body: the stored members with their state, and every member the owner may pick. */
  async view(userId: string): Promise<RosterView> {
    const memberIds = await this.get(userId);
    const rows = (await this.userAgents.listByUserId(userId)).filter((row) => row.userId === userId);
    const rowsById = new Map(rows.map((row) => [row.id.toLowerCase(), row]));
    const evaluated = new Map<string, EvaluatedMember>();
    const evaluateWorkflowOnce = async (id: string): Promise<EvaluatedMember> => {
      let result = evaluated.get(id);
      if (!result) {
        result = await this.evaluateWorkflow(userId, id, rowsById.get(id) ?? null);
        evaluated.set(id, result);
      }
      return result;
    };

    const members: RosterMemberView[] = [];
    for (const id of memberIds) {
      const member =
        memberKind(id) === 'workflow' ? await evaluateWorkflowOnce(id) : this.evaluateSystem(id);
      members.push(member.view);
    }

    const choices: RosterMemberView[] = rosterSystemChoices().map(
      (definition) => this.evaluateSystem(definition.id).view,
    );
    for (const row of rows) {
      choices.push((await evaluateWorkflowOnce(row.id.toLowerCase())).view);
    }
    return { members, choices };
  }

  /**
   * D9: replace the owner's roster. Every id is checked before anything is
   * written; a refusal is a 400 and the stored roster stays as it was.
   */
  async put(userId: string, memberIds: unknown): Promise<RosterView> {
    const ids = readRosterMemberIds(memberIds);
    for (const id of ids) {
      if (memberKind(id) === 'workflow') {
        const row = await this.userAgents.findOneByIdAndUserId(id, userId);
        if (!row || row.userId !== userId) {
          throw rosterRefusal(ROSTER_REFUSAL_CODES.notFound, 'Workflow not found', id);
        }
        continue;
      }
      const definition = systemAgentById(id);
      if (!definition) {
        throw rosterRefusal(ROSTER_REFUSAL_CODES.unknown, 'Unknown member', id);
      }
      if (!isRosterSystemCandidate(definition) || definition.status !== 'active') {
        throw rosterRefusal(
          ROSTER_REFUSAL_CODES.notAllowed,
          'This agent cannot be on the Chief of Staff roster',
          id,
        );
      }
    }
    await this.rosters.upsert({ userId, memberIds: ids, updatedAt: new Date() }, ['userId']);
    return this.view(userId);
  }

  /**
   * D10, for slice 01B's start: the stored members checked again now. A
   * system member must be active; a workflow member must be the owner's,
   * active, renderable and tested at its current version. Unusable members
   * are left out and reported (DECISION F). Budgets are not checked here:
   * approve checks them for each step (D19).
   */
  async membersForStart(userId: string): Promise<RosterStartMembers> {
    const agents: RosterListedAgent[] = [];
    const rosterWorkflows: ReferralPendingWorkflow[] = [];
    const used: string[] = [];
    const skipped: Array<{ id: string; reason: RosterMemberReason }> = [];
    for (const id of await this.get(userId)) {
      let member: EvaluatedMember;
      if (memberKind(id) === 'workflow') {
        const row = await this.userAgents.findOneByIdAndUserId(id, userId);
        member = await this.evaluateWorkflow(userId, id, row);
      } else {
        member = this.evaluateSystem(id);
      }
      if (!member.view.usable || !member.agent) {
        skipped.push({ id, reason: member.view.reason ?? 'missing' });
        continue;
      }
      agents.push(member.agent);
      if (member.workflow) {
        rosterWorkflows.push(member.workflow);
      }
      used.push(id);
    }
    return { agents, rosterWorkflows, used, skipped };
  }

  private evaluateSystem(id: string): EvaluatedMember {
    const definition = systemAgentById(id);
    if (!definition || !isRosterSystemCandidate(definition)) {
      return unusable(id, 'system', null, 'missing');
    }
    const text = systemMemberText(definition);
    if (definition.status !== 'active') {
      return unusable(
        id,
        'system',
        text.label,
        definition.status === 'coming_soon' ? 'coming_soon' : 'off',
      );
    }
    return {
      view: { id, kind: 'system', name: text.label, usable: true, reason: null },
      agent: {
        name: definition.id,
        instructions: definition.instructions,
        label: text.label,
        summary: text.summary,
      },
      workflow: null,
    };
  }

  private async evaluateWorkflow(
    userId: string,
    id: string,
    row: UserAgent | null,
  ): Promise<EvaluatedMember> {
    if (!row || row.userId !== userId || row.id.toLowerCase() !== id) {
      return unusable(id, 'workflow', null, 'missing');
    }
    const name = row.name;
    const status = workflowStatus(row.status);
    if (status === 'disabled') {
      return unusable(id, 'workflow', name, 'off');
    }
    if (status === 'draft') {
      return unusable(id, 'workflow', name, 'draft');
    }
    const rendered = renderWorkflow(row);
    if (!rendered) {
      return unusable(id, 'workflow', name, 'invalid');
    }
    const usage = await this.workflows.usageFor(userId, row.id);
    if (!workflowNormalRunAllowed(status, rendered.version, usage)) {
      return unusable(id, 'workflow', name, 'not_tested');
    }
    const model: ReferralPendingWorkflow['model'] =
      rendered.model.choice === 'platform'
        ? { choice: 'platform', id: rendered.model.id }
        : { choice: 'server' };
    return {
      view: { id, kind: 'workflow', name, usable: true, reason: null },
      agent: {
        name: row.id,
        instructions: rendered.instructions,
        label: row.name,
        summary: typeof row.description === 'string' ? row.description : '',
      },
      workflow: {
        id: row.id,
        name: row.name,
        version: rendered.version,
        knowledgeScopeIds: [...rendered.knowledgeScopeIds],
        connectorToolIds: [...rendered.connectorToolIds],
        model,
        testRun: false,
        budgetPerRunCredits: budgetOf(row.budgetPerRunCredits),
        budgetPerDayCredits: budgetOf(row.budgetPerDayCredits),
      },
    };
  }
}
