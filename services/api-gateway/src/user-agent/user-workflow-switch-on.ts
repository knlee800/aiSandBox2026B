import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { UserAgent } from '../entities/user-agent.entity';
import {
  CollaborationWorkflowService,
  WORKFLOW_REFUSAL_CODES,
  renderWorkflow,
  workflowNormalRunAllowed,
  workflowRefusal,
  type WorkflowUsage,
} from '../orchestration/collaboration-workflow';
import type { UserWorkflowSwitchOnCheck } from './user-workflow-switch-on.port';

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
 * Binds the port to the CollaborationWorkflowService instance that the Team
 * page uses, so the tested versions come from the same `usageFor`.
 *
 * OrchestrationModule imports UserAgentModule, so UserAgentModule cannot
 * import OrchestrationModule back. The service is looked up from the
 * application container at call time (`strict: false`) instead of being
 * injected, which needs no change under orchestration/. If it cannot be
 * found, the switch-on fails closed with 503.
 */
@Injectable()
export class TestedWorkflowSwitchOnCheck implements UserWorkflowSwitchOnCheck {
  private workflows: CollaborationWorkflowService | null = null;

  constructor(private readonly moduleRef: ModuleRef) {}

  async assertCanSwitchOn(userId: string, row: UserAgent): Promise<void> {
    const workflows = this.resolveWorkflows();
    await assertWorkflowCanSwitchOn(userId, row, (owner, workflowId) =>
      workflows.usageFor(owner, workflowId),
    );
  }

  private resolveWorkflows(): CollaborationWorkflowService {
    if (!this.workflows) {
      let found: CollaborationWorkflowService | undefined;
      try {
        found = this.moduleRef.get(CollaborationWorkflowService, { strict: false });
      } catch {
        found = undefined;
      }
      if (!found) {
        throw new ServiceUnavailableException('Workflow test results are not available');
      }
      this.workflows = found;
    }
    return this.workflows;
  }
}
