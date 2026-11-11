import {
  MAX_FRONT_DOOR_ROUNDS,
  type CollaborationListedAgent,
} from './orchestration.contracts';

/**
 * COS-FRONTDOOR-01B: the Chief of Staff front door, pure parts.
 *
 * A front-door run is a chief-of-staff team start whose stored agent list
 * holds the Chief of Staff first and at least one roster member (D10). With
 * an empty roster the list is the Chief of Staff alone and the run is
 * today's one-role run (D3): nothing here applies to it.
 *
 * USER-TEAMS-01B D4, D5: the same parts with the lead as a parameter, so a
 * user workflow with a stored team leads its run the same way. The run's lead
 * is `teamLeadId` on pending_job (leadIdOf), set by the server only.
 */

export const FRONT_DOOR_LEAD_ID = 'chief-of-staff';

/** The user who starts a run is never a roster member or a report-back source. */
const FRONT_DOOR_USER_ID = 'user';

/** What the members read about the Chief of Staff (D13). The Chief of Staff never reads its own line. */
export const FRONT_DOOR_LEAD_LABEL = 'Chief of Staff';
export const FRONT_DOOR_LEAD_SUMMARY =
  'Leads this run for the owner. Your answer goes back to the Chief of Staff, who writes the final answer.';

/** D14: the agent's answer is included whole up to this many characters. */
export const REPORT_BACK_ANSWER_MAX_CHARS = 12000;
export const REPORT_BACK_ANSWER_CUT = '[answer cut]';

export type FrontDoorEdge = 'report_back' | 'dispatch' | 'capped' | 'ordinary';

export interface FrontDoorGraphEdge {
  readonly sourceProfileId: string;
  readonly targetProfileId: string;
  readonly createdAtMs: number;
}

export interface FrontDoorMember {
  readonly name: string;
  readonly instructions: string;
  readonly label: string;
  readonly summary: string;
}

/** D14 idempotency key of the report-back for one agent step. */
export function reportBackIdempotencyKey(agentReferralId: string): string {
  return `report-back:${agentReferralId}`;
}

/**
 * USER-TEAMS-01B D5: a stored agent list is a team list when the given lead is
 * first and at least one member follows. The lead is the Chief of Staff or a
 * user workflow (its row id).
 */
export function isTeamRun(
  agents: readonly Pick<CollaborationListedAgent, 'name'>[] | null | undefined,
  leadId: string | null | undefined,
): boolean {
  return (
    typeof leadId === 'string' &&
    leadId.length > 0 &&
    Array.isArray(agents) &&
    agents.length > 1 &&
    agents[0]?.name === leadId
  );
}

/** A stored agent list is a front-door list: the Chief of Staff first, and at least one member. */
export function isFrontDoorRun(
  agents: readonly Pick<CollaborationListedAgent, 'name'>[] | null | undefined,
): boolean {
  return isTeamRun(agents, FRONT_DOOR_LEAD_ID);
}

/**
 * USER-TEAMS-01B D4: the lead of a stored step's run. `teamLeadId` is set by
 * the server on the first hand-off and copied to every child; it counts only
 * when it is the first listed agent. A row stored before teamLeadId existed
 * falls back to the Chief of Staff rule. Null when the run is no team run.
 */
export function leadIdOf(
  job:
    | {
        readonly agents?: readonly Pick<CollaborationListedAgent, 'name'>[] | null;
        readonly teamLeadId?: unknown;
      }
    | null
    | undefined,
): string | null {
  const agents = job?.agents;
  const stored = job?.teamLeadId;
  if (typeof stored === 'string' && isTeamRun(agents, stored)) {
    return stored;
  }
  return isFrontDoorRun(agents) ? FRONT_DOOR_LEAD_ID : null;
}

/** USER-TEAMS-01B D5: what the members read about a workflow lead. */
export function teamLeadSummary(leadLabel: string): string {
  return `Leads this run for the owner. Your answer goes back to ${leadLabel}, who writes the final answer.`;
}

/** D10/D13: a roster member as an agent-list entry with its label and summary. */
export function rosterMemberToListedAgent(member: FrontDoorMember): CollaborationListedAgent {
  return {
    name: member.name,
    instructions: member.instructions,
    label: member.label,
    summary: member.summary,
  };
}

/**
 * The agent list of a chief-of-staff team start. No members: exactly
 * today's one entry, with no label or summary (D3). With members: the
 * Chief of Staff first with its label, then the members in roster order.
 */
