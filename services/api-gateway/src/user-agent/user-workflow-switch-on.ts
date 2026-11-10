import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { UserAgent } from '../entities/user-agent.entity';
import {
  CollaborationWorkflowService,
  WORKFLOW_REFUSAL_CODES,
  renderWorkflow,
  workflowNormalRunAllowed,
  workflowRefusal,
  type WorkflowUsage,
} from '../orchestration/collaboration-workflow';
import { UserWorkflowSwitchOnSlot, type UserWorkflowSwitchOnCheck } from './user-workflow-switch-on.port';

/** Reads the versions of a workflow that have a completed test run. */
export type WorkflowTestedVersionsReader = (
  userId: string,
  workflowId: string,
) => Promise<Pick<WorkflowUsage, 'testedVersions'>>;

/**
 * WORKFLOW-STATUS-02: the Team start gate's rule (D7), applied to a switch-on.
 * The row is rendered the way a run renders it; switching on is allowed only
 * when that version has a completed test run, exactly as a normal run needs.
 * A row that cannot render is refused as invalid, like the start gate does.
 */
export async function assertWorkflowCanSwitchOn(
  userId: string,
  row: UserAgent,
  readTestedVersions: WorkflowTestedVersionsReader,
): Promise<void> {
  const rendered = renderWorkflow(row);
  if (!rendered) {
    throw workflowRefusal(WORKFLOW_REFUSAL_CODES.invalid);
  }
  const usage = await readTestedVersions(userId, row.id);
  if (!workflowNormalRunAllowed('active', rendered.version, usage)) {
    throw workflowRefusal(WORKFLOW_REFUSAL_CODES.notTested);
  }
}

/**
 * WORKFLOW-STATUS-03: the real check, provided by OrchestrationModule.
 *
 * It is injected with the CollaborationWorkflowService instance that the Team
 * page uses, so the tested versions come from the same `usageFor`, and with
 * UserAgentModule's exported slot. When the module initialises it binds itself
 * to the slot, which UserAgentService reaches through
 * USER_WORKFLOW_SWITCH_ON_CHECK. Ordinary injection on both sides; no module
 * cycle and no provider cycle (see UserWorkflowSwitchOnSlot).
 */
@Injectable()
export class TestedWorkflowSwitchOnCheck implements UserWorkflowSwitchOnCheck, OnModuleInit {
  constructor(
    private readonly workflows: CollaborationWorkflowService,
    private readonly slot: UserWorkflowSwitchOnSlot,
  ) {}

  onModuleInit(): void {
    this.slot.bind(this);
  }

  async assertCanSwitchOn(userId: string, row: UserAgent): Promise<void> {
    await assertWorkflowCanSwitchOn(userId, row, (owner, workflowId) =>
      this.workflows.usageFor(owner, workflowId),
    );
  }
}
