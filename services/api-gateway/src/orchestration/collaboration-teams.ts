/**
 * Server-owned collaboration teams. Role bodies live in the system-agent
 * registry. A role is name, instructions, tool profile, and Knowledge scopes.
 * The model stays the server's choice and is not stored here.
 */

import { SYSTEM_AGENT_DEFINITIONS } from '../system-agents/system-agent-registry';

export {
  CHIEF_OF_STAFF_INSTRUCTIONS,
  CHIEF_OF_STAFF_KNOWLEDGE_SCOPE_IDS,
} from '../system-agents/system-agent-registry';

export const COLLABORATION_LEAD_PROFILE_ID = 'lead';
export const COLLABORATION_WRITER_PROFILE_ID = 'writer';
export const COLLABORATION_REVIEWER_PROFILE_ID = 'reviewer';
export const COLLABORATION_CHIEF_OF_STAFF_PROFILE_ID = 'chief-of-staff';

export const COLLABORATION_TEAM_IDS = ['coding', 'chief-of-staff', 'advisors'] as const;
export type CollaborationServerTeamId = (typeof COLLABORATION_TEAM_IDS)[number];

/**
 * BIZ-USER-01C D12: a run's team as the run list and detail report it. A run
 * whose first hand-off carries a workflow snapshot is `workflow`. A start body
 * can never name `workflow` (readCollaborationStartTeam refuses it).
 */
export const COLLABORATION_WORKFLOW_TEAM_ID = 'workflow';
export type CollaborationRunTeamId =
  | CollaborationServerTeamId
  | typeof COLLABORATION_WORKFLOW_TEAM_ID;

export type CollaborationTeamToolProfile = 'read' | 'review' | 'write';

export interface CollaborationTeamRole {
  readonly name: string;
  readonly instructions: string;
  readonly toolProfile: CollaborationTeamToolProfile;
  readonly knowledgeScopeIds: readonly string[];
}

export interface CollaborationTeamDefinition {
  readonly id: CollaborationServerTeamId;
  readonly roles: readonly CollaborationTeamRole[];
}

function rolesForTeam(teamId: CollaborationServerTeamId): CollaborationTeamRole[] {
  const roles: CollaborationTeamRole[] = [];
  for (const definition of SYSTEM_AGENT_DEFINITIONS) {
    const teamRole = definition.teamRole;
    if (!teamRole || teamRole.teamId !== teamId) {
      continue;
    }
    if (
      definition.toolProfile !== 'read' &&
      definition.toolProfile !== 'review' &&
      definition.toolProfile !== 'write'
    ) {
      throw new Error(`System agent ${definition.id} is missing a tool profile`);
    }
    roles.push({
      name: teamRole.roleName,
      instructions: definition.instructions,
      toolProfile: definition.toolProfile,
      knowledgeScopeIds: definition.knowledgeScopes.map((scope) => scope.id),
    });
  }
  return roles;
}

export const COLLABORATION_TEAMS: readonly CollaborationTeamDefinition[] = [
  {
    id: 'coding',
    roles: rolesForTeam('coding'),
  },
  {
    id: 'chief-of-staff',
    roles: rolesForTeam('chief-of-staff'),
  },
  {
    id: 'advisors',
    roles: rolesForTeam('advisors'),
  },
];

export function collaborationTeamById(
  teamId: CollaborationServerTeamId,
): CollaborationTeamDefinition {
  const team = COLLABORATION_TEAMS.find((entry) => entry.id === teamId);
  if (!team) {
    throw new Error(`Unknown collaboration team: ${teamId}`);
  }
  return team;
}

export function collaborationAgentsForTeam(
  teamId: CollaborationServerTeamId,
): Array<{ name: string; instructions: string }> {
  return collaborationTeamById(teamId).roles.map((role) => ({
    name: role.name,
    instructions: role.instructions,
  }));
}

/** Missing or undefined means coding. Any other value is rejected by the caller. */
export function readCollaborationStartTeam(value: unknown): CollaborationServerTeamId | null {
  if (value === undefined) {
    return 'coding';
  }
  if (value === 'coding' || value === 'chief-of-staff' || value === 'advisors') {
    return value;
  }
  return null;
}

/**
 * The run's team is the team whose first role is the first step's target.
 * A missing or unknown target stays the coding team. A first step that
 * carries a workflow snapshot for its own target is the workflow team of one.
 */
export function collaborationTeamForTarget(
  targetProfileId: string | null | undefined,
  workflow?: { readonly id: string } | null,
): {
  id: CollaborationRunTeamId;
  roleNames: readonly string[];
} {
  if (workflow && typeof targetProfileId === 'string' && workflow.id === targetProfileId) {
    return { id: COLLABORATION_WORKFLOW_TEAM_ID, roleNames: [workflow.id] };
  }
  const matched = COLLABORATION_TEAMS.find((team) => team.roles[0]?.name === targetProfileId);
  const team = matched ?? collaborationTeamById('coding');
  return {
    id: team.id,
    roleNames: team.roles.map((role) => role.name),
  };
}

export function collaborationRoleKnowledgeScopes(): Readonly<Record<string, readonly string[]>> {
  const scopes: Record<string, readonly string[]> = {};
  for (const team of COLLABORATION_TEAMS) {
    for (const role of team.roles) {
      if (role.knowledgeScopeIds.length > 0) {
        scopes[role.name] = role.knowledgeScopeIds;
      }
    }
  }
  return scopes;
}

/** Roles outside the coding team. An answer with no valid source is labelled for these. */
export function businessRoleProfileIds(): readonly string[] {
  const ids: string[] = [];
  for (const team of COLLABORATION_TEAMS) {
    if (team.id === 'coding') {
      continue;
    }
    for (const role of team.roles) {
      ids.push(role.name);
    }
  }
  return ids;
}
