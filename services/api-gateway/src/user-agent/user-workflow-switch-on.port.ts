import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { UserAgent } from '../entities/user-agent.entity';

/**
 * WORKFLOW-STATUS-02: the check UserAgentService runs before it stores a
 * switch to `active` on a row that is not active yet. It throws the refusal
 * (409 with a stable code) when the row may not be switched on.
 *
 * This file imports nothing from orchestration/, so user-agent.service.ts can
 * depend on it without an import cycle (collaboration-workflow.ts imports
 * user-agent.service.ts). The implementation lives in
 * user-workflow-switch-on.ts and is provided by OrchestrationModule.
 */
export interface UserWorkflowSwitchOnCheck {
  /** `row` is the row as it will be saved: stored values merged with the PATCH. */
  assertCanSwitchOn(userId: string, row: UserAgent): Promise<void>;
}

export const USER_WORKFLOW_SWITCH_ON_CHECK = Symbol('USER_WORKFLOW_SWITCH_ON_CHECK');

/**
 * WORKFLOW-STATUS-03: the port's binding on the user-agent side.
 *
 * UserAgentModule provides this slot for USER_WORKFLOW_SWITCH_ON_CHECK and
 * exports it. OrchestrationModule, which already imports UserAgentModule,
 * provides the real check (injected with CollaborationWorkflowService) and
 * binds it here when the module initialises.
 *
 * The real check cannot be injected into UserAgentService directly:
 * CollaborationWorkflowService injects UserAgentService, so that would be a
 * provider cycle (UserAgentService -> check -> CollaborationWorkflowService ->
 * UserAgentService) needing forwardRef. With the slot, the provider graph is
 * acyclic and UserAgentModule does not import OrchestrationModule.
 *
 * Fail closed: until a check is bound, every switch-on is refused with 503.
 */
@Injectable()
export class UserWorkflowSwitchOnSlot implements UserWorkflowSwitchOnCheck {
  private bound: UserWorkflowSwitchOnCheck | null = null;

  /** Binds the check once; a second, different check is refused. */
  bind(check: UserWorkflowSwitchOnCheck): void {
    if (this.bound && this.bound !== check) {
      throw new Error('USER_WORKFLOW_SWITCH_ON_CHECK is already bound');
    }
    this.bound = check;
  }

  async assertCanSwitchOn(userId: string, row: UserAgent): Promise<void> {
    if (!this.bound) {
      throw new ServiceUnavailableException('Workflow test results are not available');
    }
    await this.bound.assertCanSwitchOn(userId, row);
  }
}
