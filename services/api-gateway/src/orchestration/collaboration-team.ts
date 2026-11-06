import type { CollaborationAgentIdentity, CollaborationListedAgent } from './orchestration.contracts';
import {
  COLLABORATION_LEAD_PROFILE_ID,
  COLLABORATION_REVIEWER_PROFILE_ID,
  COLLABORATION_WRITER_PROFILE_ID,
  collaborationAgentsForTeam,
} from './collaboration-teams';

export {
  COLLABORATION_LEAD_PROFILE_ID,
  COLLABORATION_REVIEWER_PROFILE_ID,
  COLLABORATION_WRITER_PROFILE_ID,
};

/** Profile id of the human who starts a run from the collaboration page. */
export const COLLABORATION_USER_PROFILE_ID = 'user';

/**
 * Coding team for the collaboration page.
 * Names are the hand-off targets. Instructions are server-owned.
 * Equal to the coding roles in the team registry.
 */
export const COLLABORATION_TEAM: readonly CollaborationListedAgent[] =
  collaborationAgentsForTeam('coding');

/** Added to the writer job only when the reviewer sent the work back. */
export const COLLABORATION_SEND_BACK_WRITER_INSTRUCTION =
  'This work was sent back. Fix only the listed items, then hand it to reviewer.';

export const COLLABORATION_PAGE_AGENT_ROLE = 'builder' as const;

export const COLLABORATION_USER_ACTOR: CollaborationAgentIdentity = {
  agentRole: COLLABORATION_PAGE_AGENT_ROLE,
  builderProfileId: COLLABORATION_USER_PROFILE_ID,
};

export const COLLABORATION_LEAD_ACTOR: CollaborationAgentIdentity = {
  agentRole: COLLABORATION_PAGE_AGENT_ROLE,
  builderProfileId: COLLABORATION_LEAD_PROFILE_ID,
};

/** Runs returned by the login list route. */
export const COLLABORATION_RUN_LIST_LIMIT = 20;

/** Cap for the task the page sends. The browser cannot raise it. */
export const COLLABORATION_USER_TASK_MAX_CHARS = 8000;

/**
 * Stored when the page rejects a step without a reason.
 * OrchestrationService.rejectReferral requires a non-empty reason.
 */
export const COLLABORATION_OMITTED_REJECT_REASON = 'omitted';
