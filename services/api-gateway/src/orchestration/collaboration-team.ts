import type { CollaborationAgentIdentity, CollaborationListedAgent } from './orchestration.contracts';

/** Profile id of the human who starts a run from the collaboration page. */
export const COLLABORATION_USER_PROFILE_ID = 'user';

export const COLLABORATION_LEAD_PROFILE_ID = 'lead';
export const COLLABORATION_WRITER_PROFILE_ID = 'writer';
export const COLLABORATION_REVIEWER_PROFILE_ID = 'reviewer';

/**
 * Fixed team for the collaboration page.
 * Names are the hand-off targets. Instructions are server-owned.
 */
export const COLLABORATION_TEAM: readonly CollaborationListedAgent[] = [
  {
    name: COLLABORATION_LEAD_PROFILE_ID,
    instructions:
      'Read the project with your tools and decide what is needed. When the code looks wrong or a change is needed, ask writer to apply a fix. You cannot change files.',
  },
  {
    name: COLLABORATION_WRITER_PROFILE_ID,
    instructions:
      'Read the files you need. Apply the fix with write_file. You may run npm test, npm run build, or npx tsc --noEmit. Do not delete files. Then ask reviewer.',
  },
  {
    name: COLLABORATION_REVIEWER_PROFILE_ID,
    instructions:
      'Read the real files. Run npm test, npm run build, or npx tsc --noEmit when that checks the change. Name each real bug with an input that shows it. If you find a real bug, send the work back to writer with a specific list of what to fix. Otherwise give the verdict and finish. You cannot change files.',
  },
];

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
