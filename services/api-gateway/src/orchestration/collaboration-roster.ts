import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { UserAgent } from '../entities/user-agent.entity';
import { systemAgentById } from '../system-agents/system-agent-registry';
import { UserAgentService } from '../user-agent/user-agent.service';
import {
  ROSTER_REFUSAL_CODES,
  assertRosterMemberIds,
  isRosterSystemCandidate,
  readRosterMemberIds,
  readStoredRosterMemberIds,
  rosterMemberKind,
  rosterRefusal,
  rosterSystemChoices,
  rosterSystemMemberText,
  type RosterMemberKind,
} from '../user-agent/user-workflow-rules';
import { CollaborationRosterEntity } from './collaboration-roster.entity';
import {
  CollaborationWorkflowService,
  renderWorkflow,
  workflowNormalRunAllowed,
  workflowStatus,
} from './collaboration-workflow';
import { MAX_AGENT_LABEL_CHARS, MAX_AGENT_SUMMARY_CHARS } from './handoff-request';
import type { CollaborationListedAgent, ReferralPendingWorkflow } from './orchestration.contracts';

// USER-TEAMS-01 D2: the member rule moved to user-agent/user-workflow-rules.ts so
// UserAgentService can share it without an import cycle; the names are unchanged.
export {
  MAX_ROSTER_MEMBERS,
  ROSTER_MEMBER_ID_MAX_CHARS,
  ROSTER_REFUSAL_CODES,
  ROSTER_SYSTEM_MEMBER_TEXT,
  assertRosterMemberIds,
  isRosterSystemCandidate,
  readRosterMemberIds,
  readStoredRosterMemberIds,
  rosterRefusal,
  rosterSystemChoices,
  type RosterMemberCheck,
  type RosterMemberKind,
  type RosterRefusalCode,
} from '../user-agent/user-workflow-rules';

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
 * USER-TEAMS-01 D6: evaluateMembers runs the same checks on any list of ids
 * (a workflow's team); membersForStart is evaluateMembers on the stored roster.
 */

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

/**
 * USER-TEAMS-01 D15: an agent-list text cut to the list's limit, so a long
 * workflow description never makes readCollaborationAgents refuse the list.
 * A cut never leaves half of a surrogate pair at the end.
 */
export function cutAgentListText(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  let cut = value.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) {
    cut = cut.slice(0, -1);
  }
  return cut;
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
        rosterMemberKind(id) === 'workflow' ? await evaluateWorkflowOnce(id) : this.evaluateSystem(id);
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
    await assertRosterMemberIds(ids, {
      userId,
      ownerRow: (id) => this.userAgents.findOneByIdAndUserId(id, userId),
      notAllowedMessage: 'This agent cannot be on the Chief of Staff roster',
    });
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
    return this.evaluateMembers(userId, await this.get(userId));
  }

  /**
   * USER-TEAMS-01 D6: the checks of membersForStart on a given list of member
   * ids (a workflow's team, for slice 01B's start). The list is read
   * fail-closed first (strings, normalised, no repeats, at most 3); order is
   * kept. Same checks, same reasons; nothing is written.
   */
  async evaluateMembers(userId: string, memberIds: unknown): Promise<RosterStartMembers> {
    const agents: RosterListedAgent[] = [];
    const rosterWorkflows: ReferralPendingWorkflow[] = [];
    const used: string[] = [];
    const skipped: Array<{ id: string; reason: RosterMemberReason }> = [];
    for (const id of readStoredRosterMemberIds(memberIds)) {
      let member: EvaluatedMember;
      if (rosterMemberKind(id) === 'workflow') {
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
    const text = rosterSystemMemberText(definition);
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
        // D15: cut to the agent list's limits (a description may hold 2000 characters).
        label: cutAgentListText(row.name, MAX_AGENT_LABEL_CHARS),
        summary: cutAgentListText(
          typeof row.description === 'string' ? row.description : '',
          MAX_AGENT_SUMMARY_CHARS,
        ),
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
