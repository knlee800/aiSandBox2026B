import type { UserAgent } from '../entities/user-agent.entity';

/**
 * WORKFLOW-STATUS-02: the check UserAgentService runs before it stores a
 * switch to `active` on a row that is not active yet. It throws the refusal
 * (409 with a stable code) when the row may not be switched on.
 *
 * This file imports nothing from orchestration/, so user-agent.service.ts can
 * depend on it without an import cycle (collaboration-workflow.ts imports
 * user-agent.service.ts). The implementation lives in
 * user-workflow-switch-on.ts and is bound in UserAgentModule.
 */
export interface UserWorkflowSwitchOnCheck {
  /** `row` is the row as it will be saved: stored values merged with the PATCH. */
  assertCanSwitchOn(userId: string, row: UserAgent): Promise<void>;
}

export const USER_WORKFLOW_SWITCH_ON_CHECK = Symbol('USER_WORKFLOW_SWITCH_ON_CHECK');
