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

/** A stored agent list is a front-door list: the Chief of Staff first, and at least one member. */
export function isFrontDoorRun(
  agents: readonly Pick<CollaborationListedAgent, 'name'>[] | null | undefined,
): boolean {
  return Array.isArray(agents) && agents.length > 1 && agents[0]?.name === FRONT_DOOR_LEAD_ID;
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
  if (members.length === 0) {
    return [{ name: FRONT_DOOR_LEAD_ID, instructions: leadInstructions }];
  }
  return [
    {
      name: FRONT_DOOR_LEAD_ID,
      instructions: leadInstructions,
      label: FRONT_DOOR_LEAD_LABEL,
      summary: FRONT_DOOR_LEAD_SUMMARY,
    },
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

function isLeadToMember(edge: { sourceProfileId: string; targetProfileId: string }): boolean {
  return (
    edge.sourceProfileId === FRONT_DOOR_LEAD_ID &&
    edge.targetProfileId !== FRONT_DOOR_LEAD_ID &&
    edge.targetProfileId !== FRONT_DOOR_USER_ID
  );
}

function isMemberToLead(edge: { sourceProfileId: string; targetProfileId: string }): boolean {
  return (
    edge.targetProfileId === FRONT_DOOR_LEAD_ID &&
    edge.sourceProfileId !== FRONT_DOOR_LEAD_ID &&
    edge.sourceProfileId !== FRONT_DOOR_USER_ID
  );
}

/**
 * D15/D16, consulted beside classifySendBackEdge. Only in a front-door run
 * (first target the Chief of Staff, more than one listed agent):
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
  firstTargetProfileId: string | null | undefined,
  agentsCount: number,
): FrontDoorEdge {
  if (firstTargetProfileId !== FRONT_DOOR_LEAD_ID || agentsCount < 2) {
    return 'ordinary';
  }
  const proposed = { sourceProfileId, targetProfileId };
  if (isMemberToLead(proposed)) {
    const dispatched = existing.some(
      (edge) => isLeadToMember(edge) && edge.targetProfileId === sourceProfileId,
    );
    const reported = existing.some(
      (edge) => isMemberToLead(edge) && edge.sourceProfileId === sourceProfileId,
    );
    return dispatched && !reported ? 'report_back' : 'ordinary';
  }
  if (isLeadToMember(proposed)) {
    const dispatches = existing.filter((edge) => isLeadToMember(edge)).length;
    if (dispatches >= MAX_FRONT_DOOR_ROUNDS) {
      return 'capped';
    }
    return existing.some((edge) => isMemberToLead(edge)) ? 'dispatch' : 'ordinary';
  }
  return 'ordinary';
}