export function frontDoorAgentList(
  leadInstructions: string,
  members: readonly FrontDoorMember[],
): CollaborationListedAgent[] {
  return teamAgentList(
    {
      name: FRONT_DOOR_LEAD_ID,
      instructions: leadInstructions,
      label: FRONT_DOOR_LEAD_LABEL,
      summary: FRONT_DOOR_LEAD_SUMMARY,
    },
    members,
  );
}

/**
 * USER-TEAMS-01B D5, D6: the agent list of a team start with the given lead.
 * No members: exactly today's one entry, with no label or summary. With
 * members: the lead first with its label and summary, then the members in
 * team order.
 */
export function teamAgentList(
  lead: FrontDoorMember,
  members: readonly FrontDoorMember[],
): CollaborationListedAgent[] {
  if (members.length === 0) {
    return [{ name: lead.name, instructions: lead.instructions }];
  }
  return [
    rosterMemberToListedAgent(lead),
    ...members.map((member) => rosterMemberToListedAgent(member)),
  ];
}

/** D14: the report-back task the Chief of Staff gets after an agent finished. */
export function buildReportBackPrompt(input: {
  ownerTask: string;
  label: string;
  answer: string;
}): string {
  const answer =
    input.answer.length > REPORT_BACK_ANSWER_MAX_CHARS
      ? `${input.answer.slice(0, REPORT_BACK_ANSWER_MAX_CHARS)}\n${REPORT_BACK_ANSWER_CUT}`
      : input.answer;
  return (
    `The owner asked:\n${input.ownerTask}\n\n` +
    `${input.label} answered:\n${answer}\n\n` +
    'Write the final answer for the owner. Keep the [source: …] markers of the claims you use. ' +
    'If you still need another listed agent, end with one hand-off request; otherwise no request.'
  );
}

function isLeadToMember(
  edge: { sourceProfileId: string; targetProfileId: string },
  leadId: string,
): boolean {
  return (
    edge.sourceProfileId === leadId &&
    edge.targetProfileId !== leadId &&
    edge.targetProfileId !== FRONT_DOOR_USER_ID
  );
}

function isMemberToLead(
  edge: { sourceProfileId: string; targetProfileId: string },
  leadId: string,
): boolean {
  return (
    edge.targetProfileId === leadId &&
    edge.sourceProfileId !== leadId &&
    edge.sourceProfileId !== FRONT_DOOR_USER_ID
  );
}

/**
 * D15/D16, consulted beside classifySendBackEdge. Only in a team run (the
 * run's lead given, more than one listed agent). USER-TEAMS-01B D5: the lead
 * is a parameter, the Chief of Staff or a user workflow:
 * - `report_back`: a member back to the Chief of Staff, after the Chief of
 *   Staff dispatched to that member and before the member reported back.
 *   Exempt from the depth and loop checks.
 * - `dispatch`: the Chief of Staff to a member once a report-back exists
 *   (the dispatch from a report-back step). Exempt from the depth check
 *   only; the loop check stays, so each member runs at most once.
 * - `capped`: a dispatch beyond MAX_FRONT_DOOR_ROUNDS.
 * Everything else, including the first dispatch from the first step, is
 * `ordinary` and keeps every check.
 */
export function classifyFrontDoorEdge(
  sourceProfileId: string,
  targetProfileId: string,
  existing: readonly FrontDoorGraphEdge[],
  leadId: string | null | undefined,
  agentsCount: number,
): FrontDoorEdge {
  if (typeof leadId !== 'string' || leadId.length === 0 || leadId === FRONT_DOOR_USER_ID) {
    return 'ordinary';
  }
  if (agentsCount < 2) {
    return 'ordinary';
  }
  const lead = leadId;
  const proposed = { sourceProfileId, targetProfileId };
  if (isMemberToLead(proposed, lead)) {
    const dispatched = existing.some(
      (edge) => isLeadToMember(edge, lead) && edge.targetProfileId === sourceProfileId,
    );
    const reported = existing.some(
      (edge) => isMemberToLead(edge, lead) && edge.sourceProfileId === sourceProfileId,
    );
    return dispatched && !reported ? 'report_back' : 'ordinary';
  }
  if (isLeadToMember(proposed, lead)) {
    const dispatches = existing.filter((edge) => isLeadToMember(edge, lead)).length;
    if (dispatches >= MAX_FRONT_DOOR_ROUNDS) {
      return 'capped';
    }
    return existing.some((edge) => isMemberToLead(edge, lead)) ? 'dispatch' : 'ordinary';
  }
  return 'ordinary';
}
